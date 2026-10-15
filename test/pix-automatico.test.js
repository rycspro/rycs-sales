import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import Database from "better-sqlite3";
import { subirServidor, assinar, cliente } from "./apoio/servidor.js";
import { primeiroDebitoPixAutomatico } from "../shared/assinatura.js";

// Pix Automático na etapa 5 do onboarding, contra o servidor de verdade e um
// Asaas falso local (ASAAS_BASE_URL_TESTE só vale com NODE_ENV=test).

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function servidorFalso(t, responder) {
  const s = http.createServer((req, res) => {
    let corpo = "";
    req.on("data", (d) => { corpo += d; });
    req.on("end", () => {
      const [status, json] = responder(req, corpo ? JSON.parse(corpo) : null);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(json));
    });
  });
  s.listen(0);
  t.after(() => s.close());
  return `http://127.0.0.1:${s.address().port}`;
}

test("primeiro débito do Pix Automático: fim do trial, com pelo menos 3 dias úteis", () => {
  const dia = (iso, trial) => primeiroDebitoPixAutomatico({ trialDias: trial }, Date.parse(iso)).toISOString().slice(0, 10);
  assert.equal(dia("2026-10-12T13:00:00Z", 3), "2026-10-15"); // segunda → quinta
  assert.equal(dia("2026-10-15T13:00:00Z", 3), "2026-10-20"); // quinta: domingo passa para terça
  assert.equal(dia("2026-10-15T13:00:00Z", 0), "2026-10-20"); // sem trial, mesma regra mínima
  assert.equal(dia("2026-10-15T13:00:00Z", 7), "2026-10-22");
});

test("Pix Automático: R$ 1,00 de ativação, autorização, débito agendado e etapa concluída", async (t) => {
  let ativa = false;
  const autorizacoes = [];
  const baseAsaas = servidorFalso(t, (req, corpo) => {
    if (req.url.startsWith("/customers")) return [200, { id: "cus_pix" }];
    if (req.url === "/pix/automatic/authorizations" && req.method === "POST") {
      autorizacoes.push(corpo);
      return [200, { id: "aut_1", status: "CREATED", payload: "00020101PIXAUTOMATICO", encodedImage: PNG, immediateQrCode: { expirationDate: "2026-10-16 10:00:00" } }];
    }
    if (req.url === "/pix/automatic/authorizations/aut_1" && req.method === "GET")
      return [200, ativa ? { id: "aut_1", status: "ACTIVE", subscriptionId: "sub_asaas_1" } : { id: "aut_1", status: "CREATED" }];
    return [404, { errors: [{ description: "rota falsa inexistente" }] }];
  });

  const { base, dbPath } = await subirServidor(t, { ASAAS_API_KEY: "chave-falsa", ASAAS_BASE_URL_TESTE: baseAsaas, ASAAS_WEBHOOK_TOKEN: "tok" });
  const req = cliente(base);
  const db = new Database(dbPath);
  t.after(() => db.close());
  const webhook = (body) => req("/payments/webhook", { body, headers: { "asaas-access-token": "tok" } });

  // Etapas 1 a 4: convite com trial e estratégias aprovadas (motor interno).
  let r = await req("/admin/onboarding-convites", { cookie: assinar({ id: "admin-teste", role: "admin", entityId: null }), body: { email: "pix@exemplo.invalid", comTrial: true } });
  const token = r.corpo.url.split("/comecar/")[1];
  r = await req("/auth/register", { body: { role: "empresa", email: "pix@exemplo.invalid", senha: "12345678", whats: "11912345678", nome: "Pix SA", logo: { mimetype: "image/png", base64: PNG }, aceitouTermos: true, convite: token } });
  const ck = r.cookie;
  await req("/onboarding/empresa", { cookie: ck, body: { nome: "Pix SA", produto: "Consultoria", publico: "PMEs", concluir: true } });
  await req("/onboarding/academy/concluir", { cookie: ck, body: {} });
  for (let i = 0; i < 60; i++) {
    if ((await req("/onboarding/ia", { cookie: ck })).corpo.geracao?.status === "pronta") break;
    await esperar(300);
  }
  r = await req("/onboarding/ia/aprovar-tudo", { cookie: ck, body: {} });
  assert.equal(r.corpo.atual, "plano");
  const plano = (await req("/onboarding/plano", { cookie: ck })).corpo.planos[0];

  // Checkout: autorização no modo SUBSCRIPTION, R$ 1,00 agora, mensalidade no primeiro débito.
  r = await req("/subscription", { cookie: ck, body: { plano: plano.chave, onboarding: true, formaPagamento: "PIX_AUTOMATICO", titular: { documento: "12345678909" } } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.status, "aguardando_autorizacao");
  assert.equal(r.corpo.pixCopiaECola, "00020101PIXAUTOMATICO");
  const pedido = autorizacoes[0];
  assert.equal(pedido.customerId, "cus_pix");
  assert.equal(pedido.paymentCreationMode, "SUBSCRIPTION");
  assert.equal(pedido.frequency, "MONTHLY");
  assert.equal(pedido.value, plano.preco);
  assert.equal(pedido.immediateQrCode.originalValue, 1);
  assert.equal(pedido.startDate, primeiroDebitoPixAutomatico({ trialDias: 3 }).toISOString().slice(0, 10));
  assert.ok(pedido.contractId.length <= 35 && pedido.description.length <= 35);

  // Ainda não autorizado: a etapa não conclui.
  r = await req("/subscription/pix-automatico", { cookie: ck });
  assert.equal(r.corpo.status, "aguardando_autorizacao");
  assert.equal((await req("/onboarding", { cookie: ck })).corpo.atual, "plano");

  // O Pix de R$ 1,00 chega como cobrança avulsa: não vira saldo de campanha.
  await webhook({ id: "evt_pg", event: "PAYMENT_RECEIVED", payment: { id: "pay_ativacao", customer: "cus_pix", value: 1, billingType: "PIX" } });
  const empresaId = db.prepare("SELECT entityId FROM users WHERE email = 'pix@exemplo.invalid'").get().entityId;
  assert.equal(db.prepare("SELECT saldo FROM companies WHERE id = ?").get(empresaId).saldo, 0);

  // Banco confirmou: o webhook ativa (conferindo na API) e a etapa conclui.
  ativa = true;
  await webhook({ id: "evt_aut", event: "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED", authorization: { id: "aut_1", status: "ACTIVE" } });
  for (let i = 0; i < 20 && (await req("/subscription/pix-automatico", { cookie: ck })).corpo.status !== "autorizada"; i++) await esperar(200);
  const sub = db.prepare("SELECT * FROM subscriptions WHERE companyId = ?").get(empresaId);
  assert.deepEqual([sub.status, sub.asaasId, sub.formaPagamento], ["trial", "sub_asaas_1", "PIX_AUTOMATICO"]);
  assert.equal(db.prepare("SELECT assinatura FROM companies WHERE id = ?").get(empresaId).assinatura, plano.chave);
  assert.equal((await req("/onboarding", { cookie: ck })).corpo.atual, "campanha");

  // Primeiro débito confirmado: assinatura ativa pelo fluxo de sempre.
  await webhook({ id: "evt_deb", event: "PAYMENT_CONFIRMED", payment: { id: "pay_mes1", customer: "cus_pix", value: plano.preco, subscription: "sub_asaas_1" } });
  assert.equal(db.prepare("SELECT status FROM subscriptions WHERE id = ?").get(sub.id).status, "ativa");

  // Pagador cancelou a autorização no banco: próximo débito não acontece.
  await webhook({ id: "evt_cancel", event: "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED", authorization: { id: "aut_1", cancellationReason: "PAYER_REQUEST" } });
  const depois = db.prepare("SELECT status, falhaMotivo FROM subscriptions WHERE id = ?").get(sub.id);
  assert.equal(depois.status, "inadimplente");
  assert.match(depois.falhaMotivo, /cancelada/);
});

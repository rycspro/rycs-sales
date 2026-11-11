import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";

const dir = mkdtempSync(join(tmpdir(), "rycs-stripe-"));
Object.assign(process.env, {
  DB_PATH: join(dir, "test.db"), JWT_SECRET: "segredo-teste-stripe", NODE_ENV: "test",
  STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_teste", PUBLIC_URL: "https://app.rycs.pro",
  RESEND_API_KEY: "", ANTHROPIC_API_KEY: "",
});
const st = await import("../server/services/stripe.js");
const { default: db } = await import("../server/db.js");
test.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

const ts = Date.now();
db.prepare("INSERT INTO companies (id, nome, produto, criadoEm) VALUES ('emp1', 'Acme Inc', 'CRM', ?)").run(ts);
db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES ('u-emp', 'ceo@acme.invalid', 'x', 'empresa', 'emp1', ?)").run(ts);

// API do Stripe falsa: guarda as chamadas e responde por caminho.
const chamadas = [];
let respostas = {};
st.usarFetch(async (url, op = {}) => {
  const caminho = new URL(url).pathname.replace(/^\/v1/, "");
  chamadas.push({ caminho, metodo: op.method, corpo: new URLSearchParams(op.body || ""), headers: op.headers });
  const r = typeof respostas[caminho] === "function" ? respostas[caminho](op) : respostas[caminho];
  if (!r) return { ok: false, status: 404, json: async () => ({ error: { message: "não mockado " + caminho, code: "resource_missing" } }) };
  return { ok: !r.error, status: r.error ? 400 : 200, json: async () => r };
});

const contar = (sql, ...a) => db.prepare(sql).get(...a).n;
const sub = (id) => db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(id);
const empresa = () => db.prepare("SELECT * FROM companies WHERE id = 'emp1'").get();
let nEvt = 0;
const evento = (type, object) => ({ id: `evt_${++nEvt}`, type, data: { object } });

function novaAssinatura(id, plano = "growth") {
  db.prepare(`INSERT INTO subscriptions (id, companyId, plano, status, valor, criadoEm, formaPagamento, gateway, moeda, ciclo)
              VALUES (?, 'emp1', ?, 'pendente', 799, ?, 'STRIPE', 'stripe', 'USD', 'MENSAL')`).run(id, plano, Date.now());
}

test("corpo no formato do Stripe", () => {
  const f = st.formulario({ a: 1, b: { c: "x", d: [{ e: 2 }] }, z: undefined });
  assert.equal(decodeURIComponent(f.toString()), "a=1&b[c]=x&b[d][0][e]=2");
});

test("assinatura do webhook: confere, recusa adulterado e antigo", () => {
  const corpo = Buffer.from('{"id":"evt_1"}');
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", "whsec_teste").update(`${t}.${corpo}`).digest("hex");
  assert.equal(st.assinaturaValida(corpo, `t=${t},v1=${v1}`), true);
  assert.equal(st.assinaturaValida(Buffer.from('{"id":"evt_2"}'), `t=${t},v1=${v1}`), false);
  assert.equal(st.assinaturaValida(corpo, `t=${t - 600},v1=${createHmac("sha256", "whsec_teste").update(`${t - 600}.${corpo}`).digest("hex")}`), false);
  assert.equal(st.assinaturaValida(corpo, undefined), false);
});

test("checkout em dólar: mesmos números do plano, trial e retorno seguro", async () => {
  respostas["/customers"] = { id: "cus_1" };
  respostas["/checkout/sessions"] = { id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" };
  novaAssinatura("s1");
  const r = await st.criarCheckoutAssinatura({ empresa: empresa(), email: "ceo@acme.invalid", subId: "s1", chave: "growth", trialDias: 5, retorno: "https://evil.com" });
  assert.equal(r.url, "https://checkout.stripe.com/c/cs_1");
  const c = chamadas.find((x) => x.caminho === "/checkout/sessions").corpo;
  assert.equal(c.get("mode"), "subscription");
  assert.equal(c.get("line_items[0][price_data][currency]"), "usd");
  assert.equal(c.get("line_items[0][price_data][unit_amount]"), "79900");
  assert.equal(c.get("line_items[0][price_data][recurring][interval]"), "month");
  assert.equal(c.get("subscription_data[trial_period_days]"), "5");
  assert.equal(c.get("subscription_data[metadata][subId]"), "s1");
  assert.equal(c.get("success_url"), "https://app.rycs.pro/plataforma?stripe=ok");
  assert.equal(c.get("payment_method_types[0]"), null); // métodos do painel (cartão, UPI…)
  assert.equal(empresa().stripeCustomerId, "cus_1");
  assert.equal(sub("s1").stripeSessionId, "cs_1");
});

test("anual cobra 12 meses com desconto, intervalo de ano", async () => {
  novaAssinatura("s-anual", "starter");
  chamadas.length = 0;
  await st.criarCheckoutAssinatura({ empresa: empresa(), subId: "s-anual", chave: "starter", ciclo: "ANUAL", retorno: "/onboarding/plano" });
  const c = chamadas.find((x) => x.caminho === "/checkout/sessions").corpo;
  assert.equal(c.get("line_items[0][price_data][unit_amount]"), String(Math.round(399 * 0.7 * 12 * 100)));
  assert.equal(c.get("line_items[0][price_data][recurring][interval]"), "year");
  assert.equal(c.get("cancel_url"), "https://app.rycs.pro/onboarding/plano?stripe=cancelado");
  assert.equal(chamadas.filter((x) => x.caminho === "/customers").length, 0); // reaproveita o cliente
});

test("checkout concluído com trial libera o plano como trial", async () => {
  const fim = Math.floor(Date.now() / 1000) + 5 * 86400;
  respostas["/subscriptions/sub_1"] = { id: "sub_1", status: "trialing", trial_end: fim };
  await st.processarEvento(evento("checkout.session.completed", { id: "cs_1", mode: "subscription", subscription: "sub_1", customer: "cus_1", client_reference_id: "s1", metadata: { subId: "s1" } }));
  assert.equal(sub("s1").status, "trial");
  assert.equal(sub("s1").stripeSubscriptionId, "sub_1");
  assert.equal(sub("s1").trialFim, fim * 1000);
  assert.equal(empresa().assinatura, "growth");
  assert.equal(contar("SELECT COUNT(*) n FROM notifications WHERE userId = 'u-emp' AND titulo LIKE '%liberado%'"), 1);
});

test("fatura zerada do trial é ignorada; fatura paga ativa (formato novo da API)", async () => {
  await st.processarEvento(evento("invoice.paid", { amount_paid: 0, subscription: "sub_1" }));
  assert.equal(sub("s1").status, "trial");
  const fim = Math.floor(Date.now() / 1000) + 30 * 86400;
  await st.processarEvento(evento("invoice.paid", { amount_paid: 79900, parent: { subscription_details: { subscription: "sub_1" } }, lines: { data: [{ period: { end: fim } }] } }));
  assert.equal(sub("s1").status, "ativa");
  assert.equal(sub("s1").proximaCobranca, fim * 1000);
});

test("aviso repetido é tratado uma vez só", async () => {
  const e = evento("invoice.payment_failed", { subscription: "sub_1", billing_reason: "subscription_cycle" });
  await st.processarEvento(e);
  const r = await st.processarEvento(e);
  assert.equal(r.duplicado, true);
  assert.equal(sub("s1").status, "inadimplente");
  assert.equal(contar("SELECT COUNT(*) n FROM notifications WHERE userId = 'u-emp' AND titulo LIKE 'Não conseguimos%'"), 1);
});

test("cartão atualizado no portal volta a ativar", async () => {
  await st.processarEvento(evento("customer.subscription.updated", { id: "sub_1", status: "active", items: { data: [{ current_period_end: 1900000000 }] } }));
  assert.equal(sub("s1").status, "ativa");
  assert.equal(sub("s1").proximaCobranca, 1900000000 * 1000);
});

test("falha no tratamento libera o aviso para o Stripe reenviar", async () => {
  novaAssinatura("s2");
  respostas["/subscriptions/sub_2"] = { error: { message: "fora do ar" } };
  const e = evento("checkout.session.completed", { id: "cs_2", mode: "subscription", subscription: "sub_2", metadata: { subId: "s2" } });
  await assert.rejects(st.processarEvento(e));
  respostas["/subscriptions/sub_2"] = { id: "sub_2", status: "active", items: { data: [{ current_period_end: 1900000000 }] } };
  await st.processarEvento(e);
  assert.equal(sub("s2").status, "ativa");
});

test("assinatura encerrada no Stripe volta a empresa para o Free só se nada mais vale", async () => {
  await st.processarEvento(evento("customer.subscription.deleted", { id: "sub_1", status: "canceled" }));
  assert.equal(sub("s1").status, "cancelada");
  assert.equal(empresa().assinatura, "growth"); // s2 ainda ativa
  await st.processarEvento(evento("customer.subscription.deleted", { id: "sub_2", status: "canceled" }));
  assert.equal(empresa().assinatura, "free");
});

test("cancelar pela RYCS cancela no Stripe; checkout aberto é encerrado", async () => {
  chamadas.length = 0;
  respostas["/subscriptions/sub_2"] = { id: "sub_2", status: "canceled" };
  await st.cancelarAssinaturaStripe(sub("s2"));
  assert.ok(chamadas.some((x) => x.caminho === "/subscriptions/sub_2" && x.metodo === "DELETE"));
  respostas["/checkout/sessions/cs_x/expire"] = { id: "cs_x", status: "expired" };
  await st.cancelarAssinaturaStripe({ gateway: "stripe", stripeSessionId: "cs_x" });
  assert.ok(chamadas.some((x) => x.caminho === "/checkout/sessions/cs_x/expire"));
});

test("checkout embutido: abre dentro da RYCS e devolve o client_secret", async () => {
  novaAssinatura("s-emb");
  chamadas.length = 0;
  respostas["/checkout/sessions"] = { id: "cs_emb", client_secret: "cs_emb_secret_x" };
  const r = await st.criarCheckoutAssinatura({ empresa: empresa(), subId: "s-emb", chave: "growth", retorno: "/plataforma", embutido: true });
  assert.equal(r.clientSecret, "cs_emb_secret_x");
  assert.equal(r.url, null);
  const c = chamadas.find((x) => x.caminho === "/checkout/sessions").corpo;
  assert.equal(c.get("ui_mode"), "embedded");
  assert.equal(c.get("redirect_on_completion"), "if_required");
  assert.equal(c.get("return_url"), "https://app.rycs.pro/plataforma?stripe=ok");
  assert.equal(c.get("success_url"), null);
});

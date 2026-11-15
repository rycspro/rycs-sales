import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente } from "./apoio/servidor.js";
import { subirAsaasFalso } from "./apoio/asaasFalso.js";

// V4 — Confirmação do pagamento pela API oficial (via gateway Asaas FALSO, com
// chamada HTTP real). Fail-closed: nada credita quando a API falha, o pagamento
// não existe, o valor diverge ou a empresa diverge. Reentrega legítima após
// erro temporário credita uma única vez.

const TOKEN = "token-confirma";
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("webhook só credita após confirmar o pagamento na API do Asaas", async (t) => {
  const asaas = await subirAsaasFalso();
  t.after(() => asaas.fechar());

  const { base, dbPath } = await subirServidor(t, {
    ASAAS_WEBHOOK_TOKEN: TOKEN,
    ASAAS_API_KEY: "test-key-sandbox",
    ASAAS_BASE_URL_TESTE: asaas.baseUrl,
  });
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  await req("/auth/register", { body: { role: "empresa", email: "conf@exemplo.invalid", senha: "12345678", whats: "11912345678", nome: "Conf", logo: { mimetype: "image/png", base64: PNG }, aceitouTermos: true } });
  const companyId = db.prepare("SELECT entityId FROM users WHERE email = 'conf@exemplo.invalid'").get().entityId;
  db.prepare("INSERT INTO deposit_requests (id, companyId, valor, status, referencia, criadoEm) VALUES ('drC', ?, 100, 'pendente', 'pay_c', ?)").run(companyId, Date.now());
  const saldo = () => db.prepare("SELECT saldo FROM companies WHERE id = ?").get(companyId).saldo;
  const enviar = () => req("/payments/webhook", { headers: { "asaas-access-token": TOKEN }, body: { event: "PAYMENT_RECEIVED", payment: { id: "pay_c", value: 100, currency: "BRL", externalReference: companyId } } });

  // 1) Pagamento inexistente na API → fail-closed (sem crédito).
  let r = await enviar();
  assert.equal(r.status, 200);
  assert.equal(r.corpo.recusado, "pagamento não encontrado na API");
  assert.equal(saldo(), 0);

  // 2) Valor divergente (API diz 999) → sem crédito.
  asaas.definir("pay_c", { status: "RECEIVED", value: 999, customer: "cus_x" });
  r = await enviar();
  assert.equal(r.corpo.recusado, "valor divergente da API");
  assert.equal(saldo(), 0);

  // 3) Status não liberado → sem crédito.
  asaas.definir("pay_c", { status: "PENDING", value: 100, customer: "cus_x" });
  r = await enviar();
  assert.ok(String(r.corpo.recusado).startsWith("status"));
  assert.equal(saldo(), 0);

  // 4) API indisponível (gateway derrubado) → fail-closed 503, sem crédito.
  asaas.derrubar();
  r = await enviar();
  assert.equal(r.status, 503, "indisponibilidade não credita");
  assert.equal(saldo(), 0);

  // 5) Reentrega legítima após o erro temporário: gateway volta e confirma →
  // credita UMA vez (o marcador de dedupe foi liberado no erro).
  asaas.levantar();
  asaas.definir("pay_c", { status: "RECEIVED", value: 100 });
  r = await enviar();
  assert.equal(r.status, 200);
  assert.equal(saldo(), 100, "reentrega legítima credita");
  // Reentrega idêntica não credita de novo.
  await enviar();
  assert.equal(saldo(), 100, "idempotente");
});

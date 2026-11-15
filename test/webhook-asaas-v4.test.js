import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente } from "./apoio/servidor.js";

// V4 — Segurança do webhook Asaas: autenticação só por header, validação do
// vínculo (empresa/valor/moeda/solicitação) e recusa de divergências sem
// creditar dinheiro.

const TOKEN = "token-asaas-v4";
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function empresaComDeposito(req, db, email, valor) {
  await req("/auth/register", { body: { role: "empresa", email, senha: "12345678", whats: "11912345678", nome: "Emp", logo: { mimetype: "image/png", base64: PNG }, aceitouTermos: true } });
  const companyId = db.prepare("SELECT entityId FROM users WHERE email = ?").get(email).entityId;
  return companyId;
}
const saldoDe = (db, id) => db.prepare("SELECT saldo FROM companies WHERE id = ?").get(id).saldo;

test("webhook Asaas: header-only, vínculo validado e divergências recusadas", async (t) => {
  const { base, dbPath } = await subirServidor(t, { ASAAS_WEBHOOK_TOKEN: TOKEN });
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  const companyId = await empresaComDeposito(req, db, "v4@exemplo.invalid", 100);
  // Solicitação de depósito rastreável de R$100 vinculada ao paymentId.
  db.prepare("INSERT INTO deposit_requests (id, companyId, valor, status, referencia, criadoEm) VALUES ('dr1', ?, 100, 'pendente', 'pay_v4', ?)").run(companyId, Date.now());

  const enviar = (payment, { headers } = {}) => req("/payments/webhook", { headers: headers ?? { "asaas-access-token": TOKEN }, body: { event: "PAYMENT_RECEIVED", payment } });

  // Token na query string → recusado (não aceita mais ?token=).
  let r = await req("/payments/webhook?token=" + TOKEN, { body: { event: "PAYMENT_RECEIVED", payment: { id: "pay_v4", value: 100, externalReference: companyId } } });
  assert.equal(r.status, 401, "token por query recusado");
  assert.equal(saldoDe(db, companyId), 0, "nada creditado");

  // Sem header → 401.
  r = await enviar({ id: "pay_v4", value: 100, externalReference: companyId }, { headers: {} });
  assert.equal(r.status, 401);

  // Valor divergente da solicitação → não credita.
  r = await enviar({ id: "pay_v4", value: 999, externalReference: companyId });
  assert.equal(r.status, 200);
  assert.equal(saldoDe(db, companyId), 0, "valor divergente não credita");

  // Moeda diferente de BRL → não credita.
  r = await enviar({ id: "pay_v4", value: 100, currency: "USD", externalReference: companyId });
  assert.equal(saldoDe(db, companyId), 0, "moeda divergente não credita");

  // Empresa divergente da solicitação → não credita.
  const outra = await empresaComDeposito(req, db, "v4b@exemplo.invalid", 100);
  r = await enviar({ id: "pay_v4", value: 100, externalReference: outra });
  assert.equal(saldoDe(db, outra), 0, "empresa divergente não credita");

  // Pagamento legítimo (bate empresa, valor, moeda) → credita uma vez.
  r = await enviar({ id: "pay_v4", value: 100, currency: "BRL", externalReference: companyId });
  assert.equal(r.status, 200);
  assert.equal(saldoDe(db, companyId), 100, "pagamento legítimo creditado");
  // Reentrega não credita de novo (idempotência preservada).
  await enviar({ id: "pay_v4", value: 100, externalReference: companyId });
  assert.equal(saldoDe(db, companyId), 100, "idempotente");

  // A recusa foi auditada.
  const rec = db.prepare("SELECT COUNT(*) n FROM security_audit WHERE acao = 'deposito_recusado'").get().n;
  assert.ok(rec >= 1, "recusa auditada");
});

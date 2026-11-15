import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente } from "./apoio/servidor.js";

// V3 — O Asaas emite eventos diferentes para a mesma cobrança (PAYMENT_CONFIRMED
// e PAYMENT_RECEIVED no cartão). O crédito do caixa é amarrado ao INSERT único
// do ledger (UNIQUE tipo+idempotencyKey = payment.id), então o mesmo pagamento
// credita uma única vez, qualquer que seja o evento.

const TOKEN = "token-webhook-teste";

test("eventos distintos do mesmo pagamento creditam o caixa uma só vez", async (t) => {
  const { base, dbPath } = await subirServidor(t, { ASAAS_WEBHOOK_TOKEN: TOKEN });
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  const r0 = await req("/auth/register", { body: { role: "empresa", email: "dep@exemplo.invalid", senha: "12345678", whats: "11912345678", nome: "Empresa Dep", logo: { mimetype: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }, aceitouTermos: true } });
  assert.equal(r0.status, 200, JSON.stringify(r0.corpo));
  const companyId = db.prepare("SELECT entityId FROM users WHERE email = 'dep@exemplo.invalid'").get().entityId;

  const payment = { id: "pay_idem_1", value: 150, externalReference: companyId };
  const enviar = (event) => req("/payments/webhook", {
    headers: { "asaas-access-token": TOKEN },
    body: { event, payment },
  });

  // Cartão: autorizado e depois liquidado — mesmo payment.id, eventos distintos.
  let r = await enviar("PAYMENT_CONFIRMED");
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  r = await enviar("PAYMENT_RECEIVED");
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  // Reentrega do mesmo evento também não credita de novo.
  await enviar("PAYMENT_RECEIVED");

  const emp = db.prepare("SELECT saldo, totalAportado FROM companies WHERE id = ?").get(companyId);
  assert.equal(emp.saldo, 150, "caixa creditado uma única vez");
  assert.equal(emp.totalAportado, 150, "total aportado creditado uma única vez");

  const linhas = db.prepare("SELECT COUNT(*) n FROM financial_ledger WHERE tipo = 'deposito' AND idempotencyKey = ?").get(payment.id).n;
  assert.equal(linhas, 1, "um único lançamento de depósito no ledger");

  // Token inválido é recusado.
  const semToken = await req("/payments/webhook", { body: { event: "PAYMENT_RECEIVED", payment: { id: "pay_x", value: 10, externalReference: companyId } } });
  assert.equal(semToken.status, 401, "webhook sem token é recusado");
});

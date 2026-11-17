// O Asaas reentrega eventos e manda PAYMENT_RECEIVED e PAYMENT_CONFIRMED para a
// mesma cobrança (ids de evento diferentes). O caixa da empresa só pode ser
// creditado uma vez por cobrança — senão a empresa ganha dinheiro em dobro.
//
// V3 — o crédito do caixa é amarrado ao INSERT único do ledger
// (UNIQUE tipo+idempotencyKey = payment.id), com pré-checagem explícita
// (defesa em profundidade). Cobrimos os dois caminhos de resolução da empresa
// (externalReference e asaasCustomerId) e a reentrega exata do mesmo evento.

import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente } from "./apoio/servidor.js";

const TOKEN = "token-webhook-teste";

test("eventos distintos do mesmo pagamento creditam o caixa uma só vez (externalReference)", async (t) => {
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

test("eventos distintos do mesmo pagamento creditam o caixa uma só vez (asaasCustomerId)", async (t) => {
  const { base, dbPath } = await subirServidor(t, { ASAAS_WEBHOOK_TOKEN: "tok" });
  const db = new Database(dbPath);
  t.after(() => db.close());

  const id = "emp-dep-1";
  db.prepare("INSERT INTO companies (id, nome, produto, whatsapp, saldo, totalAportado, asaasCustomerId, aportes, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, "Dep SA", "Consultoria", "11999999999", 0, 0, "cus_dep", "[]", Date.now());

  const req = cliente(base);
  const hook = (event) => req("/payments/webhook", {
    headers: { "asaas-access-token": "tok" },
    body: { event, payment: { id: "pay_dep_1", customer: "cus_dep", value: 100 } },
  });

  const r1 = await hook("PAYMENT_RECEIVED");
  const r2 = await hook("PAYMENT_CONFIRMED"); // mesmo pagamento, evento diferente
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);

  const emp = db.prepare("SELECT saldo, totalAportado FROM companies WHERE id = ?").get(id);
  assert.equal(emp.saldo, 100, "saldo deve ser creditado uma única vez");
  assert.equal(emp.totalAportado, 100);

  const movimentos = db.prepare("SELECT COUNT(*) n FROM financial_ledger WHERE tipo = 'deposito' AND idempotencyKey = 'pay_dep_1'").get().n;
  assert.equal(movimentos, 1, "o ledger deve ter um único movimento de depósito");
});

test("reentrega exata do mesmo evento também credita uma só vez", async (t) => {
  const { base, dbPath } = await subirServidor(t, { ASAAS_WEBHOOK_TOKEN: "tok" });
  const db = new Database(dbPath);
  t.after(() => db.close());

  const id = "emp-dep-2";
  db.prepare("INSERT INTO companies (id, nome, produto, whatsapp, saldo, totalAportado, asaasCustomerId, aportes, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, "Dep 2", "Consultoria", "11988887777", 0, 0, "cus_dep2", "[]", Date.now());

  const req = cliente(base);
  const hook = () => req("/payments/webhook", {
    headers: { "asaas-access-token": "tok" },
    body: { event: "PAYMENT_RECEIVED", payment: { id: "pay_dep_2", customer: "cus_dep2", value: 50 } },
  });

  await hook();
  const r2 = await hook(); // reentrega idêntica
  assert.equal(r2.corpo?.duplicado, true);
  assert.equal(db.prepare("SELECT saldo FROM companies WHERE id = ?").get(id).saldo, 50);
});

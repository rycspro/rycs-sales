// O Asaas reentrega eventos e manda PAYMENT_RECEIVED e PAYMENT_CONFIRMED para a
// mesma cobrança (ids de evento diferentes). O caixa da empresa só pode ser
// creditado uma vez por cobrança — senão a empresa ganha dinheiro em dobro.

import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente } from "./apoio/servidor.js";

test("eventos distintos do mesmo pagamento creditam o caixa uma só vez", async (t) => {
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

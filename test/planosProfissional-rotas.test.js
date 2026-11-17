// Rotas e webhook dos planos do profissional (Pro/Premium). Servidor real em
// processo à parte, banco temporário, sem Asaas e sem cobrança.

import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente, assinar } from "./apoio/servidor.js";

const DIA = 86_400_000;

function preparar(dbPath) {
  const db = new Database(dbPath);
  db.prepare("INSERT INTO sellers (id, nome, email, whats, criadoEm) VALUES ('s1', 'Ana', 'ana@teste.dev', '11999990000', ?)").run(Date.now());
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES ('u-s1', 'ana@teste.dev', 'x', 'vendedor', 's1', ?)").run(Date.now());
  db.prepare("INSERT INTO companies (id, nome, produto, whatsapp, saldo, totalAportado, asaasCustomerId, aportes, criadoEm) VALUES ('e1', 'Emp', 'X', '11988880000', 0, 0, 'cus_prof', '[]', ?)").run(Date.now());
  return db;
}

test("plano do profissional: grátis por padrão, assinatura desligada e concessão do admin", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const db = preparar(dbPath);
  t.after(() => db.close());
  const req = cliente(base);
  const vend = assinar({ id: "u-s1", role: "vendedor", entityId: "s1" });
  const admin = assinar({ id: "u-admin", role: "admin", entityId: "admin" });

  const r0 = await req("/profissional/plano", { cookie: vend });
  assert.equal(r0.status, 200);
  assert.equal(r0.corpo.plano, "gratis");
  assert.equal(r0.corpo.cobrancaAtiva, false);
  assert.equal(r0.corpo.saqueMinimo, 10);

  const r1 = await req("/profissional/assinatura", { cookie: vend, body: { plano: "pro" } });
  assert.equal(r1.status, 503, "sem PLANOS_PROFISSIONAL_ATIVO não cobra ninguém");
  assert.equal(r1.corpo.codigo, "PLANOS_EM_BREVE");

  const proibido = await req("/admin/profissionais/s1/plano", { cookie: vend, body: { plano: "pro", ate: Date.now() + DIA, motivo: "x" } });
  assert.equal(proibido.status, 403);

  const semMotivo = await req("/admin/profissionais/s1/plano", { cookie: admin, body: { plano: "pro", ate: Date.now() + DIA } });
  assert.equal(semMotivo.status, 400);

  const conc = await req("/admin/profissionais/s1/plano", { cookie: admin, body: { plano: "premium", ate: Date.now() + 30 * DIA, motivo: "teste interno", origem: "migracao" } });
  assert.equal(conc.status, 201);
  assert.equal((await req("/profissional/plano", { cookie: vend })).corpo.plano, "premium");

  const ret = await req("/admin/profissionais/s1/plano", { cookie: admin, method: "DELETE", body: { motivo: "fim do teste" } });
  assert.equal(ret.corpo.retiradas, 1);
  assert.equal((await req("/profissional/plano", { cookie: vend })).corpo.plano, "gratis");
});

test("webhook prof: ativa uma vez, não vira depósito de empresa, e reembolso desliga", async (t) => {
  const { base, dbPath } = await subirServidor(t, { ASAAS_WEBHOOK_TOKEN: "tok" });
  const db = preparar(dbPath);
  t.after(() => db.close());
  db.prepare(`INSERT INTO assinaturas_profissional (id, sellerId, plano, status, origem, asaasId, asaasCustomerId, valor, criadoEm)
    VALUES ('ap1', 's1', 'pro', 'pendente', 'asaas', 'sub_x', 'cus_prof', 197, ?)`).run(Date.now());

  const req = cliente(base);
  const vend = assinar({ id: "u-s1", role: "vendedor", entityId: "s1" });
  const hook = (event, extra = {}) => req("/payments/webhook", {
    headers: { "asaas-access-token": "tok" },
    body: { event, payment: { id: "pay_prof_1", customer: "cus_prof", subscription: "sub_x", value: 197, dueDate: "2026-11-17", externalReference: "prof:ap1", ...extra } },
  });

  assert.equal((await hook("PAYMENT_RECEIVED")).corpo.resultado, "ativada");
  assert.equal((await hook("PAYMENT_CONFIRMED")).corpo.resultado, "ja_processado");

  const a = db.prepare("SELECT * FROM assinaturas_profissional WHERE id = 'ap1'").get();
  assert.equal(a.status, "ativa");
  assert.equal(a.pagoAte, Date.parse("2027-11-17T12:00:00Z"), "um ano a partir do vencimento, uma vez só");

  // Mesmo customer de uma empresa: o caixa dela não pode ser creditado.
  assert.equal(db.prepare("SELECT saldo FROM companies WHERE id = 'e1'").get().saldo, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM financial_ledger WHERE idempotencyKey = 'pay_prof_1'").get().n, 0);

  assert.equal((await req("/profissional/plano", { cookie: vend })).corpo.plano, "pro");
  assert.ok(db.prepare("SELECT COUNT(*) n FROM notifications WHERE userId = 'u-s1' AND tipo = 'plano'").get().n >= 1);

  assert.equal((await hook("PAYMENT_REFUNDED")).corpo.resultado, "reembolsada");
  assert.equal((await req("/profissional/plano", { cookie: vend })).corpo.plano, "gratis");
});

test("webhook prof: cobrança removida antes de pagar expira; atraso marca atrasada", async (t) => {
  const { base, dbPath } = await subirServidor(t, { ASAAS_WEBHOOK_TOKEN: "tok" });
  const db = preparar(dbPath);
  t.after(() => db.close());
  const ins = db.prepare(`INSERT INTO assinaturas_profissional (id, sellerId, plano, status, origem, pagoAte, criadoEm) VALUES (?, 's1', 'pro', ?, 'asaas', ?, ?)`);
  ins.run("ap2", "pendente", null, Date.now());
  ins.run("ap3", "ativa", Date.now() - DIA, Date.now());

  const req = cliente(base);
  const hook = (event, ref, id) => req("/payments/webhook", {
    headers: { "asaas-access-token": "tok" },
    body: { event, payment: { id, externalReference: ref, value: 197 } },
  });
  assert.equal((await hook("PAYMENT_DELETED", "prof:ap2", "pay_a")).corpo.resultado, "expirada");
  assert.equal((await hook("PAYMENT_OVERDUE", "prof:ap3", "pay_b")).corpo.resultado, "atrasada");
  assert.equal(db.prepare("SELECT status FROM assinaturas_profissional WHERE id = 'ap3'").get().status, "atrasada");
});

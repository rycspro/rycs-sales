import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente, assinar } from "./apoio/servidor.js";

// V5 — Reconciliação read-only: invariante de aporte (totalAportado == SUM
// deposito) + integridade (nenhum contador negativo; reservado <= saldo) para
// empresa e vendedor. Nunca corrige automaticamente. Rota admin-only.

const TOKEN = "token-recon";
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("reconciliação detecta aporte divergente, saldo negativo e reservado>saldo, sem corrigir", async (t) => {
  const { base, dbPath } = await subirServidor(t, { ASAAS_WEBHOOK_TOKEN: TOKEN });
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  await req("/auth/register", { body: { role: "empresa", email: "recon@exemplo.invalid", senha: "12345678", whats: "11912345678", nome: "Recon", logo: { mimetype: "image/png", base64: PNG }, aceitouTermos: true } });
  const companyId = db.prepare("SELECT entityId FROM users WHERE email = 'recon@exemplo.invalid'").get().entityId;
  db.prepare("INSERT INTO deposit_requests (id, companyId, valor, status, referencia, criadoEm) VALUES ('drR', ?, 100, 'pendente', 'pay_r', ?)").run(companyId, Date.now());
  await req("/payments/webhook", { headers: { "asaas-access-token": TOKEN }, body: { event: "PAYMENT_RECEIVED", payment: { id: "pay_r", value: 100, currency: "BRL", externalReference: companyId } } });

  const ckAdmin = assinar({ id: "admin-recon", role: "admin", entityId: null });
  const emp = () => req("/admin/reconciliacao/empresa/" + companyId, { cookie: ckAdmin });

  // Consistente após o depósito legítimo.
  let r = await emp();
  assert.equal(r.status, 200);
  assert.equal(r.corpo.divergente, false, "sem divergência");
  assert.equal(r.corpo.depositosLedger, 100);

  // Aporte divergente (contador maior que o ledger).
  db.prepare("UPDATE companies SET totalAportado = totalAportado + 250 WHERE id = ?").run(companyId);
  r = await emp();
  assert.equal(r.corpo.divergente, true);
  assert.equal(r.corpo.divergenciaAporte, 250);
  assert.ok(r.corpo.alertas.some((a) => a.tipo === "aporte_divergente"));

  // Reservado maior que o saldo → alerta de integridade.
  db.prepare("UPDATE companies SET saldo = 10, saldoReservado = 50 WHERE id = ?").run(companyId);
  r = await emp();
  assert.ok(r.corpo.alertas.some((a) => a.tipo === "reservado_excede_saldo"), "reservado>saldo detectado");

  // Saldo negativo → alerta.
  db.prepare("UPDATE companies SET saldo = -5, saldoReservado = 0 WHERE id = ?").run(companyId);
  r = await emp();
  assert.ok(r.corpo.alertas.some((a) => a.tipo === "saldo_negativo"), "saldo negativo detectado");

  // Não corrige automaticamente.
  assert.equal(db.prepare("SELECT saldo FROM companies WHERE id = ?").get(companyId).saldo, -5);

  // Vendedor com disponivel negativo é detectado.
  const reg = await req("/auth/register", { body: { role: "vendedor", email: "vrec@exemplo.invalid", senha: "123456", aceitouTermos: true } });
  const sellerId = db.prepare("SELECT entityId FROM users WHERE email = 'vrec@exemplo.invalid'").get().entityId;
  db.prepare("UPDATE sellers SET disponivel = -3 WHERE id = ?").run(sellerId);
  r = await req("/admin/reconciliacao/vendedor/" + sellerId, { cookie: ckAdmin });
  assert.ok(r.corpo.alertas.some((a) => a.tipo === "disponivel_negativo"), "disponivel negativo detectado");

  // A varredura geral lista empresa e vendedor divergentes.
  r = await req("/admin/reconciliacao", { cookie: ckAdmin });
  assert.ok(r.corpo.divergencias.some((d) => d.companyId === companyId));
  assert.ok(r.corpo.divergencias.some((d) => d.sellerId === sellerId));

  // Rota é admin-only.
  assert.equal((await req("/admin/reconciliacao", { cookie: reg.cookie })).status, 403);
});

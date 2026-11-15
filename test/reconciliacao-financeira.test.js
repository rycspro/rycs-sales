import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente, assinar } from "./apoio/servidor.js";

// V5 — Reconciliação read-only: detecta divergência entre o contador
// (companies.totalAportado) e o registro auditável (SUM deposito no ledger),
// sem corrigir automaticamente. Rota restrita ao admin.

const TOKEN = "token-recon";
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("reconciliação detecta divergência de aporte sem corrigir; rota é admin-only", async (t) => {
  const { base, dbPath } = await subirServidor(t, { ASAAS_WEBHOOK_TOKEN: TOKEN });
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  await req("/auth/register", { body: { role: "empresa", email: "recon@exemplo.invalid", senha: "12345678", whats: "11912345678", nome: "Recon", logo: { mimetype: "image/png", base64: PNG }, aceitouTermos: true } });
  const companyId = db.prepare("SELECT entityId FROM users WHERE email = 'recon@exemplo.invalid'").get().entityId;

  // Depósito legítimo de R$100 pelo webhook (credita caixa + grava ledger).
  db.prepare("INSERT INTO deposit_requests (id, companyId, valor, status, referencia, criadoEm) VALUES ('drR', ?, 100, 'pendente', 'pay_r', ?)").run(companyId, Date.now());
  await req("/payments/webhook", { headers: { "asaas-access-token": TOKEN }, body: { event: "PAYMENT_RECEIVED", payment: { id: "pay_r", value: 100, currency: "BRL", externalReference: companyId } } });

  const ckAdmin = assinar({ id: "admin-recon", role: "admin", entityId: null });

  // Consistente: totalAportado == SUM(deposito).
  let r = await req("/admin/reconciliacao/" + companyId, { cookie: ckAdmin });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.divergente, false, "sem divergência após depósito legítimo");
  assert.equal(r.corpo.depositosLedger, 100);

  // Injeta uma divergência direto no contador (sem lançamento no ledger).
  db.prepare("UPDATE companies SET totalAportado = totalAportado + 250 WHERE id = ?").run(companyId);

  r = await req("/admin/reconciliacao/" + companyId, { cookie: ckAdmin });
  assert.equal(r.corpo.divergente, true, "divergência detectada");
  assert.equal(r.corpo.divergenciaAporte, 250);

  // A varredura geral também aponta a empresa divergente.
  r = await req("/admin/reconciliacao", { cookie: ckAdmin });
  assert.ok(r.corpo.divergencias.some((d) => d.companyId === companyId), "varredura lista a divergência");

  // Não corrige automaticamente: o contador segue como estava.
  assert.equal(db.prepare("SELECT totalAportado FROM companies WHERE id = ?").get(companyId).totalAportado, 350);

  // Rota é restrita ao admin.
  const reg = await req("/auth/register", { body: { role: "vendedor", email: "naoadmin@exemplo.invalid", senha: "123456", aceitouTermos: true } });
  assert.equal((await req("/admin/reconciliacao", { cookie: reg.cookie })).status, 403);
});

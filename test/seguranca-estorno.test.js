import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar, cliente } from "./apoio/servidor.js";

// Estorno de saque não pode pagar o profissional duas vezes.
// - Saque pago COM registro no gateway (asaasId): só devolve após o banco
//   confirmar que o Pix não saiu; com o gateway desligado, recusa (503/502).
// - Saque pago SEM asaasId: trava (409) — sem registro não há como confirmar
//   que o Pix não saiu; devolver o saldo pagaria em dobro (defesa em profundidade).
// - Saque ainda não pago (solicitado): estorno legítimo devolve o saldo (200).

test("estorno de saque respeita a integridade financeira", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  const r = await req("/auth/register", { body: { role: "vendedor", email: "saque@exemplo.invalid", senha: "123456", aceitouTermos: true } });
  const sellerId = db.prepare("SELECT entityId FROM users WHERE email = 'saque@exemplo.invalid'").get().entityId;
  db.prepare("UPDATE sellers SET disponivel = 0, sacado = 0 WHERE id = ?").run(sellerId);
  const admin = assinar({ id: "admin-teste", role: "admin", entityId: null });
  const disponivel = () => db.prepare("SELECT disponivel FROM sellers WHERE id = ?").get(sellerId).disponivel;

  // (a) Pago SEM asaasId → 409, saldo intacto.
  db.prepare("INSERT INTO withdrawals (id, sellerId, valor, pix, status, criadoEm) VALUES ('wman', ?, 50, 'k@pix', 'pago', ?)").run(sellerId, Date.now());
  let res = await req("/admin/withdrawals/wman/estornar", { cookie: admin, method: "POST", body: {} });
  assert.equal(res.status, 409, "saque pago sem asaasId não pode ser estornado às cegas");
  assert.equal(disponivel(), 0, "saldo não foi devolvido (evita pagar 2x)");

  // (b) Pago COM asaasId e gateway desligado → 503, saldo intacto.
  db.prepare("INSERT INTO withdrawals (id, sellerId, valor, pix, status, asaasId, criadoEm) VALUES ('wgw', ?, 50, 'k@pix', 'pago', 'tr_x', ?)").run(sellerId, Date.now());
  res = await req("/admin/withdrawals/wgw/estornar", { cookie: admin, method: "POST", body: {} });
  assert.equal(res.status, 503, "sem gateway não dá para confirmar que o Pix não saiu");
  assert.equal(disponivel(), 0);

  // (c) Ainda não pago (solicitado) → estorno legítimo devolve o saldo.
  db.prepare("INSERT INTO withdrawals (id, sellerId, valor, pix, status, criadoEm) VALUES ('wsol', ?, 50, 'k@pix', 'solicitado', ?)").run(sellerId, Date.now());
  res = await req("/admin/withdrawals/wsol/estornar", { cookie: admin, method: "POST", body: {} });
  assert.equal(res.status, 200, "saque solicitado pode ser devolvido");
  assert.equal(disponivel(), 50, "saldo devolvido ao profissional");
  assert.equal(db.prepare("SELECT status FROM withdrawals WHERE id = 'wsol'").get().status, "cancelado");

  // Só admin estorna.
  const outro = assinar({ id: "v2", role: "vendedor", entityId: "x" });
  res = await req("/admin/withdrawals/wsol/estornar", { cookie: outro, method: "POST", body: {} });
  assert.equal(res.status, 403);
});

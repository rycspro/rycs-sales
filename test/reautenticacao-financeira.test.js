import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente } from "./apoio/servidor.js";

// Reautenticação financeira (troca de Pix e saque). Com a flag ligada, exige a
// senha, limita tentativas e audita. Com a flag desligada (padrão), o fluxo
// atual é preservado — saque legítimo não é bloqueado.

async function criarVendedor(req, db, email) {
  await req("/auth/register", { body: { role: "vendedor", email, senha: "123456", aceitouTermos: true } });
  const login = await req("/auth/login", { body: { email, senha: "123456" } });
  const id = db.prepare("SELECT entityId FROM users WHERE email = ?").get(email).entityId;
  db.prepare("UPDATE sellers SET disponivel = 100, pix = 'chave', pixTipo = 'aleatoria' WHERE id = ?").run(id);
  return { cookie: login.cookie, id };
}

test("com a flag ligada, saque e troca de Pix exigem senha; tentativas são limitadas e auditadas", async (t) => {
  const { base, dbPath } = await subirServidor(t, { REAUTH_FINANCEIRO: "1" });
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());
  const { cookie, id } = await criarVendedor(req, db, "reauth@exemplo.invalid");

  // Saque sem senha → 401.
  let r = await req("/payments/withdraw", { cookie, body: { valor: 50 } });
  assert.equal(r.status, 401, "saque sem senha bloqueado");

  // Saque com senha errada → 401 (conta como tentativa).
  r = await req("/payments/withdraw", { cookie, body: { valor: 50, senha: "errada" } });
  assert.equal(r.status, 401, "senha errada bloqueada");

  // Saque com senha certa → 200 (debita).
  r = await req("/payments/withdraw", { cookie, body: { valor: 50, senha: "123456" } });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  assert.equal(db.prepare("SELECT disponivel FROM sellers WHERE id = ?").get(id).disponivel, 50);

  // Troca de Pix sem senha → 401; com senha → 200 + auditoria + carimbo.
  r = await req("/sellers/" + id, { cookie, method: "PATCH", body: { pix: "nova-chave" } });
  assert.equal(r.status, 401, "troca de Pix sem senha bloqueada");
  r = await req("/sellers/" + id, { cookie, method: "PATCH", body: { pix: "nova-chave", senha: "123456" } });
  assert.equal(r.status, 200, "troca de Pix com senha ok");
  const s = db.prepare("SELECT pix, pixAlteradoEm FROM sellers WHERE id = ?").get(id);
  assert.equal(s.pix, "nova-chave");
  assert.ok(s.pixAlteradoEm, "carimbo pixAlteradoEm gravado");

  // Auditoria registrada (sem expor a senha; Pix mascarado).
  const evPix = db.prepare("SELECT contexto FROM security_audit WHERE acao = 'pix_alterado' AND alvo = ?").get(id);
  assert.ok(evPix, "evento pix_alterado auditado");
  assert.ok(!JSON.stringify(evPix).includes("123456"), "senha nunca aparece na trilha");
  const evSaque = db.prepare("SELECT 1 FROM security_audit WHERE acao = 'saque_solicitado' AND alvo = ?").get(id);
  assert.ok(evSaque, "saque auditado");

  // Bloqueio por excesso de tentativas (lockout 429).
  for (let i = 0; i < 6; i++) await req("/payments/withdraw", { cookie, body: { valor: 10, senha: "x" } });
  r = await req("/payments/withdraw", { cookie, body: { valor: 10, senha: "123456" } });
  assert.equal(r.status, 429, "lockout após tentativas repetidas");
});

test("com a flag desligada (padrão), o saque legítimo não é bloqueado", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());
  const { cookie, id } = await criarVendedor(req, db, "semflag@exemplo.invalid");

  const r = await req("/payments/withdraw", { cookie, body: { valor: 50 } });
  assert.equal(r.status, 200, "sem flag, saque sem senha continua funcionando");
  assert.equal(db.prepare("SELECT disponivel FROM sellers WHERE id = ?").get(id).disponivel, 50);
});

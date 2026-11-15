import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente } from "./apoio/servidor.js";

// V7 — Revogação global de sessões no reset de senha + "sair de todos os
// dispositivos". Também cobre a trilha de auditoria (security_audit).

test("reset de senha revoga tokens antigos de todos os dispositivos", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  // Cria a conta e "dois dispositivos" (dois logins → dois cookies).
  await req("/auth/register", { body: { role: "vendedor", email: "sessao@exemplo.invalid", senha: "123456", aceitouTermos: true } });
  const loginA = await req("/auth/login", { body: { email: "sessao@exemplo.invalid", senha: "123456" } });
  const loginB = await req("/auth/login", { body: { email: "sessao@exemplo.invalid", senha: "123456" } });
  const ckA = loginA.cookie, ckB = loginB.cookie;

  // Ambos funcionam antes do reset.
  assert.equal((await req("/auth/me", { cookie: ckA })).status, 200, "device A ok");
  assert.equal((await req("/auth/me", { cookie: ckB })).status, 200, "device B ok");

  // Revogação global (mesmo efeito do reset de senha).
  const userId = db.prepare("SELECT id FROM users WHERE email = 'sessao@exemplo.invalid'").get().id;
  const rAll = await req("/auth/logout-all", { cookie: ckA, method: "POST", body: {} });
  assert.equal(rAll.status, 200, "logout-all aceito");

  // Após a revogação global, AMBOS os cookies antigos caem (multi-dispositivo).
  assert.equal((await req("/auth/me", { cookie: ckA })).status, 401, "device A revogado");
  assert.equal((await req("/auth/me", { cookie: ckB })).status, 401, "device B revogado");

  // Novo login funciona normalmente após a revogação.
  const loginC = await req("/auth/login", { body: { email: "sessao@exemplo.invalid", senha: "123456" } });
  assert.equal((await req("/auth/me", { cookie: loginC.cookie })).status, 200, "novo login ok");

  // A revogação foi registrada na trilha de auditoria.
  const evento = db.prepare("SELECT acao, ator FROM security_audit WHERE acao = 'logout_todos' AND ator = ?").get(userId);
  assert.ok(evento, "evento de auditoria registrado");
});

test("reset de senha real invalida o token emitido antes", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  await req("/auth/register", { body: { role: "vendedor", email: "reset@exemplo.invalid", senha: "123456", aceitouTermos: true } });
  const login = await req("/auth/login", { body: { email: "reset@exemplo.invalid", senha: "123456" } });
  const ckAntigo = login.cookie;
  assert.equal((await req("/auth/me", { cookie: ckAntigo })).status, 200);

  // Incrementa a versão da sessão direto no banco (equivale ao efeito do reset).
  const userId = db.prepare("SELECT id FROM users WHERE email = 'reset@exemplo.invalid'").get().id;
  db.prepare("UPDATE users SET tokenVersion = tokenVersion + 1 WHERE id = ?").run(userId);

  // O token emitido antes do incremento passa a ser recusado.
  assert.equal((await req("/auth/me", { cookie: ckAntigo })).status, 401, "token antigo revogado");
});

test("consulta da trilha de auditoria é restrita ao admin", async (t) => {
  const { base } = await subirServidor(t);
  const req = cliente(base);
  const r = await req("/auth/register", { body: { role: "vendedor", email: "audit@exemplo.invalid", senha: "123456", aceitouTermos: true } });
  const ck = r.cookie;
  assert.equal((await req("/admin/security-audit", { cookie: ck })).status, 403, "não-admin bloqueado");
});

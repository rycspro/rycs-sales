import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar, cliente } from "./apoio/servidor.js";

// V2 — PATCH /sellers/:id só pode ser feito pelo próprio profissional ou pelo
// admin. Empresas (e qualquer outro) não alteram dados sensíveis de um
// profissional — especialmente Pix e e-mail, que permitiriam desvio de saque
// ou tomada de conta via redefinição de senha.

test("empresa não altera Pix/e-mail de profissional; dono e admin sim", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  // Profissional vítima.
  let r = await req("/auth/register", { body: { role: "vendedor", email: "vitima@exemplo.invalid", senha: "123456", aceitouTermos: true } });
  const ckVitima = r.cookie;
  const sellerId = db.prepare("SELECT entityId FROM users WHERE email = 'vitima@exemplo.invalid'").get().entityId;
  db.prepare("UPDATE sellers SET pix = 'pix-da-vitima', email = 'vitima@exemplo.invalid' WHERE id = ?").run(sellerId);

  // Empresa atacante (cookie forjado com entityId de empresa).
  const ckEmpresa = assinar({ id: "userE", role: "empresa", entityId: "empresa-atacante" });
  r = await req(`/sellers/${sellerId}`, { cookie: ckEmpresa, method: "PATCH", body: { pix: "pix-do-atacante", email: "atacante@mal.invalid" } });
  assert.equal(r.status, 403, "empresa não edita profissional");

  // Outro profissional também não.
  const ckOutro = assinar({ id: "userO", role: "vendedor", entityId: "outro-seller" });
  r = await req(`/sellers/${sellerId}`, { cookie: ckOutro, method: "PATCH", body: { pix: "pix-do-atacante" } });
  assert.equal(r.status, 403, "outro profissional não edita");

  // Pix e e-mail intactos após as tentativas.
  let atual = db.prepare("SELECT pix, email FROM sellers WHERE id = ?").get(sellerId);
  assert.equal(atual.pix, "pix-da-vitima", "Pix não foi alterado por terceiros");
  assert.equal(atual.email, "vitima@exemplo.invalid", "e-mail não foi alterado por terceiros");

  // Funcionalidade preservada: o próprio profissional edita o seu Pix.
  r = await req(`/sellers/${sellerId}`, { cookie: ckVitima, method: "PATCH", body: { pix: "pix-novo-da-vitima" } });
  assert.equal(r.status, 200, "o dono edita o próprio cadastro");
  atual = db.prepare("SELECT pix FROM sellers WHERE id = ?").get(sellerId);
  assert.equal(atual.pix, "pix-novo-da-vitima");

  // Admin continua podendo administrar (ex.: status).
  const ckAdmin = assinar({ id: "admin-teste", role: "admin", entityId: null });
  r = await req(`/sellers/${sellerId}`, { cookie: ckAdmin, method: "PATCH", body: { status: "aprovado" } });
  assert.equal(r.status, 200, "admin administra o profissional");
});

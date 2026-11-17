import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente } from "./apoio/servidor.js";
import { reauthAtivo } from "../server/services/reautenticacao.js";

const LOGO = { mimetype: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" };
async function empresa(req, db, email) {
  await req("/auth/register", { body: { role: "empresa", email, senha: "12345678", whats: "11912345678", nome: "Empresa Teste", logo: LOGO, aceitouTermos: true } });
  return db.prepare("SELECT entityId FROM users WHERE email = ?").get(email).entityId;
}
async function vendedor(req, db, email) {
  await req("/auth/register", { body: { role: "vendedor", email, senha: "123456", aceitouTermos: true } });
  return db.prepare("SELECT entityId FROM users WHERE email = ?").get(email).entityId;
}

test("contacts: só distribui/atribui contato a profissional do Time (applications aprovado)", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  const A = await empresa(req, db, "ct-a@exemplo.invalid");
  const V = await vendedor(req, db, "ct-v@exemplo.invalid");   // do Time
  const W = await vendedor(req, db, "ct-w@exemplo.invalid");   // fora do Time
  db.prepare("INSERT INTO applications (sellerId, companyId, status) VALUES (?, ?, 'aprovado')").run(V, A);

  const camp = await req("/campaigns", { cookie: (await req("/auth/login", { body: { email: "ct-a@exemplo.invalid", senha: "12345678" } })).cookie, body: { titulo: "C" } });
  const ckA = (await req("/auth/login", { body: { email: "ct-a@exemplo.invalid", senha: "12345678" } })).cookie;
  const campaignId = camp.corpo.id;
  db.prepare("INSERT INTO campaign_contacts (id, campaignId, companyId, nome, telefone, status, criadoEm) VALUES ('k1', ?, ?, 'Cliente', '11988', 'disponivel', ?)").run(campaignId, A, Date.now());

  // Distribuir para quem NÃO é do Time → 422; contato segue disponível.
  let r = await req("/contacts/distribuir", { cookie: ckA, body: { campaignId, sellers: [W] } });
  assert.equal(r.status, 422, "profissional fora do Time é recusado");
  assert.equal(db.prepare("SELECT status FROM campaign_contacts WHERE id='k1'").get().status, "disponivel");

  // PATCH atribuindo a quem não é do Time → 422.
  r = await req("/contacts/k1", { cookie: ckA, method: "PATCH", body: { sellerId: W } });
  assert.equal(r.status, 422);

  // Distribuir para profissional do Time → ok.
  r = await req("/contacts/distribuir", { cookie: ckA, body: { campaignId, sellers: [V] } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.distribuidos, 1);
  assert.equal(db.prepare("SELECT sellerId FROM campaign_contacts WHERE id='k1'").get().sellerId, V);
});

test("leads: GET /leads/comissoes não é sombreada por /leads/:id", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  t.after(() => db.close());

  const ckA = (await (async () => { await empresa(req, db, "lc-a@exemplo.invalid"); return req("/auth/login", { body: { email: "lc-a@exemplo.invalid", senha: "12345678" } }); })()).cookie;
  const r = await req("/leads/comissoes", { cookie: ckA });
  assert.equal(r.status, 200, "comissoes responde (não cai no /leads/:id → 404)");
  assert.ok(Array.isArray(r.corpo.vendedores), "payload de comissões, não de lead");
});

test("reautenticação financeira: ativa por padrão em produção, desligável", () => {
  const orig = { env: process.env.NODE_ENV, flag: process.env.REAUTH_FINANCEIRO };
  try {
    delete process.env.REAUTH_FINANCEIRO; process.env.NODE_ENV = "production";
    assert.equal(reauthAtivo(), true, "produção sem flag → ativa");
    process.env.REAUTH_FINANCEIRO = "0";
    assert.equal(reauthAtivo(), false, "produção com REAUTH_FINANCEIRO=0 → desligada");
    delete process.env.REAUTH_FINANCEIRO; process.env.NODE_ENV = "test";
    assert.equal(reauthAtivo(), false, "test sem flag → desligada (não quebra testes)");
    process.env.REAUTH_FINANCEIRO = "1";
    assert.equal(reauthAtivo(), true, "flag=1 em qualquer ambiente → ativa");
  } finally {
    if (orig.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = orig.env;
    if (orig.flag === undefined) delete process.env.REAUTH_FINANCEIRO; else process.env.REAUTH_FINANCEIRO = orig.flag;
  }
});

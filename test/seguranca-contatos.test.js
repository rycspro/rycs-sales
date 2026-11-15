import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar, cliente } from "./apoio/servidor.js";

// V1 — BOLA em campaign_contacts: nenhuma empresa pode ler/alterar/apagar os
// contatos (PII de leads) de outra. A correção escopa tudo pela empresa dona da
// campanha, com companyId vindo da sessão, nunca do corpo.

test("contatos de campanha ficam isolados por empresa", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());
  const agora = Date.now();

  // Empresa A (dona) — conta real, para criar a campanha.
  let r = await req("/auth/register", { body: { role: "empresa", email: "donaa@exemplo.invalid", senha: "12345678", whats: "11912345678", nome: "Empresa A", logo: { mimetype: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }, aceitouTermos: true } });
  const ckA = r.cookie;
  const companyA = db.prepare("SELECT entityId FROM users WHERE email = 'donaa@exemplo.invalid'").get().entityId;

  r = await req("/campaigns", { cookie: ckA, body: { titulo: "Campanha A" } });
  const campanhaA = r.corpo.id;
  assert.ok(campanhaA, "campanha A criada");

  // Lead com PII na campanha de A.
  db.prepare("INSERT INTO campaign_contacts (id, campaignId, companyId, nome, telefone, email, status, criadoEm) VALUES ('cA1', ?, ?, 'Cliente Secreto', '11999990000', 'cliente@sigilo.invalid', 'disponivel', ?)")
    .run(campanhaA, companyA, agora);

  // Atacante: outra empresa (cookie forjado com entityId diferente).
  const ckB = assinar({ id: "userB", role: "empresa", entityId: "empresa-B" });

  // Leitura cruzada → 403 (sem vazar PII).
  r = await req(`/contacts/${campanhaA}`, { cookie: ckB });
  assert.equal(r.status, 403, "B não lê contatos de A");

  // Remoção cruzada → 403, e o contato continua lá.
  r = await req(`/contacts/${campanhaA}`, { cookie: ckB, method: "DELETE" });
  assert.equal(r.status, 403, "B não apaga contatos de A");

  // Alteração cruzada por id → 403.
  r = await req(`/contacts/cA1`, { cookie: ckB, method: "PATCH", body: { status: "distribuido" } });
  assert.equal(r.status, 403, "B não altera contato de A");

  // Distribuição cruzada → 403.
  r = await req(`/contacts/distribuir`, { cookie: ckB, body: { campaignId: campanhaA, sellers: ["x"] } });
  assert.equal(r.status, 403, "B não distribui contatos de A");

  // Upload para a campanha de A usando o corpo → 403 (companyId do corpo é ignorado).
  r = await req(`/contacts/upload`, { cookie: ckB, body: { campaignId: campanhaA, companyId: "empresa-B", dados: [{ nome: "Injetado", telefone: "11888880000" }] } });
  assert.equal(r.status, 403, "B não injeta contatos na campanha de A");

  // Nada foi destruído nem injetado.
  const restantes = db.prepare("SELECT COUNT(*) n FROM campaign_contacts WHERE campaignId = ?").get(campanhaA).n;
  assert.equal(restantes, 1, "contato de A intacto");

  // Funcionalidade preservada: a dona lê os próprios contatos.
  r = await req(`/contacts/${campanhaA}`, { cookie: ckA });
  assert.equal(r.status, 200, "A lê os próprios contatos");
  assert.equal(r.corpo.total, 1);
  assert.equal(r.corpo.contatos[0].nome, "Cliente Secreto");

  // Upload da própria dona grava com o companyId da campanha (não do corpo).
  r = await req(`/contacts/upload`, { cookie: ckA, body: { campaignId: campanhaA, companyId: "mentira", dados: [{ nome: "Novo", telefone: "11777770000" }] } });
  assert.equal(r.status, 200, "A faz upload na própria campanha");
  const novo = db.prepare("SELECT companyId FROM campaign_contacts WHERE nome = 'Novo'").get();
  assert.equal(novo.companyId, companyA, "companyId vem da campanha, não do corpo");
});

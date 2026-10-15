import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar, cliente } from "./apoio/servidor.js";

// O admin sempre consegue excluir uma empresa. O caso que travava: tabelas
// com chave estrangeira para a empresa ou para as campanhas dela que não
// estavam na lista fixa da exclusão (brain_onboarding, company_billing,
// professional_notes, campaign_contacts, campaign_quiz_attempts...).

test("admin exclui empresa com campanhas, saldo e registros em todas as tabelas ligadas", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000"); // o servidor escreve no mesmo arquivo
  t.after(() => db.close());
  const agora = Date.now();

  let r = await req("/auth/register", { body: { role: "empresa", email: "excluir@exemplo.invalid", senha: "12345678", whats: "11912345678", nome: "Empresa Teste", logo: { mimetype: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }, aceitouTermos: true } });
  const ckEmpresa = r.cookie;
  const companyId = db.prepare("SELECT entityId FROM users WHERE email = 'excluir@exemplo.invalid'").get().entityId;
  r = await req("/auth/register", { body: { role: "vendedor", email: "vend@exemplo.invalid", senha: "123456", aceitouTermos: true } });
  const sellerId = db.prepare("SELECT entityId FROM users WHERE email = 'vend@exemplo.invalid'").get().entityId;

  r = await req("/campaigns", { cookie: ckEmpresa, body: { titulo: "Campanha a excluir" } });
  const campaignId = r.corpo.id;

  db.prepare("UPDATE companies SET saldo = 250 WHERE id = ?").run(companyId);
  db.prepare("INSERT INTO brain_onboarding (id, companyId, criadoEm, atualizadoEm) VALUES ('b1', ?, ?, ?)").run(companyId, agora, agora);
  db.prepare("INSERT INTO company_billing (companyId, billing_status) VALUES (?, 'ativa')").run(companyId);
  db.prepare("INSERT INTO professional_notes (companyId, sellerId, observacao, atualizadoEm) VALUES (?, ?, 'nota', ?)").run(companyId, sellerId, agora);
  db.prepare("INSERT INTO campaign_contacts (id, campaignId, companyId, criadoEm) VALUES ('cc1', ?, ?, ?)").run(campaignId, companyId, agora);
  db.prepare("INSERT INTO campaign_quiz_attempts (id, campaignId, sellerId, score, criadoEm) VALUES ('q1', ?, ?, 80, ?)").run(campaignId, sellerId, agora);
  db.prepare("INSERT INTO platform_earnings (id, submissionId, companyId, sellerId, bruto, taxa, liquido, criadoEm) VALUES ('pe1', 's1', ?, ?, 10, 3, 7, ?)").run(companyId, sellerId, agora);

  const cookieAdmin = assinar({ id: "admin-teste", role: "admin", entityId: null });
  const ckOutraEmpresa = assinar({ id: "x", role: "empresa", entityId: "outra" });

  // Só a plataforma exclui.
  r = await req(`/companies/${companyId}`, { cookie: ckOutraEmpresa, method: "DELETE" });
  assert.equal(r.status, 403);

  // Com saldo, a primeira chamada só avisa; confirmando, exclui.
  r = await req(`/companies/${companyId}`, { cookie: cookieAdmin, method: "DELETE" });
  assert.equal(r.status, 409);
  assert.equal(r.corpo.saldo, 250);
  r = await req(`/companies/${companyId}?forcar=true`, { cookie: cookieAdmin, method: "DELETE" });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));

  const resta = (sql, ...a) => db.prepare(sql).get(...a).n;
  assert.equal(resta("SELECT COUNT(*) n FROM companies WHERE id = ?", companyId), 0);
  assert.equal(resta("SELECT COUNT(*) n FROM users WHERE entityId = ?", companyId), 0);
  assert.equal(resta("SELECT COUNT(*) n FROM campaigns WHERE companyId = ?", companyId), 0);
  for (const tabela of ["brain_onboarding", "company_billing", "professional_notes", "campaign_contacts", "campaign_events", "onboarding"])
    assert.equal(resta(`SELECT COUNT(*) n FROM ${tabela} WHERE companyId = ?`, companyId), 0, tabela);
  assert.equal(resta("SELECT COUNT(*) n FROM campaign_quiz_attempts WHERE campaignId = ?", campaignId), 0);
  // Receita da plataforma fica como histórico; o profissional continua.
  assert.equal(resta("SELECT COUNT(*) n FROM platform_earnings WHERE companyId = ?", companyId), 1);
  assert.equal(resta("SELECT COUNT(*) n FROM sellers WHERE id = ?", sellerId), 1);

  // A proteção dos eventos de campanha volta logo depois da exclusão.
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name = 'no_delete_campaign_events'").get());
  r = await req("/auth/register", { body: { role: "empresa", email: "outra@exemplo.invalid", senha: "12345678", whats: "11912345678", nome: "Empresa Teste", logo: { mimetype: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }, aceitouTermos: true } });
  await req("/campaigns", { cookie: r.cookie, body: { titulo: "Outra" } });
  assert.throws(() => db.prepare("DELETE FROM campaign_events").run(), /imutáveis/);

  // A conta da empresa excluída não entra mais.
  r = await req("/auth/login", { body: { email: "excluir@exemplo.invalid", senha: "12345678" } });
  assert.equal(r.status, 401);
});

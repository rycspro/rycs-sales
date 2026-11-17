import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar, cliente } from "./apoio/servidor.js";

// Regressão de autorização / isolamento multitenant.
//
// Cada bloco prova uma falha de autorização encontrada na auditoria e a trava:
//   contacts.js  — BOLA/BFLA: nenhum check de posse (C1/C2)
//   campaigns.js — vazamento de candidaturas de concorrentes (H1)
//   companies.js — mass-assignment de recurso pago destaque/plano (H2)
//   state.js     — fallback de erro devolvia o estado de todos os tenants (H3)
//   course.js    — empresa forjava progresso de profissional fora do Time (M2)

const LOGO = { mimetype: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" };

async function registrarEmpresa(req, db, email) {
  const r = await req("/auth/register", { body: { role: "empresa", email, senha: "12345678", whats: "11912345678", nome: "Empresa", logo: LOGO, aceitouTermos: true } });
  const id = db.prepare("SELECT entityId FROM users WHERE email = ?").get(email).entityId;
  return { cookie: r.cookie, id };
}
async function registrarVendedor(req, db, email) {
  const r = await req("/auth/register", { body: { role: "vendedor", email, senha: "123456", aceitouTermos: true } });
  const id = db.prepare("SELECT entityId FROM users WHERE email = ?").get(email).entityId;
  return { cookie: r.cookie, id };
}

test("contacts.js: só a empresa dona (ou admin) lê/escreve contatos da campanha", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  const A = await registrarEmpresa(req, db, "donaa@exemplo.invalid");
  const B = await registrarEmpresa(req, db, "donab@exemplo.invalid");
  const V = await registrarVendedor(req, db, "vend-c@exemplo.invalid");

  const camp = await req("/campaigns", { cookie: A.cookie, body: { titulo: "Campanha A" } });
  const campaignId = camp.corpo.id;
  db.prepare("INSERT INTO campaign_contacts (id, campaignId, companyId, nome, telefone, email, status, criadoEm) VALUES ('ct1', ?, ?, 'Fulano', '11999', 'f@x.com', 'disponivel', ?)")
    .run(campaignId, A.id, Date.now());

  // Empresa dona enxerga.
  let r = await req(`/contacts/${campaignId}`, { cookie: A.cookie });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.contatos.length, 1);

  // Outra empresa: leitura e todas as escritas bloqueadas (403 via escopo.js).
  r = await req(`/contacts/${campaignId}`, { cookie: B.cookie });
  assert.equal(r.status, 403, "GET cross-tenant deve ser bloqueado");
  r = await req("/contacts/upload", { cookie: B.cookie, body: { campaignId, companyId: B.id, dados: [{ nome: "x", telefone: "1" }] } });
  assert.equal(r.status, 403, "upload cross-tenant deve ser bloqueado");
  r = await req("/contacts/ct1", { cookie: B.cookie, method: "PATCH", body: { status: "distribuido", sellerId: V.id } });
  assert.equal(r.status, 403, "PATCH cross-tenant deve ser bloqueado");
  r = await req("/contacts/distribuir", { cookie: B.cookie, body: { campaignId, sellers: [V.id] } });
  assert.equal(r.status, 403, "distribuir cross-tenant deve ser bloqueado");
  r = await req(`/contacts/${campaignId}`, { cookie: B.cookie, method: "DELETE" });
  assert.equal(r.status, 403, "DELETE cross-tenant deve ser bloqueado");

  // O contato segue intacto e ligado à empresa A.
  const contato = db.prepare("SELECT companyId, status FROM campaign_contacts WHERE id = 'ct1'").get();
  assert.equal(contato.companyId, A.id);
  assert.equal(contato.status, "disponivel");

  // Vendedor não administra contatos.
  r = await req(`/contacts/${campaignId}`, { cookie: V.cookie });
  assert.equal(r.status, 403, "vendedor não lê contatos");

  // Upload legítimo da dona: companyId vem da campanha, nunca do corpo (forjado).
  r = await req("/contacts/upload", { cookie: A.cookie, body: { campaignId, companyId: "forjado", dados: [{ nome: "Novo", telefone: "11888" }] } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.inseridos, 1);
  const novo = db.prepare("SELECT companyId FROM campaign_contacts WHERE telefone = '11888'").get();
  assert.equal(novo.companyId, A.id, "companyId deve ser derivado da campanha, não do corpo");
});

test("campaigns.js: vendedor só vê a própria candidatura; a empresa dona vê todas", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  const A = await registrarEmpresa(req, db, "dona-h1@exemplo.invalid");
  const V1 = await registrarVendedor(req, db, "v1-h1@exemplo.invalid");
  const V2 = await registrarVendedor(req, db, "v2-h1@exemplo.invalid");

  const camp = await req("/campaigns", { cookie: A.cookie, body: { titulo: "Ativa" } });
  const campaignId = camp.corpo.id;
  db.prepare("UPDATE campaigns SET status = 'ativa' WHERE id = ?").run(campaignId);
  const agora = Date.now();
  db.prepare("INSERT INTO campaign_applications (id, campaignId, sellerId, status, mensagem, criadoEm) VALUES ('a1', ?, ?, 'pendente', 'quero entrar', ?)").run(campaignId, V1.id, agora);
  db.prepare("INSERT INTO campaign_applications (id, campaignId, sellerId, status, mensagem, criadoEm) VALUES ('a2', ?, ?, 'pendente', 'eu tambem', ?)").run(campaignId, V2.id, agora);

  // V1 só recebe a própria candidatura — nunca a do concorrente V2.
  let r = await req(`/campaigns/${campaignId}`, { cookie: V1.cookie });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.candidaturas.length, 1);
  assert.equal(r.corpo.candidaturas[0].sellerId, V1.id);

  // A empresa dona vê as duas candidaturas.
  r = await req(`/campaigns/${campaignId}`, { cookie: A.cookie });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.candidaturas.length, 2);
  const ids = r.corpo.candidaturas.map((c) => c.sellerId).sort();
  assert.deepEqual(ids, [V1.id, V2.id].sort());
});

test("companies.js: empresa não pode auto-conceder destaque/plano; admin pode", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  const A = await registrarEmpresa(req, db, "dona-h2@exemplo.invalid");

  // Empresa tenta ligar o recurso pago + trocar plano junto com um campo legítimo.
  let r = await req(`/companies/${A.id}`, { cookie: A.cookie, method: "PATCH", body: { nome: "Nome Novo", destaque: 1, destaqueTipo: "premium", plano: "pro" } });
  assert.equal(r.status, 200);
  let emp = db.prepare("SELECT nome, destaque, destaqueTipo, plano FROM companies WHERE id = ?").get(A.id);
  assert.equal(emp.nome, "Nome Novo", "campo legítimo aplicado");
  assert.ok(!emp.destaque, "destaque NÃO pode ser ligado pela empresa");
  assert.ok(emp.destaqueTipo == null || emp.destaqueTipo === "", "destaqueTipo NÃO pode ser definido pela empresa");
  assert.notEqual(emp.plano, "pro", "plano NÃO pode ser trocado pela empresa");

  // Admin (operação interna) consegue ajustar o recurso pago.
  const cookieAdmin = assinar({ id: "admin-teste", role: "admin", entityId: null });
  r = await req(`/companies/${A.id}`, { cookie: cookieAdmin, method: "PATCH", body: { destaque: 1, destaqueTipo: "premium" } });
  assert.equal(r.status, 200);
  emp = db.prepare("SELECT destaque, destaqueTipo FROM companies WHERE id = ?").get(A.id);
  assert.ok(emp.destaque, "admin pode ligar destaque");
  assert.equal(emp.destaqueTipo, "premium");
});

test("state.js: erro na consulta escopada não vaza o estado de outros tenants", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  const A = await registrarEmpresa(req, db, "dona-h3@exemplo.invalid");
  const B = await registrarEmpresa(req, db, "outra-h3@exemplo.invalid");

  // Força getEmpresaState(A) a lançar: JSON inválido em comissoes (parseCompany faz JSON.parse sem guarda).
  db.prepare("UPDATE companies SET comissoes = '{invalido' WHERE id = ?").run(A.id);

  const r = await req("/state", { cookie: A.cookie });
  assert.equal(r.status, 200);
  const ids = (r.corpo.companies || []).map((c) => c.id);
  assert.ok(!ids.includes(B.id), "não pode devolver a empresa B");
  assert.equal(r.corpo.companies.length, 0, "fallback de erro deve ser estado vazio, não getFullState()");
  assert.equal(r.corpo.sellers.length, 0);
});

test("campaigns.js quiz: bloqueia campanha não-ativa/invisível e limita tentativas", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  const A = await registrarEmpresa(req, db, "dona-q@exemplo.invalid");
  const V = await registrarVendedor(req, db, "v-q@exemplo.invalid");
  const quiz = JSON.stringify([{ pergunta: "1+1", correta: "2", modulo: "Base" }]);

  const camp = await req("/campaigns", { cookie: A.cookie, body: { titulo: "Com quiz" } });
  const campaignId = camp.corpo.id;
  db.prepare("UPDATE campaigns SET quiz = ?, maxTentativasQuiz = 2, notaMinimaQuiz = 70 WHERE id = ?").run(quiz, campaignId);

  // Rascunho (não ativa): vendedor não lê nem responde o quiz.
  let r = await req(`/campaigns/${campaignId}/quiz`, { cookie: V.cookie });
  assert.equal(r.status, 404, "quiz de rascunho é 404");
  r = await req(`/campaigns/${campaignId}/quiz`, { cookie: V.cookie, body: { respostas: ["2"] } });
  assert.equal(r.status, 404, "responder quiz de rascunho é 404");

  // Ativa a campanha: fluxo legítimo libera.
  db.prepare("UPDATE campaigns SET status = 'ativa' WHERE id = ?").run(campaignId);
  r = await req(`/campaigns/${campaignId}/quiz`, { cookie: V.cookie });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.maxTentativas, 2);
  assert.ok(r.corpo.questoes[0].correta === undefined, "nunca envia o gabarito ao vendedor");

  // Empresa invisível volta a esconder o quiz.
  db.prepare("UPDATE companies SET visivel = 0 WHERE id = ?").run(A.id);
  r = await req(`/campaigns/${campaignId}/quiz`, { cookie: V.cookie });
  assert.equal(r.status, 404, "empresa invisível esconde o quiz");
  db.prepare("UPDATE companies SET visivel = 1 WHERE id = ?").run(A.id);

  // Limite de tentativas: 2 permitidas, a 3ª é 429 (sem repetir até passar).
  r = await req(`/campaigns/${campaignId}/quiz`, { cookie: V.cookie, body: { respostas: ["0"] } });
  assert.equal(r.status, 200);
  r = await req(`/campaigns/${campaignId}/quiz`, { cookie: V.cookie, body: { respostas: ["0"] } });
  assert.equal(r.status, 200);
  r = await req(`/campaigns/${campaignId}/quiz`, { cookie: V.cookie, body: { respostas: ["2"] } });
  assert.equal(r.status, 429, "excedeu o limite de tentativas");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM campaign_quiz_attempts WHERE campaignId = ? AND sellerId = ?").get(campaignId, V.id).n, 2);
});

test("course.js: empresa só grava progresso de profissional do próprio Time", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  const A = await registrarEmpresa(req, db, "dona-m2@exemplo.invalid");
  const V = await registrarVendedor(req, db, "v-m2@exemplo.invalid");

  // Sem vínculo aprovado: bloqueado.
  let r = await req("/course-progress", { cookie: A.cookie, method: "PATCH", body: { sellerId: V.id, companyId: A.id, moduleIds: ["m1"] } });
  assert.equal(r.status, 403, "sem vínculo não pode gravar progresso");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM course_progress WHERE sellerId = ? AND companyId = ?").get(V.id, A.id).n, 0);

  // Com parceria aprovada: liberado.
  db.prepare("INSERT INTO applications (sellerId, companyId, status) VALUES (?, ?, 'aprovado')").run(V.id, A.id);
  r = await req("/course-progress", { cookie: A.cookie, method: "PATCH", body: { sellerId: V.id, companyId: A.id, moduleIds: ["m1"] } });
  assert.equal(r.status, 200, "com vínculo aprovado deve gravar");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM course_progress WHERE sellerId = ? AND companyId = ?").get(V.id, A.id).n, 1);
});

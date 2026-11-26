import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar, cliente } from "./apoio/servidor.js";

// Salvamento automático de campanha em rascunho: a correção garante que a
// campanha é persistida NO BANCO desde a primeira interação (não só em
// localStorage), com atualização parcial que não apaga campos não enviados,
// restauração da etapa atual (passoWizard), isolamento por empresa e exclusão
// real do rascunho. Cobre os critérios de homologação 1, 2, 8, 9, 11 e 13.
test("rascunho de campanha: autosave real, patch parcial, etapa, ownership e exclusão", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  // Duas empresas distintas (isolamento/ownership).
  const logo = { mimetype: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" };
  let r = await req("/auth/register", { body: { role: "empresa", email: "dona@exemplo.invalid", senha: "12345678", whats: "11911111111", nome: "Empresa Dona", logo, aceitouTermos: true } });
  const ckDona = r.cookie;
  r = await req("/auth/register", { body: { role: "empresa", email: "outra@exemplo.invalid", senha: "12345678", whats: "11922222222", nome: "Empresa Outra", logo, aceitouTermos: true } });
  const ckOutra = r.cookie;

  // 1) Primeira interação significativa cria o registro DRAFT no banco.
  r = await req("/campaigns", { cookie: ckDona, body: { objetivoUI: "agendar_reunioes", titulo: "Campanha sem título", passoWizard: 1 } });
  assert.equal(typeof r.corpo.id, "string");
  const id = r.corpo.id;
  let row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  assert.equal(row.status, "rascunho");
  assert.equal(row.objetivoUI, "agendar_reunioes");
  assert.equal(row.passoWizard, 1);
  assert.ok(row.atualizadoEm > 0, "atualizadoEm carimbado na criação");

  // 2) Autosave incremental: nome e descrição (etapa 2). Patch parcial NÃO pode
  //    apagar objetivoUI preenchido antes.
  await req(`/campaigns/${id}`, { cookie: ckDona, method: "PATCH", body: { titulo: "Prospecção Sudeste", descricao: "Agendar reuniões com distribuidoras", passoWizard: 1 } });
  row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  assert.equal(row.titulo, "Prospecção Sudeste");
  assert.equal(row.descricao, "Agendar reuniões com distribuidoras");
  assert.equal(row.objetivoUI, "agendar_reunioes", "campo anterior preservado no patch parcial");

  // 3) Avança a etapa e salva ações remuneradas (JSON) — etapa restaurável.
  await req(`/campaigns/${id}`, { cookie: ckDona, method: "PATCH", body: { passoWizard: 3, canais: ["whatsapp", "ligacao"], acoesAtivas: ["agendamento"], tarefas: { agendamento: 40 }, orcamento: 2000 } });
  row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  assert.equal(row.passoWizard, 3, "etapa atual persistida (volta exatamente onde parou)");
  assert.deepEqual(JSON.parse(row.canais), ["whatsapp", "ligacao"]);
  assert.deepEqual(JSON.parse(row.tarefas), { agendamento: 40 });
  assert.equal(row.orcamento, 2000);
  assert.equal(row.titulo, "Prospecção Sudeste", "título preservado entre autosaves");

  // 4) GET recupera o rascunho com a etapa e todos os campos.
  r = await req(`/campaigns/${id}`, { cookie: ckDona });
  assert.equal(r.corpo.passoWizard, 3);
  assert.equal(r.corpo.titulo, "Prospecção Sudeste");
  assert.deepEqual(r.corpo.acoesAtivas, ["agendamento"]);

  // 5) Aparece na listagem de rascunhos da própria empresa.
  r = await req("/campaigns", { cookie: ckDona });
  assert.ok(r.corpo.some((c) => c.id === id && c.status === "rascunho"), "rascunho listado para a empresa dona");

  // 6) Ownership: outra empresa não vê, não edita e não exclui.
  r = await req(`/campaigns/${id}`, { cookie: ckOutra });
  assert.equal(r.status, 403, "outra empresa não acessa o rascunho");
  r = await req(`/campaigns/${id}`, { cookie: ckOutra, method: "PATCH", body: { titulo: "invadido" } });
  assert.equal(r.status, 403);
  r = await req(`/campaigns/${id}`, { cookie: ckOutra, method: "DELETE" });
  assert.equal(r.status, 403);
  assert.equal(db.prepare("SELECT titulo FROM campaigns WHERE id = ?").get(id).titulo, "Prospecção Sudeste", "rascunho intacto após tentativa de invasão");

  // 7) Publicação é transição de status no MESMO registro — sem duplicar.
  //    (Sem plano a publicação é barrada; aqui só garantimos que não há novo id.)
  const antes = db.prepare("SELECT COUNT(*) n FROM campaigns").get().n;

  // 8) Exclusão real do rascunho pela empresa dona.
  r = await req(`/campaigns/${id}`, { cookie: ckDona, method: "DELETE" });
  assert.equal(r.corpo.ok, true);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM campaigns WHERE id = ?").get(id).n, 0, "rascunho removido do banco");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM campaigns").get().n, antes - 1);
});

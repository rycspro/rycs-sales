import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Banco temporário e Resend desligado (sendEmail só registra no log).
const dir = mkdtempSync(join(tmpdir(), "rycs-email-leads-"));
Object.assign(process.env, {
  DB_PATH: join(dir, "test.db"), JWT_SECRET: "segredo-teste-email-leads", NODE_ENV: "test", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "",
});
await import("../server/services/metaLeadsRycs.js");
const { descadastrar } = await import("../server/services/sequenciasEmail.js");
const { leadsDoPublico, emailParaLead, enviarLoteLeads } = await import("../server/routes/emailAdmin.js");
const { default: db } = await import("../server/db.js");
test.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

let n = 0;
const lead = (nome, email, telefone, pais = "") =>
  db.prepare("INSERT INTO rycs_leads_meta (leadgenId, nome, email, telefone, pais, criadoEm, importadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(`L${++n}`, nome, email, telefone, pais, 1000 + n, 1000 + n);

lead("RAHUL KUMAR", "rahul@x.invalid", "+91 98765 43210");
lead("Priya", "Priya@X.invalid", "", "IN");                 // Índia pelo país do formulário
lead("João", "joao@x.invalid", "+55 11 98888-7777");        // Brasil: fora
lead("Sem email", "", "+91 98765 00000");                   // sem e-mail: fora
lead("Repetido", "rahul@x.invalid", "+91 98765 43210");     // mesmo e-mail: conta uma vez
lead("Tem conta", "conta@x.invalid", "+91 90000 11111");    // já tem conta: fora
lead("Saiu", "saiu@x.invalid", "+91 90000 22222");          // descadastrado: fora
db.prepare("INSERT INTO users (id, email, senha, role, criadoEm) VALUES ('U1', 'conta@x.invalid', 'x', 'vendedor', 1)").run();
descadastrar("saiu@x.invalid");

test("público da Índia: só leads +91/IN com e-mail, sem conta e sem descadastro", () => {
  const { pendentes, jaReceberam } = leadsDoPublico("leads_india", "Hello");
  assert.deepEqual(pendentes.map((p) => p.email), ["rahul@x.invalid", "priya@x.invalid"]);
  assert.equal(jaReceberam, 0);
  assert.equal(leadsDoPublico("todos"), null);
});

test("e-mail em inglês com primeiro nome, descadastro em inglês e um clique", () => {
  const m = emailParaLead({
    assunto: "{{nome}}, sell for Brazilian companies", preheader: "", conteudo: "Hi {{nome}},\n\nLine <b>two</b>",
    cta: "", botao: "", nome: "RAHUL KUMAR", email: "rahul@x.invalid", publico: "leads_india",
  });
  assert.equal(m.assunto, "Rahul, sell for Brazilian companies");
  assert.match(m.html, /Hi Rahul,/);
  assert.match(m.html, /Line &lt;b&gt;two&lt;\/b&gt;/);
  assert.match(m.html, /Get started/);
  assert.match(m.html, /Unsubscribe/);
  assert.match(m.headers["List-Unsubscribe"], /\/api\/email\/descadastro\?e=.+&t=.+&l=en>$/);
  assert.equal(m.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(m.text, /Unsubscribe: http/);
  const semNome = emailParaLead({ assunto: "Hi {{nome}}", conteudo: "x", nome: "", email: "a@x.invalid", publico: "leads_india" });
  assert.equal(semNome.assunto, "Hi there");
});

test("lote registra cada envio e o próximo lote pula quem já recebeu o assunto", async () => {
  const info = db.prepare("INSERT INTO email_dispatches (adminId, assunto, publico, quantidade, status, criadoEm) VALUES ('A', 'Hello', 'Leads', 0, 'enviando', 1)").run();
  const { pendentes } = leadsDoPublico("leads_india", "Hello");
  const r = await enviarLoteLeads({ dispatchId: info.lastInsertRowid, publico: "leads_india", lote: pendentes.slice(0, 1), dados: { assunto: "Hello", conteudo: "Hi {{nome}}" } });
  assert.deepEqual(r, { enviados: 1, falhas: 0 });
  const d = db.prepare("SELECT quantidade, status FROM email_dispatches WHERE id = ?").get(info.lastInsertRowid);
  assert.deepEqual({ ...d }, { quantidade: 1, status: "enviado" });

  const depois = leadsDoPublico("leads_india", "Hello");
  assert.deepEqual(depois.pendentes.map((p) => p.email), ["priya@x.invalid"]);
  assert.equal(depois.jaReceberam, 1);
  // Outro assunto: todos voltam a ser pendentes.
  assert.equal(leadsDoPublico("leads_india", "Outro").pendentes.length, 2);
});

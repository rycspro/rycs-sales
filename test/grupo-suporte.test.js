import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { linkDeGrupo, nomeDoGrupo, MODELO_GRUPO } from "../shared/grupoSuporte.js";

const dir = mkdtempSync(join(tmpdir(), "rycs-grupo-"));
Object.assign(process.env, {
  DB_PATH: join(dir, "test.db"), JWT_SECRET: "segredo-teste-grupo", NODE_ENV: "test", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ASAAS_API_KEY: "",
  WHATSAPP_TOKEN: "tok", WHATSAPP_PHONE_NUMBER_ID: "PN1", WHATSAPP_WABA_ID: "WABA1",
});
const meta = await import("../server/services/meta.js");
const g = await import("../server/services/grupoSuporte.js");
const { ativarAssinatura } = await import("../server/routes/subscriptions.js");
const { guardarAvisoWhatsapp } = await import("../server/services/whatsapp.js");
const { default: db } = await import("../server/db.js");
test.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

let chamadas = [], modelo = false, oficial = false;
meta.usarFetch(async (url, o = {}) => {
  const corpo = o.body ? JSON.parse(o.body) : null;
  chamadas.push({ url: String(url), metodo: o.method || "GET", corpo });
  let r = {};
  if (url.includes("message_templates")) r = { data: modelo ? [{ name: MODELO_GRUPO.nome, language: "pt_BR", status: "APPROVED", components: [{ type: "BODY", text: MODELO_GRUPO.corpo }] }] : [] };
  else if (url.includes("is_official_business_account")) r = { is_official_business_account: oficial };
  else if (url.includes("/groups")) r = { request_id: "req1" };
  else if (url.includes("/messages")) r = { messages: [{ id: `w${chamadas.length}` }] };
  return { ok: true, status: 200, json: async () => r };
});
// Meio-dia em Brasília, para o horário de silêncio não mudar o resultado.
const MEIO_DIA = Date.UTC(2026, 10, 24, 15);
test.before(() => { Date.now = () => MEIO_DIA; });
const reset = () => { chamadas = []; g.esquecerModelo(); g.esquecerContaOficial(); };
const ins = (sql, ...a) => db.prepare(sql).run(...a);
const empresa = (id, whatsapp = "11988887777") => {
  ins("INSERT INTO companies (id, nome, produto, whatsapp, representanteLegal, criadoEm) VALUES (?, ?, 'x', ?, 'Ana Souza', 1)", id, `Empresa ${id}`, whatsapp);
  ins("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'empresa', ?, 1)", `u-${id}`, `${id}@x.invalid`, id);
};
const linha = (id) => db.prepare("SELECT * FROM grupos_suporte WHERE companyId = ?").get(id);
const enviadas = () => chamadas.filter((c) => c.url.includes("/messages") && c.metodo === "POST");
if (!db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) ins("INSERT INTO users (id, email, senha, role, criadoEm) VALUES ('adm', 'adm@x.invalid', 'x', 'admin', 1)");
const admin = db.prepare("SELECT id FROM users WHERE role = 'admin'").get().id;

test("link e nome do grupo", () => {
  assert.equal(linkDeGrupo(" https://chat.whatsapp.com/AbCdEf123456?mode=x "), "https://chat.whatsapp.com/AbCdEf123456");
  for (const x of ["https://evil.com/chat.whatsapp.com/AbCdEf123456", "http://chat.whatsapp.com/AbCdEf123456", "javascript:alert(1)", ""]) assert.equal(linkDeGrupo(x), "");
  assert.equal(nomeDoGrupo("x".repeat(300)).length, 128);
});

test("pagamento confirmado põe a empresa na fila uma vez só; trial não", () => {
  empresa("a");
  ins("INSERT INTO subscriptions (id, companyId, plano, status, asaasId, criadoEm, atualizadoEm) VALUES ('s1', 'a', 'growth', 'pendente', 'as1', 1, 1)");
  assert.equal(linha("a"), undefined);
  ativarAssinatura("as1");
  assert.ok(linha("a"));
  const { token } = linha("a");
  ativarAssinatura("as1");
  assert.equal(linha("a").token, token);
  assert.equal(g.aoPagarPlano("nao-existe"), false);
});

test("sem grupo: avisa o admin uma vez e não manda nada ao cliente", async () => {
  reset();
  await g.processarGrupos();
  await g.processarGrupos();
  assert.equal(linha("a").status, "aguardando_link");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM notifications WHERE userId = ? AND titulo = 'Criar grupo de suporte'").get(admin).n, 1);
  assert.equal(enviadas().length, 0);
});

test("admin cola o link: avisa no sistema e espera o modelo; aprovado, envia uma vez", async () => {
  reset();
  assert.throws(() => g.definirLink("a", "https://evil.com/x"), /link de convite/);
  g.definirLink("a", "https://chat.whatsapp.com/GrupoDaEmpresaA1");
  await g.processarGrupos();
  assert.equal(linha("a").envio, "aguardando_modelo");
  assert.equal(enviadas().length, 0, "sem modelo aprovado não há envio");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM notifications WHERE userId = 'u-a' AND tipo = 'suporte'").get().n, 1);

  modelo = true; reset();
  db.prepare("UPDATE grupos_suporte SET proximaEm = 0").run();
  await g.processarGrupos();
  await g.processarGrupos();
  assert.equal(enviadas().length, 1);
  const c = enviadas()[0].corpo;
  assert.equal(c.to, "5511988887777");
  assert.equal(c.template.name, MODELO_GRUPO.nome);
  assert.equal(c.template.components[1].parameters[0].text, `grupo-suporte/?t=${linha("a").token}`);
  assert.equal(linha("a").envio, "enviado");
  assert.deepEqual(g.grupoDoToken(linha("a").token), { empresa: "Empresa a", link: "https://chat.whatsapp.com/GrupoDaEmpresaA1" });
  assert.equal(g.grupoDoToken("' OR 1=1"), null);
});

test("quem pediu para sair não recebe; conversa aberta recebe texto livre", async () => {
  reset();
  empresa("b", "11977776666");
  empresa("c", "11966665555");
  const recebe = (de, texto) => guardarAvisoWhatsapp({ object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [{ field: "messages", value: { metadata: { phone_number_id: "PN1" }, messages: [{ from: de, id: `in${de}`, timestamp: String(Math.floor((MEIO_DIA - 3600e3) / 1000)), type: "text", text: { body: texto } }] } }] }] });
  recebe("5511977776666", "sair");
  recebe("5511966665555", "já paguei");
  for (const id of ["b", "c"]) g.definirLink(id, `https://chat.whatsapp.com/GrupoDaEmpresa${id}9`);
  await g.processarGrupos();
  assert.equal(linha("b").envio, "pediu_para_sair");
  assert.equal(linha("c").envio, "enviado");
  assert.equal(enviadas().length, 1);
  assert.equal(enviadas()[0].corpo.type, "text");
});

test("conta oficial: cria o grupo na Meta e usa o link do webhook", async () => {
  reset(); oficial = true;
  empresa("d", "11955554444");
  g.aoPagarPlano("d");
  await g.processarGrupos();
  assert.equal(linha("d").status, "criando");
  assert.equal(chamadas.find((x) => x.url.includes("/PN1/groups")).corpo.subject, "RYCS + Empresa d");
  const aviso = { object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [{ field: "group_lifecycle_update", value: { groups: [{ type: "group_create", request_id: "req1", group_id: "G1", invite_link: "https://chat.whatsapp.com/CriadoPelaMeta1" }] } }] }] };
  assert.equal(g.receberAvisoGrupo(aviso), 1);
  assert.equal(g.receberAvisoGrupo(aviso), 0, "aviso repetido não muda nada");
  assert.equal(linha("d").link, "https://chat.whatsapp.com/CriadoPelaMeta1");
  assert.equal(linha("d").origem, "api");
});

test("horário de silêncio e grupo padrão", async () => {
  reset(); oficial = false;
  empresa("e", "11944443333");
  g.aoPagarPlano("e");
  g.definirLinkPadrao("https://chat.whatsapp.com/GrupoPadraoRycs");
  Date.now = () => Date.UTC(2026, 10, 25, 4); // 1h em Brasília
  await g.processarGrupos();
  assert.equal(linha("e").origem, "padrao");
  assert.equal(linha("e").envio, "pendente");
  assert.equal(enviadas().filter((x) => x.corpo.to === "5511944443333").length, 0);
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";

// Banco temporário e ambiente sem e-mail antes de carregar o serviço.
const dir = mkdtempSync(join(tmpdir(), "rycs-meta-"));
Object.assign(process.env, {
  DB_PATH: join(dir, "test.db"), JWT_SECRET: "segredo-teste-meta", NODE_ENV: "test",
  META_APP_ID: "123", META_APP_SECRET: "segredo-app", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "",
});
const meta = await import("../server/services/meta.js");
const { default: db } = await import("../server/db.js");
test.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

const ts = Date.now();
db.prepare("INSERT INTO companies (id, nome, produto, criadoEm) VALUES ('emp1', 'Empresa Meta', 'CRM', ?)").run(ts);
db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES ('u-emp', 'emp@x.invalid', 'x', 'empresa', 'emp1', ?)").run(ts);
db.prepare(`INSERT INTO meta_conexoes (companyId, status, tokenUsuario, pageId, pageNome, tokenPagina, adAccountId, adAccountNome, criadoEm, atualizadoEm)
  VALUES ('emp1', 'ativa', ?, 'P1', 'Página', ?, 'act_9', 'Conta', ?, ?)`).run(meta.cifrar("tok-usuario"), meta.cifrar("tok-pagina"), ts, ts);

function novoProfissional(id) {
  db.prepare("INSERT INTO sellers (id, nome, email, whats, criadoEm) VALUES (?, ?, ?, '11999999999', ?)").run(id, `Vendedor ${id}`, `${id}@x.invalid`, ts);
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'vendedor', ?, ?)").run(`u-${id}`, `${id}@x.invalid`, id, ts);
  db.prepare("INSERT INTO applications (sellerId, companyId, status) VALUES (?, 'emp1', 'aprovado')").run(id);
}

// Graph API falsa: responde conforme o caminho.
let respostas = {};
meta.usarFetch(async (url) => {
  const u = new URL(url);
  const caminho = u.pathname.replace(/^\/v[\d.]+/, "");
  const r = typeof respostas[caminho] === "function" ? respostas[caminho](u) : respostas[caminho];
  if (!r) return { ok: false, status: 404, json: async () => ({ error: { message: "não mockado " + caminho, code: 100 } }) };
  return { ok: !r.error, status: r.error ? 400 : 200, json: async () => r };
});
const lead = (id, campos) => ({ id, created_time: "2026-11-11T10:00:00+0000", campaign_id: "C1", campaign_name: "Black Friday", ad_name: "Anúncio A", platform: "ig",
  field_data: Object.entries(campos).map(([name, v]) => ({ name, values: [v] })) });
const aviso = (leadgenId) => ({ object: "page", entry: [{ id: "P1", changes: [{ field: "leadgen", value: { leadgen_id: leadgenId, page_id: "P1", form_id: "F1" } }] }] });
const contar = (sql, ...a) => db.prepare(sql).get(...a).n;

test("tokens ficam cifrados e voltam iguais", () => {
  const c = meta.cifrar("EAAG-segredo");
  assert.ok(!c.includes("EAAG"));
  assert.equal(meta.decifrar(c), "EAAG-segredo");
});

test("assinatura do webhook confere com o App Secret", () => {
  const corpo = Buffer.from(JSON.stringify({ a: 1 }));
  const ok = "sha256=" + createHmac("sha256", "segredo-app").update(corpo).digest("hex");
  assert.equal(meta.assinaturaValida(corpo, ok), true);
  assert.equal(meta.assinaturaValida(corpo, "sha256=" + "0".repeat(64)), false);
  assert.equal(meta.assinaturaValida(corpo, undefined), false);
});

test("campos do formulário viram nome, e-mail e telefone", () => {
  const p = meta.mapearCampos([{ name: "first_name", values: ["Ana"] }, { name: "last_name", values: ["Lima"] },
    { name: "EMAIL", values: ["Ana@X.com"] }, { name: "phone_number", values: ["+55 (11) 98888-7777"] }, { name: "qual_orcamento", values: ["5k"] }]);
  assert.deepEqual([p.nome, p.email, p.telefone], ["Ana Lima", "ana@x.com", "5511988887777"]);
  assert.equal(p.respostas.qual_orcamento, "5k");
});

test("sem profissional aprovado o lead espera; ao aprovar, é entregue", async () => {
  respostas["/L0"] = lead("L0", { full_name: "Bruno Sem Time", email: "bruno@x.com" });
  await meta.processarAvisoWebhook(aviso("L0"));
  assert.equal(db.prepare("SELECT status FROM meta_leads WHERE leadgenId = 'L0'").get().status, "sem_profissional");
  assert.equal(contar("SELECT COUNT(*) n FROM leads WHERE origem = 'meta_ads'"), 0);
  assert.equal(contar("SELECT COUNT(*) n FROM notifications WHERE userId = 'u-emp' AND titulo LIKE '%aguardando%'"), 1);

  novoProfissional("s1");
  await meta.reprocessarPendentes();
  assert.equal(db.prepare("SELECT status FROM meta_leads WHERE leadgenId = 'L0'").get().status, "criado");
  assert.equal(contar("SELECT COUNT(*) n FROM leads WHERE origem = 'meta_ads' AND sellerId = 's1'"), 1);
});

test("lead novo é criado uma vez só, mesmo com aviso repetido", async () => {
  respostas["/L1"] = lead("L1", { full_name: "Carla Souza", email: "carla@x.com", phone_number: "+5511977776666" });
  await meta.processarAvisoWebhook(aviso("L1"));
  await meta.processarAvisoWebhook(aviso("L1"));
  const l = db.prepare("SELECT * FROM leads WHERE email = 'carla@x.com'").all();
  assert.equal(l.length, 1);
  assert.deepEqual([l[0].nome, l[0].telefone, l[0].origem, l[0].companyId], ["Carla Souza", "5511977776666", "meta_ads", "emp1"]);
  const ml = db.prepare("SELECT * FROM meta_leads WHERE leadgenId = 'L1'").get();
  assert.deepEqual([ml.status, ml.metaCampaignNome, ml.leadId], ["criado", "Black Friday", l[0].id]);
  assert.equal(contar("SELECT COUNT(*) n FROM notifications WHERE titulo = 'Novo lead do Meta Ads'"), 2);
  assert.ok(meta.conexaoDe("emp1").ultimoLeadEm);
});

test("mesma pessoa preenchendo de novo não duplica o lead", async () => {
  respostas["/L2"] = lead("L2", { full_name: "Carla S.", email: "CARLA@x.com" });
  await meta.processarAvisoWebhook(aviso("L2"));
  assert.equal(contar("SELECT COUNT(*) n FROM leads WHERE email = 'carla@x.com'"), 1);
  assert.equal(db.prepare("SELECT status FROM meta_leads WHERE leadgenId = 'L2'").get().status, "duplicado");
});

test("leads são divididos entre os profissionais aprovados", async () => {
  novoProfissional("s2");
  for (const id of ["L3", "L4"]) {
    respostas[`/${id}`] = lead(id, { full_name: `Pessoa ${id}`, email: `${id}@x.com` });
    await meta.processarAvisoWebhook(aviso(id));
  }
  assert.ok(contar("SELECT COUNT(*) n FROM leads WHERE origem = 'meta_ads' AND sellerId = 's2'") >= 1);
});

test("aviso de Página de outra empresa ou desconhecida é ignorado", async () => {
  const outro = { object: "page", entry: [{ changes: [{ field: "leadgen", value: { leadgen_id: "LX", page_id: "OUTRA" } }] }] };
  assert.equal(await meta.processarAvisoWebhook(outro), 0);
  assert.equal(contar("SELECT COUNT(*) n FROM meta_leads WHERE leadgenId = 'LX'"), 0);
});

test("token expirado marca a conexão e avisa a empresa", async () => {
  respostas["/L5"] = { error: { message: "Error validating access token", code: 190 } };
  await meta.processarAvisoWebhook(aviso("L5"));
  assert.equal(meta.conexaoDe("emp1").status, "expirada");
  assert.equal(db.prepare("SELECT status FROM meta_leads WHERE leadgenId = 'L5'").get().status, "erro");
  assert.equal(contar("SELECT COUNT(*) n FROM notifications WHERE userId = 'u-emp' AND titulo = 'Reconecte a Meta'"), 1);
  db.prepare("UPDATE meta_conexoes SET status = 'ativa' WHERE companyId = 'emp1'").run();
});

test("métricas somam gasto e calculam custo por lead", async () => {
  respostas["/act_9/insights"] = { data: [
    { campaign_id: "C1", campaign_name: "Black Friday", spend: "300.00", impressions: "10000", clicks: "200", ctr: "2", cpc: "1.5", actions: [{ action_type: "lead", value: "20" }, { action_type: "onsite_conversion.lead_grouped", value: "20" }] },
    { campaign_id: "C2", campaign_name: "Branding", spend: "100.00", impressions: "5000", clicks: "50", ctr: "1", cpc: "2", actions: [] },
  ] };
  const m = await meta.metricas("emp1", "last_30d");
  assert.equal(m.total.gasto, 400);
  assert.equal(m.total.leads, 20);
  assert.equal(m.total.custoPorLead, 20);
  assert.equal(m.campanhas[0].custoPorLead, 15);
  assert.equal(m.campanhas[1].custoPorLead, null);
  assert.ok(m.campanhas[0].leadsNaRycs >= 1);
});

test("resumo para a tela nunca expõe tokens", () => {
  const r = meta.resumoConexao(meta.conexaoDe("emp1"));
  assert.ok(!JSON.stringify(r).includes("tok-"));
  assert.ok(!JSON.stringify(r).includes("v1:"));
  assert.equal(r.pagina.id, "P1");
});

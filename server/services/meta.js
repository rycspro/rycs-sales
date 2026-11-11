// Integração com a Meta (Facebook / Instagram): leads de formulários de
// anúncio (Lead Ads) e métricas das campanhas da empresa.
//
// Fluxo: a empresa conecta a conta pelo Login da Meta → escolhe a Página e a
// conta de anúncios → a RYCS assina os avisos "leadgen" da Página. Quando
// alguém preenche um formulário, a Meta chama o webhook com o leadgen_id; a
// RYCS busca os campos na Graph API e cria o lead para um profissional
// aprovado da empresa.
//
// Variáveis: META_APP_ID, META_APP_SECRET, META_CONFIG_ID (configuração do
// Login para Empresas), META_VERIFY_TOKEN (verificação do webhook) e
// META_GRAPH_VERSION (opcional).

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import db, { uid, agora } from "../db.js";
import { notificar } from "../routes/notifications.js";
import { registrarEventoCampanha } from "./campaignEvents.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS meta_conexoes (
    companyId TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'escolher',
    metaUserId TEXT DEFAULT '',
    metaUserNome TEXT DEFAULT '',
    tokenUsuario TEXT DEFAULT '',
    tokenExpiraEm INTEGER,
    pageId TEXT DEFAULT '',
    pageNome TEXT DEFAULT '',
    tokenPagina TEXT DEFAULT '',
    adAccountId TEXT DEFAULT '',
    adAccountNome TEXT DEFAULT '',
    campaignId TEXT,
    ultimoLeadEm INTEGER,
    ultimoErro TEXT DEFAULT '',
    ultimoErroEm INTEGER,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_meta_conexoes_pagina ON meta_conexoes(pageId);

  -- Um registro por lead recebido da Meta. A chave única no leadgenId é o
  -- que impede lead duplicado quando a Meta reenvia o mesmo aviso.
  CREATE TABLE IF NOT EXISTS meta_leads (
    id TEXT PRIMARY KEY,
    leadgenId TEXT NOT NULL UNIQUE,
    companyId TEXT NOT NULL,
    pageId TEXT NOT NULL,
    formId TEXT DEFAULT '',
    adId TEXT DEFAULT '',
    metaCampaignId TEXT DEFAULT '',
    metaCampaignNome TEXT DEFAULT '',
    campos TEXT DEFAULT '{}',
    leadId TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    tentativas INTEGER NOT NULL DEFAULT 0,
    erro TEXT DEFAULT '',
    recebidoEm INTEGER NOT NULL,
    processadoEm INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_meta_leads_empresa ON meta_leads(companyId, recebidoEm);
  CREATE INDEX IF NOT EXISTS idx_meta_leads_status ON meta_leads(status, tentativas);
`);

const VERSAO = () => process.env.META_GRAPH_VERSION || "v23.0";
export const GRAPH = () => `https://graph.facebook.com/${VERSAO()}`;
export const metaConfigurada = () => !!(process.env.META_APP_ID && process.env.META_APP_SECRET);

// ── Criptografia dos tokens ───────────────────────────────────────────
// Token da Meta dá acesso à Página e aos anúncios da empresa: nunca fica em
// texto puro no banco. A chave deriva do JWT_SECRET, que já é obrigatório.

const chave = () => createHash("sha256").update(`meta-tokens:${process.env.META_TOKEN_KEY || process.env.JWT_SECRET || "dev"}`).digest();

export function cifrar(texto) {
  if (!texto) return "";
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(String(texto), "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${dados.toString("base64")}`;
}

export function decifrar(valor) {
  if (!valor) return "";
  const [v, iv, tag, dados] = String(valor).split(":");
  if (v !== "v1") return "";
  const d = createDecipheriv("aes-256-gcm", chave(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(dados, "base64")), d.final()]).toString("utf8");
}

// ── Assinatura do webhook ─────────────────────────────────────────────

export function assinaturaValida(corpoBruto, cabecalho, segredo = process.env.META_APP_SECRET) {
  if (!segredo || !corpoBruto || !cabecalho?.startsWith("sha256=")) return false;
  const esperado = Buffer.from(createHmac("sha256", segredo).update(corpoBruto).digest("hex"));
  const recebido = Buffer.from(cabecalho.slice(7));
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

// ── Graph API ─────────────────────────────────────────────────────────
// fetch injetável para os testes.

let _fetch = (...a) => fetch(...a);
export function usarFetch(f) { _fetch = f; }

export class ErroMeta extends Error {
  constructor(msg, codigo, status) { super(msg); this.codigo = codigo; this.status = status; }
  get tokenInvalido() { return this.codigo === 190 || this.codigo === 102 || this.codigo === 10 || this.codigo === 200; }
}

export async function graph(caminho, { token, params = {}, metodo = "GET" } = {}) {
  const url = new URL(caminho.startsWith("http") ? caminho : `${GRAPH()}${caminho}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  if (token) url.searchParams.set("access_token", token);
  const r = await _fetch(url.toString(), { method: metodo });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok || corpo?.error) {
    const e = corpo?.error || {};
    throw new ErroMeta(e.message || `Graph API respondeu ${r.status}`, e.code, r.status);
  }
  return corpo;
}

// ── Login para Empresas ───────────────────────────────────────────────

export const redirectUri = () => `${(process.env.PUBLIC_URL || process.env.FRONTEND_URL || "https://app.rycs.pro").replace(/\/+$/, "")}/api/meta/callback`;

export const PERMISSOES = [
  "public_profile", "pages_show_list", "pages_read_engagement", "pages_manage_metadata",
  "pages_manage_ads", "leads_retrieval", "ads_read", "business_management",
];

export function urlLogin(state) {
  const u = new URL(`https://www.facebook.com/${VERSAO()}/dialog/oauth`);
  u.searchParams.set("client_id", process.env.META_APP_ID || "");
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  if (process.env.META_CONFIG_ID) u.searchParams.set("config_id", process.env.META_CONFIG_ID);
  else u.searchParams.set("scope", PERMISSOES.join(","));
  return u.toString();
}

// Troca o código do login por um token de usuário de longa duração (~60 dias)
// e guarda a conexão em "escolher" (falta a empresa escolher Página e conta).
export async function concluirLogin(companyId, code) {
  const base = { client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET };
  const curto = await graph("/oauth/access_token", { params: { ...base, redirect_uri: redirectUri(), code } });
  let token = curto.access_token, expira = curto.expires_in;
  try {
    const longo = await graph("/oauth/access_token", { params: { ...base, grant_type: "fb_exchange_token", fb_exchange_token: token } });
    token = longo.access_token; expira = longo.expires_in || expira;
  } catch { /* token de sistema/empresa já pode vir sem expiração */ }
  const eu = await graph("/me", { token, params: { fields: "id,name" } });
  const ts = agora();
  const expiraEm = expira ? ts + Number(expira) * 1000 : null;
  db.prepare(`INSERT INTO meta_conexoes (companyId, status, metaUserId, metaUserNome, tokenUsuario, tokenExpiraEm, criadoEm, atualizadoEm)
    VALUES (?, 'escolher', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(companyId) DO UPDATE SET metaUserId = excluded.metaUserId, metaUserNome = excluded.metaUserNome,
      tokenUsuario = excluded.tokenUsuario, tokenExpiraEm = excluded.tokenExpiraEm,
      status = CASE WHEN meta_conexoes.pageId != '' THEN 'reconfirmar' ELSE 'escolher' END,
      ultimoErro = '', atualizadoEm = excluded.atualizadoEm`)
    .run(companyId, eu.id, eu.name || "", cifrar(token), expiraEm, ts, ts);
}

export function conexaoDe(companyId) {
  return db.prepare("SELECT * FROM meta_conexoes WHERE companyId = ?").get(companyId) || null;
}

// O que vai para a tela: nunca os tokens.
export function resumoConexao(c) {
  if (!c) return { conectado: false, configurada: metaConfigurada() };
  return {
    conectado: true, configurada: metaConfigurada(), status: c.status,
    usuario: c.metaUserNome, tokenExpiraEm: c.tokenExpiraEm,
    pagina: c.pageId ? { id: c.pageId, nome: c.pageNome } : null,
    contaAnuncios: c.adAccountId ? { id: c.adAccountId, nome: c.adAccountNome } : null,
    campaignId: c.campaignId || null, ultimoLeadEm: c.ultimoLeadEm,
    ultimoErro: c.ultimoErro || "", ultimoErroEm: c.ultimoErroEm,
  };
}

export async function opcoesDisponiveis(companyId) {
  const c = conexaoDe(companyId);
  if (!c) return null;
  const token = decifrar(c.tokenUsuario);
  const [paginas, contas] = await Promise.all([
    graph("/me/accounts", { token, params: { fields: "id,name", limit: 100 } }).then((r) => r.data || []),
    graph("/me/adaccounts", { token, params: { fields: "id,name,account_status,currency", limit: 100 } }).then((r) => r.data || []).catch(() => []),
  ]);
  return {
    paginas: paginas.map((p) => ({ id: p.id, nome: p.name })),
    contasAnuncios: contas.map((a) => ({ id: a.id, nome: a.name, moeda: a.currency, ativa: a.account_status === 1 })),
  };
}

export async function configurar(companyId, { pageId, adAccountId, campaignId }) {
  const c = conexaoDe(companyId);
  if (!c) throw new ErroMeta("Conecte a conta da Meta primeiro.");
  const token = decifrar(c.tokenUsuario);
  const paginas = await graph("/me/accounts", { token, params: { fields: "id,name,access_token", limit: 100 } }).then((r) => r.data || []);
  const pagina = paginas.find((p) => p.id === String(pageId));
  if (!pagina) throw new ErroMeta("Página não encontrada nesta conta da Meta.");
  const dona = db.prepare("SELECT companyId FROM meta_conexoes WHERE pageId = ? AND companyId != ?").get(pagina.id, companyId);
  if (dona) throw new ErroMeta("Esta Página já está conectada a outra empresa na RYCS.");

  let conta = null;
  if (adAccountId) {
    const contas = await graph("/me/adaccounts", { token, params: { fields: "id,name", limit: 100 } }).then((r) => r.data || []);
    conta = contas.find((a) => a.id === String(adAccountId));
    if (!conta) throw new ErroMeta("Conta de anúncios não encontrada nesta conta da Meta.");
  }
  if (campaignId && !db.prepare("SELECT 1 FROM campaigns WHERE id = ? AND companyId = ?").get(campaignId, companyId))
    throw new ErroMeta("Campanha da RYCS não encontrada.");

  // Trocou de Página: para de ouvir a antiga.
  if (c.pageId && c.pageId !== pagina.id && c.tokenPagina) {
    await graph(`/${c.pageId}/subscribed_apps`, { token: decifrar(c.tokenPagina), metodo: "DELETE" }).catch(() => null);
  }
  await graph(`/${pagina.id}/subscribed_apps`, { token: pagina.access_token, metodo: "POST", params: { subscribed_fields: "leadgen" } });

  db.prepare(`UPDATE meta_conexoes SET status = 'ativa', pageId = ?, pageNome = ?, tokenPagina = ?, adAccountId = ?, adAccountNome = ?,
    campaignId = ?, ultimoErro = '', atualizadoEm = ? WHERE companyId = ?`)
    .run(pagina.id, pagina.name || "", cifrar(pagina.access_token), conta?.id || "", conta?.name || "", campaignId || null, agora(), companyId);
  return resumoConexao(conexaoDe(companyId));
}

export async function desconectar(companyId) {
  const c = conexaoDe(companyId);
  if (!c) return;
  if (c.pageId && c.tokenPagina) {
    await graph(`/${c.pageId}/subscribed_apps`, { token: decifrar(c.tokenPagina), metodo: "DELETE" }).catch(() => null);
  }
  if (c.tokenUsuario) {
    await graph("/me/permissions", { token: decifrar(c.tokenUsuario), metodo: "DELETE" }).catch(() => null);
  }
  db.prepare("DELETE FROM meta_conexoes WHERE companyId = ?").run(companyId);
}

function registrarErro(companyId, msg, { expirou = false } = {}) {
  db.prepare(`UPDATE meta_conexoes SET ultimoErro = ?, ultimoErroEm = ?, status = CASE WHEN ? THEN 'expirada' ELSE status END WHERE companyId = ?`)
    .run(String(msg).slice(0, 300), agora(), expirou ? 1 : 0, companyId);
  if (expirou) {
    const u = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(companyId);
    if (u) notificar(u.id, "integracao", "Reconecte a Meta", "O acesso da RYCS à sua conta da Meta expirou ou foi removido. Abra Configurações → Integrações e clique em Reconectar para voltar a receber leads.");
  }
}

// ── Leads ─────────────────────────────────────────────────────────────

const CAMPOS_NOME = ["full_name", "nome_completo", "nome", "name"];
export function mapearCampos(fieldData = []) {
  const v = {};
  for (const f of fieldData) v[String(f.name || "").toLowerCase()] = Array.isArray(f.values) ? f.values.join(", ") : String(f.values ?? "");
  const pega = (...k) => k.map((x) => v[x]).find((x) => x && x.trim()) || "";
  let nome = pega(...CAMPOS_NOME);
  if (!nome) nome = [pega("first_name", "primeiro_nome"), pega("last_name", "sobrenome")].filter(Boolean).join(" ");
  return {
    nome: nome.trim(),
    email: pega("email", "e-mail", "work_email").trim().toLowerCase(),
    telefone: pega("phone_number", "telefone", "phone", "whatsapp", "work_phone_number").replace(/\D/g, ""),
    empresa: pega("company_name", "empresa", "company").trim(),
    cargo: pega("job_title", "cargo").trim(),
    respostas: v,
  };
}

// Vendedor aprovado da empresa que recebeu menos leads da Meta nas últimas 24h.
function escolherProfissional(companyId) {
  const desde = agora() - 24 * 3600 * 1000;
  return db.prepare(`SELECT a.sellerId,
      (SELECT COUNT(*) FROM leads l WHERE l.sellerId = a.sellerId AND l.companyId = a.companyId AND l.origem = 'meta_ads' AND l.criadoEm > ?) AS n
    FROM applications a WHERE a.companyId = ? AND a.status = 'aprovado'
    ORDER BY n ASC, RANDOM() LIMIT 1`).get(desde, companyId)?.sellerId || null;
}

// Guarda o aviso. Idempotente: o mesmo leadgen_id nunca entra duas vezes.
export function receberAviso(valor) {
  const leadgenId = String(valor?.leadgen_id || "");
  const pageId = String(valor?.page_id || "");
  if (!leadgenId || !pageId) return null;
  const c = db.prepare("SELECT companyId FROM meta_conexoes WHERE pageId = ? AND status IN ('ativa','expirada','reconfirmar')").get(pageId);
  if (!c) return null;
  const r = db.prepare(`INSERT OR IGNORE INTO meta_leads (id, leadgenId, companyId, pageId, formId, adId, recebidoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(uid(), leadgenId, c.companyId, pageId, String(valor.form_id || ""), String(valor.ad_id || ""), agora());
  return r.changes ? leadgenId : null;
}

export async function processarLead(leadgenId) {
  const ml = db.prepare("SELECT * FROM meta_leads WHERE leadgenId = ?").get(leadgenId);
  if (!ml || ["criado", "duplicado"].includes(ml.status)) return ml;
  const c = conexaoDe(ml.companyId);
  if (!c?.tokenPagina || c.pageId !== ml.pageId) {
    db.prepare("UPDATE meta_leads SET status = 'erro', erro = 'Página desconectada', tentativas = tentativas + 1 WHERE id = ?").run(ml.id);
    return null;
  }

  let dados;
  try {
    dados = await graph(`/${leadgenId}`, {
      token: decifrar(c.tokenPagina),
      params: { fields: "id,created_time,field_data,ad_id,ad_name,adset_name,campaign_id,campaign_name,form_id,platform,is_organic" },
    });
  } catch (e) {
    db.prepare("UPDATE meta_leads SET status = 'erro', erro = ?, tentativas = tentativas + 1 WHERE id = ?").run(String(e.message).slice(0, 300), ml.id);
    registrarErro(ml.companyId, `Falha ao buscar lead: ${e.message}`, { expirou: e instanceof ErroMeta && e.tokenInvalido });
    return null;
  }

  const p = mapearCampos(dados.field_data);
  const ts = agora();
  db.prepare(`UPDATE meta_leads SET campos = ?, formId = COALESCE(NULLIF(?, ''), formId), adId = COALESCE(NULLIF(?, ''), adId),
    metaCampaignId = ?, metaCampaignNome = ? WHERE id = ?`)
    .run(JSON.stringify({ ...p.respostas, _plataforma: dados.platform || "", _anuncio: dados.ad_name || "", _conjunto: dados.adset_name || "" }),
      String(dados.form_id || ""), String(dados.ad_id || ""), String(dados.campaign_id || ""), String(dados.campaign_name || ""), ml.id);

  // A mesma pessoa preencheu de novo: avisa quem já cuida dela, sem novo lead.
  const existente = (p.email || p.telefone) && db.prepare(`SELECT id, sellerId FROM leads WHERE companyId = ?
      AND ((? != '' AND lower(email) = ?) OR (? != '' AND replace(replace(replace(replace(telefone,' ',''),'-',''),'(',''),')','') LIKE '%' || ?))
      ORDER BY criadoEm DESC LIMIT 1`).get(ml.companyId, p.email, p.email, p.telefone, p.telefone.slice(-10));
  if (existente) {
    db.prepare("UPDATE meta_leads SET status = 'duplicado', leadId = ?, processadoEm = ? WHERE id = ?").run(existente.id, ts, ml.id);
    db.prepare(`INSERT INTO lead_events (id, leadId, sellerId, tipo, observacao, criadoEm) VALUES (?, ?, ?, 'nota', ?, ?)`)
      .run(uid(), existente.id, existente.sellerId, `Preencheu de novo um formulário da Meta${dados.campaign_name ? ` (campanha "${dados.campaign_name}")` : ""}.`, ts);
    const vend = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(existente.sellerId);
    if (vend) notificar(vend.id, "lead", "Lead voltou a se cadastrar", `${p.nome || "Um lead"} preencheu de novo o formulário. Aproveite o interesse.`);
    return db.prepare("SELECT * FROM meta_leads WHERE id = ?").get(ml.id);
  }

  const sellerId = escolherProfissional(ml.companyId);
  if (!sellerId) {
    const ja = ml.status === "sem_profissional";
    db.prepare("UPDATE meta_leads SET status = 'sem_profissional', erro = 'Nenhum profissional aprovado', tentativas = tentativas + 1 WHERE id = ?").run(ml.id);
    const u = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(ml.companyId);
    if (u && !ja) notificar(u.id, "lead", "Lead da Meta aguardando profissional", `${p.nome || "Um lead"} chegou pelo anúncio, mas a empresa ainda não tem profissional aprovado. Ele será entregue assim que houver.`);
    return null;
  }

  const leadId = uid();
  const campanha = c.campaignId && db.prepare("SELECT id FROM campaigns WHERE id = ? AND companyId = ?").get(c.campaignId, ml.companyId) ? c.campaignId : null;
  db.transaction(() => {
    db.prepare(`INSERT INTO leads (id, sellerId, companyId, campaignId, nome, empresa, cargo, telefone, email, origem, etapa, valorEstimado, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'meta_ads', 'novo', 0, ?, ?)`)
      .run(leadId, sellerId, ml.companyId, campanha, p.nome || "Lead do Meta Ads", p.empresa, p.cargo, p.telefone, p.email, ts, ts);
    const origem = [dados.campaign_name && `Campanha: ${dados.campaign_name}`, dados.ad_name && `Anúncio: ${dados.ad_name}`, dados.platform && `Plataforma: ${dados.platform}`].filter(Boolean).join(" · ");
    db.prepare(`INSERT INTO lead_events (id, leadId, sellerId, tipo, observacao, criadoEm) VALUES (?, ?, ?, 'nota', ?, ?)`)
      .run(uid(), leadId, sellerId, `Lead recebido do Meta Ads.${origem ? ` ${origem}.` : ""}`, ts);
    db.prepare("UPDATE meta_leads SET status = 'criado', leadId = ?, erro = '', processadoEm = ? WHERE id = ?").run(leadId, ts, ml.id);
    db.prepare("UPDATE meta_conexoes SET ultimoLeadEm = ? WHERE companyId = ?").run(ts, ml.companyId);
  })();
  if (campanha) registrarEventoCampanha({ companyId: ml.companyId, campaignId: campanha, tipo: "LEAD_CREATED", sellerId, leadId, source: "META", dados: { origem: "meta_ads" }, criadoEm: ts });

  const vend = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sellerId);
  if (vend) notificar(vend.id, "lead", "Novo lead do Meta Ads", `${p.nome || "Um novo lead"} acabou de se cadastrar pelo anúncio. Faça o primeiro contato agora — quanto mais rápido, maior a chance.`);
  return db.prepare("SELECT * FROM meta_leads WHERE id = ?").get(ml.id);
}

export async function processarAvisoWebhook(corpo) {
  if (corpo?.object !== "page") return 0;
  const novos = [];
  for (const entrada of corpo.entry || []) {
    for (const mudanca of entrada.changes || []) {
      if (mudanca.field !== "leadgen") continue;
      const id = receberAviso(mudanca.value);
      if (id) novos.push(id);
    }
  }
  for (const id of novos) await processarLead(id).catch((e) => console.warn("[meta] lead:", e.message));
  return novos.length;
}

// Reprocessa o que falhou (Graph fora do ar, empresa sem profissional...).
let ocupado = false;
export async function reprocessarPendentes() {
  if (ocupado) return;
  ocupado = true;
  try {
    const itens = db.prepare(`SELECT leadgenId FROM meta_leads WHERE status IN ('pendente','erro','sem_profissional') AND tentativas < 288
      ORDER BY recebidoEm LIMIT 50`).all();
    for (const { leadgenId } of itens) await processarLead(leadgenId).catch(() => null);
  } finally { ocupado = false; }
}

export function iniciarWorkerMeta() {
  if (!metaConfigurada()) return;
  setInterval(() => reprocessarPendentes().catch(() => null), 5 * 60 * 1000).unref?.();
  console.log("[meta] integração ativa");
}

// ── Métricas das campanhas ────────────────────────────────────────────

const PERIODOS = new Set(["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month", "last_month", "maximum"]);
const cache = new Map();
const TIPOS_LEAD = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "leadgen_grouped"];

export async function metricas(companyId, periodo = "last_30d") {
  if (!PERIODOS.has(periodo)) periodo = "last_30d";
  const c = conexaoDe(companyId);
  if (!c?.adAccountId) return null;
  const chaveCache = `${companyId}:${c.adAccountId}:${periodo}`;
  const emCache = cache.get(chaveCache);
  if (emCache && agora() - emCache.em < 10 * 60 * 1000) return emCache.dados;

  let linhas;
  try {
    linhas = (await graph(`/${c.adAccountId}/insights`, {
      token: decifrar(c.tokenUsuario),
      params: { level: "campaign", date_preset: periodo, fields: "campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions", limit: 200 },
    })).data || [];
  } catch (e) {
    registrarErro(companyId, `Falha nas métricas: ${e.message}`, { expirou: e instanceof ErroMeta && e.tokenInvalido });
    throw e;
  }

  const recebidosPorCampanha = Object.fromEntries(db.prepare(`SELECT metaCampaignId AS id, COUNT(*) AS n FROM meta_leads
    WHERE companyId = ? AND recebidoEm > ? GROUP BY metaCampaignId`).all(companyId, agora() - diasDoPeriodo(periodo) * 86400000).map((r) => [r.id, r.n]));

  const campanhas = linhas.map((l) => {
    const leads = (l.actions || []).filter((a) => TIPOS_LEAD.includes(a.action_type)).reduce((m, a) => Math.max(m, Number(a.value) || 0), 0);
    const gasto = Number(l.spend) || 0;
    return {
      id: l.campaign_id, nome: l.campaign_name, gasto, impressoes: Number(l.impressions) || 0, cliques: Number(l.clicks) || 0,
      ctr: Number(l.ctr) || 0, cpc: Number(l.cpc) || 0, leads, leadsNaRycs: recebidosPorCampanha[l.campaign_id] || 0,
      custoPorLead: leads ? gasto / leads : null,
    };
  }).sort((a, b) => b.gasto - a.gasto);

  const total = campanhas.reduce((t, x) => ({ gasto: t.gasto + x.gasto, impressoes: t.impressoes + x.impressoes, cliques: t.cliques + x.cliques, leads: t.leads + x.leads }), { gasto: 0, impressoes: 0, cliques: 0, leads: 0 });
  total.custoPorLead = total.leads ? total.gasto / total.leads : null;
  total.ctr = total.impressoes ? (total.cliques / total.impressoes) * 100 : 0;
  const dados = { periodo, conta: { id: c.adAccountId, nome: c.adAccountNome }, total, campanhas, atualizadoEm: agora() };
  cache.set(chaveCache, { em: agora(), dados });
  return dados;
}

function diasDoPeriodo(p) {
  return { today: 1, yesterday: 2, last_7d: 7, last_14d: 14, last_30d: 30, this_month: 31, last_month: 62, maximum: 3650 }[p] || 30;
}

export function resumoLeads(companyId) {
  const desde = agora() - 30 * 86400000;
  const porStatus = Object.fromEntries(db.prepare(`SELECT status, COUNT(*) n FROM meta_leads WHERE companyId = ? AND recebidoEm > ? GROUP BY status`).all(companyId, desde).map((r) => [r.status, r.n]));
  const recentes = db.prepare(`SELECT m.recebidoEm, m.status, m.metaCampaignNome, l.nome, l.sellerId, s.nome AS profissional
    FROM meta_leads m LEFT JOIN leads l ON l.id = m.leadId LEFT JOIN sellers s ON s.id = l.sellerId
    WHERE m.companyId = ? ORDER BY m.recebidoEm DESC LIMIT 10`).all(companyId);
  return { ultimos30dias: porStatus, recentes };
}

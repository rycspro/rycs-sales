// Leads dos formulários instantâneos (Lead Ads) da própria RYCS, na Página
// "Rycs Sales Machine". Quem preenche o formulário fica dentro do Facebook /
// Instagram e não passa pela plataforma, então o pixel não vê: aqui a RYCS
// busca esses leads na Meta a cada 10 minutos e guarda para o admin
// (aba Campanhas), com campanha, conjunto e anúncio de cada um.
//
// Não confundir com services/meta.js, que recebe os leads das EMPRESAS
// clientes (cada uma conecta a própria Página).
//
// Usa o mesmo META_ADS_TOKEN do gasto: usuário do sistema com a conta de
// anúncios e a Página atribuídas, e as permissões ads_read, leads_retrieval,
// pages_show_list, pages_read_engagement e pages_manage_ads.

import db, { agora } from "../db.js";
import { lerCamposLead, chaveTelefone, telefoneDosOutros } from "../../shared/campanhas.js";
import { META_PAGE_ID } from "../../shared/metaPixel.js";
import { qualificarLead, perguntasDoFormulario, FORMULARIO_EMPRESAS_NOME } from "../../shared/qualificacaoEmpresa.js";
import { lerGraph, escreverGraph, anunciosConectados } from "./metaAnuncios.js";

const CAMPOS_LEAD = "id,created_time,field_data,form_id,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,platform,is_organic";
const json = (texto) => { try { return JSON.parse(texto || "{}") || {}; } catch { return {}; } };

db.exec(`
  CREATE TABLE IF NOT EXISTS rycs_leads_meta (
    leadgenId TEXT PRIMARY KEY,
    formId TEXT NOT NULL DEFAULT '',
    formNome TEXT NOT NULL DEFAULT '',
    campanhaId TEXT NOT NULL DEFAULT '',
    campanha TEXT NOT NULL DEFAULT '',
    conjuntoId TEXT NOT NULL DEFAULT '',
    conjunto TEXT NOT NULL DEFAULT '',
    anuncioId TEXT NOT NULL DEFAULT '',
    anuncio TEXT NOT NULL DEFAULT '',
    plataforma TEXT NOT NULL DEFAULT '',
    organico INTEGER NOT NULL DEFAULT 0,
    nome TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    telefone TEXT NOT NULL DEFAULT '',
    cidade TEXT NOT NULL DEFAULT '',
    pais TEXT NOT NULL DEFAULT '',
    outros TEXT NOT NULL DEFAULT '{}',
    criadoEm INTEGER NOT NULL,
    importadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rycs_leads_data ON rycs_leads_meta(criadoEm);
  CREATE TABLE IF NOT EXISTS rycs_leads_sync (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    ultimaEm INTEGER,
    ultimoOkEm INTEGER,
    erro TEXT NOT NULL DEFAULT '',
    importados INTEGER NOT NULL DEFAULT 0
  );
`);

// Leads já importados com o telefone numa pergunta personalizada (ex.:
// "whatsapp_number"): preenche o campo telefone, que estava vazio.
for (const l of db.prepare("SELECT leadgenId, outros FROM rycs_leads_meta WHERE telefone = ''").all()) {
  const t = telefoneDosOutros(json(l.outros));
  if (t) db.prepare("UPDATE rycs_leads_meta SET telefone = ? WHERE leadgenId = ? AND telefone = ''").run(t.slice(0, 300), l.leadgenId);
}

const paginaId = () => String(process.env.META_PAGE_ID || META_PAGE_ID);

// Os leads da Página saem com o token da própria Página; o usuário do sistema
// consegue esse token porque a Página está atribuída a ele.
async function tokenDaPagina() {
  try {
    const r = await lerGraph(`/${paginaId()}`, { fields: "access_token" });
    if (r?.access_token) return r.access_token;
  } catch { /* cai no token do usuário do sistema */ }
  return process.env.META_ADS_TOKEN;
}

export function guardarLead(l, formNome = "") {
  const c = lerCamposLead(l.field_data);
  return db.prepare(`
    INSERT OR IGNORE INTO rycs_leads_meta (leadgenId, formId, formNome, campanhaId, campanha, conjuntoId, conjunto, anuncioId, anuncio,
      plataforma, organico, nome, email, telefone, cidade, pais, outros, criadoEm, importadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(l.id), String(l.form_id || ""), String(formNome).slice(0, 200),
    String(l.campaign_id || ""), String(l.campaign_name || ""), String(l.adset_id || ""), String(l.adset_name || ""),
    String(l.ad_id || ""), String(l.ad_name || ""), String(l.platform || ""), l.is_organic ? 1 : 0,
    c.nome, c.email, c.telefone, c.cidade, c.pais, JSON.stringify(c.outros),
    Date.parse(l.created_time) || agora(), agora(),
  ).changes;
}

let ocupado = false;

export async function sincronizarLeadsRycs() {
  if (!anunciosConectados() || ocupado) return null;
  ocupado = true;
  const t = agora();
  db.prepare("INSERT INTO rycs_leads_sync (id, ultimaEm) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET ultimaEm = excluded.ultimaEm").run(t);
  try {
    const token = await tokenDaPagina();
    // Desde o último lead guardado (com folga de 1 dia); na primeira vez, tudo o
    // que a Meta ainda guarda (90 dias).
    const ultimo = db.prepare("SELECT MAX(criadoEm) AS em FROM rycs_leads_meta").get()?.em;
    const filtro = ultimo ? [{ field: "time_created", operator: "GREATER_THAN", value: Math.floor((ultimo - 24 * 3600 * 1000) / 1000) }] : null;
    const formularios = await lerGraph(`/${paginaId()}/leadgen_forms`, { fields: "id,name", limit: 100 }, { token });
    let novos = 0;
    for (const f of formularios) {
      const leads = await lerGraph(`/${f.id}/leads`, { fields: CAMPOS_LEAD, ...(filtro && { filtering: filtro }) }, { token, maxPaginas: 50 });
      for (const l of leads) novos += guardarLead(l, f.name);
    }
    db.prepare("UPDATE rycs_leads_sync SET ultimoOkEm = ?, erro = '', importados = importados + ? WHERE id = 1").run(agora(), novos);
    if (novos) console.log(`[leads-rycs] ${novos} lead(s) novo(s) importado(s)`);
    return { novos };
  } catch (e) {
    const erro = String(e?.message || e).slice(0, 300);
    db.prepare("UPDATE rycs_leads_sync SET erro = ? WHERE id = 1").run(erro);
    console.error("[leads-rycs] sincronização:", erro);
    return { erro };
  } finally {
    ocupado = false;
  }
}

export function statusLeadsRycs() {
  const s = db.prepare("SELECT ultimaEm, ultimoOkEm, erro FROM rycs_leads_sync WHERE id = 1").get() || {};
  const total = db.prepare("SELECT COUNT(*) AS n FROM rycs_leads_meta").get().n;
  return { conectado: anunciosConectados(), total, ultimaEm: s.ultimaEm || null, ultimoOkEm: s.ultimoOkEm || null, erro: s.erro || "" };
}

// Quem do lead já virou conta na plataforma: mesmo e-mail, ou mesmo telefone
// (últimos 10 dígitos) de um profissional ou empresa.
function contasConhecidas() {
  const emails = new Map();
  for (const u of db.prepare("SELECT email, role, criadoEm FROM users WHERE role IN ('vendedor','empresa')").all())
    emails.set(String(u.email).toLowerCase(), { papel: u.role, em: u.criadoEm });
  const telefones = new Map();
  for (const s of db.prepare("SELECT whats, criadoEm FROM sellers WHERE whats != ''").all()) {
    const k = chaveTelefone(s.whats);
    if (k.length >= 8) telefones.set(k, { papel: "vendedor", em: s.criadoEm });
  }
  for (const c of db.prepare("SELECT whatsapp, criadoEm FROM companies WHERE COALESCE(whatsapp, '') != ''").all()) {
    const k = chaveTelefone(c.whatsapp);
    if (k.length >= 8 && !telefones.has(k)) telefones.set(k, { papel: "empresa", em: c.criadoEm });
  }
  return (lead) => emails.get(lead.email) || (chaveTelefone(lead.telefone).length >= 8 ? telefones.get(chaveTelefone(lead.telefone)) : null) || null;
}

export function leadsRycs({ desde = 0 } = {}) {
  const conta = contasConhecidas();
  return db.prepare("SELECT * FROM rycs_leads_meta WHERE criadoEm >= ? ORDER BY criadoEm DESC").all(desde).map((l) => {
    const c = conta(l);
    const outros = json(l.outros);
    return {
      id: l.leadgenId, em: l.criadoEm, nome: l.nome, email: l.email, telefone: l.telefone, cidade: l.cidade, pais: l.pais,
      empresa: String(outros.company_name || ""), qualificacao: qualificarLead(outros),
      campanha: l.campanha, conjunto: l.conjunto, anuncio: l.anuncio, formulario: l.formNome, plataforma: l.plataforma,
      organico: !!l.organico, outros, conta: !!c, contaPapel: c?.papel || "", contaEm: c?.em || null,
    };
  });
}

// Formulário instantâneo das campanhas [EMP]: se ainda não existe na Página,
// o servidor cria, com as perguntas de shared/qualificacaoEmpresa.js. Os leads
// dele entram pela mesma importação de 10 em 10 minutos.
let formularioEmpresas = { id: "", erro: "" };
export const formularioEmpresasMeta = () => formularioEmpresas;

export async function garantirFormularioEmpresas() {
  if (!anunciosConectados()) return formularioEmpresas;
  try {
    const token = await tokenDaPagina();
    const existentes = await lerGraph(`/${paginaId()}/leadgen_forms`, { fields: "id,name,status", limit: 100 }, { token });
    const achado = existentes.find((f) => f.name === FORMULARIO_EMPRESAS_NOME && f.status === "ACTIVE");
    const id = achado?.id || (await escreverGraph(`/${paginaId()}/leadgen_forms`, {
      name: FORMULARIO_EMPRESAS_NOME,
      locale: "PT_BR",
      questions: perguntasDoFormulario(),
      privacy_policy: { url: "https://rycs.pro/privacidade", link_text: "Política de privacidade da RYCS" },
      context_card: { title: "Tenha o seu time de vendas", style: "PARAGRAPH_STYLE", content: ["Responda algumas perguntas rápidas sobre a sua empresa. A RYCS analisa e fala com você."] },
      thank_you_page: { title: "Recebemos suas respostas", body: "A RYCS vai analisar e falar com você em breve.", button_type: "VIEW_WEBSITE", button_text: "Conhecer a RYCS", website_url: "https://app.rycs.pro/cadastro/empresa" },
      follow_up_action_url: "https://app.rycs.pro/cadastro/empresa",
    }, { token })).id;
    formularioEmpresas = { id: String(id), erro: "" };
    if (!achado) console.log(`[leads-rycs] formulário "${FORMULARIO_EMPRESAS_NOME}" criado na Meta: ${id}`);
  } catch (e) {
    formularioEmpresas = { id: "", erro: String(e?.message || e).slice(0, 300) };
    console.error("[leads-rycs] formulário de empresas:", formularioEmpresas.erro);
  }
  return formularioEmpresas;
}

export function iniciarLeadsRycs() {
  if (!anunciosConectados()) return;
  const tick = async () => {
    if (!formularioEmpresas.id) await garantirFormularioEmpresas();
    await sincronizarLeadsRycs().catch(() => null);
  };
  setTimeout(tick, 60 * 1000).unref?.();
  setInterval(tick, 10 * 60 * 1000).unref?.();
  console.log("[leads-rycs] importação dos formulários da RYCS ativa");
}

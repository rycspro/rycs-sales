// Conta do WhatsApp oficial da RYCS vista da Meta, para o admin: número
// (qualidade, limite, se pode enviar), conta (moeda, quem paga, verificação),
// custos por categoria, desempenho e cliques por modelo, perfil público e links
// para o que só dá para mudar no painel da Meta (cartão, token, publicar app).
//
// Tudo é lido com o mesmo token dos disparos (WHATSAPP_TOKEN). O que a Meta não
// liberar para esse token aparece com o erro dela, sem travar o resto da tela.

import { graph } from "./meta.js";
import { validarPerfilWhatsapp } from "../../shared/whatsappPerfil.js";
import db, { uid } from "../db.js";
import { lerGraph, anunciosConectados } from "./metaAnuncios.js";
import { META_AD_ACCOUNT_ID } from "../../shared/metaPixel.js";

const TOKEN = () => process.env.WHATSAPP_TOKEN || "";
const NUMERO_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const CONTA_ID = () => process.env.WHATSAPP_WABA_ID || "";
const NEGOCIO_ID = () => process.env.META_BUSINESS_ID || "1500248066486586";
const APP_ID = () => process.env.META_APP_ID || "";
const DIA_S = 24 * 60 * 60;

const descrever = (e) => `${e?.codigo ? `${e.codigo} ` : ""}${e?.message || "Falha ao consultar a Meta"}`.slice(0, 300);
export const tentar = async (f) => { try { return { ok: true, dados: await f() }; } catch (e) { return { ok: false, erro: descrever(e) }; } };

// Lê campos de um objeto da Meta. Se algum não existir nesta versão da API
// (erro 100) ou for restrito (erro 10/200, como os que a Meta só libera para
// provedores), tenta um por um e devolve os que vieram.
export async function lerCampos(id, campos) {
  try {
    return await graph(`/${id}`, { token: TOKEN(), params: { fields: campos.join(",") } });
  } catch (e) {
    if (![10, 100, 200].includes(e?.codigo) || campos.length < 2) throw e;
    const r = {};
    for (const c of campos) {
      try { Object.assign(r, await graph(`/${id}`, { token: TOKEN(), params: { fields: c } })); } catch { /* campo indisponível */ }
    }
    if (!Object.keys(r).length) throw e;
    return r;
  }
}

const CAMPOS_NUMERO = ["display_phone_number", "verified_name", "name_status", "quality_rating", "messaging_limit_tier", "throughput",
  "status", "platform_type", "code_verification_status", "is_official_business_account", "account_mode", "health_status"];
const CAMPOS_CONTA = ["name", "currency", "timezone_id", "account_review_status", "business_verification_status", "ownership_type",
  "is_enabled_for_insights", "primary_funding_id", "health_status"];
const CAMPOS_PERFIL = ["about", "address", "description", "email", "profile_picture_url", "websites", "vertical"];

// Páginas da Meta para o que a API não deixa ver nem mudar.
export function linksMeta() {
  const n = NEGOCIO_ID();
  const app = APP_ID();
  return [
    { rotulo: "Cobrança e forma de pagamento (Configurações do negócio)", url: `https://business.facebook.com/latest/settings/?business_id=${n}` },
    { rotulo: "Modelos de mensagem (WhatsApp Manager)", url: `https://business.facebook.com/wa/manage/message-templates/?waba_id=${CONTA_ID()}&business_id=${n}` },
    { rotulo: "Contas e números do WhatsApp", url: `https://business.facebook.com/latest/settings/whatsapp_business_presence/?business_id=${n}` },
    { rotulo: "Usuários do sistema (token do servidor)", url: `https://business.facebook.com/latest/settings/system_users/?business_id=${n}` },
    { rotulo: "Apps do negócio (publicar o app RYCS)", url: `https://business.facebook.com/latest/settings/apps/?business_id=${n}` },
    ...(app ? [{ rotulo: "Webhook do app RYCS", url: `https://developers.facebook.com/apps/${app}/whatsapp-business/wa-configurations-v2/?business_id=${n}` }] : []),
  ];
}

export async function contaWhatsapp() {
  const [numero, conta, perfil, apps] = await Promise.all([
    tentar(() => lerCampos(NUMERO_ID(), CAMPOS_NUMERO)),
    tentar(() => lerCampos(CONTA_ID(), CAMPOS_CONTA)),
    tentar(async () => (await graph(`/${NUMERO_ID()}/whatsapp_business_profile`, { token: TOKEN(), params: { fields: CAMPOS_PERFIL.join(",") } })).data?.[0] || {}),
    tentar(async () => ((await graph(`/${CONTA_ID()}/subscribed_apps`, { token: TOKEN() })).data || []).map((a) => a.whatsapp_business_api_data || a)),
  ]);
  return { numero, conta, perfil, apps, links: linksMeta(), ids: { numero: NUMERO_ID(), conta: CONTA_ID(), negocio: NEGOCIO_ID(), app: APP_ID() } };
}

// Todos os modelos da conta, em qualquer situação (aprovado, em análise, recusado...).
export async function modelosMeta() {
  const lista = [];
  let r = await graph(`/${CONTA_ID()}/message_templates`, {
    token: TOKEN(), params: { fields: "id,name,language,category,status,quality_score,rejected_reason,previous_category", limit: 100 },
  });
  for (let pagina = 0; ; pagina++) {
    lista.push(...(r.data || []));
    if (!r.paging?.next || pagina >= 4) break;
    r = await graph(r.paging.next, { token: TOKEN() });
  }
  return lista.map((t) => ({
    id: String(t.id), nome: t.name, idioma: t.language, categoria: t.category, status: t.status,
    qualidade: t.quality_score?.score || "", motivo: t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : "",
    categoriaAnterior: t.previous_category || "",
  }));
}

// ── Custos ────────────────────────────────────────────────────────────────

const dinheiro = (n) => Math.round(n * 10000) / 10000;

// Pontos do pricing_analytics da Meta → total, por categoria e por dia.
export function resumirCustos(pontos) {
  const porCategoria = new Map();
  const porDia = new Map();
  const total = { mensagens: 0, cobradas: 0, custo: 0 };
  for (const p of pontos) {
    const categoria = p.pricing_category || "OUTRA";
    const gratis = String(p.pricing_type || "").startsWith("FREE");
    const v = Number(p.volume) || 0;
    const c = Number(p.cost) || 0;
    const cat = porCategoria.get(categoria) || { categoria, mensagens: 0, cobradas: 0, gratis: 0, custo: 0 };
    cat.mensagens += v; cat.custo += c;
    if (gratis) cat.gratis += v; else cat.cobradas += v;
    porCategoria.set(categoria, cat);
    const dia = new Date((Number(p.start) || 0) * 1000).toISOString().slice(0, 10);
    const d = porDia.get(dia) || { dia, mensagens: 0, custo: 0 };
    d.mensagens += v; d.custo += c;
    porDia.set(dia, d);
    total.mensagens += v; total.custo += c;
    if (!gratis) total.cobradas += v;
  }
  const medio = (custo, n) => (n > 0 ? dinheiro(custo / n) : null);
  return {
    total: { ...total, custo: dinheiro(total.custo), custoPorMensagem: medio(total.custo, total.cobradas) },
    categorias: [...porCategoria.values()].map((c) => ({ ...c, custo: dinheiro(c.custo), custoPorMensagem: medio(c.custo, c.cobradas) }))
      .sort((a, b) => b.custo - a.custo || b.mensagens - a.mensagens),
    dias: [...porDia.values()].filter((d) => d.mensagens > 0).map((d) => ({ ...d, custo: dinheiro(d.custo) })).sort((a, b) => b.dia.localeCompare(a.dia)),
  };
}

export async function custosWhatsapp(dias = 30) {
  const fim = Math.floor(Date.now() / 1000);
  const inicio = fim - dias * DIA_S;
  const campo = `pricing_analytics.start(${inicio}).end(${fim}).granularity(DAILY).dimensions(["PRICING_CATEGORY","PRICING_TYPE"])`;
  const r = await graph(`/${CONTA_ID()}`, { token: TOKEN(), params: { fields: campo } });
  return resumirCustos((r.pricing_analytics?.data || []).flatMap((d) => d.data_points || []));
}

// ── Desempenho e cliques por modelo (template_analytics) ─────────────────

// Pontos do template_analytics → um resumo por modelo, com cliques por botão.
export function resumirEstatisticas(pontos, modelos = []) {
  const nomes = new Map(modelos.map((m) => [String(m.id), m]));
  const por = new Map();
  for (const p of pontos) {
    const id = String(p.template_id);
    const m = por.get(id) || { id, enviados: 0, entregues: 0, lidos: 0, cliques: 0, cliquesLink: 0, custo: 0, botoes: new Map() };
    m.enviados += Number(p.sent) || 0;
    m.entregues += Number(p.delivered) || 0;
    m.lidos += Number(p.read) || 0;
    for (const c of p.clicked || []) {
      const n = Number(c.count) || 0;
      m.cliques += n;
      if (String(c.type || "").includes("url")) m.cliquesLink += n;
      const k = `${c.type}|${c.button_content || ""}`;
      m.botoes.set(k, { tipo: c.type || "", botao: c.button_content || "", cliques: (m.botoes.get(k)?.cliques || 0) + n });
    }
    for (const c of p.cost || []) if (c.type === "amount_spent") m.custo += Number(c.value) || 0;
    por.set(id, m);
  }
  const taxa = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
  return [...por.values()].map((m) => {
    const t = nomes.get(m.id) || {};
    return {
      id: m.id, nome: t.nome || m.id, idioma: t.idioma || "", categoria: t.categoria || "",
      enviados: m.enviados, entregues: m.entregues, lidos: m.lidos, cliques: m.cliques, cliquesLink: m.cliquesLink,
      taxaEntrega: taxa(m.entregues, m.enviados), taxaLeitura: taxa(m.lidos, m.entregues), taxaClique: taxa(m.cliques, m.entregues),
      custo: dinheiro(m.custo), custoPorEntregue: m.entregues ? dinheiro(m.custo / m.entregues) : null,
      custoPorClique: m.cliquesLink ? dinheiro(m.custo / m.cliquesLink) : null,
      botoes: [...m.botoes.values()].sort((a, b) => b.cliques - a.cliques),
    };
  }).filter((m) => m.enviados > 0 || m.cliques > 0).sort((a, b) => b.enviados - a.enviados);
}

export async function estatisticasModelos(dias, modelos) {
  const fim = Math.floor(Date.now() / 1000);
  const inicio = fim - Math.min(dias, 89) * DIA_S; // a Meta só guarda 90 dias
  const ids = modelos.map((m) => m.id);
  const pontos = [];
  for (let i = 0; i < ids.length; i += 10) {
    const r = await graph(`/${CONTA_ID()}/template_analytics`, {
      token: TOKEN(),
      params: {
        start: inicio, end: fim, granularity: "DAILY",
        metric_types: JSON.stringify(["SENT", "DELIVERED", "READ", "CLICKED", "COST"]),
        template_ids: `[${ids.slice(i, i + 10).join(",")}]`,
      },
    });
    pontos.push(...(r.data || []).flatMap((d) => d.data_points || []));
  }
  return resumirEstatisticas(pontos, modelos);
}

// Liga as estatísticas de modelos na conta (entregas, leituras, cliques e custo
// por modelo). A Meta pode não deixar desligar depois.
export async function ligarEstatisticas() {
  await graph(`/${CONTA_ID()}`, { token: TOKEN(), metodo: "POST", params: { is_enabled_for_insights: "true" } });
  return lerCampos(CONTA_ID(), ["is_enabled_for_insights"]);
}

// ── Perfil público do número ─────────────────────────────────────────────

export async function salvarPerfil(dados) {
  const v = validarPerfilWhatsapp(dados);
  if (v.erro) { const e = new Error(v.erro); e.validacao = true; throw e; }
  await graph(`/${NUMERO_ID()}/whatsapp_business_profile`, { token: TOKEN(), metodo: "POST", dados: { messaging_product: "whatsapp", ...v.campos } });
  return (await graph(`/${NUMERO_ID()}/whatsapp_business_profile`, { token: TOKEN(), params: { fields: CAMPOS_PERFIL.join(",") } })).data?.[0] || {};
}

// Quem paga e em que moeda: ownership_type SELF = o próprio negócio da RYCS.
export async function cobrancaWhatsapp() {
  return lerCampos(CONTA_ID(), ["currency", "ownership_type", "primary_funding_id", "timezone_id", "is_enabled_for_insights"]);
}

// ── Saldo e gastos ────────────────────────────────────────────────────────
// A Meta não informa o saldo do WhatsApp pela API (o dado de pagamento da conta
// só é liberado para provedores). O admin registra as recargas que fez, e o
// saldo estimado é: recargas − gasto que a Meta informa desde a primeira recarga.
// A conta de anúncios, essa sim, a API mostra (com o META_ADS_TOKEN).


db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_recargas (
    id TEXT PRIMARY KEY,
    valor REAL NOT NULL,
    em INTEGER NOT NULL,
    observacao TEXT DEFAULT '',
    adminId TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL
  );
`);

export const listarRecargas = () => db.prepare("SELECT id, valor, em, observacao FROM whatsapp_recargas ORDER BY em DESC").all();

export function registrarRecarga({ valor, em, observacao = "" }, adminId = "") {
  const v = Math.round(Number(String(valor).replace(",", ".")) * 100) / 100;
  if (!(v > 0 && v <= 1000000)) throw Object.assign(new Error("Informe o valor da recarga."), { validacao: true });
  const quando = em ? Date.parse(em) : Date.now();
  if (!Number.isFinite(quando) || quando > Date.now() + 86400000) throw Object.assign(new Error("Data inválida."), { validacao: true });
  const id = uid();
  db.prepare("INSERT INTO whatsapp_recargas (id, valor, em, observacao, adminId, criadoEm) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, v, quando, String(observacao || "").slice(0, 200), adminId, Date.now());
  return { id };
}

export const apagarRecarga = (id) => db.prepare("DELETE FROM whatsapp_recargas WHERE id = ?").run(String(id)).changes;

// Gastos por dia (dias em UTC, como a Meta fecha) → hoje, 7 dias, mês e desde uma data.
export function resumirGastos(dias, { agoraMs = Date.now(), desdeMs = null } = {}) {
  const dia = (ms) => new Date(ms).toISOString().slice(0, 10);
  const hoje = dia(agoraMs);
  const seteDias = dia(agoraMs - 6 * 86400000);
  const mes = hoje.slice(0, 7);
  const desde = desdeMs ? dia(desdeMs) : null;
  const soma = (f) => Math.round(dias.filter(f).reduce((s, d) => s + d.custo, 0) * 100) / 100;
  return {
    hoje: soma((d) => d.dia === hoje), seteDias: soma((d) => d.dia >= seteDias), mes: soma((d) => d.dia.startsWith(mes)),
    desdeRecarga: desde ? soma((d) => d.dia >= desde) : null,
  };
}

const STATUS_CONTA_ANUNCIOS = { 1: "Ativa", 2: "Desativada", 3: "Com pagamento pendente", 7: "Em análise de risco", 8: "Pagamento em análise", 9: "Em período de carência", 100: "Encerrando", 101: "Encerrada" };

async function contaDeAnuncios() {
  if (!anunciosConectados()) return { ok: false, erro: "Sem o token de anúncios (META_ADS_TOKEN) no servidor." };
  const id = String(process.env.META_AD_ACCOUNT_ID || META_AD_ACCOUNT_ID).replace(/^act_/, "");
  return tentar(async () => {
    const r = await lerGraph(`/act_${id}`, { fields: "name,currency,balance,amount_spent,spend_cap,is_prepay_account,funding_source_details,account_status" });
    const centavos = (v) => (v == null || v === "" ? null : Number(v) / 100);
    return {
      nome: r.name || "", moeda: r.currency || "", status: STATUS_CONTA_ANUNCIOS[r.account_status] || String(r.account_status ?? ""),
      prePaga: !!r.is_prepay_account, formaPagamento: r.funding_source_details?.display_string || "",
      aPagar: centavos(r.balance), gastoTotal: centavos(r.amount_spent), limiteGasto: centavos(r.spend_cap) || null,
    };
  });
}

export async function saldoMeta({ agoraMs = Date.now() } = {}) {
  const recargas = listarRecargas();
  const primeira = recargas.length ? Math.min(...recargas.map((r) => r.em)) : null;
  // Do começo do mês (ou da primeira recarga, se for antes) até agora; a Meta guarda 90 dias.
  const inicioMes = Date.UTC(new Date(agoraMs).getUTCFullYear(), new Date(agoraMs).getUTCMonth(), 1);
  const desde = Math.max(Math.min(inicioMes, primeira ?? inicioMes, agoraMs - 6 * 86400000), agoraMs - 89 * 86400000);
  const [custos, cobranca, anuncios] = await Promise.all([
    tentar(async () => {
      const campo = `pricing_analytics.start(${Math.floor(desde / 1000)}).end(${Math.floor(agoraMs / 1000)}).granularity(DAILY).dimensions(["PRICING_CATEGORY","PRICING_TYPE"])`;
      const r = await graph(`/${CONTA_ID()}`, { token: TOKEN(), params: { fields: campo } });
      return resumirCustos((r.pricing_analytics?.data || []).flatMap((d) => d.data_points || []));
    }),
    tentar(cobrancaWhatsapp),
    contaDeAnuncios(),
  ]);
  const totalRecargas = Math.round(recargas.reduce((s, r) => s + r.valor, 0) * 100) / 100;
  const gastos = custos.ok ? resumirGastos(custos.dados.dias, { agoraMs, desdeMs: primeira }) : null;
  return {
    moeda: cobranca.ok ? cobranca.dados.currency || "" : "",
    whatsapp: custos.ok ? { ok: true, ...gastos, dias: custos.dados.dias.slice(0, 31) } : { ok: false, erro: custos.erro },
    recargas, totalRecargas,
    saldoEstimado: recargas.length && gastos ? Math.round((totalRecargas - gastos.desdeRecarga) * 100) / 100 : null,
    anuncios, links: linksMeta(),
  };
}

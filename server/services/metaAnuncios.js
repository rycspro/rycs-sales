// Gasto, impressões e cliques da conta de anúncios da própria RYCS ("RYCS
// SALES MACHINE"), para a aba Campanhas do admin. Só leitura (Insights API).
//
// Variáveis: META_ADS_TOKEN (token de usuário do sistema com ads_read na conta
// de anúncios) e META_AD_ACCOUNT_ID (opcional; padrão em shared/metaPixel.js).
// Sem token, o admin mostra só os dados da plataforma.

import { GRAPH } from "./meta.js";
import { chaveDia } from "../../shared/campanhas.js";
import { META_AD_ACCOUNT_ID, META_PIXEL_ID } from "../../shared/metaPixel.js";

export const anunciosConectados = () => !!process.env.META_ADS_TOKEN;

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

// GET na Graph API seguindo a paginação (até `maxPaginas`). O token nunca vai
// para log: os erros levam só a mensagem da Meta.
export async function lerGraph(caminho, params = {}, { token = process.env.META_ADS_TOKEN, maxPaginas = 20 } = {}) {
  let url = new URL(`${GRAPH()}${caminho}`);
  for (const [k, v] of Object.entries({ limit: 500, ...params, access_token: token }))
    url.searchParams.set(k, typeof v === "string" || typeof v === "number" ? String(v) : JSON.stringify(v));
  const linhas = [];
  for (let pagina = 0; url && pagina < maxPaginas; pagina++) {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok || corpo.error) throw new Error(corpo.error?.message || `HTTP ${r.status}`);
    if (!Array.isArray(corpo.data)) return corpo;
    linhas.push(...corpo.data);
    url = corpo.paging?.next ? new URL(corpo.paging.next) : null;
  }
  return linhas;
}

// POST na Graph API; o token vai no corpo, nunca na URL.
export async function escreverGraph(caminho, params = {}, { token = process.env.META_ADS_TOKEN } = {}) {
  const corpo = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, access_token: token }))
    corpo.set(k, typeof v === "string" || typeof v === "number" ? String(v) : JSON.stringify(v));
  const r = await fetch(`${GRAPH()}${caminho}`, { method: "POST", body: corpo, signal: AbortSignal.timeout(20_000) });
  const resposta = await r.json().catch(() => ({}));
  if (!r.ok || resposta.error) throw new Error(resposta.error?.error_user_msg || resposta.error?.message || `HTTP ${r.status}`);
  return resposta;
}

const contaAnuncios = () => String(process.env.META_AD_ACCOUNT_ID || META_AD_ACCOUNT_ID).replace(/^act_/, "");
const insights = (params) => lerGraph(`/act_${contaAnuncios()}/insights`, params);

// desde = 0 → todo o período da conta.
export async function gastosMeta({ desde, ate }) {
  if (!anunciosConectados()) return null;
  const periodo = desde ? { time_range: { since: chaveDia(desde), until: chaveDia(ate) } } : { date_preset: "maximum" };
  const chave = JSON.stringify(periodo);
  const salvo = cache.get(chave);
  if (salvo && Date.now() - salvo.em < CACHE_MS) return salvo.dados;

  const [anuncios, dias] = await Promise.all([
    insights({ level: "ad", fields: "campaign_name,adset_name,ad_name,spend,impressions,inline_link_clicks", ...periodo }),
    insights({ level: "campaign", fields: "campaign_name,spend", time_increment: 1, ...periodo }),
  ]);
  const dados = {
    gastos: anuncios.map((l) => ({
      campanha: l.campaign_name, conjunto: l.adset_name, anuncio: l.ad_name,
      gasto: Number(l.spend) || 0, impressoes: Number(l.impressions) || 0, cliques: Number(l.inline_link_clicks) || 0,
    })),
    gastosDia: dias.map((l) => ({ campanha: l.campaign_name, dia: l.date_start, gasto: Number(l.spend) || 0 })),
  };
  cache.set(chave, { em: Date.now(), dados });
  return dados;
}

// Nota (0 a 10) que a Meta dá à correspondência de cada evento do pixel: quanto
// maior, mais conversões ela consegue ligar ao anúncio. Precisa do pixel
// atribuído ao usuário do sistema do META_ADS_TOKEN. Erro também fica em cache,
// para não insistir a cada abertura da aba.
export async function qualidadeCorrespondencia() {
  if (!anunciosConectados()) return null;
  const salvo = cache.get("qualidade");
  if (salvo && Date.now() - salvo.em < CACHE_MS) return salvo.dados;
  let dados;
  try {
    const url = new URL(`${GRAPH()}/dataset_quality`);
    url.searchParams.set("dataset_id", process.env.META_PIXEL_ID || META_PIXEL_ID);
    url.searchParams.set("fields", "web{event_name,event_match_quality{composite_score}}");
    url.searchParams.set("access_token", process.env.META_ADS_TOKEN);
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok || corpo.error) throw new Error(corpo.error?.message || `HTTP ${r.status}`);
    const eventos = (corpo.web || [])
      .map((e) => ({ evento: e.event_name, nota: Number(e.event_match_quality?.composite_score) }))
      .filter((e) => e.evento && Number.isFinite(e.nota))
      .sort((a, b) => b.nota - a.nota);
    dados = { eventos, erro: "" };
  } catch (e) {
    dados = { eventos: [], erro: String(e?.message || e).slice(0, 200) };
  }
  cache.set("qualidade", { em: Date.now(), dados });
  return dados;
}

// Gasto, impressões e cliques da conta de anúncios da própria RYCS ("RYCS
// SALES MACHINE"), para a aba Campanhas do admin. Só leitura (Insights API).
//
// Variáveis: META_ADS_TOKEN (token de usuário do sistema com ads_read na conta
// de anúncios) e META_AD_ACCOUNT_ID (opcional; padrão em shared/metaPixel.js).
// Sem token, o admin mostra só os dados da plataforma.

import { GRAPH } from "./meta.js";
import { chaveDia } from "../../shared/campanhas.js";
import { META_AD_ACCOUNT_ID } from "../../shared/metaPixel.js";

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

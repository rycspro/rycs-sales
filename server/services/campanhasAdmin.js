// Aba Campanhas do admin: junta o que a plataforma registrou (visitantes e
// contas com a origem do anúncio, e os marcos de cada conta) ao gasto da Meta,
// e mostra a saúde do rastreamento (pixel, API de Conversões, eventos enviados).

import db, { agora } from "../db.js";
import { classificarOrigem } from "../../shared/jornada.js";
import { agruparCampanhas } from "../../shared/campanhas.js";
import { META_PIXEL_ID } from "../../shared/metaPixel.js";
import { jornadasVendedores, jornadasEmpresas } from "./jornada.js";
import { capiAtiva } from "./metaConversoes.js";
import { anunciosConectados, gastosMeta } from "./metaAnuncios.js";
import { leadsRycs, statusLeadsRycs } from "./metaLeadsRycs.js";

const DIA = 24 * 60 * 60 * 1000;
const json = (texto) => { try { return JSON.parse(texto || "{}") || {}; } catch { return {}; } };

function depositosPorEmpresa() {
  const mapa = new Map();
  for (const l of db.prepare(`
    SELECT d.companyId, COALESCE(NULLIF(d.moeda, ''), NULLIF(c.moeda, ''), 'BRL') AS moedaDeposito, SUM(d.valor) AS total
    FROM deposit_requests d JOIN companies c ON c.id = d.companyId
    WHERE d.status = 'confirmado' GROUP BY d.companyId, moedaDeposito
  `).all()) mapa.set(l.companyId, { ...(mapa.get(l.companyId) || {}), [l.moedaDeposito]: l.total });
  return mapa;
}

function statusRastreio(desde) {
  const eventos = {};
  for (const l of db.prepare("SELECT evento, status, COUNT(*) AS n FROM meta_eventos WHERE atualizadoEm >= ? GROUP BY evento, status").all(desde)) {
    eventos[l.evento] ||= { enviados: 0, erros: 0 };
    if (l.status === "enviado") eventos[l.evento].enviados += l.n;
    else if (l.status === "erro") eventos[l.evento].erros += l.n;
  }
  const ultimoErro = db.prepare("SELECT evento, erro, atualizadoEm FROM meta_eventos WHERE status = 'erro' ORDER BY atualizadoEm DESC LIMIT 1").get() || null;
  return { pixelId: META_PIXEL_ID, capiAtiva: capiAtiva(), anunciosConectados: anunciosConectados(), eventos, ultimoErro };
}

export async function relatorioCampanhas({ tipo = "vendedor", dias = 30, origem = "meta" } = {}) {
  const t = agora();
  const desde = Number(dias) > 0 ? t - Number(dias) * DIA : 0;
  const daOrigem = (o) => !origem || classificarOrigem(o) === origem;

  const visitantes = db.prepare("SELECT origem, papel, primeiroEm FROM jornada_visitantes WHERE primeiroEm >= ?").all(desde)
    .map((v) => ({ origem: json(v.origem), papel: v.papel, em: v.primeiroEm }))
    .filter((v) => daOrigem(v.origem));

  // As duas jornadas entram para descobrir o tipo de cada campanha.
  const depositos = depositosPorEmpresa();
  const contas = [
    ...jornadasVendedores(desde).map((j) => ({ ...j, papel: "vendedor" })),
    ...jornadasEmpresas(desde).map((j) => ({ ...j, papel: "empresa", depositos: depositos.get(j.id) || {} })),
  ].map((j) => ({ origem: j.origemBruta, criadoEm: j.criadoEm, papel: j.papel, pais: j.pais, marcos: j.marcos, depositos: j.depositos }))
    .filter((c) => daOrigem(c.origem));

  let gasto = { status: anunciosConectados() ? "ok" : "sem_token", erro: "" };
  let dadosGasto = null;
  if (anunciosConectados() && (!origem || origem === "meta")) {
    try { dadosGasto = await gastosMeta({ desde, ate: t }); }
    catch (e) { gasto = { status: "erro", erro: String(e?.message || e).slice(0, 200) }; }
  }

  // Leads de formulário instantâneo são sempre da Meta.
  const leads = !origem || origem === "meta" ? leadsRycs({ desde }) : [];

  return {
    ...agruparCampanhas({ tipo, visitantes, contas, gastos: dadosGasto?.gastos, gastosDia: dadosGasto?.gastosDia, leads }),
    gastoMeta: gasto,
    rastreio: { ...statusRastreio(desde), leadsFormulario: statusLeadsRycs() },
  };
}

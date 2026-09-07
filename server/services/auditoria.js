import db from "../db.js";
import { ACOES } from "../../shared/acoes.js";
import { avaliar } from "./regras.js";

// Auditoria da RYCS — roda no servidor, sem depender de IA externa.
//
// Antes o veredito vinha de uma chamada à Anthropic. O motor de regras faz a
// triagem localmente: é gratuito, instantâneo, reproduzível e explicável —
// cada recusa lista exatamente o que pesou, o que a IA não garantia.
//
// O que ele não faz é julgar conteúdo: não assiste ao vídeo nem interpreta
// nuance. Por isso o desenho continua sendo triagem, com "revisao" mandando
// para conferência humana da empresa sempre que houver dúvida.

const UMA_HORA = 3600000;
const JANELA_CLIENTE = 24 * UMA_HORA;

// Reúne o histórico que transforma checagem de formato em detecção de fraude.
function montarContexto({ sellerId, companyId, prova }) {
  const ctx = {};

  const telefone = String(prova?.telefone || "").replace(/\D/g, "");
  const video = String(prova?.video || "").trim();
  const cliente = String(prova?.cliente || "").trim().toLowerCase();

  const anteriores = db.prepare(
    "SELECT prova, companyId, criadoEm, status FROM submissions WHERE sellerId = ? ORDER BY criadoEm DESC LIMIT 200"
  ).all(sellerId);

  const agora = Date.now();
  let acoesUltimaHora = 0;

  for (const a of anteriores) {
    let p = {};
    try { p = JSON.parse(a.prova || "{}"); } catch { /* prova corrompida */ }

    if (agora - a.criadoEm < UMA_HORA) acoesUltimaHora++;

    const tel = String(p.telefone || "").replace(/\D/g, "");
    if (telefone && tel && tel === telefone) ctx.telefoneRepetido = true;

    if (video && String(p.video || "").trim() === video) ctx.videoRepetido = true;

    if (cliente && String(p.cliente || "").trim().toLowerCase() === cliente
        && agora - a.criadoEm < JANELA_CLIENTE) ctx.clienteRepetidoRecente = true;
  }

  ctx.acoesUltimaHora = acoesUltimaHora;
  ctx.primeiraAcaoNaEmpresa = !anteriores.some((a) => a.companyId === companyId);

  const decididas = anteriores.filter((a) => ["liberado", "recusado", "ia_recusado"].includes(a.status));
  const aprovadas = anteriores.filter((a) => a.status === "liberado");
  ctx.totalDecididas = decididas.length;
  ctx.totalAprovadas = aprovadas.length;
  ctx.taxaAprovacao = decididas.length ? Math.round((aprovadas.length / decididas.length) * 100) : 100;

  const empresa = db.prepare("SELECT ticket FROM companies WHERE id = ?").get(companyId);
  ctx.ticketEmpresa = Number(String(empresa?.ticket || "").replace(/[^\d]/g, "")) || 0;

  return ctx;
}

export async function auditar({ tipo, prova, sellerId, companyId }) {
  const acao = ACOES[tipo];
  if (!acao) return { veredito: "revisao", confianca: 0, motivo: "Tipo de ação desconhecido.", fonte: "sistema" };

  const contexto = sellerId && companyId ? montarContexto({ sellerId, companyId, prova }) : {};
  return avaliar({ tipo, prova, camposReq: acao.prova, contexto });
}

export const statusDoVeredito = (v) =>
  v === "aprovado" ? "ia_aprovado" : v === "recusado" ? "ia_recusado" : "revisao";

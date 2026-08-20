import { API_URL } from "./api.js";
import { ACOES } from "./constants.js";

export function heuristicaLocal(prova, camposReq) {
  let pontos = 0;
  const motivos = [];
  const video = String(prova.video || "").trim();
  if (/^https?:\/\/\S+/i.test(video)) pontos += 34; else motivos.push("link de vídeo ausente ou inválido");
  const cliente = String(prova.cliente || "").trim();
  if (cliente.length >= 5 && !/^(teste|test|asdf|aaa+|cliente ?\d*|xxx+)$/i.test(cliente)) pontos += 26;
  else motivos.push("nome do cliente genérico");
  const telefone = String(prova.telefone || "").replace(/\D/g, "");
  if (!camposReq.includes("telefone") || telefone.length >= 10) pontos += 22;
  else motivos.push("telefone incompleto");
  const preenchidos = camposReq.every((c) => String(prova[c] || "").trim().length > 0);
  if (preenchidos) pontos += 18; else motivos.push("campo obrigatório vazio");
  const veredito = pontos >= 78 ? "aprovado" : pontos >= 48 ? "revisao" : "recusado";
  const motivo = motivos.length ? motivos.join(", ") : "dados consistentes com o exigido";
  return { veredito, confianca: Math.max(5, Math.min(96, pontos)), motivo: motivo[0].toUpperCase() + motivo.slice(1) + "." };
}

export async function analisarComIA({ tipo, prova }) {
  const acao = ACOES[tipo];
  try {
    const resposta = await fetch(`${API_URL}/api/analisar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, prova }),
    });
    if (!resposta.ok) throw new Error("backend offline");
    const j = await resposta.json();
    return { veredito: j.veredito, confianca: j.confianca, motivo: j.motivo, fonte: "ia" };
  } catch (e) {
    const r = heuristicaLocal(prova, acao.prova);
    return { ...r, fonte: "heuristica" };
  }
}

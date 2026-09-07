import Anthropic from "@anthropic-ai/sdk";
import { ACOES, CAMPOS, SISTEMA_AUDITOR } from "../../shared/acoes.js";

// A auditoria roda no servidor, no momento em que a ação é criada.
//
// Antes ela vivia no navegador: a tela chamava a IA e depois gravava o
// veredito na própria ação. Isso permitia ao vendedor pular a análise e
// escrever "aprovado" na própria tarefa — auto-aprovar o próprio trabalho.
// Aqui o veredito nunca passa pelo cliente.

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

if (!client) console.warn("[auditoria] ANTHROPIC_API_KEY ausente — usando triagem por heurística.");

// Plano B determinístico. Existe para o sistema nunca travar sem veredito:
// sem ele, uma falha da IA deixaria a ação parada para sempre, que é
// exatamente o que estava acontecendo.
export function heuristica(prova, camposReq) {
  let pontos = 0;
  const motivos = [];

  const video = String(prova?.video || "").trim();
  if (/^https?:\/\/\S+/i.test(video)) pontos += 34;
  else motivos.push("link de vídeo ausente ou inválido");

  const cliente = String(prova?.cliente || "").trim();
  if (cliente.length >= 5 && !/^(teste|test|asdf|a+|cliente ?\d*|x+|nome)$/i.test(cliente)) pontos += 26;
  else motivos.push("nome do cliente genérico");

  const telefone = String(prova?.telefone || "").replace(/\D/g, "");
  const precisaTelefone = camposReq.includes("telefone");
  if (!precisaTelefone || telefone.length >= 10) pontos += 22;
  else motivos.push("telefone incompleto");

  // Dígitos repetidos são o padrão mais comum de telefone inventado.
  if (precisaTelefone && /^(\d)\1+$/.test(telefone)) { pontos -= 30; motivos.push("telefone com dígitos repetidos"); }

  const preenchidos = camposReq.every((c) => String(prova?.[c] || "").trim().length > 0);
  if (preenchidos) pontos += 18;
  else motivos.push("campo obrigatório vazio");

  pontos = Math.max(0, Math.min(100, pontos));
  const veredito = pontos >= 78 ? "aprovado" : pontos >= 48 ? "revisao" : "recusado";
  const texto = motivos.length ? motivos.join(", ") : "dados consistentes com o exigido";

  return {
    veredito,
    confianca: Math.max(5, Math.min(96, pontos)),
    motivo: texto[0].toUpperCase() + texto.slice(1) + ".",
    fonte: "heuristica",
  };
}

export async function auditar({ tipo, prova }) {
  const acao = ACOES[tipo];
  if (!acao) return { veredito: "revisao", confianca: 0, motivo: "Tipo de ação desconhecido.", fonte: "sistema" };

  if (!client) return heuristica(prova, acao.prova);

  try {
    const linhas = acao.prova.map((c) => `${CAMPOS[c]?.label || c}: ${prova?.[c] || "(vazio)"}`).join("\n");
    const resposta = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: SISTEMA_AUDITOR,
      messages: [{ role: "user", content: `Ação: ${acao.nome}\nRegra: ${acao.regra}\n\nDados enviados pelo vendedor:\n${linhas}` }],
    });

    const texto = resposta.content.map((b) => b.text || "").join("").replace(/```json|```/g, "").trim();
    const j = JSON.parse(texto);

    return {
      veredito: ["aprovado", "revisao", "recusado"].includes(j.veredito) ? j.veredito : "revisao",
      confianca: Math.max(0, Math.min(100, Math.round(Number(j.confianca) || 50))),
      motivo: String(j.motivo || "Analisado pela IA.").slice(0, 200),
      fonte: "ia",
    };
  } catch (err) {
    // Falha da IA não pode travar a esteira: cai na heurística e segue.
    console.error("[auditoria] IA indisponível:", err.message);
    return heuristica(prova, acao.prova);
  }
}

export const statusDoVeredito = (v) =>
  v === "aprovado" ? "ia_aprovado" : v === "recusado" ? "ia_recusado" : "revisao";

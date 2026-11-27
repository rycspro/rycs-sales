// Roteiro comercial guiado: importação (uma vez) e acompanhamento ao vivo.
//
// Importação: o documento (PDF/TXT/texto colado) é lido uma única vez e vira
// o roteiro estruturado salvo no banco. O PDF nunca volta à IA durante as
// chamadas. Sem chave da IA, o motor interno separa títulos e perguntas e
// marca tudo para revisão.
//
// Ao vivo: a cada trecho novo de fala, primeiro o casamento local (grátis,
// instantâneo); depois, se houver IA, um modelo rápido recebe só o trecho novo
// + um rabo curto do anterior + o roteiro compacto (em cache) e devolve quais
// perguntas foram feitas e quais respostas apareceram, sempre com a citação.
// Citação que não está na fala é descartada: resposta nunca é inventada. Se a
// IA falhar ou demorar, a chamada segue com o casamento local e o manual.

import Anthropic from "@anthropic-ai/sdk";
import { extrairTextoPdf } from "./reportPdf.js";
import {
  normalizarEstrutura, estruturarTextoInterno, listarPerguntas, perguntasVisiveis, aguardandoResposta,
  trechoNaFala, casarLocal, aplicarAchados, palavrasChave, OPERADORES, TIPOS_CAMPO, LIMITES,
} from "../../shared/roteiroComercial.js";

// Importação acontece uma vez por documento: modelo mais capaz. Ao vivo,
// latência e custo mandam: modelo rápido. Os dois podem ser trocados por env.
const MODELO_IMPORTACAO = process.env.ROTEIRO_IA_MODELO || "claude-opus-5-5";
const MODELO_TEMPO_REAL = process.env.ROTEIRO_IA_TEMPO_REAL_MODELO || "claude-haiku-5-5";
const TIMEOUT_IMPORTACAO_MS = 180000;
const TIMEOUT_TEMPO_REAL_MS = 8000;
export const MAX_TEXTO_DOCUMENTO = 200000;
const MAX_PDF_IA = 20 * 1024 * 1024;
const RABO_CONTEXTO = 400;      // caracteres do trecho anterior mandados como contexto
const MIN_TRECHO_IA = 2;        // "sim" sozinho já é resposta: o navegador agrupa as falas antes de mandar
export const MAX_CHAMADAS_IA = 600; // teto por execução (≈ 1h de conversa)

export const iaDisponivel = () => !!process.env.ANTHROPIC_API_KEY;

let cliente = null;
const claude = () => (cliente ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 }));
// Fallback de recusa no servidor só existe para Opus/Sonnet/Fable.
const comFallback = (modelo) => /^claude-(opus|sonnet|fable)/.test(modelo) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {};

// ── Importação ───────────────────────────────────────────────────────

const CONDICAO = {
  anyOf: [
    { type: "null" },
    {
      type: "object", additionalProperties: false, required: ["perguntaId", "operador", "valor"],
      properties: { perguntaId: { type: "string" }, operador: { type: "string", enum: OPERADORES.map((o) => o.id) }, valor: { type: "string" } },
    },
  ],
};

const ESQUEMA_IMPORTACAO = {
  type: "object", additionalProperties: false, required: ["nome", "blocos", "criterios", "avisos"],
  properties: {
    nome: { type: "string" },
    blocos: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["id", "titulo", "orientacao", "condicao", "topicos"],
        properties: {
          id: { type: "string" }, titulo: { type: "string" }, orientacao: { type: "string" }, condicao: CONDICAO,
          topicos: {
            type: "array",
            items: {
              type: "object", additionalProperties: false, required: ["id", "titulo", "orientacao", "perguntas"],
              properties: {
                id: { type: "string" }, titulo: { type: "string" }, orientacao: { type: "string" },
                perguntas: {
                  type: "array",
                  items: {
                    type: "object", additionalProperties: false,
                    required: ["id", "texto", "variacoes", "orientacao", "obrigatoria", "campo", "condicao"],
                    properties: {
                      id: { type: "string" }, texto: { type: "string" },
                      variacoes: { type: "array", items: { type: "string" } },
                      orientacao: { type: "string" }, obrigatoria: { type: "boolean" },
                      campo: {
                        type: "object", additionalProperties: false, required: ["tipo", "opcoes"],
                        properties: { tipo: { type: "string", enum: TIPOS_CAMPO.map((t) => t.id) }, opcoes: { type: "array", items: { type: "string" } } },
                      },
                      condicao: CONDICAO,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    criterios: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["descricao", "perguntaId", "operador", "valor", "efeito"],
        properties: {
          descricao: { type: "string" }, perguntaId: { type: "string" },
          operador: { type: "string", enum: OPERADORES.map((o) => o.id) }, valor: { type: "string" },
          efeito: { type: "string", enum: ["qualifica", "desqualifica"] },
        },
      },
    },
    avisos: { type: "array", items: { type: "string" } },
  },
};

const SISTEMA_IMPORTACAO = `Você transforma o documento de roteiro comercial de uma empresa (ligação ou videochamada de vendas) em um roteiro estruturado, em português do Brasil.

Regras:
- Use somente o que está no documento. Não crie perguntas, argumentos, preços, condições ou critérios que não estejam nele.
- Preserve a ordem e a lógica do documento. O texto de cada pergunta fica o mais próximo possível do original; corrija só quebras de linha e erros de extração.
- Bloco = etapa do roteiro (por exemplo abertura, qualificação, apresentação, objeções, fechamento), com o título que o documento usa. Tópico = subdivisão dentro da etapa; se o documento não subdivide, use um único tópico com título vazio.
- Pergunta = algo que o profissional pergunta ao contato e cuja resposta vale registrar. Falas, argumentos e instruções sem pergunta vão em "orientacao" do bloco, do tópico ou da pergunta a que se referem.
- obrigatoria = true somente quando o documento indica (obrigatória, sempre perguntar, não pular, essencial e afins).
- campo.tipo: "sim_nao" para perguntas fechadas de sim ou não; "opcao" quando o documento lista as respostas possíveis (opcoes = essas respostas, como estão escritas); "numero", "moeda" ou "data" quando a resposta é quantidade, valor em dinheiro ou data; senão "texto". opcoes fica vazio fora de "opcao".
- condicao: quando o documento diz que uma pergunta ou bloco só vale em certo caso ("se o cliente disser que sim, pergunte...", "caso tenha mais de 10 funcionários"), aponte o id da pergunta da qual depende, com operador e valor. Sem condição: null.
- criterios: critérios de qualificação ou desqualificação definidos no documento, ligados ao id da pergunta correspondente quando houver (senão perguntaId vazio).
- ids únicos no roteiro todo: blocos b1, b2…; tópicos t1, t2…; perguntas p1, p2…
- variacoes: até 3 jeitos naturais e diferentes de alguém fazer essa mesma pergunta numa conversa falada. Servem só para reconhecer a pergunta no áudio: não mudam o sentido nem acrescentam assunto.
- avisos: trechos ambíguos ou que você não conseguiu encaixar. Lista vazia se não houver.
- nome: o título que o documento dá ao roteiro; sem título, um nome curto e descritivo.`;

// Pergunta que não aparece no documento fica marcada para a empresa revisar.
function marcarRevisao(estrutura, fonte) {
  if (!fonte) return estrutura;
  const conjunto = new Set(palavrasChave(fonte));
  for (const b of estrutura.blocos) for (const t of b.topicos) for (const p of t.perguntas) {
    const chaves = palavrasChave(p.texto);
    if (!chaves.length) continue;
    const presentes = chaves.filter((c) => conjunto.has(c)).length;
    if (presentes / chaves.length < 0.6) p.revisar = true;
  }
  return estrutura;
}

// Lê o documento uma única vez e devolve o roteiro estruturado.
// arquivo = { nome, buffer } (PDF ou TXT) | texto = string colada.
export async function estruturarDocumento({ texto = "", arquivo = null }) {
  let fonte = String(texto || "");
  let pdf = null;
  if (arquivo) {
    const ext = String(arquivo.nome || "").toLowerCase().split(".").pop();
    if (ext === "pdf") {
      try { fonte = extrairTextoPdf(arquivo.buffer); } catch (e) { throw new Error(e.message || "Não foi possível ler o PDF."); }
      pdf = arquivo.buffer;
    } else if (ext === "txt") {
      fonte = arquivo.buffer.toString("utf8");
    } else {
      throw new Error("Envie um arquivo PDF ou TXT.");
    }
  }
  fonte = fonte.replace(/\u0000/g, "").trim();
  if (fonte.length > MAX_TEXTO_DOCUMENTO) throw new Error(`O documento tem ${fonte.length.toLocaleString("pt-BR")} caracteres; o limite é ${MAX_TEXTO_DOCUMENTO.toLocaleString("pt-BR")}. Divida em partes.`);
  // PDF escaneado (sem texto) só a IA consegue ler.
  const textoSuficiente = fonte.length >= 80;
  if (!textoSuficiente && !(pdf && iaDisponivel())) {
    throw new Error(pdf ? "O PDF não tem texto legível. Envie a versão em texto ou cole o conteúdo." : "Conteúdo muito curto para montar um roteiro.");
  }

  if (iaDisponivel()) {
    try {
      const conteudo = textoSuficiente
        ? [{ type: "text", text: `DOCUMENTO:\n${fonte}` }]
        : (pdf.length <= MAX_PDF_IA
          ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } }, { type: "text", text: "Estruture o roteiro deste documento." }]
          : null);
      if (!conteudo) throw new Error("PDF grande demais para leitura por imagem.");
      const resposta = await claude().beta.messages.create({
        model: MODELO_IMPORTACAO,
        max_tokens: 16000,
        ...comFallback(MODELO_IMPORTACAO),
        output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA_IMPORTACAO } },
        system: SISTEMA_IMPORTACAO,
        messages: [{ role: "user", content: conteudo }],
      }, { timeout: TIMEOUT_IMPORTACAO_MS });
      if (resposta.stop_reason === "refusal") throw new Error("A IA não processou este documento.");
      if (resposta.stop_reason === "max_tokens") throw new Error("O roteiro ficou grande demais para uma leitura. Divida o documento em partes.");
      const bloco = resposta.content.find((b) => b.type === "text");
      const json = JSON.parse(bloco?.text || "");
      const estrutura = marcarRevisao(normalizarEstrutura(json), textoSuficiente ? fonte : "");
      if (!listarPerguntas(estrutura).length && !estrutura.blocos.length) throw new Error("A IA não encontrou roteiro no documento.");
      return {
        estrutura, origem: "ia", nome: String(json.nome || "").trim().slice(0, 120),
        avisos: (json.avisos || []).map((a) => String(a).slice(0, 300)).slice(0, 10),
      };
    } catch (e) {
      // Falha da IA não trava a importação quando há texto: segue o motor interno.
      if (!textoSuficiente) throw new Error(e.message || "A IA não conseguiu ler este PDF.");
      console.warn("[roteiro] importação pela IA falhou, usando motor interno:", e.message);
    }
  }
  const estrutura = estruturarTextoInterno(fonte);
  // Primeiro "bloco" só com título é o título do documento: vira o nome.
  let nome = "";
  const primeiro = estrutura.blocos[0];
  if (estrutura.blocos.length > 1 && primeiro && !primeiro.orientacao && !primeiro.topicos.length) {
    nome = primeiro.titulo.slice(0, 120);
    estrutura.blocos.shift();
  }
  if (!estrutura.blocos.length) throw new Error("Não encontramos conteúdo de roteiro no documento.");
  return {
    estrutura, origem: "interno", nome,
    avisos: ["Roteiro montado sem IA: títulos viraram blocos e frases com \"?\" viraram perguntas. Revise tipos de resposta, obrigatórias e condições antes de publicar."],
  };
}

// ── Acompanhamento ao vivo ───────────────────────────────────────────

const ESQUEMA_TEMPO_REAL = {
  type: "object", additionalProperties: false, required: ["perguntasFeitas", "respostas"],
  properties: {
    perguntasFeitas: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["id", "trecho"], properties: { id: { type: "string" }, trecho: { type: "string" } } },
    },
    respostas: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["id", "valor", "trecho"], properties: { id: { type: "string" }, valor: { type: "string" }, trecho: { type: "string" } } },
    },
  },
};

const SISTEMA_TEMPO_REAL = `Você acompanha ao vivo uma conversa comercial guiada por um roteiro. A transcrição chega em trechos, sem indicar quem fala.

Com base apenas no TRECHO NOVO:
1. perguntasFeitas: perguntas do roteiro que foram feitas ao contato, mesmo com outras palavras, desde que com o mesmo sentido. trecho = citação exata da transcrição.
2. respostas: respostas do contato a perguntas do roteiro, inclusive às que estão AGUARDANDO RESPOSTA e às ainda não feitas, quando o contato já respondeu por conta própria. valor = a resposta curta, como foi dita, no formato do campo; trecho = citação exata da transcrição.

Regras:
- Nunca invente nem deduza além do que foi dito. Na dúvida, deixe de fora.
- Ignore perguntas listadas como FORA DO ROTEIRO AGORA.
- Campo sim_nao: valor "Sim" ou "Não". Campo opcao: exatamente uma das opções listadas. Campos numero e moeda: só o número dito.
- O CONTEXTO ANTERIOR serve só para entender o trecho novo; não repita o que já foi analisado nele.
- Nada encontrado: listas vazias.`;

// Roteiro em poucas linhas, sem orientações: é o que vai em cache.
export function roteiroCompacto(estrutura) {
  const linhas = ["ROTEIRO (id [tipo] pergunta | outras formas | opções):"];
  for (const p of listarPerguntas(estrutura)) {
    let l = `${p.id} [${p.campo?.tipo || "texto"}] ${p.texto}`;
    if (p.variacoes?.length) l += ` | ${p.variacoes.join(" / ")}`;
    if (p.campo?.opcoes?.length) l += ` | opções: ${p.campo.opcoes.join("; ")}`;
    linhas.push(l);
  }
  return linhas.join("\n");
}

function descreverEstado(estrutura, estado) {
  const visiveis = new Set(perguntasVisiveis(estrutura, estado.respostas).map((p) => p.id));
  const todas = listarPerguntas(estrutura).map((p) => p.id);
  const lista = (ids) => (ids.length ? ids.join(", ") : "nenhuma");
  return [
    `PERGUNTA ATUAL: ${estado.perguntaAtual || "nenhuma"}`,
    `JÁ FEITAS: ${lista(todas.filter((id) => estado.feitas?.[id]))}`,
    `AGUARDANDO RESPOSTA: ${lista(aguardandoResposta(estrutura, estado))}`,
    `JÁ RESPONDIDAS: ${lista(todas.filter((id) => estado.respostas?.[id]))}`,
    `FORA DO ROTEIRO AGORA: ${lista(todas.filter((id) => !visiveis.has(id)))}`,
  ].join("\n");
}

async function perguntarIA(estrutura, estado, contextoAnterior, trechoNovo) {
  const resposta = await claude().messages.create({
    model: MODELO_TEMPO_REAL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA_TEMPO_REAL } },
    system: [
      { type: "text", text: SISTEMA_TEMPO_REAL },
      { type: "text", text: roteiroCompacto(estrutura), cache_control: { type: "ephemeral" } },
    ],
    messages: [{
      role: "user",
      content: `${descreverEstado(estrutura, estado)}\n\nCONTEXTO ANTERIOR: ${contextoAnterior ? `"${contextoAnterior}"` : "(início da conversa)"}\n\nTRECHO NOVO: "${trechoNovo}"`,
    }],
  }, { timeout: TIMEOUT_TEMPO_REAL_MS });
  if (resposta.stop_reason === "refusal" || resposta.stop_reason === "max_tokens") throw new Error(`resposta ${resposta.stop_reason}`);
  const bloco = resposta.content.find((b) => b.type === "text");
  const json = JSON.parse(bloco?.text || "{}");
  const u = resposta.usage || {};
  return { json, tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.output_tokens || 0) };
}

// Só aceita o que a IA cita e que está mesmo na fala.
function filtrarAchadosIA(estrutura, json, fala) {
  const ids = new Set(listarPerguntas(estrutura).map((p) => p.id));
  const ok = (x) => x && ids.has(String(x.id)) && trechoNaFala(x.trecho, fala);
  return {
    feitas: (json?.perguntasFeitas || []).filter(ok).map((x) => ({ id: String(x.id), trecho: String(x.trecho).slice(0, LIMITES.trecho) })),
    respostas: (json?.respostas || []).filter(ok).map((x) => ({ id: String(x.id), valor: String(x.valor ?? ""), trecho: String(x.trecho).slice(0, LIMITES.trecho) })),
  };
}

// Analisa um trecho novo. Devolve { aplicar(estado), contextoFala, ia, tokens }:
// `aplicar` é usado sobre o estado lido de novo do banco, para não perder uma
// correção manual feita enquanto a IA respondia.
// ia = "ok" | "indisponivel" | "falhou" | "pulada".
export async function analisarTrecho({ estrutura, estado, contextoFala = "", trecho, chamadasIA = 0 }) {
  const novo = String(trecho || "").replace(/\s+/g, " ").trim().slice(0, 4000);
  const rabo = `${contextoFala} ${novo}`.trim().slice(-RABO_CONTEXTO);
  if (!novo) return { aplicar: (e) => e, contextoFala, ia: "pulada", tokens: 0 };

  // 1. Casamento local: grátis e imediato. O fim do trecho anterior entra para
  //    pegar a resposta de uma pergunta feita logo antes do corte.
  const locais = casarLocal(estrutura, estado, `${contextoFala.slice(-160)} ${novo}`);
  const aplicarLocal = (e) => aplicarAchados(estrutura, e, locais, "local");
  const semIA = (ia) => ({ aplicar: aplicarLocal, contextoFala: rabo, ia, tokens: 0 });

  // 2. IA, quando há chave, trecho que vale a pena e dentro do teto.
  if (!iaDisponivel()) return semIA("indisponivel");
  if (novo.length < MIN_TRECHO_IA || chamadasIA >= MAX_CHAMADAS_IA) return semIA("pulada");
  try {
    const { json, tokens } = await perguntarIA(estrutura, aplicarLocal(estado), contextoFala.slice(-RABO_CONTEXTO), novo);
    const daIA = filtrarAchadosIA(estrutura, json, `${contextoFala} ${novo}`);
    return { aplicar: (e) => aplicarAchados(estrutura, aplicarLocal(e), daIA, "ia"), contextoFala: rabo, ia: "ok", tokens };
  } catch (e) {
    console.warn("[roteiro] análise ao vivo sem IA nesta rodada:", e.message);
    return semIA("falhou");
  }
}

// Frases que o whisper "ouve" no silêncio. Trecho que é só isso é descartado.
const ALUCINACOES = [/legendas? (pela|por) .*amara/i, /^obrigad[oa][.!]?$/i, /^tchau[.!]?$/i, /inscreva-se/i, /^\.+$/];
export function limparTranscricao(texto) {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  return ALUCINACOES.some((r) => r.test(t)) ? "" : t;
}

// Texto curto para a linha do tempo do lead (CRM).
export function resumoRespostas(nomeRoteiro, estrutura, estado) {
  const linhas = [];
  for (const p of listarPerguntas(estrutura)) {
    const r = estado?.respostas?.[p.id];
    if (r?.valor) linhas.push(`${p.texto} → ${r.valor}`);
  }
  const cabeca = `Roteiro "${nomeRoteiro}": ${linhas.length} resposta(s).`;
  return `${cabeca}${linhas.length ? `\n${linhas.join("\n")}` : ""}`.slice(0, 3000);
}

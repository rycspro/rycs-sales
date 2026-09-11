// Adapter Anthropic.
//
// É o único fornecedor já presente no projeto (`@anthropic-ai/sdk` está nas
// dependências), então é o único que ganha implementação real. Os demais —
// OpenAI, Gemini, Deepgram, Google Speech — entram registrando outro adapter
// neste mesmo formato, sem que o pipeline mude uma linha.
//
// Sem ANTHROPIC_API_KEY, `disponivel()` devolve false e a capacidade responde
// INDISPONÍVEL. Em nenhuma hipótese um resultado é fabricado.

import { registrarProvider } from "./index.js";

const MODELO_ECONOMICO = "claude-haiku-4-5-20251001";
const MODELO_CAPAZ = "claude-sonnet-5";

// Preço por milhão de tokens, usado só para estimar custo por auditoria. É
// aproximação para acompanhamento interno, não cobrança.
const PRECO = {
  [MODELO_ECONOMICO]: { entrada: 1, saida: 5 },
  [MODELO_CAPAZ]: { entrada: 3, saida: 15 },
};

const temChave = () => !!process.env.ANTHROPIC_API_KEY;

async function cliente() {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function estimarCusto(modelo, uso) {
  const p = PRECO[modelo];
  if (!p || !uso) return null;
  const custo = ((uso.input_tokens || 0) / 1e6) * p.entrada + ((uso.output_tokens || 0) / 1e6) * p.saida;
  return Math.round(custo * 1e6) / 1e6;
}

// O modelo devolve texto. Extrair JSON de dentro dele é responsabilidade do
// adapter; validar o formato é do contrato. Um JSON quebrado vira erro aqui e
// o critério fica inconclusivo — nunca um palpite.
function extrairJson(texto) {
  const limpo = String(texto || "").replace(/```json|```/g, "").trim();
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) throw new Error("resposta do modelo sem JSON reconhecível");
  return JSON.parse(limpo.slice(inicio, fim + 1));
}

// ---------------------------------------------------------- semântica ----
registrarProvider({
  capacidade: "semantica",
  nome: "anthropic",
  modelo: MODELO_CAPAZ,
  prioridade: 10,
  disponivel: temChave,
  async executar({ entrada }) {
    const { transcricao, esquema } = entrada;
    if (!transcricao) throw new Error("sem transcrição para avaliar");

    // Critério a critério, com o trecho que sustenta a resposta. Contexto
    // longo é justamente onde este modelo rende, então a transcrição inteira
    // vai numa chamada só em vez de várias — sai mais barato e mais coerente.
    const api = await cliente();
    const r = await api.messages.create({
      model: MODELO_CAPAZ,
      max_tokens: 2000,
      system: esquema.instrucao + "\n\nFormato exato da resposta:\n" + JSON.stringify(esquema.formato),
      messages: [{
        role: "user",
        content: `CRITÉRIOS:\n${JSON.stringify(esquema.criterios, null, 1)}\n\nTRANSCRIÇÃO:\n${String(transcricao).slice(0, 120000)}`,
      }],
    });

    const texto = r.content.map((b) => b.text || "").join("");
    return {
      dados: extrairJson(texto),
      modelo: MODELO_CAPAZ,
      custoEstimado: estimarCusto(MODELO_CAPAZ, r.usage),
      tokens: { entrada: r.usage?.input_tokens ?? null, saida: r.usage?.output_tokens ?? null },
    };
  },
});

// -------------------------------------------------------------- visão ----
registrarProvider({
  capacidade: "visao",
  nome: "anthropic",
  modelo: MODELO_ECONOMICO,
  prioridade: 10,
  disponivel: temChave,
  async executar({ entrada }) {
    const { base64, mimetype } = entrada;
    // O pipeline entrega referência de storage; enquanto o download assinado
    // não estiver ligado, sem bytes não há análise — e isso é um erro honesto,
    // não um resultado inventado.
    if (!base64) throw new Error("análise de imagem exige o conteúdo do arquivo; referência de storage ainda não é resolvida por este adapter");

    const api = await cliente();
    const r = await api.messages.create({
      model: MODELO_ECONOMICO,
      max_tokens: 400,
      system:
        "Você avalia fotos de comprovação de visita comercial. Responda APENAS JSON com as chaves " +
        "business_environment_detected, storefront_detected, person_detected, suspicious_content, " +
        "possible_manipulation (booleanos) e confidence (0..1), mais notes (string curta). " +
        "Avalie apenas o ambiente e a integridade da imagem. Não descreva, avalie ou infira " +
        "características pessoais de quem aparece na foto.",
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimetype || "image/jpeg", data: base64 } },
          { type: "text", text: "Avalie esta foto de comprovação de visita." },
        ],
      }],
    });

    const texto = r.content.map((b) => b.text || "").join("");
    return {
      dados: extrairJson(texto),
      modelo: MODELO_ECONOMICO,
      custoEstimado: estimarCusto(MODELO_ECONOMICO, r.usage),
      tokens: { entrada: r.usage?.input_tokens ?? null, saida: r.usage?.output_tokens ?? null },
    };
  },
});

// A Anthropic não oferece speech-to-text. Nenhum adapter de transcrição é
// registrado aqui: a capacidade fica indisponível até que um provedor
// específico — OpenAI, Deepgram, Google, AWS, Azure — seja adicionado.
export const CAPACIDADES_COBERTAS = ["semantica", "visao"];

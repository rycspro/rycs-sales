import { OBJETIVOS, ORDEM_OBJETIVOS, montarCampanha } from "../../shared/objetivosCampanha.js";

// Monta uma campanha a partir de um texto livre da empresa.
//
// "Quero vender energia solar para comércios em Campinas, quem fecha é meu
// time" precisa virar objetivo, função comercial, ações remuneradas, prova
// exigida e prazo. Quem contrata sabe descrever o que quer; não sabe traduzir
// isso em configuração de campanha. Esta é a tradução.
//
// Duas fontes, como no motor de leitura: provedor externo quando há chave, e o
// motor interno sempre que não há. O que sai é RASCUNHO — nada é publicado, e
// a empresa revisa campo a campo antes de qualquer coisa ir ao ar.

// Palavras que revelam a intenção. A ordem importa: a primeira que casar vence,
// e por isso "fechar" vem antes de "reunião" — quem diz "quero fechar mais
// contratos com reunião" está pedindo closer, não SDR.
const PISTAS = [
  ["vendas",      /\b(fechar|fechamento|contrato|assinar|vender mais|converter|proposta)\b/i],
  ["reativacao",  /\b(reativar|base (parada|inativa|antiga)|ex.?clientes?|voltar a (falar|vender)|churn)\b/i],
  ["campo",       /\b(porta a porta|presencial|em campo|rua|com[ée]rcio|condom[ií]nio|visita)\b/i],
  ["prospeccao",  /\b(prospec\w+|mercado novo|lista fria|cold|abrir (mercado|conta)|n[aã]o conhec\w+)\b/i],
  ["reunioes",    /\b(reuni[aã]o|reuni[oõ]es|agenda|agendar|agendamento|call|demonstra\w+)\b/i],
];

export function detectarObjetivo(texto = "") {
  for (const [chave, padrao] of PISTAS) {
    if (padrao.test(texto)) return chave;
  }
  return null;
}

// Região dita no texto. Precisa aceitar duas formas, porque as pessoas usam as
// duas: nome próprio ("em Campinas", "na Grande BH") e descrição em minúscula
// ("no interior de SP", "na zona sul", "em todo o Brasil"). Exigir inicial
// maiúscula, como eu fazia antes, perdia a segunda inteira.
const LUGAR = "(?:interior|litoral|capital|zona|regi[aã]o|grande|todo|toda|norte|sul|leste|oeste|centro)";

function extrairRegiao(texto = "") {
  // 1. Descrição em minúscula, opcionalmente seguida do estado ou cidade.
  const descrito = texto.match(
    new RegExp(`\\b(?:em|no|na|nos|nas)\\s+((?:o |a )?${LUGAR}(?:[\\wÀ-ÿ-]*)(?:\\s+(?:de|do|da|d[eo]s)?\\s*[\\wÀ-ÿ]+){0,3})`, "i")
  );
  if (descrito) return limpar(descrito[1]);

  // 2. Nome próprio.
  const proprio = texto.match(/\b(?:em|no|na)\s+([A-ZÀ-Ý][\wÀ-ÿ]+(?:\s+(?:de|do|da|d[eo]s)?\s*[A-ZÀ-Ý][\wÀ-ÿ]+){0,3})/);
  return proprio ? limpar(proprio[1]) : "";
}

// Corta a cauda que o regex agarra sem querer: "SP quem fecha" → "SP".
function limpar(t) {
  return t
    .replace(/\s+(quem|que|e|com|para|porque|pois|mas)\b.*$/i, "")
    .replace(/[,.;].*$/, "")
    .trim();
}

// Público dito no texto, quando a empresa descreve para quem vende.
function extrairPublico(texto = "") {
  const m = texto.match(/\bpara\s+((?:[a-zà-ÿ][\wÀ-ÿ]*\s+){0,6}[a-zà-ÿ][\wÀ-ÿ]*)/i);
  if (!m) return "";
  const t = m[1].trim();
  // "para Campinas" é região, não público.
  return t.length > 6 && !/^[A-ZÀ-Ý]/.test(m[1]) ? t : "";
}

// Motor interno. Determinístico: o mesmo texto produz sempre a mesma campanha.
export function sugerirInterno({ empresa = {}, brief = "" }) {
  const chave = detectarObjetivo(brief);

  if (!chave) {
    return {
      campanha: null,
      fonte: "interno",
      explicacao:
        "Não consegui identificar o objetivo pelo que você escreveu. " +
        "Diga o que precisa acontecer — agendar reuniões, abrir mercado novo, " +
        "fechar vendas, vender em campo ou reativar clientes — ou escolha o " +
        "objetivo na lista acima.",
    };
  }

  const campanha = montarCampanha(chave, empresa);
  const regiao = extrairRegiao(brief);
  const publico = extrairPublico(brief);
  if (regiao) campanha.regiao = regiao;
  if (publico && !campanha.publico) campanha.publico = publico;
  campanha.descricao = brief.trim().slice(0, 600);

  const obj = OBJETIVOS[chave];
  const partes = [`Objetivo identificado: ${obj.nome.toLowerCase()}, que pede ${obj.funcao.toUpperCase()}.`];
  if (regiao) partes.push(`Região lida do seu texto: ${regiao}.`);
  partes.push(
    campanha.valoresDerivadosDoTicket
      ? `Os valores por ação partem do seu ticket (${empresa.ticket}) e são ponto de partida — revise antes de publicar.`
      : "Sem ticket no cadastro da empresa, os valores por ação ficaram em zero: preencha antes de publicar."
  );

  return { campanha, fonte: "interno", explicacao: partes.join(" ") };
}

// Camada externa. Só roda com chave; qualquer falha cai no motor interno.
export async function sugerirCampanha({ empresa = {}, brief = "" }) {
  const base = sugerirInterno({ empresa, brief });
  if (!process.env.ANTHROPIC_API_KEY) return base;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const resposta = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 700,
      system:
        "Você traduz o pedido de uma empresa em configuração de campanha de vendas por comissão. " +
        `Responda APENAS um JSON com as chaves: objetivo (um de: ${ORDEM_OBJETIVOS.join(", ")}), ` +
        "titulo (curto), objetivoTexto (uma frase), publico (o cliente ideal descrito), regiao, descricao. " +
        "Não invente dado que não esteja no pedido nem no cadastro: campo sem informação vai como string vazia. " +
        "Não escreva valores em dinheiro — a plataforma calcula isso.",
      messages: [{
        role: "user",
        content: `Empresa: ${empresa.nome || "—"}\nProduto: ${empresa.produto || "—"}\n` +
                 `Ticket: ${empresa.ticket || "—"}\nCliente ideal: ${empresa.icp || "—"}\n\nPedido:\n${brief}`,
      }],
    });

    const texto = resposta.content.map((b) => b.text || "").join("");
    const json = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));

    // O objetivo devolvido precisa existir. Modelo que responde categoria
    // inventada não define a campanha: cai para o que o motor interno leu.
    const chave = OBJETIVOS[json.objetivo] ? json.objetivo : detectarObjetivo(brief);
    if (!chave) return base;

    const campanha = montarCampanha(chave, empresa);
    if (json.titulo) campanha.titulo = String(json.titulo).slice(0, 120);
    if (json.objetivoTexto) campanha.objetivo = String(json.objetivoTexto).slice(0, 200);
    if (json.publico) campanha.publico = String(json.publico).slice(0, 500);
    if (json.regiao) campanha.regiao = String(json.regiao).slice(0, 120);
    campanha.descricao = String(json.descricao || brief).slice(0, 600);

    return {
      campanha,
      fonte: "externo",
      explicacao: base.explicacao,
    };
  } catch (err) {
    console.error("[campanha] provedor externo indisponível, usando motor interno:", err.message);
    return base;
  }
}

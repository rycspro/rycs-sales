// Leitura de um pedido de campanha escrito em português: objetivo, região e
// público. Usada pelo motor interno da campanha assistida
// (server/services/campanhaAssistida.js) e pelo Jarvas (shared/jarvas.js).
// Determinística: o mesmo texto dá sempre a mesma leitura.

// Palavras que revelam a intenção. A ordem importa: a primeira que casar vence,
// e por isso "fechar" vem antes de "reunião" — quem diz "quero fechar mais
// contratos com reunião" está pedindo closer, não SDR.
const PISTAS = [
  // "Prospecção completa" contém "prospec" e "fechamento" contém "fechar":
  // o ciclo inteiro precisa vencer as duas partes dele, ou nunca é detectado.
  ["completa",    /\b(completa|completo|do in[ií]cio ao fim|ponta a ponta|ciclo (comercial|completo)|todo o (processo|funil|ciclo))\b/i],
  ["vendas",      /\b(fechar|fechamento|contrato|assinar|vender mais|converter|proposta)\b/i],
  ["reativacao",  /\b(reativar|base (parada|inativa|antiga)|ex.?clientes?|voltar a (falar|vender)|churn)\b/i],
  // Visita vem antes de campo: as duas são PAP, mas "visita presencial" é o
  // objetivo que a tela oferece hoje, e campo ficou restrito a porta a porta.
  ["visitas",     /\b(visita\w*|visitar|presencial|ponto de venda|pdv|in loco|diagn[óo]stico local)\b/i],
  ["campo",       /\b(porta a porta|em campo|na rua|condom[ií]nio)\b/i],
  ["prospeccao",  /\b(mercado novo|lista fria|cold|abrir (mercado|conta)|n[aã]o conhec\w+|prospec\w+)\b/i],
  ["leads",       /\b(leads?|contatos? qualificados?|abastecer\w*( o)? funil|encher o funil|qualifica\w+)\b/i],
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

export function extrairRegiao(texto = "") {
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
export function limpar(t) {
  return t
    .replace(/\s+(quem|que|e|com|para|porque|pois|mas)\b.*$/i, "")
    .replace(/[,.;].*$/, "")
    .trim();
}

// Público dito no texto, quando a empresa descreve para quem vende.
export function extrairPublico(texto = "") {
  const m = texto.match(/\bpara\s+((?:[a-zà-ÿ][\wÀ-ÿ]*\s+){0,6}[a-zà-ÿ][\wÀ-ÿ]*)/i);
  if (!m) return "";
  const t = m[1].trim();
  // "para Campinas" é região, não público.
  return t.length > 6 && !/^[A-ZÀ-Ý]/.test(m[1]) ? t : "";
}

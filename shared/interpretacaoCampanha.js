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
  ["completa",    /\b(completa|completo|do in[ií]cio ao fim|ponta a ponta|ciclo (comercial|completo)|todo o (processo|funil|ciclo)|prospec\w+ e fech\w+|equipe completa|do zero ao fech\w+)\b/i],
  ["vendas",      /\b(fechar|fechamento|contrato|assinar|vender mais|converter|proposta|negoci\w+|pitch|assinatura|closer|fechar neg[oó]cio|converter lead|resultado em venda)\b/i],
  ["reativacao",  /\b(reativar|reativa\w+|base (parada|inativa|antiga|dormind\w+)|ex.?clientes?|voltar a (falar|vender)|churn|clientes (antigos|inativos|sumid\w+|que pararam|que n[aã]o compram)|recuperar cliente|reconquistar|dormiu|sumiram)\b/i],
  // Visita vem antes de campo: as duas são PAP, mas "visita presencial" é o
  // objetivo que a tela oferece hoje, e campo ficou restrito a porta a porta.
  ["visitas",     /\b(visita\w*|visitar|presencial|ponto de venda|pdv|in loco|diagn[óo]stico local|ir ao cliente|encontro presencial|na empresa do cliente|fieldwork|in company|visita comercial)\b/i],
  ["campo",       /\b(porta a porta|porta em porta|em campo|na rua|condom[ií]nio|bairro a bairro|casa em casa|residencial)\b/i],
  ["prospeccao",  /\b(mercado novo|lista fria|cold|abrir (mercado|conta)|n[aã]o conhec\w+|prospec\w+|captar clientes?|capta\w+ (de clientes?|ativa)|novo p[uú]blico|expandir (mercado|base|carteira)|conquistar (clientes?|mercado)|abordagem ativa|outbound|prospectar)\b/i],
  ["leads",       /\b(leads?|contatos? qualificados?|abastecer\w*( o)? funil|encher o funil|qualifica\w+|pipeline (cheio|vazio|fraco)|potenciais clientes?|oportunidades? (comerciais?|de neg[oó]cio)|gerar interesse|base de contatos)\b/i],
  ["reunioes",    /\b(reuni[aã]o|reuni[oõ]es|agenda|agendar|agendamento|call|demonstra\w+|demo\b|apresenta\w+|marcar (reuni[aã]o|hor[aá]rio)|discovery|call comercial|reuni[aã]o de neg[oó]cios|marcar horario)\b/i],
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
const LUGAR = "(?:interior|litoral|capital|zona|regi[aã]o|grande|todo|toda|norte|sul|leste|oeste|centro|abc|vale|serra|baixada|tri[aâ]ngulo|oeste paulista)";
const SIGLAS_ESTADO = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/;

export function extrairRegiao(texto = "") {
  // 0. "todo o Brasil", "nacional", "em todo o país" → normaliza.
  if (/\b(todo(s)? (o )?brasil|nacion(al|almente)|em todo (o )?pa[ií]s|brasil (todo|inteiro))\b/i.test(texto))
    return "Todo o Brasil";

  // 1. Descrição em minúscula, opcionalmente seguida do estado ou cidade.
  const descrito = texto.match(
    new RegExp(`\\b(?:em|no|na|nos|nas|pelo?|pela)\\s+((?:o |a )?${LUGAR}(?:[\\wÀ-ÿ-]*)(?:\\s+(?:de|do|da|d[eo]s)?\\s*[\\wÀ-ÿ]+){0,3})`, "i")
  );
  if (descrito) return limpar(descrito[1]);

  // 2. Nome próprio ("em Campinas", "no Rio de Janeiro", "em Grande BH").
  const proprio = texto.match(/\b(?:em|no|na|pelo?|pela)\s+([A-ZÀ-Ý][\wÀ-ÿ]+(?:\s+(?:de|do|da|d[eo]s)?\s*[A-ZÀ-Ý][\wÀ-ÿ]+){0,3})/);
  if (proprio) return limpar(proprio[1]);

  // 3. Sigla de estado com preposição ("no SP", "em MG", "no RJ").
  const sigla = texto.match(new RegExp(`\\b(?:em|no|na|pelo?|pela)\\s+(${SIGLAS_ESTADO.source.slice(3, -3)})\\b`));
  if (sigla) return sigla[1];

  return "";
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
  // Padrões que introduzem o público-alvo.
  const padroes = [
    /\bpara\s+((?:[a-zà-ÿ][\wÀ-ÿ]*\s+){0,6}[a-zà-ÿ][\wÀ-ÿ]*)/i,
    /\b(?:atend(?:o|e|emos)|vend(?:o|e|emos)\s+para|foc(?:o|ado)\s+em|direcionad[oa]\s+a(?:os?)?\s+|nosso\s+cliente\s+[eé]\s+|cliente\s+ideal\s+[eé]\s+|p[uú]blico\s+[eé]\s+)\s*((?:[a-zà-ÿ][\wÀ-ÿ]*\s+){0,6}[a-zà-ÿ][\wÀ-ÿ]*)/i,
    /\b(?:empresa|neg[oó]cio)\s+(?:de|voltad[oa]\s+para)\s+((?:[a-zà-ÿ][\wÀ-ÿ]*\s+){0,5}[a-zà-ÿ][\wÀ-ÿ]*)/i,
  ];
  for (const re of padroes) {
    const m = texto.match(re);
    if (!m) continue;
    const t = (m[1] || m[2] || "").trim();
    // "para Campinas" é região, não público.
    if (t.length > 6 && !/^[A-ZÀ-Ý]/.test(t)) return t;
  }
  return "";
}

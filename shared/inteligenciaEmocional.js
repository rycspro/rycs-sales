// =============================================================================
// Inteligência Emocional — questionário autoral RYCS (30 afirmações)
//
// Avaliação VOLUNTÁRIA de autorrelato. 30 afirmações distribuídas em CINCO
// competências emocionais (6 afirmações por competência). Ajuda o profissional a
// refletir sobre como reconhece, regula e expressa emoções no ambiente de
// trabalho.
//
// NATUREZA (importante): instrumento AUTORAL da RYCS, de autorrelato. NÃO é um
// instrumento psicológico validado, NÃO é diagnóstico e NÃO mede inteligência
// emocional de forma objetiva. Os resultados são apenas FREQUÊNCIA autorrelatada
// (soma e média 1–5), nunca percentis, níveis de inteligência emocional ou
// classificações clínicas (baixa/normal/superior). Não há nota de aprovação.
//
// SEGURANÇA / CHAVE: o mapeamento afirmação → competência é a "chave" do teste e
// vive só aqui (servidor). O frontend recebe apenas os itens públicos (sem a
// competência) via `itensPublicos()` — a spec exige NÃO mostrar a competência
// durante o preenchimento. A pontuação SEMPRE usa a chave oficial daqui.
//
// I18N: os identificadores (versão, ids de item, competências, escala) são
// ESTÁVEIS e independentes de idioma. Só os textos são traduzíveis. Nunca use
// texto traduzido como identificador.
// =============================================================================

export const IE_VERSAO = "rycs-inteligencia-emocional-v1-30";
export const IE_INSTRUMENTO = "RYCS — Inteligência Emocional (30 afirmações)";
export const IE_IDIOMA = "pt-BR";
export const IE_FONTE =
  "Questionário autoral RYCS de autorrelato, inspirado em conceitos gerais de competências emocionais";
export const IE_CHAVE = "rycs-inteligencia-emocional-v1";
export const IE_ALGORITMO = "soma-media-v1";
export const IE_TOTAL = 30;
export const IE_ESCALA = 5; // frequência 1–5
export const IE_ITENS_POR_COMPETENCIA = 6;

// Experimental: liberada inicialmente sob feature flag para revisão interna
// (spec, seção 12). O rótulo "experimental" sempre acompanha o resultado.
export const IE_EXPERIMENTAL = true;

// Pendências de revisão antes da liberação geral (spec, seção 12).
export const IE_PENDENCIAS = [
  "Revisão interna das 30 afirmações quanto a clareza, redundância e vieses antes da liberação geral.",
  "Instrumento autoral de autorrelato, sem validade psicométrica: resultados apresentados apenas como frequência autorrelatada (média 1–5), nunca como percentis, níveis de inteligência emocional ou diagnóstico.",
  "Revisão interna dos textos interpretativos das cinco competências.",
];

// Flag de disponibilização. DESLIGADA por padrão: a avaliação só aparece aos
// profissionais quando INTELIGENCIA_EMOCIONAL_DISPONIVEL=1 (ou, no servidor, em
// ambiente beta — ver a rota). Mantém o questionário fora do ar durante a revisão
// interna (spec, seção 12).
export const inteligenciaEmocionalDisponivel = () =>
  String(process.env.INTELIGENCIA_EMOCIONAL_DISPONIVEL ?? "0").trim() === "1";

// -----------------------------------------------------------------------------
// As cinco competências, na ordem de apresentação do gráfico (A→E). `chave`
// interno estável. Cada competência tem uma variação discreta do azul
// institucional (spec, seção 7) para diferenciá-las sem alarmismo. Conteúdo
// interpretativo (spec, seção 8): descrição + sugestão de desenvolvimento.
// -----------------------------------------------------------------------------
export const ORDEM_COMPETENCIAS = ["A", "B", "C", "D", "E"];

export const COMPETENCIAS_IE = {
  A: {
    chave: "A",
    nome: "Autoconsciência emocional",
    cor: "#318CE7",
    descricao: "Relaciona-se à capacidade percebida de reconhecer emoções, identificar situações que as desencadeiam e compreender sua influência no comportamento.",
    sugestao: "Observe durante a semana quais situações alteram seu estado emocional e como isso influencia suas decisões.",
  },
  B: {
    chave: "B",
    nome: "Autorregulação emocional",
    cor: "#4A9BEB",
    descricao: "Relaciona-se à maneira como você relata administrar suas reações diante de críticas, frustrações e situações de pressão.",
    sugestao: "Antes de responder a uma situação difícil, experimente fazer uma pausa e organizar o que deseja comunicar.",
  },
  C: {
    chave: "C",
    nome: "Percepção das emoções alheias",
    cor: "#2D7FD0",
    descricao: "Relaciona-se à atenção que você relata dedicar às expressões, necessidades e possíveis sentimentos de outras pessoas.",
    sugestao: "Em conversas importantes, pratique confirmar se compreendeu corretamente a perspectiva do outro.",
  },
  D: {
    chave: "D",
    nome: "Gestão de relacionamentos",
    cor: "#5CA8EF",
    descricao: "Relaciona-se à forma como você relata conduzir conversas, divergências e interações profissionais.",
    sugestao: "Em situações de desacordo, procure descrever fatos, ouvir a outra pessoa e construir alternativas.",
  },
  E: {
    chave: "E",
    nome: "Adaptação emocional",
    cor: "#1E6FB8",
    descricao: "Relaciona-se à maneira como você relata reagir emocionalmente a mudanças, imprevistos e frustrações.",
    sugestao: "Quando um plano mudar, identifique o que continua sob seu controle e escolha uma próxima ação possível.",
  },
};

// Nota global de interpretação, sempre exibida com o resultado. Descritiva,
// voluntária e não-diagnóstica (spec, seções 6, 8 e 10).
export const IE_NOTA_GLOBAL =
  "Este panorama descreve a frequência de comportamentos emocionais a partir das suas respostas. " +
  "As médias (de 1 a 5) refletem apenas como você descreveu seus comportamentos — não são percentis, " +
  "níveis de inteligência emocional nem diagnóstico. Médias menores não indicam incapacidade emocional, " +
  "e não há competências melhores ou piores. Instrumento autoral RYCS, voluntário, de autorrelato; " +
  "não mede inteligência emocional de forma objetiva nem substitui avaliação profissional.";

// Cabeçalho da seção de destaques (spec, seção 7): sem rótulos definitivos.
export const IE_TITULO_DESTAQUES = "Competências mais presentes nas suas respostas";

// -----------------------------------------------------------------------------
// Alternativas de resposta (escala de frequência 1–5). `valor` é o identificador
// estável; `texto` é traduzível (spec, seção 4).
// -----------------------------------------------------------------------------
export const ALTERNATIVAS = [
  { valor: 1, texto: "Nunca ou quase nunca" },
  { valor: 2, texto: "Raramente" },
  { valor: 3, texto: "Às vezes" },
  { valor: 4, texto: "Frequentemente" },
  { valor: 5, texto: "Quase sempre" },
];

// -----------------------------------------------------------------------------
// As 30 afirmações (spec, seção 5). Cada item:
//   id          → identificador estável (a01..e06)
//   texto       → afirmação exibida ao participante
//   competencia → A..E (interno; NUNCA enviado ao cliente)
// Todas as afirmações são diretas (frequência maior = mais do comportamento);
// não há itens reversos neste instrumento.
// -----------------------------------------------------------------------------
export const ITENS_IE = [
  // COMPETÊNCIA A — Autoconsciência emocional
  { id: "a01", competencia: "A", texto: "Consigo perceber quando meu estado emocional começa a mudar." },
  { id: "a02", competencia: "A", texto: "Identifico quais situações costumam me deixar frustrado." },
  { id: "a03", competencia: "A", texto: "Reconheço quando minhas emoções estão influenciando minhas decisões." },
  { id: "a04", competencia: "A", texto: "Consigo explicar o que estou sentindo em situações difíceis." },
  { id: "a05", competencia: "A", texto: "Percebo quando estou emocionalmente sobrecarregado." },
  { id: "a06", competencia: "A", texto: "Reconheço como meu humor influencia minha maneira de trabalhar." },
  // COMPETÊNCIA B — Autorregulação emocional
  { id: "b01", competencia: "B", texto: "Consigo fazer uma pausa antes de reagir quando estou irritado." },
  { id: "b02", competencia: "B", texto: "Mesmo diante de críticas, procuro responder de maneira respeitosa." },
  { id: "b03", competencia: "B", texto: "Quando fico frustrado, consigo retomar minhas atividades." },
  { id: "b04", competencia: "B", texto: "Evito tomar decisões impulsivas quando estou emocionalmente alterado." },
  { id: "b05", competencia: "B", texto: "Consigo me reorganizar depois de uma situação estressante." },
  { id: "b06", competencia: "B", texto: "Quando discordo de alguém, consigo expressar minha opinião sem perder o controle." },
  // COMPETÊNCIA C — Percepção das emoções alheias
  { id: "c01", competencia: "C", texto: "Percebo quando alguém está desconfortável durante uma conversa." },
  { id: "c02", competencia: "C", texto: "Procuro compreender como outras pessoas podem estar se sentindo." },
  { id: "c03", competencia: "C", texto: "Consigo identificar quando um colega precisa de apoio." },
  { id: "c04", competencia: "C", texto: "Presto atenção ao tom de voz e à expressão das pessoas." },
  { id: "c05", competencia: "C", texto: "Considero o estado emocional do outro antes de abordar assuntos delicados." },
  { id: "c06", competencia: "C", texto: "Percebo quando uma pessoa demonstra preocupação mesmo sem dizer diretamente." },
  // COMPETÊNCIA D — Gestão de relacionamentos
  { id: "d01", competencia: "D", texto: "Procuro esclarecer mal-entendidos antes que se tornem problemas maiores." },
  { id: "d02", competencia: "D", texto: "Consigo conversar sobre divergências sem atacar a outra pessoa." },
  { id: "d03", competencia: "D", texto: "Quando cometo um erro que afeta alguém, procuro reconhecer minha responsabilidade." },
  { id: "d04", competencia: "D", texto: "Consigo oferecer feedback de maneira respeitosa." },
  { id: "d05", competencia: "D", texto: "Busco soluções que considerem as necessidades das pessoas envolvidas." },
  { id: "d06", competencia: "D", texto: "Procuro manter uma comunicação construtiva mesmo em situações de tensão." },
  // COMPETÊNCIA E — Adaptação emocional
  { id: "e01", competencia: "E", texto: "Consigo me adaptar emocionalmente quando os planos mudam." },
  { id: "e02", competencia: "E", texto: "Quando algo não acontece como esperado, procuro identificar alternativas." },
  { id: "e03", competencia: "E", texto: "Consigo continuar trabalhando mesmo diante de alguma incerteza." },
  { id: "e04", competencia: "E", texto: "Depois de uma experiência frustrante, consigo recuperar minha disposição." },
  { id: "e05", competencia: "E", texto: "Procuro aprender com situações que provocaram desconforto." },
  { id: "e06", competencia: "E", texto: "Quando enfrento mudanças importantes, consigo ajustar minhas expectativas." },
];

const ITEM_POR_ID = Object.fromEntries(ITENS_IE.map((i) => [i.id, i]));

// Metadados das competências para o frontend (sem expor nada da chave — a relação
// item → competência não sai daqui).
export function competenciasPublicas() {
  return ORDEM_COMPETENCIAS.map((c) => ({
    chave: COMPETENCIAS_IE[c].chave,
    nome: COMPETENCIAS_IE[c].nome,
    cor: COMPETENCIAS_IE[c].cor,
  }));
}

// Itens públicos: só id + texto, na ordem oficial. Nunca revela a competência
// avaliada (spec, seção 4: "Não exibir a competência durante o preenchimento").
export function itensPublicos() {
  return ITENS_IE.map((i) => ({ id: i.id, texto: i.texto }));
}

function respostaValida(v) {
  return Number.isInteger(v) && v >= 1 && v <= IE_ESCALA;
}

// Saneia um mapa de respostas: mantém só itens conhecidos com valor inteiro 1–5.
// Usado no auto-save (o participante ainda está preenchendo).
export function sanearRespostas(respostas) {
  const limpas = {};
  if (!respostas || typeof respostas !== "object") return limpas;
  for (const [id, valor] of Object.entries(respostas)) {
    const v = Number(valor);
    if (ITEM_POR_ID[id] && respostaValida(v)) limpas[id] = v;
  }
  return limpas;
}

// Número de itens respondidos (para progresso).
export function contarRespondidos(respostas) {
  if (!respostas || typeof respostas !== "object") return 0;
  let n = 0;
  for (const item of ITENS_IE) {
    if (respostaValida(Number(respostas[item.id]))) n += 1;
  }
  return n;
}

// -----------------------------------------------------------------------------
// Validação server-side: todas as 30 afirmações respondidas, cada uma inteiro
// 1–5 (spec, seção 11).
// -----------------------------------------------------------------------------
export function validarRespostas(respostas) {
  if (!respostas || typeof respostas !== "object")
    return { ok: false, codigo: "FORMATO", erro: "Respostas ausentes ou inválidas." };

  const faltando = [];
  for (const item of ITENS_IE) {
    const v = Number(respostas[item.id]);
    if (!respostaValida(v)) faltando.push(item.id);
  }
  if (faltando.length)
    return { ok: false, codigo: "INCOMPLETO", erro: `Faltam ${faltando.length} respostas.`, faltando };

  for (const id of Object.keys(respostas)) {
    if (!ITEM_POR_ID[id])
      return { ok: false, codigo: "ITEM_INVALIDO", erro: `Item desconhecido: ${id}.` };
  }
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Cálculo das cinco competências (spec, seção 6). Para cada competência: SOMA das
// 6 respostas (6–30) e MÉDIA (1–5). NÃO calcula percentis, níveis de inteligência
// emocional nem classificações clínicas. Pressupõe respostas já validadas (ou
// ignora itens inválidos, para progresso).
// -----------------------------------------------------------------------------
export function calcularResultado(respostas) {
  const acc = {};
  for (const c of ORDEM_COMPETENCIAS) acc[c] = { soma: 0, itens: 0 };

  for (const item of ITENS_IE) {
    const v = Number(respostas?.[item.id]);
    if (!respostaValida(v)) continue;
    acc[item.competencia].soma += v;
    acc[item.competencia].itens += 1;
  }

  const competencias = {};
  for (const c of ORDEM_COMPETENCIAS) {
    const { soma, itens } = acc[c];
    competencias[c] = {
      chave: c,
      soma, // 6–30 quando completo
      itens,
      // Média na escala 1–5 (uma casa decimal). Não é percentil nem nível de IE.
      media: itens ? Math.round((soma / itens) * 10) / 10 : 0,
      // Máximo teórico da soma, para desenhar a barra (itens × 5).
      maximo: itens * IE_ESCALA,
    };
  }

  return {
    versao: IE_VERSAO,
    instrumento: IE_INSTRUMENTO,
    idioma: IE_IDIOMA,
    fonte: IE_FONTE,
    chave: IE_CHAVE,
    algoritmo: IE_ALGORITMO,
    escala: IE_ESCALA,
    experimental: IE_EXPERIMENTAL,
    competencias,
  };
}

// Competências em destaque: as de maior média, PRESERVANDO EMPATES (spec, seções
// 6 e 7). Mostra as `n` maiores (padrão 2); se o corte empata com as seguintes,
// todas as empatadas entram. Em empate de média, mantém a ordem de apresentação.
export function competenciasDestaque(resultado, n = 2) {
  const dims = resultado?.competencias || {};
  const ordenado = ORDEM_COMPETENCIAS
    .map((c, i) => ({ chave: c, media: dims[c]?.media || 0, ordem: i }))
    .sort((a, b) => (b.media - a.media) || (a.ordem - b.ordem));
  if (ordenado.length <= n) return ordenado.map((d) => d.chave);
  const corte = ordenado[n - 1].media; // média da n-ésima colocada
  return ordenado.filter((d) => d.media >= corte).map((d) => d.chave);
}

// -----------------------------------------------------------------------------
// Relatório interpretativo DETERMINÍSTICO (sem IA). Cinco competências, cada uma
// com soma, média, descrição e sugestão de desenvolvimento, mais a lista de
// destaques. Textos próprios, descritivos — nunca diagnóstico, nível de IE,
// nota de aprovação ou ranking.
// -----------------------------------------------------------------------------
export function montarRelatorio(resultado) {
  const dims = resultado?.competencias || {};
  const competencias = ORDEM_COMPETENCIAS.map((c) => {
    const meta = COMPETENCIAS_IE[c];
    const r = dims[c] || { soma: 0, media: 0, itens: 0, maximo: 0 };
    return {
      chave: c,
      nome: meta.nome,
      cor: meta.cor,
      soma: r.soma,
      media: r.media,
      maximo: r.maximo,
      descricao: meta.descricao,
      sugestao: meta.sugestao,
    };
  });

  const chavesDestaque = competenciasDestaque(resultado);
  const destaques = chavesDestaque.map((c) => competencias.find((d) => d.chave === c));

  return {
    instrumento: IE_INSTRUMENTO,
    fonte: IE_FONTE,
    experimental: IE_EXPERIMENTAL,
    escala: IE_ESCALA,
    notaGlobal: IE_NOTA_GLOBAL,
    tituloDestaques: IE_TITULO_DESTAQUES,
    destaques,
    competencias,
  };
}

// =============================================================================
// Big Five — Os Cinco Grandes Fatores de Personalidade (IPIP-50)
//
// Instrumento: IPIP Big-Five Factor Markers, versão de 50 itens, do
// International Personality Item Pool (https://ipip.ori.org). Os itens do IPIP
// estão em DOMÍNIO PÚBLICO — a Goldberg (1992) / IPIP permite uso, modificação
// e tradução livres, sem necessidade de permissão. Os 50 itens e a chave de
// correção (quais itens são reversos e a qual fator pertencem) foram conferidos
// item a item contra a fonte oficial.
//
// IDIOMA / TRADUÇÃO (pendência consciente):
//   Os textos em pt-BR aqui são uma tradução de trabalho dos 50 marcadores,
//   feita para a interface. O IPIP referencia uma tradução brasileira (Edilson
//   Pontarolo, UFRGS), mas (a) o próprio IPIP declara que a exatidão das
//   traduções NÃO foi verificada pelo projeto e (b) o arquivo não é
//   disponibilizado publicamente. Portanto NÃO há, hoje, uma tradução brasileira
//   validada + normas confirmadas para esta versão. Por isso:
//     - a avaliação fica sob feature flag (uso interno), não liberada aos
//       profissionais até confirmação (ver BIG5_PENDENCIAS e a flag);
//     - os resultados são apresentados como pontuação BRUTA e MÉDIA (1–5),
//       NUNCA como percentis (não há normas populacionais brasileiras
//       confirmadas para esta versão).
//
// SEGURANÇA / CHAVE: o mapeamento item → fator e o flag de item reverso é a
// "chave" do teste e vive só aqui (servidor). O frontend recebe apenas os itens
// públicos (sem fator/reverso) via `itensPublicos()`. A pontuação SEMPRE usa a
// chave oficial daqui, nunca fatores enviados pelo cliente.
//
// I18N: os identificadores (versão, ids de item, fatores, escala) são ESTÁVEIS
// e independentes de idioma. Só os textos são traduzíveis. Nunca use texto
// traduzido como identificador.
//
// POLO DO NEUROTICISMO: a chave oficial do IPIP-50 pontua o fator como
// "Estabilidade Emocional". A dimensão relatada aqui é Neuroticismo — o polo
// REVERSO da Estabilidade Emocional (matematicamente equivalente). Por isso os
// itens emocionais têm seu `reverso` definido EM RELAÇÃO ao polo Neuroticismo:
// "Fico estressado(a) com facilidade" é direto; "Fico relaxado(a)..." é reverso.
// =============================================================================

export const BIG5_VERSAO = "ipip-bigfive-50-v1";
export const BIG5_INSTRUMENTO = "IPIP Big-Five Factor Markers (50 itens)";
export const BIG5_IDIOMA = "pt-BR";
export const BIG5_FONTE = "International Personality Item Pool (ipip.ori.org) — domínio público";
// Identificador da chave de correção aplicada (conferida contra a fonte oficial).
export const BIG5_CHAVE = "ipip-50-markers-oficial";
export const BIG5_TOTAL = 50;
export const BIG5_ESCALA = 5; // Likert 1–5
export const BIG5_ITENS_POR_FATOR = 10;

// Avaliação experimental até a confirmação da tradução brasileira validada e das
// condições de uso. O rótulo "experimental" sempre acompanha o resultado.
export const BIG5_EXPERIMENTAL = true;

// Pendências que impedem a liberação aos profissionais (ver seção 8 da spec).
export const BIG5_PENDENCIAS = [
  "Tradução pt-BR de trabalho: ainda não validada formalmente contra a versão brasileira publicada do IPIP-50 (Pontarolo/UFRGS, referenciada pelo IPIP, mas de exatidão não verificada e não disponibilizada publicamente).",
  "Sem normas populacionais brasileiras confirmadas para esta versão: resultados são apresentados como pontuação bruta e média (1–5), nunca como percentis.",
  "Revisão interna das interpretações das cinco dimensões antes da liberação.",
];

// Flag de disponibilização. LIGADA por padrão (como o DISC v2): a avaliação
// aparece aos profissionais como instrumento experimental. Desligue com
// BIG5_DISPONIVEL=0. O rótulo "experimental", a privacidade por padrão, a
// ausência de percentis e as pendências (tradução BR validada + normas)
// continuam visíveis ao participante.
export const bigFiveDisponivel = () =>
  String(process.env.BIG5_DISPONIVEL ?? "1").trim() !== "0";

// -----------------------------------------------------------------------------
// As cinco dimensões, na ordem de apresentação do relatório (spec, seção 4).
// `chave` interno estável; conteúdo interpretativo acessível (spec, seção 5),
// sempre descritivo e não-diagnóstico.
// -----------------------------------------------------------------------------
export const ORDEM_DIMENSOES = ["O", "C", "E", "A", "N"];

export const DIMENSOES_BIG5 = {
  O: {
    chave: "O",
    nome: "Abertura à experiência",
    cor: "#318CE7",
    descricao: "Curiosidade, imaginação e interesse por novas experiências, ideias e perspectivas.",
    tendencias: "Pessoas com pontuação mais alta tendem a gostar de novidade, variedade e abstração; pontuações mais baixas costumam indicar preferência por praticidade, rotina e pelo concreto e familiar.",
    desenvolvimento: "Expor-se a áreas novas pode ampliar o repertório; equilibrar exploração com foco e execução ajuda a transformar ideias em entregas.",
    limitacoes: "Alta ou baixa abertura não mede inteligência, criatividade real nem qualidade do trabalho — descreve apenas uma preferência por explorar o novo.",
  },
  C: {
    chave: "C",
    nome: "Conscienciosidade",
    cor: "#318CE7",
    descricao: "Organização, responsabilidade, planejamento e persistência na busca de objetivos.",
    tendencias: "Pontuações mais altas costumam associar-se a método, disciplina e atenção a prazos; mais baixas, a flexibilidade e espontaneidade, por vezes com menos estrutura.",
    desenvolvimento: "Rotinas e metas claras reforçam a constância; cuidar para que o rigor não vire rigidez mantém a adaptabilidade.",
    limitacoes: "A pontuação descreve um estilo de organização, não a competência profissional nem o esforço de uma pessoa em um dia específico.",
  },
  E: {
    chave: "E",
    nome: "Extroversão",
    cor: "#318CE7",
    descricao: "Sociabilidade, energia social, entusiasmo e assertividade no contato com pessoas.",
    tendencias: "Mais alta tende a indicar conforto em interações, iniciativa social e busca de estímulo; mais baixa, preferência por ambientes calmos, reflexão e interações mais seletivas.",
    desenvolvimento: "Quem pontua alto pode treinar escuta e pausas; quem pontua baixo pode exercitar exposição gradual quando o contexto pedir presença social.",
    limitacoes: "Introversão não é timidez nem falta de habilidade social, e extroversão não garante melhor desempenho — são estilos diferentes de obter energia.",
  },
  A: {
    chave: "A",
    nome: "Amabilidade",
    cor: "#318CE7",
    descricao: "Cooperação, consideração, empatia e confiança nas relações interpessoais.",
    tendencias: "Pontuações mais altas costumam refletir cordialidade e disposição a colaborar; mais baixas, um estilo mais direto, questionador ou orientado à tarefa.",
    desenvolvimento: "Equilibrar consideração pelo outro com a defesa dos próprios limites sustenta relações saudáveis nos dois extremos.",
    limitacoes: "A pontuação não mede caráter, honestidade ou valor de uma pessoa — descreve o estilo habitual de se relacionar.",
  },
  N: {
    chave: "N",
    nome: "Neuroticismo",
    cor: "#318CE7",
    // Fator oficial do IPIP-50 é Estabilidade Emocional; aqui relatamos o polo
    // Neuroticismo (reverso), conforme a spec.
    descricao: "Tendência a experimentar emoções negativas e sensibilidade ao estresse. É o polo oposto da estabilidade emocional.",
    tendencias: "Pontuações mais altas podem indicar maior reatividade emocional e preocupação sob pressão; mais baixas, maior serenidade e recuperação diante de contratempos.",
    desenvolvimento: "Práticas de manejo do estresse, sono e apoio social ajudam a lidar com a reatividade; reconhecer gatilhos é um primeiro passo.",
    limitacoes: "NÃO é uma medida de saúde mental, transtorno ou fragilidade. Uma pontuação alta não indica doença, e esta avaliação não substitui avaliação profissional.",
  },
};

// Nota global de interpretação, sempre exibida com o resultado (spec, seção 5).
export const BIG5_NOTA_GLOBAL =
  "Este relatório descreve tendências de personalidade a partir das suas respostas. " +
  "Nenhum traço é um diagnóstico. Os resultados não inferem saúde mental, caráter, " +
  "honestidade nem competência profissional, e não existem traços melhores ou piores. " +
  "Instrumento: IPIP Big-Five Factor Markers (50 itens, domínio público). " +
  "Tradução de trabalho pt-BR, sem normas brasileiras — pontuação apresentada como média de 1 a 5.";

// -----------------------------------------------------------------------------
// Alternativas de resposta (escala de concordância 1–5). `valor` é o
// identificador estável; `texto` é traduzível.
// -----------------------------------------------------------------------------
export const ALTERNATIVAS = [
  { valor: 1, texto: "Discordo totalmente" },
  { valor: 2, texto: "Discordo" },
  { valor: 3, texto: "Nem concordo nem discordo" },
  { valor: 4, texto: "Concordo" },
  { valor: 5, texto: "Concordo totalmente" },
];

// -----------------------------------------------------------------------------
// Os 50 itens, na ordem oficial de aplicação (1→50). Cada item:
//   id       → identificador estável (q01..q50)
//   texto    → tradução de trabalho pt-BR (exibida ao participante)
//   original → marcador IPIP em inglês (proveniência/auditoria)
//   fator    → O | C | E | A | N (interno; nunca enviado ao cliente)
//   reverso  → true quando a pontuação é invertida (6 − resposta) para o fator
//              relatado. Para o fator N, o polo é Neuroticismo.
//
// Conferência (chave oficial IPIP-50, polo relatado):
//   E +: 1,11,21,31,41   E −: 6,16,26,36,46
//   A +: 7,17,27,37,42,47 A −: 2,12,22,32
//   C +: 3,13,23,33,43,48 C −: 8,18,28,38
//   O +: 5,15,25,35,40,45,50 O −: 10,20,30
//   N (reverso de Estab. Emocional) direto: 4,14,24,29,34,39,44,49  reverso: 9,19
// -----------------------------------------------------------------------------
export const ITENS_BIG5 = [
  { id: "q01", fator: "E", reverso: false, original: "Am the life of the party", texto: "Sou a alma da festa." },
  { id: "q02", fator: "A", reverso: true,  original: "Feel little concern for others", texto: "Me importo pouco com os outros." },
  { id: "q03", fator: "C", reverso: false, original: "Am always prepared", texto: "Estou sempre preparado(a)." },
  { id: "q04", fator: "N", reverso: false, original: "Get stressed out easily", texto: "Fico estressado(a) com facilidade." },
  { id: "q05", fator: "O", reverso: false, original: "Have a rich vocabulary", texto: "Tenho um vocabulário rico." },
  { id: "q06", fator: "E", reverso: true,  original: "Don't talk a lot", texto: "Não falo muito." },
  { id: "q07", fator: "A", reverso: false, original: "Am interested in people", texto: "Me interesso pelas pessoas." },
  { id: "q08", fator: "C", reverso: true,  original: "Leave my belongings around", texto: "Deixo meus pertences espalhados por aí." },
  { id: "q09", fator: "N", reverso: true,  original: "Am relaxed most of the time", texto: "Fico relaxado(a) a maior parte do tempo." },
  { id: "q10", fator: "O", reverso: true,  original: "Have difficulty understanding abstract ideas", texto: "Tenho dificuldade para entender ideias abstratas." },
  { id: "q11", fator: "E", reverso: false, original: "Feel comfortable around people", texto: "Me sinto à vontade perto das pessoas." },
  { id: "q12", fator: "A", reverso: true,  original: "Insult people", texto: "Insulto as pessoas." },
  { id: "q13", fator: "C", reverso: false, original: "Pay attention to details", texto: "Presto atenção aos detalhes." },
  { id: "q14", fator: "N", reverso: false, original: "Worry about things", texto: "Me preocupo com as coisas." },
  { id: "q15", fator: "O", reverso: false, original: "Have a vivid imagination", texto: "Tenho uma imaginação vívida." },
  { id: "q16", fator: "E", reverso: true,  original: "Keep in the background", texto: "Fico em segundo plano." },
  { id: "q17", fator: "A", reverso: false, original: "Sympathize with others' feelings", texto: "Me solidarizo com os sentimentos dos outros." },
  { id: "q18", fator: "C", reverso: true,  original: "Make a mess of things", texto: "Faço bagunça das coisas." },
  { id: "q19", fator: "N", reverso: true,  original: "Seldom feel blue", texto: "Raramente fico para baixo." },
  { id: "q20", fator: "O", reverso: true,  original: "Am not interested in abstract ideas", texto: "Não me interesso por ideias abstratas." },
  { id: "q21", fator: "E", reverso: false, original: "Start conversations", texto: "Inicio conversas." },
  { id: "q22", fator: "A", reverso: true,  original: "Am not interested in other people's problems", texto: "Não me interesso pelos problemas das outras pessoas." },
  { id: "q23", fator: "C", reverso: false, original: "Get chores done right away", texto: "Faço minhas tarefas de imediato." },
  { id: "q24", fator: "N", reverso: false, original: "Am easily disturbed", texto: "Me perturbo com facilidade." },
  { id: "q25", fator: "O", reverso: false, original: "Have excellent ideas", texto: "Tenho ótimas ideias." },
  { id: "q26", fator: "E", reverso: true,  original: "Have little to say", texto: "Tenho pouco a dizer." },
  { id: "q27", fator: "A", reverso: false, original: "Have a soft heart", texto: "Tenho um coração mole." },
  { id: "q28", fator: "C", reverso: true,  original: "Often forget to put things back in their proper place", texto: "Costumo esquecer de colocar as coisas de volta no lugar." },
  { id: "q29", fator: "N", reverso: false, original: "Get upset easily", texto: "Fico chateado(a) com facilidade." },
  { id: "q30", fator: "O", reverso: true,  original: "Do not have a good imagination", texto: "Não tenho uma boa imaginação." },
  { id: "q31", fator: "E", reverso: false, original: "Talk to a lot of different people at parties", texto: "Converso com muitas pessoas diferentes nas festas." },
  { id: "q32", fator: "A", reverso: true,  original: "Am not really interested in others", texto: "Não me interesso de verdade pelos outros." },
  { id: "q33", fator: "C", reverso: false, original: "Like order", texto: "Gosto de ordem." },
  { id: "q34", fator: "N", reverso: false, original: "Change my mood a lot", texto: "Mudo muito de humor." },
  { id: "q35", fator: "O", reverso: false, original: "Am quick to understand things", texto: "Entendo as coisas rapidamente." },
  { id: "q36", fator: "E", reverso: true,  original: "Don't like to draw attention to myself", texto: "Não gosto de chamar atenção para mim." },
  { id: "q37", fator: "A", reverso: false, original: "Take time out for others", texto: "Reservo tempo para os outros." },
  { id: "q38", fator: "C", reverso: true,  original: "Shirk my duties", texto: "Fujo das minhas obrigações." },
  { id: "q39", fator: "N", reverso: false, original: "Have frequent mood swings", texto: "Tenho oscilações de humor frequentes." },
  { id: "q40", fator: "O", reverso: false, original: "Use difficult words", texto: "Uso palavras difíceis." },
  { id: "q41", fator: "E", reverso: false, original: "Don't mind being the center of attention", texto: "Não me incomodo de ser o centro das atenções." },
  { id: "q42", fator: "A", reverso: false, original: "Feel others' emotions", texto: "Sinto as emoções das outras pessoas." },
  { id: "q43", fator: "C", reverso: false, original: "Follow a schedule", texto: "Sigo uma rotina planejada." },
  { id: "q44", fator: "N", reverso: false, original: "Get irritated easily", texto: "Me irrito com facilidade." },
  { id: "q45", fator: "O", reverso: false, original: "Spend time reflecting on things", texto: "Passo um tempo refletindo sobre as coisas." },
  { id: "q46", fator: "E", reverso: true,  original: "Am quiet around strangers", texto: "Fico quieto(a) perto de estranhos." },
  { id: "q47", fator: "A", reverso: false, original: "Make people feel at ease", texto: "Faço as pessoas se sentirem à vontade." },
  { id: "q48", fator: "C", reverso: false, original: "Am exacting in my work", texto: "Sou rigoroso(a) no meu trabalho." },
  { id: "q49", fator: "N", reverso: false, original: "Often feel blue", texto: "Costumo me sentir para baixo." },
  { id: "q50", fator: "O", reverso: false, original: "Am full of ideas", texto: "Sou cheio(a) de ideias." },
];

const ITEM_POR_ID = Object.fromEntries(ITENS_BIG5.map((i) => [i.id, i]));

// Metadados das dimensões para o frontend (sem expor nada da chave de resposta —
// fator/reverso dos itens não saem daqui).
export function dimensoesPublicas() {
  return ORDEM_DIMENSOES.map((d) => ({
    chave: DIMENSOES_BIG5[d].chave,
    nome: DIMENSOES_BIG5[d].nome,
    cor: DIMENSOES_BIG5[d].cor,
    descricao: DIMENSOES_BIG5[d].descricao,
  }));
}

// Itens públicos: só id + texto, na ordem oficial. Nunca revela o fator avaliado
// (spec, seção 2: "Não mostrar a dimensão avaliada durante as perguntas").
export function itensPublicos() {
  return ITENS_BIG5.map((i) => ({ id: i.id, texto: i.texto }));
}

function respostaValida(v) {
  return Number.isInteger(v) && v >= 1 && v <= BIG5_ESCALA;
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
  for (const item of ITENS_BIG5) {
    if (respostaValida(Number(respostas[item.id]))) n += 1;
  }
  return n;
}

// -----------------------------------------------------------------------------
// Validação server-side: todos os 50 itens respondidos, cada um inteiro 1–5.
// -----------------------------------------------------------------------------
export function validarRespostas(respostas) {
  if (!respostas || typeof respostas !== "object")
    return { ok: false, codigo: "FORMATO", erro: "Respostas ausentes ou inválidas." };

  const faltando = [];
  for (const item of ITENS_BIG5) {
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
// Cálculo das cinco dimensões. Respeita itens reversos (6 − resposta) por item,
// segundo a chave oficial. Produz pontuação BRUTA (soma) e MÉDIA por dimensão.
// NÃO calcula percentis (não há normas brasileiras confirmadas).
// Pressupõe respostas já validadas (ou ignora itens inválidos, para progresso).
// -----------------------------------------------------------------------------
export function calcularResultado(respostas) {
  const acc = {};
  for (const d of ORDEM_DIMENSOES) acc[d] = { bruto: 0, itens: 0 };

  for (const item of ITENS_BIG5) {
    const v = Number(respostas?.[item.id]);
    if (!respostaValida(v)) continue;
    const corrigida = item.reverso ? (BIG5_ESCALA + 1) - v : v; // 6 − resposta
    acc[item.fator].bruto += corrigida;
    acc[item.fator].itens += 1;
  }

  const dimensoes = {};
  for (const d of ORDEM_DIMENSOES) {
    const { bruto, itens } = acc[d];
    dimensoes[d] = {
      chave: d,
      bruto,
      itens,
      // Média na escala 1–5 (duas casas). Não é percentil.
      media: itens ? Math.round((bruto / itens) * 100) / 100 : 0,
      // Máximo teórico da soma, para desenhar a barra (itens × 5).
      maximo: itens * BIG5_ESCALA,
    };
  }

  return {
    versao: BIG5_VERSAO,
    instrumento: BIG5_INSTRUMENTO,
    idioma: BIG5_IDIOMA,
    fonte: BIG5_FONTE,
    chave: BIG5_CHAVE,
    escala: BIG5_ESCALA,
    experimental: BIG5_EXPERIMENTAL,
    dimensoes,
  };
}

// Banda qualitativa da MÉDIA (1–5), descritiva e não-ordinal — NÃO é percentil
// nem ranking. Só ajuda a ler a barra em linguagem acessível.
export function bandaMedia(media) {
  if (media >= 3.5) return { chave: "alta", rotulo: "Tendência mais alta" };
  if (media >= 2.5) return { chave: "media", rotulo: "Tendência intermediária" };
  return { chave: "baixa", rotulo: "Tendência mais baixa" };
}

// -----------------------------------------------------------------------------
// Relatório interpretativo DETERMINÍSTICO (sem IA). Cinco dimensões, cada uma
// com pontuação, explicação, tendências, desenvolvimento e limitações. Textos
// próprios, sempre descritivos — nunca diagnóstico, nunca ranking.
// -----------------------------------------------------------------------------
export function montarRelatorio(resultado) {
  const dims = resultado?.dimensoes || {};
  const dimensoes = ORDEM_DIMENSOES.map((d) => {
    const meta = DIMENSOES_BIG5[d];
    const r = dims[d] || { bruto: 0, media: 0, itens: 0, maximo: 0 };
    return {
      chave: d,
      nome: meta.nome,
      cor: meta.cor,
      bruto: r.bruto,
      media: r.media,
      maximo: r.maximo,
      banda: bandaMedia(r.media),
      descricao: meta.descricao,
      tendencias: meta.tendencias,
      desenvolvimento: meta.desenvolvimento,
      limitacoes: meta.limitacoes,
    };
  });

  return {
    instrumento: BIG5_INSTRUMENTO,
    fonte: BIG5_FONTE,
    experimental: BIG5_EXPERIMENTAL,
    escala: BIG5_ESCALA,
    notaGlobal: BIG5_NOTA_GLOBAL,
    dimensoes,
  };
}

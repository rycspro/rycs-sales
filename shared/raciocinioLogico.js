// =============================================================================
// Raciocínio Lógico e Analítico — avaliação AUTORAL de competência (RYCS).
//
// 20 questões objetivas, 4 alternativas, UMA resposta correta. Quatro
// competências de 5 questões cada: raciocínio numérico, padrões e sequências,
// dedução lógica e interpretação analítica.
//
// NÃO é teste de QI nem medida psicométrica validada de inteligência. O
// percentual de acertos é desempenho NESTE conjunto específico de questões.
// Não há percentil populacional, classificação psicométrica ou faixa de
// "inteligência".
//
// SEGURANÇA: o gabarito (`correta`) e as explicações vivem só no servidor. O
// frontend recebe apenas os itens públicos (enunciado + alternativas) via
// `itensPublicos()`, sem a resposta correta. A correção SEMPRE usa o gabarito
// oficial daqui, nunca algo enviado pelo cliente.
//
// I18N: identificadores (versão, ids de questão/alternativa, competências) são
// ESTÁVEIS. Alternativas usam ids "A".."D" (rótulos da spec), independentes de
// idioma. Nunca use texto como identificador de resposta.
// =============================================================================

export const RL_VERSAO = "rycs-raciocinio-logico-v1-20";
export const RL_INSTRUMENTO = "Raciocínio Lógico e Analítico (RYCS, autoral)";
export const RL_IDIOMA = "pt-BR";
export const RL_FONTE = "Instrumento autoral RYCS";
export const RL_CHAVE = "rycs-rl-gabarito-v1";   // versão do gabarito
export const RL_ALGORITMO = "acertos-v1";
export const RL_TOTAL = 20;
export const RL_EXPERIMENTAL = true;

export const RL_PENDENCIAS = [
  "Avaliação autoral de desempenho: não é teste de QI nem medida psicométrica validada de inteligência.",
  "O percentual de acertos reflete este conjunto específico de questões; não é certificação geral de capacidade analítica nem percentil populacional.",
];

// Flag de disponibilização. LIGADA por padrão (como as demais avaliações já
// publicadas). Desligue com RACIOCINIO_DISPONIVEL=0 para revisão interna.
export const raciocinioDisponivel = () =>
  String(process.env.RACIOCINIO_DISPONIVEL ?? "1").trim() !== "0";

// -----------------------------------------------------------------------------
// As quatro competências, na ordem de apresentação. Conteúdo descritivo, sem
// atribuir características psicológicas ao profissional.
// -----------------------------------------------------------------------------
export const ORDEM_COMPETENCIAS = ["numerico", "padroes", "deducao", "interpretacao"];

export const COMPETENCIAS = {
  numerico: {
    chave: "numerico",
    nome: "Raciocínio numérico",
    cor: "#318CE7",
    descricao: "Cálculos, porcentagens, proporções e operações aplicadas a situações de trabalho.",
  },
  padroes: {
    chave: "padroes",
    nome: "Padrões e sequências",
    cor: "#318CE7",
    descricao: "Identificação de regularidades em sequências numéricas e alfabéticas.",
  },
  deducao: {
    chave: "deducao",
    nome: "Dedução lógica",
    cor: "#318CE7",
    descricao: "Conclusões que decorrem de premissas, incluindo contraposição e ordenação.",
  },
  interpretacao: {
    chave: "interpretacao",
    nome: "Interpretação analítica",
    cor: "#318CE7",
    descricao: "Leitura de dados, médias, taxas de conversão e comparação de desempenho.",
  },
};

export const RL_NOTA_GLOBAL =
  "O percentual de acertos é uma medida de desempenho neste conjunto específico de questões, " +
  "não um teste de QI, certificação de capacidade analítica ou classificação psicométrica. " +
  "Avaliação autoral RYCS, voluntária e de uso em desenvolvimento profissional.";

// -----------------------------------------------------------------------------
// Banco de questões (v1). Cada item:
//   id          → q01..q20 (estável)
//   competencia → numerico | padroes | deducao | interpretacao
//   enunciado   → texto da questão (traduzível)
//   alternativas→ [{ id: "A".."D", texto }]
//   correta     → id da alternativa correta (SÓ SERVIDOR)
//   explicacao  → justificativa (SÓ SERVIDOR; revelada só na revisão pós-conclusão)
// Gabarito conferido item a item contra o cálculo de cada questão.
// -----------------------------------------------------------------------------
export const ITENS_RL = [
  // ---- Competência 1: raciocínio numérico (q01–q05) ----
  {
    id: "q01", competencia: "numerico",
    enunciado: "Uma empresa realizou 120 atendimentos na segunda-feira e 150 na terça-feira. Qual foi o aumento percentual?",
    alternativas: [
      { id: "A", texto: "20%" }, { id: "B", texto: "25%" }, { id: "C", texto: "30%" }, { id: "D", texto: "35%" },
    ],
    correta: "B",
    explicacao: "(150 − 120) / 120 × 100 = 25%.",
  },
  {
    id: "q02", competencia: "numerico",
    enunciado: "Um profissional recebe R$ 40 por tarefa concluída. Se realizar 18 tarefas, quanto receberá?",
    alternativas: [
      { id: "A", texto: "R$ 680" }, { id: "B", texto: "R$ 700" }, { id: "C", texto: "R$ 720" }, { id: "D", texto: "R$ 760" },
    ],
    correta: "C",
    explicacao: "40 × 18 = 720.",
  },
  {
    id: "q03", competencia: "numerico",
    enunciado: "Uma equipe concluiu 60 tarefas em 5 dias, mantendo o mesmo ritmo diário. Quantas tarefas concluirá em 8 dias?",
    alternativas: [
      { id: "A", texto: "84" }, { id: "B", texto: "90" }, { id: "C", texto: "96" }, { id: "D", texto: "108" },
    ],
    correta: "C",
    explicacao: "60 / 5 = 12 tarefas por dia; 12 × 8 = 96.",
  },
  {
    id: "q04", competencia: "numerico",
    enunciado: "Um produto custa R$ 200 e recebe um desconto de 15%. Qual será o preço final?",
    alternativas: [
      { id: "A", texto: "R$ 160" }, { id: "B", texto: "R$ 170" }, { id: "C", texto: "R$ 175" }, { id: "D", texto: "R$ 185" },
    ],
    correta: "B",
    explicacao: "15% de 200 = 30; 200 − 30 = 170.",
  },
  {
    id: "q05", competencia: "numerico",
    enunciado: "A média de quatro resultados é 18. Três deles são 12, 20 e 16. Qual é o quarto resultado?",
    alternativas: [
      { id: "A", texto: "22" }, { id: "B", texto: "24" }, { id: "C", texto: "26" }, { id: "D", texto: "28" },
    ],
    correta: "B",
    explicacao: "18 × 4 = 72; 72 − (12 + 20 + 16) = 24.",
  },

  // ---- Competência 2: padrões e sequências (q06–q10) ----
  {
    id: "q06", competencia: "padroes",
    enunciado: "Qual número completa a sequência? 2, 4, 8, 16, ?",
    alternativas: [
      { id: "A", texto: "24" }, { id: "B", texto: "30" }, { id: "C", texto: "32" }, { id: "D", texto: "36" },
    ],
    correta: "C",
    explicacao: "Cada número é o dobro do anterior.",
  },
  {
    id: "q07", competencia: "padroes",
    enunciado: "Qual número completa a sequência? 3, 6, 11, 18, 27, ?",
    alternativas: [
      { id: "A", texto: "36" }, { id: "B", texto: "38" }, { id: "C", texto: "40" }, { id: "D", texto: "42" },
    ],
    correta: "B",
    explicacao: "As diferenças são 3, 5, 7, 9 e 11; 27 + 11 = 38.",
  },
  {
    id: "q08", competencia: "padroes",
    enunciado: "Qual letra completa a sequência? A, C, F, J, O, ?",
    alternativas: [
      { id: "A", texto: "S" }, { id: "B", texto: "T" }, { id: "C", texto: "U" }, { id: "D", texto: "V" },
    ],
    correta: "C",
    explicacao: "Os avanços no alfabeto são de 2, 3, 4, 5 e 6 posições; de O chega-se a U.",
  },
  {
    id: "q09", competencia: "padroes",
    enunciado: "Qual número completa a sequência? 81, 27, 9, 3, ?",
    alternativas: [
      { id: "A", texto: "0" }, { id: "B", texto: "1" }, { id: "C", texto: "2" }, { id: "D", texto: "3" },
    ],
    correta: "B",
    explicacao: "Cada número é dividido por 3.",
  },
  {
    id: "q10", competencia: "padroes",
    enunciado: "Qual número completa a sequência? 1, 4, 9, 16, 25, ?",
    alternativas: [
      { id: "A", texto: "30" }, { id: "B", texto: "35" }, { id: "C", texto: "36" }, { id: "D", texto: "49" },
    ],
    correta: "C",
    explicacao: "A sequência apresenta os quadrados de 1, 2, 3, 4, 5 e 6.",
  },

  // ---- Competência 3: dedução lógica (q11–q15) ----
  {
    id: "q11", competencia: "deducao",
    enunciado: "Todos os analistas da equipe utilizam o sistema A. Marina é analista dessa equipe. O que podemos concluir?",
    alternativas: [
      { id: "A", texto: "Marina utiliza o sistema A." },
      { id: "B", texto: "Marina utiliza somente o sistema A." },
      { id: "C", texto: "Todos que utilizam o sistema A são analistas." },
      { id: "D", texto: "Marina administra o sistema A." },
    ],
    correta: "A",
    explicacao: "A conclusão decorre diretamente das premissas.",
  },
  {
    id: "q12", competencia: "deducao",
    enunciado: "Se uma tarefa é urgente, ela recebe prioridade máxima. A tarefa X não recebeu prioridade máxima. O que podemos concluir, considerando a regra apresentada?",
    alternativas: [
      { id: "A", texto: "A tarefa X é urgente." },
      { id: "B", texto: "A tarefa X não é urgente." },
      { id: "C", texto: "A tarefa X foi concluída." },
      { id: "D", texto: "Não é possível saber se X é urgente." },
    ],
    correta: "B",
    explicacao: "Pela contraposição: se toda tarefa urgente recebe prioridade máxima, a ausência dessa prioridade implica que ela não é urgente.",
  },
  {
    id: "q13", competencia: "deducao",
    enunciado: "Nenhum projeto encerrado aceita novas alterações. O projeto Alfa aceita novas alterações. O que podemos concluir?",
    alternativas: [
      { id: "A", texto: "Alfa está encerrado." },
      { id: "B", texto: "Alfa não está encerrado." },
      { id: "C", texto: "Alfa será encerrado amanhã." },
      { id: "D", texto: "Todos os projetos aceitam alterações." },
    ],
    correta: "B",
    explicacao: "Um projeto encerrado não aceita alterações; como Alfa aceita, não está encerrado.",
  },
  {
    id: "q14", competencia: "deducao",
    enunciado: "Alguns profissionais da empresa trabalham remotamente. Todos os profissionais remotos utilizam uma ferramenta de comunicação. Qual conclusão é necessariamente verdadeira?",
    alternativas: [
      { id: "A", texto: "Todos os profissionais utilizam a ferramenta." },
      { id: "B", texto: "Nenhum profissional presencial utiliza a ferramenta." },
      { id: "C", texto: "Alguns profissionais da empresa utilizam a ferramenta." },
      { id: "D", texto: "Todos os profissionais trabalham remotamente." },
    ],
    correta: "C",
    explicacao: "Os profissionais remotos mencionados utilizam a ferramenta; logo, alguns profissionais da empresa a utilizam.",
  },
  {
    id: "q15", competencia: "deducao",
    enunciado: "Ana chegou antes de Bruno. Bruno chegou antes de Carlos. Quem chegou primeiro entre os três?",
    alternativas: [
      { id: "A", texto: "Ana" }, { id: "B", texto: "Bruno" }, { id: "C", texto: "Carlos" },
      { id: "D", texto: "Não é possível determinar." },
    ],
    correta: "A",
    explicacao: "Ana chegou antes de Bruno, que chegou antes de Carlos.",
  },

  // ---- Competência 4: interpretação analítica (q16–q20) ----
  {
    id: "q16", competencia: "interpretacao",
    enunciado: "Uma equipe registrou — Segunda: 12 tarefas; Terça: 18; Quarta: 15; Quinta: 20; Sexta: 15. Qual foi a média diária?",
    alternativas: [
      { id: "A", texto: "15" }, { id: "B", texto: "16" }, { id: "C", texto: "17" }, { id: "D", texto: "18" },
    ],
    correta: "B",
    explicacao: "(12 + 18 + 15 + 20 + 15) / 5 = 16.",
  },
  {
    id: "q17", competencia: "interpretacao",
    enunciado: "Uma empresa recebeu 200 contatos. Desses, 50 avançaram para uma reunião. Qual foi a taxa de conversão de contatos em reuniões?",
    alternativas: [
      { id: "A", texto: "15%" }, { id: "B", texto: "20%" }, { id: "C", texto: "25%" }, { id: "D", texto: "30%" },
    ],
    correta: "C",
    explicacao: "50 / 200 × 100 = 25%.",
  },
  {
    id: "q18", competencia: "interpretacao",
    enunciado: "Resultados — Equipe A: 40 tarefas em 8 horas; Equipe B: 36 tarefas em 6 horas; Equipe C: 42 tarefas em 7 horas. Qual alternativa é correta?",
    alternativas: [
      { id: "A", texto: "A equipe A teve a maior produtividade por hora." },
      { id: "B", texto: "A equipe B teve produtividade por hora maior que a equipe C." },
      { id: "C", texto: "As equipes B e C tiveram a mesma produtividade por hora." },
      { id: "D", texto: "A equipe C teve produtividade por hora menor que a equipe A." },
    ],
    correta: "C",
    explicacao: "A = 40/8 = 5 tarefas/hora; B = 36/6 = 6; C = 42/7 = 6. B e C são iguais.",
  },
  {
    id: "q19", competencia: "interpretacao",
    enunciado: "Um relatório mostra — Janeiro: R$ 10.000; Fevereiro: R$ 12.000; Março: R$ 15.000. Qual foi o crescimento percentual de janeiro para março?",
    alternativas: [
      { id: "A", texto: "30%" }, { id: "B", texto: "40%" }, { id: "C", texto: "50%" }, { id: "D", texto: "60%" },
    ],
    correta: "C",
    explicacao: "(15.000 − 10.000) / 10.000 × 100 = 50%.",
  },
  {
    id: "q20", competencia: "interpretacao",
    enunciado: "Uma equipe possui 10 profissionais. Cada um pode concluir até 8 tarefas por dia. Se todos trabalharem na capacidade máxima, qual será a produção diária?",
    alternativas: [
      { id: "A", texto: "60 tarefas" }, { id: "B", texto: "70 tarefas" }, { id: "C", texto: "80 tarefas" }, { id: "D", texto: "100 tarefas" },
    ],
    correta: "C",
    explicacao: "10 × 8 = 80.",
  },
];

const ITEM_POR_ID = Object.fromEntries(ITENS_RL.map((i) => [i.id, i]));
const OPCOES_VALIDAS = Object.fromEntries(
  ITENS_RL.map((i) => [i.id, new Set(i.alternativas.map((a) => a.id))])
);

// Metadados das competências para o frontend (sem gabarito).
export function competenciasPublicas() {
  return ORDEM_COMPETENCIAS.map((c) => ({
    chave: COMPETENCIAS[c].chave,
    nome: COMPETENCIAS[c].nome,
    cor: COMPETENCIAS[c].cor,
    descricao: COMPETENCIAS[c].descricao,
  }));
}

// Itens públicos: enunciado + alternativas (id + texto), SEM `correta` nem
// `explicacao`. Na ordem oficial. É isto que o cliente recebe para responder.
export function itensPublicos() {
  return ITENS_RL.map((i) => ({
    id: i.id,
    competencia: i.competencia,
    enunciado: i.enunciado,
    alternativas: i.alternativas.map((a) => ({ id: a.id, texto: a.texto })),
  }));
}

function respostaValida(id, valor) {
  return typeof valor === "string" && OPCOES_VALIDAS[id]?.has(valor);
}

// Saneia um mapa de respostas: mantém só questões conhecidas com alternativa
// válida. Usado no auto-save (o participante ainda está preenchendo).
export function sanearRespostas(respostas) {
  const limpas = {};
  if (!respostas || typeof respostas !== "object") return limpas;
  for (const [id, valor] of Object.entries(respostas)) {
    if (respostaValida(id, valor)) limpas[id] = valor;
  }
  return limpas;
}

// Número de questões respondidas (para progresso).
export function contarRespondidos(respostas) {
  if (!respostas || typeof respostas !== "object") return 0;
  let n = 0;
  for (const item of ITENS_RL) {
    if (respostaValida(item.id, respostas[item.id])) n += 1;
  }
  return n;
}

// Validação server-side: todas as 20 questões respondidas com alternativa válida.
export function validarRespostas(respostas) {
  if (!respostas || typeof respostas !== "object")
    return { ok: false, codigo: "FORMATO", erro: "Respostas ausentes ou inválidas." };

  const faltando = [];
  for (const item of ITENS_RL) {
    if (!respostaValida(item.id, respostas[item.id])) faltando.push(item.id);
  }
  if (faltando.length)
    return { ok: false, codigo: "INCOMPLETO", erro: `Faltam ${faltando.length} respostas.`, faltando };

  for (const id of Object.keys(respostas)) {
    if (!ITEM_POR_ID[id])
      return { ok: false, codigo: "ITEM_INVALIDO", erro: `Questão desconhecida: ${id}.` };
  }
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Correção: compara cada resposta com o gabarito oficial. Pontuação por
// competência (0–5), total de acertos (0–20) e percentual. Sem percentil/QI.
// -----------------------------------------------------------------------------
export function calcularResultado(respostas) {
  const comp = {};
  for (const c of ORDEM_COMPETENCIAS) comp[c] = { acertos: 0, total: 0 };

  let acertosTotais = 0;
  for (const item of ITENS_RL) {
    comp[item.competencia].total += 1;
    if (respostas?.[item.id] === item.correta) {
      comp[item.competencia].acertos += 1;
      acertosTotais += 1;
    }
  }

  const competencias = {};
  for (const c of ORDEM_COMPETENCIAS) {
    const { acertos, total } = comp[c];
    competencias[c] = {
      chave: c,
      acertos,
      total,
      percentual: total ? Math.round((acertos / total) * 100) : 0,
    };
  }

  return {
    versao: RL_VERSAO,
    chave: RL_CHAVE,
    algoritmo: RL_ALGORITMO,
    totalQuestoes: RL_TOTAL,
    acertosTotais,
    percentual: Math.round((acertosTotais / RL_TOTAL) * 100),
    competencias,
  };
}

// -----------------------------------------------------------------------------
// Relatório pós-conclusão: cartões por competência, análise (áreas mais fortes
// e a desenvolver, sem rótulos psicológicos) e REVISÃO questão a questão com a
// resposta correta e a explicação. Só é chamado após a conclusão.
// -----------------------------------------------------------------------------
export function montarRelatorio(resultado, respostas = {}) {
  const comps = resultado?.competencias || {};
  const competencias = ORDEM_COMPETENCIAS.map((c) => {
    const meta = COMPETENCIAS[c];
    const r = comps[c] || { acertos: 0, total: 5, percentual: 0 };
    return { chave: c, nome: meta.nome, cor: meta.cor, descricao: meta.descricao, acertos: r.acertos, total: r.total, percentual: r.percentual };
  });

  const maxAcertos = Math.max(...competencias.map((c) => c.acertos));
  const minAcertos = Math.min(...competencias.map((c) => c.acertos));
  // Só destaca "a desenvolver" quando há variação real entre competências.
  const fortes = competencias.filter((c) => c.acertos === maxAcertos).map((c) => c.nome);
  const desenvolver = maxAcertos !== minAcertos
    ? competencias.filter((c) => c.acertos === minAcertos).map((c) => c.nome)
    : [];

  const revisao = ITENS_RL.map((item, i) => ({
    id: item.id,
    numero: i + 1,
    competencia: item.competencia,
    competenciaNome: COMPETENCIAS[item.competencia].nome,
    enunciado: item.enunciado,
    alternativas: item.alternativas.map((a) => ({ id: a.id, texto: a.texto })),
    selecionada: respostas?.[item.id] ?? null,
    correta: item.correta,
    acertou: respostas?.[item.id] === item.correta,
    explicacao: item.explicacao,
  }));

  return {
    instrumento: RL_INSTRUMENTO,
    fonte: RL_FONTE,
    experimental: RL_EXPERIMENTAL,
    notaGlobal: RL_NOTA_GLOBAL,
    acertosTotais: resultado?.acertosTotais ?? 0,
    totalQuestoes: resultado?.totalQuestoes ?? RL_TOTAL,
    percentual: resultado?.percentual ?? 0,
    competencias,
    analise: { fortes, desenvolver },
    revisao,
  };
}

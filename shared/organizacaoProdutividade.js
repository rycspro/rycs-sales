// =============================================================================
// Organização e Produtividade — avaliação situacional autoral RYCS (20 situações)
//
// Avaliação de DESEMPENHO (não autorrelato): 20 situações práticas, 4
// alternativas cada, UMA resposta preferencial fundamentada em critérios de
// organização e gestão do trabalho. 5 competências × 4 questões. Mede como o
// profissional identifica estratégias adequadas de planejamento, gestão do
// tempo, priorização, atenção aos detalhes e acompanhamento de entregas NOS
// CENÁRIOS apresentados — não a produtividade real.
//
// NATUREZA (importante): instrumento AUTORAL da RYCS. NÃO é psicométrico
// validado, NÃO é certificação, NÃO é medida de produtividade real. Resultado =
// acertos e percentual nos cenários. Não deve ser usado isoladamente para
// decisões automatizadas de contratação.
//
// SEGURANÇA / GABARITO: a resposta preferencial e a justificativa são a "chave"
// do teste e vivem só aqui (servidor). Durante o preenchimento o cliente recebe
// apenas enunciado + alternativas (sem `correta`/`justificativa`) via
// `itensPublicos()`. A correção é SEMPRE no servidor; a revisão (com gabarito) só
// é liberada DEPOIS da conclusão.
//
// I18N: identificadores (versão, ids de questão/alternativa, competências) são
// ESTÁVEIS e independentes de idioma. Só os textos são traduzíveis.
// =============================================================================

export const ORG_VERSAO = "rycs-organizacao-produtividade-v1-20";
export const ORG_INSTRUMENTO = "RYCS — Organização e Produtividade (20 situações)";
export const ORG_IDIOMA = "pt-BR";
export const ORG_FONTE = "Avaliação situacional autoral RYCS de organização e produtividade";
// Versão do gabarito (spec, seção 11) — persistida junto à tentativa.
export const ORG_GABARITO_VERSAO = "rycs-organizacao-gabarito-v1";
export const ORG_ALGORITMO = "acertos-v1";
export const ORG_TOTAL = 20;
export const ORG_ALTERNATIVAS_POR_QUESTAO = 4;
export const ORG_QUESTOES_POR_COMPETENCIA = 4;

// Experimental: o rótulo acompanha o resultado enquanto houver revisão interna.
export const ORG_EXPERIMENTAL = true;

// Pendências de revisão (spec, seções 8 e 12).
export const ORG_PENDENCIAS = [
  "Revisão interna dos cenários e alternativas antes da publicação — garantir clareza e ausência de ambiguidades relevantes.",
  "Instrumento autoral, não psicométrico: o percentual reflete acertos nos cenários apresentados, não uma medida de produtividade real.",
  "Revisão interna dos textos de desenvolvimento das cinco competências.",
];

// Alternativas identificadas por letra estável.
export const ALTERNATIVA_IDS = ["A", "B", "C", "D"];

// Flag de disponibilização. LIGADA por padrão (liberada aos profissionais).
// Pode ser desligada com ORGANIZACAO_DISPONIVEL=0 (ex.: pausar para revisão), e
// segue ligada em ambiente beta — ver a rota.
export const organizacaoDisponivel = () =>
  String(process.env.ORGANIZACAO_DISPONIVEL ?? "1").trim() !== "0";

// -----------------------------------------------------------------------------
// As cinco competências, na ordem do relatório. `chave` interno estável; cor é
// variação discreta do azul institucional. `descricao` + `sugestao` (spec,
// seção 7).
// -----------------------------------------------------------------------------
export const ORDEM_COMPETENCIAS = ["planejamento", "tempo", "priorizacao", "detalhes", "acompanhamento"];

export const COMPETENCIAS_ORG = {
  planejamento: {
    chave: "planejamento",
    nome: "Planejamento",
    cor: "#318CE7",
    descricao: "Relaciona-se à capacidade de organizar atividades em etapas, identificar dependências e estabelecer prazos realistas.",
    sugestao: "Organize atividades em etapas, identifique dependências e estabeleça prazos realistas.",
  },
  tempo: {
    chave: "tempo",
    nome: "Gestão do tempo",
    cor: "#4A9BEB",
    descricao: "Relaciona-se à forma de reservar períodos de concentração, reduzir interrupções evitáveis e acompanhar o tempo de execução.",
    sugestao: "Reserve períodos de concentração, reduza interrupções evitáveis e acompanhe o tempo real de execução.",
  },
  priorizacao: {
    chave: "priorizacao",
    nome: "Priorização",
    cor: "#2D7FD0",
    descricao: "Relaciona-se a considerar impacto, urgência, dependências e capacidade disponível ao organizar demandas.",
    sugestao: "Considere impacto, urgência, dependências e capacidade disponível ao organizar suas demandas.",
  },
  detalhes: {
    chave: "detalhes",
    nome: "Atenção aos detalhes",
    cor: "#5CA8EF",
    descricao: "Relaciona-se ao uso de conferências, validações e controles de versão para reduzir inconsistências.",
    sugestao: "Utilize conferências, validações e controles de versão para reduzir inconsistências.",
  },
  acompanhamento: {
    chave: "acompanhamento",
    nome: "Acompanhamento de entregas",
    cor: "#1E6FB8",
    descricao: "Relaciona-se a registrar o progresso, identificar impedimentos antecipadamente e manter os envolvidos informados.",
    sugestao: "Registre o progresso, identifique impedimentos antecipadamente e mantenha os envolvidos informados.",
  },
};

// Nota global de interpretação, sempre exibida com o resultado (spec, seções 1,
// 5 e 10). Descritiva, voluntária e não-certificadora.
export const ORG_NOTA_GLOBAL =
  "Este resultado mostra em quantos cenários você identificou a resposta preferencial segundo os critérios " +
  "de organização e gestão do trabalho desta avaliação. Mede o desempenho nas situações apresentadas, não a " +
  "sua produtividade real, e não é um percentil, uma medida psicométrica nem uma certificação. Não deve ser " +
  "usada isoladamente para decisões automatizadas de contratação. Avaliação autoral RYCS, voluntária.";

export const ORG_TITULO_MAIS_ACERTOS = "Competências com mais acertos";
export const ORG_TITULO_DESENVOLVER = "Oportunidades de desenvolvimento";

// -----------------------------------------------------------------------------
// As 20 situações (spec, seção 4). Cada questão:
//   id            → identificador estável (q01..q20)
//   competencia   → planejamento | tempo | priorizacao | detalhes | acompanhamento
//   enunciado     → situação apresentada
//   alternativas  → [{ id: "A".."D", texto }]
//   correta       → letra da resposta preferencial (NUNCA enviada antes de concluir)
//   justificativa → critério do gabarito (NUNCA enviado antes de concluir)
// -----------------------------------------------------------------------------
export const ITENS_ORG = [
  // COMPETÊNCIA 1 — Planejamento
  {
    id: "q01", competencia: "planejamento",
    enunciado: "Você recebe um projeto com prazo de duas semanas e várias etapas dependentes entre si. Qual é a melhor primeira ação?",
    alternativas: [
      { id: "A", texto: "Começar imediatamente pela tarefa mais simples." },
      { id: "B", texto: "Dividir o projeto em etapas, identificar dependências, estimar prazos e definir responsáveis." },
      { id: "C", texto: "Esperar até a segunda semana para avaliar o trabalho." },
      { id: "D", texto: "Executar todas as etapas simultaneamente." },
    ],
    correta: "B",
    justificativa: "Um planejamento inicial permite identificar dependências e organizar a execução.",
  },
  {
    id: "q02", competencia: "planejamento",
    enunciado: "Você precisa concluir um relatório que depende de dados enviados por outro setor. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Deixar a solicitação dos dados para o último dia." },
      { id: "B", texto: "Solicitar os dados antecipadamente, informar o prazo necessário e planejar as etapas que independem deles." },
      { id: "C", texto: "Preencher os dados com estimativas não identificadas." },
      { id: "D", texto: "Cancelar a atividade." },
    ],
    correta: "B",
    justificativa: "Antecipar dependências reduz riscos de atraso.",
  },
  {
    id: "q03", competencia: "planejamento",
    enunciado: "Uma tarefa costuma levar quatro horas, mas frequentemente apresenta imprevistos. Como planejar sua execução?",
    alternativas: [
      { id: "A", texto: "Reservar exatamente quatro horas, sem possibilidade de ajuste." },
      { id: "B", texto: "Reservar menos tempo para aumentar a pressão." },
      { id: "C", texto: "Considerar o tempo médio, prever uma margem razoável e acompanhar o progresso." },
      { id: "D", texto: "Não estabelecer previsão." },
    ],
    correta: "C",
    justificativa: "Um planejamento realista considera incertezas.",
  },
  {
    id: "q04", competencia: "planejamento",
    enunciado: "Você precisa coordenar uma atividade com três profissionais. Qual prática favorece uma execução organizada?",
    alternativas: [
      { id: "A", texto: "Informar apenas o objetivo geral." },
      { id: "B", texto: "Definir responsabilidades, entregáveis, prazos e pontos de acompanhamento." },
      { id: "C", texto: "Deixar que cada pessoa interprete livremente o prazo." },
      { id: "D", texto: "Evitar registrar decisões." },
    ],
    correta: "B",
    justificativa: "Clareza de responsabilidades reduz retrabalho e desalinhamento.",
  },
  // COMPETÊNCIA 2 — Gestão do tempo
  {
    id: "q05", competencia: "tempo",
    enunciado: "Você precisa realizar uma atividade que exige concentração, mas recebe notificações frequentes. Qual estratégia é mais adequada, quando as condições de trabalho permitem?",
    alternativas: [
      { id: "A", texto: "Responder imediatamente a todas as notificações." },
      { id: "B", texto: "Reservar um período de concentração e definir momentos para verificar mensagens não urgentes." },
      { id: "C", texto: "Trabalhar sem qualquer planejamento." },
      { id: "D", texto: "Abandonar a atividade sempre que surgir uma mensagem." },
    ],
    correta: "B",
    justificativa: "Reduzir interrupções evitáveis favorece a continuidade do trabalho.",
  },
  {
    id: "q06", competencia: "tempo",
    enunciado: "Você percebe que reuniões frequentes estão reduzindo o tempo disponível para executar suas tarefas. O que fazer?",
    alternativas: [
      { id: "A", texto: "Participar de todas sem avaliar sua necessidade." },
      { id: "B", texto: "Propor pautas e objetivos claros, revisar a necessidade de participação e organizar períodos de execução." },
      { id: "C", texto: "Cancelar todas as reuniões sem consultar ninguém." },
      { id: "D", texto: "Trabalhar continuamente fora do expediente." },
    ],
    correta: "B",
    justificativa: "Melhora o uso do tempo sem comprometer a comunicação necessária.",
  },
  {
    id: "q07", competencia: "tempo",
    enunciado: "Uma atividade importante exige três horas de trabalho concentrado. Você possui apenas períodos curtos disponíveis durante o dia. Qual abordagem é mais adequada?",
    alternativas: [
      { id: "A", texto: "Esperar indefinidamente por um dia totalmente livre." },
      { id: "B", texto: "Dividir a atividade em etapas viáveis e reservar períodos protegidos para executá-las." },
      { id: "C", texto: "Executar a tarefa enquanto participa de reuniões." },
      { id: "D", texto: "Reduzir a qualidade para terminar rapidamente." },
    ],
    correta: "B",
    justificativa: "Dividir o trabalho em etapas permite avançar de maneira organizada.",
  },
  {
    id: "q08", competencia: "tempo",
    enunciado: "Você costuma subestimar o tempo necessário para concluir tarefas. Qual ação pode ajudar?",
    alternativas: [
      { id: "A", texto: "Continuar utilizando as mesmas estimativas." },
      { id: "B", texto: "Registrar o tempo real de execução e utilizar esses dados para melhorar estimativas futuras." },
      { id: "C", texto: "Eliminar todos os prazos." },
      { id: "D", texto: "Prometer entregas cada vez mais rápidas." },
    ],
    correta: "B",
    justificativa: "Dados históricos ajudam a construir previsões mais realistas.",
  },
  // COMPETÊNCIA 3 — Priorização
  {
    id: "q09", competencia: "priorizacao",
    enunciado: "Você possui três demandas: corrigir uma falha que impede clientes de acessar um serviço; atualizar um documento interno sem prazo imediato; organizar arquivos antigos. Qual demanda deve receber atenção prioritária?",
    alternativas: [
      { id: "A", texto: "Organizar arquivos." },
      { id: "B", texto: "Atualizar o documento." },
      { id: "C", texto: "Corrigir a falha de acesso." },
      { id: "D", texto: "Escolher aleatoriamente." },
    ],
    correta: "C",
    justificativa: "A falha afeta diretamente a continuidade de um serviço.",
  },
  {
    id: "q10", competencia: "priorizacao",
    enunciado: "Duas tarefas possuem o mesmo prazo, mas uma delas impede que outros profissionais continuem trabalhando. Qual critério deve receber maior peso na priorização?",
    alternativas: [
      { id: "A", texto: "A tarefa mais agradável." },
      { id: "B", texto: "O impacto da dependência sobre o trabalho da equipe." },
      { id: "C", texto: "A ordem alfabética." },
      { id: "D", texto: "A preferência pessoal." },
    ],
    correta: "B",
    justificativa: "Tarefas que bloqueiam outras atividades podem gerar efeitos em cadeia.",
  },
  {
    id: "q11", competencia: "priorizacao",
    enunciado: "Você recebeu uma solicitação urgente enquanto executava uma tarefa importante. Qual é a melhor atitude?",
    alternativas: [
      { id: "A", texto: "Abandonar imediatamente a tarefa atual, sem avaliar." },
      { id: "B", texto: "Ignorar automaticamente a nova solicitação." },
      { id: "C", texto: "Verificar impacto e prazo da solicitação, comparar prioridades e comunicar eventuais mudanças." },
      { id: "D", texto: "Prometer concluir ambas no mesmo horário sem verificar capacidade." },
    ],
    correta: "C",
    justificativa: "Nem toda solicitação urgente exige interromper imediatamente o trabalho atual.",
  },
  {
    id: "q12", competencia: "priorizacao",
    enunciado: "Sua lista possui 15 tarefas, mas sua capacidade diária permite concluir apenas cinco. O que fazer?",
    alternativas: [
      { id: "A", texto: "Selecionar as cinco mais fáceis." },
      { id: "B", texto: "Organizar as tarefas por impacto, prazo e dependências, negociando expectativas quando necessário." },
      { id: "C", texto: "Trabalhar sem pausas até concluir todas." },
      { id: "D", texto: "Ignorar as tarefas mais difíceis." },
    ],
    correta: "B",
    justificativa: "A priorização precisa considerar capacidade real e consequências.",
  },
  // COMPETÊNCIA 4 — Atenção aos detalhes
  {
    id: "q13", competencia: "detalhes",
    enunciado: "Antes de enviar um relatório financeiro, você percebe que o total apresentado não corresponde à soma das linhas. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Enviar assim mesmo." },
      { id: "B", texto: "Ajustar o total sem verificar os dados." },
      { id: "C", texto: "Conferir os valores e a fórmula, corrigir a inconsistência e validar o resultado antes do envio." },
      { id: "D", texto: "Remover a coluna de totais." },
    ],
    correta: "C",
    justificativa: "A inconsistência deve ser investigada e corrigida.",
  },
  {
    id: "q14", competencia: "detalhes",
    enunciado: "Você precisa cadastrar informações de clientes em um sistema. Qual prática reduz o risco de erros?",
    alternativas: [
      { id: "A", texto: "Preencher rapidamente sem conferir." },
      { id: "B", texto: "Utilizar validações disponíveis e conferir campos críticos antes de concluir." },
      { id: "C", texto: "Copiar dados de outros clientes." },
      { id: "D", texto: "Deixar campos obrigatórios com informações inventadas." },
    ],
    correta: "B",
    justificativa: "Validação e conferência reduzem erros de registro.",
  },
  {
    id: "q15", competencia: "detalhes",
    enunciado: "Você recebe duas versões de um documento e precisa enviar a mais recente. Qual ação é mais adequada?",
    alternativas: [
      { id: "A", texto: "Escolher a primeira que encontrar." },
      { id: "B", texto: "Conferir versão, data, histórico de alterações e aprovação antes do envio." },
      { id: "C", texto: "Enviar as duas sem explicação." },
      { id: "D", texto: "Escolher a que possui menos páginas." },
    ],
    correta: "B",
    justificativa: "Controle de versões evita o compartilhamento de documentos desatualizados.",
  },
  {
    id: "q16", competencia: "detalhes",
    enunciado: "Uma instrução exige preencher cinco campos obrigatórios. Você concluiu quatro. O que fazer?",
    alternativas: [
      { id: "A", texto: "Enviar incompleto sem avisar." },
      { id: "B", texto: "Preencher o último campo com qualquer informação." },
      { id: "C", texto: "Verificar a informação faltante e concluir corretamente ou comunicar o impedimento." },
      { id: "D", texto: "Excluir o campo do formulário." },
    ],
    correta: "C",
    justificativa: "Preserva a integridade das informações.",
  },
  // COMPETÊNCIA 5 — Acompanhamento de entregas
  {
    id: "q17", competencia: "acompanhamento",
    enunciado: "Você delegou uma tarefa importante com prazo para sexta-feira. Qual abordagem favorece o acompanhamento?",
    alternativas: [
      { id: "A", texto: "Verificar somente após o prazo." },
      { id: "B", texto: "Definir entregável e prazo, combinar pontos de acompanhamento proporcionais ao risco e oferecer suporte quando necessário." },
      { id: "C", texto: "Perguntar a cada cinco minutos se terminou." },
      { id: "D", texto: "Assumir que tudo está correto sem confirmação." },
    ],
    correta: "B",
    justificativa: "Acompanhamento proporcional ajuda a identificar impedimentos sem microgerenciamento.",
  },
  {
    id: "q18", competencia: "acompanhamento",
    enunciado: "Você percebe que não conseguirá cumprir um prazo combinado. O que fazer?",
    alternativas: [
      { id: "A", texto: "Esperar o prazo vencer." },
      { id: "B", texto: "Comunicar o risco antecipadamente, explicar o impedimento e propor alternativas viáveis." },
      { id: "C", texto: "Informar que está concluído." },
      { id: "D", texto: "Deixar de responder às mensagens." },
    ],
    correta: "B",
    justificativa: "Comunicação antecipada permite reorganizar expectativas e ações.",
  },
  {
    id: "q19", competencia: "acompanhamento",
    enunciado: "Uma atividade foi concluída, mas ainda precisa ser aprovada pelo responsável. Como registrar seu status?",
    alternativas: [
      { id: "A", texto: "Marcar como totalmente finalizada." },
      { id: "B", texto: "Excluir a atividade do acompanhamento." },
      { id: "C", texto: "Registrar como aguardando aprovação e indicar o responsável pela próxima etapa." },
      { id: "D", texto: "Criar uma nova atividade sem relação com a anterior." },
    ],
    correta: "C",
    justificativa: "O status deve refletir a etapa real do fluxo de trabalho.",
  },
  {
    id: "q20", competencia: "acompanhamento",
    enunciado: "Uma equipe conclui suas tarefas no prazo, mas frequentemente precisa refazê-las por erros. Qual indicador adicional deve ser acompanhado?",
    alternativas: [
      { id: "A", texto: "Apenas a quantidade de tarefas concluídas." },
      { id: "B", texto: "O número de reuniões realizadas." },
      { id: "C", texto: "A taxa de retrabalho e a qualidade das entregas, além dos prazos." },
      { id: "D", texto: "Somente o horário de entrada dos profissionais." },
    ],
    correta: "C",
    justificativa: "Produtividade deve considerar qualidade, não apenas velocidade.",
  },
];

const ITEM_POR_ID = Object.fromEntries(ITENS_ORG.map((i) => [i.id, i]));

// Metadados das competências para o frontend.
export function competenciasPublicas() {
  return ORDEM_COMPETENCIAS.map((c) => ({
    chave: COMPETENCIAS_ORG[c].chave,
    nome: COMPETENCIAS_ORG[c].nome,
    cor: COMPETENCIAS_ORG[c].cor,
  }));
}

// Itens públicos: enunciado + alternativas (id + texto), SEM `correta`,
// `justificativa` nem a competência (spec, seções 2 e 11).
export function itensPublicos() {
  return ITENS_ORG.map((i) => ({
    id: i.id,
    enunciado: i.enunciado,
    alternativas: i.alternativas.map((a) => ({ id: a.id, texto: a.texto })),
  }));
}

function letraValida(questaoId, letra) {
  const item = ITEM_POR_ID[questaoId];
  return !!item && item.alternativas.some((a) => a.id === letra);
}

// Saneia um mapa de respostas { questaoId: letra }: mantém só questões conhecidas
// com letra válida. Usado no auto-save.
export function sanearRespostas(respostas) {
  const limpas = {};
  if (!respostas || typeof respostas !== "object") return limpas;
  for (const [id, letra] of Object.entries(respostas)) {
    if (letraValida(id, letra)) limpas[id] = letra;
  }
  return limpas;
}

// Número de questões respondidas (para progresso).
export function contarRespondidos(respostas) {
  if (!respostas || typeof respostas !== "object") return 0;
  let n = 0;
  for (const item of ITENS_ORG) {
    if (letraValida(item.id, respostas[item.id])) n += 1;
  }
  return n;
}

// -----------------------------------------------------------------------------
// Validação server-side: todas as 20 questões respondidas com letra válida.
// -----------------------------------------------------------------------------
export function validarRespostas(respostas) {
  if (!respostas || typeof respostas !== "object")
    return { ok: false, codigo: "FORMATO", erro: "Respostas ausentes ou inválidas." };

  const faltando = [];
  for (const item of ITENS_ORG) {
    if (!letraValida(item.id, respostas[item.id])) faltando.push(item.id);
  }
  if (faltando.length)
    return { ok: false, codigo: "INCOMPLETO", erro: `Faltam ${faltando.length} respostas.`, faltando };

  for (const id of Object.keys(respostas)) {
    if (!ITEM_POR_ID[id])
      return { ok: false, codigo: "ITEM_INVALIDO", erro: `Questão desconhecida: ${id}.` };
  }
  return { ok: true };
}

function pct(acertos, total) {
  return total ? Math.round((acertos / total) * 100) : 0;
}

// -----------------------------------------------------------------------------
// Correção (spec, seção 5). 1 ponto por acerto; percentual geral e por
// competência. Feito SEMPRE no servidor. Não gera percentil nem classificação.
// -----------------------------------------------------------------------------
export function calcularResultado(respostas) {
  const acc = {};
  for (const c of ORDEM_COMPETENCIAS) acc[c] = { acertos: 0, total: 0 };

  let acertosTotal = 0;
  for (const item of ITENS_ORG) {
    acc[item.competencia].total += 1;
    const escolhida = respostas?.[item.id];
    if (escolhida === item.correta) {
      acc[item.competencia].acertos += 1;
      acertosTotal += 1;
    }
  }

  const competencias = {};
  for (const c of ORDEM_COMPETENCIAS) {
    const { acertos, total } = acc[c];
    competencias[c] = { chave: c, acertos, total, percentual: pct(acertos, total) };
  }

  return {
    versao: ORG_VERSAO,
    instrumento: ORG_INSTRUMENTO,
    idioma: ORG_IDIOMA,
    fonte: ORG_FONTE,
    gabaritoVersao: ORG_GABARITO_VERSAO,
    algoritmo: ORG_ALGORITMO,
    total: ORG_TOTAL,
    acertos: acertosTotal,
    percentual: pct(acertosTotal, ORG_TOTAL),
    competencias,
  };
}

// Revisão de respostas (spec, seção 6): só deve ser montada DEPOIS da conclusão.
export function montarRevisao(respostas) {
  return ITENS_ORG.map((item, i) => {
    const escolhida = respostas?.[item.id] ?? null;
    return {
      id: item.id,
      numero: i + 1,
      competencia: item.competencia,
      competenciaNome: COMPETENCIAS_ORG[item.competencia].nome,
      enunciado: item.enunciado,
      alternativas: item.alternativas.map((a) => ({ id: a.id, texto: a.texto })),
      escolhida,
      correta: item.correta,
      justificativa: item.justificativa,
      acertou: escolhida === item.correta,
    };
  });
}

// -----------------------------------------------------------------------------
// Relatório (spec, seções 6 e 7). Barras por competência, destaques (mais
// acertos / desenvolvimento) e revisão completa. Recebe o resultado calculado e
// as respostas (para montar a revisão). Nunca é exposto antes da conclusão.
// -----------------------------------------------------------------------------
export function montarRelatorio(resultado, respostas) {
  const dims = resultado?.competencias || {};
  const competencias = ORDEM_COMPETENCIAS.map((c) => {
    const meta = COMPETENCIAS_ORG[c];
    const r = dims[c] || { acertos: 0, total: ORG_QUESTOES_POR_COMPETENCIA, percentual: 0 };
    return {
      chave: c,
      nome: meta.nome,
      cor: meta.cor,
      acertos: r.acertos,
      total: r.total,
      percentual: r.percentual,
      descricao: meta.descricao,
      sugestao: meta.sugestao,
    };
  });

  const valores = competencias.map((c) => c.acertos);
  const max = valores.length ? Math.max(...valores) : 0;
  const min = valores.length ? Math.min(...valores) : 0;
  const maisAcertos = competencias.filter((c) => c.acertos === max).map((c) => c.chave);
  const desenvolver = max > min ? competencias.filter((c) => c.acertos === min).map((c) => c.chave) : [];

  return {
    instrumento: ORG_INSTRUMENTO,
    fonte: ORG_FONTE,
    experimental: ORG_EXPERIMENTAL,
    gabaritoVersao: ORG_GABARITO_VERSAO,
    total: resultado?.total ?? ORG_TOTAL,
    acertos: resultado?.acertos ?? 0,
    percentual: resultado?.percentual ?? 0,
    notaGlobal: ORG_NOTA_GLOBAL,
    tituloMaisAcertos: ORG_TITULO_MAIS_ACERTOS,
    tituloDesenvolver: ORG_TITULO_DESENVOLVER,
    competencias,
    maisAcertos,
    desenvolver,
    revisao: montarRevisao(respostas),
  };
}

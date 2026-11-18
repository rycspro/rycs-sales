// =============================================================================
// Julgamento Situacional Profissional — avaliação autoral RYCS (25 situações)
//
// Avaliação de DESEMPENHO (não autorrelato): 25 cenários profissionais, 4
// alternativas cada, UMA resposta preferencial definida por critérios explícitos.
// 5 competências × 5 questões (ética e integridade, responsabilidade, colaboração,
// autonomia e julgamento sob pressão). Mede a capacidade de reconhecer condutas
// adequadas NOS CENÁRIOS apresentados.
//
// NATUREZA (importante): instrumento AUTORAL da RYCS. NÃO é diagnóstico de
// personalidade, NÃO é prova de honestidade/integridade/caráter, NÃO prevê
// comportamento futuro e NÃO é psicométrico validado. O resultado mostra apenas
// quais alternativas o profissional reconheceu como preferenciais. NUNCA deve
// gerar rótulos como "desonesto", "irresponsável" ou "não confiável", nem ser
// usado isoladamente para decisões automatizadas de contratação.
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

export const JUL_VERSAO = "rycs-julgamento-situacional-v1-25";
export const JUL_INSTRUMENTO = "RYCS — Julgamento Situacional Profissional (25 situações)";
export const JUL_IDIOMA = "pt-BR";
export const JUL_FONTE = "Avaliação situacional autoral RYCS de julgamento profissional";
// Versão do gabarito (spec, seção 11) — persistida junto à tentativa.
export const JUL_GABARITO_VERSAO = "rycs-julgamento-gabarito-v1";
export const JUL_ALGORITMO = "acertos-v1";
export const JUL_TOTAL = 25;
export const JUL_ALTERNATIVAS_POR_QUESTAO = 4;
export const JUL_QUESTOES_POR_COMPETENCIA = 5;

// Experimental: o rótulo acompanha o resultado enquanto houver revisão interna.
export const JUL_EXPERIMENTAL = true;

// Pendências de revisão (spec, seções 8 e 12).
export const JUL_PENDENCIAS = [
  "Revisão interna dos cenários com profissionais de diferentes áreas antes da publicação, verificando ambiguidades e adequação ao contexto.",
  "Instrumento autoral, não psicométrico: o percentual reflete acertos nos cenários apresentados, não comprova honestidade, caráter, ética pessoal nem comportamento futuro.",
  "Revisão interna dos textos de desenvolvimento das cinco competências.",
];

// Alternativas identificadas por letra estável.
export const ALTERNATIVA_IDS = ["A", "B", "C", "D"];

// Flag de disponibilização. LIGADA por padrão (liberada aos profissionais).
// Pode ser desligada com JULGAMENTO_DISPONIVEL=0 (ex.: pausar para revisão), e
// segue ligada em ambiente beta — ver a rota.
export const julgamentoDisponivel = () =>
  String(process.env.JULGAMENTO_DISPONIVEL ?? "1").trim() !== "0";

// -----------------------------------------------------------------------------
// As cinco competências, na ordem do relatório. `chave` interno estável; cor é
// variação discreta do azul institucional. `descricao` + `sugestao` (spec,
// seção 7).
// -----------------------------------------------------------------------------
export const ORDEM_COMPETENCIAS = ["etica", "responsabilidade", "colaboracao", "autonomia", "pressao"];

export const COMPETENCIAS_JUL = {
  etica: {
    chave: "etica",
    nome: "Ética e integridade",
    cor: "#318CE7",
    descricao: "Relaciona-se a reconhecer condutas baseadas em informações verdadeiras, proteção de dados, transparência e respeito às regras aplicáveis.",
    sugestao: "Priorize informações verdadeiras, proteção de dados, transparência e respeito às regras aplicáveis.",
  },
  responsabilidade: {
    chave: "responsabilidade",
    nome: "Responsabilidade profissional",
    cor: "#4A9BEB",
    descricao: "Relaciona-se a comunicar impedimentos antecipadamente, reconhecer erros e acompanhar a qualidade das entregas.",
    sugestao: "Comunique impedimentos antecipadamente, reconheça erros e acompanhe a qualidade de suas entregas.",
  },
  colaboracao: {
    chave: "colaboracao",
    nome: "Colaboração e trabalho em equipe",
    cor: "#2D7FD0",
    descricao: "Relaciona-se a compartilhar informações relevantes, escutar perspectivas diferentes e reconhecer as contribuições da equipe.",
    sugestao: "Compartilhe informações relevantes, escute perspectivas diferentes e reconheça as contribuições da equipe.",
  },
  autonomia: {
    chave: "autonomia",
    nome: "Autonomia e iniciativa",
    cor: "#5CA8EF",
    descricao: "Relaciona-se a buscar soluções dentro das próprias responsabilidades e saber quando consultar outras pessoas.",
    sugestao: "Busque soluções dentro de suas responsabilidades e saiba quando consultar outras pessoas.",
  },
  pressao: {
    chave: "pressao",
    nome: "Julgamento sob pressão",
    cor: "#1E6FB8",
    descricao: "Relaciona-se a considerar riscos, confirmar informações e preservar requisitos importantes mesmo diante da urgência.",
    sugestao: "Considere riscos, confirme informações e preserve requisitos importantes mesmo diante da urgência.",
  },
};

// Nota global de interpretação, sempre exibida com o resultado (spec, seções 5 e
// 10). Descritiva, voluntária e não-rotuladora.
export const JUL_NOTA_GLOBAL =
  "Este resultado mostra em quantos cenários você identificou a resposta preferencial segundo os critérios " +
  "desta avaliação. Demonstra quais alternativas você reconheceu como preferenciais nas situações apresentadas " +
  "— não comprova honestidade, caráter, ética pessoal nem prevê comportamento futuro, e não é um percentil, " +
  "classificação psicométrica ou certificação. Nunca é usado para rótulos como \"desonesto\" ou \"não confiável\", " +
  "nem isoladamente para decisões automatizadas de contratação. Avaliação autoral RYCS, voluntária.";

export const JUL_TITULO_MAIS_ACERTOS = "Áreas com mais acertos";
export const JUL_TITULO_DESENVOLVER = "Oportunidades de desenvolvimento";

// -----------------------------------------------------------------------------
// As 25 situações (spec, seção 4). Cada questão:
//   id            → identificador estável (q01..q25)
//   competencia   → etica | responsabilidade | colaboracao | autonomia | pressao
//   enunciado     → cenário apresentado
//   alternativas  → [{ id: "A".."D", texto }]
//   correta       → letra da resposta preferencial (NUNCA enviada antes de concluir)
//   justificativa → critério do gabarito (NUNCA enviado antes de concluir)
// -----------------------------------------------------------------------------
export const ITENS_JUL = [
  // COMPETÊNCIA 1 — Ética e integridade
  {
    id: "q01", competencia: "etica",
    enunciado: "Um cliente pede que você informe um benefício que o produto não oferece para facilitar o fechamento da venda. O que fazer?",
    alternativas: [
      { id: "A", texto: "Informar o benefício para não perder a venda." },
      { id: "B", texto: "Explicar corretamente as características do produto e apresentar alternativas que atendam à necessidade do cliente." },
      { id: "C", texto: "Evitar responder à pergunta e mudar de assunto." },
      { id: "D", texto: "Prometer o benefício apenas verbalmente." },
    ],
    correta: "B",
    justificativa: "A comunicação comercial deve ser verdadeira e transparente.",
  },
  {
    id: "q02", competencia: "etica",
    enunciado: "Você percebe que um colega registrou uma venda que não aconteceu para melhorar seus indicadores. Qual é a atitude mais adequada?",
    alternativas: [
      { id: "A", texto: "Ignorar porque não é sua responsabilidade." },
      { id: "B", texto: "Alterar seus próprios indicadores para compensar." },
      { id: "C", texto: "Verificar os fatos e comunicar a inconsistência pelo canal apropriado, preservando a confidencialidade." },
      { id: "D", texto: "Divulgar a suspeita em um grupo público." },
    ],
    correta: "C",
    justificativa: "Permite tratar a possível irregularidade com responsabilidade e sem acusações precipitadas.",
  },
  {
    id: "q03", competencia: "etica",
    enunciado: "Você recebe acesso a informações confidenciais de clientes. Qual conduta é adequada?",
    alternativas: [
      { id: "A", texto: "Compartilhar com colegas que não precisam dessas informações." },
      { id: "B", texto: "Utilizar os dados apenas para finalidades autorizadas, seguindo as regras de acesso e proteção." },
      { id: "C", texto: "Salvar os dados em uma conta pessoal sem autorização." },
      { id: "D", texto: "Utilizar os dados para campanhas próprias." },
    ],
    correta: "B",
    justificativa: "Protege informações confidenciais e respeita a finalidade autorizada.",
  },
  {
    id: "q04", competencia: "etica",
    enunciado: "Um fornecedor oferece um benefício pessoal em troca de favorecimento na escolha de sua proposta, contrariando as regras da empresa. O que fazer?",
    alternativas: [
      { id: "A", texto: "Aceitar porque a empresa não terá prejuízo aparente." },
      { id: "B", texto: "Aceitar desde que ninguém descubra." },
      { id: "C", texto: "Recusar o benefício e comunicar a situação conforme as políticas aplicáveis." },
      { id: "D", texto: "Solicitar um benefício maior." },
    ],
    correta: "C",
    justificativa: "Evita conflito de interesses e favorecimento indevido.",
  },
  {
    id: "q05", competencia: "etica",
    enunciado: "Você identifica um erro em uma cobrança que beneficiou financeiramente a empresa. Qual é a melhor atitude?",
    alternativas: [
      { id: "A", texto: "Manter o valor porque o cliente já pagou." },
      { id: "B", texto: "Comunicar o erro ao responsável e providenciar a correção pelos procedimentos adequados." },
      { id: "C", texto: "Esperar uma reclamação." },
      { id: "D", texto: "Apagar o registro da cobrança." },
    ],
    correta: "B",
    justificativa: "A correção de cobranças indevidas é parte de uma conduta profissional íntegra.",
  },
  // COMPETÊNCIA 2 — Responsabilidade profissional
  {
    id: "q06", competencia: "responsabilidade",
    enunciado: "Você percebe que não conseguirá cumprir um prazo acordado. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Esperar o prazo vencer." },
      { id: "B", texto: "Informar antecipadamente o risco, explicar o impedimento e propor um novo plano viável." },
      { id: "C", texto: "Informar que concluiu a tarefa." },
      { id: "D", texto: "Deixar de responder às mensagens." },
    ],
    correta: "B",
    justificativa: "Comunicação antecipada permite reorganizar expectativas e reduzir impactos.",
  },
  {
    id: "q07", competencia: "responsabilidade",
    enunciado: "Você cometeu um erro que afetou o trabalho de outra pessoa. O que fazer?",
    alternativas: [
      { id: "A", texto: "Ocultar o erro." },
      { id: "B", texto: "Atribuir a responsabilidade ao sistema sem verificar." },
      { id: "C", texto: "Reconhecer o erro, comunicar os envolvidos e colaborar na correção." },
      { id: "D", texto: "Esperar que alguém resolva." },
    ],
    correta: "C",
    justificativa: "Assumir responsabilidade contribui para corrigir o problema e prevenir recorrências.",
  },
  {
    id: "q08", competencia: "responsabilidade",
    enunciado: "Você recebe uma tarefa, mas não compreende completamente o resultado esperado. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Executar com base em suposições." },
      { id: "B", texto: "Solicitar esclarecimentos sobre objetivo, critérios de entrega e prazo antes de avançar." },
      { id: "C", texto: "Ignorar a tarefa." },
      { id: "D", texto: "Delegar para outra pessoa sem alinhamento." },
    ],
    correta: "B",
    justificativa: "Esclarecer expectativas reduz erros e retrabalho.",
  },
  {
    id: "q09", competencia: "responsabilidade",
    enunciado: "Você concluiu uma atividade, mas ainda precisa verificar se o resultado atende aos requisitos. O que fazer?",
    alternativas: [
      { id: "A", texto: "Marcar como concluída imediatamente." },
      { id: "B", texto: "Realizar a conferência necessária antes de confirmar a entrega." },
      { id: "C", texto: "Excluir os requisitos que não foram atendidos." },
      { id: "D", texto: "Enviar sem qualquer revisão." },
    ],
    correta: "B",
    justificativa: "Responsabilidade inclui verificar a qualidade da entrega.",
  },
  {
    id: "q10", competencia: "responsabilidade",
    enunciado: "Uma tarefa importante foi atribuída a você, mas depende de uma aprovação que está atrasada. Qual é a melhor atitude?",
    alternativas: [
      { id: "A", texto: "Ignorar a dependência." },
      { id: "B", texto: "Prosseguir sem aprovação, mesmo quando ela é obrigatória." },
      { id: "C", texto: "Comunicar o bloqueio, solicitar a aprovação e avançar nas etapas que não dependem dela." },
      { id: "D", texto: "Abandonar definitivamente a tarefa." },
    ],
    correta: "C",
    justificativa: "Administra a dependência sem desrespeitar controles necessários.",
  },
  // COMPETÊNCIA 3 — Colaboração e trabalho em equipe
  {
    id: "q11", competencia: "colaboracao",
    enunciado: "Um colega está com dificuldades em uma tarefa que você conhece bem, e você possui disponibilidade para ajudar. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Ignorar porque a tarefa não é sua." },
      { id: "B", texto: "Oferecer orientação e colaborar sem assumir indevidamente toda a responsabilidade." },
      { id: "C", texto: "Criticar o colega publicamente." },
      { id: "D", texto: "Executar a tarefa sem explicar nada." },
    ],
    correta: "B",
    justificativa: "Oferece apoio e contribui para a autonomia do colega.",
  },
  {
    id: "q12", competencia: "colaboracao",
    enunciado: "Duas pessoas da equipe discordam sobre como executar uma atividade. O que fazer?",
    alternativas: [
      { id: "A", texto: "Escolher um lado imediatamente." },
      { id: "B", texto: "Incentivar a discussão pessoal." },
      { id: "C", texto: "Ouvir as perspectivas, comparar alternativas com critérios objetivos e buscar alinhamento." },
      { id: "D", texto: "Evitar qualquer decisão." },
    ],
    correta: "C",
    justificativa: "Favorece decisões colaborativas baseadas em critérios.",
  },
  {
    id: "q13", competencia: "colaboracao",
    enunciado: "Você recebe uma informação importante que pode evitar um erro em outra equipe. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Guardar a informação para demonstrar vantagem." },
      { id: "B", texto: "Compartilhar a informação com os responsáveis pelo canal apropriado e em tempo útil." },
      { id: "C", texto: "Esperar que descubram sozinhos." },
      { id: "D", texto: "Publicar a informação indiscriminadamente." },
    ],
    correta: "B",
    justificativa: "Colaboração inclui compartilhar informações relevantes com as pessoas autorizadas.",
  },
  {
    id: "q14", competencia: "colaboracao",
    enunciado: "Um colega apresenta uma ideia diferente da sua durante uma reunião. Qual postura é mais adequada?",
    alternativas: [
      { id: "A", texto: "Rejeitar antes de ouvir." },
      { id: "B", texto: "Avaliar a proposta com abertura, fazer perguntas e discutir seus méritos." },
      { id: "C", texto: "Interromper a apresentação." },
      { id: "D", texto: "Concordar automaticamente para evitar qualquer divergência." },
    ],
    correta: "B",
    justificativa: "Abertura ao diálogo permite avaliar diferentes alternativas.",
  },
  {
    id: "q15", competencia: "colaboracao",
    enunciado: "Um projeto coletivo foi concluído com sucesso. Como reconhecer o resultado?",
    alternativas: [
      { id: "A", texto: "Atribuir todo o mérito a si mesmo." },
      { id: "B", texto: "Ignorar as contribuições dos demais." },
      { id: "C", texto: "Reconhecer as contribuições relevantes da equipe e os resultados alcançados." },
      { id: "D", texto: "Afirmar que o projeto teria sido melhor sem os colegas." },
    ],
    correta: "C",
    justificativa: "Reconhecimento justo fortalece a colaboração.",
  },
  // COMPETÊNCIA 4 — Autonomia e iniciativa
  {
    id: "q16", competencia: "autonomia",
    enunciado: "Você identifica um pequeno problema operacional que pode resolver dentro de suas responsabilidades e seguindo os procedimentos existentes. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Esperar que alguém perceba." },
      { id: "B", texto: "Resolver dentro de sua autonomia, registrar a ação quando necessário e comunicar os envolvidos." },
      { id: "C", texto: "Alterar processos críticos sem autorização." },
      { id: "D", texto: "Ignorar o problema." },
    ],
    correta: "B",
    justificativa: "Demonstra iniciativa dentro dos limites de responsabilidade.",
  },
  {
    id: "q17", competencia: "autonomia",
    enunciado: "Você recebe um objetivo, mas possui liberdade para organizar sua execução. Qual é a melhor abordagem?",
    alternativas: [
      { id: "A", texto: "Esperar instruções para cada pequena etapa." },
      { id: "B", texto: "Planejar as atividades, executar dentro de sua autonomia e comunicar impedimentos relevantes." },
      { id: "C", texto: "Trabalhar sem qualquer planejamento." },
      { id: "D", texto: "Transferir todas as decisões ao gestor." },
    ],
    correta: "B",
    justificativa: "Combina iniciativa, organização e alinhamento.",
  },
  {
    id: "q18", competencia: "autonomia",
    enunciado: "Você encontra uma oportunidade de melhorar um processo, mas a mudança afetaria outros setores. O que fazer?",
    alternativas: [
      { id: "A", texto: "Implementar sem comunicar ninguém." },
      { id: "B", texto: "Ignorar a oportunidade." },
      { id: "C", texto: "Preparar uma proposta fundamentada, consultar os envolvidos e obter as aprovações necessárias." },
      { id: "D", texto: "Criticar o processo sem sugerir alternativas." },
    ],
    correta: "C",
    justificativa: "Iniciativa deve considerar impactos e responsabilidades compartilhadas.",
  },
  {
    id: "q19", competencia: "autonomia",
    enunciado: "Você está executando uma tarefa e encontra uma dificuldade que não consegue resolver imediatamente. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Desistir sem tentar." },
      { id: "B", texto: "Pesquisar fontes autorizadas, testar alternativas seguras dentro de sua competência e pedir ajuda quando necessário." },
      { id: "C", texto: "Inventar informações para concluir." },
      { id: "D", texto: "Continuar repetindo o mesmo erro sem avaliar." },
    ],
    correta: "B",
    justificativa: "Combina iniciativa com reconhecimento dos próprios limites.",
  },
  {
    id: "q20", competencia: "autonomia",
    enunciado: "Você concluiu suas tarefas antes do prazo e ainda possui tempo disponível. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Registrar atividades que não realizou." },
      { id: "B", texto: "Verificar novas prioridades ou oportunidades de contribuição alinhadas às responsabilidades da função." },
      { id: "C", texto: "Alterar tarefas de outros profissionais sem autorização." },
      { id: "D", texto: "Criar atividades desnecessárias apenas para parecer ocupado." },
    ],
    correta: "B",
    justificativa: "Demonstra proatividade sem ultrapassar responsabilidades.",
  },
  // COMPETÊNCIA 5 — Julgamento sob pressão
  {
    id: "q21", competencia: "pressao",
    enunciado: "Um cliente exige uma resposta imediata sobre um assunto que você ainda precisa confirmar. O que fazer?",
    alternativas: [
      { id: "A", texto: "Inventar uma resposta para encerrar o atendimento." },
      { id: "B", texto: "Informar que precisa verificar a informação e estabelecer um prazo realista de retorno." },
      { id: "C", texto: "Ignorar o cliente." },
      { id: "D", texto: "Prometer qualquer resultado solicitado." },
    ],
    correta: "B",
    justificativa: "Mantém transparência mesmo diante da pressão.",
  },
  {
    id: "q22", competencia: "pressao",
    enunciado: "Seu gestor solicita uma entrega urgente, mas concluí-la imediatamente exigiria ignorar uma verificação obrigatória de segurança. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Ignorar a verificação." },
      { id: "B", texto: "Explicar a exigência, comunicar o impacto no prazo e buscar uma alternativa que preserve a segurança." },
      { id: "C", texto: "Ocultar que a verificação foi ignorada." },
      { id: "D", texto: "Delegar a decisão sem informar o risco." },
    ],
    correta: "B",
    justificativa: "Urgência não elimina requisitos obrigatórios de segurança.",
  },
  {
    id: "q23", competencia: "pressao",
    enunciado: "Você recebe três solicitações urgentes simultaneamente e não consegue atender a todas no prazo. O que fazer?",
    alternativas: [
      { id: "A", texto: "Prometer que concluirá tudo." },
      { id: "B", texto: "Organizar as demandas por impacto, prazo e dependências, alinhando prioridades com os responsáveis." },
      { id: "C", texto: "Escolher aleatoriamente." },
      { id: "D", texto: "Ignorar todas as solicitações." },
    ],
    correta: "B",
    justificativa: "Permite tomar decisões transparentes diante de limitações reais.",
  },
  {
    id: "q24", competencia: "pressao",
    enunciado: "Durante uma situação de crise, surgem informações contraditórias sobre a causa do problema. Qual é a melhor atitude?",
    alternativas: [
      { id: "A", texto: "Divulgar imediatamente a primeira explicação recebida." },
      { id: "B", texto: "Confirmar informações com fontes responsáveis, comunicar o que é conhecido e sinalizar o que ainda está sendo investigado." },
      { id: "C", texto: "Ocultar todas as informações indefinidamente." },
      { id: "D", texto: "Atribuir culpa sem evidências." },
    ],
    correta: "B",
    justificativa: "Evita a propagação de informações não verificadas.",
  },
  {
    id: "q25", competencia: "pressao",
    enunciado: "Você percebe que uma decisão tomada sob pressão está produzindo consequências negativas inesperadas. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Manter a decisão apenas para não reconhecer o erro." },
      { id: "B", texto: "Ignorar os novos dados." },
      { id: "C", texto: "Reavaliar a decisão com as informações disponíveis, comunicar os impactos e ajustar a ação quando necessário." },
      { id: "D", texto: "Transferir a responsabilidade sem explicar o ocorrido." },
    ],
    correta: "C",
    justificativa: "Boas decisões exigem capacidade de revisão diante de novas evidências.",
  },
];

const ITEM_POR_ID = Object.fromEntries(ITENS_JUL.map((i) => [i.id, i]));

// Metadados das competências para o frontend.
export function competenciasPublicas() {
  return ORDEM_COMPETENCIAS.map((c) => ({
    chave: COMPETENCIAS_JUL[c].chave,
    nome: COMPETENCIAS_JUL[c].nome,
    cor: COMPETENCIAS_JUL[c].cor,
  }));
}

// Itens públicos: enunciado + alternativas (id + texto), SEM `correta`,
// `justificativa` nem a competência (spec, seções 2 e 11).
export function itensPublicos() {
  return ITENS_JUL.map((i) => ({
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
  for (const item of ITENS_JUL) {
    if (letraValida(item.id, respostas[item.id])) n += 1;
  }
  return n;
}

// -----------------------------------------------------------------------------
// Validação server-side: todas as 25 questões respondidas com letra válida.
// -----------------------------------------------------------------------------
export function validarRespostas(respostas) {
  if (!respostas || typeof respostas !== "object")
    return { ok: false, codigo: "FORMATO", erro: "Respostas ausentes ou inválidas." };

  const faltando = [];
  for (const item of ITENS_JUL) {
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
  for (const item of ITENS_JUL) {
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
    versao: JUL_VERSAO,
    instrumento: JUL_INSTRUMENTO,
    idioma: JUL_IDIOMA,
    fonte: JUL_FONTE,
    gabaritoVersao: JUL_GABARITO_VERSAO,
    algoritmo: JUL_ALGORITMO,
    total: JUL_TOTAL,
    acertos: acertosTotal,
    percentual: pct(acertosTotal, JUL_TOTAL),
    competencias,
  };
}

// Revisão de respostas (spec, seção 6): só deve ser montada DEPOIS da conclusão.
export function montarRevisao(respostas) {
  return ITENS_JUL.map((item, i) => {
    const escolhida = respostas?.[item.id] ?? null;
    return {
      id: item.id,
      numero: i + 1,
      competencia: item.competencia,
      competenciaNome: COMPETENCIAS_JUL[item.competencia].nome,
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
    const meta = COMPETENCIAS_JUL[c];
    const r = dims[c] || { acertos: 0, total: JUL_QUESTOES_POR_COMPETENCIA, percentual: 0 };
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
    instrumento: JUL_INSTRUMENTO,
    fonte: JUL_FONTE,
    experimental: JUL_EXPERIMENTAL,
    gabaritoVersao: JUL_GABARITO_VERSAO,
    total: resultado?.total ?? JUL_TOTAL,
    acertos: resultado?.acertos ?? 0,
    percentual: resultado?.percentual ?? 0,
    notaGlobal: JUL_NOTA_GLOBAL,
    tituloMaisAcertos: JUL_TITULO_MAIS_ACERTOS,
    tituloDesenvolver: JUL_TITULO_DESENVOLVER,
    competencias,
    maisAcertos,
    desenvolver,
    revisao: montarRevisao(respostas),
  };
}

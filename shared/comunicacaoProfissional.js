// =============================================================================
// Comunicação Profissional — avaliação situacional autoral RYCS (20 questões)
//
// Avaliação de DESEMPENHO (não autorrelato): 20 questões situacionais, 4
// alternativas cada, UMA considerada mais adequada segundo critérios explícitos
// de comunicação profissional. 5 competências × 4 questões. Mede o reconhecimento
// de estratégias de comunicação claras, respeitosas e eficazes NOS CENÁRIOS
// apresentados — não a capacidade de comunicação em toda situação real.
//
// NATUREZA (importante): instrumento AUTORAL da RYCS. NÃO é psicométrico
// validado, NÃO é certificação. Resultado = acertos e percentual nos cenários.
// Algumas situações admitem mais de uma resposta razoável; o gabarito segue os
// critérios definidos para cada cenário, não preferências subjetivas.
//
// SEGURANÇA / GABARITO: a alternativa correta e a justificativa são a "chave" do
// teste e vivem só aqui (servidor). Durante o preenchimento o cliente recebe
// apenas enunciado + alternativas (sem `correta`/`justificativa`) via
// `itensPublicos()`. A correção é SEMPRE no servidor; a revisão (com gabarito) só
// é liberada DEPOIS da conclusão.
//
// I18N: identificadores (versão, ids de questão/alternativa, competências) são
// ESTÁVEIS e independentes de idioma. Só os textos são traduzíveis.
// =============================================================================

export const COM_VERSAO = "rycs-comunicacao-profissional-v1-20";
export const COM_INSTRUMENTO = "RYCS — Comunicação Profissional (20 questões situacionais)";
export const COM_IDIOMA = "pt-BR";
export const COM_FONTE = "Avaliação situacional autoral RYCS de comunicação profissional";
// Versão do gabarito (spec, seção 11) — persistida junto à tentativa.
export const COM_GABARITO_VERSAO = "rycs-comunicacao-gabarito-v1";
export const COM_ALGORITMO = "acertos-v1";
export const COM_TOTAL = 20;
export const COM_ALTERNATIVAS_POR_QUESTAO = 4;
export const COM_QUESTOES_POR_COMPETENCIA = 4;

// Experimental: o rótulo acompanha o resultado enquanto houver revisão interna.
export const COM_EXPERIMENTAL = true;

// Pendências de revisão (spec, seções 8 e 12).
export const COM_PENDENCIAS = [
  "Revisão interna do gabarito e das justificativas antes da publicação — algumas situações admitem mais de uma resposta razoável.",
  "Instrumento autoral, não psicométrico: o percentual reflete acertos nos cenários apresentados, não uma medida universal de habilidade de comunicação.",
  "Revisão interna dos textos interpretativos das cinco competências.",
];

// Alternativas identificadas por letra estável.
export const ALTERNATIVA_IDS = ["A", "B", "C", "D"];

// Flag de disponibilização. LIGADA por padrão (liberada aos profissionais).
// Pode ser desligada com COMUNICACAO_DISPONIVEL=0 (ex.: pausar para revisão), e
// segue ligada em ambiente beta — ver a rota.
export const comunicacaoDisponivel = () =>
  String(process.env.COMUNICACAO_DISPONIVEL ?? "1").trim() !== "0";

// -----------------------------------------------------------------------------
// As cinco competências, na ordem do relatório. `chave` interno estável; cor é
// variação discreta do azul institucional. `descricao` + `sugestao` (spec,
// seção 7).
// -----------------------------------------------------------------------------
export const ORDEM_COMPETENCIAS = ["clareza", "escuta", "escrita", "feedback", "dificeis"];

export const COMPETENCIAS_COM = {
  clareza: {
    chave: "clareza",
    nome: "Clareza e objetividade",
    cor: "#318CE7",
    descricao: "Relaciona-se à capacidade de identificar mensagens claras, completas e orientadas à ação.",
    sugestao: "Pratique estruturar mensagens com contexto, informação principal, responsável e próximo passo.",
  },
  escuta: {
    chave: "escuta",
    nome: "Escuta ativa",
    cor: "#4A9BEB",
    descricao: "Relaciona-se à identificação de atitudes que favorecem a compreensão da perspectiva de outras pessoas.",
    sugestao: "Utilize perguntas abertas e confirme o entendimento antes de apresentar soluções.",
  },
  escrita: {
    chave: "escrita",
    nome: "Comunicação escrita",
    cor: "#2D7FD0",
    descricao: "Relaciona-se à capacidade de reconhecer mensagens escritas organizadas e adequadas ao destinatário.",
    sugestao: "Revise se suas mensagens deixam claros o objetivo, as informações necessárias e a ação esperada.",
  },
  feedback: {
    chave: "feedback",
    nome: "Feedback e alinhamento",
    cor: "#5CA8EF",
    descricao: "Relaciona-se à identificação de práticas construtivas de feedback e alinhamento profissional.",
    sugestao: "Utilize exemplos específicos e combine próximos passos verificáveis.",
  },
  dificeis: {
    chave: "dificeis",
    nome: "Comunicação em situações difíceis",
    cor: "#1E6FB8",
    descricao: "Relaciona-se à identificação de respostas profissionais em conflitos, reclamações e divergências.",
    sugestao: "Procure reconhecer o problema, manter o respeito e comunicar ações concretas.",
  },
};

// Nota global de interpretação, sempre exibida com o resultado (spec, seções 1,
// 5 e 10). Descritiva, voluntária e não-certificadora.
export const COM_NOTA_GLOBAL =
  "Este resultado mostra em quantos cenários você identificou a alternativa considerada mais adequada " +
  "segundo os critérios de comunicação profissional desta avaliação. Mede o desempenho nas situações " +
  "apresentadas, não a sua capacidade de comunicação em toda situação real, e não é um percentil, uma " +
  "medida universal de habilidade nem uma certificação. Avaliação autoral RYCS, voluntária; algumas " +
  "situações admitem mais de uma resposta razoável.";

export const COM_TITULO_MAIS_ACERTOS = "Competências com mais acertos";
export const COM_TITULO_DESENVOLVER = "Competências para desenvolver";

// -----------------------------------------------------------------------------
// As 20 questões (spec, seção 4). Cada questão:
//   id            → identificador estável (q01..q20)
//   competencia   → clareza | escuta | escrita | feedback | dificeis (interno)
//   enunciado     → situação apresentada
//   alternativas  → [{ id: "A".."D", texto }]
//   correta       → letra da alternativa mais adequada (NUNCA enviada antes de concluir)
//   justificativa → critério do gabarito (NUNCA enviado antes de concluir)
// -----------------------------------------------------------------------------
export const ITENS_COM = [
  // COMPETÊNCIA 1 — Clareza e objetividade
  {
    id: "q01", competencia: "clareza",
    enunciado: "Um colega solicita uma atualização sobre uma tarefa que você ainda não concluiu. Qual é a melhor resposta?",
    alternativas: [
      { id: "A", texto: "\"Ainda não terminei. Depois eu aviso.\"" },
      { id: "B", texto: "\"Estou trabalhando nisso, mas ainda faltam algumas coisas.\"" },
      { id: "C", texto: "\"Concluí a primeira etapa, estou finalizando a segunda e pretendo entregar até as 16h. Avisarei se houver algum impedimento.\"" },
      { id: "D", texto: "\"Estou fazendo o possível, então preciso que aguarde.\"" },
    ],
    correta: "C",
    justificativa: "Comunica o progresso, a próxima etapa, a previsão e o compromisso de atualização.",
  },
  {
    id: "q02", competencia: "clareza",
    enunciado: "Você precisa explicar um processo novo a alguém sem experiência. Qual abordagem é mais adequada?",
    alternativas: [
      { id: "A", texto: "Utilizar todos os termos técnicos para demonstrar conhecimento." },
      { id: "B", texto: "Explicar as etapas em linguagem simples, apresentar um exemplo e confirmar o entendimento." },
      { id: "C", texto: "Enviar um documento longo sem explicações adicionais." },
      { id: "D", texto: "Explicar rapidamente e pedir que a pessoa pesquise o restante." },
    ],
    correta: "B",
    justificativa: "Adapta a linguagem e verifica se a informação foi compreendida.",
  },
  {
    id: "q03", competencia: "clareza",
    enunciado: "Um cliente pergunta quando receberá uma entrega, mas você ainda não possui uma data confirmada. O que fazer?",
    alternativas: [
      { id: "A", texto: "Informar uma data aproximada como se fosse definitiva." },
      { id: "B", texto: "Evitar responder até ter certeza." },
      { id: "C", texto: "Explicar que a data está sendo confirmada e estabelecer um prazo para retornar com a informação." },
      { id: "D", texto: "Dizer que a entrega acontecerá em breve, sem outros detalhes." },
    ],
    correta: "C",
    justificativa: "Comunica a incerteza com transparência e estabelece uma próxima ação.",
  },
  {
    id: "q04", competencia: "clareza",
    enunciado: "Você precisa solicitar uma correção em um relatório. Qual mensagem é mais clara?",
    alternativas: [
      { id: "A", texto: "\"Esse relatório está errado.\"" },
      { id: "B", texto: "\"Melhore o relatório.\"" },
      { id: "C", texto: "\"Revise os números da seção 3, pois o total não corresponde à soma apresentada. Pode me enviar a versão corrigida até amanhã às 14h?\"" },
      { id: "D", texto: "\"Não gostei do relatório. Faça novamente.\"" },
    ],
    correta: "C",
    justificativa: "Identifica o problema, descreve a correção e apresenta um prazo.",
  },
  // COMPETÊNCIA 2 — Escuta ativa
  {
    id: "q05", competencia: "escuta",
    enunciado: "Durante uma reunião, um colega apresenta uma preocupação que você não compreendeu completamente. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Responder imediatamente com sua opinião." },
      { id: "B", texto: "Pedir que ele explique melhor e resumir o que você entendeu antes de responder." },
      { id: "C", texto: "Ignorar a preocupação para manter a reunião rápida." },
      { id: "D", texto: "Mudar de assunto para evitar dúvidas." },
    ],
    correta: "B",
    justificativa: "Demonstra atenção e reduz o risco de interpretações equivocadas.",
  },
  {
    id: "q06", competencia: "escuta",
    enunciado: "Um cliente afirma que está insatisfeito com o atendimento. O que fazer primeiro?",
    alternativas: [
      { id: "A", texto: "Explicar por que a empresa agiu corretamente." },
      { id: "B", texto: "Oferecer um desconto imediatamente." },
      { id: "C", texto: "Ouvir o relato, reconhecer a insatisfação e fazer perguntas para compreender o problema." },
      { id: "D", texto: "Encerrar a conversa e encaminhar para outro setor." },
    ],
    correta: "C",
    justificativa: "Compreender a situação é essencial antes de propor soluções.",
  },
  {
    id: "q07", competencia: "escuta",
    enunciado: "Um colega está explicando uma dificuldade e você acredita já conhecer a solução. Qual comportamento é mais adequado?",
    alternativas: [
      { id: "A", texto: "Interromper para apresentar a solução." },
      { id: "B", texto: "Deixar que conclua, confirmar os pontos principais e então apresentar sua sugestão." },
      { id: "C", texto: "Continuar trabalhando enquanto ele fala." },
      { id: "D", texto: "Dizer que já passou pela mesma situação e começar a contar sua experiência." },
    ],
    correta: "B",
    justificativa: "Respeita a fala do outro e permite compreender o contexto completo.",
  },
  {
    id: "q08", competencia: "escuta",
    enunciado: "Durante uma conversa, você percebe que a pessoa está respondendo de maneira vaga. O que fazer?",
    alternativas: [
      { id: "A", texto: "Presumir que ela concorda." },
      { id: "B", texto: "Repetir sua opinião com mais firmeza." },
      { id: "C", texto: "Fazer perguntas abertas e pedir exemplos para compreender melhor." },
      { id: "D", texto: "Encerrar a conversa." },
    ],
    correta: "C",
    justificativa: "Perguntas abertas ajudam a esclarecer informações incompletas.",
  },
  // COMPETÊNCIA 3 — Comunicação escrita
  {
    id: "q09", competencia: "escrita",
    enunciado: "Você precisa enviar um e-mail solicitando documentos. Qual abordagem é mais adequada?",
    alternativas: [
      { id: "A", texto: "Enviar apenas \"Preciso dos documentos\"." },
      { id: "B", texto: "Escrever um texto longo sem indicar quais documentos são necessários." },
      { id: "C", texto: "Informar quais documentos são necessários, o motivo, o prazo e como enviá-los." },
      { id: "D", texto: "Enviar várias mensagens separadas com informações incompletas." },
    ],
    correta: "C",
    justificativa: "A mensagem contém as informações necessárias para a ação.",
  },
  {
    id: "q10", competencia: "escrita",
    enunciado: "Você precisa comunicar uma mudança de horário a uma equipe. Qual mensagem é mais eficaz?",
    alternativas: [
      { id: "A", texto: "\"Mudou o horário da reunião.\"" },
      { id: "B", texto: "\"Pessoal, a reunião de amanhã foi alterada das 10h para as 11h, mantendo o mesmo link. Confirmem o recebimento, por favor.\"" },
      { id: "C", texto: "\"A reunião não será mais no horário anterior.\"" },
      { id: "D", texto: "\"Depois explico a mudança.\"" },
    ],
    correta: "B",
    justificativa: "Apresenta a mudança, o novo horário e a informação de acesso.",
  },
  {
    id: "q11", competencia: "escrita",
    enunciado: "Você está escrevendo uma mensagem para um cliente que não conhece termos técnicos. O que fazer?",
    alternativas: [
      { id: "A", texto: "Utilizar o máximo possível de termos técnicos." },
      { id: "B", texto: "Manter a linguagem técnica para demonstrar profissionalismo." },
      { id: "C", texto: "Utilizar linguagem acessível e explicar termos indispensáveis." },
      { id: "D", texto: "Enviar apenas imagens sem explicação." },
    ],
    correta: "C",
    justificativa: "Adequar a linguagem ao destinatário melhora a compreensão.",
  },
  {
    id: "q12", competencia: "escrita",
    enunciado: "Você precisa registrar uma decisão tomada em reunião. Qual registro é mais adequado?",
    alternativas: [
      { id: "A", texto: "\"Conversamos sobre o projeto.\"" },
      { id: "B", texto: "\"Foi decidido que o projeto vai continuar.\"" },
      { id: "C", texto: "\"Decisão: iniciar a etapa de testes na segunda-feira. Responsável: equipe técnica. Prazo para conclusão: sexta-feira.\"" },
      { id: "D", texto: "\"Tudo certo com o projeto.\"" },
    ],
    correta: "C",
    justificativa: "Registra a decisão, o responsável e o prazo.",
  },
  // COMPETÊNCIA 4 — Feedback e alinhamento
  {
    id: "q13", competencia: "feedback",
    enunciado: "Um colega entregou uma tarefa com erros recorrentes. Qual abordagem é mais adequada?",
    alternativas: [
      { id: "A", texto: "Criticar sua capacidade profissional." },
      { id: "B", texto: "Apontar exemplos específicos, explicar o impacto e combinar ações de melhoria." },
      { id: "C", texto: "Corrigir tudo sem avisá-lo." },
      { id: "D", texto: "Reclamar com outros colegas." },
    ],
    correta: "B",
    justificativa: "Feedback construtivo utiliza fatos, impactos e orientações claras.",
  },
  {
    id: "q14", competencia: "feedback",
    enunciado: "Você recebe um feedback com o qual não concorda. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Rejeitar imediatamente." },
      { id: "B", texto: "Permanecer em silêncio e ignorar depois." },
      { id: "C", texto: "Pedir exemplos, esclarecer sua perspectiva e discutir possíveis melhorias." },
      { id: "D", texto: "Responder com críticas à outra pessoa." },
    ],
    correta: "C",
    justificativa: "Permite compreender o feedback e dialogar sem concordância automática.",
  },
  {
    id: "q15", competencia: "feedback",
    enunciado: "Um profissional da equipe realizou um bom trabalho. Como oferecer um reconhecimento mais útil?",
    alternativas: [
      { id: "A", texto: "\"Parabéns.\"" },
      { id: "B", texto: "\"Você é o melhor da equipe.\"" },
      { id: "C", texto: "\"Sua organização dos dados facilitou a análise e ajudou a equipe a concluir o relatório dentro do prazo. Excelente trabalho.\"" },
      { id: "D", texto: "Não comentar, pois cumprir tarefas é uma obrigação." },
    ],
    correta: "C",
    justificativa: "Reconhecimento específico mostra qual comportamento teve impacto positivo.",
  },
  {
    id: "q16", competencia: "feedback",
    enunciado: "Você percebe que duas pessoas entenderam uma orientação de maneiras diferentes. O que fazer?",
    alternativas: [
      { id: "A", texto: "Esperar que resolvam sozinhas." },
      { id: "B", texto: "Reunir os envolvidos, esclarecer o objetivo e registrar os critérios combinados." },
      { id: "C", texto: "Escolher uma interpretação sem explicar." },
      { id: "D", texto: "Cancelar a atividade." },
    ],
    correta: "B",
    justificativa: "Promove alinhamento e reduz novos mal-entendidos.",
  },
  // COMPETÊNCIA 5 — Comunicação em situações difíceis
  {
    id: "q17", competencia: "dificeis",
    enunciado: "Um cliente está irritado porque houve atraso na entrega. Qual resposta é mais adequada?",
    alternativas: [
      { id: "A", texto: "\"O atraso não foi culpa minha.\"" },
      { id: "B", texto: "\"Você precisa ter paciência.\"" },
      { id: "C", texto: "\"Entendo sua insatisfação com o atraso. Vou verificar o status atualizado e retornar até as 15h com uma previsão confirmada ou os próximos passos.\"" },
      { id: "D", texto: "\"Não posso fazer nada.\"" },
    ],
    correta: "C",
    justificativa: "Reconhece o problema e estabelece uma ação concreta sem prometer o que ainda não foi confirmado.",
  },
  {
    id: "q18", competencia: "dificeis",
    enunciado: "Você discorda de uma decisão tomada por seu gestor. Qual abordagem é mais adequada?",
    alternativas: [
      { id: "A", texto: "Criticar a decisão publicamente." },
      { id: "B", texto: "Executar sem questionar, mesmo percebendo um risco importante." },
      { id: "C", texto: "Apresentar sua preocupação de maneira respeitosa, com argumentos e possíveis alternativas." },
      { id: "D", texto: "Ignorar a decisão." },
    ],
    correta: "C",
    justificativa: "Permite comunicar divergências de maneira profissional.",
  },
  {
    id: "q19", competencia: "dificeis",
    enunciado: "Durante uma conversa, outra pessoa começa a elevar o tom de voz. O que fazer?",
    alternativas: [
      { id: "A", texto: "Elevar o tom também." },
      { id: "B", texto: "Manter a comunicação respeitosa, estabelecer limites e propor retomar a conversa quando houver condições de diálogo." },
      { id: "C", texto: "Fazer comentários pessoais." },
      { id: "D", texto: "Concordar com tudo para encerrar rapidamente." },
    ],
    correta: "B",
    justificativa: "Preserva o respeito e estabelece limites apropriados.",
  },
  {
    id: "q20", competencia: "dificeis",
    enunciado: "Você percebe que transmitiu uma informação incorreta a um cliente. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Esperar que ele não perceba." },
      { id: "B", texto: "Corrigir apenas se ele perguntar." },
      { id: "C", texto: "Informar o erro assim que identificado, apresentar a informação correta e esclarecer possíveis impactos." },
      { id: "D", texto: "Atribuir o erro a outro profissional." },
    ],
    correta: "C",
    justificativa: "Demonstra transparência e responsabilidade.",
  },
];

const ITEM_POR_ID = Object.fromEntries(ITENS_COM.map((i) => [i.id, i]));

// Metadados das competências para o frontend.
export function competenciasPublicas() {
  return ORDEM_COMPETENCIAS.map((c) => ({
    chave: COMPETENCIAS_COM[c].chave,
    nome: COMPETENCIAS_COM[c].nome,
    cor: COMPETENCIAS_COM[c].cor,
  }));
}

// Itens públicos: enunciado + alternativas (id + texto), SEM `correta` nem
// `justificativa` e SEM a competência (spec, seções 2 e 11: gabarito não é
// exposto antes da conclusão).
export function itensPublicos() {
  return ITENS_COM.map((i) => ({
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
  for (const item of ITENS_COM) {
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
  for (const item of ITENS_COM) {
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
  for (const item of ITENS_COM) {
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
    versao: COM_VERSAO,
    instrumento: COM_INSTRUMENTO,
    idioma: COM_IDIOMA,
    fonte: COM_FONTE,
    gabaritoVersao: COM_GABARITO_VERSAO,
    algoritmo: COM_ALGORITMO,
    total: COM_TOTAL,
    acertos: acertosTotal,
    percentual: pct(acertosTotal, COM_TOTAL),
    competencias,
  };
}

// Revisão de respostas (spec, seção 6): só deve ser montada DEPOIS da conclusão.
// Para cada questão: situação, alternativas, letra escolhida, letra correta,
// justificativa e se acertou.
export function montarRevisao(respostas) {
  return ITENS_COM.map((item, i) => {
    const escolhida = respostas?.[item.id] ?? null;
    return {
      id: item.id,
      numero: i + 1,
      competencia: item.competencia,
      competenciaNome: COMPETENCIAS_COM[item.competencia].nome,
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
// acertos / para desenvolver) e revisão completa. Recebe o resultado calculado e
// as respostas (para montar a revisão). Nunca é exposto antes da conclusão.
// -----------------------------------------------------------------------------
export function montarRelatorio(resultado, respostas) {
  const dims = resultado?.competencias || {};
  const competencias = ORDEM_COMPETENCIAS.map((c) => {
    const meta = COMPETENCIAS_COM[c];
    const r = dims[c] || { acertos: 0, total: COM_QUESTOES_POR_COMPETENCIA, percentual: 0 };
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
  // "Para desenvolver" só quando há diferenciação (evita marcar tudo quando empatado).
  const desenvolver = max > min ? competencias.filter((c) => c.acertos === min).map((c) => c.chave) : [];

  return {
    instrumento: COM_INSTRUMENTO,
    fonte: COM_FONTE,
    experimental: COM_EXPERIMENTAL,
    gabaritoVersao: COM_GABARITO_VERSAO,
    total: resultado?.total ?? COM_TOTAL,
    acertos: resultado?.acertos ?? 0,
    percentual: resultado?.percentual ?? 0,
    notaGlobal: COM_NOTA_GLOBAL,
    tituloMaisAcertos: COM_TITULO_MAIS_ACERTOS,
    tituloDesenvolver: COM_TITULO_DESENVOLVER,
    competencias,
    maisAcertos,
    desenvolver,
    revisao: montarRevisao(respostas),
  };
}

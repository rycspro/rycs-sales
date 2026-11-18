// =============================================================================
// Resolução de Problemas e Tomada de Decisão — avaliação SITUACIONAL autoral.
//
// 20 situações profissionais, 4 alternativas, UMA resposta preferencial. Cinco
// competências de 4 questões: identificação de problemas, análise de causas,
// tomada de decisão, priorização e avaliação de soluções.
//
// NÃO é instrumento psicométrico validado nem medição definitiva de competência
// profissional. Mede o reconhecimento de boas práticas NESTE conjunto de
// cenários. Sem percentil nem comparação populacional. Não deve ser usada
// isoladamente para decisões automatizadas de contratação.
//
// SEGURANÇA: a resposta preferencial (`correta`) e a justificativa vivem só no
// servidor. O frontend recebe apenas os itens públicos (situação + alternativas)
// via `itensPublicos()`. A correção SEMPRE usa o gabarito oficial daqui.
//
// I18N: identificadores (versão, ids, competências) estáveis; alternativas usam
// ids "A".."D" (rótulos da spec), independentes de idioma.
// =============================================================================

export const RP_VERSAO = "rycs-resolucao-problemas-v1-20";
export const RP_INSTRUMENTO = "Resolução de Problemas e Tomada de Decisão (RYCS, autoral)";
export const RP_IDIOMA = "pt-BR";
export const RP_FONTE = "Instrumento autoral RYCS";
export const RP_CHAVE = "rycs-rp-gabarito-v1";
export const RP_ALGORITMO = "acertos-v1";
export const RP_TOTAL = 20;
export const RP_EXPERIMENTAL = true;

export const RP_PENDENCIAS = [
  "Avaliação situacional autoral: não é instrumento psicométrico validado nem medição definitiva de competência profissional.",
  "O percentual reflete o reconhecimento de boas práticas neste conjunto de cenários; não é percentil populacional nem certificação.",
  "Não deve ser usada isoladamente para decisões automatizadas de contratação.",
];

// Flag de disponibilização. LIGADA por padrão (como as demais avaliações
// publicadas). Desligue com RESOLUCAO_DISPONIVEL=0 para revisão interna.
export const resolucaoDisponivel = () =>
  String(process.env.RESOLUCAO_DISPONIVEL ?? "1").trim() !== "0";

// -----------------------------------------------------------------------------
// As cinco competências, na ordem de apresentação. `desenvolvimento` traz a
// sugestão prática exibida como oportunidade de desenvolvimento (spec, seção 7).
// -----------------------------------------------------------------------------
export const ORDEM_COMPETENCIAS = ["identificacao", "causas", "decisao", "priorizacao", "avaliacao"];

export const COMPETENCIAS = {
  identificacao: {
    chave: "identificacao",
    nome: "Identificação de problemas",
    cor: "#318CE7",
    descricao: "Compreender o que está acontecendo antes de propor soluções.",
    desenvolvimento: "Procure compreender o que está acontecendo antes de propor soluções. Utilize registros, indicadores e observações.",
  },
  causas: {
    chave: "causas",
    nome: "Análise de causas",
    cor: "#318CE7",
    descricao: "Investigar hipóteses e buscar evidências das causas mais prováveis.",
    desenvolvimento: "Investigue diferentes hipóteses e busque evidências que ajudem a identificar as causas mais prováveis.",
  },
  decisao: {
    chave: "decisao",
    nome: "Tomada de decisão",
    cor: "#318CE7",
    descricao: "Comparar alternativas por requisitos, riscos, benefícios e informações.",
    desenvolvimento: "Compare alternativas com base em requisitos, riscos, benefícios e informações disponíveis.",
  },
  priorizacao: {
    chave: "priorizacao",
    nome: "Priorização",
    cor: "#318CE7",
    descricao: "Organizar atividades por impacto, urgência, dependências e capacidade.",
    desenvolvimento: "Considere impacto, urgência, dependências e capacidade antes de organizar suas atividades.",
  },
  avaliacao: {
    chave: "avaliacao",
    nome: "Avaliação de soluções",
    cor: "#318CE7",
    descricao: "Acompanhar indicadores e verificar efeitos positivos e negativos de uma mudança.",
    desenvolvimento: "Depois de implementar uma mudança, acompanhe indicadores e verifique seus efeitos positivos e negativos.",
  },
};

export const RP_NOTA_GLOBAL =
  "O percentual mede o reconhecimento de boas práticas neste conjunto de situações, " +
  "não um instrumento psicométrico validado, certificação de competência ou percentil populacional. " +
  "Avaliação autoral RYCS, voluntária; não deve ser usada isoladamente para decisões automatizadas de contratação.";

// -----------------------------------------------------------------------------
// Banco de situações (v1). `correta` e `explicacao` SÓ no servidor.
// Gabarito conferido contra a justificativa de cada situação.
// -----------------------------------------------------------------------------
export const ITENS_RP = [
  // ---- Competência 1: identificação de problemas (q01–q04) ----
  {
    id: "q01", competencia: "identificacao",
    enunciado: "Uma equipe apresenta queda nos resultados há três semanas. O gestor acredita que o problema é falta de esforço, mas ainda não analisou os indicadores. Qual é a melhor primeira ação?",
    alternativas: [
      { id: "A", texto: "Cobrar mais produtividade imediatamente." },
      { id: "B", texto: "Substituir os profissionais com menor resultado." },
      { id: "C", texto: "Analisar indicadores e identificar em qual etapa ocorreu a queda antes de definir ações." },
      { id: "D", texto: "Aumentar a meta para estimular a equipe." },
    ],
    correta: "C",
    explicacao: "Compreender o problema com evidências reduz decisões precipitadas.",
  },
  {
    id: "q02", competencia: "identificacao",
    enunciado: "Um cliente relata que recebeu informações diferentes de dois atendentes. Qual deve ser a primeira providência?",
    alternativas: [
      { id: "A", texto: "Escolher uma das informações e repassá-la." },
      { id: "B", texto: "Verificar os registros e a orientação oficial antes de corrigir a comunicação." },
      { id: "C", texto: "Informar que o cliente compreendeu errado." },
      { id: "D", texto: "Solicitar que o cliente entre em contato novamente." },
    ],
    correta: "B",
    explicacao: "É necessário identificar a informação correta e a origem da divergência.",
  },
  {
    id: "q03", competencia: "identificacao",
    enunciado: "Um processo que normalmente leva 20 minutos passou a levar 40 minutos. O que fazer primeiro?",
    alternativas: [
      { id: "A", texto: "Exigir que todos trabalhem mais rápido." },
      { id: "B", texto: "Eliminar etapas sem análise." },
      { id: "C", texto: "Mapear as etapas e identificar onde o tempo adicional está sendo consumido." },
      { id: "D", texto: "Aceitar que o processo ficou mais demorado." },
    ],
    correta: "C",
    explicacao: "Mapear o processo permite localizar o gargalo.",
  },
  {
    id: "q04", competencia: "identificacao",
    enunciado: "Uma empresa recebe reclamações recorrentes sobre atrasos. Os registros mostram que os pedidos são concluídos no prazo, mas demoram para ser enviados. Qual é o problema mais provável a investigar?",
    alternativas: [
      { id: "A", texto: "A produtividade de quem prepara os pedidos." },
      { id: "B", texto: "O processo entre a conclusão do pedido e seu envio." },
      { id: "C", texto: "A qualidade do produto." },
      { id: "D", texto: "A quantidade de pedidos recebidos." },
    ],
    correta: "B",
    explicacao: "Os dados apontam para a etapa de expedição.",
  },

  // ---- Competência 2: análise de causas (q05–q08) ----
  {
    id: "q05", competencia: "causas",
    enunciado: "Uma equipe passou a cometer mais erros após a implantação de um novo sistema. Qual investigação é mais adequada?",
    alternativas: [
      { id: "A", texto: "Concluir que os profissionais não se esforçam." },
      { id: "B", texto: "Verificar mudanças no fluxo, treinamento recebido e dificuldades de utilização." },
      { id: "C", texto: "Cancelar o sistema imediatamente." },
      { id: "D", texto: "Ignorar os erros até a equipe se adaptar." },
    ],
    correta: "B",
    explicacao: "Examina possíveis causas antes de escolher uma intervenção.",
  },
  {
    id: "q06", competencia: "causas",
    enunciado: "Uma campanha passou a receber menos contatos. O orçamento permaneceu igual, mas a página de cadastro foi alterada recentemente. Qual ação inicial faz mais sentido?",
    alternativas: [
      { id: "A", texto: "Aumentar o orçamento." },
      { id: "B", texto: "Comparar os indicadores antes e depois da alteração e verificar se houve queda na conversão da página." },
      { id: "C", texto: "Substituir toda a equipe comercial." },
      { id: "D", texto: "Encerrar a campanha sem investigar." },
    ],
    correta: "B",
    explicacao: "Compara uma mudança recente com os indicadores relevantes, sem presumir causalidade.",
  },
  {
    id: "q07", competencia: "causas",
    enunciado: "Um relatório contém erros frequentes. Os erros aparecem principalmente quando informações são copiadas manualmente entre sistemas. Qual hipótese deve ser investigada primeiro?",
    alternativas: [
      { id: "A", texto: "Falta de motivação da equipe." },
      { id: "B", texto: "Problemas na transferência manual de dados." },
      { id: "C", texto: "Falta de reuniões." },
      { id: "D", texto: "Baixa qualidade dos computadores, independentemente de evidências." },
    ],
    correta: "B",
    explicacao: "A concentração dos erros indica uma etapa específica a investigar.",
  },
  {
    id: "q08", competencia: "causas",
    enunciado: "Os atrasos de uma equipe aumentam sempre que há grande volume de solicitações. Qual análise ajudaria mais?",
    alternativas: [
      { id: "A", texto: "Verificar capacidade, volume de entrada e tempo médio de execução nos períodos de pico." },
      { id: "B", texto: "Pedir que todos sejam mais rápidos." },
      { id: "C", texto: "Diminuir a comunicação entre os profissionais." },
      { id: "D", texto: "Ignorar os períodos de maior demanda." },
    ],
    correta: "A",
    explicacao: "Permite identificar se existe incompatibilidade entre demanda e capacidade.",
  },

  // ---- Competência 3: tomada de decisão (q09–q12) ----
  {
    id: "q09", competencia: "decisao",
    enunciado: "Você precisa escolher entre duas ferramentas. A ferramenta A custa menos, mas não atende a um requisito obrigatório. A ferramenta B custa mais, mas atende a todos os requisitos e cabe no orçamento aprovado. Qual decisão é mais adequada?",
    alternativas: [
      { id: "A", texto: "Escolher A porque custa menos." },
      { id: "B", texto: "Escolher B porque atende aos requisitos obrigatórios e ao orçamento." },
      { id: "C", texto: "Escolher aleatoriamente." },
      { id: "D", texto: "Escolher A e ignorar o requisito." },
    ],
    correta: "B",
    explicacao: "Requisitos obrigatórios devem ser considerados antes do preço isoladamente.",
  },
  {
    id: "q10", competencia: "decisao",
    enunciado: "Uma decisão importante precisa ser tomada, mas existem informações insuficientes e o prazo permite uma verificação rápida. O que fazer?",
    alternativas: [
      { id: "A", texto: "Decidir sem considerar os dados disponíveis." },
      { id: "B", texto: "Adiar indefinidamente." },
      { id: "C", texto: "Identificar a informação crítica que falta, verificá-la e decidir dentro do prazo." },
      { id: "D", texto: "Transferir a decisão sem explicar o problema." },
    ],
    correta: "C",
    explicacao: "Equilibra qualidade da informação e prazo.",
  },
  {
    id: "q11", competencia: "decisao",
    enunciado: "Uma solução reduz custos, mas cria um risco relevante de exposição de dados de clientes. Qual atitude é mais adequada?",
    alternativas: [
      { id: "A", texto: "Implementar porque a economia é importante." },
      { id: "B", texto: "Avaliar o risco, buscar alternativas seguras e não implementar a solução insegura sem tratamento adequado." },
      { id: "C", texto: "Ocultar o risco." },
      { id: "D", texto: "Deixar que cada profissional decida individualmente." },
    ],
    correta: "B",
    explicacao: "Economia não justifica ignorar riscos relevantes de segurança e privacidade.",
  },
  {
    id: "q12", competencia: "decisao",
    enunciado: "Uma empresa precisa selecionar um fornecedor. Dois fornecedores atendem aos requisitos e possuem preços semelhantes. Qual abordagem é mais adequada?",
    alternativas: [
      { id: "A", texto: "Escolher o primeiro que responder." },
      { id: "B", texto: "Comparar critérios relevantes, como confiabilidade, suporte, prazos e histórico de entrega." },
      { id: "C", texto: "Escolher apenas pela aparência do site." },
      { id: "D", texto: "Escolher sem registrar os critérios." },
    ],
    correta: "B",
    explicacao: "Critérios comparáveis tornam a decisão mais fundamentada.",
  },

  // ---- Competência 4: priorização (q13–q16) ----
  {
    id: "q13", competencia: "priorizacao",
    enunciado: "Você possui três tarefas — Tarefa A: corrigir uma falha que impede clientes de concluir pagamentos; Tarefa B: atualizar uma apresentação interna; Tarefa C: organizar arquivos antigos. Qual deve receber prioridade?",
    alternativas: [
      { id: "A", texto: "Tarefa C." },
      { id: "B", texto: "Tarefa B." },
      { id: "C", texto: "Tarefa A." },
      { id: "D", texto: "Executar todas simultaneamente." },
    ],
    correta: "C",
    explicacao: "A falha afeta diretamente uma operação crítica.",
  },
  {
    id: "q14", competencia: "priorizacao",
    enunciado: "Você recebeu cinco solicitações urgentes, mas não consegue concluir todas no prazo. Qual é a melhor abordagem?",
    alternativas: [
      { id: "A", texto: "Prometer que entregará tudo." },
      { id: "B", texto: "Organizar as demandas por impacto, prazo e dependências, alinhando prioridades com os responsáveis." },
      { id: "C", texto: "Escolher somente as mais fáceis." },
      { id: "D", texto: "Ignorar as solicitações mais complexas." },
    ],
    correta: "B",
    explicacao: "Priorização transparente reduz riscos e expectativas incorretas.",
  },
  {
    id: "q15", competencia: "priorizacao",
    enunciado: "Uma tarefa importante depende de uma informação que outro setor ainda não enviou. O que fazer?",
    alternativas: [
      { id: "A", texto: "Permanecer parado até receber a informação." },
      { id: "B", texto: "Inventar a informação." },
      { id: "C", texto: "Solicitar a informação necessária, comunicar a dependência e avançar em atividades independentes." },
      { id: "D", texto: "Cancelar a tarefa." },
    ],
    correta: "C",
    explicacao: "Permite administrar dependências sem comprometer a qualidade.",
  },
  {
    id: "q16", competencia: "priorizacao",
    enunciado: "Uma equipe tem capacidade para concluir apenas uma das duas atividades hoje — Atividade A: prazo amanhã, impacto baixo; Atividade B: prazo hoje, impacto alto e bloqueia o trabalho de outros setores. Qual priorizar?",
    alternativas: [
      { id: "A", texto: "Atividade A." },
      { id: "B", texto: "Atividade B." },
      { id: "C", texto: "Escolher por sorteio." },
      { id: "D", texto: "Não concluir nenhuma." },
    ],
    correta: "B",
    explicacao: "Considera prazo, impacto e dependências.",
  },

  // ---- Competência 5: avaliação de soluções (q17–q20) ----
  {
    id: "q17", competencia: "avaliacao",
    enunciado: "Uma empresa implementou uma mudança para reduzir o tempo de atendimento. Como verificar se a solução funcionou?",
    alternativas: [
      { id: "A", texto: "Considerar que funcionou porque foi implementada." },
      { id: "B", texto: "Comparar o tempo de atendimento antes e depois, considerando volume, qualidade e outros fatores relevantes." },
      { id: "C", texto: "Perguntar apenas ao gestor se gostou." },
      { id: "D", texto: "Esperar vários meses sem acompanhar indicadores." },
    ],
    correta: "B",
    explicacao: "Utiliza indicadores e considera possíveis efeitos indesejados.",
  },
  {
    id: "q18", competencia: "avaliacao",
    enunciado: "Uma nova rotina reduziu erros, mas aumentou muito o tempo necessário para concluir as tarefas. Qual é a melhor atitude?",
    alternativas: [
      { id: "A", texto: "Manter a rotina sem avaliar o impacto." },
      { id: "B", texto: "Cancelar imediatamente todas as melhorias." },
      { id: "C", texto: "Avaliar o equilíbrio entre redução de erros, tempo e custos, buscando ajustes." },
      { id: "D", texto: "Ignorar a redução de erros." },
    ],
    correta: "C",
    explicacao: "Considera benefícios e efeitos negativos da solução.",
  },
  {
    id: "q19", competencia: "avaliacao",
    enunciado: "Uma solução foi testada com sucesso por uma pequena equipe. A empresa deseja aplicá-la a todos os setores. Qual abordagem é mais adequada?",
    alternativas: [
      { id: "A", texto: "Expandir imediatamente sem acompanhamento." },
      { id: "B", texto: "Planejar a expansão, verificar diferenças entre setores e acompanhar os resultados." },
      { id: "C", texto: "Considerar que o sucesso inicial garante o mesmo resultado em qualquer contexto." },
      { id: "D", texto: "Encerrar o projeto." },
    ],
    correta: "B",
    explicacao: "Resultados de um piloto precisam ser acompanhados na expansão.",
  },
  {
    id: "q20", competencia: "avaliacao",
    enunciado: "Após uma mudança, o indicador principal melhorou, mas aumentaram as reclamações de clientes. O que fazer?",
    alternativas: [
      { id: "A", texto: "Considerar a mudança um sucesso definitivo." },
      { id: "B", texto: "Ignorar as reclamações." },
      { id: "C", texto: "Investigar os efeitos sobre a experiência do cliente e ajustar a solução considerando os diferentes indicadores." },
      { id: "D", texto: "Eliminar o acompanhamento dos indicadores." },
    ],
    correta: "C",
    explicacao: "Uma solução deve ser avaliada por seus efeitos relevantes, não por uma única métrica.",
  },
];

const ITEM_POR_ID = Object.fromEntries(ITENS_RP.map((i) => [i.id, i]));
const OPCOES_VALIDAS = Object.fromEntries(
  ITENS_RP.map((i) => [i.id, new Set(i.alternativas.map((a) => a.id))])
);

export function competenciasPublicas() {
  return ORDEM_COMPETENCIAS.map((c) => ({
    chave: COMPETENCIAS[c].chave,
    nome: COMPETENCIAS[c].nome,
    cor: COMPETENCIAS[c].cor,
    descricao: COMPETENCIAS[c].descricao,
  }));
}

// Itens públicos: situação + alternativas (id + texto), SEM `correta` nem
// `explicacao`. É o que o cliente recebe para responder.
export function itensPublicos() {
  return ITENS_RP.map((i) => ({
    id: i.id,
    competencia: i.competencia,
    enunciado: i.enunciado,
    alternativas: i.alternativas.map((a) => ({ id: a.id, texto: a.texto })),
  }));
}

function respostaValida(id, valor) {
  return typeof valor === "string" && OPCOES_VALIDAS[id]?.has(valor);
}

export function sanearRespostas(respostas) {
  const limpas = {};
  if (!respostas || typeof respostas !== "object") return limpas;
  for (const [id, valor] of Object.entries(respostas)) {
    if (respostaValida(id, valor)) limpas[id] = valor;
  }
  return limpas;
}

export function contarRespondidos(respostas) {
  if (!respostas || typeof respostas !== "object") return 0;
  let n = 0;
  for (const item of ITENS_RP) {
    if (respostaValida(item.id, respostas[item.id])) n += 1;
  }
  return n;
}

export function validarRespostas(respostas) {
  if (!respostas || typeof respostas !== "object")
    return { ok: false, codigo: "FORMATO", erro: "Respostas ausentes ou inválidas." };

  const faltando = [];
  for (const item of ITENS_RP) {
    if (!respostaValida(item.id, respostas[item.id])) faltando.push(item.id);
  }
  if (faltando.length)
    return { ok: false, codigo: "INCOMPLETO", erro: `Faltam ${faltando.length} respostas.`, faltando };

  for (const id of Object.keys(respostas)) {
    if (!ITEM_POR_ID[id])
      return { ok: false, codigo: "ITEM_INVALIDO", erro: `Situação desconhecida: ${id}.` };
  }
  return { ok: true };
}

// Correção: compara cada resposta com a preferencial. Acertos por competência
// (0–4), total (0–20) e percentual. Sem percentil/psicometria.
export function calcularResultado(respostas) {
  const comp = {};
  for (const c of ORDEM_COMPETENCIAS) comp[c] = { acertos: 0, total: 0 };

  let acertosTotais = 0;
  for (const item of ITENS_RP) {
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
    versao: RP_VERSAO,
    chave: RP_CHAVE,
    algoritmo: RP_ALGORITMO,
    totalQuestoes: RP_TOTAL,
    acertosTotais,
    percentual: Math.round((acertosTotais / RP_TOTAL) * 100),
    competencias,
  };
}

// Relatório pós-conclusão: cartões por competência (com sugestão de
// desenvolvimento), destaques e REVISÃO situação a situação com a resposta
// preferencial e a justificativa. Só é chamado após a conclusão.
export function montarRelatorio(resultado, respostas = {}) {
  const comps = resultado?.competencias || {};
  const competencias = ORDEM_COMPETENCIAS.map((c) => {
    const meta = COMPETENCIAS[c];
    const r = comps[c] || { acertos: 0, total: 4, percentual: 0 };
    return {
      chave: c, nome: meta.nome, cor: meta.cor, descricao: meta.descricao,
      desenvolvimento: meta.desenvolvimento,
      acertos: r.acertos, total: r.total, percentual: r.percentual,
    };
  });

  const maxAcertos = Math.max(...competencias.map((c) => c.acertos));
  const minAcertos = Math.min(...competencias.map((c) => c.acertos));
  const fortes = competencias.filter((c) => c.acertos === maxAcertos).map((c) => c.nome);
  // Oportunidades: competências com menos acertos, com sugestão prática (seção 7).
  const desenvolver = maxAcertos !== minAcertos
    ? competencias.filter((c) => c.acertos === minAcertos).map((c) => ({ nome: c.nome, sugestao: c.desenvolvimento }))
    : [];

  const revisao = ITENS_RP.map((item, i) => ({
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
    instrumento: RP_INSTRUMENTO,
    fonte: RP_FONTE,
    experimental: RP_EXPERIMENTAL,
    notaGlobal: RP_NOTA_GLOBAL,
    acertosTotais: resultado?.acertosTotais ?? 0,
    totalQuestoes: resultado?.totalQuestoes ?? RP_TOTAL,
    percentual: resultado?.percentual ?? 0,
    competencias,
    analise: { fortes, desenvolver },
    revisao,
  };
}

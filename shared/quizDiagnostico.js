// Quiz de qualificação das empresas que chegam pelos anúncios da RYCS
// (app.rycs.pro/diagnostico). Base: planilha "RYCS - Qualificação de Leads".
//
// v3 (pedido do dono da RYCS): 7 telas. Perguntas específicas no lugar das
// genéricas — ticket médio e vendas por mês em vez de "quanto fatura", custo
// real de um vendedor (fixo, comissão e total) em vez de "quanto investiria".
// Os cards usam elementos 3D (Fluent Emoji 3D, licença MIT).
//
// Regras:
// - `nivel` (5 = sinal mais forte, 1 = mais fraco) é a escala da planilha.
//   Só o closer vê, campo a campo. Não existe nota única nem probabilidade.
// - Os ids de campo e de opção são o contrato com o servidor. Mudou um texto?
//   Pode. Mudou o sentido? Crie um id novo e troque QUIZ_VERSAO. As reuniões
//   guardam o texto que a pessoa leu, então o histórico não muda.
// - Separado de shared/qualificacaoEmpresa.js (Lead Ads da Meta).

export const QUIZ_VERSAO = "2026-11-22-v3";
// Durações que o closer pode escolher ao abrir horários (minutos).
export const DURACOES_AGENDA = [15, 20, 30, 45, 60];

// Elementos 3D (Fluent Emoji 3D, MIT), versão fixa no CDN.
export const icone3d = (codigo) => `https://cdn.jsdelivr.net/npm/@lobehub/fluent-emoji-3d@1.1.0/assets/${codigo}.webp`;

// Etapas só agrupam as respostas no painel do closer.
export const ETAPAS_QUIZ = [
  { chave: "dor", titulo: "Dor" },
  { chave: "numeros", titulo: "Vendas e custo do vendedor" },
  { chave: "decisao", titulo: "Prazo e decisão" },
];

// Telas do quiz. `cards`: um campo, escolhe um card e avança sozinho.
// `seletores`: vários campos na mesma tela, um seletor por linha.
export const PASSOS_QUIZ = [
  {
    id: "dor", tipo: "cards",
    titulo: "O que mais está travando suas vendas hoje?",
    ajuda: "Escolha o que mais dói agora.",
    campos: [{
      id: "dor", etapa: "dor", criterio: "Dor comercial", titulo: "O que mais está travando suas vendas hoje?",
      opcoes: [
        { id: "cobrar-vendedor", texto: "Cobro o vendedor o tempo todo", detalhe: "Sem cobrança, ninguém vende", icone: "23f0", nivel: 5 },
        { id: "meta-nao-batida", texto: "A meta não é batida", detalhe: "Fica no papel todo mês", icone: "1f3af", nivel: 5 },
        { id: "sem-resposta", texto: "Contatos sem resposta", detalhe: "Mensagens esperando horas", icone: "1f4ac", nivel: 5 },
        { id: "orcamentos-parados", texto: "Orçamentos parados", detalhe: "Ninguém cobra quem pediu preço", icone: "1f9fe", nivel: 5 },
        { id: "poucos-clientes", texto: "Poucos clientes novos", detalhe: "A procura caiu ou não decolou", icone: "1f9f2", nivel: 5 },
        { id: "dono-sozinho", texto: "O dono vende sozinho", detalhe: "Não sobra tempo para crescer", icone: "1f939", nivel: 5 },
      ],
    }],
  },
  {
    id: "impacto", tipo: "cards",
    titulo: "Se nada mudar em 3 meses, o que acontece?",
    ajuda: "Pense no que já está em jogo.",
    campos: [{
      id: "impacto", etapa: "dor", criterio: "Urgência · custo de adiar", titulo: "Se nada mudar em 3 meses, o que acontece?",
      opcoes: [
        { id: "caixa", texto: "O caixa aperta", detalhe: "Precisamos dessa receita já", icone: "1f4b8", nivel: 5 },
        { id: "perde-pico", texto: "Vou perder o pico de vendas", detalhe: "A melhor época passa", icone: "1f4c9", nivel: 5 },
        { id: "concorrencia", texto: "A concorrência leva", detalhe: "Fecham com quem responde antes", icone: "1f94a", nivel: 4 },
        { id: "da-para-segurar", texto: "Dá para segurar", detalhe: "Mas a empresa cresce menos", icone: "1f331", nivel: 2 },
      ],
    }],
  },
  {
    id: "prazo", tipo: "cards",
    titulo: "Até quando vocês querem resolver isso?",
    ajuda: "Quanto antes começar, antes as vendas aparecem.",
    campos: [{
      id: "prazo", etapa: "decisao", criterio: "Urgência · prazo para resolver", titulo: "Até quando vocês querem resolver isso?",
      opcoes: [
        { id: "imediatamente", texto: "Imediatamente", detalhe: "Nas próximas 48 horas", icone: "1f680", nivel: 5 },
        { id: "7-dias", texto: "Em até 7 dias", detalhe: "Ainda nesta semana", icone: "1f4c5", nivel: 4 },
        { id: "30-dias", texto: "Em até 30 dias", detalhe: "Ainda neste mês", icone: "1f5d3-fe0f", nivel: 3 },
        { id: "sem-prazo", texto: "Sem prazo definido", detalhe: "Estou avaliando com calma", icone: "23f3", nivel: 1 },
      ],
    }],
  },
  {
    id: "vendas", tipo: "seletores", icone: "1f4ca",
    titulo: "Quanto você ganha por venda hoje?",
    ajuda: "Escolha o valor médio de cada venda e quantas vendas vocês fazem por mês.",
    campos: [
      {
        id: "ticket", etapa: "numeros", criterio: "Potencial financeiro · ticket médio", titulo: "Ticket médio (valor de cada venda)",
        opcoes: [
          { id: "ate-500", texto: "Até R$ 500", nivel: 2 },
          { id: "500-1mil", texto: "R$ 500 a 1 mil", nivel: 3 },
          { id: "1mil-1500", texto: "R$ 1 mil a 1,5 mil", nivel: 3 },
          { id: "1500-5mil", texto: "R$ 1,5 mil a 5 mil", nivel: 4 },
          { id: "acima-5mil", texto: "Acima de R$ 5 mil", nivel: 5 },
        ],
      },
      {
        id: "vendas-mes", etapa: "numeros", criterio: "Potencial financeiro · volume", titulo: "Vendas por mês, hoje",
        opcoes: [
          { id: "1-10", texto: "1 a 10", nivel: 2 },
          { id: "11-20", texto: "11 a 20", nivel: 3 },
          { id: "21-30", texto: "21 a 30", nivel: 3 },
          { id: "31-50", texto: "31 a 50", nivel: 4 },
          { id: "mais-50", texto: "Mais de 50", nivel: 5 },
        ],
      },
    ],
  },
  {
    id: "vendedor", tipo: "seletores", icone: "1f4bc",
    titulo: "Quanto custa um vendedor na sua equipe?",
    ajuda: "Se ainda não tem vendedor, responda quanto pagaria.",
    campos: [
      {
        id: "salario-fixo", etapa: "numeros", criterio: "Capacidade de investimento · fixo", titulo: "Salário fixo do vendedor",
        opcoes: [
          { id: "sem-fixo", texto: "Sem fixo" },
          { id: "ate-2mil", texto: "Até R$ 2 mil" },
          { id: "2-3mil", texto: "R$ 2 a 3 mil" },
          { id: "3-5mil", texto: "R$ 3 a 5 mil" },
          { id: "acima-5mil", texto: "Acima de R$ 5 mil" },
        ],
      },
      {
        id: "comissao", etapa: "numeros", criterio: "Capacidade de investimento · comissão", titulo: "Comissão do vendedor",
        opcoes: [
          { id: "sem-comissao", texto: "Sem comissão" },
          { id: "ate-3", texto: "Até 3%" },
          { id: "3-5", texto: "3% a 5%" },
          { id: "5-10", texto: "5% a 10%" },
          { id: "acima-10", texto: "Acima de 10%" },
        ],
      },
      {
        id: "custo-total", etapa: "numeros", criterio: "Capacidade de investimento · total", titulo: "No total, por mês, em média (fixo + comissão)",
        opcoes: [
          { id: "ate-3mil", texto: "Até R$ 3 mil", nivel: 2 },
          { id: "3-5mil", texto: "R$ 3 a 5 mil", nivel: 3 },
          { id: "5-8mil", texto: "R$ 5 a 8 mil", nivel: 4 },
          { id: "acima-8mil", texto: "Acima de R$ 8 mil", nivel: 5 },
        ],
      },
    ],
  },
  {
    id: "decisor", tipo: "cards",
    titulo: "Quem decide essa contratação?",
    ajuda: "Assim a reunião já conta com as pessoas certas.",
    campos: [{
      id: "decisor", etapa: "decisao", criterio: "Poder de decisão", titulo: "Quem decide essa contratação?",
      opcoes: [
        { id: "eu", texto: "Eu decido", detalhe: "A palavra final é minha", icone: "1f451", nivel: 5 },
        { id: "socio", texto: "Eu e meu sócio(a)", detalhe: "Decidimos juntos", icone: "1f91d", nivel: 4 },
        { id: "indico", texto: "Eu indico, outra pessoa aprova", detalhe: "Levo a proposta adiante", icone: "1f4e8", nivel: 3 },
        { id: "diretoria", texto: "Diretoria ou matriz", detalhe: "Passa por aprovação interna", icone: "1f3e2", nivel: 2 },
      ],
    }],
  },
  {
    id: "contratar", tipo: "cards",
    titulo: "Se fizer sentido, quando você pretende contratar seu time de vendas?",
    ajuda: "Última pergunta!",
    campos: [{
      id: "contratar", etapa: "decisao", criterio: "Disposição para fechar", titulo: "Se fizer sentido, quando você pretende contratar seu time de vendas?",
      opcoes: [
        { id: "na-reuniao", texto: "Fecho imediatamente", detalhe: "Já na reunião", icone: "26a1", nivel: 5 },
        { id: "7-dias", texto: "Em até 7 dias", detalhe: "Preciso de poucos dias", icone: "270d-fe0f", nivel: 4 },
        { id: "30-dias", texto: "Em até 30 dias", detalhe: "Tenho prioridades antes", icone: "1f4c6", nivel: 3 },
        { id: "pesquisando", texto: "Só estou pesquisando", detalhe: "Ainda comparando opções", icone: "1f50e", nivel: 1 },
      ],
    }],
  },
];

// Contrato com o servidor: a lista de campos respondidos (uma tela de
// seletores tem vários campos).
export const PERGUNTAS_QUIZ = PASSOS_QUIZ.flatMap((p) => p.campos.map((c) => ({ ...c, icone: c.icone || p.icone })));

// Leitura do closer: cada dimensão mostra as respostas que a compõem, sem
// juntar tudo numa nota. Urgência alta com custo baixo continua visível como
// as duas coisas que são.
export const DIMENSOES_QUIZ = [
  { chave: "dor", titulo: "Dor", perguntas: ["dor", "impacto"] },
  { chave: "urgencia", titulo: "Urgência", perguntas: ["prazo", "contratar"] },
  { chave: "vendas", titulo: "Vendas hoje", perguntas: ["ticket", "vendas-mes"] },
  { chave: "vendedor", titulo: "Custo do vendedor", perguntas: ["salario-fixo", "comissao", "custo-total"] },
  { chave: "decisao", titulo: "Decisão", perguntas: ["decisor"] },
];

// Como a reunião acontece. Sem link de videochamada inventado: o
// especialista usa o WhatsApp que a empresa informou.
export const COMO_ACONTECE = "No horário marcado, um especialista da RYCS chama você no WhatsApp informado. A reunião acontece por ligação ou chamada de vídeo, como você preferir.";

// Respostas do navegador ({ campoId: opcaoId }) → registro completo, com o
// texto exatamente como a pessoa leu. Qualquer resposta faltando ou
// desconhecida invalida o conjunto.
export function registrarRespostas(entrada) {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return null;
  const registro = [];
  for (const p of PERGUNTAS_QUIZ) {
    const opcao = p.opcoes.find((o) => o.id === entrada[p.id]);
    if (!opcao) return null;
    registro.push({
      id: p.id, etapa: p.etapa, criterio: p.criterio, pergunta: p.titulo,
      opcao: opcao.id, resposta: opcao.detalhe ? `${opcao.texto} (${opcao.detalhe.toLowerCase()})` : opcao.texto,
      ...(opcao.nivel && { nivel: opcao.nivel }),
    });
  }
  return registro;
}

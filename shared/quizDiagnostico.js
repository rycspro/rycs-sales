// Quiz de qualificação das empresas que chegam pelos anúncios da RYCS
// (app.rycs.pro/diagnostico). Base: planilha "RYCS - Qualificação de Leads".
// Versão curta (v2, pedido do dono da RYCS): 7 perguntas com o que mais pesa
// para fechar — dor real, custo de adiar, urgência, faturamento, quanto
// investiria, quem decide e quando fecha.
//
// Regras:
// - `nivel` (5 = sinal mais forte, 1 = mais fraco) é a escala da planilha.
//   Só o closer vê, critério a critério. Não existe nota única nem
//   probabilidade de fechamento.
// - Os ids de pergunta e de opção são o contrato com o servidor. Mudou um
//   texto? Pode. Mudou o sentido? Crie um id novo. As reuniões já marcadas
//   guardam o texto que a pessoa leu, então o histórico não muda.
// - Este quiz é separado de shared/qualificacaoEmpresa.js, que serve aos
//   formulários de Lead Ads da Meta.

export const QUIZ_VERSAO = "2026-11-22-v2";
// Durações que o closer pode escolher ao abrir horários (minutos).
export const DURACOES_AGENDA = [15, 20, 30, 45, 60];

// Fotos do Unsplash (licença livre), servidas pelo próprio Unsplash.
export const fotoUnsplash = (id, w = 480, h = 340) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=60`;

// Etapas só agrupam as respostas no painel do closer.
export const ETAPAS_QUIZ = [
  { chave: "dor", titulo: "Dor" },
  { chave: "numeros", titulo: "Números" },
  { chave: "decisao", titulo: "Prazo e decisão" },
];

// 7 perguntas: dor real, custo de adiar, urgência, faturamento, quanto
// investiria, quem decide e quando fecha. Cada opção tem foto.
export const PERGUNTAS_QUIZ = [
  {
    id: "dor",
    etapa: "dor",
    criterio: "Dor comercial",
    titulo: "O que mais está travando suas vendas hoje?",
    ajuda: "Escolha o que mais dói agora.",
    opcoes: [
      { id: "poucos-clientes", texto: "Poucos clientes novos", detalhe: "A procura caiu ou nunca decolou", foto: "photo-1758030320753-dbfce21007b2", nivel: 5 },
      { id: "sem-resposta", texto: "Contatos sem resposta", detalhe: "Mensagens e pedidos esperando horas", foto: "photo-1554672408-17407e0322ce", nivel: 5 },
      { id: "orcamentos-parados", texto: "Orçamentos parados", detalhe: "Ninguém cobra quem pediu preço", foto: "photo-1583521214690-73421a1829a9", nivel: 5 },
      { id: "dono-sozinho", texto: "O dono vende sozinho", detalhe: "Não sobra tempo para vender mais", foto: "photo-1620809975674-10b8ff5f8e58", nivel: 5 },
    ],
  },
  {
    id: "impacto",
    etapa: "dor",
    criterio: "Urgência · custo de adiar",
    titulo: "Se nada mudar em 3 meses, o que acontece?",
    ajuda: "Pense no que já está em jogo.",
    opcoes: [
      { id: "caixa", texto: "O caixa aperta", detalhe: "Precisamos dessa receita já", foto: "photo-1614260938313-a7fc1a7ad0d2", nivel: 5 },
      { id: "perde-pico", texto: "Perdemos o pico de vendas", detalhe: "A melhor época passa sem a gente", foto: "photo-1541703483865-8a7b251a58ce", nivel: 5 },
      { id: "concorrencia", texto: "A concorrência leva", detalhe: "Clientes fecham com quem respondeu antes", foto: "photo-1586165368502-1bad197a6461", nivel: 4 },
      { id: "da-para-segurar", texto: "Dá para segurar", detalhe: "Mas a empresa cresce menos", foto: "photo-1767457108672-79c6dd48a165", nivel: 2 },
    ],
  },
  {
    id: "prazo",
    etapa: "decisao",
    criterio: "Urgência · prazo para contratar",
    titulo: "Até quando vocês querem esse reforço contratado?",
    ajuda: "Quanto antes começar, antes as vendas aparecem.",
    opcoes: [
      { id: "imediatamente", texto: "Imediatamente", detalhe: "Nas próximas 48 horas", foto: "photo-1517976487492-5750f3195933", nivel: 5 },
      { id: "7-dias", texto: "Em até 7 dias", detalhe: "Ainda nesta semana", foto: "photo-1529651737248-dad5e287768e", nivel: 4 },
      { id: "30-dias", texto: "Em até 30 dias", detalhe: "Ainda neste mês", foto: "photo-1633526543814-9718c8922b7a", nivel: 3 },
      { id: "sem-prazo", texto: "Sem prazo definido", detalhe: "Estou avaliando com calma", foto: "photo-1518281361980-b26bfd556770", nivel: 1 },
    ],
  },
  {
    id: "faturamento",
    etapa: "numeros",
    criterio: "Faturamento mensal",
    titulo: "Quanto sua empresa fatura por mês?",
    ajuda: "Uma média dos últimos meses já ajuda.",
    opcoes: [
      { id: "ate-50mil", texto: "Até R$ 50 mil", detalhe: "Negócio em crescimento", foto: "photo-1753351052363-53ce102830eb", nivel: 2 },
      { id: "50-200mil", texto: "R$ 50 mil a R$ 200 mil", detalhe: "Operação estruturada", foto: "photo-1758873268695-1b55590e507a", nivel: 3 },
      { id: "200mil-1mi", texto: "R$ 200 mil a R$ 1 milhão", detalhe: "Volume alto de vendas", foto: "photo-1586528116311-ad8dd3c8310d", nivel: 4 },
      { id: "acima-1mi", texto: "Acima de R$ 1 milhão", detalhe: "Grande operação", foto: "photo-1486406146926-c627a92ad1ab", nivel: 5 },
    ],
  },
  {
    id: "investimento",
    etapa: "numeros",
    criterio: "Capacidade de investimento",
    titulo: "Quanto você investiria por mês para resolver isso?",
    ajuda: "Somando campanha e profissionais de vendas.",
    opcoes: [
      { id: "ate-1mil", texto: "Até R$ 1 mil", detalhe: "Começar pequeno", foto: "photo-1775053886042-02c1fd9f8f52", nivel: 2 },
      { id: "1-5mil", texto: "R$ 1 mil a R$ 5 mil", detalhe: "Reforço consistente", foto: "photo-1740592910131-b604d790061a", nivel: 4 },
      { id: "acima-5mil", texto: "Acima de R$ 5 mil", detalhe: "Escalar de verdade", foto: "photo-1593672715438-d88a70629abe", nivel: 5 },
      { id: "ver-retorno", texto: "Quero ver o retorno antes", detalhe: "Depende da proposta", foto: "photo-1758876022649-ab858801c6dc", nivel: 2 },
    ],
  },
  {
    id: "decisor",
    etapa: "decisao",
    criterio: "Poder de decisão",
    titulo: "Quem decide essa contratação?",
    ajuda: "Assim a conversa já conta com as pessoas certas.",
    opcoes: [
      { id: "eu", texto: "Eu decido", detalhe: "A palavra final é minha", foto: "photo-1507679799987-c73779587ccf", nivel: 5 },
      { id: "socio", texto: "Eu e meu sócio(a)", detalhe: "Decidimos juntos", foto: "photo-1758519289013-9442fb2aeac6", nivel: 4 },
      { id: "indico", texto: "Eu indico, outra pessoa aprova", detalhe: "Levo a proposta adiante", foto: "photo-1517048676732-d65bc937f952", nivel: 3 },
      { id: "diretoria", texto: "Diretoria ou matriz", detalhe: "Passa por aprovação interna", foto: "photo-1431540015161-0bf868a2d407", nivel: 2 },
    ],
  },
  {
    id: "fechar",
    etapa: "decisao",
    criterio: "Disposição para fechar",
    titulo: "Se a proposta fizer sentido, quando você fecha?",
    ajuda: "Última pergunta!",
    opcoes: [
      { id: "na-conversa", texto: "Na própria conversa", detalhe: "Fazendo sentido, já fecho", foto: "photo-1672380135241-c024f7fbfa13", nivel: 5 },
      { id: "nesta-semana", texto: "Nesta semana", detalhe: "Preciso de poucos dias", foto: "photo-1763729805496-b5dbf7f00c79", nivel: 4 },
      { id: "neste-mes", texto: "Neste mês", detalhe: "Tenho outras prioridades antes", foto: "photo-1454165804606-c3d57bc86b40", nivel: 3 },
      { id: "pesquisando", texto: "Só estou pesquisando", detalhe: "Ainda comparando opções", foto: "photo-1486312338219-ce68d2c6f44d", nivel: 1 },
    ],
  },
];

// Leitura do closer: cada dimensão mostra as respostas que a compõem, sem
// juntar tudo numa nota. Urgência alta com verba indefinida continua visível
// como as duas coisas que são.
export const DIMENSOES_QUIZ = [
  { chave: "dor", titulo: "Dor", perguntas: ["dor", "impacto"] },
  { chave: "urgencia", titulo: "Urgência", perguntas: ["prazo"] },
  { chave: "numeros", titulo: "Faturamento e investimento", perguntas: ["faturamento", "investimento"] },
  { chave: "decisao", titulo: "Decisão", perguntas: ["decisor", "fechar"] },
];

// Como a conversa acontece. Sem link de videochamada inventado: o closer usa
// o WhatsApp e o telefone que a empresa informou.
export const COMO_ACONTECE = "No horário marcado, um especialista da RYCS chama você no WhatsApp confirmado. A conversa acontece por ligação ou chamada de vídeo, como você preferir.";

// Respostas do navegador ({ perguntaId: opcaoId }) → registro completo, com o
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

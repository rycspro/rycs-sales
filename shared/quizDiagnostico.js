// Quiz de qualificação das empresas que chegam pelos anúncios da RYCS
// (app.rycs.pro/diagnostico). Base: planilha "RYCS - Qualificação de Leads",
// com os 13 critérios reescritos como situações que o próprio empresário
// reconhece. Urgência tem duas perguntas (o custo de adiar e o prazo para
// contratar) e o ramo da empresa abre o quiz.
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

export const QUIZ_VERSAO = "2026-11-22";
// Durações que o closer pode escolher ao abrir horários (minutos).
export const DURACOES_AGENDA = [15, 20, 30, 45, 60];

export const ETAPAS_QUIZ = [
  {
    chave: "momento",
    titulo: "Momento",
    frase: "O que está acontecendo nas vendas agora",
    foto: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=70",
    alt: "Equipe reunida em um escritório acompanhando uma apresentação",
  },
  {
    chave: "operacao",
    titulo: "Operação",
    frase: "Onde o reforço comercial faz diferença",
    foto: "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1200&q=70",
    alt: "Maquininha de pagamento sobre o balcão de uma loja",
  },
  {
    chave: "investimento",
    titulo: "Investimento",
    frase: "Verba, ticket e o que já foi feito para crescer",
    foto: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=70",
    alt: "Papéis de planejamento financeiro, celular com calculadora e caneta",
  },
  {
    chave: "decisao",
    titulo: "Decisão",
    frase: "Quem decide e quando dá para começar",
    foto: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=70",
    alt: "Pessoa organizando notas adesivas na parede durante uma reunião",
  },
];

export const PERGUNTAS_QUIZ = [
  {
    id: "segmento",
    etapa: "momento",
    criterio: "Ramo da empresa",
    titulo: "Qual é o ramo da sua empresa?",
    ajuda: "Assim a conversa já começa com exemplos do seu mercado.",
    colunas: 2,
    opcoes: [
      { id: "climatizacao", icone: "❄️", texto: "Climatização e ar-condicionado" },
      { id: "turismo", icone: "🧳", texto: "Turismo e excursões" },
      { id: "educacao", icone: "🎓", texto: "Escola, curso ou educação" },
      { id: "estetica", icone: "💆", texto: "Estética e beleza" },
      { id: "piscinas", icone: "🏊", texto: "Piscinas e equipamentos" },
      { id: "distribuidora", icone: "🚚", texto: "Distribuidora ou atacado" },
      { id: "servicos", icone: "🛠️", texto: "Serviços para empresas" },
      { id: "varejo", icone: "🛍️", texto: "Loja ou varejo" },
      { id: "saude", icone: "🩺", texto: "Saúde e bem-estar" },
      { id: "outro", icone: "✳️", texto: "Outro ramo" },
    ],
  },
  {
    id: "motivo",
    etapa: "momento",
    criterio: "Necessidade comercial",
    titulo: "O que fez você buscar reforço nas vendas agora?",
    ajuda: "Escolha o motivo que mais pesa hoje.",
    opcoes: [
      { id: "vendas-cairam", icone: "📉", texto: "As vendas caíram e precisamos recuperar faturamento", nivel: 5 },
      { id: "contatos-sem-resposta", icone: "📥", texto: "Chegam contatos, mas falta gente para atender e fechar", nivel: 5 },
      { id: "temporada", icone: "🌞", texto: "Vem aí uma época de pico e não vamos dar conta", nivel: 5 },
      { id: "meta-crescimento", icone: "🎯", texto: "Temos uma meta de crescimento com data marcada", nivel: 4 },
      { id: "novo-canal", icone: "🧪", texto: "Queremos testar um novo jeito de vender", nivel: 3 },
      { id: "pesquisando", icone: "🔎", texto: "Estou só pesquisando, sem um motivo específico", nivel: 1 },
    ],
  },
  {
    id: "impacto",
    etapa: "momento",
    criterio: "Urgência · custo de adiar",
    titulo: "Se esse reforço só chegar daqui a 3 meses, o que acontece?",
    ajuda: "Pense no que já está em jogo, não no cenário ideal.",
    opcoes: [
      { id: "caixa", icone: "🚨", texto: "O caixa aperta: precisamos dessa receita antes disso", nivel: 5 },
      { id: "perde-temporada", icone: "🗓️", texto: "Perdemos a temporada de vendas deste ano", nivel: 5 },
      { id: "perde-clientes", icone: "🏃", texto: "Seguimos perdendo clientes para a concorrência", nivel: 4 },
      { id: "atrasa-meta", icone: "⏳", texto: "Atrasa uma meta, mas dá para segurar", nivel: 3 },
      { id: "nada-muda", icone: "😌", texto: "Pouca coisa muda; não há pressa", nivel: 1 },
    ],
  },
  {
    id: "prazo",
    etapa: "momento",
    criterio: "Urgência · prazo para contratar",
    titulo: "Até quando vocês querem ter esse reforço contratado?",
    ajuda: "Considere a data para contratar, não a data para ver resultado.",
    colunas: 2,
    opcoes: [
      { id: "esta-semana", icone: "⚡", texto: "Nesta semana", nivel: 5 },
      { id: "30-dias", icone: "📆", texto: "Nos próximos 30 dias", nivel: 4 },
      { id: "3-meses", icone: "🗓️", texto: "Entre 1 e 3 meses", nivel: 3 },
      { id: "depois", icone: "🔭", texto: "Daqui a mais de 3 meses", nivel: 2 },
      { id: "sem-prazo", icone: "❔", texto: "Ainda não temos prazo", nivel: 1 },
    ],
  },
  {
    id: "gargalo",
    etapa: "operacao",
    criterio: "Dificuldade comercial",
    titulo: "Em qual etapa da venda vocês mais precisam de reforço?",
    ajuda: "Escolha a que mais faz vocês perderem vendas hoje.",
    opcoes: [
      { id: "prospeccao", icone: "🎣", texto: "Prospecção: poucos clientes novos chegando", nivel: 5 },
      { id: "atendimento", icone: "💬", texto: "Atendimento: mensagens e pedidos sem resposta rápida", nivel: 5 },
      { id: "agendamento", icone: "📅", texto: "Agendamento: muita conversa, poucas reuniões ou visitas", nivel: 5 },
      { id: "acompanhamento", icone: "📄", texto: "Acompanhamento: orçamentos enviados que ninguém cobra", nivel: 5 },
      { id: "fechamento", icone: "🤝", texto: "Fechamento: negociações que não viram venda", nivel: 5 },
      { id: "visitas", icone: "🚪", texto: "Visitas: falta gente para ir até o cliente", nivel: 5 },
      { id: "sem-trava", icone: "📈", texto: "Nenhuma trava clara; queremos escalar o que funciona", nivel: 2 },
    ],
  },
  {
    id: "equipe",
    etapa: "operacao",
    criterio: "Necessidade de profissionais",
    titulo: "Quem cuida das vendas hoje?",
    ajuda: "Conte quem realmente atende, cobra e fecha no dia a dia.",
    opcoes: [
      { id: "dono", icone: "🙋", texto: "Ninguém dedicado: o dono vende", nivel: 5 },
      { id: "uma-pessoa", icone: "🧍", texto: "Uma pessoa, que não dá conta de tudo", nivel: 5 },
      { id: "time-pequeno", icone: "👥", texto: "Um time pequeno, sempre no limite", nivel: 4 },
      { id: "time-estruturado", icone: "🏢", texto: "Um time estruturado que queremos ampliar", nivel: 3 },
      { id: "time-suficiente", icone: "✅", texto: "Um time que dá conta da demanda", nivel: 1 },
    ],
  },
  {
    id: "externos",
    etapa: "operacao",
    criterio: "Compatibilidade operacional",
    titulo: "Como seria ter profissionais de fora vendendo para sua empresa?",
    ajuda: "Os profissionais da RYCS podem atuar a distância ou presencialmente, conforme a campanha.",
    opcoes: [
      { id: "ja-usamos", icone: "🤝", texto: "Já trabalhamos com vendedores externos ou representantes", nivel: 5 },
      { id: "com-acompanhamento", icone: "👍", texto: "Tranquilo, desde que a gente acompanhe os resultados", nivel: 4 },
      { id: "so-remoto", icone: "💻", texto: "Funciona, mas só a distância (WhatsApp e telefone)", nivel: 4 },
      { id: "so-presencial", icone: "📍", texto: "Precisaria ser presencial, na nossa região", nivel: 3 },
      { id: "entender", icone: "🤔", texto: "Preciso entender melhor como funciona", nivel: 3 },
      { id: "so-equipe-propria", icone: "🏠", texto: "Prefiro vender só com equipe própria", nivel: 1 },
    ],
  },
  {
    id: "dobrar",
    etapa: "operacao",
    criterio: "Escalabilidade",
    titulo: "Se os pedidos dobrassem no mês que vem, vocês dariam conta?",
    ajuda: "Pense em entrega, estoque e atendimento.",
    opcoes: [
      { id: "sobra", icone: "🚀", texto: "Sim, temos capacidade sobrando", nivel: 5 },
      { id: "ajustes", icone: "🔧", texto: "Sim, com alguns ajustes rápidos", nivel: 4 },
      { id: "parte", icone: "⚖️", texto: "Só uma parte; formaria fila de espera", nivel: 3 },
      { id: "limite", icone: "🧱", texto: "Não, já estamos no limite", nivel: 1 },
      { id: "nao-sei", icone: "❔", texto: "Não sei dizer", nivel: 2 },
    ],
  },
  {
    id: "estrutura",
    etapa: "operacao",
    criterio: "Capacidade operacional",
    titulo: "Hoje, o que pode atrapalhar o atendimento de novos clientes?",
    ajuda: "Estoque, equipe e estrutura para entregar o que for vendido.",
    opcoes: [
      { id: "nada", icone: "✅", texto: "Nada: estoque, equipe e estrutura estão em dia", nivel: 5 },
      { id: "equipe-enxuta", icone: "👥", texto: "Equipe de entrega ou atendimento enxuta", nivel: 3 },
      { id: "estoque", icone: "📦", texto: "Estoque ou insumos limitados", nivel: 3 },
      { id: "agenda-cheia", icone: "🗓️", texto: "Agenda de execução já cheia", nivel: 3 },
      { id: "processos", icone: "🗂️", texto: "Falta organizar preços, contratos ou processos", nivel: 2 },
      { id: "nao-avaliou", icone: "❔", texto: "Ainda não avaliamos", nivel: 2 },
    ],
  },
  {
    id: "iniciativa",
    etapa: "investimento",
    criterio: "Mentalidade de crescimento",
    titulo: "Nos últimos 6 meses, o que vocês fizeram para vender mais?",
    ajuda: "Vale o que saiu do papel, mesmo que não tenha dado certo.",
    opcoes: [
      { id: "vendedores", icone: "🧑‍💼", texto: "Contratamos ou testamos vendedores", nivel: 5 },
      { id: "anuncios", icone: "📣", texto: "Investimos em anúncios ou marketing", nivel: 5 },
      { id: "novidade", icone: "🆕", texto: "Lançamos produto, serviço ou região nova", nivel: 4 },
      { id: "planejou", icone: "📝", texto: "Planejamos, mas ainda não colocamos em prática", nivel: 3 },
      { id: "manter", icone: "🛡️", texto: "O foco foi manter a operação", nivel: 2 },
    ],
  },
  {
    id: "verba",
    etapa: "investimento",
    criterio: "Capacidade de investimento",
    titulo: "Como está a verba para reforçar as vendas?",
    ajuda: "Inclua campanhas e a remuneração dos profissionais.",
    opcoes: [
      { id: "separada", icone: "💰", texto: "Já tenho verba separada para isso", nivel: 5 },
      { id: "depende-proposta", icone: "📋", texto: "Tenho verba; depende da proposta", nivel: 4 },
      { id: "remanejar", icone: "🔄", texto: "Preciso remanejar de outra área", nivel: 3 },
      { id: "depois-resultado", icone: "📈", texto: "Só invisto mais depois de ver resultado", nivel: 2 },
      { id: "sem-verba", icone: "🚫", texto: "Sem verba neste momento", nivel: 1 },
    ],
  },
  {
    id: "ticket",
    etapa: "investimento",
    criterio: "Potencial financeiro",
    titulo: "Quanto vale, em média, cada venda da sua empresa?",
    ajuda: "O valor de cada venda mostra quanto dá para pagar por resultado.",
    colunas: 2,
    opcoes: [
      { id: "ate-300", icone: "🪙", texto: "Até R$ 300", nivel: 2 },
      { id: "300-1mil", icone: "💵", texto: "De R$ 300 a R$ 1 mil", nivel: 3 },
      { id: "1mil-5mil", icone: "💰", texto: "De R$ 1 mil a R$ 5 mil", nivel: 4 },
      { id: "5mil-20mil", icone: "💎", texto: "De R$ 5 mil a R$ 20 mil", nivel: 5 },
      { id: "acima-20mil", icone: "🏆", texto: "Acima de R$ 20 mil", nivel: 5 },
      { id: "na-conversa", icone: "💬", texto: "Prefiro falar na conversa" },
    ],
  },
  {
    id: "decisor",
    etapa: "decisao",
    criterio: "Poder de decisão",
    titulo: "Quem aprova essa contratação?",
    ajuda: "Assim a conversa já conta com as pessoas certas.",
    opcoes: [
      { id: "eu", icone: "🙋", texto: "Eu aprovo sozinho(a)", nivel: 5 },
      { id: "socio", icone: "👥", texto: "Eu e meu sócio(a), que pode vir à conversa", nivel: 4 },
      { id: "recomendo", icone: "🗣️", texto: "Eu recomendo; outra pessoa aprova", nivel: 3 },
      { id: "comite", icone: "🏢", texto: "Passa por diretoria, matriz ou compras", nivel: 2 },
      { id: "nao-sei", icone: "❔", texto: "Ainda não sei quem aprova", nivel: 1 },
    ],
  },
  {
    id: "inicio",
    etapa: "decisao",
    criterio: "Disponibilidade para iniciar",
    titulo: "Se fecharem, quando a primeira campanha pode começar?",
    ajuda: "Conte o tempo para separar oferta, materiais e um responsável.",
    colunas: 2,
    opcoes: [
      { id: "7-dias", icone: "⚡", texto: "Em até 7 dias", nivel: 5 },
      { id: "15-dias", icone: "📆", texto: "Em 8 a 15 dias", nivel: 4 },
      { id: "30-dias", icone: "🗓️", texto: "Em 16 a 30 dias", nivel: 3 },
      { id: "mais-30", icone: "🔭", texto: "Depois de 30 dias", nivel: 2 },
      { id: "nao-sei", icone: "❔", texto: "Ainda não consigo prever", nivel: 1 },
    ],
  },
  {
    id: "falta",
    etapa: "decisao",
    criterio: "Decisão em 7 dias",
    titulo: "O que falta para vocês tomarem a decisão?",
    ajuda: "Escolha o principal ponto em aberto.",
    opcoes: [
      { id: "so-proposta", icone: "✍️", texto: "Só ver a proposta: posso decidir nesta semana", nivel: 5 },
      { id: "como-funciona", icone: "🧩", texto: "Entender como funciona na prática", nivel: 4 },
      { id: "alinhar", icone: "🤝", texto: "Alinhar com quem decide junto", nivel: 3 },
      { id: "verba", icone: "💳", texto: "Liberar ou confirmar a verba", nivel: 3 },
      { id: "comparar", icone: "⚖️", texto: "Comparar com outras opções", nivel: 2 },
      { id: "sem-pressa", icone: "🕰️", texto: "Não pretendo decidir nas próximas semanas", nivel: 1 },
    ],
  },
];

// Leitura do closer: cada dimensão mostra as respostas que a compõem, sem
// juntar tudo numa nota. Urgência alta com verba indefinida continua visível
// como as duas coisas que são.
export const DIMENSOES_QUIZ = [
  { chave: "necessidade", titulo: "Necessidade", perguntas: ["motivo", "gargalo", "equipe"] },
  { chave: "urgencia", titulo: "Urgência", perguntas: ["impacto", "prazo"] },
  { chave: "investimento", titulo: "Investimento", perguntas: ["verba", "ticket"] },
  { chave: "prontidao", titulo: "Prontidão operacional", perguntas: ["externos", "dobrar", "estrutura", "inicio"] },
  { chave: "decisao", titulo: "Decisão", perguntas: ["decisor", "falta"] },
  { chave: "crescimento", titulo: "Crescimento", perguntas: ["iniciativa"] },
];

// Como a conversa acontece. Sem link de videochamada inventado: o closer usa
// o WhatsApp e o telefone que a empresa informou.
export const COMO_ACONTECE = "No horário marcado, um especialista da RYCS chama você no WhatsApp informado. A conversa acontece por ligação ou chamada de vídeo, como você preferir.";

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
      opcao: opcao.id, resposta: opcao.texto, ...(opcao.nivel && { nivel: opcao.nivel }),
    });
  }
  return registro;
}

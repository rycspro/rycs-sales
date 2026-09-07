// Triagem de entrada da RYCS Academy.
//
// Mede o que o vendedor SABE e DECLARA saber. O que ele realmente faz é
// medido depois, pela execução dentro da plataforma — são scores distintos e
// não devem ser confundidos.
//
// Toda pontuação é calculada no servidor. As alternativas saem para o cliente
// sem os pesos, senão bastaria ler a resposta da rede para gabaritar.

export const CATEGORIAS = {
  experiencia:   { nome: "Experiência",           peso: 10 },
  prospeccao:    { nome: "Prospecção",            peso: 15 },
  comunicacao:   { nome: "Comunicação",           peso: 10 },
  negociacao:    { nome: "Negociação",            peso: 15 },
  reunioes:      { nome: "Reuniões",              peso: 15 },
  qualificacao:  { nome: "Qualificação",          peso: 10 },
  objecoes:      { nome: "Objeções",              peso: 10 },
  fechamento:    { nome: "Fechamento",            peso:  5 },
  disciplina:    { nome: "Disciplina",            peso:  5 },
  conhecimento:  { nome: "Conhecimento comercial",peso:  5 },
};

export const ORDEM_CATEGORIAS = Object.keys(CATEGORIAS);

// Faixas de aprovação. A comparação é estrita em 90: o documento pede que
// 90,00% caia em condicionada e só 90,01% aprove.
export const FAIXAS = {
  aprovado:    { min: 90,  exclusivo: true,  nome: "Aprovado",              cor: "#5FD3A0" },
  condicional: { min: 80,  exclusivo: false, nome: "Aprovação condicionada",cor: "#F0B45E" },
  reavaliacao: { min: 60,  exclusivo: false, nome: "Reavaliação",           cor: "#9AA6FF" },
  reprovado:   { min: 0,   exclusivo: false, nome: "Não aprovado",          cor: "#FF8A7A" },
};

export function classificar(score) {
  if (score > 90) return "aprovado";
  if (score >= 80) return "condicional";
  if (score >= 60) return "reavaliacao";
  return "reprovado";
}

// -------------------------------------------------------------------------
// Banco de perguntas
//
// `opcoes` traz [texto, pontos] onde pontos vai de 0 a 10. Perguntas de
// múltipla escolha pontuam pela quantidade e qualidade das marcadas.
// Perguntas abertas são avaliadas por rubrica de palavras-chave — explicável,
// e sem depender de IA externa.
// -------------------------------------------------------------------------

const q = (id, categoria, texto, tipo, extra = {}) => ({ id, categoria, texto, tipo, ...extra });

export const PERGUNTAS = [
  // ---- Experiência ----
  q("exp1", "experiencia", "Há quanto tempo você trabalha com vendas?", "unica", {
    opcoes: [["Nunca trabalhei com vendas", 0], ["Menos de 1 ano", 3], ["1 a 3 anos", 6], ["3 a 5 anos", 8], ["Mais de 5 anos", 10]],
  }),
  q("exp2", "experiencia", "Você já vendeu para empresas (B2B)?", "unica", {
    opcoes: [["Não, apenas para consumidor final", 4], ["Sim, ocasionalmente", 7], ["Sim, é o meu principal mercado", 10]],
  }),
  q("exp3", "experiencia", "Qual o maior ticket que você já vendeu?", "unica", {
    opcoes: [["Até R$ 500", 3], ["R$ 500 a R$ 5.000", 6], ["R$ 5.000 a R$ 50.000", 8], ["Acima de R$ 50.000", 10]],
    perfil: "ticketMaximo",
  }),
  q("exp4", "experiencia", "Em quais segmentos você já vendeu?", "multipla", {
    opcoes: [["Tecnologia e SaaS", 10], ["Energia", 10], ["Contabilidade e serviços", 10], ["Imobiliário", 10],
             ["Seguros e financeiro", 10], ["Educação", 10], ["Varejo", 8], ["Indústria", 10], ["Nunca vendi", 0]],
    perfil: "segmentos",
  }),

  // ---- Prospecção ----
  q("pro1", "prospeccao", "Quantos contatos comerciais você consegue fazer por dia?", "unica", {
    opcoes: [["Até 10", 3], ["10 a 30", 6], ["30 a 50", 8], ["50 a 100", 10], ["Mais de 100", 10]],
    perfil: "capacidadeDiaria",
  }),
  q("pro2", "prospeccao", "Quais canais de prospecção você domina?", "multipla", {
    opcoes: [["Ligação", 10], ["WhatsApp", 8], ["E-mail", 8], ["LinkedIn", 9], ["Instagram", 6], ["Visita presencial", 10]],
    perfil: "canais",
  }),
  q("pro3", "prospeccao", "Você se sente confortável fazendo prospecção ativa, sem lead prévio?", "unica", {
    opcoes: [["Não, prefiro só atender demanda", 2], ["Parcialmente", 6], ["Sim, é o que faço melhor", 10]],
  }),
  q("pro4", "prospeccao", "Quando um prospect não responde, qual é a sua estratégia?", "aberta", {
    rubrica: {
      bons: ["cadência", "cadencia", "canal", "horário", "horario", "tentativ", "follow", "insist", "variar", "sequência", "sequencia", "dias"],
      ruins: ["desisto", "deixo", "espero", "aguardo", "próximo", "proximo lead"],
    },
  }),

  // ---- Comunicação ----
  q("com1", "comunicacao", "Numa primeira ligação, o que você faz primeiro?", "unica", {
    opcoes: [["Apresento o produto e as funcionalidades", 3], ["Falo o preço para filtrar rápido", 1],
             ["Pergunto sobre o problema que a pessoa vive hoje", 10], ["Conto a história da empresa", 2]],
  }),
  q("com2", "comunicacao", "Numa conversa comercial, quem deve falar mais?", "unica", {
    opcoes: [["Eu, para mostrar domínio", 2], ["O cliente, e eu conduzo com perguntas", 10], ["Meio a meio", 6]],
  }),
  q("com3", "comunicacao", "O cliente pede: 'me manda uma apresentação pelo WhatsApp'. O que você responde?", "aberta", {
    rubrica: {
      bons: ["pergunt", "o que", "preciso saber", "personaliz", "antes", "entender", "minutos", "conversa", "ligação", "ligacao", "específic", "especific"],
      ruins: ["mando", "envio agora", "já mando", "ja mando", "claro", "sem problema"],
    },
  }),

  // ---- Negociação ----
  q("neg1", "negociacao", "O cliente diz 'está muito caro'. Qual é sua primeira reação?", "unica", {
    opcoes: [["Ofereço um desconto para não perder", 1], ["Pergunto com o que ele está comparando", 9],
             ["Retomo o custo do problema que ele mesmo descreveu", 10], ["Digo que o preço é esse mesmo", 3]],
  }),
  q("neg2", "negociacao", "Você costuma oferecer desconto para fechar?", "unica", {
    opcoes: [["Sempre", 1], ["Frequentemente", 3], ["Às vezes", 6], ["Raramente", 9], ["Nunca", 8]],
  }),
  q("neg3", "negociacao", "O cliente diz que já tem fornecedor. Como você segue?", "aberta", {
    rubrica: {
      bons: ["pergunt", "o que funciona", "o que falta", "satisfeit", "contrato", "renovação", "renovacao", "compar", "prazo", "dor", "insatisf"],
      ruins: ["desisto", "agradeço", "agradeco", "encerro", "melhor preço", "melhor preco", "mais barato"],
    },
  }),
  q("neg4", "negociacao", "'Seu concorrente é 30% mais barato.' Como você responde?", "aberta", {
    rubrica: {
      bons: ["compar", "escopo", "incluí", "inclui", "diferen", "valor", "custo", "resultado", "risco", "o que está", "o que esta"],
      ruins: ["cubro", "dou o mesmo", "abaixo", "desconto", "igualo"],
    },
  }),

  // ---- Reuniões ----
  q("reu1", "reunioes", "Você tem experiência conduzindo reuniões comerciais?", "unica", {
    opcoes: [["Nunca conduzi", 0], ["Algumas vezes", 5], ["Sim, com frequência", 8], ["Sim, é minha principal atividade", 10]],
  }),
  q("reu2", "reunioes", "Quais formatos você domina?", "multipla", {
    opcoes: [["Presencial", 10], ["Google Meet", 8], ["Zoom", 8], ["Microsoft Teams", 8], ["Telefone", 7]],
    perfil: "formatos",
  }),
  q("reu3", "reunioes", "Em qual momento da reunião você apresenta o preço?", "unica", {
    opcoes: [["Logo no início, para não perder tempo", 2], ["Depois de entender a dor e dimensionar o custo dela", 10],
             ["Quando o cliente pergunta", 5], ["No final, sempre", 6]],
  }),
  q("reu4", "reunioes", "O que caracteriza uma reunião comercial bem-sucedida?", "aberta", {
    rubrica: {
      bons: ["próximo passo", "proximo passo", "data", "compromisso", "dor", "diagnóstic", "diagnostic", "qualific", "decisor", "orçament", "orcament"],
      ruins: ["cliente gostou", "foi boa", "simpátic", "simpatic", "apresentei"],
    },
  }),

  // ---- Qualificação ----
  q("qua1", "qualificacao", "O que você precisa confirmar antes de agendar uma reunião?", "multipla", {
    opcoes: [["Que existe um problema reconhecido", 10], ["Que há orçamento ou caminho para ele", 10],
             ["Que a pessoa participa da decisão", 10], ["Apenas que ela tem interesse", 2], ["Apenas o horário disponível", 0]],
  }),
  q("qua2", "qualificacao", "Você está numa reunião. Quais informações busca descobrir primeiro?", "aberta", {
    rubrica: {
      bons: ["dor", "problema", "processo atual", "custo", "quanto", "decisor", "decide", "prazo", "orçament", "orcament", "tentaram", "hoje"],
      ruins: ["produto", "apresent", "funcionalidade", "preço", "preco"],
    },
  }),
  q("qua3", "qualificacao", "Reunião marcada com quem não decide:", "unica", {
    opcoes: [["Conta como resultado, o volume importa", 1], ["É retrabalho e tende a não avançar", 10],
             ["Vale igual, o contato pode indicar", 5]],
  }),

  // ---- Objeções ----
  q("obj1", "objecoes", "'Vou pensar e depois te retorno.' Como você conduz?", "aberta", {
    rubrica: {
      bons: ["pergunt", "o que", "dúvida", "duvida", "ficou", "falta", "próximo passo", "proximo passo", "data", "quando", "específic", "especific"],
      ruins: ["aguardo", "espero", "tudo bem", "fico no aguardo", "mando mensagem depois"],
    },
  }),
  q("obj2", "objecoes", "Uma objeção, na prática, costuma ser:", "unica", {
    opcoes: [["Um não definitivo", 1], ["Um pedido de mais informação", 10], ["Sinal de que o cliente não tem dinheiro", 3],
             ["Falha na apresentação", 5]],
  }),
  q("obj3", "objecoes", "Quantas tentativas você faz antes de considerar um contato perdido?", "unica", {
    opcoes: [["1 ou 2", 2], ["3 a 5", 6], ["6 ou mais, variando canal e horário", 10]],
  }),

  // ---- Fechamento ----
  q("fec1", "fechamento", "O cliente demonstra interesse mas não quer assumir um próximo compromisso. O que você faz?", "aberta", {
    rubrica: {
      bons: ["pergunt", "o que impede", "dúvida", "duvida", "prazo", "data", "quando", "reduz", "menor", "próximo", "proximo", "falta"],
      ruins: ["deixo", "espero", "aguardo", "insisto", "pressiono", "desconto"],
    },
  }),
  q("fec2", "fechamento", "Toda reunião deve terminar com:", "unica", {
    opcoes: [["Um agradecimento", 2], ["A promessa de enviar a proposta", 5],
             ["Data, responsável e ação definidos", 10], ["O cliente dizendo que vai pensar", 0]],
  }),

  // ---- Disciplina ----
  q("dis1", "disciplina", "Quantas horas por dia você consegue dedicar a vendas?", "unica", {
    opcoes: [["Menos de 1 hora", 1], ["1 a 2 horas", 4], ["3 a 4 horas", 8], ["Mais de 4 horas", 10]],
    perfil: "horasDia",
  }),
  q("dis2", "disciplina", "Se receber 50 leads hoje, em quanto tempo faz o primeiro contato?", "unica", {
    opcoes: [["Na mesma hora", 10], ["No mesmo dia", 8], ["Em até 3 dias", 4], ["Conforme der tempo", 1]],
  }),
  q("dis3", "disciplina", "Como você organiza seus follow-ups?", "aberta", {
    rubrica: {
      bons: ["agenda", "crm", "planilha", "lembrete", "data", "sistema", "todo dia", "rotina", "bloco", "cadência", "cadencia"],
      ruins: ["memória", "memoria", "de cabeça", "de cabeca", "quando lembro", "não uso", "nao uso"],
    },
  }),

  // ---- Conhecimento comercial ----
  q("con1", "conhecimento", "O que significa ICP em vendas?", "unica", {
    opcoes: [["Índice de Conversão de Propostas", 0], ["Perfil de Cliente Ideal", 10],
             ["Instrução de Contato Padrão", 0], ["Não conheço o termo", 1]],
  }),
  q("con2", "conhecimento", "Qual a diferença entre SDR e Closer?", "unica", {
    opcoes: [["Não há diferença prática", 0], ["O SDR qualifica e agenda; o Closer conduz e fecha", 10],
             ["O SDR vende barato e o Closer vende caro", 2], ["O SDR trabalha por telefone e o Closer presencialmente", 3]],
  }),
];

// A versão que vai para o cliente nunca carrega pontuação nem rubrica.
export function perguntasPublicas() {
  return PERGUNTAS.map((p) => ({
    id: p.id,
    categoria: p.categoria,
    texto: p.texto,
    tipo: p.tipo,
    opcoes: p.opcoes ? p.opcoes.map(([texto]) => texto) : undefined,
  }));
}

export const TOTAL_PERGUNTAS = PERGUNTAS.length;

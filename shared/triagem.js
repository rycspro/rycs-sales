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
  // 17 perguntas cobrindo as 10 categorias. A distribuição segue os pesos:
  // categorias de 15% e 10% ganham duas perguntas, as de 5% ganham uma.
  // Três são abertas — o suficiente para avaliar raciocínio sem transformar
  // a triagem em redação.

  // ---- Experiência (10%) ----
  q("exp3", "experiencia", "Qual o maior ticket que você já vendeu?", "unica", {
    opcoes: [["Nunca vendi", 0], ["Até R$ 500", 3], ["R$ 500 a R$ 5.000", 6], ["R$ 5.000 a R$ 50.000", 8], ["Acima de R$ 50.000", 10]],
    perfil: "ticketMaximo",
  }),
  q("exp4", "experiencia", "Em quais segmentos você já vendeu?", "multipla", {
    opcoes: [["Tecnologia e SaaS", 10], ["Energia", 10], ["Contabilidade e serviços", 10], ["Imobiliário", 10],
             ["Seguros e financeiro", 10], ["Educação", 10], ["Varejo", 8], ["Indústria", 10], ["Nunca vendi", 0]],
    perfil: "segmentos",
  }),

  // ---- Prospecção (15%) ----
  q("pro1", "prospeccao", "Quantos contatos comerciais você consegue fazer por dia?", "unica", {
    opcoes: [["Até 10", 3], ["10 a 30", 6], ["30 a 50", 8], ["50 a 100", 10], ["Mais de 100", 10]],
    perfil: "capacidadeDiaria",
  }),
  q("pro4", "prospeccao", "Quando um prospect não responde, qual é a sua estratégia?", "aberta", {
    rubrica: {
      bons: ["cadência", "cadencia", "canal", "horário", "horario", "tentativ", "follow", "insist", "variar", "sequência", "sequencia", "dias"],
      ruins: ["desisto", "deixo", "espero", "aguardo", "próximo lead", "proximo lead"],
    },
  }),

  // ---- Comunicação (10%) ----
  q("com1", "comunicacao", "Numa primeira ligação, o que você faz primeiro?", "unica", {
    opcoes: [["Apresento o produto e as funcionalidades", 3], ["Falo o preço para filtrar rápido", 1],
             ["Pergunto sobre o problema que a pessoa vive hoje", 10], ["Conto a história da empresa", 2]],
  }),
  q("com2", "comunicacao", "Numa conversa comercial, quem deve falar mais?", "unica", {
    opcoes: [["Eu, para mostrar domínio", 2], ["O cliente, e eu conduzo com perguntas", 10], ["Meio a meio", 6]],
  }),

  // ---- Negociação (15%) ----
  q("neg1", "negociacao", "O cliente diz 'está muito caro'. Qual é sua primeira reação?", "unica", {
    opcoes: [["Ofereço um desconto para não perder", 1], ["Pergunto com o que ele está comparando", 9],
             ["Retomo o custo do problema que ele mesmo descreveu", 10], ["Digo que o preço é esse mesmo", 3]],
  }),
  q("neg4", "negociacao", "'Seu concorrente é 30% mais barato.' Como você responde?", "aberta", {
    rubrica: {
      bons: ["compar", "escopo", "incluí", "inclui", "diferen", "valor", "custo", "resultado", "risco", "o que está", "o que esta"],
      ruins: ["cubro", "dou o mesmo", "abaixo", "desconto", "igualo"],
    },
  }),

  // ---- Reuniões (15%) ----
  q("reu2", "reunioes", "Quais formatos de reunião você domina?", "multipla", {
    opcoes: [["Presencial", 10], ["Google Meet", 8], ["Zoom", 8], ["Microsoft Teams", 8], ["Telefone", 7], ["Nenhum", 0]],
    perfil: "formatos",
  }),
  q("reu3", "reunioes", "Em qual momento da reunião você apresenta o preço?", "unica", {
    opcoes: [["Logo no início, para não perder tempo", 2], ["Depois de entender a dor e dimensionar o custo dela", 10],
             ["Quando o cliente pergunta", 5], ["No final, sempre", 6]],
  }),

  // ---- Qualificação (10%) ----
  q("qua1", "qualificacao", "O que você precisa confirmar antes de agendar uma reunião?", "multipla", {
    opcoes: [["Que existe um problema reconhecido", 10], ["Que há orçamento ou caminho para ele", 10],
             ["Que a pessoa participa da decisão", 10], ["Apenas que ela tem interesse", 2], ["Apenas o horário disponível", 0]],
  }),
  q("qua3", "qualificacao", "Reunião marcada com quem não decide:", "unica", {
    opcoes: [["Conta como resultado, o volume importa", 1], ["É retrabalho e tende a não avançar", 10],
             ["Vale igual, o contato pode indicar", 5]],
  }),

  // ---- Objeções (10%) ----
  q("obj1", "objecoes", "'Vou pensar e depois te retorno.' Como você conduz?", "aberta", {
    rubrica: {
      bons: ["pergunt", "o que", "dúvida", "duvida", "ficou", "falta", "próximo passo", "proximo passo", "data", "quando", "específic", "especific"],
      ruins: ["aguardo", "espero", "tudo bem", "fico no aguardo", "mando mensagem depois"],
    },
  }),
  q("obj3", "objecoes", "Quantas tentativas você faz antes de considerar um contato perdido?", "unica", {
    opcoes: [["1 ou 2", 2], ["3 a 5", 6], ["6 ou mais, variando canal e horário", 10]],
  }),

  // ---- Fechamento (5%) ----
  q("fec2", "fechamento", "Toda reunião deve terminar com:", "unica", {
    opcoes: [["Um agradecimento", 2], ["A promessa de enviar a proposta", 5],
             ["Data, responsável e ação definidos", 10], ["O cliente dizendo que vai pensar", 0]],
  }),

  // ---- Disciplina (5%) ----
  q("dis2", "disciplina", "Se receber 50 leads hoje, em quanto tempo faz o primeiro contato?", "unica", {
    opcoes: [["Na mesma hora", 10], ["No mesmo dia", 8], ["Em até 3 dias", 4], ["Conforme der tempo", 1]],
    perfil: "velocidadeContato",
  }),

  // ---- Conhecimento comercial (5%) ----
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

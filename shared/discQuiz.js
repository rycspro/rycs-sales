// Quiz DISC para onboarding do profissional.
//
// Mede quatro dimensões de personalidade comercial:
//   D = Dominância — foco em resultado, decisão rápida
//   I = Influência — persuasão, entusiasmo, relacionamento
//   S = Estabilidade — constância, paciência, suporte
//   C = Conformidade — análise, precisão, processo
//
// Cada pergunta tem 4 opções, uma por dimensão. O profissional ordena da
// "mais parecida" para "menos parecida" — ou, nesta versão simplificada,
// escolhe a que MAIS e a que MENOS combina. A pontuação é:
//   mais = +2 para a dimensão escolhida
//   menos = -1 para a dimensão escolhida
//   as outras duas recebem +0.5 cada
//
// O resultado não reprova ninguém: informa a empresa e sugere campanhas.

export const DIMENSOES = {
  D: { nome: "Dominância", cor: "#E53E3E", descricao: "Orientado a resultados, direto, competitivo." },
  I: { nome: "Influência", cor: "#DD6B20", descricao: "Comunicativo, entusiasta, persuasivo." },
  S: { nome: "Estabilidade", cor: "#38A169", descricao: "Paciente, constante, bom ouvinte." },
  C: { nome: "Conformidade", cor: "#3182CE", descricao: "Analítico, preciso, orientado a processos." },
};

export const PERGUNTAS_DISC = [
  {
    id: "disc1",
    texto: "Em uma reunião de vendas, você tende a:",
    opcoes: [
      { dim: "D", texto: "Ir direto ao ponto e propor o fechamento" },
      { dim: "I", texto: "Criar conexão pessoal antes de falar do produto" },
      { dim: "S", texto: "Ouvir com atenção e adaptar a proposta ao que o cliente precisa" },
      { dim: "C", texto: "Apresentar dados e comparativos para embasar a decisão" },
    ],
  },
  {
    id: "disc2",
    texto: "Quando recebe um 'não' do prospect, sua primeira reação é:",
    opcoes: [
      { dim: "D", texto: "Encarar como desafio e insistir com outro ângulo" },
      { dim: "I", texto: "Manter a relação e tentar reagendar em outro momento" },
      { dim: "S", texto: "Respeitar o tempo do prospect e fazer follow-up suave" },
      { dim: "C", texto: "Analisar o que falhou para ajustar a abordagem" },
    ],
  },
  {
    id: "disc3",
    texto: "Seu dia de trabalho ideal seria:",
    opcoes: [
      { dim: "D", texto: "Cheio de ligações e reuniões, buscando bater a meta" },
      { dim: "I", texto: "Networking, eventos e conversas que geram oportunidades" },
      { dim: "S", texto: "Rotina estruturada, atendendo clientes com calma e consistência" },
      { dim: "C", texto: "Planejamento, análise de funil e preparação de propostas detalhadas" },
    ],
  },
  {
    id: "disc4",
    texto: "O que mais te motiva em vendas:",
    opcoes: [
      { dim: "D", texto: "Superar metas e ser reconhecido pelo resultado" },
      { dim: "I", texto: "Conhecer pessoas e influenciar decisões" },
      { dim: "S", texto: "Ajudar o cliente a resolver um problema de verdade" },
      { dim: "C", texto: "Dominar o processo e entregar a proposta perfeita" },
    ],
  },
  {
    id: "disc5",
    texto: "Trabalhando em equipe, você normalmente:",
    opcoes: [
      { dim: "D", texto: "Assume a liderança e define o ritmo" },
      { dim: "I", texto: "Anima o grupo e propõe ideias criativas" },
      { dim: "S", texto: "Colabora e garante que todos estejam alinhados" },
      { dim: "C", texto: "Organiza as tarefas e acompanha os detalhes" },
    ],
  },
  {
    id: "disc6",
    texto: "Ao lidar com uma objeção difícil, você prefere:",
    opcoes: [
      { dim: "D", texto: "Confrontar a objeção com firmeza e argumentos diretos" },
      { dim: "I", texto: "Contar uma história de sucesso que neutralize a dúvida" },
      { dim: "S", texto: "Dar espaço e voltar depois com uma resposta personalizada" },
      { dim: "C", texto: "Usar dados e provas para desfazer a objeção ponto a ponto" },
    ],
  },
  {
    id: "disc7",
    texto: "Quando o resultado do mês não está bom, você:",
    opcoes: [
      { dim: "D", texto: "Dobra o esforço e faz mais ligações" },
      { dim: "I", texto: "Procura parceiros e indicações para acelerar" },
      { dim: "S", texto: "Revisa a base de clientes e fortalece os que já tem" },
      { dim: "C", texto: "Analisa os números para entender onde está o gargalo" },
    ],
  },
  {
    id: "disc8",
    texto: "Qual frase mais combina com você?",
    opcoes: [
      { dim: "D", texto: "Resultado é o que importa, o resto é detalhe" },
      { dim: "I", texto: "Pessoas compram de quem elas gostam" },
      { dim: "S", texto: "Confiança se constrói com consistência" },
      { dim: "C", texto: "Dados não mentem, eu confio nos números" },
    ],
  },
];

// Quiz de experiência — complementa o DISC com dados práticos.
export const PERGUNTAS_EXPERIENCIA = [
  {
    id: "xp1",
    texto: "Há quanto tempo você trabalha com vendas?",
    tipo: "unica",
    opcoes: [
      { texto: "Nunca trabalhei, quero começar", valor: 0 },
      { texto: "Menos de 1 ano", valor: 1 },
      { texto: "1 a 3 anos", valor: 2 },
      { texto: "3 a 5 anos", valor: 3 },
      { texto: "Mais de 5 anos", valor: 4 },
    ],
  },
  {
    id: "xp2",
    texto: "Qual o seu principal canal de vendas hoje?",
    tipo: "multipla",
    opcoes: [
      "Telefone / cold call",
      "WhatsApp",
      "E-mail",
      "Presencial / porta a porta",
      "Redes sociais / Social Selling",
      "Videoconferência",
      "Ainda não tenho canal definido",
    ],
  },
  {
    id: "xp3",
    texto: "Qual tipo de venda você tem mais experiência?",
    tipo: "unica",
    opcoes: [
      { texto: "B2B — vendas para empresas", valor: "b2b" },
      { texto: "B2C — vendas para consumidor final", valor: "b2c" },
      { texto: "Ambos", valor: "ambos" },
      { texto: "Nenhuma experiência ainda", valor: "nenhuma" },
    ],
  },
  {
    id: "xp4",
    texto: "Quanto tempo por dia você pretende dedicar à RYCS?",
    tipo: "unica",
    opcoes: [
      { texto: "Tempo integral (8h+)", valor: "integral" },
      { texto: "Meio período (4-6h)", valor: "meio" },
      { texto: "Algumas horas por dia (2-4h)", valor: "parcial" },
      { texto: "Fins de semana ou pontual", valor: "pontual" },
    ],
  },
];

export const TOTAL_DISC = PERGUNTAS_DISC.length;
export const TOTAL_XP = PERGUNTAS_EXPERIENCIA.length;

// Calcula o perfil DISC a partir das respostas.
// respostaDisc = { disc1: { mais: "D", menos: "C" }, disc2: { mais: "I", menos: "S" }, ... }
export function calcularDisc(respostaDisc) {
  const scores = { D: 0, I: 0, S: 0, C: 0 };
  const dims = Object.keys(scores);

  for (const p of PERGUNTAS_DISC) {
    const r = respostaDisc[p.id];
    if (!r?.mais) continue;

    scores[r.mais] += 2;
    if (r.menos) scores[r.menos] -= 1;

    for (const d of dims) {
      if (d !== r.mais && d !== r.menos) scores[d] += 0.5;
    }
  }

  const max = Math.max(...Object.values(scores));
  const total = Object.values(scores).reduce((s, v) => s + Math.max(0, v), 0) || 1;
  const percentuais = {};
  for (const d of dims) percentuais[d] = Math.round((Math.max(0, scores[d]) / total) * 100);

  const predominante = dims.reduce((a, b) => scores[a] >= scores[b] ? a : b);
  const secundario = dims.filter((d) => d !== predominante).reduce((a, b) => scores[a] >= scores[b] ? a : b);

  return {
    scores,
    percentuais,
    predominante,
    secundario,
    label: `${predominante}${secundario}`,
    descricao: DIMENSOES[predominante].descricao,
  };
}

// Perguntas públicas sem as respostas internas (para o frontend).
export function perguntasDiscPublicas() {
  return PERGUNTAS_DISC.map((p) => ({
    id: p.id,
    texto: p.texto,
    opcoes: p.opcoes.map((o) => ({ dim: o.dim, texto: o.texto })),
  }));
}

export function perguntasXpPublicas() {
  return PERGUNTAS_EXPERIENCIA.map((p) => ({
    id: p.id,
    texto: p.texto,
    tipo: p.tipo,
    opcoes: p.opcoes.map((o) => typeof o === "string" ? o : { texto: o.texto }),
  }));
}

// Funções comerciais que um profissional pode exercer na plataforma.
// `acoes` lista os tipos de ação típicos de cada função — usado para sugerir
// o que a pessoa registra e para pontuar o score dentro da função certa.

export const FUNCOES = {
  sdr: {
    nome: "SDR",
    completo: "Sales Development Representative",
    descricao: "Qualifica leads que chegam e agenda reuniões para o closer.",
    acoes: ["ligacao", "follow", "agendamento"],
  },
  bdr: {
    nome: "BDR",
    completo: "Business Development Representative",
    descricao: "Prospecção ativa de contas frias, sem lead prévio. Abre mercado.",
    acoes: ["ligacao", "follow", "agendamento"],
  },
  closer: {
    nome: "Closer",
    completo: "Executivo de vendas",
    descricao: "Conduz a reunião, negocia e fecha o contrato.",
    acoes: ["realizada", "venda", "follow"],
  },
  pap: {
    nome: "PAP",
    completo: "Porta a porta",
    descricao: "Abordagem presencial em campo, comércio ou residência.",
    acoes: ["agendamento", "realizada", "venda"],
  },
  "sem-exp": {
    nome: "Iniciante",
    completo: "Primeira experiência em vendas",
    descricao: "Ainda sem experiência formal. Começa pela trilha de fundamentos.",
    acoes: ["ligacao", "follow"],
  },
};

export const ORDEM_FUNCOES = ["sdr", "bdr", "closer", "pap", "sem-exp"];

export const nomeFuncao = (k) => FUNCOES[k]?.nome || "—";

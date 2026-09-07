// Pipeline comercial do vendedor.
//
// A ordem importa: o funil só anda para frente ou volta explicitamente, e a
// posição de cada etapa define o que a interface mostra como próxima ação.

export const ETAPAS = {
  novo:         { nome: "Novo",        ordem: 0, cor: "#8496B4", acao: "Fazer o primeiro contato" },
  contatado:    { nome: "Contatado",   ordem: 1, cor: "#5B8CFF", acao: "Aguardar retorno ou insistir" },
  conversando:  { nome: "Conversando", ordem: 2, cor: "#5B8CFF", acao: "Qualificar a dor" },
  reuniao:      { nome: "Reunião",     ordem: 3, cor: "#9AA6FF", acao: "Confirmar e realizar" },
  qualificado:  { nome: "Qualificado", ordem: 4, cor: "#9AA6FF", acao: "Montar a proposta" },
  proposta:     { nome: "Proposta",    ordem: 5, cor: "#F0B45E", acao: "Acompanhar a leitura" },
  negociacao:   { nome: "Negociação",  ordem: 6, cor: "#F0B45E", acao: "Tratar objeções" },
  ganho:        { nome: "Ganho",       ordem: 7, cor: "#5FD3A0", acao: "Registrar a venda" },
  perdido:      { nome: "Perdido",     ordem: 8, cor: "#FF8A7A", acao: "Registrar o motivo" },
};

export const ORDEM_ETAPAS = [
  "novo", "contatado", "conversando", "reuniao",
  "qualificado", "proposta", "negociacao", "ganho", "perdido",
];

export const ETAPAS_ABERTAS = ORDEM_ETAPAS.filter((e) => e !== "ganho" && e !== "perdido");

// Tipos de interação registrados na linha do tempo do lead. Cada um vira
// evidência de execução — é o que responde "a tarefa aconteceu mesmo?".
export const TIPOS_EVENTO = {
  ligacao:  { nome: "Ligação",   exige: ["resultado"] },
  whatsapp: { nome: "WhatsApp",  exige: [] },
  email:    { nome: "E-mail",    exige: [] },
  reuniao:  { nome: "Reunião",   exige: ["resultado"] },
  proposta: { nome: "Proposta",  exige: ["valor"] },
  nota:     { nome: "Anotação",  exige: [] },
};

export const RESULTADOS_LIGACAO = [
  "atendeu", "nao_atendeu", "caixa_postal", "numero_errado", "recusou", "reagendou",
];

export const MOTIVOS_PERDA = [
  "preço", "sem orçamento", "sem urgência", "escolheu concorrente",
  "não é o decisor", "sem fit", "sem resposta",
];

export const etapaValida = (e) => Object.prototype.hasOwnProperty.call(ETAPAS, e);
export const nomeEtapa = (e) => ETAPAS[e]?.nome || e;

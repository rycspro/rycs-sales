import { ACOES } from "./acoes.js";

// Objetivos de campanha.
//
// A ideia vem do gerenciador de anúncios: em vez de pedir trinta campos soltos,
// perguntar primeiro O QUE a pessoa quer que aconteça. O objetivo escolhido
// configura o resto — qual função comercial atende, que ações são remuneradas,
// que prova cada ação exige e qual prazo faz sentido.
//
// Por que isso importa aqui, e não é só estética: quem contrata sabe dizer
// "quero reunião com quem decide". Não sabe dizer se precisa de SDR ou BDR, nem
// que evidência pedir numa reunião agendada. Hoje a tela pede as duas coisas no
// mesmo nível, e a empresa erra na configuração — depois culpa o vendedor pelo
// resultado.
//
// Cada objetivo traz `valoresSugeridos` como PONTO DE PARTIDA, não como preço.
// São proporções entre as ações (uma reunião realizada vale mais que uma
// agendada), calculadas a partir do ticket da própria empresa. Quem publica
// revisa e decide — em nenhum momento o número é apresentado como valor de
// mercado, porque não medimos mercado nenhum.

export const OBJETIVOS = {
  reunioes: {
    nome: "Agendar reuniões",
    resumo: "Encher a agenda do seu time comercial com reuniões confirmadas.",
    paraQuem: "Você já tem quem feche a venda, o que falta é volume de conversa qualificada.",
    funcao: "sdr",
    acoes: ["agendamento", "realizada"],
    principal: "agendamento",
    prazoHoras: 48,
    // Fração do ticket que cada ação costuma justificar nesta operação.
    proporcao: { agendamento: 0.012, realizada: 0.02 },
    tituloSugerido: (emp) => `Agendamento de reuniões — ${emp.nome || "campanha"}`,
    objetivoTexto: "Gerar reuniões qualificadas com quem decide.",
  },

  prospeccao: {
    nome: "Abrir mercado novo",
    resumo: "Chegar em contas que ainda não conhecem você, sem lista pronta.",
    paraQuem: "Você quer entrar num segmento ou região onde ainda não vende.",
    funcao: "bdr",
    acoes: ["ligacao", "follow", "agendamento"],
    principal: "agendamento",
    prazoHoras: 72,
    proporcao: { ligacao: 0.008, follow: 0.002, agendamento: 0.018 },
    tituloSugerido: (emp) => `Prospecção ativa — ${emp.regiao || emp.segmento || "novo mercado"}`,
    objetivoTexto: "Abrir contas novas em mercado ainda não atendido.",
  },

  vendas: {
    nome: "Fechar vendas",
    resumo: "Pagar por contrato assinado, não por atividade.",
    paraQuem: "Você tem demanda chegando e precisa de quem conduza a negociação até o fim.",
    funcao: "closer",
    acoes: ["realizada", "venda"],
    principal: "venda",
    prazoHoras: 96,
    proporcao: { realizada: 0.015, venda: 0.28 },
    tituloSugerido: (emp) => `Fechamento — ${emp.produto || emp.nome || "campanha"}`,
    objetivoTexto: "Conduzir a negociação e fechar contrato.",
  },

  campo: {
    nome: "Vender em campo",
    resumo: "Abordagem presencial em comércio, condomínio ou porta a porta.",
    paraQuem: "Seu produto se vende olho no olho, numa região definida.",
    funcao: "pap",
    acoes: ["agendamento", "realizada", "venda"],
    principal: "venda",
    prazoHoras: 48,
    proporcao: { agendamento: 0.01, realizada: 0.018, venda: 0.25 },
    tituloSugerido: (emp) => `Campo — ${emp.regiao || "região a definir"}`,
    objetivoTexto: "Abordagem presencial com fechamento no local.",
  },

  reativacao: {
    nome: "Reativar clientes",
    resumo: "Voltar a falar com quem já foi seu cliente e parou.",
    paraQuem: "Você tem uma base parada e ninguém com tempo para retomar contato.",
    funcao: "sdr",
    acoes: ["follow", "agendamento", "venda"],
    principal: "agendamento",
    prazoHoras: 72,
    proporcao: { follow: 0.003, agendamento: 0.014, venda: 0.2 },
    tituloSugerido: (emp) => `Reativação de base — ${emp.nome || "campanha"}`,
    objetivoTexto: "Retomar contato com base inativa e trazer de volta.",
  },
};

export const ORDEM_OBJETIVOS = ["reunioes", "prospeccao", "vendas", "campo", "reativacao"];

// Converte "R$ 1.490,50/mês" em 1490.5. Sem ticket não há sugestão de valor —
// e é melhor não sugerir do que sugerir a partir de um número inventado.
export function ticketEmNumero(bruto) {
  if (!bruto) return null;
  const m = String(bruto).replace(/\s/g, "").match(/([\d.]+,\d{2}|[\d.]+)/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Arredonda para um número que uma pessoa escreveria: 4,73 → 5; 47,3 → 47.
const redondo = (v) => (v >= 20 ? Math.round(v) : Math.max(0.5, Math.round(v * 2) / 2));

// Monta a campanha a partir do objetivo e dos dados que a empresa já
// preencheu. Tudo o que sai daqui é rascunho editável.
export function montarCampanha(chave, empresa = {}) {
  const obj = OBJETIVOS[chave];
  if (!obj) return null;

  const ticket = ticketEmNumero(empresa.ticket);

  // Sem ticket, os valores ficam em zero e a tela pede que a pessoa preencha.
  // Preencher com número arbitrário seria fingir uma recomendação.
  const tarefas = {};
  for (const acao of obj.acoes) {
    tarefas[acao] = ticket ? redondo(ticket * obj.proporcao[acao]) : 0;
  }

  const evidencias = {};
  const criteriosAprovacao = {};
  for (const acao of obj.acoes) {
    evidencias[acao] = ACOES[acao].prova;
    criteriosAprovacao[acao] = ACOES[acao].regra;
  }

  return {
    titulo: obj.tituloSugerido(empresa),
    objetivo: obj.objetivoTexto,
    descricao: "",
    produto: empresa.produto || "",
    publico: empresa.icp || "",
    regiao: empresa.regiao || "",
    funcao: obj.funcao,
    vagas: 2,
    orcamento: 0,
    prazoHoras: obj.prazoHoras,
    limitePorProfissional: 10,
    aceitaLeadProprio: chave === "prospeccao" || chave === "campo",
    exigeCertificacao: true,
    tarefas,
    evidencias,
    criteriosAprovacao,
    treinamento: [],
    requisitos: "",
    objetivoChave: chave,
    // Fica registrado se os valores saíram do ticket ou vieram zerados, para a
    // tela poder dizer isso a quem publica em vez de deixar o zero sem
    // explicação.
    valoresDerivadosDoTicket: Boolean(ticket),
  };
}

// Quanto a campanha consome por profissional que atinge a meta, para a tela
// mostrar o custo antes de a pessoa publicar. Só conta ação, nunca taxa.
export function custoEstimado(campanha, metaPorProfissional = 10) {
  const tarefas = campanha?.tarefas || {};
  const principal = Number(tarefas[campanha?.objetivoChave ? OBJETIVOS[campanha.objetivoChave]?.principal : ""] || 0);
  const somaAcoes = Object.values(tarefas).reduce((a, b) => a + Number(b || 0), 0);
  return {
    porAcaoPrincipal: principal,
    somaDeTodasAsAcoes: somaAcoes,
    estimativaPorProfissional: somaAcoes * metaPorProfissional,
  };
}

export const STATUS_CAMPANHA_UI = {
  rascunho: "Rascunho",
  em_revisao: "Aguardando aprovação",
  ativa: "Em andamento",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

export const FILTROS_STATUS_CAMPANHA = [
  { chave: "todas", label: "Todas", status: null },
  { chave: "em_andamento", label: "Em andamento", status: "ativa" },
  { chave: "aguardando_aprovacao", label: "Aguardando aprovação", status: "em_revisao" },
  { chave: "rascunhos", label: "Rascunhos", status: "rascunho" },
  { chave: "pausadas", label: "Pausadas", status: "pausada" },
  { chave: "encerradas", label: "Encerradas", status: "encerrada" },
];

export function filtrarCampanhasPorStatus(campanhas = [], chave = "todas") {
  const filtro = FILTROS_STATUS_CAMPANHA.find((item) => item.chave === chave);
  if (!filtro?.status) return campanhas;
  return campanhas.filter((campanha) => campanha.status === filtro.status);
}

export function taxaEntreEtapas(numerador, denominador) {
  const base = numero(denominador);
  return base > 0 ? Math.round((numero(numerador) / base) * 1000) / 10 : null;
}

export function custoPorResultado(investimento, quantidade) {
  const total = numero(quantidade);
  return total > 0 ? Math.round((numero(investimento) / total) * 100) / 100 : null;
}

export function gerarAlertasCampanha({ profissionais = [], financeiro = {}, variacaoReunioes = null, taxaAprovacaoAtual = null, taxaAprovacaoAnterior = null }) {
  const alertas = [];
  const inativos = profissionais.filter((p) => p.candidaturaStatus === "aprovado" && p.statusOperacional === "sem_atividade").length;
  if (inativos > 0) alertas.push({ nivel: "atencao", codigo: "PROFISSIONAIS_INATIVOS", texto: `${inativos} profissional(is) estão sem atividade há pelo menos 48 horas.` });
  if (financeiro.diasRestantes != null && financeiro.diasRestantes <= 2) alertas.push({ nivel: "critico", codigo: "SALDO_CURTO", texto: `Saldo suficiente para aproximadamente ${financeiro.diasRestantes.toLocaleString("pt-BR")} dia(s).` });
  if (taxaAprovacaoAtual != null && taxaAprovacaoAnterior != null) {
    const queda = Math.round((taxaAprovacaoAnterior - taxaAprovacaoAtual) * 10) / 10;
    if (queda >= 10) alertas.push({ nivel: "atencao", codigo: "APROVACAO_CAIU", texto: `A taxa de aprovação caiu ${queda.toLocaleString("pt-BR")}% no período.` });
  }
  if (variacaoReunioes != null && variacaoReunioes >= 20) alertas.push({ nivel: "positivo", codigo: "REUNIOES_SUBIRAM", texto: `As reuniões aumentaram ${variacaoReunioes.toLocaleString("pt-BR")}% em relação ao período anterior.` });
  return alertas;
}

const numero = (valor) => Number(valor) || 0;
const arredondar = (valor) => Math.round(numero(valor) * 100) / 100;

// Sem base anterior não existe variação defensável. Retornar null permite à
// interface omitir a tendência, em vez de transformar ausência de histórico
// em um crescimento fictício de 100%.
export function variacaoPercentual(atual, anterior) {
  const base = numero(anterior);
  if (base <= 0) return null;
  return Math.round(((numero(atual) - base) / base) * 1000) / 10;
}

export function projetarOrcamento({ gastoMes, orcamento, saldoDisponivel, diaDoMes, diasNoMes }) {
  const gasto = Math.max(0, numero(gastoMes));
  const limite = Math.max(0, numero(orcamento));
  const saldo = Math.max(0, numero(saldoDisponivel));
  const dia = Math.max(1, numero(diaDoMes));
  const totalDias = Math.max(dia, numero(diasNoMes));
  const gastoMedioDiario = arredondar(gasto / dia);
  const projecaoFechamento = arredondar(gastoMedioDiario * totalDias);
  const diasRestantes = gastoMedioDiario > 0 ? Math.round((saldo / gastoMedioDiario) * 10) / 10 : null;
  const percentual = limite > 0 ? Math.round((gasto / limite) * 1000) / 10 : null;
  const diasAteFim = Math.max(0, totalDias - dia);

  let risco = "sem_historico";
  if (gastoMedioDiario > 0 && diasRestantes != null && diasRestantes < diasAteFim) risco = "critico";
  else if (limite > 0 && projecaoFechamento > limite) risco = "atencao";
  else if (limite > 0 || gasto > 0) risco = "dentro";

  return { gastoMedioDiario, projecaoFechamento, diasRestantes, percentual, risco };
}

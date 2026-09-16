export const STATUS_CAMPANHA_UI = {
  rascunho: "Rascunho",
  em_revisao: "Aguardando aprovação",
  ativa: "Em andamento",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

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

// Otimização automática de verba para campanhas.
//
// Calcula investimento recomendado, distribuição entre funções e atividades,
// capacidade operacional estimada e duração projetada da verba.
//
// Considera dependências entre atividades (uma jornada completa que remunera
// agendamento + comparecimento + reunião custa a soma, não cada parte isolada).

const n = (v) => Number(v) || 0;
const dinheiro = (v) => Math.round(n(v) * 100) / 100;

// Calcula o custo de uma jornada completa (lead que percorre todo o funil)
export function custoJornadaCompleta(tarefas = {}, taxas = {}) {
  let custo = 0;
  for (const [acao, valor] of Object.entries(tarefas)) {
    if (n(valor) > 0) custo += n(valor);
  }
  // Taxas da plataforma (se houver)
  if (n(taxas.percentual) > 0) {
    custo = dinheiro(custo / (1 - n(taxas.percentual)));
  }
  return dinheiro(custo);
}

// Calcula quantas jornadas completas a verba comporta
export function jornadasPorVerba(orcamento, tarefas = {}, taxas = {}) {
  const custoJornada = custoJornadaCompleta(tarefas, taxas);
  if (custoJornada <= 0) return { jornadas: 0, custoJornada: 0 };
  return {
    jornadas: Math.floor(n(orcamento) / custoJornada),
    custoJornada,
  };
}

// Calcula a distribuição de verba entre funções em uma operação multi-função
export function distribuirVerbaEntreFuncoes(orcamentoTotal, funcoes = []) {
  if (!funcoes.length) return [];
  const total = funcoes.reduce((s, f) => s + n(f.peso || 1), 0);
  return funcoes.map((f) => ({
    funcao: f.funcao,
    percentual: total > 0 ? dinheiro(n(f.peso || 1) / total) : dinheiro(1 / funcoes.length),
    valor: total > 0 ? dinheiro(n(orcamentoTotal) * n(f.peso || 1) / total) : dinheiro(n(orcamentoTotal) / funcoes.length),
  }));
}

// Calcula investimento recomendado a partir da meta quantitativa
export function investimentoRecomendado({ metaQuantidade, tarefas = {}, etapasPlanejamento = [], taxas = {} }) {
  const meta = n(metaQuantidade);
  if (!meta) return null;

  const custoJornada = custoJornadaCompleta(tarefas, taxas);
  if (custoJornada <= 0) return null;

  // Usa contatos totais do planejamento reverso quando disponível
  const contatosTotais = etapasPlanejamento.length > 0
    ? n(etapasPlanejamento.find((e) => e.id === "contatos_trabalhados")?.quantidade) || meta
    : meta;

  // O investimento precisa cobrir os contatos trabalhados, não só a meta final
  const valorMedioAtividade = Object.values(tarefas).filter((v) => n(v) > 0);
  const mediaPorAtividade = valorMedioAtividade.length > 0
    ? valorMedioAtividade.reduce((s, v) => s + n(v), 0) / valorMedioAtividade.length
    : 0;

  const investimentoMinimo = dinheiro(contatosTotais * mediaPorAtividade);
  const investimentoRecomendado = dinheiro(investimentoMinimo * 1.15); // 15% margem de segurança

  return {
    investimentoMinimo,
    investimentoRecomendado,
    contatosTotais,
    custoJornada,
    premissas: {
      meta,
      atividades: Object.keys(tarefas).length,
      mediaPorAtividade: dinheiro(mediaPorAtividade),
    },
  };
}

// Calcula a capacidade operacional da verba
export function capacidadeOperacional({ orcamento, tarefas = {}, profissionais = 1, duracaoDias = 30, taxas = {} }) {
  const budget = n(orcamento);
  if (!budget) return null;

  const custoJornada = custoJornadaCompleta(tarefas, taxas);
  if (custoJornada <= 0) return null;

  const jornadas = Math.floor(budget / custoJornada);
  const jornadasPorProf = Math.floor(jornadas / Math.max(1, n(profissionais)));
  const consumoDiario = duracaoDias > 0 ? dinheiro(budget / n(duracaoDias)) : 0;
  const duracaoEstimada = consumoDiario > 0 ? Math.round(budget / consumoDiario) : null;

  // Detalhe por atividade
  const detalhePorAtividade = Object.entries(tarefas)
    .filter(([, v]) => n(v) > 0)
    .map(([acao, valor]) => ({
      acao,
      valorUnitario: n(valor),
      quantidadeMaxima: Math.floor(budget / n(valor)),
    }));

  return {
    jornadas,
    jornadasPorProfissional: jornadasPorProf,
    custoJornada,
    consumoDiario,
    duracaoEstimada,
    detalhePorAtividade,
  };
}

// Estima quanto tempo a verba vai durar no ritmo atual
export function projecaoDuracaoVerba({ verbaRestante, consumoMedio7d }) {
  const restante = n(verbaRestante);
  const consumo = n(consumoMedio7d);
  if (!restante || !consumo) return null;

  const consumoDiario = consumo / 7;
  const diasRestantes = Math.floor(restante / consumoDiario);

  return {
    diasRestantes,
    consumoDiario: dinheiro(consumoDiario),
    consumoSemanal: dinheiro(consumo),
    alerta: diasRestantes <= 7 ? "critico" : diasRestantes <= 14 ? "atencao" : null,
  };
}

// Valida remuneração por origem do lead
export function validarRemuneracaoPorOrigem(config = {}) {
  const { diferenciarPorOrigem, valorEmpresa, valorProfissional } = config;
  if (!diferenciarPorOrigem) return { valido: true };

  const vEmp = n(valorEmpresa);
  const vProf = n(valorProfissional);

  if (vEmp <= 0 && vProf <= 0) return { valido: false, erro: "Informe ao menos um valor de remuneração." };

  return {
    valido: true,
    valorEmpresa: dinheiro(vEmp),
    valorProfissional: dinheiro(vProf),
    diferenca: dinheiro(vProf - vEmp),
  };
}

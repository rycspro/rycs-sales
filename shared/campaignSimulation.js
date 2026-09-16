const n = (valor) => Number(valor) || 0;
const dinheiro = (valor) => Math.round(n(valor) * 100) / 100;

export function valorMedioDasTarefas(tarefas = {}) {
  const valores = Object.values(tarefas).map(Number).filter((valor) => Number.isFinite(valor) && valor > 0);
  return valores.length ? dinheiro(valores.reduce((soma, valor) => soma + valor, 0) / valores.length) : 0;
}

export function simularCapacidadeCampanha({ orcamento, profissionais, tarefas = {}, valorMedioTarefa, duracaoDias = 30, limitePorProfissional = 0, historico = null }) {
  const budget = Math.max(0, n(orcamento));
  const people = Math.max(1, Math.round(n(profissionais) || 1));
  const duration = Math.max(1, Math.round(n(duracaoDias) || 30));
  const average = Math.max(0, n(valorMedioTarefa) || valorMedioDasTarefas(tarefas));
  if (!budget || !average) return { disponivel: false, ausentes: [!budget && "orçamento", !average && "valor médio por tarefa"].filter(Boolean) };

  const maximoPorOrcamento = Math.floor(budget / average);
  const tetoOperacional = n(limitePorProfissional) > 0 ? Math.floor(n(limitePorProfissional) * people) : maximoPorOrcamento;
  const tarefasMaximas = Math.min(maximoPorOrcamento, tetoOperacional);
  const tarefasPorProfissional = Math.floor(tarefasMaximas / people);
  const consumoDiario = dinheiro((tarefasMaximas * average) / duration);
  const duracaoEstimada = consumoDiario > 0 ? Math.round((budget / consumoDiario) * 10) / 10 : null;

  let projecoesComerciais = null;
  let motivoSemProjecao = "Histórico insuficiente: são necessárias ao menos 10 tarefas liberadas da empresa.";
  if (historico && n(historico.amostra) >= 10 && n(historico.tarefas) > 0) {
    const estimar = (chave) => Math.round(tarefasMaximas * (n(historico[chave]) / n(historico.tarefas)));
    projecoesComerciais = {
      leads: estimar("leads"),
      reunioes: estimar("reunioes"),
      vendas: estimar("vendas"),
      amostra: n(historico.amostra),
      fonte: "histórico de tarefas liberadas da empresa",
      confianca: n(historico.amostra) >= 100 ? "alta" : n(historico.amostra) >= 30 ? "média" : "baixa",
      aviso: "Estimativa, não garantia de resultado.",
    };
    motivoSemProjecao = null;
  }

  return {
    disponivel: true,
    premissas: { orcamento: budget, profissionais: people, valorMedioTarefa: average, duracaoDias: duration, limitePorProfissional: n(limitePorProfissional) },
    tarefasMaximas,
    tarefasPorProfissional,
    consumoDiario,
    duracaoEstimada,
    projecoesComerciais,
    motivoSemProjecao,
  };
}

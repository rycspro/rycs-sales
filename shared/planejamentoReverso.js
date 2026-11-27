// Planejamento reverso: a partir da quantidade desejada de resultados,
// calcula as atividades necessárias para alcançá-los.
//
// Usa dados históricos da empresa quando disponíveis; na ausência, aplica
// premissas estimadas (identificadas como tal). Nunca exige que a empresa
// informe taxas de conversão ou cálculos comerciais.

const n = (v) => Number(v) || 0;
const pct = (v) => Math.min(1, Math.max(0, n(v)));

// Premissas padrão por objetivo, usadas quando não há histórico suficiente.
const PREMISSAS_PADRAO = {
  vendas: {
    taxaFechamento: 0.25,
    taxaComparecimento: 0.75,
    taxaAgendamento: 0.10,
    taxaQualificacao: 0.30,
    taxaContato: 0.40,
  },
  reunioes: {
    taxaAgendamento: 0.10,
    taxaQualificacao: 0.30,
    taxaContato: 0.40,
  },
  leads: {
    taxaQualificacao: 0.30,
    taxaContato: 0.40,
  },
  visitas: {
    taxaFechamento: 0.15,
    taxaVisitaEfetiva: 0.80,
    taxaContato: 0.50,
  },
  completa: {
    taxaFechamento: 0.20,
    taxaComparecimento: 0.75,
    taxaAgendamento: 0.10,
    taxaQualificacao: 0.30,
    taxaContato: 0.40,
  },
  reativacao: {
    taxaReativacao: 0.15,
    taxaAgendamento: 0.12,
    taxaContato: 0.35,
  },
  prospeccao: {
    taxaAgendamento: 0.08,
    taxaQualificacao: 0.25,
    taxaContato: 0.35,
  },
  campo: {
    taxaFechamento: 0.20,
    taxaVisitaEfetiva: 0.85,
    taxaContato: 0.50,
  },
};

// Pergunta adaptada ao objetivo selecionado
export function perguntaMetaQuantitativa(objetivoChave) {
  const mapa = {
    vendas: { label: "Quantas vendas deseja realizar?", unidade: "vendas", placeholder: "Ex.: 30" },
    reunioes: { label: "Quantas reuniões deseja agendar?", unidade: "reuniões", placeholder: "Ex.: 50" },
    leads: { label: "Quantos clientes deseja encontrar?", unidade: "leads qualificados", placeholder: "Ex.: 100" },
    visitas: { label: "Quantas visitas deseja realizar?", unidade: "visitas", placeholder: "Ex.: 200" },
    completa: { label: "Quantas vendas deseja fechar?", unidade: "vendas", placeholder: "Ex.: 20" },
    reativacao: { label: "Quantos clientes deseja reativar?", unidade: "clientes reativados", placeholder: "Ex.: 50" },
    prospeccao: { label: "Quantas reuniões deseja agendar?", unidade: "reuniões", placeholder: "Ex.: 40" },
    campo: { label: "Quantas vendas deseja fechar em campo?", unidade: "vendas", placeholder: "Ex.: 30" },
  };
  return mapa[objetivoChave] || mapa.vendas;
}

// Calcula o funil reverso a partir de uma meta quantitativa.
// historico: { taxaFechamento, taxaComparecimento, taxaAgendamento, taxaQualificacao, taxaContato, amostra }
export function calcularPlanejamentoReverso({ objetivoChave, metaQuantidade, historico = null, tarefas = {} }) {
  const meta = Math.max(0, Math.round(n(metaQuantidade)));
  if (!meta || !objetivoChave) return null;

  const premissas = PREMISSAS_PADRAO[objetivoChave] || PREMISSAS_PADRAO.vendas;
  const temHistorico = historico && n(historico.amostra) >= 10;
  const fonte = temHistorico ? "historico" : "estimativa";

  const tx = (campo) => {
    if (temHistorico && historico[campo] != null && n(historico[campo]) > 0) return pct(historico[campo]);
    return premissas[campo] || 0;
  };

  let etapas = [];

  if (objetivoChave === "vendas" || objetivoChave === "completa") {
    const vendas = meta;
    const taxaFech = tx("taxaFechamento");
    const reunioesRealizadas = taxaFech > 0 ? Math.ceil(vendas / taxaFech) : vendas * 4;
    const taxaComp = tx("taxaComparecimento");
    const reunioesAgendadas = taxaComp > 0 ? Math.ceil(reunioesRealizadas / taxaComp) : reunioesRealizadas;
    const taxaAgend = tx("taxaAgendamento");
    const contatosQualificados = taxaAgend > 0 ? Math.ceil(reunioesAgendadas / taxaAgend) : reunioesAgendadas * 10;
    const taxaQual = tx("taxaQualificacao");
    const contatosTrabalhados = taxaQual > 0 ? Math.ceil(contatosQualificados / taxaQual) : contatosQualificados * 3;

    etapas = [
      { id: "vendas", nome: "Vendas", quantidade: vendas, tipo: "meta" },
      { id: "reunioes_realizadas", nome: "Reuniões realizadas", quantidade: reunioesRealizadas, taxa: taxaFech, taxaNome: "Taxa de fechamento" },
      { id: "reunioes_agendadas", nome: "Reuniões agendadas", quantidade: reunioesAgendadas, taxa: taxaComp, taxaNome: "Taxa de comparecimento" },
      { id: "contatos_qualificados", nome: "Contatos qualificados", quantidade: contatosQualificados, taxa: taxaAgend, taxaNome: "Taxa de agendamento" },
      { id: "contatos_trabalhados", nome: "Contatos a trabalhar", quantidade: contatosTrabalhados, taxa: taxaQual, taxaNome: "Taxa de qualificação" },
    ];
  } else if (objetivoChave === "reunioes" || objetivoChave === "prospeccao") {
    const reunioes = meta;
    const taxaAgend = tx("taxaAgendamento");
    const contatosQualificados = taxaAgend > 0 ? Math.ceil(reunioes / taxaAgend) : reunioes * 10;
    const taxaQual = tx("taxaQualificacao");
    const contatosTrabalhados = taxaQual > 0 ? Math.ceil(contatosQualificados / taxaQual) : contatosQualificados * 3;

    etapas = [
      { id: "reunioes_agendadas", nome: "Reuniões agendadas", quantidade: reunioes, tipo: "meta" },
      { id: "contatos_qualificados", nome: "Contatos qualificados", quantidade: contatosQualificados, taxa: taxaAgend, taxaNome: "Taxa de agendamento" },
      { id: "contatos_trabalhados", nome: "Contatos a trabalhar", quantidade: contatosTrabalhados, taxa: taxaQual, taxaNome: "Taxa de qualificação" },
    ];
  } else if (objetivoChave === "leads") {
    const leads = meta;
    const taxaQual = tx("taxaQualificacao");
    const contatosTrabalhados = taxaQual > 0 ? Math.ceil(leads / taxaQual) : leads * 3;

    etapas = [
      { id: "leads_qualificados", nome: "Leads qualificados", quantidade: leads, tipo: "meta" },
      { id: "contatos_trabalhados", nome: "Contatos a trabalhar", quantidade: contatosTrabalhados, taxa: taxaQual, taxaNome: "Taxa de qualificação" },
    ];
  } else if (objetivoChave === "visitas" || objetivoChave === "campo") {
    const vendas = meta;
    const taxaFech = tx("taxaFechamento");
    const visitasNecessarias = taxaFech > 0 ? Math.ceil(vendas / taxaFech) : vendas * 5;
    const taxaVisita = tx("taxaVisitaEfetiva");
    const contatosTrabalhados = taxaVisita > 0 ? Math.ceil(visitasNecessarias / taxaVisita) : visitasNecessarias;

    etapas = [
      { id: "vendas", nome: "Vendas", quantidade: vendas, tipo: "meta" },
      { id: "visitas_realizadas", nome: "Visitas realizadas", quantidade: visitasNecessarias, taxa: taxaFech, taxaNome: "Taxa de fechamento" },
      { id: "contatos_trabalhados", nome: "Contatos a trabalhar", quantidade: contatosTrabalhados, taxa: taxaVisita, taxaNome: "Taxa de visita efetiva" },
    ];
  } else if (objetivoChave === "reativacao") {
    const reativados = meta;
    const taxaReativ = tx("taxaReativacao");
    const contatosTrabalhados = taxaReativ > 0 ? Math.ceil(reativados / taxaReativ) : reativados * 7;

    etapas = [
      { id: "clientes_reativados", nome: "Clientes reativados", quantidade: reativados, tipo: "meta" },
      { id: "contatos_trabalhados", nome: "Contatos da base a trabalhar", quantidade: contatosTrabalhados, taxa: taxaReativ, taxaNome: "Taxa de reativação" },
    ];
  }

  // Recomendações de estrutura
  const contatosTotais = etapas.find((e) => e.id === "contatos_trabalhados")?.quantidade || meta;
  const profissionaisRecomendados = Math.max(1, Math.ceil(contatosTotais / 200));

  // Investimento estimado a partir das tarefas configuradas
  let investimentoEstimado = 0;
  if (Object.keys(tarefas).length > 0) {
    const valorMedioTarefa = Object.values(tarefas).reduce((s, v) => s + n(v), 0) / Object.values(tarefas).length;
    investimentoEstimado = Math.round(contatosTotais * valorMedioTarefa * 100) / 100;
  }

  return {
    meta,
    objetivoChave,
    etapas,
    fonte,
    temHistorico,
    contatosTotais,
    profissionaisRecomendados,
    investimentoEstimado,
    aviso: !temHistorico
      ? "Taxas estimadas com base em premissas gerais. Os números reais podem variar conforme seu segmento e operação."
      : `Taxas calculadas a partir de ${n(historico.amostra)} operações anteriores.`,
  };
}

// Calcula capacidade a partir da verba (quando não há meta quantitativa)
export function calcularCapacidadePorVerba({ orcamento, tarefas = {}, duracaoDias = 30 }) {
  const budget = n(orcamento);
  if (!budget) return null;

  const valores = Object.entries(tarefas).filter(([, v]) => n(v) > 0);
  if (!valores.length) return null;

  const valorMedio = valores.reduce((s, [, v]) => s + n(v), 0) / valores.length;
  const totalAtividades = Math.floor(budget / valorMedio);
  const atividadesPorDia = duracaoDias > 0 ? Math.round((totalAtividades / duracaoDias) * 10) / 10 : 0;

  return {
    totalAtividades,
    atividadesPorDia,
    valorMedio: Math.round(valorMedio * 100) / 100,
    premissas: { orcamento: budget, duracaoDias },
  };
}

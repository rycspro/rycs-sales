// Projeção de ROI do funil comercial — baseado na planilha RYCS-Logica-Funil-e-Caixa.
// Recebe as entradas do canal e retorna todo o funil calculado + financeiro + ROI.

const n = (v) => Number(v) || 0;

// Premissas padrão quando a empresa ainda não informou
const PREMISSAS = {
  custoLead: 0,
  aumentoCustoLead: 0,
  custoContatoMinerado: 0,
  pctAgenda: 0.12,
  pctAgendamentosVerificados: 1,
  pctComparece: 0.7,
  pctFecha: 0.25,
  pctPacote: 0.7,
  ticketMensal: 599,
  ticketPacote: 2037.45,
  ganhoSdrAgendamento: 5,
  ganhoSdrContato: 0,
  bonusSdrComparecimento: 0,
  ganhoCloserReuniao: 20,
  comissaoCloserVenda: 0,
  taxasImpostos: 0.08,
  contatosSdrDia: 30,
  reunioesCloserDia: 8,
  diasOperacao: 22,
  aproveitamentoReal: 0.5,
  metaFaturamento: 0,
};

export function calcularFunilProjecao(entradas = {}) {
  const e = { ...PREMISSAS, ...entradas };

  // --- 3. FUNIL ---
  const custoAquisicaoContato =
    n(e.custoLead) * (1 + n(e.aumentoCustoLead)) +
    n(e.custoContatoMinerado) +
    n(e.pctAgenda) * n(e.pctAgendamentosVerificados) * n(e.ganhoSdrAgendamento) +
    n(e.ganhoSdrContato) +
    n(e.pctAgenda) * n(e.pctComparece) * n(e.bonusSdrComparecimento);

  const contatos = custoAquisicaoContato > 0 ? n(e.verbaCanal) / custoAquisicaoContato : 0;
  const agendamentos = contatos * n(e.pctAgenda);
  const agendamentosVerificados = agendamentos * n(e.pctAgendamentosVerificados);
  const reunioesRealizadas = agendamentos * n(e.pctComparece);
  const vendas = reunioesRealizadas * n(e.pctFecha);
  const vendasPacote = vendas * n(e.pctPacote);
  const vendasMensal = vendas - vendasPacote;

  // --- 4. DINHEIRO ---
  const faturamento = vendasPacote * n(e.ticketPacote) + vendasMensal * n(e.ticketMensal);
  const ticketMedio = vendas > 0 ? faturamento / vendas : 0;
  const custoMidia = contatos * (n(e.custoLead) * (1 + n(e.aumentoCustoLead)) + n(e.custoContatoMinerado));
  const custoSdrs = agendamentosVerificados * n(e.ganhoSdrAgendamento) + contatos * n(e.ganhoSdrContato) + reunioesRealizadas * n(e.bonusSdrComparecimento);
  const custoClosers = reunioesRealizadas * n(e.ganhoCloserReuniao) + faturamento * n(e.comissaoCloserVenda);
  const taxasImpostos = faturamento * n(e.taxasImpostos);
  const custoTotal = custoMidia + custoSdrs + custoClosers + taxasImpostos;
  const cac = vendas > 0 ? custoTotal / vendas : 0;
  const cacAquisicao = vendas > 0 ? (custoMidia + custoSdrs) / vendas : 0;
  const lucro = faturamento - custoTotal;
  const margem = faturamento > 0 ? lucro / faturamento : 0;
  const roi = custoTotal > 0 ? lucro / custoTotal : 0;
  const retornoPorReal = custoTotal > 0 ? faturamento / custoTotal : 0;

  // --- 5. EQUIPE NECESSÁRIA ---
  const capacidadeSdr = n(e.contatosSdrDia) * n(e.diasOperacao) * n(e.aproveitamentoReal);
  const capacidadeCloser = n(e.reunioesCloserDia) * n(e.diasOperacao) * n(e.aproveitamentoReal);
  const sdrsNecessarios = capacidadeSdr > 0 ? Math.ceil(contatos / capacidadeSdr) : 0;
  const closersNecessarios = capacidadeCloser > 0 ? Math.ceil(reunioesRealizadas / capacidadeCloser) : 0;

  // --- 6. META ---
  const metaFat = n(e.metaFaturamento);
  const vendasParaMeta = ticketMedio > 0 && metaFat > 0 ? Math.ceil(metaFat / ticketMedio) : 0;
  const reunioesParaMeta = n(e.pctFecha) > 0 && vendasParaMeta > 0 ? Math.ceil(vendasParaMeta / n(e.pctFecha)) : 0;
  const agendamentosParaMeta = n(e.pctComparece) > 0 && reunioesParaMeta > 0 ? Math.ceil(reunioesParaMeta / n(e.pctComparece)) : 0;
  const contatosParaMeta = n(e.pctAgenda) > 0 && agendamentosParaMeta > 0 ? Math.ceil(agendamentosParaMeta / n(e.pctAgenda)) : 0;
  const verbaParaMeta = contatosParaMeta > 0 ? contatosParaMeta * custoAquisicaoContato : 0;

  return {
    funil: {
      custoAquisicaoContato: r2(custoAquisicaoContato),
      contatos: Math.round(contatos),
      agendamentos: Math.round(agendamentos),
      agendamentosVerificados: Math.round(agendamentosVerificados),
      reunioesRealizadas: Math.round(reunioesRealizadas),
      vendas: Math.round(vendas * 100) / 100,
      vendasPacote: Math.round(vendasPacote * 100) / 100,
      vendasMensal: Math.round(vendasMensal * 100) / 100,
    },
    financeiro: {
      faturamento: r2(faturamento),
      ticketMedio: r2(ticketMedio),
      custoMidia: r2(custoMidia),
      custoSdrs: r2(custoSdrs),
      custoClosers: r2(custoClosers),
      taxasImpostos: r2(taxasImpostos),
      custoTotal: r2(custoTotal),
      cac: r2(cac),
      cacAquisicao: r2(cacAquisicao),
      lucro: r2(lucro),
      margem: r2(margem * 100),
      roi: r2(roi * 100),
      retornoPorReal: r2(retornoPorReal),
    },
    equipe: {
      sdrsNecessarios,
      closersNecessarios,
    },
    meta: metaFat > 0 ? {
      vendasParaMeta,
      reunioesParaMeta,
      agendamentosParaMeta,
      contatosParaMeta,
      verbaParaMeta: r2(verbaParaMeta),
    } : null,
  };
}

function r2(v) { return Math.round(n(v) * 100) / 100; }

// Converte dados da campanha + empresa nos inputs do funil
export function entradaDaCampanha(campanha, empresa, formasGanho = []) {
  const orcamento = n(campanha.orcamento);
  const ticket = n(empresa.ticket) || n(campanha.ticketMensal) || PREMISSAS.ticketMensal;
  const ticketPacote = n(campanha.ticketPacote) || ticket * 3.4;
  const duracao = n(campanha.duracaoDias) || 30;
  const origemLeads = campanha.origemLeads || "";

  let custoLead = 0;
  if (origemLeads === "trafego_pago") custoLead = n(campanha.custoLead) || 7;

  let ganhoSdrAgendamento = PREMISSAS.ganhoSdrAgendamento;
  let ganhoCloserReuniao = PREMISSAS.ganhoCloserReuniao;
  for (const fg of formasGanho) {
    if (fg.eventoComercial === "agendamento" && fg.tipoRemuneracao === "fixo") ganhoSdrAgendamento = n(fg.valor);
    if (fg.eventoComercial === "reuniao_realizada" && fg.tipoRemuneracao === "fixo") ganhoCloserReuniao = n(fg.valor);
  }

  return {
    verbaCanal: orcamento,
    custoLead,
    aumentoCustoLead: origemLeads === "trafego_pago" ? 0.3 : 0,
    custoContatoMinerado: origemLeads === "mineracao" ? 0.01 : 0,
    pctAgenda: n(campanha.taxaAgendamento) || PREMISSAS.pctAgenda,
    pctAgendamentosVerificados: 1,
    pctComparece: n(campanha.taxaComparecimento) || PREMISSAS.pctComparece,
    pctFecha: n(campanha.taxaFechamento) || PREMISSAS.pctFecha,
    pctPacote: n(campanha.pctPacote) || PREMISSAS.pctPacote,
    ticketMensal: ticket,
    ticketPacote,
    ganhoSdrAgendamento,
    ganhoSdrContato: 0,
    bonusSdrComparecimento: 0,
    ganhoCloserReuniao,
    comissaoCloserVenda: 0,
    taxasImpostos: PREMISSAS.taxasImpostos,
    contatosSdrDia: n(campanha.contatosSdrDia) || PREMISSAS.contatosSdrDia,
    reunioesCloserDia: n(campanha.reunioesCloserDia) || PREMISSAS.reunioesCloserDia,
    diasOperacao: duracao,
    aproveitamentoReal: PREMISSAS.aproveitamentoReal,
    metaFaturamento: n(campanha.metaFaturamento) || 0,
  };
}

// Projeção de ROI do funil comercial — lógica da planilha RYCS-Logica-Funil-e-Caixa.
// Recebe as entradas do canal e retorna o funil, o financeiro, a equipe e a meta.

import { ticketEmNumero } from "./objetivosCampanha.js";

const n = (v) => Number(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

// Taxas da planilha por tipo de canal (colunas A e B). "ambos" é a média das duas.
const TAXAS_POR_ORIGEM = {
  empresa: { canal: "Lead próprio", pctAgenda: 0.247, pctFecha: 0.3, contatosSdrDia: 20 },
  profissional: { canal: "Mineração", pctAgenda: 0.12, pctFecha: 0.2, contatosSdrDia: 120 },
  ambos: { canal: "Lead próprio + mineração", pctAgenda: 0.1835, pctFecha: 0.25, contatosSdrDia: 70 },
};

const PADRAO = {
  custoLead: 0,
  aumentoCustoLead: 0,
  custoContatoMinerado: 0,
  pctAgendamentosVerificados: 1,
  pctComparece: 0.7,
  pctPacote: 0,
  ticketMensal: 0,
  ticketPacote: 0,
  ganhoSdrAgendamento: 0,
  ganhoSdrContato: 0,
  bonusSdrComparecimento: 0,
  ganhoCloserReuniao: 0,
  ganhoCloserVenda: 0,
  comissaoCloserVenda: 0,
  taxasImpostos: 0.08,
  reunioesCloserDia: 8,
  diasOperacao: 5,
  aproveitamentoReal: 0.5,
  metaFaturamento: 0,
};

export function calcularFunilProjecao(entradas = {}) {
  const e = { ...PADRAO, ...TAXAS_POR_ORIGEM.ambos, ...entradas };
  const custoLeadEscalado = n(e.custoLead) * (1 + n(e.aumentoCustoLead));

  // 3. Funil
  const custoAquisicaoContato =
    custoLeadEscalado + n(e.custoContatoMinerado) +
    n(e.pctAgenda) * n(e.pctAgendamentosVerificados) * n(e.ganhoSdrAgendamento) +
    n(e.ganhoSdrContato) +
    n(e.pctAgenda) * n(e.pctComparece) * n(e.bonusSdrComparecimento);
  // Sem custo de aquisição (campanha que paga só reunião/venda), a verba cobre o custo do closer por contato.
  const custoCloserPorContato = n(e.pctAgenda) * n(e.pctComparece) *
    (n(e.ganhoCloserReuniao) + n(e.pctFecha) * (n(e.ganhoCloserVenda) + n(e.ticketMensal) * n(e.comissaoCloserVenda)));
  const baseVerba = custoAquisicaoContato > 0 ? "aquisicao" : custoCloserPorContato > 0 ? "closer" : null;
  const custoPorContatoUsado = baseVerba === "aquisicao" ? custoAquisicaoContato : custoCloserPorContato;
  const contatos = baseVerba ? n(e.verbaCanal) / custoPorContatoUsado : 0;
  const agendamentos = contatos * n(e.pctAgenda);
  const agendamentosVerificados = agendamentos * n(e.pctAgendamentosVerificados);
  const reunioesRealizadas = agendamentos * n(e.pctComparece);
  const vendas = reunioesRealizadas * n(e.pctFecha);
  const vendasPacote = vendas * n(e.pctPacote);
  const vendasMensal = vendas - vendasPacote;

  // 4. Dinheiro
  const faturamento = vendasPacote * n(e.ticketPacote) + vendasMensal * n(e.ticketMensal);
  const ticketMedio = vendas > 0 ? faturamento / vendas : 0;
  const custoMidia = contatos * (custoLeadEscalado + n(e.custoContatoMinerado));
  const custoSdrs = agendamentosVerificados * n(e.ganhoSdrAgendamento) + contatos * n(e.ganhoSdrContato) + reunioesRealizadas * n(e.bonusSdrComparecimento);
  const custoClosers = reunioesRealizadas * n(e.ganhoCloserReuniao) + vendas * n(e.ganhoCloserVenda) + faturamento * n(e.comissaoCloserVenda);
  const taxasImpostos = faturamento * n(e.taxasImpostos);
  const custoTotal = custoMidia + custoSdrs + custoClosers + taxasImpostos;
  const lucro = faturamento - custoTotal;

  // 5. Equipe necessária
  const capacidadeSdr = n(e.contatosSdrDia) * n(e.diasOperacao) * n(e.aproveitamentoReal);
  const capacidadeCloser = n(e.reunioesCloserDia) * n(e.diasOperacao) * n(e.aproveitamentoReal);

  // 6. Meta
  const metaFat = n(e.metaFaturamento);
  const vendasParaMeta = ticketMedio > 0 && metaFat > 0 ? Math.ceil(metaFat / ticketMedio) : 0;
  const reunioesParaMeta = n(e.pctFecha) > 0 ? vendasParaMeta / n(e.pctFecha) : 0;
  const agendamentosParaMeta = n(e.pctComparece) > 0 ? reunioesParaMeta / n(e.pctComparece) : 0;
  const contatosParaMeta = n(e.pctAgenda) > 0 ? agendamentosParaMeta / n(e.pctAgenda) : 0;

  return {
    funil: {
      baseVerba,
      custoAquisicaoContato: r2(custoAquisicaoContato),
      custoPorContatoUsado: r2(custoPorContatoUsado),
      contatos: Math.round(contatos),
      agendamentos: Math.round(agendamentos),
      agendamentosVerificados: Math.round(agendamentosVerificados),
      reunioesRealizadas: Math.round(reunioesRealizadas),
      vendas: Math.round(vendas * 10) / 10,
      vendasPacote: r2(vendasPacote),
      vendasMensal: r2(vendasMensal),
    },
    financeiro: {
      faturamento: r2(faturamento),
      ticketMedio: r2(ticketMedio),
      custoMidia: r2(custoMidia),
      custoSdrs: r2(custoSdrs),
      custoClosers: r2(custoClosers),
      taxasImpostos: r2(taxasImpostos),
      custoTotal: r2(custoTotal),
      cac: vendas > 0 ? r2(custoTotal / vendas) : 0,
      cacAquisicao: vendas > 0 ? r2((custoMidia + custoSdrs) / vendas) : 0,
      lucro: r2(lucro),
      margem: faturamento > 0 ? r2((lucro / faturamento) * 100) : 0,
      roi: custoTotal > 0 ? r2((lucro / custoTotal) * 100) : 0,
      retornoPorReal: custoTotal > 0 ? r2(faturamento / custoTotal) : 0,
    },
    equipe: {
      sdrsNecessarios: capacidadeSdr > 0 ? Math.ceil(contatos / capacidadeSdr) : 0,
      closersNecessarios: capacidadeCloser > 0 ? Math.ceil(reunioesRealizadas / capacidadeCloser) : 0,
    },
    meta: metaFat > 0 ? {
      vendasParaMeta,
      reunioesParaMeta: Math.round(reunioesParaMeta),
      agendamentosParaMeta: Math.round(agendamentosParaMeta),
      contatosParaMeta: Math.round(contatosParaMeta),
      verbaParaMeta: r2(contatosParaMeta * custoAquisicaoContato),
    } : null,
  };
}

function listaProdutos(produtos) {
  if (Array.isArray(produtos)) return produtos;
  try { return JSON.parse(produtos || "[]") || []; } catch { return []; }
}

// Ticket: média dos preços dos produtos da campanha; sem preço, o ticket do perfil da empresa.
export function ticketDaCampanha(campanha = {}, empresa = {}) {
  const precos = listaProdutos(campanha.produtosCampanha).map((p) => n(p?.preco)).filter((v) => v > 0);
  if (precos.length) return { valor: precos.reduce((s, v) => s + v, 0) / precos.length, origem: "produtos" };
  const doPerfil = ticketEmNumero(empresa?.ticket) || 0;
  return doPerfil > 0 ? { valor: doPerfil, origem: "perfil" } : { valor: 0, origem: null };
}

// Pagamentos por evento: formas de ganho ativas têm prioridade; senão, o valor das tarefas da campanha.
function pagamentos(tarefas = {}, formasGanho = []) {
  const t = typeof tarefas === "string" ? (() => { try { return JSON.parse(tarefas); } catch { return {}; } })() : (tarefas || {});
  const p = {
    ganhoSdrContato: n(t.ligacao) || n(t.contato),
    ganhoSdrAgendamento: n(t.agendamento),
    bonusSdrComparecimento: 0,
    ganhoCloserReuniao: n(t.realizada),
    ganhoCloserVenda: n(t.venda),
    comissaoCloserVenda: 0,
  };
  const fixo = (fg) => fg.tipoRemuneracao !== "comissao";
  for (const fg of formasGanho) {
    const v = n(fg.valor);
    switch (fg.eventoComercial) {
      case "contato_discadora": case "contato_whatsapp": if (fixo(fg)) p.ganhoSdrContato = v; break;
      case "reuniao_agendada": if (fixo(fg)) p.ganhoSdrAgendamento = v; break;
      case "cliente_compareceu": if (fixo(fg)) p.bonusSdrComparecimento = v; break;
      case "reuniao_realizada": if (fixo(fg)) p.ganhoCloserReuniao = v; break;
      case "venda_concluida": case "pagamento_confirmado":
        if (fixo(fg)) p.ganhoCloserVenda = v; else p.comissaoCloserVenda = v / 100;
        break;
    }
  }
  return p;
}

// Converte campanha + empresa (+ formas de ganho) nas entradas da planilha.
export function entradaDaCampanha(campanha = {}, empresa = {}, formasGanho = []) {
  const taxas = TAXAS_POR_ORIGEM[campanha.origemLeads] || TAXAS_POR_ORIGEM.ambos;
  const ticket = ticketDaCampanha(campanha, empresa);
  const duracao = n(campanha.duracaoDias) || 30;
  return {
    ...PADRAO,
    ...taxas,
    ...pagamentos(campanha.tarefas, formasGanho),
    verbaCanal: n(campanha.orcamento),
    ticketMensal: ticket.valor,
    ticketOrigem: ticket.origem,
    diasOperacao: Math.max(1, Math.round((duracao * 5) / 7)),
    metaFaturamento: n(campanha.metaFaturamento),
  };
}

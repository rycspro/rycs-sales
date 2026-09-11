const n = (value) => Number(value) || 0;

export function valorMonetario(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value || "").replace(/[^\d,.-]/g, "");
  if (!raw) return 0;
  const normalizado = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number(normalizado) || 0;
}

export function metricasEmpresa({ submissions = [], campaigns = [], leads = [], companyId, filtros = {} }) {
  const desde = filtros.dias ? Date.now() - Number(filtros.dias) * 86400000 : 0;
  const subs = submissions.filter((s) => s.companyId === companyId
    && (!desde || n(s.criadoEm) >= desde)
    && (!filtros.campaignId || s.campaignId === filtros.campaignId)
    && (!filtros.sellerId || s.sellerId === filtros.sellerId)
    && (!filtros.tipo || s.tipo === filtros.tipo));
  const liberadas = subs.filter((s) => s.status === "liberado");
  const agendadas = liberadas.filter((s) => s.tipo === "agendamento").length;
  const realizadas = liberadas.filter((s) => s.tipo === "realizada").length;
  const vendas = liberadas.filter((s) => s.tipo === "venda").length;
  const investimento = liberadas.reduce((sum, s) => sum + n(s.valor), 0);
  const retorno = liberadas.filter((s) => s.tipo === "venda")
    .reduce((sum, s) => sum + valorMonetario(s.prova?.valorContrato), 0);
  const roi = investimento > 0 ? ((retorno - investimento) / investimento) * 100 : null;
  const status = ["liberado", "revisao", "conferido", "ia_recusado", "recusado", "analisando"]
    .map((chave) => ({ chave, valor: subs.filter((s) => s.status === chave).length }))
    .filter((x) => x.valor > 0);
  const campanhas = campaigns.filter((c) => c.companyId === companyId).map((c) => {
    const itens = subs.filter((s) => s.campaignId === c.id);
    return { id: c.id, nome: c.titulo, total: itens.length, aprovadas: itens.filter((s) => s.status === "liberado").length };
  });
  const leadsFiltrados = leads.filter((l) => l.companyId === companyId
    && (!desde || n(l.criadoEm) >= desde)
    && (!filtros.campaignId || l.campaignId === filtros.campaignId)
    && (!filtros.sellerId || l.sellerId === filtros.sellerId));
  return { subs, liberadas, agendadas, realizadas, vendas, investimento, retorno, roi, status, campanhas, leads: leadsFiltrados };
}

export function projetarROI({ metricas, metaVendas = 0, ticketMedio = 0, taxaComparecimento, taxaConversao, custoAgendada }) {
  const amostra = metricas?.agendadas || 0;
  const comparecimentoHistorico = metricas?.agendadas > 0 ? metricas.realizadas / metricas.agendadas : 0;
  const conversaoHistorica = metricas?.realizadas > 0 ? metricas.vendas / metricas.realizadas : 0;
  const custoHistorico = metricas?.agendadas > 0 ? metricas.investimento / metricas.agendadas : 0;
  const base = {
    comparecimento: n(taxaComparecimento) || comparecimentoHistorico,
    conversao: n(taxaConversao) || conversaoHistorica,
    custo: n(custoAgendada) || custoHistorico,
    ticket: n(ticketMedio), meta: Math.max(0, Math.round(n(metaVendas))),
  };
  if (!base.meta || !base.ticket || !base.comparecimento || !base.conversao || !base.custo) {
    return { disponivel: false, ausentes: [!base.meta && "meta de vendas", !base.ticket && "ticket médio", !base.comparecimento && "taxa de comparecimento", !base.conversao && "taxa de conversão", !base.custo && "custo por reunião agendada"].filter(Boolean) };
  }
  const calcular = (fator) => {
    const comparecimento = Math.min(1, Math.max(.01, base.comparecimento * fator));
    const conversao = Math.min(1, Math.max(.01, base.conversao * fator));
    const realizadas = Math.ceil(base.meta / conversao);
    const agendadas = Math.ceil(realizadas / comparecimento);
    const investimento = agendadas * base.custo;
    const receita = base.meta * base.ticket;
    return { agendadas, realizadas, vendas: base.meta, investimento, receita, roi: investimento > 0 ? ((receita - investimento) / investimento) * 100 : null, comparecimento, conversao };
  };
  return {
    disponivel: true,
    amostra,
    confianca: amostra >= 50 ? "alta" : amostra >= 10 ? "média" : "baixa",
    fonte: comparecimentoHistorico && conversaoHistorica && custoHistorico ? "histórico filtrado da empresa" : "parâmetros informados pelo proprietário",
    cenarios: { conservador: calcular(.85), provavel: calcular(1), otimista: calcular(1.15) },
  };
}

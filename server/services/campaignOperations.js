import db from "../db.js";
import { custoPorResultado, projetarOrcamento, taxaEntreEtapas, variacaoPercentual } from "../../shared/campaignOperations.js";
import { listarEventosCampanha } from "./campaignEvents.js";

const valor = (row, chave = "total") => Number(row?.[chave]) || 0;
const DIA = 86400000;
const FUSO_SAO_PAULO = -3 * 60 * 60 * 1000;

function inicioDiaSaoPaulo(agoraMs) {
  const local = new Date(agoraMs + FUSO_SAO_PAULO);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - FUSO_SAO_PAULO;
}

function inicioMesSaoPaulo(agoraMs, deslocamento = 0) {
  const local = new Date(agoraMs + FUSO_SAO_PAULO);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + deslocamento, 1) - FUSO_SAO_PAULO;
}

function intervalos(agoraMs) {
  const agora = new Date(agoraMs + FUSO_SAO_PAULO);
  const inicioHoje = inicioDiaSaoPaulo(agoraMs);
  const inicioMes = inicioMesSaoPaulo(agoraMs);
  const inicioMesAnterior = inicioMesSaoPaulo(agoraMs, -1);
  const duracaoHoje = Math.max(1, agoraMs - inicioHoje);
  const duracaoMes = Math.max(1, agoraMs - inicioMes);
  return {
    agora: agoraMs,
    inicioHoje,
    inicioOntemEquivalente: inicioHoje - 86400000,
    fimOntemEquivalente: inicioHoje - 86400000 + duracaoHoje,
    inicioMes,
    inicioMesAnterior,
    fimMesAnteriorEquivalente: Math.min(inicioMes, inicioMesAnterior + duracaoMes),
    diaDoMes: agora.getUTCDate(),
    diasNoMes: new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0)).getUTCDate(),
  };
}

function resolverPeriodo(periodo = "7d", agoraMs = Date.now(), de, ate) {
  const fim = agoraMs + 1;
  if (periodo === "personalizado") {
    const inicioCustom = Number(de);
    const fimCustom = Number(ate);
    if (Number.isFinite(inicioCustom) && Number.isFinite(fimCustom) && inicioCustom < fimCustom) {
      const inicio = Math.max(inicioCustom, fimCustom - 366 * DIA);
      return { inicio, fim: Math.min(fimCustom + 1, fim), label: "Personalizado" };
    }
  }
  const inicioHoje = inicioDiaSaoPaulo(agoraMs);
  if (periodo === "hoje") return { inicio: inicioHoje, fim, label: "Hoje" };
  if (periodo === "30d") return { inicio: inicioHoje - 29 * DIA, fim, label: "30 dias" };
  return { inicio: inicioHoje - 6 * DIA, fim, label: "7 dias" };
}

function agregarPeriodo(companyId, campaignId, inicio, fim) {
  const tarefas = db.prepare(`
    SELECT COUNT(*) tarefas,
           SUM(CASE WHEN status = 'liberado' AND tipo = 'ligacao' THEN 1 ELSE 0 END) contatos,
           SUM(CASE WHEN status = 'liberado' AND tipo = 'agendamento' THEN 1 ELSE 0 END) reunioes,
           SUM(CASE WHEN status = 'liberado' AND tipo = 'realizada' THEN 1 ELSE 0 END) realizadas,
           SUM(CASE WHEN status = 'liberado' AND tipo = 'venda' THEN 1 ELSE 0 END) vendas
      FROM submissions
     WHERE companyId = ? AND campaignId = ? AND criadoEm >= ? AND criadoEm < ?
  `).get(companyId, campaignId, inicio, fim);
  const leads = valor(db.prepare(`SELECT COUNT(*) total FROM leads WHERE companyId = ? AND campaignId = ? AND criadoEm >= ? AND criadoEm < ?`).get(companyId, campaignId, inicio, fim));
  const investimento = valor(db.prepare(`
    SELECT COALESCE(SUM(ABS(fl.valor)), 0) total
      FROM financial_ledger fl JOIN submissions s ON s.id = fl.submissionId
     WHERE fl.companyId = ? AND s.companyId = ? AND s.campaignId = ? AND fl.tipo = 'liquidacao'
       AND fl.criadoEm >= ? AND fl.criadoEm < ?
  `).get(companyId, companyId, campaignId, inicio, fim));
  return {
    investimento,
    tarefas: Number(tarefas.tarefas) || 0,
    contatos: Number(tarefas.contatos) || 0,
    leads,
    reunioes: Number(tarefas.reunioes) || 0,
    realizadas: Number(tarefas.realizadas) || 0,
    vendas: Number(tarefas.vendas) || 0,
  };
}

function serieTemporal(companyId, campaignId, inicio, fim) {
  const tarefas = mapa(db.prepare(`
    SELECT strftime('%Y-%m-%d', criadoEm / 1000, 'unixepoch', '-3 hours') campaignId,
           COUNT(*) tarefas,
           SUM(CASE WHEN status = 'liberado' AND tipo = 'agendamento' THEN 1 ELSE 0 END) reunioes,
           SUM(CASE WHEN status = 'liberado' AND tipo = 'venda' THEN 1 ELSE 0 END) vendas
      FROM submissions WHERE companyId = ? AND campaignId = ? AND criadoEm >= ? AND criadoEm < ?
     GROUP BY 1 ORDER BY 1
  `).all(companyId, campaignId, inicio, fim));
  const leads = mapa(db.prepare(`
    SELECT strftime('%Y-%m-%d', criadoEm / 1000, 'unixepoch', '-3 hours') campaignId, COUNT(*) leads
      FROM leads WHERE companyId = ? AND campaignId = ? AND criadoEm >= ? AND criadoEm < ? GROUP BY 1 ORDER BY 1
  `).all(companyId, campaignId, inicio, fim));
  const gastos = mapa(db.prepare(`
    SELECT strftime('%Y-%m-%d', fl.criadoEm / 1000, 'unixepoch', '-3 hours') campaignId, SUM(ABS(fl.valor)) investimento
      FROM financial_ledger fl JOIN submissions s ON s.id = fl.submissionId
     WHERE fl.companyId = ? AND s.companyId = ? AND s.campaignId = ? AND fl.tipo = 'liquidacao'
       AND fl.criadoEm >= ? AND fl.criadoEm < ? GROUP BY 1 ORDER BY 1
  `).all(companyId, companyId, campaignId, inicio, fim));
  const dias = [];
  for (let cursor = inicioDiaSaoPaulo(inicio); cursor < fim; cursor += DIA) {
    const data = new Date(cursor + FUSO_SAO_PAULO).toISOString().slice(0, 10);
    const t = tarefas.get(data) || {};
    dias.push({
      data,
      investimento: Number(gastos.get(data)?.investimento) || 0,
      tarefas: Number(t.tarefas) || 0,
      leads: Number(leads.get(data)?.leads) || 0,
      reunioes: Number(t.reunioes) || 0,
      vendas: Number(t.vendas) || 0,
    });
  }
  return dias.slice(-31);
}

function profissionaisDaCampanha(companyId, campaignId, agoraMs) {
  const candidaturas = db.prepare(`
    SELECT ca.id applicationId, ca.sellerId, ca.status candidaturaStatus, ca.criadoEm candidaturaEm,
           s.nome, s.foto, s.titulo, s.perfil, s.cidade, s.nota, s.scoreTriagem
      FROM campaign_applications ca
      JOIN campaigns c ON c.id = ca.campaignId
      JOIN sellers s ON s.id = ca.sellerId
     WHERE c.companyId = ? AND ca.campaignId = ? AND ca.status IN ('aprovado', 'pendente')
     ORDER BY ca.criadoEm DESC
  `).all(companyId, campaignId);
  const agregados = mapa(db.prepare(`
    SELECT sellerId campaignId,
           COUNT(*) tarefas,
           SUM(CASE WHEN criadoEm >= ? THEN 1 ELSE 0 END) tarefasHoje,
           SUM(CASE WHEN status = 'liberado' AND tipo = 'agendamento' THEN 1 ELSE 0 END) reunioes,
           SUM(CASE WHEN status = 'liberado' AND tipo = 'realizada' THEN 1 ELSE 0 END) realizadas,
           SUM(CASE WHEN status = 'liberado' AND tipo = 'venda' THEN 1 ELSE 0 END) vendas,
           SUM(CASE WHEN status = 'liberado' THEN COALESCE(liquido, valor, 0) ELSE 0 END) ganhos,
           SUM(CASE WHEN status = 'liberado' THEN 1 ELSE 0 END) aprovadas,
           SUM(CASE WHEN status IN ('recusado','ia_recusado') THEN 1 ELSE 0 END) recusadas,
           MAX(criadoEm) ultimaAtividade
      FROM submissions WHERE companyId = ? AND campaignId = ? GROUP BY sellerId
  `).all(inicioDiaSaoPaulo(agoraMs), companyId, campaignId));
  return candidaturas.map((item) => {
    const stats = agregados.get(item.sellerId) || {};
    const decididas = (Number(stats.aprovadas) || 0) + (Number(stats.recusadas) || 0);
    const taxaAprovacao = decididas > 0 ? Math.round(((Number(stats.aprovadas) || 0) / decididas) * 1000) / 10 : null;
    const ultimaAtividade = Number(stats.ultimaAtividade) || null;
    const candidaturaPendente = item.candidaturaStatus === "pendente";
    const statusOperacional = candidaturaPendente ? "pendente"
      : ultimaAtividade && ultimaAtividade >= agoraMs - 30 * 60 * 1000 ? "online"
      : !ultimaAtividade || ultimaAtividade < agoraMs - 48 * 60 * 60 * 1000 ? "sem_atividade"
      : "ativo";
    return {
      ...item,
      tarefas: Number(stats.tarefas) || 0,
      tarefasHoje: Number(stats.tarefasHoje) || 0,
      reunioes: Number(stats.reunioes) || 0,
      realizadas: Number(stats.realizadas) || 0,
      vendas: Number(stats.vendas) || 0,
      ganhos: Number(stats.ganhos) || 0,
      aprovadas: Number(stats.aprovadas) || 0,
      recusadas: Number(stats.recusadas) || 0,
      taxaAprovacao,
      ultimaAtividade,
      score: Number(item.nota) || Number(item.scoreTriagem) || 0,
      statusOperacional,
      altaPerformance: !candidaturaPendente && decididas >= 3 && taxaAprovacao >= 80,
    };
  });
}

export function obterOperacaoCampanha(companyId, campaignId, opcoes = {}) {
  const campanha = db.prepare(`
    SELECT id, companyId, titulo, descricao, objetivo, regiao, funcao, status, vagas, orcamento, reservado, criadoEm
      FROM campaigns WHERE id = ? AND companyId = ?
  `).get(campaignId, companyId);
  if (!campanha) return null;
  const periodo = resolverPeriodo(opcoes.periodo, opcoes.agoraMs || Date.now(), opcoes.de, opcoes.ate);
  const duracao = periodo.fim - periodo.inicio;
  const atual = agregarPeriodo(companyId, campaignId, periodo.inicio, periodo.fim);
  const anterior = agregarPeriodo(companyId, campaignId, periodo.inicio - duracao, periodo.inicio);
  const profissionaisAtivos = valor(db.prepare(`
    SELECT COUNT(DISTINCT sellerId) total FROM campaign_applications
     WHERE campaignId = ? AND status = 'aprovado'
  `).get(campaignId));
  return {
    campanha: { ...campanha, profissionaisAtivos },
    periodo: { ...periodo, chave: opcoes.periodo || "7d" },
    metricas: {
      investimento: { valor: atual.investimento, variacao: variacaoPercentual(atual.investimento, anterior.investimento) },
      tarefas: { valor: atual.tarefas, variacao: variacaoPercentual(atual.tarefas, anterior.tarefas) },
      leads: { valor: atual.leads, variacao: variacaoPercentual(atual.leads, anterior.leads) },
      reunioes: { valor: atual.reunioes, variacao: variacaoPercentual(atual.reunioes, anterior.reunioes) },
      vendas: { valor: atual.vendas, variacao: variacaoPercentual(atual.vendas, anterior.vendas) },
    },
    funil: [
      { chave: "contatos", label: "Contatos", valor: atual.contatos, taxa: null },
      { chave: "leads", label: "Leads", valor: atual.leads, taxa: taxaEntreEtapas(atual.leads, atual.contatos) },
      { chave: "reunioes", label: "Reuniões", valor: atual.reunioes, taxa: taxaEntreEtapas(atual.reunioes, atual.leads) },
      { chave: "realizadas", label: "Realizadas", valor: atual.realizadas, taxa: taxaEntreEtapas(atual.realizadas, atual.reunioes) },
      { chave: "vendas", label: "Vendas", valor: atual.vendas, taxa: taxaEntreEtapas(atual.vendas, atual.realizadas) },
    ],
    custos: {
      lead: custoPorResultado(atual.investimento, atual.leads),
      reuniao: custoPorResultado(atual.investimento, atual.reunioes),
      venda: custoPorResultado(atual.investimento, atual.vendas),
    },
    serie: serieTemporal(companyId, campaignId, periodo.inicio, periodo.fim),
    profissionais: profissionaisDaCampanha(companyId, campaignId, opcoes.agoraMs || Date.now()),
    eventos: listarEventosCampanha(companyId, campaignId, 40),
    origem: {
      investimento: "liquidações da razão financeira",
      tarefas: "execuções enviadas",
      resultados: "execuções liberadas pela plataforma",
      leads: "leads vinculados à campanha",
    },
  };
}

function gastoNoPeriodo(companyId, inicio, fim) {
  return valor(db.prepare(`
    SELECT COALESCE(SUM(ABS(fl.valor)), 0) total
      FROM financial_ledger fl
      JOIN submissions s ON s.id = fl.submissionId
     WHERE fl.companyId = ? AND s.companyId = ? AND s.campaignId IS NOT NULL
       AND fl.tipo = 'liquidacao' AND fl.criadoEm >= ? AND fl.criadoEm < ?
  `).get(companyId, companyId, inicio, fim));
}

function quantidadeSubmissoes(companyId, inicio, fim, tipo = null, somenteLiberadas = false) {
  const filtros = ["companyId = ?", "campaignId IS NOT NULL", "criadoEm >= ?", "criadoEm < ?"];
  const params = [companyId, inicio, fim];
  if (tipo) { filtros.push("tipo = ?"); params.push(tipo); }
  if (somenteLiberadas) filtros.push("status = 'liberado'");
  return valor(db.prepare(`SELECT COUNT(*) total FROM submissions WHERE ${filtros.join(" AND ")}`).get(...params));
}

function quantidadeLeads(companyId, inicio, fim) {
  return valor(db.prepare(`
    SELECT COUNT(*) total FROM leads
     WHERE companyId = ? AND campaignId IS NOT NULL AND criadoEm >= ? AND criadoEm < ?
  `).get(companyId, inicio, fim));
}

function mapa(rows) {
  return new Map(rows.map((row) => [row.campaignId, row]));
}

export function obterVisaoGeralCampanhas(companyId, agoraMs = Date.now()) {
  const empresa = db.prepare("SELECT saldo, saldoReservado FROM companies WHERE id = ?").get(companyId);
  if (!empresa) return null;

  const tempo = intervalos(agoraMs);
  const statusRows = db.prepare("SELECT status, COUNT(*) total FROM campaigns WHERE companyId = ? GROUP BY status").all(companyId);
  const porStatus = Object.fromEntries(statusRows.map((r) => [r.status, Number(r.total) || 0]));
  const campanhasBase = db.prepare(`
    SELECT id, titulo, descricao, objetivo, regiao, funcao, status, vagas, orcamento, reservado, criadoEm
      FROM campaigns WHERE companyId = ? ORDER BY criadoEm DESC
  `).all(companyId);
  const profissionaisPorCampanha = mapa(db.prepare(`
    SELECT ca.campaignId, COUNT(DISTINCT ca.sellerId) total
      FROM campaign_applications ca JOIN campaigns c ON c.id = ca.campaignId
     WHERE c.companyId = ? AND ca.status = 'aprovado' GROUP BY ca.campaignId
  `).all(companyId));
  const tarefasPorCampanha = mapa(db.prepare(`
    SELECT campaignId,
           COUNT(*) tarefas,
           SUM(CASE WHEN status = 'liberado' AND tipo = 'agendamento' THEN 1 ELSE 0 END) reunioes,
           SUM(CASE WHEN status = 'liberado' AND tipo = 'venda' THEN 1 ELSE 0 END) vendas
      FROM submissions
     WHERE companyId = ? AND campaignId IS NOT NULL AND criadoEm >= ? AND criadoEm < ?
     GROUP BY campaignId
  `).all(companyId, tempo.inicioHoje, tempo.agora + 1));
  const leadsPorCampanha = mapa(db.prepare(`
    SELECT campaignId, COUNT(*) leads FROM leads
     WHERE companyId = ? AND campaignId IS NOT NULL AND criadoEm >= ? AND criadoEm < ?
     GROUP BY campaignId
  `).all(companyId, tempo.inicioHoje, tempo.agora + 1));
  const gastosPorCampanha = mapa(db.prepare(`
    SELECT s.campaignId,
           COALESCE(SUM(CASE WHEN fl.criadoEm >= ? AND fl.criadoEm < ? THEN ABS(fl.valor) ELSE 0 END), 0) gastoHoje,
           COALESCE(SUM(ABS(fl.valor)), 0) gastoTotal
      FROM financial_ledger fl JOIN submissions s ON s.id = fl.submissionId
     WHERE fl.companyId = ? AND s.companyId = ? AND s.campaignId IS NOT NULL AND fl.tipo = 'liquidacao'
     GROUP BY s.campaignId
  `).all(tempo.inicioHoje, tempo.agora + 1, companyId, companyId));
  const campanhas = campanhasBase.map((campanha) => {
    const tarefas = tarefasPorCampanha.get(campanha.id) || {};
    const leads = leadsPorCampanha.get(campanha.id) || {};
    const gastos = gastosPorCampanha.get(campanha.id) || {};
    const gastoTotal = Number(gastos.gastoTotal) || 0;
    const limite = Number(campanha.orcamento) || 0;
    return {
      ...campanha,
      operacaoHoje: {
        profissionais: Number(profissionaisPorCampanha.get(campanha.id)?.total) || 0,
        gasto: Number(gastos.gastoHoje) || 0,
        tarefas: Number(tarefas.tarefas) || 0,
        leads: Number(leads.leads) || 0,
        reunioes: Number(tarefas.reunioes) || 0,
        vendas: Number(tarefas.vendas) || 0,
      },
      orcamentoResumo: {
        consumido: gastoTotal,
        limite,
        percentual: limite > 0 ? Math.round((gastoTotal / limite) * 1000) / 10 : null,
      },
    };
  });
  const orcamentoAtivo = valor(db.prepare("SELECT COALESCE(SUM(orcamento), 0) total FROM campaigns WHERE companyId = ? AND status = 'ativa'").get(companyId));
  const profissionaisAtivos = valor(db.prepare(`
    SELECT COUNT(DISTINCT ca.sellerId) total
      FROM campaign_applications ca JOIN campaigns c ON c.id = ca.campaignId
     WHERE c.companyId = ? AND c.status = 'ativa' AND ca.status = 'aprovado'
  `).get(companyId));

  const gastoHoje = gastoNoPeriodo(companyId, tempo.inicioHoje, tempo.agora + 1);
  const gastoOntem = gastoNoPeriodo(companyId, tempo.inicioOntemEquivalente, tempo.fimOntemEquivalente + 1);
  const gastoMes = gastoNoPeriodo(companyId, tempo.inicioMes, tempo.agora + 1);
  const gastoMesAnterior = gastoNoPeriodo(companyId, tempo.inicioMesAnterior, tempo.fimMesAnteriorEquivalente + 1);
  const tarefasHoje = quantidadeSubmissoes(companyId, tempo.inicioHoje, tempo.agora + 1);
  const tarefasOntem = quantidadeSubmissoes(companyId, tempo.inicioOntemEquivalente, tempo.fimOntemEquivalente + 1);
  const leadsMes = quantidadeLeads(companyId, tempo.inicioMes, tempo.agora + 1);
  const leadsMesAnterior = quantidadeLeads(companyId, tempo.inicioMesAnterior, tempo.fimMesAnteriorEquivalente + 1);
  const reunioesMes = quantidadeSubmissoes(companyId, tempo.inicioMes, tempo.agora + 1, "agendamento", true);
  const reunioesMesAnterior = quantidadeSubmissoes(companyId, tempo.inicioMesAnterior, tempo.fimMesAnteriorEquivalente + 1, "agendamento", true);
  const vendasMes = quantidadeSubmissoes(companyId, tempo.inicioMes, tempo.agora + 1, "venda", true);
  const vendasMesAnterior = quantidadeSubmissoes(companyId, tempo.inicioMesAnterior, tempo.fimMesAnteriorEquivalente + 1, "venda", true);
  const saldoDisponivel = Math.max(0, Number(empresa.saldo || 0) - Number(empresa.saldoReservado || 0));
  const projecao = projetarOrcamento({ gastoMes, orcamento: orcamentoAtivo, saldoDisponivel, diaDoMes: tempo.diaDoMes, diasNoMes: tempo.diasNoMes });

  return {
    geradoEm: agoraMs,
    periodo: { principal: "mes_atual", tarefas: "hoje", comparacao: "periodo_anterior_equivalente" },
    indicadores: {
      campanhasEmAndamento: { valor: porStatus.ativa || 0, variacao: null },
      profissionaisAtivos: { valor: profissionaisAtivos, variacao: null },
      investidoHoje: { valor: gastoHoje, variacao: variacaoPercentual(gastoHoje, gastoOntem) },
      investidoMes: { valor: gastoMes, variacao: variacaoPercentual(gastoMes, gastoMesAnterior) },
      tarefasHoje: { valor: tarefasHoje, variacao: variacaoPercentual(tarefasHoje, tarefasOntem) },
      leadsGerados: { valor: leadsMes, variacao: variacaoPercentual(leadsMes, leadsMesAnterior) },
      reunioesAgendadas: { valor: reunioesMes, variacao: variacaoPercentual(reunioesMes, reunioesMesAnterior) },
      vendas: { valor: vendasMes, variacao: variacaoPercentual(vendasMes, vendasMesAnterior) },
    },
    orcamento: {
      limite: orcamentoAtivo,
      consumido: gastoMes,
      saldoDisponivel,
      reservado: Number(empresa.saldoReservado) || 0,
      comprometido: orcamentoAtivo,
      ...projecao,
    },
    status: {
      todas: campanhas.length,
      em_andamento: porStatus.ativa || 0,
      aguardando_aprovacao: porStatus.em_revisao || 0,
      rascunhos: porStatus.rascunho || 0,
      pausadas: porStatus.pausada || 0,
      encerradas: porStatus.encerrada || 0,
    },
    campanhas,
    origem: {
      investimento: "razão financeira de tarefas liquidadas",
      tarefas: "execuções enviadas no período",
      resultados: "tarefas liberadas pela plataforma",
      leads: "cadastros vinculados às campanhas",
    },
  };
}

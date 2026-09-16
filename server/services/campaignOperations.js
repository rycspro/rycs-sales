import db from "../db.js";
import { projetarOrcamento, variacaoPercentual } from "../../shared/campaignOperations.js";

const valor = (row, chave = "total") => Number(row?.[chave]) || 0;

function intervalos(agoraMs) {
  const agora = new Date(agoraMs);
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).getTime();
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
    diaDoMes: agora.getDate(),
    diasNoMes: new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate(),
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

export function obterVisaoGeralCampanhas(companyId, agoraMs = Date.now()) {
  const empresa = db.prepare("SELECT saldo, saldoReservado FROM companies WHERE id = ?").get(companyId);
  if (!empresa) return null;

  const tempo = intervalos(agoraMs);
  const statusRows = db.prepare("SELECT status, COUNT(*) total FROM campaigns WHERE companyId = ? GROUP BY status").all(companyId);
  const porStatus = Object.fromEntries(statusRows.map((r) => [r.status, Number(r.total) || 0]));
  const campanhas = db.prepare(`
    SELECT id, titulo, descricao, objetivo, regiao, funcao, status, vagas, orcamento, reservado, criadoEm
      FROM campaigns WHERE companyId = ? ORDER BY criadoEm DESC
  `).all(companyId);
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

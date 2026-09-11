// Observabilidade do RYCS Audit Engine.
//
// Cada chamada a provedor externo vira uma linha em audit_provider_runs. É o
// que responde, depois, três perguntas que só se consegue responder com dado
// registrado no momento: quanto custou auditar esta ação, qual provedor está
// falhando, e quanto tempo a auditoria leva de verdade.
//
// Nada de dado pessoal entra aqui. Nem transcrição, nem telefone, nem nome de
// cliente: só identificadores, métrica e o texto curto do erro.

import db, { uid, agora } from "../../db.js";

const SEGREDO = /(sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+|api[_-]?key\S*)/gi;

// Mesmo o texto do erro pode trazer a chave usada na chamada. Vai mascarado.
const limpar = (texto) => String(texto || "").replace(SEGREDO, "[oculto]").slice(0, 300);

export function registrarExecucao({
  auditRequestId = null, capacidade, operacao, provider, modelo,
  status, latenciaMs = 0, custoEstimado = null, tokens = null, erro = null,
}) {
  try {
    db.prepare(`INSERT INTO audit_provider_runs
      (id, auditRequestId, capacidade, operacao, provider, modelo, status, latenciaMs, custoEstimado, tokensEntrada, tokensSaida, erro, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uid(), auditRequestId, capacidade, operacao || "", provider, modelo,
        status, Math.round(latenciaMs) || 0, custoEstimado,
        tokens?.entrada ?? null, tokens?.saida ?? null,
        erro ? limpar(erro) : null, agora());
  } catch (err) {
    // Observabilidade nunca derruba a auditoria. Se o registro falhar, a
    // decisão sobre a evidência continua valendo.
    console.error("[audit] falha ao registrar execução de provider:", err.message);
  }

  console.log(JSON.stringify({
    evento: "audit_provider_run",
    auditRequestId, capacidade, operacao, provider, modelo, status,
    latenciaMs: Math.round(latenciaMs) || 0,
  }));
}

// Log estruturado de um estágio do pipeline. Mesmo princípio: identificador e
// métrica, nunca conteúdo da evidência.
export function registrarEstagio({ auditRequestId, taskId = null, estagio, status, duracaoMs, erro = null }) {
  console.log(JSON.stringify({
    evento: "audit_stage",
    auditRequestId, taskId, estagio, status,
    duracaoMs: Math.round(duracaoMs) || 0,
    ...(erro ? { erro: limpar(erro) } : {}),
  }));
}

// Métricas agregadas do motor. Alimentam o painel da plataforma.
export function metricas({ dias = 7 } = {}) {
  const desde = agora() - dias * 86400000;

  const porDecisao = db.prepare(
    "SELECT decisao, COUNT(*) n FROM audit_requests WHERE criadoEm >= ? GROUP BY decisao"
  ).all(desde);
  const total = porDecisao.reduce((n, r) => n + r.n, 0);
  const pct = (chave) => total ? Math.round(((porDecisao.find((r) => r.decisao === chave)?.n || 0) / total) * 1000) / 10 : 0;

  const tempo = db.prepare(
    "SELECT AVG(concluidoEm - criadoEm) media FROM audit_requests WHERE concluidoEm IS NOT NULL AND criadoEm >= ?"
  ).get(desde);

  const runs = db.prepare(`
    SELECT provider, capacidade, status, COUNT(*) n, AVG(latenciaMs) latencia, SUM(COALESCE(custoEstimado, 0)) custo
    FROM audit_provider_runs WHERE criadoEm >= ? GROUP BY provider, capacidade, status
  `).all(desde);

  const custoTotal = runs.reduce((n, r) => n + (r.custo || 0), 0);

  return {
    periodoDias: dias,
    auditorias: total,
    porDia: Math.round((total / dias) * 10) / 10,
    tempoMedioMs: Math.round(tempo?.media || 0),
    percentuais: { aprovado: pct("aprovado"), revisao: pct("revisao"), recusado: pct("recusado") },
    custoTotalEstimado: Math.round(custoTotal * 10000) / 10000,
    custoMedioPorAuditoria: total ? Math.round((custoTotal / total) * 10000) / 10000 : 0,
    providers: runs.map((r) => ({
      provider: r.provider, capacidade: r.capacidade, status: r.status,
      execucoes: r.n, latenciaMedia: Math.round(r.latencia || 0),
      custo: Math.round((r.custo || 0) * 10000) / 10000,
    })),
    errosPorProvider: runs.filter((r) => r.status !== "ok")
      .map((r) => ({ provider: r.provider, status: r.status, n: r.n })),
  };
}

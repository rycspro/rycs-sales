import db, { agora, uid } from "../db.js";

export const TIPOS_EVENTO_CAMPANHA = new Set([
  "CAMPAIGN_CREATED", "CAMPAIGN_PUBLISHED", "CAMPAIGN_PAUSED", "CAMPAIGN_CLOSED",
  "PROFESSIONAL_APPLIED", "PROFESSIONAL_APPROVED", "PROFESSIONAL_REJECTED", "PROFESSIONAL_JOINED",
  "TASK_STARTED", "TASK_COMPLETED", "TASK_APPROVED", "TASK_REJECTED",
  "LEAD_CREATED", "MEETING_SCHEDULED", "MEETING_COMPLETED", "SALE_RECORDED",
  "EVIDENCE_SUBMITTED", "PAYMENT_RELEASED",
]);

export function registrarEventoCampanha({
  companyId, campaignId, tipo, actorId = null, actorRole = "sistema", sellerId = null,
  submissionId = null, leadId = null, source = "SYSTEM", dados = {}, criadoEm = agora(),
}) {
  if (!campaignId || !companyId || !TIPOS_EVENTO_CAMPANHA.has(tipo)) return null;
  const id = uid();
  db.prepare(`INSERT INTO campaign_events
    (id, companyId, campaignId, tipo, actorId, actorRole, sellerId, submissionId, leadId, source, dados, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, companyId, campaignId, tipo, actorId, actorRole, sellerId, submissionId, leadId, source, JSON.stringify(dados || {}), criadoEm);
  return id;
}

export function listarEventosCampanha(companyId, campaignId, limite = 40) {
  return db.prepare(`
    SELECT ce.*, s.nome sellerNome
      FROM campaign_events ce LEFT JOIN sellers s ON s.id = ce.sellerId
     WHERE ce.companyId = ? AND ce.campaignId = ?
     ORDER BY ce.criadoEm DESC LIMIT ?
  `).all(companyId, campaignId, Math.min(100, Math.max(1, Number(limite) || 40)))
    .map((evento) => {
      let dados = {};
      try { dados = JSON.parse(evento.dados || "{}"); } catch { dados = {}; }
      return { ...evento, dados };
    });
}

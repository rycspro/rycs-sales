import db, { uid, agora } from "../db.js";

/**
 * Vincula automaticamente um lead recém-criado às campanhas ativas da empresa
 * que possuem incluirNovosAutomaticamente = 1.
 * Não duplica se o lead já estiver na campaign_leads.
 */
export function vincularLeadAutomaticamente(leadId, companyId, campanhaOrigem) {
  const campanhas = db.prepare(
    `SELECT id FROM campaigns
     WHERE companyId = ? AND status = 'ativa' AND incluirNovosAutomaticamente = 1`
  ).all(companyId);

  if (!campanhas.length) return 0;

  const ts = agora();
  const ins = db.prepare(
    `INSERT OR IGNORE INTO campaign_leads (id, campaignId, leadId, status, criadoEm)
     VALUES (?, ?, ?, 'disponivel', ?)`
  );

  let inseridos = 0;
  for (const c of campanhas) {
    if (c.id === campanhaOrigem) continue;
    const r = ins.run(uid(), c.id, leadId, ts);
    if (r.changes > 0) inseridos++;
  }
  return inseridos;
}

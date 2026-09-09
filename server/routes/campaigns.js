import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { campanhaPodeSerPublicada, STATUS_CAMPANHA, saldoDisponivel } from "../../shared/empresa.js";
import { dentroDoLimite } from "../../shared/planos.js";
import { exigirOportunidadesLiberadas } from "../services/acessoProfissional.js";

const router = Router();

router.get("/campaigns", (req, res) => {
  const { role, entityId } = req.user;
  let rows;
  if (role === "empresa") {
    rows = db.prepare("SELECT * FROM campaigns WHERE companyId = ? ORDER BY criadoEm DESC").all(entityId);
  } else {
    rows = db.prepare("SELECT * FROM campaigns ORDER BY criadoEm DESC").all();
  }
  res.json(rows.map(parseCampaign));
});

router.get("/campaigns/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Campanha não encontrada" });
  const campaign = parseCampaign(row);

  const apps = db.prepare("SELECT * FROM campaign_applications WHERE campaignId = ?").all(req.params.id);
  campaign.candidaturas = apps;

  res.json(campaign);
});

router.post("/campaigns", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa" && role !== "admin")
    return res.status(403).json({ error: "Apenas empresas podem criar campanhas" });

  const { titulo, descricao, produto, publico, vagas, comissoes, treinamento, requisitos, objetivo, regiao,
    funcao, orcamento, tarefas, evidencias, criteriosAprovacao, prazoHoras, limitePorProfissional,
    aceitaLeadProprio, exigeCertificacao } = req.body;
  if (!titulo) return res.status(400).json({ error: "Título é obrigatório" });

  const companyId = role === "empresa" ? entityId : req.body.companyId;
  if (!companyId) return res.status(400).json({ error: "companyId é obrigatório" });

  const id = uid();
  db.prepare(`
    INSERT INTO campaigns (id, companyId, titulo, descricao, produto, publico, status, vagas, comissoes, treinamento,
      requisitos, objetivo, regiao, funcao, orcamento, tarefas, evidencias, criteriosAprovacao, prazoHoras,
      limitePorProfissional, aceitaLeadProprio, exigeCertificacao, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, companyId, titulo, descricao || "", produto || "", publico || "",
    vagas || 0, JSON.stringify(comissoes || {}), JSON.stringify(treinamento || []),
    requisitos || "", objetivo || "", regiao || "", funcao || "", Number(orcamento) || 0,
    JSON.stringify(tarefas || {}), JSON.stringify(evidencias || {}), JSON.stringify(criteriosAprovacao || {}),
    Math.max(1, Number(prazoHoras) || 48), Math.max(0, Number(limitePorProfissional) || 0),
    aceitaLeadProprio ? 1 : 0, exigeCertificacao ? 1 : 0, agora());

  res.json({ id });
});

router.patch("/campaigns/:id", (req, res) => {
  const { role, entityId } = req.user;
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId)
    return res.status(403).json({ error: "Sem permissão" });

  const allowed = ["titulo", "descricao", "produto", "publico", "vagas", "requisitos", "objetivo", "regiao", "funcao",
    "orcamento", "prazoHoras", "limitePorProfissional", "aceitaLeadProprio", "exigeCertificacao"];
  const jsonFields = ["comissoes", "treinamento", "tarefas", "evidencias", "criteriosAprovacao"];
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(req.body)) {
    if (allowed.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(["aceitaLeadProprio", "exigeCertificacao"].includes(k) ? (v ? 1 : 0) : v);
    }
    else if (jsonFields.includes(k)) { sets.push(`${k} = ?`); vals.push(JSON.stringify(v)); }
  }
  if (!sets.length) return res.status(400).json({ error: "Nenhum campo válido" });
  vals.push(req.params.id);
  db.prepare(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

router.post("/campaigns/:id/status", (req, res) => {
  const { role, entityId } = req.user;
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor") return res.status(403).json({ error: "Sem permissão" });
  const status = String(req.body?.status || "");
  if (!STATUS_CAMPANHA.includes(status)) return res.status(400).json({ error: "Status inválido" });

  if (status === "ativa") {
    const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(campaign.companyId);
    const parsed = parseCampaign(campaign);
    const check = campanhaPodeSerPublicada(parsed, empresa);
    if (!check.ok) return res.status(422).json({ error: "Campanha ainda não pode ser publicada.", pendencias: check.pendencias });
    const ativas = db.prepare("SELECT COUNT(*) n FROM campaigns WHERE companyId = ? AND status = 'ativa' AND id <> ?")
      .get(campaign.companyId, campaign.id).n;
    if (!dentroDoLimite(empresa.assinatura, "campanhasAtivas", ativas))
      return res.status(422).json({ error: "Limite de campanhas ativas do plano atingido." });
    if (Number(parsed.orcamento) > saldoDisponivel(empresa))
      return res.status(422).json({ error: "O orçamento da campanha supera o saldo disponível." });
  }

  db.prepare("UPDATE campaigns SET status = ? WHERE id = ?").run(status, campaign.id);
  res.json({ ok: true, status });
});

router.post("/campaigns/:id/apply", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais podem se candidatar" });
  if (!exigirOportunidadesLiberadas(req, res)) return;

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (campaign.status !== "ativa") return res.status(400).json({ error: "Campanha não está ativa" });

  const existing = db.prepare("SELECT id FROM campaign_applications WHERE campaignId = ? AND sellerId = ?").get(req.params.id, entityId);
  if (existing) return res.status(409).json({ error: "Já se candidatou a esta campanha" });

  const id = uid();
  db.prepare("INSERT INTO campaign_applications (id, campaignId, sellerId, status, criadoEm) VALUES (?, ?, ?, 'pendente', ?)").run(id, req.params.id, entityId, agora());
  res.json({ id });
});

router.patch("/campaigns/:campaignId/applications/:appId", (req, res) => {
  const { role, entityId } = req.user;
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.campaignId);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId)
    return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor") return res.status(403).json({ error: "Sem permissão" });

  const { status } = req.body;
  if (!["aprovado", "recusado"].includes(status))
    return res.status(400).json({ error: "Status deve ser aprovado ou recusado" });

  db.prepare("UPDATE campaign_applications SET status = ? WHERE id = ?").run(status, req.params.appId);
  res.json({ ok: true });
});

function parseCampaign(row) {
  return {
    ...row,
    comissoes: JSON.parse(row.comissoes || "{}"),
    treinamento: JSON.parse(row.treinamento || "[]"),
    tarefas: JSON.parse(row.tarefas || "{}"),
    evidencias: JSON.parse(row.evidencias || "{}"),
    criteriosAprovacao: JSON.parse(row.criteriosAprovacao || "{}"),
    aceitaLeadProprio: !!row.aceitaLeadProprio,
    exigeCertificacao: !!row.exigeCertificacao,
  };
}

export default router;

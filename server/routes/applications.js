import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { exigirOportunidadesLiberadas } from "../services/acessoProfissional.js";

const router = Router();

function campanhasAutoEfetivo(sellerId, companyId) {
  const app = db.prepare("SELECT campanhasAuto FROM applications WHERE sellerId = ? AND companyId = ?").get(sellerId, companyId);
  if (app?.campanhasAuto != null) return !!app.campanhasAuto;
  const emp = db.prepare("SELECT campanhasAutoDefault FROM companies WHERE id = ?").get(companyId);
  return !!(emp?.campanhasAutoDefault);
}

function qualificacaoDa(empresa) {
  try { return JSON.parse(empresa.qualificacao || "{}"); } catch { return {}; }
}

function checarCriterios(vendedor, empresa, progresso) {
  const q = qualificacaoDa(empresa);
  const criterios = q.criterios || {};
  const falhas = [];
  if (criterios.perfis?.length && !criterios.perfis.includes(vendedor.perfil)) falhas.push("perfil comercial");
  // notaMinima não bloqueia automaticamente — aprovação é sempre manual pela empresa
  if (criterios.exigeVideo && !vendedor.video) falhas.push("vídeo de apresentação");
  const questoes = q.questoes || [];
  if (questoes.length && Number(progresso?.quizScore ?? -1) < Number(q.notaMinimaQuiz || 70)) falhas.push("avaliação sobre a empresa");
  return falhas;
}

// Empresa convida profissional para campanha específica já publicada.
// Cria ou atualiza a candidatura para "pendente" (empresa ainda precisa aprovar)
// e registra qual campanha motivou o contato.
router.post("/applications/invite", (req, res) => {
  const { sellerId, companyId, campaignId } = req.body;
  const { role, entityId } = req.user;
  if (role !== "empresa" && role !== "admin") return res.status(403).json({ error: "Sem permissão" });
  if (role === "empresa" && entityId !== companyId) return res.status(403).json({ error: "Sem permissão" });
  if (!sellerId || !companyId) return res.status(400).json({ error: "sellerId e companyId são obrigatórios" });

  const vendedor = db.prepare("SELECT * FROM sellers WHERE id = ?").get(sellerId);
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
  if (!vendedor || !empresa) return res.status(404).json({ error: "Profissional ou empresa não encontrada" });

  const mensagem = String(req.body.mensagem || "").slice(0, 600);
  const now = agora();
  db.prepare(`INSERT INTO applications (sellerId, companyId, status, mensagem, criadoEm)
    VALUES (?, ?, 'pendente', ?, ?)
    ON CONFLICT(sellerId, companyId) DO UPDATE SET status = 'pendente', mensagem = excluded.mensagem, criadoEm = excluded.criadoEm`)
    .run(sellerId, companyId, mensagem, now);

  const sellerUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sellerId);
  if (sellerUser) {
    const msg = campaignId
      ? `Você recebeu um convite da ${empresa.nome} para participar de uma campanha.`
      : `Você recebeu um convite da ${empresa.nome}.`;
    notificar(sellerUser.id, "candidatura", msg);
  }

  res.json({ ok: true });
});

router.post("/applications", (req, res) => {
  const { sellerId, companyId } = req.body;
  const { role, entityId } = req.user;

  if (!sellerId || !companyId)
    return res.status(400).json({ error: "sellerId e companyId são obrigatórios" });
  if (role === "vendedor" && entityId !== sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (!exigirOportunidadesLiberadas(req, res, sellerId)) return;
  // Empresa convida via /applications/invite — esta rota é só para o profissional.
  if (role === "empresa")
    return res.status(403).json({ error: "Use /applications/invite para convidar profissionais" });

  const vendedor = db.prepare("SELECT * FROM sellers WHERE id = ?").get(sellerId);
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
  if (!vendedor || !empresa) return res.status(404).json({ error: "Profissional ou empresa não encontrado" });
  const progresso = db.prepare("SELECT * FROM course_progress WHERE sellerId = ? AND companyId = ?").get(sellerId, companyId);
  const pendencias = checarCriterios(vendedor, empresa, progresso);

  const mensagem = String(req.body.mensagem || "").slice(0, 600);
  const now = agora();
  db.prepare(`INSERT INTO applications (sellerId, companyId, status, mensagem, criadoEm)
    VALUES (?, ?, 'pendente', ?, ?)
    ON CONFLICT(sellerId, companyId) DO UPDATE SET status = 'pendente', mensagem = excluded.mensagem, criadoEm = excluded.criadoEm`)
    .run(sellerId, companyId, mensagem, now);

  const companyUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(companyId);
  if (companyUser) {
    notificar(companyUser.id, "candidatura", `${vendedor.nome} solicitou aprovação para trabalhar com sua empresa.`);
  }
  res.json({ ok: true, pendencias });
});

router.patch("/applications", (req, res) => {
  const { sellerId, companyId, status, campanhasAuto } = req.body;
  const { role, entityId } = req.user;

  if (role === "empresa" && entityId !== companyId)
    return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor")
    return res.status(403).json({ error: "Vendedores não podem aprovar candidaturas" });
  if (!["aprovado", "recusado", "pendente"].includes(status))
    return res.status(400).json({ error: "Status deve ser aprovado, recusado ou pendente" });

  const now = agora();
  const sets = ["status = ?", "respondidoEm = ?"];
  const vals = [status, now];
  if (campanhasAuto !== undefined) {
    sets.push("campanhasAuto = ?");
    vals.push(campanhasAuto === null ? null : campanhasAuto ? 1 : 0);
  }
  vals.push(sellerId, companyId);
  db.prepare(`UPDATE applications SET ${sets.join(", ")} WHERE sellerId = ? AND companyId = ?`).run(...vals);

  if (status === "aprovado" && campanhasAutoEfetivo(sellerId, companyId)) {
    const campanhas = db.prepare("SELECT id FROM campaigns WHERE companyId = ? AND status = 'ativa'").all(companyId);
    for (const c of campanhas) {
      const existe = db.prepare("SELECT id FROM campaign_applications WHERE campaignId = ? AND sellerId = ?").get(c.id, sellerId);
      if (!existe) {
        db.prepare("INSERT INTO campaign_applications (id, campaignId, sellerId, status, criadoEm) VALUES (?, ?, ?, 'aprovado', ?)")
          .run(uid(), c.id, sellerId, now);
      }
    }
  }

  const sellerUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sellerId);
  const company = db.prepare("SELECT nome FROM companies WHERE id = ?").get(companyId);
  if (sellerUser && company) {
    const msg = status === "aprovado" ? `Você foi aprovado na ${company.nome}!` : `Sua candidatura na ${company.nome} foi recusada.`;
    notificar(sellerUser.id, "candidatura", msg);
  }

  res.json({ ok: true });
});

// Atualizar campanhasAuto de um profissional já aprovado
router.patch("/applications/campaigns-auto", (req, res) => {
  const { sellerId, campanhasAuto } = req.body;
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Sem permissão" });
  const app = db.prepare("SELECT * FROM applications WHERE sellerId = ? AND companyId = ? AND status = 'aprovado'").get(sellerId, entityId);
  if (!app) return res.status(404).json({ error: "Profissional não aprovado" });
  db.prepare("UPDATE applications SET campanhasAuto = ? WHERE sellerId = ? AND companyId = ?")
    .run(campanhasAuto === null ? null : campanhasAuto ? 1 : 0, sellerId, entityId);
  res.json({ ok: true });
});

// Default da empresa: auto ou manual para campanhas
router.get("/company/approval-config", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Sem permissão" });
  const emp = db.prepare("SELECT campanhasAutoDefault FROM companies WHERE id = ?").get(entityId);
  res.json({ campanhasAutoDefault: !!(emp?.campanhasAutoDefault) });
});

router.patch("/company/approval-config", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Sem permissão" });
  const { campanhasAutoDefault } = req.body;
  db.prepare("UPDATE companies SET campanhasAutoDefault = ? WHERE id = ?")
    .run(campanhasAutoDefault ? 1 : 0, entityId);
  res.json({ ok: true });
});

export default router;

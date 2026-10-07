import { Router } from "express";
import db from "../db.js";
import { notificar } from "./notifications.js";
import { exigirOportunidadesLiberadas } from "../services/acessoProfissional.js";

const router = Router();

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

  // Cria ou reabre candidatura como "pendente" — empresa aprova na sequência.
  db.prepare("INSERT OR REPLACE INTO applications (sellerId, companyId, status) VALUES (?, ?, 'pendente')").run(sellerId, companyId);

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

  // Candidatura é sempre criada — pendências são informativas, não bloqueantes.
  // A empresa decide manualmente se aprova ou não.
  db.prepare("INSERT OR REPLACE INTO applications (sellerId, companyId, status) VALUES (?, ?, 'pendente')").run(sellerId, companyId);
  res.json({ ok: true, pendencias });
});

router.patch("/applications", (req, res) => {
  const { sellerId, companyId, status } = req.body;
  const { role, entityId } = req.user;

  if (role === "empresa" && entityId !== companyId)
    return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor")
    return res.status(403).json({ error: "Vendedores não podem aprovar candidaturas" });
  // Sem lista fechada, qualquer texto entrava no banco como status.
  if (!["aprovado", "recusado", "pendente"].includes(status))
    return res.status(400).json({ error: "Status deve ser aprovado, recusado ou pendente" });

  // Aprovação é sempre manual — a empresa viu o perfil e decidiu.
  // Critérios automáticos servem como referência, não como bloqueio.

  db.prepare("UPDATE applications SET status = ? WHERE sellerId = ? AND companyId = ?").run(status, sellerId, companyId);

  const sellerUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sellerId);
  const company = db.prepare("SELECT nome FROM companies WHERE id = ?").get(companyId);
  if (sellerUser && company) {
    const msg = status === "aprovado" ? `Você foi aprovado na ${company.nome}!` : `Sua candidatura na ${company.nome} foi recusada.`;
    notificar(sellerUser.id, "candidatura", msg);
  }

  res.json({ ok: true });
});

export default router;

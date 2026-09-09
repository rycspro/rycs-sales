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
  if (Number(criterios.notaMinima || 0) > Number(vendedor.nota || 0)) falhas.push("nota mínima na triagem");
  if (criterios.exigeVideo && !vendedor.video) falhas.push("vídeo de apresentação");
  const questoes = q.questoes || [];
  if (questoes.length && Number(progresso?.quizScore ?? -1) < Number(q.notaMinimaQuiz || 70)) falhas.push("avaliação sobre a empresa");
  return falhas;
}

router.post("/applications", (req, res) => {
  const { sellerId, companyId } = req.body;
  const { role, entityId } = req.user;

  if (!sellerId || !companyId)
    return res.status(400).json({ error: "sellerId e companyId são obrigatórios" });
  if (role === "vendedor" && entityId !== sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (!exigirOportunidadesLiberadas(req, res, sellerId)) return;
  // Quem se candidata é o profissional. Sem isto, uma empresa podia inscrever
  // qualquer vendedor em si mesma, sem que ele soubesse.
  if (role === "empresa")
    return res.status(403).json({ error: "A candidatura parte do profissional" });

  const vendedor = db.prepare("SELECT * FROM sellers WHERE id = ?").get(sellerId);
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
  if (!vendedor || !empresa) return res.status(404).json({ error: "Profissional ou empresa não encontrado" });
  const progresso = db.prepare("SELECT * FROM course_progress WHERE sellerId = ? AND companyId = ?").get(sellerId, companyId);
  const falhas = checarCriterios(vendedor, empresa, progresso);
  if (falhas.length) return res.status(422).json({ error: `Você ainda não atende aos critérios: ${falhas.join(", ")}.`, falhas });
  db.prepare("INSERT OR REPLACE INTO applications (sellerId, companyId, status) VALUES (?, ?, 'pendente')").run(sellerId, companyId);
  res.json({ ok: true, criterios: [] });
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

  // A aprovação manual não pode virar um atalho para contornar os critérios
  // que a própria empresa publicou (inclusive em candidaturas antigas).
  if (status === "aprovado") {
    const vendedor = db.prepare("SELECT * FROM sellers WHERE id = ?").get(sellerId);
    const empresaCompleta = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
    const progresso = db.prepare("SELECT * FROM course_progress WHERE sellerId = ? AND companyId = ?").get(sellerId, companyId);
    const falhas = vendedor && empresaCompleta ? checarCriterios(vendedor, empresaCompleta, progresso) : ["dados da candidatura"];
    if (falhas.length) return res.status(422).json({ error: `Não é possível aprovar: ${falhas.join(", ")}.` });
  }

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

import { Router } from "express";
import db from "../db.js";

const router = Router();

router.patch("/course-progress", (req, res) => {
  const { sellerId, companyId, moduleIds } = req.body;
  const { role, entityId } = req.user;

  if (role === "vendedor" && entityId !== sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (role === "empresa" && entityId !== companyId)
    return res.status(403).json({ error: "Sem permissão" });
  if (!["vendedor", "empresa", "admin"].includes(role))
    return res.status(403).json({ error: "Sem permissão" });

  const existing = db.prepare("SELECT * FROM course_progress WHERE sellerId = ? AND companyId = ?").get(sellerId, companyId);
  if (existing) {
    db.prepare("UPDATE course_progress SET moduleIds = ? WHERE sellerId = ? AND companyId = ?").run(JSON.stringify(moduleIds), sellerId, companyId);
  } else {
    db.prepare("INSERT INTO course_progress (sellerId, companyId, moduleIds) VALUES (?, ?, ?)").run(sellerId, companyId, JSON.stringify(moduleIds));
  }
  res.json({ ok: true });
});

router.post("/company-training/:companyId/quiz", (req, res) => {
  const { companyId } = req.params;
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais respondem a avaliação" });
  const empresa = db.prepare("SELECT qualificacao FROM companies WHERE id = ?").get(companyId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
  let qualificacao = {};
  try { qualificacao = JSON.parse(empresa.qualificacao || "{}"); } catch {}
  const questoes = qualificacao.questoes || [];
  if (!questoes.length) return res.status(400).json({ error: "Esta empresa ainda não publicou uma avaliação" });
  const respostas = Array.isArray(req.body?.respostas) ? req.body.respostas : [];
  if (respostas.length !== questoes.length) return res.status(400).json({ error: "Responda todas as questões" });
  const acertos = questoes.reduce((n, q, i) => n + (Number(respostas[i]) === Number(q.correta) ? 1 : 0), 0);
  const quizScore = Math.round((acertos / questoes.length) * 100);
  const existente = db.prepare("SELECT sellerId FROM course_progress WHERE sellerId = ? AND companyId = ?").get(req.user.entityId, companyId);
  if (existente) {
    db.prepare("UPDATE course_progress SET quizScore = ?, quizAnswers = ? WHERE sellerId = ? AND companyId = ?")
      .run(quizScore, JSON.stringify(respostas), req.user.entityId, companyId);
  } else {
    db.prepare("INSERT INTO course_progress (sellerId, companyId, moduleIds, quizScore, quizAnswers) VALUES (?, ?, '[]', ?, ?)")
      .run(req.user.entityId, companyId, quizScore, JSON.stringify(respostas));
  }
  res.json({ ok: true, quizScore, aprovado: quizScore >= Number(qualificacao.notaMinimaQuiz || 70) });
});

export default router;

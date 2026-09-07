import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { calcular } from "../services/triagem.js";
import { perguntasPublicas, CATEGORIAS, FAIXAS, TOTAL_PERGUNTAS } from "../../shared/triagem.js";

const router = Router();

// Concluir a triagem já dá acesso — o que muda é o grau. Acima de 90 a
// aprovação é plena; abaixo disso o perfil fica PARCIAL, com acesso liberado
// e trilha da Academy recomendada.
//
// Bloquear quem tira menos afastaria justamente o lado que precisamos atrair
// primeiro. O filtro real acontece depois, na execução auditada.
export const LIBERA_MARKETPLACE = ["aprovado", "condicional", "reavaliacao", "reprovado"];

const statusDaConta = (faixa) => (faixa === "aprovado" ? "aprovado" : "parcial");

router.get("/triagem/perguntas", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  res.json({
    perguntas: perguntasPublicas(),
    categorias: CATEGORIAS,
    faixas: FAIXAS,
    total: TOTAL_PERGUNTAS,
  });
});

router.get("/triagem/minhas", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });

  const tentativas = db.prepare(
    "SELECT id, tentativa, score, status, categorias, perfil, criadoEm FROM assessments WHERE sellerId = ? ORDER BY criadoEm DESC"
  ).all(entityId).map((a) => ({
    ...a,
    categorias: JSON.parse(a.categorias || "{}"),
    perfil: JSON.parse(a.perfil || "{}"),
  }));

  const vendedor = db.prepare("SELECT status, scoreTriagem, perfilComercial FROM sellers WHERE id = ?").get(entityId);

  res.json({
    tentativas,
    atual: tentativas[0] || null,
    statusConta: vendedor?.status || "triagem",
    liberado: !!tentativas.length,
  });
});

router.post("/triagem", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais fazem a triagem" });

  const respostas = req.body?.respostas;
  if (!respostas || typeof respostas !== "object")
    return res.status(400).json({ error: "Envie as respostas da avaliação" });

  // Não dá para pular etapas: todas as perguntas precisam vir respondidas.
  const publicas = perguntasPublicas();
  const faltando = publicas.filter((p) => {
    const r = respostas[p.id];
    if (p.tipo === "multipla") return !Array.isArray(r) || r.length === 0;
    if (p.tipo === "aberta") return !String(r || "").trim();
    return r === undefined || r === null || r === "";
  });
  if (faltando.length)
    return res.status(400).json({ error: `Faltam ${faltando.length} respostas.`, faltando: faltando.map((p) => p.id) });

  // O score é calculado aqui. Nada do que o cliente enviar altera o resultado
  // além das próprias respostas.
  const r = calcular(respostas);
  const anteriores = db.prepare("SELECT COUNT(*) n FROM assessments WHERE sellerId = ?").get(entityId).n;
  const assessmentId = uid();
  const ts = agora();

  db.transaction(() => {
    db.prepare(`INSERT INTO assessments (id, sellerId, tentativa, score, status, categorias, perfil, criadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(assessmentId, entityId, anteriores + 1, r.score, r.status,
           JSON.stringify(r.categorias), JSON.stringify(r.perfil), ts);

    // Toda resposta é guardada — sem isso não há como auditar uma nota depois.
    const ins = db.prepare(`INSERT INTO assessment_answers (id, assessmentId, sellerId, questionId, resposta, pontos, criadoEm)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const d of r.detalhe) {
      ins.run(uid(), assessmentId, entityId, d.id, JSON.stringify(respostas[d.id] ?? null), d.pontos, ts);
    }

    // O status da conta sai do score, sem caminho manual.
    const statusConta = statusDaConta(r.status);
    db.prepare("UPDATE sellers SET status = ?, scoreTriagem = ?, perfilComercial = ?, perfil = ? WHERE id = ?")
      .run(statusConta, r.score, JSON.stringify(r.perfil), r.perfil.funcaoSugerida || "sdr", entityId);
  })();

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(entityId);
  if (user) {
    const msg = {
      aprovado: `Aprovado com ${r.score}%! Seu perfil comercial está completo.`,
      condicional: `Você fez ${r.score}%. Perfil parcial liberado — complete a Academy para a aprovação plena.`,
      reavaliacao: `Você fez ${r.score}%. Perfil parcial liberado. A trilha da Academy eleva sua classificação.`,
      reprovado: `Você fez ${r.score}%. Perfil parcial liberado com trilha obrigatória na Academy.`,
    }[r.status];
    notificar(user.id, "triagem", "Resultado da triagem", msg);
  }

  res.json({
    assessmentId,
    score: r.score,
    status: r.status,
    categorias: r.categorias,
    perfil: r.perfil,
    tentativa: anteriores + 1,
    liberado: true,
    statusConta: statusDaConta(r.status),
    proximoPasso: r.status === "aprovado" ? "marketplace" : "academy",
  });
});

// Visão da plataforma: desempenho agregado e por categoria.
router.get("/triagem/painel", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });

  const todas = db.prepare("SELECT score, status, categorias FROM assessments").all();
  const porStatus = {};
  const somaCat = {};
  for (const a of todas) {
    porStatus[a.status] = (porStatus[a.status] || 0) + 1;
    const c = JSON.parse(a.categorias || "{}");
    for (const [k, v] of Object.entries(c)) somaCat[k] = (somaCat[k] || 0) + v;
  }
  const mediaCat = {};
  for (const [k, v] of Object.entries(somaCat)) mediaCat[k] = Number((v / todas.length).toFixed(1));

  res.json({
    totalAvaliacoes: todas.length,
    mediaGeral: todas.length ? Number((todas.reduce((a, x) => a + x.score, 0) / todas.length).toFixed(2)) : 0,
    porStatus,
    mediaPorCategoria: mediaCat,
  });
});

export default router;

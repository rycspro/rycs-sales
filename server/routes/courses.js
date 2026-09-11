import { Router } from "express";
import {
  catalogo, carregarCurso, matricular, concluirAula, reabrirAula, progressoDoCurso,
  provaDoCurso, responderProva, certificadosDoProfissional, verificarCertificado,
  tentativasDoProfissional, criarCurso, atualizarCurso, duplicarCurso, estatisticas,
} from "../services/academy.js";
import { CATEGORIAS, NIVEIS_CURSO } from "../../shared/academy/catalogo.js";
import { notificar } from "./notifications.js";
import db from "../db.js";

const router = Router();

const souVendedor = (req, res) => {
  if (req.user.role !== "vendedor") { res.status(403).json({ error: "Apenas profissionais" }); return null; }
  return req.user.entityId;
};

// ------------------------------------------------------------- catálogo ----

router.get("/courses", (req, res) => {
  const sellerId = req.user.role === "vendedor" ? req.user.entityId : null;
  // Só a plataforma enxerga rascunho; para o resto, curso não publicado não
  // existe.
  const incluirRascunhos = req.user.role === "admin" && req.query.todos === "1";
  res.json({
    cursos: catalogo({ sellerId, incluirRascunhos }),
    categorias: CATEGORIAS,
    niveis: NIVEIS_CURSO,
  });
});

router.get("/courses/:id", (req, res) => {
  const curso = carregarCurso(req.params.id);
  if (!curso) return res.status(404).json({ error: "Curso não encontrado" });
  if (curso.status !== "publicado" && req.user.role !== "admin")
    return res.status(404).json({ error: "Curso não encontrado" });

  const sellerId = req.user.role === "vendedor" ? req.user.entityId : null;
  res.json({
    curso,
    progresso: sellerId ? progressoDoCurso({ courseId: curso.id, sellerId }) : null,
    tentativas: sellerId ? tentativasDoProfissional({ courseId: curso.id, sellerId }) : [],
    certificado: sellerId
      ? db.prepare("SELECT codigo, percentual, emitidoEm FROM course_certificates WHERE courseId = ? AND sellerId = ?").get(curso.id, sellerId) || null
      : null,
  });
});

// -------------------------------------------------------- aluno ----

router.post("/courses/:id/enroll", (req, res) => {
  const sellerId = souVendedor(req, res); if (!sellerId) return;
  const r = matricular({ courseId: req.params.id, sellerId });
  if (r.erro) return res.status(r.pago ? 402 : 400).json({ error: r.erro, pago: !!r.pago });
  res.json(r);
});

router.post("/courses/:id/lessons/:lessonId/complete", (req, res) => {
  const sellerId = souVendedor(req, res); if (!sellerId) return;
  const r = concluirAula({ courseId: req.params.id, lessonId: req.params.lessonId, sellerId });
  if (r.erro) return res.status(404).json({ error: r.erro });
  res.json(r);
});

router.delete("/courses/:id/lessons/:lessonId/complete", (req, res) => {
  const sellerId = souVendedor(req, res); if (!sellerId) return;
  res.json(reabrirAula({ courseId: req.params.id, lessonId: req.params.lessonId, sellerId }));
});

router.get("/courses/:id/quiz", (req, res) => {
  const sellerId = souVendedor(req, res); if (!sellerId) return;
  const progresso = progressoDoCurso({ courseId: req.params.id, sellerId });
  if (!progresso.liberouProva)
    return res.status(423).json({ error: `Conclua todas as aulas para liberar a prova.`, progresso });
  res.json({ questoes: provaDoCurso(req.params.id), progresso });
});

router.post("/courses/:id/quiz", (req, res) => {
  const sellerId = souVendedor(req, res); if (!sellerId) return;
  const r = responderProva({ courseId: req.params.id, sellerId, respostas: req.body?.respostas || {} });
  if (r.erro) return res.status(400).json({ error: r.erro });

  if (r.aprovado) {
    const curso = db.prepare("SELECT titulo FROM courses WHERE id = ?").get(req.params.id);
    const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sellerId);
    if (user) notificar(user.id, "academy", "Certificado emitido",
      `Você concluiu "${curso?.titulo}" com ${r.percentual}%. O certificado ${r.certificado.codigo} já está no seu perfil.`);
  }
  res.json(r);
});

router.get("/courses/me/certificates", (req, res) => {
  const sellerId = souVendedor(req, res); if (!sellerId) return;
  res.json({ certificados: certificadosDoProfissional(sellerId) });
});

// Conferência pública de certificado — dentro da sessão, para qualquer papel.
// Um certificado que ninguém consegue verificar não vale como credencial.
router.get("/certificates/:codigo", (req, res) => {
  const c = verificarCertificado(req.params.codigo);
  if (!c) return res.status(404).json({ error: "Certificado não encontrado" });
  res.json(c);
});

// ------------------------------------------------------------- plataforma ----

const souAdmin = (req, res) => {
  if (req.user.role !== "admin") { res.status(403).json({ error: "Apenas a plataforma" }); return false; }
  return true;
};

router.get("/admin/courses/stats", (req, res) => {
  if (!souAdmin(req, res)) return;
  res.json(estatisticas());
});

router.post("/admin/courses", (req, res) => {
  if (!souAdmin(req, res)) return;
  const { titulo } = req.body || {};
  if (!String(titulo || "").trim()) return res.status(400).json({ error: "O curso precisa de um título" });
  const id = criarCurso({ ...req.body, criadoPor: req.user.id });
  res.json({ id, curso: carregarCurso(id, { comProva: true }) });
});

router.patch("/admin/courses/:id", (req, res) => {
  if (!souAdmin(req, res)) return;
  const r = atualizarCurso(req.params.id, req.body);
  if (r.erro) return res.status(400).json({ error: r.erro });
  res.json({ curso: carregarCurso(req.params.id, { comProva: true }) });
});

router.post("/admin/courses/:id/duplicate", (req, res) => {
  if (!souAdmin(req, res)) return;
  const r = duplicarCurso(req.params.id, req.user.id);
  if (r.erro) return res.status(404).json({ error: r.erro });
  res.json(r);
});

router.get("/admin/courses/:id", (req, res) => {
  if (!souAdmin(req, res)) return;
  const curso = carregarCurso(req.params.id, { comProva: true });
  if (!curso) return res.status(404).json({ error: "Curso não encontrado" });
  res.json({ curso });
});

export default router;

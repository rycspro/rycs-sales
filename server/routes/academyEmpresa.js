// Academy da empresa: a empresa cria treinamentos para os profissionais das
// suas campanhas. Reaproveita toda a estrutura de cursos (courses, modules,
// lessons, questions, enrollments, certificates) — aqui só o recorte por
// companyId e a distribuição por campanha (course_campaigns).

import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { criarCurso, carregarCurso, atualizarCurso, duplicarCurso } from "../services/academy.js";
import { coletarFontes, sugerirTreinamentos, gerarCurso, gerarAulasParaCurso, iaDisponivel } from "../services/academyIA.js";

const router = Router();

const empresa = (req, res) => {
  if (req.user.role !== "empresa") { res.status(403).json({ error: "Apenas empresas" }); return null; }
  return req.user.entityId;
};

const lista = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };

// Resolve o curso garantindo que é da empresa logada.
function cursoDaEmpresa(id, companyId) {
  const c = db.prepare("SELECT * FROM courses WHERE id = ? AND companyId = ?").get(id, companyId);
  return c || null;
}
function cursoDoModulo(moduleId, companyId) {
  return db.prepare(`SELECT c.* FROM course_modules m JOIN courses c ON c.id = m.courseId
                     WHERE m.id = ? AND c.companyId = ?`).get(moduleId, companyId) || null;
}
function cursoDaAula(lessonId, companyId) {
  return db.prepare(`SELECT c.* FROM course_lessons l JOIN courses c ON c.id = l.courseId
                     WHERE l.id = ? AND c.companyId = ?`).get(lessonId, companyId) || null;
}

function campanhasDoCurso(courseId) {
  return db.prepare(`SELECT cc.campaignId, cc.obrigatorio, c.titulo
                     FROM course_campaigns cc JOIN campaigns c ON c.id = cc.campaignId
                     WHERE cc.courseId = ?`).all(courseId)
    .map((r) => ({ id: r.campaignId, titulo: r.titulo, obrigatorio: !!r.obrigatorio }));
}

// Resumo de um curso para os cards da biblioteca.
function resumoCurso(c) {
  const t = db.prepare("SELECT COUNT(*) aulas, COALESCE(SUM(duracaoMin),0) minutos FROM course_lessons WHERE courseId = ?").get(c.id);
  const modulos = db.prepare("SELECT COUNT(*) n FROM course_modules WHERE courseId = ?").get(c.id).n;
  const matriculas = db.prepare("SELECT COUNT(*) n FROM course_enrollments WHERE courseId = ?").get(c.id).n;
  return {
    id: c.id, titulo: c.titulo, descricao: c.descricao || "", capa: c.capa || "",
    status: c.status, origem: c.origem || "manual", notaMinima: c.notaMinima, criadoEm: c.criadoEm, atualizadoEm: c.atualizadoEm,
    modulos, aulas: t.aulas, duracaoMin: t.minutos, profissionais: matriculas,
    campanhas: campanhasDoCurso(c.id),
  };
}

// --------------------------------------------------- listagem + indicadores ----
router.get("/academy/empresa", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const cursos = db.prepare("SELECT * FROM courses WHERE companyId = ? ORDER BY ordem ASC, atualizadoEm DESC").all(companyId);
  const ids = cursos.map((c) => c.id);

  let emAprendizado = 0, conclusoes = 0;
  if (ids.length) {
    const ph = ids.map(() => "?").join(",");
    emAprendizado = db.prepare(`SELECT COUNT(DISTINCT sellerId) n FROM course_enrollments WHERE courseId IN (${ph}) AND concluidoEm IS NULL`).get(...ids).n;
    conclusoes = db.prepare(`SELECT COUNT(*) n FROM course_enrollments WHERE courseId IN (${ph}) AND concluidoEm IS NOT NULL`).get(...ids).n;
  }

  res.json({
    indicadores: { treinamentos: cursos.length, emAprendizado, conclusoes },
    cursos: cursos.map(resumoCurso),
  });
});

// --------------------------------------------------------------- criar ----
router.post("/academy/empresa/cursos", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const titulo = String(req.body?.titulo || "").trim();
  if (!titulo) return res.status(400).json({ error: "O treinamento precisa de um nome." });
  const emp = db.prepare("SELECT nome FROM companies WHERE id = ?").get(companyId);
  const id = criarCurso({
    titulo,
    descricao: String(req.body?.descricao || "").slice(0, 2000),
    capa: req.body?.capa || "",
    companyId,
    professor: emp?.nome || "",
    status: "rascunho",
    criadoPor: req.user.id,
    // Já nasce com o primeiro módulo, para a empresa adicionar aulas direto.
    modulos: [{ titulo: "Módulo 01", aulas: [] }],
  });
  res.status(201).json({ curso: carregarCurso(id, { comProva: true }) });
});

// ------------------------------------------------------------- abrir (builder) ----
router.get("/academy/empresa/cursos/:id", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  if (!cursoDaEmpresa(req.params.id, companyId)) return res.status(404).json({ error: "Treinamento não encontrado." });
  const curso = carregarCurso(req.params.id, { comProva: true });
  curso.campanhas = campanhasDoCurso(curso.id);
  res.json({ curso });
});

// ------------------------------------------------------------- editar meta ----
router.patch("/academy/empresa/cursos/:id", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  if (!cursoDaEmpresa(req.params.id, companyId)) return res.status(404).json({ error: "Treinamento não encontrado." });
  const permitido = {};
  for (const k of ["titulo", "descricao", "capa", "notaMinima"]) if (k in (req.body || {})) permitido[k] = req.body[k];
  atualizarCurso(req.params.id, permitido);
  res.json({ curso: carregarCurso(req.params.id, { comProva: true }) });
});

// ------------------------------------------------------------- duplicar ----
router.post("/academy/empresa/cursos/:id/duplicar", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  if (!cursoDaEmpresa(req.params.id, companyId)) return res.status(404).json({ error: "Treinamento não encontrado." });
  const r = duplicarCurso(req.params.id, req.user.id);
  if (r.erro) return res.status(404).json({ error: r.erro });
  res.status(201).json({ id: r.id });
});

// ------------------------------------------------------------- excluir ----
router.delete("/academy/empresa/cursos/:id", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const c = cursoDaEmpresa(req.params.id, companyId);
  if (!c) return res.status(404).json({ error: "Treinamento não encontrado." });
  db.transaction(() => {
    db.prepare("DELETE FROM course_campaigns WHERE courseId = ?").run(c.id);
    db.prepare("DELETE FROM course_lessons WHERE courseId = ?").run(c.id);
    db.prepare("DELETE FROM course_modules WHERE courseId = ?").run(c.id);
    db.prepare("DELETE FROM course_questions WHERE courseId = ?").run(c.id);
    db.prepare("DELETE FROM course_lesson_progress WHERE courseId = ?").run(c.id);
    db.prepare("DELETE FROM course_enrollments WHERE courseId = ?").run(c.id);
    db.prepare("DELETE FROM course_attempts WHERE courseId = ?").run(c.id);
    db.prepare("DELETE FROM course_certificates WHERE courseId = ?").run(c.id);
    db.prepare("DELETE FROM courses WHERE id = ?").run(c.id);
  })();
  res.json({ ok: true });
});

// =================================================================== módulos ====
router.post("/academy/empresa/cursos/:id/modulos", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  if (!cursoDaEmpresa(req.params.id, companyId)) return res.status(404).json({ error: "Treinamento não encontrado." });
  const ordem = db.prepare("SELECT COALESCE(MAX(ordem),-1)+1 o FROM course_modules WHERE courseId = ?").get(req.params.id).o;
  const id = uid();
  const titulo = String(req.body?.titulo || "").trim() || `Módulo ${String(ordem + 1).padStart(2, "0")}`;
  db.prepare("INSERT INTO course_modules (id, courseId, titulo, resumo, ordem) VALUES (?, ?, ?, '', ?)").run(id, req.params.id, titulo, ordem);
  res.status(201).json({ modulo: { id, titulo, ordem, aulas: [] } });
});

router.patch("/academy/empresa/modulos/:moduleId", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  if (!cursoDoModulo(req.params.moduleId, companyId)) return res.status(404).json({ error: "Módulo não encontrado." });
  const titulo = String(req.body?.titulo || "").trim();
  if (!titulo) return res.status(400).json({ error: "Informe o nome do módulo." });
  db.prepare("UPDATE course_modules SET titulo = ? WHERE id = ?").run(titulo.slice(0, 200), req.params.moduleId);
  res.json({ ok: true });
});

router.delete("/academy/empresa/modulos/:moduleId", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  if (!cursoDoModulo(req.params.moduleId, companyId)) return res.status(404).json({ error: "Módulo não encontrado." });
  db.transaction(() => {
    db.prepare("DELETE FROM course_lessons WHERE moduleId = ?").run(req.params.moduleId);
    db.prepare("DELETE FROM course_modules WHERE id = ?").run(req.params.moduleId);
  })();
  res.json({ ok: true });
});

router.put("/academy/empresa/cursos/:id/modulos/ordem", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  if (!cursoDaEmpresa(req.params.id, companyId)) return res.status(404).json({ error: "Treinamento não encontrado." });
  const ids = (req.body?.ids || []).filter(Boolean);
  const upd = db.prepare("UPDATE course_modules SET ordem = ? WHERE id = ? AND courseId = ?");
  db.transaction(() => ids.forEach((mid, i) => upd.run(i, mid, req.params.id)))();
  res.json({ ok: true });
});

// ===================================================================== aulas ====
function dadosAula(body) {
  return {
    titulo: String(body?.titulo || "").trim().slice(0, 200) || "Nova aula",
    tipo: ["video", "documento", "audio", "link", "texto"].includes(body?.tipo) ? body.tipo : "texto",
    conteudo: String(body?.conteudo || "").slice(0, 20000),
    videoUrl: String(body?.videoUrl || "").slice(0, 2000),
    materiais: Array.isArray(body?.materiais) ? body.materiais.slice(0, 50) : [],
    duracaoMin: Math.max(0, Math.min(600, Number(body?.duracaoMin) || 0)),
  };
}

router.post("/academy/empresa/modulos/:moduleId/aulas", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const curso = cursoDoModulo(req.params.moduleId, companyId);
  if (!curso) return res.status(404).json({ error: "Módulo não encontrado." });
  const ordem = db.prepare("SELECT COALESCE(MAX(ordem),-1)+1 o FROM course_lessons WHERE moduleId = ?").get(req.params.moduleId).o;
  const d = dadosAula(req.body);
  const id = uid();
  db.prepare(`INSERT INTO course_lessons (id, courseId, moduleId, titulo, tipo, conteudo, videoUrl, materiais, duracaoMin, ordem)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, curso.id, req.params.moduleId, d.titulo, d.tipo, d.conteudo, d.videoUrl, JSON.stringify(d.materiais), d.duracaoMin, ordem);
  db.prepare("UPDATE courses SET atualizadoEm = ? WHERE id = ?").run(agora(), curso.id);
  res.status(201).json({ aula: { id, moduleId: req.params.moduleId, ordem, ...d } });
});

router.patch("/academy/empresa/aulas/:lessonId", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const curso = cursoDaAula(req.params.lessonId, companyId);
  if (!curso) return res.status(404).json({ error: "Aula não encontrada." });
  const d = dadosAula({ ...db.prepare("SELECT titulo, tipo, conteudo, videoUrl, materiais, duracaoMin FROM course_lessons WHERE id = ?").get(req.params.lessonId), ...req.body, materiais: req.body?.materiais });
  db.prepare("UPDATE course_lessons SET titulo = ?, tipo = ?, conteudo = ?, videoUrl = ?, materiais = ?, duracaoMin = ? WHERE id = ?")
    .run(d.titulo, d.tipo, d.conteudo, d.videoUrl, JSON.stringify(d.materiais), d.duracaoMin, req.params.lessonId);
  db.prepare("UPDATE courses SET atualizadoEm = ? WHERE id = ?").run(agora(), curso.id);
  res.json({ aula: { id: req.params.lessonId, ...d } });
});

router.delete("/academy/empresa/aulas/:lessonId", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const curso = cursoDaAula(req.params.lessonId, companyId);
  if (!curso) return res.status(404).json({ error: "Aula não encontrada." });
  db.prepare("DELETE FROM course_lesson_progress WHERE lessonId = ?").run(req.params.lessonId);
  db.prepare("DELETE FROM course_lessons WHERE id = ?").run(req.params.lessonId);
  res.json({ ok: true });
});

router.put("/academy/empresa/modulos/:moduleId/aulas/ordem", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  if (!cursoDoModulo(req.params.moduleId, companyId)) return res.status(404).json({ error: "Módulo não encontrado." });
  const ids = (req.body?.ids || []).filter(Boolean);
  const upd = db.prepare("UPDATE course_lessons SET ordem = ? WHERE id = ? AND moduleId = ?");
  db.transaction(() => ids.forEach((lid, i) => upd.run(i, lid, req.params.moduleId)))();
  res.json({ ok: true });
});

// ================================================================= publicação ====
router.post("/academy/empresa/cursos/:id/publicar", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const c = cursoDaEmpresa(req.params.id, companyId);
  if (!c) return res.status(404).json({ error: "Treinamento não encontrado." });
  if (!String(c.titulo || "").trim()) return res.status(400).json({ error: "O treinamento precisa de um nome." });
  const aulas = db.prepare("SELECT COUNT(*) n FROM course_lessons WHERE courseId = ?").get(c.id).n;
  if (aulas < 1) return res.status(400).json({ error: "Adicione pelo menos uma aula antes de publicar." });

  const obrigatorio = req.body?.obrigatorio ? 1 : 0;
  const ids = (req.body?.campanhaIds || []).filter(Boolean).slice(0, 200);
  const validas = ids.length
    ? db.prepare(`SELECT id FROM campaigns WHERE companyId = ? AND id IN (${ids.map(() => "?").join(",")})`).all(companyId, ...ids).map((r) => r.id)
    : [];
  db.transaction(() => {
    db.prepare("DELETE FROM course_campaigns WHERE courseId = ?").run(c.id);
    const ins = db.prepare("INSERT INTO course_campaigns (courseId, campaignId, obrigatorio, criadoEm) VALUES (?, ?, ?, ?)");
    const ts = agora();
    for (const cid of validas) ins.run(c.id, cid, obrigatorio, ts);
    db.prepare("UPDATE courses SET status = 'publicado', atualizadoEm = ? WHERE id = ?").run(ts, c.id);
  })();
  res.json({ curso: carregarCurso(c.id, { comProva: true }), campanhas: campanhasDoCurso(c.id) });
});

router.post("/academy/empresa/cursos/:id/rascunho", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const c = cursoDaEmpresa(req.params.id, companyId);
  if (!c) return res.status(404).json({ error: "Treinamento não encontrado." });
  atualizarCurso(c.id, { status: "rascunho" });
  res.json({ ok: true });
});

router.post("/academy/empresa/cursos/:id/arquivar", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const c = cursoDaEmpresa(req.params.id, companyId);
  if (!c) return res.status(404).json({ error: "Treinamento não encontrado." });
  atualizarCurso(c.id, { status: "arquivado" });
  res.json({ ok: true });
});

// -------------------------------- avaliação (questões) — base para a Fase 2 ----
router.put("/academy/empresa/cursos/:id/avaliacao", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const c = cursoDaEmpresa(req.params.id, companyId);
  if (!c) return res.status(404).json({ error: "Treinamento não encontrado." });
  const questoes = Array.isArray(req.body?.questoes) ? req.body.questoes.slice(0, 100) : [];
  const notaMinima = Math.max(0, Math.min(100, Number(req.body?.notaMinima) || 80));
  db.transaction(() => {
    db.prepare("DELETE FROM course_questions WHERE courseId = ?").run(c.id);
    const ins = db.prepare("INSERT INTO course_questions (id, courseId, pergunta, alternativas, correta, explicacao, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)");
    questoes.forEach((q, i) => {
      const pergunta = String(q?.pergunta || "").trim();
      const alternativas = (Array.isArray(q?.alternativas) ? q.alternativas : []).map((a) => String(a || "").slice(0, 500)).filter(Boolean);
      if (!pergunta || alternativas.length < 2) return;
      ins.run(uid(), c.id, pergunta.slice(0, 1000), JSON.stringify(alternativas), Math.max(0, Math.min(alternativas.length - 1, Number(q?.correta) || 0)), String(q?.explicacao || "").slice(0, 1000), i);
    });
    db.prepare("UPDATE courses SET notaMinima = ?, atualizadoEm = ? WHERE id = ?").run(notaMinima, agora(), c.id);
  })();
  res.json({ curso: carregarCurso(c.id, { comProva: true }) });
});

// Reordena os módulos (treinamentos) da empresa. [{id, ordem}] ou [ids].
router.put("/academy/empresa/cursos/ordem", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const itens = Array.isArray(req.body?.ordem) ? req.body.ordem : [];
  const stmt = db.prepare("UPDATE courses SET ordem = ? WHERE id = ? AND companyId = ?");
  db.transaction(() => {
    itens.forEach((it, i) => {
      const id = typeof it === "string" ? it : it?.id;
      const ordem = typeof it === "object" && Number.isFinite(it?.ordem) ? it.ordem : i;
      if (id) stmt.run(ordem, id, companyId);
    });
  })();
  res.json({ ok: true });
});

// ------------------------------------------- Aprendizado (dados reais) ----
// Indicadores gerais + desempenho por módulo (treinamento). Tudo derivado das
// tabelas existentes de matrícula/progresso/campanhas — sem dados simulados.
router.get("/academy/empresa/aprendizado", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const cursos = db.prepare("SELECT id, titulo, descricao, status, ordem FROM courses WHERE companyId = ? AND status <> 'arquivado' ORDER BY ordem ASC, atualizadoEm DESC").all(companyId);

  // Profissionais aprovados na empresa (via campanhas).
  const aprovados = db.prepare(`
    SELECT DISTINCT ca.sellerId FROM campaign_applications ca
    JOIN campaigns c ON c.id = ca.campaignId
    WHERE c.companyId = ? AND ca.status = 'aprovado'
  `).all(companyId).map((r) => r.sellerId);
  const setAprovados = new Set(aprovados);

  const idsCursos = cursos.map((c) => c.id);
  const ph = idsCursos.map(() => "?").join(",");

  // Elegíveis por curso = aprovados nas campanhas vinculadas ao curso.
  const elegiveisPorCurso = {};
  if (idsCursos.length) {
    const rows = db.prepare(`
      SELECT cc.courseId, ca.sellerId FROM course_campaigns cc
      JOIN campaign_applications ca ON ca.campaignId = cc.campaignId AND ca.status = 'aprovado'
      WHERE cc.courseId IN (${ph})
    `).all(...idsCursos);
    for (const r of rows) (elegiveisPorCurso[r.courseId] = elegiveisPorCurso[r.courseId] || new Set()).add(r.sellerId);
  }

  const modulos = cursos.map((c) => {
    const elegiveis = elegiveisPorCurso[c.id]?.size || 0;
    const iniciaram = db.prepare("SELECT COUNT(DISTINCT sellerId) n FROM course_enrollments WHERE courseId = ?").get(c.id).n;
    const concluiram = db.prepare("SELECT COUNT(*) n FROM course_enrollments WHERE courseId = ? AND concluidoEm IS NOT NULL").get(c.id).n;
    const denom = elegiveis || iniciaram || 0;
    const pct = denom ? Math.round((concluiram / denom) * 100) : 0;
    return { id: c.id, titulo: c.titulo, descricao: c.descricao || "", status: c.status, elegiveis, iniciaram, concluiram, pct };
  });

  // Indicadores gerais.
  let iniciaramAcademy = 0, concluiramJornada = 0, progressoMedio = 0;
  if (idsCursos.length) {
    iniciaramAcademy = db.prepare(`SELECT COUNT(DISTINCT sellerId) n FROM course_enrollments WHERE courseId IN (${ph})`).get(...idsCursos).n;
    // Conclusão da jornada: matriculado em ≥1 curso publicado e com todas as matrículas concluídas.
    const porSeller = db.prepare(`SELECT sellerId, COUNT(*) total, SUM(CASE WHEN concluidoEm IS NOT NULL THEN 1 ELSE 0 END) feitos FROM course_enrollments WHERE courseId IN (${ph}) GROUP BY sellerId`).all(...idsCursos);
    concluiramJornada = porSeller.filter((s) => s.total > 0 && s.feitos === s.total).length;
    if (porSeller.length) progressoMedio = Math.round(porSeller.reduce((a, s) => a + (s.feitos / s.total), 0) / porSeller.length * 100);
  }

  res.json({
    indicadores: {
      aprovados: setAprovados.size,
      iniciaram: iniciaramAcademy,
      concluiram: concluiramJornada,
      progressoMedio,
    },
    modulos,
  });
});

// ----------------------------------------- Regras gerais da Academy (§13) ----
router.get("/academy/empresa/config", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const row = db.prepare("SELECT academyConfig FROM companies WHERE id = ?").get(companyId);
  let cfg = {}; try { cfg = JSON.parse(row?.academyConfig || "{}"); } catch { cfg = {}; }
  res.json({ config: { sequenciaObrigatoria: !!cfg.sequenciaObrigatoria, ...cfg } });
});

router.put("/academy/empresa/config", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const row = db.prepare("SELECT academyConfig FROM companies WHERE id = ?").get(companyId);
  let cfg = {}; try { cfg = JSON.parse(row?.academyConfig || "{}"); } catch { cfg = {}; }
  if ("sequenciaObrigatoria" in (req.body || {})) cfg.sequenciaObrigatoria = !!req.body.sequenciaObrigatoria;
  db.prepare("UPDATE companies SET academyConfig = ? WHERE id = ?").run(JSON.stringify(cfg), companyId);
  res.json({ config: cfg });
});

// ----------------------------------------------- Inteligência da Academy ----
// Contadores compactos para o card de inteligência da página.
router.get("/academy/empresa/inteligencia", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const fontes = coletarFontes(companyId).length;
  const revisao = db.prepare("SELECT COUNT(*) n FROM courses WHERE companyId = ? AND status = 'revisao'").get(companyId).n;
  // Módulos (treinamentos não arquivados) ainda sem nenhuma aula.
  const modulosSemConteudo = db.prepare(`
    SELECT COUNT(*) n FROM courses c
    WHERE c.companyId = ? AND c.status <> 'arquivado'
      AND NOT EXISTS (SELECT 1 FROM course_lessons l WHERE l.courseId = c.id)
  `).get(companyId).n;
  // Atualizações sugeridas: treinos cuja fonte de informação foi alterada em
  // Materiais depois que o treino foi atualizado pela última vez.
  const atualizacoes = db.prepare(`
    SELECT COUNT(DISTINCT cs.courseId) n FROM course_sources cs
    JOIN courses c ON c.id = cs.courseId
    JOIN company_info_entries e ON ('info-' || e.id) = cs.fonteId
    WHERE cs.companyId = ? AND e.atualizadoEm > c.atualizadoEm
  `).get(companyId).n;
  res.json({ iaDisponivel: iaDisponivel(), fontes, revisao, atualizacoes, modulosSemConteudo });
});

// Fontes elegíveis (Informações da empresa + base + arquivos indexados).
router.get("/academy/empresa/fontes", (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const fontes = coletarFontes(companyId).map((f) => ({ id: f.id, grupo: f.grupo, titulo: f.titulo, tipo: f.tipo }));
  const grupos = {};
  for (const f of fontes) grupos[f.grupo] = (grupos[f.grupo] || 0) + 1;
  res.json({ fontes, grupos, total: fontes.length });
});

// Sugestões de treinamentos analisando as fontes selecionadas.
router.post("/academy/empresa/ia/sugestoes", async (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  try {
    res.json(await sugerirTreinamentos(companyId, req.body?.fonteIds));
  } catch {
    res.status(500).json({ error: "Não foi possível analisar os materiais agora." });
  }
});

// Gera aulas para um módulo específico (mantém em revisão; não publica).
router.post("/academy/empresa/cursos/:id/ia/aulas", async (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  if (!cursoDaEmpresa(req.params.id, companyId)) return res.status(404).json({ error: "Módulo não encontrado." });
  try {
    const r = await gerarAulasParaCurso(companyId, req.params.id);
    res.json({ ok: true, ...r, curso: carregarCurso(req.params.id, { comProva: true }) });
  } catch (e) {
    res.status(500).json({ error: e.message || "Falha ao gerar aulas." });
  }
});

// Gera os treinamentos escolhidos e salva como "aguardando revisão".
router.post("/academy/empresa/ia/gerar", async (req, res) => {
  const companyId = empresa(req, res);
  if (!companyId) return;
  const sugestoes = Array.isArray(req.body?.sugestoes) ? req.body.sugestoes : (req.body?.sugestao ? [req.body.sugestao] : []);
  if (!sugestoes.length) return res.status(400).json({ error: "Selecione ao menos uma sugestão." });
  try {
    const cursoIds = [];
    for (const s of sugestoes.slice(0, 5)) cursoIds.push(await gerarCurso(companyId, s, req.user.id));
    res.json({ ok: true, criados: cursoIds.length, cursoIds });
  } catch (e) {
    res.status(500).json({ error: e.message || "Falha ao gerar treinamentos." });
  }
});

export default router;

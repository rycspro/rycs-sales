// RYCS Academy — catálogo, matrícula, progresso, prova e certificado.
//
// O curso vive no banco. O arquivo de catálogo é semente do primeiro boot; a
// partir daí a plataforma edita pelo painel e nada aqui depende de deploy.

import { randomBytes } from "crypto";
import db, { uid, agora } from "../db.js";
import { CATALOGO_INICIAL, gerarCapa, NIVEIS_CURSO } from "../../shared/academy/catalogo.js";

const lista = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };

// ------------------------------------------------------------- semente ----

// Semeia por slug, não por tabela vazia. Checar se a tabela tem alguma coisa
// faria um curso novo do catálogo nunca chegar a uma instalação que já rodou
// uma vez — que é exatamente o caso de produção.
//
// Curso já existente não é tocado: a plataforma pode tê-lo editado, e
// sobrescrever apagaria esse trabalho.
export function semearCatalogo() {
  const existentes = new Set(db.prepare("SELECT slug FROM courses").all().map((c) => c.slug));
  const novos = CATALOGO_INICIAL.filter((c) => !existentes.has(c.slug));
  if (!novos.length) return 0;

  const base = db.prepare("SELECT COALESCE(MAX(ordem), -1) o FROM courses").get().o;
  novos.forEach((curso, i) => {
    criarCurso({ ...curso, ordem: base + 1 + i, status: "publicado", criadoPor: "sistema" });
  });

  console.log(`[academy] ${novos.length} curso(s) publicado(s): ${novos.map((c) => c.slug).join(", ")}`);
  return novos.length;
}

// --------------------------------------------------------------- CRUD ----

export function criarCurso(dados) {
  const id = uid();
  const ts = agora();
  const cor = NIVEIS_CURSO[dados.nivel]?.cor || NIVEIS_CURSO.fundamentos.cor;
  const capa = dados.capa || gerarCapa({ titulo: dados.titulo, categoria: dados.categoria, cor });

  db.transaction(() => {
    db.prepare(`INSERT INTO courses
      (id, slug, titulo, subtitulo, descricao, categoria, nivel, professor, capa, requisitos,
       funcao, gratuito, preco, notaMinima, status, ordem, criadoPor, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, dados.slug || `curso-${id.slice(0, 8)}`, dados.titulo, dados.subtitulo || "",
        dados.descricao || "", dados.categoria || "Vendas", dados.nivel || "fundamentos",
        dados.professor || "RYCS", capa, dados.requisitos || "", dados.funcao || "",
        dados.gratuito === false ? 0 : 1, Number(dados.preco) || 0,
        Number(dados.notaMinima) || 70, dados.status || "rascunho",
        Number(dados.ordem) || 0, dados.criadoPor || null, ts, ts);

    (dados.modulos || []).forEach((m, mi) => {
      const moduleId = uid();
      db.prepare("INSERT INTO course_modules (id, courseId, titulo, resumo, ordem) VALUES (?, ?, ?, ?, ?)")
        .run(moduleId, id, m.titulo, m.resumo || "", mi);

      (m.aulas || []).forEach((a, ai) => {
        db.prepare(`INSERT INTO course_lessons
          (id, courseId, moduleId, titulo, tipo, conteudo, videoUrl, materiais, duracaoMin, ordem)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(uid(), id, moduleId, a.titulo, a.tipo || "texto", a.conteudo || "",
            a.videoUrl || "", JSON.stringify(a.materiais || []), Number(a.duracaoMin) || 5, ai);
      });
    });

    (dados.prova || []).forEach((q, qi) => {
      db.prepare(`INSERT INTO course_questions (id, courseId, pergunta, alternativas, correta, explicacao, ordem)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(uid(), id, q.pergunta, JSON.stringify(q.alternativas || []),
          Number(q.correta) || 0, q.explicacao || "", qi);
    });
  })();

  return id;
}

export function atualizarCurso(id, dados) {
  const campos = ["titulo", "subtitulo", "descricao", "categoria", "nivel", "professor",
    "capa", "requisitos", "funcao", "gratuito", "preco", "notaMinima", "status", "ordem"];
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(dados || {})) {
    if (!campos.includes(k)) continue;
    sets.push(`${k} = ?`);
    vals.push(k === "gratuito" ? (v ? 1 : 0) : v);
  }
  if (!sets.length) return { erro: "Nenhum campo válido" };
  sets.push("atualizadoEm = ?");
  vals.push(agora(), id);
  db.prepare(`UPDATE courses SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return { ok: true };
}

// Duplicar é como se cria a próxima versão de um curso sem mexer no que os
// alunos já estão fazendo.
export function duplicarCurso(id, criadoPor) {
  const curso = carregarCurso(id, { comProva: true });
  if (!curso) return { erro: "Curso não encontrado" };
  const novo = criarCurso({
    ...curso,
    slug: `${curso.slug}-copia-${Date.now().toString(36)}`,
    titulo: `${curso.titulo} (cópia)`,
    status: "rascunho",
    capa: curso.capa,
    modulos: curso.modulos.map((m) => ({ titulo: m.titulo, resumo: m.resumo, aulas: m.aulas })),
    prova: curso.prova,
    criadoPor,
  });
  return { id: novo };
}

// ------------------------------------------------------------- leitura ----

export function carregarCurso(id, { comProva = false } = {}) {
  const curso = db.prepare("SELECT * FROM courses WHERE id = ? OR slug = ?").get(id, id);
  if (!curso) return null;

  const modulos = db.prepare("SELECT * FROM course_modules WHERE courseId = ? ORDER BY ordem").all(curso.id);
  const aulas = db.prepare("SELECT * FROM course_lessons WHERE courseId = ? ORDER BY ordem").all(curso.id)
    .map((a) => ({ ...a, materiais: lista(a.materiais) }));

  const montado = {
    ...curso,
    gratuito: !!curso.gratuito,
    modulos: modulos.map((m) => ({ ...m, aulas: aulas.filter((a) => a.moduleId === m.id) })),
    totalAulas: aulas.length,
    duracaoMin: aulas.reduce((n, a) => n + (Number(a.duracaoMin) || 0), 0),
  };

  if (comProva) {
    montado.prova = db.prepare("SELECT * FROM course_questions WHERE courseId = ? ORDER BY ordem").all(curso.id)
      .map((q) => ({ ...q, alternativas: lista(q.alternativas) }));
  }
  montado.totalQuestoes = db.prepare("SELECT COUNT(*) n FROM course_questions WHERE courseId = ?").get(curso.id).n;

  return montado;
}

// Catálogo com o progresso do profissional embutido. Sem isso a tela teria de
// cruzar duas listas no cliente, e "continuar assistindo" ficaria impreciso.
export function catalogo({ sellerId = null, incluirRascunhos = false } = {}) {
  const where = incluirRascunhos ? "" : "WHERE status = 'publicado'";
  const cursos = db.prepare(`SELECT * FROM courses ${where} ORDER BY ordem, criadoEm`).all();

  const totais = db.prepare(`
    SELECT courseId, COUNT(*) aulas, SUM(duracaoMin) minutos FROM course_lessons GROUP BY courseId
  `).all();
  const alunos = db.prepare("SELECT courseId, COUNT(*) n FROM course_enrollments GROUP BY courseId").all();

  const progresso = sellerId
    ? db.prepare("SELECT courseId, COUNT(*) n FROM course_lesson_progress WHERE sellerId = ? GROUP BY courseId").all(sellerId)
    : [];
  const matriculas = sellerId
    ? db.prepare("SELECT courseId, criadoEm, concluidoEm FROM course_enrollments WHERE sellerId = ?").all(sellerId)
    : [];
  const certificados = sellerId
    ? db.prepare("SELECT courseId, codigo, percentual, emitidoEm FROM course_certificates WHERE sellerId = ?").all(sellerId)
    : [];

  return cursos.map((c) => {
    const t = totais.find((x) => x.courseId === c.id) || { aulas: 0, minutos: 0 };
    const feitas = progresso.find((x) => x.courseId === c.id)?.n || 0;
    const matricula = matriculas.find((x) => x.courseId === c.id) || null;
    return {
      ...c,
      gratuito: !!c.gratuito,
      totalAulas: t.aulas,
      duracaoMin: t.minutos || 0,
      alunos: alunos.find((x) => x.courseId === c.id)?.n || 0,
      matriculado: !!matricula,
      aulasConcluidas: feitas,
      progresso: t.aulas ? Math.round((feitas / t.aulas) * 100) : 0,
      certificado: certificados.find((x) => x.courseId === c.id) || null,
    };
  });
}

// ------------------------------------------------------------ matrícula ----

export function matricular({ courseId, sellerId }) {
  const curso = db.prepare("SELECT id, gratuito, status FROM courses WHERE id = ?").get(courseId);
  if (!curso) return { erro: "Curso não encontrado" };
  if (curso.status !== "publicado") return { erro: "Curso ainda não publicado" };

  // Curso pago exige compra. Não existe caminho no código que matricule em
  // curso pago sem pagamento confirmado — liberar por engano aqui seria dar
  // produto de graça sem ninguém perceber.
  if (!curso.gratuito) {
    return { erro: "Este curso é pago. A compra ainda não está disponível nesta versão.", pago: true };
  }

  const ja = db.prepare("SELECT id FROM course_enrollments WHERE courseId = ? AND sellerId = ?").get(courseId, sellerId);
  if (ja) return { id: ja.id, jaMatriculado: true };

  const id = uid();
  db.prepare("INSERT INTO course_enrollments (id, courseId, sellerId, origem, criadoEm) VALUES (?, ?, ?, 'gratuito', ?)")
    .run(id, courseId, sellerId, agora());
  return { id };
}

export function concluirAula({ courseId, lessonId, sellerId }) {
  const aula = db.prepare("SELECT id FROM course_lessons WHERE id = ? AND courseId = ?").get(lessonId, courseId);
  if (!aula) return { erro: "Aula não encontrada neste curso" };

  db.prepare(`INSERT INTO course_lesson_progress (sellerId, courseId, lessonId, concluidoEm)
              VALUES (?, ?, ?, ?) ON CONFLICT(sellerId, lessonId) DO NOTHING`)
    .run(sellerId, courseId, lessonId, agora());

  return progressoDoCurso({ courseId, sellerId });
}

export function reabrirAula({ courseId, lessonId, sellerId }) {
  db.prepare("DELETE FROM course_lesson_progress WHERE sellerId = ? AND lessonId = ?").run(sellerId, lessonId);
  return progressoDoCurso({ courseId, sellerId });
}

export function progressoDoCurso({ courseId, sellerId }) {
  const total = db.prepare("SELECT COUNT(*) n FROM course_lessons WHERE courseId = ?").get(courseId).n;
  const feitas = db.prepare("SELECT lessonId FROM course_lesson_progress WHERE sellerId = ? AND courseId = ?")
    .all(sellerId, courseId).map((r) => r.lessonId);

  // A próxima aula é a primeira não concluída na ordem do curso: é o que faz
  // "continuar de onde parou" apontar para o lugar certo.
  const proxima = db.prepare(`
    SELECT id, titulo, moduleId FROM course_lessons
    WHERE courseId = ? AND id NOT IN (SELECT lessonId FROM course_lesson_progress WHERE sellerId = ? AND courseId = ?)
    ORDER BY ordem LIMIT 1
  `).get(courseId, sellerId, courseId) || null;

  return {
    total,
    concluidas: feitas.length,
    percentual: total ? Math.round((feitas.length / total) * 100) : 0,
    aulasConcluidas: feitas,
    proximaAula: proxima,
    liberouProva: total > 0 && feitas.length >= total,
  };
}

// ------------------------------------------------------- prova e certificado ----

export function provaDoCurso(courseId) {
  // O gabarito NUNCA sai daqui. Mandar `correta` para o cliente é entregar a
  // prova respondida junto com a prova.
  return db.prepare("SELECT id, pergunta, alternativas, ordem FROM course_questions WHERE courseId = ? ORDER BY ordem")
    .all(courseId)
    .map((q) => ({ id: q.id, pergunta: q.pergunta, alternativas: lista(q.alternativas) }));
}

export function responderProva({ courseId, sellerId, respostas = {} }) {
  const curso = db.prepare("SELECT id, titulo, notaMinima, funcao FROM courses WHERE id = ?").get(courseId);
  if (!curso) return { erro: "Curso não encontrado" };

  const progresso = progressoDoCurso({ courseId, sellerId });
  if (!progresso.liberouProva)
    return { erro: `Conclua as ${progresso.total} aulas antes da prova. Faltam ${progresso.total - progresso.concluidas}.` };

  const questoes = db.prepare("SELECT id, correta, explicacao, pergunta, alternativas FROM course_questions WHERE courseId = ? ORDER BY ordem").all(courseId);
  if (!questoes.length) return { erro: "Este curso ainda não tem prova cadastrada." };

  const detalhe = questoes.map((q) => {
    const marcada = respostas[q.id];
    const acertou = Number(marcada) === Number(q.correta);
    return {
      id: q.id, pergunta: q.pergunta, acertou,
      marcada: marcada ?? null, correta: q.correta,
      alternativas: lista(q.alternativas),
      explicacao: q.explicacao,
    };
  });

  const acertos = detalhe.filter((d) => d.acertou).length;
  const percentual = Math.round((acertos / questoes.length) * 100);
  const aprovado = percentual >= (curso.notaMinima || 70);

  const tentativaId = uid();
  db.prepare(`INSERT INTO course_attempts (id, courseId, sellerId, acertos, total, percentual, aprovado, respostas, criadoEm)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(tentativaId, courseId, sellerId, acertos, questoes.length, percentual, aprovado ? 1 : 0,
      JSON.stringify(respostas), agora());

  let certificado = null;
  if (aprovado) {
    certificado = emitirCertificado({ courseId, sellerId, percentual });
    db.prepare("UPDATE course_enrollments SET concluidoEm = ? WHERE courseId = ? AND sellerId = ? AND concluidoEm IS NULL")
      .run(agora(), courseId, sellerId);
  }

  return { tentativaId, acertos, total: questoes.length, percentual, aprovado, notaMinima: curso.notaMinima, detalhe, certificado };
}

// Código curto e verificável. Um certificado que ninguém consegue conferir não
// vale como credencial.
function gerarCodigo() {
  return `RYCS-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function emitirCertificado({ courseId, sellerId, percentual }) {
  const existente = db.prepare("SELECT * FROM course_certificates WHERE courseId = ? AND sellerId = ?").get(courseId, sellerId);
  if (existente) {
    // Refez a prova com nota maior: atualiza o percentual, mantém o código.
    if (percentual > existente.percentual) {
      db.prepare("UPDATE course_certificates SET percentual = ? WHERE id = ?").run(percentual, existente.id);
      return { ...existente, percentual };
    }
    return existente;
  }

  const cert = { id: uid(), codigo: gerarCodigo(), courseId, sellerId, percentual, emitidoEm: agora() };
  db.prepare(`INSERT INTO course_certificates (id, codigo, courseId, sellerId, percentual, emitidoEm)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(cert.id, cert.codigo, courseId, sellerId, percentual, cert.emitidoEm);
  return cert;
}

export function certificadosDoProfissional(sellerId) {
  return db.prepare(`
    SELECT ce.codigo, ce.percentual, ce.emitidoEm, c.titulo, c.categoria, c.nivel, c.professor, c.id AS courseId
    FROM course_certificates ce JOIN courses c ON c.id = ce.courseId
    WHERE ce.sellerId = ? ORDER BY ce.emitidoEm DESC
  `).all(sellerId);
}

export function verificarCertificado(codigo) {
  const c = db.prepare(`
    SELECT ce.codigo, ce.percentual, ce.emitidoEm, cu.titulo, cu.professor, s.nome AS profissional
    FROM course_certificates ce
    JOIN courses cu ON cu.id = ce.courseId
    JOIN sellers s ON s.id = ce.sellerId
    WHERE ce.codigo = ?
  `).get(String(codigo || "").toUpperCase());
  return c || null;
}

export function tentativasDoProfissional({ courseId, sellerId }) {
  return db.prepare("SELECT acertos, total, percentual, aprovado, criadoEm FROM course_attempts WHERE courseId = ? AND sellerId = ? ORDER BY criadoEm DESC")
    .all(courseId, sellerId);
}

// Painel da plataforma.
export function estatisticas() {
  const cursos = db.prepare("SELECT COUNT(*) n, SUM(status = 'publicado') publicados FROM courses").get();
  const matriculas = db.prepare("SELECT COUNT(*) n FROM course_enrollments").get().n;
  const certificados = db.prepare("SELECT COUNT(*) n FROM course_certificates").get().n;
  const conclusao = db.prepare("SELECT COUNT(*) n FROM course_enrollments WHERE concluidoEm IS NOT NULL").get().n;
  const porCurso = db.prepare(`
    SELECT c.id, c.titulo, c.status,
      (SELECT COUNT(*) FROM course_enrollments e WHERE e.courseId = c.id) alunos,
      (SELECT COUNT(*) FROM course_certificates ce WHERE ce.courseId = c.id) certificados
    FROM courses c ORDER BY alunos DESC
  `).all();
  return {
    cursos: cursos.n, publicados: cursos.publicados || 0,
    matriculas, certificados,
    taxaConclusao: matriculas ? Math.round((conclusao / matriculas) * 100) : 0,
    porCurso,
  };
}

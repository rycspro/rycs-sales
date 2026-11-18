import { carregarEdicaoBasica } from '../../shared/academy/basico.js';

// Só preenche cursos globais vazios. IDs, preços, status e edições do administrador permanecem.
export function importarAcademyBasico(db, uid, agora) {
  let incluidos = 0;
  db.transaction(() => {
    for (let id = 1; id <= 24; id++) {
      const fonte = carregarEdicaoBasica(id);
      const curso = db.prepare("SELECT * FROM courses WHERE slug = ? AND (companyId IS NULL OR companyId = '')").get(fonte.slug);
      if (!curso) continue;
      if (db.prepare('SELECT COUNT(*) n FROM course_modules WHERE courseId = ?').get(curso.id).n ||
          db.prepare('SELECT COUNT(*) n FROM course_lessons WHERE courseId = ?').get(curso.id).n ||
          db.prepare('SELECT COUNT(*) n FROM course_questions WHERE courseId = ?').get(curso.id).n) continue;
      for (const [mi, m] of fonte.modulos.entries()) {
        const moduleId = uid();
        db.prepare('INSERT INTO course_modules (id, courseId, titulo, resumo, ordem) VALUES (?, ?, ?, ?, ?)').run(moduleId, curso.id, m.titulo, '', mi);
        for (const [ai, a] of m.aulas.entries()) {
          db.prepare("INSERT INTO course_lessons (id, courseId, moduleId, titulo, tipo, conteudo, videoUrl, materiais, duracaoMin, ordem) VALUES (?, ?, ?, ?, ?, ?, '', '[]', ?, ?)")
            .run(uid(), curso.id, moduleId, a.titulo, a.tipo, a.conteudo, a.duracaoMin, mi * 100 + ai);
          incluidos++;
        }
      }
      const descricao = /^(Catálogo|Rascunho curricular) em preparação\.|^Rascunho curricular\./.test(curso.descricao || '') ? fonte.descricao : curso.descricao;
      const subtitulo = /^Edição em preparação ·/.test(curso.subtitulo || '') ? fonte.subtitulo : curso.subtitulo;
      db.prepare('UPDATE courses SET descricao = ?, subtitulo = ?, atualizadoEm = ? WHERE id = ?').run(descricao, subtitulo, agora(), curso.id);
    }
  })();
  return incluidos;
}

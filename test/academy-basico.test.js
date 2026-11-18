import test from 'node:test';
import assert from 'node:assert/strict';
const Database = Number(process.versions.node.split('.')[0]) >= 22
  ? (await import('node:sqlite')).DatabaseSync
  : (await import('better-sqlite3')).default;
import { randomUUID } from 'node:crypto';
import { importarAcademyBasico } from '../server/services/academyBasico.js';

test('importa 436 aulas uma vez e preserva configurações e cursos editados', () => {
  const db = new Database(':memory:');
  if (!db.transaction) db.transaction = (fn) => () => {
    db.exec('BEGIN');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  db.exec(`CREATE TABLE courses(id TEXT PRIMARY KEY, slug TEXT, companyId TEXT, titulo TEXT, descricao TEXT, subtitulo TEXT, atualizadoEm TEXT, gratuito INTEGER, preco REAL, status TEXT);
    CREATE TABLE course_modules(id TEXT, courseId TEXT, titulo TEXT, resumo TEXT, ordem INTEGER);
    CREATE TABLE course_lessons(id TEXT, courseId TEXT, moduleId TEXT, titulo TEXT, tipo TEXT, conteudo TEXT, videoUrl TEXT, materiais TEXT, duracaoMin INTEGER, ordem INTEGER);
    CREATE TABLE course_questions(id TEXT, courseId TEXT);`);
  for (let i = 1; i <= 24; i++) db.prepare('INSERT INTO courses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(String(i), `sales-academy-134h-${String(i).padStart(2,'0')}`, '', 'Título editado', 'Descrição editada', 'Subtítulo editado', '', 0, 97, 'rascunho');
  assert.equal(importarAcademyBasico(db, randomUUID, () => 'agora'), 436);
  const antes = db.prepare('SELECT * FROM course_lessons').all();
  assert.equal(importarAcademyBasico(db, randomUUID, () => 'depois'), 0);
  assert.deepEqual(db.prepare('SELECT * FROM course_lessons').all(), antes);
  const c = db.prepare('SELECT * FROM courses WHERE id = ?').get('2');
  assert.equal(c.preco,97); assert.equal(c.status,'rascunho'); assert.equal(c.descricao,'Descrição editada'); assert.equal(c.titulo,'Título editado');
  assert.ok(antes.every(a => a.conteudo.includes('English — India') && a.conteudo.includes('English — United States')));
  db.close();
});

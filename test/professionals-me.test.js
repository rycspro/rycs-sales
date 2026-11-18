import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";

// GET /professionals/me — pré-visualização do próprio perfil como as empresas o
// veem (mesma ficha). Deve ser restrita ao dono profissional, devolver o perfil
// enriquecido e NUNCA vazar respostas cruas (xpRespostas/disc).
test("professionals/me: dono vê o próprio perfil enriquecido, sem vazar dados crus", async (t) => {
  const { base, dbPath } = await subirServidor(t);

  const db = new Database(dbPath);
  db.prepare("INSERT INTO sellers (id, nome, sobrenome, email, whats, perfil, cidade, estado, bio, nota, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("s1", "Maria", "Silva", "s1@teste.invalid", "11999999999", "closer", "São Paulo", "SP", "Bio de teste", 80, Date.now());
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'vendedor', ?, ?)")
    .run("u-s1", "s1@teste.invalid", "s1", Date.now());
  db.close();

  const tokVend = assinar({ id: "u-s1", role: "vendedor", entityId: "s1" });
  const tokEmpresa = assinar({ id: "u-e", role: "empresa", entityId: "e1" });

  const req = async (path, cookie) => {
    const r = await fetch(base + path, { headers: cookie ? { Cookie: cookie } : {} });
    return { status: r.status, corpo: await r.json().catch(() => null) };
  };

  // Empresa não acessa esta rota (é a prévia do próprio profissional).
  let r = await req("/professionals/me", tokEmpresa);
  assert.equal(r.status, 403);

  // Sem sessão → 401/403 (middleware de auth).
  r = await req("/professionals/me", null);
  assert.ok(r.status === 401 || r.status === 403, "sem sessão não acessa");

  // Dono profissional recebe o próprio perfil.
  r = await req("/professionals/me", tokVend);
  assert.equal(r.status, 200);
  assert.equal(r.corpo.id, "s1");
  assert.equal(r.corpo.nome, "Maria");
  assert.equal(r.corpo.whats, "11999999999");
  // Campos da ficha de empresa presentes.
  assert.ok("scoreDetalhe" in r.corpo);
  assert.ok(Array.isArray(r.corpo.pontosPositivos));
  assert.ok(Array.isArray(r.corpo.pontosNegativos));
  assert.ok(Array.isArray(r.corpo.segmentos));
  assert.ok(Array.isArray(r.corpo.certificacoes));
  assert.equal(r.corpo.ehPreviaPropria, true);
  // Métricas específicas de empresa ficam neutras (sem contexto de companyId).
  assert.equal(r.corpo.tarefasRealizadas, 0);
  assert.equal(r.corpo.parceria, null);
  // NUNCA vaza respostas cruas do quiz/DISC.
  assert.ok(!("xpRespostas" in r.corpo) || r.corpo.xpRespostas === undefined, "não vaza xpRespostas");
  assert.ok(!("disc" in r.corpo) || r.corpo.disc === undefined, "não vaza disc");
});

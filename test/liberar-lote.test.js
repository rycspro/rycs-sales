// Liberação em lote da tela Liberar (admin). Servidor real em processo à
// parte, banco temporário: nenhum dado de produção é tocado.

import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente, assinar } from "./apoio/servidor.js";

const admin = assinar({ id: "u-admin", role: "admin", entityId: "admin" });

function preparar(dbPath) {
  const db = new Database(dbPath);
  const agora = Date.now();
  for (const [id, nome] of [["s1", "Ana"], ["s2", "Bruno"]]) {
    db.prepare("INSERT INTO sellers (id, nome, email, whats, criadoEm) VALUES (?, ?, ?, '11999990000', ?)").run(id, nome, `${id}@teste.dev`, agora);
    db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'vendedor', ?, ?)").run(`u-${id}`, `${id}@teste.dev`, id, agora);
  }
  // Caixa de 100 já reservado: cada tarefa de 5 foi reservada quando entrou.
  db.prepare("INSERT INTO companies (id, nome, produto, whatsapp, saldo, saldoReservado, totalAportado, aportes, criadoEm) VALUES ('e1', 'Emp', 'X', '11988880000', 100, 100, 100, '[]', ?)").run(agora);
  const criar = (id, sellerId, status = "conferido") => db.prepare(
    "INSERT INTO submissions (id, sellerId, companyId, tipo, valor, liquido, status, criadoEm) VALUES (?, ?, 'e1', 'visita', 5, 4, ?, ?)",
  ).run(id, sellerId, status, agora);
  return { db, criar };
}

const disponivel = (db, id) => db.prepare("SELECT disponivel FROM sellers WHERE id = ?").get(id).disponivel;
const empresa = (db) => db.prepare("SELECT saldo, saldoReservado FROM companies WHERE id = 'e1'").get();
const ganhos = (db) => db.prepare("SELECT COUNT(*) n FROM platform_earnings").get().n;

test("lote: soma correta e repetir o pedido não credita de novo", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const { db, criar } = preparar(dbPath);
  t.after(() => db.close());
  const req = cliente(base);
  const ids = Array.from({ length: 10 }, (_, i) => `a${i}`);
  ids.forEach((id) => criar(id, "s1"));

  const vend = assinar({ id: "u-s1", role: "vendedor", entityId: "s1" });
  assert.equal((await req("/submissions/liberar-lote", { cookie: vend, body: { sellerId: "s1", ids } })).status, 403);

  const r = await req("/submissions/liberar-lote", { cookie: admin, body: { sellerId: "s1", ids } });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  assert.equal(r.corpo.liberadas, 10);
  assert.equal(r.corpo.liquido, 40, "10 tarefas de 4 líquidos");
  assert.equal(r.corpo.taxa, 10);
  assert.equal(r.corpo.totalDebito, 50);
  assert.equal(disponivel(db, "s1"), 40);
  assert.deepEqual(empresa(db), { saldo: 50, saldoReservado: 50 });
  assert.equal(ganhos(db), 10);

  // O mesmo clique chegando de novo, e duas vezes ao mesmo tempo.
  const [r2, r3] = await Promise.all([
    req("/submissions/liberar-lote", { cookie: admin, body: { sellerId: "s1", ids } }),
    req("/submissions/liberar-lote", { cookie: admin, body: { sellerId: "s1", ids } }),
  ]);
  for (const x of [r2, r3]) {
    assert.equal(x.status, 200);
    assert.equal(x.corpo.liberadas, 0);
    assert.equal(x.corpo.jaLiberadas, 10);
    assert.equal(x.corpo.liquido, 0);
  }
  assert.equal(disponivel(db, "s1"), 40, "nada creditado em dobro");
  assert.deepEqual(empresa(db), { saldo: 50, saldoReservado: 50 });
  assert.equal(ganhos(db), 10);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM financial_ledger WHERE tipo = 'liquidacao'").get().n, 10);
});

test("lote: tarefa já liberada é pulada, e lote inválido não libera nada", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const { db, criar } = preparar(dbPath);
  t.after(() => db.close());
  const req = cliente(base);
  criar("b1", "s1"); criar("b2", "s1"); criar("b3", "s1"); criar("c1", "s2");

  // b1 sai pela liberação individual antes do lote.
  const um = await req("/submissions/b1/liberar", { cookie: admin, body: {} });
  assert.equal(um.status, 200);
  assert.equal(disponivel(db, "s1"), 4);

  const r = await req("/submissions/liberar-lote", { cookie: admin, body: { sellerId: "s1", ids: ["b1", "b2"] } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.liberadas, 1);
  assert.equal(r.corpo.jaLiberadas, 1);
  assert.equal(r.corpo.liquido, 4);
  assert.equal(disponivel(db, "s1"), 8, "b1 não foi creditada de novo");
  assert.equal(ganhos(db), 2);

  // Tudo ou nada: tarefa de outro profissional derruba o lote inteiro.
  const misto = await req("/submissions/liberar-lote", { cookie: admin, body: { sellerId: "s1", ids: ["b3", "c1"] } });
  assert.equal(misto.status, 400);
  assert.equal(db.prepare("SELECT status FROM submissions WHERE id = 'b3'").get().status, "conferido");
  assert.equal(disponivel(db, "s1"), 8);

  // Reserva insuficiente no meio do lote também desfaz o que veio antes.
  db.prepare("UPDATE companies SET saldoReservado = 3").run();
  criar("b4", "s1");
  const semCaixa = await req("/submissions/liberar-lote", { cookie: admin, body: { sellerId: "s1", ids: ["b3", "b4"] } });
  assert.equal(semCaixa.status, 400);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM submissions WHERE status = 'liberado'").get().n, 2);
  assert.equal(disponivel(db, "s1"), 8);
  assert.equal(ganhos(db), 2);
});

test("histórico: cada lote vira uma linha, com quem liberou; antigos sem lote se agrupam", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const { db, criar } = preparar(dbPath);
  t.after(() => db.close());
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES ('u-admin', 'admin@teste.dev', 'x', 'admin', 'admin', ?)").run(Date.now());
  const req = cliente(base);

  // Liberações de antes do lote existir: sem loteId, mesmo profissional, segundos de diferença.
  const t0 = Date.now() - 86_400_000;
  for (const [i, dt] of [[1, 0], [2, 5_000], [3, 9_000]])
    db.prepare("INSERT INTO platform_earnings (id, submissionId, companyId, sellerId, bruto, taxa, liquido, criadoEm) VALUES (?, ?, 'e1', 's2', 5, 1, 4, ?)").run(`pe${i}`, `antiga${i}`, t0 + dt);

  ["h1", "h2", "h3"].forEach((id) => criar(id, "s1"));
  assert.equal((await req("/submissions/liberar-lote", { cookie: admin, body: { sellerId: "s1", ids: ["h1", "h2", "h3"] } })).status, 200);
  // Repetir não cria linha nova no histórico.
  await req("/submissions/liberar-lote", { cookie: admin, body: { sellerId: "s1", ids: ["h1", "h2", "h3"] } });

  const vend = assinar({ id: "u-s1", role: "vendedor", entityId: "s1" });
  assert.equal((await req("/admin/liberacoes", { cookie: vend })).status, 403);

  const r = await req("/admin/liberacoes", { cookie: admin });
  assert.equal(r.status, 200);
  const [lote, antigo] = r.corpo.liberacoes;
  assert.equal(r.corpo.liberacoes.length, 2);
  assert.equal(lote.profissional, "Ana");
  assert.equal(lote.quantidade, 3);
  assert.equal(lote.liquido, 12);
  assert.equal(lote.taxa, 3);
  assert.equal(lote.liberadoPor, "admin@teste.dev");
  assert.deepEqual(lote.empresas, ["Emp"]);
  assert.equal(antigo.profissional, "Bruno");
  assert.equal(antigo.quantidade, 3);
  assert.equal(antigo.liquido, 12);
});

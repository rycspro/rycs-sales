// Preços e compra avulsa dos cursos da Academy. Servidor real em processo à
// parte, banco temporário, sem Asaas e sem cobrança.

import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente, assinar } from "./apoio/servidor.js";
import { aplicarPrecosAcademy } from "../server/services/academyPrecos.js";
import { PRECOS_ACADEMY, slugAcademy } from "../shared/academy/precos.js";

const DIA = 86_400_000;

function preparar(dbPath) {
  const db = new Database(dbPath);
  db.prepare("INSERT INTO sellers (id, nome, email, whats, criadoEm) VALUES ('s1', 'Ana', 'ana@teste.dev', '11999990000', ?)").run(Date.now());
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES ('u-s1', 'ana@teste.dev', 'x', 'vendedor', 's1', ?)").run(Date.now());
  db.prepare("INSERT INTO companies (id, nome, produto, whatsapp, saldo, totalAportado, asaasCustomerId, aportes, criadoEm) VALUES ('e1', 'Emp', 'X', '11988880000', 0, 0, 'cus_s1', '[]', ?)").run(Date.now());
  return db;
}

test("preços: aplica uma vez e não sobrescreve preço editado pelo admin", () => {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE courses (id TEXT, slug TEXT, companyId TEXT, gratuito INTEGER, preco REAL, atualizadoEm INTEGER)");
  for (let n = 1; n <= 24; n++) db.prepare("INSERT INTO courses VALUES (?, ?, '', ?, 0, 0)").run(String(n), slugAcademy(n), n === 1 ? 1 : 0);
  db.prepare("UPDATE courses SET preco = 150 WHERE id = '3'").run();
  aplicarPrecosAcademy(db, () => 1);
  const c = (id) => db.prepare("SELECT gratuito, preco FROM courses WHERE id = ?").get(id);
  assert.deepEqual(c("1"), { gratuito: 1, preco: 0 });
  assert.deepEqual(c("21"), { gratuito: 1, preco: 0 });
  assert.deepEqual(c("2"), { gratuito: 0, preco: PRECOS_ACADEMY[2] });
  assert.equal(c("3").preco, 150, "preço do admin fica");
  assert.equal(aplicarPrecosAcademy(db, () => 2), 0, "segunda rodada não muda nada");
  db.close();
});

test("compra de curso: conteúdo fechado, webhook libera uma vez, estorno tira o acesso", async (t) => {
  const { base, dbPath } = await subirServidor(t, { ASAAS_WEBHOOK_TOKEN: "tok" });
  const db = preparar(dbPath);
  t.after(() => db.close());
  const req = cliente(base);
  const vend = assinar({ id: "u-s1", role: "vendedor", entityId: "s1" });
  const id = (n) => db.prepare("SELECT id FROM courses WHERE slug = ?").get(slugAcademy(n)).id;

  const cat = (await req("/courses", { cookie: vend })).corpo.cursos;
  const doCat = (n) => cat.find((c) => c.slug === slugAcademy(n));
  assert.equal(doCat(1).gratuito, true);
  assert.equal(doCat(21).gratuito, true);
  assert.equal(doCat(2).preco, 97);
  assert.equal(doCat(2).acesso, false);
  assert.equal(cat.filter((c) => /^sales-academy-134h/.test(c.slug) && !c.gratuito && !(c.preco > 0)).length, 0, "nenhum curso pago sem preço");

  const fechado = (await req(`/courses/${id(2)}`, { cookie: vend })).corpo;
  assert.equal(fechado.acesso, false);
  const aulas = fechado.curso.modulos.flatMap((m) => m.aulas);
  assert.ok(aulas.length > 0 && aulas.every((a) => a.conteudo === "" && a.titulo), "sumário sim, texto não");
  assert.equal((await req(`/courses/${id(2)}/lessons/${aulas[0].id}/complete`, { cookie: vend, body: {} })).status, 402);
  assert.equal((await req(`/courses/${id(2)}/comprar`, { cookie: vend, body: {} })).status, 503, "sem Asaas não gera cobrança");

  const gratis = (await req(`/courses/${id(1)}`, { cookie: vend })).corpo;
  assert.equal(gratis.acesso, true);
  assert.ok(gratis.curso.modulos[0].aulas[0].conteudo.length > 100);

  db.prepare("INSERT INTO course_purchases (id, courseId, sellerId, valor, status, asaasId, criadoEm) VALUES ('cp1', ?, 's1', 97, 'pendente', 'pay_c1', ?)").run(id(2), Date.now());
  const hook = (event) => req("/payments/webhook", {
    headers: { "asaas-access-token": "tok" },
    body: { event, payment: { id: "pay_c1", customer: "cus_s1", value: 97, externalReference: "curso:cp1" } },
  });
  assert.equal((await hook("PAYMENT_RECEIVED")).corpo.resultado, "paga");
  assert.equal((await hook("PAYMENT_CONFIRMED")).corpo.resultado, "ja_processado");
  assert.equal(db.prepare("SELECT saldo FROM companies WHERE id = 'e1'").get().saldo, 0, "não vira depósito de empresa");

  const aberto = (await req(`/courses/${id(2)}`, { cookie: vend })).corpo;
  assert.equal(aberto.acesso, true);
  assert.ok(aberto.curso.modulos[0].aulas[0].conteudo.length > 100);
  assert.equal((await req(`/courses/${id(2)}/lessons/${aulas[0].id}/complete`, { cookie: vend, body: {} })).status, 200);
  assert.ok(db.prepare("SELECT COUNT(*) n FROM notifications WHERE userId = 'u-s1' AND tipo = 'academy'").get().n >= 1);

  assert.equal((await hook("PAYMENT_REFUNDED")).corpo.resultado, "reembolsada");
  assert.equal((await req(`/courses/${id(2)}`, { cookie: vend })).corpo.acesso, false);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM course_lesson_progress WHERE sellerId = 's1'").get().n, 1, "progresso guardado");
});

test("plano: Premium inclui Challenger e nicho; Pro só nicho; sem plano, nada", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const db = preparar(dbPath);
  t.after(() => db.close());
  const req = cliente(base);
  const vend = assinar({ id: "u-s1", role: "vendedor", entityId: "s1" });
  const admin = assinar({ id: "u-admin", role: "admin", entityId: "admin" });
  const acesso = async (n) => (await req("/courses", { cookie: vend })).corpo.cursos.find((c) => c.slug === slugAcademy(n)).acesso;

  assert.equal(await acesso(17), false);
  await req("/admin/profissionais/s1/plano", { cookie: admin, body: { plano: "pro", ate: Date.now() + 30 * DIA, motivo: "teste" } });
  assert.equal(await acesso(17), true, "nicho no Pro");
  assert.equal(await acesso(12), false, "Challenger não está no Pro");
  await req("/admin/profissionais/s1/plano", { cookie: admin, method: "DELETE", body: { motivo: "troca" } });
  await req("/admin/profissionais/s1/plano", { cookie: admin, body: { plano: "premium", ate: Date.now() + 30 * DIA, motivo: "teste" } });
  assert.equal(await acesso(12), true, "Challenger no Premium");
  assert.equal(await acesso(2), false, "curso comum continua pago");
  await req("/admin/profissionais/s1/plano", { cookie: admin, method: "DELETE", body: { motivo: "fim" } });
  assert.equal(await acesso(12), false, "acesso pelo plano acaba com o plano");
});

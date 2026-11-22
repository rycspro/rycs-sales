import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { criarAgenda, criarSchemaAgenda } from "../server/services/agendaComercial.js";
import { PERGUNTAS_QUIZ, registrarRespostas } from "../shared/quizDiagnostico.js";

const AGORA = 1_800_000_000_000;
const MIN = 60_000;
const HORA = 60 * MIN;
const respostasValidas = () => Object.fromEntries(PERGUNTAS_QUIZ.map((p) => [p.id, p.opcoes[0].id]));

function contexto(t) {
  const db = new Database(":memory:");
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT, entityId TEXT);
    CREATE TABLE sellers (id TEXT PRIMARY KEY, nome TEXT, status TEXT, perfil TEXT);
    INSERT INTO sellers VALUES ('s1','Carla Closer','aprovado','closer'), ('s2','Gabi Closer','aprovado','closer'),
      ('s3','Eva SDR','aprovado','sdr'), ('s4','Pendente','triagem','closer');
    INSERT INTO users VALUES ('c1','vendedor','s1'), ('c2','vendedor','s2'), ('sdr','vendedor','s3'),
      ('pend','vendedor','s4'), ('admin','admin',NULL), ('emp','empresa','e1');`);
  criarSchemaAgenda(db);
  let relogio = AGORA;
  const agenda = criarAgenda(db, () => relogio);
  const admin = { id: "admin", role: "admin" }, c1 = { id: "c1", role: "vendedor" }, c2 = { id: "c2", role: "vendedor" };
  agenda.liberar(admin, "c1", true);
  agenda.liberar(admin, "c2", true);
  const abrir = (user = c1, inicio = AGORA + 2 * HORA, extra = {}) => agenda.publicar(user, { inicio, duracao: 30, ...extra });
  const reservar = (inicio = AGORA + 2 * HORA, email = "contato@empresa.test", extra = {}) => agenda.reservar({
    inicio, fim: inicio + 30 * MIN, empresa: "Empresa Teste", nome: "Contato Teste", email,
    telefone: "(11) 99999-0000", aceite: true, respostas: respostasValidas(), ...extra,
  });
  t.after(() => db.close());
  return { db, agenda, admin, c1, c2, abrir, reservar, avancar: (ms) => { relogio += ms; } };
}
const status = (s) => (e) => e.status === s;

test("só o admin libera; profissional pendente não recebe acesso; quem não foi liberado não vê a agenda", (t) => {
  const { agenda, admin, c1 } = contexto(t);
  assert.throws(() => agenda.liberar(c1, "c2", false), status(403));
  assert.throws(() => agenda.liberar(admin, "pend", true), status(400));
  assert.throws(() => agenda.liberar(admin, "nao-existe", true), status(404));
  assert.throws(() => agenda.painel({ id: "emp", role: "empresa" }), status(403));
  assert.throws(() => agenda.painel({ id: "sdr", role: "vendedor" }), status(403));
  agenda.liberar(admin, "sdr", true);
  assert.equal(agenda.painel({ id: "sdr", role: "vendedor" }).admin, false);
});

test("publicação recusa sobreposição do mesmo closer, aceita adjacente e outro closer, e cria sequências", (t) => {
  const { agenda, c1, c2, abrir } = contexto(t);
  abrir();
  assert.throws(() => abrir(c1, AGORA + 2 * HORA + 15 * MIN), status(409));
  abrir(c1, AGORA + 2 * HORA + 30 * MIN);
  abrir(c2);
  assert.throws(() => abrir(c1, AGORA + 5 * HORA, { closerId: "c2" }), status(403));
  assert.throws(() => abrir(c1, AGORA + 10 * MIN), status(409));
  // Sequência das 4h às 6h: 4 horários; um já ocupado no meio seria pulado.
  const lote = agenda.publicar(c1, { inicio: AGORA + 4 * HORA, fim: AGORA + 6 * HORA, duracao: 30 });
  assert.deepEqual(lote, { criados: 4, ocupados: 0, passados: 0 });
  const repetido = agenda.publicar(c1, { inicio: AGORA + 3 * HORA, fim: AGORA + 5 * HORA, duracao: 30 });
  assert.deepEqual(repetido, { criados: 2, ocupados: 2, passados: 0 });
  // Mesmo horário de dois closers aparece uma vez só no quiz.
  const publicos = agenda.horariosPublicos();
  assert.equal(publicos.filter((h) => h.inicio === AGORA + 2 * HORA).length, 1);
});

test("endpoint público expõe só início e fim; reserva é única e grava o texto das respostas", (t) => {
  const { agenda, c1, c2, abrir, reservar } = contexto(t);
  abrir();
  assert.deepEqual(Object.keys(agenda.horariosPublicos()[0]).sort(), ["fim", "inicio"]);
  const r = reservar();
  assert.equal(r.closer, "Carla");
  assert.equal(agenda.horariosPublicos().length, 0);
  assert.throws(() => reservar(undefined, "outra@empresa.test"), status(409));
  const [reuniao] = agenda.painel(c1).reunioes;
  assert.equal(reuniao.respostas.length, PERGUNTAS_QUIZ.length);
  assert.equal(reuniao.respostas[1].pergunta, PERGUNTAS_QUIZ[1].titulo);
  assert.equal(reuniao.respostas[1].resposta, PERGUNTAS_QUIZ[1].opcoes[0].texto);
  assert.equal(reuniao.quizVersao.length > 0, true);
  assert.equal(agenda.painel(c2).reunioes.length, 0);
  assert.throws(() => agenda.status(c2, r.id, "cancelada"), status(403));
});

test("dois closers no mesmo horário: cada reserva vai para um, sem dupla reserva", (t) => {
  const { agenda, c1, c2, abrir, reservar } = contexto(t);
  abrir(c1);
  abrir(c2);
  const a = reservar(undefined, "a@empresa.test");
  const b = reservar(undefined, "b@empresa.test");
  assert.notEqual(a.closer, b.closer);
  assert.throws(() => reservar(undefined, "c@empresa.test"), status(409));
  assert.equal(agenda.painel(c1).reunioes.length + agenda.painel(c2).reunioes.length, 2);
});

test("cancelar preserva o histórico; o horário só volta ao quiz quando o closer reabre", (t) => {
  const { agenda, c1, abrir, reservar } = contexto(t);
  abrir();
  const r = reservar();
  const horarioId = agenda.painel(c1).reunioes[0].horarioId;
  assert.throws(() => agenda.retirar(c1, horarioId), status(409));
  assert.throws(() => agenda.status(c1, r.id, "realizada"), status(400));
  assert.deepEqual(agenda.status(c1, r.id, "cancelada"), { ok: true, reaberto: false });
  assert.equal(agenda.horariosPublicos().length, 0);
  assert.equal(agenda.painel(c1).reunioes[0].status, "cancelada");
  assert.throws(() => agenda.status(c1, r.id, "realizada"), status(409));
  // Reabrindo: o mesmo horário volta e pode ser reservado de novo.
  abrir(c1, AGORA + 3 * HORA);
  const r2 = reservar(AGORA + 3 * HORA, "nova@empresa.test");
  assert.deepEqual(agenda.status(c1, r2.id, "cancelada", { reabrir: true }), { ok: true, reaberto: true });
  assert.equal(agenda.horariosPublicos().length, 1);
  reservar(AGORA + 3 * HORA, "outra@empresa.test");
  assert.equal(agenda.painel(c1).reunioes.length, 3);
});

test("resultado só depois do horário; realizada e não compareceu ficam registradas", (t) => {
  const { agenda, c1, abrir, reservar, avancar } = contexto(t);
  abrir();
  abrir(c1, AGORA + 3 * HORA);
  const a = reservar(undefined, "a@empresa.test");
  const b = reservar(AGORA + 3 * HORA, "b@empresa.test");
  avancar(4 * HORA);
  agenda.status(c1, a.id, "realizada");
  agenda.status(c1, b.id, "nao_compareceu");
  const porId = Object.fromEntries(agenda.painel(c1).reunioes.map((r) => [r.id, r.status]));
  assert.deepEqual(porId, { [a.id]: "realizada", [b.id]: "nao_compareceu" });
});

test("revogar o closer tira os horários do quiz e o acesso; o admin segue vendo o histórico", (t) => {
  const { agenda, admin, c1, abrir, reservar } = contexto(t);
  abrir();
  abrir(c1, AGORA + 3 * HORA);
  reservar();
  assert.equal(agenda.liberar(admin, "c1", false).reunioesFuturas, 1);
  assert.equal(agenda.horariosPublicos().length, 0);
  assert.throws(() => reservar(AGORA + 3 * HORA, "x@empresa.test"), status(409));
  assert.throws(() => agenda.painel(c1), status(403));
  const visaoAdmin = agenda.painel(admin);
  assert.equal(visaoAdmin.reunioes.length, 1);
  assert.equal(visaoAdmin.reunioes[0].closerAtivo, false);
});

test("dados inválidos, respostas incompletas e e-mail com conversa futura são recusados", (t) => {
  const { agenda, c1, abrir, reservar } = contexto(t);
  abrir();
  abrir(c1, AGORA + 3 * HORA);
  const incompleto = respostasValidas();
  delete incompleto.verba;
  assert.throws(() => reservar(undefined, undefined, { respostas: incompleto }), status(400));
  assert.throws(() => reservar(undefined, undefined, { respostas: { ...respostasValidas(), verba: "inventada" } }), status(400));
  assert.throws(() => reservar(undefined, "sem-arroba"), status(400));
  assert.throws(() => reservar(undefined, undefined, { telefone: "1234" }), status(400));
  assert.throws(() => reservar(undefined, undefined, { aceite: false }), status(400));
  reservar();
  assert.throws(() => reservar(AGORA + 3 * HORA), status(409));
  assert.equal(registrarRespostas(null), null);
});

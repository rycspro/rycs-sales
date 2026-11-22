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
    CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT, entityId TEXT, email TEXT, criadoEm INTEGER DEFAULT 0);
    CREATE TABLE sellers (id TEXT PRIMARY KEY, nome TEXT, status TEXT, perfil TEXT);
    INSERT INTO sellers VALUES ('s1','Carla Closer','aprovado','closer'), ('s2','Gabi Closer','aprovado','closer'),
      ('s3','Eva SDR','aprovado','sdr'), ('s4','Pendente','triagem','closer');
    INSERT INTO users (id, role, entityId, email) VALUES ('c1','vendedor','s1','c1@t'), ('c2','vendedor','s2','c2@t'), ('sdr','vendedor','s3','sdr@t'),
      ('pend','vendedor','s4','pend@t'), ('admin','admin',NULL,'admin@rycs.test'), ('emp','empresa','e1','emp@t');`);
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
  assert.ok(reuniao.respostas[1].resposta.startsWith(PERGUNTAS_QUIZ[1].opcoes[0].texto));
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
  delete incompleto.ticket;
  assert.throws(() => reservar(undefined, undefined, { respostas: incompleto }), status(400));
  assert.throws(() => reservar(undefined, undefined, { respostas: { ...respostasValidas(), ticket: "inventada" } }), status(400));
  assert.throws(() => reservar(undefined, "sem-arroba"), status(400));
  assert.throws(() => reservar(undefined, undefined, { telefone: "1234" }), status(400));
  assert.throws(() => reservar(undefined, undefined, { aceite: false }), status(400));
  reservar();
  assert.throws(() => reservar(AGORA + 3 * HORA), status(409));
  assert.equal(registrarRespostas(null), null);
});

test("pré-cadastro: cria com token, atualiza o mesmo e recusa token errado", (t) => {
  const { agenda } = contexto(t);
  const dados = { empresa: "Empresa Pré", nome: "Contato", email: "pre@empresa.test", telefone: "11988887777", aceite: true, respostas: respostasValidas() };
  const p = agenda.salvarPrecadastro(dados);
  assert.ok(p.id && p.token.length >= 24);
  assert.deepEqual(agenda.salvarPrecadastro({ ...dados, nome: "Contato Novo", id: p.id, token: p.token }), p);
  assert.equal(agenda.lerPrecadastro(p.id, p.token).nome, "Contato Novo");
  assert.throws(() => agenda.lerPrecadastro(p.id, "token-errado"), status(404));
  assert.throws(() => agenda.salvarPrecadastro({ ...dados, respostas: {} }), status(400));
});

test("reserva pelo pré-cadastro exige WhatsApp confirmado e grava o número verificado", (t) => {
  const { agenda, admin, c1, abrir } = contexto(t);
  abrir();
  const p = agenda.salvarPrecadastro({ empresa: "Empresa Pré", nome: "Contato", email: "pre@empresa.test", telefone: "11988887777", aceite: true, respostas: respostasValidas() });
  const corpo = { ...p, inicio: AGORA + 2 * HORA, fim: AGORA + 2 * HORA + 30 * MIN };
  assert.equal(agenda.painel(admin).precadastros.length, 1);
  assert.throws(() => agenda.reservarPrecadastro(corpo, { disponivel: true, verificado: false }), (e) => e.codigo === "WHATSAPP_NAO_VERIFICADO");
  assert.throws(() => agenda.reservarPrecadastro({ ...corpo, token: "x" }, { disponivel: true, verificado: true, numero: "5511977776666" }), status(404));
  const r = agenda.reservarPrecadastro(corpo, { disponivel: true, verificado: true, numero: "5511977776666" });
  const [reuniao] = agenda.painel(c1).reunioes;
  assert.equal(reuniao.id, r.id);
  assert.equal(reuniao.whatsVerificado, true);
  assert.equal(reuniao.telefone, "+5511977776666");
  assert.equal(agenda.painel(admin).precadastros.length, 0);
  abrir(c1, AGORA + 3 * HORA);
  assert.throws(() => agenda.reservarPrecadastro({ ...corpo, inicio: AGORA + 3 * HORA, fim: AGORA + 3 * HORA + 30 * MIN }, { disponivel: true, verificado: true, numero: "5511977776666" }), status(409));
});

test("sem verificação ligada no servidor, a reserva segue e fica marcada como não verificada", (t) => {
  const { agenda, c1, abrir } = contexto(t);
  abrir();
  const p = agenda.salvarPrecadastro({ empresa: "Empresa Pré", nome: "Contato", email: "pre@empresa.test", telefone: "11988887777", aceite: true, respostas: respostasValidas() });
  agenda.reservarPrecadastro({ ...p, inicio: AGORA + 2 * HORA, fim: AGORA + 2 * HORA + 30 * MIN }, { disponivel: false });
  const [reuniao] = agenda.painel(c1).reunioes;
  assert.equal(reuniao.whatsVerificado, false);
  assert.equal(reuniao.telefone, "11988887777");
});

test("resultado da venda só depois de realizada e alimenta o aprendizado por resposta", (t) => {
  const { agenda, admin, c1, c2, abrir, avancar } = contexto(t);
  abrir();
  const base = { nome: "Contato", telefone: "11988887777", aceite: true, respostas: respostasValidas() };
  const p1 = agenda.salvarPrecadastro({ ...base, empresa: "Fecha", email: "fecha@empresa.test" });
  agenda.salvarPrecadastro({ ...base, empresa: "Desistiu", email: "desistiu@empresa.test" });
  const r = agenda.reservarPrecadastro({ ...p1, inicio: AGORA + 2 * HORA, fim: AGORA + 2 * HORA + 30 * MIN }, { disponivel: false });
  assert.throws(() => agenda.resultadoVenda(c1, r.id, "fechou"), status(409));
  avancar(3 * HORA);
  agenda.status(c1, r.id, "realizada");
  assert.throws(() => agenda.resultadoVenda(c2, r.id, "fechou"), status(403));
  assert.throws(() => agenda.resultadoVenda(c1, r.id, "talvez"), status(400));
  agenda.resultadoVenda(c1, r.id, "fechou");
  const a = agenda.painel(admin).aprendizado;
  assert.equal(a.diagnosticos, 2);
  const primeira = a.perguntas[0].opcoes[0];
  assert.deepEqual([primeira.total, primeira.agendaram, primeira.compareceram, primeira.fecharam], [2, 1, 1, 1]);
  assert.equal(a.perguntas[0].opcoes[1].total, 0);
});

// AGORA = sexta-feira, 15/01/2027, 05:00 em Brasília (08:00 UTC).
test("agenda padrão da plataforma: seg a sex, 8h às 20h no horário de Brasília, gerada uma vez", (t) => {
  const { agenda } = contexto(t);
  assert.equal(agenda.garantirAgendaPadrao("admin@rycs.test"), "admin");
  assert.equal(agenda.gerarDisponibilidade(), 240); // 10 dias úteis em 14 dias × 24 reuniões de 30 min
  assert.equal(agenda.gerarDisponibilidade(), 0);
  assert.equal(agenda.garantirAgendaPadrao("admin@rycs.test"), null);
  const publicos = agenda.horariosPublicos();
  assert.equal(publicos.length, 240);
  assert.equal(new Date(publicos[0].inicio).toISOString(), "2027-01-15T11:00:00.000Z"); // 8h em Brasília
  assert.equal(new Date(publicos.at(-1).inicio).toISOString(), "2027-01-28T22:30:00.000Z"); // 19h30 da quinta
  const fimDeSemana = publicos.filter((h) => [0, 6].includes(new Date(h.inicio - 3 * HORA).getUTCDay()));
  assert.equal(fimDeSemana.length, 0);
});

test("admin atende como Equipe RYCS e transfere a reunião; o horário dele volta a ficar livre", (t) => {
  const { agenda, admin, c1, c2, abrir, reservar } = contexto(t);
  agenda.publicar(admin, { closerId: "admin", inicio: AGORA + 2 * HORA, duracao: 30 });
  const r = reservar();
  assert.equal(agenda.painel(admin).reunioes[0].closer, "Equipe RYCS");
  assert.throws(() => agenda.transferir(c1, r.id, "c1"), status(403));
  assert.throws(() => agenda.transferir(admin, r.id, "sdr"), status(400));
  abrir(c2);
  reservar(undefined, "outra@empresa.test");
  assert.throws(() => agenda.transferir(admin, r.id, "c2"), status(409));
  assert.deepEqual(agenda.transferir(admin, r.id, "c1"), { ok: true });
  assert.equal(agenda.painel(c1).reunioes[0].id, r.id);
  assert.equal(agenda.horariosPublicos().length, 1);
  assert.throws(() => agenda.transferir(admin, r.id, "c1"), status(400));
});

test("closer define a própria disponibilidade semanal; mudar ou desativar limpa só os horários livres", (t) => {
  const { agenda, c1, c2, reservar } = contexto(t);
  assert.throws(() => agenda.salvarDisponibilidade(c1, { closerId: "c2", dias: [1], inicio: "09:00", fim: "10:00", duracao: 30 }), status(403));
  assert.throws(() => agenda.salvarDisponibilidade(c1, { dias: [], inicio: "09:00", fim: "10:00", duracao: 30 }), status(400));
  assert.throws(() => agenda.salvarDisponibilidade(c1, { dias: [1], inicio: "10:00", fim: "10:15", duracao: 30 }), status(400));
  assert.equal(agenda.salvarDisponibilidade(c1, { dias: [1], inicio: "09:00", fim: "10:00", duracao: 30 }).criados, 4); // 2 segundas × 2
  const segunda = agenda.horariosPublicos()[0];
  reservar(segunda.inicio);
  assert.equal(agenda.salvarDisponibilidade(c1, { dias: [2], inicio: "14:00", fim: "15:00", duracao: 60 }).criados, 2);
  assert.equal(agenda.painel(c1).horarios.length, 2); // só as terças; a reunião da segunda continua
  assert.equal(agenda.painel(c1).reunioes.length, 1);
  agenda.desativarDisponibilidade(c1);
  assert.equal(agenda.horariosPublicos().length, 0);
  assert.equal(agenda.painel(c2).disponibilidade.length, 0);
});

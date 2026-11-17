import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";
import {
  ITENS_COM, COM_VERSAO, COM_TOTAL, ORDEM_COMPETENCIAS, COM_QUESTOES_POR_COMPETENCIA,
  calcularResultado, validarRespostas, contarRespondidos, itensPublicos,
  montarRelatorio, montarRevisao,
} from "../shared/comunicacaoProfissional.js";

// Gabarito oficial e um conjunto de respostas todas corretas.
const GABARITO = Object.fromEntries(ITENS_COM.map((i) => [i.id, i.correta]));
// Uma letra errada garantida para cada questão (a primeira != correta).
const erradaPara = (item) => item.alternativas.map((a) => a.id).find((l) => l !== item.correta);

// ─────────────────────────────── Algoritmo ───────────────────────────────
test("Comunicação: 20 questões, 4 alternativas, 1 correta, 5 competências × 4", () => {
  assert.equal(ITENS_COM.length, 20);
  assert.equal(COM_TOTAL, 20);
  assert.equal(ORDEM_COMPETENCIAS.length, 5);
  for (const item of ITENS_COM) {
    assert.equal(item.alternativas.length, 4, `questão ${item.id} deve ter 4 alternativas`);
    assert.ok(item.alternativas.some((a) => a.id === item.correta), `correta de ${item.id} deve existir`);
  }
  for (const c of ORDEM_COMPETENCIAS) {
    assert.equal(
      ITENS_COM.filter((i) => i.competencia === c).length,
      COM_QUESTOES_POR_COMPETENCIA,
      `competência ${c} deve ter ${COM_QUESTOES_POR_COMPETENCIA} questões`
    );
  }
});

test("Comunicação: gabarito 100% correto dá 20 acertos e 100%", () => {
  const res = calcularResultado(GABARITO);
  assert.equal(res.acertos, 20);
  assert.equal(res.percentual, 100);
  for (const c of ORDEM_COMPETENCIAS) {
    assert.equal(res.competencias[c].acertos, 4);
    assert.equal(res.competencias[c].percentual, 100);
  }
});

test("Comunicação: cálculo de acertos parcial e por competência", () => {
  // Erra as 4 questões da competência "clareza"; acerta o resto.
  const respostas = { ...GABARITO };
  for (const item of ITENS_COM) {
    if (item.competencia === "clareza") respostas[item.id] = erradaPara(item);
  }
  const res = calcularResultado(respostas);
  assert.equal(res.acertos, 16);
  assert.equal(res.percentual, 80);
  assert.equal(res.competencias.clareza.acertos, 0);
  assert.equal(res.competencias.clareza.percentual, 0);
  assert.equal(res.competencias.escuta.acertos, 4);
});

test("Comunicação: relatório traz competências, destaques e revisão coerente", () => {
  const respostas = { ...GABARITO };
  // Deixa 'dificeis' como a de menos acertos (erra as 4) e mantém o resto certo.
  for (const item of ITENS_COM) {
    if (item.competencia === "dificeis") respostas[item.id] = erradaPara(item);
  }
  const rel = montarRelatorio(calcularResultado(respostas), respostas);
  assert.equal(rel.competencias.length, 5);
  assert.ok(rel.maisAcertos.length >= 1, "há competências com mais acertos");
  assert.ok(rel.desenvolver.includes("dificeis"), "a de menos acertos entra em desenvolver");
  assert.equal(rel.revisao.length, 20);
  assert.ok(/não é um percentil|não é.*certificação/i.test(rel.notaGlobal));
  // A revisão marca acerto/erro corretamente.
  const revDificeis = rel.revisao.filter((q) => q.competencia === "dificeis");
  assert.ok(revDificeis.every((q) => q.acertou === false));
});

test("Comunicação: itens públicos não revelam gabarito nem competência", () => {
  const pub = itensPublicos();
  assert.equal(pub.length, 20);
  for (const it of pub) {
    assert.ok(it.id && it.enunciado && Array.isArray(it.alternativas) && it.alternativas.length === 4);
    assert.ok(!("correta" in it), "não pode vazar a resposta correta");
    assert.ok(!("justificativa" in it), "não pode vazar a justificativa");
    assert.ok(!("competencia" in it), "não pode vazar a competência");
    for (const a of it.alternativas) assert.ok(a.id && a.texto);
  }
});

test("Comunicação: revisão só revela gabarito quando montada (pós-conclusão)", () => {
  const rev = montarRevisao(GABARITO);
  assert.equal(rev.length, 20);
  for (const q of rev) {
    assert.ok(q.correta && q.justificativa, "revisão inclui gabarito e justificativa");
    assert.equal(q.acertou, true);
  }
});

test("Comunicação: validação exige as 20 respostas com letra válida", () => {
  assert.equal(validarRespostas(GABARITO).ok, true);
  assert.equal(contarRespondidos(GABARITO), 20);

  const faltaUm = { ...GABARITO }; delete faltaUm.q01;
  assert.equal(validarRespostas(faltaUm).codigo, "INCOMPLETO");

  const letraInvalida = { ...GABARITO, q02: "Z" };
  assert.equal(validarRespostas(letraInvalida).codigo, "INCOMPLETO");
  assert.equal(contarRespondidos(letraInvalida), 19, "letra inválida não conta");

  const questaoDesconhecida = { ...GABARITO, q99: "A" };
  assert.equal(validarRespostas(questaoDesconhecida).codigo, "ITEM_INVALIDO");
});

// ─────────────────────────────── Rotas / autorização ─────────────────────
test("Comunicação: rotas exigem dono, retomam, não vazam gabarito e são idempotentes", async (t) => {
  const { base, dbPath } = await subirServidor(t, { COMUNICACAO_DISPONIVEL: "1" });

  const db = new Database(dbPath);
  const criarSeller = (id, email) => {
    db.prepare("INSERT INTO sellers (id, nome, email, whats, criadoEm) VALUES (?, ?, ?, ?, ?)")
      .run(id, "Teste " + id, email, "11999999999", Date.now());
    db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'vendedor', ?, ?)")
      .run("u-" + id, email, id, Date.now());
  };
  criarSeller("s1", "s1@teste.invalid");
  criarSeller("s2", "s2@teste.invalid");
  db.close();

  const tok1 = assinar({ id: "u-s1", role: "vendedor", entityId: "s1" });
  const tok2 = assinar({ id: "u-s2", role: "vendedor", entityId: "s2" });
  const tokEmpresa = assinar({ id: "u-e", role: "empresa", entityId: "e1" });

  const req = async (path, { body, cookie, method } = {}) => {
    const r = await fetch(base + path, {
      method: method || (body !== undefined ? "POST" : "GET"),
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, corpo: await r.json().catch(() => null) };
  };

  // Empresa não acessa.
  let r = await req("/comunicacao", { cookie: tokEmpresa });
  assert.equal(r.status, 403);

  // Estado inicial.
  r = await req("/comunicacao", { cookie: tok1 });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.disponivel, true);
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.equal(r.corpo.competencias.length, 5);
  assert.ok(!r.corpo.itens, "sem tentativa não retorna itens");

  // Inicia: 20 itens sem gabarito.
  r = await req("/comunicacao/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.itens.length, 20);
  const vazou = r.corpo.itens.some((it) => "correta" in it || "justificativa" in it || "competencia" in it);
  assert.equal(vazou, false, "o cliente nunca recebe o gabarito");

  // Concluir incompleto → 400.
  r = await req("/comunicacao/concluir", { cookie: tok1, body: { respostas: { q01: "C" } } });
  assert.equal(r.status, 400);

  // Salva progresso parcial e RETOMA.
  r = await req("/comunicacao/progresso", { cookie: tok1, body: { respostas: { q01: "C", q02: "A" } } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.progresso, 2);

  r = await req("/comunicacao", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "andamento");
  assert.equal(r.corpo.respostas.q01, "C");
  assert.ok(r.corpo.itens && !("correta" in r.corpo.itens[0]), "itens em andamento sem gabarito");

  // Reiniciar retoma a mesma tentativa.
  r = await req("/comunicacao/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.corpo.retomada, true);

  // Conclui completo com o gabarito → 20/20.
  r = await req("/comunicacao/concluir", { cookie: tok1, body: { respostas: GABARITO } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado.acertos, 20);
  assert.equal(r.corpo.resultado.percentual, 100);
  assert.equal(r.corpo.resultado.versao, COM_VERSAO);
  assert.equal(r.corpo.relatorio.revisao.length, 20);
  assert.ok(r.corpo.relatorio.revisao[0].correta, "revisão pós-conclusão traz gabarito");

  // Idempotente.
  r = await req("/comunicacao/concluir", { cookie: tok1, body: { respostas: GABARITO } });
  assert.equal(r.corpo.jaConcluido, true);

  // Não pode reiniciar/alterar após concluir.
  r = await req("/comunicacao/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.status, 409);
  r = await req("/comunicacao/progresso", { cookie: tok1, body: { respostas: { q01: "A" } } });
  assert.equal(r.status, 409, "não altera respostas após conclusão");

  // GET reflete concluído, com resultado e relatório.
  r = await req("/comunicacao", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "concluido");
  assert.equal(r.corpo.resultado.acertos, 20);

  // Compartilhamento privado por padrão → liga.
  assert.equal(r.corpo.tentativa.compartilhar, false);
  r = await req("/comunicacao/compartilhamento", { cookie: tok1, body: { compartilhar: true } });
  assert.equal(r.corpo.compartilhar, true);

  // Isolamento: profissional 2 não vê a tentativa do 1.
  r = await req("/comunicacao", { cookie: tok2 });
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.ok(!r.corpo.resultado);
});

test("Comunicação: feature flag desligada mantém a avaliação fora do ar", async (t) => {
  const { base, dbPath } = await subirServidor(t, { COMUNICACAO_DISPONIVEL: "0" });

  const db = new Database(dbPath);
  db.prepare("INSERT INTO sellers (id, nome, email, whats, criadoEm) VALUES (?, ?, ?, ?, ?)")
    .run("s9", "Teste s9", "s9@teste.invalid", "11999999999", Date.now());
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'vendedor', ?, ?)")
    .run("u-s9", "s9@teste.invalid", "s9", Date.now());
  db.close();

  const tok = assinar({ id: "u-s9", role: "vendedor", entityId: "s9" });
  const req = async (path, body) => {
    const r = await fetch(base + path, {
      method: body !== undefined ? "POST" : "GET",
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), Cookie: tok },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, corpo: await r.json().catch(() => null) };
  };

  let r = await req("/comunicacao");
  assert.equal(r.corpo.disponivel, false);

  r = await req("/comunicacao/iniciar", {});
  assert.equal(r.status, 403);
});

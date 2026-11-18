import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";
import {
  ITENS_JUL, JUL_VERSAO, JUL_TOTAL, ORDEM_COMPETENCIAS, JUL_QUESTOES_POR_COMPETENCIA,
  calcularResultado, validarRespostas, contarRespondidos, itensPublicos,
  montarRelatorio, montarRevisao,
} from "../shared/julgamentoSituacional.js";

const GABARITO = Object.fromEntries(ITENS_JUL.map((i) => [i.id, i.correta]));
const erradaPara = (item) => item.alternativas.map((a) => a.id).find((l) => l !== item.correta);

// ─────────────────────────────── Algoritmo ───────────────────────────────
test("Julgamento: 25 situações, 4 alternativas, 1 preferencial, 5 competências × 5", () => {
  assert.equal(ITENS_JUL.length, 25);
  assert.equal(JUL_TOTAL, 25);
  assert.equal(ORDEM_COMPETENCIAS.length, 5);
  for (const item of ITENS_JUL) {
    assert.equal(item.alternativas.length, 4, `questão ${item.id} deve ter 4 alternativas`);
    assert.ok(item.alternativas.some((a) => a.id === item.correta), `preferencial de ${item.id} deve existir`);
    assert.ok(item.justificativa && item.justificativa.length > 0, `justificativa de ${item.id}`);
  }
  for (const c of ORDEM_COMPETENCIAS) {
    assert.equal(
      ITENS_JUL.filter((i) => i.competencia === c).length,
      JUL_QUESTOES_POR_COMPETENCIA,
      `competência ${c} deve ter ${JUL_QUESTOES_POR_COMPETENCIA} questões`
    );
  }
});

test("Julgamento: gabarito 100% correto dá 25 acertos e 100%", () => {
  const res = calcularResultado(GABARITO);
  assert.equal(res.acertos, 25);
  assert.equal(res.percentual, 100);
  for (const c of ORDEM_COMPETENCIAS) {
    assert.equal(res.competencias[c].acertos, 5);
    assert.equal(res.competencias[c].percentual, 100);
  }
});

test("Julgamento: cálculo parcial e por competência", () => {
  const respostas = { ...GABARITO };
  for (const item of ITENS_JUL) {
    if (item.competencia === "etica") respostas[item.id] = erradaPara(item);
  }
  const res = calcularResultado(respostas);
  assert.equal(res.acertos, 20);
  assert.equal(res.percentual, 80);
  assert.equal(res.competencias.etica.acertos, 0);
  assert.equal(res.competencias.responsabilidade.acertos, 5);
});

test("Julgamento: relatório traz competências, destaques e revisão", () => {
  const respostas = { ...GABARITO };
  for (const item of ITENS_JUL) {
    if (item.competencia === "pressao") respostas[item.id] = erradaPara(item);
  }
  const rel = montarRelatorio(calcularResultado(respostas), respostas);
  assert.equal(rel.competencias.length, 5);
  assert.ok(rel.maisAcertos.length >= 1);
  assert.ok(rel.desenvolver.includes("pressao"), "a de menos acertos entra em desenvolver");
  assert.equal(rel.revisao.length, 25);
  assert.ok(/não comprova honestidade|não é um percentil|caráter/i.test(rel.notaGlobal));
  const revPressao = rel.revisao.filter((q) => q.competencia === "pressao");
  assert.ok(revPressao.every((q) => q.acertou === false));
});

test("Julgamento: itens públicos não revelam gabarito nem competência", () => {
  const pub = itensPublicos();
  assert.equal(pub.length, 25);
  for (const it of pub) {
    assert.ok(it.id && it.enunciado && Array.isArray(it.alternativas) && it.alternativas.length === 4);
    assert.ok(!("correta" in it), "não pode vazar a resposta preferencial");
    assert.ok(!("justificativa" in it), "não pode vazar a justificativa");
    assert.ok(!("competencia" in it), "não pode vazar a competência");
  }
});

test("Julgamento: revisão só revela gabarito quando montada (pós-conclusão)", () => {
  const rev = montarRevisao(GABARITO);
  assert.equal(rev.length, 25);
  for (const q of rev) {
    assert.ok(q.correta && q.justificativa);
    assert.equal(q.acertou, true);
  }
});

test("Julgamento: validação exige as 25 respostas com letra válida", () => {
  assert.equal(validarRespostas(GABARITO).ok, true);
  assert.equal(contarRespondidos(GABARITO), 25);

  const faltaUm = { ...GABARITO }; delete faltaUm.q01;
  assert.equal(validarRespostas(faltaUm).codigo, "INCOMPLETO");

  const letraInvalida = { ...GABARITO, q02: "Z" };
  assert.equal(validarRespostas(letraInvalida).codigo, "INCOMPLETO");
  assert.equal(contarRespondidos(letraInvalida), 24, "letra inválida não conta");

  const questaoDesconhecida = { ...GABARITO, q99: "A" };
  assert.equal(validarRespostas(questaoDesconhecida).codigo, "ITEM_INVALIDO");
});

// ─────────────────────────────── Rotas / autorização ─────────────────────
test("Julgamento: rotas exigem dono, retomam, não vazam gabarito e são idempotentes", async (t) => {
  const { base, dbPath } = await subirServidor(t, { JULGAMENTO_DISPONIVEL: "1" });

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
  let r = await req("/julgamento", { cookie: tokEmpresa });
  assert.equal(r.status, 403);

  // Estado inicial.
  r = await req("/julgamento", { cookie: tok1 });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.disponivel, true);
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.equal(r.corpo.competencias.length, 5);
  assert.ok(!r.corpo.itens, "sem tentativa não retorna itens");

  // Inicia: 25 itens sem gabarito.
  r = await req("/julgamento/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.itens.length, 25);
  const vazou = r.corpo.itens.some((it) => "correta" in it || "justificativa" in it || "competencia" in it);
  assert.equal(vazou, false, "o cliente nunca recebe o gabarito");

  // Concluir incompleto → 400.
  r = await req("/julgamento/concluir", { cookie: tok1, body: { respostas: { q01: "B" } } });
  assert.equal(r.status, 400);

  // Salva progresso parcial e RETOMA.
  r = await req("/julgamento/progresso", { cookie: tok1, body: { respostas: { q01: "B", q02: "A" } } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.progresso, 2);

  r = await req("/julgamento", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "andamento");
  assert.equal(r.corpo.respostas.q01, "B");

  // Reiniciar retoma a mesma tentativa.
  r = await req("/julgamento/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.corpo.retomada, true);

  // Conclui completo com o gabarito → 25/25.
  r = await req("/julgamento/concluir", { cookie: tok1, body: { respostas: GABARITO } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado.acertos, 25);
  assert.equal(r.corpo.resultado.percentual, 100);
  assert.equal(r.corpo.resultado.versao, JUL_VERSAO);
  assert.equal(r.corpo.relatorio.revisao.length, 25);
  assert.ok(r.corpo.relatorio.revisao[0].correta, "revisão pós-conclusão traz gabarito");

  // Idempotente.
  r = await req("/julgamento/concluir", { cookie: tok1, body: { respostas: GABARITO } });
  assert.equal(r.corpo.jaConcluido, true);

  // Não pode reiniciar/alterar após concluir.
  r = await req("/julgamento/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.status, 409);
  r = await req("/julgamento/progresso", { cookie: tok1, body: { respostas: { q01: "A" } } });
  assert.equal(r.status, 409, "não altera respostas após conclusão");

  // GET reflete concluído.
  r = await req("/julgamento", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "concluido");
  assert.equal(r.corpo.resultado.acertos, 25);

  // Compartilhamento privado por padrão → liga.
  assert.equal(r.corpo.tentativa.compartilhar, false);
  r = await req("/julgamento/compartilhamento", { cookie: tok1, body: { compartilhar: true } });
  assert.equal(r.corpo.compartilhar, true);

  // Isolamento: profissional 2 não vê a tentativa do 1.
  r = await req("/julgamento", { cookie: tok2 });
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.ok(!r.corpo.resultado);
});

test("Julgamento: feature flag desligada mantém a avaliação fora do ar", async (t) => {
  const { base, dbPath } = await subirServidor(t, { JULGAMENTO_DISPONIVEL: "0" });

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

  let r = await req("/julgamento");
  assert.equal(r.corpo.disponivel, false);

  r = await req("/julgamento/iniciar", {});
  assert.equal(r.status, 403);
});

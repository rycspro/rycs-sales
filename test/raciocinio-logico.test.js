import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";
import {
  ITENS_RL, RL_VERSAO, RL_TOTAL, ORDEM_COMPETENCIAS,
  calcularResultado, validarRespostas, contarRespondidos, itensPublicos,
  montarRelatorio,
} from "../shared/raciocinioLogico.js";

// Gabarito conferido INDEPENDENTEMENTE (à mão, a partir da conta de cada
// questão) — serve de validação externa do banco de questões (spec, seção 4/11).
const GABARITO_ESPERADO = {
  q01: "B", q02: "C", q03: "C", q04: "B", q05: "B",
  q06: "C", q07: "B", q08: "C", q09: "B", q10: "C",
  q11: "A", q12: "B", q13: "B", q14: "C", q15: "A",
  q16: "B", q17: "C", q18: "C", q19: "C", q20: "C",
};

const mapa = (fn) => Object.fromEntries(ITENS_RL.map((i) => [i.id, fn(i)]));

// ─────────────────────────────── Banco de questões ───────────────────────
test("Raciocínio: 20 questões, 4 alternativas, 1 correta, 4 competências de 5", () => {
  assert.equal(ITENS_RL.length, 20);
  assert.equal(RL_TOTAL, 20);

  for (const item of ITENS_RL) {
    assert.equal(item.alternativas.length, 4, `${item.id} deve ter 4 alternativas`);
    const ids = item.alternativas.map((a) => a.id);
    assert.deepEqual([...new Set(ids)].sort(), ["A", "B", "C", "D"], `${item.id} alternativas A–D`);
    assert.ok(ids.includes(item.correta), `${item.id}: correta deve ser uma alternativa válida`);
    assert.ok(item.explicacao, `${item.id} deve ter explicação`);
  }

  for (const c of ORDEM_COMPETENCIAS) {
    assert.equal(ITENS_RL.filter((i) => i.competencia === c).length, 5, `competência ${c} = 5 questões`);
  }
});

test("Raciocínio: gabarito confere com a validação independente", () => {
  for (const item of ITENS_RL) {
    assert.equal(item.correta, GABARITO_ESPERADO[item.id], `gabarito de ${item.id}`);
  }
});

test("Raciocínio: correção — acertos, percentual e pontuação por competência", () => {
  // Todas corretas → 20/20 = 100%, cada competência 5/5.
  const tudoCerto = calcularResultado(mapa((i) => i.correta));
  assert.equal(tudoCerto.acertosTotais, 20);
  assert.equal(tudoCerto.percentual, 100);
  for (const c of ORDEM_COMPETENCIAS) {
    assert.equal(tudoCerto.competencias[c].acertos, 5);
    assert.equal(tudoCerto.competencias[c].total, 5);
  }
  // Nenhum percentil/QI no resultado.
  assert.ok(!("percentil" in tudoCerto));
  assert.ok(!("qi" in tudoCerto));

  // Responder tudo "A": só q11 e q15 têm gabarito A → 2 acertos (10%).
  const tudoA = calcularResultado(mapa(() => "A"));
  assert.equal(tudoA.acertosTotais, 2);
  assert.equal(tudoA.percentual, 10);
  assert.equal(tudoA.competencias.deducao.acertos, 2, "q11 e q15 são de dedução");
  assert.equal(tudoA.competencias.numerico.acertos, 0);

  // 16 acertos → 80% (spec, exemplo).
  const resp16 = mapa((i) => i.correta);
  resp16.q01 = "A"; resp16.q02 = "A"; resp16.q06 = "A"; resp16.q11 = "C"; // erra 4
  assert.equal(calcularResultado(resp16).acertosTotais, 16);
  assert.equal(calcularResultado(resp16).percentual, 80);
});

test("Raciocínio: validação exige as 20 respostas com alternativa válida", () => {
  const completas = mapa((i) => i.correta);
  assert.equal(validarRespostas(completas).ok, true);
  assert.equal(contarRespondidos(completas), 20);

  const faltaUma = { ...completas }; delete faltaUma.q01;
  assert.equal(validarRespostas(faltaUma).codigo, "INCOMPLETO");

  const invalida = { ...completas, q02: "E" };
  assert.equal(validarRespostas(invalida).codigo, "INCOMPLETO");
  assert.equal(contarRespondidos(invalida), 19, "alternativa inexistente não conta");

  const desconhecida = { ...completas, q99: "A" };
  assert.equal(validarRespostas(desconhecida).codigo, "ITEM_INVALIDO");
});

test("Raciocínio: itens públicos não trazem gabarito nem explicação", () => {
  const pub = itensPublicos();
  assert.equal(pub.length, 20);
  for (const it of pub) {
    assert.ok(it.enunciado && it.alternativas?.length === 4);
    assert.ok(!("correta" in it), "não pode vazar a resposta correta");
    assert.ok(!("explicacao" in it), "não pode vazar a explicação");
    for (const a of it.alternativas) assert.ok(a.id && a.texto);
  }
});

test("Raciocínio: relatório traz revisão com gabarito e explicação (pós-conclusão)", () => {
  const respostas = mapa((i) => i.correta);
  respostas.q01 = "A"; // erra a primeira
  const rel = montarRelatorio(calcularResultado(respostas), respostas);
  assert.equal(rel.revisao.length, 20);
  const r1 = rel.revisao.find((r) => r.id === "q01");
  assert.equal(r1.selecionada, "A");
  assert.equal(r1.correta, "B");
  assert.equal(r1.acertou, false);
  assert.ok(r1.explicacao);
});

// ─────────────────────────────── Rotas / autorização ─────────────────────
test("Raciocínio: rotas exigem dono, retomam, corrigem e são idempotentes", async (t) => {
  const { base, dbPath } = await subirServidor(t, { RACIOCINIO_DISPONIVEL: "1" });

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

  const req = async (path, { body, cookie } = {}) => {
    const r = await fetch(base + path, {
      method: body !== undefined ? "POST" : "GET",
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, corpo: await r.json().catch(() => null) };
  };

  // Empresa não acessa.
  let r = await req("/raciocinio", { cookie: tokEmpresa });
  assert.equal(r.status, 403);

  // Estado inicial.
  r = await req("/raciocinio", { cookie: tok1 });
  assert.equal(r.corpo.disponivel, true);
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.equal(r.corpo.competencias.length, 4);
  assert.ok(!r.corpo.itens, "sem tentativa não retorna itens");

  // Inicia: 20 itens SEM gabarito.
  r = await req("/raciocinio/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.corpo.itens.length, 20);
  const vazou = r.corpo.itens.some((it) => "correta" in it || "explicacao" in it);
  assert.equal(vazou, false, "o gabarito nunca é enviado antes da conclusão");

  // Concluir incompleto → 400.
  r = await req("/raciocinio/concluir", { cookie: tok1, body: { respostas: { q01: "B" } } });
  assert.equal(r.status, 400);

  // Progresso parcial + retomada.
  r = await req("/raciocinio/progresso", { cookie: tok1, body: { respostas: { q01: "B", q02: "C" } } });
  assert.equal(r.corpo.progresso, 2);
  r = await req("/raciocinio", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "andamento");
  assert.equal(r.corpo.respostas.q01, "B");
  r = await req("/raciocinio/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.corpo.retomada, true);
  assert.equal(r.corpo.respostas.q02, "C");

  // Conclui com todas corretas (gabarito) → 20/20, 100%.
  const tudoCerto = mapa((i) => i.correta);
  r = await req("/raciocinio/concluir", { cookie: tok1, body: { respostas: tudoCerto } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado.acertosTotais, 20);
  assert.equal(r.corpo.resultado.percentual, 100);
  assert.equal(r.corpo.resultado.versao, RL_VERSAO);
  assert.equal(r.corpo.relatorio.revisao.length, 20);
  assert.ok(r.corpo.relatorio.revisao[0].explicacao);

  // Idempotente.
  r = await req("/raciocinio/concluir", { cookie: tok1, body: { respostas: tudoCerto } });
  assert.equal(r.corpo.jaConcluido, true);

  // Não altera após conclusão: progresso é recusado (não está em andamento).
  r = await req("/raciocinio/progresso", { cookie: tok1, body: { respostas: { q01: "A" } } });
  assert.equal(r.status, 409);

  // Iniciar de novo NÃO refaz: devolve o resultado concluído.
  r = await req("/raciocinio/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.corpo.jaConcluido, true);
  assert.equal(r.corpo.resultado.acertosTotais, 20);

  // GET reflete concluído, com revisão.
  r = await req("/raciocinio", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "concluido");
  assert.ok(r.corpo.relatorio.revisao.length === 20);

  // Compartilhamento privado por padrão → liga.
  assert.equal(r.corpo.tentativa.compartilhar, false);
  r = await req("/raciocinio/compartilhamento", { cookie: tok1, body: { compartilhar: true } });
  assert.equal(r.corpo.compartilhar, true);

  // Isolamento: s2 não vê a tentativa de s1.
  r = await req("/raciocinio", { cookie: tok2 });
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.ok(!r.corpo.resultado);
});

test("Raciocínio: flag desligada mantém a avaliação fora do ar", async (t) => {
  const { base, dbPath } = await subirServidor(t, { RACIOCINIO_DISPONIVEL: "0", RYCS_ENVIRONMENT: "" });

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

  let r = await req("/raciocinio");
  assert.equal(r.corpo.disponivel, false);
  r = await req("/raciocinio/iniciar", {});
  assert.equal(r.status, 403);
});

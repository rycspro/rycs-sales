import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";
import {
  ITENS_RP, RP_VERSAO, RP_TOTAL, ORDEM_COMPETENCIAS,
  calcularResultado, validarRespostas, contarRespondidos, itensPublicos,
  montarRelatorio,
} from "../shared/resolucaoProblemas.js";

// Gabarito conferido INDEPENDENTEMENTE a partir das justificativas (spec, 12#5).
const GABARITO_ESPERADO = {
  q01: "C", q02: "B", q03: "C", q04: "B",
  q05: "B", q06: "B", q07: "B", q08: "A",
  q09: "B", q10: "C", q11: "B", q12: "B",
  q13: "C", q14: "B", q15: "C", q16: "B",
  q17: "B", q18: "C", q19: "B", q20: "C",
};

const mapa = (fn) => Object.fromEntries(ITENS_RP.map((i) => [i.id, fn(i)]));

// ─────────────────────────────── Banco de situações ──────────────────────
test("Resolução: 20 situações, 4 alternativas, 1 preferencial, 5 competências de 4", () => {
  assert.equal(ITENS_RP.length, 20);
  assert.equal(RP_TOTAL, 20);
  assert.equal(ORDEM_COMPETENCIAS.length, 5);

  for (const item of ITENS_RP) {
    assert.equal(item.alternativas.length, 4, `${item.id} deve ter 4 alternativas`);
    const ids = item.alternativas.map((a) => a.id);
    assert.deepEqual([...new Set(ids)].sort(), ["A", "B", "C", "D"], `${item.id} A–D`);
    assert.ok(ids.includes(item.correta), `${item.id}: preferencial válida`);
    assert.ok(item.explicacao, `${item.id} deve ter justificativa`);
  }

  for (const c of ORDEM_COMPETENCIAS) {
    assert.equal(ITENS_RP.filter((i) => i.competencia === c).length, 4, `competência ${c} = 4 questões`);
  }
});

test("Resolução: gabarito confere com a validação independente", () => {
  for (const item of ITENS_RP) {
    assert.equal(item.correta, GABARITO_ESPERADO[item.id], `gabarito de ${item.id}`);
  }
});

test("Resolução: correção — acertos, percentual e pontuação por competência", () => {
  const tudoCerto = calcularResultado(mapa((i) => i.correta));
  assert.equal(tudoCerto.acertosTotais, 20);
  assert.equal(tudoCerto.percentual, 100);
  for (const c of ORDEM_COMPETENCIAS) {
    assert.equal(tudoCerto.competencias[c].acertos, 4);
    assert.equal(tudoCerto.competencias[c].total, 4);
  }
  assert.ok(!("percentil" in tudoCerto));

  // Tudo "A": só q08 é A → 1 acerto (5%), em "causas".
  const tudoA = calcularResultado(mapa(() => "A"));
  assert.equal(tudoA.acertosTotais, 1);
  assert.equal(tudoA.percentual, 5);
  assert.equal(tudoA.competencias.causas.acertos, 1);

  // 16 acertos → 80%.
  const r16 = mapa((i) => i.correta);
  r16.q01 = "A"; r16.q05 = "A"; r16.q09 = "A"; r16.q13 = "A";
  assert.equal(calcularResultado(r16).acertosTotais, 16);
  assert.equal(calcularResultado(r16).percentual, 80);
});

test("Resolução: validação exige as 20 respostas com alternativa válida", () => {
  const completas = mapa((i) => i.correta);
  assert.equal(validarRespostas(completas).ok, true);
  assert.equal(contarRespondidos(completas), 20);

  const faltaUma = { ...completas }; delete faltaUma.q01;
  assert.equal(validarRespostas(faltaUma).codigo, "INCOMPLETO");

  const invalida = { ...completas, q02: "E" };
  assert.equal(validarRespostas(invalida).codigo, "INCOMPLETO");
  assert.equal(contarRespondidos(invalida), 19);

  const desconhecida = { ...completas, q99: "A" };
  assert.equal(validarRespostas(desconhecida).codigo, "ITEM_INVALIDO");
});

test("Resolução: itens públicos não trazem gabarito nem justificativa", () => {
  const pub = itensPublicos();
  assert.equal(pub.length, 20);
  for (const it of pub) {
    assert.ok(it.enunciado && it.alternativas?.length === 4);
    assert.ok(!("correta" in it), "não pode vazar a preferencial");
    assert.ok(!("explicacao" in it), "não pode vazar a justificativa");
  }
});

test("Resolução: relatório traz desenvolvimento e revisão (pós-conclusão)", () => {
  const respostas = mapa((i) => i.correta);
  respostas.q01 = "A"; respostas.q02 = "A"; respostas.q03 = "A"; respostas.q04 = "A"; // zera identificacao
  const rel = montarRelatorio(calcularResultado(respostas), respostas);
  assert.equal(rel.revisao.length, 20);
  // identificacao fica como oportunidade de desenvolvimento, com sugestão.
  const dev = rel.analise.desenvolver.find((d) => d.nome === "Identificação de problemas");
  assert.ok(dev && dev.sugestao, "oportunidade de desenvolvimento traz sugestão prática");
});

// ─────────────────────────────── Rotas / autorização ─────────────────────
test("Resolução: rotas exigem dono, retomam, corrigem e são idempotentes", async (t) => {
  const { base, dbPath } = await subirServidor(t, { RESOLUCAO_DISPONIVEL: "1" });

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

  let r = await req("/resolucao", { cookie: tokEmpresa });
  assert.equal(r.status, 403);

  r = await req("/resolucao", { cookie: tok1 });
  assert.equal(r.corpo.disponivel, true);
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.equal(r.corpo.competencias.length, 5);
  assert.ok(!r.corpo.itens);

  r = await req("/resolucao/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.corpo.itens.length, 20);
  assert.equal(r.corpo.itens.some((it) => "correta" in it || "explicacao" in it), false, "gabarito nunca antes da conclusão");

  r = await req("/resolucao/concluir", { cookie: tok1, body: { respostas: { q01: "C" } } });
  assert.equal(r.status, 400);

  r = await req("/resolucao/progresso", { cookie: tok1, body: { respostas: { q01: "C", q02: "B" } } });
  assert.equal(r.corpo.progresso, 2);
  r = await req("/resolucao", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "andamento");
  r = await req("/resolucao/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.corpo.retomada, true);
  assert.equal(r.corpo.respostas.q02, "B");

  const tudoCerto = mapa((i) => i.correta);
  r = await req("/resolucao/concluir", { cookie: tok1, body: { respostas: tudoCerto } });
  assert.equal(r.corpo.resultado.acertosTotais, 20);
  assert.equal(r.corpo.resultado.percentual, 100);
  assert.equal(r.corpo.resultado.versao, RP_VERSAO);
  assert.equal(r.corpo.relatorio.revisao.length, 20);

  r = await req("/resolucao/concluir", { cookie: tok1, body: { respostas: tudoCerto } });
  assert.equal(r.corpo.jaConcluido, true);

  // Não altera após conclusão.
  r = await req("/resolucao/progresso", { cookie: tok1, body: { respostas: { q01: "A" } } });
  assert.equal(r.status, 409);
  r = await req("/resolucao/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.corpo.jaConcluido, true);

  // Compartilhamento privado por padrão → liga.
  r = await req("/resolucao", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.compartilhar, false);
  r = await req("/resolucao/compartilhamento", { cookie: tok1, body: { compartilhar: true } });
  assert.equal(r.corpo.compartilhar, true);

  // Isolamento.
  r = await req("/resolucao", { cookie: tok2 });
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
});

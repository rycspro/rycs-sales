import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";
import {
  ITENS_RIASEC, RIASEC_VERSAO, RIASEC_TOTAL, ORDEM_DIMENSOES, RIASEC_ITENS_POR_DIMENSAO,
  calcularResultado, validarRespostas, contarRespondidos, itensPublicos,
  dimensoesDestaque, codigoExploratorio, montarRelatorio,
} from "../shared/riasec.js";

const todas = (v) => Object.fromEntries(ITENS_RIASEC.map((i) => [i.id, v]));
// Preenche cada dimensão com um valor definido no mapa { R: v, ... }.
const porDimensao = (mapa) =>
  Object.fromEntries(ITENS_RIASEC.map((i) => [i.id, mapa[i.dimensao] ?? 1]));

// ─────────────────────────────── Algoritmo ───────────────────────────────
test("RIASEC: 36 atividades, 6 por dimensão, 6 dimensões", () => {
  assert.equal(ITENS_RIASEC.length, 36);
  assert.equal(RIASEC_TOTAL, 36);
  assert.equal(ORDEM_DIMENSOES.length, 6);
  for (const d of ORDEM_DIMENSOES) {
    assert.equal(
      ITENS_RIASEC.filter((i) => i.dimensao === d).length,
      RIASEC_ITENS_POR_DIMENSAO,
      `dimensão ${d} deve ter ${RIASEC_ITENS_POR_DIMENSAO} atividades`
    );
  }
});

test("RIASEC: soma e média por dimensão, sem percentil nem aptidão", () => {
  const res = calcularResultado(todas(4));
  for (const d of ORDEM_DIMENSOES) {
    assert.equal(res.dimensoes[d].soma, 24);
    assert.equal(res.dimensoes[d].media, 4);
    assert.equal(res.dimensoes[d].maximo, 30);
  }
  assert.ok(!("percentil" in res.dimensoes.R), "não deve haver percentil");
  assert.ok(!("aptidao" in res.dimensoes.R), "não deve haver aptidão");
});

test("RIASEC: soma varia de 6 a 30, média de 1 a 5", () => {
  const min = calcularResultado(todas(1));
  const max = calcularResultado(todas(5));
  for (const d of ORDEM_DIMENSOES) {
    assert.equal(min.dimensoes[d].soma, 6);
    assert.equal(min.dimensoes[d].media, 1);
    assert.equal(max.dimensoes[d].soma, 30);
    assert.equal(max.dimensoes[d].media, 5);
  }
});

test("RIASEC: código exploratório são as 3 maiores médias em ordem", () => {
  // E=5, S=4, A=3 (um item a menos), demais baixos → código ESA.
  const res = calcularResultado(porDimensao({ E: 5, S: 4, A: 3, R: 2, I: 1, C: 1 }));
  assert.equal(res.codigo, "ESA");
  assert.deepEqual(res.destaques, ["E", "S", "A"]);
});

test("RIASEC: empate que impede ordem única não força código de três letras", () => {
  // E e S empatam no topo → ordem ambígua → sem código.
  const res = calcularResultado(porDimensao({ E: 5, S: 5, A: 3, R: 2, I: 1, C: 1 }));
  assert.equal(res.codigo, null, "empate no topo não gera código");
  assert.equal(codigoExploratorio(res), null);

  // Empate na 3ª posição (A e R iguais) também impede o código.
  const res2 = calcularResultado(porDimensao({ E: 5, S: 4, A: 3, R: 3, I: 1, C: 1 }));
  assert.equal(res2.codigo, null, "empate no 3º lugar não gera código");
  // ...mas os destaques preservam o empate (quatro dimensões).
  const dest = dimensoesDestaque(res2);
  assert.equal(dest.length, 4);
  assert.ok(dest.includes("A") && dest.includes("R"));
});

test("RIASEC: relatório traz 6 dimensões, destaques, código e combinação", () => {
  const res = calcularResultado(porDimensao({ E: 5, S: 4, A: 3, R: 2, I: 1, C: 1 }));
  const rel = montarRelatorio(res);
  assert.equal(rel.dimensoes.length, 6);
  assert.equal(rel.codigo, "ESA");
  assert.ok(/negociação/i.test(rel.descricaoCombinada), "combina os resumos dos destaques");
  assert.ok(rel.notaGlobal && /não é instrumento\s+psicométrico validado/i.test(rel.notaGlobal));
  for (const d of rel.dimensoes) {
    assert.ok(d.nome && d.descricao && Array.isArray(d.atividades) && d.atividades.length);
  }
});

test("RIASEC: validação exige as 36 atividades com valor 1–5", () => {
  const completas = todas(4);
  assert.equal(validarRespostas(completas).ok, true);
  assert.equal(contarRespondidos(completas), 36);

  const faltaUm = { ...completas }; delete faltaUm.r01;
  assert.equal(validarRespostas(faltaUm).codigo, "INCOMPLETO");

  const foraDaEscala = { ...completas, i01: 6 };
  assert.equal(validarRespostas(foraDaEscala).codigo, "INCOMPLETO");
  assert.equal(contarRespondidos(foraDaEscala), 35, "valor fora da escala não conta");

  const itemDesconhecido = { ...completas, z99: 3 };
  assert.equal(validarRespostas(itemDesconhecido).codigo, "ITEM_INVALIDO");
});

test("RIASEC: itens públicos não revelam a dimensão avaliada", () => {
  const pub = itensPublicos();
  assert.equal(pub.length, 36);
  for (const it of pub) {
    assert.ok(it.id && it.texto);
    assert.ok(!("dimensao" in it), "não pode vazar a dimensão");
  }
});

// ─────────────────────────────── Rotas / autorização ─────────────────────
test("RIASEC: rotas exigem dono, retomam progresso e são idempotentes", async (t) => {
  const { base, dbPath } = await subirServidor(t, { RIASEC_DISPONIVEL: "1" });

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
  let r = await req("/riasec", { cookie: tokEmpresa });
  assert.equal(r.status, 403);

  // Estado inicial.
  r = await req("/riasec", { cookie: tok1 });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.disponivel, true);
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.equal(r.corpo.dimensoes.length, 6);
  assert.ok(!r.corpo.itens, "sem tentativa não retorna itens");

  // Inicia: 36 itens públicos, sem vazar a dimensão.
  r = await req("/riasec/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.itens.length, 36);
  const vazou = r.corpo.itens.some((it) => "dimensao" in it);
  assert.equal(vazou, false, "o cliente nunca recebe a dimensão");

  // Concluir incompleto → 400.
  r = await req("/riasec/concluir", { cookie: tok1, body: { respostas: { r01: 3 } } });
  assert.equal(r.status, 400);

  // Salva progresso parcial e RETOMA.
  r = await req("/riasec/progresso", { cookie: tok1, body: { respostas: { r01: 4, i01: 2 } } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.progresso, 2);

  r = await req("/riasec", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "andamento");
  assert.equal(r.corpo.respostas.r01, 4);

  // Reiniciar retoma a mesma tentativa, preservando as respostas.
  r = await req("/riasec/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.corpo.retomada, true);
  assert.equal(r.corpo.respostas.r01, 4);

  // Conclui completo com um código determinado (E>S>A>...).
  const respFinais = Object.fromEntries(ITENS_RIASEC.map((i) => {
    const v = { E: 5, S: 4, A: 3, R: 2, I: 1, C: 1 }[i.dimensao];
    return [i.id, v];
  }));
  r = await req("/riasec/concluir", { cookie: tok1, body: { respostas: respFinais } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado.codigo, "ESA");
  assert.equal(r.corpo.resultado.versao, RIASEC_VERSAO);
  assert.ok(r.corpo.relatorio.notaGlobal);
  assert.equal(r.corpo.relatorio.dimensoes.length, 6);

  // Idempotente.
  r = await req("/riasec/concluir", { cookie: tok1, body: { respostas: respFinais } });
  assert.equal(r.corpo.jaConcluido, true);

  // GET reflete concluído, com resultado e relatório.
  r = await req("/riasec", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "concluido");
  assert.equal(r.corpo.resultado.codigo, "ESA");

  // Compartilhamento privado por padrão → liga.
  assert.equal(r.corpo.tentativa.compartilhar, false);
  r = await req("/riasec/compartilhamento", { cookie: tok1, body: { compartilhar: true } });
  assert.equal(r.corpo.compartilhar, true);

  // Isolamento: profissional 2 não vê a tentativa do 1.
  r = await req("/riasec", { cookie: tok2 });
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.ok(!r.corpo.resultado);
});

test("RIASEC: feature flag desligada mantém a avaliação fora do ar", async (t) => {
  // RIASEC_DISPONIVEL=0 e fora do beta: indisponível (pausa de revisão).
  const { base, dbPath } = await subirServidor(t, { RIASEC_DISPONIVEL: "0" });

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

  let r = await req("/riasec");
  assert.equal(r.corpo.disponivel, false);

  r = await req("/riasec/iniciar", {});
  assert.equal(r.status, 403);
});

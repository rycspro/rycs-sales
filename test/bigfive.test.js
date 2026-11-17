import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";
import {
  ITENS_BIG5, BIG5_VERSAO, BIG5_TOTAL, ORDEM_DIMENSOES,
  calcularResultado, validarRespostas, contarRespondidos, itensPublicos,
  bandaMedia,
} from "../shared/bigFive.js";

const todas = (v) => Object.fromEntries(ITENS_BIG5.map((i) => [i.id, v]));

// ─────────────────────────────── Algoritmo ───────────────────────────────
test("Big Five: instrumento tem 50 itens, 10 por fator", () => {
  assert.equal(ITENS_BIG5.length, 50);
  assert.equal(BIG5_TOTAL, 50);
  for (const d of ORDEM_DIMENSOES) {
    assert.equal(ITENS_BIG5.filter((i) => i.fator === d).length, 10, `fator ${d} deve ter 10 itens`);
  }
});

test("Big Five: resposta neutra (3) dá média 3 em todos os fatores, com e sem reversos", () => {
  // 6 − 3 = 3: itens reversos e diretos resultam igual. Isola o efeito da escala.
  const res = calcularResultado(todas(3));
  for (const d of ORDEM_DIMENSOES) {
    assert.equal(res.dimensoes[d].media, 3, `média do fator ${d}`);
    assert.equal(res.dimensoes[d].bruto, 30);
    assert.equal(res.dimensoes[d].maximo, 50);
  }
  // Nunca apresenta percentil.
  assert.ok(!("percentil" in res.dimensoes.O), "não deve haver percentil");
});

test("Big Five: itens reversos são invertidos (6 − resposta) por fator", () => {
  // Tudo = 5. Em cada fator, os itens reversos viram 1; os diretos ficam 5.
  // Contagens de reversos por fator (chave oficial IPIP-50 / polo relatado):
  //   E: 5 reversos → 5*5 + 5*1 = 30 (média 3,0)
  //   A: 4 reversos → 6*5 + 4*1 = 34 (média 3,4)
  //   C: 4 reversos → 6*5 + 4*1 = 34 (média 3,4)
  //   O: 3 reversos → 7*5 + 3*1 = 38 (média 3,8)
  //   N: 2 reversos → 8*5 + 2*1 = 42 (média 4,2)
  const res = calcularResultado(todas(5));
  assert.equal(res.dimensoes.E.bruto, 30);
  assert.equal(res.dimensoes.A.bruto, 34);
  assert.equal(res.dimensoes.C.bruto, 34);
  assert.equal(res.dimensoes.O.bruto, 38);
  assert.equal(res.dimensoes.N.bruto, 42);
  assert.equal(res.dimensoes.O.media, 3.8);
  assert.equal(res.dimensoes.N.media, 4.2);
  // Prova que a direção não é uniforme: O e N diferem só por causa dos reversos.
  assert.notEqual(res.dimensoes.O.bruto, res.dimensoes.N.bruto);
});

test("Big Five: item reverso específico inverte o sentido", () => {
  // q09 "Fico relaxado(a)..." é reverso para Neuroticismo. Responder 5 (concordo
  // muito que sou relaxado) deve BAIXAR o neuroticismo, não aumentar.
  const base = todas(3);
  const alto = { ...base, q09: 5 }; // relaxado = polo oposto do neuroticismo
  const baixo = { ...base, q09: 1 };
  assert.ok(calcularResultado(alto).dimensoes.N.bruto < calcularResultado(baixo).dimensoes.N.bruto);

  // q04 "Fico estressado(a) com facilidade" é direto para Neuroticismo.
  const estressado = { ...base, q04: 5 };
  const calmo = { ...base, q04: 1 };
  assert.ok(calcularResultado(estressado).dimensoes.N.bruto > calcularResultado(calmo).dimensoes.N.bruto);
});

test("Big Five: validação exige os 50 itens com valor 1–5", () => {
  const completas = todas(4);
  assert.equal(validarRespostas(completas).ok, true);
  assert.equal(contarRespondidos(completas), 50);

  const faltaUm = { ...completas }; delete faltaUm.q01;
  assert.equal(validarRespostas(faltaUm).codigo, "INCOMPLETO");

  const foraDaEscala = { ...completas, q02: 6 };
  assert.equal(validarRespostas(foraDaEscala).codigo, "INCOMPLETO");
  assert.equal(contarRespondidos(foraDaEscala), 49, "valor fora da escala não conta");

  const itemDesconhecido = { ...completas, q99: 3 };
  assert.equal(validarRespostas(itemDesconhecido).codigo, "ITEM_INVALIDO");
});

test("Big Five: itens públicos não revelam fator nem reverso", () => {
  const pub = itensPublicos();
  assert.equal(pub.length, 50);
  for (const it of pub) {
    assert.ok(it.id && it.texto);
    assert.ok(!("fator" in it), "não pode vazar o fator");
    assert.ok(!("reverso" in it), "não pode vazar o reverso");
  }
});

test("Big Five: banda qualitativa da média não é percentil nem ranking", () => {
  assert.equal(bandaMedia(1.5).chave, "baixa");
  assert.equal(bandaMedia(3).chave, "media");
  assert.equal(bandaMedia(4.5).chave, "alta");
});

// ─────────────────────────────── Rotas / autorização ─────────────────────
test("Big Five: rotas exigem dono, retomam progresso e são idempotentes", async (t) => {
  // Flag ligada para o teste interno (em produção, padrão é desligada).
  const { base, dbPath } = await subirServidor(t, { BIG5_DISPONIVEL: "1" });

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
  let r = await req("/big-five", { cookie: tokEmpresa });
  assert.equal(r.status, 403);

  // Estado inicial do profissional 1.
  r = await req("/big-five", { cookie: tok1 });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.disponivel, true);
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.equal(r.corpo.dimensoes.length, 5);
  assert.ok(Array.isArray(r.corpo.pendencias) && r.corpo.pendencias.length > 0);
  assert.ok(!r.corpo.itens, "sem tentativa não retorna itens");

  // Inicia: 50 itens públicos, sem vazar fator/reverso.
  r = await req("/big-five/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.itens.length, 50);
  const vazou = r.corpo.itens.some((it) => "fator" in it || "reverso" in it);
  assert.equal(vazou, false, "o cliente nunca recebe fator/reverso");

  // Concluir incompleto → 400.
  r = await req("/big-five/concluir", { cookie: tok1, body: { respostas: { q01: 3 } } });
  assert.equal(r.status, 400);

  // Salva progresso parcial e RETOMA.
  r = await req("/big-five/progresso", { cookie: tok1, body: { respostas: { q01: 4, q02: 2 } } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.progresso, 2);

  r = await req("/big-five", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "andamento");
  assert.equal(r.corpo.respostas.q01, 4);

  // Reiniciar retoma a mesma tentativa, preservando as respostas.
  r = await req("/big-five/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.corpo.retomada, true);
  assert.equal(r.corpo.respostas.q01, 4);

  // Conclui completo (tudo 3 → média 3 em todos).
  r = await req("/big-five/concluir", { cookie: tok1, body: { respostas: todas(3) } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado.dimensoes.O.media, 3);
  assert.equal(r.corpo.resultado.versao, BIG5_VERSAO);
  assert.ok(r.corpo.relatorio.notaGlobal);
  assert.equal(r.corpo.relatorio.dimensoes.length, 5);

  // Idempotente.
  r = await req("/big-five/concluir", { cookie: tok1, body: { respostas: todas(3) } });
  assert.equal(r.corpo.jaConcluido, true);

  // GET reflete concluído, com resultado e relatório.
  r = await req("/big-five", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "concluido");
  assert.ok(r.corpo.resultado.dimensoes.N);

  // Compartilhamento privado por padrão → liga.
  assert.equal(r.corpo.tentativa.compartilhar, false);
  r = await req("/big-five/compartilhamento", { cookie: tok1, body: { compartilhar: true } });
  assert.equal(r.corpo.compartilhar, true);

  // Isolamento: profissional 2 não vê a tentativa do 1.
  r = await req("/big-five", { cookie: tok2 });
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.ok(!r.corpo.resultado);
});

test("Big Five: feature flag desligada mantém a avaliação fora do ar", async (t) => {
  // Sem BIG5_DISPONIVEL e fora do beta: indisponível (comportamento de produção).
  const { base, dbPath } = await subirServidor(t);

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

  let r = await req("/big-five");
  assert.equal(r.corpo.disponivel, false);

  // Iniciar é bloqueado no servidor, não só na interface.
  r = await req("/big-five/iniciar", {});
  assert.equal(r.status, 403);
});

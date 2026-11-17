import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";
import {
  ITENS_AUTO, AUTO_VERSAO, AUTO_TOTAL, ORDEM_PADROES, AUTO_ITENS_POR_PADRAO,
  calcularResultado, validarRespostas, contarRespondidos, itensPublicos,
  padroesDestaque, montarRelatorio,
} from "../shared/autossabotagem.js";

const todas = (v) => Object.fromEntries(ITENS_AUTO.map((i) => [i.id, v]));

// ─────────────────────────────── Algoritmo ───────────────────────────────
test("Autossabotagem: instrumento tem 40 afirmações, 5 por padrão, 8 padrões", () => {
  assert.equal(ITENS_AUTO.length, 40);
  assert.equal(AUTO_TOTAL, 40);
  assert.equal(ORDEM_PADROES.length, 8);
  for (const p of ORDEM_PADROES) {
    assert.equal(
      ITENS_AUTO.filter((i) => i.padrao === p).length,
      AUTO_ITENS_POR_PADRAO,
      `padrão ${p} deve ter ${AUTO_ITENS_POR_PADRAO} afirmações`
    );
  }
});

test("Autossabotagem: soma e média por padrão, sem percentil nem risco", () => {
  // Tudo 4: soma 20 (5×4), média 4 em cada padrão.
  const res = calcularResultado(todas(4));
  for (const p of ORDEM_PADROES) {
    assert.equal(res.padroes[p].soma, 20);
    assert.equal(res.padroes[p].media, 4);
    assert.equal(res.padroes[p].maximo, 25);
  }
  // Nunca apresenta percentil nem score de risco.
  assert.ok(!("percentil" in res.padroes.A), "não deve haver percentil");
  assert.ok(!("risco" in res.padroes.A), "não deve haver score de risco");
});

test("Autossabotagem: soma varia de 5 a 25, média de 1 a 5", () => {
  const min = calcularResultado(todas(1));
  const max = calcularResultado(todas(5));
  for (const p of ORDEM_PADROES) {
    assert.equal(min.padroes[p].soma, 5);
    assert.equal(min.padroes[p].media, 1);
    assert.equal(max.padroes[p].soma, 25);
    assert.equal(max.padroes[p].media, 5);
  }
});

test("Autossabotagem: destaques trazem os 3 maiores, preservando empates", () => {
  // Médias distintas: B > A > G > demais → exatamente 3 destaques.
  const base = todas(1);
  const resp = { ...base };
  for (const i of ITENS_AUTO) {
    if (i.padrao === "B") resp[i.id] = 5; // média 5
    else if (i.padrao === "A") resp[i.id] = 4; // média 4
    else if (i.padrao === "G") resp[i.id] = 3; // média 3
  }
  const res = calcularResultado(resp);
  const d1 = padroesDestaque(res);
  assert.deepEqual(d1, ["B", "A", "G"]);

  // Empate no 3º lugar: G e H empatam → quatro destaques (empate preservado).
  const resp2 = { ...resp };
  for (const i of ITENS_AUTO) if (i.padrao === "H") resp2[i.id] = 3; // H média 3 = G
  const res2 = calcularResultado(resp2);
  const d2 = padroesDestaque(res2);
  assert.equal(d2.length, 4, "empate no corte inclui o quarto padrão");
  assert.ok(d2.includes("G") && d2.includes("H"));
});

test("Autossabotagem: relatório traz 8 padrões, destaques e textos de cada", () => {
  const rel = montarRelatorio(calcularResultado(todas(3)));
  assert.equal(rel.padroes.length, 8);
  assert.ok(rel.destaques.length >= 3);
  assert.ok(rel.notaGlobal && /não é o teste de Sabotadores/i.test(rel.notaGlobal));
  for (const d of rel.padroes) {
    assert.ok(d.nome && d.descricao && d.cotidiano && d.atencao && d.reflexao && d.acao);
  }
});

test("Autossabotagem: validação exige as 40 afirmações com valor 1–5", () => {
  const completas = todas(4);
  assert.equal(validarRespostas(completas).ok, true);
  assert.equal(contarRespondidos(completas), 40);

  const faltaUm = { ...completas }; delete faltaUm.a01;
  assert.equal(validarRespostas(faltaUm).codigo, "INCOMPLETO");

  const foraDaEscala = { ...completas, b01: 6 };
  assert.equal(validarRespostas(foraDaEscala).codigo, "INCOMPLETO");
  assert.equal(contarRespondidos(foraDaEscala), 39, "valor fora da escala não conta");

  const itemDesconhecido = { ...completas, z99: 3 };
  assert.equal(validarRespostas(itemDesconhecido).codigo, "ITEM_INVALIDO");
});

test("Autossabotagem: itens públicos não revelam o padrão avaliado", () => {
  const pub = itensPublicos();
  assert.equal(pub.length, 40);
  for (const it of pub) {
    assert.ok(it.id && it.texto);
    assert.ok(!("padrao" in it), "não pode vazar o padrão");
  }
});

// ─────────────────────────────── Rotas / autorização ─────────────────────
test("Autossabotagem: rotas exigem dono, retomam progresso e são idempotentes", async (t) => {
  // Flag ligada para o teste interno (em produção, padrão é desligada).
  const { base, dbPath } = await subirServidor(t, { AUTOSSABOTAGEM_DISPONIVEL: "1" });

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
  let r = await req("/autossabotagem", { cookie: tokEmpresa });
  assert.equal(r.status, 403);

  // Estado inicial do profissional 1.
  r = await req("/autossabotagem", { cookie: tok1 });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.disponivel, true);
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.equal(r.corpo.padroes.length, 8);
  assert.ok(Array.isArray(r.corpo.pendencias) && r.corpo.pendencias.length > 0);
  assert.ok(!r.corpo.itens, "sem tentativa não retorna itens");

  // Inicia: 40 itens públicos, sem vazar o padrão.
  r = await req("/autossabotagem/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.itens.length, 40);
  const vazou = r.corpo.itens.some((it) => "padrao" in it);
  assert.equal(vazou, false, "o cliente nunca recebe o padrão");

  // Concluir incompleto → 400.
  r = await req("/autossabotagem/concluir", { cookie: tok1, body: { respostas: { a01: 3 } } });
  assert.equal(r.status, 400);

  // Salva progresso parcial e RETOMA.
  r = await req("/autossabotagem/progresso", { cookie: tok1, body: { respostas: { a01: 4, b01: 2 } } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.progresso, 2);

  r = await req("/autossabotagem", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "andamento");
  assert.equal(r.corpo.respostas.a01, 4);

  // Reiniciar retoma a mesma tentativa, preservando as respostas.
  r = await req("/autossabotagem/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.corpo.retomada, true);
  assert.equal(r.corpo.respostas.a01, 4);

  // Conclui completo (tudo 3 → média 3 em todos).
  r = await req("/autossabotagem/concluir", { cookie: tok1, body: { respostas: todas(3) } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado.padroes.A.media, 3);
  assert.equal(r.corpo.resultado.versao, AUTO_VERSAO);
  assert.ok(r.corpo.relatorio.notaGlobal);
  assert.equal(r.corpo.relatorio.padroes.length, 8);

  // Idempotente.
  r = await req("/autossabotagem/concluir", { cookie: tok1, body: { respostas: todas(3) } });
  assert.equal(r.corpo.jaConcluido, true);

  // GET reflete concluído, com resultado e relatório.
  r = await req("/autossabotagem", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "concluido");
  assert.ok(r.corpo.resultado.padroes.H);

  // Compartilhamento privado por padrão → liga.
  assert.equal(r.corpo.tentativa.compartilhar, false);
  r = await req("/autossabotagem/compartilhamento", { cookie: tok1, body: { compartilhar: true } });
  assert.equal(r.corpo.compartilhar, true);

  // Isolamento: profissional 2 não vê a tentativa do 1.
  r = await req("/autossabotagem", { cookie: tok2 });
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.ok(!r.corpo.resultado);
});

test("Autossabotagem: feature flag desligada mantém a avaliação fora do ar", async (t) => {
  // Sem AUTOSSABOTAGEM_DISPONIVEL e fora do beta: indisponível (produção).
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

  let r = await req("/autossabotagem");
  assert.equal(r.corpo.disponivel, false);

  // Iniciar é bloqueado no servidor, não só na interface.
  r = await req("/autossabotagem/iniciar", {});
  assert.equal(r.status, 403);
});

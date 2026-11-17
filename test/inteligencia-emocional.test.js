import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";
import {
  ITENS_IE, IE_VERSAO, IE_TOTAL, ORDEM_COMPETENCIAS, IE_ITENS_POR_COMPETENCIA,
  calcularResultado, validarRespostas, contarRespondidos, itensPublicos,
  competenciasDestaque, montarRelatorio,
} from "../shared/inteligenciaEmocional.js";

const todas = (v) => Object.fromEntries(ITENS_IE.map((i) => [i.id, v]));

// ─────────────────────────────── Algoritmo ───────────────────────────────
test("Inteligência Emocional: 30 afirmações, 6 por competência, 5 competências", () => {
  assert.equal(ITENS_IE.length, 30);
  assert.equal(IE_TOTAL, 30);
  assert.equal(ORDEM_COMPETENCIAS.length, 5);
  for (const c of ORDEM_COMPETENCIAS) {
    assert.equal(
      ITENS_IE.filter((i) => i.competencia === c).length,
      IE_ITENS_POR_COMPETENCIA,
      `competência ${c} deve ter ${IE_ITENS_POR_COMPETENCIA} afirmações`
    );
  }
});

test("Inteligência Emocional: soma e média por competência, sem percentil nem nível", () => {
  // Tudo 4: soma 24 (6×4), média 4 em cada competência.
  const res = calcularResultado(todas(4));
  for (const c of ORDEM_COMPETENCIAS) {
    assert.equal(res.competencias[c].soma, 24);
    assert.equal(res.competencias[c].media, 4);
    assert.equal(res.competencias[c].maximo, 30);
  }
  assert.ok(!("percentil" in res.competencias.A), "não deve haver percentil");
  assert.ok(!("nivel" in res.competencias.A), "não deve haver nível de IE");
});

test("Inteligência Emocional: soma varia de 6 a 30, média de 1 a 5, com uma casa decimal", () => {
  const min = calcularResultado(todas(1));
  const max = calcularResultado(todas(5));
  for (const c of ORDEM_COMPETENCIAS) {
    assert.equal(min.competencias[c].soma, 6);
    assert.equal(min.competencias[c].media, 1);
    assert.equal(max.competencias[c].soma, 30);
    assert.equal(max.competencias[c].media, 5);
  }
  // Média com uma casa decimal: 5 itens 5 + 1 item 2 = 27 → 4,5.
  const mista = { ...todas(5) };
  mista.a06 = 2; // competência A: cinco 5 + um 2 = 27
  assert.equal(calcularResultado(mista).competencias.A.media, 4.5);
});

test("Inteligência Emocional: destaques trazem as maiores médias, preservando empates", () => {
  // A > B > demais → dois destaques (padrão n=2).
  const base = todas(1);
  const resp = { ...base };
  for (const i of ITENS_IE) {
    if (i.competencia === "A") resp[i.id] = 5; // média 5
    else if (i.competencia === "B") resp[i.id] = 4; // média 4
  }
  const d1 = competenciasDestaque(calcularResultado(resp));
  assert.deepEqual(d1, ["A", "B"]);

  // Empate no 2º lugar: B e C empatam → três destaques (empate preservado).
  const resp2 = { ...resp };
  for (const i of ITENS_IE) if (i.competencia === "C") resp2[i.id] = 4; // C média 4 = B
  const d2 = competenciasDestaque(calcularResultado(resp2));
  assert.equal(d2.length, 3, "empate no corte inclui a terceira competência");
  assert.ok(d2.includes("B") && d2.includes("C"));
});

test("Inteligência Emocional: relatório traz 5 competências, destaques e textos", () => {
  const rel = montarRelatorio(calcularResultado(todas(3)));
  assert.equal(rel.competencias.length, 5);
  assert.ok(rel.destaques.length >= 2);
  assert.ok(rel.notaGlobal && /não mede inteligência emocional/i.test(rel.notaGlobal));
  for (const d of rel.competencias) {
    assert.ok(d.nome && d.descricao && d.sugestao);
  }
});

test("Inteligência Emocional: validação exige as 30 afirmações com valor 1–5", () => {
  const completas = todas(4);
  assert.equal(validarRespostas(completas).ok, true);
  assert.equal(contarRespondidos(completas), 30);

  const faltaUm = { ...completas }; delete faltaUm.a01;
  assert.equal(validarRespostas(faltaUm).codigo, "INCOMPLETO");

  const foraDaEscala = { ...completas, b01: 6 };
  assert.equal(validarRespostas(foraDaEscala).codigo, "INCOMPLETO");
  assert.equal(contarRespondidos(foraDaEscala), 29, "valor fora da escala não conta");

  const itemDesconhecido = { ...completas, z99: 3 };
  assert.equal(validarRespostas(itemDesconhecido).codigo, "ITEM_INVALIDO");
});

test("Inteligência Emocional: itens públicos não revelam a competência avaliada", () => {
  const pub = itensPublicos();
  assert.equal(pub.length, 30);
  for (const it of pub) {
    assert.ok(it.id && it.texto);
    assert.ok(!("competencia" in it), "não pode vazar a competência");
  }
});

// ─────────────────────────────── Rotas / autorização ─────────────────────
test("Inteligência Emocional: rotas exigem dono, retomam progresso e são idempotentes", async (t) => {
  // Flag ligada para o teste interno (em produção, padrão é desligada).
  const { base, dbPath } = await subirServidor(t, { INTELIGENCIA_EMOCIONAL_DISPONIVEL: "1" });

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
  let r = await req("/inteligencia-emocional", { cookie: tokEmpresa });
  assert.equal(r.status, 403);

  // Estado inicial do profissional 1.
  r = await req("/inteligencia-emocional", { cookie: tok1 });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.disponivel, true);
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.equal(r.corpo.competencias.length, 5);
  assert.ok(Array.isArray(r.corpo.pendencias) && r.corpo.pendencias.length > 0);
  assert.ok(!r.corpo.itens, "sem tentativa não retorna itens");

  // Inicia: 30 itens públicos, sem vazar a competência.
  r = await req("/inteligencia-emocional/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.itens.length, 30);
  const vazou = r.corpo.itens.some((it) => "competencia" in it);
  assert.equal(vazou, false, "o cliente nunca recebe a competência");

  // Concluir incompleto → 400.
  r = await req("/inteligencia-emocional/concluir", { cookie: tok1, body: { respostas: { a01: 3 } } });
  assert.equal(r.status, 400);

  // Salva progresso parcial e RETOMA.
  r = await req("/inteligencia-emocional/progresso", { cookie: tok1, body: { respostas: { a01: 4, b01: 2 } } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.progresso, 2);

  r = await req("/inteligencia-emocional", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "andamento");
  assert.equal(r.corpo.respostas.a01, 4);

  // Reiniciar retoma a mesma tentativa, preservando as respostas.
  r = await req("/inteligencia-emocional/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.corpo.retomada, true);
  assert.equal(r.corpo.respostas.a01, 4);

  // Conclui completo (tudo 3 → média 3 em todas).
  r = await req("/inteligencia-emocional/concluir", { cookie: tok1, body: { respostas: todas(3) } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado.competencias.A.media, 3);
  assert.equal(r.corpo.resultado.versao, IE_VERSAO);
  assert.ok(r.corpo.relatorio.notaGlobal);
  assert.equal(r.corpo.relatorio.competencias.length, 5);

  // Idempotente.
  r = await req("/inteligencia-emocional/concluir", { cookie: tok1, body: { respostas: todas(3) } });
  assert.equal(r.corpo.jaConcluido, true);

  // GET reflete concluído, com resultado e relatório.
  r = await req("/inteligencia-emocional", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "concluido");
  assert.ok(r.corpo.resultado.competencias.E);

  // Compartilhamento privado por padrão → liga.
  assert.equal(r.corpo.tentativa.compartilhar, false);
  r = await req("/inteligencia-emocional/compartilhamento", { cookie: tok1, body: { compartilhar: true } });
  assert.equal(r.corpo.compartilhar, true);

  // Isolamento: profissional 2 não vê a tentativa do 1.
  r = await req("/inteligencia-emocional", { cookie: tok2 });
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.ok(!r.corpo.resultado);
});

test("Inteligência Emocional: feature flag desligada mantém a avaliação fora do ar", async (t) => {
  // Sem INTELIGENCIA_EMOCIONAL_DISPONIVEL e fora do beta: indisponível (produção).
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

  let r = await req("/inteligencia-emocional");
  assert.equal(r.corpo.disponivel, false);

  // Iniciar é bloqueado no servidor, não só na interface.
  r = await req("/inteligencia-emocional/iniciar", {});
  assert.equal(r.status, 403);
});

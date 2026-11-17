import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";
import {
  BLOCOS, DISC_V2_VERSAO, calcularResultado, validarRespostas, contarRespondidos,
} from "../shared/discV2.js";

// Helpers para montar respostas a partir das alternativas oficiais (robusto ao
// esquema de ids): escolhe a alternativa de uma dimensão em cada bloco.
const altDim = (bloco, dim) => bloco.alternativas.find((a) => a.dim === dim).id;

function respostasFixas(maisPorBloco, menosPorBloco) {
  const r = {};
  BLOCOS.forEach((b, i) => {
    r[b.id] = { mais: altDim(b, maisPorBloco(i)), menos: altDim(b, menosPorBloco(i)) };
  });
  return r;
}

// ─────────────────────────────── Algoritmo ───────────────────────────────
test("DISC v1-24: pontuação por saldo soma 24/24 e saldos somam zero", () => {
  // D sempre MAIS, C sempre MENOS → D=+24, C=-24, I=S=0.
  const respostas = respostasFixas(() => "D", () => "C");
  const val = validarRespostas(respostas);
  assert.equal(val.ok, true);

  const res = calcularResultado(respostas);
  const somaMais = ["D", "I", "S", "C"].reduce((s, d) => s + res.contagens[d].mais, 0);
  const somaMenos = ["D", "I", "S", "C"].reduce((s, d) => s + res.contagens[d].menos, 0);
  assert.equal(somaMais, 24);
  assert.equal(somaMenos, 24);
  assert.equal(["D", "I", "S", "C"].reduce((s, d) => s + res.saldos[d], 0), 0);

  assert.equal(res.saldos.D, 24);
  assert.equal(res.saldos.C, -24);
  assert.equal(res.predominante, "D");
  assert.equal(res.secundario, null);      // 2º e 3º empatados em 0 → sem combinação
  assert.equal(res.apresentacao, "unica");
  assert.equal(res.label, "D");
  assert.equal(res.versao, DISC_V2_VERSAO);
});

test("DISC v1-24: combinação de duas letras só quando o 2º é destacado", () => {
  // D MAIS em 13 blocos, I MAIS em 11; C MENOS em 12, S MENOS em 12.
  const respostas = respostasFixas(
    (i) => (i < 13 ? "D" : "I"),
    (i) => (i < 12 ? "C" : "S"),
  );
  const res = calcularResultado(respostas);
  assert.equal(res.saldos.D, 13);
  assert.equal(res.saldos.I, 11);
  assert.equal(res.predominante, "D");
  assert.equal(res.secundario, "I");
  assert.equal(res.apresentacao, "combinacao");
  assert.equal(res.label, "D + I");
});

test("DISC v1-24: empate no topo gera apresentação neutra", () => {
  // D e I ambos +12 (MAIS 12 cada; MENOS C 12, S 12).
  const respostas = respostasFixas(
    (i) => (i < 12 ? "D" : "I"),
    (i) => (i < 12 ? "C" : "S"),
  );
  const res = calcularResultado(respostas);
  assert.equal(res.saldos.D, 12);
  assert.equal(res.saldos.I, 12);
  assert.equal(res.predominante, null);
  assert.equal(res.apresentacao, "neutra");
});

test("DISC v1-24: validação rejeita incompleto, iguais e alternativa inválida", () => {
  const base = respostasFixas(() => "D", () => "C");

  const semUm = { ...base }; delete semUm[BLOCOS[0].id];
  assert.equal(validarRespostas(semUm).codigo, "INCOMPLETO");

  const iguais = { ...base, [BLOCOS[0].id]: { mais: altDim(BLOCOS[0], "D"), menos: altDim(BLOCOS[0], "D") } };
  assert.equal(validarRespostas(iguais).codigo, "IGUAIS");

  const invalida = { ...base, [BLOCOS[0].id]: { mais: "xxx", menos: altDim(BLOCOS[0], "C") } };
  assert.equal(validarRespostas(invalida).codigo, "ALTERNATIVA");

  assert.equal(contarRespondidos(base), 24);
});

// ─────────────────────────────── Rotas / autorização ─────────────────────
test("DISC v1-24: rotas exigem dono, validam no servidor e são idempotentes", async (t) => {
  const { base, dbPath } = await subirServidor(t);

  // Cria dois profissionais direto no banco (WAL: o servidor enxerga o commit).
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
  let r = await req("/disc/avaliacao", { cookie: tokEmpresa });
  assert.equal(r.status, 403);

  // Estado inicial do profissional 1.
  r = await req("/disc/avaliacao", { cookie: tok1 });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.equal(r.corpo.dimensoes.length, 4);
  assert.ok(!r.corpo.blocos, "sem tentativa não retorna blocos");

  // Inicia: 24 blocos públicos, sem revelar a dimensão.
  r = await req("/disc/avaliacao/iniciar", { cookie: tok1, body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.blocos.length, 24);
  const temDim = r.corpo.blocos.some((b) => b.alternativas.some((a) => "dim" in a));
  assert.equal(temDim, false, "o cliente nunca recebe a dimensão");

  // Monta respostas completas (D mais, C menos) a partir dos blocos públicos:
  // o servidor conhece a dimensão; aqui usamos as oficiais via shared.
  const respostas = respostasFixas(() => "D", () => "C");

  // Concluir incompleto → 400.
  r = await req("/disc/avaliacao/concluir", { cookie: tok1, body: { respostas: { [BLOCOS[0].id]: respostas[BLOCOS[0].id] } } });
  assert.equal(r.status, 400);

  // Salvar progresso parcial.
  r = await req("/disc/avaliacao/progresso", { cookie: tok1, body: { respostas: { [BLOCOS[0].id]: respostas[BLOCOS[0].id] } } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.progresso, 1);

  // Concluir completo.
  r = await req("/disc/avaliacao/concluir", { cookie: tok1, body: { respostas } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado.predominante, "D");
  assert.ok(r.corpo.relatorio.cardPrincipal.titulo);

  // Idempotente.
  r = await req("/disc/avaliacao/concluir", { cookie: tok1, body: { respostas } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.jaConcluido, true);

  // GET reflete concluído, com resultado e relatório.
  r = await req("/disc/avaliacao", { cookie: tok1 });
  assert.equal(r.corpo.tentativa.status, "concluido");
  assert.equal(r.corpo.resultado.label, "D");
  assert.ok(r.corpo.relatorio.secoes.entendendo);

  // Compartilhamento privado por padrão → liga.
  assert.equal(r.corpo.tentativa.compartilhar, false);
  r = await req("/disc/avaliacao/compartilhamento", { cookie: tok1, body: { compartilhar: true } });
  assert.equal(r.corpo.compartilhar, true);

  // Isolamento: o profissional 2 não vê a tentativa do profissional 1.
  r = await req("/disc/avaliacao", { cookie: tok2 });
  assert.equal(r.corpo.tentativa.status, "nao_iniciado");
  assert.ok(!r.corpo.resultado);
});

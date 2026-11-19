import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";

// Propostas Enterprise contra o servidor de verdade (test/apoio/servidor.js).
// Sem gateway no teste: o checkout para antes de cobrar, o que basta para
// conferir validação, aceite, vínculo com a empresa e cancelamento.

test("propostas Enterprise: admin cria, empresa vê e aceita, cancelamento fecha o link", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = async (path, { body, cookie } = {}) => {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, corpo: await r.json() };
  };

  const db = new Database(dbPath);
  db.prepare("INSERT INTO companies (id, nome, produto, criadoEm) VALUES ('emp-a', 'Empresa A', '', 1)").run();
  db.prepare("INSERT INTO companies (id, nome, produto, criadoEm) VALUES ('emp-b', 'Empresa B', '', 1)").run();
  const admin = assinar({ id: "admin-teste", role: "admin", entityId: null });
  const empA = assinar({ id: "u-a", role: "empresa", entityId: "emp-a" });
  const empB = assinar({ id: "u-b", role: "empresa", entityId: "emp-b" });
  const proposta = (extra = {}) => ({
    cliente: "Cliente A", planoBase: "growth", ciclo: "SEMESTRAL", valorFinal: 2397,
    nicho: "plano de saúde", territorio: "nacional", condicoes: "Condições de teste", ...extra,
  });

  // Só o admin cria, e plano, valor e condições são conferidos.
  let r = await req("/admin/propostas", { cookie: empA, body: proposta() });
  assert.equal(r.status, 403);
  r = await req("/admin/propostas", { cookie: admin, body: proposta({ condicoes: " " }) });
  assert.equal(r.status, 400);
  r = await req("/admin/propostas", { cookie: admin, body: proposta({ valorFinal: 3 }) });
  assert.equal(r.status, 400);
  r = await req("/admin/propostas", { cookie: admin, body: proposta({ planoBase: "free" }) });
  assert.equal(r.status, 400);

  // Growth semestral com 50%: R$ 799 × 6 = R$ 4.794, pagos R$ 2.397.
  r = await req("/admin/propostas", { cookie: admin, body: proposta({ companyId: "emp-a" }) });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.valorOriginal, 4794);
  assert.equal(r.corpo.valorFinal, 2397);
  const idA = r.corpo.id;
  const tokenA = r.corpo.url.split("/proposta/")[1];
  assert.ok(tokenA);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM propostas_plano WHERE tokenHash = ?").get(tokenA).n, 0, "o token não fica no banco em claro");

  // A empresa da proposta vê tudo; outra empresa e o admin não.
  r = await req(`/proposta/${tokenA}`, { cookie: empA });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.planoNome, "Growth");
  assert.equal(r.corpo.takeRate, 0.15);
  assert.equal(r.corpo.meses, 6);
  assert.equal(r.corpo.desconto, 2397);
  assert.equal(r.corpo.precisaDocumento, true);
  r = await req(`/proposta/${tokenA}`, { cookie: empB });
  assert.equal(r.status, 403);
  r = await req(`/proposta/${tokenA}`, { cookie: admin });
  assert.equal(r.status, 403);
  r = await req("/proposta/inexistente", { cookie: empA });
  assert.equal(r.status, 404);

  // Sem aceite não há cobrança; proposta só se paga com Pix.
  r = await req("/subscription", { cookie: empA, body: { proposta: tokenA, formaPagamento: "PIX" } });
  assert.equal(r.status, 400);
  r = await req("/subscription", { cookie: empA, body: { proposta: tokenA, aceiteCondicoes: true, formaPagamento: "CREDIT_CARD" } });
  assert.equal(r.status, 400);
  assert.equal(db.prepare("SELECT aceitoEm FROM propostas_plano WHERE id = ?").get(idA).aceitoEm, null);

  // Com aceite, grava quem aceitou e o documento; sem gateway, para antes de cobrar.
  r = await req("/subscription", { cookie: empA, body: { proposta: tokenA, aceiteCondicoes: true, formaPagamento: "PIX", documento: "11.222.333/0001-81" } });
  assert.equal(r.status, 503);
  const linha = db.prepare("SELECT * FROM propostas_plano WHERE id = ?").get(idA);
  assert.ok(linha.aceitoEm);
  assert.equal(linha.aceitoPor, "u-a");
  assert.equal(linha.companyId, "emp-a");
  assert.match(linha.aceiteHash, /^[0-9a-f]{64}$/);
  assert.equal(db.prepare("SELECT documento FROM companies WHERE id = 'emp-a'").get().documento, "11222333000181");

  // Proposta sem empresa definida: a primeira que aceitar fica com ela.
  r = await req("/admin/propostas", { cookie: admin, body: proposta({ cliente: "Cliente aberto" }) });
  const tokenLivre = r.corpo.url.split("/proposta/")[1];
  r = await req("/subscription", { cookie: empB, body: { proposta: tokenLivre, aceiteCondicoes: true, formaPagamento: "PIX" } });
  assert.equal(r.status, 503);
  r = await req(`/proposta/${tokenLivre}`, { cookie: empA });
  assert.equal(r.status, 403);

  // A lista do admin mostra o estado; cancelar fecha o link.
  r = await req("/admin/propostas", { cookie: admin });
  assert.equal(r.corpo.propostas.length, 2);
  assert.equal(r.corpo.propostas.find((p) => p.id === idA).estado, "aceita");
  r = await req(`/admin/propostas/${idA}/cancelar`, { cookie: empA, body: {} });
  assert.equal(r.status, 403);
  r = await req(`/admin/propostas/${idA}/cancelar`, { cookie: admin, body: {} });
  assert.equal(r.status, 200);
  r = await req(`/proposta/${tokenA}`, { cookie: empA });
  assert.equal(r.status, 410);
  r = await req("/subscription", { cookie: empA, body: { proposta: tokenA, aceiteCondicoes: true, formaPagamento: "PIX" } });
  assert.equal(r.status, 410);

  // "Falar com a RYCS" no card Enterprise: só empresa.
  r = await req("/enterprise/interesse", { cookie: empA, body: {} });
  assert.equal(r.status, 200);
  r = await req("/enterprise/interesse", { cookie: admin, body: {} });
  assert.equal(r.status, 403);

  db.close();
});

import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";
import {
  afiliadosAtivo, comissaoCents, reaisParaCents, centsParaReais,
  nivelDe, proximoNivel, montarTrilha, NIVEIS_PROPOSTA,
} from "../shared/afiliados.js";

// ─────────────────────────────── Matemática pura ─────────────────────────
test("Afiliados: flag desligada por padrão (não ativa dinheiro novo)", () => {
  assert.equal(afiliadosAtivo(), false);
});

test("Afiliados: comissão em centavos inteiros, sem ponto flutuante", () => {
  // R$399,00 = 39900 centavos. 20% → R$79,80 (exemplo da spec).
  assert.equal(comissaoCents(39900, 20), 7980);
  assert.equal(comissaoCents(39900, 30), 11970);
  assert.equal(comissaoCents(39900, 10), 3990);
  // Casos de borda inteiros, sempre centavos.
  assert.equal(comissaoCents(0, 30), 0);
  assert.equal(comissaoCents(39900, 0), 0);
  assert.equal(comissaoCents(33333, 15), Math.round((33333 * 15) / 100)); // 5000
  assert.equal(Number.isInteger(comissaoCents(12345, 17)), true);
});

test("Afiliados: conversão reais↔centavos", () => {
  assert.equal(reaisParaCents(399), 39900);
  assert.equal(reaisParaCents(79.8), 7980);
  assert.equal(centsParaReais(7980), 79.8);
  assert.equal(centsParaReais(11970), 119.7);
});

test("Afiliados: progressão de níveis (proposta Starter/Bronze/Ouro/Elite)", () => {
  assert.equal(nivelDe(0).chave, "starter");
  assert.equal(nivelDe(2).chave, "starter");
  assert.equal(nivelDe(3).chave, "bronze");
  assert.equal(nivelDe(4).chave, "bronze");
  assert.equal(nivelDe(5).chave, "ouro");
  assert.equal(nivelDe(9).chave, "ouro");
  assert.equal(nivelDe(10).chave, "elite");
  assert.equal(nivelDe(50).chave, "elite");

  assert.equal(proximoNivel(0).nome, "Bronze");
  assert.equal(proximoNivel(0).faltam, 3);
  assert.equal(proximoNivel(4).nome, "Ouro");
  assert.equal(proximoNivel(4).faltam, 1);
  assert.equal(proximoNivel(10), null, "no topo não há próximo nível");

  const trilha = montarTrilha(4);
  assert.equal(trilha.length, NIVEIS_PROPOSTA.length);
  assert.equal(trilha.find((t) => t.chave === "bronze").atual, true);
  assert.equal(trilha.find((t) => t.chave === "starter").desbloqueado, true);
  assert.equal(trilha.find((t) => t.chave === "ouro").desbloqueado, false);
});

// ─────────────────────────────── Rotas / derivação ───────────────────────
test("Afiliados: resumo deriva das indicações reais e persiste atribuição", async (t) => {
  const { base, dbPath } = await subirServidor(t);

  const db = new Database(dbPath);
  // Afiliado (profissional) com código de indicação.
  db.prepare("INSERT INTO sellers (id, nome, email, whats, disponivel, criadoEm) VALUES (?, ?, ?, ?, 0, ?)")
    .run("s1", "Afiliado Um", "s1@teste.invalid", "11999999999", Date.now());
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, codigoIndicacao, criadoEm) VALUES (?, ?, 'x', 'vendedor', ?, 'ABC123', ?)")
    .run("u-s1", "s1@teste.invalid", "s1", Date.now());
  // Segundo profissional (isolamento).
  db.prepare("INSERT INTO sellers (id, nome, email, whats, disponivel, criadoEm) VALUES (?, ?, ?, ?, 0, ?)")
    .run("s2", "Afiliado Dois", "s2@teste.invalid", "11988888888", Date.now());
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'vendedor', ?, ?)")
    .run("u-s2", "s2@teste.invalid", "s2", Date.now());

  // Empresa indicada que PAGOU um plano (pagamentoEm preenchido na regra v2).
  db.prepare("INSERT INTO companies (id, nome, produto, plano, criadoEm) VALUES (?, ?, ?, ?, ?)")
    .run("c1", "Empresa ABC", "Produto", "starter", Date.now());
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'empresa', ?, ?)")
    .run("u-c1", "c1@teste.invalid", "c1", Date.now());
  db.prepare(`INSERT INTO referrals (id, codigo, indicadorUserId, indicadoUserId, papelIndicador, papelIndicado, valor, status, criadoEm, regra, pagamentoEm)
              VALUES (?, 'ABC123', 'u-s1', 'u-c1', 'vendedor', 'empresa', 119.70, 'pago', ?, 'v2', ?)`)
    .run("ref1", Date.now(), Date.now());

  // Empresa indicada que NÃO pagou ainda (sem pagamentoEm).
  db.prepare("INSERT INTO companies (id, nome, produto, criadoEm) VALUES (?, ?, ?, ?)")
    .run("c2", "Empresa XYZ", "Produto", Date.now());
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'empresa', ?, ?)")
    .run("u-c2", "c2@teste.invalid", "c2", Date.now());
  db.prepare(`INSERT INTO referrals (id, codigo, indicadorUserId, indicadoUserId, papelIndicador, papelIndicado, valor, status, criadoEm, regra)
              VALUES (?, 'ABC123', 'u-s1', 'u-c2', 'vendedor', 'empresa', 0, 'pendente', ?, 'v2')`)
    .run("ref2", Date.now());
  db.close();

  const tokVend = assinar({ id: "u-s1", role: "vendedor", entityId: "s1" });
  const tokVend2 = assinar({ id: "u-s2", role: "vendedor", entityId: "s2" });
  const tokEmpresa = assinar({ id: "u-c1", role: "empresa", entityId: "c1" });
  const tokAdmin = assinar({ id: "u-adm", role: "admin", entityId: "adm" });

  const req = async (path, cookie) => {
    const r = await fetch(base + path, { headers: cookie ? { Cookie: cookie } : {} });
    return { status: r.status, corpo: await r.json().catch(() => null) };
  };

  // Empresa não acessa o resumo de afiliado.
  let r = await req("/afiliados/resumo", tokEmpresa);
  assert.equal(r.status, 403);

  // Afiliado 1: duas empresas indicadas, uma pagante, comissão recebida.
  r = await req("/afiliados/resumo", tokVend);
  assert.equal(r.status, 200);
  assert.equal(r.corpo.ativo, false, "flag desligada");
  assert.equal(r.corpo.indicadores.empresasIndicadas, 2);
  assert.equal(r.corpo.indicadores.clientesPagantes, 1);
  assert.equal(r.corpo.indicadores.comissoesRecebidas, 119.7);
  // Política vigente = 30% da primeira mensalidade (regra atual preservada).
  assert.equal(r.corpo.politicaVigente.percentual, 30);
  assert.equal(r.corpo.indicadores.percentualAtual, 30);
  assert.equal(r.corpo.nivelAtual.chave, "starter"); // 1 pagante
  assert.ok(Array.isArray(r.corpo.trilha) && r.corpo.trilha.length === 4);
  assert.equal(r.corpo.empresas.length, 2);
  const abc = r.corpo.empresas.find((e) => e.companyId === "c1");
  assert.equal(abc.pagante, true);
  assert.equal(abc.linhaDoTempo.pagamentoConfirmado, true);
  assert.equal(abc.comissaoRecebida, 119.7);

  // Atribuição permanente afiliado→empresa foi persistida (idempotente).
  const db2 = new Database(dbPath);
  const attrs = db2.prepare("SELECT companyId, affiliateUserId FROM affiliate_attributions WHERE affiliateUserId = 'u-s1'").all();
  assert.equal(attrs.length, 2, "duas atribuições materializadas");
  assert.ok(attrs.some((a) => a.companyId === "c1"));
  // Idempotência: chamar o resumo de novo não duplica.
  db2.close();
  await req("/afiliados/resumo", tokVend);
  const db3 = new Database(dbPath);
  const n = db3.prepare("SELECT COUNT(*) AS n FROM affiliate_attributions WHERE affiliateUserId = 'u-s1'").get();
  assert.equal(n.n, 2, "não duplica atribuições");
  // Nenhuma comissão nova foi movimentada (tabela vazia em Incremento A).
  const nc = db3.prepare("SELECT COUNT(*) AS n FROM affiliate_commissions").get();
  assert.equal(nc.n, 0, "flag off: nenhuma comissão creditada/movimentada");
  db3.close();

  // Isolamento: profissional 2 não vê as indicações do 1.
  r = await req("/afiliados/resumo", tokVend2);
  assert.equal(r.corpo.indicadores.empresasIndicadas, 0);
  assert.equal(r.corpo.indicadores.clientesPagantes, 0);

  // Admin vê a lista; profissional e empresa não.
  r = await req("/admin/affiliates", tokAdmin);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.corpo.afiliados));
  const a1 = r.corpo.afiliados.find((a) => a.affiliateUserId === "u-s1");
  assert.ok(a1 && a1.empresas === 2 && a1.clientesPagantes === 1);
  r = await req("/admin/affiliates", tokVend);
  assert.equal(r.status, 403);
});

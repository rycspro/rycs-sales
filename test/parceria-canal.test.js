// Parceria de Canal: o parceiro ganha fechamento + recorrência + uso sobre as
// empresas da carteira dele. Dinheiro de verdade — cada cobrança gera comissão
// uma vez, estorno cancela, liberação credita uma vez.

import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente, assinar } from "./apoio/servidor.js";
import {
  nivelCanal, proximoNivelCanal, percentuaisDoParceiro, comissaoMensalidade, liberacaoDaComissao, normalizarPct,
} from "../shared/parceriaCanal.js";

// ─────────────────────────────── Matemática pura ─────────────────────────
test("Canal: níveis da recorrência por empresas pagantes", () => {
  assert.equal(nivelCanal(0).pct, 20);
  assert.equal(nivelCanal(24).pct, 20);
  assert.equal(nivelCanal(25).pct, 25);
  assert.equal(nivelCanal(99).pct, 25);
  assert.equal(nivelCanal(100).pct, 30);
  assert.equal(nivelCanal(1).nome, "Partner");
  assert.equal(nivelCanal(25).nome, "Partner Pro");
  assert.equal(nivelCanal(101).nome, "Partner Ultra");
  assert.deepEqual([proximoNivelCanal(10).nome, proximoNivelCanal(10).faltam], ["Partner Pro", 15]);
  assert.equal(proximoNivelCanal(100), null);
});

test("Canal: 101 empresas no Start a 30% = R$ 12.089,70 por mês", () => {
  const pct = percentuaisDoParceiro(null, 101);
  const porEmpresa = comissaoMensalidade({ valorCents: 39900, primeira: false, pctFechamento: pct.fechamento, pctRecorrencia: pct.recorrencia });
  assert.equal(porEmpresa.cents, 11970);
  assert.equal(porEmpresa.cents * 101, 1208970);
});

test("Canal: override do admin ganha do padrão; recorrência fixa ignora nível", () => {
  const p = percentuaisDoParceiro({ pctFechamento: 40, pctRecorrencia: 22, pctUso: null }, 150);
  assert.deepEqual([p.fechamento, p.recorrencia, p.uso, p.recorrenciaFixa], [40, 22, 10, true]);
  assert.equal(normalizarPct(""), null);
  assert.equal(normalizarPct("12,5"), 12.5);
  assert.equal(normalizarPct("101"), undefined);
});

test("Canal: primeira cobrança mensal paga fechamento; renovação paga recorrência", () => {
  const a = comissaoMensalidade({ valorCents: 39900, meses: 1, primeira: true, pctFechamento: 50, pctRecorrencia: 20 });
  assert.equal(a.cents, 19950);
  assert.deepEqual(a.partes.map((x) => x.tipo), ["fechamento"]);
  const b = comissaoMensalidade({ valorCents: 39900, meses: 1, primeira: false, pctFechamento: 50, pctRecorrencia: 20 });
  assert.equal(b.cents, 7980);
});

test("Canal: plano anual paga fechamento sobre UM mês, não sobre os 12", () => {
  // Start anual com 30% de desconto: 399 × 0,7 × 12 = R$ 3.351,60.
  const r = comissaoMensalidade({ valorCents: 335160, meses: 12, primeira: true, pctFechamento: 50, pctRecorrencia: 20 });
  assert.deepEqual(r.partes.map((x) => [x.tipo, x.baseCents, x.cents]), [["fechamento", 27930, 13965], ["recorrencia", 307230, 61446]]);
  assert.equal(r.cents, 75411);
});

test("Canal: comissão libera no 1º dia do mês seguinte (horário de Brasília)", () => {
  assert.equal(liberacaoDaComissao(Date.UTC(2026, 10, 19, 15)), Date.UTC(2026, 11, 1, 3));
  // 30/11 às 23h em Brasília ainda é novembro.
  assert.equal(liberacaoDaComissao(Date.UTC(2026, 11, 1, 2)), Date.UTC(2026, 11, 1, 3));
  // 01/12 à 01h em Brasília já é dezembro.
  assert.equal(liberacaoDaComissao(Date.UTC(2026, 11, 1, 4)), Date.UTC(2027, 0, 1, 3));
});

// ─────────────────────────────── Fluxo real ───────────────────────────────
test("Canal: webhook → comissão → estorno → liberação → uso", async (t) => {
  const { base, dbPath } = await subirServidor(t, { ASAAS_WEBHOOK_TOKEN: "tok" });
  const db = new Database(dbPath);
  t.after(() => db.close());
  const agora = Date.now();

  // Parceiro (profissional) e uma empresa da carteira dele.
  db.prepare("INSERT INTO sellers (id, nome, email, whats, disponivel, criadoEm) VALUES ('s-p', 'Parceiro', 'parceiro@teste.invalid', '11911112222', 0, ?)").run(agora);
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, codigoIndicacao, criadoEm) VALUES ('u-p', 'parceiro@teste.invalid', 'x', 'vendedor', 's-p', 'PARC234', ?)").run(agora);
  db.prepare("INSERT INTO companies (id, nome, produto, saldo, saldoReservado, assinatura, criadoEm) VALUES ('c1', 'Carteira Um', 'Produto', 100, 100, 'starter', ?)").run(agora);
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES ('u-c1', 'c1@teste.invalid', 'x', 'empresa', 'c1', ?)").run(agora);
  db.prepare(`INSERT INTO referrals (id, codigo, indicadorUserId, indicadoUserId, papelIndicador, papelIndicado, valor, status, criadoEm, regra)
              VALUES ('ref1', 'PARC234', 'u-p', 'u-c1', 'vendedor', 'empresa', 0, 'pendente', ?, 'v2')`).run(agora);
  db.prepare("INSERT INTO subscriptions (id, companyId, plano, status, asaasId, valor, ciclo, criadoEm) VALUES ('sub1', 'c1', 'starter', 'pendente', 'sub_asaas_1', 399, 'MENSAL', ?)").run(agora);

  const req = cliente(base);
  const admin = assinar({ id: "u-adm", role: "admin", entityId: "adm" });
  const parceiro = assinar({ id: "u-p", role: "vendedor", entityId: "s-p" });
  const hook = (event, id, value = 399) => req("/payments/webhook", {
    headers: { "asaas-access-token": "tok" },
    body: { id: `evt_${event}_${id}`, event, payment: { id, subscription: "sub_asaas_1", value } },
  });
  const comissoes = () => db.prepare("SELECT * FROM affiliate_commissions WHERE policy = 'canal-v1' ORDER BY criadoEm, tipo").all();
  const seller = () => db.prepare("SELECT disponivel, pendente FROM sellers WHERE id = 's-p'").get();

  // Admin: só conta de profissional vira parceiro.
  let r = await req("/admin/parceiros-canal", { cookie: admin, body: { email: "c1@teste.invalid" } });
  assert.equal(r.status, 400);
  r = await req("/admin/parceiros-canal", { cookie: admin, body: { email: "ninguem@teste.invalid" } });
  assert.equal(r.status, 404);
  r = await req("/admin/parceiros-canal", { cookie: parceiro, body: { email: "parceiro@teste.invalid" } });
  assert.equal(r.status, 403, "profissional não se ativa sozinho");
  r = await req("/admin/parceiros-canal", { cookie: admin, body: { email: "Parceiro@teste.invalid", pctFechamento: "", pctRecorrencia: "", pctUso: "" } });
  assert.equal(r.status, 200);
  assert.deepEqual([r.corpo.vigentes.fechamento, r.corpo.vigentes.recorrencia, r.corpo.vigentes.uso], [50, 20, 10]);
  const parceiroId = r.corpo.id;

  // 1ª mensalidade: 50% de R$ 399, aguardando liberação. Não paga os 30% da regra comum.
  await hook("PAYMENT_RECEIVED", "pay_1");
  await hook("PAYMENT_CONFIRMED", "pay_1"); // mesmo pagamento, evento diferente
  let cs = comissoes();
  assert.equal(cs.length, 1, "uma comissão por cobrança");
  assert.deepEqual([cs[0].tipo, cs[0].comissaoCents, cs[0].status], ["fechamento", 19950, "pendente"]);
  assert.deepEqual(seller(), { disponivel: 0, pendente: 199.5 });
  assert.ok(db.prepare("SELECT pagamentoEm FROM referrals WHERE id = 'ref1'").get().pagamentoEm, "empresa marcada como pagante");

  // Renovação: 20% (nível Partner).
  await hook("PAYMENT_RECEIVED", "pay_2");
  cs = comissoes();
  assert.equal(cs.length, 2);
  assert.deepEqual([cs[1].tipo, cs[1].comissaoCents], ["recorrencia", 7980]);
  assert.equal(seller().pendente, 279.3);

  // Estorno antes da liberação: cancela só a comissão daquela cobrança.
  await hook("PAYMENT_REFUNDED", "pay_2");
  assert.equal(db.prepare("SELECT status FROM affiliate_commissions WHERE providerPaymentId = 'pay_2'").get().status, "cancelada");
  assert.equal(seller().pendente, 199.5);

  // Liberação: nada antes da data; depois da data, uma vez só.
  r = await req("/admin/parceiros-canal/liberar", { cookie: admin, body: {} });
  assert.equal(r.corpo.liberadas, 0, "não antecipa comissão");
  db.prepare("UPDATE affiliate_commissions SET disponivelEm = ? WHERE status = 'pendente'").run(agora - 1000);
  r = await req("/admin/parceiros-canal/liberar", { cookie: admin, body: {} });
  assert.deepEqual([r.corpo.liberadas, r.corpo.totalCents], [1, 19950]);
  r = await req("/admin/parceiros-canal/liberar", { cookie: admin, body: {} });
  assert.equal(r.corpo.liberadas, 0, "liberar de novo não credita de novo");
  assert.deepEqual(seller(), { disponivel: 199.5, pendente: 0 });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM financial_ledger WHERE tipo = 'comissao_canal' AND sellerId = 's-p'").get().n, 1);

  // Uso: ação liberada de R$ 100 com R$ 20 de taxa → 10% = R$ 2,00.
  db.prepare("INSERT INTO sellers (id, nome, email, whats, disponivel, criadoEm) VALUES ('s-w', 'Vendedor', 'w@teste.invalid', '11933334444', 0, ?)").run(agora);
  db.prepare("INSERT INTO submissions (id, sellerId, companyId, tipo, valor, liquido, status, criadoEm) VALUES ('sb1', 's-w', 'c1', 'agendamento', 100, 80, 'conferido', ?)").run(agora);
  r = await req("/submissions/sb1/liberar", { cookie: admin, body: {} });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  const uso = db.prepare("SELECT * FROM affiliate_commissions WHERE tipo = 'uso'").get();
  assert.deepEqual([uso.baseCents, uso.comissaoCents, uso.status], [2000, 200, "pendente"]);
  assert.equal(db.prepare("SELECT disponivel FROM sellers WHERE id = 's-w'").get().disponivel, 80, "o vendedor recebe igual");

  // Painel do parceiro.
  r = await req("/parceiro-canal/resumo", { cookie: parceiro });
  assert.equal(r.corpo.ativo, true);
  assert.equal(r.corpo.empresasNaCarteira, 1);
  assert.equal(r.corpo.totais.liberadoCents, 19950);
  assert.equal(r.corpo.totais.pendenteCents, 200);

  // Parceiro inativado: novas cobranças não geram comissão.
  r = await req(`/admin/parceiros-canal/${parceiroId}`, { cookie: admin, method: "PATCH", body: { status: "inativo" } });
  assert.equal(r.status, 200);
  await hook("PAYMENT_RECEIVED", "pay_3");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM affiliate_commissions WHERE providerPaymentId = 'pay_3'").get().n, 0);
  r = await req("/parceiro-canal/resumo", { cookie: parceiro });
  assert.equal(r.corpo.ativo, false);
});

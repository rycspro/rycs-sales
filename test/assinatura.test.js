import test from "node:test";
import assert from "node:assert/strict";
import { acessoDaEmpresa, estadoDaAssinatura, diasDeTrialRestantes, ESTADOS } from "../shared/assinatura.js";
import { ORDEM_PLANOS, PLANOS } from "../shared/planos.js";
import { podeConcederTrialSecreto } from "../shared/trialSecreto.js";

const AGORA = Date.parse("2026-09-21T12:00:00Z");
const emDias = (n) => AGORA + n * 86400000;

test("assinatura ativa libera o acesso", () => {
  const r = acessoDaEmpresa({ empresa: {}, assinatura: { status: "ativa", plano: "starter" } }, AGORA);
  assert.equal(r.estado, ESTADOS.ativa);
  assert.equal(r.liberado, true);
});

test("trial em andamento libera o acesso", () => {
  const r = acessoDaEmpresa({ empresa: {}, assinatura: { status: "trial", plano: "growth", trialFim: emDias(5) } }, AGORA);
  assert.equal(r.estado, ESTADOS.trial);
  assert.equal(r.liberado, true);
  assert.equal(diasDeTrialRestantes({ trialFim: emDias(5) }, AGORA), 5);
});

test("trial vencido deixa de liberar", () => {
  // Sem esta regra, uma assinatura esquecida em 'trial' daria acesso vitalício
  // de graça — basta o webhook da primeira cobrança nunca chegar.
  //
  // Sem forma de pagamento registrada, o vencimento é fim de cortesia, não
  // falha de cobrança: os dois casos têm mensagens diferentes logo abaixo.
  const r = acessoDaEmpresa({ empresa: {}, assinatura: { status: "trial", plano: "growth", trialFim: emDias(-1) } }, AGORA);
  assert.equal(r.estado, ESTADOS.trialFim);
  assert.equal(r.liberado, false);
});

test("empresa sem assinatura vai escolher plano", () => {
  const r = acessoDaEmpresa({ empresa: {}, assinatura: null }, AGORA);
  assert.equal(r.estado, ESTADOS.sem);
  assert.equal(r.liberado, false);
  assert.equal(r.acao, "escolher-plano");
  assert.match(r.titulo, /Ative seu plano/);
});

test("plano free antigo conta como sem assinatura", () => {
  // O gratuito deixou de existir. Quem ficou nele precisa escolher um plano,
  // igual a uma empresa nova.
  const r = acessoDaEmpresa({ empresa: { assinatura: "free" }, assinatura: null }, AGORA);
  assert.equal(r.estado, ESTADOS.sem);
  assert.equal(r.liberado, false);
});

test("empresa antiga com plano pago na conta continua liberada", () => {
  // Cadastrada antes deste sistema: tem `assinatura` em companies e nenhuma
  // linha em subscriptions. Derrubar o acesso dela seria punir o cliente por
  // uma mudança nossa.
  const r = acessoDaEmpresa({ empresa: { assinatura: "growth" }, assinatura: null }, AGORA);
  assert.equal(r.estado, ESTADOS.ativa);
  assert.equal(r.liberado, true);
  assert.equal(r.plano, "growth");
});

test("checkout pendente não libera, mas também não acusa inadimplência", () => {
  const r = acessoDaEmpresa({ empresa: {}, assinatura: { status: "pendente", plano: "starter" } }, AGORA);
  assert.equal(r.estado, ESTADOS.pendente);
  assert.equal(r.liberado, false);
  assert.equal(r.acao, "aguardar");
  assert.match(r.mensagem, /Start/);
});

test("pagamento vencido pede regularização sem apagar nada", () => {
  const r = acessoDaEmpresa({ empresa: { assinatura: "scale" }, assinatura: { status: "inadimplente", plano: "scale" } }, AGORA);
  assert.equal(r.liberado, false);
  assert.match(r.titulo, /Não conseguimos processar/);
  assert.match(r.mensagem, /dados continuam salvos/);
});

test("assinatura cancelada volta a ser sem assinatura", () => {
  assert.equal(estadoDaAssinatura({ status: "cancelada" }, AGORA), ESTADOS.sem);
});

test("os nomes de status do gateway são aceitos junto com os nossos", () => {
  // O Asaas responde em inglês; o banco guarda em português. A regra precisa
  // entender os dois ou um deles vira "sem assinatura" silenciosamente.
  assert.equal(estadoDaAssinatura({ status: "active" }, AGORA), ESTADOS.ativa);
  assert.equal(estadoDaAssinatura({ status: "overdue" }, AGORA), ESTADOS.inadimplente);
  assert.equal(estadoDaAssinatura({ status: "trialing", trialFim: emDias(3) }, AGORA), ESTADOS.trial);
});

test("nenhum estado devolve instrução de apagar empresa", () => {
  // A regra bloqueia acesso; ela nunca remove conta. Se algum dia alguém
  // adicionar uma ação destrutiva aqui, este teste quebra.
  for (const status of ["ativa", "trial", "pendente", "inadimplente", "cancelada", null]) {
    const r = acessoDaEmpresa({ empresa: {}, assinatura: status ? { status, trialFim: emDias(2) } : null }, AGORA);
    assert.ok(!/excluir|apagar|remover|delete/i.test(r.acao || ""), `ação destrutiva em ${status}`);
  }
});

test("sem assinatura não exibe plano nenhum", () => {
  // "free" ao lado de "Sem assinatura" seriam duas informações que se
  // contradizem na mesma linha do painel.
  const r = acessoDaEmpresa({ empresa: { assinatura: "free" }, assinatura: null }, AGORA);
  assert.equal(r.plano, null);
});

test("trial de cortesia que vence não acusa falha de pagamento", () => {
  // Quem ganhou o trial por convite nunca informou cartão. Dizer "não
  // conseguimos processar seu pagamento" manda a pessoa caçar um problema
  // inexistente — e o caminho certo é escolher um plano.
  const r = acessoDaEmpresa({
    empresa: { assinatura: "growth" },
    assinatura: { status: "trial", plano: "growth", trialFim: emDias(-1), formaPagamento: "ADMIN_TRIAL" },
  }, AGORA);
  assert.equal(r.liberado, false);
  assert.equal(r.acao, "escolher-plano");
  assert.match(r.titulo, /período gratuito terminou/);
  assert.match(r.mensagem, /continuam salvos/);
});

test("trial com cartão que vence continua sendo falha de cobrança", () => {
  const r = acessoDaEmpresa({
    empresa: {},
    assinatura: { status: "trial", plano: "growth", trialFim: emDias(-1), formaPagamento: "CREDIT_CARD" },
  }, AGORA);
  assert.equal(r.acao, "atualizar-pagamento");
});

// ── Empresa premium ─────────────────────────────────────────────────────────
//
// Premium é marca da plataforma sobre a empresa: ela opera sem precisar pagar
// plano. É o único caso em que a cobrança não decide o acesso — e por isso
// cada regra abaixo existe para impedir que a marca vaze para onde não deve.

test("premium entra sem assinatura nenhuma", () => {
  const r = acessoDaEmpresa({ empresa: { tipoEmpresa: "premium" }, assinatura: null }, AGORA);
  assert.equal(r.liberado, true);
  assert.equal(r.estado, ESTADOS.premium);
  assert.equal(r.plano, "premium");
  assert.equal(r.acao, null);
  assert.equal(r.titulo, "");
});

test("premium com cobrança falhada continua liberada", () => {
  // Sem isto, marcar a empresa como premium não resolveria nada: a assinatura
  // antiga em aberto continuaria derrubando o acesso dela.
  const r = acessoDaEmpresa({
    empresa: { tipoEmpresa: "premium" },
    assinatura: { status: "inadimplente", plano: "scale" },
  }, AGORA);
  assert.equal(r.liberado, true);
  assert.equal(r.estado, ESTADOS.premium);
});

test("premium que escolhe pagar aparece com o plano que pagou", () => {
  // Pagar é opcional para premium, não proibido. Quem assinou precisa ver o
  // próprio plano no painel, e não "Premium" no lugar dele.
  const r = acessoDaEmpresa({
    empresa: { tipoEmpresa: "premium", assinatura: "growth" },
    assinatura: { status: "ativa", plano: "growth" },
  }, AGORA);
  assert.equal(r.liberado, true);
  assert.equal(r.plano, "growth");
});

test("voltar a padrão devolve a empresa às regras de cobrança", () => {
  const r = acessoDaEmpresa({ empresa: { tipoEmpresa: "padrao" }, assinatura: null }, AGORA);
  assert.equal(r.liberado, false);
  assert.equal(r.acao, "escolher-plano");
});

test("premium não é plano a vender: fica fora da vitrine", () => {
  // Se entrasse em ORDEM_PLANOS, apareceria no checkout como plano de R$ 0 e
  // qualquer empresa se tornaria premium sozinha.
  assert.equal(ORDEM_PLANOS.includes("premium"), false);
  assert.equal(PLANOS.premium.preco, 0);
});

test("premium não consome o trial da empresa", () => {
  const r = podeConcederTrialSecreto({ estadoAtual: ESTADOS.premium, jaUsouTrial: false });
  assert.equal(r.ok, false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { detectarObjetivo, sugerirInterno } from "../server/services/campanhaAssistida.js";
import { montarCampanha, ticketEmNumero } from "../shared/objetivosCampanha.js";

const empresa = { nome: "Nexo CRM", produto: "CRM para distribuidoras", ticket: "R$ 890/mês", icp: "Distribuidoras" };

test("o objetivo sai do que a pessoa pediu, não de palavra solta", () => {
  assert.equal(detectarObjetivo("preciso de reuniões com distribuidoras"), "reunioes");
  assert.equal(detectarObjetivo("quero abrir mercado novo no Nordeste"), "prospeccao");
  assert.equal(detectarObjetivo("quero vender porta a porta em condomínios"), "campo");
  assert.equal(detectarObjetivo("preciso reativar minha base parada"), "reativacao");
});

test("quem fala em fechar contrato pede closer, mesmo citando reunião", () => {
  // A ordem das pistas existe por isso: "reunião" aparece em quase todo pedido
  // e capturaria tudo para SDR se viesse primeiro.
  assert.equal(detectarObjetivo("quero fechar mais contratos, já tenho reunião marcada"), "vendas");
});

test("pedido sem objetivo reconhecível não vira campanha inventada", () => {
  const r = sugerirInterno({ empresa, brief: "preciso de ajuda com o meu negócio urgente" });
  assert.equal(r.campanha, null);
  assert.match(r.explicacao, /Não consegui identificar o objetivo/);
});

test("região em minúscula é reconhecida, não só nome próprio", () => {
  const a = sugerirInterno({ empresa, brief: "preciso de reuniões no interior de SP" });
  assert.equal(a.campanha.regiao, "interior de SP");

  const b = sugerirInterno({ empresa, brief: "quero agendar reuniões em Campinas" });
  assert.equal(b.campanha.regiao, "Campinas");

  const c = sugerirInterno({ empresa, brief: "agendar reuniões na zona sul" });
  assert.equal(c.campanha.regiao, "zona sul");
});

test("a região não arrasta o resto da frase junto", () => {
  const r = sugerirInterno({ empresa, brief: "reuniões no interior de SP, quem fecha é meu time" });
  assert.equal(r.campanha.regiao, "interior de SP");
  assert.doesNotMatch(r.campanha.regiao, /quem|fecha|time/);
});

test("valores por ação saem do ticket da empresa, e zeram sem ticket", () => {
  const com = montarCampanha("reunioes", empresa);
  assert.ok(com.tarefas.agendamento > 0);
  assert.ok(com.tarefas.realizada > com.tarefas.agendamento, "reunião realizada vale mais que agendada");
  assert.equal(com.valoresDerivadosDoTicket, true);

  // Sem ticket, zero e aviso — nunca um número arbitrário apresentado como
  // sugestão. Preço inventado aqui é o que o vendedor lê como promessa.
  const sem = montarCampanha("reunioes", { nome: "X" });
  assert.equal(sem.tarefas.agendamento, 0);
  assert.equal(sem.valoresDerivadosDoTicket, false);
});

test("cada objetivo traz a função e as ações que fazem sentido nele", () => {
  assert.equal(montarCampanha("vendas", empresa).funcao, "closer");
  assert.equal(montarCampanha("prospeccao", empresa).funcao, "bdr");
  assert.equal(montarCampanha("campo", empresa).funcao, "pap");
  assert.ok("venda" in montarCampanha("vendas", empresa).tarefas);
  assert.ok(!("venda" in montarCampanha("reunioes", empresa).tarefas));
});

test("toda ação remunerada nasce com evidência e critério exigidos", () => {
  // Ação sem prova definida é ação que a auditoria não consegue julgar.
  const c = montarCampanha("campo", empresa);
  for (const acao of Object.keys(c.tarefas)) {
    assert.ok(c.evidencias[acao]?.length, `${acao} sem evidência`);
    assert.ok(c.criteriosAprovacao[acao], `${acao} sem critério`);
  }
});

test("ticket em texto brasileiro vira número", () => {
  assert.equal(ticketEmNumero("R$ 1.490,50/mês"), 1490.5);
  assert.equal(ticketEmNumero("R$ 890/mês"), 890);
  assert.equal(ticketEmNumero("a combinar"), null);
});

test("mesmo pedido gera exatamente a mesma campanha", () => {
  const brief = "quero agendar reuniões com distribuidoras no interior de SP";
  assert.deepEqual(sugerirInterno({ empresa, brief }), sugerirInterno({ empresa, brief }));
});

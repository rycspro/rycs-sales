import test from "node:test";
import assert from "node:assert/strict";
import { numeroDe, taxaDe, multiploDe, interpretar, interpretarAjuste, interpretarResposta, proximoCampo, perguntar, reagir, resumo, calcularTarefasJarvas, paraFala, confirmaMontagem, pareceEco, segmentosDeFala, frasesFixas } from "../shared/jarvas.js";

// Jarvas (shared/jarvas.js): entende português do dia a dia, pula o que já
// sabe e reage com conta de verdade, sem provedor externo.

test("números em algarismo, abreviados e por extenso", () => {
  assert.equal(numeroDe("R$ 2.500,00"), 2500);
  assert.equal(numeroDe("uns 5 mil"), 5000);
  assert.equal(numeroDe("3k"), 3000);
  assert.equal(numeroDe("1,5 mil"), 1500);
  assert.equal(numeroDe("dois mil e quinhentos"), 2500);
  assert.equal(numeroDe("três"), 3);
  assert.equal(numeroDe("sem número"), null);
});

test("uma frase livre responde várias perguntas de uma vez", () => {
  assert.deepEqual(interpretar("preciso de 3 vendedores em Sorocaba visitando indústrias"), { objetivo: "visitas", regiao: "Sorocaba", vagas: 3 });
  assert.deepEqual(interpretar("quero agendar reuniões, ticket de 8 mil, pagar até 3 mil por mês por profissional"),
    { objetivo: "reunioes", ticketMedio: 8000, fixoMensal: 3000 });
});

test("resposta curta vale para a pergunta em aberto, sem trocar o objetivo", () => {
  assert.deepEqual(interpretar("Sorocaba", "regiao"), { regiao: "Sorocaba" });
  assert.deepEqual(interpretar("dois", "vagas"), { vagas: 2 });
  assert.deepEqual(interpretar("5 visitas por dia", "visitasPorDia"), { visitasPorDia: 5 });
  assert.deepEqual(interpretar("não sei ainda", "ticketMedio"), { ticketMedio: 0 });
  assert.deepEqual(interpretar("blá", "vagas"), {}, "não entendeu: pede de novo");
});

test("ajustes no resumo", () => {
  assert.deepEqual(interpretarAjuste("muda para 4 profissionais"), { vagas: 4 });
  assert.deepEqual(interpretarAjuste("região: Jundiaí"), { regiao: "Jundiaí" });
  assert.deepEqual(interpretarAjuste("ticket 10 mil"), { ticketMedio: 10000 });
});

test("condução: pula o que já sabe e só pergunta visitas por dia quando faz sentido", () => {
  assert.equal(proximoCampo({}), "objetivo");
  assert.equal(proximoCampo({ objetivo: "reunioes", regiao: "SP", publico: "x", vagas: 2, ticketMedio: 0 }), "fixoMensal");
  assert.equal(proximoCampo({ objetivo: "visitas", regiao: "SP", publico: "x", vagas: 2, ticketMedio: 0 }), "visitasPorDia");
  const p = perguntar("ticketMedio", { objetivo: "reunioes" }, { ticket: "R$ 890" });
  assert.match(p.texto, /R\$\s?890/);
  assert.deepEqual(p.chips[0].patch, { ticketMedio: 890 });
});

test("reage com as contas, sem inventar quando falta dado", () => {
  // Sem conversão conhecida: pelo orçamento mensal.
  const r = { objetivo: "visitas", regiao: "Sorocaba", publico: "Indústrias", vagas: 3, ticketMedio: 890, conversao: 0, visitasPorDia: 6, fixoMensal: 2500 };
  const { tarefas, orcamento } = calcularTarefasJarvas(r);
  assert.equal(orcamento, 7500);
  assert.equal(tarefas.visita, Math.round(2500 / 22 / 6));
  assert.match(reagir({ fixoMensal: 2500 }, r), /R\$\s?19 por visita\. R\$\s?7\.500 por mês\./);
  const linhas = Object.fromEntries(resumo(r));
  assert.equal(linhas["Investimento mensal"].replace(/\s/g, " "), "R$ 7.500");
  assert.equal(linhas["Profissionais"], "3 de PAP");
});

test("pelo retorno: mostra o resultado antes do custo e fecha a conta do mês", () => {
  assert.equal(taxaDe("3 de 10"), 0.3);
  assert.equal(taxaDe("30%"), 0.3);
  assert.equal(taxaDe("1 em 4"), 0.25);
  assert.equal(multiploDe("5x"), 5);
  assert.equal(multiploDe("500%"), 5);

  let r = { objetivo: "reunioes", regiao: "Sorocaba", publico: "Indústrias", vagas: 2, ticketMedio: 5000 };
  assert.equal(proximoCampo(r), "conversao");
  r.conversao = 0.3;
  assert.match(reagir({ conversao: 0.3 }, r), /^10 reuniões: R\$\s?15\.000\.$/);
  assert.equal(proximoCampo(r), "retorno");
  r.retorno = 5;
  // Custo só depois do retorno: R$ 3.000 a cada 10 reuniões = R$ 180 por reunião + R$ 400 por venda.
  assert.match(reagir({ retorno: 5 }, r), /^R\$\s?180 por reunião\. R\$\s?400 por venda\.$/);
  assert.equal(proximoCampo(r), "meta");
  r.meta = 40;
  const { tarefas, orcamento, roi } = calcularTarefasJarvas(r);
  assert.deepEqual(tarefas, { agendamento: 180, venda: 400 });
  assert.equal(orcamento, 12000);
  assert.deepEqual([roi.vendas, roi.receita, roi.multiplo], [12, 60000, 5]);
  assert.match(reagir({ meta: 40 }, r), /^12 vendas\. R\$\s?60\.000 por mês\. Custo: R\$\s?12\.000\.$/);
  assert.equal(proximoCampo(r), null);
  assert.equal(Object.fromEntries(resumo(r))["Retorno estimado"], "5 vezes");

  // Fechamento: comissão = ticket ÷ retorno. Sem conversão: pelo orçamento, sem prometer retorno.
  assert.equal(calcularTarefasJarvas({ objetivo: "vendas", ticketMedio: 10000, retorno: 4, meta: 8 }).tarefas.venda, 2500);
  const semTaxa = { objetivo: "reunioes", regiao: "SP", publico: "x", vagas: 2, ticketMedio: 5000, conversao: 0 };
  assert.equal(proximoCampo(semTaxa), "fixoMensal");
  assert.match(reagir({ conversao: 0 }, semTaxa), /Sem a taxa, vamos pelo orçamento/);
});

test("voz: texto falado e confirmação por voz", () => {
  assert.equal(paraFala("Custa R$ 19. Total R$ 7.500,00\n\nVou buscar \"PAP\"."), "Custa 19 reais. Total 7.500 reais Vou buscar porta a porta.");
  assert.ok(confirmaMontagem("tá certo, pode montar"));
  assert.ok(!confirmaMontagem("muda para 3 profissionais"));
});

test("perguntas curtas, de no máximo 6 palavras", () => {
  const r = { objetivo: "reunioes", ticketMedio: 5000 };
  for (const campo of ["objetivo", "regiao", "vagas", "conversao", "retorno", "meta", "visitasPorDia", "fixoMensal"]) {
    const palavras = perguntar(campo, r, {}).texto.split(/\s+/).length;
    assert.ok(palavras <= 6, `${campo}: "${perguntar(campo, r, {}).texto}"`);
  }
  assert.equal(perguntar("ticketMedio", r, { ticket: "R$ 5.000" }).texto.replace(/\s/g, " "), "Ticket: R$ 5.000. Confirma?");
});

test("entende o contexto: confirmações, mudanças a qualquer momento e eco da própria voz", () => {
  const emp = { ticket: "R$ 5.000", icp: "Distribuidoras" };
  assert.deepEqual(interpretarResposta("Mantenho", "publico", {}, emp), { publico: "Distribuidoras" });
  assert.deepEqual(interpretarResposta("sim", "ticketMedio", {}, emp), { ticketMedio: 5000 });
  assert.deepEqual(interpretarResposta("muda o tíquete médio para 8 mil", "ajuste", {}, emp), { ticketMedio: 8000 });
  assert.deepEqual(interpretarResposta("na verdade a região é Campinas", "conversao", {}, emp), { regiao: "Campinas" });
  assert.deepEqual(interpretarResposta("coloca 4 profissionais", "retorno", {}, emp), { vagas: 4 });
  assert.deepEqual(interpretarResposta("indústrias com 10 profissionais", "publico", {}, emp), { publico: "Indústrias com 10 profissionais" });

  const antes = { objetivo: "reunioes", regiao: "SP", publico: "x", vagas: 2, ticketMedio: 5000, conversao: 0.3, retorno: 5, meta: 40 };
  const depois = { ...antes, ticketMedio: 8000 };
  assert.match(reagir({ ticketMedio: 8000 }, depois, emp, antes), /^Feito\. R\$\s?288 por reunião\. R\$\s?96\.000 por mês\. Custo: R\$\s?19\.200\.$/);
  assert.equal(reagir({ vagas: 3 }, { ...antes, vagas: 3 }, emp, antes), "Feito.");

  assert.ok(pareceEco("quantos profissionais", "Quantos profissionais?"));
  assert.ok(!pareceEco("três profissionais", "Quantos profissionais?"));
  assert.ok(confirmaMontagem("pode"));
});

test("voz por frase: fixas gravadas uma vez, só a frase com número da empresa gasta", () => {
  assert.deepEqual(segmentosDeFala("Ticket médio de R$ 5.000. Confirma?"), ["Ticket médio de R$ 5.000.", "Confirma?"]);
  assert.deepEqual(segmentosDeFala("Então 10 reuniões viram R$ 15.000 em vendas. Quer quantas vezes de retorno?"),
    ["Então 10 reuniões viram R$ 15.000 em vendas.", "Quer quantas vezes de retorno?"]);
  const fixas = frasesFixas();
  for (const f of ["Confirma?", "Mantenho?", "Quantos profissionais?", "Quer quantas vezes de retorno?", "Oi, sou o Jarvas.", "Posso montar?"])
    assert.ok(fixas.includes(f), f);
  assert.ok(!fixas.some((f) => /R\$|\d{3}/.test(f)), "nenhuma frase fixa tem valor de empresa");
  assert.ok(fixas.join("").length < 1000, "as fixas inteiras custam menos de 1.000 caracteres");
});

test("frases que gastam crédito: curtas e só com número", () => {
  const fixas = new Set(frasesFixas());
  const r = { objetivo: "reunioes", regiao: "SP", publico: "x", vagas: 2, ticketMedio: 5000, conversao: 0.3, retorno: 5, meta: 40 };
  const pagas = [reagir({ conversao: 0.3 }, r), reagir({ retorno: 5 }, r), reagir({ meta: 40 }, r)]
    .flatMap(segmentosDeFala).filter((f) => !fixas.has(f));
  for (const f of pagas) assert.ok(f.split(/\s+/).length <= 4 && /\d/.test(f), f);
  assert.ok(fixas.has("Feito."));
});

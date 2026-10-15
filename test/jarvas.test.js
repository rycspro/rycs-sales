import test from "node:test";
import assert from "node:assert/strict";
import { numeroDe, interpretar, interpretarAjuste, proximoCampo, perguntar, reagir, resumo, calcularTarefasJarvas } from "../shared/jarvas.js";

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
  const r = { objetivo: "visitas", regiao: "Sorocaba", publico: "Indústrias", vagas: 3, ticketMedio: 890, visitasPorDia: 6, fixoMensal: 2500 };
  const { tarefas, orcamento } = calcularTarefasJarvas(r);
  assert.equal(orcamento, 7500);
  assert.equal(tarefas.visita, Math.round(2500 / 22 / 6));
  assert.match(reagir({ fixoMensal: 2500 }, r), /cada visita sai por cerca de R\$\s?19.*R\$\s?7\.500/);
  assert.match(reagir({ ticketMedio: 0 }, { ...r, ticketMedio: 0 }), /em aberto/);
  const linhas = Object.fromEntries(resumo(r));
  assert.equal(linhas["Orçamento mensal"].replace(/\s/g, " "), "R$ 7.500");
  assert.equal(linhas["Profissionais"], "3 de PAP");
});

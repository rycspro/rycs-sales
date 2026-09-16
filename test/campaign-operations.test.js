import test from "node:test";
import assert from "node:assert/strict";
import { projetarOrcamento, variacaoPercentual } from "../shared/campaignOperations.js";

test("variação só é exibida quando existe histórico comparável", () => {
  assert.equal(variacaoPercentual(18, 15), 20);
  assert.equal(variacaoPercentual(8, 10), -20);
  assert.equal(variacaoPercentual(8, 0), null);
});

test("projeção de orçamento usa somente consumo observado", () => {
  assert.deepEqual(projetarOrcamento({ gastoMes: 1000, orcamento: 4000, saldoDisponivel: 3000, diaDoMes: 10, diasNoMes: 30 }), {
    gastoMedioDiario: 100, projecaoFechamento: 3000, diasRestantes: 30, percentual: 25, risco: "dentro",
  });
});

test("projeção sem consumo não inventa duração ou tendência", () => {
  const resultado = projetarOrcamento({ gastoMes: 0, orcamento: 5000, saldoDisponivel: 5000, diaDoMes: 8, diasNoMes: 30 });
  assert.equal(resultado.gastoMedioDiario, 0);
  assert.equal(resultado.projecaoFechamento, 0);
  assert.equal(resultado.diasRestantes, null);
  assert.equal(resultado.risco, "dentro");
});

import test from "node:test";
import assert from "node:assert/strict";
import { dadosRelatorio } from "../shared/reporting.js";

test("relatório de conversão usa apenas tarefas aprovadas", () => {
  const dados = dadosRelatorio({ tipo: "conversao", submissions: [{ tipo: "agendamento", status: "liberado" }, { tipo: "realizada", status: "liberado" }, { tipo: "venda", status: "liberado", prova: { valorContrato: "R$ 500,00" } }, { tipo: "venda", status: "recusado", prova: { valorContrato: "R$ 900,00" } }] });
  assert.equal(dados.agendadas, 1); assert.equal(dados.realizadas, 1); assert.equal(dados.vendas, 1); assert.equal(dados.retorno, 500);
});

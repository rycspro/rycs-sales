import test from "node:test";
import assert from "node:assert/strict";
import { ACOES } from "../shared/acoes.js";
import { avaliar, normalizarProva } from "../server/services/regras.js";
import { dadosAgendamentoCorrespondemAoLead } from "../shared/agendamento.js";

const contexto = {
  leadId: "lead-1",
  provaRepetida: false,
  videoRepetido: false,
  contatoMesmoTipo24h: false,
  documentoRepetido: false,
  volumeAtipico: false,
  primeiraAcaoNaEmpresa: false,
  totalDecididas: 0,
  totalAprovadas: 0,
};

test("reunião agendada completa segue para revisão de auditoria", () => {
  const campos = ACOES.agendamento.prova;
  assert.deepEqual(campos, ["cliente", "telefone", "datahora", "modalidade"]);
  const prova = normalizarProva({
    cliente: "Mariana Oliveira",
    telefone: "11987654321",
    datahora: new Date(Date.now() + 7 * 86400000).toISOString(),
    modalidade: "Remota (Google Meet)",
  }, campos);
  const resultado = avaliar({ tipo: "agendamento", prova, camposReq: campos, contexto });
  assert.equal(resultado.veredito, "revisao");
  assert.equal(resultado.exigeRevisaoHumana, true);
});

test("reunião agendada sem campo obrigatório é recusada", () => {
  const campos = ACOES.agendamento.prova;
  const prova = normalizarProva({
    cliente: "Mariana Oliveira",
    telefone: "11987654321",
    datahora: new Date(Date.now() + 7 * 86400000).toISOString(),
    modalidade: "",
  }, campos);
  const resultado = avaliar({ tipo: "agendamento", prova, camposReq: campos, contexto });
  assert.equal(resultado.veredito, "recusado");
});

test("comprovação permanece vinculada ao lead selecionado", () => {
  const lead = { nome: "Mariana Oliveira", telefone: "11987654321" };
  assert.equal(dadosAgendamentoCorrespondemAoLead({ cliente: "Mariana Oliveira", telefone: "(11) 98765-4321" }, lead), true);
  assert.equal(dadosAgendamentoCorrespondemAoLead({ cliente: "Outro contato", telefone: "11987654321" }, lead), false);
});

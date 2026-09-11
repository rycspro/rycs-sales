import test from "node:test";
import assert from "node:assert/strict";
import { avaliarRegras, normalizarRegras, PADRAO, SEMPRE_MANUAL } from "../shared/aprovacoes.js";

const base = { ativo: true, tipos: ["agendamento", "ligacao"], confiancaMinima: 85, valorMaximo: 50, amostragem: 0 };
const aprovada = { tipo: "agendamento", valor: 10, confianca: 90, veredito: "revisao", risco: "baixo", sorteio: 99 };

test("regra desligada nunca aprova sozinha", () => {
  const r = avaliarRegras({ regras: { ...base, ativo: false }, ...aprovada });
  assert.equal(r.automatica, false);
  assert.match(r.motivo, /desligada/i);
});

test("venda jamais é aprovada automaticamente, mesmo se configurada", () => {
  // A normalização remove o tipo da lista, e a avaliação barra de novo: a
  // proteção não pode depender de um único ponto do código.
  const regras = normalizarRegras({ ...base, tipos: [...SEMPRE_MANUAL, "agendamento"] });
  assert.ok(!regras.tipos.includes("venda"));

  const r = avaliarRegras({ regras: { ...base, tipos: ["venda"] }, ...aprovada, tipo: "venda", valor: 250 });
  assert.equal(r.automatica, false);
  assert.match(r.motivo, /conferência humana/i);
});

test("recusa da triagem e risco acima de baixo nunca passam pela regra", () => {
  const recusada = avaliarRegras({ regras: base, ...aprovada, veredito: "recusado" });
  assert.equal(recusada.automatica, false);
  assert.match(recusada.motivo, /recusou/i);

  for (const risco of ["medio", "alto", "critico"]) {
    const r = avaliarRegras({ regras: base, ...aprovada, risco });
    assert.equal(r.automatica, false, `risco ${risco} não deveria aprovar sozinho`);
    assert.match(r.motivo, new RegExp(risco));
  }
});

test("confiança abaixo do mínimo e valor acima do teto barram a automação", () => {
  const baixa = avaliarRegras({ regras: base, ...aprovada, confianca: 84 });
  assert.equal(baixa.automatica, false);
  assert.match(baixa.motivo, /84%.*85%/);

  const cara = avaliarRegras({ regras: base, ...aprovada, valor: 51 });
  assert.equal(cara.automatica, false);
  assert.match(cara.motivo, /teto/i);
});

test("tipo fora da lista elegível continua na revisão humana", () => {
  const r = avaliarRegras({ regras: base, ...aprovada, tipo: "realizada" });
  assert.equal(r.automatica, false);
  assert.match(r.motivo, /fora da lista/i);
});

test("amostragem devolve parte das elegíveis para conferência manual", () => {
  const regras = { ...base, amostragem: 20 };
  // O sorteio é injetado para o teste ser determinístico: com 20% de
  // amostragem, 10 cai dentro da amostra e 30 fora.
  assert.equal(avaliarRegras({ regras, ...aprovada, sorteio: 10 }).automatica, false);
  assert.equal(avaliarRegras({ regras, ...aprovada, sorteio: 10 }).amostrada, true);
  assert.equal(avaliarRegras({ regras, ...aprovada, sorteio: 30 }).automatica, true);
});

test("ação elegível dentro de todos os limites é aprovada e explica o porquê", () => {
  const r = avaliarRegras({ regras: base, ...aprovada });
  assert.equal(r.automatica, true);
  assert.match(r.motivo, /Risco baixo/);
  assert.match(r.motivo, /90%/);
  assert.match(r.motivo, /85%/);
});

test("normalização protege contra valores fora de faixa vindos do cliente", () => {
  const r = normalizarRegras({ ativo: "sim", confiancaMinima: 500, valorMaximo: -8, amostragem: 900, tipos: "nada" });
  assert.equal(r.ativo, true);
  assert.equal(r.confiancaMinima, 100);
  assert.equal(r.valorMaximo, 0);
  assert.equal(r.amostragem, 100);
  assert.deepEqual(r.tipos, []);
  assert.equal(normalizarRegras(undefined).confiancaMinima, PADRAO.confiancaMinima);
});

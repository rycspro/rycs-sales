import test from "node:test";
import assert from "node:assert/strict";
import { calcularValorTarefa } from "../shared/valorTarefa.js";
import { PLANOS, takeRateDoPlano } from "../shared/planos.js";

// Cenário START: take rate 20%, limite 5 profissionais
test("START — take rate 20%", () => {
  assert.equal(PLANOS.starter.takeRate, 0.20);
  assert.equal(PLANOS.starter.limites.vendedores, 5);

  const bruto = 100;
  const { taxa, liquido, percentual } = calcularValorTarefa(bruto, "starter");
  assert.equal(percentual, 0.20);
  assert.equal(taxa, 20);
  assert.equal(liquido, 80);
});

// Cenário GROWTH: take rate 15%
test("GROWTH — take rate 15%", () => {
  assert.equal(PLANOS.growth.takeRate, 0.15);

  const bruto = 200;
  const { taxa, liquido, percentual } = calcularValorTarefa(bruto, "growth");
  assert.equal(percentual, 0.15);
  assert.equal(taxa, 30);
  assert.equal(liquido, 170);
});

// Cenário SCALE: take rate 10%
test("SCALE — take rate 10%", () => {
  assert.equal(PLANOS.scale.takeRate, 0.10);

  const bruto = 1000;
  const { taxa, liquido, percentual } = calcularValorTarefa(bruto, "scale");
  assert.equal(percentual, 0.10);
  assert.equal(taxa, 100);
  assert.equal(liquido, 900);
});

// Consistência: bruto - taxa = liquido em todos os planos
test("bruto − taxa = líquido em todos os planos", () => {
  for (const [chave] of Object.entries(PLANOS)) {
    const bruto = 500;
    const { taxa, liquido } = calcularValorTarefa(bruto, chave);
    assert.equal(
      Math.round((bruto - taxa) * 100) / 100,
      liquido,
      `falhou no plano ${chave}`
    );
  }
});

// takeRateDoPlano retorna o valor certo
test("takeRateDoPlano retorna o take rate correto", () => {
  assert.equal(takeRateDoPlano("starter"), 0.20);
  assert.equal(takeRateDoPlano("growth"), 0.15);
  assert.equal(takeRateDoPlano("scale"), 0.10);
  assert.equal(takeRateDoPlano("free"), 0.50);
});

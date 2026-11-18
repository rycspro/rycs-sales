import test from "node:test";
import assert from "node:assert/strict";
import {
  PLANOS_PROFISSIONAL, ORDEM_PLANOS_PROFISSIONAL, PLANOS_PAGOS_PROFISSIONAL,
  pode, limite, nivel, horasSaque, prazoSaqueTexto, nivelDestaqueComercial,
  planoDoProfissional,
} from "../shared/planosProfissional.js";

test("Planos profissionais: quatro planos Free/Start/Pro/Elite com preços da spec", () => {
  assert.deepEqual(Object.keys(PLANOS_PROFISSIONAL), ["gratis", "start", "pro", "premium"]);
  assert.equal(PLANOS_PROFISSIONAL.gratis.preco, 0);
  assert.equal(PLANOS_PROFISSIONAL.start.preco, 24.9);
  assert.equal(PLANOS_PROFISSIONAL.pro.preco, 47.9);
  assert.equal(PLANOS_PROFISSIONAL.premium.preco, 97.9);
  // Elite usa a chave 'premium' (não quebra assinaturas gravadas) mas nome "Elite".
  assert.equal(PLANOS_PROFISSIONAL.premium.nome, "Elite");
  assert.equal(PLANOS_PROFISSIONAL.pro.popular, true);
  assert.equal(PLANOS_PROFISSIONAL.premium.elite, true);
  // Ordem monotônica e pagos corretos.
  assert.deepEqual(ORDEM_PLANOS_PROFISSIONAL, ["gratis", "start", "pro", "premium"]);
  assert.deepEqual(PLANOS_PAGOS_PROFISSIONAL, ["start", "pro", "premium"]);
  // Cada plano tem bullets e CTA.
  for (const k of Object.keys(PLANOS_PROFISSIONAL)) {
    assert.ok(Array.isArray(PLANOS_PROFISSIONAL[k].beneficios) && PLANOS_PROFISSIONAL[k].beneficios.length > 0);
    assert.ok(PLANOS_PROFISSIONAL[k].cta);
  }
});

test("Planos profissionais: prazo de saque por plano (fonte de verdade prazoSaqueHoras)", () => {
  assert.equal(horasSaque("gratis"), 120);
  assert.equal(horasSaque("start"), 72);
  assert.equal(horasSaque("pro"), 24);
  assert.equal(horasSaque("premium"), 0);
  assert.equal(prazoSaqueTexto("gratis"), "em até 5 dias");
  assert.equal(prazoSaqueTexto("start"), "em até 3 dias");
  assert.equal(prazoSaqueTexto("pro"), "em até 24 horas");
  assert.match(prazoSaqueTexto("premium"), /imediato após aprovação/);
});

test("Planos profissionais: nível comercial de destaque (Elite 1, Pro 2, Start 3, Free 0)", () => {
  assert.equal(nivelDestaqueComercial("premium"), 1);
  assert.equal(nivelDestaqueComercial("pro"), 2);
  assert.equal(nivelDestaqueComercial("start"), 3);
  assert.equal(nivelDestaqueComercial("gratis"), 0);
  // pesoVitrine cresce com o plano (usado na ordenação das vitrines).
  assert.equal(limite("gratis", "pesoVitrine"), 0);
  assert.equal(limite("start", "pesoVitrine"), 1);
  assert.equal(limite("pro", "pesoVitrine"), 2);
  assert.equal(limite("premium", "pesoVitrine"), 3);
});

test("Planos profissionais: capacidades do Start resolvem pelo gate pode()", () => {
  // Start ganha alertas (WhatsApp/app) mas não os recursos Pro+.
  assert.equal(pode("start", "alertaVagaWhatsApp"), true);
  assert.equal(pode("start", "alertaVagaApp"), true);
  assert.equal(pode("start", "cursosNicho"), false);
  assert.equal(pode("start", "etiquetaPro"), false);
  assert.equal(pode("start", "desempateScore"), false);
  // Níveis textuais do Start não ficam indefinidos.
  assert.equal(nivel("start", "painel"), "basico");
  assert.equal(nivel("start", "suporte"), "normal");
});

test("Planos profissionais: chaves existentes (pro/premium) continuam resolvendo", () => {
  // Assinatura premium gravada continua dando os benefícios do Elite.
  const r = planoDoProfissional([{ plano: "premium", status: "ativa", pagoAte: Date.now() + 86400000, id: "a1" }]);
  assert.equal(r.plano, "premium");
  assert.equal(nivel("premium", "painel"), "comparativo");
  assert.equal(pode("pro", "scriptsIAPorCampanha"), true);
  // Plano desconhecido cai para gratis (planoValido).
  assert.equal(horasSaque("inexistente"), 120);
});

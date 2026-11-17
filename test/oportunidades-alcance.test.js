import test from "node:test";
import assert from "node:assert/strict";
import {
  codigoPais, sanearAlcance, sanearPaisesAceitos, parsePaisesAceitos, classificarCampanha,
} from "../shared/oportunidades.js";

// Regras de alcance geográfico das campanhas (marketplace Oportunidades).
// Teste puro — não sobe servidor.

test("codigoPais resolve nome livre e código ISO-2", () => {
  assert.equal(codigoPais("Brasil"), "BR");
  assert.equal(codigoPais("BR"), "BR");
  assert.equal(codigoPais("brasil"), "BR");
  assert.equal(codigoPais("Estados Unidos"), "US");
  assert.equal(codigoPais(""), "BR");          // fallback
  assert.equal(codigoPais("Inexistente"), "BR"); // fallback
});

test("sanearAlcance só aceita valores válidos", () => {
  assert.equal(sanearAlcance("internacional"), "internacional");
  assert.equal(sanearAlcance("ambas"), "ambas");
  assert.equal(sanearAlcance("qualquer"), "nacional");
  assert.equal(sanearAlcance(undefined), "nacional");
});

test("sanearPaisesAceitos aplica a regra por alcance", () => {
  // nacional → sempre só o país da empresa, ignora a lista
  assert.deepEqual(sanearPaisesAceitos(["US", "PT"], "BR", "nacional"), ["BR"]);
  // internacional → mantém válidos, descarta inválidos, não força o país da empresa
  assert.deepEqual(sanearPaisesAceitos(["us", "pt", "ZZ"], "BR", "internacional"), ["US", "PT"]);
  // internacional sem lista → fallback seguro para o país da empresa
  assert.deepEqual(sanearPaisesAceitos([], "BR", "internacional"), ["BR"]);
  // ambas → inclui o país da empresa + os escolhidos
  assert.deepEqual(sanearPaisesAceitos(["US"], "BR", "ambas"), ["BR", "US"]);
  // dedupe
  assert.deepEqual(sanearPaisesAceitos(["BR", "BR", "US"], "BR", "ambas"), ["BR", "US"]);
});

test("parsePaisesAceitos tolera string JSON e array", () => {
  assert.deepEqual(parsePaisesAceitos('["BR","US"]'), ["BR", "US"]);
  assert.deepEqual(parsePaisesAceitos(["BR"]), ["BR"]);
  assert.deepEqual(parsePaisesAceitos("lixo"), []);
  assert.deepEqual(parsePaisesAceitos(null), []);
});

test("classificarCampanha: nacional vs internacional relativo ao profissional", () => {
  const base = { alcance: "ambas", paisesAceitos: ["BR", "US"], paisEmpresa: "BR" };

  const br = classificarCampanha({ ...base, paisProfissional: "Brasil" });
  assert.deepEqual([br.elegivel, br.nacional, br.internacional], [true, true, false]);

  const us = classificarCampanha({ ...base, paisProfissional: "US" });
  assert.deepEqual([us.elegivel, us.nacional, us.internacional], [true, false, true]);

  const pt = classificarCampanha({ ...base, paisProfissional: "PT" });
  assert.deepEqual([pt.elegivel, pt.nacional, pt.internacional], [false, false, false]);
});

test("classificarCampanha: campanha nacional só serve o país da empresa", () => {
  const nac = { alcance: "nacional", paisesAceitos: ["BR"], paisEmpresa: "BR" };
  assert.equal(classificarCampanha({ ...nac, paisProfissional: "BR" }).nacional, true);
  assert.equal(classificarCampanha({ ...nac, paisProfissional: "US" }).elegivel, false);
});

test("classificarCampanha: empresa estrangeira que aceita BR cai em internacional", () => {
  const intl = { alcance: "internacional", paisesAceitos: ["BR", "US"], paisEmpresa: "US" };
  const br = classificarCampanha({ ...intl, paisProfissional: "Brasil" });
  assert.deepEqual([br.elegivel, br.nacional, br.internacional], [true, false, true]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { validarEdicaoCurso } from "../shared/academy/validacao.js";

test("edição permite curso gratuito e preço pago válido", () => {
  assert.equal(validarEdicaoCurso({ gratuito: 0, preco: 97 }, { gratuito: true, preco: 0 }), null);
  assert.equal(validarEdicaoCurso({ gratuito: 1, preco: 0 }, { gratuito: false, preco: 97.5 }), null);
});
test("edição rejeita valores inválidos e curso pago sem preço", () => {
  for (const preco of [-1, Infinity, NaN, "97"]) assert.ok(validarEdicaoCurso({}, { preco }));
  assert.ok(validarEdicaoCurso({ gratuito: 1, preco: 0 }, { gratuito: false }));
  assert.ok(validarEdicaoCurso({}, { gratuito: "false" }));
  assert.ok(validarEdicaoCurso({}, { titulo: " " }));
  assert.ok(validarEdicaoCurso({}, { notaMinima: 101 }));
});
test("alterar detalhes e status preserva cursos legados com preço zero", () => {
  assert.equal(validarEdicaoCurso({ gratuito: 0, preco: 0 }, { status: "publicado", descricao: "Atualizada" }), null);
});

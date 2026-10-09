import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAQUE_MINIMO } from "../shared/saque.js";

test("saque mínimo é R$ 10", () => {
  assert.equal(SAQUE_MINIMO, 10);
});

// O piso valia 20 no servidor e 10 na tela, com um comentário jurando que os
// dois eram iguais. Quem tinha R$ 15 via o botão liberado e levava erro da
// API. Nenhum dos dois lados pode voltar a escrever o número na mão.
test("servidor e carteira leem o mesmo piso, sem número solto", () => {
  const servidor = readFileSync(new URL("../server/routes/payments.js", import.meta.url), "utf8");
  const carteira = readFileSync(new URL("../src/components/vendedor/Carteira.jsx", import.meta.url), "utf8");

  for (const [nome, fonte] of [["servidor", servidor], ["carteira", carteira]]) {
    assert.match(fonte, /import \{ SAQUE_MINIMO \} from ".*shared\/saque\.js"/, `${nome} não importa o piso compartilhado`);
    assert.doesNotMatch(fonte, /SAQUE_MINIMO\s*=\s*\d/, `${nome} redefine o piso em vez de importá-lo`);
  }
});

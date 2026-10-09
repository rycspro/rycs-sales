import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAQUE_MINIMO, decidirSaque, avaliarTransferencia } from "../shared/saque.js";

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
    assert.match(fonte, /import \{[^}]*\bSAQUE_MINIMO\b[^}]*\} from ".*shared\/saque\.js"/, `${nome} não importa o piso compartilhado`);
    assert.doesNotMatch(fonte, /SAQUE_MINIMO\s*=\s*\d/, `${nome} redefine o piso em vez de importá-lo`);
  }
});

// ── Desfecho do saque ───────────────────────────────────────────────────────

test("Pix concluído pelo gateway fecha o saque na hora", () => {
  // O status vinha na resposta da criação da transferência e era descartado:
  // o saque esperava o webhook TRANSFER_DONE mesmo quando o Asaas já havia
  // concluído o Pix.
  assert.equal(decidirSaque("DONE"), "pago");
  assert.equal(decidirSaque("done"), "pago");
});

test("Pix em processamento bancário continua esperando o webhook", () => {
  assert.equal(decidirSaque("PENDING"), "aguardando");
  assert.equal(decidirSaque("BANK_PROCESSING"), "aguardando");
});

test("recusa do banco é desfecho imediato, para o saldo voltar na hora", () => {
  assert.equal(decidirSaque("FAILED"), "recusado");
  assert.equal(decidirSaque("CANCELLED"), "recusado");
});

test("status desconhecido espera, em vez de chutar que foi pago", () => {
  // Marcar "pago" sobre um nome que não reconhecemos daria por entregue um
  // Pix que pode não ter saído.
  for (const s of ["", null, undefined, "SCHEDULED", "QUALQUER_COISA"]) {
    assert.equal(decidirSaque(s), "aguardando", `status ${s}`);
  }
});

// ── Validação automática do Asaas ───────────────────────────────────────────

test("transferência de um saque registrado é aprovada sem ninguém intervir", () => {
  const saque = { id: "w1", valor: 50, status: "solicitado", asaasId: "tr_1" };
  assert.deepEqual(avaliarTransferencia({ id: "tr_1", value: 50 }, saque), { status: "APPROVED" });
});

test("aprova mesmo antes de o id da transferência ser gravado no saque", () => {
  // O Asaas pode perguntar antes de a criação terminar de ser salva aqui.
  const saque = { id: "w1", valor: 50, status: "solicitado", asaasId: null };
  assert.equal(avaliarTransferencia({ id: "tr_1", value: 50, externalReference: "w1" }, saque).status, "APPROVED");
});

test("Pix sem saque correspondente é recusado (chave de API vazada)", () => {
  assert.equal(avaliarTransferencia({ id: "tr_x", value: 5000 }, undefined).status, "REFUSED");
});

test("valor diferente, saque encerrado ou segunda transferência são recusados", () => {
  const saque = { id: "w1", valor: 50, status: "solicitado", asaasId: "tr_1" };
  assert.equal(avaliarTransferencia({ id: "tr_1", value: 500 }, saque).status, "REFUSED");
  assert.equal(avaliarTransferencia({ id: "tr_2", value: 50 }, saque).status, "REFUSED");
  assert.equal(avaliarTransferencia({ id: "tr_1", value: 50 }, { ...saque, status: "cancelado" }).status, "REFUSED");
  assert.equal(avaliarTransferencia({ id: "tr_1", value: 50 }, { ...saque, status: "falhou" }).status, "REFUSED");
});

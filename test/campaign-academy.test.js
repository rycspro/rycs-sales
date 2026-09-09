import test from "node:test";
import assert from "node:assert/strict";
import { atendeCertificacaoDaCampanha } from "../shared/campaignAcademy.js";

test("campanha sem exigência de certificação libera candidatura", () => {
  assert.equal(atendeCertificacaoDaCampanha({ funcao: "sdr", exigeCertificacao: false }, []), true);
});

test("aprovação na função exigida libera a campanha", () => {
  const campanha = { funcao: "sdr", exigeCertificacao: true };
  assert.equal(atendeCertificacaoDaCampanha(campanha, [{ funcao: "sdr", percentual: 83 }]), true);
});

test("reprovação ou certificação de outra função mantém bloqueio", () => {
  const campanha = { funcao: "closer", exigeCertificacao: true };
  assert.equal(atendeCertificacaoDaCampanha(campanha, []), false);
  assert.equal(atendeCertificacaoDaCampanha(campanha, [{ funcao: "sdr", percentual: 100 }]), false);
});

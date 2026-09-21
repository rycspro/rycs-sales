import test from "node:test";
import assert from "node:assert/strict";
import { estadoDoConvite, podeResgatarConvite, MOTIVOS_CONVITE, TRIAL_SECRETO_DIAS } from "../shared/trialSecreto.js";

const AGORA = Date.parse("2026-09-21T12:00:00Z");
const emDias = (n) => AGORA + n * 86400000;
const convite = (extra = {}) => ({ id: "l1", dias: TRIAL_SECRETO_DIAS, expiraEm: emDias(30), usadoEm: null, ...extra });

test("convite novo é válido", () => {
  assert.equal(estadoDoConvite(convite(), AGORA).ok, true);
});

test("convite já usado não vale de novo", () => {
  // O uso único é a defesa contra o link vazar e virar mil trials.
  const r = estadoDoConvite(convite({ usadoEm: emDias(-1) }), AGORA);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "usado");
});

test("convite vencido não vale", () => {
  // Cobre o link esquecido num grupo e usado meses depois.
  const r = estadoDoConvite(convite({ expiraEm: emDias(-1) }), AGORA);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "expirado");
});

test("token que não existe não vira convite", () => {
  const r = estadoDoConvite(null, AGORA);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "inexistente");
});

test("empresa sem assinatura resgata", () => {
  const r = podeResgatarConvite({ link: convite(), estadoAtual: "sem", jaUsouTrial: false }, AGORA);
  assert.equal(r.ok, true);
});

test("empresa que já usou trial não resgata outro", () => {
  // Terceira defesa: sem ela, a mesma empresa encadearia convites e teria
  // acesso gratuito permanente.
  const r = podeResgatarConvite({ link: convite(), estadoAtual: "sem", jaUsouTrial: true }, AGORA);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "jaUsouTrial");
});

test("empresa com acesso liberado não precisa do convite", () => {
  for (const estado of ["ativa", "trial"]) {
    const r = podeResgatarConvite({ link: convite(), estadoAtual: estado }, AGORA);
    assert.equal(r.ok, false, `${estado} deveria recusar`);
  }
});

test("checkout pendente impede o resgate", () => {
  const r = podeResgatarConvite({ link: convite(), estadoAtual: "pendente" }, AGORA);
  assert.equal(r.ok, false);
});

test("convite ruim recusa antes de olhar a empresa", () => {
  // A ordem importa: dizer "sua empresa já usou trial" para um link expirado
  // manda a pessoa investigar a conta dela quando o problema é o link.
  const r = podeResgatarConvite({ link: convite({ usadoEm: emDias(-2) }), estadoAtual: "sem", jaUsouTrial: true }, AGORA);
  assert.equal(r.motivo, "usado");
});

test("toda recusa explica o motivo em português", () => {
  for (const chave of Object.keys(MOTIVOS_CONVITE)) {
    assert.ok(MOTIVOS_CONVITE[chave].length > 10, `${chave} sem mensagem`);
  }
});

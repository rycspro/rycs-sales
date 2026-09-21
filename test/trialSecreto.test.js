import test from "node:test";
import assert from "node:assert/strict";
import { TRIAL_SECRETO_DIAS, podeConcederTrialSecreto } from "../shared/trialSecreto.js";

test("trial secreto tem duração fixa de sete dias", () => {
  assert.equal(TRIAL_SECRETO_DIAS, 7);
});

test("trial secreto só pode ser concedido para empresa sem acesso ativo", () => {
  assert.equal(podeConcederTrialSecreto({ estadoAtual: "sem" }).ok, true);
  assert.equal(podeConcederTrialSecreto({ estadoAtual: "inadimplente" }).ok, true);
  assert.equal(podeConcederTrialSecreto({ estadoAtual: "ativa" }).ok, false);
  assert.equal(podeConcederTrialSecreto({ estadoAtual: "trial" }).ok, false);
  assert.equal(podeConcederTrialSecreto({ estadoAtual: "pendente" }).ok, false);
});

test("trial secreto não pode ser reutilizado pela mesma empresa", () => {
  const r = podeConcederTrialSecreto({ estadoAtual: "sem", jaUsouTrial: true });
  assert.equal(r.ok, false);
  assert.match(r.erro, /já utilizou/i);
});

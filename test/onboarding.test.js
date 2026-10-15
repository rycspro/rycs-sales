import test from "node:test";
import assert from "node:assert/strict";
import {
  etapaAtual, podeAbrirEtapa, concluirEtapa, onboardingConcluido, normalizarEtapas,
  validarSenhaEmpresa, normalizarWhatsapp, podeReenviarReset, REENVIO_RESET_MS,
  estadoConviteOnboarding, conviteServeParaEmail, validadeConviteDias, CONVITE_VALIDADE_MAX_DIAS,
  onboardingBloqueia, ETAPAS_PRONTAS,
} from "../shared/onboarding.js";

// ---------------------------------------------------------------------------
// Regras puras

test("progresso: a etapa atual é a primeira não concluída", () => {
  assert.equal(etapaAtual({}).chave, "acesso");
  assert.equal(etapaAtual({ acesso: "concluida" }).chave, "empresa");
  assert.equal(etapaAtual({ acesso: "concluida", empresa: "concluida", academy: "lixo" }).chave, "academy");
  const tudo = Object.fromEntries(Object.keys(normalizarEtapas({})).map((k) => [k, "concluida"]));
  assert.equal(etapaAtual(tudo), null);
  assert.equal(onboardingConcluido(tudo), true);
});

test("progresso: não pula etapa pela URL nem conclui fora de ordem", () => {
  const e = { acesso: "concluida" };
  assert.equal(podeAbrirEtapa(e, "acesso"), true);
  assert.equal(podeAbrirEtapa(e, "empresa"), true);
  assert.equal(podeAbrirEtapa(e, "academy"), false);
  assert.equal(podeAbrirEtapa(e, "campanha"), false);
  assert.equal(podeAbrirEtapa(e, "inexistente"), false);
  assert.equal(concluirEtapa(e, "ia"), null);
  assert.equal(concluirEtapa(e, "empresa").empresa, "concluida");
});

test("senha da empresa: mínimo de 8 caracteres", () => {
  assert.ok(validarSenhaEmpresa("1234567"));
  assert.equal(validarSenhaEmpresa("12345678"), null);
  assert.ok(validarSenhaEmpresa(""));
});

test("WhatsApp: aceita DDD + número, com ou sem 55, e guarda com 55", () => {
  assert.equal(normalizarWhatsapp("(11) 91234-5678"), "5511912345678");
  assert.equal(normalizarWhatsapp("+55 11 3456-7890"), "551134567890");
  assert.equal(normalizarWhatsapp("91234-5678"), null);
  assert.equal(normalizarWhatsapp(""), null);
});

test("reenvio do link de recuperação respeita o intervalo mínimo", () => {
  const t = 1_000_000;
  assert.equal(podeReenviarReset(null, t), true);
  assert.equal(podeReenviarReset(t - 1000, t), false);
  assert.equal(podeReenviarReset(t - REENVIO_RESET_MS, t), true);
});

test("convite: uso único, validade, cancelamento e preso ao e-mail", () => {
  const agora = 5_000;
  const c = { email: "dono@empresa.com", expiraEm: 10_000 };
  assert.equal(estadoConviteOnboarding(null).motivo, "inexistente");
  assert.equal(estadoConviteOnboarding(c, agora).ok, true);
  assert.equal(estadoConviteOnboarding({ ...c, usadoEm: 1 }, agora).motivo, "usado");
  assert.equal(estadoConviteOnboarding({ ...c, revogadoEm: 1 }, agora).motivo, "revogado");
  assert.equal(estadoConviteOnboarding(c, 20_000).motivo, "expirado");
  assert.equal(conviteServeParaEmail(c, " DONO@empresa.com ", agora).ok, true);
  assert.equal(conviteServeParaEmail(c, "outro@empresa.com", agora).motivo, "outroEmail");
  assert.equal(validadeConviteDias("abc"), 7);
  assert.equal(validadeConviteDias(500), CONVITE_VALIDADE_MAX_DIAS);
  assert.equal(validadeConviteDias(15), 15);
});

test("só etapa já entregue segura a empresa fora do painel", () => {
  const prontas = new Set(ETAPAS_PRONTAS);
  // Nova empresa parada numa etapa ainda não entregue entra no painel.
  if (!prontas.has("empresa")) assert.equal(onboardingBloqueia({ etapas: { acesso: "concluida" }, origem: "site" }), false);
  // Nova empresa sem acesso concluído fica no onboarding.
  assert.equal(onboardingBloqueia({ etapas: {}, origem: "site" }), true);
  // Empresa antiga só entra no fluxo quando ele estiver completo, ou se ligado.
  if (prontas.size < 6) {
    assert.equal(onboardingBloqueia({ etapas: {}, origem: "existente" }), false);
    assert.equal(onboardingBloqueia({ etapas: {}, origem: "existente", exigirExistentes: true }), true);
  }
});

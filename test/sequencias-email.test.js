import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  proximoEmailVendedor, proximoEmailEmpresa, montarTexto, idiomaDoPais, tetoDoDia, dentroDaJanela, CHAVES_TEXTOS, DIA,
} from "../shared/sequenciasEmail.js";
import { valorPrimeiraMensalidade, blocosDeBonus, RECOMPENSAS } from "../shared/indicacoes.js";
import { pendenciasPerfil } from "../shared/perfilVendedor.js";
import { subirServidor, assinar, cliente, SEGREDO } from "./apoio/servidor.js";

const T0 = Date.UTC(2026, 10, 17, 15); // 12h em Brasília
const base = (extra = {}) => ({
  ancora: T0, novo: true, perfilCompleto: false, inativo: false, indicacaoUsada: false,
  plano: "gratis", ultimaAtividade: T0, enviados: new Map(), ...extra,
});
const proximo = (ctx, dias) => proximoEmailVendedor(ctx, T0 + dias * DIA)?.chave || null;

test("onboarding: boas-vindas no dia 0, perfil no dia 1, oportunidade no 2 e aviso no 3", () => {
  const enviados = new Map();
  const ctx = base({ enviados });
  assert.equal(proximo(ctx, 0), "onboarding:boas_vindas");
  enviados.set("onboarding:boas_vindas", T0);
  assert.equal(proximo(ctx, 0.5), null);
  assert.equal(proximo(ctx, 1), "onboarding:perfil_falta");
  enviados.set("onboarding:perfil_falta", T0);
  assert.equal(proximo(ctx, 2), "onboarding:oportunidade");
  enviados.set("onboarding:oportunidade", T0);
  assert.equal(proximo(ctx, 3), "onboarding:aviso_inativacao");
});

test("quem cumpre a ação sai: perfil completo não recebe aviso e segue para indicações", () => {
  const enviados = new Map([["onboarding:boas_vindas", T0], ["onboarding:oportunidade", T0]]);
  const ctx = base({ perfilCompleto: true, enviados });
  assert.equal(proximo(ctx, 3), null);
  assert.equal(proximo(ctx, 4), "indicacoes:indique");
  enviados.set("indicacoes:indique", T0);
  assert.equal(proximo({ ...ctx, indicacaoUsada: true }, 5), null);
  assert.equal(proximo(ctx, 5), "indicacoes:codigo_nao_usado");
  enviados.set("indicacoes:codigo_nao_usado", T0);
  assert.equal(proximo(ctx, 6), "graduacao:academy");
  enviados.set("graduacao:academy", T0);
  assert.equal(proximo({ ...ctx, plano: "pro" }, 7), null);
  assert.equal(proximo(ctx, 7), "graduacao:planos");
});

test("conta antiga não recebe boas-vindas; parado 5 dias entra na repescagem", () => {
  const ctx = base({ novo: false, perfilCompleto: true, indicacaoUsada: true, plano: "pro",
    enviados: new Map([["onboarding:oportunidade", T0], ["indicacoes:indique", T0], ["graduacao:academy", T0]]) });
  assert.equal(proximo(ctx, 0), null);
  assert.equal(proximo(ctx, 9), "repescagem:precisa@2026-11-17");
  ctx.enviados.set("repescagem:precisa@2026-11-17", T0 + 9 * DIA);
  // Espaçados: o segundo só 3 dias depois do primeiro, o terceiro 4 depois do segundo.
  assert.equal(proximo(ctx, 11), null);
  assert.equal(proximo(ctx, 12), "repescagem:novas@2026-11-17");
  ctx.enviados.set("repescagem:novas@2026-11-17", T0 + 12 * DIA);
  assert.equal(proximo(ctx, 15), null);
  assert.equal(proximo(ctx, 16), "repescagem:ultima@2026-11-17");
  // Voltou a usar: o episódio antigo não conta para o novo.
  assert.equal(proximo({ ...ctx, ultimaAtividade: T0 + 10 * DIA }, 12), null);
  assert.equal(proximo({ ...ctx, ultimaAtividade: T0 + 10 * DIA }, 15), "repescagem:precisa@2026-11-27");
});

test("empresa parada: um e-mail por dia durante 7 dias", () => {
  const enviados = new Map();
  const ctx = { ultimaAtividade: T0, enviados };
  assert.equal(proximoEmailEmpresa(ctx, T0 + 4 * DIA), null);
  for (let i = 0; i < 7; i++) {
    const p = proximoEmailEmpresa(ctx, T0 + (5 + i) * DIA);
    assert.equal(p.chave, `empresas_offline:d${i + 1}@2026-11-17`);
    enviados.set(p.chave, T0);
  }
  assert.equal(proximoEmailEmpresa(ctx, T0 + 20 * DIA), null);
});

test("textos: todos em PT e EN, assunto com o nome, um botão e valores das regras", () => {
  for (const k of CHAVES_TEXTOS) {
    for (const lang of ["pt", "en"]) {
      const t = montarTexto(k, lang, { nome: "Maria Silva", pendencias: ["Foto de perfil"], codigo: "ABC1234", campanhasAtivas: 3, empresasNovasSemana: 2 });
      assert.ok(t, `${k}/${lang}`);
      assert.match(t.assunto, /Maria/);
      assert.ok(t.botao && t.aba);
    }
  }
  const op = montarTexto("onboarding:oportunidade", "pt", { nome: "Ana", campanhasAtivas: 2 });
  assert.match(op.paragrafos.join(" "), /R\$ 1,50/);
  assert.match(op.paragrafos.join(" "), /30% da primeira mensalidade/);
  const pl = montarTexto("graduacao:planos", "pt", { nome: "Ana" }).paragrafos.join(" ");
  assert.match(pl, /R\$ 29,90 por mês/);
  assert.ok(!pl.includes("NaN"));
  const emp = montarTexto("empresas_offline:d3@2026-11-17", "pt", { nome: "Acme Ltda", empresa: "Acme Ltda" });
  assert.match(emp.assunto, /^Acme Ltda,/);
  // Dado do usuário entra escapado no HTML.
  const x = montarTexto("onboarding:perfil_falta", "pt", { nome: "Zé", pendencias: ["<script>"] });
  assert.ok(!x.paragrafos.join("").includes("<script>"));
});

test("idioma, aquecimento e janela de envio", () => {
  assert.equal(idiomaDoPais("Brasil"), "pt");
  assert.equal(idiomaDoPais(""), "pt");
  assert.equal(idiomaDoPais("Índia"), "en");
  assert.equal(tetoDoDia(0), 150);
  assert.equal(tetoDoDia(2), 250);
  assert.equal(tetoDoDia(1000), 2000);
  assert.equal(dentroDaJanela(Date.UTC(2026, 10, 17, 12)), true); // 9h BRT
  assert.equal(dentroDaJanela(Date.UTC(2026, 10, 17, 23)), false); // 20h BRT
});

test("indicação: 30% da primeira mensalidade, R$ 3 a cada 10 e perfil completo", () => {
  assert.equal(valorPrimeiraMensalidade(399), 119.7);
  assert.equal(valorPrimeiraMensalidade(0), 0);
  assert.equal(blocosDeBonus(9), 0);
  assert.equal(blocosDeBonus(10), 1);
  assert.equal(blocosDeBonus(25), 2);
  assert.equal(RECOMPENSAS.vendedor.empresa.valor, 1.5);
  assert.equal(RECOMPENSAS.vendedor.vendedor.valor, 3);
  assert.deepEqual(pendenciasPerfil({ foto: "x", titulo: "t", bio: "b", disponibilidade: "d", cidade: "c", segmentos: "[\"a\"]", modalidades: ["b"], skills: "[\"c\"]" }), []);
  assert.ok(pendenciasPerfil({ foto: "", segmentos: "[]" }).includes("Foto de perfil"));
});

test("rotas: descadastro só com token válido e painel só para admin", async (t) => {
  const { base: url } = await subirServidor(t);
  const req = cliente(url);
  const email = "pessoa@exemplo.invalid";
  const e = Buffer.from(email).toString("base64url");
  const tok = createHmac("sha256", SEGREDO).update(`descadastro:${email}`).digest("base64url");

  let r = await fetch(`${url}/email/descadastro?e=${e}&t=errado`);
  assert.equal(r.status, 400);
  r = await fetch(`${url}/email/descadastro?e=${e}&t=${tok}`);
  assert.equal(r.status, 200);
  r = await fetch(`${url}/email/descadastro?e=${e}&t=${tok}`, { method: "POST", body: "List-Unsubscribe=One-Click", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  assert.equal(r.status, 200);

  const admin = assinar({ id: "admin-teste", role: "admin", entityId: null, email: "admin@exemplo.invalid" });
  let j = await req("/admin/sequencias-email", { cookie: assinar({ id: "v", role: "vendedor", entityId: "v" }) });
  assert.equal(j.status, 403);
  j = await req("/admin/sequencias-email", { cookie: admin });
  assert.equal(j.status, 200);
  assert.equal(j.corpo.descadastros, 1);
  assert.equal(j.corpo.ligado, false); // desligado nos testes
  j = await req("/admin/sequencias-email/previa", { cookie: admin, body: { chave: "onboarding:oportunidade", idioma: "en" } });
  assert.equal(j.status, 200);
  assert.match(j.corpo.html, /Unsubscribe/);
  assert.match(j.corpo.html, /BRL 1\.50/);
});

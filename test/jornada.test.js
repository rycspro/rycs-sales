import test from "node:test";
import assert from "node:assert/strict";
import { ETAPAS_VENDEDOR, classificarOrigem, limparOrigem, montarJornada, agregarFunil } from "../shared/jornada.js";
import { subirServidor, assinar, cliente } from "./apoio/servidor.js";

const DIA = 24 * 60 * 60 * 1000;

test("origem: Meta por fbclid ou utm_source, Google, convite e orgânico", () => {
  assert.equal(classificarOrigem({ fbclid: "abc" }), "meta");
  assert.equal(classificarOrigem({ utm_source: "Instagram" }), "meta");
  assert.equal(classificarOrigem({ utm_source: "fb" }), "meta");
  assert.equal(classificarOrigem({ gclid: "x" }), "google");
  assert.equal(classificarOrigem({ utm_source: "plataforma", utm_medium: "convite-profissional" }), "convite");
  assert.equal(classificarOrigem({ utm_source: "newsletter" }), "outros");
  assert.equal(classificarOrigem({}), "organico");
});

test("origem guarda só campos conhecidos, como texto curto", () => {
  assert.deepEqual(limparOrigem({ utm_source: "meta", senha: "x", utm_campaign: "a".repeat(300) }), { utm_source: "meta", utm_campaign: "a".repeat(120) });
  assert.deepEqual(limparOrigem("lixo"), {});
});

test("jornada: onde parou é a primeira etapa que falta e conta os dias desde a última atividade", () => {
  const agora = Date.now();
  const j = montarJornada(ETAPAS_VENDEDOR, { acesso: agora - 10 * DIA, conta: agora - 9 * DIA, email: true, perfil: true, candidatura: agora - 4 * DIA }, agora);
  assert.equal(j.concluidas, 5);
  assert.equal(j.etapaAtual.chave, "academy");
  assert.equal(j.diasParado, 4);
  assert.equal(j.pct, 50);
  const completa = montarJornada(ETAPAS_VENDEDOR, Object.fromEntries(ETAPAS_VENDEDOR.map((e) => [e.chave, agora])), agora);
  assert.equal(completa.etapaAtual, null);
  assert.equal(completa.diasParado, null);
  assert.equal(completa.pct, 100);
});

test("funil: quantos cumpriram cada etapa, perdidos e parados nela", () => {
  const def = [{ chave: "a", label: "A" }, { chave: "b", label: "B" }, { chave: "c", label: "C" }];
  const jornadas = [{ a: 1, b: 1, c: 1 }, { a: 1, b: 1 }, { a: 1 }, {}].map((m) => montarJornada(def, m));
  const f = agregarFunil(def, jornadas);
  assert.deepEqual(f.map((p) => p.total), [3, 2, 1]);
  assert.deepEqual(f.map((p) => p.perdidos), [1, 1, 1]);
  assert.deepEqual(f.map((p) => p.paradosAqui), [1, 1, 1]);
});

test("rotas da jornada: evento público, vínculo no cadastro e relatório só para admin", async (t) => {
  const { base } = await subirServidor(t);
  const req = cliente(base);
  const vid = "visitante-teste-123";

  let r = await req("/jornada/evento", { body: { visitanteId: "x", evento: "visita" } });
  assert.equal(r.status, 400);
  r = await req("/jornada/evento", { body: { visitanteId: vid, evento: "apagar_tudo" } });
  assert.equal(r.status, 400);

  r = await req("/jornada/evento", { body: { visitanteId: vid, evento: "visita", origem: { utm_source: "facebook", utm_campaign: "lancamento", senha: "x" } } });
  assert.equal(r.status, 200);
  await req("/jornada/evento", { body: { visitanteId: vid, evento: "visita" } });
  await req("/jornada/evento", { body: { visitanteId: vid, evento: "cadastro_aberto", papel: "empresa" } });
  await req("/jornada/evento", { body: { visitanteId: vid, evento: "cadastro_etapa", papel: "empresa", etapa: "acesso" } });

  r = await req("/onboarding/criar-conta", { body: { email: "jornada@exemplo.invalid", senha: "12345678", nomeEmpresa: "Empresa Jornada", pais: "BR", visitanteId: vid } });
  assert.equal(r.status, 200);
  const cookieEmpresa = r.cookie;

  r = await req("/admin/jornada?tipo=empresa", { cookie: cookieEmpresa });
  assert.equal(r.status, 403);

  r = await req("/admin/jornada?tipo=empresa&dias=30", { cookie: assinar({ id: "admin-teste", role: "admin", entityId: null }) });
  assert.equal(r.status, 200);
  const item = r.corpo.itens.find((i) => i.email === "jornada@exemplo.invalid");
  assert.equal(item.origem, "meta");
  assert.equal(item.campanhaOrigem, "lancamento");
  assert.equal(item.etapas.find((e) => e.chave === "conta").feito, true);
  assert.equal(item.etapaAtual.chave, "empresa");
  const cadastro = Object.fromEntries(r.corpo.cadastro.map((p) => [p.chave, p.total]));
  assert.deepEqual(cadastro, { visita: 1, cadastro_aberto: 1, etapa_acesso: 1, conta: 1 });
  assert.ok(r.corpo.origens.some((o) => o.chave === "meta" && o.total === 1));

  r = await req("/admin/jornada?tipo=empresa&origem=meta", { cookie: assinar({ id: "admin-teste", role: "admin", entityId: null }) });
  assert.equal(r.corpo.itens.length, 1);
  assert.equal(r.corpo.funil[0].total, 1);
  assert.equal(r.corpo.funil.find((p) => p.chave === "empresa").paradosAqui, 1);
});

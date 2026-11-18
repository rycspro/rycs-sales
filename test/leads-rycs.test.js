import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Banco temporário e Meta simulada: nenhuma chamada sai de verdade.
const dir = mkdtempSync(join(tmpdir(), "rycs-leads-"));
Object.assign(process.env, {
  DB_PATH: join(dir, "test.db"), JWT_SECRET: "segredo-teste-leads", NODE_ENV: "test",
  RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", META_CAPI_TOKEN: "", META_ADS_TOKEN: "token-sistema",
});
const pedidos = [];
const lead = (id, email, telefone, anuncio, quando) => ({
  id, created_time: quando, form_id: "f1", ad_id: `ad-${anuncio}`, ad_name: anuncio, adset_id: "as1", adset_name: "[INDIA] [INGLES] [TODOS]",
  campaign_id: "c1", campaign_name: "[SELLERS] [INDIA]", platform: "ig", is_organic: false,
  field_data: [{ name: "full_name", values: [`Lead ${id}`] }, { name: "email", values: [email] }, { name: "phone_number", values: [telefone] }],
});
globalThis.fetch = async (url) => {
  const u = new URL(url);
  pedidos.push({ caminho: u.pathname, token: u.searchParams.get("access_token"), filtro: u.searchParams.get("filtering") });
  const resposta = (corpo) => new Response(JSON.stringify(corpo), { status: 200 });
  if (u.pathname.endsWith("/1500235606487832")) return resposta({ id: "1500235606487832", access_token: "token-pagina" });
  if (u.pathname.endsWith("/leadgen_forms")) return resposta({ data: [{ id: "f1", name: "India sellers" }] });
  if (u.pathname.endsWith("/f1/leads")) return resposta({ data: [
    lead("L1", "ravi@exemplo.invalid", "+91 98765 43210", "Video A", "2026-11-16T10:00:00+0000"),
    lead("L2", "asha@exemplo.invalid", "+91 91234 56789", "Video B", "2026-11-17T10:00:00+0000"),
  ] });
  return new Response(JSON.stringify({ error: { message: "rota inesperada" } }), { status: 400 });
};
const leadsRycs = await import("../server/services/metaLeadsRycs.js");
const { default: db } = await import("../server/db.js");
test.after(() => rmSync(dir, { recursive: true, force: true }));

test("importa os leads dos formulários da Página com o token da Página, sem repetir", async () => {
  const r = await leadsRycs.sincronizarLeadsRycs();
  assert.deepEqual(r, { novos: 2 });
  const doLead = pedidos.find((p) => p.caminho.endsWith("/f1/leads"));
  assert.equal(doLead.token, "token-pagina");
  assert.equal(doLead.filtro, null, "primeira busca traz tudo");

  const deNovo = await leadsRycs.sincronizarLeadsRycs();
  assert.deepEqual(deNovo, { novos: 0 });
  assert.ok(pedidos.filter((p) => p.caminho.endsWith("/f1/leads")).at(-1).filtro.includes("time_created"), "depois, só desde o último lead");

  const st = leadsRycs.statusLeadsRycs();
  assert.equal(st.total, 2);
  assert.equal(st.erro, "");
});

test("lead que virou conta: pelo e-mail ou pelo telefone", () => {
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, aceitouTermos, criadoEm) VALUES ('u1', 'ravi@exemplo.invalid', 'x', 'vendedor', 's1', 1, ?)").run(Date.now());
  const lista = leadsRycs.leadsRycs();
  const porId = Object.fromEntries(lista.map((l) => [l.id, l]));
  assert.equal(porId.L1.conta, true);
  assert.equal(porId.L1.contaPapel, "vendedor");
  assert.equal(porId.L2.conta, false);
  assert.equal(porId.L1.campanha, "[SELLERS] [INDIA]");
  assert.equal(porId.L1.anuncio, "Video A");
  assert.equal(porId.L1.nome, "Lead L1");
});

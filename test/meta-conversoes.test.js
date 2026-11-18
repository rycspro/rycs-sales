import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

// Banco temporário e token falso antes de carregar o serviço. Nenhuma
// chamada sai de verdade: o fetch é trocado por um que só anota o pedido.
const dir = mkdtempSync(join(tmpdir(), "rycs-capi-"));
Object.assign(process.env, {
  DB_PATH: join(dir, "test.db"), JWT_SECRET: "segredo-teste-capi", NODE_ENV: "test",
  RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", META_CAPI_TOKEN: "token-falso", META_TEST_EVENT_CODE: "",
});
const enviados = [];
globalThis.fetch = async (url, opcoes) => {
  enviados.push({ url: String(url), corpo: JSON.parse(opcoes.body) });
  return new Response("{}", { status: 200 });
};
const capi = await import("../server/services/metaConversoes.js");
const { limparOrigem } = await import("../shared/jornada.js");
const { META_PIXEL_ID } = await import("../shared/metaPixel.js");
const { default: db } = await import("../server/db.js");
test.after(() => rmSync(dir, { recursive: true, force: true }));

const sha = (v) => createHash("sha256").update(v).digest("hex");
const esperarEnvios = async (n) => {
  for (let i = 0; i < 100 && enviados.length < n; i++) await new Promise((r) => setTimeout(r, 10));
};
const pedido = (body, cookies = {}) => ({
  body, cookies, ip: "::ffff:200.10.20.30",
  get: (h) => (h.toLowerCase() === "user-agent" ? "Mozilla/5.0 (Teste)" : ""),
});

test("dados de correspondência: normalizados como a Meta pede e em SHA-256", () => {
  const ud = capi.dadosCorrespondencia({
    email: " Ana@Exemplo.com ", telefone: "(11) 98888-7777", pais: "BR", nome: "Ána Maria Souza",
    cidade: "São Paulo, SP", estado: "SP", nascimento: "10/05/1990", genero: "feminino", userId: "u1",
  });
  assert.deepEqual(ud, {
    em: [sha("ana@exemplo.com")], ph: [sha("5511988887777")], fn: [sha("ana")], ln: [sha("souza")],
    ct: [sha("saopaulo")], st: [sha("sp")], country: [sha("br")], db: [sha("19900510")], ge: [sha("f")],
    external_id: [sha("u1")],
  });
  assert.equal(capi.normalizarTelefone("+55 11 98888-7777"), "5511988887777");
  assert.equal(capi.dadosCorrespondencia({ genero: "nao-binario", nascimento: "1990-05-10" }).ge, undefined);
  assert.deepEqual(capi.dadosCorrespondencia({ nascimento: "1990-05-10" }).db, [sha("19900510")]);
});

test("origem guarda o fbclid inteiro (até 500), os outros campos seguem curtos", () => {
  const longo = "IwAR" + "a".repeat(300);
  assert.equal(limparOrigem({ fbclid: longo, utm_campaign: "c".repeat(300) }).fbclid, longo);
  assert.equal(limparOrigem({ utm_campaign: "c".repeat(300) }).utm_campaign.length, 120);
});

const t = Date.now();
const fbclid = "IwAR" + "x".repeat(200);
db.prepare("INSERT INTO companies (id, nome, produto, documento, pais, moeda, logo, criadoEm) VALUES ('c-emp', 'Empresa Teste', '', '', 'BR', 'BRL', '', ?)").run(t);
db.prepare(`INSERT INTO users (id, email, senha, role, entityId, aceitouTermos, emailVerificado, criadoEm, origem, visitanteId)
  VALUES ('u-emp', 'dono@exemplo.invalid', 'x', 'empresa', 'c-emp', 1, 0, ?, ?, 'visitante-123')`).run(t, JSON.stringify({ fbclid }));
db.prepare("INSERT INTO jornada_visitantes (visitanteId, origem, papel, primeiroEm) VALUES ('visitante-123', '{}', 'empresa', ?)").run(t - 60_000);

test("cadastro sem aceite de cookies não vai para a Meta nem fica guardado", async () => {
  capi.registrarCadastroMeta(pedido({ email: "dono@exemplo.invalid", meta: { consentimento: false } }), "u-emp", "empresa");
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(enviados.length, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM meta_contatos").get().n, 0);
});

test("cadastro com aceite: CompleteRegistration com o event_id do navegador, uma vez só", async () => {
  const corpo = { email: "Dono@Exemplo.invalid", whats: "+5511988887777", pais: "BR", meta: { eventId: "evento-cadastro-1", consentimento: true, fbp: "fb.1.1700000000000.123456789" } };
  capi.registrarCadastroMeta(pedido(corpo), "u-emp", "empresa");
  await esperarEnvios(1);
  assert.equal(enviados.length, 1);
  const { url, corpo: enviado } = enviados[0];
  assert.match(url, new RegExp(`/${META_PIXEL_ID}/events$`));
  assert.equal(enviado.access_token, "token-falso");
  const [ev] = enviado.data;
  assert.equal(ev.event_name, "CompleteRegistration");
  assert.equal(ev.event_id, "evento-cadastro-1");
  assert.equal(ev.action_source, "website");
  assert.equal(ev.custom_data.content_category, "empresa");
  assert.deepEqual(ev.user_data.em, [sha("dono@exemplo.invalid")]);
  assert.deepEqual(ev.user_data.ph, [sha("5511988887777")]);
  assert.equal(ev.user_data.fn, undefined, "nome da empresa não vira nome de pessoa");
  assert.equal(ev.user_data.client_ip_address, "200.10.20.30");
  assert.equal(ev.user_data.client_user_agent, "Mozilla/5.0 (Teste)");
  assert.equal(ev.user_data.fbp, "fb.1.1700000000000.123456789");
  // Sem cookie _fbc: montado com o fbclid do primeiro toque e a hora da visita.
  assert.equal(ev.user_data.fbc, `fb.1.${t - 60_000}.${fbclid}`);

  capi.registrarCadastroMeta(pedido(corpo), "u-emp", "empresa");
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(enviados.length, 1);
});

test("marcos depois do cadastro viram eventos de qualidade, sem repetir", async () => {
  await capi.rodadaQualidade();
  assert.equal(enviados.length, 1, "nada novo enquanto nenhum marco foi cumprido");

  db.prepare("UPDATE users SET emailVerificado = 1 WHERE id = 'u-emp'").run();
  db.prepare("INSERT INTO deposit_requests (id, companyId, valor, status, criadoEm, confirmadoEm) VALUES ('d1', 'c-emp', 500, 'confirmado', ?, ?)").run(t, t);
  await capi.rodadaQualidade();
  const nomes = enviados.slice(1).map((e) => e.corpo.data[0].event_name).sort();
  assert.deepEqual(nomes, ["EmailConfirmado", "Purchase"]);
  const compra = enviados.find((e) => e.corpo.data[0].event_name === "Purchase").corpo.data[0];
  assert.deepEqual(compra.custom_data, { content_category: "empresa", value: 500, currency: "BRL" });
  assert.deepEqual(compra.user_data.em, [sha("dono@exemplo.invalid")]);

  await capi.rodadaQualidade();
  assert.equal(enviados.length, 3);
});

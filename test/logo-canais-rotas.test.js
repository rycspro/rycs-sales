import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { createHmac } from "node:crypto";
import { subirServidor, assinar, cliente } from "./apoio/servidor.js";
import { tipoDoLogo, avaliarLogo, LOGO_MAX_BYTES } from "../shared/onboarding.js";

test("logo: o tipo sai do navegador ou da extensão", () => {
  assert.equal(tipoDoLogo("image/jpg", "a.bin"), "image/jpeg");
  assert.equal(tipoDoLogo("", "Logo.HEIC"), "image/heic");
  assert.equal(tipoDoLogo("", "marca.svg"), "image/svg+xml");
  assert.equal(tipoDoLogo("application/pdf", "logo.pdf"), "");
  assert.equal(avaliarLogo({ mimetype: "image/png", tamanhoBytes: LOGO_MAX_BYTES }), null);
});

test("rotas: logo livre, canais, ERP, pedidos e webhook assinado", async (t) => {
  const { base, dbPath } = await subirServidor(t, { META_APP_SECRET: "segmeta", INSTAGRAM_APP_SECRET: "segig", WHATSAPP_PHONE_NUMBER_ID: "RYCS1", WHATSAPP_TOKEN: "" });
  const req = cliente(base);
  const db = new Database(dbPath);
  t.after(() => db.close());
  const T = Date.now();
  for (const c of ["c1", "c2"]) db.prepare("INSERT INTO companies (id, nome, produto, criadoEm) VALUES (?, ?, 'x', ?)").run(c, c, T);
  const emp = assinar({ id: "u1", role: "empresa", entityId: "c1" }), emp2 = assinar({ id: "u2", role: "empresa", entityId: "c2" });
  const vend = assinar({ id: "uv", role: "vendedor", entityId: "s1" }), admin = assinar({ id: "a", role: "admin" });

  // Logo: largo, pequeno, SVG e WebP passam. O que era recusado pela regra da foto.
  const svg = (x) => Buffer.from(x).toString("base64");
  for (const [mimetype, base64] of [["image/png", "QUFBQQ=="], ["image/webp", "QUFBQQ=="], ["image/svg+xml", svg('<svg width="900" height="90"><rect/></svg>')]])
    assert.equal((await req("/companies/c1/logo", { cookie: emp, body: { mimetype, base64 } })).status, 200, mimetype);
  assert.equal((await req("/companies/c1/logo", { cookie: emp, body: { mimetype: "image/svg+xml", base64: svg("<svg onload='x()'/>") } })).status, 422);
  assert.equal((await req("/companies/c1/logo", { cookie: emp, body: { mimetype: "image/png", base64: Buffer.alloc(LOGO_MAX_BYTES + 10).toString("base64") } })).status, 422);
  assert.equal((await req("/companies/c1/logo", { cookie: emp2, body: { mimetype: "image/png", base64: "QUFBQQ==" } })).status, 403);

  // Canais
  assert.equal((await req("/canais")).status, 401);
  assert.equal((await req("/canais", { cookie: admin })).status, 403);
  const c = await req("/canais", { cookie: emp });
  assert.equal(c.corpo.whatsapp.configurada, false, "sem a configuração da Meta, a tela não oferece o botão");
  assert.equal((await req("/canais/instagram/iniciar", { cookie: emp, body: {} })).status, 400, "exige o aceite");
  assert.equal((await req("/canais/instagram/iniciar", { cookie: vend, body: { consentimento: true } })).status, 403);
  assert.equal((await req("/canais/whatsapp/conectar", { cookie: emp, body: { consentimento: true, code: "x", wabaId: "12345" } })).status, 503);
  assert.equal((await req("/canais/conversas/nao-existe", { cookie: emp })).status, 404);

  // ERP e pedidos são só da empresa
  for (const rota of ["/erp", "/pedidos", "/pedidos/catalogo"]) {
    assert.equal((await req(rota, { cookie: vend })).status, 403, rota);
    assert.equal((await req(rota, { cookie: emp })).status, 200, rota);
  }
  const p = await req("/pedidos", { cookie: emp, body: { cliente: { nome: "Ana" }, itens: [{ nome: "Mesa", quantidade: 1, valor: 10 }] } });
  assert.equal(p.corpo.numero, 1);
  assert.equal((await req(`/pedidos/${p.corpo.id}`, { cookie: emp2 })).status, 404);
  assert.equal((await req(`/pedidos/${p.corpo.id}/aprovar`, { cookie: emp2, body: {} })).status, 404);
  assert.equal((await req(`/pedidos/${p.corpo.id}/enviar`, { cookie: emp, body: {} })).status, 409, "sem ERP conectado");
  assert.equal((await req("/erp/in/erp_qualquercoisaquenaoexiste", { body: { produtos: [] } })).status, 401);

  // Grupo de suporte
  assert.equal((await req("/admin/whatsapp/grupos", { cookie: emp })).status, 403);
  assert.equal((await req("/suporte/grupo/0123456789abcdef0123456789abcdef")).status, 404);

  // Webhook: assinatura errada não entra; a do produto Instagram vale só para o Instagram.
  const enviar = (corpo, segredo) => { const bruto = JSON.stringify(corpo); return req("/webhooks/meta", { bruto, headers: { "Content-Type": "application/json", "x-hub-signature-256": `sha256=${createHmac("sha256", segredo).update(bruto).digest("hex")}` } }); };
  assert.equal((await enviar({ object: "instagram", entry: [] }, "errado")).status, 401);
  assert.equal((await enviar({ object: "instagram", entry: [] }, "segig")).status, 200);
  assert.equal((await enviar({ object: "whatsapp_business_account", entry: [] }, "segig")).status, 401);
  // Cliente de empresa desconhecida não entra na caixa da RYCS.
  await enviar({ object: "whatsapp_business_account", entry: [{ id: "W", changes: [{ field: "messages", value: { metadata: { phone_number_id: "OUTRO" }, messages: [{ from: "5511", id: "x1", timestamp: "1", type: "text", text: { body: "sair" } }] } }] }] }, "segmeta");
  await enviar({ object: "whatsapp_business_account", entry: [{ id: "W", changes: [{ field: "messages", value: { metadata: { phone_number_id: "RYCS1" }, messages: [{ from: "5511", id: "x2", timestamp: "1", type: "text", text: { body: "oi" } }] } }] }] }, "segmeta");
  for (let i = 0; i < 50 && !db.prepare("SELECT 1 FROM whatsapp_mensagens").get(); i++) await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(db.prepare("SELECT wamid FROM whatsapp_mensagens").all().map((x) => x.wamid), ["x2"]);
});

// Assinatura do webhook do Resend (Svix): só aceita o que foi assinado com o
// segredo, dentro da janela de tempo.
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { assinaturaResendValida } from "../server/services/assinaturaResend.js";

const SEGREDO = `whsec_${Buffer.from("segredo-de-teste-123").toString("base64")}`;
const AGORA = Date.UTC(2026, 10, 17, 12);
const assinar = (id, ts, corpo, segredo = SEGREDO) =>
  `v1,${createHmac("sha256", Buffer.from(segredo.replace(/^whsec_/, ""), "base64")).update(`${id}.${ts}.${corpo}`).digest("base64")}`;

test("aceita evento assinado com o segredo", () => {
  const ts = String(AGORA / 1000), corpo = '{"type":"email.opened","data":{"email_id":"e1"}}';
  assert.equal(assinaturaResendValida({ id: "msg_1", timestamp: ts, assinatura: assinar("msg_1", ts, corpo), corpo, segredo: SEGREDO, agora: AGORA }), true);
  // várias assinaturas no cabeçalho: basta uma valer
  assert.equal(assinaturaResendValida({ id: "msg_1", timestamp: ts, assinatura: `v1,AAAA ${assinar("msg_1", ts, corpo)}`, corpo, segredo: SEGREDO, agora: AGORA }), true);
});

test("recusa corpo alterado, segredo errado, sem segredo e fora do prazo", () => {
  const ts = String(AGORA / 1000), corpo = '{"a":1}';
  const sig = assinar("m", ts, corpo);
  assert.equal(assinaturaResendValida({ id: "m", timestamp: ts, assinatura: sig, corpo: '{"a":2}', segredo: SEGREDO, agora: AGORA }), false);
  assert.equal(assinaturaResendValida({ id: "m", timestamp: ts, assinatura: assinar("m", ts, corpo, `whsec_${Buffer.from("outro").toString("base64")}`), corpo, segredo: SEGREDO, agora: AGORA }), false);
  assert.equal(assinaturaResendValida({ id: "m", timestamp: ts, assinatura: sig, corpo, segredo: "", agora: AGORA }), false);
  assert.equal(assinaturaResendValida({ id: "m", timestamp: ts, assinatura: sig, corpo, segredo: SEGREDO, agora: AGORA + 10 * 60 * 1000 }), false);
});

// Ponta a ponta: o webhook assinado marca o envio como aberto e clicado, a
// reentrega não conta de novo e as métricas do admin refletem isso.
import Database from "better-sqlite3";
import { subirServidor, cliente, assinar as assinarCookie } from "./apoio/servidor.js";

test("webhook do Resend alimenta as métricas da sequência", async (t) => {
  const { base, dbPath } = await subirServidor(t, { RESEND_WEBHOOK_SECRET: SEGREDO });
  const db = new Database(dbPath);
  t.after(() => db.close());
  db.prepare(`INSERT INTO email_sequencia_envios (id, chave, sequencia, destinatarioTipo, destinatarioId, email, assunto, status, resendId, enviadoEm)
    VALUES ('e1', 'onboarding:boas_vindas', 'onboarding', 'vendedor', 's1', 'a@b.com', 'Oi', 'enviado', 're_1', ?)`).run(Date.now());

  const req = cliente(base);
  const evento = async (svixId, type, extra = {}) => {
    const corpo = JSON.stringify({ type, created_at: new Date().toISOString(), data: { email_id: "re_1", to: ["a@b.com"], ...extra } });
    const ts = String(Math.floor(Date.now() / 1000));
    return req("/webhooks/resend", { bruto: corpo, headers: { "Content-Type": "application/json", "svix-id": svixId, "svix-timestamp": ts, "svix-signature": assinar(svixId, ts, corpo) } });
  };

  assert.equal((await req("/webhooks/resend", { bruto: "{}", headers: { "Content-Type": "application/json", "svix-id": "x", "svix-timestamp": "1", "svix-signature": "v1,AAAA" } })).status, 401);
  assert.equal((await evento("m1", "email.delivered")).status, 200);
  assert.equal((await evento("m2", "email.opened")).status, 200);
  assert.equal((await evento("m2", "email.opened")).corpo.resultado, "duplicado");
  assert.equal((await evento("m3", "email.clicked", { click: { link: "https://app.rycs.pro/plataforma" } })).status, 200);

  const linha = db.prepare("SELECT entregueEm, abertoEm, aberturas, clicadoEm, cliques FROM email_sequencia_envios WHERE id = 'e1'").get();
  assert.ok(linha.entregueEm && linha.abertoEm && linha.clicadoEm);
  assert.equal(linha.aberturas, 1);
  assert.equal(linha.cliques, 1);

  const m = await req("/admin/sequencias-email/metricas", { cookie: assinarCookie({ id: "admin-teste", role: "admin", entityId: null }) });
  assert.equal(m.status, 200);
  assert.equal(m.corpo.total.enviados, 1);
  assert.equal(m.corpo.total.taxaAbertura, 100);
  assert.equal(m.corpo.total.taxaClique, 100);
  assert.equal(m.corpo.passos["onboarding:boas_vindas"].abertos, 1);
  assert.equal(m.corpo.linksMaisClicados[0].link, "https://app.rycs.pro/plataforma");
});

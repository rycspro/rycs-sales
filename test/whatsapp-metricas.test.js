import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Banco temporário antes de carregar os serviços.
const dir = mkdtempSync(join(tmpdir(), "rycs-wa-metricas-"));
Object.assign(process.env, {
  DB_PATH: join(dir, "test.db"), JWT_SECRET: "segredo-teste-wa-metricas", NODE_ENV: "test", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "",
});
const { guardarAvisoWhatsapp } = await import("../server/services/whatsapp.js");
const { metricasWhatsapp } = await import("../server/services/whatsappMetricas.js");
const { default: db } = await import("../server/db.js");
test.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

const T0 = Date.UTC(2026, 10, 18, 12, 0);
const seg = (ms) => String(Math.floor(ms / 1000));
const webhook = (value) => guardarAvisoWhatsapp({ object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [{ field: "messages",
  value: { metadata: { phone_number_id: "PN1" }, ...value } }] }] });

test("sem nada enviado: painel zerado, sem alarme de webhook", () => {
  const m = metricasWhatsapp();
  assert.equal(m.total.enviados, 0);
  assert.equal(m.total.taxaEntrega, null);
  assert.deepEqual(m.modelos, []);
  assert.equal(m.semAvisoDaMeta, false);
});

test("espelho do disparo: entrega, leitura, resposta, falha e saída por modelo", () => {
  db.prepare(`INSERT INTO whatsapp_disparos (id, adminId, template, idioma, templateDados, publico, total, status, criadoEm)
    VALUES ('d1', 'admin', 'aviso_teste', 'pt_BR', '{}', 'Vendedores ativos', 6, 'parcial', ?)`).run(T0);
  const envio = db.prepare("INSERT INTO whatsapp_envios (id, disparoId, numero, wamid, status, erro, enviadoEm) VALUES (?, 'd1', ?, ?, ?, ?, ?)");
  envio.run("e1", "5511911111111", "w1", "enviado", "", T0);
  envio.run("e2", "5511922222222", "w2", "enviado", "", T0);
  envio.run("e3", "5511933333333", "w3", "enviado", "", T0);
  envio.run("e4", "5511944444444", "", "falhou", "131026 Message undeliverable", T0);
  envio.run("e5", "5511955555555", "", "falhou", "Disparo interrompido", T0);
  envio.run("e6", "5515998887777", "w6", "enviado", "", T0);

  // Reativação de empresas também sai pelo número e entra no mesmo painel.
  db.exec(`CREATE TABLE IF NOT EXISTS reativacao_whatsapp (id TEXT PRIMARY KEY, inscricaoId TEXT NOT NULL, companyId TEXT NOT NULL, dia INTEGER NOT NULL,
    modelo TEXT NOT NULL, numero TEXT DEFAULT '', wamid TEXT DEFAULT '', status TEXT NOT NULL, erro TEXT DEFAULT '', criadoEm INTEGER NOT NULL, enviadoEm INTEGER)`);
  db.prepare(`INSERT INTO reativacao_whatsapp (id, inscricaoId, companyId, dia, modelo, numero, wamid, status, criadoEm, enviadoEm)
    VALUES ('r1', 'i1', 'c1', 1, 'rycs_reativacao_d1', '5521977777777', 'w7', 'enviado', ?, ?)`).run(T0, T0);

  webhook({ statuses: [
    { id: "w1", status: "delivered", recipient_id: "5511911111111", timestamp: seg(T0 + 60e3) },
    { id: "w1", status: "read", recipient_id: "5511911111111", timestamp: seg(T0 + 120e3) },
    { id: "w2", status: "delivered", recipient_id: "5511922222222", timestamp: seg(T0 + 60e3) },
    { id: "w3", status: "failed", recipient_id: "5511933333333", timestamp: seg(T0 + 60e3), errors: [{ code: 131026, title: "Message undeliverable" }] },
    { id: "w7", status: "delivered", recipient_id: "5521977777777", timestamp: seg(T0 + 60e3) },
  ] });
  webhook({ messages: [
    // Tocou no botão da mensagem w1.
    { from: "5511911111111", id: "in1", timestamp: seg(T0 + 3600e3), type: "button", context: { id: "w1" }, button: { text: "Quero saber mais" } },
    // Pediu para sair: conta como saída da w2, não como resposta.
    { from: "5511922222222", id: "in2", timestamp: seg(T0 + 3600e3), type: "text", text: { body: "SAIR" } },
    // Respondeu a w6 escrevendo, com o número sem o nono dígito.
    { from: "551598887777", id: "in3", timestamp: seg(T0 + 86400e3), type: "text", text: { body: "Oi, como faço?" } },
  ] });

  const m = metricasWhatsapp();
  const { enviados, falhasEnvio, entregues, lidos, falhasEntrega, responderam, saidas, falhas } = m.total;
  assert.deepEqual({ enviados, falhasEnvio, entregues, lidos, falhasEntrega, responderam, saidas, falhas },
    { enviados: 5, falhasEnvio: 1, entregues: 3, lidos: 1, falhasEntrega: 1, responderam: 2, saidas: 1, falhas: 2 }, "'Disparo interrompido' nunca saiu e fica fora");
  assert.equal(m.total.taxaEntrega, 60);
  assert.equal(m.total.taxaSaida, 20);
  assert.equal(m.total.taxaFalha, 33.3);

  assert.deepEqual(m.modelos.map((x) => [x.modelo, x.origem, x.enviados]),
    [["aviso_teste", "Disparo do admin", 4], ["rycs_reativacao_d1", "Reativação de empresas", 1]]);
  assert.equal(m.modelos[1].taxaEntrega, 100);
  assert.deepEqual(m.recebidas, { mensagens: 3, pessoas: 3, pediramParaSair: 1, ultima: T0 + 86400e3 });
  assert.equal(m.semAvisoDaMeta, false);
  assert.equal(m.avisosRecebidos, 5);
  assert.deepEqual(m.errosMaisComuns, [{ erro: "131026 Message undeliverable", n: 2 }], "falha no envio e na entrega somam pelo mesmo erro");
});

test("mensagens saíram e nenhum aviso da Meta chegou: alerta de webhook", () => {
  db.exec("DELETE FROM whatsapp_status");
  assert.equal(metricasWhatsapp().semAvisoDaMeta, true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "rycs-wa-conversas-"));
Object.assign(process.env, {
  DB_PATH: join(dir, "test.db"), JWT_SECRET: "segredo-teste-wa-conversas", NODE_ENV: "test", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "",
  WHATSAPP_TOKEN: "tok", WHATSAPP_PHONE_NUMBER_ID: "PN1", WHATSAPP_WABA_ID: "WABA1",
});
const meta = await import("../server/services/meta.js");
const { guardarAvisoWhatsapp } = await import("../server/services/whatsapp.js");
const conv = await import("../server/services/whatsappConversas.js");
const { default: db } = await import("../server/db.js");
test.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

let chamadas = [];
let responder = () => ({ messages: [{ id: `wamid.out${chamadas.length}` }] });
meta.usarFetch(async (url, opcoes = {}) => {
  const corpo = opcoes.body ? JSON.parse(opcoes.body) : null;
  chamadas.push({ url, metodo: opcoes.method, corpo });
  const r = responder({ url, corpo });
  return { ok: !r.error, status: r.error ? 400 : 200, json: async () => r };
});

// Relógio real: as saídas registradas usam Date.now() e precisam vir depois das mensagens.
const AGORA = Date.now();
const seg = (ms) => String(Math.floor(ms / 1000));
const recebe = (de, id, ms, extra) => guardarAvisoWhatsapp({ object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [{ field: "messages", value: {
  metadata: { phone_number_id: "PN1" }, contacts: [{ wa_id: de, profile: { name: "Ana no Zap" } }],
  messages: [{ from: de, id, timestamp: seg(ms), type: "text", text: { body: "" }, ...extra }],
} }] }] });

test("mesmo contato com e sem o nono dígito vira uma conversa só", () => {
  assert.equal(conv.chaveNumero("551598887777"), "5515998887777");
  assert.equal(conv.chaveNumero("+55 (15) 99888-7777"), "5515998887777");
  assert.equal(conv.chaveNumero("919876543210"), "919876543210");
});

test("caixa de entrada: quem escreveu, nome do cadastro, não lidas e janela de 24h", () => {
  db.prepare("INSERT INTO sellers (id, nome, email, whats, status, pais, criadoEm) VALUES ('s1', 'Ana Souza', 'a@x.invalid', '(15) 99888-7777', 'aprovado', 'Brasil', ?)").run(AGORA);
  db.prepare(`INSERT INTO whatsapp_disparos (id, adminId, template, idioma, templateDados, variaveis, publico, total, status, criadoEm)
    VALUES ('d1', 'admin', 'rycs_conta_ativa_aceite', 'pt_BR', ?, ?, 'Vendedores ativos', 2, 'concluido', ?)`)
    .run(JSON.stringify({ corpo: "Olá, {{1}}! Aqui é a RYCS.", variaveis: ["1"], botoes: [{ tipo: "QUICK_REPLY", texto: "Sim, quero receber" }] }),
      JSON.stringify([{ origem: "nome" }]), AGORA - 5 * 3600e3);
  db.prepare("INSERT INTO whatsapp_envios (id, disparoId, nome, numero, wamid, status, enviadoEm) VALUES ('e1', 'd1', 'Ana', '5515998887777', 'w1', 'enviado', ?)").run(AGORA - 5 * 3600e3);
  db.prepare("INSERT INTO whatsapp_envios (id, disparoId, nome, numero, wamid, status, enviadoEm) VALUES ('e2', 'd1', 'Beto', '5511922223333', 'w2', 'enviado', ?)").run(AGORA - 5 * 3600e3);
  // Ana respondeu pelo botão; o WhatsApp identificou o número sem o nono dígito.
  recebe("551598887777", "in1", AGORA - 4 * 3600e3, { type: "button", button: { text: "Sim, quero receber" }, context: { id: "w1" } });
  recebe("551598887777", "in2", AGORA - 3 * 3600e3, { text: { body: "Como faço para completar o perfil?" } });

  const so = conv.listarConversas({ agoraMs: AGORA });
  assert.equal(so.length, 1, "por padrão só quem escreveu");
  const ana = so[0];
  assert.equal(ana.numero, "5515998887777");
  assert.equal(ana.destino, "551598887777", "responde no número exato que escreveu");
  assert.equal(ana.nome, "Ana Souza");
  assert.equal(ana.cadastro.tipo, "Profissional");
  assert.equal(ana.naoLidas, 2);
  assert.equal(ana.janelaAte, Math.floor((AGORA - 3 * 3600e3) / 1000) * 1000 + 24 * 3600e3, "24h depois da última mensagem (em segundos, como a Meta manda)");
  assert.equal(ana.ultima.texto, "Como faço para completar o perfil?");
  assert.deepEqual(conv.listarConversas({ filtro: "todas", agoraMs: AGORA }).map((c) => c.numero).sort(), ["5511922223333", "5515998887777"]);
  assert.equal(conv.listarConversas({ busca: "souza", agoraMs: AGORA }).length, 1);
});

test("conversa aberta: histórico em ordem, texto do disparo preenchido e marca como lida", () => {
  const c = conv.abrirConversa("5515998887777", { agoraMs: AGORA });
  assert.deepEqual(c.itens.map((i) => [i.direcao, i.texto]), [
    ["enviada", "Olá, Ana! Aqui é a RYCS."], ["recebida", "Sim, quero receber"], ["recebida", "Como faço para completar o perfil?"],
  ]);
  assert.equal(c.itens[0].botoes[0].texto, "Sim, quero receber");
  assert.equal(conv.listarConversas({ agoraMs: AGORA })[0].naoLidas, 0);
});

test("resposta livre só dentro das 24h, no número exato, e fica no histórico", async () => {
  chamadas = [];
  await conv.responder("5515998887777", "Oi Ana! Vai em Meu Perfil e completa foto e cidade.", { adminId: "adm", agoraMs: AGORA });
  assert.equal(chamadas.length, 1);
  assert.deepEqual({ to: chamadas[0].corpo.to, type: chamadas[0].corpo.type, body: chamadas[0].corpo.text.body },
    { to: "551598887777", type: "text", body: "Oi Ana! Vai em Meu Perfil e completa foto e cidade." });
  const ultima = conv.abrirConversa("5515998887777", { agoraMs: AGORA }).itens.at(-1);
  assert.deepEqual([ultima.direcao, ultima.origem, ultima.texto], ["enviada", "Resposta do admin", "Oi Ana! Vai em Meu Perfil e completa foto e cidade."]);

  await assert.rejects(conv.responder("5515998887777", "  "), /Escreva/);
  await assert.rejects(conv.responder("5515998887777", "oi", { agoraMs: AGORA + 25 * 3600e3 }), /24h/);
  await assert.rejects(conv.responder("5511922223333", "oi", { agoraMs: AGORA }), /24h/, "quem nunca escreveu não tem janela");
});

test("fora da janela: modelo aprovado para uma pessoa, e nunca para quem pediu para sair", async () => {
  chamadas = [];
  responder = ({ url }) => (url.includes("/message_templates")
    ? { data: [{ name: "rycs_retomar", language: "pt_BR", category: "UTILITY", status: "APPROVED", components: [{ type: "BODY", text: "Oi {{1}}, posso ajudar com o seu perfil?" }] }] }
    : { messages: [{ id: "wamid.modelo" }] });
  await conv.enviarModelo("5511922223333", { template: "rycs_retomar", idioma: "pt_BR", variaveis: [{ origem: "fixo", texto: "Beto" }] }, { adminId: "adm" });
  const envio = chamadas.find((c) => c.metodo === "POST");
  assert.equal(envio.corpo.template.name, "rycs_retomar");
  assert.equal(envio.corpo.to, "5511922223333");
  const ultima = conv.abrirConversa("5511922223333").itens.at(-1);
  assert.deepEqual([ultima.origem, ultima.modelo, ultima.texto], ["Modelo enviado pelo admin", "rycs_retomar", "Oi Beto, posso ajudar com o seu perfil?"]);

  recebe("5511922223333", "in3", AGORA, { text: { body: "SAIR" } });
  await assert.rejects(conv.enviarModelo("5511922223333", { template: "rycs_retomar", idioma: "pt_BR", variaveis: [{ origem: "fixo", texto: "Beto" }] }), /pediu para não receber/);
  assert.equal(conv.listarConversas({ agoraMs: AGORA }).find((c) => c.numero === "5511922223333").saiu, true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Banco temporário e ambiente de envio antes de carregar os serviços.
const dir = mkdtempSync(join(tmpdir(), "rycs-wa-"));
Object.assign(process.env, {
  DB_PATH: join(dir, "test.db"), JWT_SECRET: "segredo-teste-wa", NODE_ENV: "test", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "",
  WHATSAPP_TOKEN: "tok-teste", WHATSAPP_PHONE_NUMBER_ID: "PN1", WHATSAPP_WABA_ID: "WABA1",
});
const meta = await import("../server/services/meta.js");
const { guardarAvisoWhatsapp } = await import("../server/services/whatsapp.js");
const wa = await import("../server/services/whatsappDisparo.js");
const { default: db } = await import("../server/db.js");
test.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

const ts = Date.now();
const vendedor = (id, nome, whats, status = "aprovado", pais = "Brasil") =>
  db.prepare("INSERT INTO sellers (id, nome, email, whats, status, pais, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, nome, `${id}@x.invalid`, whats, status, pais, ts + Number(id.replace(/\D/g, "") || 0));

// Graph API falsa: guarda cada envio e responde pela função da vez.
let chamadas = [];
let responder = () => ({ messages: [{ id: `wamid.${chamadas.length}` }] });
meta.usarFetch(async (url, opcoes = {}) => {
  const corpo = opcoes.body ? JSON.parse(opcoes.body) : null;
  chamadas.push({ url, metodo: opcoes.method, corpo });
  const r = responder({ url, corpo });
  return { ok: !r.error, status: r.error ? 400 : 200, json: async () => r };
});

test("número vira formato da Cloud API, com DDI pelo país", () => {
  assert.equal(wa.numeroWhatsapp("(15) 99832-0707"), "5515998320707");
  assert.equal(wa.numeroWhatsapp("55 15 99832-0707"), "5515998320707");
  assert.equal(wa.numeroWhatsapp("015 99832-0707"), "5515998320707");
  assert.equal(wa.numeroWhatsapp("+91 98765 43210"), "919876543210");
  assert.equal(wa.numeroWhatsapp("98765 43210", "Índia"), "919876543210");
  assert.equal(wa.numeroWhatsapp("12345"), "");
  assert.equal(wa.numeroWhatsapp("98765 43210", "Japão"), "", "país sem DDI conhecido não arrisca");
  assert.deepEqual(wa.variacoes("5515998320707"), ["5515998320707", "551598320707"]);
});

test("público de ativos: só aprovados, sem duplicados, sem número inválido e sem quem pediu para sair", () => {
  vendedor("s1", "ana souza", "(11) 91234-5678");
  vendedor("s2", "Ana Repetida", "11 91234-5678");
  vendedor("s3", "Sem Numero", "");
  vendedor("s4", "Ravi Kumar", "98765 43210", "aprovado", "India");
  vendedor("s5", "Carla Sai", "(21) 98888-7777");
  vendedor("s6", "Em Triagem", "(31) 97777-6666", "triagem");
  // Carla tocou "Stop messages"; o WhatsApp identificou o número antigo, sem o nono dígito.
  guardarAvisoWhatsapp({ object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [{ field: "messages", value: {
    metadata: { phone_number_id: "PN1" },
    messages: [{ from: "552188887777", id: "wamid.sair", timestamp: "1763300000", type: "button", button: { text: "Stop messages" } }],
  } }] }] });

  const d = wa.destinatarios("ativos");
  assert.deepEqual(d.lista.map((p) => p.numero), ["5511912345678", "919876543210"]);
  assert.equal(d.lista[0].nome, "Ana");
  assert.deepEqual({ total: d.total, semNumero: d.semNumero, descadastrados: d.descadastrados, duplicados: d.duplicados },
    { total: 5, semNumero: 1, descadastrados: 1, duplicados: 1 });
  assert.equal(wa.destinatarios("inexistente"), null);
});

const TEMPLATE = {
  name: "aviso_vendedores", language: "pt_BR", category: "MARKETING", status: "APPROVED",
  components: [
    { type: "BODY", text: "Oi {{1}}, novidade na RYCS: {{2}}." },
    { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Stop messages" }, { type: "URL", text: "Abrir", url: "https://app.rycs.pro/" }] },
  ],
};

test("template: variáveis do corpo e o que ainda não dá para enviar", () => {
  const t = wa.resumirTemplate(TEMPLATE);
  assert.equal(t.suportado, true);
  assert.deepEqual(t.variaveis, ["1", "2"]);
  assert.equal(wa.resumirTemplate({ ...TEMPLATE, components: [{ type: "HEADER", format: "IMAGE" }, ...TEMPLATE.components] }).suportado, false);
  assert.equal(wa.resumirTemplate({ ...TEMPLATE, components: [TEMPLATE.components[0], { type: "BUTTONS", buttons: [{ type: "URL", text: "Ver", url: "https://x.invalid/{{1}}" }] }] }).suportado, false);
  assert.equal(wa.validarVariaveis(t, [{ origem: "nome" }]), "Preencha todas as variáveis do template.");
  assert.equal(wa.validarVariaveis(t, [{ origem: "nome" }, { origem: "fixo", texto: " " }]), "Preencha todas as variáveis do template.");
  assert.equal(wa.validarVariaveis(t, [{ origem: "nome" }, { origem: "fixo", texto: "nova campanha" }]), "");
});

test("disparo envia um por um, registra wamid, falha individual não para o resto e entrega vem do webhook", async () => {
  const tpl = wa.resumirTemplate(TEMPLATE);
  const variaveis = [{ origem: "nome" }, { origem: "fixo", texto: "nova campanha" }];
  chamadas = [];
  responder = ({ corpo }) => corpo.to === "919876543210"
    ? { error: { message: "Message undeliverable", code: 131026 } }
    : { messages: [{ id: "wamid.ok1" }] };

  const d = wa.criarDisparo({ adminId: "admin", tpl, variaveis, publico: "ativos" });
  assert.ok(wa.disparoEmAndamento());
  await wa.processarDisparo(d.id, { pausaMs: 0 });

  assert.equal(chamadas.length, 2);
  assert.equal(chamadas[0].metodo, "POST");
  assert.match(chamadas[0].url, /\/PN1\/messages\?access_token=tok-teste$/);
  assert.deepEqual(chamadas[0].corpo.template, {
    name: "aviso_vendedores", language: { code: "pt_BR" },
    components: [{ type: "body", parameters: [{ type: "text", text: "Ana" }, { type: "text", text: "nova campanha" }] }],
  });

  const envios = db.prepare("SELECT numero, status, wamid, erro FROM whatsapp_envios WHERE disparoId = ? ORDER BY rowid").all(d.id);
  assert.deepEqual(envios.map((e) => [e.numero, e.status, e.wamid]), [["5511912345678", "enviado", "wamid.ok1"], ["919876543210", "falhou", ""]]);
  assert.equal(envios[1].erro, "131026 Message undeliverable");
  assert.equal(wa.disparoEmAndamento(), undefined);

  guardarAvisoWhatsapp({ object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [{ field: "messages", value: {
    metadata: { phone_number_id: "PN1" },
    statuses: [{ id: "wamid.ok1", status: "delivered", recipient_id: "5511912345678", timestamp: "1763300100" },
      { id: "wamid.ok1", status: "read", recipient_id: "5511912345678", timestamp: "1763300200" }],
  } }] }] });
  const r = wa.listarDisparos().find((x) => x.id === d.id);
  assert.deepEqual({ status: r.status, total: r.total, enviados: r.enviados, entregues: r.entregues, lidos: r.lidos, falhasEnvio: r.falhasEnvio },
    { status: "parcial", total: 2, enviados: 1, entregues: 1, lidos: 1, falhasEnvio: 1 });
  assert.equal(wa.falhasDoDisparo(d.id).length, 1);
});

test("token inválido interrompe o disparo em vez de repetir a falha para todos", async () => {
  const tpl = wa.resumirTemplate(TEMPLATE);
  chamadas = [];
  responder = () => ({ error: { message: "Invalid OAuth access token", code: 190 } });
  const d = wa.criarDisparo({ adminId: "admin", tpl, variaveis: [{ origem: "nome" }, { origem: "fixo", texto: "x" }], publico: "ativos" });
  await wa.processarDisparo(d.id, { pausaMs: 0 });

  assert.equal(chamadas.length, 1);
  const disp = db.prepare("SELECT status, erro FROM whatsapp_disparos WHERE id = ?").get(d.id);
  assert.equal(disp.status, "falhou");
  assert.match(disp.erro, /^190 /);
  assert.deepEqual(db.prepare("SELECT erro FROM whatsapp_envios WHERE disparoId = ? ORDER BY rowid").all(d.id).map((e) => e.erro),
    ["190 Invalid OAuth access token", "Disparo interrompido"]);
});

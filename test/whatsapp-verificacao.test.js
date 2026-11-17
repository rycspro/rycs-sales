import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import Database from "better-sqlite3";
import { numeroWhatsapp, whatsVerificado, formatarNumero, mensagemCodigo } from "../shared/whatsappVerificacao.js";
import { subirServidor, assinar, cliente } from "./apoio/servidor.js";

test("número com DDI: nacional brasileiro ganha 55, curto ou longo demais é recusado", () => {
  assert.equal(numeroWhatsapp("(11) 91234-5678"), "5511912345678");
  assert.equal(numeroWhatsapp("+55 11 91234-5678"), "5511912345678");
  assert.equal(numeroWhatsapp("12345"), null);
  assert.equal(numeroWhatsapp("14155550100", "Estados Unidos"), "14155550100");
  assert.equal(numeroWhatsapp("+351 912 345 678", "Portugal"), "351912345678");
  assert.equal(numeroWhatsapp("+351 912 345 678", "Brasil"), null);
  assert.equal(formatarNumero("5511912345678"), "+55 (11) 91234-5678");
});

test("verificação vale só enquanto o número do perfil for o verificado", () => {
  assert.equal(whatsVerificado({ whats: "5511912345678", whatsVerificadoNumero: "5511912345678" }), true);
  assert.equal(whatsVerificado({ whats: "5511900000000", whatsVerificadoNumero: "5511912345678" }), false);
  assert.equal(whatsVerificado({ whats: "5511912345678", whatsVerificadoNumero: "" }), false);
});

test("mensagem usa o modelo de autenticação com o código no corpo e no botão", () => {
  const m = mensagemCodigo("5511912345678", "123456", { template: "rycs_codigo", idioma: "pt_BR" });
  assert.equal(m.to, "5511912345678");
  assert.equal(m.template.name, "rycs_codigo");
  assert.equal(m.template.components[0].parameters[0].text, "123456");
  assert.equal(m.template.components[1].sub_type, "url");
  assert.equal(m.template.components[1].parameters[0].text, "123456");
});

// Meta falsa: responde à consulta do modelo e guarda as mensagens enviadas.
async function metaFalsa(t, { modeloAprovado }) {
  const enviados = [];
  const modelos = modeloAprovado ? [{ name: "rycs_codigo", language: "pt_BR", status: "APPROVED" }] : [];
  const meta = createServer((req, res) => {
    let corpo = "";
    req.on("data", (d) => { corpo += d; });
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.url.startsWith("/conta-1/message_templates")) {
        if (req.method === "POST") {
          const m = JSON.parse(corpo);
          modelos.push({ name: m.name, language: m.language, status: "PENDING", criado: m });
          return res.end(JSON.stringify({ id: "tpl-1", status: "PENDING", category: m.category }));
        }
        return res.end(JSON.stringify({ data: modelos }));
      }
      enviados.push({ url: req.url, corpo: JSON.parse(corpo || "{}") });
      res.end(JSON.stringify({ messages: [{ id: `wamid.${enviados.length}` }] }));
    });
  });
  await new Promise((r) => meta.listen(0, "127.0.0.1", r));
  t.after(() => meta.close());
  const env = {
    WHATSAPP_TOKEN: "token-teste", WHATSAPP_PHONE_NUMBER_ID: "999", WHATSAPP_WABA_ID: "conta-1",
    WHATSAPP_TEMPLATE_CODIGO: "rycs_codigo", WHATSAPP_API_BASE: `http://127.0.0.1:${meta.address().port}`,
  };
  return { enviados, modelos, env };
}

function criarProfissionais(dbPath, lista) {
  const banco = new Database(dbPath);
  const cookies = lista.map(([id, whats]) => {
    banco.prepare("INSERT INTO sellers (id, nome, email, whats, criadoEm) VALUES (?, ?, ?, ?, ?)").run(id, `Prof ${id}`, `${id}@exemplo.invalid`, whats, Date.now());
    banco.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'vendedor', ?, ?)").run(`u-${id}`, `${id}@exemplo.invalid`, id, Date.now());
    return assinar({ id: `u-${id}`, role: "vendedor", entityId: id });
  });
  banco.close();
  return cookies;
}

test("rotas: sem o modelo aprovado na Meta, a verificação fica indisponível", async (t) => {
  const { enviados, modelos, env } = await metaFalsa(t, { modeloAprovado: false });
  const { base, dbPath } = await subirServidor(t, env);
  const [cookie] = criarProfissionais(dbPath, [["prof-x", "5511912345678"]]);
  const req = cliente(base);
  let r = await req("/whatsapp/verificacao", { cookie });
  assert.equal(r.corpo.configurado, false);
  r = await req("/whatsapp/verificacao/enviar", { cookie, body: {} });
  assert.equal(r.status, 503);
  assert.equal(enviados.length, 0);

  // O admin cria o modelo de autenticação pela API; profissional não pode.
  const admin = assinar({ id: "admin-teste", role: "admin", entityId: null });
  r = await req("/admin/whatsapp/modelo-codigo", { cookie, body: {} });
  assert.equal(r.status, 403);
  r = await req("/admin/whatsapp/modelo-codigo", { cookie: admin });
  assert.equal(r.corpo.status, null);
  r = await req("/admin/whatsapp/modelo-codigo", { cookie: admin, body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.status, "PENDING");
  assert.equal(modelos.length, 1);
  const criado = modelos[0].criado;
  assert.equal(criado.category, "AUTHENTICATION");
  assert.equal(criado.language, "pt_BR");
  assert.deepEqual(criado.components[2].buttons[0], { type: "OTP", otp_type: "COPY_CODE", text: "Copiar código" });
  assert.equal(criado.components[1].code_expiration_minutes, 10);
  // Criar de novo não duplica.
  r = await req("/admin/whatsapp/modelo-codigo", { cookie: admin, body: {} });
  assert.equal(modelos.length, 1);
});

test("rotas: envia o código pelo WhatsApp, confirma, limita reenvio e bloqueia número de outra conta", async (t) => {
  const { enviados, env } = await metaFalsa(t, { modeloAprovado: true });
  const { base, dbPath } = await subirServidor(t, env);
  const [cookieA, cookieB] = criarProfissionais(dbPath, [["prof-a", "5511912345678"], ["prof-b", "(11) 91234-5678"]]);
  const req = cliente(base);

  let r = await req("/whatsapp/verificacao", { cookie: cookieA });
  assert.equal(r.corpo.configurado, true);
  assert.equal(r.corpo.verificado, false);

  r = await req("/whatsapp/verificacao/enviar", { cookie: cookieA, body: {} });
  assert.equal(r.status, 200);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].url.split("?")[0], "/999/messages");
  assert.equal(enviados[0].corpo.to, "5511912345678");
  const codigo = enviados[0].corpo.template.components[0].parameters[0].text;
  assert.match(codigo, /^\d{6}$/);

  r = await req("/whatsapp/verificacao/enviar", { cookie: cookieA, body: {} });
  assert.equal(r.status, 429);

  const errado = codigo === "000000" ? "111111" : "000000";
  r = await req("/whatsapp/verificacao/confirmar", { cookie: cookieA, body: { codigo: errado } });
  assert.equal(r.status, 400);
  assert.equal(r.corpo.restantes, 4);

  r = await req("/whatsapp/verificacao/confirmar", { cookie: cookieA, body: { codigo } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.numero, "5511912345678");

  r = await req("/whatsapp/verificacao", { cookie: cookieA });
  assert.equal(r.corpo.verificado, true);
  r = await req("/whatsapp/verificacao/enviar", { cookie: cookieA, body: {} });
  assert.equal(r.status, 409);

  // Mesmo número em outra conta não pode ser verificado de novo.
  r = await req("/whatsapp/verificacao/enviar", { cookie: cookieB, body: {} });
  assert.equal(r.status, 409);
  assert.equal(enviados.length, 1);

  // Empresa não usa esta rota.
  r = await req("/whatsapp/verificacao", { cookie: assinar({ id: "u-emp", role: "empresa", entityId: "emp" }) });
  assert.equal(r.status, 403);
});

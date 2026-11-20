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
// 12h UTC = 9h em São Paulo e 17h30 na Índia: dentro da janela de envio nos dois.
const NO_HORARIO = () => Date.UTC(2026, 10, 17, 12, 0);
// 2h UTC = 23h em São Paulo e 7h30 na Índia: fora da janela nos dois.
const FORA_DO_HORARIO = () => Date.UTC(2026, 10, 17, 2, 0);
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
  vendedor("s7", "Davi Recusa", "(41) 96666-5555");
  // Carla tocou "Stop messages"; o WhatsApp identificou o número antigo, sem o nono dígito.
  guardarAvisoWhatsapp({ object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [{ field: "messages", value: {
    metadata: { phone_number_id: "PN1" },
    messages: [{ from: "552188887777", id: "wamid.sair", timestamp: "1763300000", type: "button", button: { text: "Stop messages" } },
      { from: "5541966665555", id: "wamid.recusa", timestamp: "1763300001", type: "button", button: { text: "Agora não" } }],
  } }] }] });

  const d = wa.destinatarios("ativos");
  assert.deepEqual(d.lista.map((p) => p.numero), ["5511912345678", "919876543210"]);
  assert.equal(d.lista[0].nome, "Ana");
  assert.deepEqual({ total: d.total, semNumero: d.semNumero, descadastrados: d.descadastrados, duplicados: d.duplicados },
    { total: 6, semNumero: 1, descadastrados: 2, duplicados: 1 });
  assert.equal(wa.destinatarios("inexistente"), null);
});

const PERFIL_OK = { foto: "data:x", titulo: "SDR", bio: "Vendo por telefone.", disponibilidade: "manhã", cidade: "Sorocaba",
  segmentos: '["saas"]', modalidades: '["remoto"]', skills: '["prospecção"]' };
const preencherPerfil = (id, campos) => {
  const cols = Object.keys(campos);
  db.prepare(`UPDATE sellers SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(...cols.map((c) => campos[c]), id);
};

test("pendências do perfil: texto da variável segue a regra dos e-mails", () => {
  assert.equal(wa.textoPendencias({ ...PERFIL_OK, cidade: "", segmentos: "[]" }), "cidade e segmentos de atuação");
  assert.equal(wa.textoPendencias({ ...PERFIL_OK, bio: " " }), "descrição pessoal (bio)");
  assert.equal(wa.textoPendencias(PERFIL_OK), "");
});

test("público de perfil incompleto: só Brasil, só com pendência, inativado entra e sai dos ativos", async () => {
  vendedor("s8", "Bia Inativa", "(51) 95555-4444");
  db.prepare("UPDATE sellers SET inativoEm = ?, inativoMotivo = 'perfil_incompleto' WHERE id = 's8'").run(ts);
  vendedor("s9", "Caio Completo", "(61) 94444-3333");
  preencherPerfil("s9", PERFIL_OK);
  db.prepare("UPDATE sellers SET inativoEm = ? WHERE id = 's9'").run(ts); // fora dos ativos para não mexer nos outros testes

  assert.ok(!wa.destinatarios("ativos").lista.some((p) => p.sellerId === "s8"), "conta inativada não recebe 'sua conta está ativa'");
  const d = wa.destinatarios("perfil_incompleto");
  assert.deepEqual(d.lista.map((p) => p.sellerId), ["s1", "s8"], "Ravi (Índia), Caio (perfil completo) e Em Triagem ficam de fora");
  assert.deepEqual({ semNumero: d.semNumero, descadastrados: d.descadastrados, duplicados: d.duplicados }, { semNumero: 1, descadastrados: 2, duplicados: 1 });

  const tpl = wa.resumirTemplate({ name: "rycs_conta_pendente", language: "pt_BR", category: "UTILITY", status: "APPROVED", components: [
    { type: "BODY", text: "Olá, {{1}}. Sua conta na RYCS tem itens pendentes.\n\nFalta: {{2}}.\n\nÉ isso que a empresa vê antes de aceitar você numa campanha. Leva poucos minutos." },
    { type: "FOOTER", text: "RYCS · Responda SAIR para parar os avisos" },
    { type: "BUTTONS", buttons: [{ type: "URL", text: "Resolver pendências", url: "https://app.rycs.pro/plataforma?aba=perfil" }, { type: "QUICK_REPLY", text: "Parar mensagens" }] },
  ] });
  assert.equal(tpl.suportado, true, "link fixo e resposta rápida já dá para enviar");
  const vars = [{ origem: "nome" }, { origem: "pendencias" }];
  assert.equal(wa.validarVariaveis(tpl, vars), "");
  assert.throws(() => wa.criarDisparo({ adminId: "admin", tpl, variaveis: vars, publico: "ativos" }), /só funciona com o público/);

  chamadas = [];
  responder = () => ({ messages: [{ id: `wamid.p${chamadas.length}` }] });
  const disp = wa.criarDisparo({ adminId: "admin", tpl, variaveis: vars, publico: "perfil_incompleto" });
  preencherPerfil("s8", PERFIL_OK); // Bia completou o perfil enquanto esperava na fila
  await wa.processarDisparo(disp.id, { pausaMs: 0, relogio: NO_HORARIO });

  assert.equal(chamadas.length, 1);
  assert.deepEqual(chamadas[0].corpo.template.components[0].parameters.map((p) => p.text), ["Ana",
    "foto de perfil, título profissional, descrição pessoal (bio), disponibilidade, cidade, segmentos de atuação, modalidades de trabalho e habilidades (skills)"]);
  assert.deepEqual(db.prepare("SELECT sellerId, status, erro FROM whatsapp_envios WHERE disparoId = ? ORDER BY rowid").all(disp.id),
    [{ sellerId: "s1", status: "enviado", erro: "" }, { sellerId: "s8", status: "falhou", erro: "Perfil completo antes do envio" }]);
  const enviados = JSON.parse(db.prepare("SELECT parametros FROM whatsapp_envios WHERE disparoId = ? AND sellerId = 's1'").get(disp.id).parametros);
  assert.deepEqual(enviados, chamadas[0].corpo.template.components[0].parameters.map((p) => p.text), "o que saiu fica registrado");
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
  await wa.processarDisparo(d.id, { pausaMs: 0, relogio: NO_HORARIO });

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
  const tpl = wa.resumirTemplate({ ...TEMPLATE, name: "aviso_token" });
  chamadas = [];
  responder = () => ({ error: { message: "Invalid OAuth access token", code: 190 } });
  const d = wa.criarDisparo({ adminId: "admin", tpl, variaveis: [{ origem: "nome" }, { origem: "fixo", texto: "x" }], publico: "ativos" });
  await wa.processarDisparo(d.id, { pausaMs: 0, relogio: NO_HORARIO });

  assert.equal(chamadas.length, 1);
  const disp = db.prepare("SELECT status, erro FROM whatsapp_disparos WHERE id = ?").get(d.id);
  assert.equal(disp.status, "falhou");
  assert.match(disp.erro, /^190 /);
  assert.deepEqual(db.prepare("SELECT erro FROM whatsapp_envios WHERE disparoId = ? ORDER BY rowid").all(d.id).map((e) => e.erro),
    ["190 Invalid OAuth access token", "Disparo interrompido"]);
});

const VARS = [{ origem: "nome" }, { origem: "fixo", texto: "x" }];
const sucesso = () => { responder = () => ({ messages: [{ id: `wamid.r${chamadas.length}` }] }); };

test("rodada: tamanho escolhido, quem já recebeu fica de fora e o limite de 24h conta", () => {
  const tpl = wa.resumirTemplate(TEMPLATE); // aviso_vendedores: Ana já recebeu no teste do disparo
  const d = wa.destinatarios("ativos", { template: tpl.nome });
  assert.deepEqual(d.lista.map((p) => p.numero), ["919876543210"], "Ravi falhou antes, então ainda pode receber");
  assert.equal(d.jaReceberam, 1);

  assert.throws(() => wa.criarDisparo({ adminId: "admin", tpl, variaveis: VARS, publico: "ativos", limite: 0 }), /de 1 a 250/);
  assert.throws(() => wa.criarDisparo({ adminId: "admin", tpl, variaveis: VARS, publico: "ativos", limite: 251 }), /de 1 a 250/);

  const antes = wa.vagas24h();
  const r = wa.criarDisparo({ adminId: "admin", tpl: { ...tpl, nome: "aviso_rodada" }, variaveis: VARS, publico: "ativos", limite: 1 });
  assert.equal(r.lista.length, 1, "só 1 nesta rodada");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM whatsapp_envios WHERE disparoId = ?").get(r.id).n, 1);
  assert.equal(r.lista[0].numero, "5511912345678");
  assert.equal(wa.vagas24h(), antes, "Ana já recebeu nas últimas 24h: a mesma pessoa ocupa uma vaga só");
  db.prepare("UPDATE whatsapp_envios SET numero = '5511900000000' WHERE disparoId = ?").run(r.id);
  assert.equal(wa.vagas24h(), antes - 1, "quem está na fila já ocupa vaga do limite de 24h");
  db.prepare("UPDATE whatsapp_envios SET status = 'falhou', erro = 'teste' WHERE disparoId = ?").run(r.id);
  db.prepare("UPDATE whatsapp_disparos SET status = 'falhou' WHERE id = ?").run(r.id);
});

test("fora das 8h às 20h no horário de quem recebe, a fila espera", async () => {
  const tpl = wa.resumirTemplate({ ...TEMPLATE, name: "aviso_horario" });
  assert.equal(wa.dentroDoHorario("5511912345678", NO_HORARIO()), true);
  assert.equal(wa.dentroDoHorario("919876543210", NO_HORARIO()), true);
  assert.equal(wa.dentroDoHorario("5511912345678", FORA_DO_HORARIO()), false, "23h em São Paulo");
  assert.equal(wa.dentroDoHorario("919876543210", FORA_DO_HORARIO()), false, "7h30 na Índia");

  chamadas = [];
  sucesso();
  const d = wa.criarDisparo({ adminId: "admin", tpl, variaveis: VARS, publico: "ativos" });
  await wa.processarDisparo(d.id, { pausaMs: 0, relogio: FORA_DO_HORARIO });
  assert.equal(chamadas.length, 0, "nada sai fora do horário");
  const esperando = wa.listarDisparos().find((x) => x.id === d.id);
  assert.equal(esperando.status, "enviando");
  assert.equal(esperando.aguardandoHorario, true);

  await wa.processarDisparo(d.id, { pausaMs: 0, relogio: NO_HORARIO });
  assert.equal(chamadas.length, 2);
  const fim = wa.listarDisparos().find((x) => x.id === d.id);
  assert.equal(fim.status, "concluido");
  assert.equal(fim.aguardandoHorario, false);
});

test("muitas falhas param o disparo para proteger a conta", async () => {
  for (let i = 1; i <= 25; i++) vendedor(`t${i}`, `Teste ${i}`, `11 9${String(i).padStart(8, "0")}`);
  const tpl = wa.resumirTemplate({ ...TEMPLATE, name: "aviso_taxa" });
  chamadas = [];
  responder = () => ({ error: { message: "Message undeliverable", code: 131026 } });
  const d = wa.criarDisparo({ adminId: "admin", tpl, variaveis: VARS, publico: "ativos" });
  await wa.processarDisparo(d.id, { pausaMs: 0, relogio: NO_HORARIO });

  assert.equal(chamadas.length, 20, "para no primeiro freio depois de 20 tentativas");
  const disp = db.prepare("SELECT status, erro FROM whatsapp_disparos WHERE id = ?").get(d.id);
  assert.equal(disp.status, "falhou");
  assert.match(disp.erro, /Muitas falhas/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM whatsapp_envios WHERE disparoId = ? AND erro = 'Disparo interrompido'").get(d.id).n, d.lista.length - 20);
});

test("público de leads da Índia: só telefone +91, sem quem já tem conta, com o primeiro nome", () => {
  db.exec(`CREATE TABLE IF NOT EXISTS rycs_leads_meta (leadgenId TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
    telefone TEXT NOT NULL DEFAULT '', pais TEXT NOT NULL DEFAULT '', criadoEm INTEGER NOT NULL)`);
  const lead = db.prepare("INSERT INTO rycs_leads_meta (leadgenId, nome, email, telefone, pais, criadoEm) VALUES (?, ?, ?, ?, ?, ?)");
  lead.run("l1", "rahul sharma", "rahul@x.invalid", "+919876500001", "IN", ts + 1);
  lead.run("l2", "Priya K", "priya@x.invalid", "98765 00002", "India", ts + 2);
  lead.run("l3", "Joana", "joana@x.invalid", "+5511988887777", "BR", ts + 3);
  lead.run("l4", "Amit Já Cadastrado", "amit@x.invalid", "+919876500004", "IN", ts + 4);
  db.prepare("INSERT INTO users (id, email, senha, role, criadoEm) VALUES ('u-amit', 'amit@x.invalid', 'x', 'vendedor', ?)").run(ts);

  const d = wa.destinatarios("leads_india");
  assert.deepEqual(d.lista.map((p) => [p.numero, p.nome, p.sellerId]), [["919876500001", "Rahul", null], ["919876500002", "Priya", null]]);
  assert.equal(d.semNumero, 1, "o lead do Brasil não é deste público");
  assert.equal(d.total, 3, "quem já tem conta nem entra na conta");
});

// Por último: o aviso de bloqueio trava novos disparos por 24h.
test("aviso de bloqueios da Meta (131048) para o disparo e trava novos por 24h", async () => {
  const tpl = wa.resumirTemplate({ ...TEMPLATE, name: "aviso_bloqueio" });
  chamadas = [];
  sucesso();
  const d = wa.criarDisparo({ adminId: "admin", tpl, variaveis: VARS, publico: "ativos", limite: 2 });
  assert.equal(wa.bloqueioRecente(), false);

  guardarAvisoWhatsapp({ object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [{ field: "messages", value: {
    metadata: { phone_number_id: "PN1" },
    statuses: [{ id: "wamid.ok1", status: "failed", recipient_id: "5511912345678", timestamp: "1763300300",
      errors: [{ code: 131048, title: "Spam rate limit hit" }] }],
  } }] }] });
  assert.equal(wa.bloqueioRecente(), true);

  await wa.processarDisparo(d.id, { pausaMs: 0, relogio: NO_HORARIO });
  assert.equal(chamadas.length, 0, "nenhuma mensagem sai depois do aviso");
  const disp = db.prepare("SELECT status, erro FROM whatsapp_disparos WHERE id = ?").get(d.id);
  assert.equal(disp.status, "falhou");
  assert.match(disp.erro, /^131048 /);
  assert.throws(() => wa.criarDisparo({ adminId: "admin", tpl: { ...tpl, nome: "outro" }, variaveis: VARS, publico: "ativos" }), /limitando o número/);
});

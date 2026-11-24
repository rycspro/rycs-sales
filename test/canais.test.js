import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { medirConversa, criteriosInternos, placar, mesmoTelefone, janelaAberta } from "../shared/canais.js";

const dir = mkdtempSync(join(tmpdir(), "rycs-canais-"));
Object.assign(process.env, {
  DB_PATH: join(dir, "test.db"), JWT_SECRET: "segredo-teste-canais", NODE_ENV: "test", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "",
  WHATSAPP_TOKEN: "tok", WHATSAPP_PHONE_NUMBER_ID: "RYCS1", WHATSAPP_WABA_ID: "WABARYCS", META_APP_ID: "app", META_APP_SECRET: "seg",
  WHATSAPP_SIGNUP_CONFIG_ID: "cfg", INSTAGRAM_APP_ID: "igapp", INSTAGRAM_APP_SECRET: "igseg",
});
const meta = await import("../server/services/meta.js");
const canais = await import("../server/services/canais.js");
const wa = await import("../server/services/canaisWhatsapp.js");
const ig = await import("../server/services/canaisInstagram.js");
const aud = await import("../server/services/auditoriaConversas.js");
const { default: db } = await import("../server/db.js");
test.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

let chamadas = [];
let responder = () => ({});
meta.usarFetch(async (url, o = {}) => {
  const c = { url: String(url), metodo: o.method || "GET", corpo: o.body && String(o.body).startsWith("{") ? JSON.parse(o.body) : o.body };
  chamadas.push(c);
  const r = responder(c);
  return { ok: !r.error && !r.error_message, status: r.error ? 400 : 200, json: async () => r };
});

const T = Date.now();
const seg = (ms) => String(Math.floor(ms / 1000));
const ins = (sql, ...a) => db.prepare(sql).run(...a);
for (const c of ["c1", "c2"]) ins("INSERT INTO companies (id, nome, produto, criadoEm) VALUES (?, ?, 'Consultoria', ?)", c, `Empresa ${c}`, T);
for (const s of ["s1", "s2"]) ins("INSERT INTO sellers (id, nome, email, whats, status, criadoEm) VALUES (?, ?, ?, '', 'aprovado', ?)", s, `Vendedor ${s}`, `${s}@x.invalid`, T);
ins("INSERT INTO applications (sellerId, companyId, status) VALUES ('s1', 'c1', 'aprovado')");
ins("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES ('u1', 'c1@x.invalid', 'x', 'empresa', 'c1', ?)", T);
ins("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES ('uv', 's1@x.invalid', 'x', 'vendedor', 's1', ?)", T);
ins("INSERT INTO leads (id, sellerId, companyId, nome, telefone, criadoEm, atualizadoEm) VALUES ('l1', 's1', 'c1', 'Ana Lead', '(11) 98888-7777', ?, ?)", T, T);
const EMP = { id: "u1", role: "empresa", entityId: "c1" }, EMP2 = { id: "u2", role: "empresa", entityId: "c2" }, VEND = { id: "uv", role: "vendedor", entityId: "s1" };

const aviso = (phone, campo, value, waba = "WABA9") => ({ object: "whatsapp_business_account", entry: [{ id: waba, changes: [{ field: campo, value: { metadata: { phone_number_id: phone, display_phone_number: "5511900000000" }, ...value } }] }] });
const msg = (de, id, ms, texto) => ({ contacts: [{ wa_id: de, profile: { name: "Cliente" } }], messages: [{ from: de, id, timestamp: seg(ms), type: "text", text: { body: texto } }] });

test("telefone: com e sem 55 e nono dígito é o mesmo", () => {
  assert.ok(mesmoTelefone("5511988887777", "(11) 98888-7777"));
  assert.ok(mesmoTelefone("551188887777", "11988887777"));
  assert.ok(!mesmoTelefone("5521988887777", "11988887777"));
  assert.ok(!mesmoTelefone("", ""));
});

test("conectar: só vale número que o token da pessoa enxerga, e nunca o da RYCS", async () => {
  const numeros = [{ id: "111111", display_phone_number: "+55 11 90000-0000", verified_name: "Loja", is_on_biz_app: true, platform_type: "CLOUD_API" }, { id: "RYCS1", display_phone_number: "+55 15" }];
  responder = ({ url }) => (url.includes("oauth/access_token") ? { access_token: "T" } : url.includes("phone_numbers") ? { data: numeros } : { success: true });
  await assert.rejects(wa.conectar({ user: EMP, companyId: "c1", code: "x", wabaId: "99999", phoneNumberId: "222222" }), /Não encontramos|mais de um/);
  await assert.rejects(wa.conectar({ user: EMP, companyId: "c1", code: "x", wabaId: "abc" }), /inválidos/);
  chamadas = [];
  const c = await wa.conectar({ user: EMP, companyId: "c1", code: "x", wabaId: "99999", phoneNumberId: "111111" });
  assert.equal(c.status, "ativa");
  assert.ok(!c.token.includes("T:") && c.token.startsWith("v1:"), "token cifrado");
  assert.ok(chamadas.some((x) => x.url.includes("/99999/subscribed_apps") && x.metodo === "POST"));
  assert.deepEqual(chamadas.filter((x) => x.url.includes("smb_app_data")).map((x) => x.corpo.sync_type), ["smb_app_state_sync", "history"]);
  await assert.rejects(wa.conectar({ user: EMP2, companyId: "c2", code: "x", wabaId: "99999", phoneNumberId: "111111" }), /já está conectado/);
});

test("aviso do número da empresa nunca entra na caixa da RYCS", () => {
  const misto = { object: "whatsapp_business_account", entry: [...aviso("111111", "messages", msg("5511977776666", "a1", T, "oi")).entry, ...aviso("RYCS1", "messages", msg("5511955554444", "a2", T, "sair")).entry, ...aviso("999", "messages", msg("5511955554444", "a3", T, "sair")).entry] };
  const { rycs, clientes } = wa.separarAviso(misto);
  assert.deepEqual(rycs.entry.flatMap((e) => e.changes.flatMap((c) => c.value.messages.map((m) => m.id))), ["a2"]);
  assert.deepEqual(clientes.entry.flatMap((e) => e.changes.flatMap((c) => c.value.messages.map((m) => m.id))), ["a1", "a3"]);
  assert.equal(wa.receberAviso(clientes), 1, "número desconhecido é ignorado");
});

test("caixa da empresa: cliente, resposta pelo celular, janela e isolamento entre empresas", async () => {
  wa.receberAviso(aviso("111111", "messages", msg("5511988887777", "m1", T - 3 * 3600e3, "Quanto custa a consultoria?")));
  wa.receberAviso(aviso("111111", "messages", msg("5511988887777", "m1", T - 3 * 3600e3, "Quanto custa a consultoria?")));
  wa.receberAviso(aviso("111111", "smb_message_echoes", { message_echoes: [{ from: "5511900000000", to: "5511988887777", id: "m2", timestamp: seg(T - 2.9 * 3600e3), type: "text", text: { body: "Vou te mandar a proposta" } }] }));
  const lista = canais.listarConversas(EMP, { canal: "whatsapp" });
  const ana = lista.find((c) => c.telefone === "5511988887777");
  assert.equal(ana.nome, "Ana Lead", "liga sozinha ao lead pelo telefone");
  assert.equal(ana.lead.id, "l1");
  assert.equal(ana.naoLidas, 0, "responder pelo celular zera as não lidas");
  assert.ok(ana.janelaAte > T);
  assert.equal(canais.abrirConversa(EMP, ana.id).mensagens.length, 2, "aviso repetido não duplica");
  assert.equal(canais.listarConversas(EMP2, { canal: "whatsapp" }).length, 0);
  assert.equal(canais.abrirConversa(EMP2, ana.id), null);
  await assert.rejects(wa.enviarTexto(EMP2, ana.id, "oi"), /não encontrada/);
  responder = () => ({ messages: [{ id: "m3" }] });
  await wa.enviarTexto(EMP, ana.id, "Segue a proposta");
  assert.equal(chamadas.at(-1).corpo.to, "5511988887777");
  wa.receberAviso(aviso("111111", "messages", { statuses: [{ id: "m3", status: "read", recipient_id: "5511988887777" }] }));
  assert.equal(canais.abrirConversa(EMP, ana.id).mensagens.at(-1).status, "read");
});

test("fora de 24h não envia pela RYCS, e histórico não abre a janela", async () => {
  wa.receberAviso(aviso("111111", "history", { history: [{ metadata: { phase: 0 }, threads: [{ id: "5511911112222", messages: [{ from: "5511911112222", id: "h1", timestamp: seg(T - 3600e3), type: "text", text: { body: "oi" } }] }] }] }));
  const h = canais.listarConversas(EMP, { canal: "whatsapp" }).find((c) => c.telefone === "5511911112222");
  assert.equal(h.janelaAte, null);
  assert.equal(h.naoLidas, 0);
  await assert.rejects(wa.enviarTexto(EMP, h.id, "oi"), /24h/);
  assert.equal(janelaAberta(T - 25 * 3600e3, T), null);
});

test("WhatsApp do vendedor: só guarda conversa com lead da empresa", async () => {
  responder = ({ url }) => (url.includes("oauth/access_token") ? { access_token: "T2" } : url.includes("phone_numbers") ? { data: [{ id: "333333", display_phone_number: "+55 11 95555-0000", is_on_biz_app: true, platform_type: "CLOUD_API" }] } : { success: true });
  await assert.rejects(wa.conectar({ user: VEND, companyId: "c2", sellerId: "s1", code: "x", wabaId: "88888", phoneNumberId: "333333" }), /aprovado/);
  chamadas = [];
  await wa.conectar({ user: VEND, companyId: "c1", sellerId: "s1", code: "x", wabaId: "88888", phoneNumberId: "333333" });
  assert.ok(!chamadas.some((x) => x.url.includes("smb_app_data")), "não pede histórico nem agenda do vendedor");

  assert.equal(wa.receberAviso(aviso("333333", "messages", msg("5511933334444", "p1", T, "mãe, chego às 8"))), 0);
  assert.equal(wa.receberAviso(aviso("333333", "smb_message_echoes", { message_echoes: [{ from: "x", to: "5511933334444", id: "p2", timestamp: seg(T), type: "text", text: { body: "ok" } }] })), 0);
  assert.equal(wa.receberAviso(aviso("333333", "history", { history: [{ threads: [{ id: "5511988887777", messages: [{ from: "5511988887777", id: "p3", timestamp: seg(T), type: "text", text: { body: "antigo" } }] }] }] })), 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM canais_mensagens WHERE texto LIKE '%mãe%'").get().n, 0, "conversa pessoal não entra no banco");

  assert.equal(wa.receberAviso(aviso("333333", "messages", msg("5511988887777", "p4", T, "Oi, é a Ana"))), 1);
  const doVendedor = canais.listarConversas(VEND, { canal: "whatsapp" });
  assert.equal(doVendedor.length, 1);
  assert.ok(canais.conversaDoUsuario(EMP, doVendedor[0].id), "a empresa acompanha a conversa com o lead dela");
  await assert.rejects(wa.enviarTexto(EMP, doVendedor[0].id, "oi"), /só o dono do número/);
  assert.equal(canais.conversaDoUsuario(EMP2, doVendedor[0].id), null);
  assert.equal(canais.conversaDoUsuario({ role: "vendedor", entityId: "s2" }, doVendedor[0].id), null);

  ins("UPDATE applications SET status = 'recusado' WHERE sellerId = 's1'");
  assert.equal(wa.receberAviso(aviso("333333", "messages", msg("5511988887777", "p5", T, "ainda aí?"))), 0, "saiu da empresa: para de alimentar");
  ins("UPDATE applications SET status = 'aprovado' WHERE sellerId = 's1'");
});

test("desconectar: avisos param e o token some", async () => {
  const c = canais.conexaoPorExterno("whatsapp", "333333");
  responder = () => ({ success: true });
  await wa.desconectar(c);
  assert.equal(canais.conexaoPorExterno("whatsapp", "333333").token, "");
  assert.equal(wa.receberAviso(aviso("333333", "messages", msg("5511988887777", "p6", T, "oi"))), 0);
});

test("número que muda de empresa não apaga nem entrega o histórico da anterior", () => {
  const a = canais.salvarConexao({ companyId: "c1", canal: "whatsapp", externoId: "444444", token: "t", userId: "u1" });
  canais.registrarMensagem(a, { contato: "5511900001111", telefone: "5511900001111", externoId: "z1", direcao: "recebida", texto: "conversa da c1", em: T });
  canais.encerrarConexao(a.id);
  const b = canais.salvarConexao({ companyId: "c2", canal: "whatsapp", externoId: "444444", token: "t2", userId: "u2" });
  assert.notEqual(b.id, a.id);
  assert.ok(canais.listarConversas(EMP, { canal: "whatsapp" }).some((c) => c.telefone === "5511900001111"), "a c1 continua com a conversa dela");
  assert.equal(canais.listarConversas(EMP2, { canal: "whatsapp" }).length, 0, "a c2 não vê");
  assert.equal(wa.receberAviso(aviso("444444", "messages", msg("5511900001111", "z2", T, "oi c2"))), 1);
  assert.equal(canais.listarConversas(EMP2, { canal: "whatsapp" })[0].ultima.texto, "oi c2");
});

test("Instagram: login, direct, comentário e respostas", async () => {
  assert.match(ig.urlLogin("st"), /instagram_business_manage_messages/);
  responder = ({ url }) => {
    if (url.includes("api.instagram.com")) return { data: [{ access_token: "curto", user_id: "178" }] };
    if (url.includes("/access_token")) return { access_token: "longo", expires_in: 5184000 };
    if (url.includes("/me?")) return { user_id: "178", id: "app1", username: "loja", name: "Loja" };
    return { success: true };
  };
  const c = await ig.concluirLogin({ companyId: "c1", userId: "u1", code: "abc#_" });
  assert.equal(c.externoId, "178");
  assert.ok(chamadas.some((x) => x.url.includes("/178/subscribed_apps") && x.url.includes("comments")));

  responder = () => ({ username: "bia", name: "Bia" });
  ig.receberAviso({ object: "instagram", entry: [{ id: "178", messaging: [{ sender: { id: "900" }, recipient: { id: "178" }, timestamp: T, message: { mid: "d1", text: "Tem no tamanho M?" } }] }] });
  ig.receberAviso({ object: "instagram", entry: [{ id: "178", messaging: [{ sender: { id: "178" }, recipient: { id: "900" }, timestamp: T + 1, message: { mid: "d2", text: "Tem sim", is_echo: true } }] }] });
  ig.receberAviso({ object: "instagram", entry: [{ id: "178", changes: [{ field: "comments", value: { id: "k1", text: "Preço?", from: { id: "901", username: "caio" }, media: { id: "mm" } } }] }] });
  assert.equal(ig.receberAviso({ object: "instagram", entry: [{ id: "555", messaging: [{ sender: { id: "1" }, recipient: { id: "555" }, message: { mid: "z", text: "x" } }] }] }), 0);
  const lista = canais.listarConversas(EMP, { canal: "instagram" });
  assert.deepEqual(lista.map((x) => x.tipo).sort(), ["comentario", "direta"]);
  const direta = lista.find((x) => x.tipo === "direta"), com = lista.find((x) => x.tipo === "comentario");
  assert.equal(canais.abrirConversa(EMP, direta.id).mensagens.length, 2);
  assert.equal(com.nome, "@caio");

  responder = () => ({ id: "r1", message_id: "d3", recipient_id: "901" });
  await ig.responder(EMP, com.id, { texto: "Te chamei no direct" });
  assert.match(chamadas.at(-1).url, /\/k1\/replies/);
  await ig.responder(EMP, com.id, { texto: "Oi, Caio", privado: true });
  assert.deepEqual(chamadas.at(-1).corpo.recipient, { comment_id: "k1" });
  await assert.rejects(ig.responder(EMP, com.id, { texto: "de novo", privado: true }), /uma mensagem privada/);
  await assert.rejects(ig.responder(EMP2, direta.id, { texto: "oi" }), /não encontrada/);
  // A resposta pública volta pelo webhook com o mesmo id: não duplica.
  ig.receberAviso({ object: "instagram", entry: [{ id: "178", changes: [{ field: "comments", value: { id: "r1", text: "Te chamei no direct", from: { id: "178", username: "loja" }, parent_id: "k1" } }] }] });
  assert.equal(canais.abrirConversa(EMP, com.id).mensagens.length, 2);
});

test("criar lead da conversa exige profissional aprovado", () => {
  const direta = canais.listarConversas(EMP, { canal: "instagram", tipo: "direta" })[0];
  assert.throws(() => canais.criarLeadDaConversa(EMP, direta.id, { sellerId: "s2" }), /aprovado/);
  const r = canais.criarLeadDaConversa(EMP, direta.id, { sellerId: "s1", nome: "Bia" });
  assert.equal(db.prepare("SELECT origem FROM leads WHERE id = ?").get(r.leadId).origem, "instagram");
  assert.throws(() => canais.criarLeadDaConversa(EMP, direta.id, { sellerId: "s1" }), /já está ligada/);
});

test("auditoria interna mede, não inventa, e usa o material da empresa", async () => {
  const m = medirConversa([
    { id: 1, direcao: "recebida", texto: "Qual o prazo de entrega?", em: T - 200 * 60000 },
    { id: 2, direcao: "enviada", texto: "Já vejo", em: T - 190 * 60000 },
    { id: 3, direcao: "recebida", texto: "Achei caro", em: T - 120 * 60000 },
  ], T);
  assert.equal(m.primeiraRespostaMin, 10);
  assert.equal(m.semRespostaMin, 120);
  const c = criteriosInternos(m);
  assert.equal(c.find((x) => x.chave === "qualificacao").situacao, "sem_dado", "uma mensagem só não dá nota");
  assert.ok(c.some((x) => x.chave === "objecoes"));
  assert.deepEqual(placar([{ situacao: "ok" }, { situacao: "atencao" }, { situacao: "sem_dado" }]), { atendidos: 1, medidos: 2 });

  ins("INSERT INTO knowledge_documents (id, companyId, titulo, status, conteudo, atualizadoEm, criadoEm) VALUES ('k', 'c1', 'Tabela', 'disponível', 'A consultoria custa R$ 900 por mês.', ?, ?)", T, T);
  ins("INSERT INTO knowledge_documents (id, companyId, titulo, status, conteudo, atualizadoEm, criadoEm) VALUES ('k2', 'c2', 'Segredo', 'disponível', 'Quanto custa a consultoria da outra empresa.', ?, ?)", T, T);
  const conv = canais.listarConversas(EMP, { canal: "whatsapp" }).find((x) => x.telefone === "5511988887777" && !x.vendedor);
  const a = await aud.auditarConversa(EMP, conv.id);
  assert.equal(a.motor, "interno");
  assert.equal(a.materiais[0].fonte.documento, "Tabela", "só material da própria empresa");
  assert.ok(aud.ultimaAuditoria(EMP, conv.id).id);
  await assert.rejects(aud.auditarConversa(EMP2, conv.id), /não encontrada/);
});

test("auditoria da Claude: apontamento sem mensagem que existe é descartado", () => {
  const msgs = [{ id: "a", direcao: "recebida", texto: "Tem garantia?" }, { id: "b", direcao: "enviada", texto: "Garantia de 10 anos" }];
  const r = aud.normalizarClaude({
    resumo: "ok", criterios: [{ nome: "Precisão", situacao: "atencao", comentario: "x", mensagens: [2] }, { nome: "Inventado", situacao: "ok", comentario: "x", mensagens: [99] }],
    afirmacoesSemFonte: [{ mensagem: 2, trecho: "Garantia de 10 anos", motivo: "não consta" }, { mensagem: 2, trecho: "frase que ninguém disse", motivo: "x" }, { mensagem: 1, trecho: "Tem garantia?", motivo: "é do cliente" }],
    riscos: [{ descricao: "solto", mensagens: [] }], proximoPasso: "", sugestaoResposta: "",
  }, msgs, []);
  assert.equal(r.criterios[0].situacao, "atencao");
  assert.equal(r.criterios[1].situacao, "sem_dado");
  assert.equal(r.afirmacoesSemFonte.length, 1);
  assert.equal(r.riscos.length, 0);
});

test("mídia só é buscada em endereço da Meta", () => {
  assert.ok(wa.hostDaMeta("https://lookaside.fbsbx.com/x"));
  for (const u of ["http://lookaside.fbsbx.com/x", "https://fbsbx.com.evil.com/x", "https://169.254.169.254/x", "nada"]) assert.ok(!wa.hostDaMeta(u), u);
});

test("Meta: desautorizar e excluir dados só com assinatura válida", () => {
  const assinar = (o, seg = "igseg") => { const d = Buffer.from(JSON.stringify(o)).toString("base64url"); return `${createHmac("sha256", seg).update(d).digest("base64url")}.${d}`; };
  assert.deepEqual(ig.lerSignedRequest(assinar({ user_id: "178", algorithm: "HMAC-SHA256" })), { userId: "178" });
  for (const x of [assinar({ user_id: "178" }, "errado"), "a.b", "", "x.y.z", assinar({ algorithm: "HMAC-SHA256" })]) assert.equal(ig.lerSignedRequest(x), null);
  const c = canais.salvarConexao({ companyId: "c1", canal: "instagram", externoId: "690", contaId: "app690", nome: "outra", token: "t", userId: "u1" });
  canais.registrarMensagem(c, { contato: "n1", externoId: "n1", direcao: "recebida", texto: "oi", em: T });
  assert.equal(ig.desautorizar("app690"), 1);
  assert.equal(canais.conexaoPorId(c.id).token, "");
  assert.ok(db.prepare("SELECT 1 FROM canais_conversas WHERE conexaoId = ?").get(c.id), "desautorizar mantém o histórico da empresa");
  const r = ig.excluirDados("690");
  assert.match(r.codigo, /^RYCS-IG-[A-F0-9]{12}$/);
  assert.equal(db.prepare("SELECT 1 FROM canais_conversas WHERE conexaoId = ?").get(c.id), undefined);
  assert.ok(db.prepare("SELECT 1 FROM canais_conexoes WHERE externoId = '178'").get(), "não mexe em outro perfil");
});

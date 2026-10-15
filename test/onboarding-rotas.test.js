import test from "node:test";
import assert from "node:assert/strict";
import { subirServidor, assinar } from "./apoio/servidor.js";
import Database from "better-sqlite3";

// Rotas do onboarding contra o servidor de verdade (test/apoio/servidor.js).

test("rotas do onboarding: cadastro, convite, retomada, permissões e recuperação de senha", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = async (path, { body, cookie } = {}) => {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = r.headers.get("set-cookie");
    return { status: r.status, corpo: await r.json(), cookie: set ? set.split(";")[0] : null };
  };
  const cookieAdmin = assinar({ id: "admin-teste", role: "admin", entityId: null });
  const empresa = (email, extra = {}) => ({ role: "empresa", email, senha: "12345678", whats: "(11) 91234-5678", nome: "Empresa Teste", logo: { mimetype: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }, aceitouTermos: true, ...extra });

  // Cadastro pelo site: senha curta e WhatsApp ausente voltam com o campo.
  let r = await req("/auth/register", { body: empresa("a@exemplo.invalid", { senha: "1234567" }) });
  assert.equal(r.status, 400); assert.equal(r.corpo.campo, "senha");
  r = await req("/auth/register", { body: empresa("a@exemplo.invalid", { whats: "" }) });
  assert.equal(r.status, 400); assert.equal(r.corpo.campo, "whatsapp");
  // Nome e logo também são pedidos já na etapa 1.
  r = await req("/auth/register", { body: empresa("a@exemplo.invalid", { nome: " " }) });
  assert.equal(r.status, 400); assert.equal(r.corpo.campo, "nome");
  r = await req("/auth/register", { body: empresa("a@exemplo.invalid", { logo: undefined }) });
  assert.equal(r.status, 400); assert.equal(r.corpo.campo, "logo");
  r = await req("/auth/register", { body: empresa("a@exemplo.invalid") });
  assert.equal(r.status, 200);
  const cookieA = r.cookie;
  r = await req("/onboarding/empresa", { cookie: cookieA });
  assert.match(r.corpo.logo, /^data:image\/png;base64,/);

  // Retomada: o progresso vem do servidor, com a etapa 1 concluída e sem trial.
  r = await req("/onboarding", { cookie: cookieA });
  assert.equal(r.corpo.atual, "empresa");
  assert.equal(r.corpo.trialDias, 0);
  assert.equal(r.corpo.origem, "site");
  assert.equal(r.corpo.whatsapp, "5511912345678");

  // Só o admin gera convites.
  r = await req("/admin/onboarding-convites", { cookie: cookieA, body: { email: "b@exemplo.invalid", comTrial: true } });
  assert.equal(r.status, 403);
  r = await req("/admin/onboarding-convites", { cookie: cookieAdmin, body: { email: "B@exemplo.invalid", comTrial: true, validadeDias: 2 } });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.trialDias, 3);
  const token = r.corpo.url.split("/comecar/")[1];

  // O convite não serve para outro e-mail e só vale uma vez.
  r = await req(`/onboarding/convites/${token}`);
  assert.equal(r.corpo.email, "b@exemplo.invalid");
  r = await req("/auth/register", { body: empresa("c@exemplo.invalid", { convite: token }) });
  assert.equal(r.status, 409); assert.equal(r.corpo.motivo, "outroEmail");
  r = await req("/auth/register", { body: empresa("b@exemplo.invalid", { convite: token }) });
  assert.equal(r.status, 200);
  const cookieB = r.cookie;
  r = await req("/onboarding", { cookie: cookieB });
  assert.equal(r.corpo.trialDias, 3); assert.equal(r.corpo.origem, "convite");
  r = await req(`/onboarding/convites/${token}`);
  assert.equal(r.status, 404); assert.equal(r.corpo.motivo, "usado");

  // Convite aplicado por quem já tem conta: só no e-mail para o qual foi gerado.
  r = await req("/admin/onboarding-convites", { cookie: cookieAdmin, body: { email: "a@exemplo.invalid", comTrial: false } });
  const tokenA = r.corpo.url.split("/comecar/")[1];
  r = await req(`/onboarding/convites/${tokenA}/aplicar`, { cookie: cookieB, body: {} });
  assert.equal(r.status, 409); assert.equal(r.corpo.motivo, "outroEmail");
  r = await req(`/onboarding/convites/${tokenA}/aplicar`, { cookie: cookieA, body: {} });
  assert.equal(r.status, 200); assert.equal(r.corpo.trialDias, 0);

  // Cancelado não serve mais.
  r = await req("/admin/onboarding-convites", { cookie: cookieAdmin, body: { email: "d@exemplo.invalid", comTrial: true } });
  const idCancelado = r.corpo.id, tokenCancelado = r.corpo.url.split("/comecar/")[1];
  r = await req(`/admin/onboarding-convites/${idCancelado}/revogar`, { cookie: cookieAdmin, body: {} });
  assert.equal(r.status, 200);
  r = await req("/auth/register", { body: empresa("d@exemplo.invalid", { convite: tokenCancelado }) });
  assert.equal(r.status, 409); assert.equal(r.corpo.motivo, "revogado");

  // Cada empresa só lê o próprio progresso: o servidor usa a empresa do token.
  r = await req("/onboarding", { cookie: cookieB });
  assert.equal(r.corpo.trialDias, 3);
  r = await req("/onboarding", { cookie: assinar({ id: "x", role: "vendedor", entityId: "qualquer" }) });
  assert.equal(r.status, 403);

  // Empresa antiga, sem WhatsApp: entra no onboarding pela etapa 1.
  const db = new Database(dbPath);
  db.prepare("INSERT INTO companies (id, nome, produto, criadoEm) VALUES ('antiga', 'Antiga', '', 1)").run();
  const cookieAntiga = assinar({ id: "u-antiga", role: "empresa", entityId: "antiga" });
  r = await req("/onboarding", { cookie: cookieAntiga });
  assert.equal(r.corpo.atual, "acesso"); assert.equal(r.corpo.origem, "existente");
  assert.equal(r.corpo.bloqueia, true, "com o fluxo completo, a empresa antiga também passa pelo onboarding");
  r = await req("/onboarding/acesso", { cookie: cookieAntiga, body: { whatsapp: "123" } });
  assert.equal(r.status, 400);
  r = await req("/onboarding/acesso", { cookie: cookieAntiga, body: { whatsapp: "11 3456-7890" } });
  assert.equal(r.corpo.atual, "empresa");

  // Etapa 2: perfil. Nome e logo da etapa 1 já vêm preenchidos;
  // obrigatórios seguram a conclusão, rascunho salva.
  r = await req("/onboarding/empresa", { cookie: cookieA });
  assert.equal(r.corpo.nome, "Empresa Teste");
  r = await req("/onboarding", { cookie: cookieA });
  assert.equal(r.corpo.bloqueia, true, "empresa nova fica na etapa 2, que já existe");
  r = await req("/onboarding/empresa", { cookie: cookieA, body: { produto: "CRM", concluir: true } });
  assert.equal(r.status, 400); assert.ok(r.corpo.erros.nome); assert.ok(r.corpo.erros.publico);
  r = await req("/onboarding/empresa", { cookie: cookieA, body: { produto: "CRM para distribuidoras", ticket: "1.490,00" } });
  assert.equal(r.status, 200); assert.equal(r.corpo.atual, "empresa");
  r = await req("/onboarding/empresa", { cookie: cookieA });
  assert.equal(r.corpo.produto, "CRM para distribuidoras"); assert.equal(r.corpo.ticket, 1490);
  r = await req("/onboarding/empresa", { cookie: cookieA, body: {
    nome: "Acme", produto: "CRM para distribuidoras", ticket: "1.490,00", publico: "Distribuidoras de 20 a 200 funcionários",
    permissoesMarca: { usarEmojis: true }, concluir: true,
  } });
  assert.equal(r.status, 200); assert.equal(r.corpo.atual, "academy");
  assert.equal(db.prepare("SELECT ticket FROM companies WHERE id = (SELECT entityId FROM users WHERE email = 'a@exemplo.invalid')").get().ticket, "R$ 1.490,00");
  r = await req("/onboarding/empresa", { cookie: assinar({ id: "x", role: "vendedor", entityId: "qualquer" }) });
  assert.equal(r.status, 403);

  // Logo: SVG com script é recusado; PNG pequeno passa e pode ser removido.
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>').toString("base64");
  r = await req("/onboarding/empresa/logo", { cookie: cookieA, body: { base64: svg, mimetype: "image/svg+xml" } });
  assert.equal(r.status, 422);
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  r = await req("/onboarding/empresa/logo", { cookie: cookieA, body: { base64: png, mimetype: "image/png" } });
  assert.equal(r.status, 200); assert.match(r.corpo.logo, /^data:image\/png;base64,/);
  r = await req("/onboarding/empresa/logo", { cookie: cookieA, body: { remover: true } });
  assert.equal(r.corpo.logo, "");

  // Recuperação de senha: mesma resposta exista ou não o e-mail, token
  // guardado como hash, e reenvio imediato não troca o link.
  r = await req("/auth/forgot-password", { body: { email: "naoexiste@exemplo.invalid" } });
  assert.equal(r.corpo.ok, true);
  r = await req("/auth/forgot-password", { body: { email: "a@exemplo.invalid" } });
  assert.equal(r.corpo.ok, true);
  const primeiro = db.prepare("SELECT resetToken FROM users WHERE email = 'a@exemplo.invalid'").get().resetToken;
  assert.match(primeiro, /^[0-9a-f]{64}$/);
  await req("/auth/forgot-password", { body: { email: "a@exemplo.invalid" } });
  assert.equal(db.prepare("SELECT resetToken FROM users WHERE email = 'a@exemplo.invalid'").get().resetToken, primeiro);
  r = await req("/auth/reset-password", { body: { token: primeiro, senha: "outrasenha" } });
  assert.equal(r.status, 400, "o hash guardado não funciona como link");
  db.close();
});

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import Database from "better-sqlite3";
import { subirServidor, assinar, cliente } from "./apoio/servidor.js";

// Etapas 3 a 6 contra o servidor de verdade. A IA (API da Anthropic) e o
// gateway (Asaas) são servidores falsos locais, apontados só neste teste:
// ANTHROPIC_BASE_URL é lido pelo SDK, e ASAAS_BASE_URL_TESTE só vale com
// NODE_ENV=test.

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function servidorFalso(t, responder) {
  const s = http.createServer((req, res) => {
    let corpo = "";
    req.on("data", (d) => { corpo += d; });
    req.on("end", () => {
      const [status, json] = responder(req, corpo ? JSON.parse(corpo) : null);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(json));
    });
  });
  s.listen(0);
  t.after(() => s.close());
  return `http://127.0.0.1:${s.address().port}`;
}

const RESPOSTAS_IA = {
  script: { abertura: "Oi {nome}, aqui é da {empresa}.", qualificacao: "Como vocês fazem hoje?", oferta: "O {produto} resolve isso.", fechamento: "Podemos começar?" },
  funil: { boasVindas: "Bem-vindo!", qualificacao: "Qual seu desafio?", oferta: "Temos o {produto}.", objecoes: "Entendo a dúvida.", fechamento: "Vamos fechar?" },
  followups: { followups: [{ quando: "Após 1 dia", mensagem: "Oi {nome}, conseguiu ver?" }] },
};

test("etapas 3 a 6: materiais, IA com falha e nova tentativa, aprovação, cartão recusado e campanha", async (t) => {
  // IA falsa: falha até ser liberada, depois responde conforme o schema pedido.
  let iaNoAr = false;
  const pedidosIA = [];
  const baseIA = servidorFalso(t, (_req, corpo) => {
    pedidosIA.push(corpo);
    if (!iaNoAr) return [500, { type: "error", error: { type: "api_error", message: "fora do ar" } }];
    const req = corpo.output_config.format.schema.required;
    const parte = req.includes("abertura") ? "script" : req.includes("boasVindas") ? "funil" : "followups";
    return [200, {
      id: "msg_1", type: "message", role: "assistant", model: corpo.model, stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(RESPOSTAS_IA[parte]) }], usage: { input_tokens: 1, output_tokens: 1 },
    }];
  });

  // Gateway falso: o cartão terminado em 0002 é recusado.
  const baseAsaas = servidorFalso(t, (req, corpo) => {
    if (req.url.startsWith("/customers")) return [200, { id: "cus_teste" }];
    if (req.url.startsWith("/subscriptions") && req.method === "POST") {
      if (corpo.creditCard?.number?.endsWith("0002")) return [400, { errors: [{ description: "Transação não autorizada." }] }];
      return [200, { id: "sub_teste", creditCard: { creditCardNumber: "4242", creditCardBrand: "VISA" } }];
    }
    if (req.url.startsWith("/payments")) return [200, { data: [] }];
    return [404, { errors: [{ description: "rota falsa inexistente" }] }];
  });

  const { base, dbPath } = await subirServidor(t, {
    ANTHROPIC_API_KEY: "chave-falsa", ANTHROPIC_BASE_URL: baseIA,
    ASAAS_API_KEY: "chave-falsa", ASAAS_BASE_URL_TESTE: baseAsaas,
  });
  const req = cliente(base);
  const db = new Database(dbPath);
  t.after(() => db.close());

  // Empresa nova com convite com trial, já com perfil (etapas 1 e 2).
  const cookieAdmin = assinar({ id: "admin-teste", role: "admin", entityId: null });
  let r = await req("/admin/onboarding-convites", { cookie: cookieAdmin, body: { email: "dono@exemplo.invalid", comTrial: true } });
  const token = r.corpo.url.split("/comecar/")[1];
  r = await req("/auth/register", { body: { role: "empresa", email: "dono@exemplo.invalid", senha: "12345678", whats: "11912345678", nome: "Empresa Teste", logo: { mimetype: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }, aceitouTermos: true, convite: token } });
  const ck = r.cookie;
  r = await req("/onboarding/empresa", { cookie: ck, body: { nome: "Acme", produto: "CRM para distribuidoras", publico: "Distribuidoras", concluir: true } });
  assert.equal(r.corpo.atual, "academy");

  // Etapa 3: tipo errado é recusado; .txt vai para o storage (disco local
  // no teste); link é validado; material pode ser removido.
  r = await req("/onboarding/academy/arquivos/foto", { cookie: ck, bruto: "x", headers: { "Content-Type": "text/plain", "X-Arquivo-Nome": "nota.txt" } });
  assert.equal(r.status, 422);
  r = await req("/onboarding/academy/arquivos/material", { cookie: ck, bruto: "Nosso CRM integra com o ERP em 1 dia.", headers: { "Content-Type": "text/plain", "X-Arquivo-Nome": encodeURIComponent("Visão geral.txt") } });
  assert.equal(r.status, 201); assert.equal(r.corpo.nome, "Visão geral.txt");
  const material = r.corpo;
  r = await req("/onboarding/academy/arquivos/foto", { cookie: ck, bruto: "img", headers: { "Content-Type": "image/png", "X-Arquivo-Nome": "foto.png" } });
  const foto = r.corpo;
  r = await req(`/onboarding/academy/materiais/${foto.id}`, { cookie: ck, method: "DELETE" });
  assert.equal(r.corpo.ok, true);
  r = await req("/onboarding/academy/links", { cookie: ck, body: { url: "javascript:alert(1)" } });
  assert.equal(r.status, 400);
  r = await req("/onboarding/academy/links", { cookie: ck, body: { url: "acme.com.br/catalogo" } });
  assert.equal(r.corpo.url, "https://acme.com.br/catalogo");
  // Outra empresa não remove material desta.
  r = await req(`/onboarding/academy/materiais/${material.id}`, { cookie: assinar({ id: "x", role: "empresa", entityId: "outra" }), method: "DELETE" });
  assert.equal(r.status, 404);
  r = await req("/onboarding/academy/concluir", { cookie: ck, body: { suporte: { nome: "Ana", whatsapp: "123" } } });
  assert.equal(r.status, 400); assert.ok(r.corpo.erros.whatsapp);
  r = await req("/onboarding/academy/concluir", { cookie: ck, body: { suporte: { nome: "Ana", whatsapp: "11 98888-7777", email: "ana@exemplo.invalid" } } });
  assert.equal(r.corpo.atual, "ia");

  // Etapa 4: a IA falha; a análise (fase 1) fica guardada.
  let g;
  for (let i = 0; i < 60; i++) {
    g = (await req("/onboarding/ia", { cookie: ck })).corpo.geracao;
    if (g?.status === "falhou") break;
    await esperar(500);
  }
  assert.equal(g.status, "falhou");
  assert.equal(g.fases.analise, "concluida");
  assert.ok(g.erro);
  assert.equal(db.prepare("SELECT statusIndexacao FROM academy_materiais WHERE id = ?").get(material.id).statusIndexacao, "indexado");
  // Nada aprovado não conclui a etapa.
  r = await req("/onboarding/ia/aprovar-tudo", { cookie: ck, body: {} });
  assert.equal(r.status, 409);

  // Tentar de novo com a IA no ar: continua da fase que falhou.
  iaNoAr = true;
  r = await req("/onboarding/ia/tentar", { cookie: ck, body: {} });
  assert.equal(r.corpo.geracao.status, "pendente");
  for (let i = 0; i < 60; i++) {
    g = (await req("/onboarding/ia", { cookie: ck })).corpo.geracao;
    if (g?.status === "pronta") break;
    await esperar(500);
  }
  assert.equal(g.status, "pronta");
  assert.equal(g.conteudo.script.abertura, RESPOSTAS_IA.script.abertura);
  // O contexto mandado à IA tem o perfil, o material e o pedido de não inventar.
  const ultimo = pedidosIA.at(-1);
  assert.match(ultimo.messages[0].content, /CRM para distribuidoras/);
  assert.match(ultimo.messages[0].content, /integra com o ERP/);
  assert.equal(ultimo.model, "claude-opus-5-5");

  // Editar uma parte tira a aprovação dela; campo vazio é recusado.
  r = await req("/onboarding/ia/aprovar", { cookie: ck, body: { parte: "script" } });
  assert.equal(r.corpo.geracao.aprovacoes.script, true);
  r = await req("/onboarding/ia/conteudo", { cookie: ck, body: { parte: "script", conteudo: { ...RESPOSTAS_IA.script, oferta: "" } } });
  assert.equal(r.status, 400);
  r = await req("/onboarding/ia/conteudo", { cookie: ck, body: { parte: "script", conteudo: { ...RESPOSTAS_IA.script, oferta: "Oferta revisada." } } });
  assert.equal(r.corpo.geracao.aprovacoes.script, false);
  assert.equal(r.corpo.geracao.conteudo.script.oferta, "Oferta revisada.");
  r = await req("/onboarding/ia/aprovar-tudo", { cookie: ck, body: {} });
  assert.equal(r.corpo.atual, "plano");

  // Etapa 5: cartão recusado volta com o motivo e não conclui a etapa.
  r = await req("/onboarding/plano", { cookie: ck });
  assert.equal(r.corpo.trialDias, 3);
  const checkout = (numero) => req("/subscription", { cookie: ck, body: {
    plano: r.corpo.planos[0].chave, onboarding: true,
    cartao: { nome: "Ana Silva", numero, validadeMes: "12", validadeAno: "40", cvv: "123" },
    titular: { documento: "12345678909", cep: "01001000", numero: "10" },
  } });
  let c = await checkout("4000000000000002");
  assert.equal(c.status, 502); assert.match(c.corpo.error, /não autorizada/);
  assert.equal((await req("/onboarding", { cookie: ck })).corpo.atual, "plano");
  c = await checkout("4242424242424242");
  assert.equal(c.status, 200); assert.equal(c.corpo.status, "trial"); assert.equal(c.corpo.trialDias, 3);
  assert.equal(c.corpo.onboardingConcluido, true);
  const sub = db.prepare("SELECT * FROM subscriptions WHERE companyId = (SELECT entityId FROM users WHERE email = 'dono@exemplo.invalid')").get();
  assert.equal(sub.cartaoFinal, "4242");
  assert.ok(!JSON.stringify(sub).includes("4242424242424242"), "número do cartão não fica no banco");
  assert.ok(!JSON.stringify(sub).includes("\"123\""));
  assert.equal((await req("/onboarding", { cookie: ck })).corpo.atual, "campanha");

  // Etapa 6: campanha criada pelo fluxo de sempre e ligada ao onboarding.
  // Sem saldo não conclui; com saldo, conclui e o onboarding termina.
  r = await req("/campaigns", { cookie: ck, body: { titulo: "Primeira campanha", orcamento: 100 } });
  const campanhaId = r.corpo.id;
  r = await req("/onboarding/campanha/concluir", { cookie: ck, body: {} });
  assert.equal(r.status, 409);
  r = await req("/onboarding/campanha", { cookie: ck, body: { campaignId: campanhaId } });
  assert.equal(r.corpo.ok, true);
  r = await req("/onboarding/campanha", { cookie: ck });
  assert.equal(r.corpo.campanha.id, campanhaId);
  assert.equal(r.corpo.caixaOk, false);
  assert.equal(r.corpo.estrategias.script.oferta, "Oferta revisada.");
  assert.equal(JSON.parse(db.prepare("SELECT estrategias FROM campaigns WHERE id = ?").get(campanhaId).estrategias).funil.boasVindas, "Bem-vindo!");
  r = await req("/onboarding/campanha/concluir", { cookie: ck, body: {} });
  assert.equal(r.status, 409);
  db.prepare("UPDATE companies SET saldo = 150 WHERE id = (SELECT entityId FROM users WHERE email = 'dono@exemplo.invalid')").run();
  r = await req("/onboarding/campanha/concluir", { cookie: ck, body: {} });
  assert.equal(r.corpo.concluido, true);
  assert.equal(r.corpo.bloqueia, false);
});

test("etapa 4 sem IA configurada: segue sem estratégias, sem inventar nada", async (t) => {
  const { base } = await subirServidor(t);
  const req = cliente(base);
  let r = await req("/auth/register", { body: { role: "empresa", email: "sem.ia@exemplo.invalid", senha: "12345678", whats: "11912345678", nome: "Empresa Teste", logo: { mimetype: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }, aceitouTermos: true } });
  const ck = r.cookie;
  await req("/onboarding/empresa", { cookie: ck, body: { nome: "Beta", produto: "Consultoria", publico: "PMEs", concluir: true } });
  r = await req("/onboarding/academy", { cookie: ck });
  assert.equal(r.corpo.armazenamento, true, "fora de produção o disco local serve de storage");
  await req("/onboarding/academy/concluir", { cookie: ck, body: {} });
  r = await req("/onboarding/ia", { cookie: ck });
  assert.equal(r.corpo.disponivel, false);
  assert.equal(r.corpo.geracao, null);
  r = await req("/onboarding/ia/pular", { cookie: ck, body: {} });
  assert.equal(r.corpo.atual, "plano");
});

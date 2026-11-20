import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Só funções da conta do WhatsApp que conversam com a Meta: a Graph API é falsa.
// Banco temporário porque meta.js carrega o db.js.
const dir = mkdtempSync(join(tmpdir(), "rycs-wa-conta-"));
Object.assign(process.env, {
  DB_PATH: join(dir, "test.db"), JWT_SECRET: "segredo-teste-wa-conta", NODE_ENV: "test", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "",
  WHATSAPP_TOKEN: "tok", WHATSAPP_PHONE_NUMBER_ID: "PN1", WHATSAPP_WABA_ID: "WABA1", META_APP_ID: "APP1",
});
const meta = await import("../server/services/meta.js");
const conta = await import("../server/services/whatsappConta.js");
const { validarPerfilWhatsapp } = await import("../shared/whatsappPerfil.js");
const { default: db } = await import("../server/db.js");
test.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

let chamadas = [];
let responder = () => ({});
meta.usarFetch(async (url, opcoes = {}) => {
  chamadas.push({ url: decodeURIComponent(url), metodo: opcoes.method, corpo: opcoes.body ? JSON.parse(opcoes.body) : null });
  const r = responder(new URL(url), opcoes);
  return { ok: !r.error, status: r.error ? 400 : 200, json: async () => r };
});

test("custos da Meta: total, por categoria (cobradas x grátis) e por dia", () => {
  const dia1 = Date.UTC(2026, 10, 18) / 1000;
  const dia2 = Date.UTC(2026, 10, 19) / 1000;
  const r = conta.resumirCustos([
    { start: dia1, end: dia1 + 86400, volume: 40, cost: 1.6, pricing_category: "UTILITY", pricing_type: "REGULAR" },
    { start: dia1, end: dia1 + 86400, volume: 5, cost: 0, pricing_category: "UTILITY", pricing_type: "FREE_CUSTOMER_SERVICE" },
    { start: dia2, end: dia2 + 86400, volume: 10, cost: 3.5, pricing_category: "MARKETING", pricing_type: "REGULAR" },
  ]);
  assert.deepEqual(r.total, { mensagens: 55, cobradas: 50, custo: 5.1, custoPorMensagem: 0.102 });
  assert.deepEqual(r.categorias.map((c) => [c.categoria, c.cobradas, c.gratis, c.custo, c.custoPorMensagem]),
    [["MARKETING", 10, 0, 3.5, 0.35], ["UTILITY", 40, 5, 1.6, 0.04]]);
  assert.deepEqual(r.dias.map((d) => [d.dia, d.mensagens]), [["2026-11-19", 10], ["2026-11-18", 45]]);
});

test("estatísticas por modelo: cliques por botão, taxa de clique e custo por entregue e por clique", () => {
  const r = conta.resumirEstatisticas([
    { template_id: "11", sent: 30, delivered: 28, read: 20, clicked: [{ type: "url_button", button_content: "Resolver pendências", count: 7 }],
      cost: [{ type: "amount_spent", value: 1.4 }, { type: "cost_per_delivered", value: 0.05 }] },
    { template_id: "11", sent: 20, delivered: 12, read: 5, clicked: [{ type: "quick_reply_button", button_content: "Parar mensagens", count: 1 }],
      cost: [{ type: "amount_spent", value: 0.6 }] },
    { template_id: "22", sent: 0, delivered: 0, read: 0 },
  ], [{ id: "11", nome: "rycs_conta_pendente", idioma: "pt_BR", categoria: "MARKETING" }]);
  assert.equal(r.length, 1, "modelo sem envio nem clique fica fora");
  const m = r[0];
  assert.deepEqual({ nome: m.nome, enviados: m.enviados, entregues: m.entregues, lidos: m.lidos, cliques: m.cliques, cliquesLink: m.cliquesLink, custo: m.custo },
    { nome: "rycs_conta_pendente", enviados: 50, entregues: 40, lidos: 25, cliques: 8, cliquesLink: 7, custo: 2 });
  assert.equal(m.taxaClique, 20);
  assert.equal(m.custoPorEntregue, 0.05);
  assert.equal(m.custoPorClique, 0.2857);
  assert.deepEqual(m.botoes.map((b) => [b.botao, b.cliques]), [["Resolver pendências", 7], ["Parar mensagens", 1]]);
});

test("campo que a versão da API não tem não derruba a leitura do número", async () => {
  chamadas = [];
  responder = (u) => {
    const campos = u.searchParams.get("fields").split(",");
    if (campos.includes("messaging_limit_tier") && campos.length > 1) return { error: { code: 100, message: "Tried accessing nonexisting field" } };
    if (campos[0] === "messaging_limit_tier") return { error: { code: 100, message: "Tried accessing nonexisting field" } };
    return Object.fromEntries(campos.map((c) => [c, c === "quality_rating" ? "GREEN" : `v_${c}`]));
  };
  const r = await conta.lerCampos("PN1", ["quality_rating", "messaging_limit_tier", "verified_name"]);
  assert.deepEqual(r, { quality_rating: "GREEN", verified_name: "v_verified_name" });
  assert.equal(chamadas.length, 4, "uma tentativa com todos e depois um por um");

  // Campo que a Meta só libera para provedores (erro 10) também não derruba o resto.
  responder = (u) => {
    const campos = u.searchParams.get("fields").split(",");
    if (campos.includes("primary_funding_id")) return { error: { code: 10, message: "requires Business Solution Provider" } };
    return Object.fromEntries(campos.map((c) => [c, `v_${c}`]));
  };
  assert.deepEqual(await conta.lerCampos("WABA1", ["currency", "primary_funding_id"]), { currency: "v_currency" });
  responder = () => ({ error: { code: 10, message: "sem permissão" } });
  await assert.rejects(conta.lerCampos("WABA1", ["currency", "primary_funding_id"]), /sem permissão/, "se nada vier, mostra o erro da Meta");
});

test("custos e estatísticas pedem à Meta o período e os modelos certos", async () => {
  chamadas = [];
  responder = (u) => (u.pathname.endsWith("/template_analytics")
    ? { data: [{ data_points: [{ template_id: "11", sent: 1, delivered: 1, read: 0, clicked: [], cost: [] }] }] }
    : { pricing_analytics: { data: [{ data_points: [{ start: 1, volume: 1, cost: 0.04, pricing_category: "UTILITY", pricing_type: "REGULAR" }] }] } });
  const c = await conta.custosWhatsapp(30);
  assert.equal(c.total.custo, 0.04);
  assert.match(chamadas[0].url, /\/WABA1\?fields=pricing_analytics\.start\(\d+\)\.end\(\d+\)\.granularity\(DAILY\)\.dimensions\(\["PRICING_CATEGORY","PRICING_TYPE"\]\)/);

  const ids = Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), nome: `m${i + 1}` }));
  chamadas = [];
  const e = await conta.estatisticasModelos(90, ids);
  assert.equal(chamadas.length, 2, "a Meta aceita até 10 modelos por consulta");
  assert.match(chamadas[0].url, /template_ids=\[1,2,3,4,5,6,7,8,9,10\]/);
  const u = new URL(chamadas[0].url.replace(/ /g, "%20"));
  assert.ok(Number(u.searchParams.get("end")) - Number(u.searchParams.get("start")) <= 89 * 86400, "no máximo 89 dias");
  assert.equal(e[0].nome, "m11");
});

test("perfil do WhatsApp: valida antes de mandar e grava na Meta", async () => {
  assert.match(validarPerfilWhatsapp({ about: "" }).erro, /recado/);
  assert.match(validarPerfilWhatsapp({ about: "x".repeat(140) }).erro, /about/);
  assert.match(validarPerfilWhatsapp({ about: "Oi", email: "nada" }).erro, /E-mail/);
  assert.match(validarPerfilWhatsapp({ about: "Oi", websites: ["rycs.pro"] }).erro, /https/);
  assert.match(validarPerfilWhatsapp({ about: "Oi", vertical: "XYZ" }).erro, /Categoria/);

  chamadas = [];
  responder = (u, o) => (o.method === "POST" ? { success: true } : { data: [{ about: "Vendas por comissão", vertical: "PROF_SERVICES" }] });
  const r = await conta.salvarPerfil({ about: " Vendas por comissão ", websites: ["https://rycs.pro", ""], vertical: "PROF_SERVICES" });
  assert.equal(r.about, "Vendas por comissão");
  assert.equal(chamadas[0].metodo, "POST");
  assert.match(chamadas[0].url, /\/PN1\/whatsapp_business_profile/);
  assert.deepEqual(chamadas[0].corpo, { messaging_product: "whatsapp", about: "Vendas por comissão", address: "", description: "", email: "", websites: ["https://rycs.pro"], vertical: "PROF_SERVICES" });
  await assert.rejects(conta.salvarPerfil({ about: "" }), (e) => e.validacao === true);
});

test("links do painel da Meta usam o negócio, a conta e o app da RYCS", () => {
  const links = conta.linksMeta();
  assert.ok(links.some((l) => l.url.includes("waba_id=WABA1")));
  assert.ok(links.some((l) => l.url.includes("/apps/APP1/")));
  assert.ok(links.every((l) => l.url.startsWith("https://")));
});

test("gastos do WhatsApp: hoje, 7 dias, mês e desde a recarga", () => {
  const agoraMs = Date.UTC(2026, 10, 20, 15, 0);
  const dias = [
    { dia: "2026-11-20", custo: 0.5 }, { dia: "2026-11-19", custo: 1.61 }, { dia: "2026-11-14", custo: 2 }, { dia: "2026-10-31", custo: 9 },
  ];
  assert.deepEqual(conta.resumirGastos(dias, { agoraMs, desdeMs: Date.UTC(2026, 10, 19, 22, 0) }),
    { hoje: 0.5, seteDias: 4.11, mes: 4.11, desdeRecarga: 2.11 });
});

test("saldo estimado: recargas registradas menos o gasto que a Meta informa desde a primeira", async () => {
  assert.throws(() => conta.registrarRecarga({ valor: "0" }), /valor/);
  assert.throws(() => conta.registrarRecarga({ valor: "10", em: "2999-01-01" }), /Data/);
  const hoje = new Date().toISOString().slice(0, 10);
  const { id } = conta.registrarRecarga({ valor: "10,00", em: hoje, observacao: "Pix" }, "adm");
  assert.deepEqual(conta.listarRecargas().map((r) => [r.valor, r.observacao]), [[10, "Pix"]]);

  chamadas = [];
  const inicioHoje = Math.floor(Date.parse(`${hoje}T00:00:00Z`) / 1000);
  responder = (u) => (u.searchParams.get("fields")?.startsWith("pricing_analytics")
    ? { pricing_analytics: { data: [{ data_points: [{ start: inicioHoje, volume: 46, cost: 1.61, pricing_category: "UTILITY", pricing_type: "REGULAR" }] }] } }
    : { currency: "BRL", ownership_type: "SELF" });
  const s = await conta.saldoMeta();
  assert.equal(s.moeda, "BRL");
  assert.equal(s.whatsapp.hoje, 1.61);
  assert.equal(s.totalRecargas, 10);
  assert.equal(s.saldoEstimado, 8.39);
  assert.equal(s.anuncios.ok, false, "sem META_ADS_TOKEN a conta de anúncios avisa em vez de inventar");

  assert.equal(conta.apagarRecarga(id), 1);
  assert.equal((await conta.saldoMeta()).saldoEstimado, null, "sem recarga registrada não há saldo estimado");
});

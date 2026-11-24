// Adaptadores de ERP. Cada um fala com uma API e devolve sempre o mesmo
// formato; o resto da plataforma não sabe qual ERP é.
//
//   produtos(ctx, pagina) / contatos(ctx, pagina) → { itens, fim }
//   criarContato(ctx, cliente) → id
//   criarPedido(ctx, pedido) → { id, numero }
//
// ctx: { cred, config, pedir } — `pedir` é o fetch (trocado nos testes).

import { createHmac } from "node:crypto";
import { request } from "node:https";
import { lookup } from "node:dns";
import { isIP, BlockList } from "node:net";

export class ErroErp extends Error {
  // `incerto`: não dá para saber se o ERP processou (queda, demora, erro 5xx).
  constructor(msg, { status = 0, autorizacao = false, incerto = false } = {}) { super(msg); Object.assign(this, { status, autorizacao, incerto, erp: true }); }
}

const TEMPO_MS = 20000;
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const digitos = (v) => String(v ?? "").replace(/\D/g, "");
const dataBr = (iso) => iso.split("-").reverse().join("/");

async function json(pedir, url, opcoes = {}) {
  let r;
  try { r = await pedir(url, { signal: AbortSignal.timeout(TEMPO_MS), redirect: "error", ...opcoes }); }
  catch (e) { throw new ErroErp(e?.name === "TimeoutError" ? "O ERP demorou demais para responder." : "Não foi possível falar com o ERP.", { incerto: true }); }
  const corpo = await r.json().catch(() => null);
  return { r, corpo };
}

// ── Bling (API v3, OAuth) ─────────────────────────────────────────────────

const BLING = "https://api.bling.com.br/Api/v3";
export const BLING_OAUTH = () => (process.env.BLING_OAUTH_URL || "https://www.bling.com.br/Api/v3/oauth").replace(/\/+$/, "");

export async function tokenBling(pedir, campos) {
  const basic = Buffer.from(`${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`).toString("base64");
  const { r, corpo } = await json(pedir, `${BLING_OAUTH()}/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "enable-jwt": "1" },
    body: new URLSearchParams(campos).toString(),
  });
  if (!r.ok || !corpo?.access_token) throw new ErroErp(corpo?.error?.description || corpo?.error_description || "O Bling não liberou o acesso.", { status: r.status, autorizacao: true });
  return { accessToken: corpo.access_token, refreshToken: corpo.refresh_token || "", expiraEm: Date.now() + num(corpo.expires_in || 21600) * 1000 };
}

async function bling(ctx, caminho, { metodo = "GET", dados } = {}) {
  const { r, corpo } = await json(ctx.pedir, `${BLING}${caminho}`, {
    method: metodo, headers: { Authorization: `Bearer ${ctx.cred.accessToken}`, Accept: "application/json", "enable-jwt": "1", ...(dados ? { "Content-Type": "application/json" } : {}) },
    body: dados ? JSON.stringify(dados) : undefined,
  });
  if (r.status === 401) throw new ErroErp("O acesso ao Bling expirou. Conecte de novo.", { status: 401, autorizacao: true });
  if (!r.ok) {
    const e = corpo?.error || {};
    const campos = (e.fields || []).map((f) => f.msg || f.message).filter(Boolean).join("; ");
    throw new ErroErp([e.description || e.message || `O Bling respondeu ${r.status}`, campos].filter(Boolean).join(": "), { status: r.status, incerto: r.status >= 500 });
  }
  return corpo?.data;
}

const provedorBling = {
  pausaMs: 400,
  async testar(ctx) { await bling(ctx, "/produtos?pagina=1&limite=1"); },
  async produtos(ctx, pagina) {
    const d = (await bling(ctx, `/produtos?pagina=${pagina}&limite=100&criterio=2&tipo=T`)) || [];
    return { fim: d.length < 100, itens: d.map((p) => ({ externoId: String(p.id), codigo: p.codigo || "", nome: p.nome || "", preco: num(p.preco), unidade: p.unidade || "UN", estoque: p.estoque?.saldoVirtualTotal ?? null })) };
  },
  async contatos(ctx, pagina) {
    const d = (await bling(ctx, `/contatos?pagina=${pagina}&limite=100&criterio=1`)) || [];
    return { fim: d.length < 100, itens: d.map((c) => ({ externoId: String(c.id), nome: c.nome || "", documento: digitos(c.numeroDocumento), telefone: digitos(c.celular || c.telefone), email: "" })) };
  },
  async criarContato(ctx, c) {
    const doc = digitos(c.documento);
    const d = await bling(ctx, "/contatos", { metodo: "POST", dados: {
      nome: c.nome, tipo: doc.length === 14 ? "J" : "F", situacao: "A", ...(doc ? { numeroDocumento: doc } : {}),
      ...(c.telefone ? { celular: digitos(c.telefone) } : {}), ...(c.email ? { email: c.email } : {}),
    } });
    return String(d?.id || "");
  },
  async criarPedido(ctx, p) {
    const d = await bling(ctx, "/pedidos/vendas", { metodo: "POST", dados: {
      data: p.data, dataSaida: p.data, dataPrevista: p.data, contato: { id: Number(p.cliente.erpId) },
      itens: p.itens.map((i) => ({ ...(i.codigo ? { codigo: i.codigo } : {}), descricao: i.nome, unidade: i.unidade || "UN", quantidade: i.quantidade, valor: i.valor, ...(i.erpId ? { produto: { id: Number(i.erpId) } } : {}) })),
      ...(p.desconto ? { desconto: { valor: p.desconto, unidade: "REAL" } } : {}), ...(p.frete ? { transporte: { frete: p.frete } } : {}),
      observacoes: p.observacoes || "", observacoesInternas: `Pedido RYCS ${p.numero}`,
    } });
    return { id: String(d?.id || ""), numero: String(d?.numero || "") };
  },
};

// ── Omie ──────────────────────────────────────────────────────────────────

async function omie(ctx, servico, call, param) {
  const { r, corpo } = await json(ctx.pedir, `https://app.omie.com.br/api/v1/${servico}/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ call, app_key: ctx.cred.appKey, app_secret: ctx.cred.appSecret, param: [param] }),
  });
  if (!r.ok || corpo?.faultstring) {
    const msg = String(corpo?.faultstring || `O Omie respondeu ${r.status}`).replace(/^ERROR:\s*/i, "");
    if (/n[aã]o existem registros/i.test(msg)) return null;
    // O Omie devolve 500 também para recusa normal, com o motivo em faultstring.
    throw new ErroErp(msg, { status: r.status, autorizacao: /app_key|app_secret|chave de acesso/i.test(msg), incerto: !corpo?.faultstring });
  }
  return corpo;
}

const provedorOmie = {
  pausaMs: 350,
  async testar(ctx) { await omie(ctx, "geral/produtos", "ListarProdutos", { pagina: 1, registros_por_pagina: 1, apenas_importado_api: "N", filtrar_apenas_omiepdv: "N" }); },
  async produtos(ctx, pagina) {
    const c = await omie(ctx, "geral/produtos", "ListarProdutos", { pagina, registros_por_pagina: 100, apenas_importado_api: "N", filtrar_apenas_omiepdv: "N" });
    return { fim: !c || pagina >= num(c.total_de_paginas), itens: (c?.produto_servico_cadastro || []).filter((p) => p.inativo !== "S" && p.bloqueado !== "S")
      .map((p) => ({ externoId: String(p.codigo_produto), codigo: p.codigo || "", nome: p.descricao || "", preco: num(p.valor_unitario), unidade: p.unidade || "UN", estoque: null })) };
  },
  async contatos(ctx, pagina) {
    const c = await omie(ctx, "geral/clientes", "ListarClientes", { pagina, registros_por_pagina: 100, apenas_importado_api: "N" });
    return { fim: !c || pagina >= num(c.total_de_paginas), itens: (c?.clientes_cadastro || []).filter((x) => x.inativo !== "S")
      .map((x) => ({ externoId: String(x.codigo_cliente_omie), nome: x.nome_fantasia || x.razao_social || "", documento: digitos(x.cnpj_cpf), telefone: digitos(`${x.telefone1_ddd || ""}${x.telefone1_numero || ""}`), email: x.email || "" })) };
  },
  async criarContato(ctx, c) {
    const tel = digitos(c.telefone).replace(/^55(?=\d{10,11}$)/, "");
    const r = await omie(ctx, "geral/clientes", "IncluirCliente", {
      codigo_cliente_integracao: `RYCS-${c.ref}`.slice(0, 60), razao_social: c.nome.slice(0, 60), nome_fantasia: c.nome.slice(0, 100),
      ...(c.documento ? { cnpj_cpf: digitos(c.documento) } : {}), ...(c.email ? { email: c.email } : {}),
      ...(tel.length >= 10 ? { telefone1_ddd: tel.slice(0, 2), telefone1_numero: tel.slice(2) } : {}),
    });
    return String(r?.codigo_cliente_omie || "");
  },
  async criarPedido(ctx, p) {
    let conta = ctx.config.contaCorrente;
    if (!conta) {
      const c = await omie(ctx, "geral/contacorrente", "ListarContasCorrentes", { pagina: 1, registros_por_pagina: 50, apenas_importado_api: "N" });
      conta = (c?.ListarContasCorrentes || []).find((x) => x.inativo !== "S")?.nCodCC;
      if (!conta) throw new ErroErp("Cadastre uma conta corrente no Omie para receber pedidos.");
    }
    const r = await omie(ctx, "produtos/pedido", "IncluirPedido", {
      cabecalho: { codigo_cliente: Number(p.cliente.erpId), codigo_pedido_integracao: p.id.replace(/-/g, "").slice(0, 20), data_previsao: dataBr(p.data), etapa: "10", codigo_parcela: "000", quantidade_itens: p.itens.length },
      det: p.itens.map((i, n) => ({ ide: { codigo_item_integracao: String(n + 1) }, produto: { codigo_produto: Number(i.erpId), descricao: i.nome, unidade: i.unidade || "UN", quantidade: i.quantidade, valor_unitario: i.valor,
        ...(n === 0 && p.desconto ? { tipo_desconto: "V", valor_desconto: p.desconto } : {}) } })),
      ...(p.frete ? { frete: { valor_frete: p.frete } } : {}),
      informacoes_adicionais: { codigo_categoria: ctx.config.categoria || "1.01.03", codigo_conta_corrente: Number(conta), consumidor_final: "S", enviar_email: "N" },
      observacoes: { obs_venda: [p.observacoes, `Pedido RYCS ${p.numero}`].filter(Boolean).join("\n") },
    });
    return { id: String(r?.codigo_pedido || ""), numero: String(r?.numero_pedido || "") };
  },
};

// ── Olist Tiny (API v2) ───────────────────────────────────────────────────

async function tiny(ctx, metodo, campos = {}) {
  const { r, corpo } = await json(ctx.pedir, `https://api.tiny.com.br/api2/${metodo}.php`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: ctx.cred.token, formato: "json", ...campos }).toString(),
  });
  const ret = corpo?.retorno;
  if (!r.ok || !ret) throw new ErroErp(`O Tiny respondeu ${r.status}`, { status: r.status, incerto: true });
  if (ret.status !== "OK") {
    if (Number(ret.codigo_erro) === 20) return null; // nenhum registro
    const erros = [...(ret.erros || []), ...(ret.registros || []).flatMap((x) => (x.registro || x)?.erros || [])].map((e) => e.erro || e).filter((e) => typeof e === "string");
    throw new ErroErp(erros.join("; ") || "O Tiny recusou o pedido.", { autorizacao: [1, 2].includes(Number(ret.codigo_erro)) });
  }
  return ret;
}

const provedorTiny = {
  pausaMs: 1200,
  async testar(ctx) { await tiny(ctx, "info"); },
  async produtos(ctx, pagina) {
    const c = await tiny(ctx, "produtos.pesquisa", { pesquisa: "", situacao: "A", pagina: String(pagina) });
    return { fim: !c || pagina >= num(c.numero_paginas || 1), itens: (c?.produtos || []).map(({ produto: p }) => ({ externoId: String(p.id), codigo: p.codigo || "", nome: p.nome || "", preco: num(p.preco_promocional) || num(p.preco), unidade: p.unidade || "UN", estoque: null })) };
  },
  async contatos(ctx, pagina) {
    const c = await tiny(ctx, "contatos.pesquisa", { pesquisa: "", situacao: "Ativo", pagina: String(pagina) });
    return { fim: !c || pagina >= num(c.numero_paginas || 1), itens: (c?.contatos || []).map(({ contato: x }) => ({ externoId: String(x.id), nome: x.fantasia || x.nome || "", documento: digitos(x.cpf_cnpj), telefone: digitos(x.fone), email: x.email || "" })) };
  },
  // O Tiny cria o cliente junto com o pedido.
  async criarContato() { return ""; },
  async criarPedido(ctx, p) {
    const c = await tiny(ctx, "pedido.incluir", { pedido: JSON.stringify({ pedido: {
      data_pedido: dataBr(p.data),
      cliente: { nome: p.cliente.nome.slice(0, 30), ...(p.cliente.documento ? { cpf_cnpj: digitos(p.cliente.documento) } : {}), ...(p.cliente.telefone ? { fone: digitos(p.cliente.telefone) } : {}), ...(p.cliente.email ? { email: p.cliente.email } : {}), atualizar_cliente: "N" },
      itens: p.itens.map((i) => ({ item: { ...(i.codigo ? { codigo: i.codigo } : {}), descricao: i.nome.slice(0, 120), unidade: (i.unidade || "UN").slice(0, 3), quantidade: String(i.quantidade), valor_unitario: i.valor.toFixed(2) } })),
      ...(p.desconto ? { valor_desconto: p.desconto.toFixed(2) } : {}), ...(p.frete ? { valor_frete: p.frete.toFixed(2) } : {}),
      obs: [p.observacoes, `Pedido RYCS ${p.numero}`].filter(Boolean).join("\n").slice(0, 1000),
    } }) });
    const reg = [c?.registros].flat().filter(Boolean).map((x) => x.registro || x)[0];
    if (reg?.status && reg.status !== "OK") throw new ErroErp((reg.erros || []).map((e) => e.erro).join("; ") || "O Tiny recusou o pedido.");
    return { id: String(reg?.id || ""), numero: String(reg?.numero || "") };
  },
};

// ── Genérico (qualquer ERP, por webhook) ──────────────────────────────────

const PRIVADOS = new BlockList();
for (const [rede, bits, tipo] of [["0.0.0.0", 8, "ipv4"], ["10.0.0.0", 8, "ipv4"], ["100.64.0.0", 10, "ipv4"], ["127.0.0.0", 8, "ipv4"], ["169.254.0.0", 16, "ipv4"],
  ["172.16.0.0", 12, "ipv4"], ["192.0.0.0", 24, "ipv4"], ["192.168.0.0", 16, "ipv4"], ["198.18.0.0", 15, "ipv4"], ["224.0.0.0", 3, "ipv4"],
  ["::", 128, "ipv6"], ["::1", 128, "ipv6"], ["64:ff9b::", 96, "ipv6"], ["fc00::", 7, "ipv6"], ["fe80::", 10, "ipv6"], ["ff00::", 8, "ipv6"]]) PRIVADOS.addSubnet(rede, bits, tipo);

// Endereço de rede interna nunca recebe requisição da RYCS (o servidor fica na
// AWS, e o endereço é digitado pela empresa).
export function ipPublico(ip) {
  const v = isIP(ip);
  if (!v) return false;
  const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapeado) return ipPublico(mapeado[1]);
  return !PRIVADOS.check(ip, v === 6 ? "ipv6" : "ipv4") && !(v === 6 && /^::ffff:/i.test(ip));
}

// A conferência acontece na hora da conexão, no mesmo IP que será usado.
function buscaSegura(host, opcoes, cb) {
  lookup(host, { ...opcoes, all: true }, (e, lista) => {
    if (e) return cb(e);
    if (!lista.length || lista.some((x) => !ipPublico(x.address))) return cb(new Error("endereço interno"));
    return opcoes.all ? cb(null, lista) : cb(null, lista[0].address, lista[0].family);
  });
}

export function enviarParaUrl(url, corpo, cabecalhos) {
  return new Promise((ok, falha) => {
    let u;
    try { u = new URL(url); } catch { return falha(new ErroErp("Endereço do ERP inválido.")); }
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (u.protocol !== "https:" || (isIP(host) && !ipPublico(host))) return falha(new ErroErp("O endereço do ERP precisa ser público e começar com https://."));
    const req = request(u, { method: "POST", lookup: buscaSegura, timeout: TEMPO_MS, headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(corpo), ...cabecalhos } }, (res) => {
      let texto = "";
      res.on("data", (d) => { if (texto.length < 20000) texto += d; });
      res.on("end", () => ok({ status: res.statusCode, texto }));
    });
    req.on("timeout", () => req.destroy(new Error("tempo esgotado")));
    req.on("error", (e) => falha(new ErroErp(e.message === "endereço interno" ? "O endereço do ERP aponta para uma rede interna." : "Não foi possível falar com o endereço do ERP.", { incerto: e.message !== "endereço interno" })));
    req.end(corpo);
  });
}

const provedorGenerico = {
  pausaMs: 0,
  async testar() { /* não há o que testar: o ERP é quem envia produtos e clientes */ },
  produtos: null, contatos: null,
  async criarContato() { return ""; },
  async criarPedido(ctx, p) {
    if (!ctx.cred.url) throw new ErroErp("Informe em Integrações o endereço do seu ERP que recebe os pedidos.");
    const corpo = JSON.stringify({ evento: "pedido.aprovado", pedido: p });
    const assinatura = createHmac("sha256", ctx.cred.segredo).update(corpo).digest("hex");
    const r = await (ctx.enviar || enviarParaUrl)(ctx.cred.url, corpo, { "X-RYCS-Signature": `sha256=${assinatura}`, "Idempotency-Key": p.id });
    if (r.status < 200 || r.status >= 300) throw new ErroErp(`O endereço do ERP respondeu ${r.status}.`, { status: r.status, incerto: r.status >= 500 });
    let d = {};
    try { d = JSON.parse(r.texto); } catch { /* resposta livre */ }
    return { id: String(d?.id || ""), numero: String(d?.numero || "") };
  },
};

export const PROVEDORES = { bling: provedorBling, omie: provedorOmie, tiny: provedorTiny, generico: provedorGenerico };

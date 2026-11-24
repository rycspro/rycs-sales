import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { totais, normalizarPedido, errosDoPedido, extrairItens, extrairCliente, textoPedido } from "../shared/pedidos.js";
import { validarCredenciais } from "../shared/erp.js";

const dir = mkdtempSync(join(tmpdir(), "rycs-erp-"));
Object.assign(process.env, { DB_PATH: join(dir, "test.db"), JWT_SECRET: "segredo-teste-erp", NODE_ENV: "test", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", BLING_CLIENT_ID: "id", BLING_CLIENT_SECRET: "seg" });
const { PROVEDORES, ipPublico, enviarParaUrl } = await import("../server/services/erpProvedores.js");
const erp = await import("../server/services/erp.js");
const canais = await import("../server/services/canais.js");
const pedidos = await import("../server/services/pedidos.js");
const { default: db } = await import("../server/db.js");
test.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });
for (const p of Object.values(PROVEDORES)) p.pausaMs = 0;

const T = Date.now();
const ins = (sql, ...a) => db.prepare(sql).run(...a);
for (const c of ["c1", "c2"]) ins("INSERT INTO companies (id, nome, produto, criadoEm, servicos) VALUES (?, ?, 'x', ?, ?)", c, c, T, JSON.stringify([{ nome: "Instalação", valor: "1.250,50" }]));
ins("INSERT INTO sellers (id, nome, email, whats, status, criadoEm) VALUES ('s1', 'V', 's@x.invalid', '', 'aprovado', ?)", T);
ins("INSERT INTO leads (id, sellerId, companyId, nome, telefone, email, criadoEm, atualizadoEm) VALUES ('l1', 's1', 'c1', 'Ana', '11988887777', '', ?, ?)", T, T);

let chamadas = [], rede = () => ({});
const http = async (url, o = {}) => {
  const c = { url: String(url), metodo: o.method || "GET", headers: o.headers || {}, corpo: o.body };
  chamadas.push(c);
  const r = await rede(c);
  return { ok: (r.status || 200) < 400, status: r.status || 200, json: async () => r.json ?? r };
};
let saidas = [], saida = () => ({ status: 200, texto: '{"id":"E1","numero":"77"}' });
erp.usarRede({ fetch: http, enviar: async (...a) => { saidas.push(a); return saida(); } });
const ate = async (f) => { for (let i = 0; i < 200; i++) { if (f()) return; await new Promise((r) => setTimeout(r, 10)); } throw new Error("não aconteceu a tempo"); };

test("pedido: totais em centavos, normalização e erros", () => {
  const p = normalizarPedido({ cliente: { nome: " Ana ", documento: "123.456.789-09" }, itens: [{ nome: "A", quantidade: "2,5", valor: "10,10" }, { nome: "B", quantidade: 3, valor: 0.1 }, { nome: "" }], desconto: "0,55", frete: 5 });
  assert.equal(p.itens.length, 2);
  assert.deepEqual(totais(p), { subtotal: 25.55, total: 30 });
  assert.deepEqual(errosDoPedido(p), []);
  assert.ok(errosDoPedido(normalizarPedido({ cliente: { nome: "Ana" }, itens: [{ nome: "A", quantidade: 1, valor: 0 }] })).some((e) => /valor/.test(e)));
  assert.ok(errosDoPedido(normalizarPedido({ cliente: { nome: "Ana" }, itens: [{ nome: "A", quantidade: 1, valor: 5 }], desconto: 10 })).some((e) => /desconto/.test(e)));
  assert.equal(normalizarPedido({ itens: [{ nome: "A", quantidade: -3, valor: -1 }] }).itens[0].quantidade, 0);
  assert.match(textoPedido(p), /Total: R\$ 30,00/);
});

test("leitura da conversa: só produto do catálogo e quantidade escrita", () => {
  const cat = [{ externoId: "1", codigo: "CAM-01", nome: "Camiseta Básica Preta", preco: 50 }, { externoId: "2", codigo: "", nome: "Caneca", preco: 20 }, { externoId: "3", codigo: "", nome: "Caneca Térmica Inox", preco: 90 }];
  const r = extrairItens([{ id: "m1", texto: "Quero 3 camisetas básicas pretas e duas canecas" }, { id: "m2", texto: "e um helicóptero" }], cat);
  assert.deepEqual(r.map((x) => [x.produto.externoId, x.quantidade]).sort(), [["1", 3], ["2", 2]]);
  assert.deepEqual(extrairItens([{ id: "m", texto: "me vê 5 un CAM-01" }], cat).map((x) => [x.produto.externoId, x.quantidade]), [["1", 5]]);
  assert.equal(extrairItens([{ id: "m", texto: "tem caneca?" }], cat)[0].quantidadeInformada, false);
  assert.deepEqual(extrairCliente([{ id: "m", direcao: "recebida", texto: "Ana@X.com CPF 123.456.789-09" }, { id: "n", direcao: "enviada", texto: "loja@x.com" }]), { email: { valor: "ana@x.com", mensagem: "m" }, documento: { valor: "12345678909", mensagem: "m" } });
});

test("credenciais e endereços: só https público", () => {
  assert.ok(validarCredenciais("omie", { appKey: "x" }));
  assert.equal(validarCredenciais("omie", { appKey: "x", appSecret: "y" }), null);
  assert.ok(validarCredenciais("bling", {}), "Bling só por login");
  assert.ok(validarCredenciais("generico", { url: "http://x.com" }));
  for (const ip of ["127.0.0.1", "10.1.1.1", "169.254.169.254", "192.168.0.1", "172.20.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "0.0.0.0", "100.64.0.1"]) assert.equal(ipPublico(ip), false, ip);
  for (const ip of ["8.8.8.8", "2606:4700::1111"]) assert.equal(ipPublico(ip), true, ip);
});

test("endereço interno é recusado antes de qualquer conexão", async () => {
  for (const u of ["https://169.254.169.254/latest", "https://localhost/x", "https://[::1]/x", "http://exemplo.com", "https://127.0.0.1:3001/api"]) await assert.rejects(enviarParaUrl(u, "{}", {}), /público|interna/, u);
});

test("Omie: conecta, copia catálogo e clientes e apaga o que saiu do ERP", async () => {
  ins("INSERT INTO erp_produtos (companyId, externoId, nome, atualizadoEm) VALUES ('c1', 'velho', 'Antigo', 1)");
  rede = ({ corpo }) => {
    const b = JSON.parse(corpo);
    if (b.app_secret !== "certo") return { status: 500, json: { faultstring: "ERROR: A chave de acesso está inválida" } };
    if (b.call === "ListarProdutos") return { json: { total_de_paginas: 1, produto_servico_cadastro: [{ codigo_produto: 11, codigo: "CAM-01", descricao: "Camiseta Preta", valor_unitario: 49.9, unidade: "UN", inativo: "N" }, { codigo_produto: 12, descricao: "Fora", inativo: "S" }] } };
    if (b.call === "ListarClientes") return { json: { total_de_paginas: 1, clientes_cadastro: [{ codigo_cliente_omie: 500, razao_social: "Ana Comércio", cnpj_cpf: "12.345.678/0001-95", telefone1_ddd: "11", telefone1_numero: "98888-7777", email: "Ana@x.com" }] } };
    return { json: {} };
  };
  await assert.rejects(erp.conectarErp("c1", "omie", { appKey: "k", appSecret: "errado" }), /Omie:.*inválida/);
  assert.equal(erp.conexaoErp("c1"), null, "credencial errada não é gravada");
  await erp.conectarErp("c1", "omie", { appKey: "k", appSecret: "certo" });
  await ate(() => erp.resumoErp("c1").ultimoSyncEm);
  const r = erp.resumoErp("c1");
  assert.deepEqual([r.produtos, r.contatos], [1, 1]);
  assert.ok(!db.prepare("SELECT credenciais FROM erp_conexoes WHERE companyId = 'c1'").get().credenciais.includes("certo"), "credencial cifrada");
  assert.equal(erp.buscarProdutos("c2", "camiseta").length, 0, "uma empresa não vê o catálogo da outra");
  assert.equal(erp.contatoDoErp("c1", { telefone: "5511988887777" }).externoId, "500");
  assert.equal(erp.contatoDoErp("c1", { nome: "Ana Comércio" }), null, "nunca só pelo nome");
});

let pedido;
test("gerar: junta conversa, lead e ERP num rascunho, com a fonte de cada dado", async () => {
  const cx = canais.salvarConexao({ companyId: "c1", canal: "whatsapp", externoId: "111111", token: "t", userId: "u1" });
  const { conversaId } = canais.registrarMensagem(cx, { contato: "5511988887777", telefone: "5511988887777", nome: "aninha", externoId: "m1", direcao: "recebida", em: T, texto: "Quero 4 camisetas pretas. Entregar sexta" });
  const antes = chamadas.length;
  pedido = await pedidos.gerar("c1", "u1", { conversaId });
  assert.equal(chamadas.length, antes, "gerar não fala com o ERP");
  assert.equal(pedido.status, "rascunho");
  assert.deepEqual(pedido.itens.map((i) => [i.erpId, i.quantidade, i.valor]), [["11", 4, 49.9]]);
  assert.equal(pedido.total, 199.6);
  assert.equal(pedido.cliente.nome, "Ana", "o lead vale mais que o apelido do WhatsApp");
  assert.equal(pedido.cliente.documento, "12345678000195");
  assert.equal(pedido.cliente.erpId, "500");
  assert.deepEqual([...new Set(pedido.fontes.map((f) => f.origem))].sort(), ["erp", "rycs", "whatsapp"]);
  await assert.rejects(pedidos.gerar("c2", "u2", { conversaId }), /não encontrada/);
  await assert.rejects(pedidos.gerar("c2", "u2", { leadId: "l1" }), /não encontrado/);
  assert.equal(pedidos.pedidoDe("c2", pedido.id), undefined);
});

test("preço vem do catálogo e o dado do cliente só vale se ele escreveu", () => {
  const prod = [{ externoId: "11", nome: "Camiseta", preco: 49.9 }];
  const r = pedidos.normalizarLeitura({ itens: [{ produto: 1, quantidade: 2, mensagem: 1, valor: 1 }, { produto: 9, quantidade: 1, mensagem: 1 }, { produto: 1, quantidade: 0, mensagem: 1 }], cliente: { nome: "Inventado", documento: "11122233344", email: "", endereco: "Rua A, 10" }, observacoes: "" },
    [{ id: "m", direcao: "recebida", texto: "Camiseta na Rua A, 10" }], prod);
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].produto.preco, 49.9);
  assert.deepEqual(r.cliente, { endereco: { valor: "Rua A, 10" } });
});

test("sem aprovação não vai ao ERP; aprovado vai uma vez, mesmo com dois cliques", async () => {
  await assert.rejects(pedidos.enviarAoErp("c1", pedido.id), /Aprove/);
  pedidos.aprovar("c1", pedido.id, "u1");
  assert.throws(() => pedidos.editar("c1", pedido.id, { desconto: 10 }), /não pode mais/);
  chamadas = [];
  rede = async ({ corpo }) => {
    const b = JSON.parse(corpo);
    await new Promise((r) => setTimeout(r, 20));
    if (b.call === "ListarContasCorrentes") return { json: { ListarContasCorrentes: [{ nCodCC: 7, inativo: "N" }] } };
    if (b.call === "IncluirPedido") return { json: { codigo_pedido: 900, numero_pedido: "15" } };
    return { json: {} };
  };
  const r = await Promise.allSettled([pedidos.enviarAoErp("c1", pedido.id), pedidos.enviarAoErp("c1", pedido.id)]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  const incluir = chamadas.filter((c) => JSON.parse(c.corpo).call === "IncluirPedido");
  assert.equal(incluir.length, 1);
  const p = JSON.parse(incluir[0].corpo).param[0];
  assert.equal(p.cabecalho.codigo_cliente, 500, "usa o cliente que já existe no ERP");
  assert.equal(p.det[0].produto.valor_unitario, 49.9);
  assert.ok(p.cabecalho.codigo_pedido_integracao.length <= 20);
  const f = pedidos.pedidoDe("c1", pedido.id);
  assert.deepEqual([f.status, f.erpNumero], ["enviado", "15"]);
  assert.ok(db.prepare("SELECT COUNT(*) n FROM lead_events WHERE leadId = 'l1' AND observacao LIKE 'Pedido%'").get().n >= 2);
  assert.throws(() => pedidos.cancelar("c1", pedido.id), /ainda não foi/);
  await assert.rejects(pedidos.enviarAoErp("c1", pedido.id, { reenviar: true }), /já está no ERP/);
});

test("recusa do ERP volta para edição; queda no meio pede conferência", async () => {
  const novo = async () => { const p = pedidos.criarManual("c1", "u1", { cliente: { nome: "Ana", erpId: "500" }, itens: [{ erpId: "11", nome: "Camiseta", quantidade: 1, valor: 10, origem: "erp" }] }); pedidos.aprovar("c1", p.id, "u1"); return p.id; };
  const a = await novo();
  rede = ({ corpo }) => (JSON.parse(corpo).call === "IncluirPedido" ? { status: 500, json: { faultstring: "ERROR: CFOP inválido" } } : { json: { ListarContasCorrentes: [{ nCodCC: 7 }] } });
  await assert.rejects(pedidos.enviarAoErp("c1", a), /CFOP/);
  assert.equal(pedidos.pedidoDe("c1", a).status, "erro");
  pedidos.editar("c1", a, { observacoes: "ok" });
  assert.equal(pedidos.pedidoDe("c1", a).status, "rascunho");

  const b = await novo();
  rede = ({ corpo }) => { if (JSON.parse(corpo).call === "IncluirPedido") throw new Error("caiu"); return { json: { ListarContasCorrentes: [{ nCodCC: 7 }] } }; };
  await assert.rejects(pedidos.enviarAoErp("c1", b));
  assert.equal(pedidos.pedidoDe("c1", b).status, "conferir");
  await assert.rejects(pedidos.enviarAoErp("c1", b), /Confira no ERP/);
});

test("Bling: renova o token uma vez só e guarda o novo", async () => {
  rede = ({ url }) => (url.includes("/oauth/token") ? { json: { access_token: "A1", refresh_token: "R1", expires_in: 1 } } : { json: { data: [] } });
  await erp.concluirBling("c2", "cod");
  await ate(() => erp.resumoErp("c2").ultimoSyncEm);
  let tokens = 0;
  rede = async ({ url }) => {
    if (url.includes("/oauth/token")) { tokens++; await new Promise((r) => setTimeout(r, 20)); return { json: { access_token: "A2", refresh_token: "R2", expires_in: 21600 } }; }
    if (url.includes("/pedidos/vendas")) return { json: { data: { id: 5 } } };
    return { json: { data: [] } };
  };
  db.prepare("UPDATE erp_conexoes SET sincronizandoDesde = NULL WHERE companyId = 'c2'").run();
  chamadas = [];
  const p = { id: "x", numero: 1, data: "2026-11-24", cliente: { nome: "Ana", erpId: "9" }, itens: [{ erpId: "3", nome: "A", unidade: "UN", quantidade: 1, valor: 2 }], desconto: 0, frete: 0 };
  await Promise.all([erp.enviarPedido("c2", p), erp.enviarPedido("c2", { ...p, id: "y" })]);
  assert.equal(tokens, 1);
  assert.equal(chamadas.filter((c) => c.url.includes("/pedidos/vendas")).every((c) => c.headers.Authorization === "Bearer A2"), true);
});

test("outro ERP: endereço exclusivo recebe catálogo; pedido sai assinado", async () => {
  await erp.conectarErp("c2", "generico", { url: "https://erp.exemplo.com/pedidos" });
  const r = erp.resumoErp("c2");
  assert.equal(r.produtos, 0, "trocar de ERP limpa o catálogo anterior");
  const segredo = r.urlEntrada.split("/").pop();
  assert.equal(erp.receberDoErp("erp_errado", { produtos: [] }), null);
  assert.deepEqual(erp.receberDoErp(segredo, { produtos: [{ id: 1, nome: "Mesa", preco: "300,00" }, { nome: "sem id" }], clientes: [{ id: 2, nome: "Bia" }] }), { produtos: 1, clientes: 1 });
  const p = pedidos.criarManual("c2", "u2", { cliente: { nome: "Bia" }, itens: [{ erpId: "1", nome: "Mesa", quantidade: 1, valor: 300, origem: "erp" }] });
  pedidos.aprovar("c2", p.id, "u2");
  await pedidos.enviarAoErp("c2", p.id);
  const [url, corpo, cab] = saidas.at(-1);
  assert.equal(url, "https://erp.exemplo.com/pedidos");
  assert.equal(cab["X-RYCS-Signature"], `sha256=${createHmac("sha256", r.segredo).update(corpo).digest("hex")}`);
  assert.equal(pedidos.pedidoDe("c2", p.id).erpNumero, "77");
  erp.desconectarErp("c2");
  assert.equal(erp.receberDoErp(segredo, { produtos: [] }), null);
});

test("catálogo junta ERP e serviços da RYCS", () => {
  const c = pedidos.catalogo("c1", "instala");
  assert.deepEqual([c[0].nome, c[0].preco, c[0].origem], ["Instalação", 1250.5, "rycs"]);
});

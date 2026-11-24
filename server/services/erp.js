// ERP da empresa: conexão, credenciais cifradas, cópia local de produtos e
// clientes (para o gerador de pedidos) e envio do pedido aprovado.
//
// Da base de clientes do ERP guardamos só nome, documento, telefone e e-mail:
// o que o pedido precisa. Uma empresa conecta um ERP por vez.
//
// Ambiente: BLING_CLIENT_ID e BLING_CLIENT_SECRET (só para o Bling).

import { randomBytes, timingSafeEqual } from "node:crypto";
import db, { agora } from "../db.js";
import { cifrar, decifrar } from "./meta.js";
import { notificar } from "../routes/notifications.js";
import { PROVEDORES, ErroErp, tokenBling, BLING_OAUTH } from "./erpProvedores.js";
import { ERPS, erpValido, validarCredenciais } from "../../shared/erp.js";
import { chaveTelefone } from "../../shared/canais.js";

const HORA = 60 * 60 * 1000;
const MAX_PAGINAS = 200;

db.exec(`
  CREATE TABLE IF NOT EXISTS erp_conexoes (
    companyId TEXT PRIMARY KEY,
    provedor TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativa',
    credenciais TEXT NOT NULL DEFAULT '',
    config TEXT NOT NULL DEFAULT '{}',
    segredoEntrada TEXT NOT NULL DEFAULT '',
    sincronizandoDesde INTEGER,
    ultimoSyncEm INTEGER,
    ultimoErro TEXT NOT NULL DEFAULT '',
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS erp_produtos (
    companyId TEXT NOT NULL,
    externoId TEXT NOT NULL,
    codigo TEXT NOT NULL DEFAULT '',
    nome TEXT NOT NULL,
    preco REAL NOT NULL DEFAULT 0,
    unidade TEXT NOT NULL DEFAULT 'UN',
    estoque REAL,
    atualizadoEm INTEGER NOT NULL,
    PRIMARY KEY (companyId, externoId)
  );
  CREATE TABLE IF NOT EXISTS erp_contatos (
    companyId TEXT NOT NULL,
    externoId TEXT NOT NULL,
    nome TEXT NOT NULL,
    documento TEXT NOT NULL DEFAULT '',
    telefone TEXT NOT NULL DEFAULT '',
    chaveTelefone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    atualizadoEm INTEGER NOT NULL,
    PRIMARY KEY (companyId, externoId)
  );
  CREATE INDEX IF NOT EXISTS idx_erp_contatos_tel ON erp_contatos(companyId, chaveTelefone);
`);
// Processo caiu no meio da sincronização: libera para a próxima.
db.prepare("UPDATE erp_conexoes SET sincronizandoDesde = NULL").run();

let pedir = (...a) => fetch(...a);
let enviar = null;
export function usarRede({ fetch: f, enviar: e } = {}) { if (f) pedir = f; enviar = e || null; }

const erro = (msg, http = 400) => Object.assign(new Error(msg), { validacao: true, http });
const linhaDe = db.prepare("SELECT * FROM erp_conexoes WHERE companyId = ?");
const ler = (j, p) => { try { return JSON.parse(j || "") ?? p; } catch { return p; } };
export const conexaoErp = (companyId) => linhaDe.get(companyId) || null;
const base = () => (process.env.PUBLIC_URL || process.env.FRONTEND_URL || "https://app.rycs.pro").replace(/\/+$/, "");

export const blingConfigurado = () => !!(process.env.BLING_CLIENT_ID && process.env.BLING_CLIENT_SECRET);

export function resumoErp(companyId) {
  const c = conexaoErp(companyId);
  const disponiveis = { bling: blingConfigurado(), tiny: true, omie: true, generico: true };
  if (!c) return { conectado: false, disponiveis };
  const n = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE companyId = ?`).get(companyId).n;
  const cred = c.provedor === "generico" ? ler(decifrar(c.credenciais), {}) : {};
  return {
    conectado: true, disponiveis, provedor: c.provedor, nome: ERPS[c.provedor]?.nome, status: c.status, sincronizando: !!c.sincronizandoDesde,
    ultimoSyncEm: c.ultimoSyncEm, ultimoErro: c.ultimoErro, produtos: n("erp_produtos"), contatos: n("erp_contatos"),
    ...(c.provedor === "generico" ? { urlEntrada: `${base()}/api/erp/in/${c.segredoEntrada}`, urlSaida: cred.url || "", segredo: cred.segredo || "" } : {}),
  };
}

function gravar(companyId, provedor, cred, segredoEntrada = "") {
  const t = agora();
  db.transaction(() => {
    const antiga = conexaoErp(companyId);
    // Trocou de ERP: o catálogo do anterior não vale mais.
    if (antiga && antiga.provedor !== provedor) limparDados(companyId);
    db.prepare(`INSERT INTO erp_conexoes (companyId, provedor, credenciais, segredoEntrada, criadoEm, atualizadoEm) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(companyId) DO UPDATE SET provedor = excluded.provedor, status = 'ativa', credenciais = excluded.credenciais, segredoEntrada = excluded.segredoEntrada,
        ultimoErro = '', config = CASE WHEN erp_conexoes.provedor = excluded.provedor THEN erp_conexoes.config ELSE '{}' END, atualizadoEm = excluded.atualizadoEm`)
      .run(companyId, provedor, cifrar(JSON.stringify(cred)), segredoEntrada, t, t);
  })();
}

function limparDados(companyId) {
  db.prepare("DELETE FROM erp_produtos WHERE companyId = ?").run(companyId);
  db.prepare("DELETE FROM erp_contatos WHERE companyId = ?").run(companyId);
}

export async function conectarErp(companyId, provedor, dados) {
  const e = validarCredenciais(provedor, dados);
  if (e) throw erro(e);
  const cred = Object.fromEntries(ERPS[provedor].campos.map((c) => [c.chave, String(dados[c.chave] || "").trim()]));
  let segredoEntrada = "";
  if (provedor === "generico") {
    const atual = conexaoErp(companyId);
    const mesma = atual?.provedor === "generico";
    cred.segredo = (mesma && ler(decifrar(atual.credenciais), {}).segredo) || randomBytes(24).toString("hex");
    segredoEntrada = (mesma && atual.segredoEntrada) || `erp_${randomBytes(24).toString("hex")}`;
  }
  try { await PROVEDORES[provedor].testar({ cred, config: {}, pedir, enviar }); }
  catch (x) { throw x.erp ? erro(`${ERPS[provedor].nome}: ${x.message}`, 422) : x; }
  gravar(companyId, provedor, cred, segredoEntrada);
  sincronizarEmSegundoPlano(companyId);
  return resumoErp(companyId);
}

export function desconectarErp(companyId) {
  db.transaction(() => { limparDados(companyId); db.prepare("DELETE FROM erp_conexoes WHERE companyId = ?").run(companyId); })();
}

// ── Bling: login e renovação ──────────────────────────────────────────────

export function urlBling(state) {
  const u = new URL(`${BLING_OAUTH()}/authorize`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env.BLING_CLIENT_ID || "");
  u.searchParams.set("state", state);
  return u.toString();
}
export async function concluirBling(companyId, code) {
  gravar(companyId, "bling", await tokenBling(pedir, { grant_type: "authorization_code", code }));
  sincronizarEmSegundoPlano(companyId);
}

const renovando = new Map();
async function credenciaisValidas(c) {
  const cred = ler(decifrar(c.credenciais), {});
  if (c.provedor !== "bling" || (cred.expiraEm || 0) > Date.now() + 5 * 60 * 1000) return cred;
  // O refresh do Bling vale uma vez: duas renovações juntas derrubariam o acesso.
  if (!renovando.has(c.companyId)) {
    renovando.set(c.companyId, tokenBling(pedir, { grant_type: "refresh_token", refresh_token: cred.refreshToken })
      .then((novo) => {
        const n = { ...novo, refreshToken: novo.refreshToken || cred.refreshToken };
        db.prepare("UPDATE erp_conexoes SET credenciais = ?, atualizadoEm = ? WHERE companyId = ?").run(cifrar(JSON.stringify(n)), agora(), c.companyId);
        return n;
      }).finally(() => renovando.delete(c.companyId)));
  }
  return renovando.get(c.companyId);
}

async function contexto(companyId) {
  const c = conexaoErp(companyId);
  if (!c) throw erro("Conecte o ERP em Leads → Integrações.", 409);
  return { c, provedor: PROVEDORES[c.provedor], ctx: { cred: await credenciaisValidas(c), config: ler(c.config, {}), pedir, enviar } };
}

function registrarErro(companyId, e) {
  db.prepare("UPDATE erp_conexoes SET ultimoErro = ?, status = CASE WHEN ? THEN 'expirada' ELSE status END, atualizadoEm = ? WHERE companyId = ?")
    .run(String(e?.message || e).slice(0, 300), e?.autorizacao ? 1 : 0, agora(), companyId);
}

// ── Produtos e clientes ───────────────────────────────────────────────────

const upProduto = db.prepare(`INSERT INTO erp_produtos (companyId, externoId, codigo, nome, preco, unidade, estoque, atualizadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(companyId, externoId) DO UPDATE SET codigo = excluded.codigo, nome = excluded.nome, preco = excluded.preco, unidade = excluded.unidade, estoque = excluded.estoque, atualizadoEm = excluded.atualizadoEm`);
const upContato = db.prepare(`INSERT INTO erp_contatos (companyId, externoId, nome, documento, telefone, chaveTelefone, email, atualizadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(companyId, externoId) DO UPDATE SET nome = excluded.nome, documento = excluded.documento, telefone = excluded.telefone, chaveTelefone = excluded.chaveTelefone, email = excluded.email, atualizadoEm = excluded.atualizadoEm`);
const txt = (v, max) => String(v ?? "").trim().slice(0, max);

function gravarProdutos(companyId, itens, t) {
  let n = 0;
  db.transaction(() => {
    for (const p of itens) {
      const externoId = txt(p.externoId, 80), nome = txt(p.nome, 250);
      if (!externoId || !nome) continue;
      const preco = Number(p.preco);
      upProduto.run(companyId, externoId, txt(p.codigo, 80), nome, Number.isFinite(preco) && preco > 0 ? preco : 0, txt(p.unidade, 10) || "UN", Number.isFinite(p.estoque) ? p.estoque : null, t);
      n++;
    }
  })();
  return n;
}
function gravarContatos(companyId, itens, t) {
  let n = 0;
  db.transaction(() => {
    for (const c of itens) {
      const externoId = txt(c.externoId, 80), nome = txt(c.nome, 200);
      if (!externoId || !nome) continue;
      upContato.run(companyId, externoId, nome, String(c.documento || "").replace(/\D/g, "").slice(0, 14), String(c.telefone || "").replace(/\D/g, "").slice(0, 15), chaveTelefone(c.telefone), txt(c.email, 160).toLowerCase(), t);
      n++;
    }
  })();
  return n;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export async function sincronizar(companyId) {
  const c0 = conexaoErp(companyId);
  if (!c0) throw erro("Conecte o ERP primeiro.", 409);
  const inicio = agora();
  if (!db.prepare("UPDATE erp_conexoes SET sincronizandoDesde = ? WHERE companyId = ? AND sincronizandoDesde IS NULL").run(inicio, companyId).changes) return { emAndamento: true };
  try {
    const { provedor, ctx } = await contexto(companyId);
    const total = { produtos: 0, contatos: 0 };
    for (const [tipo, gravarTipo, tabela] of [["produtos", gravarProdutos, "erp_produtos"], ["contatos", gravarContatos, "erp_contatos"]]) {
      if (!provedor[tipo]) continue;
      let completo = false;
      for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
        const { itens, fim } = await provedor[tipo](ctx, pagina);
        total[tipo] += gravarTipo(companyId, itens, agora());
        if (fim) { completo = true; break; }
        if (provedor.pausaMs) await esperar(provedor.pausaMs);
      }
      // Só some daqui o que o ERP confirmou que não existe mais (leitura inteira).
      if (completo) db.prepare(`DELETE FROM ${tabela} WHERE companyId = ? AND atualizadoEm < ?`).run(companyId, inicio);
    }
    db.prepare("UPDATE erp_conexoes SET ultimoSyncEm = ?, ultimoErro = '', status = 'ativa' WHERE companyId = ?").run(agora(), companyId);
    return total;
  } catch (e) {
    registrarErro(companyId, e);
    if (e?.autorizacao && c0.status !== "expirada") {
      const u = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(companyId);
      if (u) notificar(u.id, "integracao", "Reconecte o ERP", `O acesso da RYCS ao ${ERPS[c0.provedor]?.nome} foi recusado. Abra Leads → Integrações e conecte de novo.`);
    }
    throw e;
  } finally {
    db.prepare("UPDATE erp_conexoes SET sincronizandoDesde = NULL WHERE companyId = ?").run(companyId);
  }
}
export function sincronizarEmSegundoPlano(companyId) {
  if (conexaoErp(companyId)?.provedor === "generico") return;
  sincronizar(companyId).catch((e) => console.warn("[erp] sincronização:", companyId, e?.message));
}

// Entrada do ERP genérico: POST com { produtos: [...], clientes: [...] }.
export function receberDoErp(segredo, corpo) {
  const alvo = Buffer.from(String(segredo || ""));
  const c = db.prepare("SELECT * FROM erp_conexoes WHERE provedor = 'generico' AND segredoEntrada = ?").get(String(segredo || ""));
  if (!c || alvo.length < 20 || !timingSafeEqual(Buffer.from(c.segredoEntrada), alvo)) return null;
  const t = agora();
  const arr = (v) => (Array.isArray(v) ? v.slice(0, 2000) : []);
  const pega = (o, ...k) => k.map((x) => o?.[x]).find((x) => x != null && x !== "");
  const produtos = arr(corpo?.produtos || corpo?.products).map((p) => ({ externoId: pega(p, "id", "codigo", "sku"), codigo: pega(p, "codigo", "sku"), nome: pega(p, "nome", "descricao", "name"), preco: pega(p, "preco", "valor", "price"), unidade: pega(p, "unidade", "unit"), estoque: Number(pega(p, "estoque", "stock")) }));
  const clientes = arr(corpo?.clientes || corpo?.contatos || corpo?.customers).map((x) => ({ externoId: pega(x, "id", "codigo", "documento"), nome: pega(x, "nome", "razaoSocial", "name"), documento: pega(x, "documento", "cpfCnpj", "cpf_cnpj"), telefone: pega(x, "telefone", "celular", "phone"), email: pega(x, "email") }));
  const r = { produtos: gravarProdutos(c.companyId, produtos, t), clientes: gravarContatos(c.companyId, clientes, t) };
  db.prepare("UPDATE erp_conexoes SET ultimoSyncEm = ? WHERE companyId = ?").run(t, c.companyId);
  return r;
}

export function buscarProdutos(companyId, busca = "", limite = 30) {
  const termo = `%${String(busca).trim().toLowerCase()}%`;
  return db.prepare("SELECT externoId, codigo, nome, preco, unidade, estoque FROM erp_produtos WHERE companyId = ? AND (lower(nome) LIKE ? OR lower(codigo) LIKE ?) ORDER BY nome LIMIT ?").all(companyId, termo, termo, limite);
}
export function buscarContatos(companyId, busca = "", limite = 20) {
  const termo = `%${String(busca).trim().toLowerCase()}%`, n = String(busca).replace(/\D/g, "");
  return db.prepare(`SELECT externoId, nome, documento, telefone, email FROM erp_contatos WHERE companyId = ? AND (lower(nome) LIKE ? OR lower(email) LIKE ?${n.length >= 4 ? " OR documento LIKE ? OR telefone LIKE ?" : ""}) ORDER BY nome LIMIT ?`)
    .all(companyId, termo, termo, ...(n.length >= 4 ? [`%${n}%`, `%${n}%`] : []), limite);
}
// Cliente do ERP pelo documento, telefone ou e-mail (nunca só pelo nome).
export function contatoDoErp(companyId, { documento = "", telefone = "", email = "" }) {
  const doc = String(documento).replace(/\D/g, ""), chave = chaveTelefone(telefone), mail = String(email).trim().toLowerCase();
  const por = (cond, v) => (v ? db.prepare(`SELECT * FROM erp_contatos WHERE companyId = ? AND ${cond} = ? LIMIT 1`).get(companyId, v) : null);
  return por("documento", doc.length >= 11 ? doc : "") || por("chaveTelefone", chave) || por("email", mail) || null;
}

// Envia um pedido aprovado. O chamador (pedidos.js) garante que só vai uma vez.
export async function enviarPedido(companyId, pedido) {
  const { c, provedor, ctx } = await contexto(companyId);
  try {
    const p = { ...pedido, cliente: { ...pedido.cliente } };
    if (c.provedor === "omie" && p.itens.some((i) => !i.erpId)) throw new ErroErp("No Omie, todos os itens precisam ser do catálogo do ERP.");
    if (!p.cliente.erpId) {
      const achado = contatoDoErp(companyId, p.cliente);
      p.cliente.erpId = achado?.externoId || await provedor.criarContato(ctx, { ...p.cliente, ref: p.id });
      if (p.cliente.erpId && !achado) gravarContatos(companyId, [{ externoId: p.cliente.erpId, ...p.cliente }], agora());
    }
    let r;
    try { r = await provedor.criarPedido(ctx, p); }
    catch (e) { if (e?.incerto) e.pedidoIncerto = true; throw e; }
    return { ...r, clienteErpId: p.cliente.erpId || "" };
  } catch (e) {
    if (e?.autorizacao) registrarErro(companyId, e);
    throw e?.erp ? Object.assign(erro(`${ERPS[c.provedor].nome}: ${e.message}`, 422), { pedidoIncerto: !!e.pedidoIncerto }) : e;
  }
}

export function iniciarErp() {
  setInterval(() => {
    for (const c of db.prepare("SELECT companyId FROM erp_conexoes WHERE status = 'ativa' AND provedor != 'generico' AND COALESCE(ultimoSyncEm, 0) < ?").all(agora() - 6 * HORA)) sincronizarEmSegundoPlano(c.companyId);
  }, HORA).unref?.();
}
export { erpValido };

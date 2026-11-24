// Instagram da empresa pela API oficial, com o login do próprio Instagram
// (conta profissional). Directs e comentários chegam pelo mesmo webhook da
// Meta e caem na aba Leads → Instagram.
//
// Ambiente: INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET (produto "Instagram" do
// app da RYCS, "API com login do Instagram").

import db, { agora } from "../db.js";
import { graph, buscar, cifrar, decifrar, versaoGraph, ErroMeta } from "./meta.js";
import { notificar } from "../routes/notifications.js";
import {
  conexaoPorId, salvarConexao, marcarErroConexao, encerrarConexao, registrarMensagem, conversaDoUsuario, erroCanal, ler,
} from "./canais.js";
import { janelaAberta, bytes, LIMITE_TEXTO } from "../../shared/canais.js";

const DIA = 24 * 60 * 60 * 1000;
const API = () => `https://graph.instagram.com/${versaoGraph()}`;

export const ESCOPOS = ["instagram_business_basic", "instagram_business_manage_messages", "instagram_business_manage_comments"];
export const instagramConfigurado = () => !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);

export const redirectInstagram = () => `${(process.env.PUBLIC_URL || process.env.FRONTEND_URL || "https://app.rycs.pro").replace(/\/+$/, "")}/api/instagram/callback`;

export function urlLogin(state) {
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("client_id", process.env.INSTAGRAM_APP_ID || "");
  u.searchParams.set("redirect_uri", redirectInstagram());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", ESCOPOS.join(","));
  u.searchParams.set("state", state);
  return u.toString();
}

async function tokenCurto(code) {
  const r = await buscar("https://api.instagram.com/oauth/access_token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID, client_secret: process.env.INSTAGRAM_APP_SECRET,
      grant_type: "authorization_code", redirect_uri: redirectInstagram(), code: String(code).replace(/#_$/, ""),
    }).toString(),
  });
  const corpo = await r.json().catch(() => ({}));
  const d = Array.isArray(corpo?.data) ? corpo.data[0] : corpo;
  if (!r.ok || !d?.access_token) throw new ErroMeta(corpo?.error_message || corpo?.error?.message || "O Instagram não liberou o acesso.", corpo?.code, r.status);
  return d;
}

export async function concluirLogin({ companyId, userId, code }) {
  const curto = await tokenCurto(code);
  const longo = await graph("https://graph.instagram.com/access_token", { params: { grant_type: "ig_exchange_token", client_secret: process.env.INSTAGRAM_APP_SECRET, access_token: curto.access_token } });
  const token = longo.access_token;
  const eu = await graph(`${API()}/me`, { token, params: { fields: "user_id,id,username,name,profile_picture_url" } });
  const contaId = String(eu.user_id || curto.user_id || eu.id || "");
  if (!contaId) throw new ErroMeta("O Instagram não informou a conta.");
  const conexao = salvarConexao({
    companyId, canal: "instagram", externoId: contaId, contaId: String(eu.id || ""), nome: eu.username || "", foto: eu.profile_picture_url || "",
    token: cifrar(token), tokenExpiraEm: longo.expires_in ? agora() + Number(longo.expires_in) * 1000 : null, userId, dados: { nomePerfil: eu.name || "" },
  });
  try {
    await assinar(contaId, token);
  } catch (e) {
    encerrarConexao(conexao.id);
    throw e;
  }
  return conexaoPorId(conexao.id);
}

// "mentions" não existe em todo app; sem ele, seguem directs e comentários.
async function assinar(contaId, token) {
  const pedir = (campos) => graph(`${API()}/${contaId}/subscribed_apps`, { token, metodo: "POST", params: { subscribed_fields: campos } });
  try { await pedir("messages,messaging_postbacks,comments,mentions"); }
  catch (e) { if (e?.codigo !== 100) throw e; await pedir("messages,comments"); }
}

export async function desconectar(conexao) {
  if (conexao.token) await graph(`${API()}/${conexao.externoId}/subscribed_apps`, { token: decifrar(conexao.token), metodo: "DELETE" }).catch(() => null);
  encerrarConexao(conexao.id);
}

// ── Directs que já existiam (últimas conversas) ───────────────────────────

export async function importarRecentes(conexaoId) {
  const c = conexaoPorId(conexaoId);
  if (!c?.token) return 0;
  const token = decifrar(c.token);
  let n = 0;
  const lista = (await graph(`${API()}/me/conversations`, { token, params: { platform: "instagram", limit: 25 } })).data || [];
  for (const item of lista) {
    try {
      const conv = await graph(`${API()}/${item.id}`, { token, params: { fields: "messages{id,created_time,from,to,message}" } });
      const msgs = (conv.messages?.data || []).map((m) => ({ ...m, em: Date.parse(m.created_time) || 0 })).sort((a, b) => a.em - b.em);
      for (const m of msgs) {
        const minha = ehMinha(c, m.from?.id, m.from?.username);
        const outro = minha ? m.to?.data?.[0] : m.from;
        if (!outro?.id || !m.em) continue;
        const recente = m.em > agora() - DIA;
        if (registrarMensagem(c, {
          contato: outro.id, usuario: outro.username || "", externoId: m.id, direcao: minha ? "enviada" : "recebida",
          origem: recente ? (minha ? "celular" : "cliente") : "historico", em: m.em, tipo: m.message ? "texto" : "outro", texto: m.message || "",
        })?.nova) n++;
      }
    } catch (e) { console.warn("[canais] instagram histórico:", e?.message); }
  }
  return n;
}

// ── Avisos da Meta ────────────────────────────────────────────────────────

const ehMinha = (c, id, username) => [c.externoId, c.contaId].filter(Boolean).includes(String(id || "")) || (!!username && username === c.nome);

const conexaoDoAviso = (id) => db.prepare("SELECT * FROM canais_conexoes WHERE canal = 'instagram' AND status = 'ativa' AND (externoId = ? OR (contaId != '' AND contaId = ?))").get(String(id || ""), String(id || ""));

export function receberAviso(corpo) {
  if (corpo?.object !== "instagram") return 0;
  let n = 0;
  for (const entrada of corpo.entry || []) {
    const c = conexaoDoAviso(entrada.id);
    if (!c) continue;
    for (const e of entrada.messaging || []) {
      try { if (tratarDirect(c, e)) n++; } catch (err) { console.warn("[canais] direct:", err?.message); }
    }
    for (const m of entrada.changes || []) {
      try { if (tratarComentario(c, m)) n++; } catch (err) { console.warn("[canais] comentário:", err?.message); }
    }
  }
  return n;
}

const ANEXO = { image: "imagem", video: "video", audio: "audio", file: "documento", ig_reel: "video", reel: "video", story_mention: "outro", share: "outro" };
const ROTULO_ANEXO = { story_mention: "Mencionou você nos stories", share: "Compartilhou uma publicação", ig_reel: "Enviou um reel", reel: "Enviou um reel" };

function tratarDirect(c, e) {
  const m = e.message || (e.postback ? { mid: e.postback.mid, text: e.postback.title } : null);
  if (!m?.mid) return false;
  if (m.is_deleted) {
    return db.prepare("UPDATE canais_mensagens SET texto = '', tipo = 'outro', dados = '{}' WHERE externoId = ? AND companyId = ?").run(String(m.mid), c.companyId).changes > 0;
  }
  const minha = m.is_echo === true || ehMinha(c, e.sender?.id);
  const contato = String((minha ? e.recipient?.id : e.sender?.id) || "");
  if (!contato || ehMinha(c, contato)) return false;
  const anexo = (m.attachments || [])[0];
  const r = registrarMensagem(c, {
    contato, externoId: m.mid, direcao: minha ? "enviada" : "recebida", origem: minha ? "celular" : "cliente", em: Number(e.timestamp) || agora(), status: minha ? "sent" : "",
    tipo: anexo ? ANEXO[anexo.type] || "outro" : "texto", texto: m.text || (anexo ? ROTULO_ANEXO[anexo.type] || "" : ""),
    dados: anexo?.payload?.url ? { url: anexo.payload.url } : {},
  });
  if (r?.nova) buscarPerfil(c, r.conversaId, contato).catch(() => null);
  return !!r?.nova;
}

function tratarComentario(c, { field, value: v = {} }) {
  if (!["comments", "live_comments", "mentions"].includes(field)) return false;
  const comentarioId = String(v.id || v.comment_id || "");
  if (!comentarioId) return false;
  const dados = { comentarioId, midiaPublicacao: String(v.media?.id || v.media_id || "") };
  // Resposta da própria empresa a um comentário: entra na conversa do comentário original.
  if (ehMinha(c, v.from?.id, v.from?.username)) {
    const pai = v.parent_id && db.prepare(`SELECT k.contatoExterno FROM canais_mensagens m JOIN canais_conversas k ON k.id = m.conversaId
      WHERE m.externoId = ? AND k.conexaoId = ?`).get(String(v.parent_id), c.id);
    if (!pai) return false;
    return !!registrarMensagem(c, { conversaTipo: "comentario", contato: pai.contatoExterno, externoId: comentarioId, direcao: "enviada", origem: "celular", texto: v.text || "", dados, em: agora() })?.nova;
  }
  const contato = String(v.from?.id || v.from?.username || "");
  if (!contato) return false;
  return !!registrarMensagem(c, {
    conversaTipo: "comentario", contato, usuario: v.from?.username || "", midiaId: dados.midiaPublicacao, externoId: comentarioId,
    direcao: "recebida", origem: "cliente", texto: v.text || "", dados, em: agora(),
  })?.nova;
}

// Nome e @ de quem mandou o direct (o aviso só traz o id).
async function buscarPerfil(c, conversaId, igsid) {
  const v = db.prepare("SELECT usuario FROM canais_conversas WHERE id = ?").get(conversaId);
  if (!v || v.usuario) return;
  const p = await graph(`${API()}/${igsid}`, { token: decifrar(c.token), params: { fields: "name,username" } });
  if (p?.username || p?.name) db.prepare("UPDATE canais_conversas SET usuario = ?, nome = CASE WHEN nome = '' THEN ? ELSE nome END WHERE id = ?").run(p.username || "", p.name || "", conversaId);
}

// ── Responder ─────────────────────────────────────────────────────────────

// Direct: dentro de 24h da última mensagem da pessoa. Comentário: resposta
// pública, ou uma única mensagem privada em até 7 dias (regra da Meta).
export async function responder(user, conversaId, { texto, comentarioId = "", privado = false }) {
  const v = conversaDoUsuario(user, conversaId);
  if (!v || v.canal !== "instagram") throw erroCanal("Conversa não encontrada.", 404);
  const t = String(texto || "").trim();
  if (!t) throw erroCanal("Escreva a mensagem.");
  if (bytes(t) > LIMITE_TEXTO.instagram) throw erroCanal("Mensagem muito longa para o Instagram (máximo 1000 caracteres).");
  const c = conexaoPorId(v.conexaoId);
  if (c?.status !== "ativa") throw erroCanal("Este Instagram está desconectado. Conecte de novo para responder.", 409);
  const token = decifrar(c.token);
  try {
    if (v.tipo === "comentario") {
      const alvo = db.prepare(`SELECT externoId, em, dados FROM canais_mensagens WHERE conversaId = ? AND direcao = 'recebida'
        ${comentarioId ? "AND externoId = ?" : ""} ORDER BY em DESC LIMIT 1`).get(v.id, ...(comentarioId ? [String(comentarioId)] : []));
      if (!alvo) throw erroCanal("Comentário não encontrado.", 404);
      if (privado) {
        if (alvo.em < agora() - 7 * DIA) throw erroCanal("A Meta só permite mensagem privada até 7 dias depois do comentário.", 409);
        if (ler(alvo.dados, {}).privadaEm) throw erroCanal("A Meta só permite uma mensagem privada por comentário, e ela já foi enviada.", 409);
        const r = await graph(`${API()}/${c.externoId}/messages`, { token, metodo: "POST", dados: { recipient: { comment_id: alvo.externoId }, message: { text: t } } });
        db.prepare("UPDATE canais_mensagens SET dados = ? WHERE conversaId = ? AND externoId = ?").run(JSON.stringify({ ...ler(alvo.dados, {}), privadaEm: agora() }), v.id, alvo.externoId);
        registrarMensagem(c, { contato: r.recipient_id || v.contatoExterno, usuario: v.usuario, nome: v.nome, externoId: r.message_id, direcao: "enviada", origem: "rycs", texto: t, status: "sent", autorUserId: user.id, em: agora() });
        return { id: r.message_id };
      }
      const r = await graph(`${API()}/${alvo.externoId}/replies`, { token, metodo: "POST", dados: { message: t } });
      registrarMensagem(c, { conversaTipo: "comentario", contato: v.contatoExterno, externoId: r.id, direcao: "enviada", origem: "rycs", texto: t, status: "sent", autorUserId: user.id, em: agora(), dados: { comentarioId: r.id } });
      return { id: r.id };
    }
    if (!janelaAberta(v.ultimaRecebidaEm)) throw erroCanal("Passaram 24h desde a última mensagem da pessoa. Responda pelo aplicativo do Instagram: a mensagem aparece aqui.", 409);
    const r = await graph(`${API()}/${c.externoId}/messages`, { token, metodo: "POST", dados: { recipient: { id: v.contatoExterno }, message: { text: t } } });
    registrarMensagem(c, { contato: v.contatoExterno, externoId: r.message_id, direcao: "enviada", origem: "rycs", texto: t, status: "sent", autorUserId: user.id, em: agora() });
    return { id: r.message_id };
  } catch (e) {
    if (e instanceof ErroMeta && e.codigo === 190) marcarErroConexao(c.id, e.message, { expirou: true });
    throw e;
  }
}

// ── Renovação do token (vale 60 dias) ─────────────────────────────────────

export async function renovarTokens() {
  const t = agora();
  const lista = db.prepare(`SELECT * FROM canais_conexoes WHERE canal = 'instagram' AND status = 'ativa' AND tokenExpiraEm IS NOT NULL
    AND tokenExpiraEm < ? AND COALESCE(tokenRenovadoEm, 0) < ?`).all(t + 20 * DIA, t - DIA);
  for (const c of lista) {
    try {
      const r = await graph("https://graph.instagram.com/refresh_access_token", { params: { grant_type: "ig_refresh_token", access_token: decifrar(c.token) } });
      db.prepare("UPDATE canais_conexoes SET token = ?, tokenExpiraEm = ?, tokenRenovadoEm = ?, ultimoErro = '' WHERE id = ?")
        .run(cifrar(r.access_token), t + Number(r.expires_in || 0) * 1000, t, c.id);
    } catch (e) {
      const acabou = c.tokenExpiraEm < t || e?.codigo === 190;
      marcarErroConexao(c.id, e.message, { expirou: acabou });
      if (acabou) notificar(c.consentimentoUserId, "integracao", "Reconecte o Instagram", `O acesso da RYCS ao Instagram @${c.nome} expirou. Abra Leads → Instagram e conecte de novo.`);
    }
  }
  return lista.length;
}

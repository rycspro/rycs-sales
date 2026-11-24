// WhatsApp da empresa ou do vendedor pela API oficial da Meta.
//
// A conexão é o Cadastro Incorporado da Meta com coexistência: a pessoa lê um
// QR code no aplicativo WhatsApp Business e continua usando o celular; o que
// entra e o que sai pelo celular também aparece aqui. Não é automação do
// WhatsApp Web: aquilo viola os termos do WhatsApp e derruba o número do
// cliente.
//
// Ambiente: META_APP_ID, META_APP_SECRET e WHATSAPP_SIGNUP_CONFIG_ID
// (configuração "Cadastro Incorporado do WhatsApp" no app da RYCS).

import { randomInt } from "node:crypto";
import db, { agora } from "../db.js";
import { graph, buscar, cifrar, decifrar, versaoGraph, ErroMeta } from "./meta.js";
import { notificar } from "../routes/notifications.js";
import {
  conexaoPorExterno, conexaoPorId, salvarConexao, marcarErroConexao, encerrarConexao, registrarMensagem, atualizarStatus,
  conversaDoUsuario, erroCanal, ler, vendedorAprovado,
} from "./canais.js";
import { soDigitos, janelaAberta, LIMITE_TEXTO, mesmoTelefone } from "../../shared/canais.js";

const NUMERO_RYCS = () => process.env.WHATSAPP_PHONE_NUMBER_ID || "";

export const whatsappConfigurado = () => !!(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.WHATSAPP_SIGNUP_CONFIG_ID);

// Dados públicos que a tela usa para abrir a janela da Meta.
export const dadosLogin = () => (whatsappConfigurado()
  ? { configurada: true, appId: process.env.META_APP_ID, configId: process.env.WHATSAPP_SIGNUP_CONFIG_ID, versaoGraph: versaoGraph(), versaoFluxo: process.env.WHATSAPP_SIGNUP_VERSION || "v5" }
  : { configurada: false });

// ── Conectar ──────────────────────────────────────────────────────────────

export async function conectar({ user, companyId, sellerId = null, code, wabaId, phoneNumberId }) {
  if (!whatsappConfigurado()) throw erroCanal("A RYCS ainda está ativando esta integração com a Meta.", 503);
  if (!code || !wabaId) throw erroCanal("A Meta não devolveu os dados do número. Tente conectar de novo.");
  if (!/^\d{5,30}$/.test(String(wabaId)) || (phoneNumberId && !/^\d{5,30}$/.test(String(phoneNumberId)))) throw erroCanal("Dados do número inválidos.");
  if (sellerId && !vendedorAprovado(companyId, sellerId)) throw erroCanal("Você precisa estar aprovado nesta empresa para conectar o seu WhatsApp.", 403);

  const { access_token: token } = await graph("/oauth/access_token", { params: { client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, code } });
  if (!token) throw erroCanal("A Meta não liberou o acesso. Tente conectar de novo.", 502);

  // Os ids vêm do navegador: só valem se o token da própria pessoa enxerga o número.
  const lista = (await graph(`/${wabaId}/phone_numbers`, { token, params: { fields: "id,display_phone_number,verified_name,is_on_biz_app,platform_type", limit: 50 } })).data || [];
  const n = phoneNumberId ? lista.find((x) => String(x.id) === String(phoneNumberId)) : lista.length === 1 ? lista[0] : null;
  if (!n) throw erroCanal(lista.length > 1 ? "Esta conta tem mais de um número. Conecte de novo e escolha o número na janela da Meta." : "Não encontramos o número nesta conta da Meta.");
  if (String(n.id) === NUMERO_RYCS()) throw erroCanal("Este é o número oficial da RYCS e não pode ser conectado aqui.", 409);

  const coexistencia = n.is_on_biz_app === true;
  const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Grava antes de assinar os avisos: assim a primeira mensagem já encontra a conexão.
  const conexao = salvarConexao({
    companyId, sellerId, canal: "whatsapp", contaId: String(wabaId), externoId: String(n.id), nome: n.verified_name || "", numero: n.display_phone_number || "",
    token: cifrar(token), coexistencia, userId: user.id, dados: coexistencia || n.platform_type === "CLOUD_API" ? {} : { pin: cifrar(pin) },
  });
  try {
    await graph(`/${wabaId}/subscribed_apps`, { token, metodo: "POST" });
    if (!coexistencia && n.platform_type !== "CLOUD_API") await graph(`/${n.id}/register`, { token, metodo: "POST", dados: { messaging_product: "whatsapp", pin } });
  } catch (e) {
    encerrarConexao(conexao.id);
    throw e;
  }
  // Nomes e histórico só do número da empresa. No do vendedor, nada do que veio
  // antes da conexão é pedido à Meta.
  if (coexistencia && !sellerId) {
    for (const sync_type of ["smb_app_state_sync", "history"]) {
      try { await graph(`/${n.id}/smb_app_data`, { token, metodo: "POST", dados: { messaging_product: "whatsapp", sync_type } }); }
      catch (e) { marcarErroConexao(conexao.id, `Histórico não sincronizado: ${e.message}`); break; }
    }
  }
  return conexaoPorId(conexao.id);
}

export async function desconectar(conexao) {
  const outras = db.prepare("SELECT COUNT(*) AS n FROM canais_conexoes WHERE canal = 'whatsapp' AND contaId = ? AND id != ? AND status = 'ativa'").get(conexao.contaId, conexao.id).n;
  if (!outras && conexao.token) await graph(`/${conexao.contaId}/subscribed_apps`, { token: decifrar(conexao.token), metodo: "DELETE" }).catch(() => null);
  encerrarConexao(conexao.id);
}

// ── Avisos da Meta ────────────────────────────────────────────────────────

// Separa o que é do número da RYCS (caixa de entrada do admin, reativação,
// verificação) do que é dos números das empresas. Sem isso, o cliente de uma
// empresa apareceria na caixa da RYCS e poderia "descadastrar" alguém dela.
export function separarAviso(corpo) {
  if (corpo?.object !== "whatsapp_business_account") return { rycs: corpo, clientes: null };
  const meu = NUMERO_RYCS();
  const deCliente = (entrada, mudanca) => {
    const id = String(mudanca.value?.metadata?.phone_number_id || "");
    if (id) return meu ? id !== meu : !!conexaoPorExterno("whatsapp", id);
    return !!db.prepare("SELECT 1 FROM canais_conexoes WHERE canal = 'whatsapp' AND contaId != '' AND contaId IN (?, ?)")
      .get(String(entrada.id || ""), String(mudanca.value?.waba_info?.waba_id || ""));
  };
  const parte = (querCliente) => ({
    object: corpo.object,
    entry: (corpo.entry || []).map((e) => ({ ...e, changes: (e.changes || []).filter((m) => deCliente(e, m) === querCliente) })).filter((e) => e.changes.length),
  });
  return { rycs: parte(false), clientes: parte(true) };
}

const emMs = (t) => (Number(t) > 0 ? Number(t) * 1000 : agora());
const TIPO = { text: "texto", image: "imagem", audio: "audio", voice: "audio", video: "video", document: "documento", sticker: "figurinha", location: "localizacao", contacts: "contato", reaction: "reacao", button: "texto", interactive: "texto", media_placeholder: "outro" };

function conteudo(m) {
  const midia = m[m.type];
  const texto = m.type === "text" ? m.text?.body
    : m.type === "button" ? m.button?.text
      : m.type === "interactive" ? (m.interactive?.button_reply?.title || m.interactive?.list_reply?.title)
        : m.type === "reaction" ? m.reaction?.emoji
          : m.type === "location" ? [m.location?.name, m.location?.address].filter(Boolean).join(" — ")
            : midia?.caption || midia?.filename || "";
  return {
    tipo: TIPO[m.type] || "outro", texto: texto || "",
    dados: midia?.id ? { midiaId: String(midia.id), mime: midia.mime_type || "", arquivo: midia.filename || "" } : {},
  };
}

export function receberAviso(corpo) {
  if (corpo?.object !== "whatsapp_business_account") return 0;
  let n = 0;
  for (const entrada of corpo.entry || []) for (const mudanca of entrada.changes || []) {
    try { n += tratarMudanca(entrada, mudanca); }
    catch (e) { console.warn("[canais] whatsapp:", mudanca?.field, e?.message); }
  }
  return n;
}

function tratarMudanca(entrada, { field, value: v = {} }) {
  if (field === "account_update") return contaMudou(String(v.waba_info?.waba_id || entrada.id || ""), v.event);
  const conexao = conexaoPorExterno("whatsapp", v.metadata?.phone_number_id);
  if (!conexao || conexao.status === "desconectada") return 0;
  let n = 0;
  const grava = (m) => { if (registrarMensagem(conexao, m)?.nova) n++; };

  if (field === "messages") {
    const nomes = new Map();
    for (const c of v.contacts || []) for (const k of [c.wa_id, c.user_id]) if (k) nomes.set(String(k), c.profile?.name || "");
    for (const m of v.messages || []) {
      if (!m?.id || m.group_id) continue; // grupo não é atendimento de lead
      const tel = soDigitos(m.from);
      grava({ contato: tel || m.from_user_id, contatoAlternativo: m.from_user_id || "", telefone: tel, nome: nomes.get(String(m.from)) || nomes.get(String(m.from_user_id)) || "",
        externoId: m.id, direcao: "recebida", origem: "cliente", em: emMs(m.timestamp), ...conteudo(m) });
    }
    for (const s of v.statuses || []) {
      if (!s?.id || !s.status) continue;
      const erro = (s.errors || []).map((e) => [e.code, e.title || e.message].filter(Boolean).join(" ")).join("; ");
      if (atualizarStatus(conexao, s.id, s.status, erro)) n++;
    }
  } else if (field === "smb_message_echoes") {
    for (const m of v.message_echoes || []) {
      if (!m?.id || m.group_id) continue;
      const tel = soDigitos(m.to);
      grava({ contato: tel || m.to_user_id, contatoAlternativo: m.to_user_id || "", telefone: tel, externoId: m.id, direcao: "enviada", origem: "celular", em: emMs(m.timestamp), status: "sent", ...conteudo(m) });
    }
  } else if (field === "history" && !conexao.sellerId) {
    const meu = soDigitos(v.metadata?.display_phone_number || conexao.numero);
    for (const bloco of v.history || []) for (const t of bloco.threads || []) {
      const tel = soDigitos(t.id || t.context?.wa_id);
      const alternativo = String(t.context?.user_id || "");
      for (const m of t.messages || []) {
        if (!m?.id) continue;
        const minha = mesmoTelefone(m.from, meu) || (!m.from && !m.from_user_id);
        grava({ contato: tel || alternativo, contatoAlternativo: alternativo, telefone: tel, nome: "", usuario: t.context?.username || "",
          externoId: m.id, direcao: minha ? "enviada" : "recebida", origem: "historico", em: emMs(m.timestamp), status: minha ? "sent" : "", ...conteudo(m) });
      }
    }
  } else if (field === "smb_app_state_sync" && !conexao.sellerId) {
    // Da agenda do celular aproveitamos só o nome de quem já tem conversa.
    for (const s of v.state_sync || []) {
      const c = s.contact || {};
      const nome = c.full_name || c.first_name || "", tel = soDigitos(c.phone_number);
      if (s.action !== "add" || !nome || !tel) continue;
      db.prepare("UPDATE canais_conversas SET nome = ? WHERE conexaoId = ? AND nome = '' AND telefone LIKE ?").run(nome, conexao.id, `%${tel.slice(-8)}`);
    }
  }
  return n;
}

function contaMudou(wabaId, evento) {
  if (!["PARTNER_REMOVED", "ACCOUNT_OFFBOARDED", "ACCOUNT_DELETED", "DISABLED_UPDATE"].includes(evento)) return 0;
  const linhas = db.prepare("SELECT * FROM canais_conexoes WHERE canal = 'whatsapp' AND contaId = ? AND status = 'ativa'").all(wabaId);
  for (const c of linhas) {
    marcarErroConexao(c.id, "A conexão foi encerrada no WhatsApp. Conecte de novo.", { expirou: true });
    notificar(c.consentimentoUserId, "integracao", "WhatsApp desconectado", `O número ${c.numero || c.nome} foi desconectado pela Meta ou pelo aplicativo. Abra Leads → WhatsApp e conecte de novo.`);
  }
  return linhas.length;
}

// ── Responder ─────────────────────────────────────────────────────────────

export async function enviarTexto(user, conversaId, texto) {
  const v = conversaDoUsuario(user, conversaId);
  if (!v || v.canal !== "whatsapp") throw erroCanal("Conversa não encontrada.", 404);
  // A empresa lê a conversa do vendedor com o lead dela, mas quem responde pelo
  // número pessoal é só o dono do número.
  if (v.sellerId && user.role !== "vendedor") throw erroCanal("Este número é do profissional: só o dono do número responde por ele.", 403);
  const t = String(texto || "").trim();
  if (!t) throw erroCanal("Escreva a mensagem.");
  if (t.length > LIMITE_TEXTO.whatsapp) throw erroCanal(`Mensagem muito longa (máximo ${LIMITE_TEXTO.whatsapp} caracteres).`);
  if (!janelaAberta(v.ultimaRecebidaEm)) throw erroCanal("Passaram 24h desde a última mensagem do cliente. Responda pelo aplicativo do WhatsApp no celular: a mensagem aparece aqui.", 409);
  const destino = v.telefone || (/^\d+$/.test(v.contatoExterno) ? v.contatoExterno : "");
  if (!destino) throw erroCanal("O WhatsApp não informou o número deste contato. Responda pelo celular.", 409);
  const conexao = conexaoPorId(v.conexaoId);
  if (conexao?.status !== "ativa") throw erroCanal("Este número está desconectado. Conecte de novo para responder.", 409);
  try {
    const r = await graph(`/${conexao.externoId}/messages`, { token: decifrar(conexao.token), metodo: "POST",
      dados: { messaging_product: "whatsapp", recipient_type: "individual", to: destino, type: "text", text: { body: t } } });
    const externoId = r.messages?.[0]?.id;
    registrarMensagem(conexao, { contato: v.contatoExterno, contatoAlternativo: v.contatoAlternativo, telefone: v.telefone, externoId, direcao: "enviada", origem: "rycs", tipo: "texto", texto: t, status: "sent", autorUserId: user.id, em: agora() });
    return { id: externoId };
  } catch (e) {
    if (e instanceof ErroMeta && e.codigo === 190) marcarErroConexao(conexao.id, e.message, { expirou: true });
    throw e;
  }
}

// ── Mídia ─────────────────────────────────────────────────────────────────

const MAX_MIDIA = 25 * 1024 * 1024;
const HOSTS = /(^|\.)(fbsbx\.com|facebook\.com|fbcdn\.net|whatsapp\.net|cdninstagram\.com)$/i;
export function hostDaMeta(url) {
  try { const u = new URL(url); return u.protocol === "https:" && HOSTS.test(u.hostname); } catch { return false; }
}

// Foto, áudio, vídeo ou documento de uma mensagem, buscado na Meta na hora.
export async function baixarMidia(user, mensagemId) {
  const m = db.prepare("SELECT * FROM canais_mensagens WHERE id = ?").get(String(mensagemId || ""));
  const v = m && conversaDoUsuario(user, m.conversaId);
  const d = m ? ler(m.dados, {}) : {};
  if (!v || !(d.midiaId || d.url)) throw erroCanal("Mídia não encontrada.", 404);
  const conexao = conexaoPorId(v.conexaoId);
  if (!conexao?.token) throw erroCanal("A conta está desconectada.", 409);
  const token = decifrar(conexao.token);
  let url = d.url, mime = d.mime || "", headers = {};
  if (d.midiaId) {
    const info = await graph(`/${d.midiaId}`, { token });
    if (Number(info.file_size) > MAX_MIDIA) throw erroCanal("Arquivo grande demais para abrir aqui. Veja pelo celular.", 413);
    url = info.url; mime = info.mime_type || mime; headers = { Authorization: `Bearer ${token}` };
  }
  if (!hostDaMeta(url)) throw erroCanal("Endereço da mídia inválido.", 502);
  const r = await buscar(url, { headers, redirect: "error" });
  if (!r.ok) throw erroCanal("A Meta não entregou este arquivo. Ele pode ter expirado.", 502);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_MIDIA) throw erroCanal("Arquivo grande demais para abrir aqui. Veja pelo celular.", 413);
  mime = String(mime || r.headers?.get?.("content-type") || "application/octet-stream").split(";")[0].trim().toLowerCase();
  return { buf, mime, arquivo: String(d.arquivo || "").replace(/[^\w.\- ]+/g, "_").slice(0, 80) };
}

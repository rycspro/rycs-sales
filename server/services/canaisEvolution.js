// WhatsApp pessoal (ou Business) do profissional pela Evolution API (Baileys).
//
// Cada profissional pode conectar o próprio WhatsApp escaneando um QR Code.
// A Evolution API roda como microsserviço isolado (docker-compose.evolution.yml)
// e este arquivo faz a ponte entre ela e as tabelas canais_* da RYCS.
//
// NÃO usa tokens, credenciais ou endpoints da integração oficial da Meta.
// O canal é "evolution" (não "whatsapp") para nunca conflitar com a API oficial.
//
// Ambiente: EVOLUTION_API_URL, EVOLUTION_API_KEY

import db, { uid, agora } from "../db.js";
import {
  conexaoPorExterno, conexaoPorId, salvarConexao, marcarErroConexao,
  encerrarConexao, registrarMensagem, atualizarStatus, conversaDoUsuario,
  erroCanal, vendedorAprovado,
} from "./canais.js";
import { soDigitos } from "../../shared/canais.js";

// ── Configuração ─────────────────────────────────────────────────────────

const BASE_URL = () => (process.env.EVOLUTION_API_URL || "http://localhost:8080").replace(/\/+$/, "");
const API_KEY = () => process.env.EVOLUTION_API_KEY || "";

export const evolutionConfigurada = () => !!(BASE_URL() && API_KEY());

// ── HTTP para a Evolution API ────────────────────────────────────────────

async function evo(caminho, { metodo = "GET", dados = null, timeout = 15_000 } = {}) {
  const url = `${BASE_URL()}${caminho}`;
  const opts = {
    method: metodo,
    headers: { "Content-Type": "application/json", apikey: API_KEY() },
    signal: AbortSignal.timeout(timeout),
  };
  if (dados) opts.body = JSON.stringify(dados);
  const r = await fetch(url, opts);
  const corpo = await r.text();
  if (!r.ok) {
    const msg = (() => { try { return JSON.parse(corpo)?.message || corpo; } catch { return corpo; } })();
    throw erroCanal(`Evolution API: ${msg}`, r.status >= 500 ? 502 : 400);
  }
  try { return JSON.parse(corpo); } catch { return corpo; }
}

// ── Instância por profissional ───────────────────────────────────────────

function nomeInstancia(sellerId) { return `rycs_${sellerId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60); }

export async function criarInstancia(sellerId) {
  const nome = nomeInstancia(sellerId);
  // Tenta criar; se já existe, a Evolution retorna a instância existente.
  const r = await evo("/instance/create", {
    metodo: "POST",
    dados: {
      instanceName: nome,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      reject_call: false,
      always_online: false,
      groups_ignore: true,
      read_messages: false,
      read_status: false,
      sync_full_history: false,
    },
  });
  return { instanceName: r.instance?.instanceName || nome, instanceId: r.instance?.instanceId || "", hash: r.hash || "" };
}

export async function buscarQrCode(sellerId) {
  const nome = nomeInstancia(sellerId);
  try {
    const r = await evo(`/instance/connect/${nome}`);
    return { base64: r.base64 || "", code: r.code || "", pairingCode: r.pairingCode || "" };
  } catch (e) {
    // Se instância não existe, criar e tentar de novo.
    if (/not found|instance not/i.test(e.message)) {
      await criarInstancia(sellerId);
      const r = await evo(`/instance/connect/${nome}`);
      return { base64: r.base64 || "", code: r.code || "", pairingCode: r.pairingCode || "" };
    }
    throw e;
  }
}

export async function statusInstancia(sellerId) {
  const nome = nomeInstancia(sellerId);
  try {
    const r = await evo(`/instance/connectionState/${nome}`);
    return { state: r.instance?.state || r.state || "close", nome };
  } catch { return { state: "close", nome }; }
}

export async function desconectarInstancia(sellerId) {
  const nome = nomeInstancia(sellerId);
  try { await evo(`/instance/logout/${nome}`, { metodo: "DELETE" }); } catch { /* ok se já desconectado */ }
}

export async function excluirInstancia(sellerId) {
  const nome = nomeInstancia(sellerId);
  try { await evo(`/instance/delete/${nome}`, { metodo: "DELETE" }); } catch { /* ok */ }
}

// ── Conectar / Desconectar ───────────────────────────────────────────────

export async function conectar({ user, companyId, sellerId }) {
  if (!evolutionConfigurada()) throw erroCanal("A integração WhatsApp pessoal ainda não foi ativada.", 503);
  if (!sellerId) throw erroCanal("Apenas profissionais podem conectar o WhatsApp pessoal.");
  if (!vendedorAprovado(companyId, sellerId)) throw erroCanal("Você precisa estar aprovado nesta empresa.", 403);

  // Verifica se já tem conexão Evolution ativa para este vendedor.
  const existente = db.prepare("SELECT * FROM canais_conexoes WHERE canal = 'evolution' AND sellerId = ? AND status = 'ativa'").get(sellerId);
  if (existente) throw erroCanal("Você já tem um WhatsApp pessoal conectado. Desconecte o atual antes de conectar outro.", 409);

  const instancia = await criarInstancia(sellerId);
  const qr = await buscarQrCode(sellerId);

  // Grava a conexão como "aguardando_qr" — o webhook de CONNECTION_UPDATE muda para "ativa".
  const conexao = salvarConexao({
    companyId, sellerId, canal: "evolution",
    contaId: instancia.instanceName,
    externoId: instancia.instanceName,
    nome: "", numero: "",
    token: instancia.hash || API_KEY(),
    coexistencia: false,
    userId: user.id,
    dados: { instanceId: instancia.instanceId },
  });
  // Marca como aguardando QR Code.
  db.prepare("UPDATE canais_conexoes SET status = 'aguardando_qr', atualizadoEm = ? WHERE id = ?").run(agora(), conexao.id);

  return { id: conexao.id, qrCode: qr.base64, code: qr.code };
}

export async function reconectar(conexao) {
  if (conexao.canal !== "evolution") throw erroCanal("Essa conexão não é do WhatsApp pessoal.");
  const qr = await buscarQrCode(conexao.sellerId);
  db.prepare("UPDATE canais_conexoes SET status = 'aguardando_qr', ultimoErro = '', atualizadoEm = ? WHERE id = ?").run(agora(), conexao.id);
  return { id: conexao.id, qrCode: qr.base64, code: qr.code };
}

export async function desconectar(conexao) {
  if (conexao.canal !== "evolution") throw erroCanal("Essa conexão não é do WhatsApp pessoal.");
  await desconectarInstancia(conexao.sellerId);
  encerrarConexao(conexao.id);
}

export async function excluir(conexao) {
  if (conexao.canal !== "evolution") throw erroCanal("Essa conexão não é do WhatsApp pessoal.");
  await excluirInstancia(conexao.sellerId);
  encerrarConexao(conexao.id);
}

// ── Enviar mensagem ──────────────────────────────────────────────────────

export async function enviarTexto(conexao, { para, texto }) {
  if (!texto?.trim()) throw erroCanal("A mensagem não pode ser vazia.");
  if (texto.length > 4096) throw erroCanal("A mensagem é longa demais (máximo 4.096 caracteres).");
  const nome = conexao.contaId;
  const numero = soDigitos(para);
  if (!numero || numero.length < 10) throw erroCanal("Número de telefone inválido.");

  const r = await evo(`/message/sendText/${nome}`, {
    metodo: "POST",
    dados: { number: numero, text: texto },
  });
  return { id: r.key?.id || uid(), remoteJid: r.key?.remoteJid || "" };
}

export async function enviarMidia(conexao, { para, tipo, url, caption, fileName }) {
  const nome = conexao.contaId;
  const numero = soDigitos(para);
  if (!numero || numero.length < 10) throw erroCanal("Número de telefone inválido.");

  const mediaType = tipo === "imagem" ? "image" : tipo === "video" ? "video" : tipo === "audio" ? "audio" : "document";
  const r = await evo(`/message/sendMedia/${nome}`, {
    metodo: "POST",
    dados: { number: numero, mediatype: mediaType, media: url, caption: caption || "", fileName: fileName || "" },
  });
  return { id: r.key?.id || uid(), remoteJid: r.key?.remoteJid || "" };
}

// ── Webhook da Evolution API ─────────────────────────────────────────────

export function receberWebhook(corpo) {
  if (!corpo?.instance) return 0;
  const evento = corpo.event;
  const nomeInstancia = corpo.instance;

  // Localiza a conexão por contaId (que é o instanceName).
  const conexao = db.prepare("SELECT * FROM canais_conexoes WHERE canal = 'evolution' AND contaId = ? AND status != 'desconectada'").get(nomeInstancia);
  if (!conexao) return 0;

  let n = 0;
  try {
    if (evento === "connection.update") n += tratarConexao(conexao, corpo.data);
    else if (evento === "qrcode.updated") n += tratarQrCode(conexao, corpo.data);
    else if (evento === "messages.upsert") n += tratarMensagens(conexao, corpo.data);
    else if (evento === "messages.update") n += tratarAtualizacao(conexao, corpo.data);
    else if (evento === "send.message") n += tratarEnviada(conexao, corpo.data);
  } catch (e) { console.warn("[evolution]", evento, e?.message); }
  return n;
}

function tratarConexao(conexao, data) {
  const state = data?.state || data?.status;
  if (!state) return 0;
  const t = agora();

  if (state === "open" || state === "connected") {
    // Extrai o número do jid da instância.
    const jid = data?.ownerJid || data?.wuid || "";
    const numero = soDigitos(jid.split("@")[0] || "");
    db.prepare(`UPDATE canais_conexoes SET status = 'ativa', numero = CASE WHEN ? != '' THEN ? ELSE numero END,
      nome = CASE WHEN nome = '' AND ? != '' THEN ? ELSE nome END, ultimoErro = '', atualizadoEm = ? WHERE id = ?`)
      .run(numero, numero, numero, numero, t, conexao.id);
    return 1;
  }
  if (state === "close" || state === "disconnected" || state === "refused") {
    const motivo = data?.statusReason || "";
    db.prepare("UPDATE canais_conexoes SET status = 'desconectada', ultimoErro = ?, atualizadoEm = ? WHERE id = ?")
      .run(String(motivo).slice(0, 300), t, conexao.id);
    return 1;
  }
  if (state === "connecting") {
    db.prepare("UPDATE canais_conexoes SET status = 'reconectando', atualizadoEm = ? WHERE id = ?").run(t, conexao.id);
    return 1;
  }
  return 0;
}

function tratarQrCode(conexao, data) {
  // Atualiza o QR Code guardado nos dados da conexão para o frontend buscar.
  const qr = data?.qrcode || data?.base64 || "";
  if (!qr) return 0;
  const t = agora();
  const dadosAtuais = (() => { try { return JSON.parse(conexao.dados || "{}"); } catch { return {}; } })();
  dadosAtuais.qrCode = qr;
  dadosAtuais.qrCodeEm = t;
  db.prepare("UPDATE canais_conexoes SET dados = ?, status = 'aguardando_qr', atualizadoEm = ? WHERE id = ?")
    .run(JSON.stringify(dadosAtuais), t, conexao.id);
  return 1;
}

function tratarMensagens(conexao, data) {
  const msgs = Array.isArray(data) ? data : data?.messages || [data];
  let n = 0;
  for (const m of msgs) {
    if (!m?.key?.id) continue;
    // Ignora mensagens de grupo.
    if (m.key?.remoteJid?.includes("@g.us")) continue;
    // Ignora status/stories.
    if (m.key?.remoteJid === "status@broadcast") continue;

    const tel = soDigitos((m.key.remoteJid || "").split("@")[0]);
    const fromMe = m.key.fromMe === true;
    const { tipo, texto, dados } = extrairConteudo(m.message || m);

    const resultado = registrarMensagem(conexao, {
      contato: tel,
      telefone: tel,
      nome: m.pushName || "",
      externoId: m.key.id,
      direcao: fromMe ? "enviada" : "recebida",
      origem: fromMe ? "vendedor" : "cliente",
      em: m.messageTimestamp ? Number(m.messageTimestamp) * 1000 : agora(),
      tipo, texto, dados,
    });
    if (resultado?.nova) n++;
  }
  return n;
}

function tratarEnviada(conexao, data) {
  if (!data?.key?.id) return 0;
  if (data.key?.remoteJid?.includes("@g.us") || data.key?.remoteJid === "status@broadcast") return 0;
  const tel = soDigitos((data.key.remoteJid || "").split("@")[0]);
  const { tipo, texto, dados } = extrairConteudo(data.message || data);

  const resultado = registrarMensagem(conexao, {
    contato: tel, telefone: tel, nome: "",
    externoId: data.key.id,
    direcao: "enviada", origem: "vendedor",
    em: data.messageTimestamp ? Number(data.messageTimestamp) * 1000 : agora(),
    tipo, texto, dados,
  });
  return resultado?.nova ? 1 : 0;
}

function tratarAtualizacao(conexao, data) {
  const updates = Array.isArray(data) ? data : [data];
  let n = 0;
  for (const u of updates) {
    if (!u?.key?.id) continue;
    const status = u.update?.status;
    if (!status) continue;
    // Mapeia status numérico do Baileys para nomes usados pela RYCS.
    const mapa = { 1: "sent", 2: "delivered", 3: "read", 4: "played" };
    const nome = typeof status === "number" ? mapa[status] : String(status).toLowerCase();
    if (!nome) continue;
    if (atualizarStatus(conexao, u.key.id, nome, "")) n++;
  }
  return n;
}

// ── Extração de conteúdo ─────────────────────────────────────────────────

const TIPO_MAP = {
  conversation: "texto", extendedTextMessage: "texto",
  imageMessage: "imagem", videoMessage: "video", audioMessage: "audio",
  documentMessage: "documento", stickerMessage: "figurinha",
  locationMessage: "localizacao", contactMessage: "contato",
  reactionMessage: "reacao",
};

function extrairConteudo(msg) {
  if (!msg) return { tipo: "texto", texto: "", dados: {} };

  // Texto simples.
  if (msg.conversation) return { tipo: "texto", texto: msg.conversation, dados: {} };
  if (msg.extendedTextMessage?.text) return { tipo: "texto", texto: msg.extendedTextMessage.text, dados: {} };

  // Mídia.
  for (const [chave, tipo] of Object.entries(TIPO_MAP)) {
    const m = msg[chave];
    if (!m) continue;
    if (tipo === "texto") continue; // Já tratado acima.
    if (tipo === "reacao") return { tipo: "reacao", texto: m.text || "", dados: {} };
    if (tipo === "localizacao") return { tipo: "localizacao", texto: [m.name, m.address].filter(Boolean).join(" — "), dados: { lat: m.degreesLatitude, lng: m.degreesLongitude } };
    if (tipo === "contato") return { tipo: "contato", texto: m.displayName || "", dados: { vcard: m.vcard } };
    return {
      tipo,
      texto: m.caption || m.fileName || "",
      dados: { mime: m.mimetype || "", arquivo: m.fileName || "" },
    };
  }

  return { tipo: "texto", texto: "", dados: {} };
}

// ── Status / Info para o frontend ────────────────────────────────────────

export function dadosConexao(sellerId) {
  const conexao = db.prepare("SELECT * FROM canais_conexoes WHERE canal = 'evolution' AND sellerId = ? AND status != 'desconectada' ORDER BY criadoEm DESC LIMIT 1").get(sellerId);
  if (!conexao) return { conectada: false };
  const dados = (() => { try { return JSON.parse(conexao.dados || "{}"); } catch { return {}; } })();
  return {
    conectada: conexao.status === "ativa",
    id: conexao.id,
    status: conexao.status,
    numero: conexao.numero,
    nome: conexao.nome,
    qrCode: dados.qrCode || "",
    qrCodeEm: dados.qrCodeEm || null,
    ultimoErro: conexao.ultimoErro,
    criadoEm: conexao.criadoEm,
    atualizadoEm: conexao.atualizadoEm,
  };
}

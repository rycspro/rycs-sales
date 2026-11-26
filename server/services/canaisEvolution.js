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
  erroCanal,
} from "./canais.js";
import { soDigitos } from "../../shared/canais.js";

// ── Configuração ─────────────────────────────────────────────────────────

const BASE_URL = () => (process.env.EVOLUTION_API_URL || "http://localhost:8080").replace(/\/+$/, "");
const API_KEY = () => process.env.EVOLUTION_API_KEY || "";
// URL pública que a Evolution usa para entregar os webhooks ao backend.
const WEBHOOK_URL = () => process.env.EVOLUTION_WEBHOOK_URL || "";
const MAX_PILOTOS = 10;

export const evolutionConfigurada = () => !!(BASE_URL() && API_KEY());

// ── Feature flag (piloto) ───────────────────────────────────────────────

export function pilotoAutorizado(sellerId) {
  if (!sellerId) return false;
  return !!db.prepare("SELECT 1 FROM evolution_pilotos WHERE sellerId = ?").get(sellerId);
}

export function listarPilotos() {
  return db.prepare("SELECT p.*, s.nome AS nomeVendedor FROM evolution_pilotos p LEFT JOIN sellers s ON s.id = p.sellerId ORDER BY p.criadoEm DESC").all();
}

export function adicionarPiloto(sellerId, autorizadoPor) {
  const total = db.prepare("SELECT COUNT(*) AS n FROM evolution_pilotos").get().n;
  if (total >= MAX_PILOTOS) throw erroCanal(`Limite de ${MAX_PILOTOS} pilotos atingido. Remova um antes de adicionar.`);
  if (pilotoAutorizado(sellerId)) throw erroCanal("Este profissional já está autorizado.");
  db.prepare("INSERT INTO evolution_pilotos (sellerId, autorizadoPor, criadoEm) VALUES (?, ?, ?)").run(sellerId, autorizadoPor, agora());
}

export function removerPiloto(sellerId) {
  db.prepare("DELETE FROM evolution_pilotos WHERE sellerId = ?").run(sellerId);
}

// ── Consentimento ───────────────────────────────────────────────────────

export function registrarConsentimento(sellerId, companyId, texto, ip) {
  const id = uid();
  db.prepare("INSERT INTO evolution_consentimentos (id, sellerId, companyId, texto, ip, criadoEm) VALUES (?, ?, ?, ?, ?, ?)").run(id, sellerId, companyId, texto, ip || "", agora());
  return id;
}

export function consentimentoExiste(sellerId, companyId) {
  return !!db.prepare("SELECT 1 FROM evolution_consentimentos WHERE sellerId = ? AND companyId = ?").get(sellerId, companyId);
}

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
  const dados = {
    instanceName: nome,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    reject_call: false,
    always_online: false,
    groups_ignore: true,
    read_messages: false,
    read_status: false,
    sync_full_history: false,
  };
  // Webhook por-instância com o header apikey que o backend valida. Sem isso,
  // a Evolution entregaria sem o header e o webhook recusaria (401). base64
  // faz o QR Code chegar pronto; só assinamos os eventos que a RYCS trata.
  if (WEBHOOK_URL()) {
    dados.webhook = {
      url: WEBHOOK_URL(),
      byEvents: false,
      base64: true,
      headers: { apikey: API_KEY(), "Content-Type": "application/json" },
      events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE"],
    };
  }
  // Tenta criar; se já existe, a Evolution retorna a instância existente.
  const r = await evo("/instance/create", { metodo: "POST", dados });
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

export async function conectar({ user, sellerId, ip }) {
  if (!evolutionConfigurada()) throw erroCanal("A integração WhatsApp pessoal ainda não foi ativada.", 503);
  if (!sellerId) throw erroCanal("Apenas profissionais podem conectar o WhatsApp pessoal.");
  if (!pilotoAutorizado(sellerId)) throw erroCanal("Você ainda não foi autorizado para o piloto do WhatsApp pessoal. Fale com o administrador.", 403);
  // O WhatsApp pessoal é por profissional (um número atende várias empresas):
  // não se amarra a uma empresa. Cada mensagem recebida é roteada para a empresa
  // do lead correspondente. Por isso a conexão não exige escolher uma empresa.

  // Limita a 5 conexões ativas simultâneas por profissional.
  const ativas = db.prepare("SELECT COUNT(*) AS n FROM canais_conexoes WHERE canal = 'evolution' AND sellerId = ? AND status = 'ativa'").get(sellerId).n;
  if (ativas >= 5) throw erroCanal("Você atingiu o limite de 5 WhatsApps conectados. Desconecte um antes de conectar outro.", 409);

  // Registra consentimento (sem empresa: vale para todas as que o profissional atende).
  registrarConsentimento(sellerId, "", "Aceito conectar meu WhatsApp pessoal à RYCS para atendimento comercial. Entendo que esta é uma tecnologia não oficial.", ip);

  const instancia = await criarInstancia(sellerId);
  const qr = await buscarQrCode(sellerId);

  // Grava a conexão como "aguardando_qr" — o webhook de CONNECTION_UPDATE muda para "ativa".
  const conexao = salvarConexao({
    companyId: "", sellerId, canal: "evolution",
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
    // statusReason 401/403 = logout intencional; não reconectar.
    const intencional = /401|403|logout|banned/i.test(String(motivo));
    if (intencional) {
      db.prepare("UPDATE canais_conexoes SET status = 'desconectada', ultimoErro = ?, atualizadoEm = ? WHERE id = ?")
        .run(String(motivo).slice(0, 300), t, conexao.id);
    } else {
      db.prepare("UPDATE canais_conexoes SET status = 'reconectando', ultimoErro = ?, atualizadoEm = ? WHERE id = ?")
        .run(String(motivo).slice(0, 300), t, conexao.id);
      // Tenta reconectar automaticamente após 5 segundos.
      setTimeout(() => tentarReconectar(conexao.id), 5_000);
    }
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
    if (m.key?.remoteJid?.includes("@g.us")) continue;
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
    if (resultado?.nova) {
      n++;
      // Notifica o vendedor sobre nova mensagem recebida de lead.
      if (!fromMe && conexao.sellerId) {
        const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(conexao.sellerId);
        if (user) {
          const preview = String(texto || "").slice(0, 60) || "(mídia)";
          try { notificarVendedor(user.id, m.pushName || tel, preview); } catch {}
        }
      }
    }
  }
  return n;
}

async function notificarVendedor(userId, nome, preview) {
  try {
    const { notificar } = await import("../routes/notifications.js");
    notificar(userId, "mensagem", `WhatsApp: ${nome}`, preview);
  } catch {}
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
  if (!conexao) {
    // Conexão desconectada: retorna os dados para o frontend mostrar o histórico
    // e oferecer reconexão com contexto (número, nome, etc.).
    const desconectada = db.prepare("SELECT * FROM canais_conexoes WHERE canal = 'evolution' AND sellerId = ? AND status = 'desconectada' ORDER BY atualizadoEm DESC LIMIT 1").get(sellerId);
    if (!desconectada) return { conectada: false };
    return {
      conectada: false,
      id: desconectada.id,
      status: "desconectada",
      numero: desconectada.numero,
      nome: desconectada.nome,
      qrCode: "",
      qrCodeEm: null,
      ultimoErro: desconectada.ultimoErro,
      criadoEm: desconectada.criadoEm,
      atualizadoEm: desconectada.atualizadoEm,
    };
  }
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

export function listarConexoes(sellerId) {
  const rows = db.prepare("SELECT * FROM canais_conexoes WHERE canal = 'evolution' AND sellerId = ? ORDER BY CASE WHEN status = 'ativa' THEN 0 WHEN status = 'desconectada' THEN 2 ELSE 1 END, criadoEm DESC").all(sellerId);
  return rows.map((c) => {
    const dados = (() => { try { return JSON.parse(c.dados || "{}"); } catch { return {}; } })();
    return {
      id: c.id, status: c.status, numero: c.numero, nome: c.nome,
      apelido: c.apelido || "",
      qrCode: dados.qrCode || "", qrCodeEm: dados.qrCodeEm || null,
      ultimoErro: c.ultimoErro, criadoEm: c.criadoEm, atualizadoEm: c.atualizadoEm,
    };
  });
}

export function renomearConexao(sellerId, conexaoId, apelido) {
  const conexao = db.prepare("SELECT * FROM canais_conexoes WHERE id = ? AND canal = 'evolution' AND sellerId = ?").get(conexaoId, sellerId);
  if (!conexao) throw erroCanal("Conexão não encontrada.", 404);
  db.prepare("UPDATE canais_conexoes SET apelido = ?, atualizadoEm = ? WHERE id = ?").run(String(apelido || "").trim().slice(0, 60), agora(), conexaoId);
  return { ok: true };
}

// ── Reconexão automática ────────────────────────────────────────────────

async function tentarReconectar(conexaoId) {
  const conexao = db.prepare("SELECT * FROM canais_conexoes WHERE id = ? AND canal = 'evolution' AND status = 'reconectando'").get(conexaoId);
  if (!conexao) return;
  try {
    const nome = nomeInstancia(conexao.sellerId);
    await evo(`/instance/connect/${nome}`);
    console.log(`[evolution] reconexão automática iniciada: ${nome}`);
  } catch (e) {
    console.warn(`[evolution] reconexão automática falhou: ${e?.message}`);
    db.prepare("UPDATE canais_conexoes SET status = 'desconectada', ultimoErro = ?, atualizadoEm = ? WHERE id = ?")
      .run(`Reconexão automática falhou: ${String(e?.message || "").slice(0, 200)}`, agora(), conexaoId);
  }
}

// ── Admin: listar todas as instâncias da Evolution API ───────────────────

export async function listarInstancias() {
  if (!evolutionConfigurada()) return [];
  try {
    const r = await evo("/instance/fetchInstances");
    return Array.isArray(r) ? r : [];
  } catch { return []; }
}

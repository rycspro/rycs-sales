import { randomBytes } from "node:crypto";
import { VoiceProviderInterface } from "./providerInterface.js";

// Cliente ARI leve para comunicação com Asterisk via REST + WebSocket.
// Desabilitado em produção enquanto ASTERISK_ARI_URL não estiver configurado.

const ARI_URL = process.env.ASTERISK_ARI_URL || "";
const ARI_USER = process.env.ASTERISK_ARI_USER || "rycs-voice";
const ARI_PASS = process.env.ASTERISK_ARI_PASSWORD || "";
const ARI_WS_URL = process.env.ASTERISK_WS_URL || "";
const WEBRTC_WSS_URL = process.env.WEBRTC_WSS_URL || "";

function ariConfigurado() {
  return !!(ARI_URL && ARI_USER && ARI_PASS);
}

const DOMINIO_SIP = process.env.VOICE_SIP_DOMAIN || "app.rycs.pro";

function nomeRamal(sellerId) {
  return `sdr_${String(sellerId).replace(/[^A-Za-z0-9_-]/g, "")}`.slice(0, 40);
}

// Operadoras esperam E.164 sem "+"; números brasileiros chegam sem DDI.
export function paraE164(numero) {
  const d = String(numero || "").replace(/\D/g, "").replace(/^0+/, "");
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

class AriClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.connected = false;
    this.processedEvents = new Set();
    this.eventCleanupTimer = null;
  }

  async request(method, path, body = null) {
    if (!ariConfigurado()) throw new Error("ARI não configurado");
    const url = `${ARI_URL}${path}`;
    const headers = {
      "Authorization": "Basic " + Buffer.from(`${ARI_USER}:${ARI_PASS}`).toString("base64"),
      "Content-Type": "application/json",
    };
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetch(url, opts);
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`ARI ${method} ${path}: ${resp.status} ${text}`);
    }
    const ct = resp.headers.get("content-type") || "";
    return ct.includes("json") ? resp.json() : resp.text();
  }

  async connectWebSocket() {
    if (!ARI_WS_URL || this.ws) return;
    try {
      const wsUrl = `${ARI_WS_URL}&api_key=${ARI_USER}:${ARI_PASS}`;
      const WebSocket = globalThis.WebSocket || (await import("ws")).default;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.startEventCleanup();
      };

      this.ws.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data);
          this.handleAriEvent(event);
        } catch { /* ignore parse errors */ }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.connected = false;
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, 5000);
  }

  startEventCleanup() {
    if (this.eventCleanupTimer) return;
    this.eventCleanupTimer = setInterval(() => {
      if (this.processedEvents.size > 10000) {
        this.processedEvents.clear();
      }
    }, 60000);
  }

  handleAriEvent(event) {
    const eventKey = `${event.type}_${event.timestamp}_${event.channel?.id || ""}`;
    if (this.processedEvents.has(eventKey)) return;
    this.processedEvents.add(eventKey);

    for (const [, cb] of this.listeners) {
      try { cb(event); } catch { /* listener error */ }
    }
  }

  onEvent(id, callback) {
    this.listeners.set(id, callback);
  }

  removeListener(id) {
    this.listeners.delete(id);
  }

  disconnect() {
    if (this.ws) { this.ws.close(); this.ws = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.eventCleanupTimer) { clearInterval(this.eventCleanupTimer); this.eventCleanupTimer = null; }
    this.connected = false;
  }
}

const ariClient = new AriClient();

const chamadas = new Map();
let aoAtualizarChamada = () => {};

async function desligarCanal(id) {
  if (!id) return;
  await ariClient.request("DELETE", `/channels/${id}`).catch(() => {});
}

async function tratarEventoPonte(ev) {
  const canal = ev.channel;
  if (!canal) return;

  if (ev.type === "StasisStart") {
    const [papel, callId] = ev.args || [];
    const c = chamadas.get(callId);
    if (!c) return;

    if (papel === "agente") {
      try {
        const ponte = await ariClient.request("POST", "/bridges", { type: "mixing" });
        c.ponte = ponte.id;
        await ariClient.request("POST", `/bridges/${ponte.id}/addChannel`, { channel: canal.id });
        aoAtualizarChamada(callId, { status: "discando" });
        const cliente = await ariClient.request("POST", "/channels", {
          endpoint: `PJSIP/${c.destino}@operadora-endpoint`,
          app: "rycs-voice",
          appArgs: `cliente,${callId}`,
          timeout: 45,
          ...(c.callerIdNum ? { callerId: c.callerIdNum } : {}),
        });
        c.cliente = cliente.id;
      } catch (err) {
        aoAtualizarChamada(callId, { status: "falhou", motivo: err.message });
        await desligarCanal(c.agente);
      }
    } else if (papel === "cliente") {
      c.atendidaEm = Date.now();
      await ariClient.request("POST", `/bridges/${c.ponte}/addChannel`, { channel: canal.id }).catch(() => {});
      aoAtualizarChamada(callId, { status: "em_andamento", atendidaEm: c.atendidaEm });
    }
    return;
  }

  if (ev.type === "ChannelDestroyed") {
    for (const [callId, c] of chamadas) {
      if (c.agente !== canal.id && c.cliente !== canal.id) continue;
      chamadas.delete(callId);
      await desligarCanal(c.agente === canal.id ? c.cliente : c.agente);
      if (c.ponte) await ariClient.request("DELETE", `/bridges/${c.ponte}`).catch(() => {});
      aoAtualizarChamada(callId, {
        status: c.atendidaEm ? "encerrada" : "nao_atendida",
        atendidaEm: c.atendidaEm,
        encerradaEm: Date.now(),
        causa: ev.cause_txt || "",
      });
    }
  }
}

export class SipProvider extends VoiceProviderInterface {
  get id() { return "sip"; }
  get nome() { return "SIP/Asterisk (WebRTC)"; }

  getCapabilities() {
    const configurado = ariConfigurado();
    return {
      canInitiate: configurado,
      canTerminate: configurado,
      canRecord: false,
      canTransfer: false,
      canMute: configurado,
      canListen: false,
      canWhisper: false,
      canDetectVoicemail: false,
      canVerifyDuration: configurado,
      canVerifyAnswer: configurado,
      realtime: configurado,
      webrtc: configurado,
      pendente: !configurado,
      ...(configurado ? {} : {
        requisitos: [
          "Servidor Asterisk em EC2",
          "Contrato com operadora SIP",
          "Certificado TLS para WSS",
          "Variáveis ARI_URL, ARI_USER, ARI_PASSWORD preenchidas",
        ],
      }),
    };
  }

  async initialize() {
    if (!ariConfigurado()) {
      return {
        ok: false,
        motivo: "Variáveis de ambiente do Asterisk não configuradas (ASTERISK_ARI_URL, ASTERISK_ARI_USER, ASTERISK_ARI_PASSWORD).",
      };
    }

    try {
      const info = await ariClient.request("GET", "/asterisk/info");
      ariClient.onEvent("ponte-chamadas", (ev) => { tratarEventoPonte(ev).catch(() => {}); });
      ariClient.connectWebSocket();
      return { ok: true, versao: info?.system?.version || "desconhecida" };
    } catch (err) {
      return { ok: false, motivo: `Falha ao conectar ao Asterisk: ${err.message}` };
    }
  }

  async createWebRtcEndpoint({ sellerId }) {
    if (!ariConfigurado()) return { ok: false, motivo: "ARI não configurado." };

    const nome = nomeRamal(sellerId);
    const senha = randomBytes(18).toString("hex");
    const gravar = (tipo, campos) => ariClient.request("PUT", `/asterisk/config/dynamic/res_pjsip/${tipo}/${nome}`, {
      fields: Object.entries(campos).map(([attribute, value]) => ({ attribute, value: String(value) })),
    });

    try {
      await gravar("auth", { auth_type: "userpass", username: nome, password: senha });
      await gravar("aor", { max_contacts: 1, remove_existing: "yes" });
      await gravar("endpoint", {
        transport: "transport-ws",
        context: "rycs-webrtc",
        disallow: "all",
        allow: "opus,ulaw",
        webrtc: "yes",
        dtls_auto_generate_cert: "yes",
        direct_media: "no",
        auth: nome,
        aors: nome,
      });
    } catch (err) {
      return { ok: false, motivo: `Falha ao preparar o ramal: ${err.message}` };
    }

    return {
      ok: true,
      endpoint: nome,
      usuario: nome,
      senha,
      dominio: DOMINIO_SIP,
      wssUrl: WEBRTC_WSS_URL || `wss://${DOMINIO_SIP}/voice-ws`,
      stunServers: [process.env.STUN_SERVER || "stun:stun.l.google.com:19302"],
      codecs: ["opus", "ulaw"],
    };
  }

  // Liga primeiro para o navegador do profissional; quando ele atende, o
  // evento StasisStart disca para o lead e junta as duas pontas numa ponte.
  async initiateCall({ telefone, sellerId, callId, callerIdNum }) {
    if (!ariConfigurado()) return { ok: false, motivo: "Provedor SIP não configurado." };

    const destino = paraE164(telefone);
    try {
      const canal = await ariClient.request("POST", "/channels", {
        endpoint: `PJSIP/${nomeRamal(sellerId)}`,
        app: "rycs-voice",
        appArgs: `agente,${callId}`,
        callerId: `RYCS <${destino}>`,
        timeout: 30,
      });
      chamadas.set(callId, { destino, callerIdNum, agente: canal.id, cliente: null, ponte: null, atendidaEm: null });
      return {
        ok: true,
        providerCallId: callId,
        channelId: canal.id,
        status: "chamando_profissional",
        origemDados: "verificado",
      };
    } catch (err) {
      const semRegistro = /404|400|Allocation failed|not found/i.test(err.message);
      return {
        ok: false,
        providerCallId: callId,
        status: "falhou",
        motivo: semRegistro ? "Áudio do navegador não conectado. Recarregue a discadora." : `Falha ao originar: ${err.message}`,
        origemDados: "verificado",
      };
    }
  }

  async terminateCall(callId, { channelId } = {}) {
    if (!ariConfigurado()) return { ok: false, motivo: "ARI não configurado." };
    if (!channelId) return { ok: false, motivo: "channelId necessário para encerrar." };

    try {
      await ariClient.request("DELETE", `/channels/${channelId}`, { reason_code: 16, reason: "normal" });
      return { ok: true, status: "encerrada" };
    } catch (err) {
      if (err.message.includes("404")) return { ok: true, status: "ja_encerrada" };
      return { ok: false, motivo: err.message };
    }
  }

  async muteCall(channelId, muted) {
    if (!ariConfigurado()) return { ok: false, motivo: "ARI não configurado." };

    try {
      if (muted) {
        await ariClient.request("POST", `/channels/${channelId}/mute`, { direction: "in" });
      } else {
        await ariClient.request("DELETE", `/channels/${channelId}/mute`, { direction: "in" });
      }
      return { ok: true, muted };
    } catch (err) {
      return { ok: false, motivo: err.message };
    }
  }

  async getCallStatus(callId, { channelId } = {}) {
    if (!ariConfigurado()) return { status: "indisponivel" };
    if (!channelId) return { status: "desconhecido" };

    try {
      const ch = await ariClient.request("GET", `/channels/${channelId}`);
      const stateMap = {
        Ring: "chamando",
        Ringing: "chamando",
        Up: "em_andamento",
        Down: "encerrada",
      };
      return {
        status: stateMap[ch.state] || ch.state,
        channelState: ch.state,
        callerIdNum: ch.caller?.number || "",
        connectedNum: ch.connected?.number || "",
        creationTime: ch.creationtime,
        origemDados: "verificado",
      };
    } catch (err) {
      if (err.message.includes("404")) return { status: "encerrada", origemDados: "verificado" };
      return { status: "erro", motivo: err.message };
    }
  }

  async getCallDuration(channelId) {
    if (!ariConfigurado() || !channelId) return { duracao: 0 };

    try {
      const ch = await ariClient.request("GET", `/channels/${channelId}`);
      if (!ch.creationtime) return { duracao: 0 };
      const inicio = new Date(ch.creationtime).getTime();
      const agora = Date.now();
      return { duracao: Math.floor((agora - inicio) / 1000), origemDados: "verificado" };
    } catch {
      return { duracao: 0 };
    }
  }

  async handleCallEvent(event) {
    if (!event?.type) return { processado: false };

    const eventKey = `${event.type}_${event.timestamp}_${event.channel?.id || ""}`;
    const vars = event.channel?.dialplan?.app_data?.split(",") || [];
    const callId = event.channel?.channelvars?.RYCS_CALL_ID || vars[1] || "";

    const resultado = {
      processado: true,
      eventKey,
      callId,
      tipo: event.type,
      channelId: event.channel?.id || "",
      timestamp: event.timestamp,
    };

    switch (event.type) {
      case "StasisStart":
        resultado.acao = "chamada_iniciada";
        resultado.companyId = event.channel?.channelvars?.RYCS_COMPANY_ID || "";
        resultado.sellerId = event.channel?.channelvars?.RYCS_SELLER_ID || "";
        break;
      case "ChannelStateChange":
        if (event.channel?.state === "Up") {
          resultado.acao = "atendida";
        } else if (event.channel?.state === "Ringing") {
          resultado.acao = "chamando";
        }
        break;
      case "ChannelHangupRequest":
        resultado.acao = "encerrando";
        resultado.cause = event.cause;
        break;
      case "StasisEnd":
        resultado.acao = "encerrada";
        break;
      case "ChannelDestroyed":
        resultado.acao = "destruida";
        resultado.cause = event.cause;
        resultado.causeTxt = event.cause_txt;
        break;
      default:
        resultado.acao = event.type;
    }

    return resultado;
  }

  async getRecording(_callId) {
    return { disponivel: false, motivo: "Gravação desabilitada nesta fase." };
  }

  async getUsage({ companyId }) {
    return { minutos: 0, custo: 0, nota: "Consumo via voice_usage_events no banco." };
  }

  onAriEvent(listenerId, callback) {
    ariClient.onEvent(listenerId, callback);
  }

  removeAriListener(listenerId) {
    ariClient.removeListener(listenerId);
  }

  aoAtualizarChamada(fn) {
    aoAtualizarChamada = fn;
  }

  get ariConnected() {
    return ariClient.connected;
  }

  async shutdown() {
    ariClient.disconnect();
  }
}

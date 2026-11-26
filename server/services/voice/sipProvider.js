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
      ariClient.connectWebSocket();
      return { ok: true, versao: info?.system?.version || "desconhecida" };
    } catch (err) {
      return { ok: false, motivo: `Falha ao conectar ao Asterisk: ${err.message}` };
    }
  }

  async createWebRtcEndpoint({ extensionId, companyId, sellerId }) {
    if (!ariConfigurado()) return { ok: false, motivo: "ARI não configurado." };

    const endpointName = `sdr_${companyId}_${sellerId}`.slice(0, 40);
    return {
      ok: true,
      endpoint: endpointName,
      wssUrl: WEBRTC_WSS_URL || `wss://${new URL(ARI_URL).hostname}:8089/ws`,
      stunServers: [process.env.STUN_SERVER || "stun:stun.l.google.com:19302"],
      codecs: ["opus", "ulaw"],
    };
  }

  async initiateCall({ telefone, leadId, sellerId, companyId, queueId, callerIdNum }) {
    if (!ariConfigurado()) return { ok: false, motivo: "Provedor SIP não configurado." };

    const callId = `sip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const destino = telefone.replace(/\D/g, "");

    try {
      const channel = await ariClient.request("POST", "/channels", {
        endpoint: `PJSIP/${destino}@operadora-endpoint`,
        app: "rycs-voice",
        appArgs: `outgoing,${callId},${companyId},${sellerId},${leadId || ""},${queueId || ""}`,
        callerId: callerIdNum || destino,
        variables: {
          RYCS_CALL_ID: callId,
          RYCS_COMPANY_ID: companyId,
          RYCS_SELLER_ID: sellerId,
          RYCS_LEAD_ID: leadId || "",
          RYCS_QUEUE_ID: queueId || "",
        },
      });

      return {
        ok: true,
        providerCallId: callId,
        channelId: channel.id,
        status: "originando",
        origemDados: "verificado",
      };
    } catch (err) {
      return {
        ok: false,
        providerCallId: callId,
        motivo: `Falha ao originar: ${err.message}`,
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

  get ariConnected() {
    return ariClient.connected;
  }

  async shutdown() {
    ariClient.disconnect();
  }
}

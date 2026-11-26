import { VoiceProviderInterface } from "./providerInterface.js";

export class SipProvider extends VoiceProviderInterface {
  get id() { return "sip"; }
  get nome() { return "SIP/Asterisk (em ativação)"; }

  getCapabilities() {
    return {
      canInitiate: false,
      canTerminate: false,
      canRecord: false,
      canTransfer: false,
      canMute: false,
      canListen: false,
      canWhisper: false,
      canDetectVoicemail: false,
      canVerifyDuration: false,
      canVerifyAnswer: false,
      realtime: false,
      webrtc: false,
      pendente: true,
      requisitos: [
        "Servidor Asterisk em EC2 São Paulo",
        "Contrato com operadora SIP (tronco)",
        "Certificado TLS para WSS",
        "Configuração SRTP/DTLS",
      ],
    };
  }

  async initialize() {
    return {
      ok: false,
      motivo: "O provedor SIP/Asterisk ainda não foi configurado. É necessário contratar a operadora e provisionar o servidor de voz.",
    };
  }

  async initiateCall() {
    return { ok: false, motivo: "Provedor SIP não configurado." };
  }

  async terminateCall() {
    return { ok: false, motivo: "Provedor SIP não configurado." };
  }

  async getCallStatus() {
    return { status: "indisponivel" };
  }

  async handleCallEvent(event) {
    return { processado: false, motivo: "Provedor SIP não configurado." };
  }

  async getRecording() {
    return { disponivel: false };
  }

  async getUsage() {
    return { minutos: 0, custo: 0 };
  }
}

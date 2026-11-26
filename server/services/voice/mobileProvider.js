import { VoiceProviderInterface } from "./providerInterface.js";

export class MobileProvider extends VoiceProviderInterface {
  get id() { return "mobile"; }
  get nome() { return "Mobile Dialer"; }

  getCapabilities() {
    return {
      canInitiate: true,
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
    };
  }

  async initialize() { return { ok: true }; }

  async initiateCall({ telefone, leadId, sellerId }) {
    return {
      providerCallId: `mob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      telUri: `tel:${telefone.replace(/\D/g, "")}`,
      status: "iniciada",
      origemDados: "declarado",
      aviso: "A ligação será feita pelo telefone do dispositivo. O resultado deve ser registrado manualmente.",
    };
  }

  async terminateCall() {
    return { ok: false, motivo: "O modo celular não permite encerrar a ligação pela plataforma." };
  }

  async getCallStatus(callId) {
    return { callId, status: "desconhecido", origemDados: "declarado" };
  }

  async handleCallEvent(event) {
    return { processado: true };
  }

  async getRecording() {
    return { disponivel: false, motivo: "Gravação não disponível no modo celular." };
  }

  async getUsage({ companyId, periodo }) {
    return { minutos: 0, custo: 0, nota: "Modo celular usa a linha do profissional; sem custo na plataforma." };
  }
}

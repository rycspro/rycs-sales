import { VoiceProviderInterface } from "./providerInterface.js";

const CENARIOS = ["atendeu", "nao_atendeu", "ocupado", "caixa_postal", "falha", "timeout"];

function cenarioAleatorio() {
  const pesos = [40, 25, 10, 15, 5, 5];
  const total = pesos.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < CENARIOS.length; i++) {
    r -= pesos[i];
    if (r <= 0) return CENARIOS[i];
  }
  return "atendeu";
}

export class MockProvider extends VoiceProviderInterface {
  get id() { return "mock"; }
  get nome() { return "Simulação (desenvolvimento)"; }

  getCapabilities() {
    return {
      canInitiate: true,
      canTerminate: true,
      canRecord: true,
      canTransfer: false,
      canMute: true,
      canListen: true,
      canWhisper: false,
      canDetectVoicemail: true,
      canVerifyDuration: true,
      canVerifyAnswer: true,
      realtime: true,
      webrtc: false,
      simulado: true,
    };
  }

  async initialize() { return { ok: true, aviso: "Provedor de simulação — nenhuma ligação real será feita." }; }

  async initiateCall({ telefone, leadId }) {
    const cenario = cenarioAleatorio();
    const callId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const duracao = cenario === "atendeu" ? Math.floor(60 + Math.random() * 300) : cenario === "caixa_postal" ? Math.floor(10 + Math.random() * 20) : 0;

    return {
      providerCallId: callId,
      status: cenario === "atendeu" ? "atendida" : cenario === "caixa_postal" ? "caixa_postal" : cenario === "ocupado" ? "ocupado" : cenario === "falha" ? "falha" : cenario === "timeout" ? "timeout" : "nao_atendeu",
      origemDados: "simulado",
      cenario,
      duracao,
      duracaoTarifavel: cenario === "atendeu" ? duracao : 0,
      simulado: true,
    };
  }

  async terminateCall(callId) {
    return { ok: true, callId, encerradaEm: Date.now(), simulado: true };
  }

  async getCallStatus(callId) {
    return { callId, status: "encerrada", simulado: true, origemDados: "simulado" };
  }

  async handleCallEvent(event) {
    return { processado: true, simulado: true };
  }

  async getRecording(callId) {
    return {
      disponivel: true,
      url: "",
      simulado: true,
      aviso: "Gravação simulada — nenhum áudio real existe.",
    };
  }

  async getUsage({ companyId, periodo }) {
    return { minutos: 0, custo: 0, simulado: true, nota: "Dados simulados não geram consumo real." };
  }
}

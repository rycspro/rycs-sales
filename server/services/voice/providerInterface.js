// Interface base para provedores de telefonia RYCS Voice.
// Cada provedor implementa estes métodos.

export class VoiceProviderInterface {
  constructor(config = {}) {
    this.config = config;
  }

  get id() { return "base"; }
  get nome() { return "Base Provider"; }

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
    };
  }

  async initialize() { throw new Error("Não implementado"); }
  async initiateCall(_params) { throw new Error("Não implementado"); }
  async terminateCall(_callId) { throw new Error("Não implementado"); }
  async getCallStatus(_callId) { throw new Error("Não implementado"); }
  async handleCallEvent(_event) { throw new Error("Não implementado"); }
  async getRecording(_callId) { throw new Error("Não implementado"); }
  async getUsage(_params) { throw new Error("Não implementado"); }
}

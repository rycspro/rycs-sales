import { MobileProvider } from "./mobileProvider.js";
import { MockProvider } from "./mockProvider.js";
import { SipProvider } from "./sipProvider.js";

const providers = new Map();

function registrar(Provider) {
  const p = new Provider();
  providers.set(p.id, p);
}

registrar(MobileProvider);
registrar(MockProvider);
registrar(SipProvider);

if (process.env.ASTERISK_ARI_URL) {
  providers.get("sip").initialize().then((r) => {
    console.log(r.ok ? `[voice] Asterisk conectado (${r.versao})` : `[voice] SIP inativo: ${r.motivo}`);
  });
}

export function getProvider(id) {
  return providers.get(id) || null;
}

export function listProviders() {
  return Array.from(providers.values()).map((p) => ({
    id: p.id,
    nome: p.nome,
    capabilities: p.getCapabilities(),
  }));
}

export function getProviderCapabilities(id) {
  const p = providers.get(id);
  return p ? p.getCapabilities() : null;
}

import { API_URL } from "./api.js";
import { CAMPOS_ORIGEM, limparOrigem } from "../../shared/jornada.js";

const CHAVE_ID = "rycs_vid";
const CHAVE_ORIGEM = "rycs_origem";
const ID_VALIDO = /^[A-Za-z0-9_-]{8,64}$/;

const ler = (chave) => { try { return localStorage.getItem(chave); } catch { return null; } };
const gravar = (chave, valor) => { try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento */ } };

function novoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

let idMemoria = null;
export function visitanteId() {
  const salvo = ler(CHAVE_ID);
  if (salvo && ID_VALIDO.test(salvo)) return salvo;
  idMemoria ||= novoId();
  gravar(CHAVE_ID, idMemoria);
  return idMemoria;
}

export function origemSalva() {
  try { return limparOrigem(JSON.parse(ler(CHAVE_ORIGEM) || "{}")); } catch { return {}; }
}

// Primeiro toque: a origem do anúncio fica guardada até o cadastro. O `vid`
// vem da landing (rycs.pro), para o mesmo visitante seguir no app.
export function capturarOrigem() {
  const params = new URLSearchParams(window.location.search);
  const vid = params.get("vid");
  if (vid && ID_VALIDO.test(vid) && !ler(CHAVE_ID)) gravar(CHAVE_ID, vid);

  if (Object.keys(origemSalva()).length) return;
  const origem = {};
  for (const campo of CAMPOS_ORIGEM) if (params.get(campo)) origem[campo] = params.get(campo);
  if (!Object.keys(origem).length) {
    try {
      const ref = document.referrer && new URL(document.referrer).hostname;
      if (ref && !ref.endsWith("rycs.pro") && ref !== window.location.hostname) origem.referrer = ref;
    } catch { /* referrer inválido */ }
  }
  if (Object.keys(origem).length) {
    origem.landing = window.location.pathname;
    gravar(CHAVE_ORIGEM, JSON.stringify(limparOrigem(origem)));
  }
}

export const dadosRastreio = () => ({ visitanteId: visitanteId(), origem: origemSalva() });

export function rastrear(evento, { papel = "", etapa = "" } = {}) {
  fetch(`${API_URL}/api/jornada/evento`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evento, papel, etapa, ...dadosRastreio() }),
    keepalive: true,
  }).catch(() => null);
}

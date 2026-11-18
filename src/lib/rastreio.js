import { API_URL } from "./api.js";
import { CAMPOS_ORIGEM, limparOrigem } from "../../shared/jornada.js";
import { META_PIXEL_ID, COOKIE_CONSENTIMENTO, CONSENTIU, RECUSOU, CATEGORIA_META } from "../../shared/metaPixel.js";

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

// ── Meta (pixel no navegador) ──────────────────────────────────────────
// Só carrega depois de a pessoa aceitar cookies de marketing (AvisoCookies).
// O cadastro também sai pelo servidor (API de Conversões) com o mesmo
// event_id, e a Meta junta os dois.

function lerCookie(nome) {
  try {
    const par = document.cookie.split("; ").find((c) => c.startsWith(`${nome}=`));
    return par ? decodeURIComponent(par.slice(nome.length + 1)) : "";
  } catch { return ""; }
}

// "aceito", "recusado" ou "" (ainda não escolheu).
export function escolhaCookies() {
  const v = lerCookie(COOKIE_CONSENTIMENTO);
  return v === CONSENTIU || v === RECUSOU ? v : "";
}

export function escolherCookies(valor) {
  if (valor !== CONSENTIU && valor !== RECUSOU) return;
  // Domínio .rycs.pro: a escolha feita na landing vale no app, e vice-versa.
  const dominio = window.location.hostname.endsWith("rycs.pro") ? "; domain=.rycs.pro" : "";
  const seguro = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_CONSENTIMENTO}=${valor}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax${dominio}${seguro}`;
  if (valor === CONSENTIU) carregarPixel();
}

let pixelCarregado = false;
const fbq = (...args) => { if (pixelCarregado && window.fbq) window.fbq(...args); };

export function carregarPixel() {
  if (pixelCarregado || typeof window === "undefined" || escolhaCookies() !== CONSENTIU) return;
  pixelCarregado = true;
  if (!window.fbq) {
    // Código-base oficial do pixel: fila de chamadas até o script carregar.
    const f = function (...args) { f.callMethod ? f.callMethod(...args) : f.queue.push(args); };
    f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
    window.fbq = f;
    if (!window._fbq) window._fbq = f;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  window.fbq("init", META_PIXEL_ID);
  window.fbq("track", "PageView");
  // navegar() (lib/rotas.js) troca de tela com pushState + popstate.
  window.addEventListener("popstate", () => fbq("track", "PageView"));
}

function eventoMeta(evento, papel, etapa) {
  const categoria = CATEGORIA_META[papel];
  if (!categoria) return;
  if (evento === "cadastro_aberto") fbq("track", "ViewContent", { content_name: `Cadastro ${categoria}`, content_category: categoria });
  if (evento === "cadastro_etapa") fbq("trackCustom", "EtapaCadastro", { content_category: categoria, etapa });
}

// Um id por tentativa de cadastro: o mesmo vai no corpo da criação de conta
// (servidor) e no CompleteRegistration do pixel (cadastroConcluido).
let idCadastro = null;

export const dadosRastreio = () => {
  idCadastro ||= novoId();
  return {
    visitanteId: visitanteId(),
    origem: origemSalva(),
    meta: { eventId: idCadastro, consentimento: escolhaCookies() === CONSENTIU, fbp: lerCookie("_fbp"), fbc: lerCookie("_fbc") },
  };
};

export function cadastroConcluido(papel) {
  const categoria = CATEGORIA_META[papel];
  if (categoria && idCadastro)
    fbq("track", "CompleteRegistration", { content_name: `Cadastro ${categoria}`, content_category: categoria, status: "conta_criada" }, { eventID: idCadastro });
  idCadastro = null;
}

export function rastrear(evento, { papel = "", etapa = "" } = {}) {
  fetch(`${API_URL}/api/jornada/evento`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evento, papel, etapa, visitanteId: visitanteId(), origem: origemSalva() }),
    keepalive: true,
  }).catch(() => null);
  eventoMeta(evento, papel, etapa);
}

import { API_URL } from "./api.js";
import { CAMPOS_ORIGEM, limparOrigem } from "../../shared/jornada.js";
import { META_PIXEL_ID, COOKIE_CONSENTIMENTO, CONSENTIU, RECUSOU, CATEGORIA_META, camposCorrespondencia } from "../../shared/metaPixel.js";

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

// Correspondência avançada: o id do visitante da RYCS vai em todo evento do
// pixel (external_id, em SHA-256, igual ao que o servidor manda). Depois do
// cadastro entram e-mail, telefone, nome e cidade. A Meta liga os passos.
async function sha256(texto) {
  try {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
    return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return texto; } // sem crypto.subtle o pixel faz o hash
}

// Hash do id do visitante, calculado uma vez.
let idExterno = null;
const externalId = () => (idExterno ||= sha256(visitanteId()));

// Promessa do pixel pronto (init feito). Nula sem aceite de cookies.
let pixelPronto = null;
const fbq = (...args) => { if (pixelPronto) pixelPronto.then(() => window.fbq?.(...args)); };

export function carregarPixel() {
  if (pixelPronto || typeof window === "undefined" || escolhaCookies() !== CONSENTIU) return;
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
  pixelPronto = externalId().then((id) => {
    window.fbq("init", META_PIXEL_ID, { external_id: id });
    window.fbq("track", "PageView");
  });
  // navegar() (lib/rotas.js) troca de tela com pushState + popstate.
  window.addEventListener("popstate", () => fbq("track", "PageView"));
}

// Mesmo event_id no pixel e no servidor: a Meta conta uma vez só.
function eventoMeta(evento, papel, etapa) {
  const categoria = CATEGORIA_META[papel];
  if (!categoria || !pixelPronto) return null;
  const eventID = novoId();
  if (evento === "cadastro_aberto") fbq("track", "ViewContent", { content_name: `Cadastro ${categoria}`, content_category: categoria }, { eventID });
  else if (evento === "cadastro_etapa") fbq("trackCustom", "EtapaCadastro", { content_category: categoria, etapa }, { eventID });
  else return null;
  return eventID;
}

const sinaisMeta = () => ({ consentimento: escolhaCookies() === CONSENTIU, fbp: lerCookie("_fbp"), fbc: lerCookie("_fbc") });

// Um id por tentativa de cadastro: o mesmo vai no corpo da criação de conta
// (servidor) e no CompleteRegistration do pixel (cadastroConcluido).
let idCadastro = null;

export const dadosRastreio = () => {
  idCadastro ||= novoId();
  return {
    visitanteId: visitanteId(),
    origem: origemSalva(),
    meta: { eventId: idCadastro, ...sinaisMeta() },
  };
};

// `dados`: o que a pessoa preencheu no cadastro (e-mail, WhatsApp, nome…).
export function cadastroConcluido(papel, dados = {}) {
  const categoria = CATEGORIA_META[papel];
  if (categoria && idCadastro && pixelPronto) {
    const pessoa = papel === "vendedor";
    const campos = camposCorrespondencia({
      email: dados.email, telefone: dados.whats, pais: dados.pais || "BR",
      ...(pessoa && { nome: dados.nome, cidade: dados.cidade, estado: dados.estado, nascimento: dados.dataNascimento, genero: dados.genero }),
    });
    const eventID = idCadastro;
    // Novo init com os dados da pessoa: vale para este e os próximos eventos.
    pixelPronto = pixelPronto
      .then(externalId)
      .then((id) => { window.fbq?.("init", META_PIXEL_ID, { ...campos, external_id: id }); });
    fbq("track", "CompleteRegistration", { content_name: `Cadastro ${categoria}`, content_category: categoria, status: "conta_criada" }, { eventID });
  }
  idCadastro = null;
}

// ── Quiz das empresas (/diagnostico) ───────────────────────────────────
// ViewContent ao abrir, QuizConcluido ao terminar as perguntas, Lead no
// pré-cadastro (contato gravado) e Schedule só
// depois de a reserva estar gravada. O Schedule também sai pelo servidor com
// o mesmo event_id (dadosAgendamento vai no corpo da reserva).
const DIAGNOSTICO = { content_name: "Diagnóstico comercial", content_category: "empresa" };

export function eventoDiagnostico(nome, extra = {}) {
  if (!pixelPronto) return;
  const dados = { ...DIAGNOSTICO, ...extra };
  if (nome === "ViewContent" || nome === "Lead") fbq("track", nome, dados, { eventID: novoId() });
  else fbq("trackCustom", nome, dados, { eventID: novoId() });
}

export const dadosAgendamento = () => ({
  visitanteId: visitanteId(),
  origem: origemSalva(),
  meta: { eventId: novoId(), ...sinaisMeta() },
});

export function agendamentoConcluido(eventID, { email, telefone, nome } = {}) {
  if (!pixelPronto || !eventID) return;
  const campos = camposCorrespondencia({ email, telefone, nome, pais: "BR" });
  pixelPronto = pixelPronto
    .then(externalId)
    .then((id) => { window.fbq?.("init", META_PIXEL_ID, { ...campos, external_id: id }); });
  fbq("track", "Schedule", DIAGNOSTICO, { eventID });
}

export function rastrear(evento, { papel = "", etapa = "" } = {}) {
  const eventId = eventoMeta(evento, papel, etapa);
  fetch(`${API_URL}/api/jornada/evento`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      evento, papel, etapa, visitanteId: visitanteId(), origem: origemSalva(),
      ...(eventId && { meta: { eventId, ...sinaisMeta() } }),
    }),
    keepalive: true,
  }).catch(() => null);
}

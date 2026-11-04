// Resolução de rota sem biblioteca de router.
//
// O projeto sempre decidiu a tela lendo window.location.pathname direto no
// componente. Isso funciona para uma bifurcação, mas passou a ser três
// entradas independentes — login, cadastro de profissional e cadastro de
// empresa — e cada leitura solta do pathname vira uma regra duplicada.
// Centralizar aqui mantém uma única tabela de endereços.

import { useEffect, useState } from "react";

export const ROTAS = {
  landing: "/",
  login: "/entrar",
  escolha: "/cadastro",
  cadastroVendedor: "/cadastro/profissional",
  cadastroEmpresa: "/cadastro/empresa",
  plataforma: "/plataforma",
  trial: "/trial",
  onboarding: "/onboarding",
  comecar: "/comecar",
};

// Endereços alternativos que as pessoas digitam ou que ficam em links antigos.
// Recusar por causa de um "s" no fim seria perder um cadastro por nada.
const APELIDOS = new Map([
  ["/cadastro/vendedor", ROTAS.cadastroVendedor],
  ["/cadastro/profissionais", ROTAS.cadastroVendedor],
  ["/profissional", ROTAS.cadastroVendedor],
  ["/cadastro/empresas", ROTAS.cadastroEmpresa],
  ["/empresa", ROTAS.cadastroEmpresa],
  ["/cadastrar", ROTAS.escolha],
  ["/entrar", ROTAS.login],
  ["/login", ROTAS.login],
]);

function normalizar(caminho) {
  const limpo = (caminho || "/").replace(/\/+$/, "").toLowerCase() || "/";
  return APELIDOS.get(limpo) || limpo;
}

export function resolver(caminho = typeof window !== "undefined" ? window.location.pathname : "/") {
  const p = normalizar(caminho);
  // Convite de trial: /trial/<token>. O token não pode passar por normalização
  // — ele é sensível a maiúsculas e minúsculas.
  const bruto = (caminho || "/").replace(/\/+$/, "");
  if (bruto.startsWith("/trial/")) {
    const token = bruto.slice("/trial/".length).split("/")[0];
    if (token) return { tipo: "trial", token };
  }
  // Convite de onboarding gerado no admin: /comecar/<token>. Mesmo cuidado
  // com maiúsculas do convite de trial.
  if (bruto.startsWith("/comecar/")) {
    const token = bruto.slice("/comecar/".length).split("/")[0];
    if (token) return { tipo: "convite-onboarding", token };
  }
  // A etapa da URL é só um pedido: quem decide qual abre é o servidor.
  if (p === ROTAS.onboarding || p.startsWith(`${ROTAS.onboarding}/`))
    return { tipo: "onboarding", etapa: p.slice(ROTAS.onboarding.length + 1).split("/")[0] || null };
  if (p.startsWith("/plataforma")) return { tipo: "plataforma" };
  if (p === ROTAS.cadastroVendedor) return { tipo: "cadastro", role: "vendedor" };
  if (p === ROTAS.cadastroEmpresa) return { tipo: "cadastro", role: "empresa" };
  if (p === ROTAS.escolha) return { tipo: "escolha" };
  if (bruto.startsWith("/confirmar-email/")) {
    const token = bruto.slice("/confirmar-email/".length).split("/")[0];
    if (token) return { tipo: "confirmar-email", token };
  }
  if (p === ROTAS.login || p === "/login") return { tipo: "login" };
  if (p === ROTAS.landing) return { tipo: "landing" };
  return { tipo: "login" };
}

// Navegação preservando a query: o código de indicação (?ref=) e o token de
// redefinição de senha chegam por ali e não podem sumir ao trocar de tela.
export function navegar(destino, { manterQuery = true } = {}) {
  if (typeof window === "undefined") return;
  const query = manterQuery ? window.location.search : "";
  window.history.pushState({}, "", `${destino}${query}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRota() {
  const [rota, setRota] = useState(() => resolver());
  useEffect(() => {
    const aoMudar = () => setRota(resolver());
    window.addEventListener("popstate", aoMudar);
    return () => window.removeEventListener("popstate", aoMudar);
  }, []);
  return rota;
}

export const parametro = (chave) => {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get(chave);
  } catch {
    return null;
  }
};

// O convite chega pela URL e precisa sobreviver ao login: quem abre o link
// sem estar logado passa por cadastro ou entrada antes de conseguir resgatar.
// Guardar em memória só não bastaria — a página recarrega no meio do caminho.
const CHAVE_CONVITE = "rycs-convite-trial";

export function guardarConvite(token) {
  try { window.sessionStorage?.setItem(CHAVE_CONVITE, token); } catch { /* sessão bloqueada */ }
}

export function lerConvite() {
  try { return window.sessionStorage?.getItem(CHAVE_CONVITE) || null; } catch { return null; }
}

export function limparConvite() {
  try { window.sessionStorage?.removeItem(CHAVE_CONVITE); } catch { /* nada a fazer */ }
}

// Convite de onboarding: mesma razão do convite de trial — precisa sobreviver
// ao cadastro ou ao login, que recarregam a tela.
const CHAVE_CONVITE_ONBOARDING = "rycs-convite-onboarding";

export function guardarConviteOnboarding(token) {
  try { window.sessionStorage?.setItem(CHAVE_CONVITE_ONBOARDING, token); } catch { /* sessão bloqueada */ }
}

export function lerConviteOnboarding() {
  try { return window.sessionStorage?.getItem(CHAVE_CONVITE_ONBOARDING) || null; } catch { return null; }
}

export function limparConviteOnboarding() {
  try { window.sessionStorage?.removeItem(CHAVE_CONVITE_ONBOARDING); } catch { /* nada a fazer */ }
}

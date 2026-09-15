// Resolução de rota sem biblioteca de router.
//
// O projeto sempre decidiu a tela lendo window.location.pathname direto no
// componente. Isso funciona para uma bifurcação, mas passou a ser três
// entradas independentes — login, cadastro de profissional e cadastro de
// empresa — e cada leitura solta do pathname vira uma regra duplicada.
// Centralizar aqui mantém uma única tabela de endereços.

import { useEffect, useState } from "react";

export const ROTAS = {
  login: "/",
  escolha: "/cadastro",
  cadastroVendedor: "/cadastro/profissional",
  cadastroEmpresa: "/cadastro/empresa",
  plataforma: "/plataforma",
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
  if (p.startsWith("/plataforma")) return { tipo: "plataforma" };
  if (p === ROTAS.cadastroVendedor) return { tipo: "cadastro", role: "vendedor" };
  if (p === ROTAS.cadastroEmpresa) return { tipo: "cadastro", role: "empresa" };
  if (p === ROTAS.escolha) return { tipo: "escolha" };
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

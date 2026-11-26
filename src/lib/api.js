export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3001" : "");

// 409 ONBOARDING_PENDENTE → redireciona para a etapa atual.
// Importação lazy para evitar dependência circular na inicialização.
const tratarOnbPendente = (corpo) => {
  if (corpo?.error === "ONBOARDING_PENDENTE" && corpo?.redirect) {
    const url = corpo.redirect;
    Promise.resolve().then(() => import("./rotas.js")).then(({ navegar }) => navegar?.(url)).catch(() => null);
  }
  return corpo;
};

export const api = (path, body) =>
  fetch(`${API_URL}/api${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  }).then(async (r) => {
    const texto = await r.text();
    let corpo;
    try { corpo = JSON.parse(texto); } catch { return { error: texto?.slice(0, 200) || `Erro ${r.status}` }; }
    if (r.status === 409) tratarOnbPendente(corpo);
    return corpo;
  }).catch(() => null);

// Atalhos no estilo api.get/post/put/patch/delete (usados pela Discadora).
// Rejeitam quando não há resposta ou ela traz `error`, para o `.catch` de quem
// chama tratar — assim o estado da tela nunca recebe null/objeto de erro.
const exigirOk = (r) => {
  if (r == null || (r && typeof r === "object" && !Array.isArray(r) && r.error)) {
    throw new Error(r?.error || "Falha na requisição");
  }
  return r;
};
const comQuery = (path, params) => {
  if (!params) return path;
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
  return q ? `${path}${path.includes("?") ? "&" : "?"}${q}` : path;
};
api.get = (path, params) => api(comQuery(path, params)).then(exigirOk);
api.post = (path, body) => api(path, body || {}).then(exigirOk);
api.put = (path, body) => apiPut(path, body).then(exigirOk);
api.patch = (path, body) => apiPatch(path, body).then(exigirOk);
api.delete = (path, body) => apiDelete(path, body).then(exigirOk);

export const apiPatch = (path, body) =>
  fetch(`${API_URL}/api${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  }).then((r) => r.json()).catch(() => null);

export const apiPut = (path, body) =>
  fetch(`${API_URL}/api${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  }).then((r) => r.json()).catch(() => null);

export const apiDelete = (path, body) =>
  fetch(`${API_URL}/api${path}`, {
    method: "DELETE",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  }).then((r) => r.json()).catch(() => null);

// Exclusões respondem 409 quando há valores em aberto, e o corpo traz os
// números que a plataforma precisa ler antes de decidir. Por isso aqui o
// status vem junto: sem ele, "recusado por saldo" e "erro" seriam a mesma
// coisa para quem chama.
export const apiDeleteStatus = (path) =>
  fetch(`${API_URL}/api${path}`, {
    method: "DELETE",
    credentials: "include",
  })
    .then(async (r) => ({ status: r.status, corpo: await r.json().catch(() => ({})) }))
    .catch(() => ({ status: 0, corpo: { error: "Falha de conexão." } }));

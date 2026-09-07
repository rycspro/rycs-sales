export const API_URL = import.meta.env.DEV ? "http://localhost:3001" : "";

export const api = (path, body) =>
  fetch(`${API_URL}/api${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  }).then((r) => r.json()).catch(() => null);

export const apiPatch = (path, body) =>
  fetch(`${API_URL}/api${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  }).then((r) => r.json()).catch(() => null);

export const apiDelete = (path) =>
  fetch(`${API_URL}/api${path}`, {
    method: "DELETE",
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

export const API_URL = "http://localhost:3001";

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

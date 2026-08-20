// Cliente HTTP do Asaas.
//
// A versão anterior fazia `res.json()` sem olhar o status, então um 400 do
// gateway virava "sucesso" com campos undefined e o erro só aparecia depois,
// como saldo que nunca creditou. Aqui todo erro vira exceção.

const BASE = process.env.ASAAS_ENV === "production"
  ? "https://api.asaas.com/v3"
  : "https://sandbox.asaas.com/api/v3";

export const asaasAtivo = () => !!process.env.ASAAS_API_KEY;

export class AsaasError extends Error {
  constructor(mensagem, status, corpo) {
    super(mensagem);
    this.name = "AsaasError";
    this.status = status;
    this.corpo = corpo;
  }
}

export async function asaas(caminho, { method = "GET", body } = {}) {
  if (!asaasAtivo()) throw new AsaasError("ASAAS_API_KEY não configurada", 0, null);

  const res = await fetch(`${BASE}${caminho}`, {
    method,
    headers: { "Content-Type": "application/json", access_token: process.env.ASAAS_API_KEY },
    body: body ? JSON.stringify(body) : undefined,
  });

  const texto = await res.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { /* resposta não-JSON */ }

  if (!res.ok) {
    // O Asaas devolve os detalhes em errors[].description.
    const detalhe = dados?.errors?.map((e) => e.description).join("; ") || texto?.slice(0, 200) || res.statusText;
    throw new AsaasError(detalhe, res.status, dados);
  }
  return dados;
}

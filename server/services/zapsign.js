// Cliente mínimo da API da ZapSign (assinatura eletrônica).
// Fica desligado até existir ZAPSIGN_API_TOKEN no ambiente; sem ele, os
// contratos de colaboradores são assinados com código por e-mail.
// ZAPSIGN_SANDBOX=1 usa o ambiente de testes da ZapSign.
// ZAPSIGN_API_URL troca a base (usado nos testes com servidor simulado).

const base = () => (process.env.ZAPSIGN_API_URL
  || (process.env.ZAPSIGN_SANDBOX === "1" ? "https://sandbox.api.zapsign.com.br/api/v1" : "https://api.zapsign.com.br/api/v1")).replace(/\/$/, "");

export const zapsignAtivo = () => !!process.env.ZAPSIGN_API_TOKEN;

async function chamar(metodo, caminho, corpo) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${base()}${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${process.env.ZAPSIGN_API_TOKEN}`, "Content-Type": "application/json" },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: ctrl.signal,
    });
    const texto = await r.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { /* resposta sem JSON */ }
    if (!r.ok) throw new Error(`ZapSign ${r.status}: ${(json && (json.detail || json.message)) || texto.slice(0, 200)}`);
    return json;
  } finally { clearTimeout(t); }
}

// Cria o documento a partir do texto já preenchido do contrato e devolve o
// token do documento e o link de assinatura do colaborador.
export async function criarDocumento({ nome, texto, idExterno, signatario }) {
  const doc = await chamar("POST", "/docs/", {
    name: nome,
    markdown_text: texto,
    external_id: idExterno,
    lang: "pt-br",
    signed_file_only_finished: true,
    signers: [{
      name: signatario.nome,
      email: signatario.email,
      auth_mode: "assinaturaTela",
      send_automatic_email: false,
      lock_name: true,
      lock_email: true,
    }],
  });
  const s = doc?.signers?.[0];
  if (!doc?.token || !s?.sign_url) throw new Error("ZapSign não devolveu o link de assinatura.");
  return { token: doc.token, signUrl: s.sign_url };
}

export async function consultarDocumento(token) {
  const doc = await chamar("GET", `/docs/${encodeURIComponent(token)}/`);
  const s = doc?.signers?.[0] || {};
  return {
    token: doc?.token,
    status: doc?.status,
    idExterno: doc?.external_id,
    arquivoAssinado: doc?.signed_file || null,
    assinadoEm: s.signed_at ? Date.parse(s.signed_at) : null,
    ip: s.ip || "",
  };
}

export async function baixar(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Falha ao baixar o PDF assinado (${r.status}).`);
  return Buffer.from(await r.arrayBuffer());
}

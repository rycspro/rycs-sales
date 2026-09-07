// Motor de auditoria da RYCS.
//
// Substitui a chamada à IA por regras determinísticas. A vantagem não é só
// custo: o resultado é explicável — cada veredito lista exatamente o que
// pesou — e reproduzível, então o mesmo envio dá sempre o mesmo resultado.
//
// O desenho é de sinais com peso. Cada sinal devolve uma evidência positiva
// ou negativa; a soma define o veredito. Sinal nenhum sozinho reprova, o que
// evita que um detalhe de formatação derrube trabalho legítimo.

const DDDS_VALIDOS = new Set([
  11,12,13,14,15,16,17,18,19, 21,22,24, 27,28,
  31,32,33,34,35,37,38, 41,42,43,44,45,46, 47,48,49,
  51,53,54,55, 61, 62,64, 63, 65,66, 67, 68, 69,
  71,73,74,75,77, 79, 81,87, 82, 83, 84, 85,88, 86,89,
  91,93,94, 92,97, 95, 96, 98,99,
]);

const DOMINIOS_VIDEO = [
  "drive.google.com", "docs.google.com", "youtube.com", "youtu.be",
  "loom.com", "dropbox.com", "onedrive.live.com", "1drv.ms",
  "vimeo.com", "streamable.com", "we.tl", "wetransfer.com",
];

const PLACEHOLDERS = /^(teste?|test|asdf|qwerty|abc|xyz|nome|cliente|lorem|exemplo|fulano|ciclano|beltrano|joão da silva|jose da silva|a+|x+|\d+)$/i;
const SEQUENCIA_TECLADO = /(asdf|qwer|zxcv|1234|abcd|poiu|lkjh)/i;

// --------------------------------------------------------------------------
// Validadores estruturais
// --------------------------------------------------------------------------

export function telefoneValido(bruto) {
  const d = String(bruto || "").replace(/\D/g, "").replace(/^55/, "");
  if (d.length !== 10 && d.length !== 11) return { ok: false, motivo: "telefone com quantidade de dígitos inválida" };
  if (/^(\d)\1+$/.test(d)) return { ok: false, motivo: "telefone com todos os dígitos iguais" };
  if (!DDDS_VALIDOS.has(Number(d.slice(0, 2)))) return { ok: false, motivo: "DDD inexistente" };
  // Celular no Brasil tem 9 dígitos e começa com 9.
  if (d.length === 11 && d[2] !== "9") return { ok: false, motivo: "celular sem o 9 inicial" };
  return { ok: true };
}

export function cpfValido(bruto) {
  const c = String(bruto || "").replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (base, peso) => {
    const soma = base.split("").reduce((a, n, i) => a + Number(n) * (peso - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(c.slice(0, 9), 10) === Number(c[9]) && dv(c.slice(0, 10), 11) === Number(c[10]);
}

export function cnpjValido(bruto) {
  const c = String(bruto || "").replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = (base) => {
    let peso = base.length === 12 ? 5 : 6, soma = 0;
    for (const n of base) { soma += Number(n) * peso; peso = peso === 2 ? 9 : peso - 1; }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(c.slice(0, 12)) === Number(c[12]) && dv(c.slice(0, 13)) === Number(c[13]);
}

export function linkValido(bruto) {
  const s = String(bruto || "").trim();
  if (!/^https?:\/\/\S+\.\S+/i.test(s)) return { ok: false, motivo: "link de vídeo ausente ou malformado" };
  try {
    const host = new URL(s).hostname.replace(/^www\./, "");
    const conhecido = DOMINIOS_VIDEO.some((d) => host === d || host.endsWith("." + d));
    return { ok: true, conhecido, host };
  } catch {
    return { ok: false, motivo: "link de vídeo inválido" };
  }
}

export function nomeSuspeito(bruto) {
  const n = String(bruto || "").trim();
  if (n.length < 4) return "nome do cliente muito curto";
  if (PLACEHOLDERS.test(n)) return "nome do cliente é um valor de exemplo";
  if (SEQUENCIA_TECLADO.test(n)) return "nome do cliente parece digitação aleatória";
  if (!/[aeiouáéíóúâêôãõ]/i.test(n)) return "nome do cliente sem vogais";
  return null;
}

// --------------------------------------------------------------------------
// Motor
// --------------------------------------------------------------------------

const LIMIAR_APROVA = 75;
const LIMIAR_REVISA = 45;

export function avaliar({ tipo, prova, camposReq, contexto = {} }) {
  const sinais = [];
  const add = (peso, texto) => sinais.push({ peso, texto });

  // --- Campos obrigatórios ---
  const faltando = camposReq.filter((c) => !String(prova?.[c] || "").trim());
  if (faltando.length) add(-40, `campo obrigatório vazio (${faltando.length})`);
  else add(12, null);

  // --- Vídeo ---
  if (camposReq.includes("video")) {
    const v = linkValido(prova?.video);
    if (!v.ok) add(-45, v.motivo);
    else if (!v.conhecido) add(-8, `vídeo hospedado em domínio incomum (${v.host})`);
    else add(28, null);
  }

  // --- Cliente ---
  if (camposReq.includes("cliente")) {
    const problema = nomeSuspeito(prova?.cliente);
    if (problema) add(-35, problema);
    else {
      add(20, null);
      // Nome completo é sinal de dado real, mas ausência não reprova.
      if (String(prova.cliente).trim().split(/\s+/).length >= 2) add(6, null);
    }
  }

  // --- Telefone ---
  if (camposReq.includes("telefone")) {
    const t = telefoneValido(prova?.telefone);
    if (!t.ok) add(-32, t.motivo);
    else add(20, null);
  }

  // --- Documento (venda) ---
  if (camposReq.includes("documento")) {
    const d = String(prova?.documento || "").replace(/\D/g, "");
    const ok = d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false;
    if (!ok) add(-60, "CPF ou CNPJ com dígito verificador inválido");
    else add(22, null);
  }

  // --- Valor do contrato coerente com o ticket da empresa ---
  if (camposReq.includes("valorContrato")) {
    const v = Number(String(prova?.valorContrato || "").replace(/[^\d,.-]/g, "").replace(",", "."));
    const ticket = Number(contexto.ticketEmpresa) || 0;
    if (!Number.isFinite(v) || v <= 0) add(-25, "valor de contrato ausente ou inválido");
    else if (ticket > 0 && (v > ticket * 10 || v < ticket * 0.1))
      add(-18, "valor do contrato muito fora do ticket médio da empresa");
    else add(14, null);
  }

  // --- Duração da call ---
  if (camposReq.includes("duracao")) {
    const m = Number(String(prova?.duracao || "").replace(/\D/g, ""));
    if (!m || m < 2) add(-30, "call abaixo da duração mínima de 2 minutos");
    else if (m > 180) add(-12, "duração declarada implausível");
    else add(16, null);
  }

  // --- Repetição: o sinal mais forte de fraude ---
  if (contexto.telefoneRepetido) add(-40, "este telefone já foi usado em outra ação sua");
  if (contexto.videoRepetido) add(-70, "este link de vídeo já foi usado em outra ação");
  if (contexto.clienteRepetidoRecente) add(-22, "mesmo cliente registrado há pouco tempo");

  // --- Velocidade ---
  if (contexto.acoesUltimaHora >= 12) add(-30, `volume atípico: ${contexto.acoesUltimaHora} ações na última hora`);
  else if (contexto.acoesUltimaHora >= 7) add(-12, "ritmo acima do normal");

  // --- Histórico do vendedor ---
  if (contexto.primeiraAcaoNaEmpresa) add(-14, "primeira ação nesta empresa");
  if (contexto.totalAprovadas >= 20 && contexto.taxaAprovacao >= 85) add(14, null);
  if (contexto.totalDecididas >= 8 && contexto.taxaAprovacao < 45) add(-20, "histórico recente com muitas recusas");

  // --- Consolidação ---
  const bruto = sinais.reduce((a, s) => a + s.peso, 0);
  const confianca = Math.max(1, Math.min(99, Math.round(50 + bruto * 0.55)));
  const negativos = sinais.filter((s) => s.peso < 0 && s.texto).map((s) => s.texto);

  // Reprovar sem explicar é o pior resultado possível — quem recebe precisa
  // saber o que corrigir.
  const veredito = confianca >= LIMIAR_APROVA ? "aprovado"
    : confianca >= LIMIAR_REVISA ? "revisao"
    : "recusado";

  const motivo = negativos.length
    ? capitalizar(negativos.slice(0, 3).join("; ")) + "."
    : "Dados completos, consistentes e sem sinal de repetição.";

  return { veredito, confianca, motivo, fonte: "regras", sinais: negativos };
}

const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

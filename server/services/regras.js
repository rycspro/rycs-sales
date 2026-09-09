// Motor interno de auditoria.
//
// Ele mede consistência e risco de fraude de maneira determinística. Como não
// consulta telefonia, calendário, CRM ou serviços de vídeo, qualquer prova
// manual aprovada nas regras segue obrigatoriamente para revisão humana.

const DDDS_VALIDOS = new Set([
  11,12,13,14,15,16,17,18,19, 21,22,24,27,28,
  31,32,33,34,35,37,38, 41,42,43,44,45,46,47,48,49,
  51,53,54,55, 61,62,63,64,65,66,67,68,69,
  71,73,74,75,77,79, 81,82,83,84,85,86,87,88,89,
  91,92,93,94,95,96,97,98,99,
]);

const DOMINIOS_VIDEO = [
  "drive.google.com", "docs.google.com", "youtube.com", "youtu.be",
  "loom.com", "dropbox.com", "onedrive.live.com", "1drv.ms",
  "vimeo.com", "streamable.com", "we.tl", "wetransfer.com",
];

const PLACEHOLDERS = /^(teste?|test|asdf|qwerty|abc|xyz|nome|cliente|lorem|exemplo|fulano|ciclano|beltrano|joão da silva|jose da silva|a+|x+|\d+)$/i;
const SEQUENCIA_TECLADO = /(asdf|qwer|zxcv|1234|abcd|poiu|lkjh)/i;

export const LIMITES_PROVA = {
  cliente: 160,
  telefone: 24,
  duracao: 8,
  canal: 40,
  datahora: 48,
  documento: 24,
  valorContrato: 24,
  contrato: 2048,
  video: 2048,
};

const CANAIS_VALIDOS = new Set(["whatsapp", "email", "e-mail", "ligacao", "ligação", "telefone", "linkedin", "instagram", "outro"]);

function textoSeguro(valor, limite) {
  const texto = String(valor ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return texto.slice(0, limite);
}

export function normalizarProva(prova, camposReq = []) {
  if (!prova || typeof prova !== "object" || Array.isArray(prova)) return {};
  return camposReq.reduce((resultado, campo) => {
    resultado[campo] = textoSeguro(prova[campo], LIMITES_PROVA[campo] || 500);
    return resultado;
  }, {});
}

export function telefoneValido(bruto) {
  const d = String(bruto || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length !== 10 && d.length !== 11) return { ok: false, motivo: "telefone com quantidade de dígitos inválida" };
  if (/^(\d)\1+$/.test(d)) return { ok: false, motivo: "telefone com todos os dígitos iguais" };
  if (!DDDS_VALIDOS.has(Number(d.slice(0, 2)))) return { ok: false, motivo: "DDD inexistente" };
  if (d.length === 11 && d[2] !== "9") return { ok: false, motivo: "celular sem o 9 inicial" };
  return { ok: true, normalizado: d };
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
    let peso = base.length === 12 ? 5 : 6;
    let soma = 0;
    for (const n of base) { soma += Number(n) * peso; peso = peso === 2 ? 9 : peso - 1; }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(c.slice(0, 12)) === Number(c[12]) && dv(c.slice(0, 13)) === Number(c[13]);
}

export function linkValido(bruto) {
  const s = String(bruto || "").trim();
  if (!/^https?:\/\/\S+\.\S+/i.test(s)) return { ok: false, motivo: "link ausente ou malformado" };
  try {
    const url = new URL(s);
    if (!["http:", "https:"].includes(url.protocol)) return { ok: false, motivo: "protocolo de link não permitido" };
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const conhecido = DOMINIOS_VIDEO.some((d) => host === d || host.endsWith("." + d));
    return { ok: true, conhecido, host };
  } catch {
    return { ok: false, motivo: "link inválido" };
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

function dataHoraPlausivel(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return { ok: false, motivo: "data e hora ausentes" };
  const iso = Date.parse(texto);
  if (!Number.isNaN(iso)) {
    if (iso > Date.now() + 180 * 24 * 60 * 60 * 1000) return { ok: false, motivo: "data da reunião está muito no futuro" };
    return { ok: true };
  }
  // Mantém compatibilidade com a entrada atual ("22/08 às 15h30"), mas não
  // confunde texto aleatório com um agendamento verificável.
  if (!/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s*(?:às|as)?\s*\d{1,2}(?::|h)\d{2})?$/i.test(texto))
    return { ok: false, motivo: "data e hora em formato não reconhecido" };
  return { ok: true, manual: true };
}

function numeroMonetario(valor) {
  return Number(String(valor || "").replace(/[^\d,.-]/g, "").replace(",", "."));
}

function capitalizar(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function avaliar({ tipo, prova, camposReq, contexto = {} }) {
  const problemas = [];
  const verificacoes = [];
  const fatais = [];
  let penalidade = 0;

  const registrar = (ok, codigo, texto, { fatal = false, peso = 0 } = {}) => {
    verificacoes.push({ codigo, ok, texto });
    if (!ok) {
      problemas.push(texto);
      penalidade += peso;
      if (fatal) fatais.push(texto);
    }
  };

  const faltando = camposReq.filter((campo) => !String(prova?.[campo] || "").trim());
  registrar(!faltando.length, "campos_obrigatorios", faltando.length
    ? `campo obrigatório vazio (${faltando.length})`
    : "campos obrigatórios preenchidos", { fatal: true, peso: 60 });

  for (const campo of camposReq) {
    const limite = LIMITES_PROVA[campo] || 500;
    const bruto = String(prova?.[campo] || "");
    registrar(bruto.length <= limite, `limite_${campo}`, `${campo} excede o limite de tamanho`, { fatal: true, peso: 40 });
  }

  if (camposReq.includes("video")) {
    const video = linkValido(prova?.video);
    registrar(video.ok, "video_valido", video.ok ? "link de vídeo válido" : video.motivo, { fatal: true, peso: 55 });
    if (video.ok) registrar(video.conhecido, "video_origem", video.conhecido
      ? "domínio de vídeo reconhecido"
      : `domínio de vídeo incomum (${video.host})`, { peso: 12 });
  }

  if (camposReq.includes("contrato")) {
    const contrato = linkValido(prova?.contrato);
    registrar(contrato.ok, "contrato_valido", contrato.ok ? "link de contrato ou pagamento válido" : contrato.motivo, { fatal: true, peso: 55 });
  }

  if (camposReq.includes("cliente")) {
    const problema = nomeSuspeito(prova?.cliente);
    registrar(!problema, "cliente_plausivel", problema || "nome do cliente plausível", { fatal: Boolean(problema), peso: 45 });
  }

  if (camposReq.includes("telefone")) {
    const telefone = telefoneValido(prova?.telefone);
    registrar(telefone.ok, "telefone_valido", telefone.ok ? "telefone estruturalmente válido" : telefone.motivo, { fatal: true, peso: 45 });
  }

  if (camposReq.includes("documento")) {
    const documento = String(prova?.documento || "").replace(/\D/g, "");
    const valido = documento.length === 11 ? cpfValido(documento) : documento.length === 14 ? cnpjValido(documento) : false;
    registrar(valido, "documento_valido", valido ? "documento com dígito verificador válido" : "CPF ou CNPJ com dígito verificador inválido", { fatal: true, peso: 65 });
  }

  if (camposReq.includes("duracao")) {
    const minutos = Number(String(prova?.duracao || "").replace(/\D/g, ""));
    registrar(minutos >= 2 && minutos <= 180, "duracao_plausivel", minutos >= 2 && minutos <= 180
      ? "duração declarada dentro da faixa"
      : minutos < 2 ? "call abaixo da duração mínima de 2 minutos" : "duração declarada implausível", { fatal: minutos < 2, peso: 35 });
  }

  if (camposReq.includes("canal")) {
    const canal = String(prova?.canal || "").trim().toLowerCase();
    registrar(CANAIS_VALIDOS.has(canal), "canal_reconhecido", CANAIS_VALIDOS.has(canal)
      ? "canal declarado reconhecido"
      : "canal de follow-up não reconhecido", { peso: 18 });
  }

  if (camposReq.includes("datahora")) {
    const dataHora = dataHoraPlausivel(prova?.datahora);
    registrar(dataHora.ok, "datahora_plausivel", dataHora.ok
      ? dataHora.manual ? "data e hora exigem validação humana" : "data e hora plausíveis"
      : dataHora.motivo, { fatal: !dataHora.ok, peso: 30 });
  }

  if (camposReq.includes("valorContrato")) {
    const valor = numeroMonetario(prova?.valorContrato);
    const ticket = Number(contexto.ticketEmpresa) || 0;
    registrar(Number.isFinite(valor) && valor > 0, "valor_valido", Number.isFinite(valor) && valor > 0
      ? "valor do contrato válido"
      : "valor de contrato ausente ou inválido", { fatal: true, peso: 35 });
    if (Number.isFinite(valor) && valor > 0 && ticket > 0) {
      registrar(valor >= ticket * 0.1 && valor <= ticket * 10, "valor_ticket", valor >= ticket * 0.1 && valor <= ticket * 10
        ? "valor compatível com o ticket da empresa"
        : "valor do contrato muito fora do ticket médio da empresa", { peso: 22 });
    }
  }

  registrar(!contexto.provaRepetida, "prova_unica", contexto.provaRepetida
    ? "esta comprovação já foi enviada anteriormente"
    : "snapshot de prova não encontrado em outra ação", { fatal: Boolean(contexto.provaRepetida), peso: 70 });
  registrar(!contexto.videoRepetido, "video_unico", contexto.videoRepetido
    ? "este vídeo ou link canônico já foi usado em outra ação"
    : "vídeo não reutilizado no histórico", { fatal: Boolean(contexto.videoRepetido), peso: 65 });
  registrar(!contexto.contatoMesmoTipo24h, "contato_frequencia", contexto.contatoMesmoTipo24h
    ? "mesmo contato recebeu ações equivalentes nas últimas 24 horas"
    : "frequência por contato dentro do limite", { peso: 30 });
  registrar(!contexto.documentoRepetido, "documento_duplicidade", contexto.documentoRepetido
    ? "documento já aparece em outra venda recente"
    : "documento sem duplicidade recente", { peso: 35 });
  registrar(!contexto.volumeAtipico, "volume_vendedor", contexto.volumeAtipico
    ? `volume atípico: ${contexto.acoesUltimaHora} ações na última hora`
    : "volume do vendedor dentro da faixa", { peso: 30 });
  registrar(Boolean(contexto.leadId), "lead_vinculado", contexto.leadId
    ? "ação vinculada a um lead interno"
    : "ação sem lead interno vinculado", { peso: 18 });

  if (contexto.primeiraAcaoNaEmpresa) {
    problemas.push("primeira ação nesta empresa exige conferência reforçada");
    penalidade += 12;
  }
  if (contexto.totalDecididas >= 8 && contexto.taxaAprovacao < 45) {
    problemas.push("histórico recente com muitas recusas");
    penalidade += 20;
  }

  const confianca = Math.max(1, Math.min(99, Math.round(92 - penalidade)));
  const risco = fatais.length ? "critico"
    : penalidade >= 65 ? "alto"
      : penalidade >= 25 ? "medio"
        : "baixo";
  const veredito = fatais.length ? "recusado" : "revisao";
  const motivo = fatais.length
    ? capitalizar(fatais.slice(0, 3).join("; ")) + "."
    : problemas.length
      ? capitalizar(problemas.slice(0, 3).join("; ")) + "."
      : "Evidência estruturalmente consistente; aguarda revisão humana.";

  return {
    veredito,
    confianca,
    motivo,
    fonte: "regras_internas",
    risco,
    exigeRevisaoHumana: true,
    sinais: problemas,
    verificacoes,
  };
}

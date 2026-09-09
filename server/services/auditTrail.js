import { createHash, createHmac } from "crypto";
import db, { uid, agora } from "../db.js";
import { VERSAO_AUDITORIA } from "../../shared/auditoria.js";

// A chave não é exposta ao cliente. Em produção, AUDIT_HMAC_SECRET deve ser
// distinta da chave de sessão; o fallback mantém instalações existentes
// funcionais e ainda usa a chave privada de JWT quando ela estiver definida.
const segredoAuditoria =
  process.env.AUDIT_HMAC_SECRET ||
  process.env.JWT_SECRET ||
  "rycs-audit-development-key-change-me";

function normalizarValor(valor) {
  if (Array.isArray(valor)) return valor.map(normalizarValor);
  if (valor && typeof valor === "object") {
    return Object.keys(valor).sort().reduce((acc, chave) => {
      acc[chave] = normalizarValor(valor[chave]);
      return acc;
    }, {});
  }
  return valor;
}

export function serializarEstavel(valor) {
  return JSON.stringify(normalizarValor(valor));
}

export function sha256(valor) {
  return createHash("sha256").update(String(valor)).digest("hex");
}

export function hmacAuditoria(valor) {
  return createHmac("sha256", segredoAuditoria).update(String(valor)).digest("hex");
}

export function normalizarTelefone(valor) {
  return String(valor || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
}

export function normalizarDocumento(valor) {
  return String(valor || "").replace(/\D/g, "");
}

export function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizarUrl(valor) {
  const bruto = normalizarTexto(valor);
  try {
    const url = new URL(bruto);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";

    // Remove apenas parâmetros de rastreamento. Parâmetros de acesso e de
    // identificação do arquivo continuam no hash para não alterar o link.
    for (const chave of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_[ce]id$)/i.test(chave)) url.searchParams.delete(chave);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

export function tokenSensivel(tipo, valor) {
  const normalizado = tipo === "telefone"
    ? normalizarTelefone(valor)
    : tipo === "documento"
      ? normalizarDocumento(valor)
      : normalizarTexto(valor).toLowerCase();
  return normalizado ? hmacAuditoria(`${tipo}:${normalizado}`) : "";
}

export function hashDaProva(prova) {
  return sha256(serializarEstavel(prova));
}

function metadadosDaEvidencia(campo, valor) {
  const texto = normalizarTexto(valor);
  const url = /^(video|contrato)$/.test(campo) ? canonicalizarUrl(texto) : "";
  return {
    campo,
    tipo: url ? "url_externa" : "declaracao",
    tamanho: texto.length,
    host: url ? new URL(url).hostname : "",
    // Conteúdo externo não é baixado pela plataforma; esta marca impede que
    // uma URL seja confundida com um arquivo que foi verificado internamente.
    verificacaoDeConteudo: "nao_disponivel",
  };
}

export function registrarEvidencias({ submissionId, prova, actorId, criadoEm = agora() }) {
  for (const [campo, valor] of Object.entries(prova || {})) {
    const texto = normalizarTexto(valor);
    const canonical = campo === "telefone"
      ? normalizarTelefone(texto)
      : campo === "documento"
        ? normalizarDocumento(texto)
        : /^(video|contrato)$/.test(campo)
          ? canonicalizarUrl(texto) || texto
          : texto;
    const metadados = metadadosDaEvidencia(campo, texto);
    // HMAC, e não hash simples: telefone e documento têm espaço de busca
    // pequeno e um SHA-256 puro permitiria tentativa offline de reversão.
    const valueHash = hmacAuditoria(`evidencia:${campo}:${canonical}`);
    const hash = hmacAuditoria(serializarEstavel({ submissionId, campo, valueHash, metadados, criadoEm }));
    db.prepare(`
      INSERT INTO submission_evidence
        (id, submissionId, campo, origem, valueHash, metadados, hash, criadoPor, criadoEm)
      VALUES (?, ?, ?, 'vendedor', ?, ?, ?, ?, ?)
    `).run(uid(), submissionId, campo, valueHash, JSON.stringify(metadados), hash, actorId, criadoEm);
  }
}

function materialDoEvento({ id, submissionId, sequencia, tipo, atorId, atorRole, statusAnterior, statusNovo, motivoCodigo, observacao, checklist, dados, criadoEm, hashAnterior }) {
  return {
    versao: VERSAO_AUDITORIA,
    id,
    submissionId,
    sequencia,
    tipo,
    atorId: atorId || null,
    atorRole: atorRole || "sistema",
    statusAnterior: statusAnterior || null,
    statusNovo: statusNovo || null,
    motivoCodigo: motivoCodigo || "",
    observacao: observacao || "",
    checklist: checklist || [],
    dados: dados || {},
    criadoEm,
    hashAnterior: hashAnterior || "",
  };
}

// Só há INSERT nesta função. Nenhuma rota expõe atualização ou exclusão da
// cadeia; cada decisão posterior cria um novo evento encadeado.
export function registrarEventoAuditoria({
  submissionId,
  tipo,
  actorId = null,
  actorRole = "sistema",
  statusAnterior = null,
  statusNovo = null,
  motivoCodigo = "",
  observacao = "",
  checklist = [],
  dados = {},
  criadoEm = agora(),
}) {
  const anterior = db.prepare(
    "SELECT sequencia, hash FROM submission_events WHERE submissionId = ? ORDER BY sequencia DESC LIMIT 1"
  ).get(submissionId);
  const id = uid();
  const sequencia = (anterior?.sequencia || 0) + 1;
  const hashAnterior = anterior?.hash || "";
  const material = materialDoEvento({
    id, submissionId, sequencia, tipo, actorId, atorRole: actorRole,
    statusAnterior, statusNovo, motivoCodigo, observacao, checklist, dados,
    criadoEm, hashAnterior,
  });
  const hash = hmacAuditoria(serializarEstavel(material));

  db.prepare(`
    INSERT INTO submission_events
      (id, submissionId, sequencia, tipo, atorId, atorRole, statusAnterior, statusNovo,
       motivoCodigo, observacao, checklist, dados, hashAnterior, hash, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, submissionId, sequencia, tipo, actorId, actorRole, statusAnterior, statusNovo,
    motivoCodigo, observacao, JSON.stringify(checklist), JSON.stringify(dados), hashAnterior, hash, criadoEm
  );
  return { id, sequencia, hash };
}

export function verificarTrilhaAuditoria(submissionId) {
  const eventos = db.prepare(
    "SELECT * FROM submission_events WHERE submissionId = ? ORDER BY sequencia ASC"
  ).all(submissionId);
  let hashAnterior = "";

  for (const evento of eventos) {
    let checklist = [];
    let dados = {};
    try { checklist = JSON.parse(evento.checklist || "[]"); } catch { return { integra: false, eventos: eventos.length, erro: "Checklist corrompido" }; }
    try { dados = JSON.parse(evento.dados || "{}"); } catch { return { integra: false, eventos: eventos.length, erro: "Dados corrompidos" }; }
    if (evento.hashAnterior !== hashAnterior) return { integra: false, eventos: eventos.length, erro: "Cadeia de hashes interrompida" };

    const material = materialDoEvento({
      id: evento.id,
      submissionId: evento.submissionId,
      sequencia: evento.sequencia,
      tipo: evento.tipo,
      actorId: evento.atorId,
      atorRole: evento.atorRole,
      statusAnterior: evento.statusAnterior,
      statusNovo: evento.statusNovo,
      motivoCodigo: evento.motivoCodigo,
      observacao: evento.observacao,
      checklist,
      dados,
      criadoEm: evento.criadoEm,
      hashAnterior: evento.hashAnterior,
    });
    if (hmacAuditoria(serializarEstavel(material)) !== evento.hash)
      return { integra: false, eventos: eventos.length, erro: "Hash de evento inválido" };
    hashAnterior = evento.hash;
  }

  return { integra: true, eventos: eventos.length, hashFinal: hashAnterior || null };
}

export function resumoEvidencias(submissionId) {
  return db.prepare(
    "SELECT campo, origem, valueHash, metadados, hash, criadoEm FROM submission_evidence WHERE submissionId = ? ORDER BY criadoEm ASC"
  ).all(submissionId).map((e) => ({
    ...e,
    metadados: JSON.parse(e.metadados || "{}"),
  }));
}

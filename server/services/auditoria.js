import db from "../db.js";
import { ACOES } from "../../shared/acoes.js";
import { VERSAO_AUDITORIA } from "../../shared/auditoria.js";
import { avaliar, normalizarProva } from "./regras.js";
import { canonicalizarUrl, hashDaProva, hmacAuditoria, normalizarDocumento, normalizarTelefone } from "./auditTrail.js";

const UMA_HORA = 60 * 60 * 1000;
const UM_DIA = 24 * UMA_HORA;
const NOVENTA_DIAS = 90 * UM_DIA;

function hashEvidencia(campo, valor) {
  return hmacAuditoria(`evidencia:${campo}:${valor}`);
}

function existeEvidencia({ campo, valor, tipo, desde = 0 }) {
  if (!valor) return false;
  const valorHash = hashEvidencia(campo, valor);
  const query = tipo
    ? `SELECT 1
         FROM submission_evidence e
         JOIN submissions s ON s.id = e.submissionId
        WHERE e.campo = ? AND e.valueHash = ? AND s.tipo = ? AND e.criadoEm >= ?
        LIMIT 1`
    : `SELECT 1 FROM submission_evidence WHERE campo = ? AND valueHash = ? AND criadoEm >= ? LIMIT 1`;
  const row = tipo
    ? db.prepare(query).get(campo, valorHash, tipo, desde)
    : db.prepare(query).get(campo, valorHash, desde);
  return Boolean(row);
}

function montarContexto({ sellerId, companyId, leadId, prova, tipo, proofHash, evidencias }) {
  const telefone = normalizarTelefone(prova?.telefone);
  const documento = normalizarDocumento(prova?.documento);
  const video = canonicalizarUrl(prova?.video);
  const agora = Date.now();

  // Foto sem horário/GPS no EXIF (ex: reenviada pelo WhatsApp ou Instagram,
  // que apagam esses dados) não tem lastro de câmera — é um sinal de risco
  // para a triagem ponderar, não um motivo de recusa por si só.
  const fotosSemMetadados = (evidencias || []).filter((e) =>
    String(e?.valor || "").startsWith("data:image") && !e?.metadata?.capturadoEm && e?.metadata?.latitude == null
  ).length;
  const totalFotos = (evidencias || []).filter((e) => String(e?.valor || "").startsWith("data:image")).length;

  const anteriores = db.prepare(
    "SELECT companyId, criadoEm, status FROM submissions WHERE sellerId = ? ORDER BY criadoEm DESC LIMIT 200"
  ).all(sellerId);
  const acoesUltimaHora = anteriores.filter((a) => agora - a.criadoEm < UMA_HORA).length;
  const decididas = anteriores.filter((a) => ["liberado", "recusado", "ia_recusado"].includes(a.status));
  const aprovadas = anteriores.filter((a) => a.status === "liberado");
  const empresa = db.prepare("SELECT ticket FROM companies WHERE id = ?").get(companyId);

  return {
    leadId: leadId || null,
    ticketEmpresa: Number(String(empresa?.ticket || "").replace(/[^\d]/g, "")) || 0,
    provaRepetida: Boolean(db.prepare("SELECT 1 FROM submissions WHERE proofHash = ? LIMIT 1").get(proofHash)),
    videoRepetido: Boolean(video && existeEvidencia({ campo: "video", valor: video })),
    contatoMesmoTipo24h: Boolean(telefone && existeEvidencia({ campo: "telefone", valor: telefone, tipo, desde: agora - UM_DIA })),
    documentoRepetido: Boolean(documento && existeEvidencia({ campo: "documento", valor: documento, tipo: "venda", desde: agora - NOVENTA_DIAS })),
    acoesUltimaHora,
    volumeAtipico: acoesUltimaHora >= 7,
    primeiraAcaoNaEmpresa: !anteriores.some((a) => a.companyId === companyId),
    totalDecididas: decididas.length,
    totalAprovadas: aprovadas.length,
    taxaAprovacao: decididas.length ? Math.round((aprovadas.length / decididas.length) * 100) : 100,
    totalFotos,
    fotosSemMetadados,
  };
}

export async function auditar({ tipo, prova, sellerId, companyId, leadId = null }) {
  const acao = ACOES[tipo];
  if (!acao) {
    return {
      veredito: "recusado",
      confianca: 1,
      motivo: "Tipo de ação desconhecido.",
      fonte: "regras_internas",
      risco: "critico",
      sinais: ["tipo de ação desconhecido"],
      verificacoes: [],
      provaNormalizada: {},
      proofHash: "",
      auditVersion: VERSAO_AUDITORIA,
    };
  }

  const provaNormalizada = normalizarProva(prova, acao.prova);
  const proofHash = hashDaProva(provaNormalizada);
  const contexto = montarContexto({ sellerId, companyId, leadId, prova: provaNormalizada, tipo, proofHash, evidencias: prova?.evidencias });
  const resultado = avaliar({ tipo, prova: provaNormalizada, camposReq: acao.prova, contexto });
  return {
    ...resultado,
    provaNormalizada,
    proofHash,
    auditVersion: VERSAO_AUDITORIA,
    contexto: {
      leadVinculado: Boolean(leadId),
      acoesUltimaHora: contexto.acoesUltimaHora,
      primeiraAcaoNaEmpresa: contexto.primeiraAcaoNaEmpresa,
      totalFotos: contexto.totalFotos,
      fotosSemMetadados: contexto.fotosSemMetadados,
    },
  };
}

// Não existe aprovação automática para evidência manual. O nome legado
// ia_aprovado é mantido apenas para submissões históricas já gravadas.
export const statusDoVeredito = (veredito) => veredito === "recusado" ? "ia_recusado" : "revisao";

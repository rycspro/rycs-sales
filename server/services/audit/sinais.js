// Sinais antifraude que dependem do banco.
//
// O que é cálculo puro — distância, leitura de metadados — vive em
// shared/audit/geo.js. Aqui fica o que precisa consultar ou gravar: reuso de
// evidência e persistência dos sinais.
//
// Nenhum sinal isolado reprova. Todos viram veredicto de critério e a decisão
// sai do conjunto, no Scoring Engine.

import { createHash } from "crypto";
import db, { uid, agora } from "../../db.js";
import { RESULTADOS } from "../../../shared/audit/scoring.js";
import { SEVERIDADE } from "../../../shared/audit/geo.js";

export { SEVERIDADE, distanciaMetros, avaliarGeo, avaliarMetadados, TOLERANCIA_PADRAO_METROS } from "../../../shared/audit/geo.js";

export function hashConteudo(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

// Reuso de evidência. O hash exato pega o arquivo idêntico; o perceptual, que
// ainda não temos, pegaria o recorte e o reenquadramento. A coluna já existe
// para quando entrar.
export function avaliarReuso({ hash, sellerId, auditRequestId }) {
  if (!hash) {
    return { resultado: RESULTADOS.inconclusivo, confianca: 0, detalhe: "Evidência sem hash calculado.", sinais: [] };
  }

  const anteriores = db.prepare(`
    SELECT e.id, e.criadoEm, r.sellerId, r.taskId
    FROM audit_evidences e
    JOIN audit_requests r ON r.id = e.auditRequestId
    WHERE e.hash = ? AND e.auditRequestId != ?
    ORDER BY e.criadoEm ASC LIMIT 20
  `).all(hash, auditRequestId || "");

  if (!anteriores.length) {
    return { resultado: RESULTADOS.atendido, confianca: 1, detalhe: "Evidência inédita na plataforma.", sinais: [] };
  }

  const doMesmo = anteriores.filter((a) => a.sellerId === sellerId);
  const deOutros = anteriores.filter((a) => a.sellerId !== sellerId);

  const sinais = [];
  if (deOutros.length) {
    sinais.push({
      chave: "IMAGE_DUPLICATE",
      valor: String(deOutros.length),
      severidade: SEVERIDADE.critico,
      detalhe: `Mesma evidência já enviada por outro profissional (${deOutros.length} ocorrência(s)).`,
    });
  }
  if (doMesmo.length) {
    sinais.push({
      chave: "EVIDENCE_REUSED",
      valor: String(doMesmo.length),
      severidade: SEVERIDADE.atencao,
      detalhe: `O próprio profissional já usou esta evidência ${doMesmo.length} vez(es).`,
    });
  }

  return {
    resultado: RESULTADOS.negado,
    // Evidência de outra pessoa é sinal mais forte que reuso próprio: o
    // segundo pode ser engano de upload, o primeiro dificilmente.
    confianca: deOutros.length ? 0.98 : 0.85,
    detalhe: deOutros.length
      ? "Esta imagem já foi enviada por outro profissional."
      : "Esta imagem já havia sido enviada por você em outra ação.",
    sinais,
  };
}

export function persistirSinais(auditRequestId, sinais = []) {
  const ins = db.prepare(
    "INSERT INTO audit_signals (id, auditRequestId, chave, valor, severidade, detalhe, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const ts = agora();
  for (const s of sinais.filter(Boolean)) {
    ins.run(uid(), auditRequestId, s.chave, String(s.valor ?? ""), s.severidade || SEVERIDADE.info, String(s.detalhe || "").slice(0, 500), ts);
  }
}

export function sinaisDe(auditRequestId) {
  return db.prepare("SELECT chave, valor, severidade, detalhe, criadoEm FROM audit_signals WHERE auditRequestId = ? ORDER BY criadoEm ASC").all(auditRequestId);
}

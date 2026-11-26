// Preenche o segmento de empresas que ficaram sem ele, deduzindo do texto
// que a própria empresa cadastrou (ver inferirSegmentoEmpresa). Só escreve
// onde o segmento está vazio: nunca troca o que a empresa ou o admin escolheu.
import db from "../db.js";
import { inferirSegmentoEmpresa } from "../../shared/segmentos.js";

const VAZIO = "(segmento IS NULL OR TRIM(segmento) = '')";

export function preencherSegmentosVazios(ids = null) {
  const campos = "id, nome, razaoSocial, produto, descricaoInstitucional, cnaes, segmento, nicho";
  const linhas = ids?.length
    ? db.prepare(`SELECT ${campos} FROM companies WHERE ${VAZIO} AND id IN (${ids.map(() => "?").join(",")})`).all(...ids)
    : db.prepare(`SELECT ${campos} FROM companies WHERE ${VAZIO}`).all();
  if (!linhas.length) return [];

  const atualizar = db.prepare(`UPDATE companies SET segmento = ?,
    nicho = CASE WHEN nicho IS NULL OR TRIM(nicho) = '' THEN ? ELSE nicho END
    WHERE id = ? AND ${VAZIO}`);
  const alteradas = [];
  db.transaction(() => {
    for (const c of linhas) {
      const inferido = inferirSegmentoEmpresa(c);
      if (!inferido) continue;
      atualizar.run(inferido.segmento, inferido.nicho || "", c.id);
      const nicho = String(c.nicho || "").trim() || inferido.nicho || "";
      alteradas.push({ id: c.id, segmento: inferido.segmento, nicho });
    }
  })();
  return alteradas;
}

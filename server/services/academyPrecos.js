// Aplica a tabela de preços (shared/academy/precos.js) aos 24 cursos da grade
// de 134h. Só mexe no curso que ainda está como saiu da semente: pago com preço
// zero, ou gratuito por padrão. Curso que o admin já precificou ou tornou
// gratuito não é tocado, e rodar de novo não muda nada.

import { PRECOS_ACADEMY, slugAcademy } from "../../shared/academy/precos.js";

export function aplicarPrecosAcademy(db, agora) {
  let alterados = 0;
  const ajustar = db.prepare(`UPDATE courses SET gratuito = ?, preco = ?, atualizadoEm = ?
    WHERE slug = ? AND (companyId IS NULL OR companyId = '')
    AND gratuito = 0 AND (preco IS NULL OR preco = 0)`);
  for (const [n, preco] of Object.entries(PRECOS_ACADEMY)) {
    alterados += ajustar.run(preco > 0 ? 0 : 1, preco, agora(), slugAcademy(n)).changes;
  }
  return alterados;
}

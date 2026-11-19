import db from "../db.js";

// Foto, foto original, currículo e vídeo de apresentação são data URIs (o
// vídeo chega a dezenas de MB). Quem só precisa saber se existem não pode ler
// essas colunas: o SQLite é síncrono e cada leitura dessas travava o servidor
// para todos. Aqui elas viram 1/0 direto na consulta.
export const PESADAS_SELLER = ["foto", "fotoOriginal", "curriculo", "videoApresentacao"];

let SELECT_SELLER;
export function selectSellers(where = "") {
  SELECT_SELLER ||= `SELECT ${db.prepare("PRAGMA table_info(sellers)").all()
    .map((c) => c.name)
    .map((n) => PESADAS_SELLER.includes(n) ? `(${n} IS NOT NULL AND ${n} != '') AS ${n}` : n)
    .join(", ")} FROM sellers`;
  return `${SELECT_SELLER} ${where}`;
}

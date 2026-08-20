import db, { agora } from "../db.js";

const DIMENSIONS = ["performance", "conhecimento", "comunicacao", "confiabilidade", "conversao", "qualidade", "consistencia"];
const ROLES = ["sdr", "bdr", "closer", "pap"];
const LEVELS = [
  { key: "starter", label: "RYCS Starter", minScore: 0, minActions: 0 },
  { key: "pro", label: "RYCS Pro", minScore: 60, minActions: 20 },
  { key: "expert", label: "RYCS Expert", minScore: 75, minActions: 50 },
  { key: "elite", label: "RYCS Elite", minScore: 85, minActions: 100 },
];

export function recalcularScore(sellerId) {
  const subs = db.prepare("SELECT * FROM submissions WHERE sellerId = ?").all(sellerId);
  const seller = db.prepare("SELECT * FROM sellers WHERE id = ?").get(sellerId);
  if (!seller) return;

  const now = agora();
  const dia30 = now - 86400000 * 30;
  const dia90 = now - 86400000 * 90;

  const todas = subs.length;
  const liberadas = subs.filter((s) => s.status === "liberado");
  const recusadas = subs.filter((s) => s.status === "recusado" || s.status === "ia_recusado");
  const recentes = subs.filter((s) => s.criadoEm > dia30);
  const recentes90 = subs.filter((s) => s.criadoEm > dia90);

  const performance = todas > 0
    ? Math.round(Math.min(100, (liberadas.length / Math.max(todas, 1)) * 100 * 1.1))
    : 0;

  const conhecimento = Math.min(100, Math.round(
    (liberadas.filter((s) => s.confianca && s.confianca >= 80).length / Math.max(liberadas.length, 1)) * 100
  ));

  const comunicacao = Math.min(100, Math.round(
    liberadas.length > 0 ? (liberadas.reduce((a, s) => a + (s.confianca || 50), 0) / liberadas.length) : 50
  ));

  const confiabilidade = Math.min(100, Math.round(
    100 - (recusadas.length / Math.max(todas, 1)) * 100
  ));

  const vendas = liberadas.filter((s) => s.tipo === "venda").length;
  const reunioes = liberadas.filter((s) => s.tipo === "realizada" || s.tipo === "agendamento").length;
  const conversao = Math.min(100, Math.round(
    reunioes > 0 ? (vendas / reunioes) * 100 : vendas > 0 ? 70 : 30
  ));

  const altaConfianca = liberadas.filter((s) => s.confianca && s.confianca >= 85).length;
  const qualidade = Math.min(100, Math.round(
    (altaConfianca / Math.max(liberadas.length, 1)) * 100
  ));

  const mesesAtivos = new Set(recentes90.map((s) => {
    const d = new Date(s.criadoEm);
    return `${d.getFullYear()}-${d.getMonth()}`;
  })).size;
  const consistencia = Math.min(100, Math.round((mesesAtivos / 3) * 100));

  const scores = { performance, conhecimento, comunicacao, confiabilidade, conversao, qualidade, consistencia };
  const role = seller.perfil || "geral";

  const upsert = db.prepare(`
    INSERT INTO score_dimensions (sellerId, dimension, valor, role, atualizadoEm)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(sellerId, dimension, role) DO UPDATE SET valor = ?, atualizadoEm = ?
  `);

  const now2 = agora();
  for (const [dim, val] of Object.entries(scores)) {
    upsert.run(sellerId, dim, val, role, now2, val, now2);
  }

  const pesoRecente = recentes.length > 0 ? 1.15 : 1;
  const notaGeral = Math.round(
    (performance * 0.2 + conhecimento * 0.1 + comunicacao * 0.1 +
     confiabilidade * 0.15 + conversao * 0.2 + qualidade * 0.15 + consistencia * 0.1)
    * pesoRecente
  );
  const notaFinal = Math.min(100, notaGeral);

  const nivel = calcularNivel(notaFinal, liberadas.length);

  db.prepare("UPDATE sellers SET nota = ?, nivel = ? WHERE id = ?").run(notaFinal, nivel, sellerId);

  return { nota: notaFinal, nivel, scores };
}

function calcularNivel(score, totalActions) {
  let nivel = "starter";
  for (const l of LEVELS) {
    if (score >= l.minScore && totalActions >= l.minActions) nivel = l.key;
  }
  return nivel;
}

export function getScoreDetalhado(sellerId) {
  const rows = db.prepare("SELECT * FROM score_dimensions WHERE sellerId = ?").all(sellerId);
  const seller = db.prepare("SELECT nota, nivel FROM sellers WHERE id = ?").get(sellerId);
  const byRole = {};
  rows.forEach((r) => {
    if (!byRole[r.role]) byRole[r.role] = {};
    byRole[r.role][r.dimension] = r.valor;
  });
  return { nota: seller?.nota || 0, nivel: seller?.nivel || "starter", dimensions: byRole };
}

export { DIMENSIONS, ROLES, LEVELS };

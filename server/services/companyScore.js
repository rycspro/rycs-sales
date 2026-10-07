import db, { agora } from "../db.js";

// Company Score — a contraparte do score do profissional, para que a
// reputação valha nos dois sentidos. Uma empresa que recusa demais, demora a
// conferir ou opera sem caixa prejudica quem trabalha nela, e isso precisa
// ficar visível antes que o profissional aceite a campanha.
export const DIMENSOES_EMPRESA = [
  "pagamento",     // mantém caixa suficiente para honrar as ações
  "conferencia",   // confere no prazo em vez de deixar parado
  "aprovacao",     // proporção de ações aceitas
  "clareza",       // campanhas com treinamento e regras definidas
  "retencao",      // profissionais que seguem ativos com ela
];

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const limitar = (n) => Math.max(0, Math.min(100, Math.round(n)));

export function recalcularCompanyScore(companyId) {
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
  if (!empresa) return null;

  const subs = db.prepare("SELECT * FROM submissions WHERE companyId = ?").all(companyId);
  const liberadas = subs.filter((s) => s.status === "liberado");
  const recusadas = subs.filter((s) => s.status === "recusado" || s.status === "ia_recusado");
  const decididas = liberadas.length + recusadas.length;
  const paradas = subs.filter((s) => s.status === "revisao" || s.status === "conferido");

  // Sem histórico, a empresa começa em patamar neutro em vez de zero — nota
  // baixa por ausência de dados puniria quem acabou de entrar.
  if (subs.length === 0) {
    const neutro = 100;
    gravar(companyId, Object.fromEntries(DIMENSOES_EMPRESA.map((d) => [d, neutro])));
    db.prepare("UPDATE companies SET nota = ? WHERE id = ?").run(neutro, companyId);
    return { nota: neutro, dimensoes: Object.fromEntries(DIMENSOES_EMPRESA.map((d) => [d, neutro])) };
  }

  // Caixa suficiente para cobrir o que ainda está em aberto.
  const emAberto = paradas.reduce((a, s) => a + (s.valor || 0), 0);
  const pagamento = emAberto === 0
    ? (empresa.saldo > 0 ? 100 : 60)
    : limitar((empresa.saldo / emAberto) * 100);

  // Quanto do que chegou já foi decidido.
  const conferencia = limitar(pct(decididas, subs.length));

  // Aceitação: recusar tudo é tão ruim quanto aprovar tudo sem olhar.
  const taxaAprov = pct(liberadas.length, Math.max(1, decididas));
  const aprovacao = limitar(taxaAprov < 30 ? taxaAprov * 1.5 : taxaAprov);

  // Campanha bem descrita reduz retrabalho de quem executa.
  const curso = JSON.parse(empresa.curso || "[]");
  const comissoes = JSON.parse(empresa.comissoes || "{}");
  const clareza = limitar(
    (curso.length > 0 ? 45 : 0) +
    (Object.keys(comissoes).length > 0 ? 35 : 0) +
    (empresa.icp ? 20 : 0)
  );

  // Profissionais aprovados que seguem enviando ações.
  const aprovados = db.prepare("SELECT COUNT(*) n FROM applications WHERE companyId = ? AND status = 'aprovado'").get(companyId).n;
  const ativos = new Set(liberadas.map((s) => s.sellerId)).size;
  const retencao = aprovados === 0 ? 70 : limitar(pct(ativos, aprovados));

  const dimensoes = { pagamento, conferencia, aprovacao, clareza, retencao };
  gravar(companyId, dimensoes);

  const nota = limitar(
    pagamento * 0.3 + conferencia * 0.25 + aprovacao * 0.2 + clareza * 0.15 + retencao * 0.1
  );
  db.prepare("UPDATE companies SET nota = ? WHERE id = ?").run(nota, companyId);

  return { nota, dimensoes };
}

function gravar(companyId, dimensoes) {
  const upsert = db.prepare(`
    INSERT INTO company_score_dimensions (companyId, dimension, valor, atualizadoEm)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(companyId, dimension) DO UPDATE SET valor = ?, atualizadoEm = ?
  `);
  const now = agora();
  for (const [dim, val] of Object.entries(dimensoes)) upsert.run(companyId, dim, val, now, val, now);
}

export function getCompanyScore(companyId) {
  const rows = db.prepare("SELECT * FROM company_score_dimensions WHERE companyId = ?").all(companyId);
  const empresa = db.prepare("SELECT nota FROM companies WHERE id = ?").get(companyId);
  const dimensoes = {};
  rows.forEach((r) => { dimensoes[r.dimension] = r.valor; });
  return { nota: empresa?.nota || 0, dimensoes };
}

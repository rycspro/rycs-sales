import db, { uid, agora } from "../db.js";

const dinheiro = (valor) => Math.round((Number(valor) || 0) * 100) / 100;

export function posicaoEmpresa(companyId) {
  const empresa = db.prepare("SELECT saldo, saldoReservado FROM companies WHERE id = ?").get(companyId);
  if (!empresa) return null;
  const saldo = dinheiro(empresa.saldo);
  const reservado = dinheiro(empresa.saldoReservado);
  return { saldo, reservado, disponivel: dinheiro(Math.max(0, saldo - reservado)) };
}

function registrar({ companyId, sellerId = null, submissionId = null, tipo, valor, idempotencyKey, dados = {} }) {
  const empresa = companyId ? db.prepare("SELECT saldo, saldoReservado FROM companies WHERE id = ?").get(companyId) : null;
  const vendedor = sellerId ? db.prepare("SELECT disponivel FROM sellers WHERE id = ?").get(sellerId) : null;
  db.prepare(`INSERT OR IGNORE INTO financial_ledger
    (id, companyId, sellerId, submissionId, tipo, valor, saldoEmpresa, reservadoEmpresa, saldoProfissional, idempotencyKey, dados, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(uid(), companyId, sellerId, submissionId, tipo, dinheiro(valor),
      empresa?.saldo ?? null, empresa?.saldoReservado ?? null, vendedor?.disponivel ?? null,
      idempotencyKey || null, JSON.stringify(dados), agora());
}

export function reservarParaSubmissao({ companyId, sellerId, submissionId, valor }) {
  const bruto = dinheiro(valor);
  const movimento = db.prepare("SELECT COALESCE(SUM(valor), 0) total FROM financial_ledger WHERE submissionId = ? AND tipo IN ('reserva','estorno_reserva','liquidacao')").get(submissionId).total;
  if (dinheiro(movimento) >= bruto) return posicaoEmpresa(companyId);
  const posicao = posicaoEmpresa(companyId);
  if (!posicao) throw new Error("Empresa não encontrada");
  if (bruto <= 0) throw new Error("Valor da ação inválido");
  if (posicao.disponivel < bruto) throw new Error("Caixa disponível insuficiente para reservar esta ação");
  db.prepare("UPDATE companies SET saldoReservado = saldoReservado + ? WHERE id = ?").run(bruto, companyId);
  const ciclo = db.prepare("SELECT COUNT(*) n FROM financial_ledger WHERE submissionId = ? AND tipo = 'reserva'").get(submissionId).n + 1;
  registrar({ companyId, sellerId, submissionId, tipo: "reserva", valor: bruto, idempotencyKey: `${submissionId}:${ciclo}` });
  return posicaoEmpresa(companyId);
}

export function cancelarReserva({ companyId, sellerId, submissionId, valor, motivo = "" }) {
  const bruto = dinheiro(valor);
  const movimento = dinheiro(db.prepare("SELECT COALESCE(SUM(valor), 0) total FROM financial_ledger WHERE submissionId = ? AND tipo IN ('reserva','estorno_reserva','liquidacao')").get(submissionId).total);
  if (movimento <= 0) return posicaoEmpresa(companyId);
  const liberar = dinheiro(Math.min(bruto, movimento));
  db.prepare("UPDATE companies SET saldoReservado = MAX(0, saldoReservado - ?) WHERE id = ?").run(liberar, companyId);
  const ciclo = db.prepare("SELECT COUNT(*) n FROM financial_ledger WHERE submissionId = ? AND tipo = 'estorno_reserva'").get(submissionId).n + 1;
  registrar({ companyId, sellerId, submissionId, tipo: "estorno_reserva", valor: -liberar, idempotencyKey: `${submissionId}:${ciclo}`, dados: { motivo } });
  return posicaoEmpresa(companyId);
}

export function liquidarSubmissao({ companyId, sellerId, submissionId, bruto, taxa, liquido, totalDebito = bruto }) {
  const valorBruto = dinheiro(bruto);
  const valorDebito = dinheiro(totalDebito);
  db.prepare("UPDATE companies SET saldo = saldo - ?, saldoReservado = MAX(0, saldoReservado - ?) WHERE id = ?")
    .run(valorDebito, valorDebito, companyId);
  db.prepare("UPDATE sellers SET disponivel = disponivel + ?, pendente = MAX(0, pendente - ?) WHERE id = ?")
    .run(dinheiro(liquido), dinheiro(liquido), sellerId);
  registrar({ companyId, sellerId, submissionId, tipo: "liquidacao", valor: -valorDebito, idempotencyKey: submissionId, dados: { bruto: valorBruto, taxa: dinheiro(taxa), liquido: dinheiro(liquido) } });
}

export function registrarMovimento({ companyId = null, sellerId = null, submissionId = null, tipo, valor, idempotencyKey, dados }) {
  registrar({ companyId, sellerId, submissionId, tipo, valor, idempotencyKey, dados });
}

export function extratoEmpresa(companyId, limite = 100) {
  return db.prepare("SELECT * FROM financial_ledger WHERE companyId = ? ORDER BY criadoEm DESC LIMIT ?")
    .all(companyId, Math.min(300, Math.max(1, Number(limite) || 100)))
    .map((r) => ({ ...r, dados: JSON.parse(r.dados || "{}") }));
}

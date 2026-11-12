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

  // Pré-pago para todos, sem exceção de plano: a ação só é reservada se houver
  // caixa disponível. Empresa sem caixa faz esta reserva falhar — e o chamador
  // (POST /submissions) pausa a campanha automaticamente.
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

  // Empresas com ciclo de pagamento (diaFechamento + diaPagamento): o valor
  // aprovado fica em `pendente` até o dia de repasse. A `dataLiberacao` marca
  // quando o admin pode liberar para `disponivel` via /ciclo/liberar.
  const ciclo = db.prepare("SELECT diaFechamento, diaPagamento FROM companies WHERE id = ?").get(companyId);
  if (ciclo?.diaFechamento && ciclo?.diaPagamento) {
    const agora = new Date();
    const diaAtual = agora.getDate();
    // Se ainda não passou o fechamento do mês atual, o repasse é dia 15 do próximo mês.
    // Se já passou, é dia 15 do mês seguinte ao próximo.
    let anoRepasse = agora.getFullYear();
    let mesRepasse = agora.getMonth() + 1 + (diaAtual <= ciclo.diaFechamento ? 1 : 2);
    if (mesRepasse > 12) { mesRepasse -= 12; anoRepasse++; }
    const dataLiberacao = new Date(anoRepasse, mesRepasse - 1, ciclo.diaPagamento).getTime();
    db.prepare("UPDATE submissions SET dataLiberacao = ? WHERE id = ?").run(dataLiberacao, submissionId);
    // Dinheiro permanece em `pendente` — não move para `disponivel` ainda.
    // (pendente já foi adicionado quando a ação foi submetida; apenas confirma que
    //  a liquidação da empresa ocorreu e o repasse está agendado.)
  } else {
    db.prepare("UPDATE sellers SET disponivel = disponivel + ?, pendente = MAX(0, pendente - ?) WHERE id = ?")
      .run(dinheiro(liquido), dinheiro(liquido), sellerId);
  }

  registrar({ companyId, sellerId, submissionId, tipo: "liquidacao", valor: -valorDebito, idempotencyKey: submissionId, dados: { bruto: valorBruto, taxa: dinheiro(taxa), liquido: dinheiro(liquido) } });
}

// Libera para `disponivel` todas as submissions de uma empresa cujo
// dataLiberacao já chegou. Chamado pelo admin no dia de repasse.
export function liberarCicloEmpresa(companyId) {
  const hoje = Date.now();
  const pendentes = db.prepare(`
    SELECT s.id, s.sellerId, s.liquido
    FROM submissions s
    WHERE s.companyId = ? AND s.status = 'liberado' AND s.dataLiberacao IS NOT NULL AND s.dataLiberacao <= ?
  `).all(companyId, hoje);

  let total = 0;
  const tx = db.transaction(() => {
    for (const s of pendentes) {
      const liq = dinheiro(s.liquido || 0);
      if (liq <= 0) continue;
      db.prepare("UPDATE sellers SET disponivel = disponivel + ?, pendente = MAX(0, pendente - ?) WHERE id = ?")
        .run(liq, liq, s.sellerId);
      db.prepare("UPDATE submissions SET dataLiberacao = NULL WHERE id = ?").run(s.id);
      total += liq;
    }
  });
  tx();
  return { liberadas: pendentes.length, valorTotal: dinheiro(total) };
}

export function registrarMovimento({ companyId = null, sellerId = null, submissionId = null, tipo, valor, idempotencyKey, dados }) {
  registrar({ companyId, sellerId, submissionId, tipo, valor, idempotencyKey, dados });
}

export function extratoEmpresa(companyId, limite = 100) {
  return db.prepare("SELECT * FROM financial_ledger WHERE companyId = ? ORDER BY criadoEm DESC LIMIT ?")
    .all(companyId, Math.min(300, Math.max(1, Number(limite) || 100)))
    .map((r) => ({ ...r, dados: JSON.parse(r.dados || "{}") }));
}

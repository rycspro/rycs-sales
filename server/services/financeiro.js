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

  // Toda empresa é pré-paga (o pós-pago saiu da plataforma): quando a tarefa
  // é liberada, o dinheiro já saiu do caixa dela e vai direto para o saldo
  // disponível do profissional. Antes, empresas que tinham ficado com dia de
  // fechamento/pagamento do pós-pago seguravam esse valor em "em análise" até
  // o dia do repasse, e o profissional não conseguia sacar.
  db.prepare("UPDATE sellers SET disponivel = disponivel + ?, pendente = MAX(0, pendente - ?) WHERE id = ?")
    .run(dinheiro(liquido), dinheiro(liquido), sellerId);

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

// Solta, uma vez, o que ficou retido pelo ciclo do antigo pós-pago: tarefas
// liberadas cujo valor ainda espera o dia do repasse. Idempotente — a mesma
// transação que credita limpa a data, então rodar de novo não credita nada.
export function liberarRetidosPorCiclo() {
  const pendentes = db.prepare(`
    SELECT id, sellerId, liquido FROM submissions
    WHERE status = 'liberado' AND dataLiberacao IS NOT NULL
  `).all();
  let total = 0, liberadas = 0;
  db.transaction(() => {
    for (const s of pendentes) {
      const limpou = db.prepare("UPDATE submissions SET dataLiberacao = NULL WHERE id = ? AND dataLiberacao IS NOT NULL").run(s.id).changes;
      if (!limpou) continue;
      const liq = dinheiro(s.liquido || 0);
      if (liq > 0) {
        db.prepare("UPDATE sellers SET disponivel = disponivel + ?, pendente = MAX(0, pendente - ?) WHERE id = ?").run(liq, liq, s.sellerId);
        registrar({ sellerId: s.sellerId, submissionId: s.id, tipo: "liberacao_ciclo", valor: liq, idempotencyKey: `ciclo:${s.id}`, dados: { motivo: "fim do ciclo do pós-pago" } });
      }
      total += liq; liberadas++;
    }
  })();
  return { liberadas, valorTotal: dinheiro(total) };
}

export function reservarVerbaCampanha({ companyId, campaignId, valor }) {
  const bruto = dinheiro(valor);
  if (bruto <= 0) throw new Error("Verba inválida");
  const posicao = posicaoEmpresa(companyId);
  if (!posicao) throw new Error("Empresa não encontrada");
  if (posicao.disponivel < bruto) throw new Error("Saldo insuficiente para reservar a verba da campanha");
  const jaReservou = dinheiro(db.prepare("SELECT COALESCE(SUM(valor), 0) t FROM financial_ledger WHERE companyId = ? AND tipo = 'reserva_campanha' AND dados LIKE ?").get(companyId, `%"campaignId":"${campaignId}"%`).t);
  const jaLiberou = dinheiro(db.prepare("SELECT COALESCE(SUM(ABS(valor)), 0) t FROM financial_ledger WHERE companyId = ? AND tipo = 'liberacao_campanha' AND dados LIKE ?").get(companyId, `%"campaignId":"${campaignId}"%`).t);
  const reservadoAtual = dinheiro(jaReservou - jaLiberou);
  const adicional = dinheiro(bruto - Math.max(0, reservadoAtual));
  if (adicional <= 0) return posicaoEmpresa(companyId);
  db.prepare("UPDATE companies SET saldoReservado = saldoReservado + ? WHERE id = ?").run(adicional, companyId);
  registrar({ companyId, tipo: "reserva_campanha", valor: adicional, idempotencyKey: `campanha:${campaignId}:${Date.now()}`, dados: { campaignId } });
  return posicaoEmpresa(companyId);
}

export function liberarVerbaCampanha({ companyId, campaignId }) {
  const jaReservou = dinheiro(db.prepare("SELECT COALESCE(SUM(valor), 0) t FROM financial_ledger WHERE companyId = ? AND tipo = 'reserva_campanha' AND dados LIKE ?").get(companyId, `%"campaignId":"${campaignId}"%`).t);
  const jaLiberou = dinheiro(db.prepare("SELECT COALESCE(SUM(ABS(valor)), 0) t FROM financial_ledger WHERE companyId = ? AND tipo = 'liberacao_campanha' AND dados LIKE ?").get(companyId, `%"campaignId":"${campaignId}"%`).t);
  const jaGasto = dinheiro(db.prepare("SELECT COALESCE(SUM(ABS(valor)), 0) t FROM financial_ledger WHERE companyId = ? AND tipo = 'liquidacao' AND submissionId IN (SELECT id FROM submissions WHERE campaignId = ?)").get(companyId, campaignId).t);
  const reservado = dinheiro(Math.max(0, jaReservou - jaLiberou));
  const liberar = dinheiro(Math.max(0, reservado - jaGasto));
  if (liberar <= 0) return posicaoEmpresa(companyId);
  db.prepare("UPDATE companies SET saldoReservado = MAX(0, saldoReservado - ?) WHERE id = ?").run(liberar, companyId);
  registrar({ companyId, tipo: "liberacao_campanha", valor: -liberar, idempotencyKey: `campanha:${campaignId}:lib:${Date.now()}`, dados: { campaignId, jaGasto } });
  return posicaoEmpresa(companyId);
}

export function registrarMovimento({ companyId = null, sellerId = null, submissionId = null, tipo, valor, idempotencyKey, dados }) {
  registrar({ companyId, sellerId, submissionId, tipo, valor, idempotencyKey, dados });
}

export function extratoEmpresa(companyId, limite = 100) {
  return db.prepare("SELECT * FROM financial_ledger WHERE companyId = ? ORDER BY criadoEm DESC LIMIT ?")
    .all(companyId, Math.min(300, Math.max(1, Number(limite) || 100)))
    .map((r) => ({ ...r, dados: JSON.parse(r.dados || "{}") }));
}

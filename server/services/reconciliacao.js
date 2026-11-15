// V5 — Reconciliação financeira (SOMENTE LEITURA).
//
// O saldo é um contador mutável; o financial_ledger é o registro auditável.
// Esta reconciliação compara os dois e ALERTA divergências — nunca corrige
// automaticamente, nem inventa lançamentos históricos.
//
// O que é COMPROVADAMENTE derivável do ledger:
//   • companies.totalAportado == SUM(deposito)  — depósitos (Asaas e Stripe)
//     são a única origem de totalAportado e ambos gravam tipo='deposito' (+).
//
// Lançamentos AUSENTES / tipos conflatados identificados (não há fórmula limpa,
// então NÃO são "reconciliados", apenas sinalizados para investigação):
//   • sellers.disponivel: as LIBERAÇÕES creditam disponivel sem lançar um
//     movimento com sellerId no ledger (só o débito de saque é lançado).
//   • tipo 'saque_estornado' é usado tanto para estorno de saque (sacado) quanto
//     para devolução ao disponivel — conflata dois efeitos.
//
// Invariantes de integridade SEMPRE válidos (independentes do ledger):
//   • nenhum contador pode ser negativo;
//   • saldoReservado <= saldo (não se reserva mais do que existe).

import db from "../db.js";

const cent = (v) => Math.round((Number(v) || 0) * 100);
const neg = (v) => cent(v) < 0;

function agregadosPorTipo(coluna, id) {
  return Object.fromEntries(
    db.prepare(`SELECT tipo, COALESCE(SUM(valor),0) total FROM financial_ledger WHERE ${coluna} = ? GROUP BY tipo`).all(id).map((r) => [r.tipo, r.total])
  );
}

export function reconciliarEmpresa(companyId) {
  const emp = db.prepare("SELECT saldo, saldoReservado, totalAportado FROM companies WHERE id = ?").get(companyId);
  if (!emp) return null;
  const porTipo = agregadosPorTipo("companyId", companyId);
  const depositos = porTipo.deposito || 0;
  const difAporte = cent(emp.totalAportado) - cent(depositos);

  const alertas = [];
  if (difAporte !== 0) alertas.push({ tipo: "aporte_divergente", detalhe: `totalAportado=${emp.totalAportado} vs depósitos=${depositos}`, valor: difAporte / 100 });
  if (neg(emp.saldo)) alertas.push({ tipo: "saldo_negativo", valor: emp.saldo });
  if (neg(emp.saldoReservado)) alertas.push({ tipo: "reservado_negativo", valor: emp.saldoReservado });
  if (cent(emp.saldoReservado) > cent(emp.saldo)) alertas.push({ tipo: "reservado_excede_saldo", detalhe: `reservado=${emp.saldoReservado} > saldo=${emp.saldo}` });

  return {
    escopo: "empresa", companyId,
    totalAportado: emp.totalAportado, depositosLedger: depositos, divergenciaAporte: difAporte / 100,
    saldo: emp.saldo, saldoReservado: emp.saldoReservado,
    agregadosPorTipo: porTipo,
    divergente: alertas.length > 0, alertas,
  };
}

export function reconciliarVendedor(sellerId) {
  const s = db.prepare("SELECT disponivel, pendente, sacado FROM sellers WHERE id = ?").get(sellerId);
  if (!s) return null;
  const porTipo = agregadosPorTipo("sellerId", sellerId);
  const alertas = [];
  if (neg(s.disponivel)) alertas.push({ tipo: "disponivel_negativo", valor: s.disponivel });
  if (neg(s.pendente)) alertas.push({ tipo: "pendente_negativo", valor: s.pendente });
  if (neg(s.sacado)) alertas.push({ tipo: "sacado_negativo", valor: s.sacado });
  return {
    escopo: "vendedor", sellerId,
    disponivel: s.disponivel, pendente: s.pendente, sacado: s.sacado,
    agregadosPorTipo: porTipo,
    // disponivel/sacado não têm fórmula limpa (ver cabeçalho): expostos para
    // inspeção, não reconciliados.
    observacao: "disponivel/sacado sem lançamento completo no ledger — inspeção manual",
    divergente: alertas.length > 0, alertas,
  };
}

// Varre empresas e vendedores; devolve e loga as divergências.
export function varrerReconciliacao() {
  const divergencias = [];
  const empresas = db.prepare("SELECT id FROM companies").all();
  for (const { id } of empresas) {
    const r = reconciliarEmpresa(id);
    if (r?.divergente) { divergencias.push(r); r.alertas.forEach((a) => console.warn(`[reconciliacao] empresa ${id}: ${a.tipo}`, a.detalhe || a.valor || "")); }
  }
  const vendedores = db.prepare("SELECT id FROM sellers").all();
  for (const { id } of vendedores) {
    const r = reconciliarVendedor(id);
    if (r?.divergente) { divergencias.push(r); r.alertas.forEach((a) => console.warn(`[reconciliacao] vendedor ${id}: ${a.tipo}`, a.valor ?? "")); }
  }
  return { empresasVerificadas: empresas.length, vendedoresVerificados: vendedores.length, divergencias };
}

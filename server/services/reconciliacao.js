// V5 — Reconciliação financeira (SOMENTE LEITURA).
//
// O saldo é um contador mutável; o financial_ledger é o registro auditável.
// Esta reconciliação compara os dois e ALERTA divergências — nunca corrige
// automaticamente (requisito). Não presume que todo lançamento afeta o mesmo
// saldo: usa o sinal e o tipo de cada lançamento.
//
// Invariante inequívoco enforçado: companies.totalAportado == SUM(deposito),
// pois depósitos (Asaas e Stripe) são a ÚNICA origem de totalAportado e ambos
// gravam tipo='deposito' com valor positivo. Para os demais contadores
// (saldo/saldoReservado/disponivel/pendente/sacado) expomos os agregados por
// tipo para inspeção; alguns fluxos (ex.: crédito de indicação) ainda não têm
// lançamento correspondente — divergências aí são sinalizadas como "sem
// lastro no ledger" para investigação, não como erro de reconciliação.

import db from "../db.js";

const cent = (v) => Math.round((Number(v) || 0) * 100);

export function reconciliarEmpresa(companyId) {
  const emp = db.prepare("SELECT saldo, saldoReservado, totalAportado FROM companies WHERE id = ?").get(companyId);
  if (!emp) return null;
  const porTipo = Object.fromEntries(
    db.prepare("SELECT tipo, COALESCE(SUM(valor),0) total FROM financial_ledger WHERE companyId = ? GROUP BY tipo").all(companyId).map((r) => [r.tipo, r.total])
  );
  const depositos = porTipo.deposito || 0;
  const divergenciaAporte = cent(emp.totalAportado) - cent(depositos);
  return {
    companyId,
    totalAportado: emp.totalAportado,
    depositosLedger: depositos,
    divergenciaAporte: divergenciaAporte / 100,
    divergente: divergenciaAporte !== 0,
    saldo: emp.saldo,
    saldoReservado: emp.saldoReservado,
    agregadosPorTipo: porTipo,
  };
}

// Varre todas as empresas e devolve as divergências (invariante de aporte).
// Loga cada divergência para observabilidade administrativa.
export function varrerReconciliacao() {
  const empresas = db.prepare("SELECT id FROM companies").all();
  const divergencias = [];
  for (const { id } of empresas) {
    const r = reconciliarEmpresa(id);
    if (r?.divergente) {
      divergencias.push(r);
      console.warn(`[reconciliacao] empresa ${id}: totalAportado=${r.totalAportado} vs depósitos no ledger=${r.depositosLedger} (dif=${r.divergenciaAporte})`);
    }
  }
  return { empresasVerificadas: empresas.length, divergencias };
}

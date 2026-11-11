import db from "../db.js";
import { acessoDaEmpresa } from "../../shared/assinatura.js";

// Decide o acesso de uma empresa seguindo a mesma regra consultada pela tela em
// GET /subscription/access: bloqueio administrativo e isenção vêm antes do
// estado da assinatura. Centralizado aqui para que as rotas que precisam barrar
// uma ação (criar campanha, conversar) concordem com a tela, sem duplicar lógica.
export function acessoDaEmpresaPorId(entityId) {
  const billing = db
    .prepare("SELECT billing_status, access_status FROM company_billing WHERE companyId = ?")
    .get(entityId);

  if (billing?.access_status === "bloqueado")
    return { liberado: false, estado: "inadimplente", plano: null };
  if (billing?.billing_status === "isenta")
    return { liberado: true, estado: "ativa", plano: "pro" };

  const empresa = db.prepare("SELECT assinatura, tipoEmpresa FROM companies WHERE id = ?").get(entityId);
  const assinatura = db
    .prepare("SELECT * FROM subscriptions WHERE companyId = ? AND status != 'cancelada' ORDER BY criadoEm DESC LIMIT 1")
    .get(entityId);

  return acessoDaEmpresa({ empresa, assinatura });
}

// true quando a empresa pode usar os recursos que exigem plano ativo.
export function empresaLiberada(entityId) {
  return !!acessoDaEmpresaPorId(entityId).liberado;
}

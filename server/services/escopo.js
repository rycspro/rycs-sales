// Autorização de escopo multi-tenant, centralizada.
//
// A causa estrutural das falhas de BOLA/IDOR é cada rota decidir sozinha (e às
// vezes esquecer) se o recurso é da conta de quem chama. Aqui ficam as regras
// de propriedade por empresa, para as rotas apenas consultarem — nunca confiar
// em companyId vindo do corpo da requisição.
//
// Regra geral: admin enxerga tudo; empresa só o que pertence ao seu entityId;
// vendedor não administra recursos de empresa por estas rotas.

import db from "../db.js";

// Contexto de empresa do requisitante. null quando o papel não pode gerir
// recursos de empresa (ex.: vendedor, ou sessão sem entityId).
export function contextoEmpresa(req) {
  const u = req?.user;
  if (!u) return null;
  if (u.role === "admin") return { admin: true, companyId: null };
  if (u.role === "empresa" && u.entityId) return { admin: false, companyId: u.entityId };
  return null;
}

// Retorna a campanha se o requisitante pode gerenciá-la; senão null.
export function campanhaGerenciavel(req, campaignId) {
  const ctx = contextoEmpresa(req);
  if (!ctx || !campaignId) return null;
  const c = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId);
  if (!c) return null;
  if (ctx.admin) return c;
  return c.companyId === ctx.companyId ? c : null;
}

// Retorna o contato (campaign_contacts) se pertence à empresa do requisitante.
export function contatoGerenciavel(req, contactId) {
  const ctx = contextoEmpresa(req);
  if (!ctx || !contactId) return null;
  const row = db.prepare("SELECT * FROM campaign_contacts WHERE id = ?").get(contactId);
  if (!row) return null;
  if (ctx.admin) return row;
  return row.companyId === ctx.companyId ? row : null;
}

// Apenas o próprio profissional (ou o admin) altera o cadastro de um vendedor.
// Empresas NÃO editam profissionais: dados sensíveis (Pix, e-mail) valem
// dinheiro e permitem tomada de conta.
export function podeEditarVendedor(req, sellerId) {
  const u = req?.user;
  if (!u || !sellerId) return false;
  if (u.role === "admin") return true;
  return u.role === "vendedor" && u.entityId === sellerId;
}

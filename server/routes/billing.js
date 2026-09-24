import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { asaas, asaasAtivo, garantirCliente } from "../services/asaas.js";

const router = Router();

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito ao administrador." });
  next();
}

function getBilling(companyId) {
  return db.prepare("SELECT * FROM company_billing WHERE companyId = ?").get(companyId) || {
    companyId,
    billing_status: "ativa",
    access_status: "ativo",
    isencao_motivo: null,
    isencao_ate: null,
  };
}

function registrarHistorico(companyId, campo, statusAnterior, statusNovo, motivo, adminId) {
  db.prepare(
    "INSERT INTO company_billing_history (companyId,campo,status_anterior,status_novo,motivo,adminId,criadoEm) VALUES (?,?,?,?,?,?,?)"
  ).run(companyId, campo, statusAnterior, statusNovo, motivo || null, adminId, agora());
}

function upsertBilling(companyId, fields) {
  const cols = Object.keys(fields);
  const sets = cols.map((c) => `${c} = ?`).join(", ");
  const vals = cols.map((c) => fields[c]);
  db.prepare(
    `INSERT INTO company_billing (companyId, ${cols.join(",")}, updatedAt) VALUES (?, ${cols.map(() => "?").join(",")}, ?)
     ON CONFLICT(companyId) DO UPDATE SET ${sets}, updatedAt = ?`
  ).run(companyId, ...vals, agora(), ...vals, agora());
}

// GET /api/admin/companies/:id/billing
router.get("/admin/companies/:id/billing", requireAdmin, (req, res) => {
  const empresa = db.prepare("SELECT id, nome FROM companies WHERE id = ?").get(req.params.id);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada." });
  const billing = getBilling(req.params.id);
  const historico = db.prepare(
    "SELECT h.*, u.email as adminEmail FROM company_billing_history h LEFT JOIN users u ON u.id = h.adminId WHERE h.companyId = ? ORDER BY h.criadoEm DESC LIMIT 50"
  ).all(req.params.id);
  res.json({ empresa, billing, historico });
});

// PATCH /api/admin/companies/:id/billing/status
router.patch("/admin/companies/:id/billing/status", requireAdmin, (req, res) => {
  const { billing_status, access_status, motivo, isencao_ate } = req.body;
  const empresa = db.prepare("SELECT id, nome FROM companies WHERE id = ?").get(req.params.id);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada." });

  const atual = getBilling(req.params.id);

  if (billing_status && billing_status !== atual.billing_status) {
    if (!["ativa", "isenta", "pausada"].includes(billing_status))
      return res.status(400).json({ error: "billing_status inválido." });
    const fields = { billing_status };
    if (billing_status === "isenta") {
      fields.isencao_motivo = motivo || null;
      fields.isencao_ate = isencao_ate ? new Date(isencao_ate).getTime() : null;
    } else {
      fields.isencao_motivo = null;
      fields.isencao_ate = null;
    }
    upsertBilling(req.params.id, fields);
    registrarHistorico(req.params.id, "billing_status", atual.billing_status, billing_status, motivo, req.user.id);
  }

  if (access_status && access_status !== atual.access_status) {
    if (!["ativo", "bloqueado"].includes(access_status))
      return res.status(400).json({ error: "access_status inválido." });
    upsertBilling(req.params.id, { access_status });
    registrarHistorico(req.params.id, "access_status", atual.access_status, access_status, motivo, req.user.id);
  }

  res.json({ ok: true, billing: getBilling(req.params.id) });
});

// GET /api/admin/companies/:id/billing/history
router.get("/admin/companies/:id/billing/history", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT h.*, u.email as adminEmail FROM company_billing_history h LEFT JOIN users u ON u.id = h.adminId WHERE h.companyId = ? ORDER BY h.criadoEm DESC LIMIT 100"
  ).all(req.params.id);
  res.json(rows);
});

// POST /api/admin/companies/:id/billing/payment — gera cobrança PIX ou Cartão
router.post("/admin/companies/:id/billing/payment", requireAdmin, async (req, res) => {
  const { descricao, valor, metodo } = req.body;
  if (!descricao || !valor || !["pix", "cartao"].includes(metodo))
    return res.status(400).json({ error: "descricao, valor e metodo (pix|cartao) são obrigatórios." });

  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.params.id);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada." });

  // Proteção contra duplicidade: mesmo valor + mesma descrição nas últimas 24h
  const duplicado = db.prepare(
    "SELECT id FROM deposit_requests WHERE companyId = ? AND observacao = ? AND valor = ? AND criadoEm > ?"
  ).get(req.params.id, descricao, Number(valor), agora() - 86400000);
  if (duplicado) return res.status(409).json({ error: "Cobrança idêntica já registrada nas últimas 24h." });

  if (!asaasAtivo())
    return res.status(503).json({ error: "Gateway de pagamento indisponível." });

  const billingType = metodo === "cartao" ? "CREDIT_CARD" : "PIX";

  try {
    const customer = await garantirCliente(db, empresa);
    const cobranca = await asaas("/payments", {
      method: "POST",
      body: {
        customer,
        billingType,
        value: Number(valor),
        dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        description: descricao,
        externalReference: empresa.id,
      },
    });

    let pix = null;
    if (billingType === "PIX") {
      try { pix = await asaas(`/payments/${cobranca.id}/pixQrCode`); } catch { /* indisponível */ }
    }

    // Registrar na tabela de depósitos para rastreabilidade
    db.prepare(
      "INSERT INTO deposit_requests (id,companyId,valor,status,referencia,observacao,confirmadoPor,criadoEm) VALUES (?,?,?,?,?,?,?,?)"
    ).run(uid(), empresa.id, Number(valor), "aguardando", cobranca.id, descricao, req.user.id, agora());

    res.json({ ok: true, paymentId: cobranca.id, pix, cobranca });
  } catch (err) {
    res.status(502).json({ error: err.message || "Erro ao gerar cobrança." });
  }
});

export default router;

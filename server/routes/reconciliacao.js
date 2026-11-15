import { Router } from "express";
import { varrerReconciliacao, reconciliarEmpresa } from "../services/reconciliacao.js";

const router = Router();

// Consulta de reconciliação — restrita ao admin. Somente leitura.
router.get("/admin/reconciliacao", (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito ao administrador." });
  res.json(varrerReconciliacao());
});

router.get("/admin/reconciliacao/:companyId", (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito ao administrador." });
  const r = reconciliarEmpresa(req.params.companyId);
  if (!r) return res.status(404).json({ error: "Empresa não encontrada" });
  res.json(r);
});

export default router;

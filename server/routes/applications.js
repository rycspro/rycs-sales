import { Router } from "express";
import db from "../db.js";
import { notificar } from "./notifications.js";

const router = Router();

router.post("/applications", (req, res) => {
  const { sellerId, companyId } = req.body;
  const { role, entityId } = req.user;

  if (role === "vendedor" && entityId !== sellerId)
    return res.status(403).json({ error: "Sem permissão" });

  db.prepare("INSERT OR REPLACE INTO applications (sellerId, companyId, status) VALUES (?, ?, 'pendente')").run(sellerId, companyId);
  res.json({ ok: true });
});

router.patch("/applications", (req, res) => {
  const { sellerId, companyId, status } = req.body;
  const { role, entityId } = req.user;

  if (role === "empresa" && entityId !== companyId)
    return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor")
    return res.status(403).json({ error: "Vendedores não podem aprovar candidaturas" });

  db.prepare("UPDATE applications SET status = ? WHERE sellerId = ? AND companyId = ?").run(status, sellerId, companyId);

  const sellerUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sellerId);
  const company = db.prepare("SELECT nome FROM companies WHERE id = ?").get(companyId);
  if (sellerUser && company) {
    const msg = status === "aprovado" ? `Você foi aprovado na ${company.nome}!` : `Sua candidatura na ${company.nome} foi recusada.`;
    notificar(sellerUser.id, "candidatura", msg);
  }

  res.json({ ok: true });
});

export default router;

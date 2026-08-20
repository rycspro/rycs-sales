import { Router } from "express";
import db, { uid, agora } from "../db.js";

const router = Router();

router.post("/withdrawals", (req, res) => {
  const { sellerId, valor, pix } = req.body;
  const { role, entityId } = req.user;

  if (role === "vendedor" && entityId !== sellerId)
    return res.status(403).json({ error: "Sem permissão" });

  const id = uid();
  db.prepare("INSERT INTO withdrawals (id, sellerId, valor, pix, status, criadoEm) VALUES (?, ?, ?, ?, 'solicitado', ?)").run(id, sellerId, valor, pix, agora());
  res.json({ id });
});

router.patch("/withdrawals/:id", (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Apenas admin pode alterar saques" });

  const { status } = req.body;
  db.prepare("UPDATE withdrawals SET status = ? WHERE id = ?").run(status, req.params.id);
  res.json({ ok: true });
});

export default router;

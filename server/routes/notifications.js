import { Router } from "express";
import db, { uid, agora } from "../db.js";

const router = Router();

router.get("/notifications", (req, res) => {
  const rows = db.prepare("SELECT * FROM notifications WHERE userId = ? ORDER BY criadoEm DESC LIMIT 50").all(req.user.id);
  res.json(rows);
});

router.patch("/notifications/read-all", (req, res) => {
  db.prepare("UPDATE notifications SET lida = 1 WHERE userId = ?").run(req.user.id);
  res.json({ ok: true });
});

router.patch("/notifications/:id", (req, res) => {
  const notif = db.prepare("SELECT * FROM notifications WHERE id = ?").get(req.params.id);
  if (!notif || notif.userId !== req.user.id) return res.status(403).json({ error: "Sem permissão" });
  db.prepare("UPDATE notifications SET lida = 1 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;

export function notificar(userId, tipo, titulo, corpo = "") {
  db.prepare("INSERT INTO notifications (id, userId, tipo, titulo, corpo, lida, criadoEm) VALUES (?, ?, ?, ?, ?, 0, ?)").run(uid(), userId, tipo, titulo, corpo, agora());
}

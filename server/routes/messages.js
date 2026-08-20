import { Router } from "express";
import db, { uid, agora } from "../db.js";

const router = Router();

router.get("/messages", (req, res) => {
  const { companyId, sellerId } = req.query;
  const { role, entityId } = req.user;

  if (role === "vendedor" && sellerId && entityId !== sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (role === "empresa" && companyId && entityId !== companyId)
    return res.status(403).json({ error: "Sem permissão" });

  let rows;
  if (companyId && sellerId) {
    rows = db.prepare("SELECT * FROM messages WHERE companyId = ? AND sellerId = ? ORDER BY ts ASC").all(companyId, sellerId);
  } else if (companyId) {
    rows = db.prepare("SELECT * FROM messages WHERE companyId = ? ORDER BY ts ASC").all(companyId);
  } else {
    rows = db.prepare("SELECT * FROM messages ORDER BY ts ASC").all();
  }
  res.json(rows);
});

router.post("/messages", (req, res) => {
  const { companyId, sellerId, de, texto } = req.body;
  const id = uid();
  db.prepare("INSERT INTO messages (id, companyId, sellerId, de, texto, ts) VALUES (?, ?, ?, ?, ?, ?)").run(id, companyId, sellerId, de, texto, agora());
  res.json({ id });
});

export default router;

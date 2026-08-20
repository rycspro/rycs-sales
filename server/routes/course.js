import { Router } from "express";
import db from "../db.js";

const router = Router();

router.patch("/course-progress", (req, res) => {
  const { sellerId, companyId, moduleIds } = req.body;
  const { role, entityId } = req.user;

  if (role === "vendedor" && entityId !== sellerId)
    return res.status(403).json({ error: "Sem permissão" });

  const existing = db.prepare("SELECT * FROM course_progress WHERE sellerId = ? AND companyId = ?").get(sellerId, companyId);
  if (existing) {
    db.prepare("UPDATE course_progress SET moduleIds = ? WHERE sellerId = ? AND companyId = ?").run(JSON.stringify(moduleIds), sellerId, companyId);
  } else {
    db.prepare("INSERT INTO course_progress (sellerId, companyId, moduleIds) VALUES (?, ?, ?)").run(sellerId, companyId, JSON.stringify(moduleIds));
  }
  res.json({ ok: true });
});

export default router;

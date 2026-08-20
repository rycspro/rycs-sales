import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";

const router = Router();

router.post("/submissions", (req, res) => {
  const { sellerId, companyId, tipo, valor, prova } = req.body;
  const { role, entityId } = req.user;

  if (role === "vendedor" && entityId !== sellerId)
    return res.status(403).json({ error: "Sem permissão" });

  const id = uid();
  db.prepare(`
    INSERT INTO submissions (id, sellerId, companyId, tipo, valor, prova, status, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, 'analisando', ?)
  `).run(id, sellerId, companyId, tipo, valor, JSON.stringify(prova), agora());
  res.json({ id });
});

router.patch("/submissions/:id", (req, res) => {
  const { id } = req.params;
  const { role, entityId } = req.user;

  const sub = db.prepare("SELECT * FROM submissions WHERE id = ?").get(id);
  if (!sub) return res.status(404).json({ error: "Submissão não encontrada" });

  if (role === "vendedor" && entityId !== sub.sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (role === "empresa" && entityId !== sub.companyId)
    return res.status(403).json({ error: "Sem permissão" });

  const fields = req.body;
  const allowed = ["status", "confianca", "motivo", "fonte", "liquido"];
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (!sets.length) return res.status(400).json({ error: "nenhum campo válido" });
  vals.push(id);
  db.prepare(`UPDATE submissions SET ${sets.join(", ")} WHERE id = ?`).run(...vals);

  if (fields.status && fields.status !== sub.status) {
    const sellerUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sub.sellerId);
    const labels = { liberado: "aprovada", recusado: "recusada", revisao: "enviada para revisão", ia_aprovado: "pré-aprovada pela IA", conferido: "conferida" };
    if (sellerUser && labels[fields.status]) {
      notificar(sellerUser.id, "submissao", `Ação ${labels[fields.status]}`, fields.motivo || "");
    }
  }

  res.json({ ok: true });
});

export default router;

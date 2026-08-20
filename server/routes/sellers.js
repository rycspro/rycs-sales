import { Router } from "express";
import db, { uid, agora } from "../db.js";

const router = Router();

router.post("/sellers", (req, res) => {
  if (req.user.role !== "vendedor" && req.user.role !== "admin")
    return res.status(403).json({ error: "Sem permissão" });

  const { nome, email, whats, cidade, perfil, experiencia, pix, nota, video, respostas } = req.body;
  const id = uid();
  db.prepare(`
    INSERT INTO sellers (id, nome, email, whats, cidade, perfil, experiencia, status, nota, pix, disponivel, pendente, sacado, respostas, video, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'triagem', ?, ?, 0, 0, 0, ?, ?, ?)
  `).run(id, nome, email, whats, cidade || "", perfil || "sdr", experiencia || "", nota || 0, pix || "", JSON.stringify(respostas || []), video || "", agora());
  res.json({ id });
});

router.patch("/sellers/:id", (req, res) => {
  const { id } = req.params;
  const { role, entityId } = req.user;

  if (role === "vendedor" && entityId !== id)
    return res.status(403).json({ error: "Sem permissão para editar outro vendedor" });

  const fields = req.body;
  // Campos financeiros (disponivel/pendente/sacado) NUNCA podem ser escritos
  // pelo próprio vendedor: valem dinheiro real via Pix. Só o servidor os move,
  // ao liberar uma ação ou processar um saque.
  const sellerFields = ["nome", "email", "whats", "cidade", "perfil", "experiencia", "pix", "video"];
  const adminFields = [...sellerFields, "status", "nota"];
  const allowed = role === "admin" ? adminFields : sellerFields;

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
  db.prepare(`UPDATE sellers SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

export default router;

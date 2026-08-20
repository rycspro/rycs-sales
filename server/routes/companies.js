import { Router } from "express";
import db from "../db.js";

const router = Router();

router.patch("/companies/:id", (req, res) => {
  const { id } = req.params;
  const { role, entityId } = req.user;

  if (role === "empresa" && entityId !== id)
    return res.status(403).json({ error: "Sem permissão para editar outra empresa" });
  if (role === "vendedor")
    return res.status(403).json({ error: "Vendedores não podem editar empresas" });

  const fields = req.body;
  const allowed = ["nome", "produto", "ticket", "icp", "plano", "destaque", "saldo", "vagas", "cor", "totalAportado"];
  const jsonFields = ["comissoes", "curso", "aportes"];
  const sets = [];
  const vals = [];

  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(k === "destaque" ? (v ? 1 : 0) : v);
    } else if (jsonFields.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(JSON.stringify(v));
    }
  }
  if (!sets.length) return res.status(400).json({ error: "nenhum campo válido" });
  vals.push(id);
  db.prepare(`UPDATE companies SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

export default router;

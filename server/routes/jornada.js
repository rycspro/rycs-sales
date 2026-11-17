import { Router } from "express";
import { registrarEventoPublico, relatorioJornada } from "../services/jornada.js";

// Sem cookie: o visitante ainda não tem conta (landing, cadastro).
export const jornadaPublico = Router();

jornadaPublico.post("/jornada/evento", (req, res) => {
  const r = registrarEventoPublico(req.body || {});
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

const router = Router();

router.get("/admin/jornada", (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito ao administrador." });
  const { tipo, dias, origem } = req.query;
  res.json(relatorioJornada({ tipo, dias, origem }));
});

export default router;

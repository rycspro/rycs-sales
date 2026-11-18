import { Router } from "express";
import { registrarEventoPublico, relatorioJornada } from "../services/jornada.js";
import { relatorioCampanhas } from "../services/campanhasAdmin.js";

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

// Histórico das campanhas de anúncio (Meta por padrão): campanha → conjunto →
// anúncio, com contas, marcos e gasto. `origem=` vazio traz todas as origens.
router.get("/admin/campanhas", async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito ao administrador." });
  const { tipo, dias, origem } = req.query;
  try {
    res.json(await relatorioCampanhas({ tipo, dias, origem: origem ?? "meta" }));
  } catch (e) {
    console.error("[campanhas] relatório:", e?.message);
    res.status(500).json({ error: "Não foi possível montar o histórico de campanhas." });
  }
});

export default router;

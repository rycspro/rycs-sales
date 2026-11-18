import { Router } from "express";
import { registrarEventoPublico, relatorioJornada } from "../services/jornada.js";
import { relatorioCampanhas } from "../services/campanhasAdmin.js";
import { leadsRycs, sincronizarLeadsRycs } from "../services/metaLeadsRycs.js";

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

// Leads dos formulários instantâneos da RYCS (lista para ver e exportar).
router.get("/admin/campanhas/leads", (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito ao administrador." });
  const dias = Number(req.query.dias) || 0;
  res.json({ leads: leadsRycs({ desde: dias > 0 ? Date.now() - dias * 24 * 60 * 60 * 1000 : 0 }) });
});

// Busca agora na Meta, sem esperar a rodada de 10 minutos.
router.post("/admin/campanhas/leads/sincronizar", async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito ao administrador." });
  const r = await sincronizarLeadsRycs();
  if (!r) return res.status(409).json({ error: "Sem META_ADS_TOKEN, ou já há uma busca em andamento." });
  if (r.erro) return res.status(502).json({ error: `A Meta recusou: ${r.erro}` });
  res.json(r);
});

export default router;

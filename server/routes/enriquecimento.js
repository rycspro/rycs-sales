import { Router } from "express";
import {
  enriquecerContato,
  enriquecerLote,
  obterEnriquecimento,
  obterLogEnriquecimento,
  estatisticasEnriquecimento,
  classificarCargo,
} from "../services/enriquecimento.js";

const router = Router();

function entityDe(req) {
  const r = req.user?.role;
  if (r === "empresa") return { entityId: req.user.entityId, entityRole: "empresa" };
  if (r === "vendedor") return { entityId: req.user.entityId, entityRole: "vendedor" };
  return null;
}

// ── Enriquecer um contato ──────────────────────────────────────────────────
router.post("/enriquecimento/enriquecer", async (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  const { contatoId } = req.body || {};
  if (!contatoId) return res.status(400).json({ error: "Informe o contato." });
  try {
    const r = await enriquecerContato(contatoId, ent.entityId);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) {
    console.error("[enriq] erro:", e.message);
    res.status(500).json({ error: "Erro no enriquecimento." });
  }
});

// ── Enriquecer em lote ─────────────────────────────────────────────────────
router.post("/enriquecimento/lote", async (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  const { contatoIds } = req.body || {};
  if (!Array.isArray(contatoIds) || !contatoIds.length) {
    return res.status(400).json({ error: "Informe os contatos." });
  }
  if (contatoIds.length > 50) {
    return res.status(400).json({ error: "Máximo 50 contatos por lote." });
  }
  try {
    const r = await enriquecerLote(contatoIds, ent.entityId);
    res.json({ resultados: r });
  } catch (e) {
    console.error("[enriq] erro lote:", e.message);
    res.status(500).json({ error: "Erro no enriquecimento em lote." });
  }
});

// ── Consultar enriquecimento ───────────────────────────────────────────────
router.get("/enriquecimento/:contatoId", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  const dados = obterEnriquecimento(req.params.contatoId);
  if (!dados) return res.status(404).json({ error: "Enriquecimento não encontrado." });
  res.json(dados);
});

// ── Log de enriquecimento ──────────────────────────────────────────────────
router.get("/enriquecimento/:contatoId/log", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  res.json({ logs: obterLogEnriquecimento(req.params.contatoId) });
});

// ── Classificar cargo (utilitário) ─────────────────────────────────────────
router.post("/enriquecimento/classificar-cargo", (req, res) => {
  const { cargo } = req.body || {};
  res.json(classificarCargo(cargo));
});

// ── Admin: estatísticas ────────────────────────────────────────────────────
router.get("/enriquecimento-admin/stats", (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito." });
  res.json(estatisticasEnriquecimento());
});

export default router;

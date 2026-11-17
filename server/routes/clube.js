// RYCS Club — rotas do profissional e da administração.
//
// O estado de gamificação (XP, níveis, conquistas, missões) já vem no /state
// (db.gamificacao). Aqui ficam as IMAGENS configuráveis e os PRÊMIOS/RESGATES.
// Admin-only para gestão; profissional só lê o publicado e solicita resgate.

import { Router } from "express";
import db from "../db.js";
import { notificar } from "./notifications.js";
import {
  imagensConfig, setImagem,
  premiosDoProfissional, premiosAdmin, salvarPremio, removerPremio,
  solicitarResgate, resgatesAdmin, atualizarResgate,
  METRICAS_PREMIO, ESTADOS_RESGATE,
} from "../services/clube.js";

const router = Router();

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito ao administrador." });
  next();
}
function requireVendedor(req, res, next) {
  if (req.user?.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais." });
  next();
}

// ── Profissional ──────────────────────────────────────────────────────────────
// Imagens + prêmios publicados com progresso/elegibilidade do próprio seller.
router.get("/club", requireVendedor, (req, res) => {
  res.json({
    imagens: imagensConfig(),
    premios: premiosDoProfissional(req.user.entityId),
  });
});

router.post("/club/premios/:id/resgatar", requireVendedor, (req, res) => {
  const r = solicitarResgate(req.user.entityId, req.params.id, req.body?.endereco);
  if (r.error) return res.status(r.precisaEndereco ? 422 : 400).json(r);
  res.json(r);
});

// ── Administração ─────────────────────────────────────────────────────────────
router.get("/admin/club", requireAdmin, (req, res) => {
  res.json({
    imagens: imagensConfig(),
    premios: premiosAdmin(),
    resgates: resgatesAdmin(),
    metricas: METRICAS_PREMIO,
    estados: ESTADOS_RESGATE,
  });
});

// Define/atualiza a imagem de um slot (banner, nível, medalha). A URL vem do
// upload já feito via /uploads/presign (publicUrl) — aqui só persistimos o slot.
router.post("/admin/club/imagem", requireAdmin, (req, res) => {
  const chave = String(req.body?.chave || "").trim();
  if (!chave) return res.status(400).json({ error: "Slot da imagem é obrigatório." });
  setImagem(chave, String(req.body?.url || ""));
  res.json({ ok: true, imagens: imagensConfig() });
});

router.post("/admin/club/premios", requireAdmin, (req, res) => {
  const p = salvarPremio(req.body || {});
  res.json({ ok: true, premio: p });
});

router.patch("/admin/club/premios/:id", requireAdmin, (req, res) => {
  const p = salvarPremio(req.body || {}, req.params.id);
  if (!p) return res.status(404).json({ error: "Prêmio não encontrado." });
  res.json({ ok: true, premio: p });
});

router.delete("/admin/club/premios/:id", requireAdmin, (req, res) => {
  removerPremio(req.params.id);
  res.json({ ok: true });
});

router.patch("/admin/club/resgates/:id", requireAdmin, (req, res) => {
  const r = atualizarResgate(req.params.id, String(req.body?.estado || ""));
  if (r.error) return res.status(400).json(r);
  // Avisa o profissional sobre a mudança de estado do resgate.
  try {
    const info = resgatesAdmin().find((x) => x.id === req.params.id);
    if (info?.sellerId) {
      const u = db.prepare("SELECT id FROM users WHERE role = 'vendedor' AND entityId = ?").get(info.sellerId);
      if (u) notificar(u.id, "club", "Atualização do seu prêmio", `Seu resgate de "${info.prizeNome}" está: ${req.body.estado}.`);
    }
  } catch {}
  res.json(r);
});

export default router;

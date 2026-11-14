import { Router } from "express";
import { resumoConfig, ativar, rotacionarSecret, definirAtivo, receber } from "../services/webhooks.js";

// ── Público: entrada dos leads (sistemas externos chamam sem cookie) ──────
export const webhooksPublico = Router();

webhooksPublico.post("/webhooks/in/:secret", (req, res) => {
  const r = receber(req.params.secret, req.body, { ip: req.ip });
  if (!r.ok) return res.status(r.status || 400).json({ ok: false, erro: r.erro || "Não autorizado." });
  res.status(202).json({ ok: true, status: r.status });
});

// ── Empresa autenticada: configuração ─────────────────────────────────────
const router = Router();

const somenteEmpresa = (req, res) => {
  if (req.user?.role !== "empresa" || !req.user.entityId) { res.status(403).json({ error: "Apenas a empresa gerencia os webhooks" }); return false; }
  return true;
};

router.get("/webhooks/config", (req, res) => {
  if (!somenteEmpresa(req, res)) return;
  res.json(resumoConfig(req.user.entityId));
});

router.post("/webhooks/ativar", (req, res) => {
  if (!somenteEmpresa(req, res)) return;
  ativar(req.user.entityId);
  res.json(resumoConfig(req.user.entityId));
});

router.post("/webhooks/rotacionar", (req, res) => {
  if (!somenteEmpresa(req, res)) return;
  rotacionarSecret(req.user.entityId);
  res.json(resumoConfig(req.user.entityId));
});

router.post("/webhooks/ativo", (req, res) => {
  if (!somenteEmpresa(req, res)) return;
  definirAtivo(req.user.entityId, !!req.body?.ativo);
  res.json(resumoConfig(req.user.entityId));
});

export default router;

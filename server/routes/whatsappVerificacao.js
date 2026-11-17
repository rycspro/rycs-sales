import { Router } from "express";
import { statusVerificacao, enviarCodigo, confirmarCodigo } from "../services/whatsappVerificacao.js";

const router = Router();

function soProfissional(req, res, next) {
  if (req.user?.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais verificam o WhatsApp." });
  next();
}

router.get("/whatsapp/verificacao", soProfissional, async (req, res) => {
  const s = await statusVerificacao(req.user.entityId);
  if (!s) return res.status(404).json({ error: "Profissional não encontrado." });
  res.json(s);
});

router.post("/whatsapp/verificacao/enviar", soProfissional, async (req, res) => {
  const r = await enviarCodigo(req.user.entityId);
  res.status(r.status).json(r.corpo);
});

router.post("/whatsapp/verificacao/confirmar", soProfissional, (req, res) => {
  const r = confirmarCodigo(req.user.entityId, req.body?.codigo);
  res.status(r.status).json(r.corpo);
});

export default router;

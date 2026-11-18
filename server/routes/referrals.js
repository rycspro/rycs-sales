import { Router } from "express";
import { resumoDoUsuario } from "../services/indicacoes.js";
import { resumoAfiliado, listarAfiliadosAdmin } from "../services/afiliados.js";
import { RECOMPENSAS, GATILHOS } from "../../shared/indicacoes.js";

const router = Router();

router.get("/referrals", (req, res) => {
  const resumo = resumoDoUsuario(req.user.id);
  res.json({
    ...resumo,
    // O que este papel ganha ao indicar cada tipo de conta.
    recompensas: RECOMPENSAS[req.user.role] || {},
    gatilhos: GATILHOS,
  });
});

// Programa de Afiliados — Jornada de Indicações (somente leitura). Deriva dos
// dados reais de indicação; não movimenta dinheiro. Só profissionais.
router.get("/afiliados/resumo", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  res.json(resumoAfiliado(req.user.id));
});

// Painel administrativo — visão de afiliados (somente leitura).
router.get("/admin/affiliates", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas administradores" });
  res.json({ afiliados: listarAfiliadosAdmin() });
});

export default router;

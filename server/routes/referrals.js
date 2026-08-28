import { Router } from "express";
import { resumoDoUsuario } from "../services/indicacoes.js";
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

export default router;

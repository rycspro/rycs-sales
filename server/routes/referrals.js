import { Router } from "express";
import { resumoDoUsuario } from "../services/indicacoes.js";
import { resumoAfiliado, listarAfiliadosAdmin } from "../services/afiliados.js";
import { RECOMPENSAS, GATILHOS } from "../../shared/indicacoes.js";
import {
  resumoParceiro, listarParceiros, ativarParceiro, atualizarParceiro, liberarERepassar, ErroParceria,
} from "../services/parceriaCanal.js";
import { PCT_FECHAMENTO, PCT_USO, NIVEIS_CANAL } from "../../shared/parceriaCanal.js";

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

// ─── Parceria de Canal ───
// Parceiro: carteira, nível e comissões. Quem não é parceiro recebe { ativo: false }.
router.get("/parceiro-canal/resumo", (req, res) => {
  if (req.user.role !== "vendedor") return res.json({ ativo: false });
  res.json(resumoParceiro(req.user.id));
});

const soAdmin = (req, res) => {
  if (req.user.role === "admin") return true;
  res.status(403).json({ error: "Apenas administradores" });
  return false;
};
const responderErro = (res, e) => {
  if (e instanceof ErroParceria) return res.status(e.status).json({ error: e.message });
  console.error("[canal] admin:", e.message);
  return res.status(500).json({ error: "Não foi possível salvar o parceiro." });
};

router.get("/admin/parceiros-canal", (req, res) => {
  if (!soAdmin(req, res)) return;
  res.json({ parceiros: listarParceiros(), padrao: { fechamento: PCT_FECHAMENTO, uso: PCT_USO, niveis: NIVEIS_CANAL } });
});

router.post("/admin/parceiros-canal", (req, res) => {
  if (!soAdmin(req, res)) return;
  try { res.json(ativarParceiro({ ...(req.body || {}), adminId: req.user.id })); }
  catch (e) { responderErro(res, e); }
});

router.patch("/admin/parceiros-canal/:id", (req, res) => {
  if (!soAdmin(req, res)) return;
  try { res.json(atualizarParceiro(req.params.id, req.body || {})); }
  catch (e) { responderErro(res, e); }
});

// Libera agora as comissões cuja data já chegou (o servidor também faz isso
// sozinho a cada hora). Não antecipa nada: só o que já venceu.
router.post("/admin/parceiros-canal/liberar", async (req, res) => {
  if (!soAdmin(req, res)) return;
  try {
    const r = await liberarERepassar();
    res.json({ liberadas: r.liberadas, totalCents: r.totalCents });
  } catch (e) { responderErro(res, e); }
});

export default router;

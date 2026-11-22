// Rotas da agenda comercial interna (ver server/services/agendaComercial.js).
// `agendaPublica` entra antes do authMiddleware: o quiz é aberto a quem vem
// do anúncio. O resto exige sessão.
import { Router } from "express";
import rateLimit from "express-rate-limit";
import db from "../db.js";
import { criarAgenda, ErroAgenda } from "../services/agendaComercial.js";
import { registrarAgendamentoMeta } from "../services/metaConversoes.js";

const agenda = criarAgenda(db);
export const agendaPublica = Router();
const router = Router();

const responder = (fn) => (req, res) => {
  try {
    res.json(fn(req));
  } catch (e) {
    if (e instanceof ErroAgenda) return res.status(e.status).json({ error: e.message, ...(e.codigo && { codigo: e.codigo }) });
    console.error("[agenda] falha:", e?.message);
    res.status(500).json({ error: "Não foi possível concluir. Tente novamente." });
  }
};
const semCache = (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); };

agendaPublica.get("/agenda-publica/horarios", semCache, responder(() => ({ horarios: agenda.horariosPublicos() })));
agendaPublica.post("/agenda-publica/reservas", semCache,
  rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: "Muitas tentativas. Tente de novo mais tarde." } }),
  responder((req) => {
    const reserva = agenda.reservar(req.body || {});
    registrarAgendamentoMeta(req, reserva.id, req.body);
    return reserva;
  }));

router.get("/agenda-comercial/acesso", (req, res) => {
  try { res.json({ permitido: true, papel: agenda.acesso(req.user) }); } catch { res.json({ permitido: false }); }
});
router.get("/agenda-comercial", semCache, responder((req) => agenda.painel(req.user)));
router.post("/agenda-comercial/closers", responder((req) => agenda.liberar(req.user, req.body?.userId, req.body?.ativo)));
router.post("/agenda-comercial/horarios", responder((req) => agenda.publicar(req.user, req.body || {})));
router.post("/agenda-comercial/horarios/:id/retirar", responder((req) => agenda.retirar(req.user, req.params.id)));
router.post("/agenda-comercial/reunioes/:id/status", responder((req) => agenda.status(req.user, req.params.id, req.body?.status, { reabrir: req.body?.reabrir === true })));

export default router;

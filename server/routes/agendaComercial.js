// Rotas da agenda comercial interna (ver server/services/agendaComercial.js).
// `agendaPublica` entra antes do authMiddleware: o quiz é aberto a quem vem
// do anúncio. O resto exige sessão.
import { Router } from "express";
import rateLimit from "express-rate-limit";
import db from "../db.js";
import { criarAgenda, ErroAgenda } from "../services/agendaComercial.js";
import { registrarAgendamentoMeta } from "../services/metaConversoes.js";
import { verificacaoEmpresa, whatsappEmpresaVerificado } from "../services/whatsappVerificacao.js";

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

// Versão assíncrona do responder (verificação do WhatsApp consulta a Meta).
const responderAsync = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (e) {
    if (e instanceof ErroAgenda) return res.status(e.status).json({ error: e.message, ...(e.codigo && { codigo: e.codigo }) });
    console.error("[agenda] falha:", e?.message);
    res.status(500).json({ error: "Não foi possível concluir. Tente novamente." });
  }
};
const limite = (max, minutos = 60) => rateLimit({ windowMs: minutos * 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { error: "Muitas tentativas. Tente de novo mais tarde." } });

agendaPublica.get("/agenda-publica/horarios", semCache, responder(() => ({ horarios: agenda.horariosPublicos() })));

// Pré-cadastro: dados de contato + respostas do quiz. Devolve id + token (o
// navegador guarda) e o pedido de verificação do WhatsApp.
agendaPublica.post("/agenda-publica/precadastro", semCache, limite(30), responderAsync(async (req) => {
  const { id, token } = agenda.salvarPrecadastro(req.body || {});
  return { id, token, whatsapp: await verificacaoEmpresa(id) };
}));

// Situação da verificação (a página consulta enquanto a pessoa manda a mensagem).
agendaPublica.post("/agenda-publica/precadastro/whatsapp", semCache, limite(400, 30), responderAsync(async (req) => {
  const p = agenda.lerPrecadastro(req.body?.id, req.body?.token);
  return { whatsapp: await verificacaoEmpresa(p.id) };
}));

agendaPublica.post("/agenda-publica/reservas", semCache, limite(20), responderAsync(async (req) => {
  const p = agenda.lerPrecadastro(req.body?.id, req.body?.token);
  const v = await verificacaoEmpresa(p.id);
  const reserva = agenda.reservarPrecadastro(req.body || {}, v);
  registrarAgendamentoMeta(req, reserva.id, { email: p.email, telefone: v.verificado ? v.numero : p.telefone, nome: p.nome });
  return reserva;
}));

router.get("/agenda-comercial/acesso", (req, res) => {
  try { res.json({ permitido: true, papel: agenda.acesso(req.user) }); } catch { res.json({ permitido: false }); }
});
router.get("/agenda-comercial", semCache, responder((req) => {
  const p = agenda.painel(req.user);
  if (p.precadastros) p.precadastros = p.precadastros.map((x) => ({ ...x, whatsapp: whatsappEmpresaVerificado(x.id) }));
  return p;
}));
router.post("/agenda-comercial/closers", responder((req) => agenda.liberar(req.user, req.body?.userId, req.body?.ativo)));
router.post("/agenda-comercial/horarios", responder((req) => agenda.publicar(req.user, req.body || {})));
router.post("/agenda-comercial/horarios/:id/retirar", responder((req) => agenda.retirar(req.user, req.params.id)));
router.post("/agenda-comercial/reunioes/:id/status", responder((req) => agenda.status(req.user, req.params.id, req.body?.status, { reabrir: req.body?.reabrir === true })));

export default router;

// Rotas da agenda comercial interna (ver server/services/agendaComercial.js).
// `agendaPublica` entra antes do authMiddleware: o quiz é aberto a quem vem
// do anúncio. O resto exige sessão.
import { Router } from "express";
import rateLimit from "express-rate-limit";
import db, { ADMIN_EMAIL } from "../db.js";
import { criarAgenda, ErroAgenda } from "../services/agendaComercial.js";
import { registrarAgendamentoMeta } from "../services/metaConversoes.js";
import { whatsappEmpresaVerificado } from "../services/whatsappVerificacao.js";

const agenda = criarAgenda(db);
export const agendaPublica = Router();
const router = Router();

// Agenda padrão (uma vez): conta da plataforma, seg a sex, 8h às 20h. Os
// horários das regras semanais são renovados a cada hora para as próximas
// duas semanas.
function renovarAgenda() {
  try {
    const dono = agenda.garantirAgendaPadrao(ADMIN_EMAIL);
    if (dono) console.log("[agenda] disponibilidade padrão criada: seg a sex, 8h às 20h");
    const criados = agenda.gerarDisponibilidade();
    if (criados) console.log(`[agenda] ${criados} horário(s) gerado(s) pela disponibilidade semanal`);
  } catch (e) {
    console.error("[agenda] renovação da disponibilidade:", e?.message);
  }
}
setTimeout(renovarAgenda, 3000).unref?.();
setInterval(renovarAgenda, 60 * 60 * 1000).unref?.();

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
const limite = (max, minutos = 60) => rateLimit({ windowMs: minutos * 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { error: "Muitas tentativas. Tente de novo mais tarde." } });

agendaPublica.get("/agenda-publica/horarios", semCache, responder(() => ({ horarios: agenda.horariosPublicos() })));

// Pré-cadastro: dados de contato + respostas do quiz. Devolve id + token (o
// navegador guarda para reservar). A confirmação do WhatsApp está desligada
// no quiz por enquanto (pedido do dono da RYCS); o serviço continua pronto.
agendaPublica.post("/agenda-publica/precadastro", semCache, limite(30), responder((req) => agenda.salvarPrecadastro(req.body || {})));

agendaPublica.post("/agenda-publica/reservas", semCache, limite(20), responder((req) => {
  const p = agenda.lerPrecadastro(req.body?.id, req.body?.token);
  const v = whatsappEmpresaVerificado(p.id);
  const reserva = agenda.reservarPrecadastro(req.body || {}, { disponivel: false, verificado: !!v, numero: v?.numero });
  registrarAgendamentoMeta(req, reserva.id, { email: p.email, telefone: v ? v.numero : p.telefone, nome: p.nome });
  // Quem atende não aparece para a empresa: a equipe distribui por trás.
  return { id: reserva.id, inicio: reserva.inicio, fim: reserva.fim };
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
router.post("/agenda-comercial/disponibilidade", responder((req) => agenda.salvarDisponibilidade(req.user, req.body || {})));
router.post("/agenda-comercial/disponibilidade/desativar", responder((req) => agenda.desativarDisponibilidade(req.user, req.body?.closerId)));
router.post("/agenda-comercial/reunioes/:id/transferir", responder((req) => agenda.transferir(req.user, req.params.id, req.body?.closerId)));
router.post("/agenda-comercial/reunioes/:id/resultado", responder((req) => agenda.resultadoVenda(req.user, req.params.id, req.body?.resultado)));
router.post("/agenda-comercial/reunioes/:id/status", responder((req) => agenda.status(req.user, req.params.id, req.body?.status, { reabrir: req.body?.reabrir === true })));

export default router;

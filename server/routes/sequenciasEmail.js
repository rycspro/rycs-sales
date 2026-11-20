import { Router } from "express";
import {
  emailDoParametro, validarDescadastro, descadastrar, resumoSequencias, montarEmail, rodada, destinatariosSequencias } from "../services/sequenciasEmail.js";
import { CHAVES_TEXTOS } from "../../shared/sequenciasEmail.js";
import * as reativacao from "../services/reativacaoEmpresas.js";
import { sendEmail } from "../services/email.js";
import db from "../db.js";
import { assinaturaResendValida, registrarEventoResend, sincronizarStatusResend, metricasSequencias } from "../services/emailMetricas.js";

// Público (sem login): descadastro pelo link do rodapé e pelo botão
// "cancelar inscrição" do Gmail (POST one-click, RFC 8058).
export const sequenciasPublico = Router();

const pagina = (titulo, corpo, form = "", lang = "pt-BR") => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<style>body{font-family:system-ui,sans-serif;background:#f5f7fb;color:#111827;margin:0;padding:48px 16px}
main{max-width:440px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
h1{font-size:20px;margin:0 0 10px}p{color:#4b5563;line-height:1.6}
button{min-height:44px;padding:0 22px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
button:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}</style></head>
<body><main><h1>${titulo}</h1><p>${corpo}</p>${form}</main></body></html>`;

// Textos da página; `l=en` no link (e-mails em inglês) abre em inglês.
const TEXTOS_DESCADASTRO = {
  pt: {
    lang: "pt-BR",
    invalido: ["Link inválido", "Este link de descadastro não é válido. Use o link do e-mail mais recente."],
    confirmar: ["Parar de receber e-mails", "Você não vai mais receber os e-mails de acompanhamento da RYCS. E-mails de segurança da conta e de pagamentos continuam chegando.", "Confirmar descadastro"],
    pronto: ["Pronto", "Você não vai mais receber os e-mails de acompanhamento da RYCS."],
  },
  en: {
    lang: "en",
    invalido: ["Invalid link", "This unsubscribe link is not valid. Please use the link from the most recent email."],
    confirmar: ["Stop receiving emails", "You will no longer receive RYCS updates by email. Account security and payment emails will still be sent.", "Confirm unsubscribe"],
    pronto: ["Done", "You will no longer receive RYCS updates by email."],
  },
};
const textosDescadastro = (req) => TEXTOS_DESCADASTRO[req.query.l === "en" ? "en" : "pt"];

sequenciasPublico.get("/email/descadastro", (req, res) => {
  const t = textosDescadastro(req);
  const email = emailDoParametro(req.query.e);
  if (!email || !validarDescadastro(email, req.query.t)) {
    return res.status(400).send(pagina(t.invalido[0], t.invalido[1], "", t.lang));
  }
  const acao = `/api/email/descadastro?e=${encodeURIComponent(req.query.e)}&t=${encodeURIComponent(req.query.t)}${req.query.l === "en" ? "&l=en" : ""}`;
  res.send(pagina(t.confirmar[0], t.confirmar[1],
    `<form method="post" action="${acao}"><button type="submit">${t.confirmar[2]}</button></form>`, t.lang));
});

sequenciasPublico.post("/email/descadastro", (req, res) => {
  const t = textosDescadastro(req);
  const email = emailDoParametro(req.query.e);
  if (!email || !validarDescadastro(email, req.query.t)) return res.status(400).send(pagina(t.invalido[0], t.invalido[1], "", t.lang));
  descadastrar(email);
  res.send(pagina(t.pronto[0], t.pronto[1], "", t.lang));
});

// Eventos do Resend (entregue, aberto, clicado, devolvido, spam). Assinado
// pelo Svix com RESEND_WEBHOOK_SECRET; sem o segredo, recusa tudo.
sequenciasPublico.post("/webhooks/resend", (req, res) => {
  const corpo = req.rawBody ? req.rawBody.toString("utf8") : null;
  const ok = assinaturaResendValida({
    id: req.headers["svix-id"], timestamp: req.headers["svix-timestamp"], assinatura: req.headers["svix-signature"], corpo,
  });
  if (!ok) return res.status(401).json({ error: "Assinatura inválida." });
  res.json({ ok: true, resultado: registrarEventoResend(req.headers["svix-id"], req.body) });
});

// Admin: acompanhamento, prévia e teste.
const router = Router();
const soAdmin = (req, res, next) => (req.user?.role === "admin" ? next() : res.status(403).json({ error: "Apenas administradores." }));

router.get("/admin/sequencias-email", soAdmin, (req, res) => res.json(resumoSequencias()));

// Entrega, abertura, clique, devolução, spam e descadastro, por e-mail e no total.
router.get("/admin/sequencias-email/metricas", soAdmin, (req, res) => res.json(metricasSequencias()));

// Pergunta ao Resend o status dos e-mails já enviados (antes do webhook).
router.post("/admin/sequencias-email/sincronizar", soAdmin, async (req, res) => res.json(await sincronizarStatusResend()));

// Quem já recebeu cada e-mail, o que falhou e o próximo previsto de cada pessoa.
router.get("/admin/sequencias-email/destinatarios", soAdmin, (req, res) => res.json({ destinatarios: destinatariosSequencias() }));

// Lista de todos os e-mails possíveis, para a prévia.
router.get("/admin/sequencias-email/modelos", soAdmin, (req, res) => {
  res.json({ chaves: CHAVES_TEXTOS });
});

function exemplo(chave, idioma, email) {
  return montarEmail({
    tipo: "vendedor", chave, idioma: idioma === "en" ? "en" : "pt", email,
    nome: "Maria Silva", empresa: "Empresa Exemplo", userId: null,
    seller: { foto: "", bio: "", titulo: "Vendedora", disponibilidade: "integral", cidade: "São Paulo", segmentos: "[\"SaaS\"]", modalidades: "[\"remoto\"]", skills: "[\"prospecção\"]" },
  }, { campanhasAtivas: db.prepare("SELECT COUNT(*) AS n FROM campaigns WHERE status = 'ativa'").get().n, empresasNovasSemana: 0 });
}

router.post("/admin/sequencias-email/previa", soAdmin, (req, res) => {
  const m = exemplo(String(req.body?.chave || ""), req.body?.idioma, req.user.email || "admin@rycs.pro");
  if (!m) return res.status(404).json({ error: "Modelo não encontrado." });
  res.json({ assunto: m.assunto, html: m.html });
});

// Envia o exemplo só para o e-mail do próprio admin logado.
router.post("/admin/sequencias-email/teste", soAdmin, async (req, res) => {
  if (!req.user.email) return res.status(400).json({ error: "Seu usuário não tem e-mail." });
  const m = exemplo(String(req.body?.chave || ""), req.body?.idioma, req.user.email);
  if (!m) return res.status(404).json({ error: "Modelo não encontrado." });
  const r = await sendEmail(req.user.email, `[Teste] ${m.assunto}`, m.html, { text: m.text, headers: m.headers });
  if (!r?.ok) return res.status(502).json({ error: r?.error || "Falha no envio." });
  res.json({ ok: true, para: req.user.email });
});

// Força o disparo agora para todos na fila: ignora o horário e o teto de
// aquecimento; continua 1 por pessoa a cada 20h e respeita o descadastro.
router.post("/admin/sequencias-email/rodar", soAdmin, async (req, res) => {
  const total = { enviados: 0, falhas: 0, inativados: 0 };
  let r = {};
  for (let i = 0; i < 100; i++) {
    r = await rodada(Date.now(), { ignorarJanela: true, ignorarTeto: true });
    if (r?.ocupado) { if (i === 0) return res.json({ ocupado: true }); break; }
    total.enviados += r.enviados || 0;
    total.falhas += r.falhas || 0;
    total.inativados += r.inativados || 0;
    if (r.tetoAtingido || !r.enviados || (r.falhas || 0) >= 3) break;
  }
  res.json({ ...total, tetoAtingido: !!r.tetoAtingido });
});

// ─── Reativação de empresas ────────────────────────────────────────────────
// Configuração, pendências, métricas e a última simulação da rodada.
router.get("/admin/reativacao", soAdmin, (req, res) => res.json(reativacao.painel()));

// DRY_RUN: quem receberia o quê hoje (o dia inteiro), sem enviar nem gravar.
router.get("/admin/reativacao/simulacao", soAdmin, (req, res) =>
  res.json(reativacao.resumirPlano(reativacao.planejar(Date.now(), { diaInteiro: true }))));

// Teste interno: todos os e-mails e os modelos aprovados para um e-mail e um número.
router.post("/admin/reativacao/teste", soAdmin, async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const numero = String(req.body?.numero || "").trim();
  if (!email && !numero) return res.status(400).json({ error: "Informe um e-mail ou um número." });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "E-mail inválido." });
  res.json(await reativacao.enviarTeste({ email, numero }));
});

export default router;

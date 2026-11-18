import { Router } from "express";
import {
  emailDoParametro, validarDescadastro, descadastrar, resumoSequencias, montarEmail, rodada, destinatariosSequencias } from "../services/sequenciasEmail.js";
import { CHAVES_TEXTOS, PASSOS_EMPRESA_OFFLINE } from "../../shared/sequenciasEmail.js";
import { sendEmail } from "../services/email.js";
import db from "../db.js";

// Público (sem login): descadastro pelo link do rodapé e pelo botão
// "cancelar inscrição" do Gmail (POST one-click, RFC 8058).
export const sequenciasPublico = Router();

const pagina = (titulo, corpo, form = "") => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<style>body{font-family:system-ui,sans-serif;background:#f5f7fb;color:#111827;margin:0;padding:48px 16px}
main{max-width:440px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
h1{font-size:20px;margin:0 0 10px}p{color:#4b5563;line-height:1.6}
button{min-height:44px;padding:0 22px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
button:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}</style></head>
<body><main><h1>${titulo}</h1><p>${corpo}</p>${form}</main></body></html>`;

sequenciasPublico.get("/email/descadastro", (req, res) => {
  const email = emailDoParametro(req.query.e);
  if (!email || !validarDescadastro(email, req.query.t)) {
    return res.status(400).send(pagina("Link inválido", "Este link de descadastro não é válido. Use o link do e-mail mais recente."));
  }
  const acao = `/api/email/descadastro?e=${encodeURIComponent(req.query.e)}&t=${encodeURIComponent(req.query.t)}`;
  res.send(pagina("Parar de receber e-mails",
    "Você não vai mais receber os e-mails de acompanhamento da RYCS. E-mails de segurança da conta e de pagamentos continuam chegando.",
    `<form method="post" action="${acao}"><button type="submit">Confirmar descadastro</button></form>`));
});

sequenciasPublico.post("/email/descadastro", (req, res) => {
  const email = emailDoParametro(req.query.e);
  if (!email || !validarDescadastro(email, req.query.t)) return res.status(400).send(pagina("Link inválido", "Este link de descadastro não é válido."));
  descadastrar(email);
  res.send(pagina("Pronto", "Você não vai mais receber os e-mails de acompanhamento da RYCS."));
});

// Admin: acompanhamento, prévia e teste.
const router = Router();
const soAdmin = (req, res, next) => (req.user?.role === "admin" ? next() : res.status(403).json({ error: "Apenas administradores." }));

router.get("/admin/sequencias-email", soAdmin, (req, res) => res.json(resumoSequencias()));

// Quem já recebeu cada e-mail, o que falhou e o próximo previsto de cada pessoa.
router.get("/admin/sequencias-email/destinatarios", soAdmin, (req, res) => res.json({ destinatarios: destinatariosSequencias() }));

// Lista de todos os e-mails possíveis, para a prévia.
router.get("/admin/sequencias-email/modelos", soAdmin, (req, res) => {
  const chaves = [...CHAVES_TEXTOS, ...Array.from({ length: PASSOS_EMPRESA_OFFLINE }, (_, i) => `empresas_offline:d${i + 1}`)];
  res.json({ chaves });
});

function exemplo(chave, idioma, email) {
  const empresa = chave.startsWith("empresas_offline:");
  return montarEmail({
    tipo: empresa ? "empresa" : "vendedor", chave, idioma: idioma === "en" ? "en" : "pt", email,
    nome: empresa ? "Empresa Exemplo" : "Maria Silva", empresa: "Empresa Exemplo", userId: null,
    passo: empresa ? Number(chave.split(":d")[1]) - 1 : undefined,
    seller: empresa ? null : { foto: "", bio: "", titulo: "Vendedora", disponibilidade: "integral", cidade: "São Paulo", segmentos: "[\"SaaS\"]", modalidades: "[\"remoto\"]", skills: "[\"prospecção\"]" },
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

export default router;

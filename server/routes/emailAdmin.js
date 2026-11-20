import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { sendEmail, emailFotoPendente, layoutSequencia, urlApp } from "../services/email.js";
import { numeroWhatsapp } from "../services/whatsappDisparo.js";
import { linkDescadastro, descadastrados, esperar, limiteDeTaxa, PAUSA_ENTRE_ENVIOS_MS } from "../services/sequenciasEmail.js";
import { TEXTO_DESCADASTRO } from "../../shared/sequenciasEmail.js";
import { pendenciasPerfil } from "../../shared/perfilVendedor.js";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

// Criar tabela de log se não existir
db.exec(`CREATE TABLE IF NOT EXISTS email_dispatches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  adminId TEXT NOT NULL,
  assunto TEXT NOT NULL,
  publico TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enviado',
  resendId TEXT,
  criadoEm INTEGER NOT NULL
)`);

// Cada envio dos disparos para leads: guarda quem já recebeu cada assunto,
// para o próximo lote continuar de onde parou.
db.exec(`CREATE TABLE IF NOT EXISTS email_dispatch_envios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispatchId INTEGER NOT NULL,
  publico TEXT NOT NULL,
  assunto TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  resendId TEXT,
  erro TEXT,
  enviadoEm INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dispatch_envios_pub ON email_dispatch_envios (publico, assunto);`);
// Lote que estava enviando quando o servidor reiniciou: o resto sai no próximo clique.
db.prepare("UPDATE email_dispatches SET status = 'interrompido' WHERE status = 'enviando'").run();

// ── Leads dos formulários da Meta ─────────────────────────────────────
// Quem preencheu um formulário de anúncio da RYCS. Vai em inglês, com link de
// descadastro, em lotes (aquecimento do domínio) e com pausa entre envios.
export const PUBLICOS_LEADS = {
  leads_india: { label: "Leads da Meta (Índia)", ddi: "91", paises: ["in", "india"] },
};
const LOTE_PADRAO = 200;
const LOTE_MAXIMO = 1000;
const loteValido = (n) => Math.min(LOTE_MAXIMO, Math.max(1, Math.floor(Number(n) || LOTE_PADRAO)));
const ehEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Leads do país (pelo telefone ou pelo país do formulário) com e-mail válido.
// Fica de fora quem já tem conta (mesmo e-mail), quem se descadastrou e quem
// já recebeu um disparo deste público com o mesmo assunto.
export function leadsDoPublico(publico, assunto = "") {
  const p = PUBLICOS_LEADS[publico];
  if (!p) return null;
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'rycs_leads_meta'").get()) return { pendentes: [], jaReceberam: 0 };
  const comConta = new Set(db.prepare("SELECT lower(email) AS e FROM users WHERE email IS NOT NULL").all().map((u) => u.e));
  const fora = descadastrados();
  const recebidos = new Set(db.prepare("SELECT email FROM email_dispatch_envios WHERE publico = ? AND assunto = ? AND status = 'enviado'")
    .all(publico, String(assunto).trim()).map((r) => r.email));
  const vistos = new Set();
  const pendentes = [];
  let jaReceberam = 0;
  for (const l of db.prepare("SELECT nome, lower(trim(email)) AS email, telefone, pais FROM rycs_leads_meta ORDER BY criadoEm").all()) {
    if (!ehEmail(l.email) || vistos.has(l.email)) continue;
    const doPais = numeroWhatsapp(l.telefone, l.pais).startsWith(p.ddi) || p.paises.includes(semAcento(l.pais).trim().toLowerCase());
    if (!doPais) continue;
    vistos.add(l.email);
    if (comConta.has(l.email) || fora.has(l.email)) continue;
    if (recebidos.has(l.email)) { jaReceberam++; continue; }
    pendentes.push({ email: l.email, nome: l.nome });
  }
  return { pendentes, jaReceberam };
}

// Primeiro nome para {{nome}}; nome todo em maiúsculas/minúsculas vira "Rahul".
function primeiroNome(nome) {
  const n = String(nome || "").trim().split(/\s+/)[0] || "";
  if (!n || (n !== n.toUpperCase() && n !== n.toLowerCase())) return n;
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

// E-mail em inglês para um lead: layout das sequências (logo, um botão,
// rodapé com descadastro), versão texto e descadastro em um clique.
export function emailParaLead({ assunto, preheader, conteudo, cta, botao, nome, email, publico }) {
  const trocar = (t) => String(t || "").replace(/\{\{\s*nome\s*\}\}/gi, primeiroNome(nome) || "there");
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const titulo = trocar(assunto).trim();
  const corpo = trocar(conteudo).trim();
  const paragrafos = corpo.split(/\n{2,}/).map((t) => esc(t.trim()).replace(/\n/g, "<br>")).filter(Boolean);
  const textoBotao = String(botao || "").trim() || "Get started";
  const link = String(cta || "").trim() || `${urlApp()}/?utm_source=email&utm_medium=disparo&utm_campaign=${publico}`;
  const descadastro = linkDescadastro(email, "en");
  const html = layoutSequencia({
    titulo, paragrafos, botao: textoBotao, link, rodape: "The RYCS team",
    descadastro, textoDescadastro: TEXTO_DESCADASTRO.en, preheader: trocar(preheader).trim(),
  });
  const text = [titulo, "", corpo, "", `${textoBotao}: ${link}`, "", `${TEXTO_DESCADASTRO.en}: ${descadastro}`].join("\n");
  return {
    assunto: titulo, html, text,
    headers: { "List-Unsubscribe": `<${descadastro}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

// Envia o lote em segundo plano e vai atualizando o histórico do disparo.
let loteLeadsEmAndamento = false;
export async function enviarLoteLeads({ dispatchId, publico, lote, dados }) {
  let enviados = 0, falhas = 0, falhasSeguidas = 0, ultimoId = null;
  const assunto = String(dados.assunto).trim();
  try {
    for (const d of lote) {
      const m = emailParaLead({ ...dados, ...d, publico });
      let r;
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        await esperar(PAUSA_ENTRE_ENVIOS_MS * (tentativa === 0 ? 1 : 3 * tentativa));
        r = await sendEmail(d.email, m.assunto, m.html, { text: m.text, headers: m.headers });
        if (r?.ok || !limiteDeTaxa(r?.error)) break;
      }
      const ok = !!r?.ok;
      db.prepare("INSERT INTO email_dispatch_envios (dispatchId, publico, assunto, email, status, resendId, erro, enviadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(dispatchId, publico, assunto, d.email, ok ? "enviado" : "falhou", r?.id || null, ok ? null : String(r?.error || "").slice(0, 300), Date.now());
      if (ok) { enviados++; falhasSeguidas = 0; if (r.id) ultimoId = r.id; }
      else { falhas++; falhasSeguidas++; }
      db.prepare("UPDATE email_dispatches SET quantidade = ? WHERE id = ?").run(enviados, dispatchId);
      // Muitas falhas seguidas (cota do Resend, domínio): para e deixa o resto para depois.
      if (falhasSeguidas >= 10) break;
    }
  } finally {
    const status = falhas === 0 ? "enviado" : enviados === 0 ? "falhou" : "parcial";
    db.prepare("UPDATE email_dispatches SET quantidade = ?, status = ?, resendId = ? WHERE id = ?").run(enviados, status, ultimoId, dispatchId);
    loteLeadsEmAndamento = false;
  }
  return { enviados, falhas };
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito ao administrador." });
  next();
}

function getDestinatarios(publico, emailsCustom) {
  if (publico === "custom") {
    const emails = (emailsCustom || "")
      .split(/[\n,]/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));
    return { emails, label: "Seleção manual" };
  }
  const where = {
    todos: "1=1",
    empresas: "role = 'empresa'",
    profissionais: "role = 'vendedor'",
  }[publico] || "1=1";
  const rows = db.prepare(`SELECT email FROM users WHERE ${where}`).all();
  const labels = { todos: "Todos os usuários", empresas: "Empresas", profissionais: "Profissionais" };
  return { emails: rows.map((r) => r.email), label: labels[publico] || publico };
}

// GET /api/admin/emails — histórico
router.get("/admin/emails", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM email_dispatches ORDER BY criadoEm DESC LIMIT 100").all();
  res.json(rows);
});

// POST /api/admin/emails/preview — retorna quantidade de destinatários
router.post("/admin/emails/preview", requireAdmin, (req, res) => {
  const { publico, emailsCustom, assunto, lote } = req.body;
  if (PUBLICOS_LEADS[publico]) {
    const { pendentes, jaReceberam } = leadsDoPublico(publico, assunto);
    return res.json({
      quantidade: Math.min(loteValido(lote), pendentes.length), pendentes: pendentes.length, jaReceberam,
      publicoLabel: PUBLICOS_LEADS[publico].label, idioma: "en", emAndamento: loteLeadsEmAndamento,
    });
  }
  const { emails, label } = getDestinatarios(publico, emailsCustom);
  res.json({ quantidade: emails.length, publicoLabel: label });
});

// POST /api/admin/emails/teste — envia e-mail de teste
router.post("/admin/emails/teste", requireAdmin, async (req, res) => {
  const { para, assunto, preheader, conteudo, cta, botao, publico } = req.body;
  if (!para || !assunto || !conteudo) return res.status(400).json({ error: "Campos obrigatórios ausentes." });

  if (PUBLICOS_LEADS[publico]) {
    const m = emailParaLead({ assunto, preheader, conteudo, cta, botao, nome: "", email: para, publico });
    const r = await sendEmail(para, `[TEST] ${m.assunto}`, m.html, { text: m.text, headers: m.headers });
    if (!r.ok) return res.status(500).json({ error: r.error || "Falha ao enviar." });
    return res.json({ ok: true });
  }

  const html = buildHtml({ assunto, preheader, conteudo, cta, teste: true });
  const r = await sendEmail(para, `[TESTE] ${assunto}`, html);
  if (!r.ok) return res.status(500).json({ error: r.error || "Falha ao enviar." });
  res.json({ ok: true });
});

// POST /api/admin/emails/disparar — disparo real
router.post("/admin/emails/disparar", requireAdmin, async (req, res) => {
  const { publico, emailsCustom, assunto, preheader, conteudo, cta, botao, lote } = req.body;
  if (!assunto || !conteudo) return res.status(400).json({ error: "Assunto e conteúdo são obrigatórios." });

  if (PUBLICOS_LEADS[publico]) {
    if (loteLeadsEmAndamento) return res.status(409).json({ error: "Já há um lote sendo enviado. Aguarde terminar." });
    const { pendentes } = leadsDoPublico(publico, assunto);
    const escolhidos = pendentes.slice(0, loteValido(lote));
    if (!escolhidos.length) return res.status(400).json({ error: "Nenhum lead pendente para este assunto." });
    loteLeadsEmAndamento = true;
    const criadoEm = Date.now();
    const label = `${PUBLICOS_LEADS[publico].label} · lote de ${escolhidos.length}`;
    const assuntoLimpo = String(assunto).trim();
    const info = db.prepare(
      "INSERT INTO email_dispatches (adminId, assunto, publico, quantidade, status, resendId, criadoEm) VALUES (?, ?, ?, 0, 'enviando', NULL, ?)"
    ).run(req.user.id, assuntoLimpo, label, criadoEm);
    enviarLoteLeads({ dispatchId: info.lastInsertRowid, publico, lote: escolhidos, dados: { assunto: assuntoLimpo, preheader, conteudo, cta, botao } })
      .catch((err) => console.error("[EMAIL] Lote de leads:", err.message));
    return res.json({
      ok: true, quantidade: escolhidos.length, emAndamento: true, status: "enviando",
      registro: { id: info.lastInsertRowid, assunto: assuntoLimpo, publico: label, quantidade: 0, status: "enviando", criadoEm },
    });
  }

  const { emails, label } = getDestinatarios(publico, emailsCustom);
  if (!emails.length) return res.status(400).json({ error: "Nenhum destinatário encontrado." });

  const html = buildHtml({ assunto, preheader, conteudo, cta });
  let enviados = 0;
  let falhas = 0;
  let lastResendId = null;

  for (const email of emails) {
    const r = await sendEmail(email, assunto, html);
    if (r.ok) { enviados++; if (r.id) lastResendId = r.id; }
    else falhas++;
  }

  const status = falhas === 0 ? "enviado" : enviados === 0 ? "falhou" : "parcial";
  const criadoEm = Date.now();
  const stmt = db.prepare(
    "INSERT INTO email_dispatches (adminId, assunto, publico, quantidade, status, resendId, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const info = stmt.run(req.user.id, assunto, label, enviados, status, lastResendId, criadoEm);

  res.json({
    ok: true,
    quantidade: enviados,
    falhas,
    status,
    registro: { id: info.lastInsertRowid, assunto, publico: label, quantidade: enviados, status, criadoEm },
  });
});

function buildHtml({ assunto, preheader, conteudo, cta, teste }) {
  const APP_URL = process.env.FRONTEND_URL || "https://rycs.com.br";
  const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const ctaHtml = cta
    ? `<div style="text-align:center;margin:24px 0 16px"><a href="${esc(cta)}" style="background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Acessar</a></div>`
    : "";
  const testeTag = teste ? `<div style="background:#fef3c7;color:#92400e;padding:7px 12px;border-radius:6px;font-size:12px;margin-bottom:14px;text-align:center">⚠️ Este é um e-mail de TESTE</div>` : "";
  return `
    <div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;color:#1f2937">
      ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;color:transparent">${esc(preheader)}</div>` : ""}
      <div style="background:#1a2744;padding:16px 24px;border-radius:12px 12px 0 0;text-align:center">
        <span style="color:#60a5fa;font-size:26px;font-weight:800">R</span>
        <span style="color:#fff;font-size:18px;font-weight:700;margin-left:4px">RYCS</span>
      </div>
      <div style="background:#f9fafb;padding:28px 24px;border-radius:0 0 12px 12px">
        ${testeTag}
        <h2 style="margin:0 0 16px;font-size:19px;color:#0b1220">${esc(assunto)}</h2>
        <div style="color:#4b5563;line-height:1.7;font-size:14px;white-space:pre-wrap">${esc(conteudo)}</div>
        ${ctaHtml}
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0"/>
        <p style="color:#9ca3af;font-size:12px;margin:0">Equipe RYCS Sales Machine · <a href="${APP_URL}" style="color:#6b7280">${APP_URL}</a></p>
      </div>
    </div>`;
}

// POST /api/admin/emails/disparar-foto-pendente
// Disparo para todos os profissionais com cadastro incompleto (sem foto ou outros campos)
router.post("/admin/emails/disparar-foto-pendente", requireAdmin, async (req, res) => {
  const profissionais = db.prepare(
    "SELECT id, nome, email, foto, titulo, bio, disponibilidade, cidade, segmentos, modalidades, skills FROM sellers WHERE status NOT IN ('excluido','bloqueado')"
  ).all();

  const incompletos = profissionais.filter((s) => {
    s._pendentes = pendenciasPerfil(s);
    return s._pendentes.length > 0;
  });

  if (!incompletos.length) return res.json({ ok: true, quantidade: 0, falhas: 0, mensagem: "Nenhum profissional com cadastro incompleto." });

  let enviados = 0, falhas = 0;
  for (const s of incompletos) {
    const r = await emailFotoPendente({ nome: s.nome, email: s.email, camposPendentes: s._pendentes });
    if (r.ok) enviados++; else falhas++;
  }

  const status = falhas === 0 ? "enviado" : enviados === 0 ? "falhou" : "parcial";
  db.prepare(
    "INSERT INTO email_dispatches (adminId, assunto, publico, quantidade, status, resendId, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(req.user.id, "Cadastro incompleto — foto e dados pendentes", "Profissionais sem cadastro completo", enviados, status, null, Date.now());

  res.json({ ok: true, quantidade: enviados, falhas, totalIncompletos: incompletos.length, status });
});

// GET /api/admin/emails/foto-pendente/preview — quantos serão afetados
router.get("/admin/emails/foto-pendente/preview", requireAdmin, (req, res) => {
  const profissionais = db.prepare(
    "SELECT id, foto, titulo, bio, disponibilidade, cidade, segmentos, modalidades, skills FROM sellers WHERE status NOT IN ('excluido','bloqueado')"
  ).all();
  const total = profissionais.filter((s) => pendenciasPerfil(s).length > 0).length;
  res.json({ total });
});

// GET /api/admin/email-templates
router.get("/admin/email-templates", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM email_templates ORDER BY nome").all();
  res.json(rows);
});

// PATCH /api/admin/email-templates/:id — edita o conteúdo de um template.
router.patch("/admin/email-templates/:id", requireAdmin, (req, res) => {
  const tpl = db.prepare("SELECT id FROM email_templates WHERE id = ?").get(req.params.id);
  if (!tpl) return res.status(404).json({ error: "Template não encontrado" });
  const campos = ["nome", "assunto", "preheader", "conteudo", "cta"];
  const sets = [], vals = [];
  for (const c of campos) if (typeof req.body?.[c] === "string") { sets.push(`${c} = ?`); vals.push(req.body[c].slice(0, 8000)); }
  if (!sets.length) return res.status(400).json({ error: "Nada para atualizar" });
  vals.push(req.params.id);
  db.prepare(`UPDATE email_templates SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// POST /api/admin/emails/ai-generate — gera e-mail via IA
router.post("/admin/emails/ai-generate", requireAdmin, async (req, res) => {
  const { prompt, action, assunto, conteudo } = req.body;

  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(503).json({ error: "IA não configurada neste ambiente." });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let systemPrompt, userMsg;

  if (action && assunto) {
    // Melhorar e-mail existente
    const acoes = {
      curto: "Reescreva o e-mail de forma mais curta e direta, mantendo a mensagem essencial.",
      persuasivo: "Reescreva o e-mail de forma mais persuasiva, com gatilhos de urgência e valor.",
      profissional: "Reescreva o e-mail com tom mais formal e profissional.",
      amigavel: "Reescreva o e-mail com tom mais amigável e próximo.",
      assunto: "Crie 3 opções de assunto melhores para este e-mail. Retorne só os assuntos, um por linha.",
      cta: "Crie 3 opções de texto para o botão CTA deste e-mail. Retorne só os textos, um por linha.",
      corrigir: "Corrija erros de português e melhore a clareza do texto.",
    };
    systemPrompt = "Você é especialista em copywriting para e-mails B2B. Responda apenas com o texto solicitado, sem explicações.";
    userMsg = `${acoes[action] || "Melhore este e-mail."}\n\nAssunto: ${assunto}\n\nConteúdo:\n${conteudo || ""}`;
  } else {
    // Criar e-mail do zero
    systemPrompt = `Você é especialista em copywriting para e-mails B2B da plataforma Hicks Pro, uma plataforma SaaS para gestão de operações comerciais com vendedores freelance.
Responda SOMENTE com JSON válido, sem markdown, sem explicações.
Formato: {"assunto":"...","preheader":"...","titulo":"...","conteudo":"...","cta":"...","versaoTexto":"..."}`;
    userMsg = prompt || "Crie um e-mail de engajamento para empresas da plataforma.";
  }

  try {
    const out = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: userMsg }],
      system: systemPrompt,
    });
    const texto = out.content.map((b) => b.text || "").join("").trim();
    if (action) return res.json({ ok: true, resultado: texto });
    // Tentar parsear JSON
    try {
      const dados = JSON.parse(texto.replace(/```json|```/g, "").trim());
      return res.json({ ok: true, dados });
    } catch {
      return res.json({ ok: true, dados: { assunto: "", preheader: "", titulo: "", conteudo: texto, cta: "" } });
    }
  } catch (err) {
    res.status(502).json({ error: err.message || "Erro ao gerar e-mail." });
  }
});

// GET /api/admin/email-sequences
router.get("/admin/email-sequences", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM email_sequences ORDER BY criadoEm DESC LIMIT 200").all();
  res.json(rows);
});

// POST /api/admin/email-sequences — iniciar sequência
router.post("/admin/email-sequences", requireAdmin, (req, res) => {
  const { tipo, email, companyId, userId } = req.body;
  if (!tipo || !email) return res.status(400).json({ error: "tipo e email são obrigatórios." });
  if (!["recuperacao", "reativacao", "bloqueio"].includes(tipo))
    return res.status(400).json({ error: "tipo inválido." });

  // Evitar sequência duplicada ativa
  const existente = db.prepare(
    "SELECT id FROM email_sequences WHERE email = ? AND tipo = ? AND status = 'ativa'"
  ).get(email, tipo);
  if (existente) return res.status(409).json({ error: "Já existe uma sequência ativa para este e-mail e tipo." });

  const id = uid();
  db.prepare(
    "INSERT INTO email_sequences (id,tipo,companyId,userId,email,passo,status,proximoEnvio,criadoEm) VALUES (?,?,?,?,?,0,'ativa',?,?)"
  ).run(id, tipo, companyId || null, userId || null, email, agora(), agora());

  res.json({ ok: true, id });
});

// PATCH /api/admin/email-sequences/:id/stop — parar sequência
router.patch("/admin/email-sequences/:id/stop", requireAdmin, (req, res) => {
  const motivo = req.body?.motivo || "admin";
  db.prepare("UPDATE email_sequences SET status = 'parada', resolvidoEm = ? WHERE id = ?")
    .run(agora(), req.params.id);
  res.json({ ok: true });
});

export default router;

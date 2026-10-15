import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { sendEmail, emailFotoPendente } from "../services/email.js";
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
  const { publico, emailsCustom } = req.body;
  const { emails, label } = getDestinatarios(publico, emailsCustom);
  res.json({ quantidade: emails.length, publicoLabel: label });
});

// POST /api/admin/emails/teste — envia e-mail de teste
router.post("/admin/emails/teste", requireAdmin, async (req, res) => {
  const { para, assunto, preheader, conteudo, cta } = req.body;
  if (!para || !assunto || !conteudo) return res.status(400).json({ error: "Campos obrigatórios ausentes." });

  const html = buildHtml({ assunto, preheader, conteudo, cta, teste: true });
  const r = await sendEmail(para, `[TESTE] ${assunto}`, html);
  if (!r.ok) return res.status(500).json({ error: r.error || "Falha ao enviar." });
  res.json({ ok: true });
});

// POST /api/admin/emails/disparar — disparo real
router.post("/admin/emails/disparar", requireAdmin, async (req, res) => {
  const { publico, emailsCustom, assunto, preheader, conteudo, cta } = req.body;
  if (!assunto || !conteudo) return res.status(400).json({ error: "Assunto e conteúdo são obrigatórios." });

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
  const CAMPOS_OBRIGATORIOS = [
    { campo: "foto", label: "Foto de perfil" },
    { campo: "titulo", label: "Título profissional" },
    { campo: "bio", label: "Descrição pessoal (Bio)" },
    { campo: "disponibilidade", label: "Disponibilidade" },
    { campo: "cidade", label: "Cidade" },
  ];
  const CAMPOS_LISTA = [
    { campo: "segmentos", label: "Segmentos de atuação" },
    { campo: "modalidades", label: "Modalidades de trabalho" },
    { campo: "skills", label: "Habilidades (Skills)" },
  ];

  const profissionais = db.prepare(
    "SELECT id, nome, email, foto, titulo, bio, disponibilidade, cidade, segmentos, modalidades, skills FROM sellers WHERE status NOT IN ('excluido','bloqueado')"
  ).all();

  const incompletos = profissionais.filter((s) => {
    const pendentes = [];
    for (const { campo, label } of CAMPOS_OBRIGATORIOS) {
      if (!s[campo]) pendentes.push(label);
    }
    for (const { campo, label } of CAMPOS_LISTA) {
      let lista = [];
      try { lista = JSON.parse(s[campo] || "[]"); } catch {}
      if (!lista.length) pendentes.push(label);
    }
    s._pendentes = pendentes;
    return pendentes.length > 0;
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
  const total = profissionais.filter((s) => {
    if (!s.foto || !s.titulo || !s.bio || !s.disponibilidade || !s.cidade) return true;
    for (const campo of ["segmentos", "modalidades", "skills"]) {
      let lista = []; try { lista = JSON.parse(s[campo] || "[]"); } catch {}
      if (!lista.length) return true;
    }
    return false;
  }).length;
  res.json({ total });
});

// GET /api/admin/email-templates
router.get("/admin/email-templates", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM email_templates ORDER BY nome").all();
  res.json(rows);
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

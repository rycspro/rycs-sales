import { Router } from "express";
import db from "../db.js";
import { sendEmail } from "../services/email.js";

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
        <p style="color:#9ca3af;font-size:12px;margin:0">Equipe RYCS Sales Solutions · <a href="${APP_URL}" style="color:#6b7280">${APP_URL}</a></p>
      </div>
    </div>`;
}

export default router;

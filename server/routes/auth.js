import { Router } from "express";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db, { uid, agora } from "../db.js";
import { signToken, usuarioDev } from "../middleware/auth.js";
import { emailBoasVindas, emailResetSenha } from "../services/email.js";

const router = Router();
const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

router.post("/auth/login", (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: "E-mail e senha são obrigatórios" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(senha, user.senha)) {
    return res.status(401).json({ error: "E-mail ou senha incorretos" });
  }

  const token = signToken({ id: user.id, role: user.role, entityId: user.entityId });
  res.cookie("sm_token", token, COOKIE_OPTS);
  res.json({ id: user.id, email: user.email, role: user.role, entityId: user.entityId });
});

router.post("/auth/register", (req, res) => {
  const { email, senha, role, nome, whats, cidade, perfil, produto, ticket, icp, aceitouTermos } = req.body;
  if (!email || !senha || !role) return res.status(400).json({ error: "email, senha e role são obrigatórios" });
  if (!["vendedor", "empresa"].includes(role)) return res.status(400).json({ error: "role deve ser vendedor ou empresa" });
  if (senha.length < 6) return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
  if (!aceitouTermos) return res.status(400).json({ error: "Você deve aceitar os termos de uso" });

  const emailNorm = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm))
    return res.status(400).json({ error: "E-mail inválido" });

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(emailNorm);
  if (exists) return res.status(409).json({ error: "E-mail já cadastrado" });

  const hash = bcrypt.hashSync(senha, 10);
  const userId = uid();
  let entityId = null;
  const nomeClean = (nome || emailNorm.split("@")[0]).slice(0, 100);

  if (role === "vendedor") {
    entityId = uid();
    db.prepare(`
      INSERT INTO sellers (id, nome, email, whats, cidade, perfil, experiencia, status, nota, nivel, pix, disponivel, pendente, sacado, respostas, video, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, '', 'triagem', 0, 'starter', '', 0, 0, 0, '[]', '', ?)
    `).run(entityId, nomeClean, emailNorm, whats || "", cidade || "", perfil || "sdr", agora());
  } else if (role === "empresa") {
    entityId = uid();
    db.prepare(`
      INSERT INTO companies (id, nome, produto, ticket, icp, plano, destaque, saldo, vagas, cor, totalAportado, criadoEm, comissoes, curso, aportes)
      VALUES (?, ?, ?, ?, ?, 'saldo', 0, 0, 10, '#2563EB', 0, ?, '{}', '[]', '[]')
    `).run(entityId, nomeClean, produto || "", ticket || "", icp || "", agora());
  }

  db.prepare("INSERT INTO users (id, email, senha, role, entityId, aceitouTermos, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    userId, emailNorm, hash, role, entityId, 1, agora()
  );

  emailBoasVindas(nomeClean, emailNorm, role);

  const token = signToken({ id: userId, role, entityId });
  res.cookie("sm_token", token, COOKIE_OPTS);
  res.json({ id: userId, email: emailNorm, role, entityId });
});

router.post("/auth/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "E-mail é obrigatório" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!user) return res.json({ ok: true, message: "Se o e-mail existir, enviaremos um link." });

  const resetToken = randomBytes(32).toString("hex");
  const resetExpira = agora() + 3600000; // 1 hour

  db.prepare("UPDATE users SET resetToken = ?, resetExpira = ? WHERE id = ?").run(resetToken, resetExpira, user.id);

  const nome = user.role === "vendedor"
    ? db.prepare("SELECT nome FROM sellers WHERE id = ?").get(user.entityId)?.nome
    : user.role === "empresa"
    ? db.prepare("SELECT nome FROM companies WHERE id = ?").get(user.entityId)?.nome
    : "Admin";

  emailResetSenha(nome || "Usuário", user.email, resetToken, FRONTEND);

  res.json({ ok: true, message: "Se o e-mail existir, enviaremos um link." });
});

router.post("/auth/reset-password", (req, res) => {
  const { token, senha } = req.body;
  if (!token || !senha) return res.status(400).json({ error: "Token e senha são obrigatórios" });
  if (senha.length < 6) return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });

  const user = db.prepare("SELECT * FROM users WHERE resetToken = ?").get(token);
  if (!user || !user.resetExpira || user.resetExpira < agora()) {
    return res.status(400).json({ error: "Link expirado ou inválido. Solicite novamente." });
  }

  const hash = bcrypt.hashSync(senha, 10);
  db.prepare("UPDATE users SET senha = ?, resetToken = NULL, resetExpira = NULL WHERE id = ?").run(hash, user.id);

  res.json({ ok: true, message: "Senha redefinida com sucesso." });
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie("sm_token", { path: "/" });
  res.json({ ok: true });
});

router.get("/auth/me", (req, res) => {
  // Modo sem login (só fora de produção): responde já autenticado.
  const dev = usuarioDev();
  if (dev) return res.json(dev);

  const token = req.cookies?.sm_token;
  if (!token) return res.status(401).json({ error: "Não autenticado" });

  try {
    const { id, role, entityId } = jwt.verify(
      token,
      process.env.JWT_SECRET || "salesmachine-dev-secret-change-in-production"
    );
    const user = db.prepare("SELECT id, email, role, entityId FROM users WHERE id = ?").get(id);
    if (!user) {
      res.clearCookie("sm_token", { path: "/" });
      return res.status(401).json({ error: "Usuário não encontrado" });
    }
    res.json(user);
  } catch {
    res.clearCookie("sm_token", { path: "/" });
    return res.status(401).json({ error: "Sessão expirada" });
  }
});

export default router;

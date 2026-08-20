import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db, { uid, agora } from "../db.js";
import { signToken } from "../middleware/auth.js";

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
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
  const { email, senha, role, nome, produto, ticket, icp } = req.body;
  if (!email || !senha || !role) return res.status(400).json({ error: "email, senha e role são obrigatórios" });
  if (!["vendedor", "empresa"].includes(role)) return res.status(400).json({ error: "role deve ser vendedor ou empresa" });
  if (senha.length < 6) return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (exists) return res.status(409).json({ error: "E-mail já cadastrado" });

  const hash = bcrypt.hashSync(senha, 10);
  const userId = uid();
  let entityId = null;

  if (role === "vendedor") {
    entityId = uid();
    db.prepare(`
      INSERT INTO sellers (id, nome, email, whats, cidade, perfil, experiencia, status, nota, pix, disponivel, pendente, sacado, respostas, video, criadoEm)
      VALUES (?, ?, ?, '', '', 'sdr', '', 'triagem', 0, '', 0, 0, 0, '[]', '', ?)
    `).run(entityId, nome || email.split("@")[0], email.toLowerCase().trim(), agora());
  } else if (role === "empresa") {
    entityId = uid();
    db.prepare(`
      INSERT INTO companies (id, nome, produto, ticket, icp, plano, destaque, saldo, vagas, cor, totalAportado, criadoEm, comissoes, curso, aportes)
      VALUES (?, ?, ?, ?, ?, 'saldo', 0, 0, 10, '#0F766E', 0, ?, '{}', '[]', '[]')
    `).run(entityId, nome || "Minha Empresa", produto || "", ticket || "", icp || "", agora());
  }

  db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, ?, ?, ?, ?)").run(
    userId, email.toLowerCase().trim(), hash, role, entityId, agora()
  );

  const token = signToken({ id: userId, role, entityId });
  res.cookie("sm_token", token, COOKIE_OPTS);
  res.json({ id: userId, email: email.toLowerCase().trim(), role, entityId });
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie("sm_token", { path: "/" });
  res.json({ ok: true });
});

router.get("/auth/me", (req, res) => {
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

import jwt from "jsonwebtoken";
import db from "../db.js";

const SECRET = process.env.JWT_SECRET || "salesmachine-dev-secret-change-in-production";

// Atalho de desenvolvimento: entra direto, sem tela de login.
// Trava dupla — precisa da variável E de não estar em produção. Nunca liga
// sozinho: em produção este painel aprova saques e move dinheiro real.
const PAPEL_DEV = String(process.env.DEV_SEM_LOGIN || "").trim().toLowerCase();
const DEV_SEM_LOGIN =
  process.env.NODE_ENV !== "production" && ["admin", "vendedor", "empresa"].includes(PAPEL_DEV);

if (DEV_SEM_LOGIN) {
  console.warn(`[dev] LOGIN DESATIVADO — entrando como "${PAPEL_DEV}". Só funciona fora de produção.`);
} else if (PAPEL_DEV) {
  console.warn(`[dev] DEV_SEM_LOGIN ignorado (NODE_ENV=${process.env.NODE_ENV || "não definido"} ou papel inválido).`);
}

// Usuário fictício do modo sem login: reaproveita alguém do banco com o papel
// pedido, para o app ter dados reais para mostrar.
export function usuarioDev() {
  if (!DEV_SEM_LOGIN) return null;
  const u = db.prepare("SELECT id, email, role, entityId FROM users WHERE role = ? ORDER BY criadoEm LIMIT 1").get(PAPEL_DEV);
  return u || { id: "dev", email: `${PAPEL_DEV}@dev.local`, role: PAPEL_DEV, entityId: null };
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function authMiddleware(req, res, next) {
  if (DEV_SEM_LOGIN) {
    req.user = usuarioDev();
    return next();
  }

  const token = req.cookies?.sm_token;
  if (!token) return res.status(401).json({ error: "Não autenticado" });

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.clearCookie("sm_token");
    return res.status(401).json({ error: "Sessão expirada" });
  }
}

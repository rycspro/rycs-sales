import jwt from "jsonwebtoken";
import db from "../db.js";

// Em produção o segredo é obrigatório: o fallback abaixo está publicado no
// GitHub, e quem o conhece forja um token de admin. Melhor não subir do que
// subir com sessão falsificável.
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error("[auth] JWT_SECRET não definido em produção. Encerrando.");
  process.exit(1);
}
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
  // Carimba a versão de sessão vigente do usuário no token. Tokens emitidos
  // antes do reset ficam com uma versão menor e são recusados no middleware.
  let tv = 0;
  try { tv = db.prepare("SELECT tokenVersion FROM users WHERE id = ?").get(payload.id)?.tokenVersion ?? 0; } catch { tv = 0; }
  return jwt.sign({ ...payload, tv }, SECRET, { expiresIn: "7d" });
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
  } catch {
    res.clearCookie("sm_token");
    return res.status(401).json({ error: "Sessão expirada" });
  }

  // Revogação global: se a versão do token não bate com a atual do usuário
  // (ex.: senha redefinida depois da emissão), a sessão foi invalidada.
  // Tokens antigos sem `tv` contam como versão 0 — compatíveis enquanto o
  // usuário ainda estiver na versão 0.
  try {
    const atual = db.prepare("SELECT tokenVersion FROM users WHERE id = ?").get(req.user.id);
    if (atual && (req.user.tv ?? 0) !== (atual.tokenVersion ?? 0)) {
      res.clearCookie("sm_token");
      return res.status(401).json({ error: "Sessão expirada" });
    }
  } catch { /* na dúvida, não derruba a sessão por falha de leitura */ }

  next();
}

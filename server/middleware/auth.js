import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "salesmachine-dev-secret-change-in-production";

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function authMiddleware(req, res, next) {
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

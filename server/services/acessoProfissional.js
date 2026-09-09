import db from "../db.js";

export const STATUS_COM_OPORTUNIDADES = ["aprovado", "parcial"];

export function profissionalPodeAcessarOportunidades(sellerId) {
  const vendedor = db.prepare("SELECT status FROM sellers WHERE id = ?").get(sellerId);
  return !!vendedor && STATUS_COM_OPORTUNIDADES.includes(vendedor.status);
}

export function exigirOportunidadesLiberadas(req, res, sellerId = req.user.entityId) {
  if (req.user.role !== "vendedor") return true;
  if (profissionalPodeAcessarOportunidades(sellerId)) return true;
  res.status(403).json({
    error: "Suas oportunidades ficam bloqueadas até a decisão da triagem. A Academy continua liberada.",
    codigo: "TRIAGEM_PENDENTE",
  });
  return false;
}

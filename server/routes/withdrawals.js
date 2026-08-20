import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { emailSaquePago } from "../services/email.js";

const router = Router();

router.post("/withdrawals", (req, res) => {
  const { sellerId, valor, pix } = req.body;
  const { role, entityId } = req.user;

  if (role === "vendedor" && entityId !== sellerId)
    return res.status(403).json({ error: "Sem permissão" });

  if (!valor || valor < 10) return res.status(400).json({ error: "Valor mínimo: R$ 10,00" });

  const seller = db.prepare("SELECT disponivel FROM sellers WHERE id = ?").get(sellerId);
  if (!seller || valor > seller.disponivel)
    return res.status(400).json({ error: "Saldo insuficiente" });

  const id = uid();
  db.prepare("INSERT INTO withdrawals (id, sellerId, valor, pix, status, criadoEm) VALUES (?, ?, ?, ?, 'solicitado', ?)").run(id, sellerId, valor, pix, agora());
  db.prepare("UPDATE sellers SET disponivel = disponivel - ? WHERE id = ?").run(valor, sellerId);
  res.json({ id });
});

router.patch("/withdrawals/:id", (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Apenas admin pode alterar saques" });

  const { status } = req.body;
  if (!["pago", "cancelado"].includes(status))
    return res.status(400).json({ error: "Status inválido" });

  db.prepare("UPDATE withdrawals SET status = ? WHERE id = ?").run(status, req.params.id);

  const w = db.prepare("SELECT sellerId, valor FROM withdrawals WHERE id = ?").get(req.params.id);
  if (w) {
    if (status === "pago") {
      db.prepare("UPDATE sellers SET sacado = sacado + ? WHERE id = ?").run(w.valor, w.sellerId);
    }
    if (status === "cancelado") {
      db.prepare("UPDATE sellers SET disponivel = disponivel + ? WHERE id = ?").run(w.valor, w.sellerId);
    }

    const sellerUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(w.sellerId);
    const seller = db.prepare("SELECT nome, email FROM sellers WHERE id = ?").get(w.sellerId);
    if (sellerUser) {
      const msg = status === "pago" ? `Saque de R$ ${w.valor.toFixed(2)} foi pago!` : `Saque de R$ ${w.valor.toFixed(2)} foi cancelado.`;
      notificar(sellerUser.id, "saque", msg);
    }
    if (seller && status === "pago") {
      emailSaquePago(seller.nome, seller.email, w.valor);
    }
  }

  res.json({ ok: true });
});

export default router;

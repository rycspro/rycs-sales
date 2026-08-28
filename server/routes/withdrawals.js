import { Router } from "express";
import db from "../db.js";
import { notificar } from "./notifications.js";
import { emailSaquePago } from "../services/email.js";

const router = Router();

// Esta rota permitia que uma conta empresa criasse um saque para qualquer
// vendedor, com a chave Pix vinda do corpo da requisição — dinheiro do
// profissional indo para a chave de quem chamasse. Também lia o saldo e
// debitava fora de transação, deixando dois pedidos simultâneos sacarem o
// mesmo valor. Todo saque passa por POST /payments/withdraw, que verifica o
// dono, usa a chave do cadastro e opera em transação.
router.post("/withdrawals", (_req, res) => {
  res.status(410).json({ error: "Rota descontinuada. Use POST /payments/withdraw." });
});

router.patch("/withdrawals/:id", (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Apenas admin pode alterar saques" });

  const { status } = req.body;
  if (!["pago", "cancelado"].includes(status))
    return res.status(400).json({ error: "Status inválido" });

  const w = db.prepare("SELECT sellerId, valor, status FROM withdrawals WHERE id = ?").get(req.params.id);
  if (!w) return res.status(404).json({ error: "Saque não encontrado" });

  // Sem esta guarda, repetir "cancelado" devolvia o valor ao saldo a cada
  // chamada — um duplo-clique virava dinheiro inventado. E cancelar um saque
  // já pago devolvia ao saldo um Pix que havia saído.
  if (w.status !== "solicitado")
    return res.status(409).json({ error: `Saque já está como "${w.status}".` });

  db.transaction(() => {
    db.prepare("UPDATE withdrawals SET status = ? WHERE id = ?").run(status, req.params.id);
    if (status === "pago") {
      db.prepare("UPDATE sellers SET sacado = sacado + ? WHERE id = ?").run(w.valor, w.sellerId);
    } else {
      db.prepare("UPDATE sellers SET disponivel = disponivel + ? WHERE id = ?").run(w.valor, w.sellerId);
    }
  })();

  const sellerUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(w.sellerId);
  const seller = db.prepare("SELECT nome, email FROM sellers WHERE id = ?").get(w.sellerId);
  if (sellerUser) {
    const msg = status === "pago" ? `Saque de R$ ${w.valor.toFixed(2)} foi pago!` : `Saque de R$ ${w.valor.toFixed(2)} foi cancelado.`;
    notificar(sellerUser.id, "saque", msg);
  }
  if (seller && status === "pago") emailSaquePago(seller.nome, seller.email, w.valor);

  res.json({ ok: true });
});

export default router;

import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { sendEmail, emailAtualizacao } from "../services/email.js";

const router = Router();

router.get("/notifications", (req, res) => {
  const rows = db.prepare("SELECT * FROM notifications WHERE userId = ? ORDER BY criadoEm DESC LIMIT 50").all(req.user.id);
  res.json(rows);
});

router.patch("/notifications/read-all", (req, res) => {
  db.prepare("UPDATE notifications SET lida = 1 WHERE userId = ?").run(req.user.id);
  res.json({ ok: true });
});

router.patch("/notifications/:id", (req, res) => {
  const notif = db.prepare("SELECT * FROM notifications WHERE id = ?").get(req.params.id);
  if (!notif || notif.userId !== req.user.id) return res.status(403).json({ error: "Sem permissão" });
  db.prepare("UPDATE notifications SET lida = 1 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;

// Tipos que não geram e-mail. São avisos de baixa relevância que, somados,
// transformariam a caixa de entrada em ruído — e caixa ruidosa é caixa
// ignorada, inclusive para o aviso que importava.
const SEM_EMAIL = new Set(["mensagem"]);

export function notificar(userId, tipo, titulo, corpo = "") {
  db.prepare("INSERT INTO notifications (id, userId, tipo, titulo, corpo, lida, criadoEm) VALUES (?, ?, ?, ?, ?, 0, ?)").run(uid(), userId, tipo, titulo, corpo, agora());

  // Toda atualização também vai por e-mail. Este é o único ponto por onde
  // passa qualquer aviso da plataforma, então ligar aqui cobre vendedor e
  // empresa sem precisar lembrar de cada rota.
  if (SEM_EMAIL.has(tipo)) return;

  try {
    const user = db.prepare("SELECT email, role, entityId FROM users WHERE id = ?").get(userId);
    if (!user?.email) return;

    const tabela = user.role === "empresa" ? "companies" : "sellers";
    const dono = db.prepare(`SELECT nome FROM ${tabela} WHERE id = ?`).get(user.entityId);

    // Sem await: o envio não pode segurar a transação que gerou o aviso, e
    // falha de e-mail nunca deve derrubar a operação que deu certo.
    sendEmail(user.email, titulo, emailAtualizacao({ nome: dono?.nome || "", titulo, corpo, tipo }))
      .catch((err) => console.error("[EMAIL] falha ao notificar:", err.message));
  } catch (err) {
    console.error("[EMAIL] notificação sem e-mail:", err.message);
  }
}

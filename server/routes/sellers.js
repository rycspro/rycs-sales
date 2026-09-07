import { Router } from "express";
import db, { uid, agora } from "../db.js";

const router = Router();

router.post("/sellers", (req, res) => {
  if (req.user.role !== "vendedor" && req.user.role !== "admin")
    return res.status(403).json({ error: "Sem permissão" });

  const { nome, email, whats, cidade, perfil, experiencia, pix, nota, video, respostas } = req.body;
  const id = uid();
  db.prepare(`
    INSERT INTO sellers (id, nome, email, whats, cidade, perfil, experiencia, status, nota, pix, disponivel, pendente, sacado, respostas, video, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'triagem', ?, ?, 0, 0, 0, ?, ?, ?)
  `).run(id, nome, email, whats, cidade || "", perfil || "sdr", experiencia || "", nota || 0, pix || "", JSON.stringify(respostas || []), video || "", agora());
  res.json({ id });
});

router.patch("/sellers/:id", (req, res) => {
  const { id } = req.params;
  const { role, entityId } = req.user;

  if (role === "vendedor" && entityId !== id)
    return res.status(403).json({ error: "Sem permissão para editar outro vendedor" });

  const fields = req.body;
  // Campos financeiros (disponivel/pendente/sacado) NUNCA podem ser escritos
  // pelo próprio vendedor: valem dinheiro real via Pix. Só o servidor os move,
  // ao liberar uma ação ou processar um saque.
  const sellerFields = ["nome", "email", "whats", "cidade", "perfil", "experiencia", "pix", "pixTipo", "video"];
  const adminFields = [...sellerFields, "status", "nota"];
  const allowed = role === "admin" ? adminFields : sellerFields;

  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (!sets.length) return res.status(400).json({ error: "nenhum campo válido" });
  vals.push(id);
  db.prepare(`UPDATE sellers SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// Tabelas que penduram dados no vendedor. A ordem importa: os filhos saem
// antes do pai, senão a foreign key barra a exclusão.
const DEPENDENTES = [
  ["assessment_answers", "sellerId"],
  ["assessments", "sellerId"],
  ["lead_events", "sellerId"],
  ["leads", "sellerId"],
  ["academy_attempts", "sellerId"],
  ["academy_progress", "sellerId"],
  ["certifications", "sellerId"],
  ["score_dimensions", "sellerId"],
  ["course_progress", "sellerId"],
  ["campaign_applications", "sellerId"],
  ["applications", "sellerId"],
  ["messages", "sellerId"],
  ["submissions", "sellerId"],
  ["withdrawals", "sellerId"],
];

// Exclusão definitiva de um profissional. Só a plataforma pode chamar.
//
// O registro em platform_earnings NÃO é apagado: é o livro de receita da
// plataforma, não dado do vendedor. Apagar histórico contábil junto com a
// conta transformaria um cadastro removido em um buraco na auditoria.
router.delete("/sellers/:id", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });

  const { id } = req.params;
  const vendedor = db.prepare("SELECT id, nome, email, disponivel, pendente FROM sellers WHERE id = ?").get(id);
  if (!vendedor) return res.status(404).json({ error: "Profissional não encontrado" });

  // Conta com dinheiro parado é recusada por padrão: apagar o cadastro faria
  // a plataforma ficar com um saldo que era de alguém. Quem insiste assume a
  // decisão explicitamente com ?forcar=true.
  const saqueAberto = db.prepare(
    "SELECT COUNT(*) n FROM withdrawals WHERE sellerId = ? AND status = 'solicitado'"
  ).get(id).n;
  const saldo = (vendedor.disponivel || 0) + (vendedor.pendente || 0);
  const forcar = req.query.forcar === "true";

  if (!forcar && (saldo > 0 || saqueAberto)) {
    return res.status(409).json({
      error: "Profissional com valores em aberto",
      disponivel: vendedor.disponivel,
      pendente: vendedor.pendente,
      saquesAbertos: saqueAberto,
      comoProsseguir: "Repasse o saldo antes de excluir, ou repita com ?forcar=true.",
    });
  }

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(id);
  const removidos = {};

  db.transaction(() => {
    for (const [tabela, coluna] of DEPENDENTES) {
      const r = db.prepare(`DELETE FROM ${tabela} WHERE ${coluna} = ?`).run(id);
      if (r.changes) removidos[tabela] = r.changes;
    }
    if (user) {
      for (const tabela of ["notifications", "uploads"]) {
        const r = db.prepare(`DELETE FROM ${tabela} WHERE userId = ?`).run(user.id);
        if (r.changes) removidos[tabela] = r.changes;
      }
      const ref = db.prepare(
        "DELETE FROM referrals WHERE indicadorUserId = ? OR indicadoUserId = ?"
      ).run(user.id, user.id);
      if (ref.changes) removidos.referrals = ref.changes;
      db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    }
    db.prepare("DELETE FROM sellers WHERE id = ?").run(id);
  })();

  console.log(`[admin] profissional excluído: ${vendedor.nome} <${vendedor.email}>`);
  res.json({ removido: { id, nome: vendedor.nome, email: vendedor.email }, registros: removidos, forcado: forcar });
});

export default router;

import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { recalcularScore } from "../services/score.js";
import { emailStatusAcao } from "../services/email.js";
import { TAXA } from "../../shared/acoes.js";

const router = Router();

router.post("/submissions", (req, res) => {
  const { sellerId, companyId, campaignId, tipo, valor, prova } = req.body;
  const { role, entityId } = req.user;

  if (role === "vendedor" && entityId !== sellerId)
    return res.status(403).json({ error: "Sem permissão" });

  if (!tipo || !companyId) return res.status(400).json({ error: "tipo e companyId são obrigatórios" });

  const id = uid();
  db.prepare(`
    INSERT INTO submissions (id, sellerId, companyId, campaignId, tipo, valor, prova, status, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'analisando', ?)
  `).run(id, sellerId, companyId, campaignId || null, tipo, valor || 0, JSON.stringify(prova || {}), agora());
  res.json({ id });
});

router.patch("/submissions/:id", (req, res) => {
  const { id } = req.params;
  const { role, entityId } = req.user;

  const sub = db.prepare("SELECT * FROM submissions WHERE id = ?").get(id);
  if (!sub) return res.status(404).json({ error: "Submissão não encontrada" });

  if (role === "vendedor" && entityId !== sub.sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (role === "empresa" && entityId !== sub.companyId)
    return res.status(403).json({ error: "Sem permissão" });

  // Um vendedor não decide o destino da própria ação, e ninguém marca
  // "liberado" por aqui: isso move dinheiro e só acontece em /liberar.
  if (role === "vendedor") return res.status(403).json({ error: "Sem permissão" });
  if (req.body.status === "liberado")
    return res.status(400).json({ error: "Use POST /submissions/:id/liberar" });

  const fields = req.body;
  const allowed = ["status", "confianca", "motivo", "fonte"];
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
  db.prepare(`UPDATE submissions SET ${sets.join(", ")} WHERE id = ?`).run(...vals);

  if (fields.status && fields.status !== sub.status) {
    const sellerUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sub.sellerId);
    const seller = db.prepare("SELECT nome, email FROM sellers WHERE id = ?").get(sub.sellerId);
    const labels = { liberado: "aprovada", recusado: "recusada", revisao: "enviada para revisão", ia_aprovado: "pré-aprovada pela IA", conferido: "conferida" };
    if (sellerUser && labels[fields.status]) {
      notificar(sellerUser.id, "submissao", `Ação ${labels[fields.status]}`, fields.motivo || "");
    }

    if (seller && ["liberado", "recusado"].includes(fields.status)) {
      emailStatusAcao(seller.nome, seller.email, sub.tipo, fields.status);
    }

    if (fields.status === "liberado" || fields.status === "recusado") {
      recalcularScore(sub.sellerId);
    }
  }

  res.json({ ok: true });
});

// Contestar uma recusa da IA é o único caminho pelo qual o vendedor mexe na
// própria ação. Não move dinheiro: só devolve para conferência humana.
router.post("/submissions/:id/contestar", (req, res) => {
  const { role, entityId } = req.user;
  const sub = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!sub) return res.status(404).json({ error: "Ação não encontrada" });
  if (role === "vendedor" && entityId !== sub.sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (!["ia_recusado", "recusado"].includes(sub.status))
    return res.status(400).json({ error: "Só ações recusadas podem ser contestadas" });

  const motivo = `Vendedor contestou e pediu revisão humana. Motivo original da IA: ${sub.motivo || "—"}`;
  db.transaction(() => {
    db.prepare("UPDATE submissions SET status = 'revisao', motivo = ? WHERE id = ?").run(motivo, sub.id);
    const liquido = +((sub.valor || 0) * (1 - TAXA)).toFixed(2);
    db.prepare("UPDATE sellers SET pendente = pendente + ? WHERE id = ?").run(liquido, sub.sellerId);
  })();

  const empUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(sub.companyId);
  if (empUser) notificar(empUser.id, "submissao", "Ação contestada", "Um profissional pediu revisão humana.");

  res.json({ ok: true });
});

// Liberar uma ação move dinheiro: debita o caixa da empresa, credita o
// vendedor e registra o take rate. Tudo numa transação, no servidor — o
// cliente não envia valores, apenas o id da ação.
router.post("/submissions/:id/liberar", (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Apenas a plataforma pode liberar" });

  const sub = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!sub) return res.status(404).json({ error: "Ação não encontrada" });
  if (sub.status === "liberado") return res.status(409).json({ error: "Ação já liberada" });
  if (!["ia_aprovado", "conferido", "revisao"].includes(sub.status))
    return res.status(400).json({ error: "Ação não está pronta para liberação" });

  const empresa = db.prepare("SELECT saldo FROM companies WHERE id = ?").get(sub.companyId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

  const bruto = +(sub.valor || 0).toFixed(2);
  if (bruto <= 0) return res.status(400).json({ error: "Valor da ação inválido" });
  if (empresa.saldo < bruto)
    return res.status(400).json({ error: "Caixa da empresa insuficiente" });

  const taxa = +(bruto * TAXA).toFixed(2);
  const liquido = +(bruto - taxa).toFixed(2);

  db.transaction(() => {
    db.prepare("UPDATE submissions SET status = 'liberado', liquido = ? WHERE id = ?").run(liquido, sub.id);
    db.prepare("UPDATE companies SET saldo = saldo - ? WHERE id = ?").run(bruto, sub.companyId);
    db.prepare("UPDATE sellers SET disponivel = disponivel + ?, pendente = MAX(0, pendente - ?) WHERE id = ?")
      .run(liquido, liquido, sub.sellerId);
    db.prepare(`INSERT INTO platform_earnings (id, submissionId, companyId, sellerId, bruto, taxa, liquido, criadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uid(), sub.id, sub.companyId, sub.sellerId, bruto, taxa, liquido, agora());
  })();

  const sellerUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sub.sellerId);
  if (sellerUser) notificar(sellerUser.id, "submissao", "Ação aprovada", `R$ ${liquido.toFixed(2)} liberados para saque.`);
  const seller = db.prepare("SELECT nome, email FROM sellers WHERE id = ?").get(sub.sellerId);
  if (seller) emailStatusAcao(seller.nome, seller.email, sub.tipo, "liberado");
  recalcularScore(sub.sellerId);

  res.json({ ok: true, bruto, taxa, liquido });
});

export default router;

import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { asaas, asaasAtivo, AsaasError } from "../services/asaas.js";
import { PLANOS, ORDEM_PLANOS, planoDe } from "../../shared/planos.js";

const router = Router();

router.get("/plans", (_req, res) => {
  res.json(ORDEM_PLANOS.map((k) => ({ chave: k, ...PLANOS[k] })));
});

router.get("/subscription", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });

  const empresa = db.prepare("SELECT assinatura FROM companies WHERE id = ?").get(entityId);
  const atual = db.prepare("SELECT * FROM subscriptions WHERE companyId = ? ORDER BY criadoEm DESC LIMIT 1").get(entityId);
  const chave = empresa?.assinatura || "free";

  res.json({ plano: chave, detalhes: { chave, ...planoDe(chave) }, assinatura: atual || null });
});

// Contratar um plano. O Free é imediato; os pagos geram cobrança recorrente e
// só passam a valer quando o gateway confirmar o pagamento.
router.post("/subscription", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas podem assinar" });

  const chave = String(req.body?.plano || "").trim();
  if (!PLANOS[chave]) return res.status(400).json({ error: "Plano inválido" });

  const plano = PLANOS[chave];
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(entityId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

  if (chave === "free") {
    db.transaction(() => {
      db.prepare("UPDATE companies SET assinatura = 'free' WHERE id = ?").run(entityId);
      db.prepare("UPDATE subscriptions SET status = 'cancelada' WHERE companyId = ? AND status = 'ativa'").run(entityId);
    })();
    return res.json({ ok: true, plano: "free", message: "Plano alterado para Free." });
  }

  if (!asaasAtivo())
    return res.status(503).json({ error: "Pagamentos indisponíveis no momento. Tente mais tarde." });
  if (!empresa.documento)
    return res.status(400).json({ error: "Cadastre o CNPJ ou CPF da empresa antes de assinar." });
  if (!empresa.asaasCustomerId)
    return res.status(400).json({ error: "Faça um depósito primeiro para registrar sua empresa no gateway." });

  const subId = uid();
  try {
    const cobranca = await asaas("/subscriptions", {
      method: "POST",
      body: {
        customer: empresa.asaasCustomerId,
        billingType: "BOLETO",
        value: plano.preco,
        nextDueDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
        cycle: "MONTHLY",
        description: `RYCS ${plano.nome} — assinatura mensal`,
        externalReference: `sub:${entityId}`,
      },
    });

    db.prepare(`INSERT INTO subscriptions (id, companyId, plano, status, asaasId, valor, criadoEm)
                VALUES (?, ?, ?, 'pendente', ?, ?, ?)`)
      .run(subId, entityId, chave, cobranca.id, plano.preco, agora());

    // O plano só passa a valer no primeiro pagamento confirmado — o webhook
    // é quem ativa. Liberar antes daria acesso sem receber.
    res.json({
      ok: true, subscriptionId: subId, asaasId: cobranca.id,
      message: "Assinatura criada. O plano é liberado assim que o primeiro pagamento for confirmado.",
    });
  } catch (err) {
    console.error("[asaas] assinatura:", err.message);
    res.status(502).json({ error: err instanceof AsaasError ? err.message : "Erro ao criar assinatura" });
  }
});

router.delete("/subscription", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });

  const atual = db.prepare("SELECT * FROM subscriptions WHERE companyId = ? AND status IN ('ativa','pendente') ORDER BY criadoEm DESC LIMIT 1").get(entityId);
  if (!atual) return res.status(404).json({ error: "Nenhuma assinatura ativa" });

  if (atual.asaasId && asaasAtivo()) {
    try { await asaas(`/subscriptions/${atual.asaasId}`, { method: "DELETE" }); }
    catch (e) { console.warn("[asaas] cancelamento:", e.message); }
  }

  db.transaction(() => {
    db.prepare("UPDATE subscriptions SET status = 'cancelada' WHERE id = ?").run(atual.id);
    db.prepare("UPDATE companies SET assinatura = 'free' WHERE id = ?").run(entityId);
  })();

  res.json({ ok: true, message: "Assinatura cancelada. Sua conta voltou ao plano Free." });
});

// Chamado pelo webhook do gateway quando uma cobrança de assinatura é paga.
export function ativarAssinatura(asaasSubscriptionId) {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE asaasId = ?").get(asaasSubscriptionId);
  if (!sub || sub.status === "ativa") return;

  db.transaction(() => {
    db.prepare("UPDATE subscriptions SET status = 'ativa', inicio = COALESCE(inicio, ?) WHERE id = ?")
      .run(agora(), sub.id);
    db.prepare("UPDATE companies SET assinatura = ? WHERE id = ?").run(sub.plano, sub.companyId);
  })();

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(sub.companyId);
  if (user) notificar(user.id, "assinatura", `Plano ${planoDe(sub.plano).nome} ativado!`);
}

export default router;

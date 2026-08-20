import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { notificar } from "./notifications.js";

const router = Router();

const ASAAS_BASE = process.env.ASAAS_ENV === "production"
  ? "https://api.asaas.com/v3"
  : "https://sandbox.asaas.com/api/v3";

async function asaasRequest(path, options = {}) {
  if (!process.env.ASAAS_API_KEY) return null;
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: process.env.ASAAS_API_KEY,
      ...options.headers,
    },
  });
  return res.json();
}

router.post("/payments/deposit", authMiddleware, async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas podem depositar" });

  const { valor, metodo } = req.body;
  if (!valor || valor < 50) return res.status(400).json({ error: "Valor mínimo: R$ 50,00" });

  if (!process.env.ASAAS_API_KEY) {
    db.prepare("UPDATE companies SET saldo = saldo + ?, totalAportado = totalAportado + ? WHERE id = ?").run(valor, valor, entityId);
    const company = db.prepare("SELECT nome FROM companies WHERE id = ?").get(entityId);
    const aportes = JSON.parse(db.prepare("SELECT aportes FROM companies WHERE id = ?").get(entityId)?.aportes || "[]");
    aportes.push({ valor, ts: agora() });
    db.prepare("UPDATE companies SET aportes = ? WHERE id = ?").run(JSON.stringify(aportes), entityId);
    return res.json({ ok: true, method: "manual", message: "Asaas não configurado. Saldo adicionado diretamente." });
  }

  try {
    const billingType = metodo === "boleto" ? "BOLETO" : metodo === "cartao" ? "CREDIT_CARD" : "PIX";
    const payment = await asaasRequest("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: entityId,
        billingType,
        value: valor,
        dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        description: `Depósito RYCS - ${db.prepare("SELECT nome FROM companies WHERE id = ?").get(entityId)?.nome}`,
      }),
    });
    res.json({ ok: true, paymentId: payment.id, pixQr: payment.pixQrCode, invoiceUrl: payment.invoiceUrl });
  } catch (err) {
    console.error("Erro Asaas deposit:", err.message);
    res.status(500).json({ error: "Erro ao processar depósito" });
  }
});

router.post("/payments/withdraw", authMiddleware, async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais podem sacar" });

  const { valor } = req.body;
  const seller = db.prepare("SELECT * FROM sellers WHERE id = ?").get(entityId);
  if (!seller) return res.status(404).json({ error: "Profissional não encontrado" });
  if (valor > seller.disponivel) return res.status(400).json({ error: "Saldo insuficiente" });
  if (valor < 10) return res.status(400).json({ error: "Valor mínimo: R$ 10,00" });

  const wId = uid();
  db.prepare("INSERT INTO withdrawals (id, sellerId, valor, pix, status, criadoEm) VALUES (?, ?, ?, ?, 'solicitado', ?)").run(
    wId, entityId, valor, seller.pix, agora()
  );
  db.prepare("UPDATE sellers SET disponivel = disponivel - ? WHERE id = ?").run(valor, entityId);

  if (!process.env.ASAAS_API_KEY) {
    return res.json({ id: wId, method: "manual", message: "Asaas não configurado. Saque registrado para processamento manual." });
  }

  try {
    const transfer = await asaasRequest("/transfers", {
      method: "POST",
      body: JSON.stringify({
        value: valor,
        pixAddressKey: seller.pix,
        pixAddressKeyType: detectPixType(seller.pix),
        description: `Saque RYCS - ${seller.nome}`,
      }),
    });
    db.prepare("UPDATE withdrawals SET asaasId = ? WHERE id = ?").run(transfer.id, wId);
    res.json({ id: wId, transferId: transfer.id });
  } catch (err) {
    console.error("Erro Asaas withdraw:", err.message);
    res.json({ id: wId, method: "manual", message: "Erro no gateway. Saque será processado manualmente." });
  }
});

router.post("/payments/webhook", async (req, res) => {
  const token = req.headers["asaas-access-token"] || req.query.token;
  if (process.env.ASAAS_WEBHOOK_TOKEN && token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: "Token inválido" });
  }

  const { event, payment, transfer } = req.body;

  if (event === "PAYMENT_RECEIVED" && payment) {
    const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(payment.customer);
    if (company) {
      db.prepare("UPDATE companies SET saldo = saldo + ?, totalAportado = totalAportado + ? WHERE id = ?").run(payment.value, payment.value, company.id);
      const aportes = JSON.parse(company.aportes || "[]");
      aportes.push({ valor: payment.value, ts: agora(), asaasId: payment.id });
      db.prepare("UPDATE companies SET aportes = ? WHERE id = ?").run(JSON.stringify(aportes), company.id);

      const empUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(company.id);
      if (empUser) notificar(empUser.id, "pagamento", `Depósito de R$ ${payment.value.toFixed(2)} confirmado!`);
    }
  }

  if (event === "TRANSFER_DONE" && transfer) {
    const w = db.prepare("SELECT * FROM withdrawals WHERE asaasId = ?").get(transfer.id);
    if (w) {
      db.prepare("UPDATE withdrawals SET status = 'pago' WHERE id = ?").run(w.id);
      db.prepare("UPDATE sellers SET sacado = sacado + ? WHERE id = ?").run(w.valor, w.sellerId);

      const sellerUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(w.sellerId);
      if (sellerUser) notificar(sellerUser.id, "saque", `Saque de R$ ${w.valor.toFixed(2)} foi pago!`);
    }
  }

  res.json({ ok: true });
});

function detectPixType(key) {
  if (!key) return "RANDOM_KEY";
  if (key.includes("@")) return "EMAIL";
  const digits = key.replace(/\D/g, "");
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  if (digits.length >= 10 && digits.length <= 13) return "PHONE";
  return "RANDOM_KEY";
}

export default router;

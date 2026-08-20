import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { notificar } from "./notifications.js";
import { asaas, asaasAtivo, AsaasError } from "../services/asaas.js";

const router = Router();

const DEPOSITO_MINIMO = 50;
const SAQUE_MINIMO = 10;

// ---------------------------------------------------------------------------
// Repasse ao vendedor — ÚNICO ponto por onde dinheiro sai para o profissional.
//
// Hoje opera em custódia: a plataforma recebe os depósitos e transfere por Pix.
// Para migrar a split do Asaas, basta trocar o corpo desta função por uma
// cobrança com `split` para a carteira do vendedor; nada mais no código
// precisa mudar.
// ---------------------------------------------------------------------------
async function repassarParaVendedor({ vendedor, valor, referencia }) {
  if (!asaasAtivo()) return { modo: "manual", externoId: null };

  const transfer = await asaas("/transfers", {
    method: "POST",
    body: {
      value: valor,
      pixAddressKey: vendedor.pix,
      pixAddressKeyType: tipoChavePix(vendedor.pix),
      description: `RYCS - repasse ${referencia}`,
    },
  });
  return { modo: "pix", externoId: transfer.id };
}

// Garante que a empresa exista como cliente no gateway e reaproveita o id.
async function clienteAsaasDaEmpresa(empresa) {
  if (empresa.asaasCustomerId) return empresa.asaasCustomerId;

  if (!empresa.documento) {
    const e = new Error("Cadastre o CNPJ ou CPF da empresa antes de depositar.");
    e.faltaDocumento = true;
    throw e;
  }

  const usuario = db.prepare("SELECT email FROM users WHERE entityId = ? AND role = 'empresa'").get(empresa.id);
  const cliente = await asaas("/customers", {
    method: "POST",
    body: {
      name: empresa.nome,
      cpfCnpj: String(empresa.documento).replace(/\D/g, ""),
      email: usuario?.email || undefined,
      externalReference: empresa.id,
    },
  });

  db.prepare("UPDATE companies SET asaasCustomerId = ? WHERE id = ?").run(cliente.id, empresa.id);
  return cliente.id;
}

// ---------------------------------------------------------------------------
// Depósito da empresa
// ---------------------------------------------------------------------------
router.post("/payments/deposit", authMiddleware, async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas podem depositar" });

  const valor = Number(req.body?.valor);
  if (!Number.isFinite(valor) || valor < DEPOSITO_MINIMO)
    return res.status(400).json({ error: `Valor mínimo: R$ ${DEPOSITO_MINIMO},00` });

  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(entityId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

  // Sem gateway o saldo não pode ser creditado de graça: isso pagaria
  // vendedores com dinheiro que nunca entrou. Melhor recusar o depósito.
  if (!asaasAtivo())
    return res.status(503).json({ error: "Pagamentos indisponíveis no momento. Tente mais tarde." });

  const metodo = req.body?.metodo;
  const billingType = metodo === "boleto" ? "BOLETO" : metodo === "cartao" ? "CREDIT_CARD" : "PIX";

  try {
    const customer = await clienteAsaasDaEmpresa(empresa);
    const cobranca = await asaas("/payments", {
      method: "POST",
      body: {
        customer,
        billingType,
        value: valor,
        dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        description: `Depósito RYCS - ${empresa.nome}`,
        externalReference: empresa.id,
      },
    });

    // O Pix copia-e-cola vem de um endpoint separado.
    let pix = null;
    if (billingType === "PIX") {
      try { pix = await asaas(`/payments/${cobranca.id}/pixQrCode`); }
      catch (e) { console.warn("[asaas] QR Pix indisponível:", e.message); }
    }

    res.json({
      ok: true,
      paymentId: cobranca.id,
      invoiceUrl: cobranca.invoiceUrl,
      bankSlipUrl: cobranca.bankSlipUrl || null,
      pixCopiaECola: pix?.payload || null,
      pixQrCodeBase64: pix?.encodedImage || null,
      aviso: "O saldo entra assim que o pagamento for confirmado.",
    });
  } catch (err) {
    if (err.faltaDocumento) return res.status(400).json({ error: err.message });
    console.error("[asaas] depósito:", err.message);
    const detalhe = err instanceof AsaasError ? err.message : "Erro ao processar depósito";
    res.status(502).json({ error: detalhe });
  }
});

// ---------------------------------------------------------------------------
// Saque do vendedor
// ---------------------------------------------------------------------------
router.post("/payments/withdraw", authMiddleware, async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais podem sacar" });

  const valor = Number(req.body?.valor);
  const vendedor = db.prepare("SELECT * FROM sellers WHERE id = ?").get(entityId);
  if (!vendedor) return res.status(404).json({ error: "Profissional não encontrado" });
  if (!Number.isFinite(valor) || valor < SAQUE_MINIMO)
    return res.status(400).json({ error: `Valor mínimo: R$ ${SAQUE_MINIMO},00` });
  if (!vendedor.pix) return res.status(400).json({ error: "Cadastre sua chave Pix antes de sacar" });

  // Reserva o valor e cria o saque numa transação, para que dois pedidos
  // simultâneos não sacem o mesmo saldo duas vezes.
  const wId = uid();
  try {
    db.transaction(() => {
      const atual = db.prepare("SELECT disponivel FROM sellers WHERE id = ?").get(entityId);
      if (atual.disponivel < valor) throw new Error("SALDO_INSUFICIENTE");
      db.prepare("UPDATE sellers SET disponivel = disponivel - ? WHERE id = ?").run(valor, entityId);
      db.prepare("INSERT INTO withdrawals (id, sellerId, valor, pix, status, criadoEm) VALUES (?, ?, ?, ?, 'solicitado', ?)")
        .run(wId, entityId, valor, vendedor.pix, agora());
    })();
  } catch (e) {
    if (e.message === "SALDO_INSUFICIENTE") return res.status(400).json({ error: "Saldo insuficiente" });
    throw e;
  }

  try {
    const { modo, externoId } = await repassarParaVendedor({ vendedor, valor, referencia: vendedor.nome });
    if (externoId) db.prepare("UPDATE withdrawals SET asaasId = ? WHERE id = ?").run(externoId, wId);
    res.json({ id: wId, modo, message: modo === "manual"
      ? "Saque registrado para processamento manual."
      : "Transferência enviada. O Pix cai em instantes." });
  } catch (err) {
    // O gateway recusou: devolve o saldo em vez de deixar o dinheiro sumido.
    console.error("[asaas] saque:", err.message);
    db.transaction(() => {
      db.prepare("UPDATE sellers SET disponivel = disponivel + ? WHERE id = ?").run(valor, entityId);
      db.prepare("UPDATE withdrawals SET status = 'falhou', falhaMotivo = ? WHERE id = ?").run(String(err.message).slice(0, 200), wId);
    })();
    res.status(502).json({ error: "Não foi possível concluir o saque. O valor voltou para o seu saldo." });
  }
});

// ---------------------------------------------------------------------------
// Webhook do gateway
// ---------------------------------------------------------------------------
router.post("/payments/webhook", (req, res) => {
  const token = req.headers["asaas-access-token"] || req.query.token;
  if (!process.env.ASAAS_WEBHOOK_TOKEN || token !== process.env.ASAAS_WEBHOOK_TOKEN)
    return res.status(401).json({ error: "Token inválido" });

  const { event, payment, transfer } = req.body || {};
  const eventoId = req.body?.id || payment?.id || transfer?.id;
  if (!event || !eventoId) return res.status(400).json({ error: "Evento inválido" });

  // O Asaas reentrega eventos. Sem esta trava, um depósito seria creditado
  // tantas vezes quantas o webhook chegasse.
  const chave = `${event}:${eventoId}`;
  const novo = db.prepare("INSERT OR IGNORE INTO gateway_events (id, evento, criadoEm) VALUES (?, ?, ?)")
    .run(chave, event, agora());
  if (novo.changes === 0) return res.json({ ok: true, duplicado: true });

  if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
    creditarDeposito(payment);
  } else if (event === "TRANSFER_DONE") {
    concluirSaque(transfer);
  } else if (event === "TRANSFER_FAILED" || event === "TRANSFER_CANCELLED") {
    devolverSaque(transfer);
  }

  res.json({ ok: true });
});

function creditarDeposito(payment) {
  if (!payment) return;
  // externalReference guarda o id interno; asaasCustomerId cobre cobranças
  // criadas fora do app. O id do Asaas nunca bate com o id interno.
  const empresa =
    (payment.externalReference && db.prepare("SELECT * FROM companies WHERE id = ?").get(payment.externalReference)) ||
    db.prepare("SELECT * FROM companies WHERE asaasCustomerId = ?").get(payment.customer);

  if (!empresa) return console.warn("[webhook] pagamento sem empresa:", payment.id);

  const valor = Number(payment.value) || 0;
  if (valor <= 0) return;

  db.transaction(() => {
    db.prepare("UPDATE companies SET saldo = saldo + ?, totalAportado = totalAportado + ? WHERE id = ?")
      .run(valor, valor, empresa.id);
    const aportes = JSON.parse(empresa.aportes || "[]");
    aportes.push({ valor, ts: agora(), asaasId: payment.id });
    db.prepare("UPDATE companies SET aportes = ? WHERE id = ?").run(JSON.stringify(aportes), empresa.id);
  })();

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(empresa.id);
  if (user) notificar(user.id, "pagamento", `Depósito de R$ ${valor.toFixed(2)} confirmado!`);
}

function concluirSaque(transfer) {
  if (!transfer?.id) return;
  const w = db.prepare("SELECT * FROM withdrawals WHERE asaasId = ?").get(transfer.id);
  if (!w || w.status === "pago") return;

  db.transaction(() => {
    db.prepare("UPDATE withdrawals SET status = 'pago' WHERE id = ?").run(w.id);
    db.prepare("UPDATE sellers SET sacado = sacado + ? WHERE id = ?").run(w.valor, w.sellerId);
  })();

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(w.sellerId);
  if (user) notificar(user.id, "saque", `Saque de R$ ${w.valor.toFixed(2)} foi pago!`);
}

function devolverSaque(transfer) {
  if (!transfer?.id) return;
  const w = db.prepare("SELECT * FROM withdrawals WHERE asaasId = ?").get(transfer.id);
  if (!w || w.status !== "solicitado") return;

  db.transaction(() => {
    db.prepare("UPDATE withdrawals SET status = 'falhou', falhaMotivo = ? WHERE id = ?")
      .run("Transferência recusada pelo banco", w.id);
    db.prepare("UPDATE sellers SET disponivel = disponivel + ? WHERE id = ?").run(w.valor, w.sellerId);
  })();

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(w.sellerId);
  if (user) notificar(user.id, "saque", "Saque não concluído", "O valor voltou para o seu saldo. Confira sua chave Pix.");
}

function tipoChavePix(chave) {
  if (!chave) return "RANDOM_KEY";
  if (chave.includes("@")) return "EMAIL";
  const digitos = chave.replace(/\D/g, "");
  if (digitos.length === 11) return "CPF";
  if (digitos.length === 14) return "CNPJ";
  if (digitos.length >= 10 && digitos.length <= 13) return "PHONE";
  return "RANDOM_KEY";
}

export default router;

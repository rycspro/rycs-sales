import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { notificar } from "./notifications.js";
import { asaas, asaasAtivo, AsaasError, garantirCliente } from "../services/asaas.js";
import { ativarAssinatura, marcarInadimplencia } from "./subscriptions.js";
import { registrarMovimento } from "../services/financeiro.js";
import { isBetaEnvironment } from "../services/betaEnvironment.js";
import { SAQUE_MINIMO } from "../../shared/saque.js";

const router = Router();

const DEPOSITO_MINIMO = 1;

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
      pixAddressKey: normalizarChavePix(vendedor.pix, tipoDaChave(vendedor)),
      pixAddressKeyType: tipoDaChave(vendedor),
      operationType: "PIX",
      description: `RYCS - repasse ${referencia}`,
    },
  });
  return { modo: "pix", externoId: transfer.id };
}

// Mudou de lugar: agora vive em services/asaas.js, porque a assinatura precisa
// do mesmo cliente e não pode exigir um depósito antes para criá-lo.
const clienteAsaasDaEmpresa = (empresa) => garantirCliente(db, empresa);

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

  if (isBetaEnvironment()) {
    const id = uid();
    db.transaction(() => {
      db.prepare("UPDATE companies SET saldo = saldo + ?, totalAportado = totalAportado + ? WHERE id = ?")
        .run(valor, valor, empresa.id);
      db.prepare("INSERT INTO deposit_requests (id,companyId,valor,status,referencia,observacao,confirmadoPor,criadoEm,confirmadoEm) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(id, empresa.id, valor, "confirmado", "BETA-SIMULADO", "SIMULAÇÃO — depósito fictício sem valor real", req.user.id, agora(), agora());
      registrarMovimento({ companyId: empresa.id, tipo: "beta_deposito_simulado", valor, idempotencyKey: id, dados: { simulacao: true, semValorReal: true } });
    })();
    return res.json({ ok: true, paymentId: id, modo: "beta_simulado", aviso: "SIMULAÇÃO: saldo Beta creditado sem Pix, cartão ou valor real." });
  }

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
    return res.status(400).json({ error: `Valor mínimo: R$ ${SAQUE_MINIMO.toFixed(2).replace(".", ",")}` });
  if (!vendedor.pix) return res.status(400).json({ error: "Cadastre sua chave Pix antes de sacar" });
  if (!vendedor.pixTipo) return res.status(400).json({ error: "Informe o tipo da sua chave Pix (CPF, celular, e-mail ou aleatória)" });

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
      registrarMovimento({ sellerId: entityId, tipo: "saque_reservado", valor: -valor, idempotencyKey: wId });
    })();
  } catch (e) {
    if (e.message === "SALDO_INSUFICIENTE") return res.status(400).json({ error: "Saldo insuficiente" });
    throw e;
  }

  try {
    if (isBetaEnvironment()) {
      db.prepare("UPDATE withdrawals SET status = 'pago', asaasId = ? WHERE id = ?").run("BETA-SIMULADO", wId);
      registrarMovimento({ sellerId: entityId, tipo: "beta_saque_simulado", valor: -valor, idempotencyKey: `${wId}-beta`, dados: { simulacao: true, semValorReal: true } });
      return res.json({ id: wId, modo: "beta_simulado", message: "SIMULAÇÃO: saque Beta registrado como fictício, sem Pix real." });
    }
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
      registrarMovimento({ sellerId: entityId, tipo: "saque_estornado", valor, idempotencyKey: wId });
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
  } else if (
    // Cobrança que não entrou. O Asaas usa nomes diferentes para recusa de
    // cartão, vencimento e estorno; os três deixam a empresa sem plano em dia.
    event === "PAYMENT_OVERDUE" ||
    event === "PAYMENT_REFUSED" ||
    event === "PAYMENT_DECLINED" ||
    event === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED" ||
    event === "PAYMENT_REFUNDED" ||
    event === "PAYMENT_CHARGEBACK_REQUESTED"
  ) {
    if (payment?.subscription) {
      marcarInadimplencia(payment.subscription, `${event}${payment?.status ? ` (${payment.status})` : ""}`);
    }
  } else if (event === "TRANSFER_DONE") {
    concluirSaque(transfer);
  } else if (event === "TRANSFER_FAILED" || event === "TRANSFER_CANCELLED") {
    devolverSaque(transfer);
  }

  res.json({ ok: true });
});

function creditarDeposito(payment) {
  if (!payment) return;

  // Cobrança de assinatura não é aporte de caixa: ativa o plano e para aqui.
  if (payment.subscription) {
    ativarAssinatura(payment.subscription);
    return;
  }
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
    registrarMovimento({ companyId: empresa.id, tipo: "deposito", valor, idempotencyKey: payment.id, dados: { gateway: "asaas" } });
  })();

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(empresa.id);
  if (user) {
    notificar(user.id, "pagamento", `Depósito de R$ ${valor.toFixed(2)} confirmado!`);
  }
}

function concluirSaque(transfer) {
  if (!transfer?.id) return;
  const w = db.prepare("SELECT * FROM withdrawals WHERE asaasId = ?").get(transfer.id);
  if (!w || w.status === "pago") return;

  db.transaction(() => {
    db.prepare("UPDATE withdrawals SET status = 'pago' WHERE id = ?").run(w.id);
    db.prepare("UPDATE sellers SET sacado = sacado + ? WHERE id = ?").run(w.valor, w.sellerId);
    registrarMovimento({ sellerId: w.sellerId, tipo: "saque_pago", valor: -w.valor, idempotencyKey: w.id });
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
    registrarMovimento({ sellerId: w.sellerId, tipo: "saque_estornado", valor: w.valor, idempotencyKey: w.id });
  })();

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(w.sellerId);
  if (user) notificar(user.id, "saque", "Saque não concluído", "O valor voltou para o seu saldo. Confira sua chave Pix.");
}

// O tipo declarado pelo vendedor manda. A dedução automática é só palpite
// inicial: celular e CPF têm os mesmos 11 dígitos, e errar o tipo faz o Pix
// ir para o lugar errado ou ser recusado.
const TIPOS_VALIDOS = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"];
function tipoDaChave(vendedor) {
  const declarado = String(vendedor?.pixTipo || "").toUpperCase();
  return TIPOS_VALIDOS.includes(declarado) ? declarado : tipoChavePix(vendedor?.pix);
}

// Tipos aceitos pelo Asaas: CPF, CNPJ, EMAIL, PHONE e EVP.
// "RANDOM_KEY" não existe na API deles — usar esse valor fazia toda
// transferência para chave aleatória ser recusada.
export function tipoChavePix(chave) {
  const c = String(chave || "").trim();
  if (!c) return "EVP";
  if (c.includes("@")) return "EMAIL";

  // Chave aleatória é um UUID; reconhecer pelo formato evita confundi-la
  // com documento por causa da contagem de dígitos.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return "EVP";

  const digitos = c.replace(/\D/g, "");
  if (digitos.length === 11 && !c.startsWith("+")) return "CPF";
  if (digitos.length === 14) return "CNPJ";
  if (digitos.length >= 10 && digitos.length <= 13) return "PHONE";
  return "EVP";
}

// O Asaas espera o telefone no padrão internacional.
export function normalizarChavePix(chave, tipo) {
  const c = String(chave || "").trim();
  if (tipo !== "PHONE") return c;
  const d = c.replace(/\D/g, "");
  return d.startsWith("55") ? `+${d}` : `+55${d}`;
}

export default router;

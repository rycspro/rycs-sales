import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { asaas, asaasAtivo, AsaasError, garantirCliente } from "../services/asaas.js";
import { registrarMovimento } from "../services/financeiro.js";
import { criarCheckoutDeposito, stripeAtivo } from "../services/stripe.js";
import { normalizarMoeda } from "../../shared/moedas.js";
import { DESTAQUES, TAXA_ATIVACAO_PIX_AUTOMATICO } from "../../shared/planos.js";

const router = Router();

// Cobrança pelo gateway: o saldo entra pelo webhook, não aqui.
async function cobrancaPeloGateway(req, res, companyId, valor) {
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
  if (!empresa.documento)
    return res.status(400).json({ error: "Cadastre o CNPJ ou CPF da empresa antes de depositar." });

  try {
    // garantirCliente cria/reaproveita o cliente no Asaas e, nos dois casos,
    // desliga as notificações próprias do Asaas (só a RYCS avisa o cliente).
    const customer = await garantirCliente(db, empresa);

    const cobranca = await asaas("/payments", {
      method: "POST",
      body: {
        customer,
        billingType: "PIX",
        value: valor,
        dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        description: `Depósito RYCS — ${empresa.nome}`,
        externalReference: companyId,
      },
    });

    let pix = null;
    try { pix = await asaas(`/payments/${cobranca.id}/pixQrCode`); }
    catch (e) { console.warn("[asaas] QR Pix indisponível:", e.message); }

    // Registra o pedido para a tela poder acompanhar o status (processando →
    // confirmado). O crédito do saldo continua acontecendo só no webhook;
    // aqui a linha nasce 'pendente' e o webhook a marca 'confirmado'.
    const depositoId = uid();
    db.prepare(`INSERT INTO deposit_requests (id, companyId, valor, status, referencia, gateway, criadoEm)
                VALUES (?, ?, ?, 'pendente', ?, 'asaas', ?)`).run(depositoId, companyId, valor, cobranca.id, agora());

    // A taxa de gateway é cobrada da conta RYCS, não descontada do depositante.
    // O caixa da empresa recebe o valor bruto integral.
    return res.json({
      id: cobranca.id,
      depositoId,
      valor,
      valorBruto: valor,
      taxaGateway: 0,
      valorLiquido: valor,
      modo: "gateway",
      pixCopiaECola: pix?.payload || null,
      pixQrCodeBase64: pix?.encodedImage || null,
      pixExpiracao: pix?.expirationDate || null,
      invoiceUrl: cobranca.invoiceUrl || null,
      instrucoes: "Pague o Pix abaixo. O caixa é creditado automaticamente após a confirmação.",
    });
  } catch (err) {
    console.error("[asaas] depósito:", err.message);
    return res.status(502).json({ error: err instanceof AsaasError ? err.message : "Erro ao gerar a cobrança" });
  }
}

const MINIMO = 1;
// O Asaas recusa cobrança abaixo de R$ 5,00. Com o gateway ativo o piso é
// dele, senão a empresa pediria R$ 2 e receberia um erro do gateway sem
// entender o motivo.
const MINIMO_GATEWAY = 5;

// Depósito em moeda estrangeira (ou cartão internacional): cobrança one-time no
// Stripe. O saldo entra pelo webhook, não aqui. Pix só existe em BRL (Asaas).
async function cobrancaPeloStripe(req, res, companyId, valor, moeda) {
  if (!stripeAtivo())
    return res.status(503).json({ error: "Pagamento internacional indisponível no momento." });
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

  const depositId = uid();
  db.prepare(`INSERT INTO deposit_requests (id, companyId, valor, status, moeda, gateway, criadoEm)
              VALUES (?, ?, ?, 'pendente', ?, 'stripe', ?)`).run(depositId, companyId, valor, moeda, agora());

  const usuario = db.prepare("SELECT email FROM users WHERE entityId = ? AND role = 'empresa'").get(companyId);
  try {
    const sess = await criarCheckoutDeposito({ empresa, email: usuario?.email, depositId, valor, moeda, retorno: req.body?.retorno });
    return res.json({ id: depositId, valor, moeda, modo: "stripe", checkoutUrl: sess.url });
  } catch (err) {
    console.error("[stripe] depósito:", err.message);
    return res.status(502).json({ error: err?.message || "Erro ao abrir o checkout internacional" });
  }
}

// Chave Pix da plataforma, mostrada à empresa na hora de depositar.
const PIX_RYCS = process.env.PIX_RECEBIMENTO || "";
const TITULAR_RYCS = process.env.PIX_TITULAR || "RYCS Sales Machine";

// ---------------------------------------------------------------------------
// Empresa declara um depósito. Nada é creditado aqui — só registra a intenção
// e devolve os dados para o pagamento.
// ---------------------------------------------------------------------------
router.post("/deposits", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas podem depositar" });

  const valor = Number(req.body?.valor);
  const moeda = normalizarMoeda(req.body?.moeda);
  // Pix só existe em Real; qualquer outra moeda (ou cartão pedido) vai por Stripe.
  const metodo = (req.body?.metodo === "card" || moeda !== "BRL") ? "card" : "pix";

  // Trava de moeda: depois do primeiro aporte, a empresa opera sempre na mesma
  // moeda — caixa, repasse e take rate rodam nela.
  const emp = db.prepare("SELECT moeda, saldo, totalAportado FROM companies WHERE id = ?").get(entityId);
  const travada = (Number(emp?.saldo) > 0 || Number(emp?.totalAportado) > 0) ? normalizarMoeda(emp?.moeda) : null;
  if (travada && travada !== moeda)
    return res.status(409).json({ error: `Sua conta opera em ${travada}. Faça o depósito nessa moeda.` });

  const piso = moeda === "BRL" ? (asaasAtivo() ? MINIMO_GATEWAY : MINIMO) : 1;
  if (!Number.isFinite(valor) || valor < piso)
    return res.status(400).json({ error: `Valor mínimo: ${piso} ${moeda}` });

  if (metodo === "card") return cobrancaPeloStripe(req, res, entityId, valor, moeda);

  // Com o gateway ativo, a cobrança é gerada e confirmada sozinha pelo
  // webhook. O caminho manual abaixo só existe para quando ele está desligado,
  // e é a mesma tela nos dois casos.
  if (asaasAtivo()) return cobrancaPeloGateway(req, res, entityId, valor);

  const pendentes = db.prepare("SELECT COUNT(*) n FROM deposit_requests WHERE companyId = ? AND status = 'pendente'").get(entityId).n;
  if (pendentes >= 5)
    return res.status(429).json({ error: "Você já tem 5 depósitos aguardando confirmação." });

  const id = uid();
  // Referência curta para a empresa colocar na transferência — é o que liga
  // o Pix recebido ao pedido certo.
  const referencia = `RYCS-${id.toUpperCase()}`;

  db.prepare(`INSERT INTO deposit_requests (id, companyId, valor, status, referencia, criadoEm)
              VALUES (?, ?, ?, 'pendente', ?, ?)`).run(id, entityId, valor, referencia, agora());

  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
  const empresa = db.prepare("SELECT nome FROM companies WHERE id = ?").get(entityId);
  admins.forEach((a) => notificar(a.id, "deposito",
    `Depósito de R$ ${valor.toFixed(2)} aguardando confirmação`, `${empresa?.nome || "Empresa"} · ${referencia}`));

  res.json({
    id, valor,
    valorBruto: valor,
    taxaGateway: 0,
    valorLiquido: valor,
    referencia,
    pix: PIX_RYCS || null,
    titular: TITULAR_RYCS,
    instrucoes: PIX_RYCS
      ? `Transfira R$ ${valor.toFixed(2)} por Pix e informe a referência ${referencia}. O caixa é creditado após a confirmação.`
      : "A chave Pix ainda não foi configurada. Fale com a plataforma para concluir o depósito.",
  });
});

// A tela precisa saber o piso vigente para validar antes de enviar.
router.get("/deposits/config", (req, res) => {
  res.json({ minimo: asaasAtivo() ? MINIMO_GATEWAY : MINIMO, gateway: asaasAtivo() });
});

// Status de um depósito específico — usado pela tela para acompanhar o Pix
// (pendente → confirmado) sem recarregar. Só o dono (ou admin) consulta.
router.get("/deposits/:id", (req, res) => {
  const { role, entityId } = req.user;
  const row = db.prepare("SELECT id, companyId, valor, status, confirmadoEm FROM deposit_requests WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Depósito não encontrado" });
  if (role === "empresa" && row.companyId !== entityId) return res.status(403).json({ error: "Sem permissão" });
  res.json({ id: row.id, valor: row.valor, status: row.status, confirmadoEm: row.confirmadoEm || null });
});

// Contratar um destaque (visibilidade): cria uma assinatura mensal no Asaas.
// O destaque só é ativado quando o webhook confirmar o pagamento — nunca aqui.
// Aceita cartão de crédito ou Pix (avulso mensal). O Stripe cobre o caminho
// internacional e é tratado numa rota própria abaixo.
router.post("/destaque/checkout", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas podem contratar destaque" });
  const tipo = String(req.body?.tipo || "");
  const d = DESTAQUES[tipo];
  if (!d) return res.status(400).json({ error: "Tipo de destaque inválido" });
  if (!asaasAtivo()) return res.status(503).json({ error: "Pagamento indisponível no momento." });

  const forma = String(req.body?.formaPagamento || "CREDIT_CARD").toUpperCase();
  if (!["CREDIT_CARD", "PIX_AUTOMATICO"].includes(forma))
    return res.status(400).json({ error: "Forma de pagamento inválida." });

  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(entityId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
  if (!empresa.documento) return res.status(400).json({ error: "Cadastre o CNPJ ou CPF da empresa antes de contratar." });

  if (forma === "CREDIT_CARD") {
    const cartao = req.body?.cartao || {};
    const faltando = ["numero", "validadeMes", "validadeAno", "cvv", "nome"].filter((k) => !String(cartao[k] || "").trim());
    if (faltando.length) return res.status(400).json({ error: "Preencha todos os dados do cartão." });
    const titular = req.body?.titular || {};
    if (!titular.cep || !titular.numero) return res.status(400).json({ error: "Informe CEP e número do endereço de cobrança." });
  }

  try {
    const customer = await garantirCliente(db, empresa);
    const depositoId = uid();

    if (forma === "PIX_AUTOMATICO") {
      const startDate = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
      const autorizacao = await asaas("/pix/automatic/authorizations", {
        method: "POST",
        body: {
          customerId: customer,
          frequency: "MONTHLY",
          contractId: `RYCS-DST-${depositoId}`.slice(0, 35),
          description: `Destaque ${d.nome} RYCS`.slice(0, 35),
          startDate,
          value: d.preco,
          paymentCreationMode: "SUBSCRIPTION",
          retryPolicy: "ALLOW_THREE_IN_SEVEN_DAYS",
          immediateQrCode: {
            originalValue: TAXA_ATIVACAO_PIX_AUTOMATICO,
            expirationSeconds: 24 * 3600,
            description: "Ativação Pix Automático — Destaque RYCS",
          },
        },
      });

      db.prepare(`INSERT INTO deposit_requests (id, companyId, valor, status, referencia, gateway, observacao, criadoEm)
                  VALUES (?, ?, ?, 'pendente', ?, 'asaas', 'destaque', ?)`).run(depositoId, entityId, d.preco, autorizacao.id, agora());

      return res.json({
        depositoId, valor: d.preco, tipo, formaPagamento: "PIX_AUTOMATICO",
        taxaAtivacao: TAXA_ATIVACAO_PIX_AUTOMATICO,
        pixCopiaECola: autorizacao.payload || null,
        pixQrCodeBase64: autorizacao.encodedImage || null,
        expiraEm: autorizacao.immediateQrCode?.expirationDate || null,
      });
    }

    // CREDIT_CARD: cria assinatura mensal no Asaas com cartão.
    const vencimento = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
    const cartao = req.body.cartao;
    const titular = req.body.titular || {};

    const corpo = {
      customer,
      billingType: "CREDIT_CARD",
      value: d.preco,
      nextDueDate: vencimento,
      cycle: "MONTHLY",
      description: `Destaque ${d.nome} — RYCS`,
      externalReference: `destaque:${entityId}:${tipo}`,
      creditCard: {
        holderName: cartao.nome,
        number: String(cartao.numero).replace(/\D/g, ""),
        expiryMonth: String(cartao.validadeMes).padStart(2, "0"),
        expiryYear: String(cartao.validadeAno).length === 2 ? `20${cartao.validadeAno}` : String(cartao.validadeAno),
        ccv: String(cartao.cvv),
      },
      creditCardHolderInfo: {
        name: titular.nome || cartao.nome,
        email: titular.email || undefined,
        cpfCnpj: String(titular.documento || empresa.documento).replace(/\D/g, ""),
        postalCode: String(titular.cep || "").replace(/\D/g, ""),
        addressNumber: String(titular.numero || "") || "0",
        phone: String(titular.telefone || empresa.telefoneEmpresa || "").replace(/\D/g, "") || undefined,
      },
    };

    const cobranca = await asaas("/subscriptions", { method: "POST", body: corpo });

    db.prepare(`INSERT INTO deposit_requests (id, companyId, valor, status, referencia, gateway, observacao, criadoEm)
                VALUES (?, ?, ?, 'pendente', ?, 'asaas', 'destaque', ?)`).run(depositoId, entityId, d.preco, cobranca.id, agora());

    const cartaoInfo = cobranca.creditCard || {};
    res.json({
      depositoId, valor: d.preco, tipo, formaPagamento: "CREDIT_CARD",
      jaPago: cobranca.status === "ACTIVE",
      cartaoFinal: cartaoInfo.creditCardNumber || "",
      cartaoBandeira: cartaoInfo.creditCardBrand || "",
    });
  } catch (err) {
    console.error("[asaas] destaque:", err.message);
    res.status(502).json({ error: err instanceof AsaasError ? err.message : "Erro ao gerar a cobrança" });
  }
});

// A empresa vê os próprios pedidos; o admin vê todos os pendentes.
router.get("/deposits", (req, res) => {
  const { role, entityId } = req.user;

  if (role === "empresa") {
    return res.json(db.prepare("SELECT * FROM deposit_requests WHERE companyId = ? ORDER BY criadoEm DESC LIMIT 50").all(entityId));
  }
  if (role === "admin") {
    const rows = db.prepare(`
      SELECT d.*, c.nome AS empresaNome
      FROM deposit_requests d JOIN companies c ON c.id = d.companyId
      ORDER BY (d.status = 'pendente') DESC, d.criadoEm DESC LIMIT 100
    `).all();
    return res.json(rows);
  }
  res.status(403).json({ error: "Sem permissão" });
});

// ---------------------------------------------------------------------------
// Confirmação do admin — o ÚNICO ponto por onde entra saldo sem gateway.
// ---------------------------------------------------------------------------
router.patch("/deposits/:id", (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Apenas a plataforma pode confirmar depósitos" });

  const { status, observacao } = req.body;
  if (!["confirmado", "recusado"].includes(status))
    return res.status(400).json({ error: "Status deve ser confirmado ou recusado" });

  const pedido = db.prepare("SELECT * FROM deposit_requests WHERE id = ?").get(req.params.id);
  if (!pedido) return res.status(404).json({ error: "Depósito não encontrado" });

  // Depósito via gateway (asaas/stripe) é creditado/confirmado pelo webhook.
  // Confirmá-lo aqui à mão creditaria o valor duas vezes. 'manual' é o único
  // que o admin confirma.
  if (pedido.gateway && pedido.gateway !== "manual")
    return res.status(409).json({ error: "Depósito via gateway é confirmado automaticamente." });

  // Sem esta guarda, confirmar duas vezes creditaria o valor duas vezes —
  // um duplo-clique viraria dinheiro inventado.
  if (pedido.status !== "pendente")
    return res.status(409).json({ error: `Depósito já está como "${pedido.status}".` });

  db.transaction(() => {
    db.prepare("UPDATE deposit_requests SET status = ?, observacao = ?, confirmadoPor = ?, confirmadoEm = ? WHERE id = ?")
      .run(status, String(observacao || "").slice(0, 300), req.user.id, agora(), pedido.id);

    if (status === "confirmado") {
      const empresa = db.prepare("SELECT aportes FROM companies WHERE id = ?").get(pedido.companyId);
      const aportes = JSON.parse(empresa?.aportes || "[]");
      aportes.push({ valor: pedido.valor, ts: agora(), referencia: pedido.referencia, manual: true });
      db.prepare("UPDATE companies SET saldo = saldo + ?, totalAportado = totalAportado + ?, aportes = ? WHERE id = ?")
        .run(pedido.valor, pedido.valor, JSON.stringify(aportes), pedido.companyId);
      registrarMovimento({ companyId: pedido.companyId, tipo: "deposito", valor: pedido.valor, idempotencyKey: pedido.id, dados: { manual: true, referencia: pedido.referencia } });
    }
  })();

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(pedido.companyId);
  if (user) {
    notificar(user.id, "deposito",
      status === "confirmado"
        ? `Depósito de R$ ${pedido.valor.toFixed(2)} confirmado!`
        : `Depósito de R$ ${pedido.valor.toFixed(2)} não confirmado`,
      status === "confirmado" ? "O valor já está no seu caixa." : (observacao || "Fale com a plataforma."));
  }

  res.json({ ok: true, status });
});

export default router;

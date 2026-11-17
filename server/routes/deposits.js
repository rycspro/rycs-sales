import { Router } from "express";
import { isIP } from "node:net";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { asaas, asaasAtivo, AsaasError, garantirCliente } from "../services/asaas.js";
import { registrarMovimento } from "../services/financeiro.js";
import { criarCheckoutDeposito, stripeAtivo } from "../services/stripe.js";
import { normalizarMoeda } from "../../shared/moedas.js";
import { DESTAQUES } from "../../shared/planos.js";

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
  // Só a empresa dona ou o admin. Antes, qualquer vendedor logado lia o
  // depósito de qualquer empresa por id (IDOR).
  if (role === "admin" || (role === "empresa" && row.companyId === entityId)) {
    return res.json({ id: row.id, valor: row.valor, status: row.status, confirmadoEm: row.confirmadoEm || null });
  }
  return res.status(403).json({ error: "Sem permissão" });
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

  // Pagamento nacional do destaque é só Pix (pagamento único que ativa o
  // destaque). O cartão nacional foi removido; empresas fora do Brasil usam
  // /destaque/stripe.
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(entityId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
  if (!empresa.documento) return res.status(400).json({ error: "Cadastre o CNPJ ou CPF da empresa antes de contratar." });

  try {
    const customer = await garantirCliente(db, empresa);
    const depositoId = uid();

    // Cobrança Pix avulsa. O destaque é ativado pelo webhook quando o pagamento
    // é confirmado, pela externalReference "destaque:<empresa>:<tipo>".
    const cobranca = await asaas("/payments", {
      method: "POST",
      body: {
        customer,
        billingType: "PIX",
        value: d.preco,
        dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        description: `Destaque ${d.nome} — RYCS`,
        externalReference: `destaque:${entityId}:${tipo}`,
      },
    });

    let pix = null;
    try { pix = await asaas(`/payments/${cobranca.id}/pixQrCode`); }
    catch (e) { console.warn("[asaas] QR Pix destaque indisponível:", e.message); }

    db.prepare(`INSERT INTO deposit_requests (id, companyId, valor, status, referencia, gateway, observacao, criadoEm)
                VALUES (?, ?, ?, 'pendente', ?, 'asaas', 'destaque', ?)`).run(depositoId, entityId, d.preco, cobranca.id, agora());

    res.json({
      depositoId, valor: d.preco, tipo, formaPagamento: "PIX",
      jaPago: ["RECEIVED", "CONFIRMED"].includes(cobranca.status),
      pixCopiaECola: pix?.payload || null,
      pixQrCodeBase64: pix?.encodedImage || null,
      pixExpiracao: pix?.expirationDate || null,
      invoiceUrl: cobranca.invoiceUrl || null,
    });
  } catch (err) {
    console.error("[asaas] destaque:", err.message);
    res.status(502).json({ error: err instanceof AsaasError ? err.message : "Erro ao gerar a cobrança" });
  }
});

// Contratar o destaque como ASSINATURA RECORRENTE no cartão (mensal, sem trial).
// Mesma lógica dos planos: assina no cartão e renova todo mês. O destaque é
// ativado pelo webhook quando o pagamento é confirmado (externalReference
// "destaque:<empresa>:<tipo>"). Sem Pix — cartão apenas no caminho nacional; o
// internacional continua no Stripe (/destaque/stripe).
router.post("/destaque/subscription", async (req, res) => {
  const { role, entityId, id: userId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas podem contratar destaque" });
  const tipo = String(req.body?.tipo || "");
  const d = DESTAQUES[tipo];
  if (!d) return res.status(400).json({ error: "Tipo de destaque inválido" });
  if (!asaasAtivo()) return res.status(503).json({ error: "Pagamento indisponível no momento." });

  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(entityId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
  if (!empresa.documento) return res.status(400).json({ error: "Cadastre o CNPJ ou CPF da empresa antes de contratar." });

  try {
    const customer = await garantirCliente(db, empresa);
    const corpo = {
      customer,
      billingType: "CREDIT_CARD",
      value: d.preco,
      nextDueDate: new Date().toISOString().split("T")[0],
      cycle: "MONTHLY",
      description: `Destaque ${d.nome} — RYCS`,
      externalReference: `destaque:${entityId}:${tipo}`,
    };

    if (!isIP(req.ip)) return res.status(400).json({ error: "Não foi possível identificar o IP do pagador." });
    corpo.remoteIp = req.ip;

    // Dados do cartão vão direto ao gateway. Guardamos só o que o Asaas devolve
    // tokenizado (bandeira e quatro dígitos).
    const savedCardId = req.body?.savedCardId;
    if (savedCardId) {
      const saved = db.prepare("SELECT * FROM saved_cards WHERE id = ? AND companyId = ?").get(savedCardId, entityId);
      if (!saved) return res.status(400).json({ error: "Cartão salvo não encontrado." });
      corpo.creditCardToken = saved.token;
    } else {
      const cartao = req.body?.cartao || {};
      const titular = req.body?.titular || {};
      const faltando = ["numero", "validadeMes", "validadeAno", "cvv", "nome"].filter((k) => !String(cartao[k] || "").trim());
      if (faltando.length) return res.status(400).json({ error: "Preencha todos os dados do cartão." });
      corpo.creditCard = {
        holderName: cartao.nome,
        number: String(cartao.numero).replace(/\D/g, ""),
        expiryMonth: String(cartao.validadeMes).padStart(2, "0"),
        expiryYear: String(cartao.validadeAno).length === 2 ? `20${cartao.validadeAno}` : String(cartao.validadeAno),
        ccv: String(cartao.cvv),
      };
      const email = String(titular.email || "").trim() || db.prepare("SELECT email FROM users WHERE id = ?").get(userId)?.email;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Informe um e-mail válido do titular.", campo: "email" });
      const documento = String(titular.documento || "").replace(/\D/g, "");
      const cep = String(titular.cep || "").replace(/\D/g, "");
      const endereco = String(titular.numero || "").trim();
      if (![11, 14].includes(documento.length) || cep.length !== 8 || !endereco)
        return res.status(400).json({ error: "Informe CPF ou CNPJ, CEP e número do endereço do titular." });
      const phoneRaw = String(titular.telefone || empresa.telefoneEmpresa || empresa.whatsapp || "").replace(/\D/g, "");
      if (!phoneRaw) return res.status(400).json({ error: "Cadastre um telefone antes de pagar com cartão.", campo: "telefone" });
      corpo.creditCardHolderInfo = { name: titular.nome || cartao.nome, email, cpfCnpj: documento, postalCode: cep, addressNumber: endereco, phone: phoneRaw };
    }

    // Troca de nível: cancela a recorrência anterior antes de criar a nova.
    if (empresa.destaqueAsaasId) {
      try { await asaas(`/subscriptions/${empresa.destaqueAsaasId}`, { method: "DELETE" }); }
      catch (e) { console.warn("[asaas] cancelar destaque anterior:", e.status ?? e.message); }
    }

    const cobranca = await asaas("/subscriptions", { method: "POST", body: corpo, timeoutMs: 60_000 });
    if (!cobranca?.id) throw new Error("Asaas retornou uma assinatura sem identificador");
    db.prepare("UPDATE companies SET destaqueAsaasId = ? WHERE id = ?").run(cobranca.id, entityId);

    // Cartão cobra de forma síncrona: se já confirmou, ativa na hora (o webhook
    // também ativa, de forma idempotente).
    let ativado = false, cartaoInfo = {};
    try {
      const lista = await asaas(`/payments?subscription=${encodeURIComponent(cobranca.id)}&limit=5`);
      const pgtos = lista?.data || [];
      cartaoInfo = { ...(cobranca.creditCard || {}), ...(pgtos[0]?.creditCard || {}) };
      if (pgtos.some((p) => ["RECEIVED", "CONFIRMED"].includes(p.status))) {
        db.prepare("UPDATE companies SET destaque = 1, destaqueTipo = ? WHERE id = ?").run(tipo, entityId);
        ativado = true;
      }
    } catch (e) { console.warn("[asaas] confirmação destaque:", e.message); }

    if (!savedCardId && req.body?.salvarCartao && cartaoInfo.creditCardToken) {
      const jaExiste = db.prepare("SELECT id FROM saved_cards WHERE companyId = ? AND token = ?").get(entityId, cartaoInfo.creditCardToken);
      if (!jaExiste) db.prepare(`INSERT INTO saved_cards (id, companyId, apelido, bandeira, final4, token, holderName, tipo, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(uid(), entityId, "", cartaoInfo.creditCardBrand || "", cartaoInfo.creditCardNumber || "", cartaoInfo.creditCardToken, req.body?.cartao?.nome || "", "CREDIT_CARD", agora());
    }

    res.json({ ok: true, ativado, tipo, cartaoFinal: cartaoInfo.creditCardNumber || "" });
  } catch (err) {
    console.error("[asaas] destaque assinatura:", err.message);
    const primeiro = Array.isArray(err.corpo?.errors) ? err.corpo.errors[0] : null;
    res.status(err instanceof AsaasError ? 400 : 502)
      .json({ error: primeiro?.description || (err instanceof AsaasError ? err.message : "Não foi possível processar o pagamento.") });
  }
});

// Encerrar o destaque: cancela a recorrência no Asaas e desliga a visibilidade.
router.post("/destaque/cancel", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas podem cancelar destaque" });
  const empresa = db.prepare("SELECT id, destaqueAsaasId FROM companies WHERE id = ?").get(entityId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
  if (empresa.destaqueAsaasId && asaasAtivo()) {
    try { await asaas(`/subscriptions/${empresa.destaqueAsaasId}`, { method: "DELETE" }); }
    catch (e) { console.warn("[asaas] cancelar destaque:", e.status ?? e.message); }
  }
  db.prepare("UPDATE companies SET destaque = 0, destaqueTipo = '', destaqueAsaasId = NULL WHERE id = ?").run(entityId);
  res.json({ ok: true });
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

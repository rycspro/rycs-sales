import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { asaas, asaasAtivo, AsaasError } from "../services/asaas.js";
import { registrarMovimento } from "../services/financeiro.js";

const router = Router();

// Cobrança pelo gateway: o saldo entra pelo webhook, não aqui.
async function cobrancaPeloGateway(req, res, companyId, valor) {
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
  if (!empresa.documento)
    return res.status(400).json({ error: "Cadastre o CNPJ ou CPF da empresa antes de depositar." });

  try {
    let customer = empresa.asaasCustomerId;
    if (!customer) {
      const usuario = db.prepare("SELECT email FROM users WHERE entityId = ? AND role = 'empresa'").get(companyId);
      const cliente = await asaas("/customers", {
        method: "POST",
        body: {
          name: empresa.nome,
          cpfCnpj: String(empresa.documento).replace(/\D/g, ""),
          email: usuario?.email || undefined,
          externalReference: companyId,
        },
      });
      customer = cliente.id;
      db.prepare("UPDATE companies SET asaasCustomerId = ? WHERE id = ?").run(customer, companyId);
    }

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

    // A taxa de gateway é cobrada da conta RYCS, não descontada do depositante.
    // O caixa da empresa recebe o valor bruto integral.
    return res.json({
      id: cobranca.id,
      valor,
      valorBruto: valor,
      taxaGateway: 0,
      valorLiquido: valor,
      modo: "gateway",
      pixCopiaECola: pix?.payload || null,
      pixQrCodeBase64: pix?.encodedImage || null,
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
  const piso = asaasAtivo() ? MINIMO_GATEWAY : MINIMO;
  if (!Number.isFinite(valor) || valor < piso)
    return res.status(400).json({ error: `Valor mínimo: R$ ${piso},00` });

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

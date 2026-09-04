import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";

const router = Router();

const MINIMO = 1;

// Chave Pix da plataforma, mostrada à empresa na hora de depositar.
const PIX_RYCS = process.env.PIX_RECEBIMENTO || "";
const TITULAR_RYCS = process.env.PIX_TITULAR || "RYCS Sales Solutions";

// ---------------------------------------------------------------------------
// Empresa declara um depósito. Nada é creditado aqui — só registra a intenção
// e devolve os dados para o pagamento.
// ---------------------------------------------------------------------------
router.post("/deposits", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresas podem depositar" });

  const valor = Number(req.body?.valor);
  if (!Number.isFinite(valor) || valor < MINIMO)
    return res.status(400).json({ error: `Valor mínimo: R$ ${MINIMO},00` });

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
    id, valor, referencia,
    pix: PIX_RYCS || null,
    titular: TITULAR_RYCS,
    instrucoes: PIX_RYCS
      ? `Transfira R$ ${valor.toFixed(2)} por Pix e informe a referência ${referencia}. O caixa é creditado após a confirmação.`
      : "A chave Pix ainda não foi configurada. Fale com a plataforma para concluir o depósito.",
  });
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

// Planos do profissional (Grátis/Pro/Premium) — docs/rycs/planos-pro-premium.md.
//
// Cobrança real só com PLANOS_PROFISSIONAL_ATIVO=1. Sem ela, a assinatura
// responde 503 e a vitrine mostra "em breve". O admin pode conceder plano à
// mão (origem 'admin' ou 'migracao') para testes e para quem pagou o Pro
// antigo fora do app.

import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { asaas, asaasAtivo, AsaasError, garantirClienteProfissional } from "../services/asaas.js";
import { assinaturasDoProfissional, planoAtual, cobrancaProfissionalAtiva } from "../services/planosProfissional.js";
import { PLANOS_PROFISSIONAL, PLANOS_PAGOS_PROFISSIONAL, limite } from "../../shared/planosProfissional.js";
import { saqueMinimoPara } from "../../shared/saque.js";
import { cpfValido } from "../services/regras.js";

const router = Router();
const hojeIso = () => new Date().toISOString().slice(0, 10);
const VIVAS = ["pendente", "ativa", "atrasada"];

const publica = (a) => a && ({
  id: a.id, plano: a.plano, ciclo: a.ciclo, status: a.status, origem: a.origem, valor: a.valor,
  inicio: a.inicio, pagoAte: a.pagoAte, proximaCobranca: a.proximaCobranca, canceladoEm: a.canceladoEm,
});

function resumoDoPlano(sellerId) {
  const atual = planoAtual(sellerId);
  const assinaturas = assinaturasDoProfissional(sellerId);
  const v = db.prepare("SELECT documento, asaasCustomerId FROM sellers WHERE id = ?").get(sellerId) || {};
  return {
    ...atual,
    // O checkout pede o CPF na hora quando ele ainda não foi cadastrado.
    temDocumento: !!(v.documento || v.asaasCustomerId),
    cobrancaAtiva: cobrancaProfissionalAtiva(),
    saqueMinimo: saqueMinimoPara(limite(atual.plano, "saqueMinimo")),
    assinatura: publica(assinaturas.find((a) => VIVAS.includes(a.status) || a.id === atual.assinaturaId) || null),
  };
}

async function pixDaPrimeiraCobranca(asaasSubId) {
  try {
    const lista = await asaas(`/subscriptions/${asaasSubId}/payments`);
    const cobranca = lista?.data?.[0];
    if (!cobranca) return null;
    const pix = await asaas(`/payments/${cobranca.id}/pixQrCode`);
    return { paymentId: cobranca.id, vencimento: cobranca.dueDate, valor: cobranca.value, qrCode: pix?.encodedImage || null, copiaECola: pix?.payload || null, invoiceUrl: cobranca.invoiceUrl || null };
  } catch { return null; }
}

router.get("/profissional/plano", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  res.json(resumoDoPlano(req.user.entityId));
});

router.post("/profissional/assinatura", async (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  if (!cobrancaProfissionalAtiva())
    return res.status(503).json({ error: "A assinatura dos planos ainda não está disponível.", codigo: "PLANOS_EM_BREVE" });
  if (!asaasAtivo()) return res.status(503).json({ error: "Pagamento indisponível no momento. Tente mais tarde." });

  const chave = String(req.body?.plano || "");
  if (!PLANOS_PAGOS_PROFISSIONAL.includes(chave)) return res.status(400).json({ error: "Plano inválido." });
  const sellerId = req.user.entityId;
  const vendedor = db.prepare("SELECT * FROM sellers WHERE id = ?").get(sellerId);
  if (!vendedor) return res.status(404).json({ error: "Profissional não encontrado" });

  const atual = planoAtual(sellerId);
  if (atual.plano !== "gratis") {
    // Upgrade no meio do período ainda é decisão pendente (§8, item 11).
    return res.status(409).json({ error: atual.plano === chave ? "Você já assina este plano." : "A troca de plano no meio do período ainda não está disponível." });
  }

  // Já existe cobrança aberta: devolve a mesma (mesmo plano) ou encerra a antiga.
  const pendente = db.prepare("SELECT * FROM assinaturas_profissional WHERE sellerId = ? AND status = 'pendente' AND origem = 'asaas' ORDER BY criadoEm DESC LIMIT 1").get(sellerId);
  if (pendente && pendente.plano === chave && pendente.asaasId)
    return res.json({ assinatura: publica(pendente), pix: await pixDaPrimeiraCobranca(pendente.asaasId) });
  if (pendente) {
    if (pendente.asaasId) { try { await asaas(`/subscriptions/${pendente.asaasId}`, { method: "DELETE" }); } catch { /* já removida */ } }
    db.prepare("UPDATE assinaturas_profissional SET status = 'expirada', atualizadoEm = ? WHERE id = ?").run(agora(), pendente.id);
  }

  // CPF informado no próprio checkout: só preenche quem ainda não tem documento,
  // nunca troca um já cadastrado.
  if (!vendedor.documento && !vendedor.asaasCustomerId) {
    const cpf = String(req.body?.cpf || "").replace(/\D/g, "");
    if (!cpf) return res.status(400).json({ error: "Informe o seu CPF para assinar um plano.", codigo: "FALTA_DOCUMENTO" });
    if (!cpfValido(cpf)) return res.status(400).json({ error: "CPF inválido. Confira os números.", codigo: "CPF_INVALIDO" });
    db.prepare("UPDATE sellers SET documento = ? WHERE id = ? AND (documento IS NULL OR documento = '')").run(cpf, sellerId);
    vendedor.documento = cpf;
  }

  let customerId;
  try { customerId = await garantirClienteProfissional(db, vendedor); }
  catch (e) {
    if (e.faltaDocumento) return res.status(400).json({ error: e.message, codigo: "FALTA_DOCUMENTO" });
    return res.status(502).json({ error: "Não foi possível registrar você no meio de pagamento." });
  }

  const plano = PLANOS_PROFISSIONAL[chave];
  const id = uid();
  const t = agora();
  db.prepare(`INSERT INTO assinaturas_profissional (id, sellerId, plano, ciclo, status, origem, asaasCustomerId, valor, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, 'anual', 'pendente', 'asaas', ?, ?, ?, ?)`).run(id, sellerId, chave, customerId, plano.precoAnual, t, t);

  try {
    const sub = await asaas("/subscriptions", {
      method: "POST",
      body: {
        customer: customerId,
        billingType: "PIX",
        cycle: "YEARLY",
        value: plano.precoAnual,
        nextDueDate: hojeIso(),
        description: `RYCS ${plano.nome} — assinatura anual`,
        externalReference: `prof:${id}`,
      },
    });
    db.prepare("UPDATE assinaturas_profissional SET asaasId = ?, proximaCobranca = ?, atualizadoEm = ? WHERE id = ?")
      .run(sub.id, Date.parse(`${sub.nextDueDate || hojeIso()}T12:00:00Z`) || null, agora(), id);
    const salva = db.prepare("SELECT * FROM assinaturas_profissional WHERE id = ?").get(id);
    res.status(201).json({ assinatura: publica(salva), pix: await pixDaPrimeiraCobranca(sub.id) });
  } catch (e) {
    db.prepare("UPDATE assinaturas_profissional SET status = 'expirada', motivo = ?, atualizadoEm = ? WHERE id = ?")
      .run(`falha ao criar no gateway: ${e.message}`.slice(0, 200), agora(), id);
    res.status(e instanceof AsaasError ? 502 : 500).json({ error: "Não foi possível gerar a cobrança. Tente de novo." });
  }
});

// Cancela a renovação. O benefício segue até o fim do período pago.
router.delete("/profissional/assinatura", async (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const sellerId = req.user.entityId;
  const a = db.prepare("SELECT * FROM assinaturas_profissional WHERE sellerId = ? AND origem = 'asaas' AND status IN ('pendente','ativa','atrasada') ORDER BY criadoEm DESC LIMIT 1").get(sellerId);
  if (!a) return res.status(404).json({ error: "Você não tem assinatura para cancelar." });

  if (a.asaasId) {
    try { await asaas(`/subscriptions/${a.asaasId}`, { method: "DELETE" }); }
    catch (e) {
      if (!(e instanceof AsaasError && e.status === 404))
        return res.status(502).json({ error: "Não foi possível cancelar agora. Tente de novo." });
    }
  }
  const status = a.pagoAte ? "cancelada" : "expirada";
  db.prepare("UPDATE assinaturas_profissional SET status = ?, canceladoEm = ?, motivo = 'cancelado pelo profissional', atualizadoEm = ? WHERE id = ?")
    .run(status, agora(), agora(), a.id);
  res.json(resumoDoPlano(sellerId));
});

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get("/admin/profissionais/:sellerId/plano", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });
  res.json({ ...planoAtual(req.params.sellerId), assinaturas: assinaturasDoProfissional(req.params.sellerId).map(publica) });
});

// Concede plano sem cobrança (teste, cortesia ou quem pagou o Pro antigo por fora).
router.post("/admin/profissionais/:sellerId/plano", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });
  const { plano, ate, motivo, origem = "admin" } = req.body || {};
  if (!PLANOS_PAGOS_PROFISSIONAL.includes(plano)) return res.status(400).json({ error: "Plano inválido." });
  if (!["admin", "migracao"].includes(origem)) return res.status(400).json({ error: "Origem deve ser 'admin' ou 'migracao'." });
  const pagoAte = typeof ate === "number" ? ate : Date.parse(ate);
  if (!Number.isFinite(pagoAte) || pagoAte <= agora()) return res.status(400).json({ error: "Informe até quando o plano vale (data futura)." });
  if (!String(motivo || "").trim()) return res.status(400).json({ error: "Informe o motivo." });
  if (!db.prepare("SELECT 1 FROM sellers WHERE id = ?").get(req.params.sellerId)) return res.status(404).json({ error: "Profissional não encontrado" });

  const t = agora();
  db.prepare(`INSERT INTO assinaturas_profissional (id, sellerId, plano, ciclo, status, origem, valor, inicio, pagoAte, motivo, criadoPor, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, 'anual', 'ativa', ?, 0, ?, ?, ?, ?, ?, ?)`)
    .run(uid(), req.params.sellerId, plano, origem, t, pagoAte, String(motivo).trim().slice(0, 300), String(req.user.entityId || req.user.id || "admin"), t, t);
  res.status(201).json(planoAtual(req.params.sellerId));
});

// Retira o que o admin concedeu. Assinatura paga pelo Asaas não é mexida aqui.
router.delete("/admin/profissionais/:sellerId/plano", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });
  const motivo = String(req.body?.motivo || "").trim();
  if (!motivo) return res.status(400).json({ error: "Informe o motivo." });
  const r = db.prepare(`UPDATE assinaturas_profissional SET status = 'expirada', motivo = ?, atualizadoEm = ?
    WHERE sellerId = ? AND origem IN ('admin','migracao') AND status IN ('ativa','atrasada','cancelada')`)
    .run(`retirado: ${motivo}`.slice(0, 300), agora(), req.params.sellerId);
  res.json({ retiradas: r.changes, ...planoAtual(req.params.sellerId) });
});

export default router;

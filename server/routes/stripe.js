import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { PLANOS, CICLOS, ORDEM_PLANOS, normalizarCiclo } from "../../shared/planos.js";
import { MOEDA_INTERNACIONAL, valorInternacionalNoCiclo } from "../../shared/precosInternacionais.js";
import { trialDoOnboarding } from "../services/onboarding.js";
import { asaas, asaasAtivo } from "../services/asaas.js";
import {
  stripeAtivo, modoStripe, chavePublicaStripe, assinaturaValida, processarEvento, criarCheckoutAssinatura,
  encerrarCheckoutPendente, portalDoCliente, ErroStripe,
} from "../services/stripe.js";

// Mesmo prazo de teste do checkout em reais (server/routes/subscriptions.js).
const TRIAL_DIAS_PUBLICO = 5;

// --- Sem login: o Stripe chama o webhook sem cookie ---
export const stripePublico = Router();

stripePublico.post("/webhooks/stripe", async (req, res) => {
  if (!assinaturaValida(req.rawBody, req.headers["stripe-signature"]))
    return res.status(400).json({ error: "Assinatura inválida" });
  try {
    const r = await processarEvento(req.body);
    res.json({ received: true, ...r });
  } catch (e) {
    console.error("[stripe] webhook:", req.body?.type, e.message);
    res.status(500).json({ error: "Falha ao processar; o Stripe tenta de novo." });
  }
});

// --- Empresa logada ---
const router = Router();

const soEmpresa = (req, res, next) => (req.user?.role === "empresa" ? next() : res.status(403).json({ error: "Apenas empresas" }));

router.get("/stripe/status", soEmpresa, (_req, res) => {
  res.json({
    ativo: stripeAtivo(),
    modo: stripeAtivo() ? modoStripe() : null,
    moeda: MOEDA_INTERNACIONAL,
    // Chave publicável (pública por natureza): habilita o checkout embutido.
    chavePublica: stripeAtivo() ? chavePublicaStripe() : null,
    planos: ORDEM_PLANOS.filter((k) => PLANOS[k]?.preco > 0).map((k) => ({
      chave: k, nome: PLANOS[k].nome,
      mensal: valorInternacionalNoCiclo(k, CICLOS.MENSAL), semestral: valorInternacionalNoCiclo(k, CICLOS.SEMESTRAL), anual: valorInternacionalNoCiclo(k, CICLOS.ANUAL),
    })),
  });
});

// Abre o checkout do Stripe e devolve a URL para a tela redirecionar.
// Não pede CPF/CNPJ: é o caminho da empresa estrangeira.
router.post("/subscription/stripe", soEmpresa, async (req, res) => {
  const { entityId, id: userId } = req.user;
  if (!stripeAtivo()) return res.status(503).json({ error: "Pagamento internacional indisponível no momento." });

  const chave = String(req.body?.plano || "").trim();
  if (!PLANOS[chave]?.preco) return res.status(400).json({ error: "Escolha um dos planos pagos." });
  const ciclo = normalizarCiclo(req.body?.ciclo);
  const doOnboarding = req.body?.onboarding === true;

  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(entityId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
  const email = db.prepare("SELECT email FROM users WHERE id = ?").get(userId)?.email || null;

  // Checkout aberto antes (de qualquer gateway) deixa de valer: duas
  // assinaturas vivas seriam cobrança dobrada. O em reais é cancelado no
  // Asaas; se o Asaas não confirmar, não abrimos o em dólar.
  const pendentes = db.prepare("SELECT * FROM subscriptions WHERE companyId = ? AND status = 'pendente'").all(entityId);
  for (const p of pendentes) {
    if (p.gateway === "stripe") await encerrarCheckoutPendente(p);
    else if (p.asaasId || p.asaasAutorizacaoId) {
      if (!asaasAtivo()) return res.status(503).json({ error: "Não foi possível encerrar o checkout em reais aberto. Tente de novo em instantes." });
      try {
        if (p.asaasId) await asaas(`/subscriptions/${p.asaasId}`, { method: "DELETE" });
        else await asaas(`/pix/automatic/authorizations/${p.asaasAutorizacaoId}`, { method: "DELETE" });
      } catch (e) {
        if (e.status !== 404) {
          console.warn("[stripe] cancelar checkout em reais:", e.message);
          return res.status(502).json({ error: "Não foi possível encerrar o checkout em reais aberto. Tente de novo em instantes." });
        }
      }
      db.prepare("UPDATE voucher_redemptions SET status = 'cancelado' WHERE subscriptionId = ? AND status = 'reservado'").run(p.id);
    }
    db.prepare("UPDATE subscriptions SET status = 'cancelada', atualizadoEm = ? WHERE id = ?").run(agora(), p.id);
  }

  const trialDias = PLANOS[chave]?.trial === false ? 0 : (doOnboarding ? trialDoOnboarding(entityId) : TRIAL_DIAS_PUBLICO);
  const valor = valorInternacionalNoCiclo(chave, ciclo);
  const subId = uid();
  db.prepare(`INSERT INTO subscriptions (id, companyId, plano, status, valor, valorOriginal, desconto, criadoEm, trialDias, formaPagamento, ciclo, gateway, moeda, atualizadoEm)
              VALUES (?, ?, ?, 'pendente', ?, ?, 0, ?, ?, 'STRIPE', ?, 'stripe', ?, ?)`)
    .run(subId, entityId, chave, valor, valor, agora(), trialDias, ciclo, MOEDA_INTERNACIONAL, agora());

  try {
    const embutido = req.body?.embutido === true && !!chavePublicaStripe();
    const r = await criarCheckoutAssinatura({ empresa, email, subId, chave, ciclo, trialDias, retorno: req.body?.retorno, embutido });
    res.json({ ok: true, subscriptionId: subId, url: r.url, clientSecret: r.clientSecret, chavePublica: embutido ? chavePublicaStripe() : null,
               valor: r.valor, moeda: r.moeda, trialDias });
  } catch (e) {
    db.prepare("UPDATE subscriptions SET status = 'cancelada', falhaMotivo = ?, atualizadoEm = ? WHERE id = ?").run(String(e.message).slice(0, 300), agora(), subId);
    console.error("[stripe] checkout:", e.message);
    res.status(e instanceof ErroStripe && e.status === 400 ? 400 : 502).json({ error: "Não foi possível abrir o pagamento internacional. Tente de novo." });
  }
});

// Portal do Stripe: trocar cartão, ver faturas, cancelar.
router.post("/subscription/stripe/portal", soEmpresa, async (req, res) => {
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.user.entityId);
  try {
    res.json({ url: await portalDoCliente(empresa, req.body?.retorno) });
  } catch (e) {
    console.warn("[stripe] portal:", e.message);
    res.status(e.status === 404 ? 404 : 502).json({ error: e.status === 404 ? e.message : "Não foi possível abrir o portal de pagamento." });
  }
});

export default router;

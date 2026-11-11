// Stripe: cobrança em dólar para empresas fora do Brasil.
//
// O Asaas continua sendo o gateway do Brasil (Pix, Pix Automático, boleto,
// cartão nacional e os saques dos profissionais). O Stripe entra só para quem
// paga de fora, pelo Checkout hospedado deles: o cartão nunca passa pela RYCS,
// e o Stripe cuida sozinho de 3DS, Apple/Google Pay e do e-mandate exigido
// para cartões indianos em cobrança recorrente.
//
// Fluxo da assinatura:
//   1. POST /subscription/stripe cria a linha em `subscriptions` (pendente,
//      gateway='stripe') e uma Checkout Session com o id dela nos metadados.
//   2. A empresa paga no Stripe e volta para a plataforma.
//   3. O webhook (checkout.session.completed, invoice.paid,
//      customer.subscription.*) é quem libera, renova, marca inadimplência e
//      cancela. A volta da tela nunca libera nada sozinha.
//
// Sem dependência nova: a API REST do Stripe é chamada com fetch, como na
// integração da Meta, e o fetch é injetável nos testes.

import { createHmac, timingSafeEqual } from "crypto";
import db, { agora } from "../db.js";
import { notificar } from "../routes/notifications.js";
import { planoDe, CICLOS } from "../../shared/planos.js";
import { MOEDA_INTERNACIONAL, valorInternacionalNoCiclo } from "../../shared/precosInternacionais.js";
import { qualificarIndicacao } from "./indicacoes.js";
import { concluir as concluirEtapaOnboarding } from "./onboarding.js";

const API = "https://api.stripe.com/v1";

function adicionarColuna(tabela, coluna, definicao) {
  const existe = db.prepare(`PRAGMA table_info(${tabela})`).all().some((c) => c.name === coluna);
  if (!existe) db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
}
adicionarColuna("subscriptions", "gateway", "TEXT DEFAULT 'asaas'");
adicionarColuna("subscriptions", "moeda", "TEXT DEFAULT 'BRL'");
adicionarColuna("subscriptions", "stripeSessionId", "TEXT");
adicionarColuna("subscriptions", "stripeSubscriptionId", "TEXT");
adicionarColuna("companies", "stripeCustomerId", "TEXT");
db.exec("CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripeSubscriptionId)");

let fetchImpl = (...a) => fetch(...a);
export function usarFetch(f) { fetchImpl = f; }

export const stripeAtivo = () => !!process.env.STRIPE_SECRET_KEY;
export const chavePublicaStripe = () => process.env.STRIPE_PUBLISHABLE_KEY || null;
export const modoStripe = () => (String(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_") ? "producao" : "teste");

export class ErroStripe extends Error {
  constructor(mensagem, { status = 0, codigo = "", tipo = "" } = {}) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.tipo = tipo;
  }
}

// Corpo no formato que o Stripe espera: a[b][0][c]=valor.
export function formulario(obj, prefixo = "", saida = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const chave = prefixo ? `${prefixo}[${k}]` : k;
    if (typeof v === "object") formulario(Array.isArray(v) ? Object.fromEntries(v.map((x, i) => [i, x])) : v, chave, saida);
    else saida.append(chave, String(v));
  }
  return saida;
}

export async function stripe(caminho, { method = "GET", body, idempotencia } = {}) {
  if (!stripeAtivo()) throw new ErroStripe("Pagamento internacional indisponível no momento.", { status: 503 });
  const headers = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` };
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencia) headers["Idempotency-Key"] = String(idempotencia);
  const r = await fetchImpl(`${API}${caminho}`, { method, headers, body: body ? formulario(body).toString() : undefined });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json?.error) {
    const e = json?.error || {};
    throw new ErroStripe(e.message || `Stripe respondeu ${r.status}`, { status: r.status, codigo: e.code || "", tipo: e.type || "" });
  }
  return json;
}

// Cabeçalho Stripe-Signature: "t=<unix>,v1=<hmac>[,v1=…]". O HMAC-SHA256 é
// sobre "<t>.<corpo cru>" com o segredo do endpoint. Eventos com mais de
// cinco minutos são recusados para impedir reenvio de um aviso capturado.
export function assinaturaValida(corpoCru, cabecalho, segredo = process.env.STRIPE_WEBHOOK_SECRET, agoraSeg = Math.floor(Date.now() / 1000)) {
  if (!segredo || !corpoCru || !cabecalho) return false;
  const partes = String(cabecalho).split(",").map((p) => p.trim().split("="));
  const t = Number(partes.find(([k]) => k === "t")?.[1]);
  const assinaturas = partes.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !assinaturas.length || Math.abs(agoraSeg - t) > 300) return false;
  const esperado = createHmac("sha256", segredo).update(`${t}.`).update(corpoCru).digest();
  return assinaturas.some((a) => {
    const b = Buffer.from(String(a), "hex");
    return b.length === esperado.length && timingSafeEqual(b, esperado);
  });
}

const centavos = (v) => Math.round(Number(v) * 100);
const segParaMs = (s) => (s ? Number(s) * 1000 : null);

// Retorno para a tela: só caminho relativo da própria plataforma.
function urlDeRetorno(retorno, extra) {
  const base = (process.env.PUBLIC_URL || process.env.FRONTEND_URL || "https://app.rycs.pro").replace(/\/+$/, "");
  const caminho = typeof retorno === "string" && /^\/(?!\/)[\w\-./]*$/.test(retorno) ? retorno : "/plataforma";
  return `${base}${caminho}${caminho.includes("?") ? "&" : "?"}${extra}`;
}

async function garantirClienteStripe(empresa, email) {
  if (empresa.stripeCustomerId) return empresa.stripeCustomerId;
  const c = await stripe("/customers", {
    method: "POST",
    idempotencia: `cliente-${empresa.id}`,
    body: { name: empresa.nome || undefined, email: email || undefined, metadata: { companyId: empresa.id } },
  });
  db.prepare("UPDATE companies SET stripeCustomerId = ? WHERE id = ?").run(c.id, empresa.id);
  return c.id;
}

// Checkout pendente anterior do Stripe: a sessão é encerrada lá para o link
// antigo não conseguir abrir uma segunda assinatura.
export async function encerrarCheckoutPendente(sub) {
  if (sub?.gateway !== "stripe" || !sub.stripeSessionId || sub.stripeSubscriptionId) return;
  try { await stripe(`/checkout/sessions/${sub.stripeSessionId}/expire`, { method: "POST" }); }
  catch (e) { if (e.codigo !== "resource_missing") console.warn("[stripe] encerrar checkout anterior:", e.message); }
}

// embutido = true: o checkout abre dentro da RYCS (Embedded Checkout). A tela
// recebe o client_secret e monta o formulário do Stripe num iframe; o cliente
// não sai da plataforma. Sem embutido, devolve a URL da página do Stripe.
export async function criarCheckoutAssinatura({ empresa, email, subId, chave, ciclo = CICLOS.MENSAL, trialDias = 0, retorno, embutido = false }) {
  const plano = planoDe(chave);
  const valor = valorInternacionalNoCiclo(chave, ciclo);
  if (!valor) throw new ErroStripe("Plano inválido.", { status: 400 });
  const customer = await garantirClienteStripe(empresa, email);
  const anual = ciclo === CICLOS.ANUAL;
  const metadados = { subId, companyId: empresa.id, plano: chave, ciclo };

  const sessao = await stripe("/checkout/sessions", {
    method: "POST",
    idempotencia: `checkout-${subId}`,
    body: {
      mode: "subscription",
      customer,
      client_reference_id: subId,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: MOEDA_INTERNACIONAL.toLowerCase(),
          unit_amount: centavos(valor),
          recurring: { interval: anual ? "year" : "month" },
          product_data: { name: `RYCS ${plano.nome}`, metadata: { plano: chave } },
        },
      }],
      subscription_data: {
        metadata: metadados,
        description: `RYCS ${plano.nome} — ${anual ? "annual" : "monthly"} subscription`,
        ...(trialDias > 0 ? { trial_period_days: trialDias } : {}),
      },
      metadata: metadados,
      // Empresa de fora informa endereço e, se quiser, o tax ID para a fatura.
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { name: "auto", address: "auto" },
      allow_promotion_codes: true,
      ...(embutido
        ? { ui_mode: "embedded_page", redirect_on_completion: "if_required", return_url: urlDeRetorno(retorno, "stripe=ok") }
        : { success_url: urlDeRetorno(retorno, "stripe=ok"), cancel_url: urlDeRetorno(retorno, "stripe=cancelado") }),
    },
  });

  db.prepare("UPDATE subscriptions SET stripeSessionId = ?, invoiceUrl = ?, atualizadoEm = ? WHERE id = ?")
    .run(sessao.id, sessao.url || null, agora(), subId);
  return { url: sessao.url || null, clientSecret: sessao.client_secret || null, sessionId: sessao.id, valor, moeda: MOEDA_INTERNACIONAL };
}

export async function cancelarAssinaturaStripe(sub) {
  if (sub?.stripeSubscriptionId) {
    try { await stripe(`/subscriptions/${sub.stripeSubscriptionId}`, { method: "DELETE" }); }
    catch (e) { if (e.codigo !== "resource_missing") throw e; }
  } else {
    await encerrarCheckoutPendente(sub);
  }
}

// Portal do Stripe: a empresa troca o cartão, baixa faturas e cancela lá.
export async function portalDoCliente(empresa, retorno) {
  if (!empresa?.stripeCustomerId) throw new ErroStripe("Esta empresa ainda não tem pagamento internacional.", { status: 404 });
  const s = await stripe("/billing_portal/sessions", {
    method: "POST",
    body: { customer: empresa.stripeCustomerId, return_url: urlDeRetorno(retorno, "stripe=portal") },
  });
  return s.url;
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

const usuarioDaEmpresa = (companyId) => db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(companyId);

// Campos que mudaram de lugar entre versões da API do Stripe.
const subscriptionDaFatura = (inv) => inv?.subscription || inv?.parent?.subscription_details?.subscription || null;
const fimDoPeriodo = (s) => s?.current_period_end || s?.items?.data?.[0]?.current_period_end || null;

function subPorStripe(stripeSubscriptionId, metadados) {
  return (stripeSubscriptionId && db.prepare("SELECT * FROM subscriptions WHERE stripeSubscriptionId = ?").get(stripeSubscriptionId))
    || (metadados?.subId && db.prepare("SELECT * FROM subscriptions WHERE id = ? AND gateway = 'stripe'").get(metadados.subId))
    || null;
}

function liberar(sub, { status, proximaCobranca = null, trialFim = null }) {
  const jaEstava = sub.status === status;
  db.transaction(() => {
    db.prepare(`UPDATE subscriptions SET status = ?, inicio = COALESCE(inicio, ?), proximaCobranca = COALESCE(?, proximaCobranca),
                trialFim = COALESCE(?, trialFim), falhaMotivo = NULL, atualizadoEm = ? WHERE id = ?`)
      .run(status, agora(), proximaCobranca, trialFim, agora(), sub.id);
    db.prepare("UPDATE companies SET assinatura = ? WHERE id = ?").run(sub.plano, sub.companyId);
    // A assinatura nova substitui qualquer outra que estivesse valendo.
    db.prepare("UPDATE subscriptions SET status = 'cancelada', atualizadoEm = ? WHERE companyId = ? AND id != ? AND status IN ('pendente')")
      .run(agora(), sub.companyId, sub.id);
  })();
  try { concluirEtapaOnboarding(sub.companyId, "plano"); } catch { /* empresa fora do onboarding */ }
  if (jaEstava) return;
  const user = usuarioDaEmpresa(sub.companyId);
  if (!user) return;
  if (status === "trial") notificar(user.id, "assinatura", `Plano ${planoDe(sub.plano).nome} liberado`, "Seu período gratuito começou. A cobrança acontece no fim dele, no cartão cadastrado.");
  else { notificar(user.id, "assinatura", `Plano ${planoDe(sub.plano).nome} ativado!`); qualificarIndicacao(user.id); }
}

function inadimplente(sub, motivo) {
  if (!sub || sub.status === "cancelada") return;
  db.prepare("UPDATE subscriptions SET status = 'inadimplente', falhaMotivo = ?, atualizadoEm = ? WHERE id = ?")
    .run(String(motivo).slice(0, 300), agora(), sub.id);
  const user = usuarioDaEmpresa(sub.companyId);
  if (user && sub.status !== "inadimplente") {
    notificar(user.id, "assinatura", "Não conseguimos processar seu pagamento",
      "Atualize o cartão para voltar a usar a plataforma. Seus dados continuam salvos.");
  }
  console.warn(`[stripe] inadimplente: empresa ${sub.companyId} — ${motivo}`);
}

function encerrar(sub, motivo) {
  if (!sub || sub.status === "cancelada") return;
  db.transaction(() => {
    db.prepare("UPDATE subscriptions SET status = 'cancelada', falhaMotivo = ?, atualizadoEm = ? WHERE id = ?").run(motivo, agora(), sub.id);
    // Só volta para o Free se esta era a assinatura que valia.
    const outra = db.prepare("SELECT 1 FROM subscriptions WHERE companyId = ? AND id != ? AND status IN ('ativa','trial')").get(sub.companyId, sub.id);
    if (!outra) db.prepare("UPDATE companies SET assinatura = 'free' WHERE id = ?").run(sub.companyId);
  })();
}

function aplicarEstado(sub, s) {
  if (!sub || !s) return;
  const proxima = segParaMs(fimDoPeriodo(s));
  switch (s.status) {
    case "trialing": return liberar(sub, { status: "trial", proximaCobranca: segParaMs(s.trial_end) || proxima, trialFim: segParaMs(s.trial_end) });
    case "active": return liberar(sub, { status: "ativa", proximaCobranca: proxima });
    case "past_due":
    case "unpaid": return inadimplente(sub, `Stripe: ${s.status}`);
    case "canceled":
    case "incomplete_expired": return encerrar(sub, `Stripe: ${s.status}`);
    default: return; // incomplete / paused: aguarda o próximo aviso
  }
}

async function tratarEvento(evento) {
  const o = evento?.data?.object || {};
  switch (evento.type) {
    case "checkout.session.completed": {
      if (o.mode !== "subscription") return;
      const sub = subPorStripe(null, { subId: o.metadata?.subId || o.client_reference_id });
      if (!sub) return console.warn("[stripe] checkout sem assinatura conhecida:", o.id);
      db.prepare("UPDATE subscriptions SET stripeSubscriptionId = ?, stripeSessionId = ?, atualizadoEm = ? WHERE id = ?")
        .run(o.subscription, o.id, agora(), sub.id);
      if (o.customer) db.prepare("UPDATE companies SET stripeCustomerId = COALESCE(stripeCustomerId, ?) WHERE id = ?").run(o.customer, sub.companyId);
      // A sessão não diz se é trial; a assinatura diz.
      const s = await stripe(`/subscriptions/${o.subscription}`);
      return aplicarEstado({ ...sub, stripeSubscriptionId: o.subscription }, s);
    }
    case "invoice.paid": {
      if (!(Number(o.amount_paid) > 0)) return; // fatura zerada do início do trial
      const sub = subPorStripe(subscriptionDaFatura(o));
      if (!sub) return;
      const fim = o.lines?.data?.[0]?.period?.end;
      return liberar(sub, { status: "ativa", proximaCobranca: segParaMs(fim) });
    }
    case "invoice.payment_failed": {
      const sub = subPorStripe(subscriptionDaFatura(o));
      return inadimplente(sub, `Stripe: pagamento recusado (${o.last_finalization_error?.code || o.billing_reason || "fatura"})`);
    }
    case "customer.subscription.updated":
      return aplicarEstado(subPorStripe(o.id, o.metadata), o);
    case "customer.subscription.deleted":
      return encerrar(subPorStripe(o.id, o.metadata), "Stripe: assinatura encerrada");
    case "charge.dispute.created":
      return console.warn(`[stripe] contestação aberta: ${o.id} (${o.amount / 100} ${String(o.currency).toUpperCase()}) — responder no painel do Stripe`);
    case "charge.refunded":
      return console.warn(`[stripe] estorno: ${o.id}`);
    default:
      return;
  }
}

// Cada evento é tratado uma vez: o Stripe reentrega o mesmo aviso. Se o
// tratamento falhar, a marca sai e o Stripe tenta de novo mais tarde.
export async function processarEvento(evento) {
  if (!evento?.id || !evento?.type) return { ok: false };
  const chave = `stripe:${evento.id}`;
  const novo = db.prepare("INSERT OR IGNORE INTO gateway_events (id, evento, criadoEm) VALUES (?, ?, ?)").run(chave, evento.type, agora());
  if (novo.changes === 0) return { ok: true, duplicado: true };
  try {
    await tratarEvento(evento);
    return { ok: true };
  } catch (e) {
    db.prepare("DELETE FROM gateway_events WHERE id = ?").run(chave);
    throw e;
  }
}

if (stripeAtivo()) console.log(`[stripe] pagamento internacional ativo (modo ${modoStripe()})`);

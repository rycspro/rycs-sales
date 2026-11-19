// =============================================================================
// Parceria de Canal — motor de comissões (regras em shared/parceriaCanal.js).
//
// Fluxo do dinheiro:
//   1) cobrança de plano confirmada (webhook) ou ação liberada (taxa da RYCS)
//      → comissão constituída como "pendente" e somada ao `pendente` do
//      profissional (aparece "em análise" na Carteira);
//   2) estorno/chargeback da cobrança antes da liberação → comissão cancelada;
//   3) no 1º dia do mês seguinte → comissão liberada para o `disponivel`, com
//      registro no livro financeiro, e o repasse automático manda o Pix.
//
// Idempotência: uma comissão por cobrança/ação (UNIQUE idempotencyKey) e checagem
// por providerPaymentId — o Asaas manda RECEIVED e CONFIRMED da mesma cobrança.
// =============================================================================
import db, { uid, agora } from "../db.js";
import { notificar } from "../routes/notifications.js";
import { registrarMovimento } from "./financeiro.js";
import { codigoDoUsuario } from "./indicacoes.js";
import { reaisParaCents, centsParaReais, comissaoCents } from "../../shared/afiliados.js";
import {
  POLITICA_CANAL, NIVEIS_CANAL, percentuaisDoParceiro, comissaoMensalidade,
  liberacaoDaComissao, proximoNivelCanal, normalizarPct,
} from "../../shared/parceriaCanal.js";
import { planoDe, mesesDoCiclo } from "../../shared/planos.js";

const reais = (cents) => `R$ ${centsParaReais(cents).toFixed(2).replace(".", ",")}`;

export class ErroParceria extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function evento(commissionId, eventType, previousStatus, newStatus, dados = {}) {
  db.prepare(`INSERT INTO affiliate_commission_events (id, commissionId, eventType, previousStatus, newStatus, dados, criadoEm)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(uid(), commissionId, eventType, previousStatus, newStatus, JSON.stringify(dados), agora());
}

// Empresa → parceiro ativo que a trouxe (vínculo da indicação, permanente).
function vinculoDaEmpresa(companyId) {
  return db.prepare(`
    SELECT r.id, r.indicadorUserId, r.pagamentoEm,
           cp.pctFechamento, cp.pctRecorrencia, cp.pctUso,
           pu.entityId AS sellerId
    FROM users eu
    JOIN referrals r ON r.indicadoUserId = eu.id AND r.papelIndicado = 'empresa'
    JOIN channel_partners cp ON cp.userId = r.indicadorUserId AND cp.status = 'ativo'
    JOIN users pu ON pu.id = r.indicadorUserId AND pu.role = 'vendedor'
    WHERE eu.entityId = ? AND eu.role = 'empresa'
    LIMIT 1
  `).get(companyId) || null;
}

// Empresas da carteira com plano pago ativo — é o que define o nível.
export function empresasPagantesCanal(partnerUserId) {
  return Number(db.prepare(`
    SELECT COUNT(DISTINCT eu.entityId) AS n
    FROM referrals r
    JOIN users eu ON eu.id = r.indicadoUserId AND eu.role = 'empresa'
    JOIN subscriptions s ON s.companyId = eu.entityId AND s.status = 'ativa' AND s.plano NOT IN ('free', 'premium')
    WHERE r.indicadorUserId = ? AND r.papelIndicado = 'empresa'
  `).get(partnerUserId)?.n || 0);
}

function constituir({ v, companyId, tipo, referencia, provider, providerPaymentId, subscriptionId = null, baseCents, pct, cents, idem, dados = {} }) {
  if (!(cents > 0)) return null;
  const id = uid();
  const ins = db.prepare(`INSERT OR IGNORE INTO affiliate_commissions
    (id, affiliateUserId, companyId, subscriptionId, provider, providerPaymentId, policy, percentualSnapshot, moeda,
     baseCents, comissaoCents, status, idempotencyKey, criadoEm, disponivelEm, tipo, referencia)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BRL', ?, ?, 'pendente', ?, ?, ?, ?, ?)`)
    .run(id, v.indicadorUserId, companyId, subscriptionId, provider, String(providerPaymentId), POLITICA_CANAL, pct,
      baseCents, cents, idem, agora(), liberacaoDaComissao(agora()), tipo, String(referencia || ""));
  if (!ins.changes) return null;
  db.prepare("UPDATE sellers SET pendente = pendente + ? WHERE id = ?").run(centsParaReais(cents), v.sellerId);
  evento(id, "constituida", null, "pendente", { tipo, pct, baseCents, ...dados });
  return { id, cents };
}

// Cobrança de plano confirmada. `valor` é o efetivamente pago (com desconto de
// ciclo ou voucher); `ciclo` diz quantos meses ela cobre.
export function comissionarMensalidade({ companyId, subscriptionId = null, ciclo = "MENSAL", valor, provider = "asaas", paymentId }) {
  if (!companyId || !paymentId) return null;
  const valorCents = reaisParaCents(valor);
  if (valorCents <= 0) return null;
  const v = vinculoDaEmpresa(companyId);
  if (!v?.sellerId) return null;

  let resultado = null;
  db.transaction(() => {
    const ja = db.prepare("SELECT 1 FROM affiliate_commissions WHERE policy = ? AND provider = ? AND providerPaymentId = ?")
      .get(POLITICA_CANAL, provider, String(paymentId));
    if (ja) return;
    const jaFechou = db.prepare("SELECT 1 FROM affiliate_commissions WHERE policy = ? AND companyId = ? AND tipo = 'fechamento'")
      .get(POLITICA_CANAL, companyId);
    const primeira = !v.pagamentoEm && !jaFechou;
    const pct = percentuaisDoParceiro(v, empresasPagantesCanal(v.indicadorUserId));
    const { partes } = comissaoMensalidade({
      valorCents, meses: mesesDoCiclo(ciclo), primeira,
      pctFechamento: pct.fechamento, pctRecorrencia: pct.recorrencia,
    });
    let total = 0;
    for (const p of partes) {
      const c = constituir({
        v, companyId, tipo: p.tipo, referencia: paymentId, provider, providerPaymentId: paymentId, subscriptionId,
        baseCents: p.baseCents, pct: p.pct, cents: p.cents, idem: `canal:${provider}:${paymentId}:${p.tipo}`,
        dados: { ciclo, nivel: pct.nivel.chave },
      });
      if (c) total += c.cents;
    }
    // Marca a empresa como pagante na indicação (painéis existentes leem daqui).
    if (primeira) {
      db.prepare("UPDATE referrals SET status = 'pago', pagamentoEm = ?, qualificadoEm = COALESCE(qualificadoEm, ?) WHERE id = ?")
        .run(agora(), agora(), v.id);
    }
    resultado = { totalCents: total, primeira, nivel: pct.nivel.nome, partes };
  })();

  if (resultado?.totalCents > 0) {
    const empresa = db.prepare("SELECT nome FROM companies WHERE id = ?").get(companyId);
    notificar(v.indicadorUserId, "indicacao",
      resultado.primeira ? "Empresa da sua carteira fechou!" : "Mensalidade da sua carteira",
      `${empresa?.nome || "Uma empresa"} pagou o plano: ${reais(resultado.totalCents)} de comissão, liberados no início do próximo mês.`);
  }
  return resultado;
}

// Ação liberada: parte da taxa que a RYCS cobrou. Roda dentro da transação da
// liberação — erro aqui não pode desfazer o pagamento do profissional, então o
// chamador protege com try/catch.
export function comissionarUso({ companyId, submissionId, taxa }) {
  const taxaCents = reaisParaCents(taxa);
  if (taxaCents <= 0 || !submissionId) return null;
  const v = vinculoDaEmpresa(companyId);
  if (!v?.sellerId) return null;
  const pct = percentuaisDoParceiro(v, empresasPagantesCanal(v.indicadorUserId));
  // Transação própria (vira savepoint dentro da liberação): se falhar no meio,
  // desfaz só a comissão, nunca a liberação.
  return db.transaction(() => constituir({
    v, companyId, tipo: "uso", referencia: submissionId, provider: "rycs", providerPaymentId: submissionId,
    baseCents: taxaCents, pct: pct.uso, cents: comissaoCents(taxaCents, pct.uso), idem: `canal:uso:${submissionId}`,
  }))();
}

// Estorno ou chargeback da cobrança. Antes da liberação, cancela; depois,
// desconta do saldo disponível (até zerar) e registra o que não deu para
// recuperar no livro financeiro.
export function estornarCobrancaCanal({ provider = "asaas", paymentId, motivo = "" }) {
  if (!paymentId) return null;
  const linhas = db.prepare(`
    SELECT c.*, u.entityId AS sellerId FROM affiliate_commissions c JOIN users u ON u.id = c.affiliateUserId
    WHERE c.policy = ? AND c.provider = ? AND c.providerPaymentId = ? AND c.status IN ('pendente', 'disponivel')
  `).all(POLITICA_CANAL, provider, String(paymentId));
  if (!linhas.length) return null;

  let totalCents = 0, naoRecuperadoCents = 0;
  db.transaction(() => {
    for (const c of linhas) {
      const valor = centsParaReais(c.comissaoCents);
      if (c.status === "pendente") {
        const ok = db.prepare("UPDATE affiliate_commissions SET status = 'cancelada' WHERE id = ? AND status = 'pendente'").run(c.id).changes;
        if (!ok) continue;
        db.prepare("UPDATE sellers SET pendente = MAX(0, pendente - ?) WHERE id = ?").run(valor, c.sellerId);
        evento(c.id, "cancelada", "pendente", "cancelada", { motivo });
      } else {
        const ok = db.prepare("UPDATE affiliate_commissions SET status = 'estornada' WHERE id = ? AND status = 'disponivel'").run(c.id).changes;
        if (!ok) continue;
        const saldo = Number(db.prepare("SELECT disponivel FROM sellers WHERE id = ?").get(c.sellerId)?.disponivel) || 0;
        const desconta = Math.round(Math.min(valor, Math.max(0, saldo)) * 100) / 100;
        db.prepare("UPDATE sellers SET disponivel = disponivel - ? WHERE id = ?").run(desconta, c.sellerId);
        const nao = Math.round((valor - desconta) * 100) / 100;
        registrarMovimento({ sellerId: c.sellerId, tipo: "estorno_comissao_canal", valor: -desconta, idempotencyKey: c.id,
          dados: { motivo, companyId: c.companyId, naoRecuperado: nao } });
        evento(c.id, "estornada", "disponivel", "estornada", { motivo, naoRecuperado: nao });
        naoRecuperadoCents += reaisParaCents(nao);
      }
      totalCents += c.comissaoCents;
    }
  })();
  if (totalCents > 0) {
    notificar(linhas[0].affiliateUserId, "indicacao", "Comissão estornada",
      `O pagamento de uma empresa da sua carteira foi estornado: ${reais(totalCents)} de comissão não serão pagos.`);
  }
  if (naoRecuperadoCents > 0) console.warn(`[canal] estorno de ${paymentId}: ${reais(naoRecuperadoCents)} já tinham sido sacados pelo parceiro`);
  return { totalCents, naoRecuperadoCents };
}

// Solta para o saldo disponível as comissões cuja data de liberação chegou.
// Idempotente: a troca de status e o crédito acontecem na mesma transação.
export function liberarComissoesCanal(ts = Date.now()) {
  const linhas = db.prepare(`
    SELECT c.id, c.comissaoCents, c.companyId, c.tipo, c.affiliateUserId, u.entityId AS sellerId
    FROM affiliate_commissions c JOIN users u ON u.id = c.affiliateUserId
    WHERE c.policy = ? AND c.status = 'pendente' AND c.disponivelEm IS NOT NULL AND c.disponivelEm <= ?
  `).all(POLITICA_CANAL, ts);
  const porParceiro = new Map();
  let liberadas = 0, totalCents = 0;
  db.transaction(() => {
    for (const c of linhas) {
      const ok = db.prepare("UPDATE affiliate_commissions SET status = 'disponivel', creditadoEm = ? WHERE id = ? AND status = 'pendente'")
        .run(agora(), c.id).changes;
      if (!ok) continue;
      const valor = centsParaReais(c.comissaoCents);
      db.prepare("UPDATE sellers SET disponivel = disponivel + ?, pendente = MAX(0, pendente - ?) WHERE id = ?").run(valor, valor, c.sellerId);
      registrarMovimento({ sellerId: c.sellerId, tipo: "comissao_canal", valor, idempotencyKey: c.id, dados: { companyId: c.companyId, tipo: c.tipo } });
      evento(c.id, "liberada", "pendente", "disponivel");
      const p = porParceiro.get(c.sellerId) || { userId: c.affiliateUserId, cents: 0 };
      p.cents += c.comissaoCents;
      porParceiro.set(c.sellerId, p);
      liberadas++; totalCents += c.comissaoCents;
    }
  })();
  for (const { userId, cents } of porParceiro.values()) {
    notificar(userId, "indicacao", "Comissões da parceria liberadas", `${reais(cents)} liberados para saque.`);
  }
  return { liberadas, totalCents, sellers: [...porParceiro.keys()] };
}

export async function liberarERepassar() {
  const r = liberarComissoesCanal();
  if (!r.liberadas) return r;
  console.log(`[canal] ${r.liberadas} comissão(ões) liberada(s): ${reais(r.totalCents)}`);
  // Import tardio: payments.js importa este módulo (webhook).
  const { repassarSaldoAutomatico } = await import("../routes/payments.js");
  for (const sellerId of r.sellers) {
    await repassarSaldoAutomatico(sellerId).catch((e) => console.warn("[canal] repasse automático:", sellerId, e.message));
  }
  return r;
}

export function iniciarLiberacaoComissoesCanal() {
  const tick = () => liberarERepassar().catch((e) => console.error("[canal] liberação:", e.message));
  tick();
  setInterval(tick, 60 * 60 * 1000).unref?.();
}

// ─────────────────────────────── Leitura ────────────────────────────────

function totaisPorStatus(userId) {
  const linhas = db.prepare(`SELECT status, SUM(comissaoCents) AS cents FROM affiliate_commissions
                             WHERE policy = ? AND affiliateUserId = ? GROUP BY status`).all(POLITICA_CANAL, userId);
  const t = Object.fromEntries(linhas.map((l) => [l.status, Number(l.cents || 0)]));
  return { pendenteCents: t.pendente || 0, liberadoCents: t.disponivel || 0 };
}

function inicioDoMes(ts = Date.now()) {
  const brt = new Date(ts - 3 * 3600 * 1000);
  return Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), 1, 3, 0, 0);
}

// Painel do parceiro: carteira, nível, comissões. Só dados reais.
export function resumoParceiro(userId) {
  const p = db.prepare("SELECT * FROM channel_partners WHERE userId = ?").get(userId);
  if (!p || p.status !== "ativo") return { ativo: false };

  const pagantes = empresasPagantesCanal(userId);
  const pct = percentuaisDoParceiro(p, pagantes);
  const mesCents = Number(db.prepare(`SELECT SUM(comissaoCents) AS c FROM affiliate_commissions
    WHERE policy = ? AND affiliateUserId = ? AND status IN ('pendente', 'disponivel') AND criadoEm >= ?`)
    .get(POLITICA_CANAL, userId, inicioDoMes())?.c || 0);

  const empresas = db.prepare(`
    SELECT eu.entityId AS companyId, c.nome, c.assinatura, r.pagamentoEm, r.criadoEm,
           (SELECT s.status FROM subscriptions s WHERE s.companyId = eu.entityId ORDER BY s.criadoEm DESC LIMIT 1) AS statusAssinatura,
           (SELECT COALESCE(SUM(ac.comissaoCents), 0) FROM affiliate_commissions ac
             WHERE ac.policy = ? AND ac.affiliateUserId = r.indicadorUserId AND ac.companyId = eu.entityId
               AND ac.status IN ('pendente', 'disponivel')) AS comissaoCents
    FROM referrals r
    JOIN users eu ON eu.id = r.indicadoUserId AND eu.role = 'empresa'
    LEFT JOIN companies c ON c.id = eu.entityId
    WHERE r.indicadorUserId = ? AND r.papelIndicado = 'empresa'
    ORDER BY r.criadoEm DESC LIMIT 500
  `).all(POLITICA_CANAL, userId);

  const ultimas = db.prepare(`
    SELECT ac.id, ac.tipo, ac.status, ac.comissaoCents, ac.percentualSnapshot, ac.criadoEm, ac.disponivelEm, c.nome AS empresa
    FROM affiliate_commissions ac LEFT JOIN companies c ON c.id = ac.companyId
    WHERE ac.policy = ? AND ac.affiliateUserId = ?
    ORDER BY ac.criadoEm DESC LIMIT 30
  `).all(POLITICA_CANAL, userId);

  return {
    ativo: true,
    codigo: codigoDoUsuario(userId),
    percentuais: { fechamento: pct.fechamento, recorrencia: pct.recorrencia, uso: pct.uso },
    recorrenciaFixa: pct.recorrenciaFixa,
    nivel: { chave: pct.nivel.chave, nome: pct.nivel.nome, pct: pct.nivel.pct },
    proximoNivel: pct.recorrenciaFixa ? null : proximoNivelCanal(pagantes),
    niveis: NIVEIS_CANAL,
    pagantes,
    empresasNaCarteira: empresas.length,
    totais: { ...totaisPorStatus(userId), mesCents },
    empresas: empresas.map((e) => ({
      companyId: e.companyId,
      nome: e.nome || "Empresa",
      plano: e.assinatura ? planoDe(e.assinatura).nome : null,
      pagante: e.statusAssinatura === "ativa",
      statusAssinatura: e.statusAssinatura || null,
      comissaoCents: Number(e.comissaoCents || 0),
      desde: e.criadoEm,
    })),
    ultimas,
  };
}

// ─────────────────────────────── Admin ──────────────────────────────────

function lerPercentuais(b = {}) {
  const out = {};
  for (const k of ["pctFechamento", "pctRecorrencia", "pctUso"]) {
    if (!(k in b)) continue;
    const v = normalizarPct(b[k]);
    if (v === undefined) throw new ErroParceria(400, "Percentual inválido: use um número de 0 a 100, ou deixe vazio para o padrão.");
    out[k] = v;
  }
  return out;
}

export function listarParceiros() {
  return db.prepare(`
    SELECT cp.*, u.email, s.nome
    FROM channel_partners cp JOIN users u ON u.id = cp.userId LEFT JOIN sellers s ON s.id = u.entityId
    ORDER BY cp.criadoEm DESC
  `).all().map((p) => {
    const pagantes = empresasPagantesCanal(p.userId);
    const pct = percentuaisDoParceiro(p, pagantes);
    const empresas = Number(db.prepare("SELECT COUNT(*) AS n FROM referrals WHERE indicadorUserId = ? AND papelIndicado = 'empresa'").get(p.userId)?.n || 0);
    return {
      id: p.id, userId: p.userId, nome: p.nome || "", email: p.email, status: p.status, observacao: p.observacao || "",
      pctFechamento: p.pctFechamento, pctRecorrencia: p.pctRecorrencia, pctUso: p.pctUso,
      vigentes: { fechamento: pct.fechamento, recorrencia: pct.recorrencia, uso: pct.uso, nivel: pct.nivel.nome },
      empresas, pagantes, ...totaisPorStatus(p.userId), criadoEm: p.criadoEm,
    };
  });
}

export function ativarParceiro({ email, observacao = "", adminId = null, ...resto }) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) throw new ErroParceria(400, "Informe o e-mail da conta do parceiro.");
  const user = db.prepare("SELECT id, role FROM users WHERE lower(email) = ?").get(e);
  if (!user) throw new ErroParceria(404, "Nenhuma conta com esse e-mail. Peça para a pessoa criar a conta de profissional na RYCS primeiro.");
  if (user.role !== "vendedor") throw new ErroParceria(400, "Esse e-mail não é de uma conta de profissional. O parceiro precisa de conta de profissional para receber as comissões.");
  const pcts = lerPercentuais(resto);
  const atual = db.prepare("SELECT id FROM channel_partners WHERE userId = ?").get(user.id);
  if (atual) {
    db.prepare(`UPDATE channel_partners SET status = 'ativo', pctFechamento = ?, pctRecorrencia = ?, pctUso = ?, observacao = ?, atualizadoEm = ? WHERE id = ?`)
      .run(pcts.pctFechamento ?? null, pcts.pctRecorrencia ?? null, pcts.pctUso ?? null, String(observacao).slice(0, 500), agora(), atual.id);
  } else {
    db.prepare(`INSERT INTO channel_partners (id, userId, status, pctFechamento, pctRecorrencia, pctUso, observacao, ativadoPor, criadoEm, atualizadoEm)
                VALUES (?, ?, 'ativo', ?, ?, ?, ?, ?, ?, ?)`)
      .run(uid(), user.id, pcts.pctFechamento ?? null, pcts.pctRecorrencia ?? null, pcts.pctUso ?? null, String(observacao).slice(0, 500), adminId, agora(), agora());
  }
  codigoDoUsuario(user.id); // garante o código/link de indicação
  db.prepare("UPDATE channel_partner_requests SET status = 'aprovado', atualizadoEm = ? WHERE lower(email) = ? AND status = 'novo'").run(agora(), e);
  notificar(user.id, "indicacao", "Você agora é Parceiro de Canal da RYCS",
    "As empresas que você trouxer passam a render fechamento, recorrência mensal e uso. Acompanhe em Indicar.");
  return listarParceiros().find((p) => p.userId === user.id);
}

export function atualizarParceiro(id, b = {}) {
  const p = db.prepare("SELECT * FROM channel_partners WHERE id = ?").get(id);
  if (!p) throw new ErroParceria(404, "Parceiro não encontrado.");
  const pcts = lerPercentuais(b);
  const status = b.status === undefined ? p.status : (["ativo", "inativo"].includes(b.status) ? b.status : null);
  if (!status) throw new ErroParceria(400, "Status inválido.");
  db.prepare(`UPDATE channel_partners SET status = ?, pctFechamento = ?, pctRecorrencia = ?, pctUso = ?, observacao = ?, atualizadoEm = ? WHERE id = ?`)
    .run(status,
      "pctFechamento" in pcts ? pcts.pctFechamento : p.pctFechamento,
      "pctRecorrencia" in pcts ? pcts.pctRecorrencia : p.pctRecorrencia,
      "pctUso" in pcts ? pcts.pctUso : p.pctUso,
      b.observacao === undefined ? p.observacao : String(b.observacao).slice(0, 500),
      agora(), id);
  return listarParceiros().find((x) => x.id === id);
}

// ─────────────────────────── Pedidos de parceria ────────────────────────
// Formulário público de rycs.pro/parceiros. Guarda o pedido e avisa os
// admins; quem ativa o parceiro continua sendo o admin (precisa de conta de
// profissional para receber as comissões).

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const texto = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function registrarPedidoParceria(b = {}) {
  // Campo escondido: gente não preenche, robô preenche. Responde ok e descarta.
  if (texto(b.site, 200)) return { ok: true };

  const nome = texto(b.nome, 120);
  const email = texto(b.email, 160).toLowerCase();
  const whats = String(b.whats ?? "").replace(/\D/g, "").slice(0, 15);
  const cidade = texto(b.cidade, 120);
  const segmento = texto(b.segmento, 160);
  const mensagem = String(b.mensagem ?? "").trim().slice(0, 1000);
  const baseNum = b.base === "" || b.base === null || b.base === undefined ? null : Math.trunc(Number(String(b.base).replace(/\D/g, "")));

  if (nome.length < 2) throw new ErroParceria(400, "Informe seu nome.");
  if (!EMAIL_OK.test(email)) throw new ErroParceria(400, "Informe um e-mail válido.");
  if (whats.length < 10 || whats.length > 13) throw new ErroParceria(400, "Informe o WhatsApp com DDD.");
  if (baseNum !== null && (!Number.isFinite(baseNum) || baseNum < 0 || baseNum > 10000000))
    throw new ErroParceria(400, "Informe quantos contatos você tem, só com números.");

  let origem = "{}";
  try { origem = JSON.stringify(b.origem && typeof b.origem === "object" ? b.origem : {}).slice(0, 2000); } catch { origem = "{}"; }
  const visitanteId = /^[A-Za-z0-9_-]{8,64}$/.test(String(b.visitanteId || "")) ? String(b.visitanteId) : "";

  // Mesmo e-mail com pedido em aberto: atualiza em vez de duplicar, e só
  // avisa o admin de novo se o anterior tem mais de um dia.
  const aberto = db.prepare("SELECT * FROM channel_partner_requests WHERE email = ? AND status = 'novo' ORDER BY criadoEm DESC LIMIT 1").get(email);
  if (aberto) {
    db.prepare(`UPDATE channel_partner_requests SET nome = ?, whats = ?, cidade = ?, base = ?, segmento = ?, mensagem = ?, atualizadoEm = ? WHERE id = ?`)
      .run(nome, whats, cidade, baseNum, segmento, mensagem, agora(), aberto.id);
    if (agora() - (aberto.atualizadoEm || aberto.criadoEm) < 86400000) return { ok: true };
  } else {
    db.prepare(`INSERT INTO channel_partner_requests (id, nome, email, whats, cidade, base, segmento, mensagem, visitanteId, origem, status, criadoEm, atualizadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'novo', ?, ?)`)
      .run(uid(), nome, email, whats, cidade, baseNum, segmento, mensagem, visitanteId, origem, agora(), agora());
  }

  const base = baseNum !== null ? ` · ${baseNum.toLocaleString("pt-BR")} contatos na base` : "";
  for (const admin of db.prepare("SELECT id FROM users WHERE role = 'admin'").all()) {
    notificar(admin.id, "indicacao", "Novo pedido de parceria",
      `${nome} quer ser parceiro de canal${base}. Contato: ${email} · ${whats}. Veja em Parceiros de canal.`);
  }
  return { ok: true };
}

export function listarPedidosParceria() {
  return db.prepare(`
    SELECT r.*, (SELECT u.role FROM users u WHERE lower(u.email) = r.email LIMIT 1) AS papelConta
    FROM channel_partner_requests r
    ORDER BY CASE r.status WHEN 'novo' THEN 0 ELSE 1 END, r.criadoEm DESC
    LIMIT 300
  `).all().map((r) => ({
    id: r.id, nome: r.nome, email: r.email, whats: r.whats, cidade: r.cidade, base: r.base,
    segmento: r.segmento, mensagem: r.mensagem, status: r.status, criadoEm: r.criadoEm,
    // Se já existe conta com o e-mail e de que tipo: é o que decide se dá para ativar.
    conta: r.papelConta || null,
  }));
}

export function atualizarPedidoParceria(id, status) {
  if (!["novo", "arquivado"].includes(status)) throw new ErroParceria(400, "Status inválido.");
  const ok = db.prepare("UPDATE channel_partner_requests SET status = ?, atualizadoEm = ? WHERE id = ?").run(status, agora(), id).changes;
  if (!ok) throw new ErroParceria(404, "Pedido não encontrado.");
  return { ok: true };
}

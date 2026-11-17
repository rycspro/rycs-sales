// Planos do profissional: leitura do plano em vigor, eventos do Asaas e cotas.
// Regras puras (permissões, período, cota) ficam em shared/planosProfissional.js.

import db, { agora } from "../db.js";
import { notificar } from "../routes/notifications.js";
import {
  planoDoProfissional, estenderPeriodo, limite, periodoDaCota, avaliarConsumo, PLANOS_PROFISSIONAL,
} from "../../shared/planosProfissional.js";

// Cobrança real só com a variável ligada. Sem ela a vitrine mostra "em breve".
export const cobrancaProfissionalAtiva = () => process.env.PLANOS_PROFISSIONAL_ATIVO === "1";

export const assinaturasDoProfissional = (sellerId) =>
  db.prepare("SELECT * FROM assinaturas_profissional WHERE sellerId = ? ORDER BY criadoEm DESC").all(sellerId);

export function planoAtual(sellerId, momento = agora()) {
  return planoDoProfissional(assinaturasDoProfissional(sellerId), momento);
}

// Plano em vigor de vários profissionais de uma vez (lista da empresa).
export function planosAtuais(momento = agora()) {
  const porSeller = new Map();
  for (const a of db.prepare("SELECT * FROM assinaturas_profissional WHERE pagoAte > ?").all(momento - 400 * 86_400_000)) {
    if (!porSeller.has(a.sellerId)) porSeller.set(a.sellerId, []);
    porSeller.get(a.sellerId).push(a);
  }
  const r = new Map();
  for (const [id, lista] of porSeller) r.set(id, planoDoProfissional(lista, momento).plano);
  return r;
}

const usuarioDoVendedor = (sellerId) => db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sellerId);
function avisar(sellerId, titulo, corpo = "") {
  const u = usuarioDoVendedor(sellerId);
  if (u) notificar(u.id, "plano", titulo, corpo);
}

const dataDoAsaas = (s) => {
  const t = s ? Date.parse(`${String(s).slice(0, 10)}T12:00:00Z`) : NaN;
  return Number.isFinite(t) ? t : null;
};

// Evento do webhook do Asaas para cobrança de plano do profissional
// (externalReference "prof:<assinaturaId>"). Devolve o que foi feito.
export function tratarEventoProfissional(event, payment) {
  const id = String(payment?.externalReference || "").slice("prof:".length);
  const a = id && db.prepare("SELECT * FROM assinaturas_profissional WHERE id = ?").get(id);
  if (!a) { console.warn("[webhook] plano profissional sem assinatura:", payment?.externalReference); return "sem_assinatura"; }
  const nome = PLANOS_PROFISSIONAL[a.plano]?.nome || a.plano;
  const t = agora();

  if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
    // RECEIVED e CONFIRMED chegam para o mesmo pagamento: estende uma vez só.
    if (a.ultimoPaymentId && a.ultimoPaymentId === payment.id) return "ja_processado";
    if (a.status === "reembolsada") return "ignorado";
    const venc = dataDoAsaas(payment.dueDate) || t;
    const pagoAte = estenderPeriodo(a.pagoAte, venc);
    const status = a.status === "cancelada" ? "cancelada" : "ativa";
    db.prepare(`UPDATE assinaturas_profissional SET status = ?, pagoAte = ?, inicio = COALESCE(inicio, ?),
      ultimoPaymentId = ?, valor = COALESCE(?, valor), proximaCobranca = ?, atualizadoEm = ? WHERE id = ?`)
      .run(status, pagoAte, t, payment.id, Number(payment.value) || null, pagoAte, t, a.id);
    avisar(a.sellerId, `Plano ${nome} ativo`, `Seu plano vale até ${new Date(pagoAte).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`);
    return "ativada";
  }

  if (["PAYMENT_OVERDUE", "PAYMENT_REFUSED", "PAYMENT_DECLINED", "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"].includes(event)) {
    if (!["ativa", "pendente"].includes(a.status)) return "ignorado";
    db.prepare("UPDATE assinaturas_profissional SET status = 'atrasada', atualizadoEm = ? WHERE id = ?").run(t, a.id);
    avisar(a.sellerId, `Pagamento do plano ${nome} em aberto`, "Pague o Pix da renovação para manter os benefícios. Seu acesso para trabalhar e sacar continua igual.");
    return "atrasada";
  }

  if (event === "PAYMENT_REFUNDED" || event === "PAYMENT_CHARGEBACK_REQUESTED") {
    db.prepare("UPDATE assinaturas_profissional SET status = 'reembolsada', motivo = ?, atualizadoEm = ? WHERE id = ?")
      .run(event === "PAYMENT_REFUNDED" ? "reembolso" : "contestação (chargeback)", t, a.id);
    avisar(a.sellerId, `Plano ${nome} encerrado`, "O pagamento foi devolvido e os benefícios do plano foram desligados.");
    return "reembolsada";
  }

  if (event === "PAYMENT_DELETED") {
    if (a.pagoAte) return "ignorado";
    db.prepare("UPDATE assinaturas_profissional SET status = 'expirada', atualizadoEm = ? WHERE id = ?").run(t, a.id);
    return "expirada";
  }
  return "ignorado";
}

// Consome cota mensal (minutos de discadora, lembretes). Recusa ANTES de
// gastar. Avisa uma vez a 80% e uma vez a 100% no mês.
export function consumirCota(sellerId, recurso, qtd = 1, momento = agora()) {
  const plano = planoAtual(sellerId, momento).plano;
  const lim = limite(plano, recurso);
  const periodo = periodoDaCota(momento);
  const resultado = db.transaction(() => {
    const atual = db.prepare("SELECT * FROM uso_profissional WHERE sellerId = ? AND recurso = ? AND periodo = ?").get(sellerId, recurso, periodo)
      || { usado: 0, avisado80: 0, avisado100: 0 };
    const r = avaliarConsumo({ limite: lim, usado: atual.usado, qtd, avisado80: !!atual.avisado80, avisado100: !!atual.avisado100 });
    if (!r.ok) return r;
    db.prepare(`INSERT INTO uso_profissional (sellerId, recurso, periodo, usado, avisado80, avisado100) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(sellerId, recurso, periodo) DO UPDATE SET usado = excluded.usado, avisado80 = excluded.avisado80, avisado100 = excluded.avisado100`)
      .run(sellerId, recurso, periodo, r.usado, atual.avisado80 || r.aviso === 80 || r.aviso === 100 ? 1 : 0, atual.avisado100 || r.aviso === 100 ? 1 : 0);
    return r;
  })();
  if (resultado.aviso === 80) avisar(sellerId, "Você usou 80% da cota do mês", `Restam ${resultado.restante} de ${resultado.limite} neste mês.`);
  if (resultado.aviso === 100) avisar(sellerId, "Cota do mês esgotada", "A cota volta no início do próximo mês.");
  return { ...resultado, plano, periodo };
}

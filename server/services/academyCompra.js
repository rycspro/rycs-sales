// Compra avulsa de curso da Academy: Pix único pelo Asaas.
//
// A cobrança nasce aqui com externalReference "curso:<compraId>". A matrícula
// só é criada quando o webhook confirma o pagamento (tratarEventoCurso). Nada
// neste arquivo libera curso sem dinheiro confirmado.

import db, { uid, agora } from "../db.js";
import { asaas, asaasAtivo, garantirClienteProfissional } from "./asaas.js";
import { cpfValido } from "./regras.js";
import { notificar } from "../routes/notifications.js";
import { acessoAoCurso } from "./academy.js";

const PREFIXO = "curso:";
const VALIDADE_PIX_MS = 86_400_000;

function avisar(sellerId, titulo, corpo) {
  const u = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sellerId);
  if (u) notificar(u.id, "academy", titulo, corpo);
}

async function pixDaCobranca(asaasId) {
  const cobranca = await asaas(`/payments/${asaasId}`);
  let pix = null;
  try { pix = await asaas(`/payments/${asaasId}/pixQrCode`); }
  catch (e) { console.warn("[academy] QR Pix indisponível:", e.message); }
  return {
    paymentId: cobranca.id, valor: cobranca.value, vencimento: cobranca.dueDate,
    qrCode: pix?.encodedImage || null, copiaECola: pix?.payload || null, invoiceUrl: cobranca.invoiceUrl || null,
  };
}

const falha = (status, error, codigo) => ({ status, corpo: { error, ...(codigo ? { codigo } : {}) } });

// Devolve { status, corpo } para a rota responder.
export async function comprarCurso({ courseId, sellerId, cpf }) {
  const curso = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId);
  if (!curso || curso.status !== "publicado") return falha(404, "Curso não encontrado.");
  if (!db.prepare("SELECT 1 FROM course_lessons WHERE courseId = ? LIMIT 1").get(courseId))
    return falha(409, "Este curso está em preparação.");
  if (curso.gratuito) return falha(409, "Este curso é gratuito. Basta começar.");
  const valor = Number(curso.preco) || 0;
  if (valor <= 0) return falha(409, "Este curso ainda não tem preço definido.");
  if (acessoAoCurso({ curso, sellerId }).acesso) return falha(409, "Você já tem acesso a este curso.");
  if (!asaasAtivo()) return falha(503, "Pagamento indisponível no momento. Tente mais tarde.");

  // Pix em aberto do mesmo curso e mesmo valor: devolve o mesmo.
  const aberta = db.prepare(`SELECT * FROM course_purchases WHERE courseId = ? AND sellerId = ? AND status = 'pendente'
    ORDER BY criadoEm DESC LIMIT 1`).get(courseId, sellerId);
  if (aberta?.asaasId && aberta.valor === valor && agora() - aberta.criadoEm < VALIDADE_PIX_MS) {
    try { return { status: 200, corpo: { compra: { id: aberta.id, valor }, pix: await pixDaCobranca(aberta.asaasId) } }; }
    catch { /* cobrança sumiu no Asaas: cria outra abaixo */ }
  }

  const vendedor = db.prepare("SELECT * FROM sellers WHERE id = ?").get(sellerId);
  if (!vendedor) return falha(404, "Profissional não encontrado.");

  // CPF informado na compra: só preenche quem ainda não tem documento.
  if (!vendedor.documento && !vendedor.asaasCustomerId) {
    const doc = String(cpf || "").replace(/\D/g, "");
    if (!doc) return falha(400, "Informe o seu CPF para pagar o curso.", "FALTA_DOCUMENTO");
    if (!cpfValido(doc)) return falha(400, "CPF inválido. Confira os números.", "CPF_INVALIDO");
    db.prepare("UPDATE sellers SET documento = ? WHERE id = ? AND (documento IS NULL OR documento = '')").run(doc, sellerId);
    vendedor.documento = doc;
  }

  let customer;
  try { customer = await garantirClienteProfissional(db, vendedor); }
  catch (e) {
    if (e.faltaDocumento) return falha(400, "Informe o seu CPF para pagar o curso.", "FALTA_DOCUMENTO");
    return falha(502, "Não foi possível registrar você no meio de pagamento.");
  }

  if (aberta) db.prepare("UPDATE course_purchases SET status = 'expirada', atualizadoEm = ? WHERE id = ?").run(agora(), aberta.id);

  const id = uid();
  const t = agora();
  db.prepare(`INSERT INTO course_purchases (id, courseId, sellerId, valor, status, asaasCustomerId, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?, 'pendente', ?, ?, ?)`).run(id, courseId, sellerId, valor, customer, t, t);

  try {
    const cobranca = await asaas("/payments", {
      method: "POST",
      body: {
        customer,
        billingType: "PIX",
        value: valor,
        dueDate: new Date(Date.now() + VALIDADE_PIX_MS).toISOString().split("T")[0],
        description: `RYCS Academy — ${curso.titulo}`,
        externalReference: `${PREFIXO}${id}`,
      },
    });
    db.prepare("UPDATE course_purchases SET asaasId = ?, atualizadoEm = ? WHERE id = ?").run(cobranca.id, agora(), id);
    return { status: 201, corpo: { compra: { id, valor }, pix: await pixDaCobranca(cobranca.id) } };
  } catch (e) {
    console.error("[academy] falha ao gerar Pix do curso:", e.message);
    db.prepare("UPDATE course_purchases SET status = 'expirada', atualizadoEm = ? WHERE id = ?").run(agora(), id);
    return falha(502, "Não foi possível gerar o Pix agora. Tente de novo em instantes.");
  }
}

export const ehEventoDeCurso = (payment) => String(payment?.externalReference || "").startsWith(PREFIXO);

// Webhook do Asaas para compra de curso. Devolve o que foi feito.
export function tratarEventoCurso(event, payment) {
  const id = String(payment?.externalReference || "").slice(PREFIXO.length);
  const c = id && db.prepare("SELECT * FROM course_purchases WHERE id = ?").get(id);
  if (!c) { console.warn("[webhook] compra de curso não encontrada:", payment?.externalReference); return "sem_compra"; }
  const titulo = db.prepare("SELECT titulo FROM courses WHERE id = ?").get(c.courseId)?.titulo || "o curso";
  const t = agora();

  if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
    if (c.status === "paga") return "ja_processado";
    if (c.status === "reembolsada") return "ignorado";
    db.transaction(() => {
      db.prepare("UPDATE course_purchases SET status = 'paga', pagoEm = ?, valor = COALESCE(?, valor), atualizadoEm = ? WHERE id = ?")
        .run(t, Number(payment.value) || null, t, c.id);
      const m = db.prepare("SELECT id FROM course_enrollments WHERE courseId = ? AND sellerId = ?").get(c.courseId, c.sellerId);
      if (m) db.prepare("UPDATE course_enrollments SET origem = 'compra' WHERE id = ?").run(m.id);
      else db.prepare("INSERT INTO course_enrollments (id, courseId, sellerId, origem, criadoEm) VALUES (?, ?, ?, 'compra', ?)")
        .run(uid(), c.courseId, c.sellerId, t);
    })();
    avisar(c.sellerId, "Curso liberado", `Pagamento confirmado. "${titulo}" já está disponível na sua Academy.`);
    return "paga";
  }

  if (event === "PAYMENT_REFUNDED" || event === "PAYMENT_CHARGEBACK_REQUESTED") {
    db.transaction(() => {
      db.prepare("UPDATE course_purchases SET status = 'reembolsada', atualizadoEm = ? WHERE id = ?").run(t, c.id);
      // Progresso fica guardado; só o acesso sai.
      db.prepare("UPDATE course_enrollments SET origem = 'reembolsado' WHERE courseId = ? AND sellerId = ? AND origem = 'compra'")
        .run(c.courseId, c.sellerId);
    })();
    avisar(c.sellerId, "Compra de curso devolvida", `O pagamento de "${titulo}" foi devolvido e o acesso ao curso foi encerrado.`);
    return "reembolsada";
  }

  if (event === "PAYMENT_DELETED" || event === "PAYMENT_OVERDUE") {
    if (c.status !== "pendente") return "ignorado";
    db.prepare("UPDATE course_purchases SET status = 'expirada', atualizadoEm = ? WHERE id = ?").run(t, c.id);
    return "expirada";
  }
  return "ignorado";
}

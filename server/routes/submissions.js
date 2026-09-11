import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { recalcularScore } from "../services/score.js";
import { emailStatusAcao } from "../services/email.js";
import { takeRateDoPlano } from "../../shared/planos.js";
import { recalcularCompanyScore } from "../services/companyScore.js";
import { auditar, statusDoVeredito } from "../services/auditoria.js";
import { qualificarIndicacao } from "../services/indicacoes.js";
import { reservarParaSubmissao, cancelarReserva, liquidarSubmissao, posicaoEmpresa } from "../services/financeiro.js";
import { exigirOportunidadesLiberadas } from "../services/acessoProfissional.js";
import { dadosAgendamentoCorrespondemAoLead } from "../../shared/agendamento.js";
import { calcularValorTarefa } from "../../shared/valorTarefa.js";
import { avaliarRegras } from "../../shared/aprovacoes.js";
import { registrarEventoAuditoria, registrarEvidencias, verificarTrilhaAuditoria, resumoEvidencias } from "../services/auditTrail.js";

const router = Router();

router.post("/submissions", async (req, res) => {
  const { sellerId, companyId, campaignId, tipo, prova, leadId, idempotencyKey } = req.body;
  const { role, entityId } = req.user;

  if (role === "vendedor" && entityId !== sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (!exigirOportunidadesLiberadas(req, res, sellerId)) return;
  if (!tipo || !companyId) return res.status(400).json({ error: "tipo e companyId são obrigatórios" });

  if (idempotencyKey) {
    const anterior = db.prepare("SELECT * FROM submissions WHERE sellerId = ? AND idempotencyKey = ?").get(sellerId, idempotencyKey);
    if (anterior) return res.json({ id: anterior.id, status: anterior.status, valor: anterior.valor, duplicado: true });
  }

  const empresa = db.prepare("SELECT comissoes, assinatura, saldo, saldoReservado, regrasAprovacao FROM companies WHERE id = ?").get(companyId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

  let campanha = null;
  if (campaignId) {
    campanha = db.prepare("SELECT * FROM campaigns WHERE id = ? AND companyId = ?").get(campaignId, companyId);
    if (!campanha) return res.status(404).json({ error: "Campanha não encontrada" });
    if (campanha.status !== "ativa") return res.status(422).json({ error: "Campanha não está ativa" });
    const vinculo = db.prepare("SELECT status FROM applications WHERE sellerId = ? AND companyId = ?").get(sellerId, companyId);
    if (vinculo?.status !== "aprovado") return res.status(403).json({ error: "Profissional não aprovado nesta empresa" });
    if (tipo === "agendamento") {
      if (!leadId) return res.status(400).json({ error: "Selecione o lead da reunião agendada" });
      const lead = db.prepare(
        "SELECT id, nome, telefone FROM leads WHERE id = ? AND sellerId = ? AND companyId = ? AND campaignId = ?"
      ).get(leadId, sellerId, companyId, campaignId);
      if (!lead) return res.status(422).json({ error: "Lead não pertence a esta campanha e profissional" });
      if (!dadosAgendamentoCorrespondemAoLead(prova, lead))
        return res.status(422).json({ error: "Nome e telefone da comprovação devem corresponder ao lead selecionado" });
    }
  }

  // O valor vem da tabela da empresa, não do corpo da requisição. Aceitar o
  // valor enviado pelo cliente deixaria o vendedor definir quanto vale a
  // própria ação.
  const comissoes = campanha ? JSON.parse(campanha.tarefas || "{}") : JSON.parse(empresa.comissoes || "{}");
  const valor = Number(comissoes[tipo]);
  if (!Number.isFinite(valor) || valor <= 0)
    return res.status(400).json({ error: "Esta empresa não remunera este tipo de ação." });

  // A auditoria roda ANTES de gravar. Auditar depois faria o motor encontrar a
  // própria ação recém-inserida no histórico e acusar repetição consigo mesma.
  const r = await auditar({ tipo, prova, sellerId, companyId, leadId });
  const { taxa, liquido } = calcularValorTarefa(valor, empresa.assinatura);
  const totalDebito = +valor.toFixed(2);

  // Regras da empresa podem dispensar a conferência manual. O que elas NÃO
  // fazem é liberar dinheiro: a ação vai para "conferido", o mesmo estado de
  // quem foi conferido à mão, e o repasse continua com a plataforma.
  let regras = {};
  try { regras = JSON.parse(empresa.regrasAprovacao || "{}"); } catch { regras = {}; }
  const decisao = avaliarRegras({ regras, tipo, valor, confianca: r.confianca, veredito: r.veredito, risco: r.risco });
  const status = decisao.automatica ? "conferido" : statusDoVeredito(r.veredito);

  const id = uid();
  try { db.transaction(() => {
    db.prepare(`
      INSERT INTO submissions (id, sellerId, companyId, campaignId, leadId, tipo, valor, liquido, prova, status, confianca, motivo, fonte, idempotencyKey, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sellerId, companyId, campaignId || null, leadId || null, tipo, valor,
           liquido, JSON.stringify(prova || {}), status, r.confianca, r.motivo, r.fonte, idempotencyKey || null, agora());
    // Recusada não fica pendente: não há o que esperar.
    if (status !== "ia_recusado") {
      reservarParaSubmissao({ companyId, sellerId, submissionId: id, valor: totalDebito });
      db.prepare("UPDATE sellers SET pendente = pendente + ? WHERE id = ?").run(liquido, sellerId);
    }

    // Trilha encadeada: o envio, as evidências e a decisão viram eventos com
    // hash ligado ao anterior. É o que permite provar depois que a decisão não
    // foi editada — inclusive contra a própria plataforma.
    registrarEventoAuditoria({
      submissionId: id, tipo: "envio", actorId: req.user.id, actorRole: role,
      statusNovo: "enviado", dados: { acao: tipo, valor, campaignId: campaignId || null, leadId: leadId || null },
    });
    registrarEvidencias({ submissionId: id, prova: prova || {}, actorId: req.user.id });
    registrarEventoAuditoria({
      submissionId: id,
      tipo: decisao.automatica ? "decisao_automatica" : "triagem",
      actorRole: "sistema",
      statusAnterior: "enviado", statusNovo: status,
      motivoCodigo: r.fonte || "regras_internas",
      observacao: decisao.automatica ? decisao.motivo : r.motivo,
      dados: { confianca: r.confianca, veredito: r.veredito, regras: decisao.regras, automatica: decisao.automatica },
    });
  })(); } catch (err) {
    if (campaignId && /Caixa disponível insuficiente/.test(err.message))
      db.prepare("UPDATE campaigns SET status = 'pausada' WHERE id = ?").run(campaignId);
    return res.status(422).json({ error: err.message });
  }

  if (status === "ia_recusado") recalcularScore(sellerId);
  recalcularCompanyScore(companyId);

  res.json({ id, status, confianca: r.confianca, motivo: r.motivo, fonte: r.fonte, valor,
             automatica: decisao.automatica, regraAplicada: decisao.motivo });
});

router.patch("/submissions/:id", (req, res) => {
  const { id } = req.params;
  const { role, entityId } = req.user;

  const sub = db.prepare("SELECT * FROM submissions WHERE id = ?").get(id);
  if (!sub) return res.status(404).json({ error: "Submissão não encontrada" });

  if (role === "vendedor" && entityId !== sub.sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (role === "empresa" && entityId !== sub.companyId)
    return res.status(403).json({ error: "Sem permissão" });

  // Um vendedor não decide o destino da própria ação, e ninguém marca
  // "liberado" por aqui: isso move dinheiro e só acontece em /liberar.
  if (role === "vendedor") return res.status(403).json({ error: "Sem permissão" });
  if (req.body.status === "liberado")
    return res.status(400).json({ error: "Use POST /submissions/:id/liberar" });

  const fields = req.body;
  const allowed = ["status", "confianca", "motivo", "fonte"];
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (!sets.length) return res.status(400).json({ error: "nenhum campo válido" });
  vals.push(id);
  db.transaction(() => {
    db.prepare(`UPDATE submissions SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
    if (["recusado", "ia_recusado"].includes(fields.status) && !["recusado", "ia_recusado"].includes(sub.status)) {
      const empresa = db.prepare("SELECT assinatura FROM companies WHERE id = ?").get(sub.companyId);
      const novoModelo = sub.liquido != null;
      const liquido = novoModelo ? Number(sub.liquido) : Number(sub.valor || 0);
      const totalDebito = novoModelo ? Number(sub.valor || 0) : +(liquido * (1 + takeRateDoPlano(empresa?.assinatura))).toFixed(2);
      cancelarReserva({ companyId: sub.companyId, sellerId: sub.sellerId, submissionId: sub.id, valor: totalDebito, motivo: fields.motivo });
      db.prepare("UPDATE sellers SET pendente = MAX(0, pendente - ?) WHERE id = ?").run(liquido, sub.sellerId);
    }
    if (fields.status && fields.status !== sub.status) {
      registrarEventoAuditoria({
        submissionId: sub.id, tipo: "decisao_manual", actorId: req.user.id, actorRole: role,
        statusAnterior: sub.status, statusNovo: fields.status,
        motivoCodigo: "conferencia_humana", observacao: fields.motivo || "",
      });
    }
  })();

  if (fields.status && fields.status !== sub.status) {
    const sellerUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sub.sellerId);
    const seller = db.prepare("SELECT nome, email FROM sellers WHERE id = ?").get(sub.sellerId);
    const labels = { liberado: "aprovada", recusado: "recusada", revisao: "enviada para revisão", ia_aprovado: "pré-aprovada pela IA", conferido: "conferida" };
    if (sellerUser && labels[fields.status]) {
      notificar(sellerUser.id, "submissao", `Ação ${labels[fields.status]}`, fields.motivo || "");
    }

    if (seller && ["liberado", "recusado"].includes(fields.status)) {
      emailStatusAcao(seller.nome, seller.email, sub.tipo, fields.status);
    }

    if (fields.status === "liberado" || fields.status === "recusado") {
      recalcularScore(sub.sellerId);
    }
    recalcularCompanyScore(sub.companyId);
  }

  res.json({ ok: true });
});

// Contestar uma recusa da IA é o único caminho pelo qual o vendedor mexe na
// própria ação. Não move dinheiro: só devolve para conferência humana.
router.post("/submissions/:id/contestar", (req, res) => {
  const { role, entityId } = req.user;
  const sub = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!sub) return res.status(404).json({ error: "Ação não encontrada" });
  if (role === "vendedor" && entityId !== sub.sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (!["ia_recusado", "recusado"].includes(sub.status))
    return res.status(400).json({ error: "Só ações recusadas podem ser contestadas" });

  const motivo = `Vendedor contestou e pediu revisão humana. Motivo original da IA: ${sub.motivo || "—"}`;
  const empresa = db.prepare("SELECT assinatura FROM companies WHERE id = ?").get(sub.companyId);
  const novoModelo = sub.liquido != null;
  const liquido = novoModelo ? Number(sub.liquido) : Number(sub.valor || 0);
  const totalDebito = novoModelo ? Number(sub.valor || 0) : +(liquido * (1 + takeRateDoPlano(empresa?.assinatura))).toFixed(2);
  try { db.transaction(() => {
    reservarParaSubmissao({ companyId: sub.companyId, sellerId: sub.sellerId, submissionId: sub.id, valor: totalDebito });
    db.prepare("UPDATE submissions SET status = 'revisao', motivo = ? WHERE id = ?").run(motivo, sub.id);
    db.prepare("UPDATE sellers SET pendente = pendente + ? WHERE id = ?").run(liquido, sub.sellerId);
    registrarEventoAuditoria({
      submissionId: sub.id, tipo: "contestacao", actorId: req.user.id, actorRole: role,
      statusAnterior: sub.status, statusNovo: "revisao",
      motivoCodigo: "contestacao_profissional", observacao: motivo,
    });
  })(); } catch (err) { return res.status(422).json({ error: err.message }); }

  const empUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(sub.companyId);
  if (empUser) notificar(empUser.id, "submissao", "Ação contestada", "Um profissional pediu revisão humana.");

  res.json({ ok: true });
});

// Liberar uma ação move dinheiro: debita o caixa da empresa, credita o
// vendedor e registra o take rate. Tudo numa transação, no servidor — o
// cliente não envia valores, apenas o id da ação.
router.post("/submissions/:id/liberar", (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Apenas a plataforma pode liberar" });

  const sub = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!sub) return res.status(404).json({ error: "Ação não encontrada" });
  if (sub.status === "liberado") return res.status(409).json({ error: "Ação já liberada" });
  if (!["ia_aprovado", "conferido", "revisao"].includes(sub.status))
    return res.status(400).json({ error: "Ação não está pronta para liberação" });

  const empresa = db.prepare("SELECT saldo, assinatura FROM companies WHERE id = ?").get(sub.companyId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

  const bruto = +(sub.valor || 0).toFixed(2);
  if (bruto <= 0) return res.status(400).json({ error: "Valor da ação inválido" });
  const posicao = posicaoEmpresa(sub.companyId);
  if (posicao.saldo < bruto || posicao.reservado < bruto)
    return res.status(400).json({ error: "Reserva financeira da ação não está disponível" });

  // O take rate vem do plano contratado — é o que torna a assinatura
  // vantajosa para quem opera volume.
  const novoModelo = sub.liquido != null;
  const calculo = calcularValorTarefa(bruto, empresa.assinatura);
  const taxa = novoModelo ? +(bruto - Number(sub.liquido)).toFixed(2) : calculo.taxa;
  const liquido = novoModelo ? Number(sub.liquido) : bruto;
  const totalDebito = novoModelo ? bruto : +(bruto + taxa).toFixed(2);
  if (posicao.saldo < totalDebito || posicao.reservado < totalDebito)
    return res.status(400).json({ error: "Reserva financeira da ação e da taxa não está disponível" });

  db.transaction(() => {
    db.prepare("UPDATE submissions SET status = 'liberado', liquido = ? WHERE id = ?").run(liquido, sub.id);
    liquidarSubmissao({ companyId: sub.companyId, sellerId: sub.sellerId, submissionId: sub.id, bruto, taxa, liquido, totalDebito });
    db.prepare(`INSERT INTO platform_earnings (id, submissionId, companyId, sellerId, bruto, taxa, liquido, criadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uid(), sub.id, sub.companyId, sub.sellerId, bruto, taxa, liquido, agora());
    registrarEventoAuditoria({
      submissionId: sub.id, tipo: "liberacao", actorId: req.user.id, actorRole: "admin",
      statusAnterior: sub.status, statusNovo: "liberado",
      motivoCodigo: "repasse_plataforma",
      dados: { bruto, taxa, liquido, totalDebito },
    });
  })();

  const sellerUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sub.sellerId);
  if (sellerUser) notificar(sellerUser.id, "submissao", "Ação aprovada", `R$ ${liquido.toFixed(2)} liberados para saque.`);
  const seller = db.prepare("SELECT nome, email FROM sellers WHERE id = ?").get(sub.sellerId);
  if (seller) emailStatusAcao(seller.nome, seller.email, sub.tipo, "liberado");
  recalcularScore(sub.sellerId);
  recalcularCompanyScore(sub.companyId);
  // Primeira ação aprovada é o gatilho da recompensa de quem indicou.
  if (sellerUser) qualificarIndicacao(sellerUser.id);

  res.json({ ok: true, bruto, taxa, liquido, totalDebito });
});

// Trilha de auditoria de uma ação: quem decidiu o quê, quando, com qual regra
// e com qual confiança. A integridade é verificada na hora — se a cadeia de
// hashes tiver sido quebrada, a resposta diz isso em vez de esconder.
router.get("/submissions/:id/trilha", (req, res) => {
  const { role, entityId } = req.user;
  const sub = db.prepare("SELECT id, sellerId, companyId FROM submissions WHERE id = ?").get(req.params.id);
  if (!sub) return res.status(404).json({ error: "Ação não encontrada" });
  if (role === "empresa" && entityId !== sub.companyId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor" && entityId !== sub.sellerId) return res.status(403).json({ error: "Sem permissão" });

  const eventos = db.prepare(
    "SELECT sequencia, tipo, atorRole, statusAnterior, statusNovo, motivoCodigo, observacao, dados, criadoEm FROM submission_events WHERE submissionId = ? ORDER BY sequencia ASC"
  ).all(sub.id).map((e) => ({ ...e, dados: JSON.parse(e.dados || "{}") }));

  res.json({
    eventos,
    integridade: verificarTrilhaAuditoria(sub.id),
    // O hash da evidência, não a evidência: a trilha prova que o dado não
    // mudou sem reexpor telefone e documento a cada consulta.
    evidencias: resumoEvidencias(sub.id).map((e) => ({ campo: e.campo, origem: e.origem, metadados: e.metadados, criadoEm: e.criadoEm })),
  });
});

export default router;

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
import { calcularValorTarefa, valoresDaLiberacao } from "../../shared/valorTarefa.js";
import { avaliarRegras } from "../../shared/aprovacoes.js";
import { registrarEventoAuditoria, registrarEvidencias, verificarTrilhaAuditoria, resumoEvidencias } from "../services/auditTrail.js";
import { solicitar as solicitarAuditoria } from "../services/audit/index.js";
import { registrarEventoCampanha } from "../services/campaignEvents.js";

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

  // IP e horário de recebimento vêm do servidor, não do cliente — junto com
  // o horário e a geolocalização lidos do EXIF da foto (enviados pelo
  // vendedor), dão à empresa um rastro comprobatório da evidência.
  const provaComMetadados = {
    ...prova,
    evidencias: Array.isArray(prova?.evidencias)
      ? prova.evidencias.map((e) => ({ ...e, metadata: { ...(e.metadata || {}), ip: req.ip, recebidoEm: agora() } }))
      : prova?.evidencias,
  };

  // Regras da empresa podem dispensar a conferência manual. O que elas NÃO
  // fazem é liberar dinheiro: a ação vai para "conferido", o mesmo estado de
  // quem foi conferido à mão, e o repasse continua com a plataforma.
  // Foto sem metadados de câmera já entra nessa conta: auditar() pondera a
  // ausência de horário/GPS como sinal de risco, elevando risco/reduzindo
  // confiança o suficiente para que a própria regra barre a aprovação
  // automática quando o risco deixa de ser "baixo" — sem veto hardcoded.
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
           liquido, JSON.stringify(provaComMetadados || {}), status, r.confianca, r.motivo, r.fonte, idempotencyKey || null, agora());
    if (campaignId) {
      const dadosEvento = { tipo, status, valor };
      registrarEventoCampanha({ companyId, campaignId, tipo: "TASK_COMPLETED", actorId: req.user.id, actorRole: role, sellerId, submissionId: id, leadId: leadId || null, source: "USER", dados: dadosEvento });
      const eventoResultado = tipo === "agendamento" ? "MEETING_SCHEDULED" : tipo === "realizada" ? "MEETING_COMPLETED" : tipo === "venda" ? "SALE_RECORDED" : null;
      if (eventoResultado) registrarEventoCampanha({ companyId, campaignId, tipo: eventoResultado, actorId: req.user.id, actorRole: role, sellerId, submissionId: id, leadId: leadId || null, source: "USER", dados: dadosEvento });
      if (Object.values(prova || {}).some(Boolean)) registrarEventoCampanha({ companyId, campaignId, tipo: "EVIDENCE_SUBMITTED", actorId: req.user.id, actorRole: role, sellerId, submissionId: id, leadId: leadId || null, source: "USER", dados: { campos: Object.keys(prova || {}).filter((campo) => prova[campo]) } });
      if (status === "ia_recusado") registrarEventoCampanha({ companyId, campaignId, tipo: "TASK_REJECTED", actorRole: "sistema", sellerId, submissionId: id, leadId: leadId || null, source: "SYSTEM", dados: { motivo: r.motivo, fonte: r.fonte } });
    }
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

  // RYCS Audit Engine. Abre o pedido e devolve na hora: o processamento pesado
  // — visão, transcrição, semântica — acontece na fila, fora deste request.
  // Só faz sentido para o que não foi recusado na entrada.
  let auditoria = null;
  if (status !== "ia_recusado") {
    const evidencias = [];
    for (const [campo, valor] of Object.entries(prova || {})) {
      if (!valor) continue;
      const ehMidia = /^(video|contrato)$/.test(campo);
      evidencias.push({
        tipo: ehMidia ? "video" : "texto",
        referencia: String(valor).slice(0, 500),
        metadata: { campo },
      });
    }
    if (req.body?.geo) {
      const empresaGeo = db.prepare("SELECT endereco FROM companies WHERE id = ?").get(companyId);
      evidencias.push({
        tipo: "geo",
        referencia: "captura_do_app",
        metadata: {
          capturado: req.body.geo,
          esperado: req.body.geoEsperado || null,
          tolerancia: req.body.geoTolerancia || null,
          endereco: empresaGeo?.endereco || "",
        },
      });
    }
    const r2 = solicitarAuditoria({ taskId: id, sellerId, companyId, tipo, evidencias });
    auditoria = r2.erro ? null : { id: r2.id, status: r2.status, politica: r2.politica };
  }

  res.json({ id, status, confianca: r.confianca, motivo: r.motivo, fonte: r.fonte, valor,
             automatica: decisao.automatica, regraAplicada: decisao.motivo, auditoria });
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

  // Vendedor pode atualizar apenas statusCliente nas próprias submissões.
  if (role === "vendedor") {
    if (!("statusCliente" in req.body) || Object.keys(req.body).some((k) => k !== "statusCliente"))
      return res.status(403).json({ error: "Sem permissão" });
    db.prepare("UPDATE submissions SET statusCliente = ? WHERE id = ?").run(req.body.statusCliente, id);
    return res.json({ ok: true });
  }

  if (req.body.status === "liberado")
    return res.status(400).json({ error: "Use POST /submissions/:id/liberar" });

  const fields = req.body;
  const allowed = ["status", "confianca", "motivo", "fonte", "statusCliente"];
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
      if (["recusado", "ia_recusado"].includes(fields.status) && sub.campaignId) registrarEventoCampanha({
        companyId: sub.companyId, campaignId: sub.campaignId, tipo: "TASK_REJECTED",
        actorId: req.user.id, actorRole: role, sellerId: sub.sellerId, submissionId: sub.id,
        source: "USER", dados: { motivo: fields.motivo || "", statusAnterior: sub.status },
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
//
// A conferência do status mora dentro da transação: é ela que impede que a
// mesma ação seja creditada duas vezes, seja por clique repetido, seja por
// liberação individual e em lote ao mesmo tempo.
class ErroLiberacao extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const STATUS_LIBERAVEIS = ["ia_aprovado", "conferido", "revisao"];

const liberarSubmissao = db.transaction((submissionId, actorId, loteId = null) => {
  const sub = db.prepare("SELECT * FROM submissions WHERE id = ?").get(submissionId);
  if (!sub) throw new ErroLiberacao(404, "Ação não encontrada");
  if (sub.status === "liberado") throw new ErroLiberacao(409, "Ação já liberada");
  if (!STATUS_LIBERAVEIS.includes(sub.status))
    throw new ErroLiberacao(400, "Ação não está pronta para liberação");

  const empresa = db.prepare("SELECT saldo, assinatura FROM companies WHERE id = ?").get(sub.companyId);
  if (!empresa) throw new ErroLiberacao(404, "Empresa não encontrada");

  // O take rate vem do plano contratado — é o que torna a assinatura
  // vantajosa para quem opera volume.
  const { bruto, taxa, liquido, totalDebito } = valoresDaLiberacao(sub, empresa.assinatura);
  if (bruto <= 0) throw new ErroLiberacao(400, "Valor da ação inválido");
  const posicao = posicaoEmpresa(sub.companyId);
  if (posicao.saldo < bruto || posicao.reservado < bruto)
    throw new ErroLiberacao(400, "Reserva financeira da ação não está disponível");
  if (posicao.saldo < totalDebito || posicao.reservado < totalDebito)
    throw new ErroLiberacao(400, "Reserva financeira da ação e da taxa não está disponível");

  const mudou = db.prepare(`UPDATE submissions SET status = 'liberado', liquido = ?
    WHERE id = ? AND status IN (${STATUS_LIBERAVEIS.map(() => "?").join(",")})`)
    .run(liquido, sub.id, ...STATUS_LIBERAVEIS).changes;
  if (!mudou) throw new ErroLiberacao(409, "Ação já liberada");

  liquidarSubmissao({ companyId: sub.companyId, sellerId: sub.sellerId, submissionId: sub.id, bruto, taxa, liquido, totalDebito });
  db.prepare(`INSERT INTO platform_earnings (id, submissionId, companyId, sellerId, bruto, taxa, liquido, loteId, criadoEm)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(uid(), sub.id, sub.companyId, sub.sellerId, bruto, taxa, liquido, loteId, agora());
  registrarEventoAuditoria({
    submissionId: sub.id, tipo: "liberacao", actorId, actorRole: "admin",
    statusAnterior: sub.status, statusNovo: "liberado",
    motivoCodigo: "repasse_plataforma",
    dados: { bruto, taxa, liquido, totalDebito },
  });
  if (sub.campaignId) {
    registrarEventoCampanha({ companyId: sub.companyId, campaignId: sub.campaignId, tipo: "TASK_APPROVED", actorId, actorRole: "admin", sellerId: sub.sellerId, submissionId: sub.id, source: "USER", dados: { bruto, liquido } });
    registrarEventoCampanha({ companyId: sub.companyId, campaignId: sub.campaignId, tipo: "PAYMENT_RELEASED", actorId, actorRole: "admin", sellerId: sub.sellerId, submissionId: sub.id, source: "SYSTEM", dados: { bruto, taxa, liquido, totalDebito } });
  }
  return { sub, bruto, taxa, liquido, totalDebito };
});

// Avisos e recálculos ficam fora da transação: só rodam depois que o
// dinheiro já se moveu, e uma vez por profissional, não por tarefa.
function aposLiberar({ sellerId, companyIds, liquido, quantidade, tipo }) {
  const sellerUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sellerId);
  const titulo = quantidade > 1 ? `${quantidade} ações aprovadas` : "Ação aprovada";
  if (sellerUser) notificar(sellerUser.id, "submissao", titulo, `R$ ${liquido.toFixed(2)} liberados para saque.`);
  const seller = db.prepare("SELECT nome, email FROM sellers WHERE id = ?").get(sellerId);
  if (seller) emailStatusAcao(seller.nome, seller.email, quantidade > 1 ? `${quantidade} tarefas` : tipo, "liberado");
  recalcularScore(sellerId);
  for (const companyId of companyIds) recalcularCompanyScore(companyId);
  // Primeira ação aprovada é o gatilho da recompensa de quem indicou.
  if (sellerUser) qualificarIndicacao(sellerUser.id);
}

router.post("/submissions/:id/liberar", (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Apenas a plataforma pode liberar" });

  let r;
  try { r = liberarSubmissao(req.params.id, req.user.id, uid()); }
  catch (err) {
    if (err instanceof ErroLiberacao) return res.status(err.status).json({ error: err.message });
    throw err;
  }
  const { sub, bruto, taxa, liquido, totalDebito } = r;
  aposLiberar({ sellerId: sub.sellerId, companyIds: [sub.companyId], liquido, quantidade: 1, tipo: sub.tipo });
  res.json({ ok: true, bruto, taxa, liquido, totalDebito });
});

// Libera de uma vez as tarefas confirmadas de um profissional. Tudo ou nada:
// se uma delas não puder ser liberada, nenhuma é. Tarefas que já estavam
// liberadas são puladas sem crédito, então repetir o pedido não paga de novo.
router.post("/submissions/liberar-lote", (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Apenas a plataforma pode liberar" });

  const { sellerId, ids } = req.body || {};
  if (!sellerId || !Array.isArray(ids) || !ids.length)
    return res.status(400).json({ error: "Informe o profissional e as tarefas" });
  const unicos = [...new Set(ids.map(String))];
  if (unicos.length > 500) return res.status(400).json({ error: "Lote grande demais (máximo de 500 tarefas)" });

  let resultado;
  try {
    const loteId = uid();
    resultado = db.transaction(() => {
      const feitas = [];
      let jaLiberadas = 0;
      for (const id of unicos) {
        const sub = db.prepare("SELECT id, sellerId, status FROM submissions WHERE id = ?").get(id);
        if (!sub) throw new ErroLiberacao(404, "Ação não encontrada");
        if (sub.sellerId !== sellerId) throw new ErroLiberacao(400, "Há tarefas de outro profissional no lote");
        if (sub.status === "liberado") { jaLiberadas++; continue; }
        feitas.push(liberarSubmissao(id, req.user.id, loteId));
      }
      return { feitas, jaLiberadas };
    })();
  } catch (err) {
    if (err instanceof ErroLiberacao) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const soma = (campo) => Math.round(resultado.feitas.reduce((t, f) => t + f[campo], 0) * 100) / 100;
  const total = { bruto: soma("bruto"), taxa: soma("taxa"), liquido: soma("liquido"), totalDebito: soma("totalDebito") };
  if (resultado.feitas.length) {
    aposLiberar({
      sellerId,
      companyIds: [...new Set(resultado.feitas.map((f) => f.sub.companyId))],
      liquido: total.liquido,
      quantidade: resultado.feitas.length,
      tipo: resultado.feitas[0].sub.tipo,
    });
  }
  res.json({ ok: true, liberadas: resultado.feitas.length, jaLiberadas: resultado.jaLiberadas, ...total });
});

// Histórico da tela Liberar: cada clique vira uma linha, com profissional,
// quantidade, valores e quem liberou. Sai de platform_earnings, que já guarda
// uma linha por tarefa liberada. Liberações de antes do lote existir (sem
// loteId) são agrupadas por profissional quando saíram com menos de um minuto
// de diferença.
router.get("/admin/liberacoes", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas admin" });
  const limite = Math.min(200, Math.max(1, Number(req.query.limite) || 50));

  const linhas = db.prepare(`
    SELECT pe.submissionId, pe.sellerId, pe.companyId, pe.bruto, pe.taxa, pe.liquido, pe.loteId, pe.criadoEm,
           v.nome AS profissional, c.nome AS empresa,
           (SELECT u.email FROM submission_events ev LEFT JOIN users u ON u.id = ev.atorId
             WHERE ev.submissionId = pe.submissionId AND ev.tipo = 'liberacao'
             ORDER BY ev.criadoEm DESC LIMIT 1) AS liberadoPor
    FROM platform_earnings pe
    LEFT JOIN sellers v ON v.id = pe.sellerId
    LEFT JOIN companies c ON c.id = pe.companyId
    ORDER BY pe.criadoEm DESC
    LIMIT 3000
  `).all();

  const grupos = [];
  const porLote = new Map();
  let anterior = null;
  for (const l of linhas) {
    let g = l.loteId ? porLote.get(l.loteId) : null;
    if (!g && !l.loteId && anterior && !anterior.loteId && anterior.sellerId === l.sellerId && anterior.ultimo - l.criadoEm < 60_000) g = anterior;
    if (!g) {
      g = { id: l.loteId || `avulso:${l.submissionId}`, loteId: l.loteId, sellerId: l.sellerId, profissional: l.profissional || "Profissional",
        empresas: new Set(), quantidade: 0, bruto: 0, taxa: 0, liquido: 0, criadoEm: l.criadoEm, ultimo: l.criadoEm, liberadoPor: l.liberadoPor || null };
      grupos.push(g);
      if (l.loteId) porLote.set(l.loteId, g);
    }
    g.quantidade++;
    g.bruto += l.bruto; g.taxa += l.taxa; g.liquido += l.liquido;
    if (l.empresa) g.empresas.add(l.empresa);
    g.ultimo = Math.min(g.ultimo, l.criadoEm);
    if (!g.liberadoPor && l.liberadoPor) g.liberadoPor = l.liberadoPor;
    anterior = g;
  }

  const r2 = (v) => Math.round(v * 100) / 100;
  res.json({
    liberacoes: grupos.slice(0, limite).map(({ empresas, ultimo, ...g }) => ({
      ...g, empresas: [...empresas], bruto: r2(g.bruto), taxa: r2(g.taxa), liquido: r2(g.liquido),
    })),
  });
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

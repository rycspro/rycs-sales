import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { getProvider, listProviders } from "../services/voice/providerRegistry.js";
import {
  proximoLead, renovarReserva, liberarReserva, registrarTentativa,
  adicionarLeadsNaFila, estatisticasFila,
} from "../services/voice/queueEngine.js";

const router = Router();

// ── Feature flag: discadora habilitada por empresa ──────────────────
// A coluna `voice_habilitada` na tabela companies controla quais empresas
// podem usar a discadora. Empresas sem a flag veem 403 em todas as rotas.
// Admin sempre tem acesso (para configurar).

function voiceHabilitada(companyId, role) {
  if (role === "admin") return true;
  if (!companyId) return false;
  const emp = db.prepare("SELECT voice_habilitada FROM companies WHERE id = ?").get(companyId);
  return emp?.voice_habilitada === 1;
}

function exigirVoiceAtiva(req, res) {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) { res.status(403).json({ error: "Empresa não identificada." }); return false; }
  if (!voiceHabilitada(companyId, req.user.role)) {
    res.status(403).json({ error: "A discadora não está habilitada para esta empresa. Solicite ativação." });
    return false;
  }
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────────

function exigirEmpresa(req, res) {
  if (req.user.role !== "empresa" && req.user.role !== "admin") {
    res.status(403).json({ error: "Apenas empresas podem acessar este recurso." });
    return null;
  }
  return req.user.role === "admin" ? req.query.companyId || req.body?.companyId : req.user.entityId;
}

function companyIdDoUsuario(req) {
  if (req.user.role === "empresa") return req.user.entityId;
  if (req.user.role === "admin") return req.query.companyId || req.body?.companyId;
  if (req.user.role === "vendedor") {
    const app = db.prepare("SELECT companyId FROM applications WHERE sellerId = ? AND status = 'aprovado' LIMIT 1").get(req.user.entityId);
    return app?.companyId || null;
  }
  return null;
}

function sellerIdDoUsuario(req) {
  return req.user.role === "vendedor" ? req.user.entityId : null;
}

function auditLog(companyId, userId, acao, entidade, entidadeId, dados = {}) {
  db.prepare(`INSERT INTO voice_audit_logs (id, companyId, userId, acao, entidade, entidadeId, dados, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(uid(), companyId, userId, acao, entidade, entidadeId, JSON.stringify(dados), agora());
}

function limitesCommerciaisAtivos() {
  const cfg = db.prepare("SELECT limitesAtivos FROM voice_admin_config WHERE id = 'global'").get();
  return cfg?.limitesAtivos === 1;
}

// ── Provedores ───────────────────────────────────────────────────────

router.get("/voice/providers", (req, res) => {
  const cfg = db.prepare("SELECT telefoniaReal FROM voice_admin_config WHERE id = 'global'").get();
  res.json(listProviders().map((p) => (p.id === "sip" ? { ...p, liberado: cfg?.telefoniaReal === 1 } : p)));
});

// Credencial temporária do ramal WebRTC do profissional (renovada a cada conexão).
router.post("/voice/webrtc/credenciais", async (req, res) => {
  const sellerId = sellerIdDoUsuario(req);
  if (!sellerId) return res.status(403).json({ error: "Apenas profissionais." });
  if (!exigirVoiceAtiva(req, res)) return;

  const r = await getProvider("sip").createWebRtcEndpoint({ sellerId });
  if (!r.ok) return res.status(503).json({ error: r.motivo });
  res.json(r);
});

// Eventos reais do Asterisk viram horários e duração verificados da ligação.
getProvider("sip").aoAtualizarChamada((callId, d) => {
  const call = db.prepare("SELECT iniciadaEm FROM voice_calls WHERE id = ?").get(callId);
  if (!call) return;
  if (d.encerradaEm) {
    const total = Math.max(0, Math.round((d.encerradaEm - call.iniciadaEm) / 1000));
    const tarifavel = d.atendidaEm ? Math.max(0, Math.round((d.encerradaEm - d.atendidaEm) / 1000)) : 0;
    db.prepare(`UPDATE voice_calls SET status = ?, atendidaEm = ?, encerradaEm = ?, duracaoTotal = ?,
      duracaoTarifavel = ?, origemDados = 'verificado' WHERE id = ?`).run(d.status, d.atendidaEm || null, d.encerradaEm, total, tarifavel, callId);
    db.prepare("UPDATE voice_usage_events SET minutos = ? WHERE callId = ?").run(tarifavel / 60, callId);
  } else {
    db.prepare("UPDATE voice_calls SET status = ?, atendidaEm = COALESCE(?, atendidaEm) WHERE id = ?").run(d.status, d.atendidaEm || null, callId);
  }
  db.prepare("INSERT INTO voice_call_events (id, callId, tipo, dados, criadoEm) VALUES (?, ?, ?, ?, ?)").run(uid(), callId, d.status, JSON.stringify(d), agora());
});

// ── Status / Feature flag ───────────────────────────────────────────

router.get("/voice/status", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  const habilitada = voiceHabilitada(companyId, req.user.role);
  res.json({ habilitada, companyId });
});

// Admin: habilitar/desabilitar voice para uma empresa
router.post("/voice/admin/habilitar", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas admin." });
  const { companyId, habilitada } = req.body;
  if (!companyId) return res.status(400).json({ error: "companyId obrigatório." });
  db.prepare("UPDATE companies SET voice_habilitada = ? WHERE id = ?").run(habilitada ? 1 : 0, companyId);
  auditLog(companyId, req.user.id, habilitada ? "habilitar_voice" : "desabilitar_voice", "company", companyId, {});
  res.json({ ok: true, companyId, habilitada: !!habilitada });
});

// ── Configurações da empresa ─────────────────────────────────────────

router.get("/voice/settings", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });
  if (!voiceHabilitada(companyId, req.user.role)) return res.status(403).json({ error: "Discadora não habilitada." });
  const settings = db.prepare("SELECT * FROM voice_company_settings WHERE companyId = ?").get(companyId);
  if (!settings) {
    return res.json({
      companyId, ativo: false, modalidades: ["mobile"],
      horarioInicio: "08:00", horarioFim: "20:00",
      diasOperacao: ["seg", "ter", "qua", "qui", "sex"],
      metaDiaria: 30, maxTentativas: 3, intervaloRetentativa: 3600,
      gravacaoAtiva: false, limiteMinutosMensal: 0,
    });
  }
  res.json({
    ...settings,
    modalidades: JSON.parse(settings.modalidades || "[]"),
    diasOperacao: JSON.parse(settings.diasOperacao || "[]"),
    resultadosDisponiveis: JSON.parse(settings.resultadosDisponiveis || "[]"),
    regrasDistribuicao: JSON.parse(settings.regrasDistribuicao || "{}"),
    campanhasAutorizadas: JSON.parse(settings.campanhasAutorizadas || "[]"),
    profissionaisAutorizados: JSON.parse(settings.profissionaisAutorizados || "[]"),
    ativo: !!settings.ativo,
    gravacaoAtiva: !!settings.gravacaoAtiva,
  });
});

router.put("/voice/settings", (req, res) => {
  const companyId = exigirEmpresa(req, res);
  if (!companyId) return;
  const now = agora();
  const b = req.body;

  const existe = db.prepare("SELECT 1 FROM voice_company_settings WHERE companyId = ?").get(companyId);
  if (existe) {
    const campos = [];
    const vals = [];
    const atualizaveis = [
      "ativo", "horarioInicio", "horarioFim", "metaDiaria", "maxTentativas",
      "intervaloRetentativa", "scriptPadrao", "gravacaoAtiva", "limiteMinutosMensal",
    ];
    for (const c of atualizaveis) {
      if (b[c] !== undefined) { campos.push(`${c} = ?`); vals.push(typeof b[c] === "boolean" ? (b[c] ? 1 : 0) : b[c]); }
    }
    for (const c of ["modalidades", "diasOperacao", "resultadosDisponiveis", "regrasDistribuicao", "campanhasAutorizadas", "profissionaisAutorizados"]) {
      if (b[c] !== undefined) { campos.push(`${c} = ?`); vals.push(JSON.stringify(b[c])); }
    }
    if (campos.length) {
      campos.push("atualizadoEm = ?"); vals.push(now);
      db.prepare(`UPDATE voice_company_settings SET ${campos.join(",")} WHERE companyId = ?`).run(...vals, companyId);
    }
  } else {
    db.prepare(`INSERT INTO voice_company_settings (companyId, ativo, modalidades, horarioInicio, horarioFim, metaDiaria, maxTentativas, intervaloRetentativa, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      companyId, b.ativo ? 1 : 0,
      JSON.stringify(b.modalidades || ["mobile"]),
      b.horarioInicio || "08:00", b.horarioFim || "20:00",
      b.metaDiaria || 30, b.maxTentativas || 3, b.intervaloRetentativa || 3600,
      now, now
    );
  }
  auditLog(companyId, req.user.id, "atualizar_config", "voice_settings", companyId, b);
  res.json({ ok: true });
});

// ── Filas ────────────────────────────────────────────────────────────

router.get("/voice/queues", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });

  let filas;
  if (req.user.role === "vendedor") {
    filas = db.prepare(`
      SELECT q.* FROM voice_queues q
      JOIN voice_queue_members m ON m.queueId = q.id AND m.sellerId = ? AND m.ativo = 1
      WHERE q.companyId = ? AND q.status = 'ativa'
    `).all(req.user.entityId, companyId);
  } else {
    filas = db.prepare("SELECT * FROM voice_queues WHERE companyId = ? ORDER BY criadoEm DESC").all(companyId);
  }

  const result = filas.map((f) => ({
    ...f,
    diasOperacao: JSON.parse(f.diasOperacao || "[]"),
    config: JSON.parse(f.config || "{}"),
    stats: estatisticasFila(f.id),
  }));
  res.json(result);
});

router.post("/voice/queues", (req, res) => {
  const companyId = exigirEmpresa(req, res);
  if (!companyId) return;
  const { nome, descricao, campaignId, estrategia, maxTentativas, intervaloRetentativa, horarioInicio, horarioFim, diasOperacao } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: "Nome obrigatório." });

  const now = agora();
  const id = uid();
  db.prepare(`INSERT INTO voice_queues (id, companyId, campaignId, nome, descricao, estrategia, maxTentativas, intervaloRetentativa, horarioInicio, horarioFim, diasOperacao, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, companyId, campaignId || null, nome.trim(), descricao || "",
    estrategia || "ordem", maxTentativas || 3, intervaloRetentativa || 3600,
    horarioInicio || "08:00", horarioFim || "20:00",
    JSON.stringify(diasOperacao || ["seg", "ter", "qua", "qui", "sex"]),
    now, now
  );
  auditLog(companyId, req.user.id, "criar_fila", "voice_queue", id, { nome });
  res.json({ id, nome });
});

router.put("/voice/queues/:id", (req, res) => {
  const companyId = exigirEmpresa(req, res);
  if (!companyId) return;
  const fila = db.prepare("SELECT * FROM voice_queues WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
  if (!fila) return res.status(404).json({ error: "Fila não encontrada." });

  const b = req.body;
  const now = agora();
  const campos = [];
  const vals = [];
  for (const c of ["nome", "descricao", "estrategia", "status", "maxTentativas", "intervaloRetentativa", "horarioInicio", "horarioFim", "prioridade"]) {
    if (b[c] !== undefined) { campos.push(`${c} = ?`); vals.push(b[c]); }
  }
  if (b.diasOperacao) { campos.push("diasOperacao = ?"); vals.push(JSON.stringify(b.diasOperacao)); }
  if (b.config) { campos.push("config = ?"); vals.push(JSON.stringify(b.config)); }
  if (campos.length) {
    campos.push("atualizadoEm = ?"); vals.push(now);
    db.prepare(`UPDATE voice_queues SET ${campos.join(",")} WHERE id = ?`).run(...vals, fila.id);
  }
  auditLog(companyId, req.user.id, "atualizar_fila", "voice_queue", fila.id, b);
  res.json({ ok: true });
});

// ── Membros da fila ──────────────────────────────────────────────────

router.get("/voice/queues/:id/members", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });
  const fila = db.prepare("SELECT * FROM voice_queues WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
  if (!fila) return res.status(404).json({ error: "Fila não encontrada." });

  const membros = db.prepare(`
    SELECT m.*, s.nome, s.email, s.perfil FROM voice_queue_members m
    JOIN sellers s ON s.id = m.sellerId
    WHERE m.queueId = ? ORDER BY m.criadoEm
  `).all(fila.id);
  res.json(membros);
});

router.post("/voice/queues/:id/members", (req, res) => {
  const companyId = exigirEmpresa(req, res);
  if (!companyId) return;
  const fila = db.prepare("SELECT * FROM voice_queues WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
  if (!fila) return res.status(404).json({ error: "Fila não encontrada." });

  const { sellerIds } = req.body;
  if (!Array.isArray(sellerIds) || !sellerIds.length) return res.status(400).json({ error: "Informe profissionais." });

  const now = agora();
  const ins = db.prepare(`INSERT OR IGNORE INTO voice_queue_members (id, queueId, sellerId, criadoEm) VALUES (?, ?, ?, ?)`);
  let adicionados = 0;
  db.transaction(() => {
    for (const sid of sellerIds) {
      const r = ins.run(uid(), fila.id, sid, now);
      if (r.changes) adicionados++;
    }
  })();
  auditLog(companyId, req.user.id, "adicionar_membros", "voice_queue", fila.id, { sellerIds, adicionados });
  res.json({ adicionados });
});

router.delete("/voice/queues/:queueId/members/:sellerId", (req, res) => {
  const companyId = exigirEmpresa(req, res);
  if (!companyId) return;
  db.prepare("DELETE FROM voice_queue_members WHERE queueId = ? AND sellerId = ?").run(req.params.queueId, req.params.sellerId);
  res.json({ ok: true });
});

// ── Leads na fila ────────────────────────────────────────────────────

router.post("/voice/queues/:id/leads", (req, res) => {
  const companyId = exigirEmpresa(req, res);
  if (!companyId) return;
  const fila = db.prepare("SELECT * FROM voice_queues WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
  if (!fila) return res.status(404).json({ error: "Fila não encontrada." });

  const { leadIds } = req.body;
  if (!Array.isArray(leadIds) || !leadIds.length) return res.status(400).json({ error: "Informe leads." });

  // Validar que leads pertencem à empresa
  const placeholders = leadIds.map(() => "?").join(",");
  const validos = db.prepare(`SELECT id FROM leads WHERE id IN (${placeholders}) AND companyId = ?`).all(...leadIds, companyId);
  const idsValidos = validos.map((l) => l.id);

  const resultado = adicionarLeadsNaFila(fila.id, idsValidos);
  auditLog(companyId, req.user.id, "adicionar_leads_fila", "voice_queue", fila.id, { total: idsValidos.length, adicionados: resultado.adicionados });
  res.json(resultado);
});

router.get("/voice/queues/:id/leads", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });
  const fila = db.prepare("SELECT * FROM voice_queues WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
  if (!fila) return res.status(404).json({ error: "Fila não encontrada." });

  const { status } = req.query;
  let sql = `SELECT ql.*, l.nome, l.empresa, l.telefone, l.email, l.cargo, l.etapa, l.origem
    FROM voice_queue_leads ql JOIN leads l ON l.id = ql.leadId WHERE ql.queueId = ?`;
  const args = [fila.id];
  if (status) { sql += " AND ql.status = ?"; args.push(status); }
  sql += " ORDER BY ql.prioridade DESC, ql.posicao ASC LIMIT 200";
  res.json(db.prepare(sql).all(...args));
});

// ── Operação do profissional ─────────────────────────────────────────

router.post("/voice/session/start", (req, res) => {
  const sellerId = sellerIdDoUsuario(req);
  if (!sellerId) return res.status(403).json({ error: "Apenas profissionais." });

  const { queueId, companyId: bodyCompanyId, modalidade } = req.body;
  const companyId = bodyCompanyId || companyIdDoUsuario(req);
  if (!companyId) return res.status(400).json({ error: "Empresa não identificada." });
  if (!voiceHabilitada(companyId, req.user.role)) return res.status(403).json({ error: "Discadora não habilitada para esta empresa." });

  // Verificar se settings permite
  const settings = db.prepare("SELECT * FROM voice_company_settings WHERE companyId = ?").get(companyId);
  if (settings && !settings.ativo) return res.status(403).json({ error: "Discadora não ativada para esta empresa." });

  const now = agora();
  // Encerrar sessão anterior se existir
  db.prepare("UPDATE voice_sessions SET status = 'encerrado', encerradoEm = ? WHERE sellerId = ? AND status = 'ativo'").run(now, sellerId);

  const id = uid();
  db.prepare(`INSERT INTO voice_sessions (id, sellerId, companyId, queueId, modalidade, status, iniciadoEm)
    VALUES (?, ?, ?, ?, ?, 'ativo', ?)`).run(id, sellerId, companyId, queueId || null, modalidade || "mobile", now);

  res.json({ sessionId: id, status: "ativo" });
});

router.post("/voice/session/pause", (req, res) => {
  const sellerId = sellerIdDoUsuario(req);
  if (!sellerId) return res.status(403).json({ error: "Apenas profissionais." });
  const now = agora();
  db.prepare("UPDATE voice_sessions SET status = 'pausado', pausadoEm = ? WHERE sellerId = ? AND status = 'ativo'").run(now, sellerId);
  res.json({ ok: true });
});

router.post("/voice/session/resume", (req, res) => {
  const sellerId = sellerIdDoUsuario(req);
  if (!sellerId) return res.status(403).json({ error: "Apenas profissionais." });
  db.prepare("UPDATE voice_sessions SET status = 'ativo', pausadoEm = NULL WHERE sellerId = ? AND status = 'pausado'").run(sellerId);
  res.json({ ok: true });
});

router.post("/voice/session/end", (req, res) => {
  const sellerId = sellerIdDoUsuario(req);
  if (!sellerId) return res.status(403).json({ error: "Apenas profissionais." });
  const now = agora();
  db.prepare("UPDATE voice_sessions SET status = 'encerrado', encerradoEm = ? WHERE sellerId = ? AND status IN ('ativo','pausado')").run(now, sellerId);
  res.json({ ok: true });
});

router.get("/voice/session/current", (req, res) => {
  const sellerId = sellerIdDoUsuario(req);
  if (!sellerId) return res.status(403).json({ error: "Apenas profissionais." });
  const sessao = db.prepare("SELECT * FROM voice_sessions WHERE sellerId = ? AND status IN ('ativo','pausado') ORDER BY iniciadoEm DESC LIMIT 1").get(sellerId);
  res.json(sessao || null);
});

// ── Próximo lead (operação) ──────────────────────────────────────────

router.post("/voice/next-lead", (req, res) => {
  const sellerId = sellerIdDoUsuario(req);
  if (!sellerId) return res.status(403).json({ error: "Apenas profissionais." });

  const { queueId } = req.body;
  if (!queueId) return res.status(400).json({ error: "Fila obrigatória." });

  // Verificar se é membro da fila
  const membro = db.prepare("SELECT 1 FROM voice_queue_members WHERE queueId = ? AND sellerId = ? AND ativo = 1").get(queueId, sellerId);
  if (!membro) return res.status(403).json({ error: "Você não é membro desta fila." });

  const resultado = proximoLead(queueId, sellerId);
  if (!resultado) return res.json({ lead: null, mensagem: "Nenhum lead disponível na fila." });

  // Buscar dados completos do lead + histórico
  const eventos = db.prepare("SELECT * FROM lead_events WHERE leadId = ? ORDER BY criadoEm DESC LIMIT 10").all(resultado.lead.id);
  const callsAnteriores = db.prepare("SELECT * FROM voice_calls WHERE leadId = ? ORDER BY criadoEm DESC LIMIT 5").all(resultado.lead.id);

  // Buscar script da campanha/fila
  const fila = db.prepare("SELECT * FROM voice_queues WHERE id = ?").get(queueId);
  let script = null;
  if (fila?.campaignId) {
    script = db.prepare("SELECT * FROM voice_scripts WHERE (campaignId = ? OR queueId = ?) AND ativo = 1 ORDER BY queueId DESC LIMIT 1").get(fila.campaignId, queueId);
  }
  if (!script) {
    const companyId = companyIdDoUsuario(req);
    script = db.prepare("SELECT * FROM voice_scripts WHERE companyId = ? AND campaignId IS NULL AND queueId IS NULL AND ativo = 1 LIMIT 1").get(companyId);
  }

  // Buscar callbacks pendentes deste lead
  const callback = db.prepare("SELECT * FROM voice_callbacks WHERE leadId = ? AND sellerId = ? AND status = 'pendente' ORDER BY agendadoPara ASC LIMIT 1").get(resultado.lead.id, sellerId);

  res.json({
    lead: resultado.lead,
    reserva: resultado.reserva,
    eventos,
    callsAnteriores,
    script,
    callback,
  });
});

// ── Iniciar ligação ──────────────────────────────────────────────────

router.post("/voice/calls", (req, res) => {
  const sellerId = sellerIdDoUsuario(req);
  if (!sellerId) return res.status(403).json({ error: "Apenas profissionais." });

  const { leadId, queueId, providerId, reservaId } = req.body;
  if (!leadId) return res.status(400).json({ error: "Lead obrigatório." });

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado." });
  if (!lead.telefone) return res.status(400).json({ error: "Lead sem telefone." });

  const companyId = lead.companyId;

  // Verificar DNC
  const dnc = db.prepare("SELECT 1 FROM voice_do_not_call WHERE companyId = ? AND telefone = ?").get(companyId, lead.telefone);
  if (dnc) return res.status(403).json({ error: "Este contato solicitou não receber ligações." });

  // Verificar ligação duplicada recente (últimos 30s)
  const recente = db.prepare("SELECT 1 FROM voice_calls WHERE leadId = ? AND sellerId = ? AND criadoEm > ?").get(leadId, sellerId, agora() - 30000);
  if (recente) return res.status(429).json({ error: "Aguarde antes de ligar novamente para este contato." });

  const provId = providerId || "mobile";
  const provider = getProvider(provId);
  if (!provider) return res.status(400).json({ error: "Provedor não disponível." });

  // Mock provider: apenas admin ou ambiente de teste
  if (provId === "mock" && req.user.role !== "admin" && process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Provedor simulado não disponível em produção." });
  }

  if (provId === "sip") {
    const cfgTel = db.prepare("SELECT telefoniaReal FROM voice_admin_config WHERE id = 'global'").get();
    if (cfgTel?.telefoniaReal !== 1) return res.status(403).json({ error: "Telefonia real ainda não liberada pelo admin." });
  }

  const caps = provider.getCapabilities();
  if (!caps.canInitiate) return res.status(400).json({ error: `O provedor ${provider.nome} não está operacional.` });

  const now = agora();
  const callId = uid();

  // Iniciar chamada via provedor
  provider.initiateCall({ telefone: lead.telefone, leadId, sellerId, companyId, callId }).then((resultado) => {
    if (provId === "sip" && resultado.ok === false) return res.status(400).json({ error: resultado.motivo });
    const simulado = resultado.simulado ? 1 : 0;

    db.prepare(`INSERT INTO voice_calls
      (id, companyId, campaignId, queueId, leadId, sellerId, providerId, numeroDestino, status, origemDados, iniciadaEm, providerCallId, metadados, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      callId, companyId, lead.campaignId || null, queueId || null, leadId, sellerId,
      provider.id, lead.telefone, resultado.status || "iniciada",
      resultado.origemDados || "declarado", now,
      resultado.providerCallId || "", JSON.stringify({ simulado, ...resultado }), now
    );

    // Evento de início
    db.prepare("INSERT INTO voice_call_events (id, callId, tipo, dados, criadoEm) VALUES (?, ?, 'iniciada', ?, ?)").run(uid(), callId, JSON.stringify(resultado), now);

    // Se mock, já registrar resultado simulado
    if (resultado.simulado && resultado.duracao) {
      db.prepare("UPDATE voice_calls SET duracaoTotal = ?, duracaoTarifavel = ?, encerradaEm = ?, status = ? WHERE id = ?").run(
        resultado.duracao, resultado.duracaoTarifavel || 0, now + (resultado.duracao * 1000), resultado.status, callId
      );
    }

    // Renovar reserva se informada
    if (reservaId) renovarReserva(reservaId, sellerId);

    res.json({
      callId,
      status: resultado.status || "iniciada",
      telUri: resultado.telUri,
      origemDados: resultado.origemDados,
      aviso: resultado.aviso,
      simulado: !!resultado.simulado,
      providerCapabilities: caps,
    });
  }).catch((err) => {
    console.error("[voice] Erro ao iniciar ligação:", err);
    res.status(500).json({ error: "Erro ao iniciar ligação." });
  });
});

// ── Registrar resultado ──────────────────────────────────────────────

router.post("/voice/calls/:id/result", (req, res) => {
  const sellerId = sellerIdDoUsuario(req);
  if (!sellerId) return res.status(403).json({ error: "Apenas profissionais." });

  const call = db.prepare("SELECT * FROM voice_calls WHERE id = ? AND sellerId = ?").get(req.params.id, sellerId);
  if (!call) return res.status(404).json({ error: "Ligação não encontrada." });

  const { resultado, observacao, duracaoManual, agendarRetorno, agendarReuniao } = req.body;
  if (!resultado) return res.status(400).json({ error: "Resultado obrigatório." });

  const now = agora();

  // Atualizar a chamada
  db.prepare(`UPDATE voice_calls SET resultado = ?, observacao = ?, encerradaEm = COALESCE(encerradaEm, ?), status = 'encerrada' WHERE id = ?`).run(resultado, observacao || "", now, call.id);

  if (duracaoManual && call.origemDados === "declarado") {
    db.prepare("UPDATE voice_calls SET duracaoTotal = ?, duracaoTarifavel = ? WHERE id = ?").run(duracaoManual, duracaoManual, call.id);
  }

  // Evento no lead_events (integração com pipeline)
  db.prepare(`INSERT INTO lead_events (id, leadId, sellerId, tipo, resultado, duracao, observacao, criadoEm)
    VALUES (?, ?, ?, 'ligacao', ?, ?, ?, ?)`).run(uid(), call.leadId, sellerId, resultado, duracaoManual || call.duracaoTotal || 0, observacao || "", now);

  // Registrar tentativa na fila
  if (call.queueId && call.leadId) {
    registrarTentativa(call.queueId, call.leadId, resultado);
  }

  // Liberar reserva
  const reserva = db.prepare("SELECT id FROM voice_lead_reservations WHERE leadId = ? AND sellerId = ? AND status = 'ativa'").get(call.leadId, sellerId);
  if (reserva) liberarReserva(reserva.id, sellerId);

  // DNC
  if (resultado === "nao_ligar") {
    db.prepare("INSERT OR IGNORE INTO voice_do_not_call (id, companyId, telefone, motivo, criadoPor, criadoEm) VALUES (?, ?, ?, 'Solicitação do contato', ?, ?)").run(uid(), call.companyId, call.numeroDestino, sellerId, now);
  }

  // Callback agendado
  if (agendarRetorno) {
    db.prepare(`INSERT INTO voice_callbacks (id, leadId, sellerId, companyId, queueId, agendadoPara, observacao, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(uid(), call.leadId, sellerId, call.companyId, call.queueId, agendarRetorno, observacao || "", now);
  }

  // Integração com calendário existente: criar evento ao agendar reunião
  if (agendarReuniao && resultado === "reuniao_agendada") {
    const sellerInfo = db.prepare("SELECT nome, email FROM sellers WHERE id = ?").get(sellerId);
    const leadInfo = db.prepare("SELECT nome, email, telefone FROM leads WHERE id = ?").get(call.leadId);
    const startAt = typeof agendarReuniao === "object" ? agendarReuniao.data : agendarReuniao;
    const duracao = typeof agendarReuniao === "object" ? (agendarReuniao.duracao || 30) : 30;
    const endAt = startAt + duracao * 60 * 1000;
    db.prepare(`INSERT INTO calendar_events (title, description, meetingType, status, startAt, endAt, organizerName, organizerEmail, createdById, campaignId, leadId, companyId, createdAt, updatedAt)
      VALUES (?, ?, 'sales_call', 'scheduled', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      `Reunião: ${leadInfo?.nome || "Lead"}`,
      observacao || "Reunião agendada via discadora",
      startAt, endAt,
      sellerInfo?.nome || "", sellerInfo?.email || "",
      sellerId, call.campaignId || "", call.leadId, call.companyId,
      now, now
    );
    if (leadInfo) {
      const eventId = db.prepare("SELECT last_insert_rowid() as id").get().id;
      db.prepare(`INSERT INTO calendar_event_participants (eventId, name, email, phone, role, createdAt)
        VALUES (?, ?, ?, ?, 'guest', ?)`).run(eventId, leadInfo.nome || "", leadInfo.email || "", leadInfo.telefone || "", now);
    }
  }

  // Atualizar sessão
  db.prepare(`UPDATE voice_sessions SET totalLigacoes = totalLigacoes + 1,
    totalAtendidas = totalAtendidas + CASE WHEN ? IN ('reuniao_agendada','atendeu','venda') THEN 1 ELSE 0 END
    WHERE sellerId = ? AND status = 'ativo'`).run(resultado, sellerId);

  // Evento de auditoria
  db.prepare("INSERT INTO voice_call_events (id, callId, tipo, dados, criadoEm) VALUES (?, ?, 'resultado', ?, ?)").run(uid(), call.id, JSON.stringify({ resultado, observacao }), now);

  // Uso para contabilização futura
  const meta = JSON.parse(call.metadados || "{}");
  if (!meta.simulado) {
    db.prepare(`INSERT INTO voice_usage_events (id, companyId, sellerId, callId, tipo, minutos, simulado, idempotencyKey, criadoEm)
      VALUES (?, ?, ?, ?, 'chamada', ?, 0, ?, ?)`).run(
      uid(), call.companyId, sellerId, call.id,
      (duracaoManual || (call.origemDados === "verificado" ? call.duracaoTarifavel : call.duracaoTotal) || 0) / 60,
      `call_${call.id}`, now
    );
  }

  res.json({ ok: true, callId: call.id });
});

// ── Histórico ────────────────────────────────────────────────────────

router.get("/voice/calls", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });

  const { sellerId: filterSeller, queueId, campaignId, resultado, limit: lim, offset: off } = req.query;
  let sql = "SELECT c.*, l.nome as leadNome, l.empresa as leadEmpresa, s.nome as sellerNome FROM voice_calls c LEFT JOIN leads l ON l.id = c.leadId LEFT JOIN sellers s ON s.id = c.sellerId WHERE c.companyId = ?";
  const args = [companyId];

  if (req.user.role === "vendedor") { sql += " AND c.sellerId = ?"; args.push(req.user.entityId); }
  if (filterSeller) { sql += " AND c.sellerId = ?"; args.push(filterSeller); }
  if (queueId) { sql += " AND c.queueId = ?"; args.push(queueId); }
  if (campaignId) { sql += " AND c.campaignId = ?"; args.push(campaignId); }
  if (resultado) { sql += " AND c.resultado = ?"; args.push(resultado); }

  sql += " ORDER BY c.criadoEm DESC LIMIT ? OFFSET ?";
  args.push(parseInt(lim) || 50, parseInt(off) || 0);

  res.json(db.prepare(sql).all(...args));
});

router.get("/voice/calls/:id", (req, res) => {
  const call = db.prepare("SELECT * FROM voice_calls WHERE id = ?").get(req.params.id);
  if (!call) return res.status(404).json({ error: "Ligação não encontrada." });
  const companyId = companyIdDoUsuario(req);
  if (call.companyId !== companyId && call.sellerId !== sellerIdDoUsuario(req) && req.user.role !== "admin") {
    return res.status(403).json({ error: "Sem permissão" });
  }

  const eventos = db.prepare("SELECT * FROM voice_call_events WHERE callId = ? ORDER BY criadoEm").all(call.id);
  res.json({ ...call, metadados: JSON.parse(call.metadados || "{}"), eventos });
});

// ── Indicadores ──────────────────────────────────────────────────────

router.get("/voice/stats", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });

  const { inicio, fim, sellerId: filterSeller, queueId, campaignId } = req.query;
  const de = parseInt(inicio) || (agora() - 86400000);
  const ate = parseInt(fim) || agora();

  let where = "c.companyId = ? AND c.criadoEm >= ? AND c.criadoEm <= ?";
  const args = [companyId, de, ate];
  if (req.user.role === "vendedor") { where += " AND c.sellerId = ?"; args.push(req.user.entityId); }
  if (filterSeller) { where += " AND c.sellerId = ?"; args.push(filterSeller); }
  if (queueId) { where += " AND c.queueId = ?"; args.push(queueId); }
  if (campaignId) { where += " AND c.campaignId = ?"; args.push(campaignId); }

  const stats = db.prepare(`
    SELECT
      COUNT(*) as totalLigacoes,
      SUM(CASE WHEN c.resultado IN ('atendeu','reuniao_agendada','venda','retornar') THEN 1 ELSE 0 END) as atendidas,
      SUM(CASE WHEN c.resultado = 'nao_atendeu' THEN 1 ELSE 0 END) as naoAtendidas,
      SUM(CASE WHEN c.resultado = 'reuniao_agendada' THEN 1 ELSE 0 END) as reunioes,
      SUM(CASE WHEN c.resultado = 'venda' THEN 1 ELSE 0 END) as vendas,
      SUM(CASE WHEN c.resultado = 'ocupado' THEN 1 ELSE 0 END) as ocupado,
      SUM(CASE WHEN c.resultado = 'caixa_postal' THEN 1 ELSE 0 END) as caixaPostal,
      SUM(CASE WHEN c.resultado = 'numero_invalido' THEN 1 ELSE 0 END) as numeroInvalido,
      SUM(CASE WHEN c.resultado = 'sem_interesse' THEN 1 ELSE 0 END) as semInteresse,
      SUM(c.duracaoTotal) as tempoTotal,
      AVG(CASE WHEN c.duracaoTotal > 0 THEN c.duracaoTotal END) as tempoMedio,
      SUM(CASE WHEN c.origemDados = 'declarado' THEN 1 ELSE 0 END) as declarados,
      SUM(CASE WHEN c.origemDados = 'verificado' THEN 1 ELSE 0 END) as verificados,
      SUM(CASE WHEN c.origemDados = 'simulado' THEN 1 ELSE 0 END) as simulados
    FROM voice_calls c WHERE ${where}
  `).get(...args);

  // Profissionais ativos
  const profAtivos = db.prepare(`
    SELECT COUNT(DISTINCT sellerId) as c FROM voice_sessions
    WHERE companyId = ? AND status = 'ativo'
  `).get(companyId)?.c || 0;

  const profPausados = db.prepare(`
    SELECT COUNT(DISTINCT sellerId) as c FROM voice_sessions
    WHERE companyId = ? AND status = 'pausado'
  `).get(companyId)?.c || 0;

  res.json({
    ...stats,
    profissionaisAtivos: profAtivos,
    profissionaisPausados: profPausados,
    taxaAtendimento: stats.totalLigacoes ? Math.round((stats.atendidas / stats.totalLigacoes) * 100) : 0,
    taxaConversao: stats.atendidas ? Math.round((stats.reunioes / stats.atendidas) * 100) : 0,
  });
});

// ── Desempenho individual ────────────────────────────────────────────

router.get("/voice/stats/sellers", (req, res) => {
  const companyId = exigirEmpresa(req, res);
  if (!companyId) return;

  const de = parseInt(req.query.inicio) || (agora() - 86400000);
  const ate = parseInt(req.query.fim) || agora();

  const sellers = db.prepare(`
    SELECT
      s.id, s.nome, s.email, s.perfil,
      vs.status as statusOperacional,
      vs.queueId,
      COUNT(c.id) as ligacoes,
      SUM(CASE WHEN c.resultado IN ('atendeu','reuniao_agendada','venda','retornar') THEN 1 ELSE 0 END) as atendidas,
      SUM(CASE WHEN c.resultado = 'reuniao_agendada' THEN 1 ELSE 0 END) as reunioes,
      SUM(CASE WHEN c.resultado = 'venda' THEN 1 ELSE 0 END) as vendas,
      SUM(c.duracaoTotal) as tempoTotal,
      MAX(c.criadoEm) as ultimaAtividade,
      SUM(CASE WHEN c.origemDados = 'declarado' THEN 1 ELSE 0 END) as declarados,
      SUM(CASE WHEN c.origemDados = 'simulado' THEN 1 ELSE 0 END) as simulados
    FROM sellers s
    LEFT JOIN voice_sessions vs ON vs.sellerId = s.id AND vs.companyId = ? AND vs.status IN ('ativo','pausado')
    LEFT JOIN voice_calls c ON c.sellerId = s.id AND c.companyId = ? AND c.criadoEm >= ? AND c.criadoEm <= ?
    WHERE s.id IN (SELECT sellerId FROM voice_queue_members WHERE queueId IN (SELECT id FROM voice_queues WHERE companyId = ?))
    GROUP BY s.id
    ORDER BY ligacoes DESC
  `).all(companyId, companyId, de, ate, companyId);

  res.json(sellers);
});

// ── Scripts ──────────────────────────────────────────────────────────

router.get("/voice/scripts", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });
  res.json(db.prepare("SELECT * FROM voice_scripts WHERE companyId = ? ORDER BY criadoEm DESC").all(companyId));
});

router.post("/voice/scripts", (req, res) => {
  const companyId = exigirEmpresa(req, res);
  if (!companyId) return;
  const { nome, campaignId, queueId, abertura, qualificacao, argumentacao, objecoes, encerramento, agendamento } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: "Nome obrigatório." });

  const now = agora();
  const id = uid();
  db.prepare(`INSERT INTO voice_scripts (id, companyId, campaignId, queueId, nome, abertura, qualificacao, argumentacao, objecoes, encerramento, agendamento, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, companyId, campaignId || null, queueId || null, nome.trim(),
    abertura || "", qualificacao || "", argumentacao || "", objecoes || "", encerramento || "", agendamento || "",
    now, now
  );
  res.json({ id });
});

router.put("/voice/scripts/:id", (req, res) => {
  const companyId = exigirEmpresa(req, res);
  if (!companyId) return;
  const script = db.prepare("SELECT * FROM voice_scripts WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
  if (!script) return res.status(404).json({ error: "Script não encontrado." });

  const b = req.body;
  const campos = [];
  const vals = [];
  for (const c of ["nome", "abertura", "qualificacao", "argumentacao", "objecoes", "encerramento", "agendamento", "ativo"]) {
    if (b[c] !== undefined) { campos.push(`${c} = ?`); vals.push(b[c]); }
  }
  if (campos.length) {
    campos.push("atualizadoEm = ?"); vals.push(agora());
    db.prepare(`UPDATE voice_scripts SET ${campos.join(",")} WHERE id = ?`).run(...vals, script.id);
  }
  res.json({ ok: true });
});

// ── DNC (Não ligar) ──────────────────────────────────────────────────

router.get("/voice/dnc", (req, res) => {
  const companyId = exigirEmpresa(req, res);
  if (!companyId) return;
  res.json(db.prepare("SELECT * FROM voice_do_not_call WHERE companyId = ? ORDER BY criadoEm DESC LIMIT 200").all(companyId));
});

router.post("/voice/dnc", (req, res) => {
  const companyId = exigirEmpresa(req, res);
  if (!companyId) return;
  const { telefone, motivo } = req.body;
  if (!telefone?.trim()) return res.status(400).json({ error: "Telefone obrigatório." });
  const id = uid();
  db.prepare("INSERT OR IGNORE INTO voice_do_not_call (id, companyId, telefone, motivo, criadoPor, criadoEm) VALUES (?, ?, ?, ?, ?, ?)").run(id, companyId, telefone.trim(), motivo || "", req.user.id, agora());
  res.json({ id });
});

router.delete("/voice/dnc/:id", (req, res) => {
  const companyId = exigirEmpresa(req, res);
  if (!companyId) return;
  db.prepare("DELETE FROM voice_do_not_call WHERE id = ? AND companyId = ?").run(req.params.id, companyId);
  res.json({ ok: true });
});

// ── Callbacks ────────────────────────────────────────────────────────

router.get("/voice/callbacks", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });

  let sql = `SELECT cb.*, l.nome as leadNome, l.empresa as leadEmpresa, l.telefone
    FROM voice_callbacks cb JOIN leads l ON l.id = cb.leadId WHERE cb.companyId = ?`;
  const args = [companyId];
  if (req.user.role === "vendedor") { sql += " AND cb.sellerId = ?"; args.push(req.user.entityId); }
  sql += " AND cb.status = 'pendente' ORDER BY cb.agendadoPara ASC LIMIT 50";
  res.json(db.prepare(sql).all(...args));
});

// ── Consumo / Uso ────────────────────────────────────────────────────

router.get("/voice/usage", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });

  const de = parseInt(req.query.inicio) || (agora() - 30 * 86400000);
  const ate = parseInt(req.query.fim) || agora();

  const uso = db.prepare(`
    SELECT
      SUM(minutos) as totalMinutos,
      SUM(custo) as totalCusto,
      SUM(CASE WHEN simulado = 1 THEN minutos ELSE 0 END) as minutosSimulados,
      COUNT(*) as totalEventos
    FROM voice_usage_events WHERE companyId = ? AND criadoEm >= ? AND criadoEm <= ?
  `).get(companyId, de, ate);

  const sip = db.prepare(`
    SELECT COUNT(*) as ligacoes, COALESCE(SUM(duracaoTarifavel), 0) / 60.0 as minutos
    FROM voice_calls WHERE companyId = ? AND providerId = 'sip' AND criadoEm >= ? AND criadoEm <= ?
  `).get(companyId, de, ate);

  res.json({
    ...(uso || { totalMinutos: 0, totalCusto: 0, minutosSimulados: 0, totalEventos: 0 }),
    ligacoesNavegador: sip.ligacoes,
    minutosVerificados: sip.minutos,
  });
});

// ── Audit logs ───────────────────────────────────────────────────────

router.get("/voice/audit", (req, res) => {
  const companyId = exigirEmpresa(req, res);
  if (!companyId) return;
  const logs = db.prepare("SELECT * FROM voice_audit_logs WHERE companyId = ? ORDER BY criadoEm DESC LIMIT 100").all(companyId);
  res.json(logs.map((l) => ({ ...l, dados: JSON.parse(l.dados || "{}") })));
});

// ── Consumo detalhado (billing records) ─────────────────────────────

router.get("/voice/billing", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });

  const de = parseInt(req.query.inicio) || (agora() - 30 * 86400000);
  const ate = parseInt(req.query.fim) || agora();
  const sellerId = req.query.sellerId || null;
  const campaignId = req.query.campaignId || null;

  let sql = `SELECT * FROM voice_billing_records WHERE companyId = ? AND criadoEm >= ? AND criadoEm <= ?`;
  const args = [companyId, de, ate];
  if (sellerId) { sql += " AND sellerId = ?"; args.push(sellerId); }
  if (campaignId) { sql += " AND campaignId = ?"; args.push(campaignId); }
  sql += " ORDER BY criadoEm DESC LIMIT 500";

  res.json(db.prepare(sql).all(...args));
});

router.get("/voice/billing/resumo", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });

  const de = parseInt(req.query.inicio) || (agora() - 30 * 86400000);
  const ate = parseInt(req.query.fim) || agora();

  const resumo = db.prepare(`
    SELECT
      COUNT(*) as totalChamadas,
      SUM(atendida) as totalAtendidas,
      SUM(duracaoTotal) as duracaoTotal,
      SUM(duracaoAtendida) as duracaoAtendida,
      SUM(duracaoTarifada) as duracaoTarifada,
      SUM(custoOperadora) as custoOperadora,
      SUM(valorComercial) as valorComercial,
      SUM(CASE WHEN tipoDestino = 'fixo' THEN 1 ELSE 0 END) as chamadasFixo,
      SUM(CASE WHEN tipoDestino = 'celular' THEN 1 ELSE 0 END) as chamadasCelular
    FROM voice_billing_records WHERE companyId = ? AND criadoEm >= ? AND criadoEm <= ?
  `).get(companyId, de, ate);

  res.json(resumo || {});
});

router.get("/voice/billing/por-profissional", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });

  const de = parseInt(req.query.inicio) || (agora() - 30 * 86400000);
  const ate = parseInt(req.query.fim) || agora();

  const rows = db.prepare(`
    SELECT sellerId,
      COUNT(*) as chamadas,
      SUM(atendida) as atendidas,
      SUM(duracaoAtendida) as minutos,
      SUM(duracaoTarifada) as minutosTarifados,
      SUM(custoOperadora) as custo
    FROM voice_billing_records WHERE companyId = ? AND criadoEm >= ? AND criadoEm <= ?
    GROUP BY sellerId ORDER BY custo DESC
  `).all(companyId, de, ate);

  res.json(rows);
});

router.get("/voice/billing/por-campanha", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });

  const de = parseInt(req.query.inicio) || (agora() - 30 * 86400000);
  const ate = parseInt(req.query.fim) || agora();

  const rows = db.prepare(`
    SELECT campaignId,
      COUNT(*) as chamadas,
      SUM(atendida) as atendidas,
      SUM(duracaoAtendida) as minutos,
      SUM(custoOperadora) as custo
    FROM voice_billing_records WHERE companyId = ? AND criadoEm >= ? AND criadoEm <= ? AND campaignId != ''
    GROUP BY campaignId ORDER BY custo DESC
  `).all(companyId, de, ate);

  res.json(rows);
});

// ── Limites multiempresa ────────────────────────────────────────────

router.get("/voice/admin/limits/:companyId", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas admin" });
  const limits = db.prepare("SELECT * FROM voice_company_limits WHERE companyId = ?").get(req.params.companyId);
  res.json(limits || { companyId: req.params.companyId, maxCanaisSimultaneos: 2, maxChamadasDia: 0, maxMinutosMes: 0 });
});

router.post("/voice/admin/limits", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas admin" });
  const { companyId, maxCanaisSimultaneos, maxChamadasDia, maxMinutosMes,
    prefixosBloqueados, operadoraSipId, didNumeros,
    custoMinutoFixo, custoMinutoCelular, valorComercialMinuto } = req.body;
  if (!companyId) return res.status(400).json({ error: "companyId obrigatório" });

  const now = agora();
  db.prepare(`
    INSERT INTO voice_company_limits (companyId, maxCanaisSimultaneos, maxChamadasDia, maxMinutosMes,
      prefixosBloqueados, operadoraSipId, didNumeros,
      custoMinutoFixo, custoMinutoCelular, valorComercialMinuto, atualizadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(companyId) DO UPDATE SET
      maxCanaisSimultaneos = COALESCE(excluded.maxCanaisSimultaneos, maxCanaisSimultaneos),
      maxChamadasDia = COALESCE(excluded.maxChamadasDia, maxChamadasDia),
      maxMinutosMes = COALESCE(excluded.maxMinutosMes, maxMinutosMes),
      prefixosBloqueados = COALESCE(excluded.prefixosBloqueados, prefixosBloqueados),
      operadoraSipId = COALESCE(excluded.operadoraSipId, operadoraSipId),
      didNumeros = COALESCE(excluded.didNumeros, didNumeros),
      custoMinutoFixo = COALESCE(excluded.custoMinutoFixo, custoMinutoFixo),
      custoMinutoCelular = COALESCE(excluded.custoMinutoCelular, custoMinutoCelular),
      valorComercialMinuto = COALESCE(excluded.valorComercialMinuto, valorComercialMinuto),
      atualizadoEm = excluded.atualizadoEm
  `).run(companyId,
    maxCanaisSimultaneos ?? 2, maxChamadasDia ?? 0, maxMinutosMes ?? 0,
    JSON.stringify(prefixosBloqueados || ["0900", "0300"]),
    operadoraSipId || "", JSON.stringify(didNumeros || []),
    custoMinutoFixo ?? 0, custoMinutoCelular ?? 0, valorComercialMinuto ?? 0, now);

  auditLog(companyId, req.user.id, "atualizar_limites", "voice_company_limits", companyId, req.body);
  res.json({ ok: true });
});

// ── Controle de canais simultâneos ──────────────────────────────────

router.get("/voice/channels/active", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });

  const ativos = db.prepare(`
    SELECT COUNT(*) as canaisAtivos FROM voice_calls
    WHERE companyId = ? AND status IN ('iniciada', 'chamando', 'em_andamento')
  `).get(companyId);

  const companyLimits = db.prepare("SELECT maxCanaisSimultaneos FROM voice_company_limits WHERE companyId = ?").get(companyId);
  const globalCfg = db.prepare("SELECT maxSimultaneosGlobal FROM voice_admin_config WHERE id = 'global'").get();
  const max = companyLimits?.maxCanaisSimultaneos || globalCfg?.maxSimultaneosGlobal || 10;

  res.json({ canaisAtivos: ativos?.canaisAtivos || 0, maxCanais: max, disponivel: (ativos?.canaisAtivos || 0) < max });
});

// ── Verificação de destino (bloqueio de prefixos, fraude) ───────────

router.post("/voice/check-destination", (req, res) => {
  const companyId = companyIdDoUsuario(req);
  if (!companyId) return res.status(403).json({ error: "Sem permissão" });

  const { telefone } = req.body;
  if (!telefone) return res.status(400).json({ error: "telefone obrigatório" });

  const limpo = telefone.replace(/\D/g, "");

  // DNC
  const dnc = db.prepare("SELECT 1 FROM voice_do_not_call WHERE companyId = ? AND telefone = ?").get(companyId, limpo);
  if (dnc) return res.json({ permitido: false, motivo: "Número na lista DNC" });

  // Prefixos bloqueados
  const limits = db.prepare("SELECT prefixosBloqueados FROM voice_company_limits WHERE companyId = ?").get(companyId);
  const bloqueados = JSON.parse(limits?.prefixosBloqueados || '["0900","0300"]');
  for (const p of bloqueados) {
    if (limpo.startsWith(p)) return res.json({ permitido: false, motivo: `Prefixo ${p} bloqueado` });
  }

  // Limite diário (só quando limites comerciais estão ativos)
  if (limitesCommerciaisAtivos()) {
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const chamadasHoje = db.prepare(`
      SELECT COUNT(*) as c FROM voice_calls WHERE companyId = ? AND criadoEm >= ?
    `).get(companyId, inicioDia.getTime());
    const companyLimits = db.prepare("SELECT maxChamadasDia FROM voice_company_limits WHERE companyId = ?").get(companyId);
    const maxDia = companyLimits?.maxChamadasDia || 0;
    if (maxDia > 0 && (chamadasHoje?.c || 0) >= maxDia) {
      return res.json({ permitido: false, motivo: "Limite diário de chamadas atingido" });
    }
  }

  // Tipo de destino
  const tipoDestino = limpo.length >= 10 && ["6", "7", "8", "9"].includes(limpo.charAt(limpo.length >= 11 ? 2 : 1)) ? "celular" : "fixo";

  res.json({ permitido: true, tipoDestino, telefone: limpo });
});

// ── Admin: listar consumo de todas as empresas ──────────────────────

router.get("/voice/admin/consumo", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas admin" });

  const de = parseInt(req.query.inicio) || (agora() - 30 * 86400000);
  const ate = parseInt(req.query.fim) || agora();

  const rows = db.prepare(`
    SELECT br.companyId, c.nome as empresa,
      COUNT(*) as chamadas,
      SUM(br.atendida) as atendidas,
      SUM(br.duracaoTarifada) as minutosTarifados,
      SUM(br.custoOperadora) as custoOperadora
    FROM voice_billing_records br
    LEFT JOIN companies c ON c.id = br.companyId
    WHERE br.criadoEm >= ? AND br.criadoEm <= ?
    GROUP BY br.companyId ORDER BY custoOperadora DESC
  `).all(de, ate);

  res.json(rows);
});

// ── Admin Telefonia — painel centralizado ──────────────────────────

router.get("/voice/admin/telefonia/resumo", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas admin" });

  const agr = agora();
  const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);

  const diario = db.prepare(`
    SELECT
      COUNT(*) as ligacoes,
      SUM(CASE WHEN resultado IN ('atendeu','reuniao_agendada','venda','retornar') THEN 1 ELSE 0 END) as atendidas,
      SUM(duracaoTotal) as segundos,
      SUM(CASE WHEN origemDados = 'verificado' THEN duracaoTotal ELSE 0 END) as segundosVerificados
    FROM voice_calls WHERE criadoEm >= ?
  `).get(inicioDia.getTime());

  const mensal = db.prepare(`
    SELECT
      COUNT(*) as ligacoes,
      SUM(CASE WHEN resultado IN ('atendeu','reuniao_agendada','venda','retornar') THEN 1 ELSE 0 END) as atendidas,
      SUM(duracaoTotal) as segundos,
      SUM(CASE WHEN origemDados = 'verificado' THEN duracaoTotal ELSE 0 END) as segundosVerificados
    FROM voice_calls WHERE criadoEm >= ?
  `).get(inicioMes.getTime());

  const custoMensal = db.prepare(`
    SELECT SUM(custoOperadora) as custo, SUM(valorComercial) as comercial
    FROM voice_billing_records WHERE criadoEm >= ?
  `).get(inicioMes.getTime());

  const porEmpresa = db.prepare(`
    SELECT c.companyId, co.nome as empresa,
      COUNT(*) as ligacoes,
      SUM(CASE WHEN c.resultado IN ('atendeu','reuniao_agendada','venda','retornar') THEN 1 ELSE 0 END) as atendidas,
      SUM(c.duracaoTotal) as segundos
    FROM voice_calls c
    LEFT JOIN companies co ON co.id = c.companyId
    WHERE c.criadoEm >= ?
    GROUP BY c.companyId ORDER BY ligacoes DESC LIMIT 50
  `).all(inicioMes.getTime());

  const porProfissional = db.prepare(`
    SELECT c.sellerId, s.nome as profissional, co.nome as empresa, c.companyId,
      COUNT(*) as ligacoes,
      SUM(CASE WHEN c.resultado IN ('atendeu','reuniao_agendada','venda','retornar') THEN 1 ELSE 0 END) as atendidas,
      SUM(c.duracaoTotal) as segundos
    FROM voice_calls c
    LEFT JOIN sellers s ON s.id = c.sellerId
    LEFT JOIN companies co ON co.id = c.companyId
    WHERE c.criadoEm >= ?
    GROUP BY c.sellerId ORDER BY ligacoes DESC LIMIT 100
  `).all(inicioMes.getTime());

  const porCampanha = db.prepare(`
    SELECT c.campaignId, camp.titulo as campanha, co.nome as empresa, c.companyId,
      COUNT(*) as ligacoes,
      SUM(CASE WHEN c.resultado IN ('atendeu','reuniao_agendada','venda','retornar') THEN 1 ELSE 0 END) as atendidas,
      SUM(c.duracaoTotal) as segundos
    FROM voice_calls c
    LEFT JOIN campaigns camp ON camp.id = c.campaignId
    LEFT JOIN companies co ON co.id = c.companyId
    WHERE c.criadoEm >= ? AND c.campaignId IS NOT NULL AND c.campaignId != ''
    GROUP BY c.campaignId ORDER BY ligacoes DESC LIMIT 50
  `).all(inicioMes.getTime());

  const sessoes = db.prepare(`
    SELECT COUNT(*) as ativas FROM voice_sessions WHERE status = 'ativo'
  `).get();

  const empresasHabilitadas = db.prepare(`
    SELECT COUNT(*) as c FROM companies WHERE voice_habilitada = 1
  `).get();

  res.json({
    diario: { ...diario, minutos: Math.round((diario.segundos || 0) / 60) },
    mensal: { ...mensal, minutos: Math.round((mensal.segundos || 0) / 60) },
    custoMensal: custoMensal || { custo: 0, comercial: 0 },
    porEmpresa,
    porProfissional,
    porCampanha,
    sessoesAtivas: sessoes?.ativas || 0,
    empresasHabilitadas: empresasHabilitadas?.c || 0,
  });
});

// Admin: configurações globais de limites (desativados por padrão)
router.get("/voice/admin/telefonia/config", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas admin" });

  const cfg = db.prepare("SELECT * FROM voice_admin_config WHERE id = 'global'").get();
  res.json(cfg || {
    id: "global",
    limitesAtivos: 0,
    maxChamadasDiaGlobal: 0,
    maxMinutosMesGlobal: 0,
    maxSimultaneosGlobal: 10,
    prefixosBloqueadosGlobal: '["0900","0300"]',
    telefoniaReal: 0,
  });
});

router.post("/voice/admin/telefonia/config", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas admin" });

  const { limitesAtivos, maxChamadasDiaGlobal, maxMinutosMesGlobal,
    maxSimultaneosGlobal, prefixosBloqueadosGlobal, telefoniaReal } = req.body;
  const now = agora();

  db.prepare(`
    INSERT INTO voice_admin_config (id, limitesAtivos, maxChamadasDiaGlobal, maxMinutosMesGlobal,
      maxSimultaneosGlobal, prefixosBloqueadosGlobal, telefoniaReal, atualizadoEm)
    VALUES ('global', ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      limitesAtivos = excluded.limitesAtivos,
      maxChamadasDiaGlobal = excluded.maxChamadasDiaGlobal,
      maxMinutosMesGlobal = excluded.maxMinutosMesGlobal,
      maxSimultaneosGlobal = excluded.maxSimultaneosGlobal,
      prefixosBloqueadosGlobal = excluded.prefixosBloqueadosGlobal,
      telefoniaReal = excluded.telefoniaReal,
      atualizadoEm = excluded.atualizadoEm
  `).run(
    limitesAtivos ? 1 : 0,
    maxChamadasDiaGlobal || 0,
    maxMinutosMesGlobal || 0,
    maxSimultaneosGlobal || 10,
    JSON.stringify(prefixosBloqueadosGlobal || ["0900", "0300"]),
    telefoniaReal ? 1 : 0,
    now
  );

  auditLog("GLOBAL", req.user.id, "atualizar_config_telefonia", "voice_admin_config", "global", req.body);
  res.json({ ok: true });
});

export default router;

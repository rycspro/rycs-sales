import db, { uid, agora } from "../../db.js";

const RESERVA_TTL = 10 * 60 * 1000; // 10 min padrão

export function proximoLead(queueId, sellerId) {
  const now = agora();

  // Liberar reservas expiradas
  db.prepare(`
    UPDATE voice_lead_reservations SET status = 'expirada', liberadoEm = ?
    WHERE queueId = ? AND status = 'ativa' AND expiraEm < ?
  `).run(now, queueId, now);

  // Verificar se o profissional já tem reserva ativa na fila
  const reservaAtiva = db.prepare(`
    SELECT * FROM voice_lead_reservations
    WHERE queueId = ? AND sellerId = ? AND status = 'ativa' AND expiraEm >= ?
  `).get(queueId, sellerId, now);

  if (reservaAtiva) {
    const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(reservaAtiva.leadId);
    return { reserva: reservaAtiva, lead };
  }

  // Buscar próximo lead disponível na fila
  const fila = db.prepare("SELECT * FROM voice_queues WHERE id = ?").get(queueId);
  if (!fila || fila.status !== "ativa") return null;

  // Leads disponíveis: status pendente, sem reserva ativa, respeitando tentativas e horário
  const candidato = db.prepare(`
    SELECT ql.* FROM voice_queue_leads ql
    WHERE ql.queueId = ? AND ql.status = 'pendente'
      AND ql.tentativas < ?
      AND NOT EXISTS (
        SELECT 1 FROM voice_lead_reservations r
        WHERE r.leadId = ql.leadId AND r.queueId = ql.queueId AND r.status = 'ativa' AND r.expiraEm >= ?
      )
      AND NOT EXISTS (
        SELECT 1 FROM voice_do_not_call dnc
        JOIN leads l ON l.id = ql.leadId
        WHERE dnc.companyId = ? AND dnc.telefone = l.telefone
      )
      AND (ql.proximaTentativa IS NULL OR ql.proximaTentativa <= ?)
    ORDER BY ql.prioridade DESC, ql.posicao ASC
    LIMIT 1
  `).get(queueId, fila.maxTentativas, now, fila.companyId, now);

  if (!candidato) return null;

  // Reservar atomicamente
  const reservaId = uid();
  const expira = now + RESERVA_TTL;

  const inserir = db.transaction(() => {
    // Double-check que não foi reservado entre o SELECT e agora
    const jaReservado = db.prepare(`
      SELECT 1 FROM voice_lead_reservations
      WHERE leadId = ? AND queueId = ? AND status = 'ativa' AND expiraEm >= ?
    `).get(candidato.leadId, queueId, now);

    if (jaReservado) return null;

    db.prepare(`
      INSERT INTO voice_lead_reservations (id, queueId, leadId, sellerId, status, expiraEm, criadoEm)
      VALUES (?, ?, ?, ?, 'ativa', ?, ?)
    `).run(reservaId, queueId, candidato.leadId, sellerId, expira, now);

    return reservaId;
  });

  const resultado = inserir();
  if (!resultado) return proximoLead(queueId, sellerId); // Retry

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(candidato.leadId);
  const reserva = db.prepare("SELECT * FROM voice_lead_reservations WHERE id = ?").get(reservaId);

  return { reserva, lead };
}

export function renovarReserva(reservaId, sellerId) {
  const now = agora();
  const reserva = db.prepare("SELECT * FROM voice_lead_reservations WHERE id = ? AND sellerId = ?").get(reservaId, sellerId);
  if (!reserva || reserva.status !== "ativa") return null;

  const novaExpira = now + RESERVA_TTL;
  db.prepare("UPDATE voice_lead_reservations SET expiraEm = ? WHERE id = ?").run(novaExpira, reservaId);
  return { ...reserva, expiraEm: novaExpira };
}

export function liberarReserva(reservaId, sellerId) {
  const now = agora();
  db.prepare(`
    UPDATE voice_lead_reservations SET status = 'concluida', liberadoEm = ?
    WHERE id = ? AND sellerId = ? AND status = 'ativa'
  `).run(now, reservaId, sellerId);
}

export function registrarTentativa(queueId, leadId, resultado) {
  const now = agora();
  const ql = db.prepare("SELECT * FROM voice_queue_leads WHERE queueId = ? AND leadId = ?").get(queueId, leadId);
  if (!ql) return;

  const fila = db.prepare("SELECT * FROM voice_queues WHERE id = ?").get(queueId);
  const novasTentativas = ql.tentativas + 1;
  const intervalo = (fila?.intervaloRetentativa || 3600) * 1000;

  const finalizado = resultado === "nao_ligar" || resultado === "numero_invalido" || novasTentativas >= (fila?.maxTentativas || 3);
  const novoStatus = finalizado ? "encerrado" : "pendente";
  const proximaTentativa = finalizado ? null : now + intervalo;

  db.prepare(`
    UPDATE voice_queue_leads
    SET tentativas = ?, ultimaTentativa = ?, proximaTentativa = ?, status = ?, atualizadoEm = ?
    WHERE queueId = ? AND leadId = ?
  `).run(novasTentativas, now, proximaTentativa, novoStatus, now, queueId, leadId);
}

export function adicionarLeadsNaFila(queueId, leadIds) {
  const now = agora();
  const fila = db.prepare("SELECT * FROM voice_queues WHERE id = ?").get(queueId);
  if (!fila) return { adicionados: 0 };

  const maxPos = db.prepare("SELECT MAX(posicao) as m FROM voice_queue_leads WHERE queueId = ?").get(queueId)?.m || 0;

  const inserir = db.prepare(`
    INSERT OR IGNORE INTO voice_queue_leads (id, queueId, leadId, posicao, status, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?, 'pendente', ?, ?)
  `);

  let adicionados = 0;
  const tx = db.transaction(() => {
    for (let i = 0; i < leadIds.length; i++) {
      const r = inserir.run(uid(), queueId, leadIds[i], maxPos + i + 1, now, now);
      if (r.changes) adicionados++;
    }
  });
  tx();

  return { adicionados };
}

export function estatisticasFila(queueId) {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) as pendentes,
      SUM(CASE WHEN status = 'encerrado' THEN 1 ELSE 0 END) as encerrados,
      SUM(CASE WHEN status = 'em_atendimento' THEN 1 ELSE 0 END) as emAtendimento
    FROM voice_queue_leads WHERE queueId = ?
  `).get(queueId);

  const reservasAtivas = db.prepare(`
    SELECT COUNT(*) as c FROM voice_lead_reservations
    WHERE queueId = ? AND status = 'ativa' AND expiraEm >= ?
  `).get(queueId, agora())?.c || 0;

  return { ...stats, reservasAtivas };
}

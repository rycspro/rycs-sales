// Calendário Comercial Integrado — CRUD de eventos, participantes e stats.
import { Router } from "express";
import db from "../db.js";

const router = Router();

const adicionarColuna = (tabela, coluna, tipo) => {
  try { db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`); } catch {}
};

// Garante que as tabelas existem (migration aditiva — roda na primeira vez).
function garantirTabelas() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      meetingType TEXT DEFAULT 'custom',
      status TEXT DEFAULT 'scheduled',
      platform TEXT DEFAULT 'google_meet',
      startAt INTEGER NOT NULL,
      endAt INTEGER NOT NULL,
      timezone TEXT DEFAULT 'America/Sao_Paulo',
      meetingLink TEXT,
      organizerName TEXT,
      organizerEmail TEXT,
      createdById TEXT,
      campaignId TEXT,
      leadId TEXT,
      companyId TEXT,
      notes TEXT,
      recordingEnabled INTEGER DEFAULT 0,
      transcriptionEnabled INTEGER DEFAULT 0,
      aiAnalysisEnabled INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cal_start ON calendar_events(startAt)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cal_status ON calendar_events(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cal_creator ON calendar_events(createdById)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cal_company ON calendar_events(companyId)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_event_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventId INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT DEFAULT 'guest',
      confirmationStatus TEXT DEFAULT 'pending',
      attended INTEGER DEFAULT 0,
      joinedAt INTEGER,
      leftAt INTEGER,
      createdAt INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_calp_event ON calendar_event_participants(eventId)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      professionalId TEXT NOT NULL,
      dayOfWeek INTEGER NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      timezone TEXT DEFAULT 'America/Sao_Paulo',
      isActive INTEGER DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_booking_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      professionalId TEXT,
      companyId TEXT,
      campaignId TEXT,
      meetingType TEXT DEFAULT 'custom',
      duration INTEGER DEFAULT 30,
      description TEXT,
      timezone TEXT DEFAULT 'America/Sao_Paulo',
      fieldsJson TEXT,
      status TEXT DEFAULT 'active',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
}

try { garantirTabelas(); } catch (e) { console.error("[calendario] erro ao criar tabelas:", e.message); }

const agora = () => Date.now();

// GET /api/calendario — lista eventos com filtros
router.get("/calendario", (req, res) => {
  try {
    const { startDate, endDate, status, meetingType, companyId } = req.query;
    let sql = "SELECT * FROM calendar_events WHERE 1=1";
    const params = [];
    if (startDate) { sql += " AND startAt >= ?"; params.push(Number(startDate)); }
    if (endDate) { sql += " AND startAt <= ?"; params.push(Number(endDate)); }
    if (status) { sql += " AND status = ?"; params.push(status); }
    if (meetingType) { sql += " AND meetingType = ?"; params.push(meetingType); }
    if (companyId) { sql += " AND companyId = ?"; params.push(companyId); }
    sql += " ORDER BY startAt ASC";
    const events = db.prepare(sql).all(...params);
    const participantStmt = db.prepare("SELECT * FROM calendar_event_participants WHERE eventId = ?");
    const result = events.map((e) => ({ ...e, participants: participantStmt.all(e.id) }));
    res.json(result);
  } catch (e) {
    res.json([]);
  }
});

// GET /api/calendario/:id
router.get("/calendario/:id", (req, res) => {
  try {
    const event = db.prepare("SELECT * FROM calendar_events WHERE id = ?").get(req.params.id);
    if (!event) return res.status(404).json({ error: "Evento não encontrado" });
    event.participants = db.prepare("SELECT * FROM calendar_event_participants WHERE eventId = ?").all(event.id);
    res.json(event);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/calendario — cria evento
router.post("/calendario", (req, res) => {
  try {
    const { title, description, meetingType, platform, startAt, endAt, timezone,
      meetingLink, companyId, campaignId, leadId, notes,
      enableRecording, enableTranscription, enableAiAnalysis, participants } = req.body;
    if (!title || !startAt || !endAt) return res.status(400).json({ error: "Título, início e fim são obrigatórios." });
    const now = agora();
    const result = db.prepare(`
      INSERT INTO calendar_events (title, description, meetingType, status, platform,
        startAt, endAt, timezone, meetingLink, organizerName, organizerEmail,
        createdById, campaignId, leadId, companyId, notes,
        recordingEnabled, transcriptionEnabled, aiAnalysisEnabled, createdAt, updatedAt)
      VALUES (?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, description || null, meetingType || "custom", platform || "google_meet",
      startAt, endAt, timezone || "America/Sao_Paulo", meetingLink || null,
      req.user?.nome || "Organizador", req.user?.email || null,
      req.user?.id || "system", campaignId || null, leadId || null, companyId || null,
      notes || null, enableRecording ? 1 : 0, enableTranscription ? 1 : 0,
      enableAiAnalysis ? 1 : 0, now, now
    );
    const eventId = result.lastInsertRowid;
    if (participants?.length) {
      const ins = db.prepare(`INSERT INTO calendar_event_participants (eventId, name, email, phone, role, confirmationStatus, createdAt) VALUES (?, ?, ?, ?, ?, 'pending', ?)`);
      for (const p of participants) {
        ins.run(eventId, p.name, p.email || null, p.phone || null, p.role || "guest", now);
      }
    }
    res.json({ success: true, id: Number(eventId) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/calendario/:id/status — atualiza status
router.post("/calendario/:id/status", (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status é obrigatório." });
    db.prepare("UPDATE calendar_events SET status = ?, updatedAt = ? WHERE id = ?").run(status, agora(), req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/calendario/:id — atualiza evento
router.patch("/calendario/:id", (req, res) => {
  try {
    const fields = ["title", "description", "meetingType", "platform", "startAt", "endAt",
      "timezone", "meetingLink", "notes", "status"];
    const sets = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (req.body.enableRecording !== undefined) { sets.push("recordingEnabled = ?"); params.push(req.body.enableRecording ? 1 : 0); }
    if (req.body.enableTranscription !== undefined) { sets.push("transcriptionEnabled = ?"); params.push(req.body.enableTranscription ? 1 : 0); }
    if (req.body.enableAiAnalysis !== undefined) { sets.push("aiAnalysisEnabled = ?"); params.push(req.body.enableAiAnalysis ? 1 : 0); }
    if (!sets.length) return res.json({ success: true });
    sets.push("updatedAt = ?");
    params.push(agora());
    params.push(req.params.id);
    db.prepare(`UPDATE calendar_events SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/calendario/:id
router.delete("/calendario/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM calendar_event_participants WHERE eventId = ?").run(req.params.id);
    db.prepare("DELETE FROM calendar_events WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/calendario-stats
router.get("/calendario-stats", (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let sql = "SELECT status, COUNT(*) as cnt FROM calendar_events WHERE 1=1";
    const params = [];
    if (startDate) { sql += " AND startAt >= ?"; params.push(Number(startDate)); }
    if (endDate) { sql += " AND startAt <= ?"; params.push(Number(endDate)); }
    sql += " GROUP BY status";
    const rows = db.prepare(sql).all(...params);
    const stats = { scheduled: 0, confirmed: 0, completed: 0, noShow: 0, cancelled: 0, total: 0 };
    for (const r of rows) {
      if (r.status === "scheduled") stats.scheduled = r.cnt;
      else if (r.status === "confirmed") stats.confirmed = r.cnt;
      else if (r.status === "completed") stats.completed = r.cnt;
      else if (r.status === "no_show") stats.noShow = r.cnt;
      else if (r.status === "cancelled") stats.cancelled = r.cnt;
      stats.total += r.cnt;
    }
    res.json(stats);
  } catch (e) {
    res.json({ scheduled: 0, confirmed: 0, completed: 0, noShow: 0, cancelled: 0, total: 0 });
  }
});

export default router;

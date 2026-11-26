// Calendário Comercial Integrado — Lote 1: schema + CRUD
// Tabelas do calendário de reuniões, disponibilidade e links de agendamento.

export function criarSchemaCalendario(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      meetingType TEXT NOT NULL DEFAULT 'custom',
      status TEXT NOT NULL DEFAULT 'scheduled',
      platform TEXT NOT NULL DEFAULT 'google_meet',
      startAt INTEGER NOT NULL,
      endAt INTEGER NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
      meetingLink TEXT DEFAULT '',
      organizerName TEXT NOT NULL DEFAULT '',
      organizerEmail TEXT DEFAULT '',
      createdById TEXT DEFAULT '',
      campaignId TEXT DEFAULT '',
      leadId TEXT DEFAULT '',
      companyId TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      recordingEnabled INTEGER NOT NULL DEFAULT 0,
      transcriptionEnabled INTEGER NOT NULL DEFAULT 0,
      aiAnalysisEnabled INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cal_events_startAt ON calendar_events(startAt);
    CREATE INDEX IF NOT EXISTS idx_cal_events_status ON calendar_events(status);
    CREATE INDEX IF NOT EXISTS idx_cal_events_createdById ON calendar_events(createdById);
    CREATE INDEX IF NOT EXISTS idx_cal_events_companyId ON calendar_events(companyId);

    CREATE TABLE IF NOT EXISTS calendar_event_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventId INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'guest',
      confirmationStatus TEXT NOT NULL DEFAULT 'pending',
      attended INTEGER NOT NULL DEFAULT 0,
      joinedAt INTEGER,
      leftAt INTEGER,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cal_participants_eventId ON calendar_event_participants(eventId);

    CREATE TABLE IF NOT EXISTS calendar_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      professionalId TEXT NOT NULL,
      dayOfWeek INTEGER NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cal_avail_professional ON calendar_availability(professionalId, isActive);

    CREATE TABLE IF NOT EXISTS calendar_booking_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      professionalId TEXT DEFAULT '',
      companyId TEXT DEFAULT '',
      campaignId TEXT DEFAULT '',
      meetingType TEXT NOT NULL DEFAULT 'custom',
      duration INTEGER NOT NULL DEFAULT 30,
      description TEXT DEFAULT '',
      timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
      fieldsJson TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cal_booking_slug ON calendar_booking_links(slug);
  `);
}

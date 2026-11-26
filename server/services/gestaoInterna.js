// Gestão Interna — schema e helpers para Meu Time, Metas e Desempenho, Fechamentos.

export function criarSchemaGestaoInterna(db) {
  // ── Departamentos ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_dept_company ON departments(companyId)`);

  // ── Colaboradores internos ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS internal_team (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId TEXT NOT NULL,
      userId TEXT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      photo TEXT,
      role TEXT DEFAULT 'colaborador',
      jobTitle TEXT DEFAULT 'Vendedor',
      departmentId INTEGER REFERENCES departments(id),
      managerId INTEGER REFERENCES internal_team(id),
      startDate INTEGER,
      weeklyHours REAL,
      compensationModel TEXT DEFAULT 'nao_informado',
      baseSalary REAL,
      commissionPercent REAL,
      taskRate REAL,
      compensationNotes TEXT,
      accessLevel TEXT DEFAULT 'colaborador',
      permissions TEXT,
      status TEXT DEFAULT 'active',
      inviteToken TEXT,
      inviteExpiresAt INTEGER,
      inviteSentAt INTEGER,
      inviteAcceptedAt INTEGER,
      lastActivityAt INTEGER,
      deactivatedAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_it_company ON internal_team(companyId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_it_user ON internal_team(userId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_it_status ON internal_team(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_it_invite ON internal_team(inviteToken)`);

  // ── Metas ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId TEXT NOT NULL,
      name TEXT NOT NULL,
      indicatorType TEXT NOT NULL,
      targetValue REAL NOT NULL,
      currentValue REAL DEFAULT 0,
      scope TEXT DEFAULT 'individual',
      assigneeId INTEGER,
      departmentId INTEGER,
      startDate INTEGER NOT NULL,
      endDate INTEGER NOT NULL,
      recurrence TEXT,
      status TEXT DEFAULT 'in_progress',
      createdById TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_goals_company ON goals(companyId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_goals_assignee ON goals(assigneeId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status)`);

  // ── Pipeline de fechamentos (etapas personalizáveis) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS closing_pipeline_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#318CE7',
      position INTEGER DEFAULT 0,
      isInitial INTEGER DEFAULT 0,
      isCompletion INTEGER DEFAULT 0,
      isArchived INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cps_company ON closing_pipeline_stages(companyId)`);

  // ── Fechamentos (vendas) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS closings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyId TEXT NOT NULL,
      clientName TEXT NOT NULL,
      clientEmail TEXT,
      clientPhone TEXT,
      leadId TEXT,
      dealId TEXT,
      productOrService TEXT,
      description TEXT,
      sellerId INTEGER,
      sellerName TEXT,
      origin TEXT DEFAULT 'internal',
      campaignId TEXT,
      totalValue REAL NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'BRL',
      closingDate INTEGER NOT NULL,
      paymentMethod TEXT,
      commissionValue REAL,
      commissionPercent REAL,
      notes TEXT,
      attachments TEXT,
      validationStatus TEXT DEFAULT 'pending',
      validatedById TEXT,
      validatedAt INTEGER,
      validationNotes TEXT,
      stageId INTEGER REFERENCES closing_pipeline_stages(id),
      customFields TEXT,
      createdById TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cls_company ON closings(companyId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cls_seller ON closings(sellerId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cls_stage ON closings(stageId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cls_validation ON closings(validationStatus)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cls_date ON closings(closingDate)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cls_deal ON closings(dealId)`);

  // ── Histórico de movimentações de fechamentos ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS closing_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      closingId INTEGER NOT NULL REFERENCES closings(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      fromStageId INTEGER,
      toStageId INTEGER,
      fromStatus TEXT,
      toStatus TEXT,
      notes TEXT,
      performedById TEXT,
      performedByName TEXT,
      createdAt INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_clh_closing ON closing_history(closingId)`);
}

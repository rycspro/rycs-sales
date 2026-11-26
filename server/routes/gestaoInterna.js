// Gestão Interna — Meu Time, Metas e Desempenho, Fechamentos.
import { Router } from "express";
import db from "../db.js";
import { randomBytes } from "crypto";

const router = Router();

function garantirTabelas() {
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

try { garantirTabelas(); } catch (e) { console.error("[gestao-interna] erro ao criar tabelas:", e.message); }

const getCompanyId = (req) => req.user?.companyId || req.user?.empresa;

// ═══════════════════════════════════════════════════════════════
// DEPARTAMENTOS
// ═══════════════════════════════════════════════════════════════

router.get("/gestao/departments", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const rows = db.prepare("SELECT * FROM departments WHERE companyId = ? AND isActive = 1 ORDER BY name ASC").all(companyId);
    res.json(rows);
  } catch (e) { res.json([]); }
});

router.post("/gestao/departments", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório." });
    const now = Date.now();
    const result = db.prepare(
      "INSERT INTO departments (companyId, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)"
    ).run(companyId, name, description || null, now, now);
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch("/gestao/departments/:id", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { name, description, isActive } = req.body;
    const sets = []; const params = [];
    if (name !== undefined) { sets.push("name = ?"); params.push(name); }
    if (description !== undefined) { sets.push("description = ?"); params.push(description); }
    if (isActive !== undefined) { sets.push("isActive = ?"); params.push(isActive ? 1 : 0); }
    if (!sets.length) return res.json({ success: true });
    sets.push("updatedAt = ?"); params.push(Date.now());
    params.push(req.params.id, companyId);
    db.prepare(`UPDATE departments SET ${sets.join(", ")} WHERE id = ? AND companyId = ?`).run(...params);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// MEU TIME
// ═══════════════════════════════════════════════════════════════

router.get("/gestao/team", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { status, departmentId, role, search } = req.query;
    let sql = "SELECT t.*, d.name as departmentName FROM internal_team t LEFT JOIN departments d ON t.departmentId = d.id WHERE t.companyId = ?";
    const params = [companyId];
    if (status) { sql += " AND t.status = ?"; params.push(status); }
    if (departmentId) { sql += " AND t.departmentId = ?"; params.push(Number(departmentId)); }
    if (role) { sql += " AND t.jobTitle = ?"; params.push(role); }
    if (search) {
      sql += " AND (t.name LIKE '%' || ? || '%' OR t.email LIKE '%' || ? || '%' OR t.jobTitle LIKE '%' || ? || '%')";
      params.push(search, search, search);
    }
    sql += " ORDER BY t.name ASC";
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) { res.json([]); }
});

router.get("/gestao/team-stats", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const rows = db.prepare("SELECT status, COUNT(*) as cnt FROM internal_team WHERE companyId = ? GROUP BY status").all(companyId);
    const stats = { total: 0, active: 0, invited: 0, deactivated: 0 };
    for (const r of rows) {
      stats.total += r.cnt;
      if (r.status === "active") stats.active = r.cnt;
      else if (r.status === "invited") stats.invited = r.cnt;
      else if (r.status === "deactivated") stats.deactivated = r.cnt;
    }
    res.json(stats);
  } catch (e) { res.json({ total: 0, active: 0, invited: 0, deactivated: 0 }); }
});

router.get("/gestao/team/:id", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const member = db.prepare(
      "SELECT t.*, d.name as departmentName FROM internal_team t LEFT JOIN departments d ON t.departmentId = d.id WHERE t.id = ? AND t.companyId = ?"
    ).get(req.params.id, companyId);
    if (!member) return res.status(404).json({ error: "Colaborador não encontrado." });
    if (member.managerId) {
      member.manager = db.prepare("SELECT id, name, jobTitle FROM internal_team WHERE id = ?").get(member.managerId);
    }
    res.json(member);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/gestao/team", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { name, email, phone, photo, jobTitle, departmentId, managerId, startDate,
      weeklyHours, compensationModel, baseSalary, commissionPercent, taskRate,
      compensationNotes, accessLevel, permissions } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório." });
    const now = Date.now();
    const result = db.prepare(`
      INSERT INTO internal_team (companyId, name, email, phone, photo, jobTitle, departmentId,
        managerId, startDate, weeklyHours, compensationModel, baseSalary, commissionPercent,
        taskRate, compensationNotes, accessLevel, permissions, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      companyId, name, email || null, phone || null, photo || null,
      jobTitle || "Vendedor", departmentId || null, managerId || null,
      startDate || null, weeklyHours || null, compensationModel || "nao_informado",
      baseSalary || null, commissionPercent || null, taskRate || null,
      compensationNotes || null, accessLevel || "colaborador",
      permissions ? JSON.stringify(permissions) : null, now, now
    );
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch("/gestao/team/:id", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const fields = ["name", "email", "phone", "photo", "jobTitle", "departmentId",
      "managerId", "startDate", "weeklyHours", "compensationModel", "baseSalary",
      "commissionPercent", "taskRate", "compensationNotes", "accessLevel"];
    const sets = []; const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (req.body.permissions !== undefined) {
      sets.push("permissions = ?");
      params.push(JSON.stringify(req.body.permissions));
    }
    if (!sets.length) return res.json({ success: true });
    sets.push("updatedAt = ?"); params.push(Date.now());
    params.push(req.params.id, companyId);
    db.prepare(`UPDATE internal_team SET ${sets.join(", ")} WHERE id = ? AND companyId = ?`).run(...params);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/gestao/team/:id/status", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status é obrigatório." });
    const now = Date.now();
    const extra = status === "deactivated" ? ", deactivatedAt = ?" : "";
    const params = [status, now];
    if (status === "deactivated") params.push(now);
    params.push(req.params.id, companyId);
    db.prepare(`UPDATE internal_team SET status = ?, updatedAt = ?${extra} WHERE id = ? AND companyId = ?`).run(...params);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/gestao/team/:id/invite", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const token = randomBytes(32).toString("hex");
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days
    db.prepare(
      "UPDATE internal_team SET inviteToken = ?, inviteExpiresAt = ?, inviteSentAt = ?, status = 'invited', updatedAt = ? WHERE id = ? AND companyId = ?"
    ).run(token, expiresAt, now, now, req.params.id, companyId);
    res.json({ success: true, token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// METAS
// ═══════════════════════════════════════════════════════════════

router.get("/gestao/goals", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { status, scope, assigneeId, startDate, endDate } = req.query;
    let sql = "SELECT g.*, t.name as assigneeName, d.name as departmentName FROM goals g LEFT JOIN internal_team t ON g.assigneeId = t.id LEFT JOIN departments d ON g.departmentId = d.id WHERE g.companyId = ?";
    const params = [companyId];
    if (status) { sql += " AND g.status = ?"; params.push(status); }
    if (scope) { sql += " AND g.scope = ?"; params.push(scope); }
    if (assigneeId) { sql += " AND g.assigneeId = ?"; params.push(Number(assigneeId)); }
    if (startDate) { sql += " AND g.endDate >= ?"; params.push(Number(startDate)); }
    if (endDate) { sql += " AND g.startDate <= ?"; params.push(Number(endDate)); }
    sql += " ORDER BY g.endDate ASC";
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) { res.json([]); }
});

router.get("/gestao/goals-summary", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const rows = db.prepare("SELECT status, COUNT(*) as cnt FROM goals WHERE companyId = ? GROUP BY status").all(companyId);
    const stats = { total: 0, in_progress: 0, achieved: 0, exceeded: 0, not_achieved: 0 };
    for (const r of rows) {
      stats.total += r.cnt;
      if (stats[r.status] !== undefined) stats[r.status] = r.cnt;
    }
    res.json(stats);
  } catch (e) { res.json({ total: 0, in_progress: 0, achieved: 0, exceeded: 0, not_achieved: 0 }); }
});

router.get("/gestao/goals/:id", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const goal = db.prepare(
      "SELECT g.*, t.name as assigneeName, d.name as departmentName FROM goals g LEFT JOIN internal_team t ON g.assigneeId = t.id LEFT JOIN departments d ON g.departmentId = d.id WHERE g.id = ? AND g.companyId = ?"
    ).get(req.params.id, companyId);
    if (!goal) return res.status(404).json({ error: "Meta não encontrada." });
    res.json(goal);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/gestao/goals", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { name, indicatorType, targetValue, scope, assigneeId, departmentId,
      startDate, endDate, recurrence } = req.body;
    if (!name || !indicatorType || !targetValue || !startDate || !endDate) {
      return res.status(400).json({ error: "Nome, indicador, valor, início e fim são obrigatórios." });
    }
    const now = Date.now();
    const result = db.prepare(`
      INSERT INTO goals (companyId, name, indicatorType, targetValue, scope, assigneeId,
        departmentId, startDate, endDate, recurrence, createdById, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, name, indicatorType, targetValue, scope || "individual",
      assigneeId || null, departmentId || null, startDate, endDate,
      recurrence || null, req.user?.id || "system", now, now
    );
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch("/gestao/goals/:id", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const fields = ["name", "indicatorType", "targetValue", "currentValue", "scope",
      "assigneeId", "departmentId", "startDate", "endDate", "recurrence", "status"];
    const sets = []; const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (!sets.length) return res.json({ success: true });
    sets.push("updatedAt = ?"); params.push(Date.now());
    params.push(req.params.id, companyId);
    db.prepare(`UPDATE goals SET ${sets.join(", ")} WHERE id = ? AND companyId = ?`).run(...params);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/gestao/goals/:id", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    db.prepare("DELETE FROM goals WHERE id = ? AND companyId = ?").run(req.params.id, companyId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// PIPELINE STAGES
// ═══════════════════════════════════════════════════════════════

router.get("/gestao/pipeline-stages", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    let rows = db.prepare(
      "SELECT * FROM closing_pipeline_stages WHERE companyId = ? AND isArchived = 0 ORDER BY position ASC"
    ).all(companyId);
    if (rows.length === 0) {
      const now = Date.now();
      const defaults = [
        { name: "Venda registrada", position: 0, isInitial: 1, isCompletion: 0 },
        { name: "Em processamento", position: 1, isInitial: 0, isCompletion: 0 },
        { name: "Em acompanhamento", position: 2, isInitial: 0, isCompletion: 0 },
        { name: "Concluído", position: 3, isInitial: 0, isCompletion: 1 },
      ];
      const ins = db.prepare(
        "INSERT INTO closing_pipeline_stages (companyId, name, position, isInitial, isCompletion, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const d of defaults) ins.run(companyId, d.name, d.position, d.isInitial, d.isCompletion, now, now);
      rows = db.prepare(
        "SELECT * FROM closing_pipeline_stages WHERE companyId = ? AND isArchived = 0 ORDER BY position ASC"
      ).all(companyId);
    }
    res.json(rows);
  } catch (e) { res.json([]); }
});

router.post("/gestao/pipeline-stages", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { name, color, isInitial, isCompletion } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório." });
    const now = Date.now();
    const maxPos = db.prepare(
      "SELECT MAX(position) as mx FROM closing_pipeline_stages WHERE companyId = ?"
    ).get(companyId);
    const position = (maxPos?.mx ?? -1) + 1;
    const result = db.prepare(`
      INSERT INTO closing_pipeline_stages (companyId, name, color, position, isInitial, isCompletion, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(companyId, name, color || "#318CE7", position, isInitial ? 1 : 0, isCompletion ? 1 : 0, now, now);
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch("/gestao/pipeline-stages/:id", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const fields = ["name", "color", "isInitial", "isCompletion", "isArchived"];
    const sets = []; const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(typeof req.body[f] === "boolean" ? (req.body[f] ? 1 : 0) : req.body[f]); }
    }
    if (!sets.length) return res.json({ success: true });
    sets.push("updatedAt = ?"); params.push(Date.now());
    params.push(req.params.id, companyId);
    db.prepare(`UPDATE closing_pipeline_stages SET ${sets.join(", ")} WHERE id = ? AND companyId = ?`).run(...params);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/gestao/pipeline-stages/reorder", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { stages } = req.body;
    if (!Array.isArray(stages)) return res.status(400).json({ error: "Lista de etapas é obrigatória." });
    const now = Date.now();
    const upd = db.prepare("UPDATE closing_pipeline_stages SET position = ?, updatedAt = ? WHERE id = ? AND companyId = ?");
    for (const s of stages) upd.run(s.position, now, s.id, companyId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// FECHAMENTOS
// ═══════════════════════════════════════════════════════════════

router.get("/gestao/closings", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { startDate, endDate, sellerId, origin, validationStatus, stageId, search, minValue, maxValue } = req.query;
    let sql = "SELECT c.*, s.name as stageName, s.color as stageColor FROM closings c LEFT JOIN closing_pipeline_stages s ON c.stageId = s.id WHERE c.companyId = ?";
    const params = [companyId];
    if (startDate) { sql += " AND c.closingDate >= ?"; params.push(Number(startDate)); }
    if (endDate) { sql += " AND c.closingDate <= ?"; params.push(Number(endDate)); }
    if (sellerId) { sql += " AND c.sellerId = ?"; params.push(Number(sellerId)); }
    if (origin) { sql += " AND c.origin = ?"; params.push(origin); }
    if (validationStatus) { sql += " AND c.validationStatus = ?"; params.push(validationStatus); }
    if (stageId) { sql += " AND c.stageId = ?"; params.push(Number(stageId)); }
    if (minValue) { sql += " AND c.totalValue >= ?"; params.push(Number(minValue)); }
    if (maxValue) { sql += " AND c.totalValue <= ?"; params.push(Number(maxValue)); }
    if (search) {
      sql += " AND (c.clientName LIKE '%' || ? || '%' OR c.productOrService LIKE '%' || ? || '%' OR c.sellerName LIKE '%' || ? || '%')";
      params.push(search, search, search);
    }
    sql += " ORDER BY c.closingDate DESC";
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) { res.json([]); }
});

router.get("/gestao/closings-stats", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { startDate, endDate } = req.query;
    let where = "companyId = ?";
    const params = [companyId];
    if (startDate) { where += " AND closingDate >= ?"; params.push(Number(startDate)); }
    if (endDate) { where += " AND closingDate <= ?"; params.push(Number(endDate)); }

    const confirmed = db.prepare(`SELECT COUNT(*) as cnt, COALESCE(SUM(totalValue), 0) as total, COALESCE(SUM(commissionValue), 0) as comissoes FROM closings WHERE ${where} AND validationStatus = 'confirmed'`).get(...params);
    const pending = db.prepare(`SELECT COUNT(*) as cnt FROM closings WHERE ${where} AND validationStatus = 'pending'`).get(...params);
    const cancelled = db.prepare(`SELECT COUNT(*) as cnt FROM closings WHERE ${where} AND validationStatus = 'cancelled'`).get(...params);
    const allRows = db.prepare(`SELECT COUNT(*) as cnt, COALESCE(SUM(totalValue), 0) as total FROM closings WHERE ${where}`).get(...params);

    res.json({
      totalValue: confirmed.total,
      count: confirmed.cnt,
      avgTicket: confirmed.cnt > 0 ? Math.round(confirmed.total / confirmed.cnt * 100) / 100 : 0,
      commissions: confirmed.comissoes,
      pendingCount: pending.cnt,
      cancelledCount: cancelled.cnt,
      allCount: allRows.cnt,
      allValue: allRows.total,
    });
  } catch (e) {
    res.json({ totalValue: 0, count: 0, avgTicket: 0, commissions: 0, pendingCount: 0, cancelledCount: 0, allCount: 0, allValue: 0 });
  }
});

router.get("/gestao/closings/:id", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const closing = db.prepare(
      "SELECT c.*, s.name as stageName, s.color as stageColor FROM closings c LEFT JOIN closing_pipeline_stages s ON c.stageId = s.id WHERE c.id = ? AND c.companyId = ?"
    ).get(req.params.id, companyId);
    if (!closing) return res.status(404).json({ error: "Fechamento não encontrado." });
    closing.history = db.prepare("SELECT * FROM closing_history WHERE closingId = ? ORDER BY createdAt DESC").all(closing.id);
    res.json(closing);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/gestao/closings", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { clientName, clientEmail, clientPhone, leadId, dealId, productOrService,
      description, sellerId, sellerName, origin, campaignId, totalValue, currency,
      closingDate, paymentMethod, commissionValue, commissionPercent, notes,
      customFields } = req.body;
    if (!clientName || totalValue === undefined || !closingDate) {
      return res.status(400).json({ error: "Cliente, valor e data são obrigatórios." });
    }
    if (dealId) {
      const dup = db.prepare("SELECT id FROM closings WHERE dealId = ? AND companyId = ?").get(dealId, companyId);
      if (dup) return res.status(409).json({ error: "Já existe um fechamento para este negócio." });
    }
    const now = Date.now();
    const initialStage = db.prepare(
      "SELECT id FROM closing_pipeline_stages WHERE companyId = ? AND isInitial = 1 AND isArchived = 0 LIMIT 1"
    ).get(companyId);

    const result = db.prepare(`
      INSERT INTO closings (companyId, clientName, clientEmail, clientPhone, leadId, dealId,
        productOrService, description, sellerId, sellerName, origin, campaignId, totalValue,
        currency, closingDate, paymentMethod, commissionValue, commissionPercent, notes,
        stageId, customFields, createdById, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, clientName, clientEmail || null, clientPhone || null,
      leadId || null, dealId || null, productOrService || null, description || null,
      sellerId || null, sellerName || null, origin || "internal", campaignId || null,
      totalValue, currency || "BRL", closingDate, paymentMethod || null,
      commissionValue || null, commissionPercent || null, notes || null,
      initialStage?.id || null, customFields ? JSON.stringify(customFields) : null,
      req.user?.id || "system", now, now
    );
    const closingId = Number(result.lastInsertRowid);

    db.prepare(
      "INSERT INTO closing_history (closingId, action, toStageId, toStatus, performedById, performedByName, createdAt) VALUES (?, 'created', ?, 'pending', ?, ?, ?)"
    ).run(closingId, initialStage?.id || null, req.user?.id || "system", req.user?.nome || "Sistema", now);

    res.json({ success: true, id: closingId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch("/gestao/closings/:id", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const fields = ["clientName", "clientEmail", "clientPhone", "productOrService",
      "description", "sellerId", "sellerName", "origin", "campaignId", "totalValue",
      "currency", "closingDate", "paymentMethod", "commissionValue", "commissionPercent",
      "notes"];
    const sets = []; const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (req.body.customFields !== undefined) {
      sets.push("customFields = ?"); params.push(JSON.stringify(req.body.customFields));
    }
    if (!sets.length) return res.json({ success: true });
    sets.push("updatedAt = ?"); params.push(Date.now());
    params.push(req.params.id, companyId);
    db.prepare(`UPDATE closings SET ${sets.join(", ")} WHERE id = ? AND companyId = ?`).run(...params);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/gestao/closings/:id/validate", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { validationStatus, notes } = req.body;
    if (!validationStatus) return res.status(400).json({ error: "Status é obrigatório." });
    const now = Date.now();
    const old = db.prepare("SELECT validationStatus FROM closings WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
    if (!old) return res.status(404).json({ error: "Fechamento não encontrado." });

    db.prepare(
      "UPDATE closings SET validationStatus = ?, validatedById = ?, validatedAt = ?, validationNotes = ?, updatedAt = ? WHERE id = ? AND companyId = ?"
    ).run(validationStatus, req.user?.id || "system", now, notes || null, now, req.params.id, companyId);

    db.prepare(
      "INSERT INTO closing_history (closingId, action, fromStatus, toStatus, notes, performedById, performedByName, createdAt) VALUES (?, 'validation', ?, ?, ?, ?, ?, ?)"
    ).run(req.params.id, old.validationStatus, validationStatus, notes || null, req.user?.id || "system", req.user?.nome || "Sistema", now);

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/gestao/closings/:id/move", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { stageId, notes } = req.body;
    if (!stageId) return res.status(400).json({ error: "Etapa é obrigatória." });
    const now = Date.now();
    const old = db.prepare("SELECT stageId FROM closings WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
    if (!old) return res.status(404).json({ error: "Fechamento não encontrado." });

    db.prepare("UPDATE closings SET stageId = ?, updatedAt = ? WHERE id = ? AND companyId = ?").run(stageId, now, req.params.id, companyId);

    db.prepare(
      "INSERT INTO closing_history (closingId, action, fromStageId, toStageId, notes, performedById, performedByName, createdAt) VALUES (?, 'stage_change', ?, ?, ?, ?, ?, ?)"
    ).run(req.params.id, old.stageId, stageId, notes || null, req.user?.id || "system", req.user?.nome || "Sistema", now);

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/gestao/closings/:id", (req, res) => {
  try {
    const companyId = getCompanyId(req);
    db.prepare("DELETE FROM closing_history WHERE closingId = ?").run(req.params.id);
    db.prepare("DELETE FROM closings WHERE id = ? AND companyId = ?").run(req.params.id, companyId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

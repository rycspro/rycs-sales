import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus, X, Target, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  Phone, MessageSquare, Users, Calendar, CheckCircle2, DollarSign,
  BarChart3, Percent, Award, Pencil, Trash2, ArrowUpDown,
} from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";

const AZUL = "#318CE7";
const AZUL_SUAVE = "#EAF4FF";
const BORDA = "#E8EAED";

const fmtBRL = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString("pt-BR") : "—";
const fmtDateInput = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toISOString().split("T")[0];
};

const INDICATOR_TYPES = [
  { key: "calls", label: "Ligações realizadas", Icon: Phone, unit: "" },
  { key: "leads_worked", label: "Leads trabalhados", Icon: Users, unit: "" },
  { key: "prospections", label: "Prospecções realizadas", Icon: TrendingUp, unit: "" },
  { key: "conversations", label: "Conversas iniciadas", Icon: MessageSquare, unit: "" },
  { key: "meetings_scheduled", label: "Reuniões agendadas", Icon: Calendar, unit: "" },
  { key: "meetings_done", label: "Reuniões realizadas", Icon: CheckCircle2, unit: "" },
  { key: "tasks_done", label: "Tarefas concluídas", Icon: CheckCircle2, unit: "" },
  { key: "sales", label: "Vendas realizadas", Icon: Award, unit: "" },
  { key: "sales_value", label: "Valor em vendas", Icon: DollarSign, unit: "BRL" },
  { key: "conversion_rate", label: "Taxa de conversão", Icon: Percent, unit: "%" },
  { key: "custom", label: "Personalizada", Icon: BarChart3, unit: "" },
];

const GOAL_SCOPES = [
  { key: "individual", label: "Individual" },
  { key: "team", label: "Por equipe" },
  { key: "department", label: "Por departamento" },
  { key: "company", label: "Geral da empresa" },
];

const GOAL_STATUSES = {
  in_progress: { label: "Em andamento", color: AZUL },
  achieved: { label: "Atingida", color: "#16a34a" },
  exceeded: { label: "Superada", color: "#7c3aed" },
  missed: { label: "Não atingida", color: "#dc2626" },
};

const RECURRENCES = [
  { key: "", label: "Nenhuma" },
  { key: "daily", label: "Diária" },
  { key: "weekly", label: "Semanal" },
  { key: "monthly", label: "Mensal" },
  { key: "quarterly", label: "Trimestral" },
];

const PERIODS = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "month", label: "Este mês" },
  { key: "last_month", label: "Mês anterior" },
  { key: "custom", label: "Personalizado" },
];

function periodToDates(period) {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
  switch (period) {
    case "today": return { startDate: startOfDay(now), endDate: endOfDay(now) };
    case "7d": { const s = new Date(now); s.setDate(s.getDate() - 7); return { startDate: startOfDay(s), endDate: endOfDay(now) }; }
    case "30d": { const s = new Date(now); s.setDate(s.getDate() - 30); return { startDate: startOfDay(s), endDate: endOfDay(now) }; }
    case "month": return { startDate: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), endDate: endOfDay(now) };
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: s.getTime(), endDate: endOfDay(e) };
    }
    default: return {};
  }
}

function diasRestantes(endDate) {
  if (!endDate) return null;
  const diff = Math.ceil((endDate - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "Vencida";
  if (diff === 0) return "Vence hoje";
  if (diff === 1) return "Falta 1 dia";
  return `Faltam ${diff} dias`;
}

function indicatorLabel(key) {
  return INDICATOR_TYPES.find((t) => t.key === key)?.label || key;
}

function formatGoalValue(value, indicatorType) {
  if (indicatorType === "sales_value") return fmtBRL(value);
  if (indicatorType === "conversion_rate") return `${(value || 0).toFixed(1)}%`;
  return String(Math.round(value || 0));
}

const EMPTY_FORM = {
  name: "", indicatorType: "sales", targetValue: "", scope: "individual",
  assigneeId: "", departmentId: "", startDate: "", endDate: "", recurrence: "",
};

export default function MetasDesempenho() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState(null);
  const [closingStats, setClosingStats] = useState(null);

  const [period, setPeriod] = useState("month");
  const [filterCollab, setFilterCollab] = useState("");
  const [filterDept, setFilterDept] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [detailGoal, setDetailGoal] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [sortCol, setSortCol] = useState("sales");
  const [sortDir, setSortDir] = useState("desc");

  const carregar = useCallback(async () => {
    const dates = periodToDates(period);
    const qs = new URLSearchParams();
    if (dates.startDate) qs.set("startDate", dates.startDate);
    if (dates.endDate) qs.set("endDate", dates.endDate);
    if (filterCollab) qs.set("assigneeId", filterCollab);

    const [goalsRes, teamRes, deptRes, statsRes, clsRes] = await Promise.all([
      api("/gestao/goals?" + qs.toString()),
      api("/gestao/team?status=active"),
      api("/gestao/departments"),
      api("/gestao/goals-summary?" + qs.toString()),
      api("/gestao/closings-stats?" + qs.toString()),
    ]);
    if (Array.isArray(goalsRes)) setGoals(goalsRes);
    else if (goalsRes?.goals) setGoals(goalsRes.goals);
    else setGoals([]);

    if (Array.isArray(teamRes)) setTeam(teamRes);
    else if (teamRes?.members) setTeam(teamRes.members);
    else setTeam([]);

    if (Array.isArray(deptRes)) setDepartments(deptRes);
    else if (deptRes?.departments) setDepartments(deptRes.departments);
    else setDepartments([]);

    setStats(statsRes || null);
    setClosingStats(clsRes || null);
    setLoading(false);
  }, [period, filterCollab]);

  useEffect(() => { carregar(); }, [carregar]);

  const openCreate = () => { setEditingGoal(null); setForm({ ...EMPTY_FORM }); setDrawerOpen(true); };
  const openEdit = (g) => {
    setEditingGoal(g);
    setForm({
      name: g.name || "",
      indicatorType: g.indicatorType || "sales",
      targetValue: g.targetValue || "",
      scope: g.scope || "individual",
      assigneeId: g.assigneeId ? String(g.assigneeId) : "",
      departmentId: g.departmentId ? String(g.departmentId) : "",
      startDate: fmtDateInput(g.startDate),
      endDate: fmtDateInput(g.endDate),
      recurrence: g.recurrence || "",
    });
    setDrawerOpen(true);
    setDetailGoal(null);
  };
  const closeDrawer = () => { setDrawerOpen(false); setEditingGoal(null); };

  const salvar = async () => {
    if (!form.name || !form.targetValue || !form.startDate || !form.endDate) return;
    setSaving(true);
    const body = {
      name: form.name,
      indicatorType: form.indicatorType,
      targetValue: Number(form.targetValue),
      scope: form.scope,
      assigneeId: form.scope === "individual" && form.assigneeId ? Number(form.assigneeId) : null,
      departmentId: form.scope === "department" && form.departmentId ? Number(form.departmentId) : null,
      startDate: new Date(form.startDate).getTime(),
      endDate: new Date(form.endDate + "T23:59:59").getTime(),
      recurrence: form.recurrence || null,
    };
    if (editingGoal) {
      await apiPatch("/gestao/goals/" + editingGoal.id, body);
    } else {
      await api("/gestao/goals", body);
    }
    setSaving(false);
    closeDrawer();
    carregar();
  };

  const excluir = async (g) => {
    if (!confirm(`Excluir a meta "${g.name}"?`)) return;
    await api("/gestao/goals/" + g.id, { _method: "DELETE" });
    setDetailGoal(null);
    carregar();
  };

  const activeGoals = useMemo(() => {
    let filtered = goals;
    if (filterDept) filtered = filtered.filter((g) => String(g.departmentId) === filterDept);
    return filtered;
  }, [goals, filterDept]);

  const perfIndicators = useMemo(() => {
    const s = closingStats || {};
    return [
      { label: "Leads trabalhados", value: s.leadsWorked || 0, Icon: Users },
      { label: "Ligações realizadas", value: s.callsMade || 0, Icon: Phone },
      { label: "Conversas iniciadas", value: s.conversationsStarted || 0, Icon: MessageSquare },
      { label: "Reuniões agendadas", value: s.meetingsScheduled || 0, Icon: Calendar },
      { label: "Reuniões realizadas", value: s.meetingsDone || 0, Icon: CheckCircle2 },
      { label: "Tarefas concluídas", value: s.tasksDone || 0, Icon: CheckCircle2 },
      { label: "Vendas realizadas", value: s.confirmed || s.count || 0, Icon: Award },
      { label: "Valor em vendas", value: fmtBRL(s.totalValue || 0), Icon: DollarSign, isCurrency: true },
      { label: "Taxa de conversão", value: s.conversionRate != null ? `${(s.conversionRate || 0).toFixed(1)}%` : "—", Icon: Percent, isText: true },
      { label: "Metas atingidas", value: stats?.achievedPercent != null ? `${(stats.achievedPercent || 0).toFixed(0)}%` : "—", Icon: Target, isText: true },
    ];
  }, [closingStats, stats]);

  const ranking = useMemo(() => {
    const rows = team.map((m) => ({
      id: m.id,
      name: m.name,
      photo: m.photo,
      jobTitle: m.jobTitle || "—",
      activities: 0,
      meetings: 0,
      sales: 0,
      salesValue: 0,
      conversion: 0,
      goalsPercent: 0,
    }));
    const col = sortCol;
    rows.sort((a, b) => sortDir === "desc" ? (b[col] || 0) - (a[col] || 0) : (a[col] || 0) - (b[col] || 0));
    return rows;
  }, [team, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  if (loading) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;

  return (
    <div className="vx-fade" style={{ position: "relative" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>
            Gestão interna
          </div>
          <h1 className="vx-disp" style={{ fontSize: 22, margin: 0 }}>Metas e desempenho</h1>
          <p style={{ color: "#737373", margin: "4px 0 0", fontSize: 14 }}>
            Acompanhe a produtividade, estabeleça metas e monitore os resultados da sua equipe.
          </p>
        </div>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={openCreate}
          style={{ gap: 6, background: AZUL, borderColor: AZUL, whiteSpace: "nowrap" }}>
          <Plus size={16} /> Criar meta
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <select className="vx-input" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ height: 36, width: "auto", minWidth: 150 }}>
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select className="vx-input" value={filterCollab} onChange={(e) => setFilterCollab(e.target.value)} style={{ height: 36, width: "auto", minWidth: 150 }}>
          <option value="">Todos os colaboradores</option>
          {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="vx-input" value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ height: 36, width: "auto", minWidth: 150 }}>
          <option value="">Todos os departamentos</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Performance Indicators */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 170px), 1fr))", gap: 10, marginBottom: 28 }}>
        {perfIndicators.map((ind) => (
          <div key={ind.label} style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ind.Icon size={14} style={{ color: AZUL }} />
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#171717" }}>
              {ind.isCurrency || ind.isText ? ind.value : ind.value}
            </div>
            <div style={{ fontSize: 12, color: "#737373", marginTop: 2 }}>{ind.label}</div>
          </div>
        ))}
      </div>

      {/* Metas ativas */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 12 }}>
          Metas ativas
        </div>
        {activeGoals.length === 0 ? (
          <EmptyState onAdd={openCreate} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 14 }}>
            {activeGoals.map((g) => (
              <GoalCard key={g.id} goal={g} team={team} onClick={() => setDetailGoal(g)} />
            ))}
          </div>
        )}
      </div>

      {/* Ranking */}
      {team.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 12 }}>
            Ranking de desempenho
          </div>
          {ranking.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 20px", border: `1px dashed ${BORDA}`, borderRadius: 12 }}>
              <p style={{ fontSize: 14, color: "#737373" }}>Sem dados de desempenho.</p>
            </div>
          ) : (
            <RankingTable ranking={ranking} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
          )}
        </div>
      )}

      {/* Create/Edit Drawer */}
      {drawerOpen && (
        <GoalDrawer
          form={form} setForm={setForm}
          editing={!!editingGoal}
          team={team} departments={departments}
          saving={saving}
          onSave={salvar} onClose={closeDrawer}
        />
      )}

      {/* Detail Drawer */}
      {detailGoal && (
        <GoalDetail
          goal={detailGoal} team={team}
          onClose={() => setDetailGoal(null)}
          onEdit={() => openEdit(detailGoal)}
          onDelete={() => excluir(detailGoal)}
        />
      )}
    </div>
  );
}

/* ====================== EMPTY STATE ====================== */
function EmptyState({ onAdd }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", border: `1px dashed ${BORDA}`, borderRadius: 12 }}>
      <span style={{ width: 52, height: 52, borderRadius: 14, background: AZUL_SUAVE, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <Target size={26} style={{ color: AZUL }} />
      </span>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>Nenhuma meta criada</h3>
      <p style={{ fontSize: 14, color: "#737373", margin: "0 0 18px" }}>
        Defina metas para acompanhar o desempenho da sua equipe.
      </p>
      <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={onAdd}
        style={{ gap: 6, background: AZUL, borderColor: AZUL }}>
        <Plus size={16} /> Criar primeira meta
      </button>
    </div>
  );
}

/* ====================== GOAL CARD ====================== */
function GoalCard({ goal: g, team, onClick }) {
  const pct = g.targetValue > 0 ? Math.min((g.currentValue / g.targetValue) * 100, 150) : 0;
  const pctDisplay = Math.round(pct);
  const statusInfo = GOAL_STATUSES[g.status] || GOAL_STATUSES.in_progress;
  const indLabel = indicatorLabel(g.indicatorType);
  const deadline = diasRestantes(g.endDate);
  const assignee = g.assigneeId ? team.find((m) => m.id === g.assigneeId) : null;
  const scopeLabel = g.scope === "individual" && assignee ? assignee.name
    : g.scope === "team" ? "Equipe"
    : g.scope === "department" ? "Departamento"
    : "Empresa";

  return (
    <button onClick={onClick}
      style={{ textAlign: "left", background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 18, cursor: "pointer", transition: "border-color .15s" }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = AZUL}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = BORDA}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#171717", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
          <div style={{ fontSize: 12, color: "#737373" }}>{scopeLabel}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: statusInfo.color + "18", color: statusInfo.color, whiteSpace: "nowrap", flexShrink: 0 }}>
          {statusInfo.label}
        </span>
      </div>
      {/* Progress bar */}
      <div style={{ background: AZUL_SUAVE, borderRadius: 6, height: 8, marginBottom: 8, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: statusInfo.color, borderRadius: 6, transition: "width .3s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <span style={{ color: "#737373" }}>
          {formatGoalValue(g.currentValue, g.indicatorType)} de {formatGoalValue(g.targetValue, g.indicatorType)}
          {" "}<span style={{ color: "#a3a3a3" }}>({indLabel.toLowerCase()})</span>
        </span>
        <span style={{ fontWeight: 600, color: statusInfo.color }}>{pctDisplay}%</span>
      </div>
      {deadline && (
        <div style={{ fontSize: 11, color: deadline === "Vencida" ? "#dc2626" : "#737373", marginTop: 6 }}>
          {deadline}
        </div>
      )}
    </button>
  );
}

/* ====================== RANKING TABLE ====================== */
function RankingTable({ ranking, sortCol, sortDir, onSort }) {
  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ArrowUpDown size={12} style={{ color: "#b8bcc4" }} />;
    return sortDir === "desc" ? <ChevronDown size={12} style={{ color: AZUL }} /> : <ChevronUp size={12} style={{ color: AZUL }} />;
  };
  const thStyle = (col) => ({
    cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
    color: sortCol === col ? AZUL : undefined,
  });
  const initials = (name) => (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="vx-table-wrap">
      <table className="vx-table" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th>Colaborador</th>
            <th>Função</th>
            <th style={thStyle("activities")} onClick={() => onSort("activities")}>Atividades <SortIcon col="activities" /></th>
            <th style={thStyle("meetings")} onClick={() => onSort("meetings")}>Reuniões <SortIcon col="meetings" /></th>
            <th style={thStyle("sales")} onClick={() => onSort("sales")}>Vendas <SortIcon col="sales" /></th>
            <th style={thStyle("salesValue")} onClick={() => onSort("salesValue")}>Valor <SortIcon col="salesValue" /></th>
            <th style={thStyle("conversion")} onClick={() => onSort("conversion")}>Conversão <SortIcon col="conversion" /></th>
            <th style={thStyle("goalsPercent")} onClick={() => onSort("goalsPercent")}>Metas <SortIcon col="goalsPercent" /></th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600, color: i < 3 ? AZUL : "#737373" }}>{i + 1}</td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {r.photo ? (
                    <img src={r.photo} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ width: 28, height: 28, borderRadius: "50%", background: AZUL_SUAVE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: AZUL, flexShrink: 0 }}>
                      {initials(r.name)}
                    </span>
                  )}
                  <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                </div>
              </td>
              <td style={{ color: "#737373" }}>{r.jobTitle}</td>
              <td>{r.activities}</td>
              <td>{r.meetings}</td>
              <td>{r.sales}</td>
              <td>{fmtBRL(r.salesValue)}</td>
              <td>{r.conversion.toFixed(1)}%</td>
              <td>{r.goalsPercent.toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ====================== GOAL DRAWER ====================== */
function GoalDrawer({ form, setForm, editing, team, departments, saving, onSave, onClose }) {
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 440, maxWidth: "100vw", height: "100%", background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,.1)", overflowY: "auto", padding: 28 }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editing ? "Editar meta" : "Criar meta"}</h2>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 3 }}><X size={18} /></button>
        </div>

        <label className="vx-label">Nome da meta *</label>
        <input className="vx-input" value={form.name} onChange={(e) => upd("name", e.target.value)} placeholder="Ex: 20 vendas no mês" style={{ marginBottom: 12 }} />

        <label className="vx-label">Tipo de indicador</label>
        <select className="vx-input" value={form.indicatorType} onChange={(e) => upd("indicatorType", e.target.value)} style={{ marginBottom: 12 }}>
          {INDICATOR_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>

        <label className="vx-label">Valor esperado *</label>
        <input className="vx-input" type="number" value={form.targetValue} onChange={(e) => upd("targetValue", e.target.value)}
          placeholder={form.indicatorType === "sales_value" ? "Ex: 50000" : "Ex: 20"} style={{ marginBottom: 12 }} />

        <label className="vx-label">Escopo</label>
        <select className="vx-input" value={form.scope} onChange={(e) => upd("scope", e.target.value)} style={{ marginBottom: 12 }}>
          {GOAL_SCOPES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>

        {form.scope === "individual" && (
          <>
            <label className="vx-label">Responsável</label>
            <select className="vx-input" value={form.assigneeId} onChange={(e) => upd("assigneeId", e.target.value)} style={{ marginBottom: 12 }}>
              <option value="">Selecionar colaborador</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </>
        )}

        {form.scope === "department" && (
          <>
            <label className="vx-label">Departamento</label>
            <select className="vx-input" value={form.departmentId} onChange={(e) => upd("departmentId", e.target.value)} style={{ marginBottom: 12 }}>
              <option value="">Selecionar departamento</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label className="vx-label">Data inicial *</label>
            <input className="vx-input" type="date" value={form.startDate} onChange={(e) => upd("startDate", e.target.value)} />
          </div>
          <div>
            <label className="vx-label">Data final *</label>
            <input className="vx-input" type="date" value={form.endDate} onChange={(e) => upd("endDate", e.target.value)} />
          </div>
        </div>

        <label className="vx-label">Recorrência</label>
        <select className="vx-input" value={form.recurrence} onChange={(e) => upd("recurrence", e.target.value)} style={{ marginBottom: 20 }}>
          {RECURRENCES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={onSave} disabled={saving || !form.name || !form.targetValue || !form.startDate || !form.endDate}
            style={{ flex: 1, background: AZUL, borderColor: AZUL }}>
            {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar meta"}
          </button>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ====================== GOAL DETAIL ====================== */
function GoalDetail({ goal: g, team, onClose, onEdit, onDelete }) {
  const statusInfo = GOAL_STATUSES[g.status] || GOAL_STATUSES.in_progress;
  const pct = g.targetValue > 0 ? Math.round((g.currentValue / g.targetValue) * 100) : 0;
  const assignee = g.assigneeId ? team.find((m) => m.id === g.assigneeId) : null;
  const indLabel = indicatorLabel(g.indicatorType);
  const deadline = diasRestantes(g.endDate);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 420, maxWidth: "100vw", height: "100%", background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,.1)", overflowY: "auto", padding: 28 }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".5px" }}>Detalhes da meta</span>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 3 }}><X size={16} /></button>
        </div>

        <h3 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px" }}>{g.name}</h3>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: statusInfo.color + "18", color: statusInfo.color }}>
          {statusInfo.label}
        </span>

        {/* Progress */}
        <div style={{ marginTop: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: "#737373" }}>Progresso</span>
            <span style={{ fontWeight: 600, color: statusInfo.color }}>{pct}%</span>
          </div>
          <div style={{ background: AZUL_SUAVE, borderRadius: 6, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: statusInfo.color, borderRadius: 6, transition: "width .3s" }} />
          </div>
          <div style={{ fontSize: 13, color: "#737373", marginTop: 6 }}>
            {formatGoalValue(g.currentValue, g.indicatorType)} de {formatGoalValue(g.targetValue, g.indicatorType)} ({indLabel.toLowerCase()})
          </div>
        </div>

        {/* Info */}
        <div style={{ fontSize: 13, color: "#737373", display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Escopo</span>
            <span style={{ color: "#171717", fontWeight: 500 }}>
              {GOAL_SCOPES.find((s) => s.key === g.scope)?.label || g.scope}
            </span>
          </div>
          {assignee && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Responsável</span>
              <span style={{ color: "#171717", fontWeight: 500 }}>{assignee.name}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Indicador</span>
            <span style={{ color: "#171717", fontWeight: 500 }}>{indLabel}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Período</span>
            <span style={{ color: "#171717" }}>{fmtDate(g.startDate)} — {fmtDate(g.endDate)}</span>
          </div>
          {g.recurrence && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Recorrência</span>
              <span style={{ color: "#171717" }}>{RECURRENCES.find((r) => r.key === g.recurrence)?.label || g.recurrence}</span>
            </div>
          )}
          {deadline && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Prazo</span>
              <span style={{ color: deadline === "Vencida" ? "#dc2626" : "#171717", fontWeight: 500 }}>{deadline}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onEdit} style={{ justifyContent: "flex-start", gap: 8 }}>
            <Pencil size={14} /> Editar meta
          </button>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onDelete} style={{ justifyContent: "flex-start", gap: 8, color: "var(--red)" }}>
            <Trash2 size={14} /> Excluir meta
          </button>
        </div>
      </div>
    </div>
  );
}

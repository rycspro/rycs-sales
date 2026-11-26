import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Plus, Search, X, TrendingUp, MoreVertical, ChevronDown,
  CheckCircle2, XCircle, Clock, AlertTriangle, Settings2,
  Trash2, Pencil, ArrowRight, Eye, LayoutList, Columns3,
  DollarSign, Hash, Receipt, Ban, CircleDot, GripVertical,
} from "lucide-react";
import { api, apiPatch, apiDelete } from "../../lib/api.js";

const AZUL = "#318CE7";
const AZUL_SUAVE = "#EAF4FF";
const BORDA = "#E8EAED";

const fmtBRL = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (ts) => ts ? new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";

const VALIDATION_MAP = {
  pending:   { label: "Em validação", color: "#D97706", bg: "#FEF3C7" },
  confirmed: { label: "Confirmado",   color: "#059669", bg: "#D1FAE5" },
  rejected:  { label: "Rejeitado",    color: "#DC2626", bg: "#FEE2E2" },
  cancelled: { label: "Cancelado",    color: "#6B7280", bg: "#F3F4F6" },
};

const ORIGIN_MAP = {
  internal: { label: "Interno", color: AZUL, bg: AZUL_SUAVE },
  rycs:     { label: "RYCS",   color: "#7C3AED", bg: "#EDE9FE" },
  manual:   { label: "Manual", color: "#6B7280", bg: "#F3F4F6" },
};

const PERIODS = [
  { key: "today",   label: "Hoje" },
  { key: "7d",      label: "Últimos 7 dias" },
  { key: "30d",     label: "Últimos 30 dias" },
  { key: "month",   label: "Este mês" },
  { key: "prev",    label: "Mês anterior" },
  { key: "all",     label: "Todos" },
];

const DEFAULT_STAGES = [
  { name: "Venda registrada", color: "#318CE7" },
  { name: "Em processamento", color: "#D97706" },
  { name: "Em acompanhamento", color: "#7C3AED" },
  { name: "Concluído", color: "#059669" },
];

function periodRange(key) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (key === "today") return { startDate: startOfDay, endDate: Date.now() };
  if (key === "7d")    return { startDate: startOfDay - 6 * 86400000, endDate: Date.now() };
  if (key === "30d")   return { startDate: startOfDay - 29 * 86400000, endDate: Date.now() };
  if (key === "month") return { startDate: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), endDate: Date.now() };
  if (key === "prev") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { startDate: s.getTime(), endDate: e.getTime() };
  }
  return {};
}

function Badge({ label, color, bg }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, color, background: bg, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: "14px 16px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {Icon && <Icon size={15} style={{ color: AZUL, flexShrink: 0 }} />}
        <span style={{ fontSize: 12, color: "#737373", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#171717" }}>{value}</div>
    </div>
  );
}

export default function Fechamentos() {
  const [closings, setClosings] = useState([]);
  const [stats, setStats] = useState({});
  const [stages, setStages] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [period, setPeriod] = useState("month");
  const [search, setSearch] = useState("");
  const [filterOrigin, setFilterOrigin] = useState("");
  const [filterValidation, setFilterValidation] = useState("");
  const [filterSeller, setFilterSeller] = useState("");
  const [drawer, setDrawer] = useState(null);
  const [detail, setDetail] = useState(null);
  const [stagesModal, setStagesModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildQuery = useCallback(() => {
    const p = periodRange(period);
    const params = new URLSearchParams();
    if (p.startDate) params.set("startDate", p.startDate);
    if (p.endDate) params.set("endDate", p.endDate);
    if (filterOrigin) params.set("origin", filterOrigin);
    if (filterValidation) params.set("validationStatus", filterValidation);
    if (filterSeller) params.set("sellerId", filterSeller);
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [period, filterOrigin, filterValidation, filterSeller, search]);

  const load = useCallback(async () => {
    const q = buildQuery();
    const [cls, st, stg, tm] = await Promise.all([
      api("/gestao/closings?" + q),
      api("/gestao/closings-stats?" + q),
      api("/gestao/pipeline-stages"),
      api("/gestao/team"),
    ]);
    if (Array.isArray(cls)) setClosings(cls);
    if (st && !st.error) setStats(st);
    if (Array.isArray(stg)) setStages(stg);
    if (Array.isArray(tm)) setTeam(tm);
    else if (tm?.members) setTeam(tm.members);
    setLoading(false);
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  const stageMap = useMemo(() => {
    const m = {};
    for (const s of stages) m[s.id] = s;
    return m;
  }, [stages]);

  const closingsByStage = useMemo(() => {
    const m = {};
    for (const s of stages) m[s.id] = [];
    for (const c of closings) {
      if (c.stageId && m[c.stageId]) m[c.stageId].push(c);
      else if (stages.length > 0) {
        const initial = stages.find((s) => s.isInitial) || stages[0];
        if (m[initial.id]) m[initial.id].push(c);
      }
    }
    return m;
  }, [closings, stages]);

  const createClosing = async (data) => {
    setSaving(true);
    const r = await api("/gestao/closings", data);
    setSaving(false);
    if (r?.error) return;
    setDrawer(null);
    load();
  };

  const updateClosing = async (id, data) => {
    setSaving(true);
    await apiPatch("/gestao/closings/" + id, data);
    setSaving(false);
    setDrawer(null);
    setDetail(null);
    load();
  };

  const validateClosing = async (id, validationStatus, notes) => {
    await api("/gestao/closings/" + id + "/validate", { validationStatus, notes });
    load();
    if (detail?.id === id) {
      const r = await api("/gestao/closings/" + id);
      if (r && !r.error) setDetail(r);
    }
  };

  const moveClosing = async (id, stageId) => {
    await api("/gestao/closings/" + id + "/move", { stageId });
    load();
  };

  const deleteClosing = async (id) => {
    if (!confirm("Excluir este fechamento?")) return;
    await apiDelete("/gestao/closings/" + id);
    if (detail?.id === id) setDetail(null);
    load();
  };

  const createDefaultStages = async () => {
    for (let i = 0; i < DEFAULT_STAGES.length; i++) {
      await api("/gestao/pipeline-stages", {
        ...DEFAULT_STAGES[i],
        position: i,
        isInitial: i === 0 ? 1 : 0,
        isCompletion: i === DEFAULT_STAGES.length - 1 ? 1 : 0,
      });
    }
    load();
  };

  if (loading) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;

  const isEmpty = closings.length === 0 && !search && !filterOrigin && !filterValidation && !filterSeller && period === "month";

  return (
    <div className="vx-fade" style={{ position: "relative" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>Gestão interna</div>
          <h1 className="vx-disp" style={{ fontSize: 22, margin: 0 }}>Fechamentos</h1>
          <p style={{ color: "#737373", margin: "4px 0 0", fontSize: 14 }}>
            Acompanhe suas vendas, monitore os resultados comerciais e gerencie o andamento dos negócios fechados.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button className="vx-btn vx-btn-sm" onClick={() => setStagesModal(true)} style={{ gap: 6 }}>
            <Settings2 size={15} /> Configurar etapas
          </button>
          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => setDrawer({ mode: "create" })} style={{ gap: 6, background: AZUL, borderColor: AZUL }}>
            <Plus size={16} /> Registrar venda
          </button>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState onAdd={() => setDrawer({ mode: "create" })} />
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
            <StatCard label="Valor confirmado" value={fmtBRL(stats.confirmedValue)} icon={DollarSign} />
            <StatCard label="Confirmados" value={stats.confirmedCount || 0} icon={CheckCircle2} />
            <StatCard label="Ticket médio" value={fmtBRL(stats.avgTicket)} icon={Receipt} />
            <StatCard label="Comissões" value={fmtBRL(stats.totalCommissions)} icon={DollarSign} />
            <StatCard label="Em validação" value={stats.pendingCount || 0} icon={Clock} />
            <StatCard label="Canceladas" value={stats.cancelledCount || 0} icon={Ban} />
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 2, background: "#F8F9FB", borderRadius: 10, padding: 2 }}>
              {[["list", "Lista", LayoutList], ["pipeline", "Pipeline", Columns3]].map(([k, label, Icon]) => (
                <button key={k} onClick={() => setView(k)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: view === k ? 600 : 400, background: view === k ? "#fff" : "transparent", color: view === k ? "#171717" : "#737373", boxShadow: view === k ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
              <div style={{ position: "relative", minWidth: 180 }}>
                <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#737373" }} />
                <input className="vx-input" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 32, height: 34, fontSize: 13, width: "100%" }} />
              </div>
              <select className="vx-input" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ height: 34, width: "auto", fontSize: 13 }}>
                {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <select className="vx-input" value={filterOrigin} onChange={(e) => setFilterOrigin(e.target.value)} style={{ height: 34, width: "auto", fontSize: 13 }}>
                <option value="">Todas origens</option>
                <option value="internal">Time interno</option>
                <option value="rycs">Profissionais RYCS</option>
                <option value="manual">Manual</option>
              </select>
              <select className="vx-input" value={filterValidation} onChange={(e) => setFilterValidation(e.target.value)} style={{ height: 34, width: "auto", fontSize: 13 }}>
                <option value="">Todas validações</option>
                <option value="pending">Em validação</option>
                <option value="confirmed">Confirmado</option>
                <option value="rejected">Rejeitado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>

          {view === "list" ? (
            <ListView closings={closings} stageMap={stageMap} onSelect={setDetail}
              onDelete={deleteClosing} onEdit={(c) => setDrawer({ mode: "edit", data: c })}
              onValidate={validateClosing} onMove={moveClosing} stages={stages} />
          ) : (
            <PipelineView stages={stages} closingsByStage={closingsByStage} stageMap={stageMap}
              onSelect={setDetail} onMove={moveClosing} onCreateDefaults={createDefaultStages} />
          )}
        </>
      )}

      {drawer && (
        <SaleDrawer mode={drawer.mode} data={drawer.data} team={team} stages={stages}
          saving={saving} onSave={drawer.mode === "create" ? createClosing : (d) => updateClosing(drawer.data.id, d)}
          onClose={() => setDrawer(null)} />
      )}

      {detail && (
        <DetailDrawer closing={detail} stageMap={stageMap} stages={stages}
          onClose={() => setDetail(null)} onValidate={validateClosing} onMove={moveClosing}
          onEdit={() => { setDrawer({ mode: "edit", data: detail }); setDetail(null); }}
          onDelete={() => deleteClosing(detail.id)} />
      )}

      {stagesModal && (
        <StagesModal stages={stages} onClose={() => { setStagesModal(false); load(); }}
          onCreateDefaults={createDefaultStages} />
      )}
    </div>
  );
}

/* ====================== EMPTY STATE ====================== */
function EmptyState({ onAdd }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <span style={{ width: 56, height: 56, borderRadius: 14, background: AZUL_SUAVE, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <TrendingUp size={28} style={{ color: AZUL }} />
      </span>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>Nenhum fechamento registrado</h2>
      <p style={{ fontSize: 14, color: "#737373", margin: "0 0 20px", maxWidth: 400, marginInline: "auto" }}>
        Registre suas vendas para acompanhar os resultados comerciais.
      </p>
      <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={onAdd} style={{ gap: 6, background: AZUL, borderColor: AZUL }}>
        <Plus size={16} /> Registrar primeira venda
      </button>
    </div>
  );
}

/* ====================== LIST VIEW ====================== */
function ListView({ closings, stageMap, onSelect, onDelete, onEdit, onValidate, onMove, stages }) {
  const [menuOpen, setMenuOpen] = useState(null);
  const [moveMenu, setMoveMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(null); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuOpen]);

  if (closings.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", border: `1px dashed ${BORDA}`, borderRadius: 12 }}>
        <p style={{ fontSize: 14, color: "#737373" }}>Nenhum fechamento encontrado com os filtros selecionados.</p>
      </div>
    );
  }

  return (
    <div className="vx-table-wrap">
      <table className="vx-table" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Produto/serviço</th>
            <th>Responsável</th>
            <th>Origem</th>
            <th style={{ textAlign: "right" }}>Valor</th>
            <th>Data</th>
            <th style={{ textAlign: "right" }}>Comissão</th>
            <th>Validação</th>
            <th>Etapa</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {closings.map((c) => {
            const v = VALIDATION_MAP[c.validationStatus] || VALIDATION_MAP.pending;
            const o = ORIGIN_MAP[c.origin] || ORIGIN_MAP.internal;
            const stage = stageMap[c.stageId];
            return (
              <tr key={c.id} onClick={() => onSelect(c)} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.clientName}</td>
                <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#737373" }}>{c.productOrService || "—"}</td>
                <td style={{ color: "#737373" }}>{c.sellerName || "—"}</td>
                <td><Badge {...o} /></td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtBRL(c.totalValue)}</td>
                <td style={{ color: "#737373", whiteSpace: "nowrap" }}>{fmtData(c.closingDate)}</td>
                <td style={{ textAlign: "right", color: "#737373" }}>{c.commissionValue ? fmtBRL(c.commissionValue) : "—"}</td>
                <td><Badge {...v} /></td>
                <td>
                  {stage ? (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, color: stage.color, background: stage.color + "18", whiteSpace: "nowrap" }}>
                      {stage.name}
                    </span>
                  ) : "—"}
                </td>
                <td>
                  <div style={{ position: "relative" }} ref={menuOpen === c.id ? menuRef : null}>
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === c.id ? null : c.id); setMoveMenu(null); }}
                      className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: 3 }}>
                      <MoreVertical size={15} />
                    </button>
                    {menuOpen === c.id && (
                      <div style={{ position: "absolute", right: 0, top: 28, background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 10, padding: 4, minWidth: 160, zIndex: 20, boxShadow: "0 4px 16px rgba(0,0,0,.1)" }}>
                        <MenuBtn icon={Eye} label="Ver detalhes" onClick={(e) => { e.stopPropagation(); onSelect(c); setMenuOpen(null); }} />
                        <MenuBtn icon={Pencil} label="Editar" onClick={(e) => { e.stopPropagation(); onEdit(c); setMenuOpen(null); }} />
                        {c.validationStatus === "pending" && (
                          <>
                            <MenuBtn icon={CheckCircle2} label="Confirmar" onClick={(e) => { e.stopPropagation(); onValidate(c.id, "confirmed"); setMenuOpen(null); }} />
                            <MenuBtn icon={XCircle} label="Rejeitar" onClick={(e) => { e.stopPropagation(); onValidate(c.id, "rejected"); setMenuOpen(null); }} />
                          </>
                        )}
                        {stages.length > 0 && (
                          <div style={{ position: "relative" }}>
                            <MenuBtn icon={ArrowRight} label="Mover etapa" onClick={(e) => { e.stopPropagation(); setMoveMenu(moveMenu ? null : c.id); }} />
                            {moveMenu === c.id && (
                              <div style={{ position: "absolute", left: "100%", top: 0, background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 10, padding: 4, minWidth: 160, zIndex: 21, boxShadow: "0 4px 16px rgba(0,0,0,.1)" }}>
                                {stages.filter((s) => s.id !== c.stageId && !s.isArchived).map((s) => (
                                  <MenuBtn key={s.id} icon={CircleDot} label={s.name} onClick={(e) => { e.stopPropagation(); onMove(c.id, s.id); setMenuOpen(null); setMoveMenu(null); }} />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <MenuBtn icon={Trash2} label="Excluir" danger onClick={(e) => { e.stopPropagation(); onDelete(c.id); setMenuOpen(null); }} />
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MenuBtn({ icon: Icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", fontSize: 13, background: "none", border: "none", cursor: "pointer", borderRadius: 6, color: danger ? "var(--red, #DC2626)" : "#171717" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "#F8F9FB"}
      onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
      <Icon size={15} /> {label}
    </button>
  );
}

/* ====================== PIPELINE VIEW ====================== */
function PipelineView({ stages, closingsByStage, stageMap, onSelect, onMove, onCreateDefaults }) {
  const [moveDropdown, setMoveDropdown] = useState(null);

  if (stages.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", border: `1px dashed ${BORDA}`, borderRadius: 12 }}>
        <Settings2 size={36} strokeWidth={1.3} style={{ color: "#737373", marginBottom: 10 }} />
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>Nenhuma etapa configurada</h3>
        <p style={{ fontSize: 13, color: "#737373", margin: "0 0 14px" }}>Configure as etapas do pipeline para visualizar seus fechamentos.</p>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={onCreateDefaults} style={{ gap: 6, background: AZUL, borderColor: AZUL }}>
          Criar etapas padrão
        </button>
      </div>
    );
  }

  const activeStages = stages.filter((s) => !s.isArchived);

  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, minHeight: 300 }}>
      {activeStages.map((stage) => {
        const items = closingsByStage[stage.id] || [];
        return (
          <div key={stage.id} style={{ minWidth: 260, maxWidth: 300, flex: "0 0 260px", background: "#F8F9FB", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column" }}>
            {/* Column header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "0 4px" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#171717", flex: 1 }}>{stage.name}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#737373", background: "#fff", borderRadius: 6, padding: "1px 7px" }}>{items.length}</span>
            </div>
            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              {items.map((c) => {
                const v = VALIDATION_MAP[c.validationStatus] || VALIDATION_MAP.pending;
                return (
                  <div key={c.id} onClick={() => onSelect(c)}
                    style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 10, padding: 12, cursor: "pointer", transition: "border-color .15s" }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = AZUL}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = BORDA}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#171717", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.clientName}</div>
                    {c.productOrService && <div style={{ fontSize: 12, color: "#737373", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.productOrService}</div>}
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#171717", marginBottom: 8 }}>{fmtBRL(c.totalValue)}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "#737373", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.sellerName || "—"}</span>
                      <Badge {...v} />
                    </div>
                    {/* Move dropdown */}
                    <div style={{ marginTop: 8, position: "relative" }}>
                      <button onClick={(e) => { e.stopPropagation(); setMoveDropdown(moveDropdown === c.id ? null : c.id); }}
                        className="vx-btn vx-btn-ghost vx-btn-sm" style={{ fontSize: 11, gap: 4, padding: "3px 8px", width: "100%" }}>
                        <ArrowRight size={12} /> Mover para... <ChevronDown size={12} />
                      </button>
                      {moveDropdown === c.id && (
                        <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 8, padding: 4, zIndex: 20, boxShadow: "0 4px 16px rgba(0,0,0,.1)" }}>
                          {activeStages.filter((s) => s.id !== stage.id).map((s) => (
                            <button key={s.id} onClick={(e) => { e.stopPropagation(); onMove(c.id, s.id); setMoveDropdown(null); }}
                              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 10px", fontSize: 12, background: "none", border: "none", cursor: "pointer", borderRadius: 6 }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "#F8F9FB"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                              {s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <div style={{ padding: "20px 12px", textAlign: "center", fontSize: 12, color: "#a3a3a3", border: `1px dashed ${BORDA}`, borderRadius: 8 }}>
                  Nenhum fechamento
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ====================== SALE DRAWER ====================== */
function SaleDrawer({ mode, data, team, stages, saving, onSave, onClose }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    clientName: data?.clientName || "",
    clientEmail: data?.clientEmail || "",
    clientPhone: data?.clientPhone || "",
    leadId: data?.leadId || "",
    productOrService: data?.productOrService || "",
    description: data?.description || "",
    sellerId: data?.sellerId || "",
    origin: data?.origin || "internal",
    totalValue: data?.totalValue || "",
    currency: data?.currency || "BRL",
    closingDate: data?.closingDate ? new Date(data.closingDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    paymentMethod: data?.paymentMethod || "",
    commissionValue: data?.commissionValue || "",
    commissionPercent: data?.commissionPercent || "",
    notes: data?.notes || "",
    stageId: data?.stageId || (stages.find((s) => s.isInitial)?.id || stages[0]?.id || ""),
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = () => {
    if (!form.clientName.trim()) return;
    const seller = team.find((t) => String(t.id) === String(form.sellerId));
    onSave({
      ...form,
      totalValue: parseFloat(form.totalValue) || 0,
      commissionValue: parseFloat(form.commissionValue) || 0,
      commissionPercent: parseFloat(form.commissionPercent) || 0,
      closingDate: new Date(form.closingDate).getTime(),
      sellerId: form.sellerId ? Number(form.sellerId) : null,
      sellerName: seller?.name || "",
      stageId: form.stageId ? Number(form.stageId) : null,
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.3)" }} />
      <div style={{ position: "relative", width: 440, maxWidth: "100vw", background: "#fff", height: "100%", overflowY: "auto", padding: 28, boxShadow: "-4px 0 24px rgba(0,0,0,.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{isEdit ? "Editar venda" : "Registrar venda"}</h2>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 3 }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Cliente *" value={form.clientName} onChange={(v) => set("clientName", v)} placeholder="Nome do cliente" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="E-mail" value={form.clientEmail} onChange={(v) => set("clientEmail", v)} placeholder="email@exemplo.com" />
            <Field label="Telefone" value={form.clientPhone} onChange={(v) => set("clientPhone", v)} placeholder="(00) 00000-0000" />
          </div>
          <Field label="Lead/negócio vinculado" value={form.leadId} onChange={(v) => set("leadId", v)} placeholder="ID do lead (opcional)" />
          <Field label="Produto ou serviço" value={form.productOrService} onChange={(v) => set("productOrService", v)} placeholder="O que foi vendido" />
          <div>
            <label className="vx-label" style={{ fontSize: 12, fontWeight: 600, color: "#737373", marginBottom: 4, display: "block" }}>Descrição</label>
            <textarea className="vx-input" value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} style={{ resize: "vertical", width: "100%" }} placeholder="Detalhes da venda (opcional)" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="vx-label" style={{ fontSize: 12, fontWeight: 600, color: "#737373", marginBottom: 4, display: "block" }}>Responsável</label>
              <select className="vx-input" value={form.sellerId} onChange={(e) => set("sellerId", e.target.value)} style={{ width: "100%" }}>
                <option value="">Selecionar...</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="vx-label" style={{ fontSize: 12, fontWeight: 600, color: "#737373", marginBottom: 4, display: "block" }}>Origem</label>
              <select className="vx-input" value={form.origin} onChange={(e) => set("origin", e.target.value)} style={{ width: "100%" }}>
                <option value="internal">Time interno</option>
                <option value="rycs">Profissionais RYCS</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <Field label="Valor total *" value={form.totalValue} onChange={(v) => set("totalValue", v)} type="number" placeholder="0,00" />
            <Field label="Moeda" value={form.currency} onChange={(v) => set("currency", v)} placeholder="BRL" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Data do fechamento" value={form.closingDate} onChange={(v) => set("closingDate", v)} type="date" />
            <Field label="Forma de pagamento" value={form.paymentMethod} onChange={(v) => set("paymentMethod", v)} placeholder="Cartão, boleto..." />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Comissão (R$)" value={form.commissionValue} onChange={(v) => set("commissionValue", v)} type="number" placeholder="0,00" />
            <Field label="Comissão (%)" value={form.commissionPercent} onChange={(v) => set("commissionPercent", v)} type="number" placeholder="0" />
          </div>
          {stages.length > 0 && (
            <div>
              <label className="vx-label" style={{ fontSize: 12, fontWeight: 600, color: "#737373", marginBottom: 4, display: "block" }}>Etapa</label>
              <select className="vx-input" value={form.stageId} onChange={(e) => set("stageId", e.target.value)} style={{ width: "100%" }}>
                {stages.filter((s) => !s.isArchived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="vx-label" style={{ fontSize: 12, fontWeight: 600, color: "#737373", marginBottom: 4, display: "block" }}>Observações</label>
            <textarea className="vx-input" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} style={{ resize: "vertical", width: "100%" }} placeholder="Notas internas (opcional)" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={submit} disabled={saving || !form.clientName.trim()} style={{ flex: 1, background: AZUL, borderColor: AZUL }}>
            {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Registrar venda"}
          </button>
          <button className="vx-btn vx-btn-sm" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div>
      <label className="vx-label" style={{ fontSize: 12, fontWeight: 600, color: "#737373", marginBottom: 4, display: "block" }}>{label}</label>
      <input className="vx-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%" }} />
    </div>
  );
}

/* ====================== DETAIL DRAWER ====================== */
function DetailDrawer({ closing: c, stageMap, stages, onClose, onValidate, onMove, onEdit, onDelete }) {
  const [tab, setTab] = useState("details");
  const [validationNotes, setValidationNotes] = useState("");
  const v = VALIDATION_MAP[c.validationStatus] || VALIDATION_MAP.pending;
  const o = ORIGIN_MAP[c.origin] || ORIGIN_MAP.internal;
  const stage = stageMap[c.stageId];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.3)" }} />
      <div style={{ position: "relative", width: 480, maxWidth: "100vw", background: "#fff", height: "100%", overflowY: "auto", padding: 28, boxShadow: "-4px 0 24px rgba(0,0,0,.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".5px" }}>Detalhes do fechamento</span>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 3 }}><X size={18} /></button>
        </div>

        {/* Header */}
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>{c.clientName}</h2>
        <div style={{ fontSize: 22, fontWeight: 700, color: AZUL, marginBottom: 10 }}>{fmtBRL(c.totalValue)}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          <Badge {...v} />
          <Badge {...o} />
          {stage && <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, color: stage.color, background: stage.color + "18" }}>{stage.name}</span>}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${BORDA}`, marginBottom: 18 }}>
          {[["details", "Detalhes"], ["history", "Histórico"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding: "8px 16px", fontSize: 13, fontWeight: tab === k ? 600 : 400, color: tab === k ? AZUL : "#737373", background: "none", border: "none", borderBottom: tab === k ? `2px solid ${AZUL}` : "2px solid transparent", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "details" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, marginBottom: 20 }}>
              <DetailRow label="Produto/serviço" value={c.productOrService} />
              <DetailRow label="Responsável" value={c.sellerName} />
              <DetailRow label="Data do fechamento" value={fmtData(c.closingDate)} />
              <DetailRow label="Forma de pagamento" value={c.paymentMethod} />
              <DetailRow label="Moeda" value={c.currency} />
              <DetailRow label="Comissão" value={c.commissionValue ? `${fmtBRL(c.commissionValue)}${c.commissionPercent ? ` (${c.commissionPercent}%)` : ""}` : null} />
              {c.clientEmail && <DetailRow label="E-mail" value={c.clientEmail} />}
              {c.clientPhone && <DetailRow label="Telefone" value={c.clientPhone} />}
              {c.description && <DetailRow label="Descrição" value={c.description} />}
              {c.notes && <DetailRow label="Observações" value={c.notes} />}
              <DetailRow label="Criado em" value={fmtData(c.createdAt)} />
            </div>

            {/* Validation controls */}
            {c.validationStatus === "pending" && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#92400E", marginBottom: 8 }}>Validação pendente</div>
                <textarea className="vx-input" value={validationNotes} onChange={(e) => setValidationNotes(e.target.value)} placeholder="Justificativa (opcional)" rows={2} style={{ resize: "vertical", width: "100%", marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="vx-btn vx-btn-sm" onClick={() => onValidate(c.id, "confirmed", validationNotes)} style={{ gap: 6, background: "#059669", borderColor: "#059669", color: "#fff", flex: 1 }}>
                    <CheckCircle2 size={14} /> Confirmar
                  </button>
                  <button className="vx-btn vx-btn-sm" onClick={() => onValidate(c.id, "rejected", validationNotes)} style={{ gap: 6, background: "#DC2626", borderColor: "#DC2626", color: "#fff", flex: 1 }}>
                    <XCircle size={14} /> Rejeitar
                  </button>
                </div>
              </div>
            )}

            {/* Move stage */}
            {stages.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#737373", marginBottom: 6 }}>Mover para etapa</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {stages.filter((s) => s.id !== c.stageId && !s.isArchived).map((s) => (
                    <button key={s.id} className="vx-btn vx-btn-sm" onClick={() => onMove(c.id, s.id)} style={{ gap: 6, fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} /> {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onEdit} style={{ justifyContent: "flex-start", gap: 8 }}>
                <Pencil size={14} /> Editar
              </button>
              <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onDelete} style={{ justifyContent: "flex-start", gap: 8, color: "var(--red, #DC2626)" }}>
                <Trash2 size={14} /> Excluir
              </button>
            </div>
          </>
        )}

        {tab === "history" && (
          <div>
            {(c.history || []).length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "#737373", fontSize: 13 }}>Nenhuma movimentação registrada.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {(c.history || []).map((h, i) => {
                  const fromStage = stageMap[h.fromStageId];
                  const toStage = stageMap[h.toStageId];
                  return (
                    <div key={h.id || i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: i < c.history.length - 1 ? `1px solid ${BORDA}` : "none" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: AZUL, marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#171717" }}>
                          {h.action === "stage_change" && fromStage && toStage ? `${fromStage.name} → ${toStage.name}` : null}
                          {h.action === "validation_change" ? `Validação: ${h.fromStatus || "—"} → ${h.toStatus || "—"}` : null}
                          {h.action === "created" ? "Fechamento registrado" : null}
                          {!["stage_change", "validation_change", "created"].includes(h.action) ? h.action : null}
                        </div>
                        {h.notes && <div style={{ fontSize: 12, color: "#737373", marginTop: 2 }}>{h.notes}</div>}
                        <div style={{ fontSize: 11, color: "#a3a3a3", marginTop: 2 }}>
                          {h.performedByName || "Sistema"} · {fmtData(h.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "#737373" }}>{label}</span>
      <span style={{ color: "#171717", fontWeight: 500, textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

/* ====================== STAGES MODAL ====================== */
function StagesModal({ stages, onClose, onCreateDefaults }) {
  const [list, setList] = useState([...stages].sort((a, b) => a.position - b.position));
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#318CE7");
  const [saving, setSaving] = useState(false);

  const addStage = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const r = await api("/gestao/pipeline-stages", {
      name: newName.trim(),
      color: newColor,
      position: list.length,
      isInitial: list.length === 0 ? 1 : 0,
      isCompletion: 0,
    });
    setSaving(false);
    if (r?.error) return;
    setNewName("");
    const stgs = await api("/gestao/pipeline-stages");
    if (Array.isArray(stgs)) setList(stgs.sort((a, b) => a.position - b.position));
  };

  const updateStage = async (id, fields) => {
    await apiPatch("/gestao/pipeline-stages/" + id, fields);
    setList((prev) => prev.map((s) => s.id === id ? { ...s, ...fields } : s));
  };

  const toggleInitial = async (id) => {
    for (const s of list) {
      if (s.isInitial && s.id !== id) await apiPatch("/gestao/pipeline-stages/" + s.id, { isInitial: 0 });
    }
    await apiPatch("/gestao/pipeline-stages/" + id, { isInitial: 1 });
    setList((prev) => prev.map((s) => ({ ...s, isInitial: s.id === id ? 1 : 0 })));
  };

  const toggleCompletion = async (id) => {
    const s = list.find((x) => x.id === id);
    await apiPatch("/gestao/pipeline-stages/" + id, { isCompletion: s.isCompletion ? 0 : 1 });
    setList((prev) => prev.map((x) => x.id === id ? { ...x, isCompletion: x.isCompletion ? 0 : 1 } : x));
  };

  const archiveStage = async (id) => {
    await apiPatch("/gestao/pipeline-stages/" + id, { isArchived: 1 });
    setList((prev) => prev.filter((s) => s.id !== id));
  };

  if (stages.length === 0 && list.length === 0) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 480, padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Configurar etapas</h2>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 3 }}><X size={18} /></button>
          </div>
          <p style={{ fontSize: 14, color: "#737373", marginBottom: 20 }}>Nenhuma etapa configurada. Comece com as etapas padrão ou crie as suas.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={async () => { await onCreateDefaults(); const stgs = await api("/gestao/pipeline-stages"); if (Array.isArray(stgs)) setList(stgs.sort((a, b) => a.position - b.position)); }}
              style={{ gap: 6, background: AZUL, borderColor: AZUL, flex: 1 }}>
              Criar etapas padrão
            </button>
          </div>
          {/* Manual add */}
          <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
            <input className="vx-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da etapa" style={{ flex: 1 }} />
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 36, height: 36, border: "none", cursor: "pointer", borderRadius: 6 }} />
            <button className="vx-btn vx-btn-sm" onClick={addStage} disabled={saving || !newName.trim()}>Adicionar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 540, maxHeight: "85vh", overflowY: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Configurar etapas</h2>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 3 }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {list.filter((s) => !s.isArchived).map((s, idx) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F8F9FB", borderRadius: 10 }}>
              <GripVertical size={16} style={{ color: "#a3a3a3", flexShrink: 0 }} />
              <input type="color" value={s.color || "#318CE7"} onChange={(e) => updateStage(s.id, { color: e.target.value })}
                style={{ width: 28, height: 28, border: "none", cursor: "pointer", borderRadius: 6, flexShrink: 0 }} />
              <input className="vx-input" value={s.name} onChange={(e) => updateStage(s.id, { name: e.target.value })}
                style={{ flex: 1, fontSize: 13, height: 32 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#737373", cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="radio" name="initial" checked={!!s.isInitial} onChange={() => toggleInitial(s.id)} /> Inicial
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#737373", cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={!!s.isCompletion} onChange={() => toggleCompletion(s.id)} /> Conclusão
              </label>
              <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => archiveStage(s.id)} title="Arquivar" style={{ padding: 3 }}>
                <Trash2 size={14} style={{ color: "#DC2626" }} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input className="vx-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova etapa" style={{ flex: 1 }} />
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 36, height: 36, border: "none", cursor: "pointer", borderRadius: 6 }} />
          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={addStage} disabled={saving || !newName.trim()} style={{ background: AZUL, borderColor: AZUL }}>
            <Plus size={15} /> Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

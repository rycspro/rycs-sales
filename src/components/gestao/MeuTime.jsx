import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, Search, X, Users, MoreVertical, LayoutGrid, List,
  UserPlus, UserMinus, Pencil, Trash2, Mail, ChevronRight,
  Shield, Activity, Target as TargetIcon, Info,
} from "lucide-react";
import { api, apiPatch, apiDelete } from "../../lib/api.js";

const AZUL = "#318CE7";
const AZUL_SUAVE = "#EAF4FF";
const BORDA = "#E8EAED";

const JOB_TITLES = ["SDR", "BDR", "Closer", "Vendedor", "Gestor comercial"];

const COMPENSATION_MODELS = [
  { key: "fixo", label: "Salário fixo" },
  { key: "fixo_comissao", label: "Fixo + comissão" },
  { key: "comissionado", label: "Exclusivamente comissionado" },
  { key: "tarefa", label: "Pagamento por tarefa" },
  { key: "personalizado", label: "Personalizado" },
  { key: "nao_informado", label: "Não informado" },
];

const ACCESS_LEVELS = [
  { key: "administrador", label: "Administrador" },
  { key: "gestor", label: "Gestor" },
  { key: "colaborador", label: "Colaborador" },
  { key: "personalizado", label: "Personalizado" },
];

const STATUS_MAP = {
  active: { label: "Ativo", color: "#16a34a", bg: "#dcfce7" },
  pending_invite: { label: "Convite pendente", color: "#d97706", bg: "#fef3c7" },
  deactivated: { label: "Desativado", color: "#dc2626", bg: "#fee2e2" },
};

const initials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatDate = (ts) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const EMPTY_FORM = {
  name: "", email: "", phone: "", photo: "", jobTitle: "Vendedor",
  departmentId: "", managerId: "", startDate: "", weeklyHours: "",
  compensationModel: "nao_informado", baseSalary: "", commissionPercent: "",
  taskRate: "", compensationNotes: "", accessLevel: "colaborador",
};

export default function MeuTime() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, deactivated: 0 });
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [viewMode, setViewMode] = useState("table");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [detailMember, setDetailMember] = useState(null);
  const [detailTab, setDetailTab] = useState("info");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const menuRef = useRef(null);

  const loadAll = useCallback(async () => {
    const [membersRes, statsRes, deptsRes] = await Promise.all([
      api("/gestao/team"),
      api("/gestao/team-stats"),
      api("/gestao/departments"),
    ]);
    if (Array.isArray(membersRes)) setMembers(membersRes);
    else if (membersRes?.members) setMembers(membersRes.members);
    else setMembers([]);
    if (statsRes && !statsRes.error) setStats(statsRes);
    if (Array.isArray(deptsRes)) setDepartments(deptsRes);
    else if (deptsRes?.departments) setDepartments(deptsRes.departments);
    else setDepartments([]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (menuOpen === null) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(null);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuOpen]);

  const filtered = members.filter((m) => {
    if (filterRole && m.jobTitle !== filterRole) return false;
    if (filterDept && String(m.departmentId) !== filterDept) return false;
    if (filterStatus && m.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !m.name?.toLowerCase().includes(s) &&
        !m.email?.toLowerCase().includes(s) &&
        !m.jobTitle?.toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setDrawerOpen(true);
    setDetailMember(null);
  };

  const openEdit = (m) => {
    setForm({
      name: m.name || "",
      email: m.email || "",
      phone: m.phone || "",
      photo: m.photo || "",
      jobTitle: m.jobTitle || "Vendedor",
      departmentId: m.departmentId ? String(m.departmentId) : "",
      managerId: m.managerId ? String(m.managerId) : "",
      startDate: m.startDate ? new Date(m.startDate).toISOString().slice(0, 10) : "",
      weeklyHours: m.weeklyHours || "",
      compensationModel: m.compensationModel || "nao_informado",
      baseSalary: m.baseSalary || "",
      commissionPercent: m.commissionPercent || "",
      taskRate: m.taskRate || "",
      compensationNotes: m.compensationNotes || "",
      accessLevel: m.accessLevel || "colaborador",
    });
    setEditingId(m.id);
    setDrawerOpen(true);
    setDetailMember(null);
    setMenuOpen(null);
  };

  const openDetail = (m) => {
    setDetailMember(m);
    setDetailTab("info");
    setDrawerOpen(false);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const body = {
      ...form,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      managerId: form.managerId ? Number(form.managerId) : null,
      startDate: form.startDate ? new Date(form.startDate).getTime() : null,
      weeklyHours: form.weeklyHours ? Number(form.weeklyHours) : null,
      baseSalary: form.baseSalary ? Number(form.baseSalary) : null,
      commissionPercent: form.commissionPercent ? Number(form.commissionPercent) : null,
      taskRate: form.taskRate ? Number(form.taskRate) : null,
    };
    if (editingId) {
      await apiPatch("/gestao/team/" + editingId, body);
    } else {
      await api("/gestao/team", body);
    }
    setSaving(false);
    setDrawerOpen(false);
    loadAll();
  };

  const toggleStatus = async (m) => {
    const newStatus = m.status === "active" ? "deactivated" : "active";
    await api("/gestao/team/" + m.id + "/status", { status: newStatus });
    setMenuOpen(null);
    loadAll();
  };

  const remove = async (m) => {
    if (!confirm(`Remover ${m.name} do time?`)) return;
    await apiDelete("/gestao/team/" + m.id);
    setMenuOpen(null);
    if (detailMember?.id === m.id) setDetailMember(null);
    loadAll();
  };

  const sendInvite = async (m) => {
    await api("/gestao/team/" + m.id + "/invite", {});
    setMenuOpen(null);
    loadAll();
  };

  const getDeptName = (id) => {
    const d = departments.find((dep) => dep.id === id);
    return d ? d.name : "—";
  };

  const getManagerName = (id) => {
    const m = members.find((mem) => mem.id === id);
    return m ? m.name : "—";
  };

  if (loading) return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;

  const statusBadge = (status) => {
    const s = STATUS_MAP[status] || STATUS_MAP.active;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500,
        padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.color,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
        {s.label}
      </span>
    );
  };

  const avatar = (m, size = 36) => (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: AZUL_SUAVE,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      fontSize: size * 0.38, fontWeight: 600, color: AZUL, overflow: "hidden",
    }}>
      {m.photo
        ? <img src={m.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initials(m.name)
      }
    </div>
  );

  // ── Empty state ──
  if (members.length === 0 && !search && !filterRole && !filterDept && !filterStatus) {
    return (
      <div className="vx-fade">
        <div style={{ textAlign: "center", padding: "80px 24px" }}>
          <span style={{
            width: 64, height: 64, borderRadius: 16, background: AZUL_SUAVE,
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
          }}>
            <Users size={32} style={{ color: AZUL }} />
          </span>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Seu time comercial começa aqui</h2>
          <p style={{ fontSize: 14, color: "#737373", margin: "0 0 24px", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
            Cadastre seus próprios vendedores e organize toda a sua operação comercial dentro da RYCS.
          </p>
          <button className="vx-btn vx-btn-primary" onClick={openAdd}
            style={{ gap: 6, background: AZUL, borderColor: AZUL }}>
            <UserPlus size={18} /> Adicionar primeiro colaborador
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vx-fade" style={{ position: "relative" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 4 }}>
            Gestão interna
          </div>
          <h1 className="vx-disp" style={{ fontSize: 22, margin: 0 }}>Meu time</h1>
          <p style={{ color: "#737373", margin: "4px 0 0", fontSize: 14 }}>
            Organize e acompanhe sua própria equipe comercial.
          </p>
        </div>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={openAdd}
          style={{ gap: 6, background: AZUL, borderColor: AZUL, whiteSpace: "nowrap" }}>
          <Plus size={16} /> Adicionar colaborador
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total de colaboradores", value: stats.total },
          { label: "Colaboradores ativos", value: stats.active, color: "#16a34a" },
          { label: "Convites pendentes", value: stats.pending, color: "#d97706" },
          { label: "Colaboradores desativados", value: stats.deactivated, color: "#dc2626" },
        ].map((s, i) => (
          <div key={i} style={{
            background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 16,
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color || "#171717" }}>{s.value}</div>
            <div style={{ fontSize: 13, color: "#737373", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#737373" }} />
          <input className="vx-input" placeholder="Buscar por nome, e-mail ou função..." value={search}
            onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 32, width: "100%", height: 36 }} />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#737373", padding: 2 }}>
              <X size={14} />
            </button>
          )}
        </div>
        <select className="vx-input" value={filterRole} onChange={(e) => setFilterRole(e.target.value)} style={{ height: 36, width: "auto", minWidth: 130 }}>
          <option value="">Todas as funções</option>
          {JOB_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="vx-input" value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ height: 36, width: "auto", minWidth: 140 }}>
          <option value="">Todos os departamentos</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="vx-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ height: 36, width: "auto", minWidth: 120 }}>
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="pending_invite">Convite pendente</option>
          <option value="deactivated">Desativado</option>
        </select>
        <div style={{ display: "flex", gap: 2, background: "#F8F9FB", borderRadius: 10, padding: 2 }}>
          <button onClick={() => setViewMode("table")} title="Lista"
            style={{ padding: "6px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: viewMode === "table" ? AZUL : "transparent", color: viewMode === "table" ? "#fff" : "#737373" }}>
            <List size={16} />
          </button>
          <button onClick={() => setViewMode("cards")} title="Cards"
            style={{ padding: "6px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: viewMode === "cards" ? AZUL : "transparent", color: viewMode === "cards" ? "#fff" : "#737373" }}>
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", border: `1px dashed ${BORDA}`, borderRadius: 12 }}>
              <Search size={36} strokeWidth={1.3} style={{ color: "#737373", marginBottom: 10 }} />
              <p style={{ fontSize: 14, color: "#737373", margin: 0 }}>Nenhum colaborador encontrado.</p>
            </div>
          ) : viewMode === "table" ? (
            <div className="vx-table-wrap">
              <table className="vx-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 44 }}></th>
                    <th>Nome</th>
                    <th>Função</th>
                    <th>Departamento</th>
                    <th>Gestor</th>
                    <th>Status</th>
                    <th>Última atividade</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id} onClick={() => openDetail(m)} style={{ cursor: "pointer" }}>
                      <td>{avatar(m)}</td>
                      <td style={{ fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <div>{m.name}</div>
                        {m.email && <div style={{ fontSize: 12, color: "#737373", fontWeight: 400 }}>{m.email}</div>}
                      </td>
                      <td style={{ color: "#737373" }}>{m.jobTitle || "—"}</td>
                      <td style={{ color: "#737373" }}>{m.departmentId ? getDeptName(m.departmentId) : "—"}</td>
                      <td style={{ color: "#737373" }}>{m.managerId ? getManagerName(m.managerId) : "—"}</td>
                      <td>{statusBadge(m.status)}</td>
                      <td style={{ color: "#737373" }}>{formatDate(m.lastActivityAt)}</td>
                      <td>
                        <div style={{ position: "relative" }} ref={menuOpen === m.id ? menuRef : null}>
                          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === m.id ? null : m.id); }}
                            className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: 3 }}>
                            <MoreVertical size={15} />
                          </button>
                          {menuOpen === m.id && (
                            <div style={{
                              position: "absolute", right: 0, top: 28, background: "#fff", border: `1px solid ${BORDA}`,
                              borderRadius: 10, padding: 4, minWidth: 160, zIndex: 20, boxShadow: "var(--shadow-pop)",
                            }}>
                              <MenuBtn icon={Pencil} label="Editar" onClick={(e) => { e.stopPropagation(); openEdit(m); }} />
                              {m.status !== "deactivated" && m.email && (
                                <MenuBtn icon={Mail} label="Enviar convite" onClick={(e) => { e.stopPropagation(); sendInvite(m); }} />
                              )}
                              <MenuBtn
                                icon={m.status === "active" ? UserMinus : UserPlus}
                                label={m.status === "active" ? "Desativar" : "Reativar"}
                                onClick={(e) => { e.stopPropagation(); toggleStatus(m); }}
                              />
                              <MenuBtn icon={Trash2} label="Excluir" danger onClick={(e) => { e.stopPropagation(); remove(m); }} />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 14 }}>
              {filtered.map((m) => (
                <div key={m.id} onClick={() => openDetail(m)}
                  style={{
                    background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 20,
                    cursor: "pointer", transition: "border-color .15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = AZUL}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = BORDA}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    {avatar(m, 44)}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#171717", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                      <div style={{ fontSize: 13, color: "#737373" }}>{m.jobTitle || "—"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#737373" }}>{m.departmentId ? getDeptName(m.departmentId) : "Sem departamento"}</span>
                    {statusBadge(m.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {detailMember && (
          <DetailPanel
            member={detailMember} tab={detailTab} setTab={setDetailTab}
            onClose={() => setDetailMember(null)} onEdit={() => openEdit(detailMember)}
            onToggleStatus={() => toggleStatus(detailMember)} onRemove={() => remove(detailMember)}
            getDeptName={getDeptName} getManagerName={getManagerName}
            avatar={avatar} statusBadge={statusBadge}
          />
        )}
      </div>

      {/* Add/Edit Drawer */}
      {drawerOpen && (
        <DrawerForm
          form={form} setForm={setForm} saving={saving}
          editingId={editingId} departments={departments} members={members}
          onSave={save} onClose={() => setDrawerOpen(false)}
          onAddDept={async (name) => {
            const r = await api("/gestao/departments", { name });
            if (r && !r.error) {
              const deptsRes = await api("/gestao/departments");
              if (Array.isArray(deptsRes)) setDepartments(deptsRes);
              else if (deptsRes?.departments) setDepartments(deptsRes.departments);
            }
          }}
        />
      )}
    </div>
  );
}

function MenuBtn({ icon: Icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px",
        fontSize: 13, background: "none", border: "none", cursor: "pointer", borderRadius: 6,
        color: danger ? "var(--red)" : "#171717",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "#F8F9FB"}
      onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
      <Icon size={15} /> {label}
    </button>
  );
}

function DetailPanel({ member: m, tab, setTab, onClose, onEdit, onToggleStatus, onRemove, getDeptName, getManagerName, avatar, statusBadge }) {
  const tabs = [
    { key: "info", label: "Informações", Icon: Info },
    { key: "activity", label: "Atividades", Icon: Activity },
    { key: "goals", label: "Metas", Icon: TargetIcon },
    { key: "permissions", label: "Permissões", Icon: Shield },
  ];

  const compLabel = COMPENSATION_MODELS.find((c) => c.key === m.compensationModel)?.label || "Não informado";

  return (
    <div style={{
      width: 360, flexShrink: 0, background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12,
      padding: 20, position: "sticky", top: 20, maxHeight: "calc(100vh - 120px)", overflowY: "auto",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".5px" }}>Perfil</span>
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 3 }}><X size={16} /></button>
      </div>

      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        {avatar(m, 52)}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#171717" }}>{m.name}</div>
          <div style={{ fontSize: 13, color: "#737373" }}>{m.jobTitle || "—"}</div>
          <div style={{ marginTop: 4 }}>{statusBadge(m.status)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${BORDA}`, marginBottom: 16 }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 12px", fontSize: 12, fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? AZUL : "#737373", background: "none", border: "none",
            borderBottom: tab === t.key ? `2px solid ${AZUL}` : "2px solid transparent",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
          }}>
            <t.Icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "info" && (
        <div style={{ fontSize: 13, color: "#737373", display: "flex", flexDirection: "column", gap: 8 }}>
          <InfoRow label="E-mail" value={m.email} />
          <InfoRow label="WhatsApp" value={m.phone} />
          <InfoRow label="Departamento" value={m.departmentId ? getDeptName(m.departmentId) : null} />
          <InfoRow label="Gestor" value={m.managerId ? getManagerName(m.managerId) : null} />
          <InfoRow label="Data de entrada" value={formatDate(m.startDate)} />
          <InfoRow label="Carga horária" value={m.weeklyHours ? `${m.weeklyHours}h/semana` : null} />
          <div style={{ borderTop: `1px solid ${BORDA}`, margin: "4px 0", paddingTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Remuneração</div>
            <InfoRow label="Modelo" value={compLabel} />
            {m.baseSalary > 0 && <InfoRow label="Salário base" value={`R$ ${Number(m.baseSalary).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />}
            {m.commissionPercent > 0 && <InfoRow label="Comissão" value={`${m.commissionPercent}%`} />}
            {m.taskRate > 0 && <InfoRow label="Valor por tarefa" value={`R$ ${Number(m.taskRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />}
            {m.compensationNotes && <InfoRow label="Observações" value={m.compensationNotes} />}
          </div>
        </div>
      )}
      {tab === "activity" && (
        <div style={{ textAlign: "center", padding: "32px 16px", color: "#737373", fontSize: 13 }}>
          <Activity size={28} strokeWidth={1.3} style={{ color: "#b8bcc4", marginBottom: 8 }} />
          <p style={{ margin: 0 }}>Nenhuma atividade registrada.</p>
        </div>
      )}
      {tab === "goals" && (
        <div style={{ textAlign: "center", padding: "32px 16px", color: "#737373", fontSize: 13 }}>
          <TargetIcon size={28} strokeWidth={1.3} style={{ color: "#b8bcc4", marginBottom: 8 }} />
          <p style={{ margin: 0 }}>Nenhuma meta atribuída.</p>
        </div>
      )}
      {tab === "permissions" && (
        <div style={{ fontSize: 13, color: "#737373" }}>
          <InfoRow label="Nível de acesso" value={ACCESS_LEVELS.find((a) => a.key === m.accessLevel)?.label || "Colaborador"} />
          <p style={{ fontSize: 12, color: "#b8bcc4", marginTop: 12 }}>Configuração detalhada de permissões estará disponível em breve.</p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 16, borderTop: `1px solid ${BORDA}`, paddingTop: 16 }}>
        <MenuBtn icon={Pencil} label="Editar colaborador" onClick={onEdit} />
        <MenuBtn
          icon={m.status === "active" ? UserMinus : UserPlus}
          label={m.status === "active" ? "Desativar colaborador" : "Reativar colaborador"}
          onClick={onToggleStatus}
        />
        <MenuBtn icon={Trash2} label="Excluir colaborador" danger onClick={onRemove} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span>{label}</span>
      <span style={{ color: "#171717", fontWeight: 500, textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function DrawerForm({ form, setForm, saving, editingId, departments, members, onSave, onClose, onAddDept }) {
  const [newDept, setNewDept] = useState("");
  const [showNewDept, setShowNewDept] = useState(false);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const showBaseSalary = ["fixo", "fixo_comissao", "personalizado"].includes(form.compensationModel);
  const showCommission = ["fixo_comissao", "comissionado", "personalizado"].includes(form.compensationModel);
  const showTaskRate = ["tarefa", "personalizado"].includes(form.compensationModel);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000,
      display: "flex", justifyContent: "flex-end",
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 420, maxWidth: "100vw", background: "#fff", height: "100%",
        overflowY: "auto", padding: 28, boxShadow: "-4px 0 24px rgba(0,0,0,.08)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            {editingId ? "Editar colaborador" : "Adicionar colaborador"}
          </h2>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose} style={{ padding: 3 }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nome completo *">
            <input className="vx-input" value={form.name} onChange={set("name")} placeholder="Nome do colaborador" />
          </Field>
          <Field label="E-mail">
            <input className="vx-input" type="email" value={form.email} onChange={set("email")} placeholder="email@empresa.com" />
          </Field>
          <Field label="WhatsApp">
            <input className="vx-input" value={form.phone} onChange={set("phone")} placeholder="(00) 00000-0000" />
          </Field>
          <Field label="Função">
            <select className="vx-input" value={form.jobTitle} onChange={set("jobTitle")}>
              {JOB_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              {form.jobTitle && !JOB_TITLES.includes(form.jobTitle) && (
                <option value={form.jobTitle}>{form.jobTitle}</option>
              )}
            </select>
            <input className="vx-input" value={!JOB_TITLES.includes(form.jobTitle) ? form.jobTitle : ""}
              onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))}
              placeholder="Ou digite uma função personalizada" style={{ marginTop: 6 }} />
          </Field>
          <Field label="Departamento">
            <div style={{ display: "flex", gap: 6 }}>
              <select className="vx-input" value={form.departmentId} onChange={set("departmentId")} style={{ flex: 1 }}>
                <option value="">Nenhum</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setShowNewDept(!showNewDept)}
                style={{ padding: "4px 8px", fontSize: 12 }}>
                <Plus size={14} />
              </button>
            </div>
            {showNewDept && (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input className="vx-input" value={newDept} onChange={(e) => setNewDept(e.target.value)}
                  placeholder="Nome do departamento" style={{ flex: 1 }} />
                <button className="vx-btn vx-btn-primary vx-btn-sm" disabled={!newDept.trim()}
                  style={{ background: AZUL, borderColor: AZUL }}
                  onClick={async () => {
                    if (!newDept.trim()) return;
                    await onAddDept(newDept.trim());
                    setNewDept("");
                    setShowNewDept(false);
                  }}>Criar</button>
              </div>
            )}
          </Field>
          <Field label="Gestor responsável">
            <select className="vx-input" value={form.managerId} onChange={set("managerId")}>
              <option value="">Nenhum</option>
              {members.filter((m) => m.id !== editingId).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Data de entrada">
            <input className="vx-input" type="date" value={form.startDate} onChange={set("startDate")} />
          </Field>
          <Field label="Carga horária semanal">
            <input className="vx-input" type="number" value={form.weeklyHours} onChange={set("weeklyHours")}
              placeholder="Ex: 44" min="0" max="168" />
          </Field>

          <div style={{ borderTop: `1px solid ${BORDA}`, margin: "4px 0", paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>
              Remuneração
            </div>
            <Field label="Modelo de remuneração">
              <select className="vx-input" value={form.compensationModel} onChange={set("compensationModel")}>
                {COMPENSATION_MODELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
            {showBaseSalary && (
              <Field label="Salário base (R$)">
                <input className="vx-input" type="number" value={form.baseSalary} onChange={set("baseSalary")}
                  placeholder="0,00" min="0" step="0.01" />
              </Field>
            )}
            {showCommission && (
              <Field label="Comissão (%)">
                <input className="vx-input" type="number" value={form.commissionPercent} onChange={set("commissionPercent")}
                  placeholder="0" min="0" max="100" step="0.1" />
              </Field>
            )}
            {showTaskRate && (
              <Field label="Valor por tarefa (R$)">
                <input className="vx-input" type="number" value={form.taskRate} onChange={set("taskRate")}
                  placeholder="0,00" min="0" step="0.01" />
              </Field>
            )}
            <Field label="Observações sobre remuneração">
              <textarea className="vx-input" value={form.compensationNotes} onChange={set("compensationNotes")}
                rows={2} style={{ resize: "vertical" }} placeholder="Opcional" />
            </Field>
          </div>

          <div style={{ borderTop: `1px solid ${BORDA}`, margin: "4px 0", paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>
              Permissões
            </div>
            <Field label="Nível de acesso">
              <select className="vx-input" value={form.accessLevel} onChange={set("accessLevel")}>
                {ACCESS_LEVELS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="vx-btn vx-btn-primary" onClick={onSave} disabled={saving || !form.name.trim()}
              style={{ flex: 1, background: AZUL, borderColor: AZUL }}>
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar colaborador"}
            </button>
            <button className="vx-btn vx-btn-ghost" onClick={onClose}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="vx-label" style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: "block" }}>{label}</label>
      {children}
    </div>
  );
}

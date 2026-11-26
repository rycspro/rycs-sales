import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X, Clock, Users,
  Video, Phone, MapPin, Link2, Search, Filter, CalendarCheck2,
  CalendarX2, UserX, BarChart3, Eye, Pencil, Trash2, Check,
} from "lucide-react";
import { api } from "../../lib/api.js";
import { Stat } from "../ui.jsx";
import "./CalendarioComercial.css";

const VIEWS = { month: "Mês", week: "Semana", day: "Dia" };
const MEETING_TYPES = {
  qualification: "Qualificação", diagnosis: "Diagnóstico",
  commercial_presentation: "Apresentação Comercial", demonstration: "Demonstração",
  negotiation: "Negociação", proposal_presentation: "Proposta",
  closing: "Fechamento", follow_up: "Follow-up",
  internal: "Interna", custom: "Personalizada",
};
const STATUS_MAP = {
  scheduled: { label: "Agendada", tone: "brand" },
  confirmed: { label: "Confirmada", tone: "indigo" },
  in_progress: { label: "Em andamento", tone: "amber" },
  completed: { label: "Realizada", tone: "green" },
  no_show: { label: "Não compareceu", tone: "red" },
  cancelled: { label: "Cancelada", tone: "muted" },
  rescheduled: { label: "Reagendada", tone: "amber" },
  awaiting_validation: { label: "Aguardando validação", tone: "amber" },
};
const PLATFORMS = {
  google_meet: { label: "Google Meet", Icon: Video },
  external_link: { label: "Link externo", Icon: Link2 },
  in_person: { label: "Presencial", Icon: MapPin },
  phone_call: { label: "Telefone", Icon: Phone },
};

const pad2 = (n) => String(n).padStart(2, "0");
const fmtDate = (ts) => new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtTime = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtWeekday = (ts) => new Date(ts).toLocaleDateString("pt-BR", { weekday: "short" });
const fmtMonthYear = (d) => d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days = [];
  const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }
  for (let i = 1; i <= last.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  while (days.length < 42) {
    const d = new Date(year, month + 1, days.length - last.getDate() - startDay + 1);
    days.push({ date: d, isCurrentMonth: false });
  }
  return days;
}

function getWeekDays(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

export default function CalendarioComercial() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ scheduled: 0, confirmed: 0, completed: 0, noShow: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const [evts, st] = await Promise.all([api("/calendario"), api("/calendario-stats")]);
    setEvents(Array.isArray(evts) ? evts : []);
    if (st && !st.error) setStats(st);
    setLoading(false);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const filtered = useMemo(() => {
    let list = events;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.title?.toLowerCase().includes(q) || e.organizerName?.toLowerCase().includes(q));
    }
    if (filterStatus) list = list.filter((e) => e.status === filterStatus);
    if (filterType) list = list.filter((e) => e.meetingType === filterType);
    return list;
  }, [events, search, filterStatus, filterType]);

  const eventsForDay = useCallback((date) => {
    return filtered.filter((e) => isSameDay(new Date(e.startAt), date));
  }, [filtered]);

  const navigate = (dir) => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  return (
    <div className="cal-page vx-fade">
      <header className="cal-header">
        <div className="cal-header-left">
          <CalendarDays size={22} className="cal-icon-title" />
          <div>
            <h2 className="vx-disp">Calendário Comercial</h2>
            <p className="vx-mut">Gerencie reuniões, disponibilidade e agendamentos do time comercial.</p>
          </div>
        </div>
        <button className="vx-btn vx-btn-primary cal-btn-new" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Nova reunião
        </button>
      </header>

      <div className="cal-stats">
        <Stat label="Agendadas" value={stats.scheduled} Icon={CalendarDays} />
        <Stat label="Confirmadas" value={stats.confirmed} Icon={CalendarCheck2} />
        <Stat label="Realizadas" value={stats.completed} Icon={Check} />
        <Stat label="Não compareceram" value={stats.noShow} Icon={UserX} />
      </div>

      <div className="cal-toolbar">
        <div className="cal-toolbar-left">
          <div className="cal-nav">
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => navigate(-1)}><ChevronLeft size={16} /></button>
            <button className="vx-btn vx-btn-ghost vx-btn-sm cal-today" onClick={goToday}>Hoje</button>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => navigate(1)}><ChevronRight size={16} /></button>
          </div>
          <h3 className="cal-period">
            {view === "month" && fmtMonthYear(currentDate)}
            {view === "week" && (() => {
              const days = getWeekDays(currentDate);
              return `${fmtDate(days[0])} — ${fmtDate(days[6])}`;
            })()}
            {view === "day" && currentDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h3>
        </div>
        <div className="cal-toolbar-right">
          <div className="cal-search">
            <Search size={14} />
            <input placeholder="Buscar reunião…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="vx-input cal-filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="vx-input cal-filter" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Todos os tipos</option>
            {Object.entries(MEETING_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="vx-seg cal-views" role="tablist">
            {Object.entries(VIEWS).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={view === k} data-on={view === k ? "1" : "0"} onClick={() => setView(k)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="cal-loading"><div className="vx-spinner" /></div>
      ) : (
        <>
          {view === "month" && <MonthView currentDate={currentDate} eventsForDay={eventsForDay} onSelect={setSelectedEvent} onDayClick={(d) => { setCurrentDate(d); setView("day"); }} />}
          {view === "week" && <WeekView currentDate={currentDate} eventsForDay={eventsForDay} onSelect={setSelectedEvent} />}
          {view === "day" && <DayView currentDate={currentDate} eventsForDay={eventsForDay} onSelect={setSelectedEvent} />}
        </>
      )}

      {showCreate && <CreateDrawer onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadEvents(); }} />}
      {selectedEvent && <DetailDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} onUpdated={() => { setSelectedEvent(null); loadEvents(); }} />}
    </div>
  );
}

function MonthView({ currentDate, eventsForDay, onSelect, onDayClick }) {
  const days = getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
  const today = new Date();
  return (
    <div className="cal-month">
      <div className="cal-month-header">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => <div key={d} className="cal-weekday">{d}</div>)}
      </div>
      <div className="cal-month-grid">
        {days.map(({ date, isCurrentMonth }, i) => {
          const dayEvents = eventsForDay(date);
          const isToday = isSameDay(date, today);
          return (
            <div key={i} className={`cal-day ${isCurrentMonth ? "" : "cal-day-other"} ${isToday ? "cal-day-today" : ""}`}
              onClick={() => onDayClick(date)}>
              <span className={`cal-day-num ${isToday ? "cal-today-mark" : ""}`}>{date.getDate()}</span>
              <div className="cal-day-events">
                {dayEvents.slice(0, 3).map((e) => (
                  <button key={e.id} className={`cal-event-pill cal-tone-${STATUS_MAP[e.status]?.tone || "muted"}`}
                    onClick={(ev) => { ev.stopPropagation(); onSelect(e); }}>
                    <span className="cal-pill-time">{fmtTime(e.startAt)}</span> {e.title}
                  </button>
                ))}
                {dayEvents.length > 3 && <span className="cal-more">+{dayEvents.length - 3} mais</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ currentDate, eventsForDay, onSelect }) {
  const days = getWeekDays(currentDate);
  const today = new Date();
  return (
    <div className="cal-week">
      <div className="cal-week-header">
        <div className="cal-time-gutter" />
        {days.map((d) => (
          <div key={d.toISOString()} className={`cal-week-day-header ${isSameDay(d, today) ? "cal-week-today" : ""}`}>
            <span className="cal-week-dayname">{fmtWeekday(d)}</span>
            <span className={`cal-week-daynum ${isSameDay(d, today) ? "cal-today-mark" : ""}`}>{d.getDate()}</span>
          </div>
        ))}
      </div>
      <div className="cal-week-body">
        {HOURS.map((h) => (
          <div key={h} className="cal-week-row">
            <div className="cal-time-gutter cal-time-label">{pad2(h)}:00</div>
            {days.map((d) => {
              const dayEvts = eventsForDay(d).filter((e) => new Date(e.startAt).getHours() === h);
              return (
                <div key={d.toISOString()} className="cal-week-cell">
                  {dayEvts.map((e) => (
                    <button key={e.id} className={`cal-week-event cal-tone-${STATUS_MAP[e.status]?.tone || "muted"}`}
                      onClick={() => onSelect(e)}>
                      <strong>{fmtTime(e.startAt)}</strong> {e.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayView({ currentDate, eventsForDay, onSelect }) {
  const dayEvents = eventsForDay(currentDate);
  return (
    <div className="cal-day-view">
      <div className="cal-day-view-header">
        <h3>{currentDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</h3>
        <span className="vx-mut">{dayEvents.length} reunião(ões)</span>
      </div>
      {HOURS.map((h) => {
        const hourEvts = dayEvents.filter((e) => new Date(e.startAt).getHours() === h);
        return (
          <div key={h} className="cal-day-row">
            <div className="cal-time-label">{pad2(h)}:00</div>
            <div className="cal-day-slot">
              {hourEvts.map((e) => {
                const st = STATUS_MAP[e.status] || STATUS_MAP.scheduled;
                const pl = PLATFORMS[e.platform] || PLATFORMS.google_meet;
                return (
                  <button key={e.id} className={`cal-day-event cal-tone-${st.tone}`} onClick={() => onSelect(e)}>
                    <div className="cal-day-event-top">
                      <strong>{fmtTime(e.startAt)}–{fmtTime(e.endAt)}</strong>
                      <span className={`vx-badge vx-badge-${st.tone}`}>{st.label}</span>
                    </div>
                    <div className="cal-day-event-title">{e.title}</div>
                    <div className="cal-day-event-meta">
                      <pl.Icon size={13} /> {pl.label}
                      {e.organizerName && <span>· {e.organizerName}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CreateDrawer({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: "", meetingType: "custom", platform: "google_meet",
    date: new Date().toISOString().slice(0, 10), startTime: "09:00", duration: 30,
    clientName: "", clientEmail: "", description: "", enableAiAnalysis: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target?.type === "checkbox" ? e.target.checked : (e.target?.value ?? e) }));

  async function submit(e) {
    e.preventDefault();
    if (!form.title || !form.date || !form.startTime) return setError("Preencha título, data e horário.");
    setSaving(true);
    setError("");
    const start = new Date(`${form.date}T${form.startTime}`).getTime();
    const end = start + form.duration * 60000;
    const participants = form.clientName ? [{ name: form.clientName, email: form.clientEmail, role: "lead" }] : [];
    const r = await api("/calendario", {
      title: form.title, description: form.description, meetingType: form.meetingType,
      platform: form.platform, startAt: start, endAt: end,
      enableAiAnalysis: form.enableAiAnalysis, participants,
    });
    setSaving(false);
    if (!r || r.error) return setError(r?.error || "Erro ao criar reunião.");
    onCreated();
  }

  return (
    <div className="cal-overlay" onClick={onClose}>
      <form className="cal-drawer" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <div className="cal-drawer-header">
          <h3>Nova reunião</h3>
          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="cal-drawer-body">
          <label className="vx-label">Título *</label>
          <input className="vx-input" value={form.title} onChange={set("title")} placeholder="Ex: Reunião de qualificação" />

          <div className="cal-row">
            <div className="cal-col">
              <label className="vx-label">Tipo de reunião</label>
              <select className="vx-input" value={form.meetingType} onChange={set("meetingType")}>
                {Object.entries(MEETING_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="cal-col">
              <label className="vx-label">Plataforma</label>
              <select className="vx-input" value={form.platform} onChange={set("platform")}>
                {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="cal-row">
            <div className="cal-col">
              <label className="vx-label">Data *</label>
              <input className="vx-input" type="date" value={form.date} onChange={set("date")} />
            </div>
            <div className="cal-col">
              <label className="vx-label">Horário *</label>
              <input className="vx-input" type="time" value={form.startTime} onChange={set("startTime")} />
            </div>
            <div className="cal-col">
              <label className="vx-label">Duração</label>
              <select className="vx-input" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}>
                {[15, 30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n} min</option>)}
              </select>
            </div>
          </div>

          <label className="vx-label">Nome do cliente</label>
          <input className="vx-input" value={form.clientName} onChange={set("clientName")} placeholder="Nome do lead ou empresa" />
          <label className="vx-label">E-mail do cliente</label>
          <input className="vx-input" type="email" value={form.clientEmail} onChange={set("clientEmail")} placeholder="email@empresa.com" />

          <label className="vx-label">Descrição</label>
          <textarea className="vx-input cal-textarea" value={form.description} onChange={set("description")} rows={3} placeholder="Pauta, observações…" />

          <label className="cal-check">
            <input type="checkbox" checked={form.enableAiAnalysis} onChange={set("enableAiAnalysis")} />
            Habilitar análise por IA após a reunião
          </label>

          {error && <p className="cal-error" role="alert">{error}</p>}
        </div>
        <div className="cal-drawer-footer">
          <button type="button" className="vx-btn vx-btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="vx-btn vx-btn-primary" disabled={saving}>{saving ? "Salvando…" : "Criar reunião"}</button>
        </div>
      </form>
    </div>
  );
}

function DetailDrawer({ event, onClose, onUpdated }) {
  const [tab, setTab] = useState("overview");
  const [updating, setUpdating] = useState(false);
  const st = STATUS_MAP[event.status] || STATUS_MAP.scheduled;
  const pl = PLATFORMS[event.platform] || PLATFORMS.google_meet;

  async function changeStatus(newStatus) {
    setUpdating(true);
    await api(`/calendario/${event.id}/status`, { status: newStatus });
    setUpdating(false);
    onUpdated();
  }

  async function deleteEvent() {
    if (!window.confirm("Excluir esta reunião? Esta ação não pode ser desfeita.")) return;
    setUpdating(true);
    await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3001" : "")}/api/calendario/${event.id}`, {
      method: "DELETE", credentials: "include",
    });
    setUpdating(false);
    onUpdated();
  }

  const tabs = [
    ["overview", "Visão geral"],
    ["participants", `Participantes (${event.participants?.length || 0})`],
    ["history", "Histórico"],
  ];

  return (
    <div className="cal-overlay" onClick={onClose}>
      <div className="cal-drawer cal-drawer-detail" onClick={(e) => e.stopPropagation()}>
        <div className="cal-drawer-header">
          <div>
            <span className={`vx-badge vx-badge-${st.tone}`}>{st.label}</span>
            <h3>{event.title}</h3>
          </div>
          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="vx-seg cal-detail-tabs" role="tablist">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} data-on={tab === k ? "1" : "0"} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        <div className="cal-drawer-body">
          {tab === "overview" && (
            <>
              <div className="cal-detail-grid">
                <div className="cal-detail-item">
                  <Clock size={15} /> <strong>Horário</strong>
                  <span>{fmtDate(event.startAt)} · {fmtTime(event.startAt)}–{fmtTime(event.endAt)}</span>
                </div>
                <div className="cal-detail-item">
                  <pl.Icon size={15} /> <strong>Plataforma</strong>
                  <span>{pl.label}</span>
                </div>
                <div className="cal-detail-item">
                  <BarChart3 size={15} /> <strong>Tipo</strong>
                  <span>{MEETING_TYPES[event.meetingType] || event.meetingType}</span>
                </div>
                {event.organizerName && (
                  <div className="cal-detail-item">
                    <Users size={15} /> <strong>Organizador</strong>
                    <span>{event.organizerName}{event.organizerEmail && ` (${event.organizerEmail})`}</span>
                  </div>
                )}
                {event.meetingLink && (
                  <div className="cal-detail-item">
                    <Link2 size={15} /> <strong>Link</strong>
                    <a href={event.meetingLink} target="_blank" rel="noreferrer">{event.meetingLink}</a>
                  </div>
                )}
              </div>
              {event.description && <p className="cal-detail-desc">{event.description}</p>}
              {event.notes && <p className="cal-detail-notes"><strong>Notas:</strong> {event.notes}</p>}
              <div className="cal-detail-flags">
                {event.recordingEnabled === 1 && <span className="vx-badge vx-badge-indigo">Gravação</span>}
                {event.transcriptionEnabled === 1 && <span className="vx-badge vx-badge-indigo">Transcrição</span>}
                {event.aiAnalysisEnabled === 1 && <span className="vx-badge vx-badge-indigo">Análise IA</span>}
              </div>
            </>
          )}
          {tab === "participants" && (
            <div className="cal-participants">
              {(event.participants || []).length === 0 && <p className="vx-mut">Nenhum participante registrado.</p>}
              {(event.participants || []).map((p) => (
                <div key={p.id} className="cal-participant">
                  <strong>{p.name}</strong>
                  <span className="vx-mut">{p.role}</span>
                  {p.email && <span>{p.email}</span>}
                  <span className={`vx-badge vx-badge-${p.confirmationStatus === "confirmed" ? "green" : "muted"}`}>
                    {p.confirmationStatus === "confirmed" ? "Confirmado" : p.confirmationStatus === "declined" ? "Recusou" : "Pendente"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {tab === "history" && (
            <div className="cal-history">
              <p className="vx-mut">Criado em {fmtDate(event.createdAt)} às {fmtTime(event.createdAt)}</p>
              {event.updatedAt !== event.createdAt && <p className="vx-mut">Atualizado em {fmtDate(event.updatedAt)} às {fmtTime(event.updatedAt)}</p>}
            </div>
          )}
        </div>

        <div className="cal-drawer-footer">
          <button type="button" className="vx-btn vx-btn-ghost cal-btn-delete" onClick={deleteEvent} disabled={updating}>
            <Trash2 size={15} /> Excluir
          </button>
          <div className="cal-footer-actions">
            {event.status === "scheduled" && (
              <>
                <button className="vx-btn vx-btn-ghost vx-btn-sm" disabled={updating} onClick={() => changeStatus("cancelled")}>Cancelar</button>
                <button className="vx-btn vx-btn-ghost vx-btn-sm" disabled={updating} onClick={() => changeStatus("confirmed")}>Confirmar</button>
                <button className="vx-btn vx-btn-primary vx-btn-sm" disabled={updating} onClick={() => changeStatus("completed")}>Realizada</button>
              </>
            )}
            {event.status === "confirmed" && (
              <>
                <button className="vx-btn vx-btn-ghost vx-btn-sm" disabled={updating} onClick={() => changeStatus("no_show")}>Não compareceu</button>
                <button className="vx-btn vx-btn-primary vx-btn-sm" disabled={updating} onClick={() => changeStatus("completed")}>Realizada</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import {
  LayoutDashboard, Users, MessageSquare, CalendarDays, RotateCcw, Settings,
  Phone, Plus, ChevronRight, Search, Building2, Clock, Reply, ArrowUpRight,
  Filter, Check, AlertTriangle, X, ChevronLeft, Edit3, ExternalLink,
  MessageCircle, Eye,
} from "lucide-react";
import { api } from "../../../lib/api.js";
import { DS } from "./Conversas.jsx";
import { ETAPAS, nomeEtapa, ORDEM_ETAPAS, ETAPAS_ABERTAS } from "../../../../shared/pipeline.js";

const Conversas = lazy(() => import("./Conversas.jsx"));

const ESPERA = <div style={{ display: "grid", placeItems: "center", flex: 1 }}><div className="vx-spinner" /></div>;

// ── Sidebar interna ────────────────────────────────────────────────────
const SECOES = [
  { id: "visao-geral", label: "Visão geral", Icon: LayoutDashboard },
  { id: "leads", label: "Leads", Icon: Users },
  { id: "whatsapp", label: "WhatsApp", Icon: MessageSquare },
  { id: "calendario", label: "Calendário", Icon: CalendarDays },
  { id: "followups", label: "Follow-ups", Icon: RotateCcw },
];

function Sidebar({ secao, setSecao, badges, largura }) {
  const mobile = largura < 768;
  if (mobile) {
    return (
      <div style={{
        display: "flex", justifyContent: "space-around", padding: "6px 4px",
        background: DS.bg, borderTop: `1px solid ${DS.border}`,
        position: "sticky", bottom: 0, zIndex: 10,
      }}>
        {SECOES.map((s) => {
          const ativo = secao === s.id;
          return (
            <button key={s.id} type="button" onClick={() => setSecao(s.id)} title={s.label}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: "6px 8px", border: "none", borderRadius: 8, cursor: "pointer",
                background: ativo ? "#DCEAFE" : "transparent", color: ativo ? DS.blue : "#64748B",
                font: "inherit", fontSize: 10, fontWeight: ativo ? 600 : 500, position: "relative",
                minWidth: 48, transition: "background .15s, color .15s",
              }}>
              <s.Icon size={20} />
              {s.label.split(" ")[0]}
              {badges[s.id] > 0 && (
                <span style={{
                  position: "absolute", top: 2, right: 4, minWidth: 16, height: 16, borderRadius: 8,
                  background: "#EF4444", color: "#fff", fontSize: 10, fontWeight: 700,
                  display: "grid", placeItems: "center", padding: "0 4px",
                }}>{badges[s.id] > 99 ? "99+" : badges[s.id]}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{
      width: 68, flexShrink: 0, background: "#F5F6F8",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "16px 0 12px", gap: 4, borderRight: `1px solid ${DS.border}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: DS.blue,
        display: "grid", placeItems: "center", marginBottom: 12,
        fontSize: 14, fontWeight: 800, color: "#fff", fontFamily: DS.font,
      }}>R</div>
      {SECOES.map((s) => {
        const ativo = secao === s.id;
        return (
          <div key={s.id} style={{ position: "relative" }}>
            <button type="button" onClick={() => setSecao(s.id)} title={s.label}
              style={{
                width: 44, height: 44, borderRadius: 10, border: "none", cursor: "pointer",
                background: ativo ? "#DCEAFE" : "transparent",
                color: ativo ? DS.blue : "#64748B",
                display: "grid", placeItems: "center",
                transition: "background .15s, color .15s",
              }}>
              <s.Icon size={22} />
            </button>
            {badges[s.id] > 0 && (
              <span style={{
                position: "absolute", top: 2, right: 0, minWidth: 16, height: 16, borderRadius: 8,
                background: "#EF4444", color: "#fff", fontSize: 9, fontWeight: 700,
                display: "grid", placeItems: "center", padding: "0 3px", pointerEvents: "none",
              }}>{badges[s.id] > 99 ? "99+" : badges[s.id]}</span>
            )}
          </div>
        );
      })}
      <div style={{ flex: 1 }} />
      <button type="button" title="Configurações" onClick={() => setSecao("config")}
        style={{
          width: 44, height: 44, borderRadius: 10, border: "none", cursor: "pointer",
          background: secao === "config" ? "#DCEAFE" : "transparent",
          color: secao === "config" ? DS.blue : "#64748B",
          display: "grid", placeItems: "center",
        }}>
        <Settings size={22} />
      </button>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────
const hora = (t) => {
  if (!t) return "";
  const d = new Date(t), hoje = new Date();
  return d.toDateString() === hoje.toDateString()
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};
const diaCompleto = (t) => new Date(t).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const iniciais = (n) => String(n || "?").replace(/^[@+]/, "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";

function Avatar({ nome, tam = 36, cor }) {
  return (
    <span style={{
      width: tam, height: tam, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 600,
      fontSize: tam * 0.36, flexShrink: 0, fontFamily: DS.font,
      background: cor || DS.blue100, color: cor ? "#fff" : DS.blue,
    }}>{iniciais(nome)}</span>
  );
}

// ── Visão Geral ─────────────────────────────────────────────────────────
function VisaoGeral({ leads, conversas, followups, onIr, naoLidas }) {
  const hj = Date.now();
  const atrasados = (leads || []).filter((l) => l.proximaAcaoEm && l.proximaAcaoEm < hj && !["ganho", "perdido"].includes(l.etapa)).length;
  const novoHoje = (leads || []).filter((l) => new Date(l.criadoEm).toDateString() === new Date().toDateString()).length;
  const totalConversas = (conversas || []).length;

  const cards = [
    { label: "Mensagens não lidas", valor: naoLidas || 0, cor: DS.orange, Icon: Eye, acao: () => onIr("whatsapp") },
    { label: "Leads ativos", valor: (leads || []).filter((l) => !["ganho", "perdido"].includes(l.etapa)).length, cor: DS.blue, Icon: Users, acao: () => onIr("leads") },
    { label: "Follow-ups atrasados", valor: atrasados, cor: "#EF4444", Icon: RotateCcw, acao: () => onIr("followups") },
    { label: "Novos leads hoje", valor: novoHoje, cor: DS.green, Icon: Plus, acao: null },
  ];

  return (
    <div style={{ padding: "24px 20px", overflowY: "auto", flex: 1, fontFamily: DS.font }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: DS.ink }}>Visão geral</h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: DS.muted }}>Resumo da sua operação comercial</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
        {cards.map((c) => (
          <button key={c.label} type="button" onClick={c.acao}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
              background: DS.card, border: `1px solid ${DS.border}`, borderRadius: DS.radiusSm,
              cursor: c.acao ? "pointer" : "default", textAlign: "left", font: "inherit",
            }}>
            <span style={{ width: 36, height: 36, borderRadius: 8, background: `${c.cor}12`, display: "grid", placeItems: "center" }}>
              <c.Icon size={18} style={{ color: c.cor }} />
            </span>
            <span>
              <span style={{ fontSize: 11, color: DS.muted, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".04em" }}>{c.label}</span>
              <span style={{ display: "block", fontSize: 22, fontWeight: 700, color: DS.ink, lineHeight: 1.1 }}>{c.valor}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Leads que precisam de ação */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: DS.ink, margin: "0 0 10px" }}>Próximas ações</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(leads || []).filter((l) => l.proximaAcaoEm && !["ganho", "perdido"].includes(l.etapa))
          .sort((a, b) => a.proximaAcaoEm - b.proximaAcaoEm).slice(0, 8).map((l) => (
            <button key={l.id} type="button" onClick={() => { onIr("leads", l); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                background: DS.card, border: `1px solid ${DS.border}`, borderRadius: DS.radiusSm,
                cursor: "pointer", textAlign: "left", font: "inherit",
              }}>
              <Avatar nome={l.nome} tam={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nome}</div>
                <div style={{ fontSize: 11, color: DS.muted }}>{l.proximaAcao || nomeEtapa(l.etapa)} · {hora(l.proximaAcaoEm)}</div>
              </div>
              <span style={{
                fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 5,
                background: l.proximaAcaoEm < hj ? "rgba(239,68,68,.1)" : DS.blue50,
                color: l.proximaAcaoEm < hj ? "#EF4444" : DS.blue,
              }}>{l.proximaAcaoEm < hj ? "Atrasado" : hora(l.proximaAcaoEm)}</span>
            </button>
          ))}
        {!(leads || []).some((l) => l.proximaAcaoEm && !["ganho", "perdido"].includes(l.etapa)) && (
          <p style={{ fontSize: 13, color: DS.muted, padding: 12 }}>Nenhuma ação programada.</p>
        )}
      </div>
    </div>
  );
}

// ── Leads compacto ──────────────────────────────────────────────────────
function LeadsCompacto({ leads, aviso, onAbrirWhatsApp, onAgendar, onFollowUp, onSelecionar, leadSel }) {
  const [busca, setBusca] = useState("");
  const [etapaFiltro, setEtapaFiltro] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const [novaObs, setNovaObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  const detalheLead = detalhe || leadSel;

  const filtrados = (leads || []).filter((l) => {
    if (etapaFiltro && l.etapa !== etapaFiltro) return false;
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return (l.nome || "").toLowerCase().includes(t) || (l.telefone || "").includes(t) || (l.email || "").toLowerCase().includes(t) || (l.empresa || "").toLowerCase().includes(t);
  });

  const salvarObs = async () => {
    if (!detalheLead || !novaObs.trim()) return;
    setSalvando(true);
    const r = await api(`/leads/${detalheLead.id}/eventos`, { tipo: "nota", observacao: novaObs.trim() });
    setSalvando(false);
    if (r?.error) return aviso?.(r.error);
    setNovaObs(""); aviso?.("Observação salva.");
  };

  const mudarEtapa = async (leadId, novaEtapa) => {
    const body = { etapa: novaEtapa };
    if (novaEtapa === "perdido") body.motivoPerda = "sem resposta";
    if (novaEtapa === "ganho" || novaEtapa === "fechado") body.valorVenda = 1;
    const r = await api(`/leads/${leadId}`, body, "PATCH");
    if (r?.error) aviso?.(r.error);
    else aviso?.(`Lead movido para ${nomeEtapa(novaEtapa)}.`);
  };

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, fontFamily: DS.font }}>
      {/* Lista */}
      <div style={{
        width: detalheLead ? "min(340px, 40%)" : "100%", display: "flex", flexDirection: "column",
        borderRight: detalheLead ? `1px solid ${DS.border}` : "none", transition: "width .2s",
      }}>
        <div style={{ padding: "16px 16px 10px" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700, color: DS.ink }}>Leads</h2>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: DS.muted2 }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lead…"
              style={{
                width: "100%", padding: "8px 12px 8px 32px", fontSize: 13, border: `1px solid ${DS.border}`,
                borderRadius: 8, outline: "none", background: DS.bg, fontFamily: DS.font, boxSizing: "border-box",
              }} />
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            <button type="button" onClick={() => setEtapaFiltro("")}
              style={{ padding: "4px 10px", fontSize: 11.5, fontWeight: etapaFiltro === "" ? 600 : 400, borderRadius: 6, border: `1px solid ${DS.border}`, background: !etapaFiltro ? DS.blue50 : "transparent", color: !etapaFiltro ? DS.blue : DS.muted, cursor: "pointer", font: "inherit" }}>
              Todas
            </button>
            {ETAPAS_ABERTAS.map((e) => (
              <button key={e} type="button" onClick={() => setEtapaFiltro(e)}
                style={{ padding: "4px 10px", fontSize: 11.5, fontWeight: etapaFiltro === e ? 600 : 400, borderRadius: 6, border: `1px solid ${DS.border}`, background: etapaFiltro === e ? DS.blue50 : "transparent", color: etapaFiltro === e ? DS.blue : DS.muted, cursor: "pointer", font: "inherit" }}>
                {nomeEtapa(e)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
          {filtrados.length === 0 && <p style={{ textAlign: "center", color: DS.muted, fontSize: 13, padding: 20 }}>Nenhum lead encontrado.</p>}
          {filtrados.map((l) => (
            <button key={l.id} type="button" onClick={() => { setDetalhe(l); onSelecionar?.(l); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 10px",
                background: detalheLead?.id === l.id ? DS.blue50 : "transparent", border: "none",
                borderRadius: 8, cursor: "pointer", textAlign: "left", font: "inherit",
                transition: "background .1s",
              }}>
              <Avatar nome={l.nome} tam={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: DS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nome}</div>
                <div style={{ fontSize: 11, color: DS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {l.empresa || (l.telefone ? `+${l.telefone}` : l.email || "")}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "3px 7px", borderRadius: 5, whiteSpace: "nowrap",
                background: `${ETAPAS[l.etapa]?.cor || DS.muted}18`, color: ETAPAS[l.etapa]?.cor || DS.muted,
              }}>{nomeEtapa(l.etapa)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Detalhe do lead */}
      {detalheLead && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <Avatar nome={detalheLead.nome} tam={48} />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: DS.ink }}>{detalheLead.nome}</h3>
              {detalheLead.empresa && <div style={{ fontSize: 13, color: DS.muted }}>{detalheLead.empresa}{detalheLead.cargo ? ` · ${detalheLead.cargo}` : ""}</div>}
              {detalheLead.telefone && <div style={{ fontSize: 12.5, color: DS.muted }}>+{detalheLead.telefone}</div>}
              {detalheLead.email && <div style={{ fontSize: 12.5, color: DS.muted }}>{detalheLead.email}</div>}
            </div>
            <button type="button" onClick={() => { setDetalhe(null); onSelecionar?.(null); }}
              style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${DS.border}`, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: DS.muted }}>
              <X size={14} />
            </button>
          </div>

          {/* Etapa + ações rápidas */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{
              padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: `${ETAPAS[detalheLead.etapa]?.cor || DS.muted}18`, color: ETAPAS[detalheLead.etapa]?.cor || DS.muted,
            }}>{nomeEtapa(detalheLead.etapa)}</span>
            {detalheLead.proximaAcao && (
              <span style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: DS.bg, color: DS.ink2, border: `1px solid ${DS.border}` }}>
                {detalheLead.proximaAcao} · {hora(detalheLead.proximaAcaoEm)}
              </span>
            )}
          </div>

          {/* Botões de ação */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {detalheLead.telefone && (
              <button type="button" onClick={() => onAbrirWhatsApp?.(detalheLead)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                  background: "#25D366", color: "#fff", border: "none", borderRadius: 8,
                  cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, minHeight: 36,
                }}>
                <MessageSquare size={14} /> WhatsApp
              </button>
            )}
            <button type="button" onClick={() => onAgendar?.(detalheLead)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                background: DS.card, color: DS.ink, border: `1px solid ${DS.border}`, borderRadius: 8,
                cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, minHeight: 36,
              }}>
              <CalendarDays size={14} /> Agendar
            </button>
            <button type="button" onClick={() => onFollowUp?.(detalheLead)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                background: DS.card, color: DS.ink, border: `1px solid ${DS.border}`, borderRadius: 8,
                cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, minHeight: 36,
              }}>
              <RotateCcw size={14} /> Follow-up
            </button>
          </div>

          {/* Atualizar etapa */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: DS.muted, display: "block", marginBottom: 6 }}>Atualizar etapa</label>
            <select value={detalheLead.etapa} onChange={(e) => mudarEtapa(detalheLead.id, e.target.value)}
              style={{ padding: "6px 10px", fontSize: 13, borderRadius: 8, border: `1px solid ${DS.border}`, background: DS.bg, fontFamily: DS.font, cursor: "pointer" }}>
              {ORDEM_ETAPAS.map((e) => <option key={e} value={e}>{nomeEtapa(e)}</option>)}
            </select>
          </div>

          {/* Adicionar observação */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: DS.muted, display: "block", marginBottom: 6 }}>Adicionar observação</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={novaObs} onChange={(e) => setNovaObs(e.target.value)} placeholder="Ex: Demonstrou interesse no plano Pro"
                style={{ flex: 1, padding: "7px 10px", fontSize: 13, border: `1px solid ${DS.border}`, borderRadius: 8, outline: "none", fontFamily: DS.font }} />
              <button type="button" onClick={salvarObs} disabled={salvando || !novaObs.trim()}
                style={{
                  padding: "7px 14px", background: DS.blue, color: "#fff", border: "none", borderRadius: 8,
                  cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, minHeight: 36,
                  opacity: salvando || !novaObs.trim() ? 0.5 : 1,
                }}>Salvar</button>
            </div>
          </div>

          {/* Valor estimado */}
          {detalheLead.valorEstimado > 0 && (
            <div style={{ padding: "10px 14px", background: DS.bg, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
              <span style={{ color: DS.muted }}>Valor estimado: </span>
              <b>R$ {Number(detalheLead.valorEstimado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Calendário compacto ─────────────────────────────────────────────────
function CalendarioCompacto({ aviso, leadContexto, onAbrirWhatsApp }) {
  const [reunioes, setReunioes] = useState([]);
  const [vis, setVis] = useState("semana");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ data: "", hora: "", duracao: "30", notas: "" });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api("/agenda-comercial").then((r) => {
      if (r?.reunioes) setReunioes(r.reunioes);
      else if (Array.isArray(r)) setReunioes(r);
    });
  }, []);

  useEffect(() => {
    if (leadContexto && !modal) {
      setModal(leadContexto);
      const agora = new Date();
      setForm({
        data: agora.toISOString().split("T")[0],
        hora: `${String(agora.getHours() + 1).padStart(2, "0")}:00`,
        duracao: "30",
        notas: "",
      });
    }
  }, [leadContexto]); // eslint-disable-line react-hooks/exhaustive-deps

  const hj = new Date();
  const inicioSemana = new Date(hj); inicioSemana.setDate(hj.getDate() - hj.getDay());
  const fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 7);

  const reunioesFiltradas = reunioes.filter((r) => {
    const d = new Date(r.inicio || r.criadoEm);
    if (vis === "dia") return d.toDateString() === hj.toDateString();
    if (vis === "semana") return d >= inicioSemana && d < fimSemana;
    return d.getMonth() === hj.getMonth() && d.getFullYear() === hj.getFullYear();
  }).sort((a, b) => (a.inicio || a.criadoEm) - (b.inicio || b.criadoEm));

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, fontFamily: DS.font, overflowY: "auto" }}>
      <div style={{ padding: "16px 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: DS.ink }}>Calendário</h2>
        <div style={{ display: "flex", gap: 4 }}>
          {["dia", "semana", "mes"].map((v) => (
            <button key={v} type="button" onClick={() => setVis(v)}
              style={{
                padding: "5px 12px", fontSize: 12, fontWeight: vis === v ? 600 : 400, borderRadius: 6,
                border: `1px solid ${DS.border}`, background: vis === v ? DS.blue50 : "transparent",
                color: vis === v ? DS.blue : DS.muted, cursor: "pointer", font: "inherit",
                textTransform: "capitalize",
              }}>{v === "mes" ? "Mês" : v === "dia" ? "Hoje" : "Semana"}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: "0 20px 20px", overflowY: "auto" }}>
        {reunioesFiltradas.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: DS.muted }}>
            <CalendarDays size={36} style={{ marginBottom: 8, opacity: 0.4 }} />
            <p style={{ fontSize: 13 }}>Nenhum compromisso {vis === "dia" ? "para hoje" : vis === "semana" ? "esta semana" : "este mês"}.</p>
          </div>
        )}
        {reunioesFiltradas.map((r) => (
          <div key={r.id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            background: DS.card, border: `1px solid ${DS.border}`, borderRadius: DS.radiusSm,
            marginBottom: 8,
          }}>
            <span style={{
              width: 4, height: 40, borderRadius: 2, flexShrink: 0,
              background: r.status === "realizada" ? DS.green : r.status === "cancelada" ? "#EF4444" : DS.blue,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: DS.ink }}>{r.nome || r.empresa || "Reunião"}</div>
              <div style={{ fontSize: 11.5, color: DS.muted }}>
                {r.inicio ? new Date(r.inicio).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : hora(r.criadoEm)}
                {r.telefone ? ` · +${r.telefone}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {r.telefone && onAbrirWhatsApp && (
                <button type="button" title="Abrir no WhatsApp" onClick={() => onAbrirWhatsApp({ telefone: r.telefone, nome: r.nome })}
                  style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${DS.border}`, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: "#25D366" }}>
                  <MessageSquare size={14} />
                </button>
              )}
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "4px 8px", borderRadius: 5,
                background: r.status === "realizada" ? "rgba(37,211,102,.1)" : r.status === "cancelada" ? "rgba(239,68,68,.1)" : DS.blue50,
                color: r.status === "realizada" ? DS.green : r.status === "cancelada" ? "#EF4444" : DS.blue,
                textTransform: "capitalize", alignSelf: "center",
              }}>{r.status || "agendada"}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de agendamento */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={{ background: DS.card, borderRadius: DS.radius, padding: 24, maxWidth: 420, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, fontFamily: DS.font, color: DS.ink }}>Agendar reunião</h3>
            {modal.nome && <div style={{ fontSize: 13, color: DS.muted, marginBottom: 12 }}>Lead: <b>{modal.nome}</b>{modal.telefone ? ` · +${modal.telefone}` : ""}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: DS.muted }}>Data
                <input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                  style={{ display: "block", width: "100%", padding: "7px 10px", fontSize: 13, border: `1px solid ${DS.border}`, borderRadius: 8, marginTop: 4, fontFamily: DS.font, boxSizing: "border-box" }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: DS.muted }}>Horário
                <input type="time" value={form.hora} onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))}
                  style={{ display: "block", width: "100%", padding: "7px 10px", fontSize: 13, border: `1px solid ${DS.border}`, borderRadius: 8, marginTop: 4, fontFamily: DS.font, boxSizing: "border-box" }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: DS.muted }}>Duração
                <select value={form.duracao} onChange={(e) => setForm((f) => ({ ...f, duracao: e.target.value }))}
                  style={{ display: "block", width: "100%", padding: "7px 10px", fontSize: 13, border: `1px solid ${DS.border}`, borderRadius: 8, marginTop: 4, fontFamily: DS.font, boxSizing: "border-box" }}>
                  <option value="15">15 minutos</option>
                  <option value="30">30 minutos</option>
                  <option value="45">45 minutos</option>
                  <option value="60">1 hora</option>
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: DS.muted }}>Notas
                <input value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Opcional"
                  style={{ display: "block", width: "100%", padding: "7px 10px", fontSize: 13, border: `1px solid ${DS.border}`, borderRadius: 8, marginTop: 4, fontFamily: DS.font, boxSizing: "border-box" }} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setModal(null)}
                style={{ padding: "8px 16px", border: `1px solid ${DS.border}`, borderRadius: 8, background: "transparent", cursor: "pointer", font: "inherit", fontSize: 13 }}>Cancelar</button>
              <button type="button" disabled={salvando || !form.data || !form.hora}
                onClick={async () => {
                  setSalvando(true);
                  const obs = `Reunião agendada para ${form.data} ${form.hora} (${form.duracao}min)${form.notas ? `. ${form.notas}` : ""}`;
                  if (modal.id) {
                    await api(`/leads/${modal.id}/eventos`, { tipo: "reuniao", resultado: "agendada", observacao: obs, proximaAcao: `Reunião ${form.data}`, proximaAcaoEm: new Date(`${form.data}T${form.hora}`).getTime() });
                  }
                  setSalvando(false);
                  aviso?.("Reunião registrada no lead.");
                  setModal(null);
                }}
                style={{ padding: "8px 16px", background: DS.blue, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, opacity: salvando ? 0.6 : 1 }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Follow-ups ──────────────────────────────────────────────────────────
function FollowUps({ leads, aviso, onAbrirWhatsApp, leadContexto }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ acao: "", data: "", hora: "" });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (leadContexto && !modal) {
      setModal(leadContexto);
      const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
      setForm({ acao: "", data: amanha.toISOString().split("T")[0], hora: "09:00" });
    }
  }, [leadContexto]); // eslint-disable-line react-hooks/exhaustive-deps

  const hj = Date.now();
  const diaMs = 86400000;
  const comAcao = (leads || []).filter((l) => l.proximaAcaoEm && !["ganho", "perdido"].includes(l.etapa));
  const atrasados = comAcao.filter((l) => l.proximaAcaoEm < hj);
  const hoje = comAcao.filter((l) => l.proximaAcaoEm >= hj && l.proximaAcaoEm < hj + diaMs);
  const amanha = comAcao.filter((l) => { const ini = hj + diaMs; return l.proximaAcaoEm >= ini && l.proximaAcaoEm < ini + diaMs; });
  const proximos = comAcao.filter((l) => l.proximaAcaoEm >= hj + 2 * diaMs);

  const grupos = [
    { label: "Atrasados", items: atrasados, cor: "#EF4444", bg: "rgba(239,68,68,.06)" },
    { label: "Hoje", items: hoje, cor: DS.blue, bg: DS.blue50 },
    { label: "Amanhã", items: amanha, cor: DS.purple, bg: "rgba(139,92,246,.06)" },
    { label: "Próximos dias", items: proximos, cor: DS.muted, bg: DS.bg },
  ];

  const renderItem = (l, cor) => (
    <div key={l.id} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
      background: DS.card, border: `1px solid ${DS.border}`, borderRadius: DS.radiusSm,
      marginBottom: 6,
    }}>
      <Avatar nome={l.nome} tam={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: DS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nome}</div>
        <div style={{ fontSize: 11, color: DS.muted }}>{l.proximaAcao || nomeEtapa(l.etapa)} · {hora(l.proximaAcaoEm)}</div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {l.telefone && onAbrirWhatsApp && (
          <button type="button" title="Abrir no WhatsApp" onClick={() => onAbrirWhatsApp(l)}
            style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${DS.border}`, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: "#25D366" }}>
            <MessageSquare size={13} />
          </button>
        )}
        <button type="button" title="Reagendar" onClick={() => {
          setModal(l);
          const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
          setForm({ acao: l.proximaAcao || "", data: amanha.toISOString().split("T")[0], hora: "09:00" });
        }}
          style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${DS.border}`, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: DS.muted }}>
          <CalendarDays size={13} />
        </button>
        <button type="button" title="Concluir"
          onClick={async () => {
            await api(`/leads/${l.id}`, { proximaAcao: "", proximaAcaoEm: null }, "PATCH");
            aviso?.("Follow-up concluído.");
          }}
          style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${DS.border}`, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: DS.green }}>
          <Check size={13} />
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, fontFamily: DS.font, overflowY: "auto", padding: "16px 20px" }}>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: DS.ink }}>Follow-ups</h2>
      {grupos.map((g) => g.items.length > 0 && (
        <div key={g.label} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: g.cor, textTransform: "uppercase", letterSpacing: ".04em",
            padding: "6px 10px", background: g.bg, borderRadius: 6, marginBottom: 8, display: "inline-block",
          }}>{g.label} ({g.items.length})</div>
          {g.items.sort((a, b) => a.proximaAcaoEm - b.proximaAcaoEm).map((l) => renderItem(l, g.cor))}
        </div>
      ))}
      {comAcao.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: DS.muted }}>
          <RotateCcw size={36} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p style={{ fontSize: 13 }}>Nenhum follow-up programado.</p>
        </div>
      )}

      {/* Modal de reagendamento / novo follow-up */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={{ background: DS.card, borderRadius: DS.radius, padding: 24, maxWidth: 400, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, fontFamily: DS.font, color: DS.ink }}>
              {modal.proximaAcaoEm ? "Reagendar follow-up" : "Novo follow-up"}
            </h3>
            <div style={{ fontSize: 13, color: DS.muted, marginBottom: 12 }}>Lead: <b>{modal.nome}</b></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: DS.muted }}>Ação
                <input value={form.acao} onChange={(e) => setForm((f) => ({ ...f, acao: e.target.value }))} placeholder="Ex: Ligar para confirmar interesse"
                  style={{ display: "block", width: "100%", padding: "7px 10px", fontSize: 13, border: `1px solid ${DS.border}`, borderRadius: 8, marginTop: 4, fontFamily: DS.font, boxSizing: "border-box" }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: DS.muted }}>Data
                <input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                  style={{ display: "block", width: "100%", padding: "7px 10px", fontSize: 13, border: `1px solid ${DS.border}`, borderRadius: 8, marginTop: 4, fontFamily: DS.font, boxSizing: "border-box" }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: DS.muted }}>Horário
                <input type="time" value={form.hora} onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))}
                  style={{ display: "block", width: "100%", padding: "7px 10px", fontSize: 13, border: `1px solid ${DS.border}`, borderRadius: 8, marginTop: 4, fontFamily: DS.font, boxSizing: "border-box" }} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setModal(null)}
                style={{ padding: "8px 16px", border: `1px solid ${DS.border}`, borderRadius: 8, background: "transparent", cursor: "pointer", font: "inherit", fontSize: 13 }}>Cancelar</button>
              <button type="button" disabled={salvando || !form.data}
                onClick={async () => {
                  setSalvando(true);
                  const ts = new Date(`${form.data}T${form.hora || "09:00"}`).getTime();
                  await api(`/leads/${modal.id}`, { proximaAcao: form.acao || "Follow-up", proximaAcaoEm: ts }, "PATCH");
                  setSalvando(false);
                  aviso?.("Follow-up programado.");
                  setModal(null);
                }}
                style={{ padding: "8px 16px", background: DS.blue, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, opacity: salvando ? 0.6 : 1 }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Configurações ───────────────────────────────────────────────────────
function ConfigSecao() {
  return (
    <div style={{ padding: "24px 20px", fontFamily: DS.font }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: DS.ink }}>Configurações</h2>
      <p style={{ fontSize: 13, color: DS.muted, margin: 0 }}>As configurações da sua conta estão na aba Configurações do menu principal.</p>
    </div>
  );
}

// ── Central (componente principal) ──────────────────────────────────────
export default function Central({ aviso }) {
  const [secao, setSecao] = useState("whatsapp");
  const [leads, setLeads] = useState(null);
  const [naoLidas, setNaoLidas] = useState(0);
  const [largura, setLargura] = useState(() => typeof window === "undefined" ? 1200 : window.innerWidth);
  const [leadSel, setLeadSel] = useState(null);
  const [agendarLead, setAgendarLead] = useState(null);
  const [followUpLead, setFollowUpLead] = useState(null);
  const whatsAppRef = useRef({ aberta: "", texto: "" });
  const conversasRef = useRef(null);

  useEffect(() => {
    const f = () => setLargura(window.innerWidth);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  const carregarLeads = useCallback(() => {
    api("/leads?limit=500").then((r) => { if (Array.isArray(r)) setLeads(r); });
  }, []);

  const carregarNaoLidas = useCallback(() => {
    api("/canais/conversas?canal=evolution&busca=").then((r) => {
      if (r?.naoLidas?.evolution != null) setNaoLidas(r.naoLidas.evolution);
      conversasRef.current = r?.conversas || [];
    });
  }, []);

  useEffect(() => { carregarLeads(); carregarNaoLidas(); }, [carregarLeads, carregarNaoLidas]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) { carregarLeads(); carregarNaoLidas(); } }, 15000);
    return () => clearInterval(t);
  }, [carregarLeads, carregarNaoLidas]);

  const mobile = largura < 768;

  // Badges para a sidebar
  const hj = Date.now();
  const followAtrasados = (leads || []).filter((l) => l.proximaAcaoEm && l.proximaAcaoEm < hj && !["ganho", "perdido"].includes(l.etapa)).length;
  const badges = {
    "visao-geral": 0,
    leads: 0,
    whatsapp: naoLidas,
    calendario: 0,
    followups: followAtrasados,
  };

  // Navegação entre seções com contexto
  const irPara = (sec, ctx) => {
    setSecao(sec);
    if (ctx) setLeadSel(ctx);
  };

  const abrirWhatsApp = (lead) => {
    if (!lead?.telefone) return;
    setSecao("whatsapp");
  };

  const agendar = (ctx) => {
    const lead = ctx?.lead || ctx;
    if (lead) setAgendarLead(lead);
    setSecao("calendario");
  };

  const followUp = (ctx) => {
    const lead = ctx?.lead || ctx;
    if (lead) setFollowUpLead(lead);
    setSecao("followups");
  };

  const contextoWhatsApp = { onAgendar: agendar, onFollowUp: followUp };

  const conteudo = (() => {
    switch (secao) {
      case "visao-geral":
        return <VisaoGeral leads={leads} conversas={conversasRef.current} followups={leads} onIr={irPara} naoLidas={naoLidas} />;
      case "leads":
        return <LeadsCompacto leads={leads} aviso={aviso} onAbrirWhatsApp={abrirWhatsApp} onAgendar={agendar} onFollowUp={followUp} onSelecionar={setLeadSel} leadSel={leadSel} />;
      case "whatsapp":
        return (
          <Suspense fallback={ESPERA}>
            <Conversas aviso={aviso} onAbrirLead={(l) => { setLeadSel(l); setSecao("leads"); }} contexto={contextoWhatsApp} />
          </Suspense>
        );
      case "calendario":
        return <CalendarioCompacto aviso={aviso} leadContexto={agendarLead} onAbrirWhatsApp={abrirWhatsApp} />;
      case "followups":
        return <FollowUps leads={leads} aviso={aviso} onAbrirWhatsApp={abrirWhatsApp} leadContexto={followUpLead} />;
      case "config":
        return <ConfigSecao />;
      default:
        return null;
    }
  })();

  // Limpar contextos de lead após usar
  useEffect(() => {
    if (secao !== "calendario") setAgendarLead(null);
    if (secao !== "followups") setFollowUpLead(null);
  }, [secao]);

  return (
    <div style={{
      display: "flex", flexDirection: mobile ? "column" : "row",
      height: mobile ? "calc(100dvh - 120px)" : "calc(100dvh - 80px)",
      background: DS.bg, fontFamily: DS.font,
      borderRadius: mobile ? 0 : DS.radius,
      overflow: "hidden",
    }}>
      {!mobile && <Sidebar secao={secao} setSecao={setSecao} badges={badges} largura={largura} />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, background: DS.card }}>
        {conteudo}
      </div>
      {mobile && <Sidebar secao={secao} setSecao={setSecao} badges={badges} largura={largura} />}
    </div>
  );
}

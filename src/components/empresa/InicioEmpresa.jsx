import { useState, useMemo, useRef, useEffect } from "react";
import {
  Users, UserCheck, Megaphone, MessageSquare, Mail,
  ShieldCheck, TrendingUp, ArrowRight, Bell,
  BarChart3, ChevronRight, Clock,
  CheckCircle2, AlertTriangle, Sparkles,
  Activity, Target, Award, Wallet, SlidersHorizontal, ChevronDown,
} from "lucide-react";
import { money, dataCurta } from "../../lib/utils.js";
import { saldoDisponivel, isPosPago, isPremium } from "../../../shared/empresa.js";

// ── utilidades ────────────────────────────────────────────────────────────────

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function dataHoje() {
  return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function diasAtras(dias) {
  return Date.now() - dias * 86400000;
}

function variacao(atual, anterior) {
  if (!anterior) return null;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  return pct;
}

function VariacaoBadge({ pct }) {
  if (pct === null || pct === undefined) return null;
  const positivo = pct >= 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 2,
      fontSize: 11, fontWeight: 700,
      color: positivo ? "#059669" : "#DC2626",
      background: positivo ? "#dcfce7" : "#fee2e2",
      borderRadius: 20, padding: "2px 7px",
    }}>
      {positivo ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

// ── CARD DE INDICADOR ─────────────────────────────────────────────────────────

function CardIndicador({ icon: Icon, label, valor, pct, onClick, cor = "var(--brand)" }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", gap: 10,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "18px 20px",
        cursor: onClick ? "pointer" : "default",
        textAlign: "left", width: "100%",
        transition: "box-shadow .15s, border-color .15s",
        boxShadow: "0 1px 4px rgba(0,0,0,.04)",
      }}
      onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.borderColor = "var(--brand)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(37,99,235,.12)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.04)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: cor + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} color={cor} strokeWidth={2.2} />
        </div>
        {pct !== null && pct !== undefined && <VariacaoBadge pct={pct} />}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-disp)", lineHeight: 1 }}>{valor}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, fontWeight: 500 }}>{label}</div>
      </div>
    </button>
  );
}

// ── TIMELINE ─────────────────────────────────────────────────────────────────

function eventosDaPlataforma(db, empId) {
  const eventos = [];

  // Novos sellers cadastrados (candidaturas recentes)
  const apps = (db.sellers || [])
    .filter((s) => s.aplicacoes?.[empId])
    .slice(0, 5)
    .map((s) => ({
      tipo: "profissional",
      icon: UserCheck,
      cor: "#7C3AED",
      texto: `${s.nome || "Profissional"} se candidatou`,
      ts: s.criadoEm || Date.now() - 86400000 * 3,
    }));
  eventos.push(...apps);

  // Mensagens recentes
  const msgs = (db.messages || [])
    .filter((m) => m.companyId === empId && m.de === "vendedor")
    .slice(-5)
    .map((m) => {
      const seller = (db.sellers || []).find((s) => s.id === m.sellerId);
      return {
        tipo: "mensagem",
        icon: MessageSquare,
        cor: "#2563EB",
        texto: `Mensagem de ${seller?.nome || "Profissional"}`,
        ts: m.ts,
      };
    });
  eventos.push(...msgs);

  // Submissões aprovadas
  const subs = (db.submissions || [])
    .filter((s) => s.companyId === empId && ["liberado", "conferido"].includes(s.status))
    .slice(-5)
    .map((s) => {
      const seller = (db.sellers || []).find((x) => x.id === s.sellerId);
      return {
        tipo: "aprovacao",
        icon: CheckCircle2,
        cor: "#059669",
        texto: `Tarefa aprovada — ${seller?.nome || "Profissional"}`,
        ts: s.criadoEm,
      };
    });
  eventos.push(...subs);

  // Campanhas criadas
  const camps = (db.campaigns || [])
    .filter((c) => c.companyId === empId)
    .slice(-3)
    .map((c) => ({
      tipo: "campanha",
      icon: Megaphone,
      cor: "#D97706",
      texto: `Campanha "${c.titulo || "sem título"}"`,
      ts: c.criadoEm,
    }));
  eventos.push(...camps);

  return eventos
    .filter((e) => e.ts)
    .sort((a, b) => Number(b.ts) - Number(a.ts))
    .slice(0, 8);
}

// ── MINIBAR ───────────────────────────────────────────────────────────────────

function MiniBar({ value, max, cor = "var(--brand)" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 4, background: "var(--surface-3, #E2E8F0)", borderRadius: 99, overflow: "hidden", marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: cor, borderRadius: 99, transition: "width .4s" }} />
    </div>
  );
}

// ── PERÍODO DROPDOWN ─────────────────────────────────────────────────────────

const OPCOES_PERIODO = [
  { value: "1", label: "Hoje" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "mes", label: "Este mês" },
  { value: "ano", label: "Este ano" },
  { value: "", label: "Todo o período" },
  { value: "custom", label: "Personalizado..." },
];

function PeriodoDropdown({ periodo, setPeriodo, customDe, setCustomDe, customAte, setCustomAte }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  const labelAtual = OPCOES_PERIODO.find((o) => o.value === periodo)?.label || "Período";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setAberto((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "7px 12px", borderRadius: 10,
          border: "1.5px solid var(--border)", background: "var(--surface)",
          cursor: "pointer", fontSize: 13, color: "var(--ink)",
          fontWeight: 500, transition: "border-color .15s",
          boxShadow: aberto ? "0 0 0 2px var(--brand)33" : "none",
          borderColor: aberto ? "var(--brand)" : "var(--border)",
        }}
        onMouseEnter={(e) => { if (!aberto) e.currentTarget.style.borderColor = "var(--brand)"; }}
        onMouseLeave={(e) => { if (!aberto) e.currentTarget.style.borderColor = "var(--border)"; }}
      >
        <SlidersHorizontal size={14} color="var(--muted)" />
        <span>{labelAtual}</span>
        <ChevronDown size={13} color="var(--muted)" style={{ transform: aberto ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>

      {aberto && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 100,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.12)",
          minWidth: 200, padding: "6px 0", overflow: "hidden",
        }}>
          {OPCOES_PERIODO.map((o) => (
            <button
              key={o.value}
              onClick={() => { setPeriodo(o.value); if (o.value !== "custom") setAberto(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "9px 16px", background: periodo === o.value ? "var(--surface-2)" : "transparent",
                border: "none", cursor: "pointer", fontSize: 13.5,
                color: periodo === o.value ? "var(--brand)" : "var(--ink)",
                fontWeight: periodo === o.value ? 600 : 400,
                transition: "background .1s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = periodo === o.value ? "var(--surface-2)" : "transparent"; }}
            >
              {o.label}
            </button>
          ))}
          {periodo === "custom" && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.03em" }}>DE</span>
                <input type="date" className="vx-input" style={{ fontSize: 12, padding: "6px 10px" }}
                  value={customDe} onChange={(e) => setCustomDe(e.target.value)} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.03em" }}>ATÉ</span>
                <input type="date" className="vx-input" style={{ fontSize: 12, padding: "6px 10px" }}
                  value={customAte} onChange={(e) => setCustomAte(e.target.value)} />
              </div>
              <button className="vx-btn vx-btn-primary vx-btn-sm" style={{ width: "100%" }} onClick={() => setAberto(false)}>
                Aplicar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────

export default function InicioEmpresa({ emp, db, setAba }) {
  const [periodo, setPeriodo] = useState("30");
  const [customDe, setCustomDe] = useState("");
  const [customAte, setCustomAte] = useState("");

  const empId = emp?.id;

  // ── Cálculos com dados reais ────────────────────────────────────────────────

  const sellers = useMemo(() => (db?.sellers || []), [db]);
  const campaigns = useMemo(() => (db?.campaigns || []).filter((c) => c.companyId === empId), [db, empId]);
  const submissions = useMemo(() => (db?.submissions || []).filter((s) => s.companyId === empId), [db, empId]);
  const messages = useMemo(() => (db?.messages || []).filter((m) => m.companyId === empId), [db, empId]);
  const leads = useMemo(() => (db?.leads || []).filter((l) => l.companyId === empId), [db, empId]);

  const corte = useMemo(() => {
    if (periodo === "custom") {
      if (customDe) return new Date(customDe + "T00:00:00").getTime();
      return diasAtras(30);
    }
    if (periodo === "mes") { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.getTime(); }
    if (periodo === "ano") { const d = new Date(); d.setMonth(0); d.setDate(1); d.setHours(0,0,0,0); return d.getTime(); }
    if (periodo === "") return 0;
    return diasAtras(Number(periodo));
  }, [periodo, customDe]);

  const fimPeriodo = useMemo(() => {
    if (periodo === "custom" && customAte) return new Date(customAte + "T23:59:59").getTime();
    return Date.now();
  }, [periodo, customAte]);

  const isNumericPreset = ["7", "30", "90"].includes(periodo);
  const cortePrev = isNumericPreset ? diasAtras(Number(periodo) * 2) : 0;

  const sellersAtivos = sellers.filter((s) => s.aplicacoes?.[empId] === "aprovado");
  const campanhasAtivas = campaigns.filter((c) => c.status === "ativa");
  const subsRevisao = submissions.filter((s) => s.status === "revisao");
  const profsPendentes = db?.solicitacoesPendentes || [];
  const totalAprovacoesPendentes = subsRevisao.length + profsPendentes.length;
  const naoLidas = messages.filter((m) => m.de === "vendedor" && !m.lida);
  const leadsTotal = leads.length;

  // variações (período atual vs período anterior)
  const sellersPeriodo = sellers.filter((s) => s.criadoEm && Number(s.criadoEm) >= corte && Number(s.criadoEm) <= fimPeriodo);
  const sellersPrev = isNumericPreset ? sellers.filter((s) => s.criadoEm && Number(s.criadoEm) >= cortePrev && Number(s.criadoEm) < corte) : [];
  const msgsPeriodo = messages.filter((m) => Number(m.ts) >= corte && Number(m.ts) <= fimPeriodo);
  const msgsPrev = isNumericPreset ? messages.filter((m) => Number(m.ts) >= cortePrev && Number(m.ts) < corte) : [];

  const pctSellers = isNumericPreset ? variacao(sellersPeriodo.length, sellersPrev.length) : null;
  const pctMsgs = isNumericPreset ? variacao(msgsPeriodo.length, msgsPrev.length) : null;

  // conversas únicas
  const conversas = [...new Set(messages.map((m) => m.sellerId))].length;

  // receita / investimento
  const pagasTotal = submissions.filter((s) => s.status === "liberado");
  const investimento = pagasTotal.reduce((a, s) => a + Number(s.valor || 0), 0);

  // Profissionais em destaque (mais tarefas aprovadas)
  const topSellers = useMemo(() => {
    return sellers
      .filter((s) => s.aplicacoes?.[empId] === "aprovado")
      .map((s) => {
        const subs = submissions.filter((x) => x.sellerId === s.id && x.status === "liberado");
        const ganhos = subs.reduce((a, x) => a + Number(x.valor || 0), 0);
        return { ...s, subsAprovadas: subs.length, ganhos };
      })
      .sort((a, b) => b.subsAprovadas - a.subsAprovadas)
      .slice(0, 5);
  }, [sellers, submissions, empId]);

  const maxSubs = topSellers[0]?.subsAprovadas || 1;

  // Timeline
  const eventos = useMemo(() => eventosDaPlataforma(db, empId), [db, empId]);

  // Pendências da empresa
  const saldo = saldoDisponivel(emp);
  const semSaldo = !isPosPago(emp) && !isPremium(emp) && saldo <= 0;
  const campsSemCandidatos = campanhasAtivas.filter((c) => !c.candidaturas?.length).length;

  const pendencias = [
    profsPendentes.length > 0 && {
      icon: ShieldCheck, texto: `${profsPendentes.length} profissional${profsPendentes.length > 1 ? "is" : ""} aguardando aprovação`, cta: "Revisar", aba: "conferir", cor: "#DC2626",
    },
    subsRevisao.length > 0 && {
      icon: CheckCircle2, texto: `${subsRevisao.length} tarefa${subsRevisao.length > 1 ? "s" : ""} aguardando revisão`, cta: "Revisar", aba: "conferir", cor: "#D97706",
    },
    semSaldo && {
      icon: Wallet, texto: "Adicione saldo para publicar campanhas", cta: "Ver financeiro", aba: "financeiro", cor: "#DC2626",
    },
    campanhasAtivas.length === 0 && campaigns.length === 0 && {
      icon: Megaphone, texto: "Crie sua primeira campanha para começar", cta: "Criar campanha", aba: "campanhas", cor: "#7C3AED",
    },
    campsSemCandidatos > 0 && {
      icon: Megaphone, texto: `${campsSemCandidatos} campanha${campsSemCandidatos > 1 ? "s" : ""} sem candidatos inscritos`, cta: "Ver campanhas", aba: "campanhas", cor: "#D97706",
    },
    naoLidas.length > 0 && {
      icon: Mail, texto: `${naoLidas.length} mensagem${naoLidas.length > 1 ? "s" : ""} não lida${naoLidas.length > 1 ? "s" : ""}`, cta: "Ver conversas", aba: "conversas", cor: "#2563EB",
    },
    sellersAtivos.length === 0 && profsPendentes.length > 0 && {
      icon: Users, texto: "Aprove profissionais para operar suas campanhas", cta: "Ver profissionais", aba: "conferir", cor: "#7C3AED",
    },
  ].filter(Boolean);

  const nomeEmpresa = emp?.nome || "sua empresa";
  const primeiroNome = nomeEmpresa.split(/\s+/)[0];

  const ir = (aba) => setAba?.(aba);

  return (
    <div className="vx-fade" style={{ maxWidth: 1200, paddingBottom: 48 }}>

      {/* ── CABEÇALHO ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4, fontWeight: 500 }}>{dataHoje()}</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-disp)", lineHeight: 1.1 }}>
            {saudacao()}, {primeiroNome} 👋
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--muted)" }}>
            Visão geral da operação comercial da {nomeEmpresa}.
          </p>
        </div>

        {/* Seletor de período compacto */}
        <PeriodoDropdown
          periodo={periodo}
          setPeriodo={(v) => { setPeriodo(v); setCustomDe(""); setCustomAte(""); }}
          customDe={customDe}
          setCustomDe={setCustomDe}
          customAte={customAte}
          setCustomAte={setCustomAte}
        />
      </div>

      {/* ── LEMBRETES PENDENTES ────────────────────────────────────────── */}
      {pendencias.length > 0 ? (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 14, padding: "16px 20px", marginBottom: 28,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={15} color="#D97706" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              {pendencias.length} {pendencias.length === 1 ? "pendência" : "pendências"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pendencias.map((p, i) => {
              const Ic = p.icon;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 10,
                  background: "var(--surface-2)", cursor: "pointer",
                  transition: "background .12s",
                }}
                  onClick={() => ir(p.aba)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3, #e2e8f0)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: p.cor + "14", display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Ic size={16} color={p.cor} />
                  </div>
                  <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)", fontWeight: 500 }}>{p.texto}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: p.cor,
                    display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                  }}>
                    {p.cta} <ArrowRight size={13} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{
          background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
          borderRadius: 14, padding: "16px 24px", marginBottom: 28,
          display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 20px rgba(5,150,105,.18)",
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Sparkles size={18} color="#fff" />
          </div>
          <p style={{ margin: 0, fontSize: 14, color: "#fff", fontWeight: 500 }}>
            Tudo em dia! Sua operação está ativa com {campanhasAtivas.length} campanha{campanhasAtivas.length !== 1 ? "s" : ""} e {sellersAtivos.length} profissional{sellersAtivos.length !== 1 ? "is" : ""}.
          </p>
        </div>
      )}

      {/* ── CARDS DE INDICADORES ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 28 }}>
        <CardIndicador icon={UserCheck} label="Profissionais ativos" valor={sellersAtivos.length} onClick={() => ir("profissionais")} cor="#059669" />
        <CardIndicador icon={Megaphone} label="Campanhas ativas" valor={campanhasAtivas.length} onClick={() => ir("campanhas")} cor="#D97706" />
        <CardIndicador icon={MessageSquare} label="Conversas" valor={conversas} onClick={() => ir("conversas")} cor="#7C3AED" />
        <CardIndicador icon={ShieldCheck} label="Aprovações pendentes" valor={totalAprovacoesPendentes} onClick={() => ir("conferir")} cor={totalAprovacoesPendentes > 0 ? "#DC2626" : "#059669"} />
        {leadsTotal > 0 && <CardIndicador icon={Target} label="Leads gerados" valor={leadsTotal} onClick={() => ir("campanhas")} cor="#D97706" />}
        {investimento > 0 && <CardIndicador icon={TrendingUp} label="Investimento total" valor={money(investimento)} onClick={() => ir("painel")} cor="#059669" />}
      </div>

      {/* ── GRID PRINCIPAL ────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>

        {/* COLUNA ESQUERDA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>


          {/* ── DESEMPENHO COMERCIAL ──────────────────────────────────────── */}
          <div className="vx-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <h3 className="vx-disp" style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 7 }}>
                <BarChart3 size={16} color="var(--brand)" /> Desempenho Comercial
              </h3>
              <button onClick={() => ir("painel")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--brand)", fontWeight: 600, padding: 0 }}>
                Ver análise completa <ArrowRight size={13} />
              </button>
            </div>

            {/* Métricas rápidas do período */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Tarefas no período", val: submissions.filter((s) => Number(s.criadoEm) >= corte && Number(s.criadoEm) <= fimPeriodo).length, icon: Activity },
                { label: "Aprovadas", val: submissions.filter((s) => Number(s.criadoEm) >= corte && Number(s.criadoEm) <= fimPeriodo && s.status === "liberado").length, icon: CheckCircle2, cor: "#059669" },
                { label: "Leads no período", val: leads.filter((l) => { const t = Number(l.criadoEm || l.atualizadoEm); return t >= corte && t <= fimPeriodo; }).length, icon: Target, cor: "#D97706" },
                { label: "Campanhas criadas", val: campaigns.filter((c) => Number(c.criadoEm) >= corte && Number(c.criadoEm) <= fimPeriodo).length, icon: Megaphone, cor: "#7C3AED" },
              ].map(({ label, val, icon: Ic, cor = "var(--brand)" }) => (
                <div key={label} className="vx-card" style={{ padding: "12px 14px", background: "var(--surface-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                    <Ic size={13} color={cor} />
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-disp)" }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Campanhas listadas */}
            {campanhasAtivas.length > 0 ? (
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Campanhas ativas</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {campanhasAtivas.slice(0, 4).map((c) => {
                    const inscritos = c.candidaturas?.length || 0;
                    const aprovadas = submissions.filter((s) => s.campaignId === c.id && s.status === "liberado").length;
                    return (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.titulo || "Campanha"}</div>
                          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>{inscritos} inscrito{inscritos !== 1 ? "s" : ""} · {aprovadas} aprovado{aprovadas !== 1 ? "s" : ""}</div>
                        </div>
                        <span style={{ background: "#dcfce7", color: "#166534", fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: "2px 8px", flexShrink: 0 }}>Ativa</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0", color: "var(--muted)" }}>
                <Megaphone size={24} style={{ display: "block", margin: "0 auto 8px" }} strokeWidth={1.5} />
                <p style={{ margin: 0, fontSize: 13 }}>Nenhuma campanha ativa no momento</p>
                <button onClick={() => ir("campanhas")} style={{ marginTop: 10, background: "none", border: "1.5px solid var(--border)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12.5, color: "var(--brand)", fontWeight: 600 }}>
                  Criar campanha
                </button>
              </div>
            )}
          </div>

          {/* ── PROFISSIONAIS EM DESTAQUE ────────────────────────────────── */}
          {topSellers.length > 0 && (
            <div className="vx-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 className="vx-disp" style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 7 }}>
                  <Award size={16} color="#D97706" /> Profissionais em Destaque
                </h3>
                <button onClick={() => ir("profissionais")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--brand)", fontWeight: 600, padding: 0 }}>
                  Ver todos <ArrowRight size={13} />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topSellers.map((s, i) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 20, fontSize: 12.5, fontWeight: 700, color: i === 0 ? "#D97706" : "var(--muted)", textAlign: "center", flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0, overflow: "hidden" }}>
                      {s.foto
                        ? <img src={s.foto} alt={s.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : (s.nome || "?")[0].toUpperCase()
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.nome || "Profissional"}
                      </div>
                      <MiniBar value={s.subsAprovadas} max={maxSubs} cor={i === 0 ? "#D97706" : "var(--brand)"} />
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{s.subsAprovadas}</div>
                      <div style={{ fontSize: 10.5, color: "var(--muted)" }}>tarefas</div>
                    </div>
                    {s.ganhos > 0 && (
                      <div style={{ textAlign: "right", flexShrink: 0, minWidth: 70 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#059669" }}>{money(s.ganhos)}</div>
                        <div style={{ fontSize: 10.5, color: "var(--muted)" }}>gerado</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── ATIVIDADE RECENTE ─────────────────────────────────────────── */}
          <div className="vx-card" style={{ padding: 18 }}>
            <h3 className="vx-disp" style={{ margin: "0 0 14px", fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
              <Activity size={14} color="var(--brand)" /> Atividade recente
            </h3>
            {eventos.length === 0 ? (
              <p className="vx-mut" style={{ fontSize: 13, textAlign: "center", padding: "16px 0" }}>Nenhuma atividade registrada.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {eventos.map((ev, i) => {
                  const Ic = ev.icon;
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, paddingBottom: i < eventos.length - 1 ? 12 : 0, marginBottom: i < eventos.length - 1 ? 12 : 0, borderBottom: i < eventos.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: ev.cor + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Ic size={13} color={ev.cor} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.texto}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1, display: "flex", alignItems: "center", gap: 3 }}>
                          <Clock size={10} /> {dataCurta(ev.ts)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: coluna direita vira bloco único embaixo */}
      <style>{`
        @media (max-width: 860px) {
          .inicio-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

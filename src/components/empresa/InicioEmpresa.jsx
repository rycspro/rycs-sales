import { useState, useMemo } from "react";
import {
  Users, UserCheck, Megaphone, MessageSquare, Mail,
  ShieldCheck, TrendingUp, ArrowRight, Bell,
  BarChart3, ChevronRight, Clock,
  CheckCircle2, AlertTriangle, Sparkles,
  Activity, Target, Award,
} from "lucide-react";
import { money, dataCurta } from "../../lib/utils.js";

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

// ── ITEM DE ATENÇÃO ───────────────────────────────────────────────────────────

function ItemAtencao({ icon: Icon, label, descricao, qtd, prioridade = "normal", onClick }) {
  const cores = {
    alta: { bg: "#fef2f2", brd: "#fecaca", ic: "#DC2626", txt: "#b91c1c" },
    media: { bg: "#fffbeb", brd: "#fde68a", ic: "#D97706", txt: "#92400e" },
    normal: { bg: "var(--surface-2)", brd: "var(--border)", ic: "var(--muted)", txt: "var(--ink)" },
  };
  const c = cores[prioridade];
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 14, width: "100%",
        padding: "13px 16px", borderRadius: 12,
        background: c.bg, border: `1px solid ${c.brd}`,
        cursor: "pointer", textAlign: "left",
        transition: "opacity .12s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = ".85"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: c.ic + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color={c.ic} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--ink)" }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{descricao}</div>
      </div>
      {qtd > 0 && (
        <span style={{ background: c.ic, color: "#fff", borderRadius: 20, fontSize: 11.5, fontWeight: 700, padding: "3px 10px", flexShrink: 0 }}>
          {qtd}
        </span>
      )}
      <ChevronRight size={15} color="var(--muted)" style={{ flexShrink: 0 }} />
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

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────

export default function InicioEmpresa({ emp, db, setAba }) {
  const [periodo, setPeriodo] = useState("30");

  const empId = emp?.id;

  // ── Cálculos com dados reais ────────────────────────────────────────────────

  const sellers = useMemo(() => (db?.sellers || []), [db]);
  const campaigns = useMemo(() => (db?.campaigns || []).filter((c) => c.companyId === empId), [db, empId]);
  const submissions = useMemo(() => (db?.submissions || []).filter((s) => s.companyId === empId), [db, empId]);
  const messages = useMemo(() => (db?.messages || []).filter((m) => m.companyId === empId), [db, empId]);
  const leads = useMemo(() => (db?.leads || []).filter((l) => l.companyId === empId), [db, empId]);

  const corte = diasAtras(Number(periodo));
  const cortePrev = diasAtras(Number(periodo) * 2);

  const sellersAtivos = sellers.filter((s) => s.aplicacoes?.[empId] === "aprovado");
  const campanhasAtivas = campaigns.filter((c) => c.status === "ativa");
  const subsRevisao = submissions.filter((s) => s.status === "revisao");
  const naoLidas = messages.filter((m) => m.de === "vendedor" && !m.lida);
  const leadsTotal = leads.length;

  // variações (período atual vs período anterior)
  const sellersPeriodo = sellers.filter((s) => s.criadoEm && Number(s.criadoEm) >= corte);
  const sellersPrev = sellers.filter((s) => s.criadoEm && Number(s.criadoEm) >= cortePrev && Number(s.criadoEm) < corte);
  const msgsPeriodo = messages.filter((m) => Number(m.ts) >= corte);
  const msgsPrev = messages.filter((m) => Number(m.ts) >= cortePrev && Number(m.ts) < corte);

  const pctSellers = variacao(sellersPeriodo.length, sellersPrev.length);
  const pctMsgs = variacao(msgsPeriodo.length, msgsPrev.length);

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

  // Banner contextual
  const bannerMensagem = (() => {
    if (subsRevisao.length > 0) return { texto: `Existem ${subsRevisao.length} tarefa${subsRevisao.length > 1 ? "s" : ""} aguardando sua revisão.`, cta: "Revisar aprovações", aba: "conferir", icone: ShieldCheck };
    if (naoLidas.length > 0) return { texto: `Você tem ${naoLidas.length} mensagem${naoLidas.length > 1 ? "s" : ""} não lida${naoLidas.length > 1 ? "s" : ""} de profissionais.`, cta: "Ver conversas", aba: "conversas", icone: Mail };
    if (campanhasAtivas.length === 0 && campaigns.length === 0) return { texto: "Sua operação comercial está pronta para crescer. Crie a primeira campanha.", cta: "Criar campanha", aba: "campanhas", icone: Megaphone };
    if (sellersAtivos.length === 0) return { texto: "Aprove profissionais para começar a operar suas campanhas.", cta: "Ver profissionais", aba: "profissionais", icone: Users };
    return { texto: `Sua operação está ativa com ${campanhasAtivas.length} campanha${campanhasAtivas.length > 1 ? "s" : ""} e ${sellersAtivos.length} profissional${sellersAtivos.length > 1 ? "is" : ""} no time.`, cta: "Ver insights", aba: "painel", icone: Sparkles };
  })();

  // Alertas de atenção
  const alertas = [
    subsRevisao.length > 0 && {
      icon: ShieldCheck, label: "Aprovações pendentes", descricao: "Tarefas aguardando revisão manual", qtd: subsRevisao.length, prioridade: "alta", aba: "conferir",
    },
    naoLidas.length > 0 && {
      icon: Mail, label: "Mensagens não lidas", descricao: "Profissionais aguardando resposta", qtd: naoLidas.length, prioridade: "media", aba: "conversas",
    },
    campanhasAtivas.filter((c) => !c.candidaturas?.length).length > 0 && {
      icon: Megaphone, label: "Campanhas sem candidatos", descricao: "Campanhas ativas sem profissionais inscritos", qtd: campanhasAtivas.filter((c) => !c.candidaturas?.length).length, prioridade: "media", aba: "campanhas",
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

        {/* Seletor de período */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div className="vx-seg" style={{ fontSize: 12 }}>
            {[["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"]].map(([v, l]) => (
              <button key={v} data-on={periodo === v ? "1" : "0"} onClick={() => setPeriodo(v)} style={{ padding: "5px 11px", fontSize: 12 }}>{l}</button>
            ))}
          </div>
          {(db?.notifications || []).filter((n) => !n.lida).length > 0 && (
            <div style={{ position: "relative" }}>
              <Bell size={18} color="var(--muted)" />
              <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, background: "var(--red, #DC2626)", borderRadius: "50%", border: "2px solid var(--surface)" }} />
            </div>
          )}
        </div>
      </div>

      {/* ── BANNER INTELIGENTE ────────────────────────────────────────────── */}
      {(() => {
        const { texto, cta, aba, icone: Icone } = bannerMensagem;
        return (
          <div style={{
            background: "linear-gradient(135deg, #1e40af 0%, #2563EB 60%, #3b82f6 100%)",
            borderRadius: 16, padding: "20px 24px",
            display: "flex", alignItems: "center", gap: 16,
            marginBottom: 28, flexWrap: "wrap",
            boxShadow: "0 4px 24px rgba(37,99,235,.22)",
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icone size={20} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ margin: 0, fontSize: 14.5, color: "#fff", fontWeight: 500, lineHeight: 1.5 }}>{texto}</p>
            </div>
            <button
              onClick={() => ir(aba)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "#fff", color: "#1e40af",
                border: "none", borderRadius: 10, padding: "9px 16px",
                fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                transition: "opacity .12s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = ".9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              {cta} <ArrowRight size={14} />
            </button>
          </div>
        );
      })()}

      {/* ── CARDS DE INDICADORES ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 28 }}>
        <CardIndicador icon={Users} label="Profissionais" valor={sellers.length} pct={pctSellers} onClick={() => ir("profissionais")} />
        <CardIndicador icon={UserCheck} label="Profissionais ativos" valor={sellersAtivos.length} onClick={() => ir("profissionais")} cor="#059669" />
        <CardIndicador icon={Megaphone} label="Campanhas ativas" valor={campanhasAtivas.length} onClick={() => ir("campanhas")} cor="#D97706" />
        <CardIndicador icon={MessageSquare} label="Conversas" valor={conversas} onClick={() => ir("conversas")} cor="#7C3AED" />
        <CardIndicador icon={Mail} label="Mensagens não lidas" valor={naoLidas.length} pct={pctMsgs} onClick={() => ir("conversas")} cor={naoLidas.length > 0 ? "#DC2626" : "var(--brand)"} />
        <CardIndicador icon={ShieldCheck} label="Aprovações pendentes" valor={subsRevisao.length} onClick={() => ir("conferir")} cor={subsRevisao.length > 0 ? "#DC2626" : "#059669"} />
        {leadsTotal > 0 && <CardIndicador icon={Target} label="Leads gerados" valor={leadsTotal} onClick={() => ir("campanhas")} cor="#D97706" />}
        {investimento > 0 && <CardIndicador icon={TrendingUp} label="Investimento total" valor={money(investimento)} onClick={() => ir("painel")} cor="#059669" />}
      </div>

      {/* ── GRID PRINCIPAL ────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>

        {/* COLUNA ESQUERDA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── CENTRAL DE ATENÇÃO ────────────────────────────────────────── */}
          {alertas.length > 0 && (
            <div className="vx-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <AlertTriangle size={16} color="#D97706" />
                <h3 className="vx-disp" style={{ margin: 0, fontSize: 15 }}>Precisa da sua atenção</h3>
                <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 8px", marginLeft: "auto" }}>
                  {alertas.length} {alertas.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {alertas.map((a, i) => (
                  <ItemAtencao key={i} {...a} onClick={() => ir(a.aba)} />
                ))}
              </div>
            </div>
          )}

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
                { label: "Tarefas no período", val: submissions.filter((s) => Number(s.criadoEm) >= corte).length, icon: Activity },
                { label: "Aprovadas", val: submissions.filter((s) => Number(s.criadoEm) >= corte && s.status === "liberado").length, icon: CheckCircle2, cor: "#059669" },
                { label: "Leads no período", val: leads.filter((l) => Number(l.criadoEm || l.atualizadoEm) >= corte).length, icon: Target, cor: "#D97706" },
                { label: "Campanhas criadas", val: campaigns.filter((c) => Number(c.criadoEm) >= corte).length, icon: Megaphone, cor: "#7C3AED" },
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

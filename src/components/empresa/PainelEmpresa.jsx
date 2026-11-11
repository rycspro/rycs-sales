import { useState, useEffect, useMemo } from "react";
import { Wallet, ClipboardList, Banknote, Users, TrendingUp, LockKeyhole, CalendarCheck, Presentation, Target, Sparkles, ArrowRight, Filter } from "lucide-react";
import { api } from "../../lib/api.js";
import { money, agora, dataCurta } from "../../lib/utils.js";
import { ACOES } from "../../lib/constants.js";
import { Donut, Stat } from "../ui.jsx";
import { metricasEmpresa, projetarROI, valorMonetario } from "../../../shared/analytics.js";
import CampaignsDashboard from "./CampaignsDashboard.jsx";

export default function PainelEmpresa({ emp, db, up, aviso, irParaCampanhas, vista = "desempenho" }) {
  const [financeiro, setFinanceiro] = useState(null);
  const [filtros, setFiltros] = useState({ dias: "30", campaignId: "", sellerId: "", tipo: "" });
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [customDe, setCustomDe] = useState("");
  const [customAte, setCustomAte] = useState("");
  const [tipoPeriodo, setTipoPeriodo] = useState("30");
  const [premissas, setPremissas] = useState({ metaVendas: 5, ticketMedio: valorMonetario(emp.ticket), taxaComparecimento: "", taxaConversao: "", custoAgendada: "" });

  useEffect(() => {
    api("/company/finance").then((f) => { if (f?.posicao) setFinanceiro(f); });
  }, []);

  const metricas = useMemo(() => metricasEmpresa({ submissions: db.submissions, campaigns: db.campaigns || [], leads: db.leads || [], companyId: emp.id, filtros }), [db.submissions, db.campaigns, db.leads, emp.id, filtros]);
  const projecao = useMemo(() => projetarROI({ metricas, ...premissas, taxaComparecimento: Number(premissas.taxaComparecimento) / 100, taxaConversao: Number(premissas.taxaConversao) / 100 }), [metricas, premissas]);
  const time = db.sellers.filter((s) => s.aplicacoes?.[emp.id] === "aprovado").length;

  // Página Campanhas (antes aba interna de Insights)
  if (vista === "campanhas") {
    const campanhas = (db.campaigns || []).filter((c) => c.companyId === emp.id);
    return (
      <>
        {campanhas.length === 0 && (
          <div style={{ background: "linear-gradient(135deg, var(--brand-50) 0%, var(--brand-100) 100%)", border: "1.5px solid var(--brand-200, var(--brand-100))", borderRadius: 14, padding: "22px 22px 18px", marginBottom: 22, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <Sparkles size={16} color="var(--brand)" />
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand)" }}>Comece aqui</span>
              </div>
              <div className="vx-disp" style={{ fontSize: 20, margin: "0 0 5px" }}>Crie sua primeira campanha</div>
              <p className="vx-mut" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>Coloque profissionais de vendas para trabalhar pela sua empresa. A IA monta tudo — você só revisa.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
              <button className="vx-btn vx-btn-primary" style={{ gap: 7, fontSize: 14, padding: "10px 20px" }} onClick={() => irParaCampanhas?.()}>
                <Sparkles size={14} /> Criar com IA <ArrowRight size={14} />
              </button>
              <button className="vx-btn" style={{ fontSize: 13 }} onClick={() => irParaCampanhas?.()}>
                Criar manualmente
              </button>
            </div>
          </div>
        )}
        <CampaignsDashboard campanhas={campanhas} db={db} emp={emp} aviso={aviso} somenteMetricas
          onNova={() => irParaCampanhas?.()}
          onAbrir={() => irParaCampanhas?.()} />
      </>
    );
  }

  return (
    <>
      <div className="vx-page-head" style={{ paddingBottom: 0 }}>
        <div>
          <h1 className="vx-disp">Insights</h1>
          <p>Acompanhe o desempenho comercial da sua operação por período, campanha e profissional.</p>
        </div>
        <button
          type="button"
          className={`vx-btn${filtroAberto || filtros.campaignId || filtros.sellerId || filtros.tipo || tipoPeriodo !== "30" ? " vx-btn-primary" : ""}`}
          style={{ gap: 6, flexShrink: 0, alignSelf: "flex-start" }}
          onClick={() => setFiltroAberto((v) => !v)}
        >
          <Filter size={14} /> Filtrar
        </button>
      </div>

      {filtroAberto && (
        <div className="vx-card vx-filterbar" style={{ padding: 14, maxWidth: "none", marginTop: 14, marginBottom: 16 }}>
          <label><span className="vx-label">Período</span>
            <select className="vx-input" value={tipoPeriodo} onChange={(e) => {
              const v = e.target.value;
              setTipoPeriodo(v);
              setCustomDe(""); setCustomAte("");
              if (v !== "custom" && v !== "mes" && v !== "ano") setFiltros((f) => ({ ...f, dias: v }));
              else if (v === "mes") { const d = new Date(); const dias = d.getDate(); setFiltros((f) => ({ ...f, dias: String(dias) })); }
              else if (v === "ano") { const d = new Date(); const start = new Date(d.getFullYear(), 0, 1); const dias = Math.ceil((d - start) / 86400000); setFiltros((f) => ({ ...f, dias: String(dias) })); }
            }}>
              <option value="1">Hoje</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="mes">Este mês</option>
              <option value="ano">Este ano</option>
              <option value="">Todo o período</option>
              <option value="custom">Personalizado...</option>
            </select>
          </label>
          {tipoPeriodo === "custom" && (
            <>
              <label><span className="vx-label">De</span>
                <input type="date" className="vx-input" value={customDe} onChange={(e) => {
                  setCustomDe(e.target.value);
                  const ate = customAte || new Date().toISOString().slice(0,10);
                  if (e.target.value) {
                    const diff = Math.ceil((new Date(ate) - new Date(e.target.value)) / 86400000);
                    if (diff > 0) setFiltros((f) => ({ ...f, dias: String(diff) }));
                  }
                }} />
              </label>
              <label><span className="vx-label">Até</span>
                <input type="date" className="vx-input" value={customAte} onChange={(e) => {
                  setCustomAte(e.target.value);
                  if (customDe && e.target.value) {
                    const diff = Math.ceil((new Date(e.target.value) - new Date(customDe)) / 86400000);
                    if (diff > 0) setFiltros((f) => ({ ...f, dias: String(diff) }));
                  }
                }} />
              </label>
            </>
          )}
          <label><span className="vx-label">Campanha</span>
            <select className="vx-input" value={filtros.campaignId} onChange={(e) => setFiltros({ ...filtros, campaignId: e.target.value })}><option value="">Todas campanhas</option>{(db.campaigns || []).filter((c) => c.companyId === emp.id).map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}</select>
          </label>
          <label><span className="vx-label">Profissional</span>
            <select className="vx-input" value={filtros.sellerId} onChange={(e) => setFiltros({ ...filtros, sellerId: e.target.value })}><option value="">Todos profissionais</option>{db.sellers.filter((s) => s.aplicacoes?.[emp.id] === "aprovado").map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
          </label>
          <label><span className="vx-label">Tipo de tarefa</span>
            <select className="vx-input" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}><option value="">Todas tarefas</option>{Object.entries(ACOES).map(([k, a]) => <option key={k} value={k}>{a.nome}</option>)}</select>
          </label>
        </div>
      )}

      <div className="vx-grid vx-g4" style={{ marginBottom: 22 }}>
        <Stat label="Reuniões agendadas" value={metricas.agendadas} Icon={CalendarCheck} tone="brand" mono={false} />
        <Stat label="Reuniões realizadas" value={metricas.realizadas} Icon={Presentation} tone="indigo" mono={false} />
        <Stat label="Vendas realizadas" value={metricas.vendas} Icon={Target} tone="amber" mono={false} />
        <Stat label="ROI atual" value={metricas.roi == null ? "—" : `${metricas.roi.toFixed(1)}%`} Icon={TrendingUp} tone={metricas.roi != null && metricas.roi < 0 ? "red" : "brand"} />
      </div>

      <div className="vx-grid vx-g4" style={{ marginBottom: 22 }}>
        <Stat label="Investimento" value={money(metricas.investimento)} Icon={Banknote} tone="muted" />
        <Stat label="Retorno registrado" value={money(metricas.retorno)} Icon={TrendingUp} tone="brand" />
        <Stat label="Tarefas filtradas" value={metricas.subs.length} Icon={ClipboardList} tone="indigo" mono={false} />
        <Stat label="Profissionais no time" value={time} Icon={Users} tone="muted" mono={false} />
      </div>

      <div className="vx-grid vx-g2 vx-dashboard-charts" style={{ marginBottom: 22 }}>
        <Donut titulo="Conversão comercial" itens={[{ nome: "Agendadas", valor: metricas.agendadas }, { nome: "Realizadas", valor: metricas.realizadas }, { nome: "Vendas", valor: metricas.vendas }]} />
        <Donut titulo="Tarefas por situação" itens={metricas.status.map((s) => ({ nome: ({ liberado:"Aprovadas", revisao:"Em revisão", conferido:"Conferidas", ia_recusado:"Recusadas pela IA", recusado:"Recusadas", analisando:"Analisando" })[s.chave] || s.chave, valor: s.valor }))} />
        <Donut titulo="Investimento versus retorno" centro={money(metricas.retorno)} formatar={money} itens={[{ nome: "Investimento", valor: metricas.investimento }, { nome: "Retorno", valor: metricas.retorno }]} />
        <Donut titulo="Desempenho por campanha" itens={metricas.campanhas.filter((c) => c.total).map((c) => ({ nome: c.nome, valor: c.aprovadas, fonte: `${c.total} tarefas registradas` }))} />
      </div>

      <section className="vx-card" style={{ padding: 18, marginBottom: 22 }}>
        <div className="vx-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}><div><div className="vx-eyebrow">Planejamento determinístico</div><div className="vx-disp" style={{ fontSize: 18 }}>ROI projetado</div><p className="vx-mut" style={{ margin: "4px 0 0", fontSize: 12.5 }}>Projeção não é garantia. Ajuste as premissas e confira a fonte.</p></div>{projecao.disponivel && <span className={`vx-badge ${projecao.confianca === "alta" ? "vx-badge-brand" : "vx-badge-amber"}`}>Confiança {projecao.confianca} · amostra {projecao.amostra}</span>}</div>
        <div className="vx-grid vx-g4" style={{ marginTop: 14 }}>
          <label><span className="vx-label">Meta de vendas</span><input className="vx-input" type="number" min="1" value={premissas.metaVendas} onChange={(e) => setPremissas({ ...premissas, metaVendas: e.target.value })}/></label>
          <label><span className="vx-label">Ticket médio</span><input className="vx-input" type="number" min="0" value={premissas.ticketMedio} onChange={(e) => setPremissas({ ...premissas, ticketMedio: e.target.value })}/></label>
          <label><span className="vx-label">Comparecimento %</span><input className="vx-input" type="number" min="1" max="100" placeholder={metricas.agendadas ? `${Math.round(metricas.realizadas / metricas.agendadas * 100)} histórico` : "Informe"} value={premissas.taxaComparecimento} onChange={(e) => setPremissas({ ...premissas, taxaComparecimento: e.target.value })}/></label>
          <label><span className="vx-label">Conversão %</span><input className="vx-input" type="number" min="1" max="100" placeholder={metricas.realizadas ? `${Math.round(metricas.vendas / metricas.realizadas * 100)} histórico` : "Informe"} value={premissas.taxaConversao} onChange={(e) => setPremissas({ ...premissas, taxaConversao: e.target.value })}/></label>
          <label><span className="vx-label">Custo por agendada</span><input className="vx-input" type="number" min="0" placeholder={metricas.agendadas ? money(metricas.investimento / metricas.agendadas) : "Informe"} value={premissas.custoAgendada} onChange={(e) => setPremissas({ ...premissas, custoAgendada: e.target.value })}/></label>
        </div>
        {!projecao.disponivel ? <div className="vx-notice vx-notice-amber" style={{ marginTop: 14 }}>Complete: {projecao.ausentes.join(", ")}. Sem essas premissas não exibimos números inventados.</div> : <><div className="vx-grid vx-g3" style={{ marginTop: 14 }}>{Object.entries(projecao.cenarios).map(([nome, c]) => <div className="vx-scenario" key={nome}><span>{nome}</span><strong className="vx-mono">{c.roi.toFixed(1)}% ROI</strong><small>{c.agendadas} agendadas → {c.realizadas} realizadas → {c.vendas} vendas</small><small>{money(c.investimento)} investimento · {money(c.receita)} receita</small></div>)}</div><div className="vx-chart-source">Fonte: {projecao.fonte}. Fórmula: (retorno - investimento) / investimento × 100.</div></>}
      </section>

      {financeiro?.extrato?.length > 0 && <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 10 }}>Extrato operacional</div>
        {financeiro.extrato.slice(0, 8).map((m) => <div key={m.id} className="vx-row" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}><div><b>{({ deposito: "Depósito", reserva: "Reserva de tarefa", estorno_reserva: "Reserva liberada", liquidacao: "Tarefa paga" })[m.tipo] || m.tipo}</b><div className="vx-mut" style={{ fontSize: 11.5 }}>{dataCurta(m.criadoEm)}</div></div><b className="vx-mono" style={{ color: m.valor < 0 ? "var(--red)" : "var(--brand)" }}>{money(m.valor)}</b></div>)}
      </div>}

    </>
  );
}

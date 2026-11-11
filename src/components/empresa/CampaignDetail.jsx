import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Award, BriefcaseBusiness, CalendarCheck, CheckCircle2, CircleDollarSign,
  CirclePause, Clock3, Ellipsis, ListChecks, Pencil, RefreshCw, Settings, Target,
  TrendingUp, Upload, UsersRound, X,
} from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES } from "../../lib/constants.js";
import { STATUS_CAMPANHA_UI } from "../../../shared/campaignOperations.js";
import { lerArquivoLeads, sugerirMapeamento } from "../../lib/importers.js";
import PipelineKanban from "./PipelineKanban.jsx";
import ComissoesPanel from "./ComissoesPanel.jsx";
import CriadorCampos from "./CriadorCampos.jsx";
import { useI18n } from "../../lib/i18n.jsx";

const ABAS_KEYS = [
  ["geral", "camp.detail.tab.overview"], ["profissionais", "camp.detail.tab.professionals"], ["tarefas", "camp.detail.tab.tasks"],
  ["pipeline", "camp.detail.tab.pipeline"], ["contatos", "camp.detail.tab.contacts"], ["reunioes", "camp.detail.tab.meetings"], ["performance", "camp.detail.tab.performance"],
  ["financeiro", "camp.detail.tab.financial"], ["comissoes", "camp.detail.tab.commissions"], ["campos", "camp.detail.tab.fields"],
  ["verificacao", "camp.detail.tab.verification"], ["configuracoes", "camp.detail.tab.settings"],
];
const PERIODOS_KEYS = [["hoje", "camp.detail.period.today"], ["7d", "camp.detail.period.7d"], ["30d", "camp.detail.period.30d"], ["personalizado", "camp.detail.period.custom"]];
const FILTROS_PROFISSIONAIS_KEYS = [
  ["todos", "camp.detail.filterAll"], ["online", "camp.detail.filterOnline"], ["alta", "camp.detail.filterHighPerf"],
  ["sem_atividade", "camp.detail.filterNoActivity"], ["pendente", "camp.detail.filterPending"],
];
const EVENTOS_LABEL_KEYS = {
  CAMPAIGN_CREATED: "camp.event.created", CAMPAIGN_PUBLISHED: "camp.event.published",
  CAMPAIGN_PAUSED: "camp.event.paused", CAMPAIGN_CLOSED: "camp.event.closed",
  PROFESSIONAL_APPLIED: "camp.event.applied", PROFESSIONAL_APPROVED: "camp.event.approved",
  PROFESSIONAL_REJECTED: "camp.event.rejected", PROFESSIONAL_JOINED: "camp.event.joined",
  TASK_STARTED: "camp.event.taskStarted", TASK_COMPLETED: "camp.event.taskCompleted", TASK_APPROVED: "camp.event.taskApproved",
  TASK_REJECTED: "camp.event.taskRejected", LEAD_CREATED: "camp.event.leadCreated", MEETING_SCHEDULED: "camp.event.meetingScheduled",
  MEETING_COMPLETED: "camp.event.meetingCompleted", SALE_RECORDED: "camp.event.saleRecorded",
  EVIDENCE_SUBMITTED: "camp.event.evidenceSubmitted", PAYMENT_RELEASED: "camp.event.paymentReleased",
};
const SERIES_KEYS = {
  investimento: { i18n: "camp.detail.investment", cor: "#F0B45E", monetario: true },
  tarefas: { i18n: "camp.detail.tasks", cor: "#5B8CFF" },
  leads: { i18n: "camp.detail.leads", cor: "#9AA6FF" },
  reunioes: { i18n: "camp.detail.meetings", cor: "#22A06B" },
  vendas: { i18n: "camp.detail.sales", cor: "#FF8A7A" },
};

function dataInput(ms) {
  const data = new Date(ms - 3 * 60 * 60 * 1000);
  return data.toISOString().slice(0, 10);
}

function timestampSaoPaulo(data, fim = false) {
  if (!data) return null;
  return new Date(`${data}T${fim ? "23:59:59.999" : "00:00:00"}-03:00`).getTime();
}

function Variacao({ valor }) {
  const { t } = useI18n();
  if (valor == null) return <span className="vx-mut">{t("camp.detail.noComparison")}</span>;
  return <span className={valor >= 0 ? "vx-positive" : "vx-negative"}>{valor >= 0 ? "↑" : "↓"} {Math.abs(valor).toLocaleString("pt-BR")}%</span>;
}

function Empty({ texto }) {
  return <div className="vx-campaign-inline-empty">{texto}</div>;
}

function ActivityFeed({ eventos = [], onRefresh }) {
  const { t } = useI18n();
  return <section className="vx-card vx-activity-card">
    <div className="vx-row"><div><div className="vx-eyebrow">{t("camp.detail.realtimeActivity")}</div><h2 className="vx-disp">{t("camp.detail.happeningNow")}</h2></div><button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onRefresh} title={t("camp.detail.refresh")}><RefreshCw size={14} /> {t("camp.detail.refresh")}</button></div>
    {eventos.length === 0 ? <Empty texto={t("camp.detail.activityEmpty")} /> : <div className="vx-activity-list">
      {eventos.slice(0, 12).map((evento) => <div key={evento.id}>
        <time className="vx-mono">{new Date(evento.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
        <i className={`is-${evento.tipo.toLowerCase()}`} />
        <div><b>{evento.sellerNome ? `${evento.sellerNome} — ` : ""}{EVENTOS_LABEL_KEYS[evento.tipo] ? t(EVENTOS_LABEL_KEYS[evento.tipo]) : evento.tipo}</b><span>{evento.source === "BACKFILL" ? t("camp.detail.existingHistory") : new Date(evento.criadoEm).toLocaleDateString("pt-BR")}</span></div>
      </div>)}
    </div>}
    <div className="vx-chart-source">{t("camp.detail.activitySource")}</div>
  </section>;
}

function AttentionNeeded({ alertas = [] }) {
  const { t } = useI18n();
  return <section className="vx-card vx-alerts-card">
    <div className="vx-eyebrow">{t("camp.detail.deterministicMonitoring")}</div><h2 className="vx-disp">{t("camp.detail.attentionNeeded")}</h2>
    {alertas.length === 0 ? <div className="vx-alert-row is-positive"><CheckCircle2 size={16} /><span>{t("camp.detail.noAlerts")}</span></div> : alertas.map((alerta) => <div className={`vx-alert-row is-${alerta.nivel}`} key={alerta.codigo}><span className="vx-alert-dot" /><span>{alerta.texto}</span></div>)}
  </section>;
}

function PerformanceChart({ serie = [] }) {
  const { t } = useI18n();
  const [visiveis, setVisiveis] = useState(() => new Set(Object.keys(SERIES_KEYS)));
  const largura = 640, altura = 220, margemX = 18, margemY = 20;
  const temDados = serie.some((dia) => Object.keys(SERIES_KEYS).some((chave) => Number(dia[chave]) > 0));
  const alternar = (chave) => setVisiveis((atual) => {
    const proximo = new Set(atual);
    if (proximo.has(chave) && proximo.size > 1) proximo.delete(chave); else proximo.add(chave);
    return proximo;
  });
  const pontos = (chave) => {
    const maximo = Math.max(1, ...serie.map((dia) => Number(dia[chave]) || 0));
    return serie.map((dia, i) => {
      const x = margemX + (serie.length <= 1 ? 0 : (i / (serie.length - 1)) * (largura - margemX * 2));
      const y = altura - margemY - ((Number(dia[chave]) || 0) / maximo) * (altura - margemY * 2);
      return { x, y, valor: Number(dia[chave]) || 0, data: dia.data };
    });
  };
  return <div className="vx-performance-chart">
    <div className="vx-chart-toggles">{Object.entries(SERIES_KEYS).map(([chave, config]) => <button key={chave} data-on={visiveis.has(chave) ? "1" : "0"} onClick={() => alternar(chave)}><i style={{ background: config.cor }} />{t(config.i18n)}</button>)}</div>
    {!temDados ? <Empty texto={t("camp.detail.chartNoData")} /> : <>
      <svg role="img" aria-label={t("camp.detail.chartLabel")} viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none">
        {[0, .25, .5, .75, 1].map((p) => <line key={p} x1={margemX} x2={largura - margemX} y1={margemY + p * (altura - margemY * 2)} y2={margemY + p * (altura - margemY * 2)} className="vx-chart-gridline" />)}
        {Object.entries(SERIES_KEYS).filter(([chave]) => visiveis.has(chave)).map(([chave, config]) => {
          const lista = pontos(chave);
          return <g key={chave}><polyline points={lista.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={config.cor} strokeWidth="3" vectorEffect="non-scaling-stroke" />{lista.map((p) => <circle key={p.data} cx={p.x} cy={p.y} r="4" fill={config.cor}><title>{`${t(config.i18n)} · ${p.data}: ${config.monetario ? money(p.valor) : p.valor}`}</title></circle>)}</g>;
        })}
      </svg>
      <div className="vx-chart-axis"><span>{serie[0]?.data?.slice(5).split("-").reverse().join("/")}</span><span>{serie.at(-1)?.data?.slice(5).split("-").reverse().join("/")}</span></div>
    </>}
    <div className="vx-chart-source">{t("camp.detail.chartSource")}</div>
  </div>;
}

function ProfessionalProfile({ item, tarefas, leads, campanha, onClose, onStatusChange }) {
  const { t } = useI18n();
  const sellerId = item.sellerId;
  const tarefasProfissional = tarefas.filter((t) => t.sellerId === sellerId);
  const leadsProfissional = leads.filter((l) => l.sellerId === sellerId);
  const reunioes = tarefasProfissional.filter((t) => t.tipo === "agendamento").length;
  const realizadas = tarefasProfissional.filter((t) => t.tipo === "realizada").length;
  const vendas = tarefasProfissional.filter((t) => t.tipo === "venda").length;
  const evidencias = tarefasProfissional.filter((t) => Object.values(t.prova || {}).some(Boolean) || (t.arquivos || []).length);
  const porDia = new Map();
  tarefasProfissional.forEach((t) => {
    const data = new Date(t.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    porDia.set(data, (porDia.get(data) || 0) + 1);
  });
  const serie = [...porDia.entries()].slice(-10);
  const maximo = Math.max(1, ...serie.map(([, total]) => total));
  return <div className="vx-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="vx-sheet vx-professional-sheet">
      <div className="vx-row"><div><div className="vx-eyebrow">{t("camp.detail.profileInCampaign")}</div><h2 className="vx-disp">{item.nome || t("camp.detail.professional")}</h2></div><button className="vx-btn vx-btn-ghost" aria-label={t("app.close")} onClick={onClose}><X size={18} /></button></div>
      <div className="vx-professional-identity"><div className="vx-avatar">{String(item.nome || "P").split(" ").slice(0, 2).map((n) => n[0]).join("")}</div><div><b>{item.titulo || item.perfil || t("camp.detail.commercialPro")}</b><span>{item.cidade || t("camp.detail.locationUnknown")}</span></div><span className={`vx-campaign-person-status is-${item.statusOperacional}`}>{item.statusOperacional.replace("_", " ")}</span></div>
      <div className="vx-profile-stats">
        {[[t("camp.detail.tasks"), tarefasProfissional.length], [t("camp.detail.approved"), item.aprovadas], [t("camp.detail.rejected"), item.recusadas], [t("camp.detail.leads"), leadsProfissional.length], [t("camp.detail.meetings"), reunioes], [t("camp.detail.completed"), realizadas], [t("camp.detail.sales"), vendas], [t("camp.detail.earnings"), money(item.ganhos)]].map(([label, total]) => <div key={label}><span>{label}</span><b className="vx-mono">{total}</b></div>)}
      </div>
      <div className="vx-grid vx-g2" style={{ marginTop: 13 }}><div className="vx-scenario"><span>{t("camp.detail.approvalRate")}</span><strong>{item.taxaAprovacao == null ? t("camp.detail.noBase") : `${item.taxaAprovacao.toLocaleString("pt-BR")}%`}</strong></div><div className="vx-scenario"><span>Score</span><strong>{item.score || t("camp.detail.noScore")}</strong></div></div>
      <div className="vx-profile-chart"><div className="vx-eyebrow">{t("camp.detail.dailyPerformance")}</div>{serie.length === 0 ? <Empty texto={t("camp.detail.proNoActivity")} /> : serie.map(([data, total]) => <div key={data}><span>{data}</span><i><b style={{ width: `${(total / maximo) * 100}%` }} /></i><strong>{total}</strong></div>)}</div>
      <div className="vx-eyebrow" style={{ marginTop: 17 }}>{t("camp.detail.evidenceHistory")}</div>
      {evidencias.length === 0 ? <Empty texto={t("camp.detail.noEvidence")} /> : <div className="vx-compact-list">{evidencias.slice(0, 8).map((tt) => <div key={tt.id}><div><b>{tt.tipo}</b><span>{new Date(tt.criadoEm).toLocaleString("pt-BR")}</span></div><span className="vx-chip">{tt.status}</span></div>)}</div>}
      {item.candidaturaStatus === "pendente" && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="vx-btn vx-btn-primary" style={{ flex: 1 }} onClick={() => onStatusChange("aprovado")}><CheckCircle2 size={14} /> {t("camp.detail.approvePro")}</button>
          <button className="vx-btn vx-btn-danger" style={{ flex: 1 }} onClick={() => onStatusChange("recusado")}><X size={14} /> {t("camp.detail.reject")}</button>
        </div>
      )}
    </div>
  </div>;
}

export default function CampaignDetail({ campanha, db, onVoltar, onEditar, onStatus }) {
  const { t } = useI18n();
  const [aba, setAba] = useState("geral");
  const [periodo, setPeriodo] = useState("7d");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [menu, setMenu] = useState(false);
  const [recarregar, setRecarregar] = useState(0);
  const [filtroProfissional, setFiltroProfissional] = useState("todos");
  const [profissionalAberto, setProfissionalAberto] = useState(null);
  const [dataDe, setDataDe] = useState(() => dataInput(Date.now() - 6 * 86400000));
  const [dataAte, setDataAte] = useState(() => dataInput(Date.now()));

  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, []);

  useEffect(() => {
    let ativo = true;
    setErro("");
    setDados(null);
    const custom = periodo === "personalizado" ? `&de=${timestampSaoPaulo(dataDe)}&ate=${timestampSaoPaulo(dataAte, true)}` : "";
    api(`/campaigns/${campanha.id}/operations?periodo=${periodo}${custom}`).then((r) => {
      if (!ativo) return;
      if (!r || r.error) setErro(r?.error || "Não foi possível carregar a operação.");
      else setDados(r);
    });
    return () => { ativo = false; };
  }, [campanha.id, periodo, dataDe, dataAte, recarregar]);

  const tarefas = useMemo(() => (db.submissions || []).filter((s) => s.campaignId === campanha.id), [db.submissions, campanha.id]);
  const leads = useMemo(() => (db.leads || []).filter((l) => l.campaignId === campanha.id), [db.leads, campanha.id]);
  const candidaturas = campanha.candidaturas || [];
  const profissionaisLocais = useMemo(() => candidaturas.filter((a) => ["aprovado", "pendente"].includes(a.status)).map((a) => {
    const profissional = (db.sellers || []).find((s) => s.id === a.sellerId) || {};
    const tarefasDoProfissional = tarefas.filter((s) => s.sellerId === a.sellerId);
    return { ...a, ...profissional, applicationId: a.id, candidaturaStatus: a.status, tarefas: tarefasDoProfissional.length, statusOperacional: a.status === "pendente" ? "pendente" : "sem_atividade", ganhos: 0, aprovadas: 0, recusadas: 0, score: Number(profissional.nota) || 0 };
  }), [candidaturas, db.sellers, tarefas]);
  const profissionais = dados?.profissionais || profissionaisLocais;
  const profissionaisFiltrados = profissionais.filter((item) => filtroProfissional === "todos"
    || (filtroProfissional === "online" && item.statusOperacional === "online")
    || (filtroProfissional === "alta" && item.altaPerformance)
    || (filtroProfissional === "sem_atividade" && item.statusOperacional === "sem_atividade")
    || (filtroProfissional === "pendente" && item.candidaturaStatus === "pendente"));
  const reunioes = tarefas.filter((s) => ["agendamento", "realizada"].includes(s.tipo));

  const alterarStatus = async (status) => {
    setMenu(false);
    await onStatus(status);
    setRecarregar((n) => n + 1);
  };

  return <div className="vx-fade">
    <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ paddingLeft: 0, marginBottom: 10 }} onClick={onVoltar}><ArrowLeft size={14} /> {t("camp.detail.backToCampaigns")}</button>
    <div className="vx-campaign-detail-head">
      <div>
        <div className="vx-row" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <h1 className="vx-disp">{campanha.titulo}</h1>
          <span className={`vx-campaign-status is-${campanha.status}`}>{STATUS_CAMPANHA_UI[campanha.status] || campanha.status}</span>
        </div>
        <p>{campanha.descricao || campanha.objetivo || t("camp.detail.defaultDesc")}</p>
        <div className="vx-campaign-detail-meta">
          <span><BriefcaseBusiness size={13} /> {campanha.funcao ? campanha.funcao.toUpperCase() : t("camp.dash.roleUndefined")}</span>
          {campanha.regiao && <span><Target size={13} /> {campanha.regiao}</span>}
          <span><UsersRound size={13} /> {dados?.campanha?.profissionaisAtivos ?? profissionais.filter((p) => p.candidaturaStatus === "aprovado").length} {t("camp.dash.activeProsLabel")}</span>
        </div>
      </div>
      <div className="vx-campaign-detail-actions">
        {campanha.status === "ativa" && <button className="vx-btn" onClick={() => alterarStatus("pausada")}><CirclePause size={14} /> {t("camp.detail.pause")}</button>}
        <button className="vx-btn" onClick={onEditar}><Pencil size={14} /> {t("camp.detail.edit")}</button>
        <div className="vx-context-wrap"><button className="vx-btn" aria-label={t("camp.detail.moreActions")} onClick={() => setMenu((v) => !v)}><Ellipsis size={16} /></button>{menu && <div className="vx-context-menu">
          {campanha.status === "pausada" && <button onClick={() => alterarStatus("ativa")}>{t("camp.detail.resume")}</button>}
          {!['encerrada'].includes(campanha.status) && <button className="is-danger" onClick={() => alterarStatus("encerrada")}>{t("camp.detail.close")}</button>}
        </div>}</div>
      </div>
    </div>

    <div className="vx-campaign-inner-tabs" role="tablist">
      {ABAS_KEYS.map(([chave, i18nKey]) => <button key={chave} role="tab" aria-selected={aba === chave} data-on={aba === chave ? "1" : "0"} onClick={() => setAba(chave)}>{t(i18nKey)}</button>)}
    </div>

    {["geral", "performance", "financeiro"].includes(aba) && <div className="vx-campaign-periods">
      {PERIODOS_KEYS.map(([chave, i18nKey]) => <button key={chave} data-on={periodo === chave ? "1" : "0"} onClick={() => setPeriodo(chave)}>{t(i18nKey)}</button>)}
      {periodo === "personalizado" && <div className="vx-custom-dates"><label>{t("camp.detail.from")}<input type="date" value={dataDe} max={dataAte} onChange={(e) => setDataDe(e.target.value)} /></label><label>{t("camp.detail.to")}<input type="date" value={dataAte} min={dataDe} onChange={(e) => setDataAte(e.target.value)} /></label></div>}
    </div>}

    {erro && <div className="vx-notice vx-notice-amber">{erro}</div>}
    {!dados && !erro && <div className="vx-campaign-detail-loading"><div className="vx-stat vx-skeleton" /><div className="vx-stat vx-skeleton" /><div className="vx-stat vx-skeleton" /></div>}

    {dados && aba === "geral" && <>
      <div className="vx-campaign-overview-stats">
        {[
          ["investimento", "camp.detail.investment", CircleDollarSign, true], ["tarefas", "camp.detail.tasks", ListChecks, false],
          ["leads", "camp.detail.leads", Target, false], ["reunioes", "camp.detail.meetings", CalendarCheck, false], ["vendas", "camp.detail.sales", TrendingUp, false],
        ].map(([chave, labelKey, Icone, monetario]) => <article className="vx-stat" key={chave}>
          <div className="vx-campaign-stat-top"><span>{t(labelKey)}</span><Icone size={16} /></div>
          <strong className="vx-stat-val vx-mono">{monetario ? money(dados.metricas[chave].valor) : dados.metricas[chave].valor.toLocaleString("pt-BR")}</strong>
          <Variacao valor={dados.metricas[chave].variacao} />
        </article>)}
      </div>

      <div className="vx-campaign-detail-grid">
        <section className="vx-card vx-funnel-card">
          <div className="vx-row"><div><div className="vx-eyebrow">{t("camp.detail.salesFunnel")}</div><h2 className="vx-disp">{t("camp.detail.operationConversion")}</h2></div><span className="vx-chip">{dados.periodo.label}</span></div>
          <div className="vx-funnel">
            {dados.funil.map((etapa, i) => <div className="vx-funnel-step" key={etapa.chave}>
              <div><b className="vx-mono">{etapa.valor.toLocaleString("pt-BR")}</b><span>{etapa.label}</span></div>
              {i > 0 && <small>{etapa.taxa == null ? t("camp.detail.noBase") : `${etapa.taxa.toLocaleString("pt-BR")}%`}</small>}
            </div>)}
          </div>
          <div className="vx-chart-source">{t("camp.detail.funnelSource")}</div>
        </section>
        <section className="vx-card vx-cost-card">
          <div className="vx-eyebrow">{t("camp.detail.costPerResult")}</div><h2 className="vx-disp">{t("camp.detail.efficiency")}</h2>
          {[["lead", t("camp.detail.costPerLead")], ["reuniao", t("camp.detail.costPerMeeting")], ["venda", t("camp.detail.costPerSale")]].map(([chave, label]) => <div className="vx-cost-row" key={chave}><span>{label}</span><b className="vx-mono">{dados.custos[chave] == null ? t("camp.detail.noResult") : money(dados.custos[chave])}</b></div>)}
          <div className="vx-chart-source">Base: {dados.origem.investimento}.</div>
        </section>
      </div>
      <AttentionNeeded alertas={dados.alertas} />
      <ActivityFeed eventos={dados.eventos} onRefresh={() => setRecarregar((n) => n + 1)} />
    </>}

    {dados && aba === "profissionais" && <section className="vx-card vx-detail-section">
      <div className="vx-row" style={{ alignItems: "end", flexWrap: "wrap" }}><div><h2 className="vx-disp">{t("camp.detail.activeTeam")}</h2><p>{t("camp.detail.approvedPros", { n: profissionais.filter((p) => p.candidaturaStatus === "aprovado").length })}</p></div><span className="vx-chip"><UsersRound size={12} /> {profissionais.length} {t("camp.detail.records")}</span></div>
      <div className="vx-professional-filters">{FILTROS_PROFISSIONAIS_KEYS.map(([chave, i18nKey]) => <button key={chave} data-on={filtroProfissional === chave ? "1" : "0"} onClick={() => setFiltroProfissional(chave)}>{t(i18nKey)}</button>)}</div>
      {profissionaisFiltrados.length === 0 ? <Empty texto={t("camp.detail.noProInFilter")} /> : <div className="vx-campaign-team-table">
        <div className="vx-team-head"><span>{t("camp.detail.professional")}</span><span>{t("camp.detail.role")}</span><span>Status</span><span>{t("camp.dash.today")}</span><span>{t("camp.detail.result")}</span><span>{t("camp.detail.earnings")}</span><span>Score</span><span>{t("camp.detail.actions")}</span></div>
        {profissionaisFiltrados.map((item) => <button className="vx-team-row" key={item.applicationId || item.id} onClick={() => setProfissionalAberto(item)}>
          <span className="vx-team-person"><i>{String(item.nome || "P").split(" ").slice(0, 2).map((n) => n[0]).join("")}</i><b>{item.nome || "Profissional"}</b></span>
          <span data-label="Função">{item.titulo || item.perfil || campanha.funcao || "—"}</span>
          <span data-label="Status"><em className={`vx-campaign-person-status is-${item.statusOperacional}`}>{item.statusOperacional.replace("_", " ")}</em></span>
          <span data-label={t("camp.dash.today")} className="vx-mono">{item.tarefasHoje || 0} {t("camp.detail.tasks").toLowerCase()}</span>
          <span data-label="Resultado" className="vx-mono">{(item.reunioes || 0) + (item.vendas || 0)}</span>
          <span data-label="Ganhos" className="vx-mono">{money(item.ganhos)}</span>
          <span data-label="Score" className="vx-mono">{item.score || "—"}</span>
          <span className="vx-team-action">{t("camp.detail.viewProfile")} →</span>
        </button>)}
      </div>}
    </section>}
    {dados && aba === "tarefas" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">{t("camp.detail.campaignTasks")}</h2><p>{t("camp.detail.campaignTasksDesc")}</p>{tarefas.length === 0 ? <Empty texto={t("camp.detail.noTasks")} /> : <div className="vx-compact-list">{tarefas.slice(0, 20).map((item) => <div key={item.id}><div><b>{item.tipo}</b><span>{new Date(item.criadoEm).toLocaleString("pt-BR")}</span></div><span className="vx-chip">{item.status}</span></div>)}</div>}</section>}
    {aba === "pipeline" && <section className="vx-card vx-detail-section">
      <PipelineKanban
        campanha={campanha}
        leads={leads}
        sellers={profissionais}
        aviso={(msg) => console.log(msg)}
        onLeadsAtualizado={() => setRecarregar((n) => n + 1)}
      />
    </section>}
    {dados && aba === "comissoes" && <ComissoesPanel emp={{ id: campanha.companyId }} />}
    {aba === "campos" && <section className="vx-card vx-detail-section">
      <h2 className="vx-disp">{t("camp.detail.customFields")}</h2>
      <p className="vx-mut" style={{ fontSize: 13 }}>{t("camp.detail.customFieldsDesc")}</p>
      <CriadorCampos
        campos={campanha.camposPersonalizados?.geral || []}
        modelos={campanha.modelosCampos || []}
        onChange={async (campos) => { await apiPatch(`/campaigns/${campanha.id}`, { camposPersonalizados: { ...(campanha.camposPersonalizados||{}), geral: campos } }); }}
        onSalvarModelo={async (modelo) => {
          const modelos = [...(campanha.modelosCampos || []), modelo];
          await apiPatch(`/campaigns/${campanha.id}`, { modelosCampos: modelos });
        }}
        tarefa="geral"
      />
    </section>}
    {dados && aba === "reunioes" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">{t("camp.detail.meetings")}</h2><p>{t("camp.detail.meetingsDesc")}</p>{reunioes.length === 0 ? <Empty texto={t("camp.detail.noMeetings")} /> : <div className="vx-compact-list">{reunioes.slice(0, 20).map((item) => <div key={item.id}><div><b>{item.tipo === "realizada" ? t("camp.detail.meetingCompleted") : t("camp.detail.meetingScheduled")}</b><span>{new Date(item.criadoEm).toLocaleString("pt-BR")}</span></div><span className="vx-chip">{item.status}</span></div>)}</div>}</section>}
    {dados && aba === "performance" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">{t("camp.detail.resultsOverTime")}</h2><p>{t("camp.detail.compareMetrics", { period: dados.periodo.label.toLowerCase() })}</p><PerformanceChart serie={dados.serie} /></section>}
    {dados && aba === "financeiro" && <div className="vx-finance-stack">
      <section className="vx-card vx-detail-section">
        <div className="vx-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}><div><h2 className="vx-disp">{t("camp.detail.campaignFinancial")}</h2><p>{t("camp.detail.financialPosition")}</p></div><span className={`vx-budget-risk ${dados.financeiro.diasRestantes != null && dados.financeiro.diasRestantes <= 2 ? "is-danger" : "is-ok"}`}><i />{dados.financeiro.diasRestantes == null ? t("camp.dash.noConsumption") : t("camp.detail.estimatedDays", { n: dados.financeiro.diasRestantes.toLocaleString("pt-BR") })}</span></div>
        <div className="vx-finance-budget"><div className="vx-row"><span>{t("camp.dash.budget")}</span><b className="vx-mono">{money(dados.financeiro.consumido)} / {money(dados.financeiro.limite)}</b></div><div className="vx-meter-track"><div className="vx-meter-fill" style={{ width: `${Math.min(100, dados.financeiro.limite > 0 ? (dados.financeiro.consumido / dados.financeiro.limite) * 100 : 0)}%`, background: "var(--brand)" }} /></div></div>
        <div className="vx-finance-kpis">
          {[[t("camp.detail.reservedBalance"), dados.financeiro.reservado, true], [t("camp.detail.consumed"), dados.financeiro.consumido, true], [t("camp.detail.available"), dados.financeiro.disponivel, true], [t("camp.dash.avgDailySpend"), dados.financeiro.gastoMedioDiario, true], [t("camp.detail.monthlyProjection"), dados.financeiro.projecaoMensal, true], [t("camp.dash.estimatedDuration"), dados.financeiro.diasRestantes, false]].map(([label, valor, monetario]) => <div key={label}><span>{label}</span><b className="vx-mono">{monetario ? money(valor) : valor == null ? t("camp.dash.noConsumption") : t("camp.dash.daysLeft", { n: valor.toLocaleString("pt-BR") })}</b></div>)}
        </div>
      </section>
      <section className="vx-card vx-detail-section"><h2 className="vx-disp">{t("camp.detail.dailySpendResults")}</h2><p>{t("camp.detail.dailySpendDesc")}</p><PerformanceChart serie={dados.financeiro.serie} /></section>
      <section className="vx-card vx-detail-section"><h2 className="vx-disp">{t("camp.detail.costBreakdown")}</h2><p>{t("camp.detail.costBreakdownDesc")}</p>{dados.financeiro.detalhamento.length === 0 ? <Empty texto={t("camp.detail.noCostBreakdown")} /> : <div className="vx-cost-table"><div><span>{t("camp.detail.taskType")}</span><span>{t("camp.detail.unitValue")}</span><span>{t("camp.detail.quantity")}</span><span>{t("camp.detail.totalSpent")}</span></div>{dados.financeiro.detalhamento.map((item) => <div key={item.tipo}><b>{ACOES[item.tipo]?.nome || item.tipo}</b><span className="vx-mono" data-label="Valor unitário">{money(item.valorUnitario)}</span><span className="vx-mono" data-label="Quantidade">{item.quantidade}</span><span className="vx-mono" data-label="Total gasto">{money(item.total)}</span></div>)}</div>}</section>
    </div>}
    {dados && aba === "configuracoes" && <section className="vx-card vx-detail-section"><Settings size={22} color="var(--brand)" /><h2 className="vx-disp">{t("camp.detail.campaignSettings")}</h2><p>{t("camp.detail.campaignSettingsDesc")}</p><button className="vx-btn vx-btn-primary" onClick={onEditar}><Pencil size={14} /> {t("camp.detail.editSettings")}</button></section>}
    {aba === "contatos" && <ContatosCampanha campanha={campanha} profissionais={profissionais} aviso={(msg) => console.log("[contatos]", msg)} />}
    {aba === "verificacao" && <VerificacaoCampanha campanha={campanha} />}
    {profissionalAberto && <ProfessionalProfile item={profissionalAberto} tarefas={tarefas} leads={leads} campanha={campanha} onClose={() => setProfissionalAberto(null)} onStatusChange={async (status) => {
      await apiPatch(`/campaigns/${campanha.id}/applications/${profissionalAberto.applicationId || profissionalAberto.id}`, { status });
      setProfissionalAberto(null);
      setRecarregar((v) => v + 1);
    }} />}
  </div>;
}

// ── Lista de Contatos ────────────────────────────────────────────────────────

const MODELOS_VERIFICACAO_KEYS = [
  { value: "ia", labelKey: "camp.detail.verif.ai", descKey: "camp.detail.verif.aiDesc" },
  { value: "manual", labelKey: "camp.detail.verif.manual", descKey: "camp.detail.verif.manualDesc" },
  { value: "ia_manual", labelKey: "camp.detail.verif.aiManual", descKey: "camp.detail.verif.aiManualDesc" },
  { value: "integracao", labelKey: "camp.detail.verif.integration", descKey: "camp.detail.verif.integrationDesc" },
];

const CAMPOS_CONTATO_KEYS = [["nome","camp.detail.contacts.name"],["empresa","camp.detail.contacts.company"],["cargo","camp.detail.contacts.role"],["telefone","camp.detail.contacts.phone"],["email","camp.detail.contacts.email"],["valorEstimado","camp.detail.contacts.estValue"]];

function ContatosCampanha({ campanha, profissionais, aviso }) {
  const { t } = useI18n();
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [tabela, setTabela] = useState({ colunas: [], linhas: [] });
  const [mapa, setMapa] = useState({});
  const [relatorio, setRelatorio] = useState(null);
  const [redistribuindo, setRedistribuindo] = useState(false);
  const [avisoLocal, setAvisoLocal] = useState("");
  const fileRef = useRef(null);

  const sellers = profissionais.filter((p) => p.candidaturaStatus === "aprovado");

  const carregar = async () => {
    setCarregando(true);
    const r = await api(`/leads?campaignId=${campanha.id}`);
    if (Array.isArray(r)) setLeads(r);
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, [campanha.id]);

  const normalizados = useMemo(() => tabela.linhas.map((linha) =>
    Object.fromEntries(CAMPOS_CONTATO_KEYS.map(([campo]) => [campo, mapa[campo] >= 0 ? linha[mapa[campo]] || "" : ""]))
  ), [tabela, mapa]);

  const aplicarTabela = (tb) => { setTabela(tb); setMapa(sugerirMapeamento(tb.colunas)); setRelatorio(null); };
  const lerArquivo = async (file) => { try { aplicarTabela(await lerArquivoLeads(file)); setAberto(true); } catch (e) { setAvisoLocal(e.message); } };

  const importar = async () => {
    if (mapa.nome == null || mapa.nome < 0) return setAvisoLocal(t("camp.detail.contacts.mapName"));
    setEnviando(true); setAvisoLocal("");
    const r = await api("/leads/import", { campaignId: campanha.id, autoDistribuir: true, linhas: normalizados });
    setEnviando(false);
    if (!r || r.error) return setAvisoLocal(r?.error || t("camp.detail.contacts.importError"));
    setRelatorio(r); setAberto(false); setTabela({ colunas: [], linhas: [] });
    await carregar();
    setAvisoLocal(t("camp.detail.contacts.importSuccess", { imported: r.importados, sellers: sellers.length }));
  };

  const redistribuir = async () => {
    if (!sellers.length) return setAvisoLocal(t("camp.detail.contacts.noProsRedist"));
    setRedistribuindo(true);
    const r = await api("/leads/redistribuir", { campaignId: campanha.id });
    setRedistribuindo(false);
    if (r?.error) return setAvisoLocal(r.error);
    setAvisoLocal(t("camp.detail.contacts.redistSuccess", { n: r.redistribuidos }));
    await carregar();
  };

  const fechados = leads.filter((l) => l.etapa === "fechado" || l.etapa === "ganho").length;
  const totalVendas = leads.filter((l) => l.etapa === "fechado" || l.etapa === "ganho").reduce((s, l) => s + (Number(l.valorVenda) || 0), 0);

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div className="vx-eyebrow">{t("camp.detail.contacts.eyebrow")}</div>
          <h2 className="vx-disp" style={{ margin: "4px 0" }}>{t("camp.detail.contacts.title")}</h2>
          <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>{t("camp.detail.contacts.subtitle")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="vx-chip">{t("camp.detail.contacts.count", { n: leads.length })}</span>
          <button className="vx-btn" onClick={() => { setAberto(!aberto); setAvisoLocal(""); }}><Upload size={13} /> {t("camp.detail.contacts.import")}</button>
          <button className="vx-btn" disabled={redistribuindo || !sellers.length} onClick={redistribuir}>
            {redistribuindo ? t("camp.detail.contacts.redistributing") : t("camp.detail.contacts.redistribute")}
          </button>
        </div>
      </div>

      {avisoLocal && <div className="vx-notice" style={{ marginBottom: 12 }}>{avisoLocal}</div>}

      {aberto && (
        <section className="vx-card" style={{ padding: 18, marginBottom: 18 }}>
          <div className="vx-disp" style={{ fontSize: 16, marginBottom: 4 }}>{t("camp.detail.contacts.importTitle")}</div>
          <div className="vx-mut" style={{ fontSize: 12, marginBottom: 14 }}>
            {t("camp.detail.contacts.importDesc", { sellers: sellers.length })}
          </div>
          <input ref={fileRef} hidden type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => lerArquivo(e.target.files?.[0])} />
          <button className="vx-btn" onClick={() => fileRef.current?.click()}><Upload size={13} /> {t("camp.detail.contacts.chooseFile")}</button>

          {tabela.colunas.length > 0 && (
            <>
              <div className="vx-sep" />
              <div className="vx-disp" style={{ fontSize: 14, marginBottom: 10 }}>{t("camp.detail.contacts.columnMapping")}</div>
              <div className="vx-grid vx-g3">
                {CAMPOS_CONTATO_KEYS.map(([campo, labelKey]) => (
                  <label key={campo}>
                    <span className="vx-label">{t(labelKey)}</span>
                    <select className="vx-input" value={mapa[campo] ?? -1} onChange={(e) => setMapa({ ...mapa, [campo]: Number(e.target.value) })}>
                      <option value={-1}>{t("camp.detail.contacts.ignore")}</option>
                      {tabela.colunas.map((c, i) => <option key={i} value={i}>{c}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="vx-table-wrap" style={{ marginTop: 12 }}>
                <table className="vx-table">
                  <thead><tr>{CAMPOS_CONTATO_KEYS.map(([, lk]) => <th key={lk}>{t(lk)}</th>)}</tr></thead>
                  <tbody>{normalizados.slice(0, 3).map((l, i) => <tr key={i}>{CAMPOS_CONTATO_KEYS.map(([c]) => <td key={c}>{l[c] || "—"}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <div className="vx-chart-source">{t("camp.detail.contacts.rowsPreview", { rows: normalizados.length })}</div>
              <button className="vx-btn vx-btn-primary" style={{ marginTop: 12 }} disabled={enviando || !normalizados.length} onClick={importar}>
                {enviando ? t("camp.detail.contacts.importing") : t("camp.detail.contacts.confirmImport")}
              </button>
            </>
          )}
          {relatorio && (
            <div className="vx-grid vx-g4" style={{ marginTop: 14 }}>
              {[[t("camp.detail.contacts.received"), relatorio.totalRecebido], [t("camp.detail.contacts.imported"), relatorio.importados], [t("camp.detail.contacts.duplicates"), relatorio.duplicados], [t("camp.detail.contacts.invalid"), relatorio.invalidos]].map(([l, v]) => (
                <div className="vx-scenario" key={l}><span>{l}</span><strong className="vx-mono">{v}</strong></div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="vx-grid vx-g4" style={{ marginBottom: 16 }}>
        <div className="vx-card" style={{ padding: 14 }}><div className="vx-mut" style={{ fontSize: 12 }}>{t("common.total")}</div><b className="vx-mono" style={{ fontSize: 19 }}>{leads.length}</b></div>
        <div className="vx-card" style={{ padding: 14 }}><div className="vx-mut" style={{ fontSize: 12 }}>{t("camp.detail.contacts.closed")}</div><b className="vx-mono" style={{ fontSize: 19 }}>{fechados}</b></div>
        <div className="vx-card" style={{ padding: 14 }}><div className="vx-mut" style={{ fontSize: 12 }}>{t("camp.detail.contacts.conversion")}</div><b className="vx-mono" style={{ fontSize: 19 }}>{leads.length ? Math.round(fechados / leads.length * 100) : 0}%</b></div>
        <div className="vx-card" style={{ padding: 14 }}><div className="vx-mut" style={{ fontSize: 12 }}>{t("camp.detail.contacts.totalSales")}</div><b className="vx-mono" style={{ fontSize: 19 }}>{money(totalVendas)}</b></div>
      </div>

      {carregando ? (
        <div className="vx-mut">{t("camp.detail.contacts.loading")}</div>
      ) : leads.length === 0 ? (
        <div className="vx-card" style={{ padding: 32, textAlign: "center" }}>
          <Upload size={24} color="var(--muted)" />
          <p className="vx-mut" style={{ marginTop: 10 }}>{t("camp.detail.contacts.empty")}</p>
          <p className="vx-mut" style={{ fontSize: 12 }}>{t("camp.detail.contacts.recognizedCols")}</p>
        </div>
      ) : (
        <PipelineKanban
          campanha={campanha}
          leads={leads}
          sellers={sellers}
          aviso={setAvisoLocal}
          onLeadsAtualizado={carregar}
        />
      )}
    </div>
  );
}

// ── Modelo de Verificação ────────────────────────────────────────────────────

function VerificacaoCampanha({ campanha }) {
  const { t } = useI18n();
  const tarefasCampanha = (() => {
    try { return JSON.parse(campanha.tarefas || "[]"); } catch { return []; }
  })();
  const modelosSalvos = (() => {
    try { return JSON.parse(campanha.modelosVerificacao || "{}"); } catch { return {}; }
  })();
  const evidenciasCampanha = (() => {
    try { return JSON.parse(campanha.evidencias || "{}"); } catch { return {}; }
  })();

  const [modelos, setModelos] = useState(modelosSalvos);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  const EVIDENCIA_POR_TIPO = {
    agendamento: [t("camp.detail.verif.ev.crmRecord"), t("camp.detail.verif.ev.confirmSent")],
    realizada: [t("camp.detail.verif.ev.recording"), t("camp.detail.verif.ev.leadConfirm")],
    venda: [t("camp.detail.verif.ev.contract"), t("camp.detail.verif.ev.crmRecord")],
    ligacao: [t("camp.detail.verif.ev.audioRecord"), t("camp.detail.verif.ev.callLog")],
    follow: [t("camp.detail.verif.ev.messageSent"), t("camp.detail.verif.ev.leadReply")],
    pap: [t("camp.detail.verif.ev.onSitePhoto"), t("camp.detail.verif.ev.geoConfirm")],
  };

  const salvar = async () => {
    setSalvando(true);
    const r = await apiPatch(`/campaigns/${campanha.id}`, { modelosVerificacao: modelos });
    setSalvando(false);
    setAviso(r?.error ? r.error : t("camp.detail.verif.saved"));
  };

  return (
    <div className="vx-fade">
      <div style={{ marginBottom: 20 }}>
        <div className="vx-eyebrow">{t("camp.detail.verif.eyebrow")}</div>
        <h2 className="vx-disp" style={{ margin: "4px 0" }}>{t("camp.detail.verif.title")}</h2>
        <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>{t("camp.detail.verif.subtitle")}</p>
      </div>

      {aviso && <div className="vx-notice" style={{ marginBottom: 14 }}>{aviso}</div>}

      {tarefasCampanha.length === 0
        ? <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
            <p className="vx-mut">{t("camp.detail.verif.noTasks")}</p>
            <p className="vx-mut" style={{ fontSize: 12, marginTop: 6 }}>{t("camp.detail.verif.noTasksHint")}</p>
          </div>
        : <>
            <div style={{ display: "grid", gap: 14 }}>
              {tarefasCampanha.map((tarefa) => {
                const tipo = tarefa.tipo || tarefa.acao;
                const evidencias = evidenciasCampanha[tipo] || EVIDENCIA_POR_TIPO[tipo] || [];
                const modeloAtual = modelos[tipo] || "manual";
                return (
                  <div key={tipo} className="vx-card" style={{ padding: 18 }}>
                    <div className="vx-row" style={{ marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
                      <div>
                        <b style={{ fontSize: 15 }}>{ACOES[tipo]?.nome || tipo}</b>
                        <div className="vx-mut" style={{ fontSize: 12, marginTop: 2 }}>
                          {t("camp.detail.verif.valuePerExec", { amount: money(tarefa.valor || 0) })}
                        </div>
                      </div>
                      <span className="vx-chip">{(() => { const mv = MODELOS_VERIFICACAO_KEYS.find((m) => m.value === modeloAtual); return mv ? t(mv.labelKey) : modeloAtual; })()}</span>
                    </div>

                    <div className="vx-label" style={{ marginBottom: 6 }}>{t("camp.detail.verif.model")}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                      {MODELOS_VERIFICACAO_KEYS.map((m) => (
                        <label key={m.value} style={{ display: "flex", alignItems: "flex-start", gap: 6, cursor: "pointer", fontSize: 13 }}>
                          <input
                            type="radio"
                            name={`verificacao-${tipo}`}
                            value={m.value}
                            checked={modeloAtual === m.value}
                            onChange={() => setModelos((prev) => ({ ...prev, [tipo]: m.value }))}
                            style={{ marginTop: 2 }}
                          />
                          <span>
                            <b>{t(m.labelKey)}</b>
                            <div className="vx-mut" style={{ fontSize: 11 }}>{t(m.descKey)}</div>
                          </span>
                        </label>
                      ))}
                    </div>

                    {evidencias.length > 0 && (
                      <div>
                        <div className="vx-label" style={{ marginBottom: 6 }}>{t("camp.detail.verif.evidenceRequired")}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {evidencias.map((ev) => (
                            <span key={ev} className="vx-chip" style={{ fontSize: 11 }}>
                              <CheckCircle2 size={10} style={{ marginRight: 3 }} />{ev}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button className="vx-btn vx-btn-primary" style={{ marginTop: 16 }} disabled={salvando} onClick={salvar}>
              {salvando ? t("common.saving") : t("camp.detail.verif.saveBtn")}
            </button>
          </>}
    </div>
  );
}

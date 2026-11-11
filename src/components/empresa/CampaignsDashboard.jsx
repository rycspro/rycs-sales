import { useEffect, useMemo, useState } from "react";
import {
  Activity, BriefcaseBusiness, CalendarCheck, CircleDollarSign, Plus,
  Sparkles, Target, TrendingUp, UsersRound, WalletCards,
} from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { FILTROS_STATUS_CAMPANHA, filtrarCampanhasPorStatus, STATUS_CAMPANHA_UI } from "../../../shared/campaignOperations.js";
import { useI18n } from "../../lib/i18n.jsx";

const INDICADORES_KEYS = [
  ["campanhasEmAndamento", "camp.dash.activeCampaigns", BriefcaseBusiness, "camp.dash.periodNow", false],
  ["profissionaisAtivos", "camp.dash.activePros", UsersRound, "camp.dash.periodNow", false],
  ["investidoHoje", "camp.dash.investedToday", CircleDollarSign, "camp.dash.periodToday", true],
  ["investidoMes", "camp.dash.investedMonth", WalletCards, "camp.dash.periodMonth", true],
  ["tarefasHoje", "camp.dash.tasksToday", Activity, "camp.dash.periodToday", false],
  ["leadsGerados", "camp.dash.leadsGenerated", Target, "camp.dash.periodMonth", false],
  ["reunioesAgendadas", "camp.dash.meetingsScheduled", CalendarCheck, "camp.dash.periodMonth", false],
  ["vendas", "camp.dash.sales", TrendingUp, "camp.dash.periodMonth", false],
];

function Tendencia({ valor }) {
  const { t } = useI18n();
  if (valor == null) return <span className="vx-campaign-stat-period">{t("camp.dash.noComparison")}</span>;
  const positiva = valor >= 0;
  return <span className={`vx-campaign-trend ${positiva ? "is-positive" : "is-negative"}`}>
    {positiva ? "↑" : "↓"} {Math.abs(valor).toLocaleString("pt-BR")}%
  </span>;
}

function Skeleton() {
  return <div className="vx-campaign-stats">{Array.from({ length: 8 }, (_, i) =>
    <div key={i} className="vx-stat vx-skeleton" style={{ minHeight: 132 }} />)}</div>;
}

function Risco({ risco }) {
  const { t } = useI18n();
  const textos = {
    dentro: [t("camp.dash.riskOk"), "is-ok"],
    atencao: [t("camp.dash.riskWarning"), "is-warning"],
    critico: [t("camp.dash.riskCritical"), "is-danger"],
    sem_historico: [t("camp.dash.riskNoHistory"), "is-muted"],
  };
  const [texto, classe] = textos[risco] || textos.sem_historico;
  return <span className={`vx-budget-risk ${classe}`}><i />{texto}</span>;
}

function CampaignCard({ campanha, onAbrir }) {
  const { t } = useI18n();
  const hoje = campanha.operacaoHoje || {};
  const budget = campanha.orcamentoResumo || {};
  const percentual = Math.min(100, Math.max(0, Number(budget.percentual) || 0));
  return <article className="vx-card vx-campaign-card">
    <div className="vx-campaign-card-head">
      <div>
        <h3 className="vx-disp">{campanha.titulo}</h3>
        <div className="vx-campaign-card-meta">{campanha.funcao ? campanha.funcao.toUpperCase() : t("camp.dash.roleUndefined")}{campanha.regiao ? ` • ${campanha.regiao}` : ""}</div>
      </div>
      <span className={`vx-campaign-status is-${campanha.status}`}>{STATUS_CAMPANHA_UI[campanha.status] || campanha.status}</span>
    </div>
    <div className="vx-campaign-people"><UsersRound size={14} /><b>{Number(hoje.profissionais || 0).toLocaleString("pt-BR")}</b> {t("camp.dash.activeProsLabel")}</div>
    <div className="vx-campaign-today">
      <div className="vx-eyebrow">{t("camp.dash.today")}</div>
      <div className="vx-campaign-metrics">
        <div><b className="vx-mono">{money(hoje.gasto)}</b><span>{t("camp.dash.spent")}</span></div>
        <div><b className="vx-mono">{Number(hoje.tarefas || 0).toLocaleString("pt-BR")}</b><span>{t("camp.dash.tasks")}</span></div>
        <div><b className="vx-mono">{Number(hoje.leads || 0).toLocaleString("pt-BR")}</b><span>{t("camp.dash.leads")}</span></div>
        <div><b className="vx-mono">{Number(hoje.reunioes || 0).toLocaleString("pt-BR")}</b><span>{t("camp.dash.meetings")}</span></div>
        <div><b className="vx-mono">{Number(hoje.vendas || 0).toLocaleString("pt-BR")}</b><span>{t("camp.dash.salesLabel")}</span></div>
      </div>
    </div>
    <div className="vx-campaign-budget-mini">
      <div className="vx-row"><span>{t("camp.dash.budget")}</span><b className="vx-mono">{money(budget.consumido)} / {money(budget.limite)}</b></div>
      <div className="vx-meter-track"><div className="vx-meter-fill" style={{ width: `${percentual}%`, background: percentual >= 90 ? "var(--red)" : percentual >= 70 ? "var(--amber)" : "var(--brand)" }} /></div>
      <span>{budget.percentual == null ? t("camp.dash.noBudget") : t("camp.dash.consumed", { pct: budget.percentual.toLocaleString("pt-BR") })}</span>
    </div>
    <button className="vx-btn vx-btn-block vx-campaign-operation-btn" onClick={() => onAbrir(campanha)}>{t("camp.dash.viewOperation")} <span>→</span></button>
  </article>;
}

export default function CampaignsDashboard({ campanhas, onCriar, onCriarIA, onAbrir, recarregarSinal = 0, somenteMetricas = false }) {
  const { t } = useI18n();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("todas");

  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, []);

  useEffect(() => {
    let ativo = true;
    setErro("");
    api("/campaigns-overview").then((r) => {
      if (!ativo) return;
      if (!r || r.error) setErro(r?.error || "Não foi possível carregar os indicadores.");
      else setDados(r);
    });
    return () => { ativo = false; };
  }, [recarregarSinal]);

  const orcamento = dados?.orcamento;
  const percentualVisual = Math.min(100, Math.max(0, Number(orcamento?.percentual) || 0));
  const campanhasComDados = useMemo(() => {
    if (!dados?.campanhas) return campanhas;
    return dados.campanhas.map((resumo) => ({ ...(campanhas.find((c) => c.id === resumo.id) || {}), ...resumo }));
  }, [campanhas, dados]);
  const campanhasFiltradas = useMemo(() => filtrarCampanhasPorStatus(campanhasComDados, filtro), [campanhasComDados, filtro]);

  return <div className="vx-fade">
    <div className="vx-page-head vx-campaign-head">
      <div>
        <div className="vx-eyebrow">{t("camp.dash.eyebrow")}</div>
        <h1 className="vx-disp">{t("nav.campaigns")}</h1>
        <p><b>{t("camp.dash.heroTitle")}</b><br />{t("camp.dash.heroDesc")}</p>
      </div>
      {!somenteMetricas && (
        <div className="vx-campaign-actions">
          <button className="vx-btn vx-btn-primary vx-btn-ai-hero" onClick={onCriarIA}><Sparkles size={15} /> {t("camp.createWithAI")}</button>
          <button className="vx-btn vx-btn-ghost" onClick={onCriar}><Plus size={15} /> {t("camp.createManual")}</button>
        </div>
      )}
    </div>

    {erro && <div className="vx-notice vx-notice-amber" style={{ marginBottom: 14 }}>{erro}</div>}
    {!dados && !erro ? <Skeleton /> : dados && <>
      <div className="vx-campaign-stats">
        {INDICADORES_KEYS.map(([chave, tituloKey, Icone, periodoKey, monetario]) => {
          const item = dados.indicadores[chave];
          return <article className="vx-stat vx-campaign-stat" key={chave}>
            <div className="vx-campaign-stat-top"><span>{t(tituloKey)}</span><Icone size={17} /></div>
            <strong className="vx-stat-val vx-mono">{monetario ? money(item.valor) : Number(item.valor).toLocaleString("pt-BR")}</strong>
            <div className="vx-campaign-stat-foot"><Tendencia valor={item.variacao} /><span>{t(periodoKey)}</span></div>
          </article>;
        })}
      </div>

      <section className="vx-card vx-budget-card">
        <div className="vx-budget-main">
          <div className="vx-eyebrow">{t("camp.dash.monthlyBudget")}</div>
          <div className="vx-budget-value"><strong className="vx-mono">{money(orcamento.consumido)}</strong><span> / {money(orcamento.limite)}</span></div>
          <div className="vx-meter-track"><div className="vx-meter-fill" style={{ width: `${percentualVisual}%`, background: orcamento.risco === "critico" ? "var(--red)" : orcamento.risco === "atencao" ? "var(--amber)" : "var(--brand)" }} /></div>
          <div className="vx-budget-progress"><span>{orcamento.percentual == null ? t("camp.dash.noActiveLimit") : t("camp.dash.consumed", { pct: orcamento.percentual.toLocaleString("pt-BR") })}</span><Risco risco={orcamento.risco} /></div>
        </div>
        <div className="vx-budget-facts">
          <div><span>{t("camp.dash.availableBalance")}</span><b className="vx-mono">{money(orcamento.saldoDisponivel)}</b></div>
          <div><span>{t("camp.dash.reservedTasks")}</span><b className="vx-mono">{money(orcamento.reservado)}</b></div>
          <div><span>{t("camp.dash.avgDailySpend")}</span><b className="vx-mono">{money(orcamento.gastoMedioDiario)}</b></div>
          <div><span>{t("camp.dash.closingProjection")}</span><b className="vx-mono">{money(orcamento.projecaoFechamento)}</b></div>
          <div><span>{t("camp.dash.estimatedDuration")}</span><b className="vx-mono">{orcamento.diasRestantes == null ? t("camp.dash.noConsumption") : t("camp.dash.daysLeft", { n: orcamento.diasRestantes.toLocaleString("pt-BR") })}</b></div>
        </div>
        <div className="vx-chart-source">{t("camp.dash.budgetSource", { source: dados.origem.investimento })}</div>
      </section>
    </>}

    {!somenteMetricas && <section style={{ marginTop: 22 }}>
      <div className="vx-row" style={{ alignItems: "end", marginBottom: 11 }}>
        <div><div className="vx-eyebrow">{t("camp.dash.operations")}</div><h2 className="vx-disp" style={{ margin: "3px 0 0", fontSize: 19 }}>{t("camp.dash.yourCampaigns")}</h2></div>
      </div>
      {campanhas.length > 0 && dados && <>
        <div className="vx-campaign-filters" role="tablist" aria-label={t("camp.dash.filterByStatus")}>
          {FILTROS_STATUS_CAMPANHA.map((item) => <button key={item.chave} role="tab" aria-selected={filtro === item.chave} data-on={filtro === item.chave ? "1" : "0"} onClick={() => setFiltro(item.chave)}>
            {item.label}<span>{dados.status[item.chave] || 0}</span>
          </button>)}
        </div>
        {filtro === "todas" && dados.status.em_andamento === 0 && <div className="vx-notice vx-notice-amber" style={{ margin: "12px 0" }}><b>{t("camp.dash.noneRunning")}</b> {t("camp.dash.noneRunningHint")}</div>}
      </>}
      {campanhas.length === 0 ? <div className="vx-card vx-campaign-empty">
        <div className="vx-campaign-empty-icon"><BriefcaseBusiness size={24} /></div>
        <h2 className="vx-disp">{t("camp.dash.emptyTitle")}</h2>
        <p>{t("camp.dash.emptyDesc")}</p>
        <div className="vx-campaign-actions"><button className="vx-btn vx-btn-primary vx-btn-ai-hero" onClick={onCriarIA}><Sparkles size={14} /> {t("camp.createWithAI")}</button><button className="vx-btn vx-btn-ghost" onClick={onCriar}><Plus size={14} /> {t("camp.createManual")}</button></div>
      </div> : campanhasFiltradas.length === 0 ? <div className="vx-card vx-campaign-filter-empty">{t("camp.dash.noFilterResults")}</div> : <div className="vx-campaign-card-grid">
        {campanhasFiltradas.map((campanha) => <CampaignCard key={campanha.id} campanha={campanha} onAbrir={onAbrir} />)}
      </div>}
    </section>}
  </div>;
}

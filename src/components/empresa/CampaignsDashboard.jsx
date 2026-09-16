import { useEffect, useMemo, useState } from "react";
import {
  Activity, BriefcaseBusiness, CalendarCheck, CircleDollarSign, Plus,
  Sparkles, Target, TrendingUp, UsersRound, WalletCards,
} from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { FILTROS_STATUS_CAMPANHA, filtrarCampanhasPorStatus, STATUS_CAMPANHA_UI } from "../../../shared/campaignOperations.js";

const INDICADORES = [
  ["campanhasEmAndamento", "Campanhas em andamento", BriefcaseBusiness, "agora", false],
  ["profissionaisAtivos", "Profissionais ativos", UsersRound, "agora", false],
  ["investidoHoje", "Investido hoje", CircleDollarSign, "hoje", true],
  ["investidoMes", "Investido no mês", WalletCards, "mês atual", true],
  ["tarefasHoje", "Tarefas realizadas hoje", Activity, "hoje", false],
  ["leadsGerados", "Leads gerados", Target, "mês atual", false],
  ["reunioesAgendadas", "Reuniões agendadas", CalendarCheck, "mês atual", false],
  ["vendas", "Vendas", TrendingUp, "mês atual", false],
];

function Tendencia({ valor }) {
  if (valor == null) return <span className="vx-campaign-stat-period">sem histórico comparável</span>;
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
  const textos = {
    dentro: ["Dentro do previsto", "is-ok"],
    atencao: ["Atenção ao orçamento", "is-warning"],
    critico: ["Orçamento pode acabar antes do prazo", "is-danger"],
    sem_historico: ["Aguardando histórico de consumo", "is-muted"],
  };
  const [texto, classe] = textos[risco] || textos.sem_historico;
  return <span className={`vx-budget-risk ${classe}`}><i />{texto}</span>;
}

function CampaignCard({ campanha, onAbrir }) {
  const hoje = campanha.operacaoHoje || {};
  const budget = campanha.orcamentoResumo || {};
  const percentual = Math.min(100, Math.max(0, Number(budget.percentual) || 0));
  return <article className="vx-card vx-campaign-card">
    <div className="vx-campaign-card-head">
      <div>
        <h3 className="vx-disp">{campanha.titulo}</h3>
        <div className="vx-campaign-card-meta">{campanha.funcao ? campanha.funcao.toUpperCase() : "Função não definida"}{campanha.regiao ? ` • ${campanha.regiao}` : ""}</div>
      </div>
      <span className={`vx-campaign-status is-${campanha.status}`}>{STATUS_CAMPANHA_UI[campanha.status] || campanha.status}</span>
    </div>
    <div className="vx-campaign-people"><UsersRound size={14} /><b>{Number(hoje.profissionais || 0).toLocaleString("pt-BR")}</b> profissionais ativos</div>
    <div className="vx-campaign-today">
      <div className="vx-eyebrow">Hoje</div>
      <div className="vx-campaign-metrics">
        <div><b className="vx-mono">{money(hoje.gasto)}</b><span>gastos</span></div>
        <div><b className="vx-mono">{Number(hoje.tarefas || 0).toLocaleString("pt-BR")}</b><span>tarefas</span></div>
        <div><b className="vx-mono">{Number(hoje.leads || 0).toLocaleString("pt-BR")}</b><span>leads</span></div>
        <div><b className="vx-mono">{Number(hoje.reunioes || 0).toLocaleString("pt-BR")}</b><span>reuniões</span></div>
        <div><b className="vx-mono">{Number(hoje.vendas || 0).toLocaleString("pt-BR")}</b><span>vendas</span></div>
      </div>
    </div>
    <div className="vx-campaign-budget-mini">
      <div className="vx-row"><span>Orçamento</span><b className="vx-mono">{money(budget.consumido)} / {money(budget.limite)}</b></div>
      <div className="vx-meter-track"><div className="vx-meter-fill" style={{ width: `${percentual}%`, background: percentual >= 90 ? "var(--red)" : percentual >= 70 ? "var(--amber)" : "var(--brand)" }} /></div>
      <span>{budget.percentual == null ? "Sem orçamento definido" : `${budget.percentual.toLocaleString("pt-BR")}% consumido`}</span>
    </div>
    <button className="vx-btn vx-btn-block vx-campaign-operation-btn" onClick={() => onAbrir(campanha)}>Ver operação <span>→</span></button>
  </article>;
}

export default function CampaignsDashboard({ campanhas, onCriar, onCriarIA, onAbrir, recarregarSinal = 0 }) {
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
        <div className="vx-eyebrow">Central de operações comerciais</div>
        <h1 className="vx-disp">Campanhas</h1>
        <p><b>Sua operação comercial em um só lugar.</b><br />Acompanhe profissionais, investimento e resultados das suas campanhas em tempo real.</p>
      </div>
      <div className="vx-campaign-actions">
        <button className="vx-btn vx-btn-ai" onClick={onCriarIA}><Sparkles size={15} /> Criar com IA</button>
        <button className="vx-btn vx-btn-primary" onClick={onCriar}><Plus size={15} /> Nova campanha</button>
      </div>
    </div>

    {erro && <div className="vx-notice vx-notice-amber" style={{ marginBottom: 14 }}>{erro}</div>}
    {!dados && !erro ? <Skeleton /> : dados && <>
      <div className="vx-campaign-stats">
        {INDICADORES.map(([chave, titulo, Icone, periodo, monetario]) => {
          const item = dados.indicadores[chave];
          return <article className="vx-stat vx-campaign-stat" key={chave}>
            <div className="vx-campaign-stat-top"><span>{titulo}</span><Icone size={17} /></div>
            <strong className="vx-stat-val vx-mono">{monetario ? money(item.valor) : Number(item.valor).toLocaleString("pt-BR")}</strong>
            <div className="vx-campaign-stat-foot"><Tendencia valor={item.variacao} /><span>{periodo}</span></div>
          </article>;
        })}
      </div>

      <section className="vx-card vx-budget-card">
        <div className="vx-budget-main">
          <div className="vx-eyebrow">Orçamento mensal</div>
          <div className="vx-budget-value"><strong className="vx-mono">{money(orcamento.consumido)}</strong><span> / {money(orcamento.limite)}</span></div>
          <div className="vx-meter-track"><div className="vx-meter-fill" style={{ width: `${percentualVisual}%`, background: orcamento.risco === "critico" ? "var(--red)" : orcamento.risco === "atencao" ? "var(--amber)" : "var(--brand)" }} /></div>
          <div className="vx-budget-progress"><span>{orcamento.percentual == null ? "Sem limite ativo" : `${orcamento.percentual.toLocaleString("pt-BR")}% consumido`}</span><Risco risco={orcamento.risco} /></div>
        </div>
        <div className="vx-budget-facts">
          <div><span>Saldo disponível</span><b className="vx-mono">{money(orcamento.saldoDisponivel)}</b></div>
          <div><span>Reservado em tarefas</span><b className="vx-mono">{money(orcamento.reservado)}</b></div>
          <div><span>Gasto médio diário</span><b className="vx-mono">{money(orcamento.gastoMedioDiario)}</b></div>
          <div><span>Projeção de fechamento</span><b className="vx-mono">{money(orcamento.projecaoFechamento)}</b></div>
          <div><span>Estimativa de duração</span><b className="vx-mono">{orcamento.diasRestantes == null ? "Sem consumo" : `${orcamento.diasRestantes.toLocaleString("pt-BR")} dias`}</b></div>
        </div>
        <div className="vx-chart-source">Origem: {dados.origem.investimento}. Projeção baseada somente no consumo real do mês.</div>
      </section>
    </>}

    <section style={{ marginTop: 22 }}>
      <div className="vx-row" style={{ alignItems: "end", marginBottom: 11 }}>
        <div><div className="vx-eyebrow">Operações</div><h2 className="vx-disp" style={{ margin: "3px 0 0", fontSize: 19 }}>Suas campanhas</h2></div>
      </div>
      {campanhas.length > 0 && dados && <>
        <div className="vx-campaign-filters" role="tablist" aria-label="Filtrar campanhas por status">
          {FILTROS_STATUS_CAMPANHA.map((item) => <button key={item.chave} role="tab" aria-selected={filtro === item.chave} data-on={filtro === item.chave ? "1" : "0"} onClick={() => setFiltro(item.chave)}>
            {item.label}<span>{dados.status[item.chave] || 0}</span>
          </button>)}
        </div>
        {filtro === "todas" && dados.status.em_andamento === 0 && <div className="vx-notice vx-notice-amber" style={{ margin: "12px 0" }}><b>Nenhuma campanha em andamento.</b> Ative uma campanha ou crie uma nova operação.</div>}
      </>}
      {campanhas.length === 0 ? <div className="vx-card vx-campaign-empty">
        <div className="vx-campaign-empty-icon"><BriefcaseBusiness size={24} /></div>
        <h2 className="vx-disp">Coloque sua força comercial para trabalhar.</h2>
        <p>Crie sua primeira campanha e encontre profissionais para executar sua operação comercial.</p>
        <div className="vx-campaign-actions"><button className="vx-btn vx-btn-primary" onClick={onCriar}>Criar campanha</button><button className="vx-btn vx-btn-ai" onClick={onCriarIA}><Sparkles size={14} /> Criar com IA</button></div>
      </div> : campanhasFiltradas.length === 0 ? <div className="vx-card vx-campaign-filter-empty">Nenhuma campanha neste status.</div> : <div className="vx-campaign-card-grid">
        {campanhasFiltradas.map((campanha) => <CampaignCard key={campanha.id} campanha={campanha} onAbrir={onAbrir} />)}
      </div>}
    </section>
  </div>;
}

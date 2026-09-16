import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, BarChart3, BriefcaseBusiness, CalendarCheck, CircleDollarSign,
  CirclePause, Ellipsis, ListChecks, Pencil, Settings, Target, TrendingUp,
  UsersRound, WalletCards,
} from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { STATUS_CAMPANHA_UI } from "../../../shared/campaignOperations.js";

const ABAS = [
  ["geral", "Visão Geral"], ["profissionais", "Profissionais"], ["tarefas", "Tarefas"],
  ["leads", "Leads"], ["reunioes", "Reuniões"], ["performance", "Performance"],
  ["financeiro", "Financeiro"], ["configuracoes", "Configurações"],
];
const PERIODOS = [["hoje", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"]];

function Variacao({ valor }) {
  if (valor == null) return <span className="vx-mut">sem comparação</span>;
  return <span className={valor >= 0 ? "vx-positive" : "vx-negative"}>{valor >= 0 ? "↑" : "↓"} {Math.abs(valor).toLocaleString("pt-BR")}%</span>;
}

function Empty({ texto }) {
  return <div className="vx-campaign-inline-empty">{texto}</div>;
}

export default function CampaignDetail({ campanha, db, onVoltar, onEditar, onStatus }) {
  const [aba, setAba] = useState("geral");
  const [periodo, setPeriodo] = useState("7d");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [menu, setMenu] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, []);

  useEffect(() => {
    let ativo = true;
    setErro("");
    setDados(null);
    api(`/campaigns/${campanha.id}/operations?periodo=${periodo}`).then((r) => {
      if (!ativo) return;
      if (!r || r.error) setErro(r?.error || "Não foi possível carregar a operação.");
      else setDados(r);
    });
    return () => { ativo = false; };
  }, [campanha.id, periodo, recarregar]);

  const tarefas = useMemo(() => (db.submissions || []).filter((s) => s.campaignId === campanha.id), [db.submissions, campanha.id]);
  const leads = useMemo(() => (db.leads || []).filter((l) => l.campaignId === campanha.id), [db.leads, campanha.id]);
  const candidaturas = campanha.candidaturas || [];
  const profissionais = useMemo(() => candidaturas.filter((a) => a.status === "aprovado").map((a) => ({
    ...a,
    profissional: (db.sellers || []).find((s) => s.id === a.sellerId),
    tarefas: tarefas.filter((s) => s.sellerId === a.sellerId),
  })), [candidaturas, db.sellers, tarefas]);
  const reunioes = tarefas.filter((s) => ["agendamento", "realizada"].includes(s.tipo));

  const alterarStatus = async (status) => {
    setMenu(false);
    await onStatus(status);
    setRecarregar((n) => n + 1);
  };

  return <div className="vx-fade">
    <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ paddingLeft: 0, marginBottom: 10 }} onClick={onVoltar}><ArrowLeft size={14} /> Central de campanhas</button>
    <div className="vx-campaign-detail-head">
      <div>
        <div className="vx-row" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <h1 className="vx-disp">{campanha.titulo}</h1>
          <span className={`vx-campaign-status is-${campanha.status}`}>{STATUS_CAMPANHA_UI[campanha.status] || campanha.status}</span>
        </div>
        <p>{campanha.descricao || campanha.objetivo || "Operação comercial RYCS"}</p>
        <div className="vx-campaign-detail-meta">
          <span><BriefcaseBusiness size={13} /> {campanha.funcao ? campanha.funcao.toUpperCase() : "Função não definida"}</span>
          {campanha.regiao && <span><Target size={13} /> {campanha.regiao}</span>}
          <span><UsersRound size={13} /> {dados?.campanha?.profissionaisAtivos ?? profissionais.length} profissionais ativos</span>
        </div>
      </div>
      <div className="vx-campaign-detail-actions">
        {campanha.status === "ativa" && <button className="vx-btn" onClick={() => alterarStatus("pausada")}><CirclePause size={14} /> Pausar</button>}
        <button className="vx-btn" onClick={onEditar}><Pencil size={14} /> Editar</button>
        <div className="vx-context-wrap"><button className="vx-btn" aria-label="Mais ações" onClick={() => setMenu((v) => !v)}><Ellipsis size={16} /></button>{menu && <div className="vx-context-menu">
          {campanha.status === "pausada" && <button onClick={() => alterarStatus("ativa")}>Retomar campanha</button>}
          {!['encerrada'].includes(campanha.status) && <button className="is-danger" onClick={() => alterarStatus("encerrada")}>Encerrar campanha</button>}
        </div>}</div>
      </div>
    </div>

    <div className="vx-campaign-inner-tabs" role="tablist">
      {ABAS.map(([chave, label]) => <button key={chave} role="tab" aria-selected={aba === chave} data-on={aba === chave ? "1" : "0"} onClick={() => setAba(chave)}>{label}</button>)}
    </div>

    {["geral", "performance", "financeiro"].includes(aba) && <div className="vx-campaign-periods">
      {PERIODOS.map(([chave, label]) => <button key={chave} data-on={periodo === chave ? "1" : "0"} onClick={() => setPeriodo(chave)}>{label}</button>)}
      <button disabled title="O intervalo personalizado será habilitado no filtro avançado.">Personalizado</button>
    </div>}

    {erro && <div className="vx-notice vx-notice-amber">{erro}</div>}
    {!dados && !erro && <div className="vx-campaign-detail-loading"><div className="vx-stat vx-skeleton" /><div className="vx-stat vx-skeleton" /><div className="vx-stat vx-skeleton" /></div>}

    {dados && aba === "geral" && <>
      <div className="vx-campaign-overview-stats">
        {[
          ["investimento", "Investimento", CircleDollarSign, true], ["tarefas", "Tarefas", ListChecks, false],
          ["leads", "Leads", Target, false], ["reunioes", "Reuniões", CalendarCheck, false], ["vendas", "Vendas", TrendingUp, false],
        ].map(([chave, label, Icone, monetario]) => <article className="vx-stat" key={chave}>
          <div className="vx-campaign-stat-top"><span>{label}</span><Icone size={16} /></div>
          <strong className="vx-stat-val vx-mono">{monetario ? money(dados.metricas[chave].valor) : dados.metricas[chave].valor.toLocaleString("pt-BR")}</strong>
          <Variacao valor={dados.metricas[chave].variacao} />
        </article>)}
      </div>

      <div className="vx-campaign-detail-grid">
        <section className="vx-card vx-funnel-card">
          <div className="vx-row"><div><div className="vx-eyebrow">Funil comercial</div><h2 className="vx-disp">Conversão da operação</h2></div><span className="vx-chip">{dados.periodo.label}</span></div>
          <div className="vx-funnel">
            {dados.funil.map((etapa, i) => <div className="vx-funnel-step" key={etapa.chave}>
              <div><b className="vx-mono">{etapa.valor.toLocaleString("pt-BR")}</b><span>{etapa.label}</span></div>
              {i > 0 && <small>{etapa.taxa == null ? "sem base" : `${etapa.taxa.toLocaleString("pt-BR")}%`}</small>}
            </div>)}
          </div>
          <div className="vx-chart-source">Resultados contam somente execuções liberadas. Leads vêm dos registros vinculados à campanha.</div>
        </section>
        <section className="vx-card vx-cost-card">
          <div className="vx-eyebrow">Custo por resultado</div><h2 className="vx-disp">Eficiência</h2>
          {[["lead", "Custo por lead"], ["reuniao", "Custo por reunião"], ["venda", "Custo por venda"]].map(([chave, label]) => <div className="vx-cost-row" key={chave}><span>{label}</span><b className="vx-mono">{dados.custos[chave] == null ? "Sem resultado" : money(dados.custos[chave])}</b></div>)}
          <div className="vx-chart-source">Base: {dados.origem.investimento}.</div>
        </section>
      </div>
    </>}

    {dados && aba === "profissionais" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">Equipe ativa</h2><p>{profissionais.length} profissionais aprovados nesta campanha.</p>{profissionais.length === 0 ? <Empty texto="Nenhum profissional aprovado nesta campanha." /> : <div className="vx-compact-list">{profissionais.map((item) => <div key={item.id}><div><b>{item.profissional?.nome || "Profissional"}</b><span>{item.profissional?.titulo || item.profissional?.perfil || campanha.funcao}</span></div><strong className="vx-mono">{item.tarefas.length} tarefas</strong></div>)}</div>}</section>}
    {dados && aba === "tarefas" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">Tarefas da campanha</h2><p>Execuções mais recentes, com o status real de auditoria.</p>{tarefas.length === 0 ? <Empty texto="Nenhuma tarefa executada nesta campanha." /> : <div className="vx-compact-list">{tarefas.slice(0, 20).map((item) => <div key={item.id}><div><b>{item.tipo}</b><span>{new Date(item.criadoEm).toLocaleString("pt-BR")}</span></div><span className="vx-chip">{item.status}</span></div>)}</div>}</section>}
    {dados && aba === "leads" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">Leads da campanha</h2><p>Registros vinculados exclusivamente a esta operação.</p>{leads.length === 0 ? <Empty texto="Nenhum lead gerado nesta campanha." /> : <div className="vx-compact-list">{leads.slice(0, 20).map((item) => <div key={item.id}><div><b>{item.nome}</b><span>{item.empresa || "Empresa não informada"}</span></div><span className="vx-chip">{item.etapa}</span></div>)}</div>}</section>}
    {dados && aba === "reunioes" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">Reuniões</h2><p>Agendamentos e reuniões realizadas vinculados à campanha.</p>{reunioes.length === 0 ? <Empty texto="Nenhuma reunião registrada nesta campanha." /> : <div className="vx-compact-list">{reunioes.slice(0, 20).map((item) => <div key={item.id}><div><b>{item.tipo === "realizada" ? "Reunião realizada" : "Reunião agendada"}</b><span>{new Date(item.criadoEm).toLocaleString("pt-BR")}</span></div><span className="vx-chip">{item.status}</span></div>)}</div>}</section>}
    {dados && aba === "performance" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">Resultados ao longo do tempo</h2><p>Produção diária em {dados.periodo.label.toLowerCase()}.</p>{dados.serie.every((d) => !d.tarefas && !d.leads && !d.reunioes && !d.vendas) ? <Empty texto="Ainda não há atividade suficiente para o gráfico." /> : <div className="vx-performance-list">{dados.serie.map((dia) => <div key={dia.data}><span>{dia.data.slice(5).split("-").reverse().join("/")}</span><i style={{ width: `${Math.min(100, dia.tarefas * 5)}%` }} /><b>{dia.tarefas}</b></div>)}</div>}</section>}
    {dados && aba === "financeiro" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">Financeiro da campanha</h2><p>Consumo no período selecionado e limite configurado.</p><div className="vx-grid vx-g3"><div className="vx-scenario"><span>Investido no período</span><strong className="vx-mono">{money(dados.metricas.investimento.valor)}</strong></div><div className="vx-scenario"><span>Orçamento</span><strong className="vx-mono">{money(campanha.orcamento)}</strong></div><div className="vx-scenario"><span>Reservado</span><strong className="vx-mono">{money(campanha.reservado)}</strong></div></div></section>}
    {dados && aba === "configuracoes" && <section className="vx-card vx-detail-section"><Settings size={22} color="var(--brand)" /><h2 className="vx-disp">Configurações da campanha</h2><p>Objetivo, público, região, valores, evidências, treinamento e regras de publicação continuam no editor completo.</p><button className="vx-btn vx-btn-primary" onClick={onEditar}><Pencil size={14} /> Editar configuração</button></section>}
  </div>;
}

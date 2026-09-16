import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Award, BriefcaseBusiness, CalendarCheck, CheckCircle2, CircleDollarSign,
  CirclePause, Clock3, Ellipsis, ListChecks, Pencil, RefreshCw, Settings, Target,
  TrendingUp, UsersRound, X,
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
const FILTROS_PROFISSIONAIS = [
  ["todos", "Todos"], ["online", "Ativos agora"], ["alta", "Alta performance"],
  ["sem_atividade", "Sem atividade"], ["pendente", "Pendentes"],
];
const EVENTOS_LABEL = {
  CAMPAIGN_CREATED: "Campanha criada", CAMPAIGN_PUBLISHED: "Campanha publicada",
  CAMPAIGN_PAUSED: "Campanha pausada", CAMPAIGN_CLOSED: "Campanha encerrada",
  PROFESSIONAL_APPLIED: "Nova candidatura recebida", PROFESSIONAL_APPROVED: "Profissional aprovado",
  PROFESSIONAL_REJECTED: "Candidatura recusada", PROFESSIONAL_JOINED: "Profissional entrou na campanha",
  TASK_STARTED: "Tarefa iniciada", TASK_COMPLETED: "Tarefa concluída", TASK_APPROVED: "Tarefa aprovada",
  TASK_REJECTED: "Tarefa recusada", LEAD_CREATED: "Novo lead criado", MEETING_SCHEDULED: "Reunião agendada",
  MEETING_COMPLETED: "Reunião realizada", SALE_RECORDED: "Venda registrada",
  EVIDENCE_SUBMITTED: "Evidência enviada", PAYMENT_RELEASED: "Pagamento liberado",
};

function Variacao({ valor }) {
  if (valor == null) return <span className="vx-mut">sem comparação</span>;
  return <span className={valor >= 0 ? "vx-positive" : "vx-negative"}>{valor >= 0 ? "↑" : "↓"} {Math.abs(valor).toLocaleString("pt-BR")}%</span>;
}

function Empty({ texto }) {
  return <div className="vx-campaign-inline-empty">{texto}</div>;
}

function ActivityFeed({ eventos = [], onRefresh }) {
  return <section className="vx-card vx-activity-card">
    <div className="vx-row"><div><div className="vx-eyebrow">Atividade em tempo real</div><h2 className="vx-disp">Acontecendo agora</h2></div><button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onRefresh} title="Atualizar atividade"><RefreshCw size={14} /> Atualizar</button></div>
    {eventos.length === 0 ? <Empty texto="A atividade aparecerá aqui assim que a operação começar." /> : <div className="vx-activity-list">
      {eventos.slice(0, 12).map((evento) => <div key={evento.id}>
        <time className="vx-mono">{new Date(evento.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
        <i className={`is-${evento.tipo.toLowerCase()}`} />
        <div><b>{evento.sellerNome ? `${evento.sellerNome} — ` : ""}{EVENTOS_LABEL[evento.tipo] || evento.tipo}</b><span>{evento.source === "BACKFILL" ? "Histórico existente" : new Date(evento.criadoEm).toLocaleDateString("pt-BR")}</span></div>
      </div>)}
    </div>}
    <div className="vx-chart-source">Atualização sob demanda e pelo ciclo seguro da aplicação; sem polling agressivo.</div>
  </section>;
}

function ProfessionalProfile({ item, tarefas, leads, onClose }) {
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
      <div className="vx-row"><div><div className="vx-eyebrow">Perfil na campanha</div><h2 className="vx-disp">{item.nome || "Profissional"}</h2></div><button className="vx-btn vx-btn-ghost" aria-label="Fechar" onClick={onClose}><X size={18} /></button></div>
      <div className="vx-professional-identity"><div className="vx-avatar">{String(item.nome || "P").split(" ").slice(0, 2).map((n) => n[0]).join("")}</div><div><b>{item.titulo || item.perfil || "Profissional comercial"}</b><span>{item.cidade || "Localização não informada"}</span></div><span className={`vx-campaign-person-status is-${item.statusOperacional}`}>{item.statusOperacional.replace("_", " ")}</span></div>
      <div className="vx-profile-stats">
        {[["Tarefas", tarefasProfissional.length], ["Aprovadas", item.aprovadas], ["Recusadas", item.recusadas], ["Leads", leadsProfissional.length], ["Reuniões", reunioes], ["Realizadas", realizadas], ["Vendas", vendas], ["Ganhos", money(item.ganhos)]].map(([label, total]) => <div key={label}><span>{label}</span><b className="vx-mono">{total}</b></div>)}
      </div>
      <div className="vx-grid vx-g2" style={{ marginTop: 13 }}><div className="vx-scenario"><span>Taxa de aprovação</span><strong>{item.taxaAprovacao == null ? "Sem base" : `${item.taxaAprovacao.toLocaleString("pt-BR")}%`}</strong></div><div className="vx-scenario"><span>Score</span><strong>{item.score || "Sem score"}</strong></div></div>
      <div className="vx-profile-chart"><div className="vx-eyebrow">Performance diária</div>{serie.length === 0 ? <Empty texto="Ainda não há atividade deste profissional na campanha." /> : serie.map(([data, total]) => <div key={data}><span>{data}</span><i><b style={{ width: `${(total / maximo) * 100}%` }} /></i><strong>{total}</strong></div>)}</div>
      <div className="vx-eyebrow" style={{ marginTop: 17 }}>Evidências e histórico recente</div>
      {evidencias.length === 0 ? <Empty texto="Nenhuma evidência enviada nesta campanha." /> : <div className="vx-compact-list">{evidencias.slice(0, 8).map((t) => <div key={t.id}><div><b>{t.tipo}</b><span>{new Date(t.criadoEm).toLocaleString("pt-BR")}</span></div><span className="vx-chip">{t.status}</span></div>)}</div>}
    </div>
  </div>;
}

export default function CampaignDetail({ campanha, db, onVoltar, onEditar, onStatus }) {
  const [aba, setAba] = useState("geral");
  const [periodo, setPeriodo] = useState("7d");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [menu, setMenu] = useState(false);
  const [recarregar, setRecarregar] = useState(0);
  const [filtroProfissional, setFiltroProfissional] = useState("todos");
  const [profissionalAberto, setProfissionalAberto] = useState(null);

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
  const profissionaisLocais = useMemo(() => candidaturas.filter((a) => ["aprovado", "pendente"].includes(a.status)).map((a) => {
    const profissional = (db.sellers || []).find((s) => s.id === a.sellerId) || {};
    const tarefasDoProfissional = tarefas.filter((s) => s.sellerId === a.sellerId);
    return { ...a, ...profissional, candidaturaStatus: a.status, tarefas: tarefasDoProfissional.length, statusOperacional: a.status === "pendente" ? "pendente" : "sem_atividade", ganhos: 0, aprovadas: 0, recusadas: 0, score: Number(profissional.nota) || 0 };
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
          <span><UsersRound size={13} /> {dados?.campanha?.profissionaisAtivos ?? profissionais.filter((p) => p.candidaturaStatus === "aprovado").length} profissionais ativos</span>
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
      <ActivityFeed eventos={dados.eventos} onRefresh={() => setRecarregar((n) => n + 1)} />
    </>}

    {dados && aba === "profissionais" && <section className="vx-card vx-detail-section">
      <div className="vx-row" style={{ alignItems: "end", flexWrap: "wrap" }}><div><h2 className="vx-disp">Equipe ativa</h2><p>{profissionais.filter((p) => p.candidaturaStatus === "aprovado").length} profissionais aprovados nesta campanha.</p></div><span className="vx-chip"><UsersRound size={12} /> {profissionais.length} registros</span></div>
      <div className="vx-professional-filters">{FILTROS_PROFISSIONAIS.map(([chave, label]) => <button key={chave} data-on={filtroProfissional === chave ? "1" : "0"} onClick={() => setFiltroProfissional(chave)}>{label}</button>)}</div>
      {profissionaisFiltrados.length === 0 ? <Empty texto="Nenhum profissional neste filtro." /> : <div className="vx-campaign-team-table">
        <div className="vx-team-head"><span>Profissional</span><span>Função</span><span>Status</span><span>Hoje</span><span>Resultado</span><span>Ganhos</span><span>Score</span><span>Ações</span></div>
        {profissionaisFiltrados.map((item) => <button className="vx-team-row" key={item.applicationId || item.id} onClick={() => setProfissionalAberto(item)}>
          <span className="vx-team-person"><i>{String(item.nome || "P").split(" ").slice(0, 2).map((n) => n[0]).join("")}</i><b>{item.nome || "Profissional"}</b></span>
          <span data-label="Função">{item.titulo || item.perfil || campanha.funcao || "—"}</span>
          <span data-label="Status"><em className={`vx-campaign-person-status is-${item.statusOperacional}`}>{item.statusOperacional.replace("_", " ")}</em></span>
          <span data-label="Hoje" className="vx-mono">{item.tarefasHoje || 0} tarefas</span>
          <span data-label="Resultado" className="vx-mono">{(item.reunioes || 0) + (item.vendas || 0)}</span>
          <span data-label="Ganhos" className="vx-mono">{money(item.ganhos)}</span>
          <span data-label="Score" className="vx-mono">{item.score || "—"}</span>
          <span className="vx-team-action">Ver perfil →</span>
        </button>)}
      </div>}
    </section>}
    {dados && aba === "tarefas" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">Tarefas da campanha</h2><p>Execuções mais recentes, com o status real de auditoria.</p>{tarefas.length === 0 ? <Empty texto="Nenhuma tarefa executada nesta campanha." /> : <div className="vx-compact-list">{tarefas.slice(0, 20).map((item) => <div key={item.id}><div><b>{item.tipo}</b><span>{new Date(item.criadoEm).toLocaleString("pt-BR")}</span></div><span className="vx-chip">{item.status}</span></div>)}</div>}</section>}
    {dados && aba === "leads" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">Leads da campanha</h2><p>Registros vinculados exclusivamente a esta operação.</p>{leads.length === 0 ? <Empty texto="Nenhum lead gerado nesta campanha." /> : <div className="vx-compact-list">{leads.slice(0, 20).map((item) => <div key={item.id}><div><b>{item.nome}</b><span>{item.empresa || "Empresa não informada"}</span></div><span className="vx-chip">{item.etapa}</span></div>)}</div>}</section>}
    {dados && aba === "reunioes" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">Reuniões</h2><p>Agendamentos e reuniões realizadas vinculados à campanha.</p>{reunioes.length === 0 ? <Empty texto="Nenhuma reunião registrada nesta campanha." /> : <div className="vx-compact-list">{reunioes.slice(0, 20).map((item) => <div key={item.id}><div><b>{item.tipo === "realizada" ? "Reunião realizada" : "Reunião agendada"}</b><span>{new Date(item.criadoEm).toLocaleString("pt-BR")}</span></div><span className="vx-chip">{item.status}</span></div>)}</div>}</section>}
    {dados && aba === "performance" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">Resultados ao longo do tempo</h2><p>Produção diária em {dados.periodo.label.toLowerCase()}.</p>{dados.serie.every((d) => !d.tarefas && !d.leads && !d.reunioes && !d.vendas) ? <Empty texto="Ainda não há atividade suficiente para o gráfico." /> : <div className="vx-performance-list">{dados.serie.map((dia) => <div key={dia.data}><span>{dia.data.slice(5).split("-").reverse().join("/")}</span><i style={{ width: `${Math.min(100, dia.tarefas * 5)}%` }} /><b>{dia.tarefas}</b></div>)}</div>}</section>}
    {dados && aba === "financeiro" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">Financeiro da campanha</h2><p>Consumo no período selecionado e limite configurado.</p><div className="vx-grid vx-g3"><div className="vx-scenario"><span>Investido no período</span><strong className="vx-mono">{money(dados.metricas.investimento.valor)}</strong></div><div className="vx-scenario"><span>Orçamento</span><strong className="vx-mono">{money(campanha.orcamento)}</strong></div><div className="vx-scenario"><span>Reservado</span><strong className="vx-mono">{money(campanha.reservado)}</strong></div></div></section>}
    {dados && aba === "configuracoes" && <section className="vx-card vx-detail-section"><Settings size={22} color="var(--brand)" /><h2 className="vx-disp">Configurações da campanha</h2><p>Objetivo, público, região, valores, evidências, treinamento e regras de publicação continuam no editor completo.</p><button className="vx-btn vx-btn-primary" onClick={onEditar}><Pencil size={14} /> Editar configuração</button></section>}
    {profissionalAberto && <ProfessionalProfile item={profissionalAberto} tarefas={tarefas} leads={leads} onClose={() => setProfissionalAberto(null)} />}
  </div>;
}

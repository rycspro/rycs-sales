import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Award, BriefcaseBusiness, CalendarCheck, CheckCircle2, CircleDollarSign,
  CirclePause, Clock3, Ellipsis, FolderOpen, Link2, ListChecks, Pencil, RefreshCw, Settings, Target,
  TrendingUp, Unlink, Upload, UsersRound, X,
  Laptop, MapPin, Building2, Globe, MessageCircle, Phone, Mail, Eye, EyeOff, Lock,
  FileText, Download, Trash2, Database, UserPlus, Shuffle, Filter, List, Users,
} from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES } from "../../lib/constants.js";
import { STATUS_CAMPANHA_UI } from "../../../shared/campaignOperations.js";
import {
  MODELOS_TRABALHO, MERCADOS, ORIGENS_LEAD, CANAIS, NIVEIS_EXPERIENCIA,
  PROCESSOS_ADMISSAO, OBJETIVOS_UI, ACOES_DISPONIVEIS, diagnosticoCampanha,
} from "../../../shared/campaignEngine.js";
import { FUNCOES } from "../../../shared/funcoes.js";
import { lerArquivoLeads, sugerirMapeamento } from "../../lib/importers.js";
import PipelineKanban from "./PipelineKanban.jsx";
import ComissoesPanel from "./ComissoesPanel.jsx";
import CriadorCampos from "./CriadorCampos.jsx";

const ABAS = [
  ["geral", "Visão Geral"], ["profissionais", "Profissionais"], ["tarefas", "Tarefas"],
  ["pipeline", "Pipeline"], ["contatos", "Contatos"], ["materiais", "Materiais"], ["leads", "Leads"],
  ["reunioes", "Reuniões"], ["performance", "Performance"],
  ["financeiro", "Financeiro"], ["comissoes", "Comissões"], ["campos", "Campos"],
  ["verificacao", "Verificação"], ["configuracoes", "Configurações"],
];
const PERIODOS = [["hoje", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"], ["personalizado", "Personalizado"]];
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
const SERIES = {
  investimento: { label: "Investimento", cor: "#F0B45E", monetario: true },
  tarefas: { label: "Tarefas", cor: "#5B8CFF" },
  leads: { label: "Leads", cor: "#9AA6FF" },
  reunioes: { label: "Reuniões", cor: "#22A06B" },
  vendas: { label: "Vendas", cor: "#FF8A7A" },
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

function AttentionNeeded({ alertas = [] }) {
  return <section className="vx-card vx-alerts-card">
    <div className="vx-eyebrow">Monitoramento determinístico</div><h2 className="vx-disp">Atenção necessária</h2>
    {alertas.length === 0 ? <div className="vx-alert-row is-positive"><CheckCircle2 size={16} /><span>Nenhum alerta operacional detectado com os dados disponíveis.</span></div> : alertas.map((alerta) => <div className={`vx-alert-row is-${alerta.nivel}`} key={alerta.codigo}><span className="vx-alert-dot" /><span>{alerta.texto}</span></div>)}
  </section>;
}

function PerformanceChart({ serie = [] }) {
  const [visiveis, setVisiveis] = useState(() => new Set(Object.keys(SERIES)));
  const largura = 640, altura = 220, margemX = 18, margemY = 20;
  const temDados = serie.some((dia) => Object.keys(SERIES).some((chave) => Number(dia[chave]) > 0));
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
    <div className="vx-chart-toggles">{Object.entries(SERIES).map(([chave, config]) => <button key={chave} data-on={visiveis.has(chave) ? "1" : "0"} onClick={() => alternar(chave)}><i style={{ background: config.cor }} />{config.label}</button>)}</div>
    {!temDados ? <Empty texto="Ainda não há atividade suficiente para o gráfico." /> : <>
      <svg role="img" aria-label="Resultados ao longo do tempo" viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none">
        {[0, .25, .5, .75, 1].map((p) => <line key={p} x1={margemX} x2={largura - margemX} y1={margemY + p * (altura - margemY * 2)} y2={margemY + p * (altura - margemY * 2)} className="vx-chart-gridline" />)}
        {Object.entries(SERIES).filter(([chave]) => visiveis.has(chave)).map(([chave, config]) => {
          const lista = pontos(chave);
          return <g key={chave}><polyline points={lista.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={config.cor} strokeWidth="3" vectorEffect="non-scaling-stroke" />{lista.map((p) => <circle key={p.data} cx={p.x} cy={p.y} r="4" fill={config.cor}><title>{`${config.label} · ${p.data}: ${config.monetario ? money(p.valor) : p.valor}`}</title></circle>)}</g>;
        })}
      </svg>
      <div className="vx-chart-axis"><span>{serie[0]?.data?.slice(5).split("-").reverse().join("/")}</span><span>{serie.at(-1)?.data?.slice(5).split("-").reverse().join("/")}</span></div>
    </>}
    <div className="vx-chart-source">Cada série usa sua própria escala para comparar tendências. Passe pelos pontos para ver os valores reais.</div>
  </div>;
}

function ProfessionalProfile({ item, tarefas, leads, campanha, onClose, onStatusChange }) {
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
      {item.candidaturaStatus === "pendente" && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="vx-btn vx-btn-primary" style={{ flex: 1 }} onClick={() => onStatusChange("aprovado")}><CheckCircle2 size={14} /> Aprovar profissional</button>
          <button className="vx-btn vx-btn-danger" style={{ flex: 1 }} onClick={() => onStatusChange("recusado")}><X size={14} /> Recusar</button>
        </div>
      )}
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
  const [dataDe, setDataDe] = useState(() => dataInput(Date.now() - 6 * 86400000));
  const [dataAte, setDataAte] = useState(() => dataInput(Date.now()));
  const [vinculos, setVinculos] = useState([]);

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

  useEffect(() => {
    api(`/loja-leads/vinculos/campanha/${campanha.id}`).then((r) => setVinculos(r?.vinculos || []));
  }, [campanha.id, recarregar]);

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
      {periodo === "personalizado" && <div className="vx-custom-dates"><label>De<input type="date" value={dataDe} max={dataAte} onChange={(e) => setDataDe(e.target.value)} /></label><label>Até<input type="date" value={dataAte} min={dataDe} onChange={(e) => setDataAte(e.target.value)} /></label></div>}
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

      {/* ── Configuração V2 ─────────────────────────────────────── */}
      <section className="vx-card" style={{ padding: 18, marginTop: 16 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Configuração da campanha</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, fontSize: 13 }}>
          {/* Modelo de trabalho */}
          <div>
            <span className="vx-mut" style={{ fontSize: 11.5 }}>Modelo de trabalho</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              {campanha.modeloTrabalho === "presencial" ? <MapPin size={14} color="var(--brand)" /> : campanha.modeloTrabalho === "hibrido" ? <Building2 size={14} color="var(--brand)" /> : <Laptop size={14} color="var(--brand)" />}
              <b>{MODELOS_TRABALHO[campanha.modeloTrabalho]?.nome || "Remoto"}</b>
            </div>
          </div>
          {/* Função */}
          <div>
            <span className="vx-mut" style={{ fontSize: 11.5 }}>Função</span>
            <div style={{ fontWeight: 600, marginTop: 3 }}>{FUNCOES[campanha.funcao]?.nome || (campanha.funcao || "").toUpperCase() || "—"}</div>
          </div>
          {/* Mercado */}
          <div>
            <span className="vx-mut" style={{ fontSize: 11.5 }}>Mercado</span>
            <div style={{ fontWeight: 600, marginTop: 3 }}>{MERCADOS[campanha.mercado]?.label || "—"}</div>
          </div>
          {/* Origem dos leads */}
          <div>
            <span className="vx-mut" style={{ fontSize: 11.5 }}>Origem dos leads</span>
            <div style={{ fontWeight: 600, marginTop: 3 }}>{ORIGENS_LEAD[campanha.origemLeads]?.label || "—"}</div>
          </div>
          {/* Experiência */}
          <div>
            <span className="vx-mut" style={{ fontSize: 11.5 }}>Nível de experiência</span>
            <div style={{ fontWeight: 600, marginTop: 3 }}>{NIVEIS_EXPERIENCIA.find((n) => n.id === campanha.nivelExperiencia)?.label || "Não definido"}</div>
          </div>
          {/* Admissão */}
          <div>
            <span className="vx-mut" style={{ fontSize: 11.5 }}>Processo de admissão</span>
            <div style={{ fontWeight: 600, marginTop: 3 }}>{PROCESSOS_ADMISSAO.find((p) => p.id === campanha.processoAdmissao)?.label || "Manual"}</div>
          </div>
          {/* Visibilidade */}
          <div>
            <span className="vx-mut" style={{ fontSize: 11.5 }}>Visibilidade</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600, marginTop: 3 }}>
              {campanha.visibilidade === "privada" ? <><EyeOff size={13} /> Privada</> : campanha.visibilidade === "oculta" ? <><Lock size={13} /> Oculta</> : <><Eye size={13} /> Pública</>}
            </div>
          </div>
          {/* Remuneração */}
          <div>
            <span className="vx-mut" style={{ fontSize: 11.5 }}>Modelo de pagamento</span>
            <div style={{ fontWeight: 600, marginTop: 3 }}>{campanha.remuneracaoCumulativa === false ? "Resultado final" : "Cumulativo"}</div>
          </div>
          {/* Comissão */}
          {campanha.temComissao && (
            <div>
              <span className="vx-mut" style={{ fontSize: 11.5 }}>Comissão por venda</span>
              <div style={{ fontWeight: 600, marginTop: 3 }}>{campanha.percentualComissao || 0}%</div>
            </div>
          )}
        </div>

        {/* Canais */}
        {(campanha.canais || []).length > 0 && (
          <div style={{ marginTop: 14 }}>
            <span className="vx-mut" style={{ fontSize: 11.5, display: "block", marginBottom: 6 }}>Canais de abordagem</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(Array.isArray(campanha.canais) ? campanha.canais : []).map((cId) => {
                const canal = CANAIS.find((c) => c.id === cId);
                return <span key={cId} className="vx-chip" style={{ fontSize: 12 }}>{canal?.nome || cId}</span>;
              })}
            </div>
          </div>
        )}

        {/* Ações ativas */}
        {(campanha.acoesAtivas || []).length > 0 && (
          <div style={{ marginTop: 14 }}>
            <span className="vx-mut" style={{ fontSize: 11.5, display: "block", marginBottom: 6 }}>Ações ativas</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(Array.isArray(campanha.acoesAtivas) ? campanha.acoesAtivas : []).map((aId) => {
                const acao = ACOES_DISPONIVEIS.find((a) => a.id === aId);
                return <span key={aId} className="vx-chip" style={{ fontSize: 12, background: "var(--brand-50)", border: "1px solid var(--brand-100)", color: "var(--brand)" }}>{acao?.nome || ACOES[aId]?.nome || aId}</span>;
              })}
            </div>
          </div>
        )}
      </section>

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
      {vinculos.length > 0 && (
        <section className="vx-card" style={{ padding: 18, marginTop: 16 }}>
          <div className="vx-row" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Link2 size={16} style={{ color: "var(--brand)" }} />
              <div>
                <div className="vx-eyebrow">Loja de Leads</div>
                <h3 className="vx-disp" style={{ fontSize: 15, margin: 0 }}>Listas vinculadas</h3>
              </div>
            </div>
            <span className="vx-chip">{vinculos.length} lista(s)</span>
          </div>
          {vinculos.map((v) => (
            <div key={v.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              padding: "10px 0", borderTop: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                <FolderOpen size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{v.listaNome}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {v.pastaNome && `${v.pastaNome} · `}{v.modo === "automatica" ? "Automática" : "Pontual"} · {v.totalCopiados} contato(s) copiado(s)
                  </div>
                </div>
              </div>
              {v.modo === "automatica" && (
                <button className="vx-btn vx-btn-sm" title="Sincronizar agora"
                  onClick={async () => {
                    const r = await api(`/loja-leads/sincronizar/${campanha.id}`, {});
                    if (r?.error) return console.warn(r.error);
                    setRecarregar((n) => n + 1);
                  }} style={{ padding: 4 }}>
                  <RefreshCw size={13} />
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      <AttentionNeeded alertas={dados.alertas} />
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
      <h2 className="vx-disp">Campos personalizados por tarefa</h2>
      <p className="vx-mut" style={{ fontSize: 13 }}>Configure os dados que o vendedor deve preencher ao concluir cada tipo de tarefa.</p>
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
    {dados && aba === "reunioes" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">Reuniões</h2><p>Agendamentos e reuniões realizadas vinculados à campanha.</p>{reunioes.length === 0 ? <Empty texto="Nenhuma reunião registrada nesta campanha." /> : <div className="vx-compact-list">{reunioes.slice(0, 20).map((item) => <div key={item.id}><div><b>{item.tipo === "realizada" ? "Reunião realizada" : "Reunião agendada"}</b><span>{new Date(item.criadoEm).toLocaleString("pt-BR")}</span></div><span className="vx-chip">{item.status}</span></div>)}</div>}</section>}
    {dados && aba === "performance" && <section className="vx-card vx-detail-section"><h2 className="vx-disp">Resultados ao longo do tempo</h2><p>Compare investimento, tarefas, leads, reuniões e vendas em {dados.periodo.label.toLowerCase()}.</p><PerformanceChart serie={dados.serie} /></section>}
    {dados && aba === "financeiro" && <div className="vx-finance-stack">
      <section className="vx-card vx-detail-section">
        <div className="vx-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}><div><h2 className="vx-disp">Financeiro da campanha</h2><p>Posição financeira real da operação.</p></div><span className={`vx-budget-risk ${dados.financeiro.diasRestantes != null && dados.financeiro.diasRestantes <= 2 ? "is-danger" : "is-ok"}`}><i />{dados.financeiro.diasRestantes == null ? "Aguardando consumo" : `${dados.financeiro.diasRestantes.toLocaleString("pt-BR")} dias estimados`}</span></div>
        <div className="vx-finance-budget"><div className="vx-row"><span>Orçamento</span><b className="vx-mono">{money(dados.financeiro.consumido)} / {money(dados.financeiro.limite)}</b></div><div className="vx-meter-track"><div className="vx-meter-fill" style={{ width: `${Math.min(100, dados.financeiro.limite > 0 ? (dados.financeiro.consumido / dados.financeiro.limite) * 100 : 0)}%`, background: "var(--brand)" }} /></div></div>
        <div className="vx-finance-kpis">
          {[["Saldo reservado", dados.financeiro.reservado, true], ["Consumido", dados.financeiro.consumido, true], ["Disponível", dados.financeiro.disponivel, true], ["Gasto médio diário", dados.financeiro.gastoMedioDiario, true], ["Projeção mensal", dados.financeiro.projecaoMensal, true], ["Estimativa de duração", dados.financeiro.diasRestantes, false]].map(([label, valor, monetario]) => <div key={label}><span>{label}</span><b className="vx-mono">{monetario ? money(valor) : valor == null ? "Sem consumo" : `${valor.toLocaleString("pt-BR")} dias`}</b></div>)}
        </div>
      </section>
      <section className="vx-card vx-detail-section"><h2 className="vx-disp">Gasto diário × Resultados</h2><p>Séries do período selecionado, com valores reais em cada ponto.</p><PerformanceChart serie={dados.financeiro.serie} /></section>
      <section className="vx-card vx-detail-section"><h2 className="vx-disp">Detalhamento dos custos</h2><p>Valores configurados e tarefas efetivamente liquidadas.</p>{dados.financeiro.detalhamento.length === 0 ? <Empty texto="Nenhum tipo de tarefa remunerada ou liquidada nesta campanha." /> : <div className="vx-cost-table"><div><span>Tipo de tarefa</span><span>Valor unitário</span><span>Quantidade</span><span>Total gasto</span></div>{dados.financeiro.detalhamento.map((item) => <div key={item.tipo}><b>{ACOES[item.tipo]?.nome || item.tipo}</b><span className="vx-mono" data-label="Valor unitário">{money(item.valorUnitario)}</span><span className="vx-mono" data-label="Quantidade">{item.quantidade}</span><span className="vx-mono" data-label="Total gasto">{money(item.total)}</span></div>)}</div>}</section>
    </div>}
    {dados && aba === "configuracoes" && <section className="vx-card vx-detail-section"><Settings size={22} color="var(--brand)" /><h2 className="vx-disp">Configurações da campanha</h2><p>Objetivo, público, região, valores, evidências, treinamento e regras de publicação continuam no editor completo.</p><button className="vx-btn vx-btn-primary" onClick={onEditar}><Pencil size={14} /> Editar configuração</button></section>}
    {aba === "contatos" && <ContatosCampanha campanha={campanha} profissionais={profissionais} aviso={(msg) => console.log("[contatos]", msg)} />}
    {aba === "verificacao" && <VerificacaoCampanha campanha={campanha} />}
    {aba === "materiais" && <MateriaisCampanha campanha={campanha} />}
    {aba === "leads" && <LeadsCampanha campanha={campanha} profissionais={profissionais} onRecarregar={() => setRecarregar((n) => n + 1)} />}
    {profissionalAberto && <ProfessionalProfile item={profissionalAberto} tarefas={tarefas} leads={leads} campanha={campanha} onClose={() => setProfissionalAberto(null)} onStatusChange={async (status) => {
      await apiPatch(`/campaigns/${campanha.id}/applications/${profissionalAberto.applicationId || profissionalAberto.id}`, { status });
      setProfissionalAberto(null);
      setRecarregar((v) => v + 1);
    }} />}
  </div>;
}

// ── Lista de Contatos ────────────────────────────────────────────────────────

const MODELOS_VERIFICACAO = [
  { value: "ia", label: "IA", desc: "Avaliação automática por inteligência artificial" },
  { value: "manual", label: "Manual", desc: "Gestor revisa e aprova cada evidência" },
  { value: "ia_manual", label: "IA + aprovação manual", desc: "IA filtra, gestor aprova o que ficou em dúvida" },
  { value: "integracao", label: "Integração automática", desc: "CRM ou sistema externo valida automaticamente" },
];

const CAMPOS_CONTATO = [["nome","Nome *"],["empresa","Empresa"],["cargo","Cargo"],["telefone","Telefone"],["email","E-mail"],["valorEstimado","Valor estimado"]];

function ContatosCampanha({ campanha, profissionais, aviso }) {
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
    Object.fromEntries(CAMPOS_CONTATO.map(([campo]) => [campo, mapa[campo] >= 0 ? linha[mapa[campo]] || "" : ""]))
  ), [tabela, mapa]);

  const aplicarTabela = (t) => { setTabela(t); setMapa(sugerirMapeamento(t.colunas)); setRelatorio(null); };
  const lerArquivo = async (file) => { try { aplicarTabela(await lerArquivoLeads(file)); setAberto(true); } catch (e) { setAvisoLocal(e.message); } };

  const importar = async () => {
    if (mapa.nome == null || mapa.nome < 0) return setAvisoLocal("Mapeie a coluna Nome.");
    setEnviando(true); setAvisoLocal("");
    const r = await api("/leads/import", { campaignId: campanha.id, autoDistribuir: true, linhas: normalizados });
    setEnviando(false);
    if (!r || r.error) return setAvisoLocal(r?.error || "Não foi possível importar.");
    setRelatorio(r); setAberto(false); setTabela({ colunas: [], linhas: [] });
    await carregar();
    setAvisoLocal(`${r.importados} contato(s) importados e distribuídos entre ${sellers.length} profissional(is).`);
  };

  const redistribuir = async () => {
    if (!sellers.length) return setAvisoLocal("Nenhum profissional aprovado para redistribuir.");
    setRedistribuindo(true);
    const r = await api("/leads/redistribuir", { campaignId: campanha.id });
    setRedistribuindo(false);
    if (r?.error) return setAvisoLocal(r.error);
    setAvisoLocal(`${r.redistribuidos} contatos redistribuídos aleatoriamente.`);
    await carregar();
  };

  const fechados = leads.filter((l) => l.etapa === "fechado" || l.etapa === "ganho").length;
  const totalVendas = leads.filter((l) => l.etapa === "fechado" || l.etapa === "ganho").reduce((s, l) => s + (Number(l.valorVenda) || 0), 0);

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div className="vx-eyebrow">Execução comercial</div>
          <h2 className="vx-disp" style={{ margin: "4px 0" }}>Contatos da campanha</h2>
          <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>Contato é o lead. Importe CSV ou XLSX e os contatos entram direto no kanban como "Primeiro contato".</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="vx-chip">{leads.length} contatos</span>
          <button className="vx-btn" onClick={() => { setAberto(!aberto); setAvisoLocal(""); }}><Upload size={13} /> Importar</button>
          <button className="vx-btn" disabled={redistribuindo || !sellers.length} onClick={redistribuir}>
            {redistribuindo ? "Redistribuindo..." : "Redistribuir"}
          </button>
        </div>
      </div>

      {avisoLocal && <div className="vx-notice" style={{ marginBottom: 12 }}>{avisoLocal}</div>}

      {aberto && (
        <section className="vx-card" style={{ padding: 18, marginBottom: 18 }}>
          <div className="vx-disp" style={{ fontSize: 16, marginBottom: 4 }}>Importação de contatos</div>
          <div className="vx-mut" style={{ fontSize: 12, marginBottom: 14 }}>
            Nome + telefone ou e-mail obrigatórios. Duplicatas removidas. Distribuição automática entre {sellers.length} profissional(is) aprovado(s).
          </div>
          <input ref={fileRef} hidden type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => lerArquivo(e.target.files?.[0])} />
          <button className="vx-btn" onClick={() => fileRef.current?.click()}><Upload size={13} /> Escolher CSV ou XLSX</button>

          {tabela.colunas.length > 0 && (
            <>
              <div className="vx-sep" />
              <div className="vx-disp" style={{ fontSize: 14, marginBottom: 10 }}>Mapeamento de colunas</div>
              <div className="vx-grid vx-g3">
                {CAMPOS_CONTATO.map(([campo, label]) => (
                  <label key={campo}>
                    <span className="vx-label">{label}</span>
                    <select className="vx-input" value={mapa[campo] ?? -1} onChange={(e) => setMapa({ ...mapa, [campo]: Number(e.target.value) })}>
                      <option value={-1}>Ignorar</option>
                      {tabela.colunas.map((c, i) => <option key={i} value={i}>{c}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="vx-table-wrap" style={{ marginTop: 12 }}>
                <table className="vx-table">
                  <thead><tr>{CAMPOS_CONTATO.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
                  <tbody>{normalizados.slice(0, 3).map((l, i) => <tr key={i}>{CAMPOS_CONTATO.map(([c]) => <td key={c}>{l[c] || "—"}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <div className="vx-chart-source">{normalizados.length} linha(s) · prévia de 3</div>
              <button className="vx-btn vx-btn-primary" style={{ marginTop: 12 }} disabled={enviando || !normalizados.length} onClick={importar}>
                {enviando ? "Importando..." : "Confirmar importação"}
              </button>
            </>
          )}
          {relatorio && (
            <div className="vx-grid vx-g4" style={{ marginTop: 14 }}>
              {[["Recebidos", relatorio.totalRecebido], ["Importados", relatorio.importados], ["Duplicados", relatorio.duplicados], ["Inválidos", relatorio.invalidos]].map(([l, v]) => (
                <div className="vx-scenario" key={l}><span>{l}</span><strong className="vx-mono">{v}</strong></div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="vx-grid vx-g4" style={{ marginBottom: 16 }}>
        <div className="vx-card" style={{ padding: 14 }}><div className="vx-mut" style={{ fontSize: 12 }}>Total</div><b className="vx-mono" style={{ fontSize: 19 }}>{leads.length}</b></div>
        <div className="vx-card" style={{ padding: 14 }}><div className="vx-mut" style={{ fontSize: 12 }}>Fechados</div><b className="vx-mono" style={{ fontSize: 19 }}>{fechados}</b></div>
        <div className="vx-card" style={{ padding: 14 }}><div className="vx-mut" style={{ fontSize: 12 }}>Conversão</div><b className="vx-mono" style={{ fontSize: 19 }}>{leads.length ? Math.round(fechados / leads.length * 100) : 0}%</b></div>
        <div className="vx-card" style={{ padding: 14 }}><div className="vx-mut" style={{ fontSize: 12 }}>Total vendas</div><b className="vx-mono" style={{ fontSize: 19 }}>{money(totalVendas)}</b></div>
      </div>

      {carregando ? (
        <div className="vx-mut">Carregando contatos...</div>
      ) : leads.length === 0 ? (
        <div className="vx-card" style={{ padding: 32, textAlign: "center" }}>
          <Upload size={24} color="var(--muted)" />
          <p className="vx-mut" style={{ marginTop: 10 }}>Nenhum contato nesta campanha. Use "Importar" para começar.</p>
          <p className="vx-mut" style={{ fontSize: 12 }}>Colunas reconhecidas: nome, empresa, cargo, telefone, email, valor</p>
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

const CATEGORIAS_MATERIAL = [
  { id: "treinamento", label: "Treinamento" },
  { id: "vendas", label: "Material de vendas" },
  { id: "produto", label: "Produto" },
  { id: "compliance", label: "Compliance" },
  { id: "outros", label: "Outros" },
];
const OBRIGATORIEDADE = [
  { id: "obrigatorio", label: "Obrigatório" },
  { id: "recomendado", label: "Recomendado" },
  { id: "complementar", label: "Complementar" },
];
const REGRAS_ACESSO = [
  { id: "todos", label: "Todos os profissionais" },
  { id: "aprovados", label: "Apenas aprovados" },
  { id: "confidencial", label: "Confidencial (empresa)" },
];

function MateriaisCampanha({ campanha }) {
  const [materiais, setMateriais] = useState([]);
  const [biblioteca, setBiblioteca] = useState([]);
  const [vinculados, setVinculados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [abaLocal, setAbaLocal] = useState("vinculados");

  const carregar = async () => {
    setCarregando(true);
    const [bib, vinc] = await Promise.all([
      api("/materiais"),
      api(`/campaigns/${campanha.id}/materiais`),
    ]);
    setBiblioteca(Array.isArray(bib) ? bib : []);
    setVinculados(Array.isArray(vinc) ? vinc : []);
    setMateriais(Array.isArray(vinc) ? vinc : []);
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, [campanha.id]);

  const vincular = async (mat) => {
    const ja = materiais.find((m) => m.materialId === mat.id || m.id === mat.id);
    if (ja) return;
    setMateriais((prev) => [...prev, { materialId: mat.id, nome: mat.nome, tipo: mat.tipo, categoria: "outros", obrigatoriedade: "complementar", regraAcesso: "todos", ordem: prev.length }]);
  };

  const remover = (idx) => setMateriais((prev) => prev.filter((_, i) => i !== idx));

  const atualizar = (idx, campo, valor) => setMateriais((prev) => prev.map((m, i) => i === idx ? { ...m, [campo]: valor } : m));

  const salvar = async () => {
    setSalvando(true);
    const payload = materiais.map((m, i) => ({
      materialId: m.materialId || m.id,
      categoria: m.categoria || "outros",
      obrigatoriedade: m.obrigatoriedade || "complementar",
      regraAcesso: m.regraAcesso || "todos",
      ordem: i,
    }));
    const r = await api(`/campaigns/${campanha.id}/materiais`, { method: "PUT", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
    setSalvando(false);
    if (r?.error) return setAviso(r.error);
    setAviso("Materiais salvos com sucesso.");
    await carregar();
  };

  return (
    <div className="vx-fade">
      <div style={{ marginBottom: 16 }}>
        <div className="vx-eyebrow">Recursos da campanha</div>
        <h2 className="vx-disp" style={{ margin: "4px 0" }}>Materiais</h2>
        <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>Vincule materiais da biblioteca da empresa a esta campanha. Defina categoria, obrigatoriedade e regras de acesso.</p>
      </div>

      {aviso && <div className="vx-notice" style={{ marginBottom: 12 }}>{aviso}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["vinculados", "Vinculados"], ["biblioteca", "Biblioteca"]].map(([k, l]) => (
          <button key={k} className="vx-btn" data-on={abaLocal === k ? "1" : "0"} onClick={() => setAbaLocal(k)} style={{ fontWeight: abaLocal === k ? 600 : 400 }}>{l}</button>
        ))}
      </div>

      {carregando ? <div className="vx-mut">Carregando materiais...</div> : abaLocal === "vinculados" ? (
        <>
          {materiais.length === 0 ? (
            <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
              <FileText size={24} color="var(--muted)" />
              <p className="vx-mut" style={{ marginTop: 10 }}>Nenhum material vinculado. Vá na aba "Biblioteca" para adicionar.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {materiais.map((mat, idx) => (
                <div key={mat.materialId || mat.id || idx} className="vx-card" style={{ padding: 14, display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <FileText size={18} style={{ color: "var(--brand)", flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{mat.nome || "Material"}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      <select className="vx-input" style={{ width: "auto", fontSize: 12 }} value={mat.categoria} onChange={(e) => atualizar(idx, "categoria", e.target.value)}>
                        {CATEGORIAS_MATERIAL.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                      <select className="vx-input" style={{ width: "auto", fontSize: 12 }} value={mat.obrigatoriedade} onChange={(e) => atualizar(idx, "obrigatoriedade", e.target.value)}>
                        {OBRIGATORIEDADE.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                      <select className="vx-input" style={{ width: "auto", fontSize: 12 }} value={mat.regraAcesso} onChange={(e) => atualizar(idx, "regraAcesso", e.target.value)}>
                        {REGRAS_ACESSO.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => remover(idx)} title="Remover"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          {materiais.length > 0 && (
            <button className="vx-btn vx-btn-primary" style={{ marginTop: 14 }} disabled={salvando} onClick={salvar}>
              {salvando ? "Salvando..." : "Salvar materiais da campanha"}
            </button>
          )}
        </>
      ) : (
        <>
          {biblioteca.length === 0 ? (
            <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
              <FileText size={24} color="var(--muted)" />
              <p className="vx-mut" style={{ marginTop: 10 }}>Biblioteca vazia. Faça upload de materiais na seção "Materiais" do menu lateral.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {biblioteca.map((mat) => {
                const jaVinculado = materiais.some((m) => (m.materialId || m.id) === mat.id);
                return (
                  <div key={mat.id} className="vx-card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10, opacity: jaVinculado ? 0.5 : 1 }}>
                    <FileText size={16} style={{ color: "var(--brand)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{mat.nome}</div>
                      <div className="vx-mut" style={{ fontSize: 11 }}>{mat.tipo || "arquivo"} · {mat.tamanhoFormatado || ""}</div>
                    </div>
                    <button className="vx-btn vx-btn-sm" disabled={jaVinculado} onClick={() => vincular(mat)}>
                      {jaVinculado ? "Vinculado" : "Adicionar"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const SELECAO_LEADS_TIPOS = [
  { id: "toda_base", label: "Toda a base", icon: Database, desc: "Todos os leads da empresa entram na campanha" },
  { id: "filtros", label: "Por filtros", icon: Filter, desc: "Leads que atendem critérios específicos" },
  { id: "listas", label: "Por listas", icon: List, desc: "Selecione listas específicas da Loja de Leads" },
  { id: "individual", label: "Individual", icon: UserPlus, desc: "Selecione leads um a um" },
  { id: "importar", label: "Importar", icon: Upload, desc: "Importe uma base de leads externa" },
];
const DISTRIBUICAO_LEADS = [
  { id: "fila", label: "Fila compartilhada", desc: "Profissionais solicitam o próximo lead disponível" },
  { id: "automatica", label: "Automática", desc: "Sistema distribui equitativamente" },
  { id: "manual", label: "Manual", desc: "Gestor atribui leads manualmente" },
];

function LeadsCampanha({ campanha, profissionais, onRecarregar }) {
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState("");

  const carregar = async () => {
    setCarregando(true);
    const r = await api(`/campaigns/${campanha.id}/leads`);
    setLeads(r?.leads || r || []);
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, [campanha.id]);

  const stats = useMemo(() => {
    const total = leads.length;
    const disponiveis = leads.filter((l) => l.status === "disponivel").length;
    const emAtendimento = leads.filter((l) => l.status === "em_atendimento").length;
    const convertidos = leads.filter((l) => l.status === "convertido").length;
    const devolvidos = leads.filter((l) => l.status === "devolvido").length;
    return { total, disponiveis, emAtendimento, convertidos, devolvidos };
  }, [leads]);

  const selecaoTipo = campanha.selecaoLeadsTipo || "toda_base";
  const distribuicao = campanha.distribuicaoLeads || "fila";

  return (
    <div className="vx-fade">
      <div style={{ marginBottom: 16 }}>
        <div className="vx-eyebrow">Base de leads</div>
        <h2 className="vx-disp" style={{ margin: "4px 0" }}>Leads da campanha</h2>
        <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>Gerencie a base de leads vinculada à campanha e acompanhe a distribuição.</p>
      </div>

      {aviso && <div className="vx-notice" style={{ marginBottom: 12 }}>{aviso}</div>}

      <div className="vx-grid vx-g4" style={{ marginBottom: 16 }}>
        {[["Total", stats.total, Database], ["Disponíveis", stats.disponiveis, Users], ["Em atendimento", stats.emAtendimento, UserPlus], ["Convertidos", stats.convertidos, TrendingUp]].map(([label, valor, Icon]) => (
          <div key={label} className="vx-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><Icon size={14} color="var(--brand)" /><span className="vx-mut" style={{ fontSize: 12 }}>{label}</span></div>
            <b className="vx-mono" style={{ fontSize: 19 }}>{valor}</b>
          </div>
        ))}
      </div>

      <div className="vx-grid vx-g2" style={{ marginBottom: 16 }}>
        <div className="vx-card" style={{ padding: 16 }}>
          <div className="vx-label" style={{ marginBottom: 6 }}>Método de seleção</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(() => { const t = SELECAO_LEADS_TIPOS.find((s) => s.id === selecaoTipo); return t ? <><t.icon size={16} color="var(--brand)" /><div><b style={{ fontSize: 13 }}>{t.label}</b><div className="vx-mut" style={{ fontSize: 11 }}>{t.desc}</div></div></> : <span>—</span>; })()}
          </div>
        </div>
        <div className="vx-card" style={{ padding: 16 }}>
          <div className="vx-label" style={{ marginBottom: 6 }}>Distribuição</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Shuffle size={16} color="var(--brand)" />
            <div><b style={{ fontSize: 13 }}>{DISTRIBUICAO_LEADS.find((d) => d.id === distribuicao)?.label || "Fila"}</b><div className="vx-mut" style={{ fontSize: 11 }}>{DISTRIBUICAO_LEADS.find((d) => d.id === distribuicao)?.desc || ""}</div></div>
          </div>
        </div>
      </div>

      {(campanha.limiteLeadsSimultaneos || campanha.limiteLeadsDia || campanha.prazoContatoHoras || campanha.prazoInatividadeHoras) && (
        <div className="vx-card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="vx-label" style={{ marginBottom: 10 }}>Regras de distribuição</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, fontSize: 13 }}>
            {campanha.limiteLeadsSimultaneos > 0 && <div><span className="vx-mut" style={{ fontSize: 11 }}>Leads simultâneos</span><div style={{ fontWeight: 600 }}>{campanha.limiteLeadsSimultaneos}</div></div>}
            {campanha.limiteLeadsDia > 0 && <div><span className="vx-mut" style={{ fontSize: 11 }}>Leads por dia</span><div style={{ fontWeight: 600 }}>{campanha.limiteLeadsDia}</div></div>}
            {campanha.prazoContatoHoras > 0 && <div><span className="vx-mut" style={{ fontSize: 11 }}>Prazo primeiro contato</span><div style={{ fontWeight: 600 }}>{campanha.prazoContatoHoras}h</div></div>}
            {campanha.prazoInatividadeHoras > 0 && <div><span className="vx-mut" style={{ fontSize: 11 }}>Prazo inatividade</span><div style={{ fontWeight: 600 }}>{campanha.prazoInatividadeHoras}h</div></div>}
          </div>
        </div>
      )}

      {carregando ? <div className="vx-mut">Carregando leads...</div> : leads.length === 0 ? (
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <Database size={24} color="var(--muted)" />
          <p className="vx-mut" style={{ marginTop: 10 }}>Nenhum lead vinculado a esta campanha.</p>
          <p className="vx-mut" style={{ fontSize: 12 }}>Configure a fonte de leads no editor da campanha ou importe na aba Contatos.</p>
        </div>
      ) : (
        <div className="vx-card" style={{ padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="vx-table" style={{ width: "100%", fontSize: 13 }}>
              <thead><tr><th>Lead</th><th>Status</th><th>Profissional</th><th>Atribuído em</th></tr></thead>
              <tbody>
                {leads.slice(0, 50).map((lead) => (
                  <tr key={lead.id || lead.leadId}>
                    <td style={{ fontWeight: 500 }}>{lead.nome || lead.leadNome || `#${lead.leadId || lead.id}`}</td>
                    <td><span className="vx-chip" style={{ fontSize: 11 }}>{lead.status || "disponivel"}</span></td>
                    <td>{lead.sellerNome || lead.sellerId || "—"}</td>
                    <td className="vx-mono">{lead.atribuidoEm ? new Date(lead.atribuidoEm).toLocaleDateString("pt-BR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {leads.length > 50 && <div className="vx-chart-source" style={{ padding: 10 }}>Mostrando 50 de {leads.length} leads</div>}
        </div>
      )}
    </div>
  );
}

function VerificacaoCampanha({ campanha }) {
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
    agendamento: ["Registro no CRM", "Confirmação enviada ao lead"],
    realizada: ["Gravação da chamada ou ata", "Confirmação do lead"],
    venda: ["Comprovante / contrato assinado", "Registro no CRM"],
    ligacao: ["Gravação de áudio (IA analisa)", "Log da ligação"],
    follow: ["Mensagem ou e-mail enviado", "Resposta do lead (se houver)"],
    pap: ["Foto no local", "Confirmação de geolocalização"],
  };

  const salvar = async () => {
    setSalvando(true);
    const r = await apiPatch(`/campaigns/${campanha.id}`, { modelosVerificacao: modelos });
    setSalvando(false);
    setAviso(r?.error ? r.error : "Modelos de verificação salvos.");
  };

  return (
    <div className="vx-fade">
      <div style={{ marginBottom: 20 }}>
        <div className="vx-eyebrow">Qualidade e conformidade</div>
        <h2 className="vx-disp" style={{ margin: "4px 0" }}>Modelo de Verificação</h2>
        <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>Defina como cada tipo de tarefa será verificada antes do pagamento.</p>
      </div>

      {aviso && <div className="vx-notice" style={{ marginBottom: 14 }}>{aviso}</div>}

      {tarefasCampanha.length === 0
        ? <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
            <p className="vx-mut">Esta campanha não tem tarefas configuradas. Edite a campanha para adicionar tarefas.</p>
            <p className="vx-mut" style={{ fontSize: 12, marginTop: 6 }}>As evidências exigidas em cada tarefa aparecerão aqui para configuração.</p>
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
                          Valor: {money(tarefa.valor || 0)} por execução
                        </div>
                      </div>
                      <span className="vx-chip">{MODELOS_VERIFICACAO.find((m) => m.value === modeloAtual)?.label || modeloAtual}</span>
                    </div>

                    <div className="vx-label" style={{ marginBottom: 6 }}>Modelo de verificação</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                      {MODELOS_VERIFICACAO.map((m) => (
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
                            <b>{m.label}</b>
                            <div className="vx-mut" style={{ fontSize: 11 }}>{m.desc}</div>
                          </span>
                        </label>
                      ))}
                    </div>

                    {evidencias.length > 0 && (
                      <div>
                        <div className="vx-label" style={{ marginBottom: 6 }}>Evidências exigidas</div>
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
              {salvando ? "Salvando..." : "Salvar modelos de verificação"}
            </button>
          </>}
    </div>
  );
}

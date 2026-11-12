import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, CirclePause, ClipboardCheck, FileText, GitBranch, Megaphone, MoreHorizontal, Plus, Rocket, Save, Sparkles, Users, Wallet, MapPin, Clock } from "lucide-react";
import { EditorEtapas } from "./PipelineKanban.jsx";
import { api, apiPatch } from "../../lib/api.js";
import { lerJson, gravarJson, remover as removerArmazenado } from "../../lib/armazenamento.js";
import { campanhaPodeSerPublicada, saldoDisponivel } from "../../../shared/empresa.js";
import { planoTemIA, PLANOS_COM_IA } from "../../../shared/planos.js";
import { money } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";
import NovaCampanha from "./NovaCampanha.jsx";
import CampaignsDashboard from "./CampaignsDashboard.jsx";
import CampaignDetail from "./CampaignDetail.jsx";

// ── Status config ────────────────────────────────────────────────────
const STATUS_CONFIG = {
  ativa:    { label: "Publicada",  bg: "#DCFCE7", color: "#16A34A" },
  rascunho: { label: "Rascunho",   bg: "var(--surface-2)", color: "var(--muted)" },
  pausada:  { label: "Pausada",    bg: "#FEF9C3", color: "#B45309" },
  encerrada:{ label: "Encerrada",  bg: "var(--surface-2)", color: "var(--muted)" },
  cancelada:{ label: "Cancelada",  bg: "#FEE2E2", color: "#DC2626" },
};

const FILTROS_STATUS = [
  ["", "Todas"],
  ["rascunho", "Rascunho"],
  ["ativa", "Publicadas"],
  ["pausada", "Pausadas"],
  ["encerrada", "Encerradas"],
  ["cancelada", "Canceladas"],
];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: "var(--surface-2)", color: "var(--muted)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: cfg.bg, color: cfg.color }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function MetricChip({ icon: Icon, label }) {
  if (!label) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted)" }}>
      <Icon size={12} strokeWidth={2} />
      {label}
    </span>
  );
}

function MenuCampanha({ campanha, onEditar, onArquivar, onExcluir }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  const opcoes = [
    { label: "Editar", acao: () => { setAberto(false); onEditar(campanha); } },
    { label: "Arquivar", acao: () => { setAberto(false); onArquivar(campanha); }, cor: "var(--muted)" },
    { label: "Excluir", acao: () => { setAberto(false); onExcluir(campanha); }, cor: "#DC2626" },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="vx-btn vx-btn-ghost vx-btn-sm"
        onClick={(e) => { e.stopPropagation(); setAberto((v) => !v); }}
        style={{ padding: "4px 6px", lineHeight: 1, color: "var(--muted)" }}
        title="Mais opções"
      >
        <MoreHorizontal size={16} strokeWidth={2} />
      </button>
      {aberto && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50,
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", boxShadow: "0 4px 16px rgba(0,0,0,.12)",
            minWidth: 140, overflow: "hidden",
          }}
        >
          {opcoes.map(({ label, acao, cor }) => (
            <button
              key={label}
              onClick={acao}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "9px 14px", border: "none", background: "transparent",
                fontSize: 13, cursor: "pointer", color: cor || "var(--ink)",
                transition: "background .1s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CampanhaLista({ campanhas, onAbrir, onEditar, onCriar, onArquivar, onExcluir }) {
  const [filtro, setFiltro] = useState("");

  const counts = useMemo(() => Object.fromEntries(
    FILTROS_STATUS.slice(1).map(([k]) => [k, campanhas.filter((c) => c.status === k).length])
  ), [campanhas]);

  const visiveis = useMemo(() =>
    filtro ? campanhas.filter((c) => c.status === filtro) : campanhas
  , [campanhas, filtro]);

  const ativas = campanhas.filter((c) => c.status === "ativa").length;
  const rascunhos = campanhas.filter((c) => c.status === "rascunho").length;
  const totalPendentes = campanhas.reduce((acc, c) => acc + ((c.candidaturas || []).filter((a) => a.status === "pendente").length), 0);

  return (
    <div className="vx-fade">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", margin: "0 0 3px", letterSpacing: -0.3 }}>Campanhas</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Gerencie oportunidades para seus profissionais de vendas.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setFiltro(filtro === "encerrada" ? "" : "encerrada")}
            title="Arquivadas"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 500,
              border: `1.5px solid ${filtro === "encerrada" ? "var(--brand)" : "var(--border)"}`,
              background: filtro === "encerrada" ? "var(--brand)" : "var(--surface-2)",
              color: filtro === "encerrada" ? "#fff" : "var(--muted)",
              cursor: "pointer", transition: "all .15s", fontFamily: "inherit",
            }}
          >
            <Archive size={13} />
            {filtro === "encerrada" ? "Ver todas" : "Arquivadas"}
            {counts["encerrada"] > 0 && (
              <span style={{
                fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 20,
                background: filtro === "encerrada" ? "rgba(255,255,255,.25)" : "var(--border)",
                color: filtro === "encerrada" ? "#fff" : "var(--muted)",
              }}>{counts["encerrada"]}</span>
            )}
          </button>
          {/* No estado inicial (sem campanhas) os cards abaixo já oferecem os dois
              caminhos; só mostramos os botões do topo depois que existe campanha. */}
          {campanhas.length > 0 && <>
            <button className="vx-btn vx-btn-sm" onClick={() => onCriar(false)}><Plus size={13} /> Manual</button>
            <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => onCriar(true)}><Sparkles size={13} /> Criar com IA</button>
          </>}
        </div>
      </div>

      {/* Stats strip — só mostra quando há campanhas */}
      {campanhas.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Publicadas", value: ativas, icon: Megaphone },
            { label: "Rascunhos", value: rascunhos, icon: FileText },
            { label: "Candidaturas pendentes", value: totalPendentes, icon: Users },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="vx-glass-panel vx-tile">
              <div className="vx-tile-top">
                <span>{label}</span>
                <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <div className="vx-tile-val">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter pills */}
      {campanhas.length > 0 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2, marginBottom: 16 }}>
          {FILTROS_STATUS.map(([key, label]) => {
            const ativa = filtro === key;
            const count = key ? counts[key] : campanhas.length;
            return (
              <button
                key={key}
                onClick={() => setFiltro(key)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                  padding: "5px 12px", borderRadius: 20, border: `1px solid ${ativa ? "var(--brand)" : "var(--border)"}`,
                  background: ativa ? "var(--brand)" : "var(--surface)", cursor: "pointer",
                  fontSize: 12.5, fontWeight: ativa ? 600 : 400,
                  color: ativa ? "#fff" : "var(--ink)", transition: "all .15s",
                }}
              >
                {label}
                {count > 0 && <span style={{ fontSize: 11, opacity: ativa ? 0.85 : 0.6 }}>{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state — dois caminhos: manual ou IA */}
      {visiveis.length === 0 && (campanhas.length === 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {/* Manual */}
          <div onClick={() => onCriar(false)}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, transition: "border-color .15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}><Plus size={20} /></div>
            <h3 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>Criar campanha manual</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6, flex: 1 }}>Você monta a campanha do zero — objetivo, tarefas, remuneração e critérios. Controle total sobre cada detalhe.</p>
            <button className="vx-btn vx-btn-block" style={{ marginTop: 4 }}><Plus size={14} /> Criar manual</button>
          </div>
          {/* IA */}
          <div onClick={() => onCriar(true)}
            style={{ background: "var(--brand-50)", border: "1.5px solid var(--brand-200)", borderRadius: 16, padding: 24, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, transition: "border-color .15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--brand-200)"; }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--brand-100)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}><Sparkles size={20} /></div>
            <h3 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>Criar campanha com IA</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6, flex: 1 }}>A inteligência artificial monta a campanha com base no seu negócio — você só revisa. Disponível nos planos {PLANOS_COM_IA.join(" e ")}.</p>
            <button className="vx-btn vx-btn-primary vx-btn-block"><Sparkles size={14} /> Criar com IA</button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "48px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>Nenhuma campanha com este filtro.</div>
          <button className="vx-btn vx-btn-sm" style={{ marginTop: 10 }} onClick={() => setFiltro("")}>Ver todas</button>
        </div>
      ))}

      {/* Campaign cards grid */}
      {visiveis.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
          {visiveis.map((c) => {
            const pendentes = (c.candidaturas || []).filter((a) => a.status === "pendente").length;
            return (
              <div
                key={c.id}
                onClick={() => onAbrir(c)}
                style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px 18px", cursor: "pointer", transition: "border-color .15s, box-shadow .15s", display: "flex", flexDirection: "column", gap: 10 }}
              >
                {/* Top row: status + menu */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <StatusBadge status={c.status} />
                  <MenuCampanha
                    campanha={c}
                    onEditar={onEditar}
                    onArquivar={onArquivar}
                    onExcluir={onExcluir}
                  />
                </div>

                {/* Title */}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>{c.titulo || "Sem título"}</div>
                  {c.objetivo && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.objetivo}</div>}
                </div>

                {/* Metrics */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                  {c.funcao && <MetricChip icon={Users} label={c.funcao.toUpperCase()} />}
                  {c.regiao && <MetricChip icon={MapPin} label={c.regiao} />}
                  {c.duracaoDias && <MetricChip icon={Clock} label={`${c.duracaoDias} dias`} />}
                  {c.vagas > 0 && <MetricChip icon={Users} label={`${c.vagas} vaga${c.vagas !== 1 ? "s" : ""}`} />}
                </div>

                {/* Candidaturas pendentes alert */}
                {pendentes > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#EFF6FF", borderRadius: "var(--radius-sm)", fontSize: 12, color: "#1D4ED8", fontWeight: 500 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D4ED8", flexShrink: 0 }} />
                    {pendentes} candidatura{pendentes !== 1 ? "s" : ""} pendente{pendentes !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const novaCampanha = (emp) => ({
  titulo: "", descricao: "", produto: emp.produto || "", objetivo: "Gerar reuniões qualificadas",
  publico: emp.icp || "", regiao: emp.regiao || "", funcao: "sdr", vagas: 2, orcamento: 0,
  prazoHoras: 48, limitePorProfissional: 10, aceitaLeadProprio: false, exigeCertificacao: true,
  duracaoDias: 30,
  tarefas: { agendamento: 0, realizada: 0, venda:0, ligacao:0, follow:0 }, evidencias: {
    agendamento: ["Lead no ICP", "Data e participantes", "Confirmação", "Vídeo ou registro verificável"],
    realizada: ["Presença", "Duração", "Gravação ou transcrição autorizada"],
  }, criteriosAprovacao: { agendamento: "Lead válido, não duplicado e reunião confirmada.", realizada: "Participantes presentes e reunião concluída conforme a campanha." }, treinamento: [], requisitos: "",
});

export default function CampanhasEmpresa({ emp, db, up, aviso, recarregar, filtroData, bloqueado, irParaPlano }) {
  const [popupPlano, setPopupPlano] = useState(null); // null | "sem-plano" | "sem-ia"
  const temIA = planoTemIA(emp.assinatura);
  const campanhasBase = (db.campaigns || []).filter((c) => c.companyId === emp.id);
  const campanhas = (() => {
    if (!filtroData) return campanhasBase;
    const { dataInicio, dataFim, campo, direcao } = filtroData;
    let r = campanhasBase;
    if (dataInicio) r = r.filter((c) => Number(c.criadoEm || 0) >= new Date(dataInicio).getTime());
    if (dataFim)    r = r.filter((c) => Number(c.criadoEm || 0) <= new Date(dataFim + "T23:59:59").getTime());
    if (campo) r = [...r].sort((a, b) => {
      const va = a[campo] ?? ""; const vb = b[campo] ?? "";
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
      return direcao === "asc" ? cmp : -cmp;
    });
    return r;
  })();
  // Criar e editar deixam de ser a mesma tela. Criar é decisão comercial e
  // ganha um assistente de três passos; editar é ajuste fino e continua no
  // editor completo, com todos os campos à mão.
  const [criando, setCriando] = useState(false);
  const [criarComIA, setCriarComIA] = useState(false);
  const [modo, setModo] = useState(campanhas.length ? "lista" : "lista");
  const [recarregarDashboard, setRecarregarDashboard] = useState(0);
  const [selecionada, setSelecionada] = useState(campanhas[0]?.id || "nova");
  const existente = campanhas.find((c) => c.id === selecionada);
  const [rascunhoNovo, setRascunhoNovo] = useState(() => lerJson(`rycs-campanha-${emp.id}`, null) || novaCampanha(emp));
  const [edicao, setEdicao] = useState(null);
  const [alterado,setAlterado]=useState(false);
  const campanha = edicao?.id === selecionada ? edicao : existente || rascunhoNovo;
  const set = (k, valor) => {
    const atualizar = (c) => ({ ...c, [k]: valor });
    existente ? setEdicao(atualizar(campanha)) : setRascunhoNovo(atualizar(campanha));
    setAlterado(true);
  };
  const check = useMemo(() => campanhaPodeSerPublicada(campanha, emp), [campanha, emp]);
  const disponivel = saldoDisponivel(emp);
  useEffect(()=>{if(!existente)gravarJson(`rycs-campanha-${emp.id}`,rascunhoNovo);},[rascunhoNovo,existente,emp.id]);
  useEffect(()=>{const sair=(e)=>{if(alterado){e.preventDefault();e.returnValue="";}};window.addEventListener("beforeunload",sair);return()=>window.removeEventListener("beforeunload",sair);},[alterado]);
  const passos=["Informações gerais","Objetivo e público","Profissionais e Time","Leads","Academy","Tarefas e Valores","Aprovações","Orçamento e ROI","Revisão","Publicação"];
  const concluidos=[campanha.titulo,campanha.publico,true,true,(campanha.treinamento||[]).length,Object.values(campanha.tarefas||{}).some(Number),campanha.criteriosAprovacao,campanha.orcamento,check.pendencias.length===0,campanha.status==="ativa"].filter(Boolean).length;

  const salvar = async () => {
    if (!campanha.titulo.trim()) return aviso("Dê um título à campanha.");
    let r;
    if (existente) r = await apiPatch(`/campaigns/${existente.id}`, campanha);
    else r = await api("/campaigns", campanha);
    if (!r || r.error) return aviso(r?.error || "Não foi possível salvar.");
    if (existente) {
      up((d) => ({ campaigns: d.campaigns.map((c) => c.id === existente.id ? { ...c, ...campanha } : c) }));
    } else {
      const criada = { ...campanha, id: r.id, companyId: emp.id, status: "rascunho", criadoEm: Date.now() };
      up((d) => ({ campaigns: [...(d.campaigns || []), criada] }));
      setSelecionada(r.id); setEdicao(criada); setRascunhoNovo(novaCampanha(emp));
    }
    aviso("Campanha salva como rascunho.");
    setAlterado(false);removerArmazenado(`rycs-campanha-${emp.id}`);
    return r.id || existente.id;
  };
  const mudarStatus = async (status) => {
    // Publicar exige plano ativo; criar/salvar rascunho não.
    if (status === "ativa" && bloqueado) { setPopupPlano("sem-plano"); return; }
    const id = existente?.id || await salvar();
    if (!id) return;
    if (existente) await apiPatch(`/campaigns/${id}`, campanha);
    const r = await api(`/campaigns/${id}/status`, { status });
    if (!r || r.error) return aviso(r?.pendencias?.join(" · ") || r?.error || "Não foi possível alterar a campanha.");
    up((d) => ({ campaigns: d.campaigns.map((c) => c.id === id ? { ...c, ...campanha, status } : c) }));
    setEdicao((c) => c ? { ...c, status } : c);
    aviso(status === "ativa" ? "Campanha publicada." : "Campanha pausada.");
  };
  const adicionarModulo = () => set("treinamento", [...(campanha.treinamento || []), { id: `mod-${Date.now()}`, titulo: "", conteudo: "" }]);
  const decidirCandidatura = async (app, status) => {
    const r = await apiPatch(`/campaigns/${campanha.id}/applications/${app.id}`, { status });
    if (!r || r.error) return aviso(r?.error || "Não foi possível decidir a candidatura.");
    aviso(status === "aprovado" ? "Profissional aprovado e liberado para trabalhar." : "Candidatura recusada.");
    await recarregar?.();
  };

  const popupPlanoModal = popupPlano && (
    <div onClick={() => setPopupPlano(null)} style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(248,250,252,.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "0 20px 50px rgba(0,0,0,.14)", width: "100%", maxWidth: 420, padding: "28px 26px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          {popupPlano === "sem-ia" ? <Sparkles size={22} color="var(--brand)" /> : <Wallet size={22} color="var(--brand)" />}
        </div>
        <h3 className="vx-disp" style={{ margin: "0 0 6px", fontSize: 18 }}>
          {popupPlano === "sem-ia" ? "Criação com IA é dos planos superiores" : "Assine um plano para publicar"}
        </h3>
        <p className="vx-mut" style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.6 }}>
          {popupPlano === "sem-ia"
            ? `A criação de campanha com inteligência artificial está disponível nos planos ${PLANOS_COM_IA.join(" e ")}. Faça upgrade para usar.`
            : "Você pode criar e salvar campanhas como rascunho sem plano. Para publicar e deixá-la visível aos profissionais, é preciso ter um plano ativo."}
        </p>
        <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => { setPopupPlano(null); irParaPlano?.(); }}>Ver planos</button>
        <button className="vx-btn vx-btn-block" style={{ marginTop: 8 }} onClick={() => setPopupPlano(null)}>Agora não</button>
      </div>
    </div>
  );

  if (criando) return (
    <NovaCampanha
      emp={emp}
      aviso={aviso}
      iniciarComIA={criarComIA}
      aoCancelar={() => { setCriando(false); setCriarComIA(false); }}
      aoCriar={(criada) => {
        up((d) => ({ campaigns: [...(d.campaigns || []), criada] }));
        setSelecionada(criada.id);
        setEdicao(criada);
        setCriando(false);
        setCriarComIA(false);
        setModo("editor");
        setRecarregarDashboard((n) => n + 1);
        aviso("Campanha criada como rascunho. Adicione o treinamento para publicar.");
      }}
    />
  );

  const arquivarCampanha = async (c) => {
    if (!window.confirm(`Arquivar "${c.titulo || "esta campanha"}"? Ela ficará como encerrada.`)) return;
    const r = await api(`/campaigns/${c.id}/status`, { status: "encerrada" });
    if (!r || r.error) return aviso(r?.error || "Não foi possível arquivar a campanha.");
    up((d) => ({ campaigns: d.campaigns.map((x) => x.id === c.id ? { ...x, status: "encerrada" } : x) }));
    aviso("Campanha arquivada.");
  };

  const excluirCampanha = async (c) => {
    if (!window.confirm(`Excluir "${c.titulo || "esta campanha"}"? Esta ação não pode ser desfeita.`)) return;
    const r = await api(`/campaigns/${c.id}/status`, { status: "cancelada" });
    if (!r || r.error) return aviso(r?.error || "Não foi possível excluir a campanha.");
    up((d) => ({ campaigns: d.campaigns.map((x) => x.id === c.id ? { ...x, status: "cancelada" } : x) }));
    aviso("Campanha excluída.");
  };

  if (modo === "lista") return <>
    <CampanhaLista
      campanhas={campanhas}
      onAbrir={(c) => { setSelecionada(c.id); setEdicao({ ...c }); setModo("detalhe"); }}
      onEditar={(c) => { setSelecionada(c.id); setEdicao({ ...c }); setModo("editor"); }}
      onCriar={(ia) => {
        // Campanha manual pode ser criada e salva como rascunho sem plano.
        // Só a criação com IA exige plano (e plano com IA).
        if (ia) {
          if (bloqueado) { setPopupPlano("sem-plano"); return; }
          if (!temIA) { setPopupPlano("sem-ia"); return; }
        }
        setCriarComIA(ia); setCriando(true);
      }}
      onArquivar={arquivarCampanha}
      onExcluir={excluirCampanha}
    />
    {popupPlanoModal}
  </>;

  if (modo === "detalhe" && existente) return <>
    <CampaignDetail
      campanha={existente}
      db={db}
      onVoltar={() => setModo("lista")}
      onEditar={() => { setEdicao({ ...existente }); setModo("editor"); }}
      onStatus={mudarStatus}
    />
    {popupPlanoModal}
  </>;

  return <div className="vx-fade">
    <div className="vx-row" style={{ alignItems: "flex-start", gap: 16, marginBottom: 16 }}><div><button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ paddingLeft: 0, marginBottom: 4 }} onClick={() => setModo(existente ? "detalhe" : "lista")}>← {existente ? "Detalhe da campanha" : "Campanhas"}</button><div className="vx-eyebrow">Configuração da campanha</div><h2 className="vx-disp" style={{ fontSize: 24, margin: "5px 0" }}>{campanha.titulo || "Nova campanha"}</h2><p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>Ajuste orçamento, tarefas, evidências e treinamento.</p></div><button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => { setCriarComIA(false); setCriando(true); }}><Plus size={14} /> Nova campanha</button></div>
    <div className="vx-card" style={{padding:14,marginBottom:14}}><div className="vx-row"><b>Progresso da campanha</b><span className="vx-chip vx-mono">{concluidos}/10 {alterado?"· não salvo":"· salvo"}</span></div><div className="vx-meter-track" style={{margin:"10px 0"}}><div className="vx-meter-fill" style={{width:`${concluidos*10}%`,background:"var(--brand)"}}/></div><div className="vx-steps">{passos.map((p,i)=><span key={p} data-done={i<concluidos?"1":"0"}>{i+1}. {p}</span>)}</div></div>

    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10 }}>{campanhas.map((c) => <button key={c.id} className="vx-btn vx-btn-sm" onClick={() => { setSelecionada(c.id); setEdicao({ ...c }); }} style={{ borderColor: selecionada === c.id ? "var(--brand)" : undefined }}>{c.titulo} · {c.status}</button>)}</div>

    <div className="vx-grid vx-g2">
      <section className="vx-card" style={{ padding: 18 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 12 }}>Identidade e público</div>
        <label><div className="vx-label">Título</div><input className="vx-input" value={campanha.titulo} onChange={(e) => set("titulo", e.target.value)} /></label>
        <label style={{ display: "block", marginTop: 10 }}><div className="vx-label">Objetivo</div><input className="vx-input" value={campanha.objetivo} onChange={(e) => set("objetivo", e.target.value)} /></label>
        <label style={{ display: "block", marginTop: 10 }}><div className="vx-label">Descrição</div><textarea className="vx-input" style={{ minHeight: 72 }} value={campanha.descricao} onChange={(e) => set("descricao", e.target.value)} /></label>
        <div className="vx-grid vx-g2" style={{ marginTop: 10 }}><label><div className="vx-label">Função</div><select className="vx-input" value={campanha.funcao} onChange={(e) => set("funcao", e.target.value)}><option value="sdr">SDR</option><option value="bdr">BDR</option><option value="closer">Closer</option><option value="pap">PAP</option></select></label><label><div className="vx-label">Região</div><input className="vx-input" value={campanha.regiao} onChange={(e) => set("regiao", e.target.value)} /></label></div>
        <label style={{ display: "block", marginTop: 10 }}><div className="vx-label">ICP da campanha</div><textarea className="vx-input" style={{ minHeight: 72 }} value={campanha.publico} onChange={(e) => set("publico", e.target.value)} /></label>
      </section>

      <section className="vx-card" style={{ padding: 18 }}>
        <div className="vx-row"><div className="vx-disp" style={{ fontSize: 17 }}>Orçamento</div><span className="vx-chip"><Wallet size={12} /> {disponivel === Infinity ? "Sem limite de caixa" : `${money(disponivel)} disponível`}</span></div>
        <div className="vx-grid vx-g2" style={{ marginTop: 12 }}><label><div className="vx-label">Limite da campanha</div><input className="vx-input vx-mono" type="number" min="0" value={campanha.orcamento} onChange={(e) => set("orcamento", Number(e.target.value))} /></label><label><div className="vx-label">Vagas</div><input className="vx-input vx-mono" type="number" min="1" value={campanha.vagas} onChange={(e) => set("vagas", Number(e.target.value))} /></label></div>
        <div className="vx-grid vx-g2" style={{ marginTop: 10 }}>{ORDEM_ACOES.map((k)=><label key={k}><div className="vx-label">{ACOES[k].nome}</div><input className="vx-input vx-mono" type="number" min="0" value={campanha.tarefas?.[k] || 0} onChange={(e) => set("tarefas", { ...campanha.tarefas, [k]: Number(e.target.value) })} /></label>)}</div>
        <div className="vx-grid vx-g3" style={{ marginTop: 10 }}><label><div className="vx-label">Prazo em horas</div><input className="vx-input vx-mono" type="number" min="1" value={campanha.prazoHoras} onChange={(e) => set("prazoHoras", Number(e.target.value))} /></label><label><div className="vx-label">Duração (dias)</div><input className="vx-input vx-mono" type="number" min="1" value={campanha.duracaoDias || 30} onChange={(e) => set("duracaoDias", Number(e.target.value))} /></label><label><div className="vx-label">Limite por profissional</div><input className="vx-input vx-mono" type="number" min="0" value={campanha.limitePorProfissional} onChange={(e) => set("limitePorProfissional", Number(e.target.value))} /></label></div>
        <label style={{ display: "flex", gap: 8, marginTop: 13, fontSize: 13 }}><input type="checkbox" checked={campanha.aceitaLeadProprio} onChange={(e) => set("aceitaLeadProprio", e.target.checked)} /> Aceitar prospecção própria</label>
        <label style={{ display: "flex", gap: 8, marginTop: 9, fontSize: 13 }}><input type="checkbox" checked={campanha.exigeCertificacao} onChange={(e) => set("exigeCertificacao", e.target.checked)} /> Exigir certificação</label>
      </section>
    </div>

    <section className="vx-card" style={{ padding: 18, marginTop: 16 }}><div className="vx-row"><div><div className="vx-disp" style={{ fontSize: 17 }}>Treinamento específico</div><div className="vx-mut" style={{ fontSize: 12 }}>Ao menos um módulo é obrigatório para publicar.</div></div><button className="vx-btn vx-btn-sm" onClick={adicionarModulo}><Plus size={14} /> Módulo</button></div>{(campanha.treinamento || []).map((m, i) => <div key={m.id} className="vx-grid vx-g2" style={{ marginTop: 10 }}><input className="vx-input" placeholder="Título" value={m.titulo} onChange={(e) => set("treinamento", campanha.treinamento.map((x, n) => n === i ? { ...x, titulo: e.target.value } : x))} /><input className="vx-input" placeholder="Conteúdo ou URL" value={m.conteudo} onChange={(e) => set("treinamento", campanha.treinamento.map((x, n) => n === i ? { ...x, conteudo: e.target.value } : x))} /></div>)}</section>

    <section className="vx-card" style={{ padding: 18, marginTop: 16 }}>
      <div className="vx-row" style={{ marginBottom: 12 }}>
        <div><div className="vx-disp" style={{ fontSize: 17 }}>Etapas do pipeline</div><div className="vx-mut" style={{ fontSize: 12 }}>Obrigatório para publicar. Configure as etapas do funil desta campanha.</div></div>
        <GitBranch size={18} color="var(--brand)" />
      </div>
      <EditorEtapas
        etapas={(Array.isArray(campanha.etapasPipeline) && campanha.etapasPipeline.length > 0) ? campanha.etapasPipeline : [
          { id: "novo", nome: "Novo", cor: "#8496B4" },
          { id: "contatado", nome: "Contatado", cor: "#5B8CFF" },
          { id: "respondeu", nome: "Respondeu", cor: "#9AA6FF" },
          { id: "reuniao", nome: "Reunião", cor: "#9AA6FF" },
          { id: "proposta", nome: "Proposta", cor: "#F0B45E" },
          { id: "fechado", nome: "Fechado", cor: "#5FD3A0" },
          { id: "perdido", nome: "Perdido", cor: "#FF8A7A" },
        ]}
        onChange={(etapas) => {
          set("etapasPipeline", etapas);
        }}
        onClose={null}
      />
    </section>

    {!!existente?.candidaturas?.length && <section className="vx-card" style={{ padding: 18, marginTop: 16 }}>
      <div className="vx-disp" style={{ fontSize: 17, marginBottom: 10 }}>Candidaturas</div>
      <div className="vx-grid">
        {existente.candidaturas.map((app) => {
          const profissional = db.sellers.find((s) => s.id === app.sellerId);
          return <div key={app.id} className="vx-row" style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
            <div><b style={{ fontSize: 13.5 }}>{profissional?.nome || "Profissional"}</b><div className="vx-mut" style={{ fontSize: 12 }}>{app.status}</div></div>
            {app.status === "pendente" && <div style={{ display: "flex", gap: 7 }}><button className="vx-btn vx-btn-sm" onClick={() => decidirCandidatura(app, "recusado")}>Recusar</button><button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => decidirCandidatura(app, "aprovado")}>Aprovar</button></div>}
          </div>;
        })}
      </div>
    </section>}

    <section className="vx-card" style={{ padding: 16, marginTop: 16, borderColor: check.ok ? "var(--brand)" : "var(--amber)" }}><div style={{ display: "flex", gap: 9 }}><ClipboardCheck size={18} color={check.ok ? "var(--brand)" : "var(--amber)"} /><div><b>{check.ok ? "Pronta para publicar" : "Pendências de publicação"}</b>{!check.ok && <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 3 }}>{check.pendencias.join(" · ")}</div>}</div></div></section>
    <div style={{ display: "flex", gap: 9, marginTop: 16 }}><button className="vx-btn vx-btn-primary" onClick={salvar}><Save size={14} /> Salvar</button>{campanha.status === "ativa" ? <button className="vx-btn" onClick={() => mudarStatus("pausada")}><CirclePause size={14} /> Pausar</button> : <button className="vx-btn" disabled={!check.ok} onClick={() => mudarStatus("ativa")}><Rocket size={14} /> Publicar</button>}</div>
    {popupPlanoModal}
  </div>;
}

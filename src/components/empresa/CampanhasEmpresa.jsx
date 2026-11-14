import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Archive, ChevronDown, CirclePause, ClipboardCheck, FileText, GitBranch, LayoutGrid, List, MapPin, Megaphone, MoreHorizontal, Pause, Play, Plus, Rocket, Save, Search, SearchX, SlidersHorizontal, Sparkles, Users, UserCheck, Wallet, Clock } from "lucide-react";
import { EditorEtapas } from "./PipelineKanban.jsx";
import { api, apiPatch } from "../../lib/api.js";
import { lerJson, gravarJson, remover as removerArmazenado } from "../../lib/armazenamento.js";
import { campanhaPodeSerPublicada, saldoDisponivel } from "../../../shared/empresa.js";
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

function MenuCampanha({ campanha, onVisualizar, onEditar, onArquivar, onExcluir, onStatus }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  const arquivavel = campanha.status !== "encerrada" && campanha.status !== "cancelada";
  const opcoes = [
    { label: "Visualizar", acao: () => { setAberto(false); onVisualizar?.(campanha); } },
    { label: "Editar", acao: () => { setAberto(false); onEditar(campanha); } },
    campanha.status === "ativa" && { label: "Pausar", acao: () => { setAberto(false); onStatus?.(campanha, "pausada"); } },
    campanha.status === "pausada" && { label: "Retomar", acao: () => { setAberto(false); onStatus?.(campanha, "ativa"); } },
    arquivavel && { label: "Arquivar", acao: () => { setAberto(false); onArquivar(campanha); }, cor: "var(--muted)" },
    { label: "Excluir", acao: () => { setAberto(false); onExcluir(campanha); }, cor: "var(--red)" },
  ].filter(Boolean);

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

// Submissões "em execução": enviadas e ainda no fluxo, antes da decisão final.
const EM_EXECUCAO = ["analisando", "ia_aprovado", "revisao", "conferido"];
const FUNCAO_LABEL = { sdr: "SDR", bdr: "BDR", closer: "Closer", pap: "PAP" };

// Menu "+ Nova campanha": um botão só, com IA e manual no dropdown.
function NovaCampanhaMenu({ onCriar }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  const opcoes = [
    { Icon: Sparkles, titulo: "Criar com IA", desc: "Estruture sua campanha com inteligência artificial.", ia: true },
    { Icon: SlidersHorizontal, titulo: "Criar manualmente", desc: "Configure sua campanha do zero.", ia: false },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="vx-btn vx-btn-primary" aria-expanded={aberto}
        style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
        onClick={() => setAberto((v) => !v)}>
        <Plus size={15} /> Nova campanha <ChevronDown size={14} style={{ transition: "transform .15s", transform: aberto ? "rotate(180deg)" : "none" }} />
      </button>
      {aberto && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60, width: 288,
          background: "var(--surface-solid)", border: "1px solid var(--border)", borderRadius: 12,
          boxShadow: "0 12px 32px rgba(17,24,39,.14)", overflow: "hidden", padding: 6 }}>
          {opcoes.map(({ Icon, titulo, desc, ia }) => (
            <button key={titulo} type="button" onClick={() => { setAberto(false); onCriar(ia); }}
              style={{ display: "flex", gap: 11, width: "100%", textAlign: "left", padding: "10px 11px",
                border: "none", background: "transparent", borderRadius: 9, cursor: "pointer", transition: "background .15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--brand-50)", color: "var(--brand)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={16} /></span>
              <span>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{titulo}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.35 }}>{desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Card indicador do topo (Campanhas ativas, Candidaturas pendentes, Tarefas em execução).
function IndicadorTopo({ label, valor, descricao, Icon, destaque }) {
  return (
    <div style={{ background: "var(--surface)", border: `1px solid ${destaque ? "var(--brand-200)" : "var(--border)"}`, borderRadius: 12, padding: "15px 16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{label}</span>
        <Icon size={16} strokeWidth={2} color={destaque ? "var(--brand)" : "var(--muted)"} aria-hidden="true" />
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: destaque ? "var(--brand)" : "var(--ink)", fontVariantNumeric: "tabular-nums", letterSpacing: -0.4, marginTop: 8 }}>{valor}</div>
      {descricao && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{descricao}</div>}
    </div>
  );
}

// Mini-indicadores reais de uma campanha.
function statsDe(c, porCampanha) {
  const cands = c.candidaturas || [];
  const ex = porCampanha.get(c.id) || { concluidas: 0, emExecucao: 0 };
  return {
    recebidas: cands.length,
    ativos: cands.filter((a) => a.status === "aprovado").length,
    pendentes: cands.filter((a) => a.status === "pendente").length,
    concluidas: ex.concluidas,
  };
}

function MiniIndicadores({ s }) {
  const itens = [
    ["Candidaturas", s.recebidas],
    ["Profiss. ativos", s.ativos],
    ["Tarefas concl.", s.concluidas],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {itens.map(([label, val]) => (
        <div key={label} style={{ background: "var(--surface-2)", borderRadius: 9, padding: "9px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{val}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1, textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function InfoCampanha({ c }) {
  const chips = [
    c.funcao && [Users, FUNCAO_LABEL[c.funcao] || c.funcao.toUpperCase()],
    c.regiao && [MapPin, c.regiao],
    c.duracaoDias && [Clock, `${c.duracaoDias} dias`],
  ].filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
      {chips.map(([Icon, label], i) => <MetricChip key={i} icon={Icon} label={label} />)}
    </div>
  );
}

// Liga/desliga de candidaturas, no topo do card ao lado do menu. On = abertas
// (recebendo profissionais); off = encerradas.
function ToggleCandidaturas({ c, onToggle }) {
  const aberta = c.candidaturasAbertas !== false;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aberta}
      title={aberta ? "Candidaturas abertas — clique para encerrar" : "Candidaturas encerradas — clique para reabrir"}
      aria-label={aberta ? "Encerrar candidaturas" : "Reabrir candidaturas"}
      onClick={(e) => { e.stopPropagation(); onToggle?.(c); }}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", cursor: "pointer", padding: "2px 4px" }}
    >
      <UserCheck size={14} color={aberta ? "var(--brand)" : "var(--muted)"} strokeWidth={2.2} />
      <span style={{ position: "relative", width: 32, height: 18, borderRadius: 999, flexShrink: 0, background: aberta ? "var(--brand)" : "var(--surface-3, #cbd5e1)", transition: "background .18s" }}>
        <span style={{ position: "absolute", top: 2, left: aberta ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)", transition: "left .18s" }} />
      </span>
    </button>
  );
}

function CampanhaCard({ c, s, onAbrir, onCandidaturas, onToggleCandidaturas, menu }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12, transition: "border-color .15s, box-shadow .15s" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand-200)"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(17,24,39,.05)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <StatusBadge status={c.status} />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <ToggleCandidaturas c={c} onToggle={onToggleCandidaturas} />
          {menu}
        </div>
      </div>
      <div onClick={() => onAbrir(c)} style={{ cursor: "pointer", flex: 1 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3, letterSpacing: -0.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.titulo || "Sem título"}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.45, minHeight: 34, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.descricao || c.objetivo || "Sem descrição."}</div>
        <div style={{ marginTop: 10 }}><InfoCampanha c={c} /></div>
      </div>
      <MiniIndicadores s={s} />
      <div style={{ display: "flex", gap: 8 }}>
        <button className="vx-btn vx-btn-primary vx-btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => onAbrir(c)}>Gerenciar campanha</button>
        <button className="vx-btn vx-btn-sm" style={{ justifyContent: "center", whiteSpace: "nowrap" }} onClick={() => onCandidaturas(c)}>
          Candidaturas{s.pendentes > 0 && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "var(--brand-50)", color: "var(--brand)" }}>{s.pendentes}</span>}
        </button>
      </div>
    </div>
  );
}

function CampanhaRow({ c, s, onAbrir, onCandidaturas, onToggleCandidaturas, menu }) {
  const col = (val, label) => (
    <div style={{ textAlign: "center", minWidth: 70 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{val}</div>
      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</div>
    </div>
  );
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <div onClick={() => onAbrir(c)} style={{ flex: 1, minWidth: 180, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusBadge status={c.status} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.titulo || "Sem título"}</div>
      </div>
      <div style={{ display: "flex", gap: 18 }}>
        {col(s.recebidas, "Candidat.")}
        {col(s.ativos, "Ativos")}
        {col(s.concluidas, "Concl.")}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="vx-btn vx-btn-sm" onClick={() => onCandidaturas(c)} style={{ whiteSpace: "nowrap" }}>
          Candidaturas{s.pendentes > 0 && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "var(--brand-50)", color: "var(--brand)" }}>{s.pendentes}</span>}
        </button>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => onAbrir(c)} style={{ whiteSpace: "nowrap" }}>Gerenciar</button>
        <ToggleCandidaturas c={c} onToggle={onToggleCandidaturas} />
        {menu}
      </div>
    </div>
  );
}

const VISTA_KEY = "rycs-campanhas-vista";

function CampanhaLista({ campanhas, submissions, onAbrir, onEditar, onCriar, onArquivar, onExcluir, onToggleCandidaturas, onStatus, onCandidaturas, filtroBar }) {
  const [filtro, setFiltro] = useState("");
  const [arquivadas, setArquivadas] = useState(false);
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");
  const [vista, setVista] = useState(() => (lerJson(VISTA_KEY, "grade") === "lista" ? "lista" : "grade"));

  useEffect(() => { const t = setTimeout(() => setBuscaDeb(busca.trim().toLowerCase()), 200); return () => clearTimeout(t); }, [busca]);
  const trocarVista = (v) => { setVista(v); gravarJson(VISTA_KEY, v); };

  const porCampanha = useMemo(() => {
    const m = new Map();
    for (const sub of submissions) {
      const e = m.get(sub.campaignId) || { concluidas: 0, emExecucao: 0 };
      if (sub.status === "liberado") e.concluidas++;
      else if (EM_EXECUCAO.includes(sub.status)) e.emExecucao++;
      m.set(sub.campaignId, e);
    }
    return m;
  }, [submissions]);

  const counts = useMemo(() => Object.fromEntries(
    FILTROS_STATUS.slice(1).map(([k]) => [k, campanhas.filter((c) => c.status === k).length])
  ), [campanhas]);

  // Indicadores do topo (dados reais)
  const ativas = campanhas.filter((c) => c.status === "ativa").length;
  // Profissionais trabalhando: distintos aprovados nas campanhas publicadas.
  const profissionaisTrabalhando = useMemo(() => {
    const set = new Set();
    for (const c of campanhas) if (c.status === "ativa") for (const a of (c.candidaturas || [])) if (a.status === "aprovado") set.add(a.sellerId);
    return set.size;
  }, [campanhas]);
  const tarefasExecucao = submissions.filter((sub) => EM_EXECUCAO.includes(sub.status)).length;

  // Arquivadas (encerrada/cancelada) só aparecem quando o usuário pede.
  const ARQUIVADAS = ["encerrada", "cancelada"];
  const visiveis = useMemo(() => {
    let r = campanhas;
    if (arquivadas) r = r.filter((c) => ARQUIVADAS.includes(c.status));
    else r = r.filter((c) => !ARQUIVADAS.includes(c.status));
    if (filtro) r = r.filter((c) => c.status === filtro);
    if (buscaDeb) r = r.filter((c) => [c.titulo, c.objetivo, c.descricao, c.regiao, c.funcao]
      .some((v) => String(v || "").toLowerCase().includes(buscaDeb)));
    return r;
  }, [campanhas, arquivadas, filtro, buscaDeb]);

  const pills = arquivadas
    ? FILTROS_STATUS.filter(([k]) => k === "" || ARQUIVADAS.includes(k))
    : FILTROS_STATUS.filter(([k]) => !ARQUIVADAS.includes(k));

  const menuDe = (c) => (
    <MenuCampanha campanha={c} onVisualizar={onAbrir} onEditar={onEditar} onArquivar={onArquivar}
      onExcluir={onExcluir} onStatus={onStatus} />
  );

  return (
    <div className="vx-fade">
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px", letterSpacing: -0.4 }}>Campanhas</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Crie, acompanhe e gerencie suas operações comerciais.</p>
        </div>
        {campanhas.length > 0 && <NovaCampanhaMenu onCriar={onCriar} />}
      </div>

      {/* Linha 1 — indicadores */}
      {campanhas.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 16 }}>
          <IndicadorTopo label="Campanhas ativas" valor={ativas} descricao="Operações em andamento" Icon={Megaphone} />
          <IndicadorTopo label="Profissionais trabalhando" valor={profissionaisTrabalhando} descricao="Ativos nas campanhas publicadas" Icon={UserCheck} />
          <IndicadorTopo label="Tarefas em execução" valor={tarefasExecucao} descricao="Atividades em andamento" Icon={Activity} />
        </div>
      )}

      {/* Linha 2 — busca, período, arquivadas, vista */}
      {campanhas.length > 0 && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input className="vx-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar campanhas..."
              style={{ paddingLeft: 34, width: "100%", height: "auto", padding: "9px 12px 9px 34px" }} />
          </div>
          {filtroBar}
          <button type="button" className="vx-btn" aria-pressed={arquivadas}
            style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", borderColor: arquivadas ? "var(--brand)" : undefined, color: arquivadas ? "var(--brand)" : undefined }}
            onClick={() => { setArquivadas((v) => !v); setFiltro(""); }}>
            <Archive size={14} /> Arquivadas
            {(counts["encerrada"] + counts["cancelada"]) > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "var(--surface-2)", color: "var(--muted)" }}>{counts["encerrada"] + counts["cancelada"]}</span>}
          </button>
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 9, overflow: "hidden" }}>
            {[["grade", LayoutGrid], ["lista", List]].map(([v, Icon]) => (
              <button key={v} type="button" onClick={() => trocarVista(v)} aria-label={v === "grade" ? "Grade" : "Lista"} title={v === "grade" ? "Grade" : "Lista"}
                style={{ display: "grid", placeItems: "center", width: 34, height: 34, border: "none", cursor: "pointer",
                  background: vista === v ? "var(--brand-50)" : "transparent", color: vista === v ? "var(--brand)" : "var(--muted)" }}>
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pills de status */}
      {campanhas.length > 0 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2, marginBottom: 16 }}>
          {pills.map(([key, label]) => {
            const on = filtro === key;
            const total = key ? counts[key] : (arquivadas ? counts["encerrada"] + counts["cancelada"] : campanhas.length - counts["encerrada"] - counts["cancelada"]);
            return (
              <button key={key || "todas"} onClick={() => setFiltro(key)}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                  padding: "5px 12px", borderRadius: 20, border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`,
                  background: on ? "var(--brand)" : "var(--surface)", cursor: "pointer",
                  fontSize: 12.5, fontWeight: on ? 600 : 400, color: on ? "#fff" : "var(--ink)", transition: "all .15s" }}>
                {label}{total > 0 && <span style={{ fontSize: 11, opacity: on ? 0.85 : 0.6 }}>{total}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Estado vazio — nenhuma campanha criada */}
      {campanhas.length === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div onClick={() => onCriar(false)}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, transition: "border-color .15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}><SlidersHorizontal size={20} /></div>
            <h3 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>Criar campanha manual</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6, flex: 1 }}>Você monta a campanha do zero — objetivo, tarefas, remuneração e critérios. Controle total sobre cada detalhe.</p>
            <button className="vx-btn vx-btn-block" style={{ marginTop: 4 }}><SlidersHorizontal size={14} /> Criar manual</button>
          </div>
          <div onClick={() => onCriar(true)}
            style={{ background: "var(--brand-50)", border: "1.5px solid var(--brand-200)", borderRadius: 16, padding: 24, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, transition: "border-color .15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--brand-200)"; }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--brand-100)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}><Sparkles size={20} /></div>
            <h3 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>Criar campanha com IA</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6, flex: 1 }}>A inteligência artificial monta a campanha com base no seu negócio — você só revisa. Disponível em todos os planos, inclusive o gratuito.</p>
            <button className="vx-btn vx-btn-primary vx-btn-block"><Sparkles size={14} /> Criar com IA</button>
          </div>
        </div>
      )}

      {/* Nenhum resultado para busca/filtro */}
      {campanhas.length > 0 && visiveis.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
          <SearchX size={28} color="var(--muted)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>Nenhuma campanha encontrada</div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>Tente ajustar os filtros ou o termo pesquisado.</p>
          <button className="vx-btn vx-btn-sm" onClick={() => { setBusca(""); setFiltro(""); setArquivadas(false); }}>Limpar filtros</button>
        </div>
      )}

      {/* Lista de campanhas */}
      {visiveis.length > 0 && (vista === "grade" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {visiveis.map((c) => (
            <CampanhaCard key={c.id} c={c} s={statsDe(c, porCampanha)} onAbrir={onAbrir} onCandidaturas={onCandidaturas} onToggleCandidaturas={onToggleCandidaturas} menu={menuDe(c)} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visiveis.map((c) => (
            <CampanhaRow key={c.id} c={c} s={statsDe(c, porCampanha)} onAbrir={onAbrir} onCandidaturas={onCandidaturas} onToggleCandidaturas={onToggleCandidaturas} menu={menuDe(c)} />
          ))}
        </div>
      ))}
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

export default function CampanhasEmpresa({ emp, db, up, aviso, recarregar, filtroData, filtroBar, bloqueado, irParaPlano }) {
  const [popupPlano, setPopupPlano] = useState(null); // null | "sem-plano" (só publicação exige plano)
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
          <Wallet size={22} color="var(--brand)" />
        </div>
        <h3 className="vx-disp" style={{ margin: "0 0 6px", fontSize: 18 }}>Assine um plano para publicar</h3>
        <p className="vx-mut" style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.6 }}>
          Você pode criar campanhas (inclusive com IA) e salvar como rascunho sem plano. Para publicar e deixá-la visível aos profissionais, é preciso ter um plano ativo.
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

  const alternarCandidaturas = async (c) => {
    const abrir = c.candidaturasAbertas === false; // estava encerrada → reabrir
    const r = await apiPatch(`/campaigns/${c.id}`, { candidaturasAbertas: abrir });
    if (!r || r.error) return aviso(r?.error || "Não foi possível atualizar as candidaturas.");
    up((d) => ({ campaigns: d.campaigns.map((x) => x.id === c.id ? { ...x, candidaturasAbertas: abrir } : x) }));
    aviso(abrir ? "Candidaturas reabertas. Os profissionais já podem se candidatar." : "Candidaturas encerradas. A campanha aparece como encerrada para novos profissionais.");
  };

  const excluirCampanha = async (c) => {
    if (!window.confirm(`Excluir "${c.titulo || "esta campanha"}"? Esta ação não pode ser desfeita.`)) return;
    const r = await api(`/campaigns/${c.id}/status`, { status: "cancelada" });
    if (!r || r.error) return aviso(r?.error || "Não foi possível excluir a campanha.");
    up((d) => ({ campaigns: d.campaigns.map((x) => x.id === c.id ? { ...x, status: "cancelada" } : x) }));
    aviso("Campanha excluída.");
  };

  // Pausar/Retomar a partir do card — reutiliza o mesmo endpoint de status do editor.
  const mudarStatusCampanha = async (c, status) => {
    const r = await api(`/campaigns/${c.id}/status`, { status });
    if (!r || r.error) return aviso(r?.pendencias?.join(" · ") || r?.error || "Não foi possível alterar a campanha.");
    up((d) => ({ campaigns: d.campaigns.map((x) => x.id === c.id ? { ...x, status } : x) }));
    aviso(status === "ativa" ? "Campanha retomada." : status === "pausada" ? "Campanha pausada." : "Campanha atualizada.");
  };

  const abrirEditor = (c) => { setSelecionada(c.id); setEdicao({ ...c }); setModo("editor"); };

  if (modo === "lista") return <>
    <CampanhaLista
      campanhas={campanhas}
      submissions={(db.submissions || []).filter((s) => s.companyId === emp.id)}
      filtroBar={filtroBar}
      onAbrir={(c) => { setSelecionada(c.id); setEdicao({ ...c }); setModo("detalhe"); }}
      onEditar={abrirEditor}
      onCandidaturas={abrirEditor}
      onStatus={mudarStatusCampanha}
      onCriar={(ia) => {
        // Criar campanha (manual ou com IA) é liberado em todos os planos,
        // inclusive o gratuito: todo mundo tem direito à campanha criada por IA.
        // O plano e o caixa só pesam na hora de PUBLICAR, não de criar.
        setCriarComIA(ia); setCriando(true);
      }}
      onArquivar={arquivarCampanha}
      onExcluir={excluirCampanha}
      onToggleCandidaturas={alternarCandidaturas}
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

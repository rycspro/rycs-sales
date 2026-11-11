import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, CirclePause, ClipboardCheck, FileText, GitBranch, Megaphone, MoreHorizontal, Plus, Rocket, Save, Sparkles, Users, Wallet, MapPin, Clock } from "lucide-react";
import { EditorEtapas } from "./PipelineKanban.jsx";
import { api, apiPatch } from "../../lib/api.js";
import { lerJson, gravarJson, remover as removerArmazenado } from "../../lib/armazenamento.js";
import { campanhaPodeSerPublicada, saldoDisponivel } from "../../../shared/empresa.js";
import { planoTemIA, PLANOS_COM_IA } from "../../../shared/planos.js";
import { money } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import NovaCampanha from "./NovaCampanha.jsx";
import CampaignsDashboard from "./CampaignsDashboard.jsx";
import CampaignDetail from "./CampaignDetail.jsx";

// ── Status config ────────────────────────────────────────────────────
const STATUS_CONFIG = {
  ativa:    { i18n: "camp.status.published",  bg: "#DCFCE7", color: "#16A34A" },
  rascunho: { i18n: "camp.status.draft",      bg: "var(--surface-2)", color: "var(--muted)" },
  pausada:  { i18n: "camp.status.paused",     bg: "#FEF9C3", color: "#B45309" },
  encerrada:{ i18n: "camp.status.closed",     bg: "var(--surface-2)", color: "var(--muted)" },
  cancelada:{ i18n: "camp.status.cancelled",  bg: "#FEE2E2", color: "#DC2626" },
};

const FILTROS_STATUS_KEYS = [
  ["", "camp.filter.all"],
  ["rascunho", "camp.filter.draft"],
  ["ativa", "camp.filter.published"],
  ["pausada", "camp.filter.paused"],
  ["encerrada", "camp.filter.closed"],
  ["cancelada", "camp.filter.cancelled"],
];

function StatusBadge({ status }) {
  const { t } = useI18n();
  const cfg = STATUS_CONFIG[status] || { bg: "var(--surface-2)", color: "var(--muted)" };
  const label = cfg.i18n ? t(cfg.i18n) : status;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: cfg.bg, color: cfg.color }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      {label}
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
  const { t } = useI18n();
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  const opcoes = [
    { label: t("app.edit"), acao: () => { setAberto(false); onEditar(campanha); } },
    { label: t("camp.menu.archive"), acao: () => { setAberto(false); onArquivar(campanha); }, cor: "var(--muted)" },
    { label: t("app.delete"), acao: () => { setAberto(false); onExcluir(campanha); }, cor: "#DC2626" },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="vx-btn vx-btn-ghost vx-btn-sm"
        onClick={(e) => { e.stopPropagation(); setAberto((v) => !v); }}
        style={{ padding: "4px 6px", lineHeight: 1, color: "var(--muted)" }}
        title={t("camp.menu.moreOptions")}
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
  const { t } = useI18n();
  const [filtro, setFiltro] = useState("");

  const counts = useMemo(() => Object.fromEntries(
    FILTROS_STATUS_KEYS.slice(1).map(([k]) => [k, campanhas.filter((c) => c.status === k).length])
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
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", margin: "0 0 3px", letterSpacing: -0.3 }}>{t("camp.title")}</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{t("camp.subtitle")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setFiltro(filtro === "encerrada" ? "" : "encerrada")}
            title={t("camp.archived")}
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
            {filtro === "encerrada" ? t("camp.viewAll") : t("camp.archived")}
            {counts["encerrada"] > 0 && (
              <span style={{
                fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 20,
                background: filtro === "encerrada" ? "rgba(255,255,255,.25)" : "var(--border)",
                color: filtro === "encerrada" ? "#fff" : "var(--muted)",
              }}>{counts["encerrada"]}</span>
            )}
          </button>
          {campanhas.length > 0 && <>
            <button className="vx-btn vx-btn-sm" onClick={() => onCriar(false)}><Plus size={13} /> {t("camp.manual")}</button>
            <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => onCriar(true)}><Sparkles size={13} /> {t("camp.createWithAI")}</button>
          </>}
        </div>
      </div>

      {/* Stats strip */}
      {campanhas.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: t("camp.stats.published"), value: ativas, icon: Megaphone },
            { label: t("camp.stats.drafts"), value: rascunhos, icon: FileText },
            { label: t("camp.stats.pendingApps"), value: totalPendentes, icon: Users },
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
          {FILTROS_STATUS_KEYS.map(([key, i18nKey]) => {
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
                {t(i18nKey)}
                {count > 0 && <span style={{ fontSize: 11, opacity: ativa ? 0.85 : 0.6 }}>{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {visiveis.length === 0 && (campanhas.length === 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {/* Manual */}
          <div onClick={() => onCriar(false)}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, transition: "border-color .15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}><Plus size={20} /></div>
            <h3 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>{t("camp.empty.manualTitle")}</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6, flex: 1 }}>{t("camp.empty.manualDesc")}</p>
            <button className="vx-btn vx-btn-block" style={{ marginTop: 4 }}><Plus size={14} /> {t("camp.empty.manualBtn")}</button>
          </div>
          {/* IA */}
          <div onClick={() => onCriar(true)}
            style={{ background: "var(--brand-50)", border: "1.5px solid var(--brand-200)", borderRadius: 16, padding: 24, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, transition: "border-color .15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--brand-200)"; }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--brand-100)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}><Sparkles size={20} /></div>
            <h3 className="vx-disp" style={{ fontSize: 17, margin: 0 }}>{t("camp.empty.aiTitle")}</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6, flex: 1 }}>{t("camp.empty.aiDesc", { plans: PLANOS_COM_IA.join(` ${t("camp.and")} `) })}</p>
            <button className="vx-btn vx-btn-primary vx-btn-block"><Sparkles size={14} /> {t("camp.createWithAI")}</button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "48px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>{t("camp.empty.noFilter")}</div>
          <button className="vx-btn vx-btn-sm" style={{ marginTop: 10 }} onClick={() => setFiltro("")}>{t("camp.viewAll")}</button>
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
                style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 18px", cursor: "pointer", transition: "border-color .15s, box-shadow .15s", display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <StatusBadge status={c.status} />
                  <MenuCampanha
                    campanha={c}
                    onEditar={onEditar}
                    onArquivar={onArquivar}
                    onExcluir={onExcluir}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>{c.titulo || t("camp.untitled")}</div>
                  {c.objetivo && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.objetivo}</div>}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                  {c.funcao && <MetricChip icon={Users} label={c.funcao.toUpperCase()} />}
                  {c.regiao && <MetricChip icon={MapPin} label={c.regiao} />}
                  {c.duracaoDias && <MetricChip icon={Clock} label={t("camp.days", { n: c.duracaoDias })} />}
                  {c.vagas > 0 && <MetricChip icon={Users} label={t("camp.slots", { n: c.vagas })} />}
                </div>

                {pendentes > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#EFF6FF", borderRadius: "var(--radius-sm)", fontSize: 12, color: "#1D4ED8", fontWeight: 500 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D4ED8", flexShrink: 0 }} />
                    {t("camp.pendingApps", { n: pendentes })}
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
  const { t } = useI18n();
  const [popupPlano, setPopupPlano] = useState(null);
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
  const passos=[t("camp.step.info"),t("camp.step.objective"),t("camp.step.professionals"),t("camp.step.leads"),t("camp.step.academy"),t("camp.step.tasks"),t("camp.step.approvals"),t("camp.step.budget"),t("camp.step.review"),t("camp.step.publish")];
  const concluidos=[campanha.titulo,campanha.publico,true,true,(campanha.treinamento||[]).length,Object.values(campanha.tarefas||{}).some(Number),campanha.criteriosAprovacao,campanha.orcamento,check.pendencias.length===0,campanha.status==="ativa"].filter(Boolean).length;

  const salvar = async () => {
    if (!campanha.titulo.trim()) return aviso(t("camp.toast.needTitle"));
    let r;
    if (existente) r = await apiPatch(`/campaigns/${existente.id}`, campanha);
    else r = await api("/campaigns", campanha);
    if (!r || r.error) return aviso(r?.error || t("camp.toast.saveFailed"));
    if (existente) {
      up((d) => ({ campaigns: d.campaigns.map((c) => c.id === existente.id ? { ...c, ...campanha } : c) }));
    } else {
      const criada = { ...campanha, id: r.id, companyId: emp.id, status: "rascunho", criadoEm: Date.now() };
      up((d) => ({ campaigns: [...(d.campaigns || []), criada] }));
      setSelecionada(r.id); setEdicao(criada); setRascunhoNovo(novaCampanha(emp));
    }
    aviso(t("camp.toast.savedDraft"));
    setAlterado(false);removerArmazenado(`rycs-campanha-${emp.id}`);
    return r.id || existente.id;
  };
  const mudarStatus = async (status) => {
    if (status === "ativa" && bloqueado) { setPopupPlano("sem-plano"); return; }
    const id = existente?.id || await salvar();
    if (!id) return;
    if (existente) await apiPatch(`/campaigns/${id}`, campanha);
    const r = await api(`/campaigns/${id}/status`, { status });
    if (!r || r.error) return aviso(r?.pendencias?.join(" · ") || r?.error || t("camp.toast.statusFailed"));
    up((d) => ({ campaigns: d.campaigns.map((c) => c.id === id ? { ...c, ...campanha, status } : c) }));
    setEdicao((c) => c ? { ...c, status } : c);
    aviso(status === "ativa" ? t("camp.toast.published") : t("camp.toast.paused"));
  };
  const adicionarModulo = () => set("treinamento", [...(campanha.treinamento || []), { id: `mod-${Date.now()}`, titulo: "", conteudo: "" }]);
  const decidirCandidatura = async (app, status) => {
    const r = await apiPatch(`/campaigns/${campanha.id}/applications/${app.id}`, { status });
    if (!r || r.error) return aviso(r?.error || t("camp.toast.appDecisionFailed"));
    aviso(status === "aprovado" ? t("camp.toast.proApproved") : t("camp.toast.appRejected"));
    await recarregar?.();
  };

  const popupPlanoModal = popupPlano && (
    <div onClick={() => setPopupPlano(null)} style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(248,250,252,.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "0 20px 50px rgba(0,0,0,.14)", width: "100%", maxWidth: 420, padding: "28px 26px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          {popupPlano === "sem-ia" ? <Sparkles size={22} color="var(--brand)" /> : <Wallet size={22} color="var(--brand)" />}
        </div>
        <h3 className="vx-disp" style={{ margin: "0 0 6px", fontSize: 18 }}>
          {popupPlano === "sem-ia" ? t("camp.popup.aiPlansOnly") : t("camp.popup.subscribeToPub")}
        </h3>
        <p className="vx-mut" style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.6 }}>
          {popupPlano === "sem-ia"
            ? t("camp.popup.aiPlansDesc", { plans: PLANOS_COM_IA.join(` ${t("camp.and")} `) })
            : t("camp.popup.subscribeDesc")}
        </p>
        <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => { setPopupPlano(null); irParaPlano?.(); }}>{t("camp.popup.viewPlans")}</button>
        <button className="vx-btn vx-btn-block" style={{ marginTop: 8 }} onClick={() => setPopupPlano(null)}>{t("camp.popup.notNow")}</button>
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
        aviso(t("camp.toast.createdDraft"));
      }}
    />
  );

  const arquivarCampanha = async (c) => {
    if (!window.confirm(t("camp.confirm.archive", { title: c.titulo || t("camp.thisOne") }))) return;
    const r = await api(`/campaigns/${c.id}/status`, { status: "encerrada" });
    if (!r || r.error) return aviso(r?.error || t("camp.toast.archiveFailed"));
    up((d) => ({ campaigns: d.campaigns.map((x) => x.id === c.id ? { ...x, status: "encerrada" } : x) }));
    aviso(t("camp.toast.archived"));
  };

  const excluirCampanha = async (c) => {
    if (!window.confirm(t("camp.confirm.delete", { title: c.titulo || t("camp.thisOne") }))) return;
    const r = await api(`/campaigns/${c.id}/status`, { status: "cancelada" });
    if (!r || r.error) return aviso(r?.error || t("camp.toast.deleteFailed"));
    up((d) => ({ campaigns: d.campaigns.map((x) => x.id === c.id ? { ...x, status: "cancelada" } : x) }));
    aviso(t("camp.toast.deleted"));
  };

  if (modo === "lista") return <>
    <CampanhaLista
      campanhas={campanhas}
      onAbrir={(c) => { setSelecionada(c.id); setEdicao({ ...c }); setModo("detalhe"); }}
      onEditar={(c) => { setSelecionada(c.id); setEdicao({ ...c }); setModo("editor"); }}
      onCriar={(ia) => {
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
    <div className="vx-row" style={{ alignItems: "flex-start", gap: 16, marginBottom: 16 }}><div><button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ paddingLeft: 0, marginBottom: 4 }} onClick={() => setModo(existente ? "detalhe" : "lista")}>← {existente ? t("camp.editor.backDetail") : t("camp.title")}</button><div className="vx-eyebrow">{t("camp.editor.config")}</div><h2 className="vx-disp" style={{ fontSize: 24, margin: "5px 0" }}>{campanha.titulo || t("camp.editor.newCampaign")}</h2><p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>{t("camp.editor.adjustDesc")}</p></div><button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => { setCriarComIA(false); setCriando(true); }}><Plus size={14} /> {t("camp.editor.newCampaign")}</button></div>
    <div className="vx-card" style={{padding:14,marginBottom:14}}><div className="vx-row"><b>{t("camp.editor.progress")}</b><span className="vx-chip vx-mono">{concluidos}/10 {alterado ? `· ${t("camp.editor.unsaved")}` : `· ${t("camp.editor.saved")}`}</span></div><div className="vx-meter-track" style={{margin:"10px 0"}}><div className="vx-meter-fill" style={{width:`${concluidos*10}%`,background:"var(--brand)"}}/></div><div className="vx-steps">{passos.map((p,i)=><span key={p} data-done={i<concluidos?"1":"0"}>{i+1}. {p}</span>)}</div></div>

    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10 }}>{campanhas.map((c) => <button key={c.id} className="vx-btn vx-btn-sm" onClick={() => { setSelecionada(c.id); setEdicao({ ...c }); }} style={{ borderColor: selecionada === c.id ? "var(--brand)" : undefined }}>{c.titulo} · {c.status}</button>)}</div>

    <div className="vx-grid vx-g2">
      <section className="vx-card" style={{ padding: 18 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 12 }}>{t("camp.editor.identity")}</div>
        <label><div className="vx-label">{t("camp.label.title")}</div><input className="vx-input" value={campanha.titulo} onChange={(e) => set("titulo", e.target.value)} /></label>
        <label style={{ display: "block", marginTop: 10 }}><div className="vx-label">{t("camp.label.objective")}</div><input className="vx-input" value={campanha.objetivo} onChange={(e) => set("objetivo", e.target.value)} /></label>
        <label style={{ display: "block", marginTop: 10 }}><div className="vx-label">{t("camp.label.description")}</div><textarea className="vx-input" style={{ minHeight: 72 }} value={campanha.descricao} onChange={(e) => set("descricao", e.target.value)} /></label>
        <div className="vx-grid vx-g2" style={{ marginTop: 10 }}><label><div className="vx-label">{t("camp.label.role")}</div><select className="vx-input" value={campanha.funcao} onChange={(e) => set("funcao", e.target.value)}><option value="sdr">SDR</option><option value="bdr">BDR</option><option value="closer">Closer</option><option value="pap">PAP</option></select></label><label><div className="vx-label">{t("camp.label.region")}</div><input className="vx-input" value={campanha.regiao} onChange={(e) => set("regiao", e.target.value)} /></label></div>
        <label style={{ display: "block", marginTop: 10 }}><div className="vx-label">{t("camp.label.icp")}</div><textarea className="vx-input" style={{ minHeight: 72 }} value={campanha.publico} onChange={(e) => set("publico", e.target.value)} /></label>
      </section>

      <section className="vx-card" style={{ padding: 18 }}>
        <div className="vx-row"><div className="vx-disp" style={{ fontSize: 17 }}>{t("camp.budget.title")}</div><span className="vx-chip"><Wallet size={12} /> {disponivel === Infinity ? t("camp.budget.noLimit") : t("camp.budget.available", { amount: money(disponivel) })}</span></div>
        <div className="vx-grid vx-g2" style={{ marginTop: 12 }}><label><div className="vx-label">{t("camp.budget.campaignLimit")}</div><input className="vx-input vx-mono" type="number" min="0" value={campanha.orcamento} onChange={(e) => set("orcamento", Number(e.target.value))} /></label><label><div className="vx-label">{t("camp.budget.slots")}</div><input className="vx-input vx-mono" type="number" min="1" value={campanha.vagas} onChange={(e) => set("vagas", Number(e.target.value))} /></label></div>
        <div className="vx-grid vx-g2" style={{ marginTop: 10 }}>{ORDEM_ACOES.map((k)=><label key={k}><div className="vx-label">{ACOES[k].nome}</div><input className="vx-input vx-mono" type="number" min="0" value={campanha.tarefas?.[k] || 0} onChange={(e) => set("tarefas", { ...campanha.tarefas, [k]: Number(e.target.value) })} /></label>)}</div>
        <div className="vx-grid vx-g3" style={{ marginTop: 10 }}><label><div className="vx-label">{t("camp.budget.deadlineHours")}</div><input className="vx-input vx-mono" type="number" min="1" value={campanha.prazoHoras} onChange={(e) => set("prazoHoras", Number(e.target.value))} /></label><label><div className="vx-label">{t("camp.budget.durationDays")}</div><input className="vx-input vx-mono" type="number" min="1" value={campanha.duracaoDias || 30} onChange={(e) => set("duracaoDias", Number(e.target.value))} /></label><label><div className="vx-label">{t("camp.budget.limitPerPro")}</div><input className="vx-input vx-mono" type="number" min="0" value={campanha.limitePorProfissional} onChange={(e) => set("limitePorProfissional", Number(e.target.value))} /></label></div>
        <label style={{ display: "flex", gap: 8, marginTop: 13, fontSize: 13 }}><input type="checkbox" checked={campanha.aceitaLeadProprio} onChange={(e) => set("aceitaLeadProprio", e.target.checked)} /> {t("camp.budget.ownProspecting")}</label>
        <label style={{ display: "flex", gap: 8, marginTop: 9, fontSize: 13 }}><input type="checkbox" checked={campanha.exigeCertificacao} onChange={(e) => set("exigeCertificacao", e.target.checked)} /> {t("camp.budget.requireCert")}</label>
      </section>
    </div>

    <section className="vx-card" style={{ padding: 18, marginTop: 16 }}><div className="vx-row"><div><div className="vx-disp" style={{ fontSize: 17 }}>{t("camp.training.title")}</div><div className="vx-mut" style={{ fontSize: 12 }}>{t("camp.training.required")}</div></div><button className="vx-btn vx-btn-sm" onClick={adicionarModulo}><Plus size={14} /> {t("camp.training.module")}</button></div>{(campanha.treinamento || []).map((m, i) => <div key={m.id} className="vx-grid vx-g2" style={{ marginTop: 10 }}><input className="vx-input" placeholder={t("camp.label.title")} value={m.titulo} onChange={(e) => set("treinamento", campanha.treinamento.map((x, n) => n === i ? { ...x, titulo: e.target.value } : x))} /><input className="vx-input" placeholder={t("camp.training.contentUrl")} value={m.conteudo} onChange={(e) => set("treinamento", campanha.treinamento.map((x, n) => n === i ? { ...x, conteudo: e.target.value } : x))} /></div>)}</section>

    <section className="vx-card" style={{ padding: 18, marginTop: 16 }}>
      <div className="vx-row" style={{ marginBottom: 12 }}>
        <div><div className="vx-disp" style={{ fontSize: 17 }}>{t("camp.pipeline.title")}</div><div className="vx-mut" style={{ fontSize: 12 }}>{t("camp.pipeline.required")}</div></div>
        <GitBranch size={18} color="var(--brand)" />
      </div>
      <EditorEtapas
        etapas={(Array.isArray(campanha.etapasPipeline) && campanha.etapasPipeline.length > 0) ? campanha.etapasPipeline : [
          { id: "novo", nome: t("camp.pipeline.new"), cor: "#8496B4" },
          { id: "contatado", nome: t("camp.pipeline.contacted"), cor: "#5B8CFF" },
          { id: "respondeu", nome: t("camp.pipeline.replied"), cor: "#9AA6FF" },
          { id: "reuniao", nome: t("camp.pipeline.meeting"), cor: "#9AA6FF" },
          { id: "proposta", nome: t("camp.pipeline.proposal"), cor: "#F0B45E" },
          { id: "fechado", nome: t("camp.pipeline.won"), cor: "#5FD3A0" },
          { id: "perdido", nome: t("camp.pipeline.lost"), cor: "#FF8A7A" },
        ]}
        onChange={(etapas) => {
          set("etapasPipeline", etapas);
        }}
        onClose={null}
      />
    </section>

    {!!existente?.candidaturas?.length && <section className="vx-card" style={{ padding: 18, marginTop: 16 }}>
      <div className="vx-disp" style={{ fontSize: 17, marginBottom: 10 }}>{t("camp.applications.title")}</div>
      <div className="vx-grid">
        {existente.candidaturas.map((app) => {
          const profissional = db.sellers.find((s) => s.id === app.sellerId);
          return <div key={app.id} className="vx-row" style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
            <div><b style={{ fontSize: 13.5 }}>{profissional?.nome || t("camp.applications.professional")}</b><div className="vx-mut" style={{ fontSize: 12 }}>{app.status}</div></div>
            {app.status === "pendente" && <div style={{ display: "flex", gap: 7 }}><button className="vx-btn vx-btn-sm" onClick={() => decidirCandidatura(app, "recusado")}>{t("camp.applications.reject")}</button><button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => decidirCandidatura(app, "aprovado")}>{t("camp.applications.approve")}</button></div>}
          </div>;
        })}
      </div>
    </section>}

    <section className="vx-card" style={{ padding: 16, marginTop: 16, borderColor: check.ok ? "var(--brand)" : "var(--amber)" }}><div style={{ display: "flex", gap: 9 }}><ClipboardCheck size={18} color={check.ok ? "var(--brand)" : "var(--amber)"} /><div><b>{check.ok ? t("camp.readyToPublish") : t("camp.publishPending")}</b>{!check.ok && <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 3 }}>{check.pendencias.join(" · ")}</div>}</div></div></section>
    <div style={{ display: "flex", gap: 9, marginTop: 16 }}><button className="vx-btn vx-btn-primary" onClick={salvar}><Save size={14} /> {t("app.save")}</button>{campanha.status === "ativa" ? <button className="vx-btn" onClick={() => mudarStatus("pausada")}><CirclePause size={14} /> {t("camp.pause")}</button> : <button className="vx-btn" disabled={!check.ok} onClick={() => mudarStatus("ativa")}><Rocket size={14} /> {t("camp.publish")}</button>}</div>
    {popupPlanoModal}
  </div>;
}

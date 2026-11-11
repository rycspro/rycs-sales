import { useState, useRef, useEffect } from "react";
import CidadeEstadoSelector from "./CidadeEstadoSelector.jsx";
import { Sparkles, ArrowRight, ArrowLeft, Check, Wallet, Loader, Target, CalendarCheck, MapPin, BadgeDollarSign, Workflow, Plus, Trash2, ShieldCheck, TrendingUp, BookOpen, ChevronDown, ChevronUp, Send, RotateCcw } from "lucide-react";
import { api } from "../../lib/api.js";
import ConversaJarvas from "./ConversaJarvas.jsx";
import { money } from "../../lib/utils.js";
import { useI18n } from "../../lib/i18n.jsx";
import { ACOES } from "../../lib/constants.js";
import { OBJETIVOS, ORDEM_OBJETIVOS, montarCampanha, custoEstimado } from "../../../shared/objetivosCampanha.js";
import { campanhaPodeSerPublicada, requisitosPublicacao, saldoDisponivel, isPosPago } from "../../../shared/empresa.js";
import { sugerirValores, sugerirValorVisita, impactoNoRoi } from "../../../shared/valorTarefa.js";
import { takeRateDoPlano } from "../../../shared/planos.js";

// Criação de campanha em três passos.
//
// A tela antiga pedia trinta campos de uma vez, sem hierarquia: título, prazo,
// evidência por ação e limite por profissional no mesmo nível de importância.
// Para quem contrata, isso é um formulário de configuração — não uma decisão
// comercial. E quem não sabe a diferença entre SDR e BDR erra a escolha ali,
// recebe o profissional errado e conclui que a plataforma não funciona.
//
// Aqui a pergunta é outra: o que você precisa que aconteça. O objetivo
// escolhido configura função, ações remuneradas, prova exigida e prazo. Sobra
// para a empresa decidir só o que é dela: para quem, onde, quanto.
//
// Os campos avançados continuam existindo — ficam no editor completo, depois
// que a campanha nasce. Nada foi removido, só tirado do caminho.

const PASSOS_KEYS = ["camp.new.step.objective", "camp.new.step.details", "camp.new.step.review"];

function formatarBRL(valor) {
  if (!valor && valor !== 0) return "";
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(str) {
  if (!str) return 0;
  return Number(String(str).replace(/\./g, "").replace(",", ".")) || 0;
}

function CampoOrcamento({ value, onChange }) {
  const [display, setDisplay] = useState(value > 0 ? formatarBRL(value) : "");
  const inputRef = useRef(null);
  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^\d,]/g, "");
    setDisplay(raw);
    onChange(parseBRL(raw));
  };
  const handleBlur = () => {
    const n = parseBRL(display);
    setDisplay(n > 0 ? formatarBRL(n) : "");
    onChange(n);
  };
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-2)", fontSize: 13.5, pointerEvents: "none", userSelect: "none" }}>R$</span>
      <input ref={inputRef} className="vx-input vx-mono" style={{ paddingLeft: 30 }}
        inputMode="decimal" value={display}
        onChange={handleChange} onBlur={handleBlur}
        placeholder="0,00" />
    </div>
  );
}
const ICONES_OBJETIVO = { leads: Target, reunioes: CalendarCheck, visitas: MapPin, vendas: BadgeDollarSign, completa: Workflow };

export default function NovaCampanha({ emp, aoCriar, aoCancelar, aviso, iniciarComIA = false }) {
  const { t } = useI18n();
  const [passo, setPasso] = useState(0);
  const [objetivo, setObjetivo] = useState(null);
  const [campanha, setCampanha] = useState(null);
  const [brief, setBrief] = useState("");
  const [gerando, setGerando] = useState(false);
  const [explicacao, setExplicacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [sugestaoIA, setSugestaoIA] = useState(null);
  const [mostrarSugestao, setMostrarSugestao] = useState(false);
  const [ticketLocal, setTicketLocal] = useState("");
  const [visitasPorDiaLocal, setVisitasPorDiaLocal] = useState("");
  const [gerandoTreinamento, setGerandoTreinamento] = useState(false);
  const [modeloTreinamento, setModeloTreinamento] = useState("rapido");

  const disponivel = saldoDisponivel(emp);
  const set = (k, v) => setCampanha((c) => ({ ...c, [k]: v }));

  const objAtual = campanha?.objetivoChave ? OBJETIVOS[campanha.objetivoChave] : null;
  const ehCampanhaVisita = objAtual?.usaVisitasPorDia || false;

  const calcularSugestaoIA = () => {
    const plano = emp.assinatura || "free";
    const ticketBase = ticketLocal
      ? parseBRL(ticketLocal)
      : Number(String(emp.ticket || "").replace(/\D/g, "")) || Number(emp.ticket) || 0;

    if (ehCampanhaVisita) {
      const vpd = Number(visitasPorDiaLocal) || 0;
      const orcBase = Number(campanha?.orcamento) || 0;
      const resultado = sugerirValorVisita({ orcamento: orcBase, visitasPorDia: vpd, ticketMedio: ticketBase, plano });
      setSugestaoIA({ ...resultado, tipo: "visita" });
      setMostrarSugestao(true);
    } else {
      const resultado = sugerirValores({ ticketMedio: ticketBase, margem: 0.3, plano });
      setSugestaoIA({ ...resultado, tipo: "reuniao" });
      setMostrarSugestao(true);
    }
  };

  const aceitarSugestaoIA = () => {
    if (!sugestaoIA?.disponivel || !campanha) return;
    const novasTarefas = { ...campanha.tarefas };
    if (sugestaoIA.tipo === "visita") {
      if (novasTarefas.visita !== undefined) novasTarefas.visita = sugestaoIA.valorVisita.bruto;
      if (novasTarefas.venda !== undefined) novasTarefas.venda = sugestaoIA.comissaoVenda.bruto;
    } else {
      sugestaoIA.tarefas?.forEach((st) => {
        if (novasTarefas[st.tipo] !== undefined) novasTarefas[st.tipo] = st.bruto;
      });
    }
    set("tarefas", novasTarefas);
    setMostrarSugestao(false);
  };

  const MODELOS_TREINAMENTO = {
    rapido: { nome: t("camp.new.trainingQuick"), descricao: t("camp.new.trainingQuickDesc") },
    completo: { nome: t("camp.new.trainingFull"), descricao: t("camp.new.trainingFullDesc") },
    quiz: { nome: t("camp.new.trainingQuiz"), descricao: t("camp.new.trainingQuizDesc") },
    script: { nome: t("camp.new.trainingScript"), descricao: t("camp.new.trainingScriptDesc") },
  };

  const gerarTreinamentoComIA = async () => {
    if (!campanha) return;
    setGerandoTreinamento(true);
    const r = await api("/campaigns/treinamento", {
      modelo: modeloTreinamento,
      campanha: {
        titulo: campanha.titulo,
        objetivo: campanha.objetivo,
        descricao: campanha.descricao,
        publico: campanha.publico,
        regiao: campanha.regiao,
        funcao: campanha.funcao,
      },
      empresa: {
        nome: emp.nome,
        produto: emp.produto,
        icp: emp.icp,
        ticket: emp.ticket,
      },
    });
    setGerandoTreinamento(false);
    if (!r || r.error) return;
    if (Array.isArray(r.modulos) && r.modulos.length > 0) {
      set("treinamento", r.modulos);
    }
  };

  const escolher = (chave) => {
    setObjetivo(chave);
    setCampanha(montarCampanha(chave, emp));
    setExplicacao("");
    setPasso(1);
  };

  const gerarComIA = async () => {
    if (brief.trim().length < 10) return aviso(t("camp.new.briefTooShort"));
    setGerando(true);
    const r = await api("/campaigns/sugerir", { brief });
    setGerando(false);
    if (!r || r.error) return aviso(r?.error || t("camp.new.errorBuildCampaign"));
    setObjetivo(r.campanha.objetivoChave);
    setCampanha(r.campanha);
    setExplicacao(r.explicacao);
    setPasso(1);
  };

  const receberCampanhaDoJarvas = (chaveObjetivo, campanhaMontada) => {
    setObjetivo(chaveObjetivo);
    setCampanha(campanhaMontada);
    setExplicacao("");
    setPasso(1);
  };

  const criar = async () => {
    if (!campanha?.titulo?.trim()) return aviso(t("camp.new.titleRequired"));
    setSalvando(true);
    const payload = { ...campanha };
    if (ehCampanhaVisita && visitasPorDiaLocal) payload.visitasPorDia = Number(visitasPorDiaLocal) || 0;
    const r = await api("/campaigns", payload);
    setSalvando(false);
    if (!r || r.error) return aviso(r?.error || t("camp.new.errorCreateCampaign"));
    aoCriar?.({ ...campanha, id: r.id, companyId: emp.id, status: "rascunho", criadoEm: Date.now() });
  };

  const obj = objetivo ? OBJETIVOS[objetivo] : null;
  const custo = campanha ? custoEstimado(campanha, campanha.limitePorProfissional || 10) : null;
  const checklist = campanha ? campanhaPodeSerPublicada(campanha, emp) : { ok: false, pendencias: [] };
  // Os itens do checklist vêm da mesma regra que decide a publicação. Antes
  // eram uma lista à parte, escrita aqui, e as duas discordavam: a empresa
  // premium via "Plano ativo" em vermelho num checklist que o servidor já
  // tinha aprovado.
  const requisitos = campanha ? requisitosPublicacao(campanha, emp) : [];
  const adicionarTreinamento = () => set("treinamento", [...(campanha.treinamento || []), { id: `mod-${Date.now()}`, titulo: "", conteudo: "" }]);
  const atualizarTreinamento = (indice, campo, valor) => set("treinamento", campanha.treinamento.map((item, i) => i === indice ? { ...item, [campo]: valor } : item));
  const removerTreinamento = (indice) => set("treinamento", campanha.treinamento.filter((_, i) => i !== indice));

  return (
    <div className="vx-fade vx-campaign-wizard">
      {/* trilha dos passos */}
      <div className="vx-wizard-steps">
        {PASSOS_KEYS.map((pk, i) => (
          <div key={pk} data-active={i === passo ? "1" : "0"} data-done={i < passo ? "1" : "0"}>
            <div>
              <span>{i < passo ? <Check size={12} /> : i + 1}</span>
              {t(pk)}
            </div>
            {i < PASSOS_KEYS.length - 1 && <i />}
          </div>
        ))}
      </div>

      {/* ---------------------------------------------- passo 1: objetivo */}
      {passo === 0 && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>{t("camp.new.title")}</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            {iniciarComIA
              ? t("camp.new.subtitleAI")
              : t("camp.new.subtitleManual")}
          </p>

          {/* Jarvas — conversa assistida por voz (somente no fluxo com IA) */}
          {iniciarComIA && (
            <div className="vx-card" style={{ padding: 20, marginTop: 4, borderColor: "var(--brand-200, var(--brand-100))", background: "linear-gradient(135deg, var(--brand-50) 0%, var(--indigo-50, var(--brand-50)) 100%)", borderWidth: 1.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                <b style={{ fontSize: 15 }}>Jarvas</b>
                <span className="vx-badge vx-badge-brand" style={{ fontSize: 11 }}>{t("camp.new.aiRecommended")}</span>
              </div>
              <ConversaJarvas emp={emp} onCampanha={receberCampanhaDoJarvas} />
            </div>
          )}

          {!iniciarComIA && <>
            <div className="vx-objective-grid">
              {ORDEM_OBJETIVOS.map((k) => {
                const o = OBJETIVOS[k];
                const Icone = ICONES_OBJETIVO[k] || Target;
                return (
                  <button key={k} className="vx-card vx-objective-card" onClick={() => escolher(k)}>
                    <span className="vx-objective-icon"><Icone size={19} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <b style={{ fontSize: 15 }}>{o.nome}</b>
                        <span className="vx-badge vx-badge-brand">{o.funcao.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>{o.resumo}</div>
                      <div className="vx-mut" style={{ fontSize: 12, marginTop: 6 }}>{o.paraQuem}</div>
                    </div>
                    <ArrowRight size={16} className="vx-objective-arrow" />
                  </button>
                );
              })}
            </div>
          </>}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 14 }}>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }} onClick={aoCancelar}>{t("common.cancel")}</button>
          </div>
        </>
      )}

      {/* ---------------------------------------------- passo 2: detalhes */}
      {passo === 1 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>{obj?.nome}</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            {t("camp.new.detailsSubtitle")}
          </p>

          {explicacao && (
            <div style={{ padding: "11px 14px", borderRadius: 10, background: "var(--brand-50)", border: "1px solid var(--brand-100)", marginTop: 14, fontSize: 12.5, lineHeight: 1.6, color: "var(--text-2)" }}>
              {explicacao}
            </div>
          )}

          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <label><div className="vx-label">{t("camp.new.campaignName")}</div>
              <input className="vx-input" value={campanha.titulo} onChange={(e) => set("titulo", e.target.value)} /></label>

            <label style={{ display: "block", marginTop: 12 }}><div className="vx-label">{t("camp.new.shortDescription")}</div>
              <textarea className="vx-input" style={{ minHeight: 62 }} value={campanha.descricao || ""}
                onChange={(e) => set("descricao", e.target.value)}
                placeholder={t("camp.new.shortDescPlaceholder")} /></label>

            <label style={{ display: "block", marginTop: 12 }}><div className="vx-label">{t("camp.new.icpLabel")}</div>
              <textarea className="vx-input" style={{ minHeight: 64 }} value={campanha.publico}
                onChange={(e) => set("publico", e.target.value)}
                placeholder={t("camp.new.icpPlaceholder")} /></label>

            <div className="vx-grid vx-g2" style={{ marginTop: 12 }}>
              <label><div className="vx-label">{t("camp.new.region")}</div>
                <input className="vx-input" value={campanha.regiao} onChange={(e) => set("regiao", e.target.value)} placeholder={t("camp.new.regionPlaceholder")} /></label>
              <label><div className="vx-label">{t("camp.new.howManyPros")}</div>
                <input className="vx-input vx-mono" type="number" min="1" value={campanha.vagas}
                  onChange={(e) => set("vagas", Number(e.target.value))} /></label>
            </div>
            <CidadeEstadoSelector estado={campanha.estado||""} cidade={campanha.cidade||""} onEstado={(v)=>set("estado",v)} onCidade={(v)=>set("cidade",v)} />
            <div className="vx-grid vx-g2" style={{ marginTop: 12 }}>
              <label><div className="vx-label">{t("camp.new.commissionPct")} <span className="vx-mut" style={{fontSize:11}}>({t("common.optional")})</span></div>
                <div style={{position:"relative"}}><input className="vx-input vx-mono" type="number" min="0" max="100" step="0.5" value={campanha.percentualComissao||0} onChange={(e)=>set("percentualComissao",Number(e.target.value))} /><span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:"var(--muted)",fontSize:13}}>%</span></div>
              </label>
              <label><div className="vx-label">{t("camp.new.jarvasMode")} <span className="vx-mut" style={{fontSize:11}}>({t("common.optional")})</span></div>
                <select className="vx-input" value={campanha.modoJarvas||""} onChange={(e)=>set("modoJarvas",e.target.value)}>
                  <option value="">{t("camp.new.jarvasDefault")}</option>
                  <option value="voz">{t("camp.new.jarvasVoice")}</option>
                  <option value="escrita">{t("camp.new.jarvasText")}</option>
                </select>
              </label>
            </div>
          </div>

          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-row" style={{ marginBottom: 12 }}><div><b>{t("camp.new.operationStructure")}</b><div className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.operationStructureDesc")}</div></div><ShieldCheck size={18} color="var(--brand)" /></div>
            <div className="vx-grid vx-g3">
              <label><div className="vx-label">{t("camp.new.recommendedRole")}</div><select className="vx-input" value={campanha.funcao} onChange={(e) => set("funcao", e.target.value)}><option value="sdr">SDR</option><option value="bdr">BDR</option><option value="closer">Closer</option><option value="pap">{t("camp.new.roleDoorToDoor")}</option></select></label>
              <label><div className="vx-label">{t("camp.new.deadlineHours")}</div><input className="vx-input vx-mono" type="number" min="1" value={campanha.prazoHoras} onChange={(e) => set("prazoHoras", Number(e.target.value))} /></label>
              <label><div className="vx-label">{t("camp.new.limitPerPro")}</div><input className="vx-input vx-mono" type="number" min="0" value={campanha.limitePorProfissional} onChange={(e) => set("limitePorProfissional", Number(e.target.value))} /></label>
            </div>
            <div className="vx-wizard-checks" style={{ marginTop: 12 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" style={{ marginTop: 3, flexShrink: 0 }} checked={campanha.prospeccaoAtiva} onChange={(e) => set("prospeccaoAtiva", e.target.checked)} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("camp.new.coldCallTitle")}</div>
                  <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>{t("camp.new.coldCallDesc")}</div>
                </div>
              </label>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginTop: 10 }}>
                <input type="checkbox" style={{ marginTop: 3, flexShrink: 0 }} checked={campanha.aceitaLeadProprio} onChange={(e) => set("aceitaLeadProprio", e.target.checked)} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("camp.new.ownLeadsTitle")}</div>
                  <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>{t("camp.new.ownLeadsDesc")}</div>
                </div>
              </label>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginTop: 10 }}>
                <input type="checkbox" style={{ marginTop: 3, flexShrink: 0 }} checked={campanha.exigeCertificacao} onChange={(e) => set("exigeCertificacao", e.target.checked)} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("camp.new.certRequiredTitle")}</div>
                  <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>{t("camp.new.certRequiredDesc")}</div>
                </div>
              </label>
            </div>
          </div>

          {/* valores: o ponto onde a empresa decide o que paga */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-row" style={{ marginBottom: 4 }}>
              <b style={{ fontSize: 14 }}>{t("camp.new.payPerAction")}</b>
              <span className="vx-chip"><Wallet size={12} /> {disponivel === Infinity ? (isPosPago(emp) ? t("camp.new.postpaidNoLimit") : t("camp.new.premiumNoLimit")) : t("camp.new.availableBalance", { amount: money(disponivel) })}</span>
            </div>

            {/* Sugestão com IA */}
            <div style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div className="vx-row" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <TrendingUp size={14} color="var(--brand)" />
                  <b style={{ fontSize: 13 }}>{t("camp.new.aiSuggestion")}</b>
                  <span className="vx-mut" style={{ fontSize: 11.5 }}>— {ehCampanhaVisita ? t("camp.new.aiSuggVisit") : t("camp.new.aiSuggAction")}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={calcularSugestaoIA}>
                    <Sparkles size={12} /> {t("camp.new.calculate")}
                  </button>
                  {sugestaoIA && <button className="vx-btn vx-btn-sm vx-btn-ghost" onClick={() => setMostrarSugestao((v) => !v)}>
                    {mostrarSugestao ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: mostrarSugestao ? 10 : 0 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>{t("camp.new.avgTicket")}</span>
                <div style={{ position: "relative", maxWidth: 160 }}>
                  <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-2)", fontSize: 12.5, pointerEvents: "none" }}>R$</span>
                  <input
                    className="vx-input vx-mono"
                    style={{ paddingLeft: 28, fontSize: 13, height: 32 }}
                    inputMode="decimal"
                    placeholder={emp.ticket ? String(emp.ticket).replace("R$", "").trim() : "0,00"}
                    value={ticketLocal}
                    onChange={(e) => setTicketLocal(e.target.value.replace(/[^\d,]/g, ""))}
                  />
                </div>
                {!ticketLocal && emp.ticket && (
                  <span className="vx-mut" style={{ fontSize: 11 }}>{t("camp.new.usingProfile", { ticket: emp.ticket })}</span>
                )}
                {ehCampanhaVisita && (
                  <>
                    <span style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap", marginLeft: 4 }}>{t("camp.new.visitsPerDay")}</span>
                    <input
                      className="vx-input vx-mono"
                      style={{ width: 72, fontSize: 13, height: 32 }}
                      type="number" min="1" step="1"
                      placeholder="Ex.: 5"
                      value={visitasPorDiaLocal}
                      onChange={(e) => setVisitasPorDiaLocal(e.target.value)}
                    />
                    <span className="vx-mut" style={{ fontSize: 11 }}>{t("camp.new.budgetFormula")}</span>
                  </>
                )}
              </div>
              {mostrarSugestao && sugestaoIA && (
                sugestaoIA.disponivel ? (
                  <div>
                    {sugestaoIA.tipo === "visita" ? (
                      <div className="vx-grid vx-g2" style={{ marginBottom: 10 }}>
                        <div style={{ background: "#fff", borderRadius: 8, padding: "9px 11px", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 2 }}>{t("camp.new.perVisit")}</div>
                          <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>{money(sugestaoIA.valorVisita.bruto)}</div>
                          <div className="vx-mut" style={{ fontSize: 11 }}>{t("camp.new.txFee", { pct: (sugestaoIA.valorVisita.percentual * 100).toFixed(0) })} · {t("camp.new.net")} {money(sugestaoIA.valorVisita.liquido)}</div>
                          <div className="vx-mut" style={{ fontSize: 11 }}>{sugestaoIA.fonte}</div>
                        </div>
                        {sugestaoIA.comissaoVenda.bruto > 0 && (
                          <div style={{ background: "#fff", borderRadius: 8, padding: "9px 11px", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 2 }}>{t("camp.new.commissionPerSale")}</div>
                            <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>{money(sugestaoIA.comissaoVenda.bruto)}</div>
                            <div className="vx-mut" style={{ fontSize: 11 }}>{t("camp.new.txFee", { pct: (sugestaoIA.comissaoVenda.percentual * 100).toFixed(0) })} · {t("camp.new.net")} {money(sugestaoIA.comissaoVenda.liquido)}</div>
                            <div className="vx-mut" style={{ fontSize: 11 }}>{t("camp.new.pctOfTicket", { pct: "8" })}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="vx-grid vx-g2" style={{ marginBottom: 10 }}>
                        {sugestaoIA.tarefas?.filter((st) => campanha.tarefas[st.tipo] !== undefined).map((st) => (
                          <div key={st.tipo} style={{ background: "#fff", borderRadius: 8, padding: "9px 11px", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 2 }}>{ACOES[st.tipo]?.nome || st.tipo}</div>
                            <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>{money(st.bruto)}</div>
                            <div className="vx-mut" style={{ fontSize: 11 }}>{t("camp.new.txFee", { pct: (st.percentual * 100).toFixed(0) })} · {t("camp.new.net")} {money(st.liquido)}</div>
                            <div className="vx-mut" style={{ fontSize: 11 }}>{t("camp.new.range")}: {money(st.minimo)} – {money(st.maximo)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {sugestaoIA.tipo !== "visita" && (() => {
                      const agendamento = sugestaoIA.tarefas?.find((st) => st.tipo === "agendamento");
                      return agendamento ? (
                        <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
                          {t("camp.new.estCostMeeting")}: <b className="vx-mono">{money(agendamento.bruto)}</b>
                          {sugestaoIA.premissas?.conversao ? ` · ${t("camp.new.perSale")}: ~${money(agendamento.bruto / sugestaoIA.premissas.conversao)}` : ""}
                          {" · "}{t("camp.new.planTxRate")}: {(takeRateDoPlano(emp.assinatura || "free") * 100).toFixed(0)}%
                        </div>
                      ) : null;
                    })()}
                    {sugestaoIA.confianca && <div className="vx-mut" style={{ fontSize: 11, marginBottom: 8 }}>
                      {t("camp.new.confidence")}: {sugestaoIA.confianca} · {sugestaoIA.fontes?.[0]?.nome}
                    </div>}
                    <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={aceitarSugestaoIA}>
                      <Check size={12} /> {t("camp.new.acceptSuggestion")}
                    </button>
                  </div>
                ) : (
                  <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>
                    {sugestaoIA.motivo} {sugestaoIA.ausentes && <b>{t("camp.new.missing")}: {sugestaoIA.ausentes.join(", ")}</b>}
                  </div>
                )
              )}
            </div>

            <p className="vx-mut" style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.6 }}>
              {campanha.valoresDerivadosDoTicket
                ? t("camp.new.valuesPrefilled", { ticket: emp.ticket })
                : t("camp.new.valuesFillOrAI")}
            </p>
            <div className="vx-grid vx-g2">
              {Object.keys(campanha.tarefas).map((k) => (
                <label key={k}>
                  <div className="vx-label">
                    {k === "venda" ? t("camp.new.saleCommissionLabel") : (ACOES[k]?.nome || k)}
                  </div>
                  <input className="vx-input vx-mono" type="number" min="0" step="0.5" value={campanha.tarefas[k]}
                    onChange={(e) => set("tarefas", { ...campanha.tarefas, [k]: Number(e.target.value) })} />
                </label>
              ))}
            </div>

            <div style={{ marginTop: 12 }}><div className="vx-label">{t("camp.new.totalBudget")}</div>
              <CampoOrcamento value={campanha.orcamento} onChange={(v) => set("orcamento", v)} /></div>
            {!isPosPago(emp) && campanha.orcamento > disponivel && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--amber)" }}>
                {t("camp.new.budgetExceedsBalance")}
              </div>
            )}
          </div>

          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-row" style={{ marginBottom: 12 }}>
              <div><b style={{ fontSize: 14 }}>{t("camp.new.trainingRequired")}</b><div className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.trainingRequiredDesc")}</div></div>
              <button className="vx-btn vx-btn-sm" onClick={adicionarTreinamento}><Plus size={13} /> {t("camp.new.module")}</button>
            </div>

            {/* Gerador de treinamento com IA */}
            <div style={{ background: "linear-gradient(135deg, var(--brand-50), var(--indigo-50, var(--brand-50)))", border: "1px solid var(--brand-100)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <BookOpen size={14} color="var(--brand)" />
                <b style={{ fontSize: 13 }}>{t("camp.new.generateTraining")}</b>
              </div>
              <p className="vx-mut" style={{ margin: "0 0 10px", fontSize: 12, lineHeight: 1.5 }}>
                {t("camp.new.generateTrainingDesc")}
              </p>
              <div className="vx-grid vx-g2" style={{ marginBottom: 10 }}>
                {Object.entries(MODELOS_TREINAMENTO).map(([k, m]) => (
                  <label key={k} style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer", background: modeloTreinamento === k ? "var(--brand-50)" : "var(--surface)", border: `1px solid ${modeloTreinamento === k ? "var(--brand)" : "var(--border)"}`, borderRadius: 8, padding: "9px 11px" }}>
                    <input type="radio" name="modeloTreinamento" value={k} checked={modeloTreinamento === k} onChange={() => setModeloTreinamento(k)} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.nome}</div>
                      <div className="vx-mut" style={{ fontSize: 11.5, lineHeight: 1.4 }}>{m.descricao}</div>
                    </div>
                  </label>
                ))}
              </div>
              <button className="vx-btn vx-btn-primary vx-btn-sm" disabled={gerandoTreinamento} onClick={gerarTreinamentoComIA}>
                {gerandoTreinamento ? <><Loader size={13} /> {t("camp.new.generatingModules")}</> : <><Sparkles size={13} /> {t("camp.new.generateTrainingBtn")}</>}
              </button>
            </div>

            {(campanha.treinamento || []).length === 0
              ? <div className="vx-campaign-inline-empty">{t("camp.new.noModulesYet")}</div>
              : <div className="vx-training-drafts">
                  {campanha.treinamento.map((modulo, indice) => (
                    <div key={modulo.id || indice}>
                      <input className="vx-input" placeholder={t("camp.new.moduleTitle")} value={modulo.titulo || ""} onChange={(e) => atualizarTreinamento(indice, "titulo", e.target.value)} />
                      <textarea className="vx-input" placeholder={t("camp.new.moduleContent")} value={modulo.conteudo || ""} onChange={(e) => atualizarTreinamento(indice, "conteudo", e.target.value)} />
                      <button className="vx-btn vx-btn-ghost vx-btn-sm" aria-label={t("camp.new.removeModule")} onClick={() => removerTreinamento(indice)}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>}
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(0)}><ArrowLeft size={14} /> {t("common.back")}</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(2)}>{t("camp.new.review")} <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ---------------------------------------------- passo 3: revisão */}
      {passo === 2 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>{t("camp.new.reviewTitle")}</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            {t("camp.new.reviewSubtitle")}
          </p>

          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-grid vx-g2" style={{ fontSize: 13 }}>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.rev.campaign")}</span><div style={{ fontWeight: 600 }}>{campanha.titulo}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.rev.objective")}</span><div style={{ fontWeight: 600 }}>{obj?.nome}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.rev.icp")}</span><div style={{ fontWeight: 600 }}>{campanha.publico || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.rev.professional")}</span><div style={{ fontWeight: 600 }}>{campanha.funcao.toUpperCase()}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.rev.slots")}</span><div style={{ fontWeight: 600 }}>{campanha.vagas}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.rev.region")}</span><div style={{ fontWeight: 600 }}>{campanha.regiao || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.rev.deadline")}</span><div style={{ fontWeight: 600 }}>{campanha.prazoHoras}h</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.rev.budget")}</span><div style={{ fontWeight: 600 }} className="vx-mono">{money(campanha.orcamento)}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.rev.limitPerPro")}</span><div style={{ fontWeight: 600 }}>{campanha.limitePorProfissional || t("camp.new.rev.noLimit")}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.rev.ownLeads")}</span><div style={{ fontWeight: 600 }}>{campanha.aceitaLeadProprio ? t("camp.new.rev.accepted") : t("camp.new.rev.notAccepted")}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.rev.certification")}</span><div style={{ fontWeight: 600 }}>{campanha.exigeCertificacao ? t("camp.new.rev.required") : t("camp.new.rev.notRequired")}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>{t("camp.new.rev.training")}</span><div style={{ fontWeight: 600 }}>{t("camp.new.rev.modules", { n: (campanha.treinamento || []).length })}</div></div>
            </div>

            <hr className="vx-sep" />
            <div className="vx-eyebrow" style={{ marginBottom: 8 }}>{t("camp.new.rev.whatYouPay")}</div>
            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              {Object.entries(campanha.tarefas).map(([k, v]) => (
                <div key={k} className="vx-row">
                  <span style={{ color: "var(--text-2)" }}>{ACOES[k]?.nome || k}</span>
                  <b className="vx-mono">{money(Number(v))}</b>
                </div>
              ))}
            </div>
            {custo?.estimativaPorProfissional > 0 && (
              <div className="vx-mut" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
                {t("camp.new.rev.costEstimate", { limit: campanha.limitePorProfissional })}
                {" "}<b className="vx-mono">{money(custo.estimativaPorProfissional)}</b>.
                {" "}{t("camp.new.rev.costDisclaimer")}
              </div>
            )}

            <hr className="vx-sep" />
            <div className="vx-eyebrow" style={{ marginBottom: 8 }}>{t("camp.new.rev.evidenceRequired")}</div>
            <div className="vx-evidence-summary">{Object.entries(campanha.evidencias || {}).map(([tipo, campos]) => <div key={tipo}><b>{ACOES[tipo]?.nome || tipo}</b><span>{Array.isArray(campos) ? campos.join(" · ") : t("camp.new.rev.criteriaSet")}</span></div>)}</div>

            <hr className="vx-sep" />
            <div className="vx-row" style={{ alignItems: "flex-start" }}><div><div className="vx-eyebrow">{t("camp.new.rev.publishChecklist")}</div><b style={{ fontSize: 13 }}>{checklist.ok ? t("camp.new.rev.draftReady") : t("camp.new.rev.pendingCount", { n: checklist.pendencias.length })}</b></div><span className={`vx-campaign-status ${checklist.ok ? "is-ativa" : "is-em_revisao"}`}>{checklist.ok ? t("camp.new.rev.complete") : t("camp.new.rev.pending")}</span></div>
            <div className="vx-publish-checklist">{requisitos.map(({ label, ok }) => <div key={label} data-ok={ok ? "1" : "0"}><span>{ok ? <Check size={12} /> : "!"}</span>{label}</div>)}</div>
            {!checklist.ok && <div className="vx-notice vx-notice-amber" style={{ marginTop: 11 }}>{checklist.pendencias.join(" · ")}</div>}
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(1)}><ArrowLeft size={14} /> {t("common.back")}</button>
            <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={criar}>
              {salvando ? t("common.saving") : <>{t("camp.new.saveDraft")} <Check size={14} /></>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

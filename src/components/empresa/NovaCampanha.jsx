import { useState, useRef, useMemo } from "react";
import CidadeEstadoSelector from "./CidadeEstadoSelector.jsx";
import { Sparkles, ArrowRight, ArrowLeft, Check, Wallet, Loader, Target, CalendarCheck, MapPin, BadgeDollarSign, Workflow, Plus, Trash2, ShieldCheck, TrendingUp, BookOpen, ChevronDown, ChevronUp, Send, RotateCcw, Search, Filter, HandCoins, Footprints, Settings, Laptop, Building2, MessageCircle, Phone, Mail, Linkedin, Instagram, Globe, Users, Eye, EyeOff, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "../../lib/api.js";
import ConversaJarvas from "./ConversaJarvas.jsx";
import { useI18n } from "../../lib/i18n.jsx";
import { nomeAssistente } from "../../../shared/jarvas.js";
import { money } from "../../lib/utils.js";
import { ACOES } from "../../lib/constants.js";
import { OBJETIVOS, ORDEM_OBJETIVOS, montarCampanha, custoEstimado } from "../../../shared/objetivosCampanha.js";
import { campanhaPodeSerPublicada, requisitosPublicacao, saldoDisponivel, isPosPago } from "../../../shared/empresa.js";
import { sugerirValores, sugerirValorVisita } from "../../../shared/valorTarefa.js";
import { takeRateDoPlano } from "../../../shared/planos.js";
import MultiSelect from "../ui/MultiSelect.jsx";
import { PAISES } from "../../../shared/paises.js";
import {
  MODELOS_TRABALHO, RESTRICOES_GEO, MERCADOS, ORIGENS_LEAD, CANAIS,
  NIVEIS_EXPERIENCIA, PROCESSOS_ADMISSAO, OBJETIVOS_UI, ORDEM_OBJETIVOS_UI,
  ACOES_DISPONIVEIS, SUGESTOES_ACOES,
  regrasLocalizacao, camposVisiveis, diagnosticoCampanha, migrarCampanhaAntiga,
  precisaDeReuniao, precisaDePresencial,
} from "../../../shared/campaignEngine.js";
import { FUNCOES, ORDEM_FUNCOES } from "../../../shared/funcoes.js";

const OPC_PAISES = PAISES.map((p) => ({ value: p.code, label: p.nome }));
const NOME_PAIS = Object.fromEntries(PAISES.map((p) => [p.code, p.nome]));
const nomePais = (code) => NOME_PAIS[String(code || "").toUpperCase()] || code || "seu país";

const PASSOS = ["Objetivo", "Estrutura", "Perfil profissional", "Ações & Remuneração", "Revisão"];

const ICONES_OBJETIVO_UI = {
  encontrar_clientes: Search, qualificar: Filter, agendar_reunioes: CalendarCheck,
  realizar_vendas: HandCoins, visitas_comerciais: Footprints,
  reativar_clientes: RotateCcw, personalizar: Settings,
};

const ICONES_MODELO = { remoto: Laptop, presencial: MapPin, hibrido: Building2 };
const ICONES_CANAL = { whatsapp: MessageCircle, ligacao: Phone, email: Mail, linkedin: Linkedin, instagram: Instagram, presencial: MapPin, outro: Globe };

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
  const handleChange = (e) => { const raw = e.target.value.replace(/[^\d,]/g, ""); setDisplay(raw); onChange(parseBRL(raw)); };
  const handleBlur = () => { const n = parseBRL(display); setDisplay(n > 0 ? formatarBRL(n) : ""); onChange(n); };
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-2)", fontSize: 13.5, pointerEvents: "none", userSelect: "none" }}>R$</span>
      <input className="vx-input vx-mono" style={{ paddingLeft: 30 }} inputMode="decimal" value={display} onChange={handleChange} onBlur={handleBlur} placeholder="0,00" />
    </div>
  );
}

function CardOption({ selected, onClick, icon: Icon, title, subtitle, disabled }) {
  return (
    <button
      className="vx-card"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "14px 16px", cursor: disabled ? "not-allowed" : "pointer", textAlign: "left", width: "100%",
        border: `1.5px solid ${selected ? "var(--brand)" : "var(--border)"}`,
        background: selected ? "var(--brand-50)" : "var(--surface)",
        opacity: disabled ? 0.5 : 1,
        transition: "border-color .15s, background .15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {Icon && <Icon size={18} color={selected ? "var(--brand)" : "var(--text-2)"} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: selected ? 600 : 400, color: selected ? "var(--brand)" : "var(--text-1)" }}>{title}</div>
          {subtitle && <div className="vx-mut" style={{ fontSize: 12, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {selected && <Check size={16} color="var(--brand)" />}
      </div>
    </button>
  );
}

function ChipToggle({ items, value, onChange, multi = false }) {
  const isActive = (id) => multi ? (value || []).includes(id) : value === id;
  const toggle = (id) => {
    if (multi) {
      const arr = value || [];
      onChange(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
    } else {
      onChange(id);
    }
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((item) => (
        <button key={item.id} onClick={() => toggle(item.id)} style={{
          display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20,
          fontSize: 12.5, fontWeight: 500, cursor: "pointer",
          border: `1.5px solid ${isActive(item.id) ? "var(--brand)" : "var(--border)"}`,
          background: isActive(item.id) ? "var(--brand-50)" : "var(--surface)",
          color: isActive(item.id) ? "var(--brand)" : "var(--text-2)",
          transition: "all .15s",
        }}>
          {item.icon && <item.icon size={13} />}
          {item.nome || item.label || item.id}
        </button>
      ))}
    </div>
  );
}

export default function NovaCampanha({ emp, aoCriar, aoCancelar, aviso, iniciarComIA = false }) {
  const { locale } = useI18n();
  const nome = nomeAssistente(locale);
  const [passo, setPasso] = useState(0);
  const [campanha, setCampanha] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [explicacao, setExplicacao] = useState("");
  const [gerandoTreinamento, setGerandoTreinamento] = useState(false);
  const [modeloTreinamento, setModeloTreinamento] = useState("rapido");
  const [ticketLocal, setTicketLocal] = useState("");
  const [sugestaoIA, setSugestaoIA] = useState(null);
  const [mostrarSugestao, setMostrarSugestao] = useState(false);

  const disponivel = saldoDisponivel(emp);
  const set = (k, v) => setCampanha((c) => ({ ...c, [k]: v }));
  const setNested = (k, sub, v) => setCampanha((c) => ({ ...c, [k]: { ...(c[k] || {}), [sub]: v } }));

  const vis = useMemo(() => campanha ? camposVisiveis(campanha) : {}, [campanha]);
  const diag = useMemo(() => campanha ? diagnosticoCampanha(campanha, emp) : { pronta: false, bloqueios: [], recomendacoes: [] }, [campanha, emp]);

  const escolher = (chaveUI) => {
    const objUI = OBJETIVOS_UI[chaveUI];
    if (!objUI) return;
    const base = montarCampanha(objUI.objetivo, emp);
    if (!base) return;
    setCampanha({
      ...base,
      objetivoUI: chaveUI,
      modeloTrabalho: "remoto",
      restricaoGeo: "nenhuma",
      origemLeads: "",
      mercado: "pais_todo",
      canais: [],
      nivelExperiencia: "indiferente",
      idiomasExigidos: [],
      disponibilidade: "flexivel",
      requisitosObrigatorios: [],
      requisitosDesejaveis: [],
      processoAdmissao: "manual",
      limiteProf: 0,
      visibilidade: "publica",
      temComissao: false,
      comissaoConfig: {},
      remuneracaoCumulativa: true,
      acoesAtivas: base.tarefas ? Object.keys(base.tarefas) : [],
      icpTipo: "",
      icpEstruturado: {},
      qualificacaoCriterios: [],
      reuniaoConfig: {},
      alcance: "nacional",
      paisesAceitos: [],
    });
    setExplicacao("");
    setPasso(1);
  };

  const receberCampanhaDoJarvas = (chaveObjetivo, campanhaMontada) => {
    setCampanha({ ...campanhaMontada, objetivoUI: "", modeloTrabalho: "remoto", restricaoGeo: "nenhuma", origemLeads: "", mercado: "pais_todo", canais: [], nivelExperiencia: "indiferente", processoAdmissao: "manual", visibilidade: "publica", temComissao: false, remuneracaoCumulativa: true, acoesAtivas: Object.keys(campanhaMontada.tarefas || {}) });
    setExplicacao("");
    setPasso(1);
  };

  const adicionarTreinamento = () => set("treinamento", [...(campanha.treinamento || []), { id: `mod-${Date.now()}`, titulo: "", conteudo: "" }]);
  const atualizarTreinamento = (i, campo, valor) => set("treinamento", campanha.treinamento.map((item, idx) => idx === i ? { ...item, [campo]: valor } : item));
  const removerTreinamento = (i) => set("treinamento", campanha.treinamento.filter((_, idx) => idx !== i));

  const gerarTreinamentoComIA = async () => {
    if (!campanha) return;
    setGerandoTreinamento(true);
    const r = await api("/campaigns/treinamento", {
      modelo: modeloTreinamento,
      campanha: { titulo: campanha.titulo, objetivo: campanha.objetivo, descricao: campanha.descricao, publico: campanha.publico, regiao: campanha.regiao, funcao: campanha.funcao },
      empresa: { nome: emp.nome, produto: emp.produto, icp: emp.icp, ticket: emp.ticket },
    });
    setGerandoTreinamento(false);
    if (!r || r.error) return;
    if (Array.isArray(r.modulos) && r.modulos.length > 0) set("treinamento", r.modulos);
  };

  const calcularSugestaoIA = () => {
    const plano = emp.assinatura || "free";
    const ticketBase = ticketLocal ? parseBRL(ticketLocal) : Number(String(emp.ticket || "").replace(/\D/g, "")) || 0;
    const ehVisita = precisaDePresencial(campanha);
    if (ehVisita) {
      const vpd = Number(campanha?.visitasPorDia) || 0;
      const resultado = sugerirValorVisita({ orcamento: Number(campanha?.orcamento) || 0, visitasPorDia: vpd, ticketMedio: ticketBase, plano });
      setSugestaoIA({ ...resultado, tipo: "visita" });
    } else {
      const resultado = sugerirValores({ ticketMedio: ticketBase, margem: 0.3, plano });
      setSugestaoIA({ ...resultado, tipo: "reuniao" });
    }
    setMostrarSugestao(true);
  };

  const aceitarSugestaoIA = () => {
    if (!sugestaoIA?.disponivel || !campanha) return;
    const novasTarefas = { ...campanha.tarefas };
    if (sugestaoIA.tipo === "visita") {
      if (novasTarefas.visita !== undefined) novasTarefas.visita = sugestaoIA.valorVisita.bruto;
      if (novasTarefas.venda !== undefined) novasTarefas.venda = sugestaoIA.comissaoVenda.bruto;
    } else {
      sugestaoIA.tarefas?.forEach((t) => { if (novasTarefas[t.tipo] !== undefined) novasTarefas[t.tipo] = t.bruto; });
    }
    set("tarefas", novasTarefas);
    setMostrarSugestao(false);
  };

  const toggleAcao = (id) => {
    const ativas = campanha.acoesAtivas || [];
    const novas = ativas.includes(id) ? ativas.filter((a) => a !== id) : [...ativas, id];
    set("acoesAtivas", novas);
    const tarefas = { ...(campanha.tarefas || {}) };
    if (!ativas.includes(id)) { tarefas[id] = tarefas[id] || 0; }
    else { delete tarefas[id]; }
    set("tarefas", tarefas);
  };

  const criar = async () => {
    if (!campanha?.titulo?.trim()) return aviso("Dê um título à campanha.");
    setSalvando(true);
    const payload = { ...campanha };
    const r = await api("/campaigns", payload);
    setSalvando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível criar a campanha.");
    aoCriar?.({ ...campanha, id: r.id, companyId: emp.id, status: "rascunho", criadoEm: Date.now() });
  };

  const objUI = campanha?.objetivoUI ? OBJETIVOS_UI[campanha.objetivoUI] : null;
  const objBase = campanha?.objetivoChave ? OBJETIVOS[campanha.objetivoChave] : null;
  const custo = campanha ? custoEstimado(campanha, campanha.limitePorProfissional || 10) : null;

  const MODELOS_TREINAMENTO = {
    rapido: { nome: "Treinamento rápido", descricao: "Visão geral + script + 3 objeções" },
    completo: { nome: "Treinamento completo", descricao: "Módulos detalhados: produto, ICP, objeções" },
    quiz: { nome: "Quiz + certificação", descricao: "Perguntas de múltipla escolha" },
    script: { nome: "Script operacional", descricao: "Roteiro passo a passo" },
  };

  return (
    <div className="vx-fade vx-campaign-wizard">
      {/* trilha dos passos */}
      <div className="vx-wizard-steps">
        {PASSOS.map((p, i) => (
          <div key={p} data-active={i === passo ? "1" : "0"} data-done={i < passo ? "1" : "0"}>
            <div>
              <span>{i < passo ? <Check size={12} /> : i + 1}</span>
              {p}
            </div>
            {i < PASSOS.length - 1 && <i />}
          </div>
        ))}
      </div>

      {/* ═══════════════════════ PASSO 1: OBJETIVO ═══════════════════════ */}
      {passo === 0 && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Nova campanha</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            {iniciarComIA
              ? `Converse com o ${nome}, seu assessor de vendas: ele pergunta, calcula o retorno e monta a campanha para você revisar.`
              : "O que você precisa que aconteça? Escolha o objetivo e a plataforma configura o resto."}
          </p>

          {iniciarComIA && (
            <div className="vx-card" style={{ padding: 20, marginTop: 4, borderColor: "var(--brand-200, var(--brand-100))", background: "linear-gradient(135deg, var(--brand-50) 0%, var(--indigo-50, var(--brand-50)) 100%)", borderWidth: 1.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                <b style={{ fontSize: 15 }}>{nome}</b>
                <span className="vx-badge vx-badge-brand" style={{ fontSize: 11 }}>IA · Recomendado</span>
              </div>
              <ConversaJarvas emp={emp} onCampanha={receberCampanhaDoJarvas} />
            </div>
          )}

          {!iniciarComIA && (
            <div className="vx-objective-grid">
              {ORDEM_OBJETIVOS_UI.map((k) => {
                const o = OBJETIVOS_UI[k];
                const Icone = ICONES_OBJETIVO_UI[k] || Target;
                return (
                  <button key={k} className="vx-card vx-objective-card" onClick={() => escolher(k)}>
                    <span className="vx-objective-icon"><Icone size={19} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <b style={{ fontSize: 15 }}>{o.nome}</b>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>{o.descricao}</div>
                    </div>
                    <ArrowRight size={16} className="vx-objective-arrow" />
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 14 }}>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }} onClick={aoCancelar}>Cancelar</button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 2: ESTRUTURA ═══════════════════════ */}
      {passo === 1 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Estrutura da operação</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            Como a campanha vai funcionar: modelo de trabalho, território e origem dos leads.
          </p>

          {/* Dados básicos */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <label><div className="vx-label">Nome da campanha</div>
              <input className="vx-input" value={campanha.titulo} onChange={(e) => set("titulo", e.target.value)} /></label>
            <label style={{ display: "block", marginTop: 12 }}><div className="vx-label">Descrição da operação</div>
              <textarea className="vx-input" style={{ minHeight: 62 }} value={campanha.descricao || ""}
                onChange={(e) => set("descricao", e.target.value)}
                placeholder="Explique o resultado esperado e o contexto para o profissional." /></label>
          </div>

          {/* Modelo de trabalho */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Modelo de trabalho</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Como o profissional executa as atividades.</div></div>
            <div style={{ display: "grid", gap: 8 }}>
              {Object.values(MODELOS_TRABALHO).map((m) => {
                const Ic = ICONES_MODELO[m.id] || Globe;
                return <CardOption key={m.id} selected={campanha.modeloTrabalho === m.id} onClick={() => set("modeloTrabalho", m.id)} icon={Ic} title={m.nome} subtitle={m.descricao} />;
              })}
            </div>
          </div>

          {/* Restrição geográfica do profissional (só remoto) */}
          {campanha.modeloTrabalho === "remoto" && (
            <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Localização do profissional</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Aceita profissionais de qualquer lugar ou restringe por região?</div></div>
              <div style={{ display: "grid", gap: 8 }}>
                {Object.values(RESTRICOES_GEO).map((r) => (
                  <CardOption key={r.id} selected={campanha.restricaoGeo === r.id} onClick={() => set("restricaoGeo", r.id)} title={r.label} />
                ))}
              </div>
              {vis.paisesRestritos && (
                <div style={{ marginTop: 12 }}>
                  <div className="vx-label">Países aceitos</div>
                  <MultiSelect opcoes={OPC_PAISES} valor={campanha.paisesRestritos || []} onChange={(v) => set("paisesRestritos", v)} placeholder="Selecione os países" />
                </div>
              )}
              {vis.regioesRestritas && (
                <div style={{ marginTop: 12 }}>
                  <div className="vx-label">Regiões aceitas</div>
                  <input className="vx-input" value={(campanha.regioesRestritas || []).join(", ")} onChange={(e) => set("regioesRestritas", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Ex.: Sudeste, Sul" />
                </div>
              )}
              {vis.cidadesRestritas && (
                <div style={{ marginTop: 12 }}>
                  <div className="vx-label">Cidades aceitas</div>
                  <input className="vx-input" value={(campanha.cidadesRestritas || []).join(", ")} onChange={(e) => set("cidadesRestritas", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Ex.: São Paulo, Rio de Janeiro" />
                </div>
              )}
            </div>
          )}

          {/* Território (presencial/híbrido) */}
          {(campanha.modeloTrabalho === "presencial" || campanha.modeloTrabalho === "hibrido") && (
            <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Território de atuação</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Onde o profissional precisa atuar fisicamente.</div></div>
              <div className="vx-grid vx-g2">
                <label><div className="vx-label">Região</div>
                  <input className="vx-input" value={campanha.regiao} onChange={(e) => set("regiao", e.target.value)} placeholder="Ex.: interior de SP" /></label>
              </div>
              <CidadeEstadoSelector estado={campanha.estado || ""} cidade={campanha.cidade || ""} onEstado={(v) => set("estado", v)} onCidade={(v) => set("cidade", v)} />
            </div>
          )}

          {/* Mercado de atuação do cliente */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Mercado dos seus clientes</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Onde estão os potenciais clientes que esta campanha vai atingir.</div></div>
            <div style={{ display: "grid", gap: 8 }}>
              {Object.values(MERCADOS).map((m) => (
                <CardOption key={m.id} selected={campanha.mercado === m.id} onClick={() => set("mercado", m.id)} title={m.label} />
              ))}
            </div>
            {(campanha.mercado === "outros_paises" || campanha.mercado === "global") && (
              <div style={{ marginTop: 12 }}>
                <div className="vx-label">Países do mercado</div>
                <MultiSelect opcoes={OPC_PAISES} valor={campanha.mercadoPaises || []} onChange={(v) => set("mercadoPaises", v)} placeholder="Selecione os países" />
              </div>
            )}
          </div>

          {/* Origem dos leads */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Origem dos leads</b><div className="vx-mut" style={{ fontSize: 11.5 }}>De onde virão os contatos desta campanha.</div></div>
            <div style={{ display: "grid", gap: 8 }}>
              {Object.values(ORIGENS_LEAD).map((o) => (
                <CardOption key={o.id} selected={campanha.origemLeads === o.id} onClick={() => set("origemLeads", o.id)} title={o.label} />
              ))}
            </div>
          </div>

          {/* Canais */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Canais de abordagem</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Como o profissional pode entrar em contato com os leads.</div></div>
            <ChipToggle
              items={CANAIS.map((c) => ({ id: c.id, nome: c.nome, icon: ICONES_CANAL[c.id] || Globe }))}
              value={campanha.canais || []}
              onChange={(v) => set("canais", v)}
              multi
            />
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(0)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(2)}>Perfil profissional <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 3: PERFIL PROFISSIONAL ═══════════════════════ */}
      {passo === 2 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Perfil profissional</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            Quem pode trabalhar nesta campanha e como entra.
          </p>

          {/* Função comercial */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Função comercial</b>
              {objUI?.funcaoSugerida && <span className="vx-badge vx-badge-brand" style={{ fontSize: 11, marginLeft: 8 }}>Sugerida: {FUNCOES[objUI.funcaoSugerida]?.nome}</span>}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {ORDEM_FUNCOES.filter((f) => f !== "sem-exp").map((k) => {
                const f = FUNCOES[k];
                return <CardOption key={k} selected={campanha.funcao === k} onClick={() => set("funcao", k)} title={f.nome} subtitle={f.descricao} />;
              })}
            </div>
          </div>

          {/* ICP */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Perfil do cliente ideal (ICP)</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Descreva o tipo de empresa ou pessoa que o profissional deve abordar.</div></div>
            <textarea className="vx-input" style={{ minHeight: 64 }} value={campanha.publico || ""}
              onChange={(e) => set("publico", e.target.value)}
              placeholder="Ex.: distribuidoras de bebida com 10 a 80 funcionários" />
            <label style={{ display: "block", marginTop: 12 }}><div className="vx-label">Produto ou serviço ofertado</div>
              <input className="vx-input" value={campanha.produto || ""} onChange={(e) => set("produto", e.target.value)} placeholder="Ex.: Software de gestão" /></label>
          </div>

          {/* Nível de experiência */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Nível de experiência</b></div>
            <div style={{ display: "grid", gap: 8 }}>
              {NIVEIS_EXPERIENCIA.map((n) => (
                <CardOption key={n.id} selected={campanha.nivelExperiencia === n.id} onClick={() => set("nivelExperiencia", n.id)} title={n.label} />
              ))}
            </div>
          </div>

          {/* Processo de admissão */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Processo de admissão</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Como os profissionais entram na campanha.</div></div>
            <div style={{ display: "grid", gap: 8 }}>
              {PROCESSOS_ADMISSAO.map((p) => (
                <CardOption key={p.id} selected={campanha.processoAdmissao === p.id} onClick={() => set("processoAdmissao", p.id)} title={p.label} subtitle={p.descricao} />
              ))}
            </div>
            <div className="vx-grid vx-g2" style={{ marginTop: 12 }}>
              <label><div className="vx-label">Vagas disponíveis</div>
                <input className="vx-input vx-mono" type="number" min="0" value={campanha.vagas || 0} onChange={(e) => set("vagas", Number(e.target.value))} /></label>
              <label><div className="vx-label">Limite de profissionais</div>
                <input className="vx-input vx-mono" type="number" min="0" value={campanha.limiteProf || 0} onChange={(e) => set("limiteProf", Number(e.target.value))} placeholder="0 = sem limite" /></label>
            </div>
          </div>

          {/* Certificação e visibilidade */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-wizard-checks">
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" style={{ marginTop: 3, flexShrink: 0 }} checked={campanha.exigeCertificacao} onChange={(e) => set("exigeCertificacao", e.target.checked)} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Exigir certificação antes de trabalhar</div>
                  <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>Profissional precisa completar o treinamento da campanha.</div>
                </div>
              </label>
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="vx-label">Visibilidade da campanha</div>
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                <CardOption selected={campanha.visibilidade === "publica"} onClick={() => set("visibilidade", "publica")} icon={Eye} title="Pública" subtitle="Visível para todos os profissionais que atendam aos critérios." />
                <CardOption selected={campanha.visibilidade === "privada"} onClick={() => set("visibilidade", "privada")} icon={EyeOff} title="Privada" subtitle="Visível apenas para profissionais convidados." />
                <CardOption selected={campanha.visibilidade === "oculta"} onClick={() => set("visibilidade", "oculta")} icon={Lock} title="Oculta" subtitle="Não aparece em buscas. Somente via link direto." />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(1)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(3)}>Ações & Remuneração <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 4: AÇÕES & REMUNERAÇÃO ═══════════════════════ */}
      {passo === 3 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Ações & Remuneração</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            Quais ações são remuneradas, quanto custam e como são comprovadas.
          </p>

          {/* Ações ativas */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Ações remuneradas</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Selecione as ações que a campanha vai remunerar. As sugeridas já estão marcadas.</div></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {ACOES_DISPONIVEIS.map((a) => {
                const ativa = (campanha.acoesAtivas || []).includes(a.id);
                return (
                  <button key={a.id} onClick={() => toggleAcao(a.id)} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8,
                    border: `1.5px solid ${ativa ? "var(--brand)" : "var(--border)"}`,
                    background: ativa ? "var(--brand-50)" : "var(--surface)",
                    cursor: "pointer", fontSize: 13, textAlign: "left",
                  }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${ativa ? "var(--brand)" : "var(--border)"}`, background: ativa ? "var(--brand)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {ativa && <Check size={12} color="#fff" />}
                    </div>
                    <span style={{ color: ativa ? "var(--text-1)" : "var(--text-2)" }}>{a.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Valores por ação */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-row" style={{ marginBottom: 4 }}>
              <b style={{ fontSize: 14 }}>Quanto você paga por ação</b>
              <span className="vx-chip"><Wallet size={12} /> {money(disponivel)} disponível</span>
            </div>

            {/* Sugestão com IA */}
            <div style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 10, padding: "12px 14px", marginBottom: 14, marginTop: 10 }}>
              <div className="vx-row" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <TrendingUp size={14} color="var(--brand)" />
                  <b style={{ fontSize: 13 }}>Sugestão com IA</b>
                </div>
                <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={calcularSugestaoIA}>
                  <Sparkles size={12} /> Calcular
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Ticket médio</span>
                <div style={{ position: "relative", maxWidth: 160 }}>
                  <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-2)", fontSize: 12.5, pointerEvents: "none" }}>R$</span>
                  <input className="vx-input vx-mono" style={{ paddingLeft: 28, fontSize: 13, height: 32 }} inputMode="decimal"
                    placeholder={emp.ticket ? String(emp.ticket).replace("R$", "").trim() : "0,00"}
                    value={ticketLocal} onChange={(e) => setTicketLocal(e.target.value.replace(/[^\d,]/g, ""))} />
                </div>
              </div>
              {mostrarSugestao && sugestaoIA && sugestaoIA.disponivel && (
                <div style={{ marginTop: 10 }}>
                  <div className="vx-grid vx-g2" style={{ marginBottom: 10 }}>
                    {sugestaoIA.tipo === "visita" ? (
                      <>
                        <div style={{ background: "var(--surface)", borderRadius: 8, padding: "9px 11px", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Por visita realizada</div>
                          <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>{money(sugestaoIA.valorVisita.bruto)}</div>
                        </div>
                        {sugestaoIA.comissaoVenda?.bruto > 0 && (
                          <div style={{ background: "var(--surface)", borderRadius: 8, padding: "9px 11px", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Comissão por venda</div>
                            <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>{money(sugestaoIA.comissaoVenda.bruto)}</div>
                          </div>
                        )}
                      </>
                    ) : (
                      sugestaoIA.tarefas?.filter((t) => (campanha.acoesAtivas || []).includes(t.tipo)).map((t) => (
                        <div key={t.tipo} style={{ background: "var(--surface)", borderRadius: 8, padding: "9px 11px", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{ACOES[t.tipo]?.nome || t.tipo}</div>
                          <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>{money(t.bruto)}</div>
                          <div className="vx-mut" style={{ fontSize: 11 }}>Faixa: {money(t.minimo)} – {money(t.maximo)}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={aceitarSugestaoIA}><Check size={12} /> Aceitar sugestão</button>
                </div>
              )}
              {mostrarSugestao && sugestaoIA && !sugestaoIA.disponivel && (
                <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>{sugestaoIA.motivo}</div>
              )}
            </div>

            <div className="vx-grid vx-g2">
              {(campanha.acoesAtivas || []).map((k) => (
                <label key={k}>
                  <div className="vx-label">{ACOES_DISPONIVEIS.find((a) => a.id === k)?.nome || ACOES[k]?.nome || k}</div>
                  <input className="vx-input vx-mono" type="number" min="0" step="0.5"
                    value={campanha.tarefas?.[k] || 0}
                    onChange={(e) => set("tarefas", { ...campanha.tarefas, [k]: Number(e.target.value) })} />
                </label>
              ))}
            </div>

            {/* Modelo de pagamento */}
            {(campanha.acoesAtivas || []).length > 1 && (
              <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
                <div className="vx-label" style={{ marginBottom: 8 }}>Modelo de pagamento</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <CardOption selected={campanha.remuneracaoCumulativa} onClick={() => set("remuneracaoCumulativa", true)} title="Cumulativo" subtitle="Paga cada ação individualmente (ex: R$10 lead + R$30 reunião)." />
                  <CardOption selected={!campanha.remuneracaoCumulativa} onClick={() => set("remuneracaoCumulativa", false)} title="Resultado final" subtitle="Paga apenas a última ação do funil. Ações intermediárias não são remuneradas." />
                </div>
              </div>
            )}

            <div style={{ marginTop: 14 }}><div className="vx-label">Orçamento total</div>
              <CampoOrcamento value={campanha.orcamento} onChange={(v) => set("orcamento", v)} /></div>

            <div className="vx-grid vx-g2" style={{ marginTop: 12 }}>
              <label><div className="vx-label">Prazo por tarefa (horas)</div>
                <input className="vx-input vx-mono" type="number" min="1" value={campanha.prazoHoras} onChange={(e) => set("prazoHoras", Number(e.target.value))} /></label>
              <label><div className="vx-label">Limite por profissional</div>
                <input className="vx-input vx-mono" type="number" min="0" value={campanha.limitePorProfissional} onChange={(e) => set("limitePorProfissional", Number(e.target.value))} /></label>
            </div>

            {/* Comissão */}
            <div style={{ marginTop: 14 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={campanha.temComissao || false} onChange={(e) => set("temComissao", e.target.checked)} />
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Pagar comissão adicional por venda fechada</div>
              </label>
              {campanha.temComissao && (
                <div className="vx-grid vx-g2" style={{ marginTop: 10 }}>
                  <label><div className="vx-label">% de comissão sobre venda</div>
                    <div style={{ position: "relative" }}>
                      <input className="vx-input vx-mono" type="number" min="0" max="100" step="0.5" value={campanha.percentualComissao || 0} onChange={(e) => set("percentualComissao", Number(e.target.value))} />
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13 }}>%</span>
                    </div></label>
                </div>
              )}
            </div>
          </div>

          {/* Treinamento */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-row" style={{ marginBottom: 12 }}>
              <div><b style={{ color: "var(--brand)" }}>Treinamento</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Opcional. O profissional conhece a operação antes de começar.</div></div>
              <button className="vx-btn vx-btn-sm" onClick={adicionarTreinamento}><Plus size={13} /> Módulo</button>
            </div>

            <div style={{ background: "linear-gradient(135deg, var(--brand-50), var(--indigo-50, var(--brand-50)))", border: "1px solid var(--brand-100)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <BookOpen size={14} color="var(--brand)" />
                <b style={{ fontSize: 13 }}>Gerar treinamento com IA</b>
              </div>
              <div className="vx-grid vx-g2" style={{ marginBottom: 10 }}>
                {Object.entries(MODELOS_TREINAMENTO).map(([k, m]) => (
                  <label key={k} style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer", background: modeloTreinamento === k ? "var(--brand-50)" : "var(--surface)", border: `1px solid ${modeloTreinamento === k ? "var(--brand)" : "var(--border)"}`, borderRadius: 8, padding: "9px 11px" }}>
                    <input type="radio" name="modeloTreinamento" value={k} checked={modeloTreinamento === k} onChange={() => setModeloTreinamento(k)} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div><div style={{ fontSize: 13, fontWeight: 600 }}>{m.nome}</div><div className="vx-mut" style={{ fontSize: 11.5 }}>{m.descricao}</div></div>
                  </label>
                ))}
              </div>
              <button className="vx-btn vx-btn-primary vx-btn-sm" disabled={gerandoTreinamento} onClick={gerarTreinamentoComIA}>
                {gerandoTreinamento ? <><Loader size={13} /> Gerando…</> : <><Sparkles size={13} /> Gerar treinamento</>}
              </button>
            </div>

            {(campanha.treinamento || []).length === 0
              ? <div className="vx-campaign-inline-empty">Gere com IA ou adicione módulos manualmente.</div>
              : <div className="vx-training-drafts">
                  {campanha.treinamento.map((modulo, i) => (
                    <div key={modulo.id || i}>
                      <input className="vx-input" placeholder="Título do módulo" value={modulo.titulo || ""} onChange={(e) => atualizarTreinamento(i, "titulo", e.target.value)} />
                      <textarea className="vx-input" placeholder="Conteúdo ou URL" value={modulo.conteudo || ""} onChange={(e) => atualizarTreinamento(i, "conteudo", e.target.value)} />
                      <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => removerTreinamento(i)}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>}
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(2)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(4)}>Revisar campanha <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 5: REVISÃO ═══════════════════════ */}
      {passo === 4 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Revisão & Publicação</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            Confira tudo antes de criar. A campanha nasce como rascunho.
          </p>

          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            {/* Resumo */}
            <div className="vx-grid vx-g2" style={{ fontSize: 13 }}>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Campanha</span><div style={{ fontWeight: 600 }}>{campanha.titulo}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Objetivo</span><div style={{ fontWeight: 600 }}>{objUI?.nome || objBase?.nome || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Modelo</span><div style={{ fontWeight: 600 }}>{MODELOS_TRABALHO[campanha.modeloTrabalho]?.nome || "Remoto"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Função</span><div style={{ fontWeight: 600 }}>{FUNCOES[campanha.funcao]?.nome || campanha.funcao}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>ICP</span><div style={{ fontWeight: 600 }}>{campanha.publico || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Mercado</span><div style={{ fontWeight: 600 }}>{MERCADOS[campanha.mercado]?.label || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Origem leads</span><div style={{ fontWeight: 600 }}>{ORIGENS_LEAD[campanha.origemLeads]?.label || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Canais</span><div style={{ fontWeight: 600 }}>{(campanha.canais || []).map((c) => CANAIS.find((x) => x.id === c)?.nome || c).join(", ") || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Admissão</span><div style={{ fontWeight: 600 }}>{PROCESSOS_ADMISSAO.find((p) => p.id === campanha.processoAdmissao)?.label || "Manual"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Visibilidade</span><div style={{ fontWeight: 600 }}>{campanha.visibilidade === "publica" ? "Pública" : campanha.visibilidade === "privada" ? "Privada" : "Oculta"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Certificação</span><div style={{ fontWeight: 600 }}>{campanha.exigeCertificacao ? "Obrigatória" : "Não exigida"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Treinamento</span><div style={{ fontWeight: 600 }}>{(campanha.treinamento || []).length} módulo(s)</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Prazo / ação</span><div style={{ fontWeight: 600 }}>{campanha.prazoHoras}h</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Orçamento</span><div style={{ fontWeight: 600 }} className="vx-mono">{money(campanha.orcamento)}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Pagamento</span><div style={{ fontWeight: 600 }}>{campanha.remuneracaoCumulativa ? "Cumulativo" : "Resultado final"}</div></div>
            </div>

            <hr className="vx-sep" />
            <div className="vx-eyebrow" style={{ marginBottom: 8 }}>O que você paga</div>
            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              {(campanha.acoesAtivas || []).map((k) => (
                <div key={k} className="vx-row">
                  <span style={{ color: "var(--text-2)" }}>{ACOES_DISPONIVEIS.find((a) => a.id === k)?.nome || ACOES[k]?.nome || k}</span>
                  <b className="vx-mono">{money(Number(campanha.tarefas?.[k] || 0))}</b>
                </div>
              ))}
              {campanha.temComissao && campanha.percentualComissao > 0 && (
                <div className="vx-row">
                  <span style={{ color: "var(--text-2)" }}>Comissão adicional por venda</span>
                  <b className="vx-mono">{campanha.percentualComissao}%</b>
                </div>
              )}
            </div>

            {custo?.estimativaPorProfissional > 0 && (
              <div className="vx-mut" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
                Estimativa por profissional (meta {campanha.limitePorProfissional || 10}): <b className="vx-mono">{money(custo.estimativaPorProfissional)}</b>
              </div>
            )}

            <hr className="vx-sep" />
            <div className="vx-eyebrow" style={{ marginBottom: 8 }}>Diagnóstico</div>
            {diag.bloqueios.length > 0 ? (
              <div>
                {diag.bloqueios.map((b) => (
                  <div key={b.campo} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", fontSize: 13, color: "var(--danger, #dc2626)" }}>
                    <AlertCircle size={14} /> {b.msg}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--brand)" }}>
                <CheckCircle2 size={14} /> Campanha pronta para ser criada como rascunho.
              </div>
            )}
            {diag.recomendacoes.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {diag.recomendacoes.map((r) => (
                  <div key={r.campo} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", fontSize: 12, color: "var(--amber, #f59e0b)" }}>
                    <AlertCircle size={12} /> {r.msg}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(3)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={criar}>
              {salvando ? "Salvando…" : <>Salvar como rascunho <Check size={14} /></>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useMemo } from "react";
import CidadeEstadoSelector from "./CidadeEstadoSelector.jsx";
import { Sparkles, ArrowRight, ArrowLeft, Check, Wallet, Loader, Target, CalendarCheck, MapPin, BadgeDollarSign, Workflow, Plus, Trash2, ShieldCheck, TrendingUp, BookOpen, ChevronDown, ChevronUp, Send, RotateCcw, Search, Filter, HandCoins, Footprints, Settings, Laptop, Building2, MessageCircle, Phone, Mail, Linkedin, Instagram, Globe, Users, Eye, EyeOff, Lock, AlertCircle, CheckCircle2, FileText, Upload, Library, Database, UserPlus, Shuffle, Zap, SlidersHorizontal, Image, Link2, ClipboardCheck, UserCheck, Bot, X, File, CloudUpload, GripVertical, Download, Video, Music, FileSpreadsheet, Presentation } from "lucide-react";
import { api, API_URL } from "../../lib/api.js";
import { lerJson, gravarJson, remover as removerArmazenado } from "../../lib/armazenamento.js";
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

const SUGESTOES_FUNCAO = {
  sdr: ["contato", "lead_qualificado", "agendamento", "follow", "ligacao"],
  bdr: ["lead_encontrado", "lead_cadastrado", "lead_validado", "contato", "lead_qualificado"],
  closer: ["realizada", "proposta", "venda"],
  pap: ["visita", "lead_encontrado", "lead_qualificado", "venda"],
};

const EVIDENCIAS_OPCOES = [
  { id: "registro_discadora", nome: "Registro na discadora" },
  { id: "registro_whatsapp", nome: "Registro no WhatsApp" },
  { id: "registro_crm", nome: "Registro no CRM" },
  { id: "registro_calendario", nome: "Registro no calendário" },
  { id: "registro_venda", nome: "Registro de venda" },
  { id: "confirmacao_comparecimento", nome: "Confirmação de comparecimento" },
  { id: "envio_imagem", nome: "Envio de imagem" },
  { id: "envio_documento", nome: "Envio de documento" },
  { id: "envio_link", nome: "Envio de link" },
  { id: "evidencia_personalizada", nome: "Envio de evidência personalizada" },
  { id: "confirmacao_manual", nome: "Confirmação manual da empresa" },
];

const METODOS_APROVACAO = [
  { id: "manual", nome: "Aprovação manual pela empresa", icon: UserCheck },
  { id: "automatica", nome: "Validação automática", icon: CheckCircle2 },
  { id: "ia", nome: "Validação assistida por IA", icon: Bot },
];

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
        {Icon && <Icon size={18} color={selected ? "#318CE7" : "var(--text-2)"} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: selected ? 600 : 400, color: "var(--ink, #171717)" }}>{title}</div>
          {subtitle && <div className="vx-mut" style={{ fontSize: 12, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {selected && <Check size={16} color="#318CE7" />}
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
          color: isActive(item.id) ? "var(--ink, #171717)" : "var(--text-2)",
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
  const chaveRascunho = `rycs-wizard-${emp.id}`;
  const rascunhoSalvo = useRef(lerJson(chaveRascunho, null));
  const [passo, _setPasso] = useState(rascunhoSalvo.current?.passo || 0);
  const setPasso = (p) => { _setPasso(p); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const [campanha, setCampanha] = useState(rascunhoSalvo.current?.campanha || null);
  const [salvando, setSalvando] = useState(false);
  const [explicacao, setExplicacao] = useState("");
  const [gerandoTreinamento, setGerandoTreinamento] = useState(false);
  const [modeloTreinamento, setModeloTreinamento] = useState("rapido");
  const [ticketLocal, setTicketLocal] = useState("");
  const [sugestaoIA, setSugestaoIA] = useState(null);
  const [mostrarSugestao, setMostrarSugestao] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [uploadProgresso, setUploadProgresso] = useState({});
  const [enviandoMateriais, setEnviandoMateriais] = useState(false);
  const [modalBiblioteca, setModalBiblioteca] = useState(false);
  const [bibliotecaMateriais, setBibliotecaMateriais] = useState([]);
  const [bibliotecaBusca, setBibliotecaBusca] = useState("");
  const [bibliotecaFiltro, setBibliotecaFiltro] = useState("");
  const [bibliotecaSel, setBibliotecaSel] = useState([]);
  const [carregandoBiblioteca, setCarregandoBiblioteca] = useState(false);
  const uploadInputRef = useRef(null);

  const disponivel = saldoDisponivel(emp);
  const set = (k, v) => setCampanha((c) => ({ ...c, [k]: v }));

  useEffect(() => {
    if (campanha) gravarJson(chaveRascunho, { campanha, passo });
  }, [campanha, passo, chaveRascunho]);
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
    const { formasGanhoRascunho, nomeOperacao, ...payload } = campanha;
    // Criar operação se necessário
    if (payload.estruturaComercial === "operacao" && nomeOperacao?.trim()) {
      const opR = await api("/operacoes", { nome: nomeOperacao.trim() });
      if (opR?.id) payload.operacaoId = opR.id;
    }
    const r = await api("/campaigns", payload);
    setSalvando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível criar a campanha.");
    // Salvar formas de ganho configuradas no wizard
    if (formasGanhoRascunho?.length) {
      for (const fg of formasGanhoRascunho) {
        if (fg.nome?.trim()) await api(`/campaigns/${r.id}/formas-ganho`, fg);
      }
    }
    // Vincular materiais à campanha
    const mats = campanha.materiaisVinculados || [];
    if (mats.length) {
      const payload2 = mats.map((m, i) => ({
        materialId: m.id, categoria: m.categoria || "outros",
        obrigatoriedade: m.obrigatoriedade || "complementar", ordem: i,
      }));
      await fetch(`${API_URL}/api/campaigns/${r.id}/materiais`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materiais: payload2 }), credentials: "include",
      });
    }
    removerArmazenado(chaveRascunho);
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
      {rascunhoSalvo.current && campanha && (
        <div className="vx-notice" style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Rascunho restaurado automaticamente{campanha.titulo ? `: "${campanha.titulo}"` : ""}.</span>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => { removerArmazenado(chaveRascunho); rascunhoSalvo.current = null; setCampanha(null); setPasso(0); }}>Descartar</button>
        </div>
      )}
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

          {/* Materiais da campanha */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: "var(--brand)" }}>Materiais da campanha</b>
              <div className="vx-mut" style={{ fontSize: 11.5 }}>Disponibilize os materiais que os profissionais utilizarão durante a operação.</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {/* Card 1 — Enviar arquivos */}
              <div
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#318CE7"; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "var(--border)";
                  const files = [...e.dataTransfer.files].map((f) => ({ file: f, id: `up-${Date.now()}-${Math.random().toString(36).slice(2)}`, nome: f.name, tamanho: f.size, status: "pendente" }));
                  if (files.length) setUploadQueue((prev) => [...prev, ...files]);
                }}
                style={{ border: "1.5px dashed var(--border)", borderRadius: 12, padding: "24px 16px", textAlign: "center", cursor: "pointer", transition: "border-color .15s", background: "var(--surface)" }}
                onClick={() => uploadInputRef.current?.click()}
              >
                <CloudUpload size={28} color="var(--muted)" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Enviar arquivos</div>
                <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>Selecione ou arraste arquivos do seu dispositivo.</div>
                <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={(e) => { e.stopPropagation(); uploadInputRef.current?.click(); }} style={{ background: "#318CE7", borderColor: "#318CE7" }}>
                  <Plus size={13} /> Selecionar arquivos
                </button>
                <input ref={uploadInputRef} type="file" multiple hidden
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.mp4,.mov,.mp3,.wav,.m4a,.txt,.key"
                  onChange={(e) => {
                    const files = [...e.target.files].map((f) => ({ file: f, id: `up-${Date.now()}-${Math.random().toString(36).slice(2)}`, nome: f.name, tamanho: f.size, status: "pendente" }));
                    if (files.length) setUploadQueue((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                />
              </div>
              {/* Card 2 — Biblioteca da empresa */}
              <div
                style={{ border: "1.5px solid var(--border)", borderRadius: 12, padding: "24px 16px", textAlign: "center", cursor: "pointer", background: "var(--surface)", transition: "border-color .15s" }}
                onClick={async () => {
                  setModalBiblioteca(true);
                  setCarregandoBiblioteca(true);
                  setBibliotecaSel((campanha.materiaisVinculados || []).filter((m) => m.origem === "biblioteca").map((m) => m.id));
                  const r = await api("/materiais");
                  if (r?.materiais) setBibliotecaMateriais(r.materiais);
                  setCarregandoBiblioteca(false);
                }}
              >
                <Library size={28} color="var(--muted)" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Biblioteca da empresa</div>
                <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>Vincule materiais que já estão cadastrados na RYCS.</div>
                <button className="vx-btn vx-btn-sm" onClick={(e) => e.stopPropagation()} style={{ pointerEvents: "none" }}>
                  <Search size={13} /> Buscar materiais
                </button>
              </div>
            </div>

            {/* Upload queue / progress */}
            {uploadQueue.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="vx-eyebrow" style={{ marginBottom: 8 }}>ENVIANDO ARQUIVOS</div>
                {uploadQueue.map((arq) => (
                  <div key={arq.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                    <File size={16} color="var(--muted)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{arq.nome}</div>
                      <div className="vx-mut" style={{ fontSize: 11 }}>
                        {arq.status === "pendente" && `${(arq.tamanho / 1024).toFixed(0)} KB — Aguardando`}
                        {arq.status === "enviando" && `${uploadProgresso[arq.id] || 0}%`}
                        {arq.status === "ok" && "Enviado"}
                        {arq.status === "erro" && <span style={{ color: "#DC2626" }}>{arq.erro || "Erro no envio"}</span>}
                      </div>
                      {arq.status === "enviando" && <div style={{ height: 3, borderRadius: 2, background: "var(--border)", marginTop: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${uploadProgresso[arq.id] || 0}%`, background: "#318CE7", borderRadius: 2, transition: "width .2s" }} /></div>}
                    </div>
                    {arq.status !== "enviando" && (
                      <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setUploadQueue((prev) => prev.filter((a) => a.id !== arq.id))} style={{ padding: 2 }}><X size={14} /></button>
                    )}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="vx-btn vx-btn-primary vx-btn-sm" disabled={enviandoMateriais || uploadQueue.every((a) => a.status === "ok")} style={{ background: "#318CE7", borderColor: "#318CE7" }}
                    onClick={async () => {
                      setEnviandoMateriais(true);
                      const vinculados = [...(campanha.materiaisVinculados || [])];
                      for (const arq of uploadQueue) {
                        if (arq.status === "ok") continue;
                        setUploadQueue((prev) => prev.map((a) => a.id === arq.id ? { ...a, status: "enviando" } : a));
                        try {
                          const r = await new Promise((resolve, reject) => {
                            const xhr = new XMLHttpRequest();
                            xhr.open("POST", `${API_URL}/api/materiais/upload`);
                            xhr.withCredentials = true;
                            xhr.setRequestHeader("Content-Type", arq.file.type || "application/octet-stream");
                            xhr.setRequestHeader("X-Arquivo-Nome", encodeURIComponent(arq.file.name));
                            xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgresso((prev) => ({ ...prev, [arq.id]: Math.round(e.loaded / e.total * 100) })); };
                            xhr.onload = () => { try { const res = JSON.parse(xhr.responseText); if (res.error) reject(new Error(res.error)); else resolve(res); } catch { reject(new Error("Erro no envio")); } };
                            xhr.onerror = () => reject(new Error("Falha na conexão"));
                            xhr.send(arq.file);
                          });
                          setUploadQueue((prev) => prev.map((a) => a.id === arq.id ? { ...a, status: "ok" } : a));
                          vinculados.push({ id: r.id, nome: r.nome, categoria: r.categoria, mimetype: r.mimetype, tamanho: r.tamanho, origem: "upload", obrigatoriedade: "complementar", salvarBiblioteca: true });
                        } catch (e) {
                          setUploadQueue((prev) => prev.map((a) => a.id === arq.id ? { ...a, status: "erro", erro: e.message } : a));
                        }
                      }
                      set("materiaisVinculados", vinculados);
                      setEnviandoMateriais(false);
                    }}>
                    {enviandoMateriais ? <><Loader size={13} /> Enviando...</> : <><Upload size={13} /> Enviar todos</>}
                  </button>
                  <button className="vx-btn vx-btn-sm" onClick={() => { setUploadQueue([]); setUploadProgresso({}); }}>Limpar fila</button>
                </div>
              </div>
            )}

            {/* Materiais vinculados */}
            {(campanha.materiaisVinculados || []).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="vx-eyebrow" style={{ marginBottom: 8 }}>MATERIAIS VINCULADOS ({(campanha.materiaisVinculados || []).length})</div>
                {(campanha.materiaisVinculados || []).map((mat, idx) => {
                  const IconeMat = mat.mimetype?.startsWith("video/") ? Video : mat.mimetype?.startsWith("audio/") ? Music : mat.mimetype?.includes("spreadsheet") || mat.mimetype?.includes("excel") ? FileSpreadsheet : mat.mimetype?.includes("presentation") || mat.mimetype?.includes("powerpoint") ? Presentation : mat.mimetype?.includes("image") ? Image : FileText;
                  return (
                    <div key={mat.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6 }}>
                      <GripVertical size={14} color="var(--border)" style={{ cursor: "grab", flexShrink: 0 }} />
                      <div style={{ width: 32, height: 32, borderRadius: 7, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <IconeMat size={16} color="var(--muted)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mat.nome}</div>
                        <div className="vx-mut" style={{ fontSize: 11, display: "flex", gap: 8 }}>
                          <span>{mat.categoria || "arquivo"}{mat.tamanho ? ` · ${(mat.tamanho / 1024).toFixed(0)} KB` : ""}</span>
                          <span style={{ color: mat.origem === "upload" ? "#318CE7" : "var(--brand)" }}>{mat.origem === "upload" ? "Enviado do dispositivo" : "Biblioteca da empresa"}</span>
                        </div>
                      </div>
                      <select className="vx-input" style={{ width: 140, fontSize: 11.5, height: 28, padding: "0 8px" }}
                        value={mat.obrigatoriedade || "complementar"}
                        onChange={(e) => set("materiaisVinculados", (campanha.materiaisVinculados || []).map((m, i) => i === idx ? { ...m, obrigatoriedade: e.target.value } : m))}>
                        <option value="complementar">Complementar</option>
                        <option value="obrigatorio">Consulta obrigatória</option>
                      </select>
                      <button className="vx-btn vx-btn-ghost vx-btn-sm" title="Desvincular" onClick={() => set("materiaisVinculados", (campanha.materiaisVinculados || []).filter((_, i) => i !== idx))} style={{ padding: 3 }}><Trash2 size={14} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Biblioteca */}
          {modalBiblioteca && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
              onClick={(e) => { if (e.target === e.currentTarget) setModalBiblioteca(false); }}>
              <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 640, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Biblioteca de materiais</h3>
                    <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setModalBiblioteca(false)} style={{ padding: 3 }}><X size={18} /></button>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                      <input className="vx-input" placeholder="Buscar por nome..." value={bibliotecaBusca} onChange={(e) => setBibliotecaBusca(e.target.value)} style={{ paddingLeft: 32, fontSize: 13, height: 36 }} />
                    </div>
                    <select className="vx-input" value={bibliotecaFiltro} onChange={(e) => setBibliotecaFiltro(e.target.value)} style={{ width: 140, fontSize: 12.5, height: 36 }}>
                      <option value="">Todos os tipos</option>
                      <option value="apresentacao">Apresentações</option>
                      <option value="documento">Documentos</option>
                      <option value="foto">Fotos</option>
                      <option value="video">Vídeos</option>
                      <option value="audio">Áudios</option>
                      <option value="link">Links</option>
                    </select>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "0 24px" }}>
                  {carregandoBiblioteca ? (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}><Loader size={20} style={{ animation: "spin 1s linear infinite" }} /><div style={{ marginTop: 8, fontSize: 13 }}>Carregando materiais...</div></div>
                  ) : (() => {
                    const filtrados = bibliotecaMateriais.filter((m) => {
                      if (bibliotecaFiltro && m.categoria !== bibliotecaFiltro) return false;
                      if (bibliotecaBusca && !m.nome.toLowerCase().includes(bibliotecaBusca.toLowerCase())) return false;
                      return true;
                    });
                    return filtrados.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>Nenhum material encontrado na biblioteca.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 4 }}>
                        {filtrados.map((mat) => {
                          const sel = bibliotecaSel.includes(mat.id);
                          const IconeMat = mat.categoria === "video" ? Video : mat.categoria === "audio" ? Music : mat.categoria === "foto" ? Image : mat.categoria === "apresentacao" ? Presentation : mat.categoria === "link" ? Link2 : FileText;
                          return (
                            <button key={mat.id} onClick={() => setBibliotecaSel((prev) => sel ? prev.filter((x) => x !== mat.id) : [...prev, mat.id])}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1.5px solid ${sel ? "#318CE7" : "var(--border)"}`, borderRadius: 8, background: sel ? "rgba(49,140,231,0.04)" : "var(--surface)", cursor: "pointer", width: "100%", textAlign: "left", transition: "border-color .15s" }}>
                              <div style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${sel ? "#318CE7" : "var(--border)"}`, background: sel ? "#318CE7" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {sel && <Check size={12} color="#fff" />}
                              </div>
                              <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <IconeMat size={16} color={sel ? "#318CE7" : "var(--muted)"} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: sel ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mat.nome}</div>
                                <div className="vx-mut" style={{ fontSize: 11 }}>{mat.categoria}{mat.tamanho ? ` · ${(mat.tamanho / 1024).toFixed(0)} KB` : ""}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                  <span className="vx-mut" style={{ fontSize: 13 }}>{bibliotecaSel.length} material(is) selecionado(s)</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="vx-btn vx-btn-sm" onClick={() => setModalBiblioteca(false)}>Cancelar</button>
                    <button className="vx-btn vx-btn-sm vx-btn-primary" disabled={!bibliotecaSel.length} style={{ background: "#318CE7", borderColor: "#318CE7" }}
                      onClick={() => {
                        const existentes = new Set((campanha.materiaisVinculados || []).map((m) => m.id));
                        const novos = bibliotecaSel.filter((id) => !existentes.has(id)).map((id) => {
                          const mat = bibliotecaMateriais.find((m) => m.id === id);
                          return mat ? { id: mat.id, nome: mat.nome, categoria: mat.categoria, mimetype: mat.mimetype, tamanho: mat.tamanho, origem: "biblioteca", obrigatoriedade: "complementar" } : null;
                        }).filter(Boolean);
                        set("materiaisVinculados", [...(campanha.materiaisVinculados || []), ...novos]);
                        setModalBiblioteca(false);
                      }}>
                      <Check size={13} /> Vincular materiais selecionados
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Base de leads da campanha */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: "var(--brand)" }}>Base de leads da campanha</b>
              <div className="vx-mut" style={{ fontSize: 11.5 }}>Defina quais contatos os profissionais poderão trabalhar.</div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <CardOption selected={campanha.fonteLeads === "empresa"} onClick={() => set("fonteLeads", "empresa")} icon={Database} title="Utilizar leads da minha empresa" subtitle="Disponibilize contatos da sua base para os profissionais." />
              <CardOption selected={campanha.fonteLeads === "profissional"} onClick={() => set("fonteLeads", "profissional")} icon={UserPlus} title="Profissionais encontram novos leads" subtitle="Os profissionais prospectam e cadastram seus próprios leads." />
              <CardOption selected={campanha.fonteLeads === "ambos"} onClick={() => set("fonteLeads", "ambos")} icon={Shuffle} title="Combinar as duas opções" subtitle="A empresa fornece leads e os profissionais também podem prospectar." />
            </div>
            {(campanha.fonteLeads === "empresa" || campanha.fonteLeads === "ambos") && (
              <div style={{ marginTop: 14, padding: "14px 16px", background: "var(--brand-50)", borderRadius: 10, border: "1px solid var(--brand-100)" }}>
                <b style={{ fontSize: 13, color: "var(--brand)" }}>Distribuição dos leads</b>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <CardOption selected={campanha.distribuicaoLeads === "fila"} onClick={() => set("distribuicaoLeads", "fila")} title="Fila compartilhada" subtitle="Profissionais solicitam o próximo lead disponível." />
                  <CardOption selected={campanha.distribuicaoLeads === "automatica"} onClick={() => set("distribuicaoLeads", "automatica")} title="Distribuição automática" subtitle="O sistema distribui os contatos entre os profissionais elegíveis." />
                  <CardOption selected={campanha.distribuicaoLeads === "manual"} onClick={() => set("distribuicaoLeads", "manual")} title="Distribuição manual" subtitle="A empresa escolhe quais contatos atribuir a cada profissional." />
                </div>
                <div className="vx-grid vx-g2" style={{ marginTop: 12 }}>
                  <label><div className="vx-label">Leads simultâneos por profissional</div>
                    <input className="vx-input vx-mono" type="number" min="0" value={campanha.limiteLeadsSimultaneos || 0}
                      onChange={(e) => set("limiteLeadsSimultaneos", Number(e.target.value))} placeholder="0 = sem limite" /></label>
                  <label><div className="vx-label">Novos leads por dia</div>
                    <input className="vx-input vx-mono" type="number" min="0" value={campanha.limiteLeadsDia || 0}
                      onChange={(e) => set("limiteLeadsDia", Number(e.target.value))} placeholder="0 = sem limite" /></label>
                  <label><div className="vx-label">Prazo primeiro contato (horas)</div>
                    <input className="vx-input vx-mono" type="number" min="0" value={campanha.prazoContatoHoras || 0}
                      onChange={(e) => set("prazoContatoHoras", Number(e.target.value))} placeholder="0 = sem prazo" /></label>
                  <label><div className="vx-label">Prazo inatividade (horas)</div>
                    <input className="vx-input vx-mono" type="number" min="0" value={campanha.prazoInatividadeHoras || 0}
                      onChange={(e) => set("prazoInatividadeHoras", Number(e.target.value))} placeholder="0 = sem prazo" /></label>
                </div>
                <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 8 }}>Após salvar, acesse a aba Leads para vincular os contatos da base.</div>
              </div>
            )}
          </div>

          {/* Estrutura comercial */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Estrutura comercial</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Defina se esta campanha é independente ou faz parte de uma operação integrada.</div></div>
            <div style={{ display: "grid", gap: 8 }}>
              <CardOption selected={campanha.estruturaComercial === "independente" || !campanha.estruturaComercial} onClick={() => set("estruturaComercial", "independente")} icon={Target} title="Campanha independente" subtitle="Funciona por conta própria, sem vínculo com outras campanhas." />
              <CardOption selected={campanha.estruturaComercial === "vinculada"} onClick={() => set("estruturaComercial", "vinculada")} icon={Workflow} title="Vincular a outra campanha" subtitle="Continuidade comercial: leads e oportunidades são transferidos entre campanhas." />
              <CardOption selected={campanha.estruturaComercial === "operacao"} onClick={() => set("estruturaComercial", "operacao")} icon={Shuffle} title="Criar uma operação integrada" subtitle="Agrupe campanhas relacionadas (ex: SDR + Closer) em uma única operação." />
            </div>
            {campanha.estruturaComercial === "operacao" && (
              <div style={{ marginTop: 12 }}>
                <label><div className="vx-label">Nome da operação</div>
                  <input className="vx-input" placeholder="Ex: RYCS Sales Machine" value={campanha.nomeOperacao || ""}
                    onChange={(e) => set("nomeOperacao", e.target.value)} />
                </label>
              </div>
            )}
            {campanha.estruturaComercial === "vinculada" && (
              <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 10, padding: "10px 12px", background: "var(--brand-50)", borderRadius: 8, border: "1px solid var(--brand-100)" }}>
                Após criar a campanha, acesse a aba de configurações para definir a campanha de origem ou destino e as regras de transferência.
              </div>
            )}
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

          {/* Seletor de modo */}
          <div style={{ marginTop: 14, marginBottom: 14 }}>
            <div className="vx-eyebrow" style={{ marginBottom: 8 }}>COMO DESEJA CONFIGURAR AS AÇÕES REMUNERADAS?</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { id: "rapido", icon: Zap, titulo: "Seleção rápida", desc: "Escolha ações comerciais prontas e defina quanto deseja pagar por cada uma." },
                { id: "personalizado", icon: SlidersHorizontal, titulo: "Personalizado", desc: "Crie suas próprias ações, valores e condições de pagamento." },
              ].map((m) => {
                const on = (campanha.modoAcoesRemuneradas || "rapido") === m.id;
                return (
                  <button key={m.id} onClick={() => {
                    if (m.id === "personalizado" && (campanha.modoAcoesRemuneradas || "rapido") === "rapido") {
                      const existentes = (campanha.formasGanhoRascunho || []);
                      const convertidas = (campanha.acoesAtivas || []).filter((k) => !existentes.some((f) => f.modeloOriginalId === k)).map((k) => ({
                        tempId: `fg-${k}-${Date.now()}`, nome: ACOES_DISPONIVEIS.find((a) => a.id === k)?.nome || ACOES[k]?.nome || k,
                        tipoRemuneracao: k === "venda" && campanha.vendaTipoRemuneracao === "percentual" ? "comissao" : "fixo",
                        valor: campanha.tarefas?.[k] || 0, eventoComercial: "", descricao: "",
                        origem: "predefinido", modeloOriginalId: k, condicoesRecebimento: "", metodoAprovacao: "manual", evidencias: [],
                      }));
                      set("formasGanhoRascunho", [...convertidas, ...existentes.filter((f) => f.origem !== "predefinido")]);
                    }
                    set("modoAcoesRemuneradas", m.id);
                  }} style={{
                    padding: "18px 16px", cursor: "pointer", textAlign: "left", width: "100%", borderRadius: 12,
                    border: `1.5px solid ${on ? "#318CE7" : "var(--border)"}`,
                    background: on ? "rgba(49,140,231,0.04)" : "var(--surface)",
                    transition: "border-color .15s, background .15s", position: "relative",
                  }}>
                    {on && <div style={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: "50%", background: "#318CE7", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={12} color="#fff" /></div>}
                    <m.icon size={22} color={on ? "#318CE7" : "var(--muted)"} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink, #171717)", marginBottom: 4 }}>{m.titulo}</div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── MODO SELEÇÃO RÁPIDA ── */}
          {(campanha.modoAcoesRemuneradas || "rapido") === "rapido" && (<>
            <div className="vx-card" style={{ padding: 18 }}>
              <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Ações remuneradas</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Selecione e configure cada ação. Sugestões para {FUNCOES[campanha.funcao]?.nome || campanha.funcao || "SDR"} já estão destacadas.</div></div>
              <div style={{ display: "grid", gap: 8 }}>
                {(() => {
                  const sugeridas = SUGESTOES_FUNCAO[campanha.funcao] || SUGESTOES_FUNCAO.sdr;
                  const ordenadas = [...ACOES_DISPONIVEIS].sort((a, b) => {
                    const sa = sugeridas.includes(a.id) ? 0 : 1;
                    const sb = sugeridas.includes(b.id) ? 0 : 1;
                    return sa - sb;
                  });
                  return ordenadas.map((a) => {
                    const ativa = (campanha.acoesAtivas || []).includes(a.id);
                    const sugerida = sugeridas.includes(a.id);
                    const AcIcon = ACOES[a.id]?.Icon;
                    return (
                      <div key={a.id} style={{ border: `1.5px solid ${ativa ? "#318CE7" : "var(--border)"}`, borderRadius: 10, background: ativa ? "rgba(49,140,231,0.03)" : "var(--surface)", overflow: "hidden", transition: "border-color .15s" }}>
                        <button onClick={() => toggleAcao(a.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", width: "100%", textAlign: "left", cursor: "pointer", border: "none", background: "transparent" }}>
                          <div style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${ativa ? "#318CE7" : "var(--border)"}`, background: ativa ? "#318CE7" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {ativa && <Check size={12} color="#fff" />}
                          </div>
                          {AcIcon && <AcIcon size={16} color={ativa ? "#318CE7" : "var(--muted)"} />}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: ativa ? 600 : 400, color: ativa ? "var(--ink)" : "var(--text-2)" }}>{a.nome}</div>
                            {sugerida && !ativa && <div style={{ fontSize: 11, color: "var(--brand)", marginTop: 1 }}>Recomendada</div>}
                          </div>
                          {ativa && <ChevronDown size={14} color="var(--muted)" />}
                        </button>
                        {ativa && (
                          <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <label>
                              <div className="vx-label">Tipo de remuneração</div>
                              <select className="vx-input" value={a.id === "venda" ? (campanha.vendaTipoRemuneracao || "fixo") : "fixo"}
                                onChange={(e) => { if (a.id === "venda") set("vendaTipoRemuneracao", e.target.value); }}>
                                <option value="fixo">Valor fixo (R$)</option>
                                {a.id === "venda" && <option value="percentual">Comissão (%)</option>}
                              </select>
                            </label>
                            <label>
                              <div className="vx-label">{a.id === "venda" && campanha.vendaTipoRemuneracao === "percentual" ? "Percentual (%)" : "Valor (R$)"}</div>
                              <div style={{ position: "relative" }}>
                                <input className="vx-input vx-mono" type="number" min="0" step="0.5"
                                  max={a.id === "venda" && campanha.vendaTipoRemuneracao === "percentual" ? "100" : undefined}
                                  value={campanha.tarefas?.[a.id] || 0}
                                  onChange={(e) => set("tarefas", { ...campanha.tarefas, [a.id]: Number(e.target.value) })} />
                                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 12, pointerEvents: "none" }}>
                                  {a.id === "venda" && campanha.vendaTipoRemuneracao === "percentual" ? "%" : "R$"}
                                </span>
                              </div>
                            </label>
                            <label>
                              <div className="vx-label">Método de aprovação</div>
                              <select className="vx-input" value={campanha[`aprovacao_${a.id}`] || "manual"}
                                onChange={(e) => set(`aprovacao_${a.id}`, e.target.value)}>
                                {METODOS_APROVACAO.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                              </select>
                            </label>
                            <label>
                              <div className="vx-label">Critérios de validação</div>
                              <input className="vx-input" placeholder="Ex: Lead no ICP, dados completos"
                                value={campanha[`criterio_${a.id}`] || ""}
                                onChange={(e) => set(`criterio_${a.id}`, e.target.value)} />
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Ações personalizadas preservadas ao voltar do modo personalizado */}
            {(campanha.formasGanhoRascunho || []).filter((f) => f.origem !== "predefinido").length > 0 && (
              <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
                <div style={{ marginBottom: 10 }}><b style={{ color: "var(--brand)" }}>Ações personalizadas</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Criadas no modo personalizado e preservadas.</div></div>
                {(campanha.formasGanhoRascunho || []).filter((f) => f.origem !== "predefinido").map((fg, i) => (
                  <div key={fg.tempId} style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{fg.nome || "Sem nome"}</div>
                      <div className="vx-mut" style={{ fontSize: 11.5 }}>{fg.tipoRemuneracao === "comissao" ? `${fg.valor}%` : money(fg.valor)}</div>
                    </div>
                    <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => set("formasGanhoRascunho", (campanha.formasGanhoRascunho || []).filter((f) => f.tempId !== fg.tempId))}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </>)}

          {/* ── MODO PERSONALIZADO ── */}
          {campanha.modoAcoesRemuneradas === "personalizado" && (<>
            <div className="vx-card" style={{ padding: 18 }}>
              <div className="vx-row" style={{ marginBottom: 12 }}>
                <div>
                  <b style={{ color: "var(--brand)" }}>Crie suas formas de ganho</b>
                  <div className="vx-mut" style={{ fontSize: 11.5 }}>Personalize as atividades e condições de remuneração da sua operação.</div>
                </div>
                <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={() => set("formasGanhoRascunho", [...(campanha.formasGanhoRascunho || []), {
                  tempId: `fg-${Date.now()}`, nome: "", tipoRemuneracao: "fixo", valor: 0, eventoComercial: "", descricao: "",
                  origem: "personalizado", modeloOriginalId: "", condicoesRecebimento: "", metodoAprovacao: "manual",
                  evidencias: [], baseCalculo: "", limiteDiario: 0, limiteSemanal: 0, limiteMensal: 0,
                  limitePorProfissional: 0, limitePorLead: 0, limiteTotalCampanha: 0, dependeDeAcao: "",
                  prazoValidacaoHoras: 0, frequenciaPagamento: "ocorrencia", condicoesAdicionais: "", regraCumulatividade: true,
                }])}><Plus size={13} /> Adicionar forma de ganho</button>
              </div>

              {(campanha.formasGanhoRascunho || []).length === 0
                ? <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--muted)" }}>
                    <SlidersHorizontal size={28} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 13 }}>Nenhuma forma de ganho criada ainda.</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Clique em "Adicionar forma de ganho" para começar.</div>
                  </div>
                : (campanha.formasGanhoRascunho || []).map((fg, i) => {
                  const upd = (campo, val) => set("formasGanhoRascunho", campanha.formasGanhoRascunho.map((f, j) => j === i ? { ...f, [campo]: val } : f));
                  const isExpanded = fg._expanded !== false;
                  return (
                    <div key={fg.tempId} style={{ border: "1px solid var(--border)", borderRadius: 10, marginBottom: 10, overflow: "hidden", background: "var(--surface)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }} onClick={() => upd("_expanded", !isExpanded)}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: fg.origem === "predefinido" ? "var(--brand-50)" : "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {fg.origem === "predefinido" ? <Zap size={14} color="var(--brand)" /> : <SlidersHorizontal size={14} color="var(--muted)" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fg.nome || "Nova forma de ganho"}</div>
                          <div className="vx-mut" style={{ fontSize: 11.5 }}>{fg.tipoRemuneracao === "comissao" ? `${fg.valor}%` : money(fg.valor)} · {fg.metodoAprovacao === "ia" ? "IA" : fg.metodoAprovacao === "automatica" ? "Automático" : "Manual"}</div>
                        </div>
                        {isExpanded ? <ChevronUp size={14} color="var(--muted)" /> : <ChevronDown size={14} color="var(--muted)" />}
                        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={(e) => { e.stopPropagation(); set("formasGanhoRascunho", campanha.formasGanhoRascunho.filter((_, j) => j !== i)); }}><Trash2 size={14} /></button>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: "0 14px 14px", display: "grid", gap: 10 }}>
                          <label><div className="vx-label">Nome da ação *</div>
                            <input className="vx-input" placeholder="Ex: Contato efetivo na discadora" value={fg.nome} onChange={(e) => upd("nome", e.target.value)} /></label>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <label><div className="vx-label">Tipo de remuneração</div>
                              <select className="vx-input" value={fg.tipoRemuneracao} onChange={(e) => upd("tipoRemuneracao", e.target.value)}>
                                <option value="fixo">Valor fixo por ação</option>
                                <option value="comissao">Comissão percentual</option>
                              </select></label>
                            <label><div className="vx-label">{fg.tipoRemuneracao === "comissao" ? "Percentual (%)" : "Valor (R$)"}</div>
                              <div style={{ position: "relative" }}>
                                <input className="vx-input vx-mono" type="number" min="0" step="0.5" value={fg.valor} onChange={(e) => upd("valor", Number(e.target.value))} />
                                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 12, pointerEvents: "none" }}>{fg.tipoRemuneracao === "comissao" ? "%" : "R$"}</span>
                              </div></label>
                          </div>
                          {fg.tipoRemuneracao === "comissao" && (
                            <label><div className="vx-label">Base de cálculo</div>
                              <input className="vx-input" placeholder="Ex: Valor do contrato fechado" value={fg.baseCalculo || ""} onChange={(e) => upd("baseCalculo", e.target.value)} /></label>
                          )}
                          <label><div className="vx-label">O que o profissional precisa fazer para receber?</div>
                            <textarea className="vx-input" rows={2} placeholder="Descreva as condições para recebimento..." value={fg.condicoesRecebimento || ""} onChange={(e) => upd("condicoesRecebimento", e.target.value)} style={{ resize: "vertical" }} /></label>
                          <div>
                            <div className="vx-label" style={{ marginBottom: 6 }}>Como essa ação será comprovada?</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {EVIDENCIAS_OPCOES.map((ev) => {
                                const selecionada = (fg.evidencias || []).includes(ev.id);
                                return (
                                  <button key={ev.id} onClick={() => upd("evidencias", selecionada ? (fg.evidencias || []).filter((e) => e !== ev.id) : [...(fg.evidencias || []), ev.id])}
                                    style={{ padding: "5px 10px", borderRadius: 16, fontSize: 12, border: `1px solid ${selecionada ? "#318CE7" : "var(--border)"}`, background: selecionada ? "rgba(49,140,231,0.06)" : "var(--surface)", color: selecionada ? "#318CE7" : "var(--text-2)", cursor: "pointer", fontWeight: selecionada ? 600 : 400 }}>
                                    {selecionada && <Check size={10} style={{ marginRight: 4 }} />}{ev.nome}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <label><div className="vx-label">Método de aprovação</div>
                            <select className="vx-input" value={fg.metodoAprovacao || "manual"} onChange={(e) => upd("metodoAprovacao", e.target.value)}>
                              {METODOS_APROVACAO.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                            </select></label>
                          <label><div className="vx-label">Descrição (opcional)</div>
                            <input className="vx-input" placeholder="Descrição interna ou visível ao profissional" value={fg.descricao || ""} onChange={(e) => upd("descricao", e.target.value)} /></label>

                          {/* Configurações avançadas */}
                          <details style={{ marginTop: 4 }}>
                            <summary style={{ fontSize: 12.5, color: "var(--brand)", cursor: "pointer", fontWeight: 500 }}>Configurações avançadas</summary>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
                              <label><div className="vx-label">Limite diário</div><input className="vx-input vx-mono" type="number" min="0" value={fg.limiteDiario || 0} onChange={(e) => upd("limiteDiario", Number(e.target.value))} /></label>
                              <label><div className="vx-label">Limite semanal</div><input className="vx-input vx-mono" type="number" min="0" value={fg.limiteSemanal || 0} onChange={(e) => upd("limiteSemanal", Number(e.target.value))} /></label>
                              <label><div className="vx-label">Limite mensal</div><input className="vx-input vx-mono" type="number" min="0" value={fg.limiteMensal || 0} onChange={(e) => upd("limiteMensal", Number(e.target.value))} /></label>
                              <label><div className="vx-label">Por profissional</div><input className="vx-input vx-mono" type="number" min="0" value={fg.limitePorProfissional || 0} onChange={(e) => upd("limitePorProfissional", Number(e.target.value))} /></label>
                              <label><div className="vx-label">Por lead</div><input className="vx-input vx-mono" type="number" min="0" value={fg.limitePorLead || 0} onChange={(e) => upd("limitePorLead", Number(e.target.value))} /></label>
                              <label><div className="vx-label">Total campanha</div><input className="vx-input vx-mono" type="number" min="0" value={fg.limiteTotalCampanha || 0} onChange={(e) => upd("limiteTotalCampanha", Number(e.target.value))} /></label>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                              <label><div className="vx-label">Frequência pagamento</div>
                                <select className="vx-input" value={fg.frequenciaPagamento || "ocorrencia"} onChange={(e) => upd("frequenciaPagamento", e.target.value)}>
                                  <option value="ocorrencia">Por ocorrência</option><option value="diario">Diário</option><option value="semanal">Semanal</option><option value="mensal">Mensal</option>
                                </select></label>
                              <label><div className="vx-label">Prazo validação (horas)</div><input className="vx-input vx-mono" type="number" min="0" value={fg.prazoValidacaoHoras || 0} onChange={(e) => upd("prazoValidacaoHoras", Number(e.target.value))} /></label>
                            </div>
                            <label style={{ display: "block", marginTop: 8 }}><div className="vx-label">Depende de outra ação</div>
                              <select className="vx-input" value={fg.dependeDeAcao || ""} onChange={(e) => upd("dependeDeAcao", e.target.value)}>
                                <option value="">Nenhuma dependência</option>
                                {(campanha.formasGanhoRascunho || []).filter((f) => f.tempId !== fg.tempId && f.nome).map((f) => <option key={f.tempId} value={f.tempId}>{f.nome}</option>)}
                              </select></label>
                            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, cursor: "pointer" }}>
                              <input type="checkbox" checked={fg.regraCumulatividade !== false} onChange={(e) => upd("regraCumulatividade", e.target.checked)} />
                              <span style={{ fontSize: 12.5 }}>Remuneração cumulativa</span></label>
                            <label style={{ display: "block", marginTop: 8 }}><div className="vx-label">Condições adicionais</div>
                              <input className="vx-input" placeholder="Ex: Somente leads do ICP, primeiro contato" value={fg.condicoesAdicionais || ""} onChange={(e) => upd("condicoesAdicionais", e.target.value)} /></label>
                            <label style={{ display: "block", marginTop: 8 }}><div className="vx-label">Evento comercial associado</div>
                              <select className="vx-input" value={fg.eventoComercial || ""} onChange={(e) => upd("eventoComercial", e.target.value)}>
                                <option value="">Nenhum</option>
                                <option value="contato_discadora">Contato na discadora</option><option value="contato_whatsapp">Contato no WhatsApp</option>
                                <option value="lead_qualificado">Lead qualificado</option><option value="reuniao_agendada">Reunião agendada</option>
                                <option value="reuniao_realizada">Reunião realizada</option><option value="proposta_apresentada">Proposta apresentada</option>
                                <option value="venda_concluida">Venda concluída</option><option value="pagamento_confirmado">Pagamento confirmado</option>
                                <option value="acao_personalizada">Ação personalizada</option>
                              </select></label>
                          </details>
                        </div>
                      )}
                    </div>
                  );
                })
              }
            </div>
          </>)}

          {/* ── CONFIGURAÇÕES COMUNS AOS DOIS MODOS ── */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div className="vx-row" style={{ marginBottom: 4 }}>
              <b style={{ fontSize: 14 }}>Orçamento e limites</b>
              <span className="vx-chip"><Wallet size={12} /> {money(disponivel)} disponível</span>
            </div>

            {/* Sugestão com IA */}
            {(campanha.modoAcoesRemuneradas || "rapido") === "rapido" && (
              <div style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 10, padding: "12px 14px", marginBottom: 14, marginTop: 10 }}>
                <div className="vx-row" style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><TrendingUp size={14} color="var(--brand)" /><b style={{ fontSize: 13 }}>Sugestão com IA</b></div>
                  <button className="vx-btn vx-btn-sm vx-btn-primary" onClick={calcularSugestaoIA}><Sparkles size={12} /> Calcular</button>
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
            )}

            {/* Modelo de pagamento */}
            {((campanha.acoesAtivas || []).length > 1 || (campanha.formasGanhoRascunho || []).length > 1) && (
              <div style={{ marginTop: 10, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
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
            {(campanha.modoAcoesRemuneradas || "rapido") === "rapido" && (
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
            )}
          </div>

          {/* ── RESUMO DINÂMICO ── */}
          {(() => {
            const modo = campanha.modoAcoesRemuneradas || "rapido";
            const acoesRapidas = modo === "rapido" ? (campanha.acoesAtivas || []) : [];
            const formasCustom = (campanha.formasGanhoRascunho || []).filter((f) => f.origem !== "predefinido");
            const formasPre = (campanha.formasGanhoRascunho || []).filter((f) => f.origem === "predefinido");
            const totalAcoes = modo === "rapido" ? acoesRapidas.length + formasCustom.length : (campanha.formasGanhoRascunho || []).length;
            const fixos = modo === "rapido"
              ? acoesRapidas.filter((k) => !(k === "venda" && campanha.vendaTipoRemuneracao === "percentual")).map((k) => campanha.tarefas?.[k] || 0).filter((v) => v > 0)
              : (campanha.formasGanhoRascunho || []).filter((f) => f.tipoRemuneracao === "fixo" && f.valor > 0).map((f) => f.valor);
            const comissoes = modo === "rapido"
              ? [...(campanha.vendaTipoRemuneracao === "percentual" && campanha.tarefas?.venda > 0 ? [campanha.tarefas.venda] : []), ...(campanha.temComissao && campanha.percentualComissao > 0 ? [campanha.percentualComissao] : [])]
              : (campanha.formasGanhoRascunho || []).filter((f) => f.tipoRemuneracao === "comissao" && f.valor > 0).map((f) => f.valor);
            const pendencias = [];
            if (totalAcoes === 0) pendencias.push("Nenhuma ação configurada");
            if (modo === "rapido" && acoesRapidas.some((k) => !(campanha.tarefas?.[k] > 0))) pendencias.push("Ações sem valor definido");
            if (modo === "personalizado" && (campanha.formasGanhoRascunho || []).some((f) => !f.nome?.trim())) pendencias.push("Formas de ganho sem nome");
            if (Number(campanha.orcamento || 0) <= 0) pendencias.push("Orçamento não definido");
            const somaFixos = fixos.reduce((s, v) => s + v, 0);
            return totalAcoes > 0 || pendencias.length > 0 ? (
              <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
                <div className="vx-eyebrow" style={{ marginBottom: 10 }}>RESUMO DAS AÇÕES REMUNERADAS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: pendencias.length ? 12 : 0 }}>
                  <div style={{ textAlign: "center" }}><div className="vx-mut" style={{ fontSize: 11 }}>Ações</div><b className="vx-mono" style={{ fontSize: 18 }}>{totalAcoes}</b></div>
                  {fixos.length > 0 && <div style={{ textAlign: "center" }}><div className="vx-mut" style={{ fontSize: 11 }}>Valores fixos</div><b className="vx-mono" style={{ fontSize: 18 }}>{fixos.length}</b><div className="vx-mut" style={{ fontSize: 11 }}>Até {money(somaFixos)} por jornada</div></div>}
                  {comissoes.length > 0 && <div style={{ textAlign: "center" }}><div className="vx-mut" style={{ fontSize: 11 }}>Comissões</div><b className="vx-mono" style={{ fontSize: 18 }}>{comissoes.length}</b></div>}
                  <div style={{ textAlign: "center" }}><div className="vx-mut" style={{ fontSize: 11 }}>Pagamento</div><b style={{ fontSize: 13 }}>{campanha.remuneracaoCumulativa ? "Cumulativo" : "Resultado final"}</b></div>
                </div>
                {pendencias.length > 0 && (
                  <div style={{ display: "grid", gap: 4 }}>
                    {pendencias.map((p) => <div key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#DC2626" }}><AlertCircle size={13} /> {p}</div>)}
                  </div>
                )}
              </div>
            ) : null;
          })()}

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
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Materiais</span><div style={{ fontWeight: 600 }}>{(campanha.materiaisVinculados || []).length} arquivo(s){(campanha.materiaisVinculados || []).some((m) => m.obrigatoriedade === "obrigatorio") ? ` (${(campanha.materiaisVinculados || []).filter((m) => m.obrigatoriedade === "obrigatorio").length} obrigatório(s))` : ""}</div></div>
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
                  <b className="vx-mono">{k === "venda" && campanha.vendaTipoRemuneracao === "percentual"
                    ? `${campanha.tarefas?.[k] || 0}%`
                    : money(Number(campanha.tarefas?.[k] || 0))}</b>
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

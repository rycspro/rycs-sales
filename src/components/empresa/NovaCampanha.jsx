import { useState, useEffect, useRef, useMemo } from "react";
import CidadeEstadoSelector from "./CidadeEstadoSelector.jsx";
import { Sparkles, ArrowRight, ArrowLeft, Check, Wallet, Loader, Target, CalendarCheck, MapPin, BadgeDollarSign, Workflow, Plus, Trash2, ShieldCheck, TrendingUp, BookOpen, ChevronDown, ChevronUp, Send, RotateCcw, Search, Filter, HandCoins, Footprints, Settings, Laptop, Building2, MessageCircle, Phone, Mail, Linkedin, Instagram, Globe, Users, Eye, EyeOff, Lock, AlertCircle, CheckCircle2, FileText, Upload, Library, Database, UserPlus, Shuffle, Zap, SlidersHorizontal, Image, Link2, ClipboardCheck, UserCheck, Bot, X, File, CloudUpload, GripVertical, Download, Video, Music, FileSpreadsheet, Presentation, Cloud, CloudOff, LogOut, GraduationCap, Pencil } from "lucide-react";
import { api, apiPatch, API_URL } from "../../lib/api.js";
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

const PASSOS = ["O que você precisa?", "Como vai funcionar?", "Quem vai trabalhar?", "Ações e pagamentos", "Verba da campanha", "Tudo certo?"];

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

const SEL = { bg: "#E4F0FF", border: "#318CE7", bgOff: "#FFFFFF", borderOff: "#E2E2E2" };

function CardOption({ selected, onClick, icon: Icon, title, subtitle, disabled }) {
  return (
    <button
      className="vx-card"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "14px 16px", cursor: disabled ? "not-allowed" : "pointer", textAlign: "left", width: "100%",
        border: `1px solid ${selected ? SEL.border : SEL.borderOff}`,
        background: selected ? SEL.bg : SEL.bgOff,
        opacity: disabled ? 0.5 : 1,
        transition: "border-color .15s, background .15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {Icon && <Icon size={18} color={selected ? "#318CE7" : "#6b7280"} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: selected ? 600 : 400, color: "#171717" }}>{title}</div>
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
          border: `1px solid ${isActive(item.id) ? SEL.border : SEL.borderOff}`,
          background: isActive(item.id) ? SEL.bg : SEL.bgOff,
          color: isActive(item.id) ? "#171717" : "var(--text-2)",
          transition: "all .15s",
        }}>
          {item.icon && <item.icon size={13} />}
          {item.nome || item.label || item.id}
        </button>
      ))}
    </div>
  );
}

function LeadsSelectorInline({ campanha, set, rascunhoId }) {
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const selecionados = campanha.leadsSelecionados || [];

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    api("/leads").then((r) => {
      if (!cancelado && Array.isArray(r)) setLeads(r);
      setCarregando(false);
    }).catch(() => setCarregando(false));
    return () => { cancelado = true; };
  }, []);

  const toggle = (id) => {
    const novos = selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id];
    set("leadsSelecionados", novos);
  };

  const filtrados = leads.filter((l) => {
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return (l.nome || "").toLowerCase().includes(t) || (l.empresa || "").toLowerCase().includes(t) || (l.telefone || "").includes(t) || (l.email || "").toLowerCase().includes(t);
  });

  if (!leads.length && !carregando) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div className="vx-label" style={{ marginBottom: 6 }}>Escolha os contatos da sua base</div>
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-2)" }} />
        <input className="vx-input" placeholder="Buscar por nome, empresa, telefone ou e-mail…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ paddingLeft: 30, fontSize: 13 }} />
      </div>
      {carregando ? (
        <div className="vx-mut" style={{ fontSize: 12, padding: 8 }}><Loader size={13} style={{ animation: "spin 1s linear infinite", marginRight: 6 }} />Carregando leads…</div>
      ) : (
        <>
          {selecionados.length > 0 && <div className="vx-mut" style={{ fontSize: 12, marginBottom: 6 }}>{selecionados.length} lead(s) selecionado(s)</div>}
          <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)" }}>
            {filtrados.length === 0 ? (
              <div className="vx-mut" style={{ fontSize: 12, padding: 12, textAlign: "center" }}>Nenhum lead encontrado</div>
            ) : filtrados.map((l) => (
              <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                <input type="checkbox" checked={selecionados.includes(l.id)} onChange={() => toggle(l.id)} style={{ accentColor: "var(--brand)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{l.nome || "Sem nome"}</div>
                  <div className="vx-mut" style={{ fontSize: 11.5 }}>{[l.empresa, l.telefone, l.email].filter(Boolean).join(" · ")}</div>
                </div>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Indicador discreto de salvamento automático, no cabeçalho da criação.
function IndicadorSalvamento({ estado, onRetry }) {
  if (estado === "idle") return <span />;
  const mapa = {
    salvando: { Icon: Loader, cor: "var(--text-2)", texto: "Salvando alterações…", spin: true },
    salvo: { Icon: Cloud, cor: "var(--green, #16A34A)", texto: "Todas as alterações foram salvas", check: true },
    erro: { Icon: AlertCircle, cor: "var(--red, #DC2626)", texto: "Não foi possível salvar" },
    offline: { Icon: CloudOff, cor: "var(--amber, #F59E0B)", texto: "Sem conexão — alterações pendentes" },
  };
  const s = mapa[estado] || mapa.salvando;
  const Icon = s.Icon;
  return (
    <span aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: s.cor, whiteSpace: "nowrap" }}>
      <Icon size={14} style={s.spin ? { animation: "spin 1s linear infinite" } : undefined} />
      {s.check && <Check size={12} />}
      {s.texto}
      {estado === "erro" && <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: "2px 8px", fontSize: 12, color: "var(--brand)" }} onClick={onRetry}>Tentar novamente</button>}
    </span>
  );
}

export default function NovaCampanha({ emp, aoCriar, aoCancelar, aviso, iniciarComIA = false, rascunho = null, aoSair }) {
  const { locale } = useI18n();
  const nome = nomeAssistente(locale);
  const chaveRascunho = `rycs-wizard-${emp.id}`;
  // Ao continuar a edição de um rascunho existente (vindo do banco), ele é a
  // fonte de verdade — ignora qualquer resquício em localStorage.
  const rascunhoSalvo = useRef(rascunho ? null : lerJson(chaveRascunho, null));
  const [passo, _setPasso] = useState(rascunho?.passoWizard ?? rascunhoSalvo.current?.passo ?? 0);
  const setPasso = (p) => { _setPasso(p); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const [campanha, setCampanha] = useState(rascunho || rascunhoSalvo.current?.campanha || null);
  // id do registro persistente no banco (DRAFT). Existe desde a primeira
  // interação significativa; é o mesmo id até a publicação (sem duplicar).
  const [rascunhoId, setRascunhoId] = useState(rascunho?.id || null);
  // idle | salvando | salvo | erro | offline
  const [estadoSalvamento, setEstadoSalvamento] = useState(rascunho ? "salvo" : "idle");
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
  const [modalTreinamentoIA, setModalTreinamentoIA] = useState(false);
  const [bibliotecaMateriais, setBibliotecaMateriais] = useState([]);
  const [bibliotecaBusca, setBibliotecaBusca] = useState("");
  const [bibliotecaFiltro, setBibliotecaFiltro] = useState("");
  const [bibliotecaSel, setBibliotecaSel] = useState([]);
  const [carregandoBiblioteca, setCarregandoBiblioteca] = useState(false);
  const uploadInputRef = useRef(null);

  const disponivel = saldoDisponivel(emp);
  const set = (k, v) => setCampanha((c) => ({ ...c, [k]: v }));

  // ── Salvamento automático (fonte de verdade = banco) ────────────────────────
  // O localStorage é apenas auxiliar de recuperação (fechamento abrupto); o
  // registro DRAFT no banco é persistido a cada alteração relevante, para que a
  // campanha nunca se perca ao sair da página antes de publicar.
  const rascunhoIdRef = useRef(rascunhoId);
  const campanhaRef = useRef(campanha);
  const passoRef = useRef(passo);
  const criandoRef = useRef(false);     // trava para não criar rascunhos duplicados
  const pendenteRef = useRef(false);     // há alteração aguardando persistência
  const seqRef = useRef(0);              // controle de versão: nº da requisição
  const seqSalvoRef = useRef(0);         // última seq efetivamente confirmada
  const debounceRef = useRef(null);
  useEffect(() => { rascunhoIdRef.current = rascunhoId; }, [rascunhoId]);
  useEffect(() => { campanhaRef.current = campanha; }, [campanha]);
  useEffect(() => { passoRef.current = passo; }, [passo]);

  // Monta o corpo enviado ao banco. Campos só-do-wizard (formas de ganho em
  // rascunho, nome de operação, estado de upload) são ignorados pelo backend,
  // então podem seguir sem risco; passoWizard carrega a etapa atual.
  const montarPayloadRascunho = (c) => {
    const campos = { ...(c || {}) };
    delete campos.formasGanhoRascunho;
    delete campos.nomeOperacao;
    delete campos.uploadQueue;
    delete campos.funcoesOperacao;
    delete campos.abaFuncaoAtiva;
    ORDEM_FUNCOES.forEach((k) => delete campos[`config_${k}`]);
    return { ...campos, titulo: (c?.titulo || "").trim() || "Campanha sem título", passoWizard: passoRef.current };
  };

  const persistirRascunho = async () => {
    const c = campanhaRef.current;
    if (!c) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      pendenteRef.current = true;
      setEstadoSalvamento("offline");
      return;
    }
    // 1) Ainda não existe registro → cria uma única vez.
    if (!rascunhoIdRef.current) {
      if (criandoRef.current) { pendenteRef.current = true; return; }
      criandoRef.current = true;
      setEstadoSalvamento("salvando");
      const r = await api("/campaigns", montarPayloadRascunho(campanhaRef.current));
      criandoRef.current = false;
      if (!r || r.error) { setEstadoSalvamento("erro"); return; }
      rascunhoIdRef.current = r.id;
      setRascunhoId(r.id);
      seqSalvoRef.current = ++seqRef.current;
      setEstadoSalvamento("salvo");
      // Se algo mudou durante a criação, grava a versão mais recente.
      if (pendenteRef.current) { pendenteRef.current = false; persistirRascunho(); }
      return;
    }
    // 2) Atualização parcial — envia o estado atual completo; a última a sair
    //    vence. Respostas atrasadas não revertem o indicador.
    const seq = ++seqRef.current;
    setEstadoSalvamento("salvando");
    const r = await apiPatch(`/campaigns/${rascunhoIdRef.current}`, montarPayloadRascunho(campanhaRef.current));
    if (!r || r.error) {
      if (seq >= seqSalvoRef.current) setEstadoSalvamento("erro");
      return;
    }
    if (seq > seqSalvoRef.current) {
      seqSalvoRef.current = seq;
      setEstadoSalvamento("salvo");
    }
  };

  // Debounce de ~900ms para texto; qualquer alteração de campanha/passo reagenda.
  useEffect(() => {
    if (!campanha) return;
    gravarJson(chaveRascunho, { campanha, passo }); // auxiliar de recuperação
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { persistirRascunho(); }, 900);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanha, passo, chaveRascunho]);

  // Recuperação ao voltar a conexão: regrava o que ficou pendente offline.
  useEffect(() => {
    const aoVoltarOnline = () => { pendenteRef.current = false; persistirRascunho(); };
    const aoCairOffline = () => setEstadoSalvamento("offline");
    window.addEventListener("online", aoVoltarOnline);
    window.addEventListener("offline", aoCairOffline);
    return () => { window.removeEventListener("online", aoVoltarOnline); window.removeEventListener("offline", aoCairOffline); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      distribuicaoLeads: "automatica",
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
    setCampanha({ ...campanhaMontada, objetivoUI: "", modeloTrabalho: "remoto", restricaoGeo: "nenhuma", origemLeads: "", mercado: "pais_todo", distribuicaoLeads: "automatica", canais: [], nivelExperiencia: "indiferente", processoAdmissao: "manual", visibilidade: "publica", temComissao: false, remuneracaoCumulativa: true, acoesAtivas: Object.keys(campanhaMontada.tarefas || {}) });
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

  // Persiste formas de ganho e materiais vinculados ao id do rascunho. Chamado
  // tanto ao finalizar quanto ao "Salvar e sair".
  const gravarRelacionamentos = async (id, c) => {
    const { formasGanhoRascunho } = c;
    if (formasGanhoRascunho?.length) {
      for (const fg of formasGanhoRascunho) {
        if (fg.nome?.trim()) await api(`/campaigns/${id}/formas-ganho`, fg);
      }
    }
    const mats = c.materiaisVinculados || [];
    if (mats.length) {
      const payload2 = mats.map((m, i) => ({
        materialId: m.id, categoria: m.categoria || "outros",
        obrigatoriedade: m.obrigatoriedade || "complementar", ordem: i,
      }));
      await fetch(`${API_URL}/api/campaigns/${id}/materiais`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materiais: payload2 }), credentials: "include",
      });
    }
    const leadIds = c.leadsSelecionados || [];
    if (leadIds.length) {
      await fetch(`${API_URL}/api/campaigns/${id}/leads`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds }), credentials: "include",
      });
    }
  };

  // Garante que o registro DRAFT existe e está atualizado no banco. Reutiliza o
  // rascunho já criado pelo autosave — nunca cria uma campanha duplicada.
  const garantirRascunhoPersistido = async (c) => {
    const payload = montarPayloadRascunho(c);
    // Cria operação se necessário (apenas uma vez).
    if (c.estruturaComercial === "operacao" && c.nomeOperacao?.trim() && !c.operacaoId) {
      const opR = await api("/operacoes", { nome: c.nomeOperacao.trim() });
      if (opR?.id) payload.operacaoId = opR.id;
    }
    let id = rascunhoIdRef.current;
    if (id) {
      const r = await apiPatch(`/campaigns/${id}`, payload);
      if (!r || r.error) return { error: r?.error || "Não foi possível salvar a campanha." };
    } else {
      const r = await api("/campaigns", payload);
      if (!r || r.error) return { error: r?.error || "Não foi possível criar a campanha." };
      id = r.id;
      rascunhoIdRef.current = id;
      setRascunhoId(id);
    }
    return { id, operacaoId: payload.operacaoId };
  };

  const criar = async () => {
    if (!campanha?.titulo?.trim()) return aviso("Dê um título à campanha.");
    setSalvando(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Operação multi-função: cria uma campanha por função
    if (campanha.estruturaComercial === "operacao" && (campanha.funcoesOperacao || []).length >= 2) {
      const funcoes = campanha.funcoesOperacao;
      let operacaoId = campanha.operacaoId;
      if (!operacaoId && campanha.nomeOperacao?.trim()) {
        const opR = await api("/operacoes", { nome: campanha.nomeOperacao.trim() });
        if (opR?.id) operacaoId = opR.id;
        else { setSalvando(false); return aviso("Não foi possível criar a operação."); }
      }
      const idsCriados = [];
      for (let i = 0; i < funcoes.length; i++) {
        const fk = funcoes[i];
        const cfg = campanha[`config_${fk}`] || {};
        const fInfo = FUNCOES[fk];
        const payloadFunc = {
          ...montarPayloadRascunho(campanha),
          titulo: `${campanha.titulo} — ${fInfo?.nome || fk}`,
          funcao: fk,
          operacaoId,
          vagas: cfg.vagas || 0,
          nivelExperiencia: cfg.nivelExperiencia || campanha.nivelExperiencia,
          processoAdmissao: cfg.processoAdmissao || campanha.processoAdmissao,
          acoesAtivas: cfg.acoesAtivas || [],
          tarefas: cfg.tarefas || {},
          remuneracaoCumulativa: cfg.remuneracaoCumulativa ?? true,
          prazoHoras: cfg.prazoHoras || 24,
          limitePorProfissional: cfg.limitePorProfissional || 10,
          orcamento: cfg.orcamento || 0,
          ordemOperacao: i,
        };
        const r = await api("/campaigns", payloadFunc);
        if (r?.id) idsCriados.push(r.id);
      }
      // Cria vínculos entre campanhas consecutivas
      for (let i = 0; i < idsCriados.length - 1; i++) {
        await api("/vinculos-campanhas", {
          operacaoId,
          campanhaOrigemId: idsCriados[i],
          campanhaDestinoId: idsCriados[i + 1],
          eventoTransferencia: "tarefa_concluida",
          distribuicaoDestino: "equilibrada",
        });
      }
      // Vincula leads à primeira campanha
      const leadIds = campanha.leadsSelecionados || [];
      if (leadIds.length && idsCriados[0]) {
        await fetch(`${API_URL}/api/campaigns/${idsCriados[0]}/leads`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIds }), credentials: "include",
        });
      }
      setSalvando(false);
      seqSalvoRef.current = ++seqRef.current;
      setEstadoSalvamento("salvo");
      removerArmazenado(chaveRascunho);
      aoCriar?.({ ...campanha, id: idsCriados[0], operacaoId, companyId: emp.id, status: "rascunho", criadoEm: campanha.criadoEm || Date.now(), campanhasOperacao: idsCriados });
      return;
    }

    const res = await garantirRascunhoPersistido(campanha);
    if (res.error) { setSalvando(false); return aviso(res.error); }
    await gravarRelacionamentos(res.id, campanha);
    setSalvando(false);
    seqSalvoRef.current = ++seqRef.current;
    setEstadoSalvamento("salvo");
    removerArmazenado(chaveRascunho);
    aoCriar?.({ ...campanha, id: res.id, companyId: emp.id, status: "rascunho", criadoEm: campanha.criadoEm || Date.now() });
  };

  // "Salvar e sair": conveniência. Persiste tudo e volta para a lista — mas sair
  // sem clicar aqui também preserva a campanha (o autosave já cuidou).
  const salvarESair = async () => {
    if (!campanha) { (aoSair || aoCancelar)?.(); return; }
    setSalvando(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const res = await garantirRascunhoPersistido(campanha);
    if (res.error) { setSalvando(false); return aviso(res.error); }
    await gravarRelacionamentos(res.id, campanha);
    setSalvando(false);
    seqSalvoRef.current = ++seqRef.current;
    setEstadoSalvamento("salvo");
    removerArmazenado(chaveRascunho);
    aviso("Rascunho salvo.");
    (aoSair || aoCancelar)?.();
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
      {/* Cabeçalho do rascunho: indicador de salvamento + salvar e sair */}
      {campanha && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <IndicadorSalvamento estado={estadoSalvamento} onRetry={persistirRascunho} />
          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" disabled={salvando} onClick={salvarESair} style={{ whiteSpace: "nowrap" }}>
            <LogOut size={13} /> Salvar e sair
          </button>
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
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>O que você quer que aconteça?</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            {iniciarComIA
              ? `Converse com o ${nome}, seu assessor de vendas: ele pergunta, calcula o retorno e monta tudo para você revisar.`
              : "Escolha o resultado que você espera. A gente cuida do resto."}
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
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Como vai funcionar?</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            Defina o nome, onde o profissional trabalha, de onde vêm os contatos e como eles serão distribuídos.
          </p>

          {/* Dados básicos */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <label><div className="vx-label">Como você quer chamar esta campanha?</div>
              <input className="vx-input" value={campanha.titulo} onChange={(e) => set("titulo", e.target.value)} /></label>
            <label style={{ display: "block", marginTop: 12 }}><div className="vx-label">Descreva o que o profissional vai fazer</div>
              <textarea className="vx-input" style={{ minHeight: 62 }} value={campanha.descricao || ""}
                onChange={(e) => set("descricao", e.target.value)}
                placeholder="Ex.: Ligar para donos de restaurante e agendar uma demonstração do sistema." /></label>
          </div>

          {/* Modelo de trabalho */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>De onde o profissional trabalha?</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Ele trabalha de casa, na rua ou mistura os dois?</div></div>
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
              <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>De onde ele pode ser?</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Aceita profissionais de qualquer lugar ou só de algumas regiões?</div></div>
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
              <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Onde ele vai atuar?</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Em qual cidade ou região o profissional vai trabalhar presencialmente?</div></div>
              <div className="vx-grid vx-g2">
                <label><div className="vx-label">Região</div>
                  <input className="vx-input" value={campanha.regiao} onChange={(e) => set("regiao", e.target.value)} placeholder="Ex.: interior de SP" /></label>
              </div>
              <CidadeEstadoSelector estado={campanha.estado || ""} cidade={campanha.cidade || ""} onEstado={(v) => set("estado", v)} onCidade={(v) => set("cidade", v)} />
            </div>
          )}

          {/* Mercado de atuação do cliente */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Onde estão seus clientes?</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Em qual mercado os profissionais vão vender para você?</div></div>
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
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>De onde vêm os contatos?</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Como os profissionais vão conseguir os contatos para trabalhar?</div></div>
            <div style={{ display: "grid", gap: 8 }}>
              {Object.values(ORIGENS_LEAD).map((o) => (
                <CardOption key={o.id} selected={campanha.origemLeads === o.id} onClick={() => set("origemLeads", o.id)} title={o.label} />
              ))}
            </div>
          </div>

          {/* Canais */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Por onde ele vai falar com os contatos?</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Selecione os meios de comunicação que o profissional pode usar.</div></div>
            <ChipToggle
              items={CANAIS.map((c) => ({ id: c.id, nome: c.nome, icon: ICONES_CANAL[c.id] || Globe }))}
              value={campanha.canais || []}
              onChange={(v) => set("canais", v)}
              multi
            />
          </div>

          {/* Materiais e treinamento (unificado) */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: "var(--brand)" }}>Materiais e treinamento</b>
              <div className="vx-mut" style={{ fontSize: 11.5 }}>Adicione arquivos, treinamentos e conteúdos que vão ajudar o profissional.</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {/* Enviar arquivos */}
              <div
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#318CE7"; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "var(--border)";
                  const files = [...e.dataTransfer.files].map((f) => ({ file: f, id: `up-${Date.now()}-${Math.random().toString(36).slice(2)}`, nome: f.name, tamanho: f.size, status: "pendente" }));
                  if (files.length) setUploadQueue((prev) => [...prev, ...files]);
                }}
                style={{ border: "1.5px dashed var(--border)", borderRadius: 12, padding: "20px 14px", textAlign: "center", cursor: "pointer", transition: "border-color .15s", background: "var(--surface)" }}
                onClick={() => uploadInputRef.current?.click()}
              >
                <CloudUpload size={24} color="var(--muted)" style={{ marginBottom: 6 }} />
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Enviar arquivos</div>
                <div className="vx-mut" style={{ fontSize: 11.5, lineHeight: 1.4 }}>Do seu dispositivo</div>
                <input ref={uploadInputRef} type="file" multiple hidden
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.mp4,.mov,.mp3,.wav,.m4a,.txt,.key"
                  onChange={(e) => {
                    const files = [...e.target.files].map((f) => ({ file: f, id: `up-${Date.now()}-${Math.random().toString(36).slice(2)}`, nome: f.name, tamanho: f.size, status: "pendente" }));
                    if (files.length) setUploadQueue((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                />
              </div>
              {/* Buscar na biblioteca */}
              <div
                style={{ border: "1.5px solid var(--border)", borderRadius: 12, padding: "20px 14px", textAlign: "center", cursor: "pointer", background: "var(--surface)", transition: "border-color .15s" }}
                onClick={async () => {
                  setModalBiblioteca(true);
                  setCarregandoBiblioteca(true);
                  setBibliotecaSel((campanha.materiaisVinculados || []).filter((m) => m.origem === "biblioteca").map((m) => m.id));
                  const r = await api("/materiais");
                  if (r?.materiais) setBibliotecaMateriais(r.materiais);
                  setCarregandoBiblioteca(false);
                }}
              >
                <Library size={24} color="var(--muted)" style={{ marginBottom: 6 }} />
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Buscar na biblioteca</div>
                <div className="vx-mut" style={{ fontSize: 11.5, lineHeight: 1.4 }}>Materiais e treinamentos da empresa</div>
              </div>
              {/* Criar com IA */}
              <div
                style={{ border: "1.5px solid var(--border)", borderRadius: 12, padding: "20px 14px", textAlign: "center", cursor: "pointer", background: "var(--surface)", transition: "border-color .15s" }}
                onClick={() => setModalTreinamentoIA(true)}
              >
                <Sparkles size={24} color="var(--brand)" style={{ marginBottom: 6 }} />
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Criar com IA</div>
                <div className="vx-mut" style={{ fontSize: 11.5, lineHeight: 1.4 }}>Gerar treinamento automático</div>
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

            {/* Lista unificada de conteúdos vinculados */}
            {((campanha.materiaisVinculados || []).length > 0 || (campanha.treinamento || []).length > 0) && (
              <div style={{ marginTop: 14 }}>
                <div className="vx-eyebrow" style={{ marginBottom: 8 }}>CONTEÚDOS VINCULADOS ({(campanha.materiaisVinculados || []).length + (campanha.treinamento || []).length})</div>
                {(campanha.treinamento || []).map((modulo, idx) => (
                  <div key={modulo.id || `tr-${idx}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--brand-100)", borderRadius: 8, marginBottom: 6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 7, background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <GraduationCap size={16} color="var(--brand)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{modulo.titulo || "Módulo sem título"}</div>
                      <div className="vx-mut" style={{ fontSize: 11, display: "flex", gap: 8 }}>
                        <span style={{ color: "var(--brand)" }}>Treinamento</span>
                        {modulo.conteudo && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{modulo.conteudo.slice(0, 60)}</span>}
                      </div>
                    </div>
                    <select className="vx-input" style={{ width: 140, fontSize: 11.5, height: 28, padding: "0 8px" }}
                      value={modulo.obrigatoriedade || "obrigatorio"}
                      onChange={(e) => set("treinamento", campanha.treinamento.map((m, i) => i === idx ? { ...m, obrigatoriedade: e.target.value } : m))}>
                      <option value="obrigatorio">Obrigatório</option>
                      <option value="complementar">Complementar</option>
                    </select>
                    <button className="vx-btn vx-btn-ghost vx-btn-sm" title="Editar" onClick={() => {
                      const novoTitulo = prompt("Título do módulo:", modulo.titulo || "");
                      if (novoTitulo !== null) atualizarTreinamento(idx, "titulo", novoTitulo);
                    }} style={{ padding: 3 }}><Pencil size={14} /></button>
                    <button className="vx-btn vx-btn-ghost vx-btn-sm" title="Remover" onClick={() => removerTreinamento(idx)} style={{ padding: 3 }}><Trash2 size={14} /></button>
                  </div>
                ))}
                {(campanha.materiaisVinculados || []).map((mat, idx) => {
                  const IconeMat = mat.mimetype?.startsWith("video/") ? Video : mat.mimetype?.startsWith("audio/") ? Music : mat.mimetype?.includes("spreadsheet") || mat.mimetype?.includes("excel") ? FileSpreadsheet : mat.mimetype?.includes("presentation") || mat.mimetype?.includes("powerpoint") ? Presentation : mat.mimetype?.includes("image") ? Image : FileText;
                  return (
                    <div key={mat.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 7, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <IconeMat size={16} color="var(--muted)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mat.nome}</div>
                        <div className="vx-mut" style={{ fontSize: 11, display: "flex", gap: 8 }}>
                          <span>{mat.categoria || "arquivo"}{mat.tamanho ? ` · ${(mat.tamanho / 1024).toFixed(0)} KB` : ""}</span>
                          <span style={{ color: mat.origem === "upload" ? "#318CE7" : "var(--brand)" }}>{mat.origem === "upload" ? "Enviado" : "Biblioteca"}</span>
                        </div>
                      </div>
                      <select className="vx-input" style={{ width: 140, fontSize: 11.5, height: 28, padding: "0 8px" }}
                        value={mat.obrigatoriedade || "complementar"}
                        onChange={(e) => set("materiaisVinculados", (campanha.materiaisVinculados || []).map((m, i) => i === idx ? { ...m, obrigatoriedade: e.target.value } : m))}>
                        <option value="complementar">Complementar</option>
                        <option value="obrigatorio">Obrigatório</option>
                      </select>
                      <button className="vx-btn vx-btn-ghost vx-btn-sm" title="Desvincular" onClick={() => set("materiaisVinculados", (campanha.materiaisVinculados || []).filter((_, i) => i !== idx))} style={{ padding: 3 }}><Trash2 size={14} /></button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Exigir treinamento */}
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginTop: 14 }}>
              <input type="checkbox" style={{ marginTop: 3, flexShrink: 0 }} checked={campanha.exigeCertificacao} onChange={(e) => set("exigeCertificacao", e.target.checked)} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Exigir que complete o treinamento antes de começar</div>
                <div className="vx-mut" style={{ fontSize: 11.5, lineHeight: 1.5 }}>O profissional só trabalha depois de concluir os treinamentos obrigatórios.</div>
              </div>
            </label>
          </div>

          {/* Modal Criar com IA */}
          {modalTreinamentoIA && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
              onClick={(e) => { if (e.target === e.currentTarget) setModalTreinamentoIA(false); }}>
              <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 520, overflow: "hidden" }}>
                <div style={{ padding: "20px 24px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Criar treinamento com IA</h3>
                    <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setModalTreinamentoIA(false)} style={{ padding: 3 }}><X size={18} /></button>
                  </div>
                  <p className="vx-mut" style={{ fontSize: 12.5, margin: "0 0 16px", lineHeight: 1.5 }}>Escolha o tipo de treinamento. A IA vai usar os dados da campanha e os materiais vinculados para gerar o conteúdo.</p>
                </div>
                <div style={{ padding: "0 24px 20px", display: "grid", gap: 8 }}>
                  {Object.entries(MODELOS_TREINAMENTO).map(([k, m]) => (
                    <button key={k} onClick={() => setModeloTreinamento(k)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: `1px solid ${modeloTreinamento === k ? SEL.border : SEL.borderOff}`, borderRadius: 10, background: modeloTreinamento === k ? SEL.bg : SEL.bgOff, cursor: "pointer", textAlign: "left", width: "100%", transition: "border-color .15s, background .15s" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${modeloTreinamento === k ? "#318CE7" : "var(--border)"}`, background: modeloTreinamento === k ? "#318CE7" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {modeloTreinamento === k && <Check size={12} color="#fff" />}
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.nome}</div>
                        <div className="vx-mut" style={{ fontSize: 12 }}>{m.descricao}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button className="vx-btn vx-btn-sm" onClick={() => setModalTreinamentoIA(false)}>Cancelar</button>
                  <button className="vx-btn vx-btn-sm vx-btn-primary" disabled={gerandoTreinamento} style={{ background: "#318CE7", borderColor: "#318CE7" }}
                    onClick={async () => {
                      await gerarTreinamentoComIA();
                      setModalTreinamentoIA(false);
                    }}>
                    {gerandoTreinamento ? <><Loader size={13} /> Gerando...</> : <><Sparkles size={13} /> Gerar treinamento</>}
                  </button>
                </div>
              </div>
            </div>
          )}

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
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${sel ? SEL.border : SEL.borderOff}`, borderRadius: 8, background: sel ? SEL.bg : SEL.bgOff, cursor: "pointer", width: "100%", textAlign: "left", transition: "border-color .15s, background .15s" }}>
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
              <b style={{ color: "var(--brand)" }}>Quem o profissional vai contatar?</b>
              <div className="vx-mut" style={{ fontSize: 11.5 }}>Você fornece a lista de contatos ou o profissional busca sozinho?</div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <CardOption selected={campanha.fonteLeads === "empresa"} onClick={() => set("fonteLeads", "empresa")} icon={Database} title="Eu forneço os contatos" subtitle="Você envia a lista e o profissional trabalha só esses contatos." />
              <CardOption selected={campanha.fonteLeads === "profissional"} onClick={() => set("fonteLeads", "profissional")} icon={UserPlus} title="O profissional busca sozinho" subtitle="Ele mesmo prospecta e cadastra novos contatos." />
              <CardOption selected={campanha.fonteLeads === "ambos"} onClick={() => set("fonteLeads", "ambos")} icon={Shuffle} title="As duas coisas" subtitle="Você fornece contatos e o profissional também pode buscar mais." />
            </div>
            {(campanha.fonteLeads === "empresa" || campanha.fonteLeads === "ambos") && (
              <div style={{ marginTop: 14, padding: "14px 16px", background: "var(--brand-50)", borderRadius: 10, border: "1px solid var(--brand-100)" }}>
                <b style={{ fontSize: 13, color: "var(--brand)" }}>Como dividir os contatos entre os profissionais?</b>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <CardOption selected={!campanha.distribuicaoLeads || campanha.distribuicaoLeads === "automatica"} onClick={() => { set("distribuicaoLeads", "automatica"); set("limiteLeadsSimultaneos", 0); set("limiteLeadsDia", 0); set("prazoContatoHoras", 0); set("prazoInatividadeHoras", 0); }} icon={Zap} title="Automático (recomendado)" subtitle="A plataforma distribui os contatos de forma equilibrada entre os profissionais." />
                  <CardOption selected={campanha.distribuicaoLeads === "manual"} onClick={() => set("distribuicaoLeads", "manual")} icon={SlidersHorizontal} title="Eu quero controlar" subtitle="Você define quantos contatos cada profissional recebe e os prazos." />
                </div>
                {campanha.distribuicaoLeads === "manual" && (
                  <div className="vx-grid vx-g2" style={{ marginTop: 12 }}>
                    <label><div className="vx-label">Contatos ao mesmo tempo por profissional</div>
                      <input className="vx-input vx-mono" type="number" min="0" value={campanha.limiteLeadsSimultaneos || 0}
                        onChange={(e) => set("limiteLeadsSimultaneos", Number(e.target.value))} placeholder="0 = sem limite" /></label>
                    <label><div className="vx-label">Novos contatos por dia</div>
                      <input className="vx-input vx-mono" type="number" min="0" value={campanha.limiteLeadsDia || 0}
                        onChange={(e) => set("limiteLeadsDia", Number(e.target.value))} placeholder="0 = sem limite" /></label>
                    <label><div className="vx-label">Prazo primeiro contato (horas)</div>
                      <input className="vx-input vx-mono" type="number" min="0" value={campanha.prazoContatoHoras || 0}
                        onChange={(e) => set("prazoContatoHoras", Number(e.target.value))} placeholder="0 = sem prazo" /></label>
                    <label><div className="vx-label">Prazo inatividade (horas)</div>
                      <input className="vx-input vx-mono" type="number" min="0" value={campanha.prazoInatividadeHoras || 0}
                        onChange={(e) => set("prazoInatividadeHoras", Number(e.target.value))} placeholder="0 = sem prazo" /></label>
                  </div>
                )}
                <LeadsSelectorInline campanha={campanha} set={set} rascunhoId={rascunhoIdRef.current} />
              </div>
            )}
          </div>

          {/* Estrutura comercial */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Como os profissionais vão trabalhar?</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Uma campanha sozinha ou em equipe com outras?</div></div>
            <div style={{ display: "grid", gap: 8 }}>
              <CardOption selected={campanha.estruturaComercial === "independente" || !campanha.estruturaComercial} onClick={() => set("estruturaComercial", "independente")} icon={Target} title="Campanha sozinha" subtitle="Funciona de forma independente, sem vínculo com outras." />
              <CardOption selected={campanha.estruturaComercial === "vinculada"} onClick={() => set("estruturaComercial", "vinculada")} icon={Workflow} title="Conectar a outra campanha" subtitle="Os contatos passam de uma campanha para outra automaticamente." />
              <CardOption selected={campanha.estruturaComercial === "operacao"} onClick={() => set("estruturaComercial", "operacao")} icon={Shuffle} title="Montar uma equipe completa" subtitle="Vários profissionais com funções diferentes trabalham juntos (ex: um busca contatos e outro fecha a venda)." />
            </div>
            {campanha.estruturaComercial === "operacao" && (
              <div style={{ marginTop: 12 }}>
                <label><div className="vx-label">Dê um nome para esta equipe</div>
                  <input className="vx-input" placeholder="Ex: Equipe Vendas Restaurantes" value={campanha.nomeOperacao || ""}
                    onChange={(e) => set("nomeOperacao", e.target.value)} />
                </label>

                <div style={{ marginTop: 16 }}>
                  <div className="vx-label" style={{ marginBottom: 8 }}>Quais funções vão participar?</div>
                  <div className="vx-mut" style={{ fontSize: 11.5, marginBottom: 10 }}>Selecione todas as funções que a equipe precisa. Cada uma vira uma campanha ligada às outras.</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {ORDEM_FUNCOES.filter((f) => f !== "sem-exp").map((k) => {
                      const f = FUNCOES[k];
                      const nomeAmigavel = { sdr: "Qualificar contatos e agendar reuniões", bdr: "Encontrar novos clientes", closer: "Negociar e fechar vendas", pap: "Visitar clientes presencialmente" }[k] || f.completo;
                      const funcoesOp = campanha.funcoesOperacao || [];
                      const ativa = funcoesOp.includes(k);
                      return (
                        <button key={k} onClick={() => {
                          const novas = ativa ? funcoesOp.filter((x) => x !== k) : [...funcoesOp, k];
                          set("funcoesOperacao", novas);
                          if (!ativa && !campanha[`config_${k}`]) {
                            set(`config_${k}`, { funcao: k, vagas: 0, nivelExperiencia: "", processoAdmissao: "manual", acoesAtivas: [], tarefas: {}, remuneracaoCumulativa: true, prazoHoras: 24, limitePorProfissional: 10, orcamento: 0 });
                          }
                        }} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", width: "100%", textAlign: "left", cursor: "pointer",
                          border: `1px solid ${ativa ? SEL.border : SEL.borderOff}`,
                          background: ativa ? SEL.bg : SEL.bgOff,
                          borderRadius: 10, transition: "border-color .15s, background .15s",
                        }}>
                          <div style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${ativa ? "#318CE7" : "var(--border)"}`, background: ativa ? "#318CE7" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {ativa && <Check size={12} color="#fff" />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: ativa ? 600 : 400, color: "var(--ink, #171717)" }}>{nomeAmigavel} ({f.nome})</div>
                            <div className="vx-mut" style={{ fontSize: 12, marginTop: 2 }}>{f.descricao}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(campanha.funcoesOperacao || []).length >= 2 && (
                  <div style={{ marginTop: 16 }}>
                    <div className="vx-label" style={{ marginBottom: 8 }}>Ordem das funções na operação</div>
                    <div className="vx-mut" style={{ fontSize: 11.5, marginBottom: 10 }}>Os contatos seguem esta ordem: a primeira função trabalha o contato e passa para a seguinte.</div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {(campanha.funcoesOperacao || []).map((k, i) => {
                        const f = FUNCOES[k];
                        return (
                          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
                            <GripVertical size={14} color="var(--muted)" />
                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{i + 1}. {f?.nome || k}</span>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="vx-btn vx-btn-ghost vx-btn-sm" disabled={i === 0} style={{ padding: 2 }} onClick={() => {
                                const arr = [...(campanha.funcoesOperacao || [])];
                                [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                                set("funcoesOperacao", arr);
                              }}><ChevronUp size={14} /></button>
                              <button className="vx-btn vx-btn-ghost vx-btn-sm" disabled={i === (campanha.funcoesOperacao || []).length - 1} style={{ padding: 2 }} onClick={() => {
                                const arr = [...(campanha.funcoesOperacao || [])];
                                [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
                                set("funcoesOperacao", arr);
                              }}><ChevronDown size={14} /></button>
                            </div>
                            {i < (campanha.funcoesOperacao || []).length - 1 && <ArrowRight size={12} color="var(--brand)" style={{ flexShrink: 0 }} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(campanha.funcoesOperacao || []).length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div className="vx-label" style={{ marginBottom: 8 }}>Configure cada função</div>
                    <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", marginBottom: 14 }}>
                      {(campanha.funcoesOperacao || []).map((k) => {
                        const f = FUNCOES[k];
                        const ativa = (campanha.abaFuncaoAtiva || (campanha.funcoesOperacao || [])[0]) === k;
                        return (
                          <button key={k} onClick={() => set("abaFuncaoAtiva", k)} style={{
                            padding: "10px 16px", fontSize: 13, fontWeight: ativa ? 600 : 400, cursor: "pointer",
                            color: ativa ? "var(--brand)" : "var(--muted)",
                            borderBottom: ativa ? "2px solid var(--brand)" : "2px solid transparent",
                            marginBottom: -2, background: "transparent", border: "none", borderBottomWidth: 2, borderBottomStyle: "solid",
                            borderBottomColor: ativa ? "var(--brand)" : "transparent",
                          }}>
                            {f?.nome || k}
                          </button>
                        );
                      })}
                    </div>

                    {(() => {
                      const funcaoAtiva = campanha.abaFuncaoAtiva || (campanha.funcoesOperacao || [])[0];
                      if (!funcaoAtiva) return null;
                      const cfg = campanha[`config_${funcaoAtiva}`] || {};
                      const setConfig = (campo, valor) => set(`config_${funcaoAtiva}`, { ...cfg, [campo]: valor });
                      const fInfo = FUNCOES[funcaoAtiva];
                      const sugeridas = SUGESTOES_FUNCAO[funcaoAtiva] || [];

                      return (
                        <div style={{ display: "grid", gap: 14 }}>
                          <div className="vx-card" style={{ padding: 14 }}>
                            <b style={{ fontSize: 13, color: "var(--brand)" }}>Perfil e requisitos — {fInfo?.nome}</b>
                            <div className="vx-grid vx-g2" style={{ marginTop: 10 }}>
                              <label><div className="vx-label">Quantas vagas?</div>
                                <select className="vx-input" value={cfg.vagas === 0 ? "0" : String(cfg.vagas || 0)} onChange={(e) => setConfig("vagas", Number(e.target.value))}>
                                  <option value="0">Ilimitado</option>
                                  {[1,2,3,5,10,15,20,30,50,100].map((v) => <option key={v} value={v}>{v}</option>)}
                                </select></label>
                              <label><div className="vx-label">Experiência</div>
                                <select className="vx-input" value={cfg.nivelExperiencia || ""} onChange={(e) => setConfig("nivelExperiencia", e.target.value)}>
                                  <option value="">Qualquer nível</option>
                                  {NIVEIS_EXPERIENCIA.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                                </select></label>
                              <label><div className="vx-label">Como entra?</div>
                                <select className="vx-input" value={cfg.processoAdmissao || "manual"} onChange={(e) => setConfig("processoAdmissao", e.target.value)}>
                                  {PROCESSOS_ADMISSAO.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                                </select></label>
                            </div>
                          </div>

                          <div className="vx-card" style={{ padding: 14 }}>
                            <b style={{ fontSize: 13, color: "var(--brand)" }}>Atividades e pagamentos — {fInfo?.nome}</b>
                            <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4, marginBottom: 10 }}>Marque o que este profissional faz e quanto ganha.</div>
                            <div style={{ display: "grid", gap: 6 }}>
                              {(() => {
                                const ordenadas = [...ACOES_DISPONIVEIS].sort((a, b) => {
                                  const sa = sugeridas.includes(a.id) ? 0 : 1;
                                  const sb = sugeridas.includes(b.id) ? 0 : 1;
                                  return sa - sb;
                                });
                                return ordenadas.map((a) => {
                                  const cfgAcoes = cfg.acoesAtivas || [];
                                  const ativa = cfgAcoes.includes(a.id);
                                  return (
                                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: `1px solid ${ativa ? SEL.border : SEL.borderOff}`, borderRadius: 8, background: ativa ? SEL.bg : SEL.bgOff }}>
                                      <input type="checkbox" checked={ativa} onChange={() => {
                                        const novas = ativa ? cfgAcoes.filter((x) => x !== a.id) : [...cfgAcoes, a.id];
                                        setConfig("acoesAtivas", novas);
                                        if (!ativa) {
                                          const t = { ...(cfg.tarefas || {}), [a.id]: cfg.tarefas?.[a.id] || 0 };
                                          setConfig("tarefas", t);
                                        }
                                      }} style={{ accentColor: "var(--brand)" }} />
                                      <span style={{ flex: 1, fontSize: 13, fontWeight: ativa ? 600 : 400 }}>{a.nome}{sugeridas.includes(a.id) && !ativa ? " ★" : ""}</span>
                                      {ativa && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                          <span style={{ fontSize: 12, color: "var(--muted)" }}>R$</span>
                                          <input className="vx-input vx-mono" type="number" min="0" step="0.01" style={{ width: 80, padding: "4px 8px", fontSize: 13 }}
                                            value={cfg.tarefas?.[a.id] || 0}
                                            onChange={(e) => setConfig("tarefas", { ...(cfg.tarefas || {}), [a.id]: Number(e.target.value) })} />
                                        </div>
                                      )}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                            <div className="vx-grid vx-g2" style={{ marginTop: 12 }}>
                              <label><div className="vx-label">Orçamento para esta função</div>
                                <CampoOrcamento value={cfg.orcamento || 0} onChange={(v) => setConfig("orcamento", v)} /></label>
                              <label><div className="vx-label">Prazo por atividade (horas)</div>
                                <input className="vx-input vx-mono" type="number" min="1" value={cfg.prazoHoras || 24} onChange={(e) => setConfig("prazoHoras", Number(e.target.value))} /></label>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {(campanha.funcoesOperacao || []).length >= 2 && (
                  <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--brand-50)", borderRadius: 10, border: "1px solid var(--brand-100)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <Workflow size={14} color="var(--brand)" />
                      <b style={{ fontSize: 13, color: "var(--brand)" }}>Como funciona a equipe</b>
                    </div>
                    <ul className="vx-mut" style={{ fontSize: 12, margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                      <li>Todos compartilham a mesma base de contatos.</li>
                      <li>Quando o primeiro profissional termina, o contato passa automaticamente para o próximo da fila.</li>
                      {(campanha.funcoesOperacao || []).includes("sdr") && (campanha.funcoesOperacao || []).includes("closer") && (
                        <li>O SDR agenda na agenda do Closer — integração automática de calendário.</li>
                      )}
                      <li>Cada profissional é pago individualmente pelo que fizer.</li>
                      <li>Ao publicar, serão criadas {(campanha.funcoesOperacao || []).length} campanhas conectadas dentro da operação.</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
            {campanha.estruturaComercial === "vinculada" && (
              <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 10, padding: "10px 12px", background: "var(--brand-50)", borderRadius: 8, border: "1px solid var(--brand-100)" }}>
                Depois de criar, você poderá escolher de qual campanha os contatos vão vir e para onde vão seguir.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(0)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(2)}>Quem vai trabalhar? <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 3: PERFIL PROFISSIONAL ═══════════════════════ */}
      {passo === 2 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Quem vai trabalhar?</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            Defina o tipo de profissional, o nível de experiência e como ele entra na campanha.
          </p>

          {campanha.estruturaComercial === "operacao" && (campanha.funcoesOperacao || []).length > 0 ? (
            <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ marginBottom: 10 }}><b style={{ color: "var(--brand)" }}>Funções da equipe</b>
                <div className="vx-mut" style={{ fontSize: 11.5 }}>O perfil, vagas e experiência de cada função foram configurados no passo anterior.</div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {(campanha.funcoesOperacao || []).map((k) => {
                  const f = FUNCOES[k];
                  const cfg = campanha[`config_${k}`] || {};
                  return (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--brand-50)", borderRadius: 8, border: "1px solid var(--brand-100)" }}>
                      <Check size={14} color="var(--brand)" />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{f?.nome || k}</span>
                      <span className="vx-mut" style={{ fontSize: 12 }}>{cfg.vagas || 0} vagas · {(cfg.acoesAtivas || []).length} atividades</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (<>
          {/* Função comercial */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>O que o profissional vai fazer?</b>
              {objUI?.funcaoSugerida && <span className="vx-badge vx-badge-brand" style={{ fontSize: 11, marginLeft: 8 }}>Sugerida: {FUNCOES[objUI.funcaoSugerida]?.nome}</span>}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {ORDEM_FUNCOES.filter((f) => f !== "sem-exp").map((k) => {
                const f = FUNCOES[k];
                const nomeAmigavel = { sdr: "Qualificar contatos e agendar reuniões", bdr: "Encontrar novos clientes", closer: "Negociar e fechar vendas", pap: "Visitar clientes presencialmente" }[k] || f.completo;
                return <CardOption key={k} selected={campanha.funcao === k} onClick={() => set("funcao", k)} title={`${nomeAmigavel} (${f.nome})`} subtitle={f.descricao} />;
              })}
            </div>
          </div>

          {/* ICP */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Quem é o cliente ideal?</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Descreva o tipo de empresa ou pessoa que o profissional deve procurar.</div></div>
            <textarea className="vx-input" style={{ minHeight: 64 }} value={campanha.publico || ""}
              onChange={(e) => set("publico", e.target.value)}
              placeholder="Ex.: distribuidoras de bebida com 10 a 80 funcionários" />
            <label style={{ display: "block", marginTop: 12 }}><div className="vx-label">Produto ou serviço ofertado</div>
              <input className="vx-input" value={campanha.produto || ""} onChange={(e) => set("produto", e.target.value)} placeholder="Ex.: Software de gestão" /></label>
          </div>

          {/* Nível de experiência */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Quanta experiência ele precisa ter?</b></div>
            <div style={{ display: "grid", gap: 8 }}>
              {NIVEIS_EXPERIENCIA.map((n) => (
                <CardOption key={n.id} selected={campanha.nivelExperiencia === n.id} onClick={() => set("nivelExperiencia", n.id)} title={n.label} />
              ))}
            </div>
          </div>

          {/* Processo de admissão */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Como o profissional entra na campanha?</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Ele pode começar na hora ou precisa da sua aprovação?</div></div>
            <div style={{ display: "grid", gap: 8 }}>
              {PROCESSOS_ADMISSAO.map((p) => (
                <CardOption key={p.id} selected={campanha.processoAdmissao === p.id} onClick={() => set("processoAdmissao", p.id)} title={p.label} subtitle={p.descricao} />
              ))}
            </div>
            <div className="vx-grid vx-g2" style={{ marginTop: 12 }}>
              <label><div className="vx-label">Quantas vagas?</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select className="vx-input" value={campanha.vagas === 0 ? "0" : String(campanha.vagas || 0)} onChange={(e) => set("vagas", Number(e.target.value))} style={{ flex: 1 }}>
                    <option value="0">Ilimitado</option>
                    {[1,2,3,5,10,15,20,30,50,100].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  {![0,1,2,3,5,10,15,20,30,50,100].includes(campanha.vagas) && campanha.vagas > 0 && (
                    <input className="vx-input vx-mono" type="number" min="1" value={campanha.vagas} onChange={(e) => set("vagas", Number(e.target.value))} style={{ width: 80 }} />
                  )}
                </div></label>
              <label><div className="vx-label">Máximo de profissionais</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select className="vx-input" value={campanha.limiteProf === 0 ? "0" : String(campanha.limiteProf || 0)} onChange={(e) => set("limiteProf", Number(e.target.value))} style={{ flex: 1 }}>
                    <option value="0">Ilimitado</option>
                    {[1,2,3,5,10,15,20,30,50,100].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  {![0,1,2,3,5,10,15,20,30,50,100].includes(campanha.limiteProf) && campanha.limiteProf > 0 && (
                    <input className="vx-input vx-mono" type="number" min="1" value={campanha.limiteProf} onChange={(e) => set("limiteProf", Number(e.target.value))} style={{ width: 80 }} />
                  )}
                </div></label>
            </div>
          </div>
          </>)}

          {/* Visibilidade */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div>
              <div className="vx-label">Quem pode ver esta campanha?</div>
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                <CardOption selected={campanha.visibilidade === "publica"} onClick={() => set("visibilidade", "publica")} icon={Eye} title="Todos podem ver" subtitle="Qualquer profissional que se encaixe no perfil pode se candidatar." />
                <CardOption selected={campanha.visibilidade === "privada"} onClick={() => set("visibilidade", "privada")} icon={EyeOff} title="Só convidados" subtitle="Apenas profissionais que você convidar verão a campanha." />
                <CardOption selected={campanha.visibilidade === "oculta"} onClick={() => set("visibilidade", "oculta")} icon={Lock} title="Oculta" subtitle="Não aparece em buscas. Só entra quem tiver o link." />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(1)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(3)}>Ações e pagamentos <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 4: AÇÕES & REMUNERAÇÃO ═══════════════════════ */}
      {passo === 3 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Ações e pagamentos</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            {campanha.estruturaComercial === "operacao" ? "As atividades e valores de cada função foram configurados no passo 2." : "Escolha o que o profissional faz e quanto ganha por cada resultado."}
          </p>

          {campanha.estruturaComercial === "operacao" && (campanha.funcoesOperacao || []).length > 0 ? (
            <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Resumo de pagamentos por função</b></div>
              <div style={{ display: "grid", gap: 10 }}>
                {(campanha.funcoesOperacao || []).map((k) => {
                  const f = FUNCOES[k];
                  const cfg = campanha[`config_${k}`] || {};
                  const totalAtividades = (cfg.acoesAtivas || []).reduce((s, a) => s + Number(cfg[`valor_${a}`] || 0), 0);
                  return (
                    <div key={k} style={{ padding: "14px 16px", background: "var(--brand-50)", borderRadius: 10, border: "1px solid var(--brand-100)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <Check size={14} color="var(--brand)" />
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{f?.nome || k}</span>
                        <span className="vx-mut" style={{ fontSize: 12 }}>{cfg.vagas || 0} vagas</span>
                      </div>
                      <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                        {(cfg.acoesAtivas || []).map((a) => (
                          <div key={a} className="vx-row">
                            <span style={{ color: "var(--text-2)" }}>{ACOES_DISPONIVEIS.find((x) => x.id === a)?.nome || ACOES[a]?.nome || a}</span>
                            <b className="vx-mono">{money(Number(cfg[`valor_${a}`] || 0))}</b>
                          </div>
                        ))}
                      </div>
                      {cfg.orcamento > 0 && <div className="vx-mut" style={{ fontSize: 12, marginTop: 6 }}>Orçamento: <b className="vx-mono">{money(cfg.orcamento)}</b></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (<>
          {/* Seletor de modo */}
          <div style={{ marginTop: 14, marginBottom: 14 }}>
            <div className="vx-eyebrow" style={{ marginBottom: 8 }}>COMO QUER MONTAR OS PAGAMENTOS?</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { id: "rapido", icon: Zap, titulo: "Usar sugestões prontas", desc: "Escolha entre atividades já montadas e defina o valor de cada uma." },
                { id: "personalizado", icon: SlidersHorizontal, titulo: "Montar do zero", desc: "Crie suas próprias atividades, valores e regras de pagamento." },
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
                    border: `1px solid ${on ? SEL.border : SEL.borderOff}`,
                    background: on ? SEL.bg : SEL.bgOff,
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
              <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Por quais resultados você paga?</b><div className="vx-mut" style={{ fontSize: 11.5 }}>Marque cada atividade e defina o valor. As mais comuns para {FUNCOES[campanha.funcao]?.nome || campanha.funcao || "SDR"} aparecem primeiro.</div></div>
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
                      <div key={a.id} style={{ border: `1px solid ${ativa ? SEL.border : SEL.borderOff}`, borderRadius: 10, background: ativa ? SEL.bg : SEL.bgOff, overflow: "hidden", transition: "border-color .15s, background .15s" }}>
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
                                    style={{ padding: "5px 10px", borderRadius: 16, fontSize: 12, border: `1px solid ${selecionada ? SEL.border : SEL.borderOff}`, background: selecionada ? SEL.bg : SEL.bgOff, color: selecionada ? "#318CE7" : "var(--text-2)", cursor: "pointer", fontWeight: selecionada ? 600 : 400 }}>
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

            {/* Sugestão com IA */}
            {(campanha.modoAcoesRemuneradas || "rapido") === "rapido" && (
              <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
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
              <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
                <div className="vx-label" style={{ marginBottom: 8 }}>Como funciona o pagamento?</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <CardOption selected={campanha.remuneracaoCumulativa} onClick={() => set("remuneracaoCumulativa", true)} title="Pagar por cada etapa" subtitle="O profissional ganha por cada atividade que completar (ex: R$10 por contato + R$30 por reunião)." />
                  <CardOption selected={!campanha.remuneracaoCumulativa} onClick={() => set("remuneracaoCumulativa", false)} title="Pagar só pelo resultado final" subtitle="Só paga quando o profissional chega ao último passo. Etapas anteriores não são remuneradas." />
                </div>
              </div>
            )}

            {/* Comissão */}
            {(campanha.modoAcoesRemuneradas || "rapido") === "rapido" && (
              <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
                <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={campanha.temComissao || false} onChange={(e) => set("temComissao", e.target.checked)} />
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Pagar uma porcentagem extra sobre cada venda</div>
                </label>
                {campanha.temComissao && (
                  <div className="vx-grid vx-g2" style={{ marginTop: 10 }}>
                    <label><div className="vx-label">Porcentagem sobre a venda</div>
                      <div style={{ position: "relative" }}>
                        <input className="vx-input vx-mono" type="number" min="0" max="100" step="0.5" value={campanha.percentualComissao || 0} onChange={(e) => set("percentualComissao", Number(e.target.value))} />
                        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13 }}>%</span>
                      </div></label>
                  </div>
                )}
              </div>
            )}

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
            if (totalAcoes === 0) pendencias.push("Nenhuma atividade escolhida");
            if (modo === "rapido" && acoesRapidas.some((k) => !(campanha.tarefas?.[k] > 0))) pendencias.push("Atividades sem valor definido");
            if (modo === "personalizado" && (campanha.formasGanhoRascunho || []).some((f) => !f.nome?.trim())) pendencias.push("Formas de ganho sem nome");
            if (totalAcoes > 0 && fixos.length === 0 && comissoes.length === 0) pendencias.push("Nenhum valor definido");
            const somaFixos = fixos.reduce((s, v) => s + v, 0);
            return totalAcoes > 0 || pendencias.length > 0 ? (
              <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
                <div className="vx-eyebrow" style={{ marginBottom: 10 }}>RESUMO DO QUE VOCÊ VAI PAGAR</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: pendencias.length ? 12 : 0 }}>
                  <div style={{ textAlign: "center" }}><div className="vx-mut" style={{ fontSize: 11 }}>Atividades</div><b className="vx-mono" style={{ fontSize: 18 }}>{totalAcoes}</b></div>
                  {fixos.length > 0 && <div style={{ textAlign: "center" }}><div className="vx-mut" style={{ fontSize: 11 }}>Valores fixos</div><b className="vx-mono" style={{ fontSize: 18 }}>{fixos.length}</b><div className="vx-mut" style={{ fontSize: 11 }}>Até {money(somaFixos)} por ciclo</div></div>}
                  {comissoes.length > 0 && <div style={{ textAlign: "center" }}><div className="vx-mut" style={{ fontSize: 11 }}>Comissões</div><b className="vx-mono" style={{ fontSize: 18 }}>{comissoes.length}</b></div>}
                  <div style={{ textAlign: "center" }}><div className="vx-mut" style={{ fontSize: 11 }}>Pagamento</div><b style={{ fontSize: 13 }}>{campanha.remuneracaoCumulativa ? "Por etapa" : "Só no final"}</b></div>
                </div>
                {pendencias.length > 0 && (
                  <div style={{ display: "grid", gap: 4 }}>
                    {pendencias.map((p) => <div key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#DC2626" }}><AlertCircle size={13} /> {p}</div>)}
                  </div>
                )}
              </div>
            ) : null;
          })()}

          </>)}

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(2)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(4)}>Verba da campanha <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 5: VERBA DA CAMPANHA ═══════════════════════ */}
      {passo === 4 && campanha && (() => {
        const modo = campanha.modoAcoesRemuneradas || "rapido";
        const acoesAtivas = campanha.acoesAtivas || [];
        const tarefas = campanha.tarefas || {};
        const formasCustom = (campanha.formasGanhoRascunho || []).filter((f) => f.origem !== "predefinido");
        const todasAcoes = modo === "rapido"
          ? [...acoesAtivas.map((k) => ({ id: k, nome: ACOES_DISPONIVEIS.find((a) => a.id === k)?.nome || ACOES[k]?.nome || k, valor: Number(tarefas[k]) || 0, tipo: k === "venda" && campanha.vendaTipoRemuneracao === "percentual" ? "comissao" : "fixo" })),
             ...formasCustom.map((f) => ({ id: f.tempId, nome: f.nome || "Personalizada", valor: f.valor || 0, tipo: f.tipoRemuneracao || "fixo" }))]
          : (campanha.formasGanhoRascunho || []).map((f) => ({ id: f.tempId, nome: f.nome || "Sem nome", valor: f.valor || 0, tipo: f.tipoRemuneracao || "fixo" }));
        const acoesFixas = todasAcoes.filter((a) => a.tipo === "fixo" && a.valor > 0);
        const custoUnitarioTotal = acoesFixas.reduce((s, a) => s + a.valor, 0);
        const orcamentoAtual = Number(campanha.orcamento) || 0;
        const temMultiFuncao = campanha.estruturaComercial === "operacao" && (campanha.funcoesOperacao || []).length >= 2;
        const funcoes = temMultiFuncao ? (campanha.funcoesOperacao || []) : [];

        const SUGESTOES_VERBA = [1000, 2500, 5000, 10000, 25000];

        const distribuicaoVerba = campanha.distribuicaoVerba || {};
        const modoDistribuicao = campanha.modoDistribuicaoVerba || "automatico";

        const calcularDistribuicaoAuto = (verba) => {
          if (acoesFixas.length === 0 || custoUnitarioTotal <= 0) return { acoesPossiveis: 0, porAcao: {} };
          const acoesPossiveis = Math.floor(verba / custoUnitarioTotal);
          const porAcao = {};
          acoesFixas.forEach((a) => {
            const proporcao = a.valor / custoUnitarioTotal;
            porAcao[a.id] = Math.round(verba * proporcao * 100) / 100;
          });
          return { acoesPossiveis, porAcao };
        };

        const distAuto = calcularDistribuicaoAuto(orcamentoAtual);
        const verbaUsadaCustom = modoDistribuicao === "personalizado"
          ? Object.values(distribuicaoVerba).reduce((s, v) => s + (Number(v) || 0), 0)
          : Object.values(distAuto.porAcao).reduce((s, v) => s + v, 0);
        const verbaRestante = Math.max(0, orcamentoAtual - verbaUsadaCustom);
        const precisaAdicionar = orcamentoAtual > disponivel ? orcamentoAtual - disponivel : 0;

        return (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Verba da campanha</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            Defina quanto você deseja investir. A plataforma distribui automaticamente entre as atividades.
          </p>

          {/* Saldo disponível */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14, background: "linear-gradient(135deg, var(--brand-50) 0%, var(--surface) 100%)", border: "1.5px solid var(--brand-100)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Wallet size={20} color="var(--brand)" />
              <div>
                <div className="vx-mut" style={{ fontSize: 11.5 }}>Saldo disponível na conta</div>
                <div className="vx-mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--brand)" }}>{money(disponivel)}</div>
              </div>
            </div>
          </div>

          {/* Campo principal: Quanto deseja investir */}
          <div className="vx-card" style={{ padding: 22, marginTop: 14 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Quanto você deseja investir?</div>
              <div className="vx-mut" style={{ fontSize: 12.5 }}>Esse é o limite total que a empresa autoriza para esta campanha.</div>
            </div>
            <CampoOrcamento value={orcamentoAtual} onChange={(v) => set("orcamento", v)} />

            {/* Sugestões de valores */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {SUGESTOES_VERBA.map((v) => (
                <button key={v} onClick={() => set("orcamento", v)} style={{
                  padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${orcamentoAtual === v ? SEL.border : SEL.borderOff}`,
                  background: orcamentoAtual === v ? SEL.bg : SEL.bgOff,
                  color: orcamentoAtual === v ? "#318CE7" : "var(--text-2)",
                  transition: "all .15s",
                }}>
                  {money(v)}
                </button>
              ))}
            </div>
          </div>

          {/* Valor total + simulação */}
          {orcamentoAtual > 0 && (
            <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
              <div className="vx-eyebrow" style={{ marginBottom: 12 }}>SIMULAÇÃO DA VERBA</div>

              {/* Cards de resumo */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
                <div style={{ background: "var(--brand-50)", borderRadius: 10, padding: "14px 16px", textAlign: "center", border: "1px solid var(--brand-100)" }}>
                  <Wallet size={18} color="var(--brand)" style={{ marginBottom: 4 }} />
                  <div className="vx-mut" style={{ fontSize: 11 }}>Verba total</div>
                  <div className="vx-mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--brand)" }}>{money(orcamentoAtual)}</div>
                </div>
                {custoUnitarioTotal > 0 && (
                  <div style={{ background: "var(--surface)", borderRadius: 10, padding: "14px 16px", textAlign: "center", border: "1px solid var(--border)" }}>
                    <Target size={18} color="var(--muted)" style={{ marginBottom: 4 }} />
                    <div className="vx-mut" style={{ fontSize: 11 }}>Ações estimadas</div>
                    <div className="vx-mono" style={{ fontSize: 18, fontWeight: 700 }}>{distAuto.acoesPossiveis}</div>
                    <div className="vx-mut" style={{ fontSize: 10.5 }}>Estimativa · pode variar</div>
                  </div>
                )}
                <div style={{ background: verbaRestante > 0 ? "rgba(245,158,11,0.06)" : "rgba(22,163,74,0.06)", borderRadius: 10, padding: "14px 16px", textAlign: "center", border: `1px solid ${verbaRestante > 0 ? "rgba(245,158,11,0.2)" : "rgba(22,163,74,0.2)"}` }}>
                  <BadgeDollarSign size={18} color={verbaRestante > 0 ? "var(--amber, #F59E0B)" : "var(--green, #16A34A)"} style={{ marginBottom: 4 }} />
                  <div className="vx-mut" style={{ fontSize: 11 }}>Verba restante</div>
                  <div className="vx-mono" style={{ fontSize: 18, fontWeight: 700, color: verbaRestante > 0 ? "var(--amber, #F59E0B)" : "var(--green, #16A34A)" }}>{money(verbaRestante)}</div>
                </div>
              </div>

              {/* Distribuição por ação */}
              {acoesFixas.length > 0 && (
                <>
                  <div className="vx-eyebrow" style={{ marginBottom: 8 }}>VERBA POR ATIVIDADE</div>
                  <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                    {acoesFixas.map((a) => {
                      const valorDist = modoDistribuicao === "personalizado" ? (Number(distribuicaoVerba[a.id]) || 0) : (distAuto.porAcao[a.id] || 0);
                      const acoesEst = a.valor > 0 ? Math.floor(valorDist / a.valor) : 0;
                      return (
                        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{a.nome}</div>
                            <div className="vx-mut" style={{ fontSize: 11.5 }}>{money(a.valor)} por ação · ~{acoesEst} ações</div>
                          </div>
                          {modoDistribuicao === "personalizado" ? (
                            <div style={{ width: 120 }}>
                              <CampoOrcamento value={valorDist} onChange={(v) => set("distribuicaoVerba", { ...distribuicaoVerba, [a.id]: v })} />
                            </div>
                          ) : (
                            <div className="vx-mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>{money(valorDist)}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Personalizar divisão */}
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ fontSize: 12.5, color: "var(--brand)", cursor: "pointer", fontWeight: 500 }}>
                      <SlidersHorizontal size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
                      Personalizar divisão da verba
                    </summary>
                    <div style={{ marginTop: 10, padding: "14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                        <CardOption selected={modoDistribuicao !== "personalizado"} onClick={() => { set("modoDistribuicaoVerba", "automatico"); set("distribuicaoVerba", {}); }} icon={Zap} title="Automático" subtitle="A plataforma distribui proporcionalmente." />
                        <CardOption selected={modoDistribuicao === "personalizado"} onClick={() => {
                          set("modoDistribuicaoVerba", "personalizado");
                          const init = {};
                          acoesFixas.forEach((a) => { init[a.id] = distAuto.porAcao[a.id] || 0; });
                          set("distribuicaoVerba", init);
                        }} icon={SlidersHorizontal} title="Manual" subtitle="Defina quanto investir em cada atividade." />
                      </div>
                    </div>
                  </details>
                </>
              )}

              {/* Distribuição multi-função */}
              {temMultiFuncao && funcoes.length > 0 && (
                <>
                  <div className="vx-eyebrow" style={{ marginTop: 14, marginBottom: 8 }}>VERBA POR FUNÇÃO</div>
                  <div className="vx-mut" style={{ fontSize: 12, marginBottom: 10 }}>A verba é dividida automaticamente entre as funções, com base nas atividades e dependências comerciais.</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {funcoes.map((fk) => {
                      const f = FUNCOES[fk];
                      const cfg = campanha[`config_${fk}`] || {};
                      const custoFunc = (cfg.acoesAtivas || []).reduce((s, a) => s + Number(cfg[`valor_${a}`] || 0), 0);
                      const totalCustoFunc = funcoes.reduce((s, k2) => { const c2 = campanha[`config_${k2}`] || {}; return s + (c2.acoesAtivas || []).reduce((s2, a) => s2 + Number(c2[`valor_${a}`] || 0), 0); }, 0);
                      const proporcao = totalCustoFunc > 0 ? custoFunc / totalCustoFunc : 1 / funcoes.length;
                      const verbaFunc = Math.round(orcamentoAtual * proporcao * 100) / 100;
                      return (
                        <div key={fk} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{f?.nome || fk}</div>
                            <div className="vx-mut" style={{ fontSize: 11.5 }}>{(cfg.acoesAtivas || []).length} atividade(s) · {cfg.vagas || 0} vagas</div>
                          </div>
                          <div className="vx-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>{money(verbaFunc)}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Aviso: precisa adicionar saldo */}
          {precisaAdicionar > 0 && (
            <div className="vx-card" style={{ padding: 16, marginTop: 14, background: "rgba(245,158,11,0.06)", border: "1.5px solid rgba(245,158,11,0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertCircle size={18} color="var(--amber, #F59E0B)" />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>Saldo insuficiente para a verba desejada</div>
                  <div className="vx-mut" style={{ fontSize: 12.5 }}>
                    Você precisa adicionar <b className="vx-mono">{money(precisaAdicionar)}</b> ao saldo para cobrir essa verba.
                    Você pode salvar o rascunho agora e adicionar saldo depois — mas atividades remuneradas só iniciam com cobertura financeira.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info: separação verba x saldo */}
          <div className="vx-card" style={{ padding: 14, marginTop: 14, background: "var(--surface)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <ShieldCheck size={16} color="var(--brand)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.6 }}>
                A verba é o limite que você autoriza para esta campanha. Novas obrigações não ultrapassam esse valor.
                Você pode salvar o rascunho sem saldo e adicionar quando quiser — atividades remuneradas só iniciam quando houver cobertura.
                A verba é compartilhada entre os profissionais participantes.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(3)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(5)}>Revisar tudo <ArrowRight size={14} /></button>
          </div>
        </>
        );
      })()}

      {/* ═══════════════════════ PASSO 6: REVISÃO ═══════════════════════ */}
      {passo === 5 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Tudo certo?</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            Confira o resumo. A campanha será salva como rascunho — você publica quando quiser.
          </p>

          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            {/* Resumo */}
            <div className="vx-grid vx-g2" style={{ fontSize: 13 }}>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Nome</span><div style={{ fontWeight: 600 }}>{campanha.titulo}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Objetivo</span><div style={{ fontWeight: 600 }}>{objUI?.nome || objBase?.nome || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Onde trabalha</span><div style={{ fontWeight: 600 }}>{MODELOS_TRABALHO[campanha.modeloTrabalho]?.nome || "Remoto"}</div></div>
              {campanha.estruturaComercial === "operacao"
                ? <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Equipe</span><div style={{ fontWeight: 600 }}>{(campanha.funcoesOperacao || []).map((k) => FUNCOES[k]?.nome || k).join(" → ")}</div></div>
                : <div><span className="vx-mut" style={{ fontSize: 11.5 }}>O que faz</span><div style={{ fontWeight: 600 }}>{FUNCOES[campanha.funcao]?.nome || campanha.funcao}</div></div>
              }
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Cliente ideal</span><div style={{ fontWeight: 600 }}>{campanha.publico || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Mercado</span><div style={{ fontWeight: 600 }}>{MERCADOS[campanha.mercado]?.label || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Origem dos contatos</span><div style={{ fontWeight: 600 }}>{ORIGENS_LEAD[campanha.origemLeads]?.label || "—"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Meios de contato</span><div style={{ fontWeight: 600 }}>{(campanha.canais || []).map((c) => CANAIS.find((x) => x.id === c)?.nome || c).join(", ") || "—"}</div></div>
              {campanha.estruturaComercial !== "operacao" && (<>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Como entra</span><div style={{ fontWeight: 600 }}>{PROCESSOS_ADMISSAO.find((p) => p.id === campanha.processoAdmissao)?.label || "Manual"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Quem pode ver</span><div style={{ fontWeight: 600 }}>{campanha.visibilidade === "publica" ? "Todos" : campanha.visibilidade === "privada" ? "Só convidados" : "Oculta"}</div></div>
              </>)}
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Treinamento obrigatório</span><div style={{ fontWeight: 600 }}>{campanha.exigeCertificacao ? "Sim" : "Não"}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Treinamento</span><div style={{ fontWeight: 600 }}>{(campanha.treinamento || []).length} módulo(s)</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Materiais de apoio</span><div style={{ fontWeight: 600 }}>{(campanha.materiaisVinculados || []).length} arquivo(s){(campanha.materiaisVinculados || []).some((m) => m.obrigatoriedade === "obrigatorio") ? ` (${(campanha.materiaisVinculados || []).filter((m) => m.obrigatoriedade === "obrigatorio").length} obrigatório(s))` : ""}</div></div>
              {campanha.estruturaComercial !== "operacao" && (<>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Verba da campanha</span><div style={{ fontWeight: 600 }} className="vx-mono">{money(campanha.orcamento)}</div></div>
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Pagamento</span><div style={{ fontWeight: 600 }}>{campanha.remuneracaoCumulativa ? "Por etapa" : "Só no resultado final"}</div></div>
              </>)}
            </div>

            {campanha.estruturaComercial === "operacao" && (campanha.funcoesOperacao || []).length > 0 ? (<>
              <hr className="vx-sep" />
              <div className="vx-eyebrow" style={{ marginBottom: 10 }}>DETALHES POR FUNÇÃO</div>
              <div style={{ display: "grid", gap: 10 }}>
                {(campanha.funcoesOperacao || []).map((k) => {
                  const f = FUNCOES[k];
                  const cfg = campanha[`config_${k}`] || {};
                  return (
                    <div key={k} style={{ padding: "14px 16px", background: "var(--brand-50)", borderRadius: 10, border: "1px solid var(--brand-100)" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{f?.nome || k}</div>
                      <div className="vx-grid vx-g2" style={{ fontSize: 12.5 }}>
                        <div><span className="vx-mut">Vagas</span><div style={{ fontWeight: 600 }}>{cfg.vagas || 0}</div></div>
                        <div><span className="vx-mut">Experiência</span><div style={{ fontWeight: 600 }}>{NIVEIS_EXPERIENCIA.find((n) => n.id === cfg.nivelExperiencia)?.label || "Qualquer"}</div></div>
                        <div><span className="vx-mut">Admissão</span><div style={{ fontWeight: 600 }}>{PROCESSOS_ADMISSAO.find((p) => p.id === cfg.processoAdmissao)?.label || "Manual"}</div></div>
                        <div><span className="vx-mut">Orçamento</span><div style={{ fontWeight: 600 }} className="vx-mono">{money(cfg.orcamento || 0)}</div></div>
                      </div>
                      {(cfg.acoesAtivas || []).length > 0 && (
                        <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12.5 }}>
                          {(cfg.acoesAtivas || []).map((a) => (
                            <div key={a} className="vx-row">
                              <span style={{ color: "var(--text-2)" }}>{ACOES_DISPONIVEIS.find((x) => x.id === a)?.nome || ACOES[a]?.nome || a}</span>
                              <b className="vx-mono">{money(Number(cfg[`valor_${a}`] || 0))}</b>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>) : (<>
            <hr className="vx-sep" />
            <div className="vx-eyebrow" style={{ marginBottom: 8 }}>Valores por resultado</div>
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
                  <span style={{ color: "var(--text-2)" }}>Porcentagem extra por venda</span>
                  <b className="vx-mono">{campanha.percentualComissao}%</b>
                </div>
              )}
            </div>

            {custo?.estimativaPorProfissional > 0 && (
              <div className="vx-mut" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
                Estimativa por profissional (meta {campanha.limitePorProfissional || 10}): <b className="vx-mono">{money(custo.estimativaPorProfissional)}</b>
              </div>
            )}
            </>)}

            <hr className="vx-sep" />
            <div className="vx-eyebrow" style={{ marginBottom: 8 }}>Verificação</div>
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
                <CheckCircle2 size={14} /> Tudo certo! Pode salvar.
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
            <button className="vx-btn" onClick={() => setPasso(4)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={criar}>
              {salvando ? "Salvando…" : <>Salvar rascunho <Check size={14} /></>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

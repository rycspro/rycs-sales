import { useState, useEffect, useRef, useMemo } from "react";
import CidadeEstadoSelector from "./CidadeEstadoSelector.jsx";
import { Sparkles, ArrowRight, ArrowLeft, Check, Wallet, Loader, Target, CalendarCheck, MapPin, BadgeDollarSign, Workflow, Plus, Trash2, ShieldCheck, TrendingUp, BookOpen, ChevronDown, ChevronUp, Send, RotateCcw, Search, Filter, HandCoins, Footprints, Settings, Laptop, Building2, MessageCircle, Phone, Mail, Linkedin, Instagram, Globe, Users, Eye, EyeOff, Lock, AlertCircle, CheckCircle2, FileText, Upload, Library, Database, UserPlus, Shuffle, Zap, SlidersHorizontal, Image, Link2, ClipboardCheck, UserCheck, Bot, X, File, CloudUpload, GripVertical, Download, Video, Music, FileSpreadsheet, Presentation, Cloud, CloudOff, LogOut, GraduationCap, Pencil, Info } from "lucide-react";
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
import { ModalSaldo } from "./PagamentosEmpresa.jsx";
import {
  MODELOS_TRABALHO, RESTRICOES_GEO, MERCADOS, ORIGENS_LEAD, CANAIS,
  NIVEIS_EXPERIENCIA, PROCESSOS_ADMISSAO, OBJETIVOS_UI, ORDEM_OBJETIVOS_UI,
  ACOES_DISPONIVEIS, SUGESTOES_ACOES, ORIGENS_PROFISSIONAIS, SELECAO_RAPIDA,
  regrasLocalizacao, camposVisiveis, diagnosticoCampanha, migrarCampanhaAntiga,
  precisaDeReuniao, precisaDePresencial,
} from "../../../shared/campaignEngine.js";
import { FUNCOES, ORDEM_FUNCOES } from "../../../shared/funcoes.js";
import { perguntaMetaQuantitativa, calcularPlanejamentoReverso } from "../../../shared/planejamentoReverso.js";
import { calcularFunilProjecao, entradaDaCampanha } from "../../../shared/funilProjecao.js";
import { TIPOS_RESPOSTA, CLASSIFICACOES, calcularScore, criarPergunta, criarCriterio, perguntasVisiveis } from "../../../shared/qualificacaoLeads.js";
import { CANAIS_CONFIRMACAO, configConfirmacaoPadrao } from "../../../shared/confirmacaoContato.js";
import { investimentoRecomendado, capacidadeOperacional } from "../../../shared/otimizacaoVerba.js";

const OPC_PAISES = PAISES.map((p) => ({ value: p.code, label: p.nome }));
const NOME_PAIS = Object.fromEntries(PAISES.map((p) => [p.code, p.nome]));
const nomePais = (code) => NOME_PAIS[String(code || "").toUpperCase()] || code || "seu país";

const PASSOS = ["Tipo de campanha", "O que você precisa?", "Como vai funcionar?", "Configurações", "Confirmação", "Quem vai trabalhar?", "Ações", "Gestão e validação", "Pagamentos", "Tudo certo?"];
const PASSOS_CURTOS = ["Tipo", "Objetivo", "Campanha", "Operação", "Confirmação", "Profissionais", "Ações", "Gestão", "Pagamentos", "Revisão"];

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

const ACOES_ICON_ROTINA = {
  ligacao: Phone, contato: MessageCircle, lead_encontrado: Search,
  lead_cadastrado: UserPlus, lead_validado: CheckCircle2, lead_qualificado: Filter,
  agendamento: CalendarCheck, bonus_comparecimento: UserCheck,
  realizada: Users, proposta: FileText, venda: HandCoins,
  visita: MapPin, follow: RotateCcw, abordagem: Zap,
};

const JORNADA_DESC = {
  ligacao: "Realizar cold call e registrar o contato.", contato: "Abordar o lead pelo canal selecionado.",
  lead_encontrado: "Prospectar e cadastrar novos contatos.", lead_cadastrado: "Registrar o lead na base de dados.",
  lead_validado: "Validar as informações do contato.", lead_qualificado: "Identificar necessidades e potencial de compra.",
  agendamento: "Agendar uma conversa com o responsável pela negociação.",
  bonus_comparecimento: "Acompanhar a participação do cliente na reunião.",
  realizada: "Conduzir a reunião e registrar os resultados.", proposta: "Apresentar a proposta comercial ao cliente.",
  venda: "Fechar o negócio e registrar a venda.", visita: "Realizar a visita comercial presencial.",
  follow: "Retomar o contato e registrar a resposta.", abordagem: "Realizar abordagem inicial com o lead.",
};

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

const SEL = { bg: "var(--brand-50, #E4F0FF)", border: "var(--brand, #318CE7)", bgOff: "var(--surface, #FFFFFF)", borderOff: "var(--border, #E2E2E2)" };

function Tag({ obrigatorio }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontSize: 10, fontWeight: 700, letterSpacing: ".04em",
      padding: "2px 7px", borderRadius: 20,
      marginLeft: 7, verticalAlign: "middle",
      background: obrigatorio ? "#FEF3C7" : "var(--brand-600,#1D4ED8)",
      color: obrigatorio ? "#92400E" : "#fff",
      border: `1px solid ${obrigatorio ? "#FCD34D" : "var(--brand-600,#1D4ED8)"}`,
    }}>
      {obrigatorio ? "OBRIGATÓRIO" : "OPCIONAL"}
    </span>
  );
}

function CardOptionLarge({ selected, onClick, icon: Icon, title, subtitle, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative", padding: "20px 18px 18px", cursor: "pointer", textAlign: "left", width: "100%",
        border: `1.5px solid ${selected ? "var(--brand)" : "var(--border)"}`,
        background: selected ? "var(--brand-50, #EFF6FF)" : "var(--surface)",
        borderRadius: 12, transition: "border-color .15s, background .15s",
      }}
    >
      {selected && (
        <div style={{ position: "absolute", top: 12, right: 12, width: 22, height: 22, borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Check size={13} color="#fff" />
        </div>
      )}
      {Icon && <Icon size={28} color="var(--brand)" style={{ marginBottom: 12 }} />}
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink, #171717)", marginBottom: 6 }}>{title}</div>
      {subtitle && <div className="vx-mut" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{subtitle}</div>}
      {badge && <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--brand)", textTransform: "uppercase" }}>{badge}</div>}
    </button>
  );
}

function CardOption({ selected, onClick, icon: Icon, title, subtitle, disabled }) {
  return (
    <button
      className={`vx-card${selected ? " vx-card--sel" : ""}`}
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
        {Icon && <Icon size={18} color={selected ? "var(--brand)" : "var(--muted)"} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: selected ? 600 : 400, color: "var(--ink, #171717)" }}>{title}</div>
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
          border: `1px solid ${isActive(item.id) ? SEL.border : SEL.borderOff}`,
          background: isActive(item.id) ? SEL.bg : SEL.bgOff,
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

function SelectDropdown({ value, onChange, options }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const selected = options.find((o) => o.value === value) || options[0];
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "9px 12px", background: "var(--surface)", border: `1px solid ${open ? "var(--brand)" : "var(--border)"}`,
        borderRadius: 8, cursor: "pointer", fontSize: 13.5, fontWeight: 500, color: "var(--text)",
        boxShadow: open ? "0 0 0 3px var(--brand-100)" : "none", transition: "border-color .15s, box-shadow .15s",
      }}>
        <span>{selected?.label}</span>
        <ChevronDown size={15} color="var(--muted)" style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,.12)", overflow: "hidden",
        }}>
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", background: o.value === value ? "var(--brand-50)" : "transparent",
              border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: o.value === value ? 600 : 400,
              color: o.value === value ? "var(--brand)" : "var(--text)", textAlign: "left",
            }}>
              <span>{o.label}</span>
              {o.value === value && <Check size={14} color="var(--brand)" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FontesContatosSelector({ campanha, set }) {
  const fontesSelecionadas = campanha.fontesContatosSelecionadas || [];
  const leadsSelecionados = campanha.leadsSelecionados || [];
  const listasSelecionadas = campanha.listasSelecionadas || [];

  const [dadosFontes, setDadosFontes] = useState({});
  const [buscas, setBuscas] = useState({});
  const [pastasAbertas, setPastasAbertas] = useState({});

  const FONTES = [
    { id: "meus-contatos", Icon: Users, label: "Meus contatos", desc: "Sua base de contatos" },
    { id: "listas-leads", Icon: Library, label: "Listas de leads", desc: "Listas salvas na plataforma" },
    { id: "meta-ads", Icon: Target, label: "Meta Ads", desc: "Leads do Facebook/Instagram" },
    { id: "loja-leads", Icon: Database, label: "Loja de Leads", desc: "Leads adquiridos" },
    { id: "google-sheets", Icon: FileSpreadsheet, label: "Google Planilhas", desc: "Importar de planilha pública" },
    { id: "importar", Icon: Upload, label: "Importar contatos", desc: "CSV ou arquivo de contatos" },
  ];

  const carregarFonte = (id) => {
    if (id === "meus-contatos") {
      setDadosFontes((d) => ({ ...d, [id]: { items: [], loading: true } }));
      api("/leads").then((r) => {
        setDadosFontes((d) => ({ ...d, [id]: { items: Array.isArray(r) ? r : [], loading: false } }));
      }).catch(() => setDadosFontes((d) => ({ ...d, [id]: { items: [], loading: false } })));
    } else if (id === "meta-ads") {
      setDadosFontes((d) => ({ ...d, [id]: { items: [], loading: true } }));
      api("/meta/leads").then((r) => {
        const items = Array.isArray(r) ? r : (r?.leads || []);
        setDadosFontes((d) => ({ ...d, [id]: { items, loading: false } }));
      }).catch(() => setDadosFontes((d) => ({ ...d, [id]: { items: [], loading: false } })));
    } else if (id === "listas-leads" || id === "loja-leads") {
      setDadosFontes((d) => ({ ...d, [id]: { pastas: [], loading: true } }));
      api("/loja-leads/pastas").then(async (r) => {
        const pastas = r?.pastas || [];
        const pastasComListas = await Promise.all(
          pastas.map(async (p) => {
            const lr = await api(`/loja-leads/listas/${p.id}`).catch(() => ({ listas: [] }));
            return { ...p, listas: lr?.listas || [] };
          })
        );
        setDadosFontes((d) => ({ ...d, [id]: { pastas: pastasComListas, loading: false } }));
      }).catch(() => setDadosFontes((d) => ({ ...d, [id]: { pastas: [], loading: false } })));
    }
  };

  const toggleFonte = (id) => {
    const ativa = fontesSelecionadas.includes(id);
    const novas = ativa ? fontesSelecionadas.filter((f) => f !== id) : [...fontesSelecionadas, id];
    set("fontesContatosSelecionadas", novas);
    if (!ativa && !dadosFontes[id]) carregarFonte(id);
  };

  const toggleLead = (id) => {
    const novos = leadsSelecionados.includes(id)
      ? leadsSelecionados.filter((x) => x !== id)
      : [...leadsSelecionados, id];
    set("leadsSelecionados", novos);
  };

  const toggleLista = (id) => {
    const novos = listasSelecionadas.includes(id)
      ? listasSelecionadas.filter((x) => x !== id)
      : [...listasSelecionadas, id];
    set("listasSelecionadas", novos);
  };

  const totalSelecionados = leadsSelecionados.length + listasSelecionadas.length;

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 13 }}>Fontes de contatos</b>
        <div className="vx-mut" style={{ fontSize: 12, marginTop: 2 }}>Selecione de onde virão os contatos desta campanha.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {FONTES.map(({ id, Icon, label, desc }) => {
          const ativo = fontesSelecionadas.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggleFonte(id)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                background: ativo ? "var(--brand-50)" : "var(--surface)",
                border: `1px solid ${ativo ? "var(--brand)" : "var(--border)"}`,
                borderRadius: 10, cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: ativo ? "var(--brand)" : "var(--brand-50)", border: ativo ? "none" : "1px solid var(--brand-100)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={19} color={ativo ? "#fff" : "var(--brand)"} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: ativo ? "var(--brand)" : "var(--text)" }}>{label}</div>
                <div className="vx-mut" style={{ fontSize: 12, marginTop: 2 }}>{desc}</div>
              </div>
              {ativo && <Check size={16} color="var(--brand)" style={{ flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {/* Painéis expandidos por fonte */}
      {fontesSelecionadas.map((id) => {
        const d = dadosFontes[id] || {};
        const busca = buscas[id] || "";

        if (id === "meus-contatos" || id === "meta-ads") {
          const items = d.items || [];
          const filtrados = items.filter((l) => {
            if (!busca.trim()) return true;
            const t = busca.toLowerCase();
            return (l.nome || "").toLowerCase().includes(t) || (l.empresa || "").toLowerCase().includes(t) || (l.telefone || "").includes(t) || (l.email || "").toLowerCase().includes(t);
          });
          const fonteLabel = id === "meus-contatos" ? "Meus contatos" : "Meta Ads";
          return (
            <div key={id} style={{ marginTop: 10, padding: "12px 14px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8, color: "var(--brand)" }}>{fonteLabel}</div>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-2)" }} />
                <input className="vx-input" placeholder="Buscar por nome, empresa, telefone…" value={busca} onChange={(e) => setBuscas((b) => ({ ...b, [id]: e.target.value }))} style={{ paddingLeft: 26, fontSize: 12 }} />
              </div>
              {d.loading ? (
                <div className="vx-mut" style={{ fontSize: 12 }}><Loader size={12} style={{ animation: "spin 1s linear infinite", marginRight: 4 }} />Carregando…</div>
              ) : items.length === 0 ? (
                <div className="vx-mut" style={{ fontSize: 12, padding: 8, textAlign: "center" }}>Nenhum contato encontrado</div>
              ) : (
                <>
                  <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)" }}>
                    {filtrados.map((l) => (
                      <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                        <input type="checkbox" checked={leadsSelecionados.includes(l.id)} onChange={() => toggleLead(l.id)} style={{ accentColor: "var(--brand)" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500 }}>{l.nome || "Sem nome"}</div>
                          <div className="vx-mut" style={{ fontSize: 11 }}>{[l.empresa, l.telefone, l.email].filter(Boolean).join(" · ")}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" className="vx-btn vx-btn-sm" style={{ fontSize: 11 }} onClick={() => { const ids = items.map((l) => l.id); const novos = Array.from(new Set([...leadsSelecionados, ...ids])); set("leadsSelecionados", novos); }}>Selecionar todos</button>
                    <button type="button" className="vx-btn vx-btn-sm" style={{ fontSize: 11 }} onClick={() => { const ids = new Set(items.map((l) => l.id)); set("leadsSelecionados", leadsSelecionados.filter((x) => !ids.has(x))); }}>Remover todos</button>
                  </div>
                </>
              )}
            </div>
          );
        }

        if (id === "listas-leads" || id === "loja-leads") {
          const pastas = d.pastas || [];
          const fonteLabel = id === "listas-leads" ? "Listas de leads" : "Loja de Leads";
          return (
            <div key={id} style={{ marginTop: 10, padding: "12px 14px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8, color: "var(--brand)" }}>{fonteLabel}</div>
              {d.loading ? (
                <div className="vx-mut" style={{ fontSize: 12 }}><Loader size={12} style={{ animation: "spin 1s linear infinite", marginRight: 4 }} />Carregando…</div>
              ) : pastas.length === 0 ? (
                <div className="vx-mut" style={{ fontSize: 12, padding: 8, textAlign: "center" }}>Nenhuma lista encontrada</div>
              ) : (
                <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)" }}>
                  {pastas.map((p) => (
                    <div key={p.id}>
                      <button
                        type="button"
                        onClick={() => setPastasAbertas((pa) => ({ ...pa, [`${id}-${p.id}`]: !pa[`${id}-${p.id}`] }))}
                        style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 10px", background: "var(--surface-raised, var(--surface))", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                      >
                        {pastasAbertas[`${id}-${p.id}`] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {p.nome || "Pasta"}
                        <span className="vx-mut" style={{ fontWeight: 400, marginLeft: "auto" }}>{(p.listas || []).length} lista(s)</span>
                      </button>
                      {pastasAbertas[`${id}-${p.id}`] && (p.listas || []).map((l) => (
                        <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: 12, background: "var(--bg)" }}>
                          <input type="checkbox" checked={listasSelecionadas.includes(l.id)} onChange={() => toggleLista(l.id)} style={{ accentColor: "var(--brand)" }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500 }}>{l.nome || "Lista"}</div>
                            {l.total != null && <div className="vx-mut" style={{ fontSize: 11 }}>{l.total} contatos</div>}
                          </div>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }

        if (id === "google-sheets") {
          return (
            <div key={id} style={{ marginTop: 10, padding: "12px 14px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "var(--brand)" }}>Google Planilhas</div>
              <div className="vx-mut" style={{ fontSize: 12, marginBottom: 8 }}>Cole o link de uma planilha pública do Google Sheets com os contatos.</div>
              <input className="vx-input" placeholder="https://docs.google.com/spreadsheets/d/…" value={campanha.planilhaUrl || ""} onChange={(e) => set("planilhaUrl", e.target.value)} style={{ fontSize: 12 }} />
            </div>
          );
        }

        if (id === "importar") {
          return (
            <div key={id} style={{ marginTop: 10, padding: "12px 14px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "var(--brand)" }}>Importar contatos</div>
              <div className="vx-mut" style={{ fontSize: 12, marginBottom: 8 }}>Importe um arquivo CSV ou Excel com seus contatos.</div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "9px 16px", background: "var(--brand)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", userSelect: "none", transition: "opacity .15s" }} onMouseEnter={e => e.currentTarget.style.opacity=".85"} onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                <Upload size={14} color="#fff" />
                <span>Selecionar arquivo (.csv, .xlsx)</span>
                <input type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append("file", file);
                  try {
                    await fetch(`${API_URL}/api/leads/import`, { method: "POST", body: fd, credentials: "include" });
                    if (fontesSelecionadas.includes("meus-contatos")) carregarFonte("meus-contatos");
                    else { toggleFonte("meus-contatos"); carregarFonte("meus-contatos"); }
                  } catch (_) { /* ignore */ }
                }} />
              </label>
            </div>
          );
        }

        return null;
      })}

      {/* Resumo de contatos vinculados */}
      {totalSelecionados > 0 && (
        <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--brand-50)", borderRadius: 8, border: "1px solid var(--brand-100)", display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={14} color="var(--brand)" />
          <span style={{ fontSize: 13, color: "var(--brand)", fontWeight: 500 }}>
            {[
              leadsSelecionados.length > 0 && `${leadsSelecionados.length} contato(s) selecionado(s)`,
              listasSelecionadas.length > 0 && `${listasSelecionadas.length} lista(s) vinculada(s)`,
            ].filter(Boolean).join(" · ")}
          </span>
        </div>
      )}
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
  if (!rascunho && rascunhoSalvo.current) { removerArmazenado(chaveRascunho); rascunhoSalvo.current = null; }
  const rascunhoCampanhaInicial = rascunho || rascunhoSalvo.current?.campanha || null;
  const [tipoCampanha, setTipoCampanha] = useState(rascunhoCampanhaInicial?.estruturaComercial || "");
  const [campanhasDisponiveis, setCampanhasDisponiveis] = useState([]);
  const [carregandoCampanhas, setCarregandoCampanhas] = useState(false);
  const _rawPasso = rascunho?.passoWizard ?? rascunhoSalvo.current?.passo ?? 0;
  const [passo, _setPasso] = useState(rascunhoCampanhaInicial ? _rawPasso + 1 : _rawPasso);
  const [etapaConfirmacao, setEtapaConfirmacao] = useState(false);
  const setPasso = (p) => { _setPasso(p); setEtapaConfirmacao(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
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
  const [gerandoICP, setGerandoICP] = useState(false);
  const [recomendandoAtividades, setRecomendandoAtividades] = useState(false);
  const [recomendandoEvidencias, setRecomendandoEvidencias] = useState(false);
  const [gerandoDescricao, setGerandoDescricao] = useState(false);
  const uploadInputRef = useRef(null);
  const [catalogoProdutos, setCatalogoProdutos] = useState([]);
  const [popoverProjecao, setPopoverProjecao] = useState(null);
  const [modalSaldoAberto, setModalSaldoAberto] = useState(false);
  const [popoverFerr, setPopoverFerr] = useState(false);
  const popoverFerrRef = useRef(null);

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
  useEffect(() => {
    if (!popoverFerr) return;
    const h = (e) => { if (popoverFerrRef.current && !popoverFerrRef.current.contains(e.target)) setPopoverFerr(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [popoverFerr]);
  useEffect(() => { rascunhoIdRef.current = rascunhoId; }, [rascunhoId]);
  useEffect(() => { campanhaRef.current = campanha; }, [campanha]);
  useEffect(() => { passoRef.current = passo; }, [passo]);
  useEffect(() => {
    if (passo !== 5) return;
    api("/erp/pedidos/catalogo").then((r) => {
      if (r && Array.isArray(r.produtos)) setCatalogoProdutos(r.produtos);
    }).catch(() => {});
  }, [passo]);

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

  useEffect(() => {
    if (passo !== 3 || tipoCampanha !== "vinculada") return;
    setCarregandoCampanhas(true);
    api("/campaigns").then((data) => {
      if (Array.isArray(data)) setCampanhasDisponiveis(data.filter((c) => c.status !== "cancelada" && c.id !== rascunhoId));
      setCarregandoCampanhas(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, tipoCampanha]);

  const setNested = (k, sub, v) => setCampanha((c) => ({ ...c, [k]: { ...(c[k] || {}), [sub]: v } }));

  const vis = useMemo(() => campanha ? camposVisiveis(campanha) : {}, [campanha]);
  const diag = useMemo(() => campanha ? diagnosticoCampanha(campanha, emp) : { pronta: false, bloqueios: [], recomendacoes: [] }, [campanha, emp]);

  const secaoVisivel = useMemo(() => {
    if (!campanha) return {};
    return {
      dadosBasicos: true,
      modeloTrabalho: true,
      mercado: !!campanha.modeloTrabalho,
      origemLeads: !!campanha.mercado,
      canais: !!campanha.origemLeads,
      materiais: !!(campanha.canais && campanha.canais.length > 0),
      estrutura: !!(campanha.canais && campanha.canais.length > 0),
    };
  }, [campanha]);

  const escolher = (chaveUI) => {
    const objUI = OBJETIVOS_UI[chaveUI];
    if (!objUI) return;
    const base = montarCampanha(objUI.objetivo, emp);
    if (!base) return;
    setCampanha({
      ...base,
      objetivoUI: chaveUI,
      estruturaComercial: tipoCampanha || "independente",
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
    setPasso(2);
  };

  const receberCampanhaDoJarvas = (chaveObjetivo, campanhaMontada) => {
    setCampanha({ ...campanhaMontada, objetivoUI: "", estruturaComercial: tipoCampanha || campanhaMontada.estruturaComercial || "independente", modeloTrabalho: "remoto", restricaoGeo: "nenhuma", origemLeads: "", mercado: "pais_todo", distribuicaoLeads: "automatica", canais: [], nivelExperiencia: "indiferente", processoAdmissao: "manual", visibilidade: "publica", temComissao: false, remuneracaoCumulativa: true, acoesAtivas: Object.keys(campanhaMontada.tarefas || {}) });
    setExplicacao("");
    setPasso(2);
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

  const gerarICP = async () => {
    if (!campanha || gerandoICP) return;
    setGerandoICP(true);
    try {
      const r = await api("/campaigns/gerar-icp", {
        objetivo: campanha.objetivo, funcao: campanha.funcao,
        produto: campanha.produto || emp.produto || "", regiao: campanha.regiao || "",
        mercado: campanha.mercado || "", empresa: { nome: emp.nome, segmento: emp.segmento },
      });
      if (r && !r.error && r.icp) {
        set("publico", r.icp);
        if (r.icpEstruturado) set("icpEstruturado", r.icpEstruturado);
      }
    } catch (_) { /* silently fail */ }
    setGerandoICP(false);
  };

  const gerarDescricaoIA = async () => {
    if (!campanha || gerandoDescricao) return;
    setGerandoDescricao(true);
    try {
      const r = await api("/campaigns/gerar-descricao", {
        titulo: campanha.titulo, objetivo: campanha.objetivo, funcao: campanha.funcao,
      });
      if (r.descricao) set("descricao", r.descricao);
    } catch (e) { aviso("Não foi possível gerar a descrição."); }
    setGerandoDescricao(false);
  };

  const recomendarAtividades = async () => {
    if (!campanha || recomendandoAtividades) return;
    setRecomendandoAtividades(true);
    try {
      const r = await api("/campaigns/recomendar-atividades", {
        objetivo: campanha.objetivo, funcao: campanha.funcao,
        mercado: campanha.mercado || "", origemLeads: campanha.origemLeads || "",
        canais: campanha.canais || [], produto: campanha.produto || emp.produto || "",
      });
      if (r && !r.error && Array.isArray(r.atividades)) {
        const novas = r.atividades.map((a) => a.id).filter((id) => !(campanha.acoesAtivas || []).includes(id));
        if (novas.length > 0) set("acoesAtivas", [...(campanha.acoesAtivas || []), ...novas]);
        if (r.valores) {
          const t = { ...(campanha.tarefas || {}) };
          for (const [k, v] of Object.entries(r.valores)) { if (!t[k]) t[k] = v; }
          set("tarefas", t);
        }
      }
    } catch (_) { /* silently fail */ }
    setRecomendandoAtividades(false);
  };

  const recomendarEvidencias = async (fgIndex) => {
    if (!campanha || recomendandoEvidencias) return;
    setRecomendandoEvidencias(true);
    try {
      const fg = (campanha.formasGanhoRascunho || [])[fgIndex];
      if (!fg) { setRecomendandoEvidencias(false); return; }
      const r = await api("/campaigns/recomendar-comprovacoes", {
        atividade: fg.nome, funcao: campanha.funcao || "",
        objetivo: campanha.objetivo || "", canais: campanha.canais || [],
      });
      if (r && !r.error && Array.isArray(r.evidencias)) {
        const ids = r.evidencias.map((e) => e.id).filter((id) => EVIDENCIAS_OPCOES.some((o) => o.id === id));
        if (ids.length) {
          const fgs = [...(campanha.formasGanhoRascunho || [])];
          fgs[fgIndex] = { ...fgs[fgIndex], evidencias: [...new Set([...(fgs[fgIndex].evidencias || []), ...ids])] };
          set("formasGanhoRascunho", fgs);
        }
        if (r.metodoAprovacao) {
          const fgs = [...(campanha.formasGanhoRascunho || [])];
          fgs[fgIndex] = { ...fgs[fgIndex], metodoAprovacao: r.metodoAprovacao };
          set("formasGanhoRascunho", fgs);
        }
      }
    } catch (_) { /* silently fail */ }
    setRecomendandoEvidencias(false);
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
    const listaIds = c.listasSelecionadas || [];
    for (const listaId of listaIds) {
      await api("/loja-leads/vincular", { listaId, campaignId: id, modo: "inclusao" });
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
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => { removerArmazenado(chaveRascunho); rascunhoSalvo.current = null; setCampanha(null); setTipoCampanha(""); setPasso(0); }}>Descartar</button>
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
      <div className="vx-wizard-stepper">
        <div className="vx-ws-label">Etapa {passo + 1} de {PASSOS.length}</div>
        <div className="vx-ws-bar"><div className="vx-ws-bar-fill" style={{ width: `${((passo) / (PASSOS.length - 1)) * 100}%` }} /></div>
      </div>

      {/* ═══════════════════════ PASSO 0: TIPO DE CAMPANHA ═══════════════════════ */}
      {passo === 0 && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 22, margin: "0 0 8px" }}>Tipo de campanha</h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Como você deseja organizar sua operação comercial?</p>

          <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: "var(--brand)" }}>Selecione o tipo de campanha</b><Tag obrigatorio={true} />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <CardOption selected={tipoCampanha === "independente"} onClick={() => { setTipoCampanha("independente"); setPasso(1); }} icon={Target} title="Campanha com uma única função" subtitle="Um ou vários profissionais exercendo a mesma função." />
              <CardOption selected={tipoCampanha === "operacao"} onClick={() => { setTipoCampanha("operacao"); setPasso(1); }} icon={Shuffle} title="Campanha com diferentes profissionais" subtitle="Profissionais com funções diferentes trabalhando juntos na mesma campanha." />
              <CardOption selected={tipoCampanha === "vinculada"} onClick={() => { setTipoCampanha("vinculada"); setPasso(1); }} icon={Workflow} title="Conectar com outra campanha" subtitle="Conecte esta campanha a uma operação comercial existente." />
            </div>
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }} onClick={aoCancelar}>Cancelar</button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 1: OBJETIVO ═══════════════════════ */}
      {passo === 1 && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 22, margin: "0 0 8px" }}>O que você quer que aconteça?</h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
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
            <button className="vx-btn" onClick={() => setPasso(0)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }} onClick={aoCancelar}>Cancelar</button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 2: ESTRUTURA ═══════════════════════ */}
      {passo === 2 && campanha && (
        <>
          {/* Dados básicos */}
          <>
          <h2 className="vx-disp" style={{ fontSize: 22, margin: "0 0 8px" }}>Sobre a campanha</h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Defina as informações gerais da sua campanha.</p>
          <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
            <label><div className="vx-label">Como você quer chamar esta campanha? <Tag obrigatorio={true} /></div>
              <input className="vx-input" value={campanha.titulo} onChange={(e) => set("titulo", e.target.value)} /></label>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div className="vx-label" style={{ margin: 0 }}>Descreva o que o profissional vai fazer <Tag obrigatorio={false} /></div>
                <button className="vx-btn vx-btn-sm" style={{ gap: 5, fontSize: 11.5 }} disabled={gerandoDescricao} onClick={gerarDescricaoIA}>
                  {gerandoDescricao ? <><Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> Gerando…</> : <><Sparkles size={12} /> Gerar com IA</>}
                </button>
              </div>
              <textarea className="vx-input" style={{ minHeight: 62 }} value={campanha.descricao || ""}
                onChange={(e) => set("descricao", e.target.value)}
                placeholder="Ex.: Ligar para donos de restaurante e agendar uma demonstração do sistema." />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div className="vx-label" style={{ margin: 0 }}>Descreva o público que o profissional precisa abordar <Tag obrigatorio={false} /></div>
                <button className="vx-btn vx-btn-sm" style={{ gap: 5, fontSize: 11.5 }} disabled={gerandoICP} onClick={gerarICP}>
                  {gerandoICP ? <><Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> Gerando…</> : <><Sparkles size={12} /> Gerar com IA</>}
                </button>
              </div>
              <textarea className="vx-input" style={{ minHeight: 62 }} value={campanha.publico || ""}
                onChange={(e) => set("publico", e.target.value)}
                placeholder="Ex.: Donos de restaurante com mais de 10 mesas no interior de SP." />
            </div>
          </div>
          </>
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(1)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(3)}>Continuar <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 3: CONFIGURAÇÕES DA OPERAÇÃO ═══════════════════════ */}
      {passo === 3 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 22, margin: "0 0 8px" }}>Sobre os leads</h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Defina a origem, a localização e os critérios de qualificação dos seus potenciais clientes.</p>

          {/* Mercado de atuação do cliente */}
          {secaoVisivel.mercado && (<>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Localização dos clientes</h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 12, fontSize: 13 }}>Onde estão os clientes que o profissional vai contatar?</p>
          <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                { id: "pais_todo", label: "Em todo o meu país", icon: MapPin, subtitle: "O profissional pode atuar em qualquer estado ou cidade." },
                { id: "regioes_pais", label: "Em regiões específicas", icon: Filter, subtitle: "Defina estados ou cidades onde os clientes estão." },
                { id: "outros_paises", label: "Em outros países", icon: Globe, subtitle: "Clientes fora do seu país de origem." },
                { id: "global", label: "Em qualquer lugar do mundo", icon: Globe, subtitle: "Sem restrição geográfica nenhuma." },
              ].map(({ id, label, icon: Icon, subtitle }) => (
                <CardOption key={id} selected={campanha.mercado === id} onClick={() => set("mercado", id)} icon={Icon} title={label} subtitle={subtitle} />
              ))}
            </div>
            {(campanha.mercado === "outros_paises" || campanha.mercado === "global") && (
              <div style={{ marginTop: 12 }}>
                <div className="vx-label">Países do mercado</div>
                <MultiSelect opcoes={OPC_PAISES} valor={campanha.mercadoPaises || []} onChange={(v) => set("mercadoPaises", v)} placeholder="Selecione os países" />
              </div>
            )}
          </div>
          </>)}

          {/* Origem dos leads */}
          {secaoVisivel.origemLeads && (<>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>De onde vêm os contatos?</h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 12, fontSize: 13 }}>Você fornece a lista de contatos ou o profissional busca sozinho?</p>
          <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <CardOption selected={campanha.origemLeads === "empresa"} onClick={() => { set("origemLeads", "empresa"); set("fonteLeads", "empresa"); }} icon={Database} title="Minha empresa fornecerá os leads" subtitle="Você envia a lista e o profissional trabalha só esses contatos." />
              <CardOption selected={campanha.origemLeads === "profissional"} onClick={() => { set("origemLeads", "profissional"); set("fonteLeads", "profissional"); }} icon={UserPlus} title="O profissional encontrará os leads" subtitle="Ele mesmo prospecta e cadastra novos contatos." />
              <CardOption selected={campanha.origemLeads === "ambos"} onClick={() => { set("origemLeads", "ambos"); set("fonteLeads", "ambos"); }} icon={Shuffle} title="Ambas as opções" subtitle="Você fornece contatos e o profissional também pode buscar mais." />
            </div>
          </div>
          </>)}

          {/* Fontes de contatos + Distribuição */}
          {secaoVisivel.origemLeads && (campanha.origemLeads === "empresa" || campanha.origemLeads === "ambos") && (<>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Contatos e distribuição</h2>
          {true && (
            <div className="vx-card" style={{ padding: 18, marginTop: 10 }}>
              <FontesContatosSelector campanha={campanha} set={set} />
              <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!campanha.incluirNovosAutomaticamente} onChange={(e) => set("incluirNovosAutomaticamente", e.target.checked)} style={{ accentColor: "var(--brand)" }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Incluir novos contatos automaticamente</span>
                </label>
                <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4, paddingLeft: 26 }}>
                  {campanha.incluirNovosAutomaticamente
                    ? "Novos leads recebidos pelas fontes selecionadas entrarão automaticamente na campanha enquanto ela estiver ativa."
                    : "Somente os contatos selecionados manualmente farão parte da campanha."}
                </div>
              </div>
              {!campanha.incluirNovosAutomaticamente && (campanha.leadsSelecionados || []).length === 0 && (campanha.listasSelecionadas || []).length === 0 && !campanha.planilhaUrl && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--amber-50, #FFFBEB)", borderRadius: 8, border: "1px solid var(--amber-200, #FDE68A)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <AlertCircle size={14} color="var(--amber, #F59E0B)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: "var(--amber-700, #92400E)" }}>Selecione ao menos uma fonte de contatos ou ative a inclusão automática para poder publicar esta campanha.</span>
                </div>
              )}
            </div>
          )}

          {/* Distribuição de contatos — card separado */}
          {secaoVisivel.origemLeads && (campanha.origemLeads === "empresa" || campanha.origemLeads === "ambos") && (
            <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ marginBottom: 12 }}>
                <b style={{ color: "var(--brand)" }}>Como dividir os contatos entre os profissionais?</b><Tag obrigatorio={false} />
                <div className="vx-mut" style={{ fontSize: 11.5 }}>Defina como os contatos serão distribuídos para a equipe.</div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <CardOption
                  selected={!campanha.distribuicaoLeads || campanha.distribuicaoLeads === "automatica"}
                  onClick={() => { set("distribuicaoLeads", "automatica"); set("limiteLeadsSimultaneos", 0); set("limiteLeadsDia", 0); set("prazoContatoHoras", 0); set("prazoInatividadeHoras", 0); }}
                  icon={Zap}
                  title="Distribuição inteligente"
                  subtitle="A RYCS organiza a fila e distribui os contatos conforme a capacidade da equipe."
                />
                <CardOption
                  selected={campanha.distribuicaoLeads === "manual"}
                  onClick={() => set("distribuicaoLeads", "manual")}
                  icon={SlidersHorizontal}
                  title="Distribuição personalizada"
                  subtitle="Você define os limites e prazos de atendimento."
                />
              </div>
              {(!campanha.distribuicaoLeads || campanha.distribuicaoLeads === "automatica") && (
                <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={14} color="var(--green, #16A34A)" style={{ flexShrink: 0 }} />
                  <span className="vx-mut" style={{ fontSize: 12, lineHeight: 1.4 }}>A RYCS distribui os contatos automaticamente de forma equilibrada: até 5 simultâneos, 10 por dia, com prazo de 4h para primeiro contato e 48h de inatividade.</span>
                </div>
              )}
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
            </div>
          )}
          </>)}

          {/* Canais */}
          {secaoVisivel.canais && (() => {
            const canaisSel = campanha.canais || [];
            const toggleCanal = (id) => {
              const novos = canaisSel.includes(id) ? canaisSel.filter((x) => x !== id) : [...canaisSel, id];
              set("canais", novos);
            };
            const isPresencialOuHibrido = campanha.modeloTrabalho === "presencial" || campanha.modeloTrabalho === "hibrido";
            const CARDS_CANAL = [
              { id: "whatsapp",  Icon: MessageCircle, color: "#25D366", titulo: "WhatsApp",           descricao: "Prospecção, atendimento e acompanhamento.",     ferramenta: "WhatsApp da RYCS" },
              { id: "ligacao",   Icon: Phone,         color: "#3B82F6", titulo: "Ligação telefônica", descricao: "Abordagens comerciais por telefone.",           ferramenta: "Discadora da RYCS" },
              { id: "email",     Icon: Mail,          color: "#6366F1", titulo: "E-mail",             descricao: "Apresentações, propostas e follow-ups.",        ferramenta: null },
              { id: "linkedin",  Icon: Linkedin,      color: "#0077B5", titulo: "LinkedIn",           descricao: "Prospecção e contato com decisores.",           ferramenta: null },
              { id: "instagram", Icon: Instagram,     color: "#E1306C", titulo: "Instagram",          descricao: "Abordagem pelas redes sociais.",                ferramenta: null },
              ...(isPresencialOuHibrido ? [{ id: "presencial", Icon: MapPin, color: "#F59E0B", titulo: "Visita presencial", descricao: "Prospecção diretamente no local.", ferramenta: null }] : []),
              { id: "outro",     Icon: Globe,         color: "#8B5CF6", titulo: "Outros canais",      descricao: "Telegram, SMS ou outro meio de comunicação.",   ferramenta: null },
            ];
            const totalSel = canaisSel.length;
            return (<>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Canais de comunicação</h2>
              <p className="vx-mut" style={{ marginTop: 0, marginBottom: 12, fontSize: 13 }}>Por onde o profissional entrará em contato com os clientes?</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                {CARDS_CANAL.map(({ id, Icon, color, titulo, descricao, ferramenta }) => {
                  const sel = canaisSel.includes(id);
                  const bgIcon = color.startsWith("#") ? `${color}1a` : "var(--brand-50)";
                  return (
                    <button key={id} type="button" onClick={() => toggleCanal(id)} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "11px 13px",
                      border: `1.5px solid ${sel ? "var(--brand)" : "var(--border)"}`,
                      background: sel ? "var(--brand-50)" : "var(--surface)",
                      borderRadius: 11, cursor: "pointer", textAlign: "left",
                      transition: "border-color .15s, background .15s", width: "100%",
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: bgIcon, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={17} color={color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>{titulo}</div>
                        <div className="vx-mut" style={{ fontSize: 11.5, lineHeight: 1.4, marginTop: 1 }}>{descricao}</div>
                        {ferramenta && (
                          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 600, color: "var(--brand)", marginTop: 3 }}>
                            <Zap size={9} />{ferramenta}
                          </div>
                        )}
                      </div>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${sel ? "var(--brand)" : "var(--border)"}`, background: sel ? "var(--brand)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background .15s, border-color .15s" }}>
                        {sel && <Check size={10} color="#fff" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {canaisSel.includes("outro") && (
                <div style={{ marginTop: 8 }}>
                  <input className="vx-input" placeholder="Descreva os canais utilizados (ex.: Telegram, SMS, etc.)"
                    value={campanha.outrosCanaisDescricao || ""}
                    onChange={(e) => set("outrosCanaisDescricao", e.target.value)} />
                </div>
              )}
              {/* Rodapé: info + contador */}
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div ref={popoverFerrRef} style={{ position: "relative", display: "inline-block" }}>
                  <button type="button" onClick={() => setPopoverFerr((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: "4px 0", color: "var(--muted)" }}>
                    <Info size={13} />
                    <span style={{ fontSize: 12 }}>Ferramentas de trabalho</span>
                  </button>
                  {popoverFerr && (
                    <div style={{ position: "absolute", left: 0, bottom: "calc(100% + 6px)", zIndex: 100, width: 280, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 13px", boxShadow: "0 4px 16px rgba(0,0,0,.12)", fontSize: 12, lineHeight: 1.5, color: "var(--muted)" }}>
                      Os canais selecionados orientam o ambiente de trabalho do profissional e os métodos de comprovação. As ferramentas integradas da RYCS são exibidas apenas quando há integração ativa na conta.
                    </div>
                  )}
                </div>
                {totalSel > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)" }}>
                    {totalSel} canal{totalSel > 1 ? "is" : ""} selecionado{totalSel > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </>);
          })()}

          {/* Materiais e treinamento (unificado) */}
          {secaoVisivel.materiais && (<>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Materiais e treinamento</h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 12, fontSize: 13 }}>Adicione arquivos, treinamentos e conteúdos que vão ajudar o profissional.</p>
          <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {/* Enviar arquivos */}
              <div
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--brand)"; }}
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
                      {arq.status === "enviando" && <div style={{ height: 3, borderRadius: 2, background: "var(--border)", marginTop: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${uploadProgresso[arq.id] || 0}%`, background: "var(--brand)", borderRadius: 2, transition: "width .2s" }} /></div>}
                    </div>
                    {arq.status !== "enviando" && (
                      <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setUploadQueue((prev) => prev.filter((a) => a.id !== arq.id))} style={{ padding: 2 }}><X size={14} /></button>
                    )}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="vx-btn vx-btn-primary vx-btn-sm" disabled={enviandoMateriais || uploadQueue.every((a) => a.status === "ok")} style={{ background: "var(--brand)", borderColor: "var(--brand)" }}
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
                          <span style={{ color: "var(--brand)" }}>{mat.origem === "upload" ? "Enviado" : "Biblioteca"}</span>
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
                <div style={{ fontSize: 13, fontWeight: 600 }}>Exigir treinamento antes de começar o trabalho</div>
                <div className="vx-mut" style={{ fontSize: 11.5, lineHeight: 1.5 }}>O treinamento é liberado após a aprovação da candidatura, mas contatos e atividades remuneradas ficam bloqueados até a conclusão dos treinamentos obrigatórios.</div>
              </div>
            </label>
          </div>
          </>)}

          {/* Modal Criar com IA — sempre montado para não perder estado */}
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
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${modeloTreinamento === k ? "var(--brand)" : "var(--border)"}`, background: modeloTreinamento === k ? "var(--brand)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
                  <button className="vx-btn vx-btn-sm vx-btn-primary" disabled={gerandoTreinamento} style={{ background: "var(--brand)", borderColor: "var(--brand)" }}
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
                              <div style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${sel ? "var(--brand)" : "var(--border)"}`, background: sel ? "var(--brand)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {sel && <Check size={12} color="#fff" />}
                              </div>
                              <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <IconeMat size={16} color={sel ? "var(--brand)" : "var(--muted)"} />
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
                    <button className="vx-btn vx-btn-sm vx-btn-primary" disabled={!bibliotecaSel.length} style={{ background: "var(--brand)", borderColor: "var(--brand)" }}
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



          {/* Perguntas de qualificação */}
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Qualificação de leads</h2>
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
  
                <div className="vx-mut" style={{ fontSize: 11.5 }}>Perguntas que o profissional faz ao contato para qualificá-lo.</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="vx-btn vx-btn-sm" style={{ minHeight: 36, fontSize: 12 }} onClick={() => {
                  const novas = [...(campanha.perguntasQualificacao || []), criarPergunta({ ordem: (campanha.perguntasQualificacao || []).length + 1 })];
                  set("perguntasQualificacao", novas);
                }}><Plus size={13} /> Pergunta</button>
                {rascunhoId && <button className="vx-btn vx-btn-sm" style={{ minHeight: 36, fontSize: 12, background: "var(--brand-50)", color: "var(--brand)", border: "1px solid var(--brand-100)" }} onClick={async () => {
                  const r = await api(`/campaigns/${rascunhoId}/gerar-qualificacao`, {});
                  if (r && !r.error) {
                    set("perguntasQualificacao", r.perguntas);
                    set("criteriosQualificacaoLeads", r.criterios);
                  }
                }}><Sparkles size={13} /> Sugerir com IA</button>}
              </div>
            </div>
            {(campanha.perguntasQualificacao || []).length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                {(campanha.perguntasQualificacao || []).map((p, idx) => (
                  <div key={p.id} style={{ padding: "12px 14px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span className="vx-mut" style={{ fontSize: 11, minWidth: 20, paddingTop: 8 }}>{idx + 1}.</span>
                      <div style={{ flex: 1 }}>
                        <input className="vx-input" style={{ marginBottom: 6, fontSize: 13 }} value={p.texto} placeholder="Texto da pergunta"
                          onChange={(e) => { const novas = [...(campanha.perguntasQualificacao || [])]; novas[idx] = { ...p, texto: e.target.value }; set("perguntasQualificacao", novas); }} />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <select className="vx-input" style={{ flex: 1, minWidth: 120, fontSize: 12 }} value={p.tipo}
                            onChange={(e) => { const novas = [...(campanha.perguntasQualificacao || [])]; novas[idx] = { ...p, tipo: e.target.value }; set("perguntasQualificacao", novas); }}>
                            {TIPOS_RESPOSTA.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                          </select>
                          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                            <input type="checkbox" checked={!!p.obrigatoria}
                              onChange={(e) => { const novas = [...(campanha.perguntasQualificacao || [])]; novas[idx] = { ...p, obrigatoria: e.target.checked }; set("perguntasQualificacao", novas); }} /> Obrigatória
                          </label>
                        </div>
                        {(p.tipo === "escolha_unica" || p.tipo === "multipla_escolha") && (
                          <input className="vx-input" style={{ marginTop: 6, fontSize: 12 }} value={(p.opcoes || []).join(", ")} placeholder="Opções separadas por vírgula"
                            onChange={(e) => { const novas = [...(campanha.perguntasQualificacao || [])]; novas[idx] = { ...p, opcoes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }; set("perguntasQualificacao", novas); }} />
                        )}
                      </div>
                      <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--danger, #dc2626)" }}
                        onClick={() => { const novas = (campanha.perguntasQualificacao || []).filter((_, i) => i !== idx); set("perguntasQualificacao", novas); }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!(campanha.perguntasQualificacao || []).length && (
              <div className="vx-mut" style={{ fontSize: 12, textAlign: "center", padding: "16px 0" }}>
                Nenhuma pergunta configurada. Clique em "Sugerir com IA" para gerar automaticamente ou adicione manualmente.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(2)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(4)}>Confirmação <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 4: CONFIRMAÇÃO DE CONTATO ═══════════════════════ */}
      {passo === 4 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 22, margin: "0 0 8px" }}>Confirmação de contato</h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Defina como a RYCS deverá comprovar que o profissional realmente conversou com seu cliente.</p>

          {/* Confirmação de contato */}
          {(() => {
            const canaisAtivos = (campanha.confirmacaoContato || {}).canais || [];
            const habilitada = !!(campanha.confirmacaoContato || {}).habilitada;
            const isRycs = !habilitada;
            const toggleCanal = (id) => {
              if (id === "rycs") {
                set("confirmacaoContato", { ...(campanha.confirmacaoContato || configConfirmacaoPadrao()), habilitada: false, canais: [] });
                return;
              }
              const novos = canaisAtivos.includes(id) ? canaisAtivos.filter((x) => x !== id) : [...canaisAtivos.filter((x) => x !== "rycs"), id];
              set("confirmacaoContato", { ...(campanha.confirmacaoContato || configConfirmacaoPadrao()), habilitada: novos.length > 0, canais: novos });
            };
            const CARDS_CONFIRMACAO = [
              {
                id: "whatsapp",
                Icon: MessageCircle,
                iconColor: "#25D366",
                titulo: "Confirmação por WhatsApp",
                descricao: "Após o atendimento, o cliente recebe uma mensagem identificando sua empresa e o profissional responsável, com um link exclusivo para confirmar a conversa.",
                criterios: ["Número vinculado ao contato.", "Confirmação expressa do cliente.", "Validade e uso único do link."],
                rodape: "A atividade permanece pendente até receber uma confirmação válida e cumprir as demais regras de comprovação.",
                disabled: false,
              },
              {
                id: "email",
                Icon: Mail,
                iconColor: "var(--brand)",
                titulo: "Confirmação por e-mail",
                descricao: "O cliente recebe um e-mail identificando a empresa, o profissional e o assunto comercial abordado, podendo reconhecer ou negar o atendimento.",
                criterios: ["E-mail vinculado ao contato.", "Resposta registrada pelo cliente.", "Validade e uso único do link."],
                rodape: "Se o cliente não reconhecer o atendimento, a atividade não será aprovada automaticamente.",
                disabled: false,
              },
              {
                id: "sms",
                Icon: Phone,
                iconColor: "var(--muted)",
                titulo: "Confirmação por SMS",
                descricao: "O cliente recebe uma mensagem de texto com um link seguro para confirmar o atendimento, sem precisar instalar aplicativos.",
                criterios: ["Telefone vinculado ao contato.", "Confirmação expressa do cliente.", "Validade e uso único do link."],
                rodape: "A confirmação será registrada no histórico da atividade.",
                disabled: true,
                badge: "Indisponível no momento",
              },
              {
                id: "rycs",
                Icon: ShieldCheck,
                iconColor: "var(--brand)",
                titulo: "Verificação pela RYCS",
                descricao: "Não exige uma ação adicional do cliente. A comprovação acontece por meio dos registros e evidências da atividade realizada pelo profissional.",
                criterios: ["Histórico de conversas ou ligações.", "Evidências obrigatórias da atividade.", "Inconsistências e duplicidades."],
                rodape: "Atividades com evidências insuficientes ou suspeitas serão encaminhadas para revisão.",
                disabled: false,
              },
            ];
            const isSelected = (id) => id === "rycs" ? isRycs : canaisAtivos.includes(id);
            return (<>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Confirmação de contato</h2>
              <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Defina como a RYCS deverá comprovar que o profissional realmente conversou com seu cliente.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 0 }}>
                {CARDS_CONFIRMACAO.map(({ id, Icon, iconColor, titulo, descricao, criterios, rodape, disabled, badge }) => {
                  const sel = isSelected(id);
                  return (
                    <button key={id} type="button" disabled={disabled} onClick={() => !disabled && toggleCanal(id)} style={{
                      position: "relative", textAlign: "left", padding: "16px", cursor: disabled ? "not-allowed" : "pointer",
                      border: `1.5px solid ${sel ? "var(--brand)" : "var(--border)"}`,
                      background: sel ? "var(--brand-50, #EFF6FF)" : "var(--surface)",
                      borderRadius: 12, opacity: disabled ? 0.6 : 1,
                      transition: "border-color .15s, background .15s",
                      display: "flex", flexDirection: "column", gap: 0,
                    }}>
                      {sel && (
                        <div style={{ position: "absolute", top: 12, right: 12, width: 20, height: 20, borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Check size={12} color="#fff" />
                        </div>
                      )}
                      <Icon size={24} color={disabled ? "var(--muted)" : iconColor} style={{ marginBottom: 10 }} />
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink, #171717)", marginBottom: badge ? 4 : 8 }}>{titulo}</div>
                      {badge && <div style={{ fontSize: 11, fontWeight: 600, color: "var(--amber, #F59E0B)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{badge}</div>}
                      <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>{descricao}</div>
                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: "auto" }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>O que será verificado</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {criterios.map((c) => (
                            <div key={c} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "var(--text-2)" }}>
                              <Check size={12} color="var(--brand)" style={{ marginTop: 1, flexShrink: 0 }} />
                              <span>{c}</span>
                            </div>
                          ))}
                        </div>
                        <div className="vx-mut" style={{ fontSize: 11, lineHeight: 1.4, marginTop: 8 }}>{rodape}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--brand-50, #EFF6FF)", borderRadius: 10, border: "1px solid var(--brand-100, #BFDBFE)", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <ShieldCheck size={16} color="var(--brand)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", marginBottom: 2 }}>Proteção contra fraudes</div>
                  <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.5 }}>Nenhuma confirmação isolada garante a liberação do pagamento. A RYCS cruza as evidências com as regras da campanha antes de aprovar a atividade.</div>
                </div>
              </div>
            </>);
          })()}

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(3)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(5)}>Profissionais <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 5: PERFIL PROFISSIONAL ═══════════════════════ */}
      {passo === 5 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 22, margin: "0 0 8px" }}>Sobre os profissionais</h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Defina o perfil, as responsabilidades e a rotina comercial de cada profissional.</p>

          {campanha.estruturaComercial === "operacao" ? (<>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Profissionais que vão trabalhar <Tag obrigatorio={true} /></h2>
            <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Selecione todas as funções que a equipe precisa. Cada uma vira uma campanha ligada às outras.</p>
            <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {ORDEM_FUNCOES.filter((f) => f !== "sem-exp").map((k) => {
                  const f = FUNCOES[k];
                  const IconFuncao = { sdr: CalendarCheck, bdr: Target, closer: BadgeDollarSign, pap: Footprints }[k] || Users;
                  const nomeAmigavel = { sdr: "Qualificar e agendar reuniões", bdr: "Encontrar novos clientes", closer: "Negociar e fechar vendas", pap: "Visitar clientes presencialmente" }[k] || f.completo;
                  const funcoesOp = campanha.funcoesOperacao || [];
                  const ativa = funcoesOp.includes(k);
                  return (
                    <button key={k} type="button" onClick={() => {
                      const novas = ativa ? funcoesOp.filter((x) => x !== k) : [...funcoesOp, k];
                      set("funcoesOperacao", novas);
                      if (!ativa && !campanha[`config_${k}`]) {
                        set(`config_${k}`, { funcao: k, vagas: 0, nivelExperiencia: "", processoAdmissao: "manual", acoesAtivas: [], tarefas: {}, remuneracaoCumulativa: true, prazoHoras: 24, limitePorProfissional: 10, orcamento: 0 });
                      }
                    }} style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, padding: "14px 14px", width: "100%", textAlign: "left", cursor: "pointer",
                      border: `1px solid ${ativa ? SEL.border : SEL.borderOff}`,
                      background: ativa ? SEL.bg : SEL.bgOff,
                      borderRadius: 10, transition: "border-color .15s, background .15s", position: "relative",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: ativa ? "var(--brand)" : "var(--brand-50)", border: ativa ? "none" : "1px solid var(--brand-100)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <IconFuncao size={18} color={ativa ? "#fff" : "var(--brand)"} />
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: ativa ? "var(--brand)" : "var(--text)", letterSpacing: 0.2 }}>{f.nome}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: ativa ? "var(--brand)" : "var(--text)" }}>{nomeAmigavel}</div>
                        <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 3 }}>{f.descricao}</div>
                      </div>
                      {ativa && <div style={{ position: "absolute", top: 10, right: 10, width: 18, height: 18, borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={11} color="#fff" /></div>}
                    </button>
                  );
                })}
              </div>
              {(campanha.funcoesOperacao || []).length >= 2 && (
                <div style={{ marginTop: 16 }}>
                  <div className="vx-label" style={{ marginBottom: 8 }}>Ordem das funções na operação <Tag obrigatorio={false} /></div>
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
                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  {(campanha.funcoesOperacao || []).map((k) => {
                    const f = FUNCOES[k];
                    const IconFuncao = { sdr: CalendarCheck, bdr: Target, closer: BadgeDollarSign, pap: Footprints }[k] || Users;
                    const nomeAmigavel = { sdr: "Qualificar e agendar reuniões", bdr: "Encontrar novos clientes", closer: "Negociar e fechar vendas", pap: "Visitar clientes presencialmente" }[k] || f?.completo;
                    const cfg = campanha[`config_${k}`] || {};
                    const setConfig = (campo, valor) => set(`config_${k}`, { ...(campanha[`config_${k}`] || {}), [campo]: valor });
                    const expandido = campanha.abaFuncaoAtiva === k;
                    const origemLabel = { rycs: "RYCS", interno: "Minha equipe", ambos: "Ambos" }[cfg.origemProfissionais] || "RYCS";
                    const expLabel = NIVEIS_EXPERIENCIA.find((n) => n.id === (cfg.nivelExperiencia || "indiferente"))?.label || "Indiferente";
                    const aprovLabel = PROCESSOS_ADMISSAO.find((p) => p.id === (cfg.processoAdmissao || "manual"))?.label || "Manual";
                    return (
                      <div key={k} style={{ border: `1px solid ${expandido ? "var(--brand)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden", background: "var(--surface)", transition: "border-color .15s" }}>
                        {/* cabeçalho */}
                        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, background: "var(--brand-50)" }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <IconFuncao size={20} color="#fff" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--brand)" }}>{f?.nome || k}</div>
                            <div style={{ fontSize: 12, color: "var(--brand)", opacity: 0.75 }}>{nomeAmigavel}</div>
                          </div>
                          <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" style={{ padding: 6 }} onClick={() => set("abaFuncaoAtiva", expandido ? null : k)}>
                            <Pencil size={15} color="var(--brand)" />
                          </button>
                        </div>
                        {/* resumo (recolhido) */}
                        {!expandido && (<>
                          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                            <div><div className="vx-mut" style={{ fontSize: 11 }}>Origem</div><div style={{ fontWeight: 600, fontSize: 13 }}>{origemLabel}</div></div>
                            <div><div className="vx-mut" style={{ fontSize: 11 }}>Experiência</div><div style={{ fontWeight: 600, fontSize: 13 }}>{expLabel}</div></div>
                            <div><div className="vx-mut" style={{ fontSize: 11 }}>Aprovação</div><div style={{ fontWeight: 600, fontSize: 13 }}>{aprovLabel}</div></div>
                          </div>
                          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
                            <button type="button" className="vx-btn vx-btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => set("abaFuncaoAtiva", k)}>
                              Personalizar profissional
                            </button>
                          </div>
                        </>)}
                        {/* formulário expandido */}
                        {expandido && (
                          <div style={{ padding: 16, borderTop: "1px solid var(--border)", display: "grid", gap: 14 }}>
                            {/* Origem */}
                            <div>
                              <div className="vx-label" style={{ marginBottom: 6 }}>Origem dos profissionais <Tag obrigatorio={true} /></div>
                              <SelectDropdown
                                value={cfg.origemProfissionais || "rycs"}
                                onChange={(v) => setConfig("origemProfissionais", v)}
                                options={Object.values(ORIGENS_PROFISSIONAIS).map((o) => ({ value: o.id, label: o.label }))}
                              />
                              {(cfg.origemProfissionais === "interno" || cfg.origemProfissionais === "ambos") && (
                                <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 8, padding: "8px 10px", background: "var(--brand-50)", borderRadius: 8, border: "1px solid var(--brand-100)" }}>
                                  Os colaboradores da sua empresa podem ser selecionados em <b>Gestão interna → Meu time</b> após a publicação.
                                </div>
                              )}
                            </div>
                            {/* Experiência */}
                            <div>
                              <div className="vx-label" style={{ marginBottom: 6 }}>Experiência <Tag obrigatorio={false} /></div>
                              <SelectDropdown
                                value={cfg.nivelExperiencia || "indiferente"}
                                onChange={(v) => setConfig("nivelExperiencia", v)}
                                options={NIVEIS_EXPERIENCIA.map((n) => ({ value: n.id, label: n.label }))}
                              />
                            </div>
                            {/* Aprovação — oculta se só equipe interna */}
                            {cfg.origemProfissionais !== "interno" && (
                              <div>
                                <div className="vx-label" style={{ marginBottom: 6 }}>Aprovação da candidatura <Tag obrigatorio={false} /></div>
                                <SelectDropdown
                                  value={cfg.processoAdmissao || "manual"}
                                  onChange={(v) => setConfig("processoAdmissao", v)}
                                  options={PROCESSOS_ADMISSAO.map((p) => ({ value: p.id, label: p.label }))}
                                />
                              </div>
                            )}
                            <button type="button" className="vx-btn vx-btn-brand" style={{ justifyContent: "center" }} onClick={() => set("abaFuncaoAtiva", null)}>
                              Concluir configuração
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                    {(campanha.funcoesOperacao || []).includes("sdr") && (campanha.funcoesOperacao || []).includes("closer") && (<>
                      <li>O SDR qualifica contatos e agenda reuniões. O Closer recebe a reunião e conduz a negociação até o fechamento.</li>
                      <li>O SDR visualiza automaticamente os horários disponíveis dos Closers — sem necessidade de consultar individualmente cada um.</li>
                      <li>As reuniões são distribuídas entre os Closers elegíveis de forma equilibrada, priorizando quem tem menor carga.</li>
                    </>)}
                    <li>Cada profissional é pago individualmente pelo que fizer.</li>
                    <li>Ao publicar, serão criadas {(campanha.funcoesOperacao || []).length} campanhas conectadas dentro da operação.</li>
                  </ul>
                </div>
              )}
            </div>
          </>) : campanha.estruturaComercial === "vinculada" ? (
            <>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Campanha de origem <Tag obrigatorio={false} /></h2>
            <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Selecione a campanha da qual esta vai receber contatos.</p>
            <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
              {carregandoCampanhas ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}><Loader size={14} style={{ animation: "spin 1s linear infinite" }} /><span className="vx-mut" style={{ fontSize: 13 }}>Carregando campanhas…</span></div>
              ) : campanhasDisponiveis.length === 0 ? (
                <div className="vx-mut" style={{ fontSize: 13, padding: "10px 0" }}>Nenhuma campanha disponível para vincular.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {campanhasDisponiveis.map((c) => (
                    <CardOption key={c.id} selected={campanha.campanhaVinculadaId === c.id} onClick={() => set("campanhaVinculadaId", c.id)}
                      title={c.titulo || "(sem título)"}
                      subtitle={`${c.funcao || c.objetivo || ""} · ${c.status || ""}`} />
                  ))}
                </div>
              )}
            </div>
            </>) : (<>
          {/* Função comercial */}
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Função comercial <Tag obrigatorio={true} /></h2>
          <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
            <div style={{ display: "grid", gap: 8 }}>
              {ORDEM_FUNCOES.filter((f) => f !== "sem-exp").map((k) => {
                const f = FUNCOES[k];
                const nomeAmigavel = { sdr: "Qualificar contatos e agendar reuniões", bdr: "Encontrar novos clientes", closer: "Negociar e fechar vendas", pap: "Visitar clientes presencialmente" }[k] || f.completo;
                return <CardOption key={k} selected={campanha.funcao === k} onClick={() => set("funcao", k)} title={`${nomeAmigavel} (${f.nome})`} subtitle={f.descricao} />;
              })}
            </div>
          </div>

          {/* Nível de experiência */}
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Nível de experiência <Tag obrigatorio={false} /></h2>
          <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
            <div style={{ display: "grid", gap: 8 }}>
              {NIVEIS_EXPERIENCIA.map((n) => (
                <CardOption key={n.id} selected={campanha.nivelExperiencia === n.id} onClick={() => set("nivelExperiencia", n.id)} title={n.label} subtitle={n.descricao} />
              ))}
            </div>
          </div>

          {/* Aprovação da candidatura */}
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Aprovação da candidatura <Tag obrigatorio={false} /></h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Controla como os profissionais entram na campanha, não a aprovação das atividades.</p>
          <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
            <div style={{ display: "grid", gap: 8 }}>
              {PROCESSOS_ADMISSAO.map((p) => (
                <CardOption key={p.id} selected={campanha.processoAdmissao === p.id} onClick={() => set("processoAdmissao", p.id)} title={p.label} subtitle={p.descricao} />
              ))}
            </div>
          </div>

          </>)}

          {/* Modelo de trabalho + localização do profissional (unificado) */}
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Modelo de trabalho <Tag obrigatorio={true} /></h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Ele trabalha de casa, na rua ou mistura os dois?</p>
          <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
            <div style={{ display: "grid", gap: 8 }}>
              {Object.values(MODELOS_TRABALHO).map((m) => {
                const Ic = ICONES_MODELO[m.id] || Globe;
                return <CardOption key={m.id} selected={campanha.modeloTrabalho === m.id} onClick={() => set("modeloTrabalho", m.id)} icon={Ic} title={m.nome} subtitle={m.descricao} />;
              })}
            </div>

            {/* Remoto: opção de restringir localização */}
            {campanha.modeloTrabalho === "remoto" && (
              <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={!!campanha.restricaoGeo && campanha.restricaoGeo !== "nenhuma"}
                    onChange={(e) => set("restricaoGeo", e.target.checked ? "regioes" : "nenhuma")}
                    style={{ width: 16, height: 16, accentColor: "var(--brand)", flexShrink: 0 }}
                  />
                  <span style={{ fontWeight: 500, fontSize: 14 }}>Restringir a localização dos profissionais</span>
                </label>
                {(!campanha.restricaoGeo || campanha.restricaoGeo === "nenhuma") ? (
                  <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 6, marginLeft: 26 }}>Profissionais de qualquer localização podem participar.</div>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      {Object.values(RESTRICOES_GEO).filter((r) => r.id !== "nenhuma").map((r) => (
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
              </div>
            )}

            {/* Presencial/Híbrido: território obrigatório */}
            {(campanha.modeloTrabalho === "presencial" || campanha.modeloTrabalho === "hibrido") && (
              <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <div style={{ marginBottom: 10 }}>
                  <b style={{ color: "var(--brand)", fontSize: 13 }}>Território de atuação</b><Tag obrigatorio={true} />
                  <div className="vx-mut" style={{ fontSize: 11.5 }}>Em qual cidade ou região o profissional vai trabalhar presencialmente?</div>
                </div>
                <div className="vx-grid vx-g2">
                  <label><div className="vx-label">Região</div>
                    <input className="vx-input" value={campanha.regiao} onChange={(e) => set("regiao", e.target.value)} placeholder="Ex.: interior de SP" /></label>
                </div>
                <CidadeEstadoSelector estado={campanha.estado || ""} cidade={campanha.cidade || ""} onEstado={(v) => set("estado", v)} onCidade={(v) => set("cidade", v)} />
              </div>
            )}
          </div>

          {/* Visibilidade */}
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Visibilidade <Tag obrigatorio={false} /></h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Quem pode se candidatar a esta campanha?</p>
          <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
            <div style={{ display: "grid", gap: 8 }}>
                <CardOption selected={campanha.visibilidade === "publica"} onClick={() => set("visibilidade", "publica")} icon={Eye} title="Qualquer profissional" subtitle="Qualquer profissional que se encaixe no perfil pode se candidatar." />
                <CardOption selected={campanha.visibilidade === "privada"} onClick={() => set("visibilidade", "privada")} icon={EyeOff} title="Só convidados" subtitle="Apenas profissionais que você convidar poderão se candidatar." />
                <CardOption selected={campanha.visibilidade === "oculta"} onClick={() => set("visibilidade", "oculta")} icon={Lock} title="Oculta" subtitle="Não aparece em buscas. Só entra quem tiver o link." />
            </div>
          </div>

          {/* ── Monte a rotina comercial ── */}
          {campanha.estruturaComercial !== "vinculada" && (() => {
            const funcoesParaRotina = campanha.estruturaComercial === "operacao"
              ? (campanha.funcoesOperacao || [])
              : campanha.funcao ? [campanha.funcao] : [];
            if (funcoesParaRotina.length === 0) return null;
            const funcaoAtiva = campanha.abaRotinaAtiva || funcoesParaRotina[0];
            const isOp = campanha.estruturaComercial === "operacao";
            const getMode = (k) => isOp ? (campanha[`config_${k}`]?.modoAtividades) : campanha.modoAcoesRemuneradas;
            const setMode = (k, v) => isOp ? set(`config_${k}`, { ...(campanha[`config_${k}`] || {}), modoAtividades: v }) : set("modoAcoesRemuneradas", v);
            const getAtivs = (k) => isOp ? (campanha[`config_${k}`]?.acoesAtivas || []) : (campanha.acoesAtivas || []);
            const setAtivs = (k, novas) => isOp ? set(`config_${k}`, { ...(campanha[`config_${k}`] || {}), acoesAtivas: novas }) : set("acoesAtivas", novas);
            const toggleAtiv = (k, id) => { const a = getAtivs(k); setAtivs(k, a.includes(id) ? a.filter(x => x !== id) : [...a, id]); };
            const getNomes = (k) => isOp ? (campanha[`config_${k}`]?.nomesPersonalizados || {}) : (campanha.nomesPersonalizados || {});
            const setNomes = (k, v) => isOp ? set(`config_${k}`, { ...(campanha[`config_${k}`] || {}), nomesPersonalizados: v }) : set("nomesPersonalizados", v);
            const mode = getMode(funcaoAtiva);
            const ativs = getAtivs(funcaoAtiva);
            const listaRapida = SELECAO_RAPIDA[funcaoAtiva] || [];
            return (
              <div className="vx-card" style={{ padding: 18, marginTop: 20 }}>
                <div style={{ marginBottom: 14 }}>
                  <b style={{ color: "var(--brand)" }}>Monte a rotina comercial</b><Tag obrigatorio={false} />
                  <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4 }}>Defina o que cada profissional fará na sua campanha.</div>
                </div>
                {/* Abas por função */}
                {funcoesParaRotina.length > 1 && (
                  <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", marginBottom: 14 }}>
                    {funcoesParaRotina.map((k) => {
                      const f = FUNCOES[k]; const ativa = funcaoAtiva === k;
                      return (
                        <button key={k} onClick={() => set("abaRotinaAtiva", k)} style={{
                          padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                          color: ativa ? "#fff" : "var(--muted)", background: ativa ? "var(--brand)" : "transparent",
                          borderRadius: "8px 8px 0 0", border: "none",
                          marginBottom: -2, borderBottomWidth: 2, borderBottomStyle: "solid",
                          borderBottomColor: ativa ? "var(--brand)" : "transparent",
                        }}>{f?.nome || k}</button>
                      );
                    })}
                  </div>
                )}
                {/* Cards de modo */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: mode ? 16 : 0 }}>
                  {[
                    { id: "rapido", Icon: Zap, titulo: "Seleção rápida", desc: "Atividades recomendadas para esta função." },
                    { id: "personalizado", Icon: SlidersHorizontal, titulo: "Personalizado", desc: "Monte sua própria rotina comercial." },
                  ].map(({ id, Icon, titulo, desc }) => {
                    const sel = mode === id;
                    return (
                      <button key={id} type="button" onClick={() => setMode(funcaoAtiva, id)} style={{
                        display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 10, cursor: "pointer", textAlign: "left", position: "relative",
                        border: `1.5px solid ${sel ? "var(--brand)" : "var(--border)"}`,
                        background: sel ? "var(--brand-50)" : "var(--surface)", transition: "border-color .15s, background .15s",
                      }}>
                        {sel && <div style={{ position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={10} color="#fff" /></div>}
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: sel ? "var(--brand)" : "var(--brand-50)", border: sel ? "none" : "1px solid var(--brand-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={18} color={sel ? "#fff" : "var(--brand)"} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: sel ? "var(--brand)" : "var(--ink)" }}>{titulo}</div>
                        <div className="vx-mut" style={{ fontSize: 12, lineHeight: 1.5 }}>{desc}</div>
                      </button>
                    );
                  })}
                </div>
                {/* Seleção rápida — jornada vertical */}
                {mode === "rapido" && listaRapida.length > 0 && (
                  <div>
                    {listaRapida.map((a, idx) => {
                      const ativa = ativs.includes(a.id);
                      const AcIcon = ACOES_ICON_ROTINA[a.id] || ClipboardCheck;
                      const isLast = idx === listaRapida.length - 1;
                      return (
                        <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0, paddingTop: 4 }}>
                            <div style={{ width: 26, height: 26, borderRadius: "50%", background: ativa ? "var(--brand)" : "var(--border)", color: ativa ? "#fff" : "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, zIndex: 1, flexShrink: 0 }}>
                              {String(idx + 1).padStart(2, "0")}
                            </div>
                            {!isLast && <div style={{ width: 2, flex: 1, background: "var(--border)", margin: "3px 0" }} />}
                          </div>
                          <button type="button" onClick={() => toggleAtiv(funcaoAtiva, a.id)} style={{
                            flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                            marginBottom: isLast ? 0 : 8,
                            border: `1.5px solid ${ativa ? "var(--brand)" : "var(--border)"}`,
                            background: ativa ? "var(--brand-50)" : "var(--surface)",
                            borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "border-color .15s, background .15s",
                          }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: ativa ? "var(--brand)" : "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <AcIcon size={17} color={ativa ? "#fff" : "var(--brand)"} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 600, color: ativa ? "var(--brand)" : "var(--ink)" }}>{a.nome}</div>
                              <div className="vx-mut" style={{ fontSize: 12, marginTop: 2 }}>{JORNADA_DESC[a.id] || ""}</div>
                            </div>
                            <div style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${ativa ? "var(--brand)" : "var(--border)"}`, background: ativa ? "var(--brand)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {ativa && <Check size={12} color="#fff" />}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                    <button type="button" onClick={() => { setMode(funcaoAtiva, "personalizado"); const nId = `custom_${Date.now()}`; setAtivs(funcaoAtiva, [...ativs, nId]); }} style={{ marginTop: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: "1.5px dashed var(--border)", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--brand)", fontWeight: 600 }}>
                      <Plus size={15} /> Adicionar atividade personalizada
                    </button>
                  </div>
                )}
                {/* Personalizado */}
                {mode === "personalizado" && (
                  <div>
                    <div className="vx-mut" style={{ fontSize: 12, marginBottom: 8 }}>Selecione atividades para esta função:</div>
                    <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                      {listaRapida.map((a) => {
                        const ativa = ativs.includes(a.id);
                        const AcIcon = ACOES_ICON_ROTINA[a.id] || ClipboardCheck;
                        return (
                          <button key={a.id} type="button" onClick={() => toggleAtiv(funcaoAtiva, a.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1.5px solid ${ativa ? "var(--brand)" : "var(--border)"}`, background: ativa ? "var(--brand-50)" : "var(--surface)", borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
                            <AcIcon size={15} color={ativa ? "var(--brand)" : "var(--muted)"} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: ativa ? 600 : 400, color: ativa ? "var(--brand)" : "var(--text)" }}>{a.nome}</span>
                            <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${ativa ? "var(--brand)" : "var(--border)"}`, background: ativa ? "var(--brand)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {ativa && <Check size={11} color="#fff" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {ativs.filter((id) => id.startsWith("custom_")).map((id) => {
                      const nomes = getNomes(funcaoAtiva);
                      return (
                        <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--brand)", background: "var(--brand-50)", borderRadius: 8, marginBottom: 6 }}>
                          <input className="vx-input" placeholder="Nome da atividade" style={{ flex: 1, padding: "4px 8px", fontSize: 13 }}
                            value={nomes[id] || ""} onChange={(e) => setNomes(funcaoAtiva, { ...nomes, [id]: e.target.value })} />
                          <button type="button" onClick={() => setAtivs(funcaoAtiva, ativs.filter((x) => x !== id))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2 }}><Trash2 size={14} /></button>
                        </div>
                      );
                    })}
                    <button type="button" onClick={() => { const nId = `custom_${Date.now()}`; setAtivs(funcaoAtiva, [...ativs, nId]); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: "1.5px dashed var(--border)", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--brand)", fontWeight: 600 }}>
                      <Plus size={15} /> Adicionar atividade personalizada
                    </button>
                  </div>
                )}
              </div>
            );
          })()}


          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(4)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(6)}>Ações <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 6: AÇÕES & REMUNERAÇÃO ═══════════════════════ */}
      {passo === 6 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 22, margin: "0 0 8px" }}>Ações e pagamentos</h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
            {campanha.estruturaComercial === "operacao" ? "Configure as atividades, valores e aprovações para cada função da operação." : "Escolha o que o profissional faz e quanto ganha por cada resultado."}
          </p>


          {/* Remuneração por origem do lead */}
          {campanha.origemLeads === "mista" && (
            <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ marginBottom: 12 }}>
                <b style={{ color: "var(--brand)" }}><HandCoins size={15} style={{ marginRight: 6, verticalAlign: -2 }} />Remuneração por origem do lead</b><Tag obrigatorio={false} />
                <div className="vx-mut" style={{ fontSize: 11.5 }}>Leads da empresa e leads encontrados pelo profissional podem ter valores diferentes.</div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, marginBottom: 12 }}>
                <input type="checkbox" checked={!!(campanha.remuneracaoPorOrigem || {}).diferenciarPorOrigem}
                  onChange={(e) => set("remuneracaoPorOrigem", { ...(campanha.remuneracaoPorOrigem || {}), diferenciarPorOrigem: e.target.checked })} />
                <span>Diferenciar valores por origem</span>
              </label>
              {(campanha.remuneracaoPorOrigem || {}).diferenciarPorOrigem && (
                <div className="vx-grid vx-g2">
                  <label><div className="vx-label">Multiplicador — Lead da empresa</div>
                    <input className="vx-input" type="number" step="0.1" min="0" value={(campanha.remuneracaoPorOrigem || {}).fatorEmpresa || 1}
                      onChange={(e) => set("remuneracaoPorOrigem", { ...(campanha.remuneracaoPorOrigem || {}), diferenciarPorOrigem: true, fatorEmpresa: Number(e.target.value) || 1 })} />
                    <div className="vx-mut" style={{ fontSize: 11 }}>Valor padrão: 1x</div>
                  </label>
                  <label><div className="vx-label">Multiplicador — Lead do profissional</div>
                    <input className="vx-input" type="number" step="0.1" min="0" value={(campanha.remuneracaoPorOrigem || {}).fatorProfissional || 1.5}
                      onChange={(e) => set("remuneracaoPorOrigem", { ...(campanha.remuneracaoPorOrigem || {}), diferenciarPorOrigem: true, fatorProfissional: Number(e.target.value) || 1.5 })} />
                    <div className="vx-mut" style={{ fontSize: 11 }}>Valor padrão: 1.5x (paga mais porque o profissional encontrou)</div>
                  </label>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(5)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(7)}>Gestão e validação <ArrowRight size={14} /></button>
          </div>
        </>
      )}


      {/* ═══════════════════════ PASSO 7: GESTÃO E VALIDAÇÃO ═══════════════════════ */}
      {passo === 7 && campanha && (() => {
        const gestaoModo = campanha.gestaoOperacionalModo || "automatico";
        const produtosSelecionados = campanha.produtosCampanha || [];
        return (
          <>
            <h2 className="vx-disp" style={{ fontSize: 22, margin: "0 0 8px" }}>Gestão e validação</h2>
            <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Configure como a campanha será gerenciada e como os resultados serão aprovados.</p>

            {/* Gestão operacional */}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Gestão operacional</h2>
            <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Como a campanha será acompanhada e distribuída.</p>
            <div className="vx-card" style={{ padding: 22, marginTop: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: gestaoModo === "manual" ? 14 : 0 }}>
                <div onClick={() => set("gestaoOperacionalModo", "automatico")} style={{ padding: "16px 14px", borderRadius: 12, border: `1.5px solid ${gestaoModo !== "manual" ? "var(--brand)" : "var(--border)"}`, background: gestaoModo !== "manual" ? "var(--brand-50)" : "var(--surface)", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Zap size={16} color={gestaoModo !== "manual" ? "var(--brand)" : "var(--muted)"} />
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: gestaoModo !== "manual" ? "var(--brand)" : "var(--text)" }}>Automático <span style={{ fontSize: 11, fontWeight: 600 }}>(recomendado)</span></div>
                    {gestaoModo !== "manual" && <Check size={14} color="var(--brand)" style={{ marginLeft: "auto" }} />}
                  </div>
                  <div className="vx-mut" style={{ fontSize: 12 }}>A RYCS gerencia prazos, limites e distribuição dos contatos.</div>
                </div>
                <div onClick={() => set("gestaoOperacionalModo", "manual")} style={{ padding: "16px 14px", borderRadius: 12, border: `1.5px solid ${gestaoModo === "manual" ? "var(--brand)" : "var(--border)"}`, background: gestaoModo === "manual" ? "var(--brand-50)" : "var(--surface)", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <SlidersHorizontal size={16} color={gestaoModo === "manual" ? "var(--brand)" : "var(--muted)"} />
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: gestaoModo === "manual" ? "var(--brand)" : "var(--text)" }}>Eu quero controlar</div>
                    {gestaoModo === "manual" && <Check size={14} color="var(--brand)" style={{ marginLeft: "auto" }} />}
                  </div>
                  <div className="vx-mut" style={{ fontSize: 12 }}>Defina prazo, metas e crie seus próprios controles.</div>
                </div>
              </div>
              {gestaoModo === "manual" && (
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", marginTop: 2 }}>
                  <label>
                    <div className="vx-label">Data de início</div>
                    <input className="vx-input" type="date" value={campanha.dataInicioGestao || ""} onChange={(e) => set("dataInicioGestao", e.target.value)} />
                  </label>
                  <label>
                    <div className="vx-label">Data de encerramento</div>
                    <input className="vx-input" type="date" value={campanha.dataEncerramentoGestao || ""} onChange={(e) => set("dataEncerramentoGestao", e.target.value)} />
                  </label>
                  <label>
                    <div className="vx-label">Meta diária de contatos</div>
                    <input className="vx-input" type="number" min="0" placeholder="Ex.: 50" value={campanha.metaDiariaContatos || ""} onChange={(e) => set("metaDiariaContatos", Number(e.target.value) || 0)} />
                  </label>
                  <label>
                    <div className="vx-label">Meta de vendas</div>
                    <input className="vx-input" type="number" min="0" placeholder="Ex.: 10" value={campanha.metaVendasManual || ""} onChange={(e) => set("metaVendasManual", Number(e.target.value) || 0)} />
                  </label>
                </div>
              )}
            </div>

            {/* Quais produtos ou serviços */}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Quais produtos ou serviços serão comercializados?</h2>
            <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Selecione os produtos do seu catálogo para calcular o faturamento estimado.</p>
            <div className="vx-card" style={{ padding: 22, marginTop: 0 }}>
              {catalogoProdutos.length === 0 ? (
                <div style={{ padding: "16px", background: "var(--brand-50)", borderRadius: 10, border: "1px solid var(--brand-100)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--brand)", marginBottom: 2 }}>Nenhum produto cadastrado</div>
                    <div className="vx-mut" style={{ fontSize: 12 }}>Cadastre seus produtos e serviços em Materiais para selecioná-los aqui.</div>
                  </div>
                  <a href="/empresa/materiais" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--brand)", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
                    <Plus size={14} /> Ir a Materiais
                  </a>
                </div>
              ) : (
                <>
                  {(() => {
                    const [dropOpen, setDropOpen] = React.useState(false);
                    const dropRef = React.useRef(null);
                    React.useEffect(() => {
                      const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
                      document.addEventListener("mousedown", h);
                      return () => document.removeEventListener("mousedown", h);
                    }, []);
                    const naoSelecionados = catalogoProdutos.filter((p) => !produtosSelecionados.some((s) => s.nome === p.nome));
                    return (
                      <div ref={dropRef} style={{ position: "relative", marginBottom: produtosSelecionados.length > 0 ? 12 : 0 }}>
                        <button type="button" onClick={() => setDropOpen((v) => !v)} style={{
                          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 14px", background: "var(--surface)", border: `1px solid ${dropOpen ? "var(--brand)" : "var(--border)"}`,
                          borderRadius: 8, cursor: "pointer", fontSize: 13.5, color: naoSelecionados.length === 0 ? "var(--muted)" : "var(--text)",
                          boxShadow: dropOpen ? "0 0 0 3px var(--brand-100)" : "none",
                        }}>
                          <span>{naoSelecionados.length === 0 ? "Todos os produtos já selecionados" : "Selecionar produto ou serviço…"}</span>
                          <ChevronDown size={15} color="var(--muted)" style={{ transform: dropOpen ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
                        </button>
                        {dropOpen && naoSelecionados.length > 0 && (
                          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)", overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
                            {naoSelecionados.map((p, i) => (
                              <button key={i} type="button" onClick={() => { set("produtosCampanha", [...produtosSelecionados, { nome: p.nome, preco: p.preco || 0 }]); setDropOpen(false); }}
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 14px", background: "transparent", border: "none", borderBottom: i < naoSelecionados.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left" }}>
                                <span style={{ fontSize: 13.5 }}>{p.nome}</span>
                                {p.preco > 0 && <span className="vx-mono" style={{ fontSize: 12, color: "var(--brand)" }}>{money(p.preco)}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {produtosSelecionados.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {produtosSelecionados.map((p, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20, background: "var(--brand-50)", border: "1px solid var(--brand-100)", fontSize: 12.5, fontWeight: 500 }}>
                          <span>{p.nome}</span>
                          {p.preco > 0 && <span className="vx-mono" style={{ color: "var(--brand)", fontSize: 11 }}>{money(p.preco)}</span>}
                          <button onClick={() => set("produtosCampanha", produtosSelecionados.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "var(--muted)" }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {produtosSelecionados.filter((p) => !p.preco).map((p, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, marginTop: 8 }}>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.nome}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginRight: 6, whiteSpace: "nowrap" }}>Informe o preço:</div>
                      <div style={{ width: 130 }}>
                        <CampoOrcamento value={0} onChange={(v) => set("produtosCampanha", produtosSelecionados.map((x) => x.nome === p.nome ? { ...x, preco: v } : x))} />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Validação de resultados */}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 5px" }}>Validação de resultados</h2>
            <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Defina como você aprova um lead qualificado, uma reunião agendada ou outro resultado desta atividade.</p>
            <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
              <div style={{ display: "grid", gap: 8 }}>
                {METODOS_APROVACAO.map((m) => {
                  const MIcon = m.icon;
                  return (
                    <CardOption key={m.id} selected={(campanha.aprovacaoPagamentos || "manual") === m.id}
                      onClick={() => set("aprovacaoPagamentos", m.id)} icon={MIcon} title={m.nome}
                      subtitle={m.id === "automatica" ? "O resultado é validado automaticamente após comprovação obrigatória." : m.id === "ia" ? "A IA analisa as evidências e valida dentro dos critérios definidos." : "Você revisa e aprova manualmente cada resultado entregue."} />
                  );
                })}
              </div>
              <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--brand-50)", borderRadius: 8, border: "1px solid var(--brand-100)", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <ShieldCheck size={14} color="var(--brand)" style={{ flexShrink: 0, marginTop: 1 }} />
                <span className="vx-mut" style={{ fontSize: 11.5 }}>Independente da modalidade, as comprovações obrigatórias definidas pela RYCS nunca podem ser ignoradas.</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
              <button className="vx-btn" onClick={() => setPasso(6)}><ArrowLeft size={14} /> Voltar</button>
              <button className="vx-btn vx-btn-primary" onClick={() => setPasso(8)}>Pagamentos <ArrowRight size={14} /></button>
            </div>
          </>
        );
      })()}

      {/* ═══════════════════════ PASSO 8: PAGAMENTOS ═══════════════════════ */}
      {passo === 8 && campanha && (() => {
        const orcamentoAtual = Number(campanha.orcamento) || 0;
        const precisaAdicionar = orcamentoAtual > disponivel ? orcamentoAtual - disponivel : 0;
        const entradasProj = entradaDaCampanha(campanha, emp);
        const projecao = calcularFunilProjecao(entradasProj);
        const ticketMedioEstimado = entradasProj.ticketMensal;
        const funcoesList = campanha.estruturaComercial === "operacao"
          ? (campanha.funcoesOperacao || [])
          : campanha.funcao ? [campanha.funcao] : [];
        const gestaoModo = campanha.gestaoOperacionalModo || "automatico";
        const ICONE_FUNCAO = { sdr: Footprints, bdr: Globe, closer: Target, pap: MapPin };

        return (
        <>
          <h2 className="vx-disp" style={{ fontSize: 22, margin: "0 0 8px" }}>Pagamentos</h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
            Defina seu investimento e descubra o potencial da sua campanha.
          </p>

          {/* ── Remuneração da jornada ── */}
          {funcoesList.length > 0 && (() => {
            const funcaoRemAtiva = campanha.abaRemuneracaoAtiva || funcoesList[0];
            const isOp = campanha.estruturaComercial === "operacao";
            const getAtivsRem = (k) => isOp ? (campanha[`config_${k}`]?.acoesAtivas || []) : (campanha.acoesAtivas || []);
            const getTarefa = (k, id) => isOp ? Number(campanha[`config_${k}`]?.tarefas?.[id] || 0) : Number(campanha.tarefas?.[id] || 0);
            const setTarefa = (k, id, v) => {
              if (isOp) { const cfg = campanha[`config_${k}`] || {}; set(`config_${k}`, { ...cfg, tarefas: { ...(cfg.tarefas || {}), [id]: v } }); }
              else { set("tarefas", { ...campanha.tarefas, [id]: v }); }
            };
            const getLiberacao = (k) => isOp ? (campanha[`config_${k}`]?.aprovacaoPagamentos || "manual") : (campanha.aprovacaoPagamentos || "manual");
            const setLiberacao = (k, v) => {
              if (isOp) { const cfg = campanha[`config_${k}`] || {}; set(`config_${k}`, { ...cfg, aprovacaoPagamentos: v }); }
              else { set("aprovacaoPagamentos", v); }
            };
            const acoesRem = getAtivsRem(funcaoRemAtiva);
            const liberacao = getLiberacao(funcaoRemAtiva);
            const nomeAcao = (id) => ACOES_DISPONIVEIS.find((a) => a.id === id)?.nome || ACOES[id]?.nome || id;
            const regraAcao = (id) => ACOES[id]?.regra || "Critérios definidos pela RYCS de acordo com as evidências exigidas.";
            return (
              <>
                <h2 className="vx-disp" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "28px 0 6px" }}>Remuneração da jornada</h2>
                <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>Defina quanto cada profissional receberá pelas atividades da campanha.</p>

                {/* Banner IA */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 12, marginTop: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Bot size={20} color="#fff" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--brand)" }}>Remuneração inteligente</div>
                    <div className="vx-mut" style={{ fontSize: 12 }}>Receba sugestões de valores de acordo com as atividades, complexidade e perfil da sua operação.</div>
                  </div>
                  <button className="vx-btn vx-btn-sm vx-btn-primary" style={{ whiteSpace: "nowrap", flexShrink: 0 }} disabled={recomendandoAtividades} onClick={recomendarAtividades}>
                    {recomendandoAtividades ? <><Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> Sugerindo…</> : <><Sparkles size={12} /> Sugerir valores com IA</>}
                  </button>
                </div>

                {/* Cards de função */}
                {funcoesList.length > 1 && (
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${funcoesList.length}, 1fr)`, gap: 8, marginTop: 10 }}>
                    {funcoesList.map((k) => {
                      const f = FUNCOES[k];
                      const FuncIc = { sdr: CalendarCheck, bdr: Target, closer: BadgeDollarSign, pap: Footprints }[k] || Users;
                      const ativa = funcaoRemAtiva === k;
                      const qtd = getAtivsRem(k).length;
                      return (
                        <button key={k} type="button" onClick={() => set("abaRemuneracaoAtiva", k)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: `1.5px solid ${ativa ? "var(--brand)" : "var(--border)"}`, background: ativa ? "var(--brand-50)" : "var(--surface)", borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "border-color .15s, background .15s", position: "relative" }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: ativa ? "var(--brand)" : "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <FuncIc size={17} color={ativa ? "#fff" : "var(--brand)"} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: ativa ? "var(--brand)" : "var(--ink)" }}>{f?.nome || k}</div>
                            <div className="vx-mut" style={{ fontSize: 11.5 }}>{qtd} {qtd === 1 ? "atividade" : "atividades"}</div>
                          </div>
                          {ativa && <div style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Check size={9} color="#fff" /></div>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Painel de remuneração */}
                {acoesRem.length > 0 ? (
                  <div style={{ marginTop: 10, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "var(--brand-50)", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>Atividades remuneradas</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>Valor por resultado</span>
                    </div>
                    {acoesRem.map((id, idx) => {
                      const AcIcon = ACOES_ICON_ROTINA[id] || ClipboardCheck;
                      const val = getTarefa(funcaoRemAtiva, id);
                      const isVenda = id === "venda";
                      const tipoRem = isOp ? (campanha[`config_${funcaoRemAtiva}`]?.vendaTipoRemuneracao || "fixo") : (campanha.vendaTipoRemuneracao || "fixo");
                      const isComissao = isVenda && tipoRem === "percentual";
                      const [popover, setPopover] = React.useState(false);
                      const popRef = React.useRef(null);
                      React.useEffect(() => {
                        const h = (e) => { if (popRef.current && !popRef.current.contains(e.target)) setPopover(false); };
                        document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
                      }, []);
                      return (
                        <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: idx > 0 ? "1px solid var(--border)" : "none" }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <AcIcon size={15} color="var(--brand)" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{nomeAcao(id)}</div>
                            <div ref={popRef} style={{ position: "relative", display: "inline-block" }}>
                              <button type="button" onClick={() => setPopover((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0, marginTop: 2 }}>
                                <ShieldCheck size={11} color="var(--brand)" />
                                <span style={{ fontSize: 11.5, color: "var(--brand)", fontWeight: 500 }}>Como será verificada?</span>
                              </button>
                              {popover && (
                                <div style={{ position: "absolute", left: 0, top: "calc(100% + 4px)", zIndex: 100, width: 240, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", boxShadow: "0 4px 16px rgba(0,0,0,.12)", fontSize: 12, lineHeight: 1.5 }}>
                                  <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6, color: "var(--ink)" }}>Critérios de verificação</div>
                                  <div className="vx-mut">{regraAcao(id)}</div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ width: 110 }}>
                              <div style={{ position: "relative" }}>
                                <input className="vx-input vx-mono" type="number" min="0" step="0.5" value={val || ""} placeholder="0"
                                  onChange={(e) => setTarefa(funcaoRemAtiva, id, Number(e.target.value))}
                                  style={{ paddingRight: 32, textAlign: "right" }} />
                                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 11, pointerEvents: "none" }}>{isComissao ? "%" : "R$"}</span>
                              </div>
                            </div>
                            <div className="vx-mut" style={{ fontSize: 10.5, marginTop: 2 }}>{isComissao ? "Comissão (%)" : "Valor em R$"}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ marginTop: 10, padding: "16px", background: "var(--brand-50)", borderRadius: 10, border: "1px solid var(--brand-100)", textAlign: "center" }}>
                    <div className="vx-mut" style={{ fontSize: 13 }}>Selecione as atividades na etapa <b>Profissionais → Monte a rotina comercial</b> para configurar a remuneração.</div>
                  </div>
                )}

                {/* Liberação de pagamentos */}
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {[
                    { id: "automatica", Icon: Zap, titulo: "Liberação automática", desc: "O pagamento é liberado após a comprovação e validação da atividade." },
                    { id: "manual", Icon: UserCheck, titulo: "Liberação manual", desc: "Você revisa os resultados comprovados e autoriza cada pagamento." },
                  ].map(({ id, Icon, titulo, desc }) => {
                    const sel = liberacao === id;
                    return (
                      <button key={id} type="button" onClick={() => setLiberacao(funcaoRemAtiva, id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", border: `1.5px solid ${sel ? "var(--brand)" : "var(--border)"}`, background: sel ? "var(--brand-50)" : "var(--surface)", borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "border-color .15s, background .15s" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: sel ? "var(--brand)" : "var(--brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={17} color={sel ? "#fff" : "var(--brand)"} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: sel ? "var(--brand)" : "var(--ink)" }}>{titulo}</div>
                          <div className="vx-mut" style={{ fontSize: 12, marginTop: 2 }}>{desc}</div>
                        </div>
                        {sel && <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Check size={11} color="#fff" /></div>}
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <ShieldCheck size={14} color="var(--muted)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span className="vx-mut" style={{ fontSize: 11.5 }}>Independentemente da modalidade escolhida, todas as atividades precisam respeitar as regras de comprovação da RYCS.</span>
                </div>
              </>
            );
          })()}

          {/* 1. Saldo disponível */}
          <div className="vx-card" style={{ padding: 18, marginTop: 20, background: "linear-gradient(135deg, var(--brand-50) 0%, var(--surface) 100%)", border: "1.5px solid var(--brand-100)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Wallet size={20} color="var(--brand)" />
              <div>
                <div className="vx-mut" style={{ fontSize: 11.5 }}>Saldo disponível na conta</div>
                <div className="vx-disp vx-mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--brand)" }}>{money(disponivel)}</div>
              </div>
            </div>
          </div>

          {/* 2. Quanto investir */}
          <div className="vx-card" style={{ padding: 22, marginTop: 14 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Quanto você deseja investir? <Tag obrigatorio={true} /></div>
              <div className="vx-mut" style={{ fontSize: 12.5 }}>Esse é o limite total que a empresa autoriza para esta campanha.</div>
            </div>
            <CampoOrcamento value={orcamentoAtual} onChange={(v) => set("orcamento", v)} />
            {precisaAdicionar > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, padding: "10px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={15} color="var(--amber, #F59E0B)" style={{ flexShrink: 0 }} />
                  <div className="vx-mut" style={{ fontSize: 12.5 }}>
                    Saldo insuficiente. Faltam <b className="vx-mono">{money(precisaAdicionar)}</b> para cobrir essa verba.
                  </div>
                </div>
                <button className="vx-btn vx-btn-sm vx-btn-primary" style={{ whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => setModalSaldoAberto(true)}>
                  <Plus size={13} /> Adicionar saldo
                </button>
              </div>
            )}
            {modalSaldoAberto && (
              <ModalSaldo emp={emp} aviso={aviso} aoConfirmar={() => { setModalSaldoAberto(false); window.location.reload(); }} onFechar={() => setModalSaldoAberto(false)} />
            )}
          </div>

          {/* 4. Projeção de resultados com IA */}
          <div className="vx-card" style={{ padding: 22, marginTop: 14 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                <Sparkles size={15} style={{ marginRight: 6, verticalAlign: -2, color: "var(--brand)" }} />Projeção de resultados com IA
              </div>
              <div className="vx-mut" style={{ fontSize: 12.5 }}>
                {orcamentoAtual > 0 ? "Baseado no investimento e benchmarks comerciais." : "Defina o investimento para ver a projeção."}
              </div>
            </div>
            {(() => {
              const f = projecao.funil;
              const fin = projecao.financeiro;
              const ep = entradasProj;
              const pctTxt = (v) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
              const num = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
              const origemTaxas = `Planilha RYCS — canal ${ep.canal}`;
              const origemDados = ep.ticketOrigem === "produtos" ? "Preço informado nos produtos da campanha"
                : ep.ticketOrigem === "perfil" ? "Ticket médio do perfil da empresa" : "Sem preço — informe o preço dos produtos";
              const semCusto = orcamentoAtual > 0 && !f.baseVerba;
              const temTicket = ticketMedioEstimado > 0;
              const kpiTooltips = {
                "Contatos trabalhados": {
                  formula: `${money(orcamentoAtual)} ÷ ${money(f.custoPorContatoUsado)} = ${num(f.contatos)}`,
                  explicacao: f.baseVerba === "closer"
                    ? `A campanha não paga por contato nem por agendamento, então a verba foi dividida pelo custo do closer em cada contato (reunião e venda pagas × taxas do funil).`
                    : `A verba dividida pelo custo de aquisição de cada contato: o pago por contato (${money(ep.ganhoSdrContato)}) mais a parte do pago por agendamento (${money(ep.ganhoSdrAgendamento)} × ${pctTxt(ep.pctAgenda)}).`,
                  taxa: `Custo por contato: ${money(f.custoPorContatoUsado)}`,
                  origem: "Valores das tarefas da campanha",
                },
                "Reuniões agendadas": {
                  formula: `${num(f.contatos)} contatos × ${pctTxt(ep.pctAgenda)} = ${num(f.agendamentos)}`,
                  explicacao: `De cada contato trabalhado, ${pctTxt(ep.pctAgenda)} marcam reunião.`,
                  taxa: `% que agenda: ${pctTxt(ep.pctAgenda)}`,
                  origem: origemTaxas,
                },
                "Reuniões realizadas": {
                  formula: `${num(f.agendamentos)} agendadas × ${pctTxt(ep.pctComparece)} = ${num(f.reunioesRealizadas)}`,
                  explicacao: `Dos agendamentos, ${pctTxt(ep.pctComparece)} comparecem à reunião.`,
                  taxa: `% que comparece: ${pctTxt(ep.pctComparece)}`,
                  origem: origemTaxas,
                },
                "Vendas estimadas": {
                  formula: `${num(f.reunioesRealizadas)} reuniões × ${pctTxt(ep.pctFecha)} = ${num(f.vendas)}`,
                  explicacao: `Das reuniões realizadas, ${pctTxt(ep.pctFecha)} viram venda.`,
                  taxa: `% que fecha: ${pctTxt(ep.pctFecha)}`,
                  origem: origemTaxas,
                },
                "Custo por venda": {
                  formula: `${money(fin.custoTotal)} ÷ ${num(f.vendas)} vendas = ${money(fin.cac)}`,
                  explicacao: `Custo total dividido pelas vendas: contatos e SDRs ${money(fin.custoMidia + fin.custoSdrs)}, closers ${money(fin.custoClosers)}, taxas e impostos ${money(fin.taxasImpostos)}.`,
                  taxa: `Taxas e impostos: ${pctTxt(ep.taxasImpostos)} do faturamento`,
                  origem: "Planilha RYCS — CAC (custo por venda)",
                },
                "ROI": {
                  formula: `${money(fin.lucro)} ÷ ${money(fin.custoTotal)} = ${num(fin.roi)}%`,
                  explicacao: `Lucro (faturamento ${money(fin.faturamento)} menos custo total ${money(fin.custoTotal)}) dividido pelo custo total. Cada R$ 1 investido retorna ${money(fin.retornoPorReal)}.`,
                  taxa: `Margem: ${num(fin.margem)}%`,
                  origem: origemDados,
                },
              };
              const faturamentoTooltip = {
                formula: `${num(f.vendas)} vendas × ${money(ticketMedioEstimado)} (ticket médio) = ${money(fin.faturamento)}`,
                explicacao: `Com ${num(f.vendas)} vendas estimadas e ticket médio de ${money(ticketMedioEstimado)}, o faturamento bruto projetado é ${money(fin.faturamento)}.`,
                taxa: `Ticket médio utilizado: ${money(ticketMedioEstimado)}`,
                origem: origemDados,
              };
              const PopoverConteudo = ({ tip }) => (
                <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200, width: 240, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.13)", fontSize: 12, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8, color: "var(--ink)" }}>Como foi calculado</div>
                  <div style={{ marginBottom: 6 }}>{tip.explicacao}</div>
                  <div style={{ padding: "6px 8px", background: "var(--brand-50)", borderRadius: 7, fontFamily: "monospace", fontSize: 11.5, color: "var(--brand)", fontWeight: 600, marginBottom: 8 }}>{tip.formula}</div>
                  <div className="vx-mut" style={{ fontSize: 11, marginBottom: 4 }}><b>Taxa aplicada:</b> {tip.taxa}</div>
                  <div className="vx-mut" style={{ fontSize: 11 }}><b>Origem:</b> {tip.origem}</div>
                </div>
              );
              return (<>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
                  {[
                    { label: "Contatos trabalhados", texto: num(f.contatos), Ic: Phone },
                    { label: "Reuniões agendadas", texto: num(f.agendamentos), Ic: CalendarCheck },
                    { label: "Reuniões realizadas", texto: num(f.reunioesRealizadas), Ic: Users },
                    { label: "Vendas estimadas", texto: num(f.vendas), Ic: Target },
                    { label: "Custo por venda", texto: f.vendas > 0 ? money(fin.cac) : "—", Ic: BadgeDollarSign },
                    { label: "ROI", texto: temTicket ? `${num(fin.roi)}%` : "—", Ic: TrendingUp },
                  ].map(({ label, texto, Ic }) => (
                    <div key={label} style={{ position: "relative", padding: "14px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, textAlign: "center" }}>
                      <button onClick={() => setPopoverProjecao(popoverProjecao === label ? null : label)}
                        style={{ position: "absolute", top: 6, right: 6, background: "none", border: "1px solid var(--border)", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, color: "var(--muted)", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>?</button>
                      {popoverProjecao === label && orcamentoAtual > 0 && !semCusto && (label !== "ROI" || temTicket) && <PopoverConteudo tip={kpiTooltips[label]} />}
                      <Ic size={16} color="var(--brand)" style={{ marginBottom: 4 }} />
                      <div className="vx-mono" style={{ fontSize: 20, fontWeight: 800, color: "var(--brand)" }}>
                        {orcamentoAtual <= 0 || semCusto ? "—" : texto}
                      </div>
                      <div style={{ fontSize: 10.5, fontWeight: 500, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.3 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ position: "relative", padding: "16px 20px", background: "var(--brand)", borderRadius: 10, textAlign: "center" }}>
                  <button onClick={() => setPopoverProjecao(popoverProjecao === "faturamento" ? null : "faturamento")}
                    style={{ position: "absolute", top: 8, right: 8, background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>?</button>
                  {popoverProjecao === "faturamento" && orcamentoAtual > 0 && ticketMedioEstimado > 0 && (
                    <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200, width: 260, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.13)", fontSize: 12, lineHeight: 1.5, textAlign: "left" }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8, color: "var(--ink)" }}>Como foi calculado</div>
                      <div style={{ marginBottom: 6 }}>{faturamentoTooltip.explicacao}</div>
                      <div style={{ padding: "6px 8px", background: "var(--brand-50)", borderRadius: 7, fontFamily: "monospace", fontSize: 11.5, color: "var(--brand)", fontWeight: 600, marginBottom: 8 }}>{faturamentoTooltip.formula}</div>
                      <div className="vx-mut" style={{ fontSize: 11, marginBottom: 4 }}><b>Ticket médio:</b> {faturamentoTooltip.taxa}</div>
                      <div className="vx-mut" style={{ fontSize: 11 }}><b>Origem:</b> {faturamentoTooltip.origem}</div>
                    </div>
                  )}
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.8)", marginBottom: 4 }}>FATURAMENTO BRUTO ESTIMADO</div>
                  <div className="vx-mono" style={{ fontSize: 26, fontWeight: 900, color: "#fff" }}>
                    {orcamentoAtual <= 0 || !temTicket || semCusto ? "—" : money(fin.faturamento)}
                  </div>
                  {!temTicket && orcamentoAtual > 0 && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.7)", marginTop: 4 }}>Informe o preço dos produtos para calcular</div>
                  )}
                  {temTicket && orcamentoAtual > 0 && !semCusto && (
                    <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.85)", marginTop: 4 }}>
                      Lucro estimado {money(fin.lucro)} · Margem {num(fin.margem)}% · Cada R$ 1 retorna {money(fin.retornoPorReal)}
                    </div>
                  )}
                </div>
                {semCusto && (
                  <div className="vx-mut" style={{ fontSize: 12, marginTop: 8 }}>Defina o valor pago nas ações da campanha para projetar os resultados.</div>
                )}
              </>);
            })()}
          </div>

          {/* 5. Equipe recomendada */}
          {funcoesList.length > 0 && (
            <div className="vx-card" style={{ padding: 22, marginTop: 14 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Equipe recomendada</div>
                <div className="vx-mut" style={{ fontSize: 12.5 }}>Profissionais sugeridos pela IA com base na verba e nas atividades configuradas. Você pode editar os valores.</div>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {funcoesList.map((fk) => {
                  const f = FUNCOES[fk];
                  const cfg = campanha[`config_${fk}`] || {};
                  const acoesAtivasFunc = cfg.acoesAtivas || [];
                  const custoUnitario = acoesAtivasFunc.reduce((s, a) => s + Number(cfg.tarefas?.[a] || 0), 0);
                  const recProf = orcamentoAtual > 0 && custoUnitario > 0
                    ? Math.max(1, Math.ceil(orcamentoAtual / (custoUnitario * 50)))
                    : 1;
                  const FuncIc = ICONE_FUNCAO[fk] || UserPlus;
                  return (
                    <div key={fk} style={{ padding: 16, background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <FuncIc size={18} color="#fff" />
                          </div>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>{f?.nome || fk}</div>
                            <div className="vx-mut" style={{ fontSize: 11.5 }}>{f?.descricao || ""}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="vx-mono" style={{ fontSize: 20, fontWeight: 800, color: "var(--brand)" }}>{recProf}</div>
                          <div className="vx-mut" style={{ fontSize: 10.5 }}>recomendados</div>
                        </div>
                      </div>
                      {acoesAtivasFunc.length > 0 && (
                        <div style={{ display: "grid", gap: 6 }}>
                          {acoesAtivasFunc.map((aId) => {
                            const nomeAcao = ACOES_DISPONIVEIS.find((a) => a.id === aId)?.nome || aId;
                            const valorAtual = Number(cfg.tarefas?.[aId] || 0);
                            return (
                              <div key={aId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
                                <div style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{nomeAcao}</div>
                                <div style={{ width: 110 }}>
                                  <CampoOrcamento value={valorAtual} onChange={(v) => {
                                    const cfgAtual = campanha[`config_${fk}`] || {};
                                    set(`config_${fk}`, { ...cfgAtual, tarefas: { ...cfgAtual.tarefas, [aId]: v } });
                                  }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
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
            <button className="vx-btn" onClick={() => setPasso(8)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(9)}>Revisar tudo <ArrowRight size={14} /></button>
          </div>
        </>
        );
      })()}

      {/* ═══════════════════════ PASSO 9: REVISÃO ═══════════════════════ */}
      {passo === 9 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 22, margin: "0 0 8px" }}>Tudo certo?</h2>
          <p className="vx-mut" style={{ marginTop: 0, marginBottom: 16, fontSize: 13 }}>
            Confira o resumo. A campanha será salva como rascunho — você publica quando quiser.
          </p>

          <div className="vx-card" style={{ padding: 18, marginTop: 0 }}>
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
              <div><span className="vx-mut" style={{ fontSize: 11.5 }}>Candidaturas</span><div style={{ fontWeight: 600 }}>{campanha.visibilidade === "publica" ? "Qualquer profissional" : campanha.visibilidade === "privada" ? "Só convidados" : "Oculta"}</div></div>
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

          {/* Resumo dos novos recursos configurados */}
          {(Number(campanha.metaQuantitativa) > 0 || (campanha.perguntasQualificacao || []).length > 0 || (campanha.confirmacaoContato || {}).habilitada || (campanha.remuneracaoPorOrigem || {}).diferenciarPorOrigem) && (
            <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
              <div className="vx-eyebrow" style={{ marginBottom: 10 }}>RECURSOS AVANÇADOS</div>
              <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
                {Number(campanha.metaQuantitativa) > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Target size={14} color="var(--brand)" />
                    <span>Meta: <b>{campanha.metaQuantitativa} {perguntaMetaQuantitativa(campanha.objetivo).unidade}</b></span>
                  </div>
                )}
                {(campanha.perguntasQualificacao || []).length > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <ClipboardCheck size={14} color="var(--brand)" />
                    <span><b>{(campanha.perguntasQualificacao || []).length}</b> pergunta(s) de qualificação</span>
                  </div>
                )}
                {(campanha.confirmacaoContato || {}).habilitada && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <ShieldCheck size={14} color="var(--brand)" />
                    <span>Confirmação de contato via {((campanha.confirmacaoContato || {}).canais || []).join(", ")}</span>
                  </div>
                )}
                {(campanha.remuneracaoPorOrigem || {}).diferenciarPorOrigem && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <HandCoins size={14} color="var(--brand)" />
                    <span>Remuneração diferenciada por origem ({(campanha.remuneracaoPorOrigem || {}).fatorEmpresa || 1}x empresa / {(campanha.remuneracaoPorOrigem || {}).fatorProfissional || 1.5}x profissional)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(7)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={criar}>
              {salvando ? "Salvando…" : <>Salvar rascunho <Check size={14} /></>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

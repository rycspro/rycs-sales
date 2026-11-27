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

const PASSOS = ["Tipo de campanha", "O que você precisa?", "Como vai funcionar?", "Quem vai trabalhar?", "Ações", "Pagamentos", "Tudo certo?"];
const PASSOS_CURTOS = ["Tipo", "Objetivo", "Operação", "Profissionais", "Ações", "Pagamentos", "Revisão"];

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
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 12px", border: "1px dashed var(--border)", borderRadius: 6, fontSize: 12 }}>
                <Upload size={14} color="var(--text-2)" />
                <span className="vx-mut">Clique para selecionar arquivo (.csv, .xlsx)</span>
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
  const [gerandoICP, setGerandoICP] = useState(false);
  const [recomendandoAtividades, setRecomendandoAtividades] = useState(false);
  const [recomendandoEvidencias, setRecomendandoEvidencias] = useState(false);
  const [gerandoDescricao, setGerandoDescricao] = useState(false);
  const uploadInputRef = useRef(null);
  const [catalogoProdutos, setCatalogoProdutos] = useState([]);
  const [popoverProjecao, setPopoverProjecao] = useState(null);

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
        <div className="vx-ws-steps">
          {PASSOS_CURTOS.map((p, i) => (
            <button key={p} type="button" className="vx-ws-step" data-state={i < passo ? "done" : i === passo ? "active" : "pending"} onClick={() => i < passo && setPasso(i)}>
              <span className="vx-ws-circle">{i < passo ? <Check size={11} strokeWidth={2.5} /> : i + 1}</span>
              <span className="vx-ws-title">{p}</span>
            </button>
          ))}
        </div>
        <div className="vx-ws-mobile">
          <span className="vx-ws-circle" data-state="active">{passo + 1}</span>
          <div className="vx-ws-mobile-info">
            <span className="vx-ws-mobile-title">{PASSOS_CURTOS[passo]}</span>
            <span className="vx-ws-mobile-sub">Etapa {passo + 1} de {PASSOS.length}</span>
          </div>
          <div className="vx-ws-mobile-bar"><div className="vx-ws-bar-fill" style={{ width: `${((passo) / (PASSOS.length - 1)) * 100}%` }} /></div>
        </div>
      </div>

      {/* ═══════════════════════ PASSO 0: TIPO DE CAMPANHA ═══════════════════════ */}
      {passo === 0 && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Tipo de campanha</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>Como você deseja organizar sua operação comercial?</p>

          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
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
            <button className="vx-btn" onClick={() => setPasso(0)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }} onClick={aoCancelar}>Cancelar</button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 2: ESTRUTURA ═══════════════════════ */}
      {passo === 2 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Como vai funcionar?</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            Defina o nome da campanha, de onde vêm os contatos e como eles serão distribuídos.
          </p>

          {/* Dados básicos */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
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

          {/* Mercado de atuação do cliente */}
          {secaoVisivel.mercado && <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Localização dos seus clientes</b><Tag obrigatorio={false} /><div className="vx-mut" style={{ fontSize: 11.5 }}>Onde estão os clientes que o profissional vai contatar?</div></div>
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
          </div>}

          {/* Origem dos leads */}
          {secaoVisivel.origemLeads && <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: "var(--brand)" }}>De onde vêm os contatos?</b><Tag obrigatorio={false} />
              <div className="vx-mut" style={{ fontSize: 11.5 }}>Você fornece a lista de contatos ou o profissional busca sozinho?</div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <CardOption selected={campanha.origemLeads === "empresa"} onClick={() => { set("origemLeads", "empresa"); set("fonteLeads", "empresa"); }} icon={Database} title="Minha empresa fornecerá os leads" subtitle="Você envia a lista e o profissional trabalha só esses contatos." />
              <CardOption selected={campanha.origemLeads === "profissional"} onClick={() => { set("origemLeads", "profissional"); set("fonteLeads", "profissional"); }} icon={UserPlus} title="O profissional encontrará os leads" subtitle="Ele mesmo prospecta e cadastra novos contatos." />
              <CardOption selected={campanha.origemLeads === "ambos"} onClick={() => { set("origemLeads", "ambos"); set("fonteLeads", "ambos"); }} icon={Shuffle} title="Ambas as opções" subtitle="Você fornece contatos e o profissional também pode buscar mais." />
            </div>
          </div>}

          {secaoVisivel.origemLeads && (campanha.origemLeads === "empresa" || campanha.origemLeads === "ambos") && (
            <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <CardOption selected={!campanha.distribuicaoLeads || campanha.distribuicaoLeads === "automatica"} onClick={() => { set("distribuicaoLeads", "automatica"); set("limiteLeadsSimultaneos", 0); set("limiteLeadsDia", 0); set("prazoContatoHoras", 0); set("prazoInatividadeHoras", 0); }} icon={Zap} title="Automático (recomendado)" subtitle="A plataforma distribui os contatos de forma equilibrada entre os profissionais." />
                <CardOption selected={campanha.distribuicaoLeads === "manual"} onClick={() => set("distribuicaoLeads", "manual")} icon={SlidersHorizontal} title="Eu quero controlar" subtitle="Você define quantos contatos cada profissional recebe e os prazos." />
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

          {/* Canais */}
          {secaoVisivel.canais && <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Por onde ele vai falar com os contatos?</b><Tag obrigatorio={false} /><div className="vx-mut" style={{ fontSize: 11.5 }}>Selecione os meios de comunicação que o profissional pode usar.</div></div>
            <ChipToggle
              items={CANAIS.map((c) => ({ id: c.id, nome: c.nome, icon: ICONES_CANAL[c.id] || Globe }))}
              value={campanha.canais || []}
              onChange={(v) => set("canais", v)}
              multi
            />
          </div>}

          {/* Materiais e treinamento (unificado) */}
          {secaoVisivel.materiais && <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: "var(--brand)" }}>Materiais e treinamento</b><Tag obrigatorio={false} />
              <div className="vx-mut" style={{ fontSize: 11.5 }}>Adicione arquivos, treinamentos e conteúdos que vão ajudar o profissional.</div>
            </div>
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
          </div>}

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
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <b style={{ color: "var(--brand)" }}><ClipboardCheck size={15} style={{ marginRight: 6, verticalAlign: -2 }} />Qualificação de leads</b><Tag obrigatorio={false} />
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

          {/* Confirmação de contato */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: "var(--brand)" }}><ShieldCheck size={15} style={{ marginRight: 6, verticalAlign: -2 }} />Confirmação de contato</b><Tag obrigatorio={false} />
              <div className="vx-mut" style={{ fontSize: 11.5 }}>O cliente recebe um link para confirmar que o contato realmente aconteceu.</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CANAIS_CONFIRMACAO.map((c) => {
                const canaisAtivos = (campanha.confirmacaoContato || {}).canais || [];
                const ativo = canaisAtivos.includes(c.id);
                return (
                  <button key={c.id} type="button" style={{
                    padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${ativo ? SEL.border : SEL.borderOff}`,
                    background: ativo ? SEL.bg : SEL.bgOff,
                    color: ativo ? "var(--brand)" : "var(--text-2)",
                  }} onClick={() => {
                    const novos = ativo ? canaisAtivos.filter((x) => x !== c.id) : [...canaisAtivos, c.id];
                    set("confirmacaoContato", { ...(campanha.confirmacaoContato || configConfirmacaoPadrao()), habilitada: novos.length > 0, canais: novos });
                  }}>{c.nome}</button>
                );
              })}
              {/* Sem confirmação */}
              {(() => {
                const semConfirmacao = !(campanha.confirmacaoContato || {}).habilitada;
                return (
                  <button type="button" style={{
                    padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${semConfirmacao ? SEL.border : SEL.borderOff}`,
                    background: semConfirmacao ? SEL.bg : SEL.bgOff,
                    color: semConfirmacao ? "var(--brand)" : "var(--text-2)",
                  }} onClick={() => set("confirmacaoContato", { ...(campanha.confirmacaoContato || configConfirmacaoPadrao()), habilitada: false, canais: [] })}>
                    Sem confirmação
                  </button>
                );
              })()}
            </div>
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="vx-btn" onClick={() => setPasso(1)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(3)}>Quem vai trabalhar? <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 3: PERFIL PROFISSIONAL ═══════════════════════ */}
      {passo === 3 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Quem vai trabalhar?</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            Defina o tipo de profissional, onde ele trabalha, o nível de experiência e como ele entra na campanha.
          </p>

          {campanha.estruturaComercial === "operacao" ? (
            <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Quais profissionais vão trabalhar nesta campanha?</b><Tag obrigatorio={true} />
                <div className="vx-mut" style={{ fontSize: 11.5 }}>Selecione todas as funções que a equipe precisa. Cada uma vira uma campanha ligada às outras.</div>
              </div>
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
          ) : campanha.estruturaComercial === "vinculada" ? (
            <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Campanha de origem</b><Tag obrigatorio={false} />
                <div className="vx-mut" style={{ fontSize: 11.5 }}>Selecione a campanha da qual esta vai receber contatos.</div>
              </div>
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
          ) : (<>
          {/* Função comercial */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>O que o profissional vai fazer?</b><Tag obrigatorio={true} />
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
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Quem é o cliente ideal?</b><Tag obrigatorio={false} /><div className="vx-mut" style={{ fontSize: 11.5 }}>Descreva o tipo de empresa ou pessoa que o profissional deve procurar.</div></div>
            <textarea className="vx-input" style={{ minHeight: 64 }} value={campanha.publico || ""}
              onChange={(e) => set("publico", e.target.value)}
              placeholder="Ex.: distribuidoras de bebida com 10 a 80 funcionários" />
            <label style={{ display: "block", marginTop: 12 }}><div className="vx-label">Produto ou serviço ofertado</div>
              <input className="vx-input" value={campanha.produto || ""} onChange={(e) => set("produto", e.target.value)} placeholder="Ex.: Software de gestão" /></label>
            <button className="vx-btn vx-btn-sm" style={{ marginTop: 10, gap: 6 }} disabled={gerandoICP} onClick={gerarICP}>
              {gerandoICP ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Gerando ICP…</> : <><Sparkles size={13} /> Gerar ICP com IA</>}
            </button>
          </div>

          {/* Nível de experiência */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Experiência</b><Tag obrigatorio={false} /></div>
            <div style={{ display: "grid", gap: 8 }}>
              {NIVEIS_EXPERIENCIA.map((n) => (
                <CardOption key={n.id} selected={campanha.nivelExperiencia === n.id} onClick={() => set("nivelExperiencia", n.id)} title={n.label} subtitle={n.descricao} />
              ))}
            </div>
          </div>

          {/* Aprovação da candidatura */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: "var(--brand)" }}>Aprovação da candidatura</b><Tag obrigatorio={false} />
              <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 2 }}>Controla como os profissionais entram na campanha, não a aprovação das atividades.</div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {PROCESSOS_ADMISSAO.map((p) => (
                <CardOption key={p.id} selected={campanha.processoAdmissao === p.id} onClick={() => set("processoAdmissao", p.id)} title={p.label} subtitle={p.descricao} />
              ))}
            </div>
          </div>

          </>)}

          {/* Modelo de trabalho + localização do profissional (unificado) */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: "var(--brand)" }}>Como o profissional vai trabalhar?</b><Tag obrigatorio={true} />
              <div className="vx-mut" style={{ fontSize: 11.5 }}>Ele trabalha de casa, na rua ou mistura os dois?</div>
            </div>
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
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div>
              <div className="vx-label">Quem pode se candidatar a esta campanha? <Tag obrigatorio={false} /></div>
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                <CardOption selected={campanha.visibilidade === "publica"} onClick={() => set("visibilidade", "publica")} icon={Eye} title="Qualquer profissional" subtitle="Qualquer profissional que se encaixe no perfil pode se candidatar." />
                <CardOption selected={campanha.visibilidade === "privada"} onClick={() => set("visibilidade", "privada")} icon={EyeOff} title="Só convidados" subtitle="Apenas profissionais que você convidar poderão se candidatar." />
                <CardOption selected={campanha.visibilidade === "oculta"} onClick={() => set("visibilidade", "oculta")} icon={Lock} title="Oculta" subtitle="Não aparece em buscas. Só entra quem tiver o link." />
              </div>
            </div>
          </div>

          {/* Validação de resultados */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ marginBottom: 10 }}>
              <b style={{ color: "var(--brand)" }}>Como os resultados serão validados?</b><Tag obrigatorio={false} />
              <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 2 }}>Defina como você aprova um lead qualificado, uma reunião agendada ou outro resultado desta atividade.</div>
            </div>
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
            <button className="vx-btn" onClick={() => setPasso(2)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(4)}>Ações e pagamentos <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 4: AÇÕES & REMUNERAÇÃO ═══════════════════════ */}
      {passo === 4 && campanha && (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Ações e pagamentos</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            {campanha.estruturaComercial === "operacao" ? "Configure as atividades, valores e aprovações para cada função da operação." : "Escolha o que o profissional faz e quanto ganha por cada resultado."}
          </p>

          {campanha.estruturaComercial !== "operacao" && campanha.modoAcoesRemuneradas && (
            <button className="vx-btn vx-btn-sm" style={{ marginTop: 4, marginBottom: 10, gap: 6 }} disabled={recomendandoAtividades} onClick={recomendarAtividades}>
              {recomendandoAtividades ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Recomendando…</> : <><Sparkles size={13} /> Recomendar atividades com IA</>}
            </button>
          )}

          {campanha.estruturaComercial === "operacao" && (campanha.funcoesOperacao || []).length > 0 ? (<>
            {/* Abas por função */}
            <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", marginBottom: 14 }}>
              {(campanha.funcoesOperacao || []).map((k) => {
                const f = FUNCOES[k];
                const ativaAba = (campanha.abaFuncaoAtiva || (campanha.funcoesOperacao || [])[0]) === k;
                return (
                  <button key={k} onClick={() => set("abaFuncaoAtiva", k)} style={{
                    padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    color: ativaAba ? "#fff" : "var(--muted)",
                    background: ativaAba ? "var(--brand)" : "transparent",
                    borderRadius: "8px 8px 0 0", border: "none",
                    marginBottom: -2, borderBottomWidth: 2, borderBottomStyle: "solid",
                    borderBottomColor: ativaAba ? "var(--brand)" : "transparent",
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
                    <b style={{ fontSize: 13, color: "var(--brand)" }}>Atividades e pagamentos — {fInfo?.nome}</b><Tag obrigatorio={true} />
                    <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4, marginBottom: 12 }}>Como este profissional é remunerado?</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: cfg.modoAtividades ? 14 : 0 }}>
                      {[
                        { id: "rapido", Icon: Zap, titulo: "Seleção rápida", desc: "Atividades predefinidas para esta função." },
                        { id: "personalizado", Icon: SlidersHorizontal, titulo: "Personalizado", desc: "Configure suas próprias atividades e remunerações." },
                      ].map(({ id, Icon, titulo, desc }) => {
                        const sel = cfg.modoAtividades === id;
                        return (
                          <button key={id} type="button" onClick={() => setConfig("modoAtividades", id)} style={{
                            display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 10, cursor: "pointer", textAlign: "left", position: "relative",
                            border: `1px solid ${sel ? SEL.border : SEL.borderOff}`, background: sel ? SEL.bg : SEL.bgOff,
                          }}>
                            {sel && <div style={{ position: "absolute", top: 8, right: 8, width: 16, height: 16, borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={10} color="#fff" /></div>}
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: sel ? "var(--brand)" : "var(--brand-50)", border: sel ? "none" : "1px solid var(--brand-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Icon size={16} color={sel ? "#fff" : "var(--brand)"} />
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: sel ? "var(--brand)" : "var(--text)" }}>{titulo}</div>
                              <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 2 }}>{desc}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {(cfg.modoAtividades === "rapido" || cfg.modoAtividades === "personalizado") && (() => {
                      const listaAtividades = cfg.modoAtividades === "rapido"
                        ? (SELECAO_RAPIDA[funcaoAtiva] || ACOES_DISPONIVEIS.filter((a) => sugeridas.includes(a.id)))
                        : [];
                      return (
                        <div style={{ display: "grid", gap: 8 }}>
                          {listaAtividades.map((a) => {
                            const ativa = (cfg.acoesAtivas || []).includes(a.id);
                            return (
                              <div key={a.id} style={{ borderRadius: 10, border: `1px solid ${ativa ? SEL.border : SEL.borderOff}`, background: ativa ? SEL.bg : SEL.bgOff, overflow: "hidden" }}>
                                <button type="button" onClick={() => {
                                  const novas = ativa ? (cfg.acoesAtivas || []).filter((x) => x !== a.id) : [...(cfg.acoesAtivas || []), a.id];
                                  setConfig("acoesAtivas", novas);
                                  if (!ativa) setConfig("tarefas", { ...(cfg.tarefas || {}), [a.id]: cfg.tarefas?.[a.id] || 0 });
                                }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", width: "100%", textAlign: "left", cursor: "pointer", background: "transparent", border: "none" }}>
                                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${ativa ? "var(--brand)" : "var(--border)"}`, background: ativa ? "var(--brand)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    {ativa && <Check size={11} color="#fff" />}
                                  </div>
                                  <span style={{ flex: 1, fontSize: 13, fontWeight: ativa ? 600 : 400, color: ativa ? "var(--brand)" : "var(--text)" }}>{a.nome}</span>
                                </button>
                                {ativa && (
                                  <div style={{ padding: "0 12px 12px 12px", display: "grid", gap: 10 }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                      <label>
                                        <div className="vx-label">Tipo de remuneração</div>
                                        <select className="vx-input" value={a.id === "venda" ? (cfg.vendaTipoRemuneracao || "fixo") : "fixo"}
                                          onChange={(e) => { if (a.id === "venda") setConfig("vendaTipoRemuneracao", e.target.value); }}>
                                          <option value="fixo">Valor fixo (R$)</option>
                                          {a.id === "venda" && <option value="percentual">Comissão (%)</option>}
                                        </select>
                                      </label>
                                      <label>
                                        <div className="vx-label">{a.id === "venda" && cfg.vendaTipoRemuneracao === "percentual" ? "Percentual (%)" : "Valor (R$)"}</div>
                                        <input className="vx-input vx-mono" type="number" min="0" step="0.5"
                                          max={a.id === "venda" && cfg.vendaTipoRemuneracao === "percentual" ? "100" : undefined}
                                          value={cfg.tarefas?.[a.id] || ""}
                                          placeholder={a.id === "venda" && cfg.vendaTipoRemuneracao === "percentual" ? "0" : "0,00"}
                                          onChange={(e) => setConfig("tarefas", { ...(cfg.tarefas || {}), [a.id]: Number(e.target.value) })} />
                                      </label>
                                    </div>
                                    {a.id === "venda" && cfg.vendaTipoRemuneracao === "percentual" && (
                                      <label>
                                        <div className="vx-label">Base de cálculo</div>
                                        <input className="vx-input" placeholder="Ex: Valor do contrato fechado" value={cfg.baseCalculoVenda || ""} onChange={(e) => setConfig("baseCalculoVenda", e.target.value)} />
                                      </label>
                                    )}
                                    {(campanha.origemLeads === "ambos" || campanha.fonteLeads === "ambos") && (
                                      <div>
                                        <div className="vx-label" style={{ marginBottom: 4 }}>Remuneração por origem do lead</div>
                                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                                          <input type="checkbox" checked={!!((cfg.remuneracaoPorOrigem || {})[a.id]?.diferenciar)}
                                            onChange={(e) => setConfig("remuneracaoPorOrigem", { ...(cfg.remuneracaoPorOrigem || {}), [a.id]: { ...(cfg.remuneracaoPorOrigem?.[a.id] || {}), diferenciar: e.target.checked } })} />
                                          Diferenciar valor para leads do profissional
                                        </label>
                                        {(cfg.remuneracaoPorOrigem || {})[a.id]?.diferenciar && (
                                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                                            <label><div className="vx-label">Multiplicador — Lead da empresa</div>
                                              <input className="vx-input vx-mono" type="number" step="0.1" min="0" value={(cfg.remuneracaoPorOrigem?.[a.id]?.fatorEmpresa) || 1}
                                                onChange={(e) => setConfig("remuneracaoPorOrigem", { ...(cfg.remuneracaoPorOrigem || {}), [a.id]: { ...(cfg.remuneracaoPorOrigem?.[a.id] || {}), fatorEmpresa: Number(e.target.value) } })} /></label>
                                            <label><div className="vx-label">Multiplicador — Lead do profissional</div>
                                              <input className="vx-input vx-mono" type="number" step="0.1" min="0" value={(cfg.remuneracaoPorOrigem?.[a.id]?.fatorProfissional) || 1.5}
                                                onChange={(e) => setConfig("remuneracaoPorOrigem", { ...(cfg.remuneracaoPorOrigem || {}), [a.id]: { ...(cfg.remuneracaoPorOrigem?.[a.id] || {}), fatorProfissional: Number(e.target.value) } })} /></label>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    <div>
                                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Comprovação</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                        {EVIDENCIAS_OPCOES.map((ev) => {
                                          const selEv = ((cfg.comprovacoes || {})[a.id] || []).includes(ev.id);
                                          return (
                                            <button key={ev.id} type="button" onClick={() => {
                                              const atual = (cfg.comprovacoes || {})[a.id] || [];
                                              const novas = selEv ? atual.filter((x) => x !== ev.id) : [...atual, ev.id];
                                              setConfig("comprovacoes", { ...(cfg.comprovacoes || {}), [a.id]: novas });
                                            }} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11.5, cursor: "pointer", fontWeight: selEv ? 600 : 400, border: `1px solid ${selEv ? SEL.border : SEL.borderOff}`, background: selEv ? SEL.bg : SEL.bgOff, color: selEv ? "var(--brand)" : "var(--text-2)" }}>
                                              {ev.nome}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {cfg.modoAtividades === "personalizado" && (cfg.acoesAtivas || []).filter((id) => id.startsWith("custom_")).map((id) => (
                            <div key={id} style={{ borderRadius: 10, border: `1px solid ${SEL.border}`, background: SEL.bg, overflow: "hidden" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
                                <input className="vx-input" placeholder="Nome da atividade" style={{ flex: 1, fontSize: 13, padding: "4px 8px" }}
                                  value={(cfg.nomesPersonalizados || {})[id] || ""}
                                  onChange={(e) => setConfig("nomesPersonalizados", { ...(cfg.nomesPersonalizados || {}), [id]: e.target.value })} />
                                <button type="button" onClick={() => setConfig("acoesAtivas", (cfg.acoesAtivas || []).filter((x) => x !== id))}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2 }}><Trash2 size={14} /></button>
                              </div>
                              <div style={{ padding: "0 12px 12px 12px", display: "grid", gap: 8 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>Valor (R$)</span>
                                  <input className="vx-input vx-mono" type="number" min="0" step="0.01" style={{ width: 100, padding: "4px 8px", fontSize: 13 }}
                                    value={cfg.tarefas?.[id] || ""} placeholder="0,00"
                                    onChange={(e) => setConfig("tarefas", { ...(cfg.tarefas || {}), [id]: Number(e.target.value) })} />
                                </label>
                              </div>
                            </div>
                          ))}
                          {cfg.modoAtividades === "personalizado" && (
                            <button type="button" onClick={() => {
                              const novaId = `custom_${Date.now()}`;
                              setConfig("acoesAtivas", [...(cfg.acoesAtivas || []), novaId]);
                              setConfig("tarefas", { ...(cfg.tarefas || {}), [novaId]: 0 });
                            }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: "1.5px dashed var(--border)", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--brand)", fontWeight: 600 }}>
                              <Plus size={15} /> Adicionar forma de ganho
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    {cfg.modoAtividades && (cfg.acoesAtivas || []).filter((id) => !id.startsWith("custom_")).length > 1 && (
                      <div style={{ marginTop: 14 }}>
                        <div className="vx-label" style={{ marginBottom: 8 }}>Como funciona o pagamento?</div>
                        <div style={{ display: "grid", gap: 8 }}>
                          <CardOption selected={cfg.remuneracaoCumulativa !== false} onClick={() => setConfig("remuneracaoCumulativa", true)} title="Pagar por cada etapa" subtitle="O profissional ganha por cada atividade que completar." />
                          <CardOption selected={cfg.remuneracaoCumulativa === false} onClick={() => setConfig("remuneracaoCumulativa", false)} title="Pagar só pelo resultado final" subtitle="Só paga quando o profissional chega ao último passo." />
                        </div>
                      </div>
                    )}
                    {cfg.modoAtividades && (
                      <div style={{ marginTop: 14 }}>
                        <div className="vx-label" style={{ marginBottom: 8 }}>Como os resultados serão validados?</div>
                        <div className="vx-mut" style={{ fontSize: 11.5, marginBottom: 8 }}>Defina como você aprova um lead qualificado, uma reunião agendada ou outro resultado desta atividade.</div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {METODOS_APROVACAO.map((m) => {
                            const MIcon = m.icon;
                            return (
                              <CardOption key={m.id} selected={(cfg.aprovacaoPagamentos || "manual") === m.id}
                                onClick={() => setConfig("aprovacaoPagamentos", m.id)} icon={MIcon} title={m.nome}
                                subtitle={m.id === "automatica" ? "O resultado é validado automaticamente após comprovação obrigatória." : m.id === "ia" ? "A IA analisa as evidências e valida dentro dos critérios definidos." : "Você revisa e aprova manualmente cada resultado entregue."} />
                            );
                          })}
                        </div>
                        <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--brand-50)", borderRadius: 8, border: "1px solid var(--brand-100)", display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <ShieldCheck size={14} color="var(--brand)" style={{ flexShrink: 0, marginTop: 1 }} />
                          <span className="vx-mut" style={{ fontSize: 11.5 }}>Independente da modalidade, as comprovações obrigatórias definidas pela RYCS nunca podem ser ignoradas.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </>) : (<>
          {/* Seletor de modo */}
          <div className="vx-card" style={{ padding: 20, marginTop: 14 }}>
            <div style={{ marginBottom: 14 }}>
              <b style={{ fontSize: 15, color: "var(--ink)" }}>Atividades e pagamentos — {FUNCOES[campanha.funcao]?.nome || campanha.funcao || "SDR"}</b><Tag obrigatorio={true} />
              <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 2 }}>Defina o que o profissional fará e quanto receberá.</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { id: "rapido", icon: Zap, titulo: "Seleção rápida", desc: "Escolha atividades recomendadas para esta função e defina quanto deseja pagar." },
                { id: "personalizado", icon: SlidersHorizontal, titulo: "Personalizado", desc: "Configure suas próprias atividades, valores e formas de pagamento." },
              ].map((m) => {
                const on = campanha.modoAcoesRemuneradas === m.id;
                return (
                  <button key={m.id} onClick={() => {
                    if (m.id === "personalizado" && campanha.modoAcoesRemuneradas !== "personalizado") {
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
                  }} className="vx-card" style={{
                    padding: "22px 18px", cursor: "pointer", textAlign: "left", width: "100%", borderRadius: 14,
                    border: `2px solid ${on ? "var(--brand)" : "var(--border)"}`,
                    background: on ? "var(--brand-50)" : "var(--surface-solid)",
                    transition: "border-color .2s, background .2s, box-shadow .2s", position: "relative",
                    boxShadow: on ? "0 0 0 3px var(--brand-50)" : "none",
                  }}>
                    {on && <div style={{ position: "absolute", top: 12, right: 12, width: 22, height: 22, borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={12} color="#fff" /></div>}
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: on ? "var(--brand-100, rgba(37,99,235,.12))" : "var(--surface-2, #f3f4f6)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                      <m.icon size={20} color={on ? "var(--brand)" : "var(--muted)"} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: on ? "var(--brand)" : "var(--ink)", marginBottom: 5 }}>{m.titulo}</div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── MODO SELEÇÃO RÁPIDA ── */}
          {campanha.modoAcoesRemuneradas === "rapido" && (<>
            <div className="vx-card" style={{ padding: 18 }}>
              <div style={{ marginBottom: 12 }}><b style={{ color: "var(--brand)" }}>Por quais resultados você paga?</b><Tag obrigatorio={true} /><div className="vx-mut" style={{ fontSize: 11.5 }}>Marque cada atividade e defina o valor. As mais comuns para {FUNCOES[campanha.funcao]?.nome || campanha.funcao || "SDR"} aparecem primeiro.</div></div>
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
                          <div style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${ativa ? "var(--brand)" : "var(--border)"}`, background: ativa ? "var(--brand)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {ativa && <Check size={12} color="#fff" />}
                          </div>
                          {AcIcon && <AcIcon size={16} color={ativa ? "var(--brand)" : "var(--muted)"} />}
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
                <div style={{ marginBottom: 10 }}><b style={{ color: "var(--brand)" }}>Ações personalizadas</b><Tag obrigatorio={false} /><div className="vx-mut" style={{ fontSize: 11.5 }}>Criadas no modo personalizado e preservadas.</div></div>
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
                  <b style={{ color: "var(--brand)" }}>Crie suas formas de ganho</b><Tag obrigatorio={true} />
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
                                    style={{ padding: "5px 10px", borderRadius: 16, fontSize: 12, border: `1px solid ${selecionada ? SEL.border : SEL.borderOff}`, background: selecionada ? SEL.bg : SEL.bgOff, color: selecionada ? "var(--brand)" : "var(--text-2)", cursor: "pointer", fontWeight: selecionada ? 600 : 400 }}>
                                    {selecionada && <Check size={10} style={{ marginRight: 4 }} />}{ev.nome}
                                  </button>
                                );
                              })}
                            </div>
                            <button className="vx-btn vx-btn-sm" style={{ marginTop: 6, gap: 5, fontSize: 11.5 }} disabled={recomendandoEvidencias} onClick={() => recomendarEvidencias(i)}>
                              {recomendandoEvidencias ? <><Loader size={11} style={{ animation: "spin 1s linear infinite" }} /> Sugerindo…</> : <><Sparkles size={11} /> Sugerir comprovações</>}
                            </button>
                          </div>
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

          </>)}

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
            <button className="vx-btn" onClick={() => setPasso(3)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(5)}>Pagamentos <ArrowRight size={14} /></button>
          </div>
        </>
      )}

      {/* ═══════════════════════ PASSO 5: VERBA DA CAMPANHA ═══════════════════════ */}
      {passo === 5 && campanha && (() => {
        const orcamentoAtual = Number(campanha.orcamento) || 0;
        const precisaAdicionar = orcamentoAtual > disponivel ? orcamentoAtual - disponivel : 0;
        const produtosSelecionados = campanha.produtosCampanha || [];
        const entradasProj = entradaDaCampanha(campanha, emp);
        const projecao = calcularFunilProjecao(entradasProj);
        const ticketMedioEstimado = entradasProj.ticketMensal;
        const buscaCatalogo = campanha._buscaCatalogo || "";
        const catalogoFiltrado = catalogoProdutos.filter((p) =>
          !buscaCatalogo || (p.nome || "").toLowerCase().includes(buscaCatalogo.toLowerCase())
        );
        const funcoesList = campanha.estruturaComercial === "operacao"
          ? (campanha.funcoesOperacao || [])
          : campanha.funcao ? [campanha.funcao] : [];
        const gestaoModo = campanha.gestaoOperacionalModo || "automatico";
        const ICONE_FUNCAO = { sdr: Footprints, bdr: Globe, closer: Target, pap: MapPin };

        return (
        <>
          <h2 className="vx-disp" style={{ fontSize: 23, margin: "0 0 5px" }}>Pagamentos</h2>
          <p className="vx-mut" style={{ marginTop: 0, fontSize: 13.5 }}>
            Defina seu investimento e descubra o potencial da sua campanha.
          </p>

          {/* 1. Saldo disponível */}
          <div className="vx-card" style={{ padding: 18, marginTop: 14, background: "linear-gradient(135deg, var(--brand-50) 0%, var(--surface) 100%)", border: "1.5px solid var(--brand-100)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Wallet size={20} color="var(--brand)" />
              <div>
                <div className="vx-mut" style={{ fontSize: 11.5 }}>Saldo disponível na conta</div>
                <div className="vx-mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--brand)" }}>{money(disponivel)}</div>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10 }}>
                <AlertCircle size={15} color="var(--amber, #F59E0B)" style={{ flexShrink: 0 }} />
                <div className="vx-mut" style={{ fontSize: 12.5 }}>
                  Saldo insuficiente. Você precisa adicionar <b className="vx-mono">{money(precisaAdicionar)}</b> para cobrir essa verba.
                </div>
              </div>
            )}
          </div>

          {/* 3. Produtos e serviços */}
          <div className="vx-card" style={{ padding: 22, marginTop: 14 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Quais produtos ou serviços serão comercializados?</div>
              <div className="vx-mut" style={{ fontSize: 12.5 }}>Selecione do catálogo ou adicione um novo. Informe o preço para calcular o faturamento estimado.</div>
            </div>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
              <input className="vx-input" style={{ paddingLeft: 32 }} placeholder="Buscar produto ou serviço..." value={buscaCatalogo}
                onChange={(e) => set("_buscaCatalogo", e.target.value)} />
            </div>
            {produtosSelecionados.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
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
            {buscaCatalogo && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, maxHeight: 200, overflowY: "auto", marginBottom: 10 }}>
                {catalogoFiltrado.map((p, i) => {
                  const jaSel = produtosSelecionados.some((s) => s.nome === p.nome);
                  return (
                    <button key={i} onClick={() => {
                      if (jaSel) set("produtosCampanha", produtosSelecionados.filter((s) => s.nome !== p.nome));
                      else { set("produtosCampanha", [...produtosSelecionados, { nome: p.nome, preco: p.preco || 0 }]); set("_buscaCatalogo", ""); }
                    }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 14px", background: "transparent", border: "none", borderBottom: i < catalogoFiltrado.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: 13 }}>{p.nome}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {p.preco > 0 && <span className="vx-mono" style={{ fontSize: 12, color: "var(--brand)" }}>{money(p.preco)}</span>}
                        {jaSel && <Check size={14} color="var(--brand)" />}
                      </div>
                    </button>
                  );
                })}
                {!catalogoFiltrado.some((p) => p.nome?.toLowerCase() === buscaCatalogo.toLowerCase()) && (
                  <button onClick={() => { set("produtosCampanha", [...produtosSelecionados, { nome: buscaCatalogo, preco: 0 }]); set("_buscaCatalogo", ""); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", background: "var(--brand-50)", border: "none", cursor: "pointer", color: "var(--brand)", fontSize: 13, fontWeight: 600 }}>
                    <Plus size={14} /> Adicionar &quot;{buscaCatalogo}&quot;
                  </button>
                )}
              </div>
            )}
            {produtosSelecionados.filter((p) => !p.preco).map((p, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, marginBottom: 6 }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.nome}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginRight: 6, whiteSpace: "nowrap" }}>Informe o preço:</div>
                <div style={{ width: 130 }}>
                  <CampoOrcamento value={0} onChange={(v) => set("produtosCampanha", produtosSelecionados.map((x) => x.nome === p.nome ? { ...x, preco: v } : x))} />
                </div>
              </div>
            ))}
            {produtosSelecionados.length === 0 && !buscaCatalogo && (
              <div className="vx-mut" style={{ fontSize: 12.5, fontStyle: "italic" }}>Nenhum produto selecionado — digite acima para buscar ou adicionar.</div>
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

          {/* 6. Gestão operacional */}
          <div className="vx-card" style={{ padding: 22, marginTop: 14 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Gestão operacional</div>
              <div className="vx-mut" style={{ fontSize: 12.5 }}>Como a campanha será acompanhada e distribuída.</div>
            </div>
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
            <button className="vx-btn" onClick={() => setPasso(4)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" onClick={() => setPasso(6)}>Revisar tudo <ArrowRight size={14} /></button>
          </div>
        </>
        );
      })()}

      {/* ═══════════════════════ PASSO 6: REVISÃO ═══════════════════════ */}
      {passo === 6 && campanha && (
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
            <button className="vx-btn" onClick={() => setPasso(5)}><ArrowLeft size={14} /> Voltar</button>
            <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={criar}>
              {salvando ? "Salvando…" : <>Salvar rascunho <Check size={14} /></>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

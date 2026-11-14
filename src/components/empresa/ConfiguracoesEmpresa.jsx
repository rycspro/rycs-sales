import { documentoValido, mascararDocumento } from "../../../shared/documentoConta.js";
import { useUnsavedChanges } from "../../lib/unsavedChanges.js";
import SegurancaConta from "../conta/SegurancaConta.jsx";
import { useState, useEffect, useRef } from "react";
import {
  Building2, Users, Bell, Lock, Save, Check, Settings,
  Briefcase, AlertCircle, ChevronRight, Globe,
  CreditCard, Headphones, Gift, Mail, MessageCircle, ExternalLink,
  ImagePlus, Trash2, Plug, Eye, EyeOff, Sparkles,
} from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import Indicacoes from "../Indicacoes.jsx";
import IntegracaoMeta from "./IntegracaoMeta.jsx";
import PagamentosEmpresa from "./PagamentosEmpresa.jsx";
import DestaqueEmpresa from "./DestaqueEmpresa.jsx";

// ── Data ─────────────────────────────────────────────────────────────

const CAMPOS_EMPRESA = [
  ["nome", "Nome fantasia", "Como a empresa é conhecida"],
  ["razaoSocial", "Razão social", "Razão social completa"],
  ["documento", "CNPJ ou CPF", "00.000.000/0000-00"],
  ["segmento", "Segmento", "Ex: Tecnologia, Saúde, Varejo"],
  ["produto", "Produto ou serviço", "O que você vende?"],
  ["endereco", "Endereço completo", "Rua, número, cidade, estado"],
  ["regiao", "Região atendida", "Ex: São Paulo e Grande SP"],
];

const CAMPOS_CONTATO = [
  ["representanteLegal", "Representante legal", "Nome do responsável"],
  ["emailEmpresa", "E-mail principal", "email@empresa.com.br"],
  ["telefoneEmpresa", "Telefone", "(11) 00000-0000"],
  ["contatoComercial", "E-mail comercial", "comercial@empresa.com.br"],
  ["contatoFinanceiro", "E-mail financeiro", "financeiro@empresa.com.br"],
];

const CAMPOS_COMERCIAL = [
  ["ticket", "Ticket médio", "Ex: R$ 2.000"],
  ["icp", "Perfil de cliente ideal (ICP)", "Ex: PMEs do setor de saúde"],
];

const NOTIF_OPCOES = [
  ["notifSubmissoes", "Envio de ações", "Quando um profissional envia uma ação de uma campanha."],
  ["notifCandidaturas", "Novas candidaturas", "Quando alguém se candidata a uma campanha."],
  ["notifFinanceiro", "Movimentações financeiras", "Depósitos, cobranças e confirmações de pagamento."],
  ["notifRelatorios", "Relatórios periódicos", "Resumos semanais de desempenho das campanhas."],
];

const SECOES_NAV = [
  { key: "dados", label: "Dados da empresa", icon: Building2 },
  { key: "comercial", label: "Comercial", icon: Briefcase },
  { key: "plano", label: "Plano e pagamentos", icon: CreditCard },
  { key: "visibilidade", label: "Visibilidade", icon: Sparkles },
  { key: "integracoes", label: "Integrações", icon: Plug },
  { key: "notificacoes", label: "Notificações", icon: Bell },
  { key: "cartoes", label: "Cartões salvos", icon: CreditCard },
  { key: "seguranca", label: "Segurança", icon: Lock },
  { key: "preferencias", label: "Preferências", icon: Settings },
  { key: "idiomas", label: "Idiomas", icon: Globe },
  { key: "indicar", label: "Indicar", icon: Gift },
];

// Idiomas disponíveis para a interface. A preferência fica salva por navegador.
const IDIOMAS = [
  { code: "pt-BR", nome: "Português (Brasil)", flag: "🇧🇷" },
  { code: "en",    nome: "English",            flag: "🇺🇸" },
  { code: "es",    nome: "Español",            flag: "🇪🇸" },
];

// ── UI atoms ──────────────────────────────────────────────────────────

function FInput({ label, value, onChange, type = "text", placeholder, hint, span2 }) {
  return (
    <label style={{ display: "block", gridColumn: span2 ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", letterSpacing: 0.2, marginBottom: 5 }}>{label}</div>
      <input className="vx-input" type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {hint && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>{hint}</div>}
    </label>
  );
}

function FTextarea({ label, value, onChange, placeholder, hint, span2 }) {
  return (
    <label style={{ display: "block", gridColumn: span2 ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", letterSpacing: 0.2, marginBottom: 5 }}>{label}</div>
      <textarea className="vx-input" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ minHeight: 88, resize: "vertical" }} />
      {hint && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>{hint}</div>}
    </label>
  );
}

function FGrid({ children, cols = 2 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "14px 20px" }}>
      {children}
    </div>
  );
}

function Block({ title, description, children }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "20px 24px", marginBottom: 14 }}>
      {(title || description) && (
        <div style={{ marginBottom: 16 }}>
          {title && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", letterSpacing: 0.5, textTransform: "uppercase" }}>{title}</div>}
          {description && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: title ? 2 : 0, lineHeight: 1.5 }}>{description}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

function PgHead({ title, description }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 19, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px", letterSpacing: -0.3 }}>{title}</h2>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

function Toggle({ value, onChange, label, desc }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <button
        type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)}
        style={{ width: 40, height: 22, borderRadius: 11, background: value ? "var(--brand)" : "var(--surface-3)", position: "relative", border: "none", cursor: "pointer", transition: "background .2s", flexShrink: 0, marginTop: 2 }}
      >
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: value ? 20 : 2, transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.2)" }} />
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>
    </div>
  );
}

function CkBox({ value, onChange, label, desc }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span
        role="checkbox" aria-checked={value} onClick={() => onChange(!value)}
        style={{ width: 18, height: 18, borderRadius: 4, marginTop: 2, border: `1.5px solid ${value ? "var(--brand)" : "var(--border-strong)"}`, background: value ? "var(--brand)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all .15s" }}
      >
        {value && <Check size={11} color="#fff" strokeWidth={3} />}
      </span>
      <div>
        <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1, lineHeight: 1.4 }}>{desc}</div>}
      </div>
    </label>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: 148, fontSize: 12.5, color: "var(--muted)", fontWeight: 500, flexShrink: 0, paddingTop: 1 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: value ? "var(--ink)" : "var(--muted)", fontStyle: value ? "normal" : "italic" }}>{value || "Não informado"}</div>
    </div>
  );
}

function InlineField({ label, value, onChange, type = "text", placeholder, multiline = false, dark = false }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      try { inputRef.current.select?.(); } catch (_) {}
    }
  }, [editing]);

  const baseText = {
    fontSize: 13.5,
    color: dark ? (value ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.5)") : (value ? "var(--ink)" : "var(--muted)"),
    fontStyle: value ? "normal" : "italic",
    marginTop: 1, lineHeight: 1.4,
    overflowWrap: "break-word",
  };

  const inputStyle = {
    width: "100%", fontSize: 13.5, fontFamily: "inherit",
    border: `1.5px solid ${dark ? "rgba(255,255,255,.6)" : "var(--brand)"}`,
    borderRadius: 6, padding: "4px 8px",
    background: dark ? "rgba(255,255,255,.12)" : "var(--surface)",
    color: dark ? "#fff" : "var(--ink)",
    outline: "none", boxSizing: "border-box",
    marginTop: 1,
  };

  return (
    <div
      style={{ marginBottom: 10, cursor: editing ? "default" : "text", borderRadius: 6, padding: "4px 6px", margin: "0 -6px 6px", transition: "background .12s" }}
      onClick={() => !editing && setEditing(true)}
      onMouseEnter={(e) => { if (!editing) e.currentTarget.style.background = dark ? "rgba(255,255,255,.1)" : "var(--surface-2)"; }}
      onMouseLeave={(e) => { if (!editing) e.currentTarget.style.background = ""; }}
      title={editing ? undefined : "Clique para editar"}
    >
      <div style={{ fontSize: 11, color: dark ? "rgba(255,255,255,.65)" : "var(--muted)", fontWeight: 500 }}>{label}</div>
      {editing ? (
        multiline ? (
          <textarea
            ref={inputRef}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            placeholder={placeholder}
            style={{ ...inputStyle, minHeight: 68, resize: "vertical" }}
          />
        ) : (
          <input
            ref={inputRef}
            type={type}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            placeholder={placeholder}
            style={inputStyle}
          />
        )
      ) : (
        <div style={baseText}>{value || (placeholder ? `${placeholder}` : "Clique para editar")}</div>
      )}
    </div>
  );
}

// ── Cartões salvos ───────────────────────────────────────────────────

function CartoesSalvos({ aviso }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    const r = await api("/saved-cards");
    if (Array.isArray(r)) setCards(r);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const remover = async (id) => {
    const r = await api(`/saved-cards/${id}`, { method: "DELETE" });
    if (r?.ok) { setCards((prev) => prev.filter((c) => c.id !== id)); aviso("Cartão removido."); }
    else aviso(r?.error || "Erro ao remover.");
  };

  return (
    <>
      <PgHead title="Cartões salvos" description="Gerencie os cartões salvos para pagamentos futuros." />
      {loading ? (
        <div className="vx-mut" style={{ padding: 20, textAlign: "center" }}>Carregando...</div>
      ) : cards.length === 0 ? (
        <div className="vx-card" style={{ padding: 24, textAlign: "center" }}>
          <CreditCard size={28} style={{ color: "var(--muted)", margin: "0 auto 8px" }} />
          <div className="vx-mut" style={{ fontSize: 13 }}>Nenhum cartão salvo.</div>
          <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>Ao assinar um plano, marque "Salvar este cartão" para ele aparecer aqui.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cards.map((c) => (
            <div key={c.id} className="vx-card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <CreditCard size={20} style={{ color: "var(--brand)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.bandeira} •••• {c.final4}</div>
                <div className="vx-mut" style={{ fontSize: 11.5 }}>
                  {c.holderName}{c.apelido ? ` · ${c.apelido}` : ""} · {c.tipo === "DEBIT_CARD" ? "Débito" : "Crédito"}
                </div>
              </div>
              <button className="vx-btn" onClick={() => remover(c.id)} title="Remover cartão"
                style={{ padding: "6px 10px", fontSize: 11.5, color: "var(--red)" }}>
                <Trash2 size={14} /> Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────

export default function ConfiguracoesEmpresa({ emp, up, aviso, recarregar, db, secaoInicial = "dados", somenteConteudo = false }) {
  const [secao, setSecao] = useState(secaoInicial);
  const campanhasEmpresa = (db?.campaigns || []).filter((c) => c.companyId === emp.id);
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  const [form, setForm] = useState(() => ({
    ...emp,
    notifEmail: emp.notifEmail ?? true,
    notifSubmissoes: emp.notifSubmissoes ?? true,
    notifCandidaturas: emp.notifCandidaturas ?? true,
    notifFinanceiro: emp.notifFinanceiro ?? true,
    notifRelatorios: emp.notifRelatorios ?? false,
  }));
  const [changed, setChanged] = useState(false);
  useUnsavedChanges(changed);
  const [salvando, setSalvando] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [logo, setLogo] = useState(emp?.logo || "");
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const inputLogoRef = useRef(null);

  const [idioma, setIdioma] = useState(() => {
    try { return localStorage.getItem("rycs-idioma") || "pt-BR"; } catch { return "pt-BR"; }
  });
  const escolherIdioma = (code) => {
    if (code === idioma) return;
    setIdioma(code);
    try { localStorage.setItem("rycs-idioma", code); } catch { /* ignore */ }
    document.documentElement.lang = code;
    aviso?.(`Idioma alterado para ${IDIOMAS.find((i) => i.code === code)?.nome || code}.`);
  };

  const enviarLogo = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    if (!["image/jpeg", "image/png"].includes(arquivo.type) || arquivo.size > 2 * 1024 * 1024) return aviso("Envie uma imagem JPG ou PNG de até 2 MB.");
    setEnviandoLogo(true);
    const reader = new FileReader();
    reader.onerror = () => { setEnviandoLogo(false); aviso("Não foi possível ler a imagem."); };
    reader.onload = async () => {
      const dataUri = reader.result;
      const img = new Image();
      img.onerror = () => { setEnviandoLogo(false); aviso("Imagem inválida."); };
      img.onload = async () => {
        const r = await api(`/companies/${emp.id}/logo`, {
          base64: dataUri.split(",")[1], mimetype: arquivo.type,
          largura: img.width, altura: img.height,
        });
        setEnviandoLogo(false);
        if (!r || r.error) return aviso(r?.error || "Não foi possível enviar o logo.");
        setLogo(r.logo);
        up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, logo: r.logo } : c) }));
        aviso("Logo atualizado.");
      };
      img.src = dataUri;
    };
    reader.readAsDataURL(arquivo);
    e.target.value = "";
  };

  const removerLogo = async () => {
    setEnviandoLogo(true);
    const r = await apiPatch(`/companies/${emp.id}`, { logo: "" });
    setEnviandoLogo(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível remover o logo.");
    setLogo("");
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, logo: "" } : c) }));
    aviso("Logo removido.");
  };

  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  if (!emp) return null;

  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setChanged(true); setSavedOk(false); };
  const tog = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setChanged(true); setSavedOk(false); };

  const descartar = () => {
    setForm({ ...emp, notifEmail: emp.notifEmail ?? true, notifSubmissoes: emp.notifSubmissoes ?? true, notifCandidaturas: emp.notifCandidaturas ?? true, notifFinanceiro: emp.notifFinanceiro ?? true, notifRelatorios: emp.notifRelatorios ?? false });
    setChanged(false);
    setSavedOk(false);
  };

  const salvar = async () => {
    if (form.emailEmpresa && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailEmpresa)) return aviso("Informe um e-mail válido.");
    if (form.telefoneEmpresa && !/^\d{10,13}$/.test(String(form.telefoneEmpresa).replace(/\D/g, ""))) return aviso("Informe um telefone válido com DDD.");
    if (form.documento !== emp.documento && form.documento && !documentoValido(form.documento)) return aviso("Informe um CPF ou CNPJ completo.");
    setSalvando(true);
    const payload = {};
    [...CAMPOS_EMPRESA, ...CAMPOS_CONTATO, ...CAMPOS_COMERCIAL].forEach(([k]) => { payload[k] = form[k] || ""; });
    payload.diferenciais = form.diferenciais || "";
    payload.objecoes = form.objecoes || "";
    payload.cor = form.cor || "";
    payload.notifEmail = form.notifEmail;
    payload.notifSubmissoes = form.notifSubmissoes;
    payload.notifCandidaturas = form.notifCandidaturas;
    payload.notifFinanceiro = form.notifFinanceiro;
    payload.notifRelatorios = form.notifRelatorios;
    const r = await apiPatch(`/companies/${emp.id}`, payload);
    setSalvando(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível salvar.");
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, ...payload } : c) }));
    setChanged(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3500);
    aviso("Configurações salvas.");
  };

  // Visibilidade na vitrine: quando desligada, a empresa (e suas campanhas) não
  // aparece para nenhum profissional. Persiste na hora, sem depender do "Salvar".
  const visivel = form.visivel !== false;
  const alternarVisivel = async () => {
    const novo = !visivel;
    setForm((f) => ({ ...f, visivel: novo }));
    const r = await apiPatch(`/companies/${emp.id}`, { visivel: novo });
    if (!r || r.error) { setForm((f) => ({ ...f, visivel: !novo })); return aviso(r?.error || "Não foi possível atualizar a visibilidade."); }
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, visivel: novo } : c) }));
    aviso(novo ? "Empresa visível para os profissionais." : "Empresa oculta — não aparece para nenhum profissional.");
  };

  // ── Section content ───────────────────────────────────────────────

  const secoes = {
    dados: (
      <>
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px", letterSpacing: -0.3 }}>Dados da empresa</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>Clique em qualquer campo para editar diretamente.</p>
          </div>
          <button
            type="button" role="switch" aria-checked={visivel} onClick={alternarVisivel}
            title={visivel ? "Sua empresa aparece para os profissionais" : "Sua empresa está oculta para todos os profissionais"}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 999,
              cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
              border: `1.5px solid ${visivel ? "var(--brand)" : "var(--border)"}`,
              background: visivel ? "var(--brand-50)" : "var(--surface)",
              color: visivel ? "var(--brand)" : "var(--muted)",
            }}
          >
            {visivel ? <Eye size={15} /> : <EyeOff size={15} />}
            <span style={{ fontSize: 13, fontWeight: 600 }}>Deixar visível</span>
            <span style={{ width: 38, height: 22, borderRadius: 999, padding: 2, background: visivel ? "var(--brand)" : "var(--surface-3, #d1d5db)", transition: "background .2s", display: "inline-block" }}>
              <span style={{ display: "block", width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transform: visivel ? "translateX(16px)" : "translateX(0)", transition: "transform .2s" }} />
            </span>
          </button>
        </div>

        {/* ── Cartão editável ── */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          {/* Header gradiente — nome e segmento editáveis */}
          <div style={{ background: `linear-gradient(135deg, ${form.cor || "var(--brand)"} 0%, ${form.cor || "#3b82f6"} 100%)`, padding: "24px 28px 20px", display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 60, height: 60, borderRadius: 14, background: "rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: -1, flexShrink: 0, border: "2px solid rgba(255,255,255,.35)", overflow: "hidden" }}>
              {logo ? <img src={logo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (form.nome || "?")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <InlineField label="" value={form.nome} onChange={(v) => { set("nome")(v); setChanged(true); }} placeholder="Nome fantasia" dark
                extraStyle={{ fontSize: 20, fontWeight: 700 }} />
              <InlineField label="" value={form.segmento} onChange={(v) => { set("segmento")(v); setChanged(true); }} placeholder="Segmento da empresa" dark />
            </div>
            {/* Logo upload inline no header */}
            <div style={{ flexShrink: 0 }}>
              <input ref={inputLogoRef} type="file" accept="image/jpeg,image/png" onChange={enviarLogo} style={{ display: "none" }} />
              <button
                onClick={() => inputLogoRef.current?.click()}
                disabled={enviandoLogo}
                title={logo ? "Trocar logo" : "Enviar logo"}
                style={{ background: "rgba(255,255,255,.18)", border: "1.5px solid rgba(255,255,255,.4)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "#fff", fontSize: 12, fontFamily: "inherit" }}
              >
                <ImagePlus size={13} />
                {enviandoLogo ? "…" : logo ? "Trocar" : "Logo"}
              </button>
              {logo && (
                <button onClick={removerLogo} disabled={enviandoLogo} title="Remover logo"
                  style={{ marginTop: 4, background: "rgba(255,0,0,.25)", border: "1.5px solid rgba(255,100,100,.5)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#fff", fontSize: 11, fontFamily: "inherit" }}>
                  <Trash2 size={11} /> Remover
                </button>
              )}
            </div>
          </div>

          {/* Grid de campos editáveis */}
          <div style={{ padding: "20px 28px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: "0 32px" }}>
              {/* Coluna 1: Dados cadastrais */}
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>Dados cadastrais</div>
                <InlineField label="Razão social" value={form.razaoSocial} onChange={set("razaoSocial")} placeholder="Razão social completa" />
                <InlineField label="CNPJ / CPF" value={mascararDocumento(form.documento)} onChange={v => set("documento")(mascararDocumento(v))} placeholder="00.000.000/0000-00" />
              </div>

              {/* Coluna 2: Contato */}
              <div style={{ borderLeft: mobile ? "none" : "1px solid var(--border)", borderTop: mobile ? "1px solid var(--border)" : "none", paddingLeft: mobile ? 0 : 32, paddingTop: mobile ? 16 : 0, marginTop: mobile ? 16 : 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>Contato</div>
                <InlineField label="Representante" value={form.representanteLegal} onChange={set("representanteLegal")} placeholder="Nome do responsável" />
                <InlineField label="E-mail" value={form.emailEmpresa} onChange={set("emailEmpresa")} type="email" placeholder="email@empresa.com.br" />
                <InlineField label="Telefone" value={form.telefoneEmpresa} onChange={set("telefoneEmpresa")} placeholder="(11) 00000-0000" />
              </div>

              {/* Coluna 3: Comercial + Localização */}
              <div style={{ borderLeft: mobile ? "none" : "1px solid var(--border)", borderTop: mobile ? "1px solid var(--border)" : "none", paddingLeft: mobile ? 0 : 32, paddingTop: mobile ? 16 : 0, marginTop: mobile ? 16 : 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>Comercial & Localização</div>
                <InlineField label="Ticket médio" value={form.ticket} onChange={set("ticket")} placeholder="Ex: R$ 2.000" />
                <InlineField label="Região atendida" value={form.regiao} onChange={set("regiao")} placeholder="Ex: São Paulo e Grande SP" />
                <InlineField label="Endereço" value={form.endereco} onChange={set("endereco")} placeholder="Rua, número, cidade, estado" />
              </div>
            </div>

            {/* Produto + ICP editáveis */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 16 }}>
              <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Produto / Serviço</div>
                <InlineField label="" value={form.produto} onChange={set("produto")} placeholder="O que você vende?" multiline />
              </div>
              <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Perfil de cliente ideal (ICP)</div>
                <InlineField label="" value={form.icp} onChange={set("icp")} placeholder="Ex: PMEs do setor de saúde" multiline />
              </div>
            </div>
          </div>
        </div>

        {/* Contatos adicionais */}
        <Block title="Contatos adicionais" description="E-mails de acesso comercial e financeiro.">
          <FGrid>
            <FInput label="E-mail comercial" value={form.contatoComercial} onChange={set("contatoComercial")} type="email" placeholder="comercial@empresa.com.br" />
            <FInput label="E-mail financeiro" value={form.contatoFinanceiro} onChange={set("contatoFinanceiro")} type="email" placeholder="financeiro@empresa.com.br" />
          </FGrid>
        </Block>
      </>
    ),

    comercial: (
      <>
        <PgHead title="Informações comerciais" description="Configure seu perfil de cliente ideal e argumentação de vendas." />
        <Block title="Dados comerciais">
          <FGrid>
            <FInput label="Ticket médio" value={form.ticket} onChange={set("ticket")} placeholder="Ex: R$ 2.000" />
            <FInput label="Perfil de cliente ideal (ICP)" value={form.icp} onChange={set("icp")} placeholder="Ex: PMEs do setor de saúde" />
          </FGrid>
        </Block>
        <Block title="Argumentação de vendas" description="Ajuda os profissionais a apresentar e defender sua solução.">
          <FGrid cols={1}>
            <FTextarea label="Diferenciais" value={form.diferenciais} onChange={set("diferenciais")} placeholder="O que torna sua solução única?" />
            <FTextarea label="Objeções mais comuns" value={form.objecoes} onChange={set("objecoes")} placeholder="Quais dúvidas ou resistências o cliente costuma ter?" />
          </FGrid>
        </Block>
      </>
    ),

    notificacoes: (
      <>
        <PgHead title="Notificações" description="Escolha quais alertas deseja receber por e-mail." />
        <Block title="Canal">
          <Toggle value={form.notifEmail} onChange={tog("notifEmail")} label="Notificações por e-mail" desc="Receba alertas no e-mail principal da conta." />
        </Block>
        {form.notifEmail && (
          <Block title="Eventos notificados">
            {NOTIF_OPCOES.map(([chave, label, desc]) => (
              <CkBox key={chave} value={form[chave]} onChange={tog(chave)} label={label} desc={desc} />
            ))}
          </Block>
        )}
      </>
    ),

    cartoes: <CartoesSalvos aviso={aviso} />,

    seguranca: <SegurancaConta aviso={aviso} />,

    preferencias: (
      <>
        <PgHead title="Preferências" description="Configurações de interface e experiência." />
        <Block>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", color: "var(--muted)" }}>
            <Globe size={18} strokeWidth={1.5} />
            <span style={{ fontSize: 13.5 }}>Preferências adicionais estarão disponíveis em breve.</span>
          </div>
        </Block>
      </>
    ),

    idiomas: (
      <>
        <PgHead title="Idiomas" description="Escolha o idioma da interface do sistema." />
        <Block>
          <div style={{ display: "grid", gap: 8 }}>
            {IDIOMAS.map((i) => {
              const ativo = idioma === i.code;
              return (
                <button
                  key={i.code}
                  type="button"
                  onClick={() => escolherIdioma(i.code)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10,
                    border: `1.5px solid ${ativo ? "var(--brand)" : "var(--border)"}`,
                    background: ativo ? "var(--brand-50)" : "var(--surface)", cursor: "pointer", textAlign: "left", width: "100%",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{i.flag}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: ativo ? 600 : 500, color: ativo ? "var(--brand)" : "var(--ink)" }}>{i.nome}</span>
                  {ativo && <Check size={16} color="var(--brand)" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "12px 2px 0", lineHeight: 1.6 }}>
            A escolha fica salva neste navegador e define o idioma da interface.
          </p>
        </Block>
      </>
    ),

    indicar: <Indicacoes aviso={aviso} />,

    integracoes: <IntegracaoMeta aviso={aviso} campanhas={campanhasEmpresa} />,

    plano: <PagamentosEmpresa emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar} secao="plano" onTrocarSecao={() => {}} />,

    visibilidade: <DestaqueEmpresa emp={emp} up={up} aviso={aviso} recarregar={recarregar} />,
  };

  const showSalvar = !["seguranca", "preferencias", "idiomas", "indicar", "integracoes", "plano", "visibilidade"].includes(secao);

  // ── Layout ────────────────────────────────────────────────────────

  return (
    <div className="vx-fade" style={{ display: "flex", flexDirection: mobile ? "column" : "row", minHeight: "100%", minWidth: 0 }}>

      {/* Secondary navigation */}
      {!somenteConteudo && (mobile ? (
        <div style={{ display: "flex", overflowX: "auto", borderBottom: "1px solid var(--border)", scrollbarWidth: "none" }}>
          {SECOES_NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSecao(key)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", whiteSpace: "nowrap", background: "none", border: "none", borderBottom: `2px solid ${secao === key ? "var(--brand)" : "transparent"}`, cursor: "pointer", color: secao === key ? "var(--brand)" : "var(--muted)", fontSize: 13, fontWeight: secao === key ? 500 : 400, flexShrink: 0, marginBottom: -1 }}
            >
              <Icon size={14} strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
      ) : (
        <nav style={{ width: 200, flexShrink: 0, borderRight: "1px solid var(--border)", paddingTop: 24, paddingBottom: 24 }}>
          {SECOES_NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSecao(key)}
              style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "7px 12px 7px 18px", background: secao === key ? "var(--surface-2)" : "transparent", border: "none", borderLeft: `2px solid ${secao === key ? "var(--brand)" : "transparent"}`, cursor: "pointer", textAlign: "left", color: secao === key ? "var(--brand)" : "var(--ink)", fontSize: 13.5, fontWeight: secao === key ? 500 : 400, transition: "all .15s" }}
            >
              <Icon size={15} strokeWidth={2} style={{ opacity: secao === key ? 1 : 0.55 }} />
              {label}
            </button>
          ))}
        </nav>
      ))}

      {/* Content area */}
      <div style={{ flex: 1, padding: mobile ? "20px 16px 40px" : "30px 32px 56px", minWidth: 0, overflowX: "hidden", overflowY: "auto" }}>

        {/* Pending changes bar */}
        {changed && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 20, gap: 12, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--ink)" }}>
              <AlertCircle size={14} style={{ color: "var(--brand)", flexShrink: 0 }} />
              Alterações não salvas
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="vx-btn vx-btn-sm" onClick={descartar}>Descartar</button>
              <button className="vx-btn vx-btn-primary vx-btn-sm" disabled={salvando} onClick={salvar}>
                <Save size={12} />
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        )}

        {/* Success banner */}
        {savedOk && !changed && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 20, color: "#15803D" }}>
            <Check size={14} />
            Configurações salvas com sucesso
          </div>
        )}

        {/* Section content */}
        {secoes[secao]}

        {/* Footer save button */}
        {showSalvar && (
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid var(--border)", marginTop: 8 }}>
            <button className="vx-btn vx-btn-primary" disabled={salvando || !changed} onClick={salvar} style={{ minWidth: 164, opacity: changed ? 1 : 0.4 }}>
              <Save size={14} />
              {salvando ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

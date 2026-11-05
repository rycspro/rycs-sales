import { useState, useEffect } from "react";
import {
  Building2, Users, Bell, Lock, Save, Check, Settings,
  Briefcase, AlertCircle, ChevronRight, Globe, LayoutGrid,
  CreditCard, Headphones, Gift, Mail, MessageCircle, ExternalLink,
} from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import PlanosEmpresa from "./PlanosEmpresa.jsx";
import Indicacoes from "../Indicacoes.jsx";

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
  { key: "geral", label: "Geral", icon: LayoutGrid },
  { key: "dados", label: "Dados da empresa", icon: Building2 },
  { key: "contatos", label: "Contatos", icon: Users },
  { key: "comercial", label: "Comercial", icon: Briefcase },
  { key: "notificacoes", label: "Notificações", icon: Bell },
  { key: "seguranca", label: "Segurança", icon: Lock },
  { key: "preferencias", label: "Preferências", icon: Settings },
  { key: "planos", label: "Planos", icon: CreditCard },
  { key: "suporte", label: "Suporte", icon: Headphones },
  { key: "indicar", label: "Indicar", icon: Gift },
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

// ── Main component ────────────────────────────────────────────────────

export default function ConfiguracoesEmpresa({ emp, up, aviso, recarregar }) {
  const [secao, setSecao] = useState("geral");
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
  const [salvando, setSalvando] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

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

  const alterarSenha = async () => {
    if (!senhaAtual || !senhaNova) return aviso("Preencha a senha atual e a nova.");
    if (senhaNova.length < 6) return aviso("A nova senha deve ter pelo menos 6 caracteres.");
    if (senhaNova !== senhaConfirm) return aviso("As senhas não coincidem.");
    setSalvandoSenha(true);
    const r = await api("/auth/change-password", { senhaAtual, senhaNova });
    setSalvandoSenha(false);
    if (!r || r.error) return aviso(r?.error || "Não foi possível alterar a senha.");
    setSenhaAtual(""); setSenhaNova(""); setSenhaConfirm("");
    aviso("Senha alterada com sucesso.");
  };

  // ── Section content ───────────────────────────────────────────────

  const secoes = {
    geral: (
      <>
        <PgHead title="Visão geral" description="Resumo das informações cadastradas na sua conta." />
        <Block>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, background: form.cor || "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff", flexShrink: 0, letterSpacing: -1 }}>
              {(emp.nome || "?")[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--ink)" }}>{emp.nome || "Empresa"}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 1 }}>{emp.segmento || "Segmento não informado"}</div>
            </div>
          </div>
          <InfoRow label="Razão social" value={emp.razaoSocial} />
          <InfoRow label="CNPJ / CPF" value={emp.documento} />
          <InfoRow label="Região atendida" value={emp.regiao} />
          <InfoRow label="E-mail principal" value={emp.emailEmpresa} />
          <InfoRow label="Telefone" value={emp.telefoneEmpresa} />
        </Block>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "Dados da empresa", key: "dados", desc: "Nome, CNPJ, segmento e endereço" },
            { label: "Contatos", key: "contatos", desc: "E-mails e responsáveis" },
            { label: "Comercial", key: "comercial", desc: "ICP, ticket e diferenciais" },
          ].map(({ label, key, desc }) => (
            <button
              key={key}
              onClick={() => setSecao(key)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", textAlign: "left", transition: "border-color .15s" }}
            >
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{label}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{desc}</div>
              </div>
              <ChevronRight size={16} color="var(--muted)" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </>
    ),

    dados: (
      <>
        <PgHead title="Dados da empresa" description="Informações cadastrais, endereço e segmento." />
        <Block title="Informações principais">
          <FGrid>
            <FInput label="Nome fantasia" value={form.nome} onChange={set("nome")} placeholder="Como a empresa é conhecida" />
            <FInput label="Razão social" value={form.razaoSocial} onChange={set("razaoSocial")} placeholder="Razão social completa" />
            <FInput label="CNPJ ou CPF" value={form.documento} onChange={set("documento")} placeholder="00.000.000/0000-00" />
            <FInput label="Segmento" value={form.segmento} onChange={set("segmento")} placeholder="Ex: Tecnologia, Saúde, Varejo" />
            <FInput label="Produto ou serviço" value={form.produto} onChange={set("produto")} placeholder="O que você vende?" span2 />
          </FGrid>
        </Block>
        <Block title="Localização">
          <FGrid>
            <FInput label="Endereço completo" value={form.endereco} onChange={set("endereco")} placeholder="Rua, número, cidade, estado" span2 />
            <FInput label="Região atendida" value={form.regiao} onChange={set("regiao")} placeholder="Ex: São Paulo e Grande SP" />
          </FGrid>
        </Block>
      </>
    ),

    contatos: (
      <>
        <PgHead title="Contatos" description="Pessoas e canais de comunicação da empresa." />
        <Block title="Responsáveis e canais">
          <FGrid>
            <FInput label="Representante legal" value={form.representanteLegal} onChange={set("representanteLegal")} placeholder="Nome do responsável" />
            <FInput label="E-mail principal" value={form.emailEmpresa} onChange={set("emailEmpresa")} type="email" placeholder="email@empresa.com.br" />
            <FInput label="Telefone" value={form.telefoneEmpresa} onChange={set("telefoneEmpresa")} placeholder="(11) 00000-0000" />
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

    seguranca: (
      <>
        <PgHead title="Segurança" description="Gerencie o acesso à sua conta." />
        <Block title="Alterar senha" description="Use uma senha forte com pelo menos 8 caracteres.">
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "14px 20px", maxWidth: 500 }}>
            <FInput label="Senha atual" value={senhaAtual} onChange={setSenhaAtual} type="password" span2 />
            <FInput label="Nova senha" value={senhaNova} onChange={setSenhaNova} type="password" />
            <FInput label="Confirmar nova senha" value={senhaConfirm} onChange={setSenhaConfirm} type="password" />
          </div>
          <button className="vx-btn" disabled={salvandoSenha || !senhaAtual || !senhaNova} onClick={alterarSenha} style={{ marginTop: 16 }}>
            <Lock size={14} />
            {salvandoSenha ? "Alterando…" : "Alterar senha"}
          </button>
        </Block>
      </>
    ),

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

    planos: <PlanosEmpresa aviso={aviso} recarregar={recarregar} />,

    suporte: (
      <>
        <PgHead title="Suporte" description="Entre em contato com a equipe RYCS." />
        <Block title="Canais de atendimento">
          {[
            { icon: Mail, label: "E-mail", valor: "suporte@rycs.pro", href: "mailto:suporte@rycs.pro", desc: "Resposta em até 1 dia útil" },
            { icon: MessageCircle, label: "WhatsApp", valor: "(11) 99999-9999", href: "https://wa.me/5511999999999", desc: "Atendimento em horário comercial" },
          ].map(({ icon: Icon, label, valor, href, desc }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} strokeWidth={1.8} style={{ color: "var(--brand)" }} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{desc}</div>
                </div>
              </div>
              <a href={href} target="_blank" rel="noreferrer" className="vx-btn vx-btn-sm" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <ExternalLink size={12} />
                {valor}
              </a>
            </div>
          ))}
        </Block>
        <Block title="Central de ajuda">
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", color: "var(--muted)" }}>
            <Globe size={18} strokeWidth={1.5} />
            <span style={{ fontSize: 13.5 }}>Documentação e tutoriais em breve em <b>docs.rycs.pro</b>.</span>
          </div>
        </Block>
      </>
    ),

    indicar: <Indicacoes aviso={aviso} />,
  };

  const showSalvar = !["seguranca", "preferencias", "geral", "planos", "suporte", "indicar"].includes(secao);

  // ── Layout ────────────────────────────────────────────────────────

  return (
    <div className="vx-fade" style={{ display: "flex", flexDirection: mobile ? "column" : "row", minHeight: "100%", minWidth: 0 }}>

      {/* Secondary navigation */}
      {mobile ? (
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
      )}

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

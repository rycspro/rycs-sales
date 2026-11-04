import { useState } from "react";
import { Building2, Users, Palette, Bell, Shield, Lock, Save, ChevronDown, ChevronUp, Check } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";

function Secao({ titulo, icone: Icon, children, defaultAberta = true }) {
  const [aberta, setAberta] = useState(defaultAberta);
  return (
    <div className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setAberta((a) => !a)}
        className="vx-row"
        style={{
          width: "100%", padding: "16px 20px", background: "none", border: "none",
          cursor: "pointer", color: "var(--ink)", fontSize: 14.5, fontWeight: 600,
          borderBottom: aberta ? "1px solid var(--border)" : "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon size={16} strokeWidth={2.2} />
          {titulo}
        </span>
        {aberta ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
      </button>
      {aberta && <div style={{ padding: 20 }}>{children}</div>}
    </div>
  );
}

function Campo({ label, valor, onChange, tipo = "text", placeholder, disabled, textarea }) {
  const props = {
    className: "vx-input",
    value: valor || "",
    onChange: (e) => onChange(e.target.value),
    placeholder,
    disabled,
    style: textarea ? { minHeight: 76 } : undefined,
  };
  return (
    <label style={{ display: "block" }}>
      <div className="vx-label">{label}</div>
      {textarea ? <textarea {...props} /> : <input type={tipo} {...props} />}
    </label>
  );
}

const CAMPOS_EMPRESA = [
  ["nome", "Nome fantasia"],
  ["razaoSocial", "Razão social"],
  ["documento", "CNPJ ou CPF"],
  ["segmento", "Segmento"],
  ["produto", "Produto ou serviço"],
  ["endereco", "Endereço completo"],
  ["regiao", "Região atendida"],
];

const CAMPOS_CONTATO = [
  ["representanteLegal", "Representante legal"],
  ["contatoFinanceiro", "E-mail financeiro"],
  ["contatoComercial", "E-mail comercial"],
  ["telefoneEmpresa", "Telefone"],
  ["emailEmpresa", "E-mail principal"],
];

const CAMPOS_COMERCIAL = [
  ["ticket", "Ticket médio"],
  ["icp", "Perfil de cliente ideal (ICP)"],
];

const NOTIF_OPCOES = [
  ["submissoes", "Quando um profissional envia uma ação"],
  ["candidaturas", "Quando alguém se candidata a uma campanha"],
  ["financeiro", "Movimentações financeiras (depósitos, cobranças)"],
  ["relatorios", "Relatórios periódicos"],
];

export default function ConfiguracoesEmpresa({ emp, up, aviso }) {
  const [form, setForm] = useState(() => ({
    ...emp,
    notifEmail: emp.notifEmail ?? true,
    notifSubmissoes: emp.notifSubmissoes ?? true,
    notifCandidaturas: emp.notifCandidaturas ?? true,
    notifFinanceiro: emp.notifFinanceiro ?? true,
    notifRelatorios: emp.notifRelatorios ?? false,
  }));
  const [salvando, setSalvando] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  if (!emp) return null;

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k) => () => setForm((f) => ({ ...f, [k]: !f[k] }));

  const salvar = async () => {
    setSalvando(true);
    const payload = {};
    [...CAMPOS_EMPRESA, ...CAMPOS_CONTATO, ...CAMPOS_COMERCIAL].forEach(([k]) => {
      payload[k] = form[k] || "";
    });
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
    setSenhaAtual("");
    setSenhaNova("");
    setSenhaConfirm("");
    aviso("Senha alterada com sucesso.");
  };

  return (
    <div className="vx-fade">
      <div className="vx-page-head" style={{ marginBottom: 20 }}>
        <div>
          <div className="vx-eyebrow">Conta da empresa</div>
          <h1 className="vx-disp" style={{ fontSize: 22, margin: "4px 0" }}>Configurações</h1>
          <p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>
            Gerencie os dados, contatos, identidade visual, notificações e segurança da sua conta.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>

        {/* Dados da empresa */}
        <Secao titulo="Dados da empresa" icone={Building2}>
          <div className="vx-grid vx-g2">
            {CAMPOS_EMPRESA.map(([k, label]) => (
              <Campo key={k} label={label} valor={form[k]} onChange={set(k)} />
            ))}
          </div>
        </Secao>

        {/* Contatos */}
        <Secao titulo="Contatos" icone={Users}>
          <div className="vx-grid vx-g2">
            {CAMPOS_CONTATO.map(([k, label]) => (
              <Campo key={k} label={label} valor={form[k]} onChange={set(k)} />
            ))}
          </div>
        </Secao>

        {/* Comercial */}
        <Secao titulo="Informações comerciais" icone={Shield}>
          <div className="vx-grid vx-g2">
            {CAMPOS_COMERCIAL.map(([k, label]) => (
              <Campo key={k} label={label} valor={form[k]} onChange={set(k)} />
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <Campo label="Diferenciais" valor={form.diferenciais} onChange={set("diferenciais")} textarea />
          </div>
          <div style={{ marginTop: 14 }}>
            <Campo label="Objeções mais comuns" valor={form.objecoes} onChange={set("objecoes")} textarea />
          </div>
        </Secao>

        {/* Identidade visual */}
        <Secao titulo="Identidade visual" icone={Palette} defaultAberta={false}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label>
              <div className="vx-label">Cor da marca</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="color"
                  value={form.cor || "#2563EB"}
                  onChange={(e) => set("cor")(e.target.value)}
                  style={{ width: 44, height: 44, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", padding: 2 }}
                />
                <input
                  className="vx-input"
                  value={form.cor || "#2563EB"}
                  onChange={(e) => set("cor")(e.target.value)}
                  placeholder="#2563EB"
                  style={{ width: 120 }}
                />
              </div>
            </label>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="vx-label">Prévia</div>
              <div style={{
                height: 44, borderRadius: "var(--radius-sm)", background: form.cor || "#2563EB",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 600, fontSize: 13, letterSpacing: .3,
              }}>
                {emp.nome || "Sua empresa"}
              </div>
            </div>
          </div>
        </Secao>

        {/* Notificações */}
        <Secao titulo="Notificações" icone={Bell} defaultAberta={false}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <span
                role="switch"
                aria-checked={form.notifEmail}
                onClick={toggle("notifEmail")}
                style={{
                  width: 40, height: 22, borderRadius: 11, background: form.notifEmail ? "var(--brand)" : "var(--surface-3)",
                  position: "relative", transition: "background .2s", cursor: "pointer", flexShrink: 0,
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 2, left: form.notifEmail ? 20 : 2,
                  transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.15)",
                }} />
              </span>
              <span style={{ fontSize: 13.5 }}>Receber notificações por e-mail</span>
            </label>

            {form.notifEmail && (
              <div style={{ paddingLeft: 50, display: "flex", flexDirection: "column", gap: 8 }}>
                {NOTIF_OPCOES.map(([k, desc]) => {
                  const chave = `notif${k.charAt(0).toUpperCase() + k.slice(1)}`;
                  return (
                    <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                      <span
                        role="checkbox"
                        aria-checked={form[chave]}
                        onClick={toggle(chave)}
                        style={{
                          width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${form[chave] ? "var(--brand)" : "var(--border-strong)"}`,
                          background: form[chave] ? "var(--brand)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", flexShrink: 0, transition: "all .15s",
                        }}
                      >
                        {form[chave] && <Check size={12} color="#fff" strokeWidth={3} />}
                      </span>
                      {desc}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </Secao>

        {/* Segurança */}
        <Secao titulo="Segurança" icone={Lock} defaultAberta={false}>
          <p className="vx-mut" style={{ margin: "0 0 14px", fontSize: 13 }}>Altere a senha de acesso da sua conta.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
            <Campo label="Senha atual" valor={senhaAtual} onChange={setSenhaAtual} tipo="password" />
            <Campo label="Nova senha" valor={senhaNova} onChange={setSenhaNova} tipo="password" />
            <Campo label="Confirmar nova senha" valor={senhaConfirm} onChange={setSenhaConfirm} tipo="password" />
            <button
              className="vx-btn"
              disabled={salvandoSenha || !senhaAtual || !senhaNova}
              onClick={alterarSenha}
              style={{ alignSelf: "flex-start", marginTop: 4 }}
            >
              <Lock size={14} />
              {salvandoSenha ? "Alterando…" : "Alterar senha"}
            </button>
          </div>
        </Secao>

        {/* Botão salvar geral */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4, paddingBottom: 24 }}>
          <button className="vx-btn vx-btn-primary" disabled={salvando} onClick={salvar} style={{ minWidth: 180 }}>
            <Save size={15} />
            {salvando ? "Salvando…" : "Salvar configurações"}
          </button>
        </div>
      </div>
    </div>
  );
}

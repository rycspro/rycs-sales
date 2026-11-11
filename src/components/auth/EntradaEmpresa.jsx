import { useId, useState } from "react";
import { ArrowRight, MailCheck, Users, Zap } from "lucide-react";
import { CampoSenha } from "../ui.jsx";
import RecuperarSenha from "./RecuperarSenha.jsx";
import MolduraAuth from "./MolduraAuth.jsx";
import { api } from "../../lib/api.js";
import { ROTAS, navegar } from "../../lib/rotas.js";
import { SENHA_MIN_EMPRESA, validarSenhaEmpresa } from "../../../shared/onboarding.js";

function formatarCnpj(valor) {
  const d = valor.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function validarCnpj(valor) {
  const d = valor.replace(/\D/g, "");
  if (d.length !== 14) return "CNPJ inválido.";
  if (/^(\d)\1+$/.test(d)) return "CNPJ inválido.";
  const calc = (n) => {
    let s = 0, p = n - 7;
    for (let i = 0; i < n; i++) { s += parseInt(d[i]) * p--; if (p < 2) p = 9; }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (calc(12) !== parseInt(d[12]) || calc(13) !== parseInt(d[13])) return "CNPJ inválido.";
  return null;
}

// Página pública de entrada da empresa.
// Modo "inicio" — dois caminhos:
//   "Criar conta" → formulário simples (e-mail, senha, termos) + e-mail de confirmação.
//   "Iniciar vendas" → navega para /onboarding (fluxo de 6 etapas com EtapaAcesso).
// Registra eventos de funil para o analytics (criou_conta / iniciou_onboarding).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Opt({ titulo, descricao, cta, onClick, icone: Icone, destaque = false }) {
  return (
    <div
      style={{
        border: `1.5px solid ${destaque ? "var(--brand)" : "var(--border)"}`,
        borderRadius: 14, padding: 16, display: "flex", flexDirection: "column",
        background: destaque ? "var(--brand-50)" : "var(--surface)",
        boxShadow: destaque ? "var(--shadow-brand)" : "var(--shadow-card)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center",
          background: destaque ? "var(--brand)" : "var(--surface-2)",
          color: destaque ? "#fff" : "var(--brand)", flexShrink: 0,
        }}>
          <Icone size={15} strokeWidth={2.3} aria-hidden="true" />
        </div>
        <span className="vx-disp" style={{ fontSize: 14.5 }}>{titulo}</span>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.55, flex: 1 }}>{descricao}</p>
      <button
        type="button"
        className={`vx-btn vx-btn-block${destaque ? " vx-btn-primary" : ""}`}
        style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 13 }}
        onClick={onClick}
      >
        {cta} <ArrowRight size={14} strokeWidth={2.3} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function EntradaEmpresa() {
  const id = useId();
  const [modo, setModo] = useState("inicio"); // inicio | criar | link-enviado | recuperar
  const [email, setEmail] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [aceitouPrivacidade, setAceitouPrivacidade] = useState(false);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);

  const iniciarVendas = () => {
    // Registra intenção e envia para o fluxo guiado (EtapaAcesso).
    api("/onboarding/evento", { evento: "iniciou_onboarding", dados: { caminho: "guiado" } });
    navegar(ROTAS.onboarding);
  };

  const enviarCriarConta = async (e) => {
    e.preventDefault();
    const novos = {};
    if (!nomeEmpresa.trim()) novos.nomeEmpresa = "Nome da empresa é obrigatório.";
    // CNPJ é opcional; valida apenas quando preenchido.
    const errCnpj = cnpj.trim() ? validarCnpj(cnpj) : null;
    if (errCnpj) novos.cnpj = errCnpj;
    if (!EMAIL_RE.test(email.trim())) novos.email = "E-mail inválido.";
    const errSenha = validarSenhaEmpresa(senha);
    if (errSenha) novos.senha = errSenha;
    if (senha !== confirmaSenha) novos.confirmaSenha = "As senhas não coincidem.";
    if (!aceitouTermos) novos.termos = "Aceite os Termos de Uso para continuar.";
    if (!aceitouPrivacidade) novos.privacidade = "Aceite a Política de Privacidade para continuar.";
    setErros(novos);
    if (Object.keys(novos).length) return;

    setErroGeral("");
    setSalvando(true);
    const r = await api("/onboarding/criar-conta", {
      email: email.trim().toLowerCase(),
      senha,
      nomeEmpresa: nomeEmpresa.trim(),
      cnpj: cnpj.replace(/\D/g, ""),
    });
    setSalvando(false);

    if (!r || r.error) {
      if (r?.campo) setErros({ [r.campo]: r.error });
      else setErroGeral(r?.error || "Não foi possível criar a conta. Tente de novo.");
      return;
    }
    // Conta criada: entra direto na plataforma; a confirmação de e-mail fica para depois.
    if (r.autenticado) { window.location.href = "/"; return; }
    setModo("link-enviado");
  };

  if (modo === "recuperar") {
    return <RecuperarSenha onVoltar={() => setModo("criar")} />;
  }

  if (modo === "link-enviado") {
    return (
      <MolduraAuth
        tarja="Confirme seu e-mail"
        titulo="Link enviado!"
        subtitulo={`Enviamos um link de confirmação para ${email}. Clique nele para ativar sua conta.`}
      >
        <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: "var(--brand-50)",
            display: "grid", placeItems: "center", margin: "0 auto 16px",
          }}>
            <MailCheck size={28} strokeWidth={1.8} color="var(--brand)" aria-hidden="true" />
          </div>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 20px", lineHeight: 1.6 }}>
            Verifique também a pasta de spam. O link expira em 24 horas.
          </p>
          <button
            className="vx-btn vx-btn-ghost vx-btn-sm"
            style={{ minHeight: 44, width: "100%" }}
            onClick={async () => {
              const r = await api("/onboarding/criar-conta/reenviar", { email });
              if (r?.error) setErroGeral(r.error);
            }}
          >
            Reenviar link
          </button>
          {erroGeral && <div className="vx-onb-erro" role="alert" style={{ marginTop: 10 }}>{erroGeral}</div>}
        </div>
      </MolduraAuth>
    );
  }

  if (modo === "criar") {
    return (
      <MolduraAuth
        tarja="Empresa"
        titulo="Criar sua conta"
        subtitulo="Acesso rápido à plataforma. Você vai preencher os dados da empresa depois."
        logoWidth={130}
        compact
        rodape={
          <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }}
            onClick={() => setModo("inicio")}>
            ← Voltar
          </button>
        }
      >
        <form onSubmit={enviarCriarConta} noValidate>
          {erroGeral && <div className="vx-onb-erro" role="alert" style={{ marginBottom: 14 }}>{erroGeral}</div>}

          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-nome`}>Nome da empresa</label>
            <input
              id={`${id}-nome`} className="vx-input" type="text" autoComplete="organization"
              placeholder="Empresa Ltda" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)}
              aria-invalid={erros.nomeEmpresa ? true : undefined} aria-describedby={erros.nomeEmpresa ? `${id}-nome-erro` : undefined}
              style={{ minHeight: 48 }}
            />
            {erros.nomeEmpresa && <div id={`${id}-nome-erro`} className="vx-onb-erro" role="alert">{erros.nomeEmpresa}</div>}
          </div>

          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-cnpj`}>CNPJ <span className="vx-mut" style={{ fontWeight: 400 }}>(opcional)</span></label>
            <input
              id={`${id}-cnpj`} className="vx-input" type="text" inputMode="numeric" autoComplete="off"
              placeholder="00.000.000/0000-00" value={cnpj}
              onChange={(e) => setCnpj(formatarCnpj(e.target.value))}
              aria-invalid={erros.cnpj ? true : undefined} aria-describedby={erros.cnpj ? `${id}-cnpj-erro` : undefined}
              style={{ minHeight: 48 }}
            />
            {erros.cnpj && <div id={`${id}-cnpj-erro`} className="vx-onb-erro" role="alert">{erros.cnpj}</div>}
          </div>

          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-email`}>E-mail</label>
            <input
              id={`${id}-email`} className="vx-input" type="email" autoComplete="email"
              placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)}
              aria-invalid={erros.email ? true : undefined} aria-describedby={erros.email ? `${id}-email-erro` : undefined}
              style={{ minHeight: 48 }}
            />
            {erros.email && <div id={`${id}-email-erro`} className="vx-onb-campo vx-onb-erro" role="alert">{erros.email}</div>}
          </div>

          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-senha`}>Senha</label>
            <CampoSenha
              id={`${id}-senha`} value={senha} onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password" minLength={SENHA_MIN_EMPRESA}
              invalido={!!erros.senha} descricao={erros.senha ? `${id}-senha-erro` : `${id}-senha-dica`}
            />
            <div id={`${id}-senha-dica`} className="vx-onb-dica">Mínimo de {SENHA_MIN_EMPRESA} caracteres.</div>
            {erros.senha && <div id={`${id}-senha-erro`} className="vx-onb-erro" role="alert">{erros.senha}</div>}
          </div>

          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-confirma-senha`}>Confirmar senha</label>
            <CampoSenha
              id={`${id}-confirma-senha`} value={confirmaSenha} onChange={(e) => setConfirmaSenha(e.target.value)}
              autoComplete="new-password"
              invalido={!!erros.confirmaSenha} descricao={erros.confirmaSenha ? `${id}-confirma-senha-erro` : undefined}
            />
            {erros.confirmaSenha && <div id={`${id}-confirma-senha-erro`} className="vx-onb-erro" role="alert">{erros.confirmaSenha}</div>}
          </div>

          <div className="vx-onb-campo" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label
              style={{
                display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                border: `1.5px solid ${erros.termos ? "var(--erro, #e53e3e)" : aceitouTermos ? "var(--brand)" : "var(--border)"}`,
                borderRadius: 10, padding: "12px 14px", background: aceitouTermos ? "var(--brand-50, #f0fdff)" : "var(--surface)",
                transition: "border-color .15s, background .15s",
              }}
            >
              <input
                type="checkbox" checked={aceitouTermos} onChange={(e) => setAceitouTermos(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: "var(--brand)", flexShrink: 0 }}
                aria-describedby={erros.termos ? `${id}-termos-erro` : undefined}
              />
              <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                Li e aceito os{" "}
                <a href="https://rycs.pro/termos" target="_blank" rel="noreferrer" className="vx-onb-link" style={{ fontSize: "inherit" }}>
                  Termos de Uso
                </a>
              </span>
            </label>
            {erros.termos && <div id={`${id}-termos-erro`} className="vx-onb-erro" role="alert">{erros.termos}</div>}

            <label
              style={{
                display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                border: `1.5px solid ${erros.privacidade ? "var(--erro, #e53e3e)" : aceitouPrivacidade ? "var(--brand)" : "var(--border)"}`,
                borderRadius: 10, padding: "12px 14px", background: aceitouPrivacidade ? "var(--brand-50, #f0fdff)" : "var(--surface)",
                transition: "border-color .15s, background .15s",
              }}
            >
              <input
                type="checkbox" checked={aceitouPrivacidade} onChange={(e) => setAceitouPrivacidade(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: "var(--brand)", flexShrink: 0 }}
                aria-describedby={erros.privacidade ? `${id}-privacidade-erro` : undefined}
              />
              <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                Li e aceito a{" "}
                <a href="https://rycs.pro/privacidade" target="_blank" rel="noreferrer" className="vx-onb-link" style={{ fontSize: "inherit" }}>
                  Política de Privacidade
                </a>
              </span>
            </label>
            {erros.privacidade && <div id={`${id}-privacidade-erro`} className="vx-onb-erro" role="alert">{erros.privacidade}</div>}
          </div>

          <button
            type="submit"
            className="vx-btn vx-btn-primary vx-btn-block"
            style={{ minHeight: 48, marginTop: 6 }}
            disabled={salvando}
          >
            {salvando ? "Criando conta…" : "Criar conta e confirmar e-mail"}
          </button>

          <p style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", marginTop: 12 }}>
            Já tem conta?{" "}
            <button type="button" className="vx-onb-link" onClick={() => navegar(ROTAS.login)}>
              Entrar
            </button>
            {" · "}
            <button type="button" className="vx-onb-link" onClick={() => setModo("recuperar")}>
              Esqueci minha senha
            </button>
          </p>
        </form>
      </MolduraAuth>
    );
  }

  // modo === "inicio"
  return (
    <MolduraAuth
      tarja="Empresa"
      titulo="Como você quer começar?"
      subtitulo="Escolha o caminho que faz mais sentido para você agora."
      logoWidth={140}
      compact
      largura={560}
      rodape={
        <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ minHeight: 44 }}
          onClick={() => navegar(ROTAS.login)}>
          Já tenho conta — entrar
        </button>
      }
    >
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        <Opt
          icone={Users}
          titulo="Criar conta"
          descricao="Crie seu acesso e explore a plataforma. Você preenche os dados da empresa quando quiser."
          cta="Criar conta"
          onClick={() => setModo("criar")}
        />
        <Opt
          icone={Zap}
          titulo="Iniciar vendas"
          descricao="Configure tudo de uma vez: empresa, materiais, IA e plano. Pronto para sua primeira campanha."
          cta="Iniciar vendas agora"
          destaque
          onClick={iniciarVendas}
        />
      </div>
    </MolduraAuth>
  );
}

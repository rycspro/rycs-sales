import { useId, useState } from "react";
import { MailCheck } from "lucide-react";
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
// A empresa cria a conta por um formulário simples (e-mail, senha, termos) e
// entra direto na plataforma — sem onboarding guiado em etapas.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EntradaEmpresa() {
  const id = useId();
  const [modo, setModo] = useState("criar"); // criar | link-enviado | recuperar
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
    const AZUL = "#318CE7";
    return (
      <div style={{ position: "fixed", inset: 0, background: "var(--bg)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <style>{`.vx-login-card .vx-input:focus,.vx-login-card .vx-input:focus-visible{border-color:${AZUL};box-shadow:0 0 0 3px rgba(49,140,231,.15);outline:none}`}</style>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
          <div className="vx-fade vx-login-card" style={{ width: "100%", maxWidth: 420 }}>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <img src="/logo-rycs-sm.png" alt="RYCS Sales Machine"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                style={{ height: 40, width: "auto", margin: "0 auto 18px", display: "block" }} />
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: AZUL, marginBottom: 10 }}>Conta empresarial</div>
              <h1 className="vx-disp" style={{ fontSize: 27, fontWeight: 600, lineHeight: 1.2, color: "var(--ink)", margin: "0 0 8px" }}>Criar sua conta</h1>
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>Acesso rápido à plataforma. Você preenche os dados da empresa depois.</p>
            </div>

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
              style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer", padding: "2px 2px" }}
            >
              <input
                type="checkbox" checked={aceitouTermos} onChange={(e) => setAceitouTermos(e.target.checked)}
                style={{ width: 16, height: 16, marginTop: 1, accentColor: "var(--brand)", flexShrink: 0 }}
                aria-describedby={erros.termos ? `${id}-termos-erro` : undefined}
              />
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" }}>
                Li e aceito os{" "}
                <a href="https://rycs.pro/termos" target="_blank" rel="noreferrer" className="vx-onb-link" style={{ fontSize: "inherit" }}>
                  Termos de Uso
                </a>
              </span>
            </label>
            {erros.termos && <div id={`${id}-termos-erro`} className="vx-onb-erro" role="alert">{erros.termos}</div>}

            <label
              style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer", padding: "2px 2px" }}
            >
              <input
                type="checkbox" checked={aceitouPrivacidade} onChange={(e) => setAceitouPrivacidade(e.target.checked)}
                style={{ width: 16, height: 16, marginTop: 1, accentColor: "var(--brand)", flexShrink: 0 }}
                aria-describedby={erros.privacidade ? `${id}-privacidade-erro` : undefined}
              />
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" }}>
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
            disabled={salvando}
            onMouseEnter={(e) => { if (!salvando) e.currentTarget.style.background = "#2b7cd0"; }}
            onMouseLeave={(e) => { if (!salvando) e.currentTarget.style.background = AZUL; }}
            style={{
              marginTop: 18, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: AZUL, color: "#fff", border: "none", borderRadius: 10, padding: "13px 16px",
              fontWeight: 600, fontSize: 14.5, cursor: salvando ? "default" : "pointer", opacity: salvando ? 0.75 : 1,
              minHeight: 48, transition: "background .15s",
            }}
          >
            {salvando ? "Criando conta…" : "Criar conta e confirmar e-mail"}
          </button>

          <p style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", marginTop: 14 }}>
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
          </div>
        </div>
        <footer style={{ textAlign: "center", padding: 16, fontSize: 12, color: "var(--muted-2)" }}>© 2026 RYCS</footer>
      </div>
    );
  }

  return null;
}

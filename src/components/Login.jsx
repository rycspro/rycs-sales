import { useState, useEffect } from "react";
import { Campo, CampoSenha } from "./ui.jsx";
import MolduraAuth from "./auth/MolduraAuth.jsx";
import RecuperarSenha from "./auth/RecuperarSenha.jsx";
import Termos from "./auth/Termos.jsx";
import { api } from "../lib/api.js";
import { ROTAS, navegar, parametro } from "../lib/rotas.js";
import { useI18n } from "../lib/i18n.jsx";
import LangSwitcher from "./LangSwitcher.jsx";

// Entrada de quem já tem conta.
//
// O cadastro saiu daqui: profissional e empresa passaram a ter ambientes
// próprios, em endereços próprios. O login continua único porque o papel vem
// do backend — pedir que a pessoa escolha "entrar como" seria inventar uma
// decisão que o servidor já tomou, com o risco de ela escolher errado.

const DEMO_PASSWORD = "Demo@RYCS2026";

export default function Login({ onLogin, conviteTrial = false, beta = false }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showTermos, setShowTermos] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  useEffect(() => {
    const t = parametro("token");
    if (t) { setResetToken(t); setShowReset(true); return; }
    // Link de convite: quem chega por indicação está vindo criar conta, não
    // entrar. O código segue na query e o cadastro o lê de lá.
    if (parametro("ref")) navegar(ROTAS.cadastroVendedor);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(email, senha);
    setLoading(false);
  };

  const entrarDemo = async (tipo) => {
    const demoEmail = tipo === "empresa" ? "demo@rycs.pro" : "profissional.demo@rycs.pro";
    setEmail(demoEmail);
    setSenha(DEMO_PASSWORD);
    setLoading(true);
    await onLogin(demoEmail, DEMO_PASSWORD);
    setLoading(false);
  };

  const enviarReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    const r = await api("/auth/reset-password", { token: resetToken, senha: novaSenha });
    setResetMsg(r?.message || r?.error || "Erro");
    if (r?.ok) { setTimeout(() => { setShowReset(false); window.history.replaceState({}, "", "/"); }, 2000); }
    setLoading(false);
  };

  if (showReset) return (
    <MolduraAuth titulo="Redefinir senha" largura={420}>
      <form onSubmit={enviarReset}>
        <Campo label="Nova senha">
          <CampoSenha value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} minLength={6} autoComplete="new-password" descricao="dica-nova-senha" />
          <div id="dica-nova-senha" className="vx-onb-dica">Contas de empresa: mínimo de 8 caracteres.</div>
        </Campo>
        <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={loading}>Redefinir</button>
      </form>
      {resetMsg && <div className="vx-mut" role="status" style={{ marginTop: 12, textAlign: "center" }}>{resetMsg}</div>}
    </MolduraAuth>
  );

  if (showForgot) return (
    <MolduraAuth largura={420}>
      <RecuperarSenha emailInicial={email} onVoltar={() => setShowForgot(false)} />
    </MolduraAuth>
  );

  if (showTermos) return <Termos onAceitar={() => setShowTermos(false)} onVoltar={() => setShowTermos(false)} />;

  return (
    <MolduraAuth
      tarja={conviteTrial ? "Convite de teste gratuito" : undefined}
      subtitulo={conviteTrial
        ? "Entre com a conta da sua empresa para ativar o período gratuito. Se ainda não tem conta, crie uma abaixo — o convite continua valendo."
        : t("login.title")}
      largura={420}
      extra={<LangSwitcher />}>
      <form onSubmit={submit}>
        <Campo label={t("login.email")}>
          <input className="vx-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("login.emailPlaceholder")} required />
        </Campo>
        <Campo label={t("login.password")}>
          <CampoSenha value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={t("login.passwordPlaceholder")} />
        </Campo>
        <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? t("app.loading") : t("login.submit")}
        </button>
        <p className="vx-onb-termos" style={{ marginTop: 8 }}>
          {t("login.termsPrefix")}{" "}
          <button type="button" className="vx-onb-link" onClick={() => setShowTermos(true)}>{t("login.termsLink")}</button> {t("login.termsSuffix")}
        </p>
      </form>

      {beta && !conviteTrial && (
        <div className="vx-beta-login-panel">
          <div className="vx-eyebrow">{t("beta.title")}</div>
          <p>{t("beta.desc")}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="vx-btn vx-btn-primary" disabled={loading} onClick={() => entrarDemo("empresa")} style={{ flex: 1 }}>Entrar como Empresa Demo</button>
            <button className="vx-btn" disabled={loading} onClick={() => entrarDemo("profissional")} style={{ flex: 1 }}>Entrar como Profissional Demo</button>
          </div>
        </div>
      )}

      <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setShowForgot(true)} style={{ width: "100%", marginTop: 4, fontSize: 12.5 }}>
        {t("login.forgot")}
      </button>

      <hr className="vx-sep" style={{ margin: "8px 0" }} />

      <div className="vx-eyebrow" style={{ textAlign: "center", marginBottom: 6 }}>{t("login.noAccount")}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="vx-btn" style={{ flex: 1 }} onClick={() => navegar(ROTAS.cadastroVendedor)}>{t("login.signupPro")}</button>
        <button className="vx-btn" style={{ flex: 1 }} onClick={() => navegar(ROTAS.cadastroEmpresa)}>{t("login.signupCompany")}</button>
      </div>
    </MolduraAuth>
  );
}

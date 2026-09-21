import { useState, useEffect } from "react";
import { Campo } from "./ui.jsx";
import MolduraAuth from "./auth/MolduraAuth.jsx";
import { api } from "../lib/api.js";
import { ROTAS, navegar, parametro } from "../lib/rotas.js";

// Entrada de quem já tem conta.
//
// O cadastro saiu daqui: profissional e empresa passaram a ter ambientes
// próprios, em endereços próprios. O login continua único porque o papel vem
// do backend — pedir que a pessoa escolha "entrar como" seria inventar uma
// decisão que o servidor já tomou, com o risco de ela escolher errado.

export default function Login({ onLogin, conviteTrial = false }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
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

  const enviarForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    const r = await api("/auth/forgot-password", { email: forgotEmail });
    setForgotMsg(r?.message || "Link enviado, se o e-mail existir.");
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
        <Campo label="Nova senha"><input className="vx-input" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} minLength={6} required /></Campo>
        <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={loading}>Redefinir</button>
      </form>
      {resetMsg && <div className="vx-mut" style={{ marginTop: 12, textAlign: "center" }}>{resetMsg}</div>}
    </MolduraAuth>
  );

  if (showForgot) return (
    <MolduraAuth titulo="Esqueci minha senha" largura={420}
      subtitulo="Informe seu e-mail para receber o link de redefinição.">
      <form onSubmit={enviarForgot}>
        <Campo label="E-mail"><input className="vx-input" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required /></Campo>
        <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={loading}>Enviar link</button>
      </form>
      {forgotMsg && <div className="vx-mut" style={{ marginTop: 12, textAlign: "center" }}>{forgotMsg}</div>}
      <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setShowForgot(false)} style={{ marginTop: 8, width: "100%" }}>Voltar ao login</button>
    </MolduraAuth>
  );

  return (
    <MolduraAuth
      tarja={conviteTrial ? "Convite de teste gratuito" : undefined}
      subtitulo={conviteTrial
        ? "Entre com a conta da sua empresa para ativar o período gratuito. Se ainda não tem conta, crie uma abaixo — o convite continua valendo."
        : "Entre na sua conta"}
      largura={420}>
      <form onSubmit={submit}>
        <Campo label="E-mail">
          <input className="vx-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
        </Campo>
        <Campo label="Senha">
          <input className="vx-input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
        </Campo>
        <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? "Carregando…" : "Entrar"}
        </button>
      </form>

      <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setShowForgot(true)} style={{ width: "100%", marginTop: 8, fontSize: 12.5 }}>
        Esqueci minha senha
      </button>

      <hr className="vx-sep" />

      <div className="vx-eyebrow" style={{ textAlign: "center", marginBottom: 10 }}>Ainda não tem conta?</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="vx-btn" style={{ flex: 1 }} onClick={() => navegar(ROTAS.cadastroVendedor)}>Sou profissional</button>
        <button className="vx-btn" style={{ flex: 1 }} onClick={() => navegar(ROTAS.cadastroEmpresa)}>Sou empresa</button>
      </div>
    </MolduraAuth>
  );
}

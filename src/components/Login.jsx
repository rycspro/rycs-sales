import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Campo, CampoSenha } from "./ui.jsx";
import MolduraAuth from "./auth/MolduraAuth.jsx";
import RecuperarSenha from "./auth/RecuperarSenha.jsx";
import Termos from "./auth/Termos.jsx";
import ComboSelect from "./ui/ComboSelect.jsx";
import { api } from "../lib/api.js";
import { ROTAS, navegar, parametro } from "../lib/rotas.js";
import { useI18n } from "../lib/i18n.jsx";

// Entrada de quem já tem conta.
//
// O cadastro saiu daqui: profissional e empresa passaram a ter ambientes
// próprios, em endereços próprios. O login continua único porque o papel vem
// do backend — pedir que a pessoa escolha "entrar como" seria inventar uma
// decisão que o servidor já tomou, com o risco de ela escolher errado.

const DEMO_PASSWORD = "Demo@RYCS2026";

const IDIOMAS = [
  { value: "pt-BR", label: "🇧🇷 Português", keywords: "portugues portuguese brasil" },
  { value: "en", label: "🇺🇸 English", keywords: "ingles english" },
  { value: "es", label: "🇪🇸 Español", keywords: "espanhol spanish" },
  { value: "zh", label: "🇨🇳 中文", keywords: "mandarim chines chinese zhongwen" },
  { value: "hi", label: "🇮🇳 हिन्दी", keywords: "hindi" },
  { value: "ar", label: "🇸🇦 العربية", keywords: "arabe arabic" },
  { value: "fr", label: "🇫🇷 Français", keywords: "frances french" },
  { value: "bn", label: "🇧🇩 বাংলা", keywords: "bengali bangla" },
  { value: "ru", label: "🇷🇺 Русский", keywords: "russo russian" },
  { value: "id", label: "🇮🇩 Bahasa Indonesia", keywords: "indonesio indonesian" },
];

export default function Login({ onLogin, conviteTrial = false, beta = false }) {
  const { t, locale, setLocale } = useI18n();
  // Fluxo de entrada: idioma → qual conta → login. O convite de trial pula o
  // portão e vai direto ao login, que é um fluxo focado por si só.
  const [etapa, setEtapa] = useState(conviteTrial ? "login" : "idioma");
  const [idioma, setIdioma] = useState(locale || "");
  const [contaTipo, setContaTipo] = useState("");
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

  const escolherIdioma = (valor) => {
    setIdioma(valor);
    // Ativa o idioma na hora: as próximas telas (conta, login) já renderizam
    // traduzidas. O provider persiste a escolha.
    setLocale(valor || "pt-BR");
  };

  if (etapa === "idioma") {
    const AZUL = "#318CE7";
    return (
      <div style={{ position: "fixed", inset: 0, background: "var(--bg)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <style>{`.vx-idioma-card .vx-input:focus,.vx-idioma-card .vx-input:focus-visible{border-color:${AZUL};box-shadow:0 0 0 3px rgba(49,140,231,.15);outline:none}`}</style>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
          <div className="vx-fade" style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
            <img src="/logo-rycs.png" alt="RYCS Sales Machine"
              onError={(e) => { e.currentTarget.style.display = "none"; const t2 = e.currentTarget.nextSibling; if (t2) t2.style.display = "block"; }}
              style={{ width: 148, margin: "0 auto 22px" }} />
            <span className="vx-disp" style={{ display: "none", fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "var(--brand)", margin: "0 auto 22px" }}>RYCS</span>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: AZUL, marginBottom: 12 }}>{t("idioma.eyebrow")}</div>
            <h1 className="vx-disp" style={{ fontSize: 25, lineHeight: 1.22, color: "var(--ink)", margin: "0 0 10px" }}>{t("idioma.titulo")}</h1>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 24px" }}>{t("idioma.descricao")}</p>
            <div className="vx-idioma-card" style={{ background: "var(--surface-solid)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: 20, textAlign: "left" }}>
              <label className="vx-label" style={{ display: "block", marginBottom: 8 }}>{t("idioma.label")}</label>
              <ComboSelect opcoes={IDIOMAS} valor={idioma} onChange={escolherIdioma} placeholder={t("idioma.label")} name="idioma" />
              <button type="button" disabled={!idioma} onClick={() => setEtapa("conta")}
                onMouseEnter={(e) => { if (idioma) e.currentTarget.style.background = "#2b7cd0"; }}
                onMouseLeave={(e) => { if (idioma) e.currentTarget.style.background = AZUL; }}
                style={{
                  marginTop: 14, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  background: idioma ? AZUL : "var(--surface-3)", color: idioma ? "#fff" : "var(--muted-2)",
                  border: "none", borderRadius: 10, padding: "12px 16px", fontWeight: 600, fontSize: 14.5,
                  cursor: idioma ? "pointer" : "not-allowed", minHeight: 46, transition: "background .15s",
                }}>
                {t("comum.continuar")} <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        <footer style={{ textAlign: "center", padding: 16, fontSize: 12, color: "var(--muted-2)" }}>© 2026 RYCS</footer>
      </div>
    );
  }

  if (etapa === "conta") {
    const cardBase = {
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8,
      padding: "20px 14px", border: "1.5px solid var(--border)", borderRadius: "var(--radius-md)",
      background: "var(--surface)", cursor: "pointer", transition: "border-color .15s, background .15s, transform .15s", minHeight: 150,
    };
    const realce = (e, on) => {
      e.currentTarget.style.borderColor = on ? "var(--brand)" : "var(--border)";
      e.currentTarget.style.background = on ? "var(--brand-50)" : "var(--surface)";
    };
    const escolherConta = (tipo) => { setContaTipo(tipo); setEtapa("login"); };
    const Card = ({ tipo, icone, titulo, texto }) => (
      <button type="button" style={cardBase}
        onClick={() => escolherConta(tipo)}
        onMouseEnter={(e) => realce(e, true)} onMouseLeave={(e) => realce(e, false)}
        onFocus={(e) => realce(e, true)} onBlur={(e) => realce(e, false)}>
        <span style={{ fontSize: 34, lineHeight: 1 }} aria-hidden="true">{icone}</span>
        <span style={{ fontWeight: 700, fontSize: 15.5, color: "var(--ink)" }}>{titulo}</span>
        <span className="vx-mut" style={{ fontSize: 12.5, lineHeight: 1.45 }}>{texto}</span>
      </button>
    );
    return (
      <MolduraAuth titulo={t("conta.titulo")} subtitulo={t("conta.subtitulo")} largura={480}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Card tipo="profissional" icone="🤝" titulo={t("conta.profissional")}
            texto={t("conta.profissionalDesc")} />
          <Card tipo="empresa" icone="🏢" titulo={t("conta.empresa")}
            texto={t("conta.empresaDesc")} />
        </div>
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setEtapa("idioma")} style={{ width: "100%", marginTop: 10, fontSize: 12.5 }}>
          {t("comum.voltar")}
        </button>
      </MolduraAuth>
    );
  }

  return (
    <MolduraAuth
      tarja={conviteTrial ? "Convite de teste gratuito" : contaTipo === "empresa" ? t("login.tarjaEmpresa") : contaTipo === "profissional" ? t("login.tarjaProfissional") : undefined}
      subtitulo={conviteTrial
        ? "Entre com a conta da sua empresa para ativar o período gratuito. Se ainda não tem conta, crie uma abaixo — o convite continua valendo."
        : t("login.subtitulo")}
      largura={420}>
      <form onSubmit={submit}>
        <Campo label={t("login.email")}>
          <input className="vx-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
        </Campo>
        <Campo label={t("login.senha")}>
          <CampoSenha value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Sua senha" />
        </Campo>
        <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? t("login.carregando") : t("login.entrar")}
        </button>
        <p className="vx-onb-termos" style={{ marginTop: 8 }}>
          {t("login.aceiteTermos").split("{termos}")[0]}
          <button type="button" className="vx-onb-link" onClick={() => setShowTermos(true)}>{t("login.termosLink")}</button>
          {t("login.aceiteTermos").split("{termos}")[1]}
        </p>
      </form>

      {beta && !conviteTrial && (
        <div className="vx-beta-login-panel">
          <div className="vx-eyebrow">AMBIENTE BETA — DADOS FICTÍCIOS</div>
          <p>Nenhuma movimentação financeira possui valor real. Os dados podem ser resetados e existem apenas para testes.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="vx-btn vx-btn-primary" disabled={loading} onClick={() => entrarDemo("empresa")} style={{ flex: 1 }}>Entrar como Empresa Demo</button>
            <button className="vx-btn" disabled={loading} onClick={() => entrarDemo("profissional")} style={{ flex: 1 }}>Entrar como Profissional Demo</button>
          </div>
        </div>
      )}

      <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setShowForgot(true)} style={{ width: "100%", marginTop: 4, fontSize: 12.5 }}>
        {t("login.esqueciSenha")}
      </button>

      <hr className="vx-sep" style={{ margin: "8px 0" }} />

      <div className="vx-eyebrow" style={{ textAlign: "center", marginBottom: 6 }}>{t("login.semConta")}</div>
      {contaTipo === "empresa" ? (
        <button className="vx-btn vx-btn-block" onClick={() => navegar(ROTAS.cadastroEmpresa)}>{t("login.criarEmpresa")}</button>
      ) : contaTipo === "profissional" ? (
        <button className="vx-btn vx-btn-block" onClick={() => navegar(ROTAS.cadastroVendedor)}>{t("login.criarProfissional")}</button>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button className="vx-btn" style={{ flex: 1 }} onClick={() => navegar(ROTAS.cadastroVendedor)}>{t("login.souProfissional")}</button>
          <button className="vx-btn" style={{ flex: 1 }} onClick={() => navegar(ROTAS.cadastroEmpresa)}>{t("login.souEmpresa")}</button>
        </div>
      )}
      {!conviteTrial && (
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setEtapa("conta")} style={{ width: "100%", marginTop: 8, fontSize: 12.5 }}>
          {t("login.trocarConta")}
        </button>
      )}
    </MolduraAuth>
  );
}

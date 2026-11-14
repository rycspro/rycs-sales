import { useState, useEffect } from "react";
import { ArrowRight, ArrowLeft, UserRound, Building2, Check } from "lucide-react";
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
  const [selecionado, setSelecionado] = useState("");
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
            <img src="/logo-rycs-sm.png" alt="RYCS Sales Machine"
              onError={(e) => { e.currentTarget.style.display = "none"; const t2 = e.currentTarget.nextSibling; if (t2) t2.style.display = "block"; }}
              style={{ height: 44, width: "auto", margin: "0 auto 22px", display: "block" }} />
            <span className="vx-disp" style={{ display: "none", fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "var(--brand)", margin: "0 auto 22px" }}>RYCS</span>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: AZUL, marginBottom: 12 }}>{t("idioma.eyebrow")}</div>
            <h1 className="vx-disp" style={{ fontSize: 25, lineHeight: 1.22, color: "var(--ink)", margin: "0 0 10px" }}>{t("idioma.titulo")}</h1>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, margin: locale === "en" ? "0 0 24px" : "0 0 4px" }}>{t("idioma.descricao")}</p>
            {locale !== "en" && (
              <p style={{ fontSize: 13, color: "var(--muted-2)", lineHeight: 1.5, margin: "0 0 24px" }}>
                Select your language to continue and explore the platform.
              </p>
            )}
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
    const AZUL = "#318CE7";
    const continuar = () => { if (selecionado) { setContaTipo(selecionado); setEtapa("login"); } };
    const Card = ({ tipo, Icone, titulo, desc, acao }) => {
      const sel = selecionado === tipo;
      return (
        <button type="button" aria-pressed={sel} onClick={() => setSelecionado(tipo)}
          onMouseEnter={(e) => { if (!sel) { e.currentTarget.style.borderColor = "rgba(49,140,231,.45)"; e.currentTarget.style.background = "rgba(49,140,231,.03)"; } }}
          onMouseLeave={(e) => { if (!sel) { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.background = "var(--surface-solid)"; } }}
          style={{
            position: "relative", flex: "1 1 300px", minWidth: 0, textAlign: "start",
            display: "flex", flexDirection: "column", gap: 10, padding: "22px 20px",
            border: `1.5px solid ${sel ? AZUL : "var(--border-strong)"}`, borderRadius: 14,
            background: sel ? "rgba(49,140,231,.06)" : "var(--surface-solid)",
            cursor: "pointer", transition: "border-color .15s, background .15s",
          }}>
          {sel && (
            <span style={{ position: "absolute", top: 14, insetInlineEnd: 14, width: 20, height: 20, borderRadius: "50%", background: AZUL, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Check size={13} aria-hidden="true" />
            </span>
          )}
          <span style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(49,140,231,.10)", color: AZUL, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone size={22} aria-hidden="true" />
          </span>
          <span style={{ fontWeight: 600, fontSize: 16.5, color: "var(--ink)" }}>{titulo}</span>
          <span style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>{desc}</span>
          <span style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, color: AZUL, fontWeight: 600, fontSize: 13 }}>
            {acao} <ArrowRight size={15} aria-hidden="true" />
          </span>
        </button>
      );
    };
    return (
      <div style={{ position: "fixed", inset: 0, background: "var(--bg)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <style>{`.vx-perfil-cards button:focus-visible{outline:2px solid ${AZUL};outline-offset:2px}`}</style>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
          <div className="vx-fade" style={{ width: "100%", maxWidth: 720 }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <img src="/logo-rycs-sm.png" alt="RYCS Sales Machine"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                style={{ height: 40, width: "auto", margin: "0 auto 20px", display: "block" }} />
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: AZUL, marginBottom: 10 }}>{t("conta.eyebrow")}</div>
              <h1 className="vx-disp" style={{ fontSize: 23, fontWeight: 600, lineHeight: 1.25, color: "var(--ink)", margin: "0 0 8px" }}>{t("conta.titulo")}</h1>
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>{t("conta.subtitulo")}</p>
            </div>
            <div className="vx-perfil-cards" style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <Card tipo="profissional" Icone={UserRound} titulo={t("conta.profissional")} desc={t("conta.profissionalDesc")} acao={t("conta.profissionalAcao")} />
              <Card tipo="empresa" Icone={Building2} titulo={t("conta.empresa")} desc={t("conta.empresaDesc")} acao={t("conta.empresaAcao")} />
            </div>
            <button type="button" disabled={!selecionado} onClick={continuar}
              onMouseEnter={(e) => { if (selecionado) e.currentTarget.style.background = "#2b7cd0"; }}
              onMouseLeave={(e) => { if (selecionado) e.currentTarget.style.background = AZUL; }}
              style={{
                marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: selecionado ? AZUL : "var(--surface-3)", color: selecionado ? "#fff" : "var(--muted-2)",
                border: "none", borderRadius: 10, padding: "13px 16px", fontWeight: 600, fontSize: 14.5,
                cursor: selecionado ? "pointer" : "not-allowed", minHeight: 48, transition: "background .15s",
              }}>
              {t("comum.continuar")} <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setEtapa("idioma")}
              style={{ margin: "12px auto 0", display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>
              <ArrowLeft size={14} aria-hidden="true" /> {t("comum.voltar")}
            </button>
          </div>
        </div>
        <footer style={{ textAlign: "center", padding: 16, fontSize: 12, color: "var(--muted-2)" }}>© 2026 RYCS</footer>
      </div>
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

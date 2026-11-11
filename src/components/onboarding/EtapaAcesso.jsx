import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Trash2 } from "lucide-react";
import { CampoSenha } from "../ui.jsx";
import Termos from "../auth/Termos.jsx";
import RecuperarSenha from "../auth/RecuperarSenha.jsx";
import MolduraOnboarding from "./MolduraOnboarding.jsx";
import { api } from "../../lib/api.js";
import { parametro, limparConviteOnboarding, ROTAS, navegar } from "../../lib/rotas.js";
import { ETAPAS, SENHA_MIN_EMPRESA, validarSenhaEmpresa, normalizarWhatsapp, LOGO_MAX_BYTES, avaliarLogo } from "../../../shared/onboarding.js";
import { useI18n } from "../../lib/i18n.jsx";

// Etapa 1 do onboarding para quem ainda não tem conta: criar o acesso
// (nome e logo da empresa, e-mail, senha e WhatsApp), entrar com uma conta existente ou recuperar a
// senha, tudo na mesma tela. Quem chega por convite do admin tem o e-mail
// travado no do convite.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Máscara enquanto digita: (11) 91234-5678.
function mascaraWhatsapp(valor) {
  const d = String(valor || "").replace(/\D/g, "").replace(/^55(?=\d{10,})/, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const lerArquivo = (arquivo) => new Promise((ok, falha) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => falha(r.error);
  r.readAsDataURL(arquivo);
});

function Campo({ id, label, erro, dica, children }) {
  return (
    <div className="vx-onb-campo">
      <label className="vx-label" htmlFor={id}>{label}</label>
      {children}
      {dica && <div id={`${id}-dica`} className="vx-onb-dica">{dica}</div>}
      {erro && <div id={`${id}-erro`} className="vx-onb-erro" role="alert">{erro}</div>}
    </div>
  );
}

export default function EtapaAcesso({ onRegister, onLogin, conviteToken = null }) {
  const { t } = useI18n();
  const id = useId();
  const [modo, setModo] = useState("cadastro"); // cadastro | login | recuperar | termos
  const [fase, setFase] = useState("intro"); // intro | form — só relevante quando modo=cadastro
  const [voltarPara, setVoltarPara] = useState("cadastro");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [nome, setNome] = useState("");
  // Logo fica só no navegador até o cadastro: { dataUri, mimetype }.
  const [logo, setLogo] = useState(null);
  const inputLogo = useRef(null);
  const [indicacao, setIndicacao] = useState(() => (parametro("ref") || "").toUpperCase());
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Convite: null = sem convite; { carregando } enquanto consulta.
  // Quem chega por convite ou com conviteToken vai direto para o formulário.
  const [convite, setConvite] = useState(conviteToken ? { carregando: true } : null);
  useEffect(() => { if (conviteToken) setFase("form"); }, [conviteToken]);
  useEffect(() => {
    if (!conviteToken) return;
    let vivo = true;
    api(`/onboarding/convites/${encodeURIComponent(conviteToken)}`).then((r) => {
      if (!vivo) return;
      if (r?.ok) { setConvite({ ok: true, email: r.email, trialDias: r.trialDias }); setEmail(r.email); }
      else { setConvite({ ok: false, erro: r?.error || "Não foi possível validar o convite." }); limparConviteOnboarding(); }
    });
    return () => { vivo = false; };
  }, [conviteToken]);
  const conviteValido = convite?.ok === true;

  const limparErro = (campo) => setErros((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  const trocarModo = (novo) => { setErros({}); setErroGeral(""); setModo(novo); if (novo !== "cadastro") setFase("form"); };

  const validar = () => {
    const e = {};
    if (!EMAIL_RE.test(email.trim())) e.email = t("onb.access.errEmail");
    if (modo === "cadastro") {
      const s = validarSenhaEmpresa(senha);
      if (s) e.senha = s;
      if (!normalizarWhatsapp(whatsapp)) e.whatsapp = t("onb.access.errWhatsapp");
      if (nome.trim().length < 2) e.nome = t("onb.access.errName");
      if (!logo) e.logo = t("onb.access.errLogo");
    } else if (!senha) e.senha = t("onb.access.errPassword");
    setErros(e);
    return !Object.keys(e).length;
  };

  const escolherLogo = async (arquivo) => {
    if (inputLogo.current) inputLogo.current.value = "";
    if (!arquivo) return;
    limparErro("logo");
    try {
      const svgTexto = arquivo.type === "image/svg+xml" ? await arquivo.text() : "";
      const erro = avaliarLogo({ mimetype: arquivo.type, tamanhoBytes: arquivo.size, svgTexto });
      if (erro) { setErros((e) => ({ ...e, logo: erro })); return; }
      setLogo({ dataUri: await lerArquivo(arquivo), mimetype: arquivo.type });
    } catch {
      setErros((e) => ({ ...e, logo: "Não foi possível ler o arquivo. Tente outro." }));
    }
  };

  const enviar = async (ev) => {
    ev.preventDefault();
    setErroGeral("");
    if (!validar()) return;
    setSalvando(true);
    if (modo === "cadastro") {
      const r = await onRegister({
        role: "empresa", email: email.trim(), senha, whats: whatsapp, nome: nome.trim(),
        logo: { base64: logo.dataUri.split(",")[1], mimetype: logo.mimetype },
        aceitouTermos: true, indicacao: indicacao || undefined,
        convite: conviteValido ? conviteToken : undefined,
      });
      setSalvando(false);
      if (r?.ok) { limparConviteOnboarding(); return; }
      if (r?.campo) setErros({ [r.campo]: r.error });
      else setErroGeral(r?.error || t("onb.access.errCreateAccess"));
      return;
    }
    const r = await onLogin(email.trim(), senha);
    setSalvando(false);
    if (!r?.ok) setErroGeral(r?.error || t("onb.access.errLogin"));
  };

  if (modo === "termos") return <Termos onAceitar={() => setModo(voltarPara)} onVoltar={() => setModo(voltarPara)} />;

  const trial = conviteValido && convite.trialDias > 0 ? convite.trialDias : 0;
  const proximos = ETAPAS.slice(1).map((e) => ({
    ...e,
    texto: {
      empresa: t("onb.access.nextCompany"),
      academy: t("onb.access.nextAcademy"),
      ia: t("onb.access.nextAI"),
      plano: trial ? t("onb.access.nextPlanTrial", { days: trial }) : t("onb.access.nextPlan"),
      campanha: t("onb.access.nextCampaign"),
    }[e.chave],
  }));

  const props = (campo) => ({
    "aria-invalid": erros[campo] ? true : undefined,
    "aria-describedby": [erros[campo] && `${id}-${campo}-erro`, `${id}-${campo}-dica`].filter(Boolean).join(" ") || undefined,
  });

  // --- Tela intro do quiz ---
  if (modo === "cadastro" && fase === "intro") {
    return (
      <MolduraOnboarding etapas={{}} ativa="acesso" semCabecalho>
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          padding: "32px 20px", background: "var(--bg)",
        }}>
          <div className="vx-fade" style={{ width: "100%", maxWidth: 560 }}>
            <button
              type="button"
              onClick={() => navegar(ROTAS.cadastroEmpresa)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "none", border: "none", cursor: "pointer",
                color: "var(--muted)", fontSize: 13.5, padding: "0 0 24px", fontFamily: "inherit",
              }}
              aria-label="Voltar para escolha de acesso"
            >
              <ArrowLeft size={15} strokeWidth={2.3} aria-hidden="true" />
              {t("onb.back")}
            </button>
            <div className="vx-onb-eyebrow" style={{ marginBottom: 16 }}>{t("onb.stepOf", { n: 1, total: 6 })}</div>
            <h1 style={{ fontSize: "clamp(26px, 5vw, 38px)", lineHeight: 1.15, fontFamily: "var(--font-disp)", fontWeight: 800, color: "var(--ink)", margin: "0 0 16px" }}>
              {t("onb.access.heroTitle")}
            </h1>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--muted)", margin: "0 0 28px" }}>
              {t("onb.access.heroDesc")}
            </p>
            <ul className="vx-onb-proximos" aria-label={t("onb.access.nextSteps")} style={{ marginBottom: 36 }}>
              {proximos.map((e) => <li key={e.chave}><span aria-hidden="true">{e.n}</span>{e.texto}</li>)}
            </ul>
            <button
              className="vx-btn vx-btn-primary vx-btn-block"
              style={{ minHeight: 54, fontSize: 16, fontWeight: 700 }}
              onClick={() => setFase("form")}
            >
              {t("onb.access.startNow")}
            </button>
            <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
              {t("onb.access.hasAccount")}{" "}
              <button type="button" className="vx-onb-link" onClick={() => { trocarModo("login"); setFase("form"); }}>
                {t("onb.access.login")}
              </button>
            </p>
          </div>
        </div>
      </MolduraOnboarding>
    );
  }

  // --- Tela de formulário (quiz) ---
  return (
    <MolduraOnboarding etapas={{}} ativa="acesso" semCabecalho>
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 20px", background: "var(--bg)",
      }}>
        <div className="vx-fade" style={{ width: "100%", maxWidth: 520 }}>
          {modo !== "recuperar" && (
            <button
              type="button" className="vx-onb-link"
              style={{ fontSize: 13, marginBottom: 20, display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44 }}
              onClick={() => { trocarModo("cadastro"); setFase("intro"); }}
            >
              ← {t("onb.back")}
            </button>
          )}

          <div className="vx-onb-card" aria-live="polite">
            {modo === "recuperar" ? (
              <RecuperarSenha emailInicial={email} onVoltar={() => trocarModo("login")} />
            ) : (
              <form onSubmit={enviar} noValidate>
                <h2 className="vx-disp vx-onb-card-titulo">{modo === "cadastro" ? t("onb.access.createAccess") : t("onb.access.accessAccount")}</h2>
                <p className="vx-mut vx-onb-card-apoio">
                  {modo === "cadastro" ? t("onb.access.createDesc") : t("onb.access.loginDesc")}
                </p>

                {convite?.carregando && <div className="vx-onb-aviso">{t("onb.access.checkingInvite")}</div>}
                {conviteValido && (
                  <div className="vx-onb-aviso">
                    {t("onb.access.inviteFor")} <b>{convite.email}</b>.{trial ? ` ${t("onb.access.trialIncluded", { days: trial })}` : ""}
                  </div>
                )}
                {convite?.ok === false && <div className="vx-onb-erro" role="alert">{convite.erro}</div>}

                {modo === "cadastro" && <>
                  <div className="vx-onb-campo">
                    <span className="vx-label" id={`${id}-logo-rotulo`}>{t("onb.access.companyLogo")}</span>
                    <div className="vx-onb-logo">
                      <div className="vx-onb-logo-previa" aria-hidden={!logo}>
                        {logo ? <img src={logo.dataUri} alt={t("onb.access.logoChosen")} /> : <ImagePlus size={22} aria-hidden="true" />}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" className="vx-btn" style={{ minHeight: 44 }}
                          aria-describedby={[`${id}-logo-rotulo`, `${id}-logo-dica`, erros.logo && `${id}-logo-erro`].filter(Boolean).join(" ")}
                          onClick={() => inputLogo.current?.click()}>
                          {logo ? t("onb.access.changeLogo") : t("onb.access.uploadLogo")}
                        </button>
                        {logo && (
                          <button type="button" className="vx-btn vx-btn-ghost" style={{ minHeight: 44 }} onClick={() => setLogo(null)}>
                            <Trash2 size={15} aria-hidden="true" /> {t("onb.access.remove")}
                          </button>
                        )}
                      </div>
                      <input ref={inputLogo} type="file" hidden accept="image/png,image/svg+xml,image/jpeg,image/webp"
                        onChange={(e) => escolherLogo(e.target.files?.[0])} />
                    </div>
                    <div id={`${id}-logo-dica`} className="vx-onb-dica">{t("onb.access.logoHint", { mb: Math.round(LOGO_MAX_BYTES / 1024 / 1024) })}</div>
                    {erros.logo && <div id={`${id}-logo-erro`} className="vx-onb-erro" role="alert">{erros.logo}</div>}
                  </div>

                  <Campo id={`${id}-nome`} label={t("onb.access.companyName")} erro={erros.nome}>
                    <input id={`${id}-nome`} className="vx-input" autoComplete="organization" maxLength={100}
                      value={nome} onChange={(e) => { setNome(e.target.value); limparErro("nome"); }} {...props("nome")} />
                  </Campo>
                </>}

                <Campo id={`${id}-email`} label={t("onb.access.email")} erro={erros.email}>
                  <input id={`${id}-email`} className="vx-input" type="email" autoComplete="email" inputMode="email"
                    value={email} onChange={(e) => { setEmail(e.target.value); limparErro("email"); }} readOnly={conviteValido && modo === "cadastro"} {...props("email")} />
                </Campo>

                <Campo id={`${id}-senha`} label={t("onb.access.password")} erro={erros.senha}
                  dica={modo === "cadastro" ? t("onb.access.passwordHintCreate", { min: SENHA_MIN_EMPRESA }) : t("onb.access.passwordHint")}>
                  <CampoSenha id={`${id}-senha`} value={senha} onChange={(e) => { setSenha(e.target.value); limparErro("senha"); }}
                    autoComplete={modo === "cadastro" ? "new-password" : "current-password"} required={false}
                    invalido={!!erros.senha} descricao={props("senha")["aria-describedby"]} />
                </Campo>

                {modo === "cadastro" && <>
                  <Campo id={`${id}-whatsapp`} label="WhatsApp" erro={erros.whatsapp} dica={t("onb.access.whatsappDica")}>
                    <input id={`${id}-whatsapp`} className="vx-input" type="tel" inputMode="numeric" autoComplete="tel-national"
                      placeholder="(11) 91234-5678" value={whatsapp} onChange={(e) => { setWhatsapp(mascaraWhatsapp(e.target.value)); limparErro("whatsapp"); }} {...props("whatsapp")} />
                  </Campo>
                  {indicacao && (
                    <Campo id={`${id}-indicacao`} label={t("onb.access.referralCode")}>
                      <input id={`${id}-indicacao`} className="vx-input vx-mono" value={indicacao}
                        onChange={(e) => setIndicacao(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} />
                    </Campo>
                  )}
                </>}

                {modo === "login" && (
                  <button type="button" className="vx-onb-link" style={{ minHeight: 44 }} onClick={() => trocarModo("recuperar")}>
                    {t("onb.access.forgotPassword")}
                  </button>
                )}

                {erroGeral && <div className="vx-onb-erro" role="alert">{erroGeral}</div>}

                <button className="vx-btn vx-btn-primary vx-btn-block vx-onb-btn" type="submit" disabled={salvando || convite?.carregando}>
                  {salvando ? (modo === "cadastro" ? t("onb.access.creating") : t("onb.access.loggingIn")) : t("onb.continue")}
                </button>

                <p className="vx-onb-termos">
                  {t("onb.access.termsPrefix")}{" "}
                  <button type="button" className="vx-onb-link" onClick={() => { setVoltarPara(modo); setModo("termos"); }}>{t("onb.access.termsLink")}</button> {t("onb.access.termsSuffix")}
                </p>

                <hr className="vx-sep" />
                {modo === "cadastro"
                  ? <button type="button" className="vx-btn vx-btn-ghost vx-btn-block vx-onb-btn" onClick={() => trocarModo("login")}>{t("onb.access.switchToLogin")}</button>
                  : <button type="button" className="vx-btn vx-btn-ghost vx-btn-block vx-onb-btn" onClick={() => trocarModo("cadastro")}>{t("onb.access.switchToRegister")}</button>}
              </form>
            )}
          </div>
        </div>
      </div>
    </MolduraOnboarding>
  );
}

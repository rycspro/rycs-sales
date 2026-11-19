import { useEffect, useId, useRef, useState } from "react";
import { MailCheck, ImagePlus, Trash2 } from "lucide-react";
import { CampoSenha } from "../ui.jsx";
import RecuperarSenha from "./RecuperarSenha.jsx";
import MolduraAuth from "./MolduraAuth.jsx";
import ComboSelect from "../ui/ComboSelect.jsx";
import { api } from "../../lib/api.js";
import { cadastroConcluido, dadosRastreio, rastrear } from "../../lib/rastreio.js";
import { ROTAS, navegar } from "../../lib/rotas.js";
import { SENHA_MIN_EMPRESA, validarSenhaEmpresa, LOGO_MAX_BYTES, avaliarLogo } from "../../../shared/onboarding.js";
import { useI18n } from "../../lib/i18n.jsx";
import { PAISES, paisPadraoPorLocale, moedaDoPais } from "../../../shared/paises.js";

// Página pública de entrada da empresa.
// A empresa cria a conta por um formulário simples (e-mail, senha, termos) e
// entra direto na plataforma — sem onboarding guiado em etapas.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EntradaEmpresa() {
  const id = useId();
  const { locale } = useI18n();
  const [modo, setModo] = useState("criar"); // criar | link-enviado | recuperar
  const [email, setEmail] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [logo, setLogo] = useState(null); // { dataUri, mimetype } — só no navegador até criar a conta
  const inputLogo = useRef(null);
  const [pais, setPais] = useState(() => paisPadraoPorLocale(locale));
  const [senha, setSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [aceitouPrivacidade, setAceitouPrivacidade] = useState(false);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { rastrear("cadastro_aberto", { papel: "empresa" }); }, []);

  const escolherLogo = async (arquivo) => {
    if (inputLogo.current) inputLogo.current.value = "";
    if (!arquivo) return;
    setErros((e) => { const { logo: _l, ...resto } = e; return resto; });
    try {
      const svgTexto = arquivo.type === "image/svg+xml" ? await arquivo.text() : "";
      const erro = avaliarLogo({ mimetype: arquivo.type, tamanhoBytes: arquivo.size, svgTexto });
      if (erro) { setErros((e) => ({ ...e, logo: erro })); return; }
      const dataUri = await new Promise((ok, falha) => {
        const r = new FileReader();
        r.onerror = () => falha(r.error);
        r.onload = () => ok(String(r.result));
        r.readAsDataURL(arquivo);
      });
      setLogo({ dataUri, mimetype: arquivo.type });
    } catch {
      setErros((e) => ({ ...e, logo: "Não foi possível ler o arquivo. Tente outro." }));
    }
  };

  const enviarCriarConta = async (e) => {
    e.preventDefault();
    rastrear("cadastro_etapa", { papel: "empresa", etapa: "acesso" });
    const novos = {};
    if (!logo) novos.logo = "Envie o logo da empresa.";
    if (!nomeEmpresa.trim()) novos.nomeEmpresa = "Nome da empresa é obrigatório.";
    if (!pais) novos.pais = "Selecione o país da empresa.";
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
      pais,
      logo: { base64: logo.dataUri.split(",")[1], mimetype: logo.mimetype },
      ...dadosRastreio(),
    });
    setSalvando(false);

    if (!r || r.error) {
      if (r?.campo) setErros({ [r.campo]: r.error });
      else setErroGeral(r?.error || "Não foi possível criar a conta. Tente de novo.");
      return;
    }
    cadastroConcluido("empresa", { email: email.trim().toLowerCase(), pais });
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
            <span className="vx-label" id={`${id}-logo-rotulo`}>Logo da empresa <span style={{ color: "var(--red)", fontWeight: 600 }}>· obrigatório</span></span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", overflow: "hidden", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--muted)" }} aria-hidden={!logo}>
                {logo ? <img src={logo.dataUri} alt="Logo escolhido" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <ImagePlus size={22} aria-hidden="true" />}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="vx-btn" style={{ minHeight: 44 }}
                  aria-describedby={[`${id}-logo-rotulo`, `${id}-logo-dica`, erros.logo && `${id}-logo-erro`].filter(Boolean).join(" ")}
                  onClick={() => inputLogo.current?.click()}>
                  {logo ? "Trocar logo" : "Enviar logo"}
                </button>
                {logo && (
                  <button type="button" className="vx-btn vx-btn-ghost" style={{ minHeight: 44 }} onClick={() => setLogo(null)}>
                    <Trash2 size={15} aria-hidden="true" /> Remover
                  </button>
                )}
              </div>
              <input ref={inputLogo} type="file" hidden accept="image/png,image/svg+xml,image/jpeg,image/webp"
                onChange={(e) => escolherLogo(e.target.files?.[0])} />
            </div>
            <div id={`${id}-logo-dica`} className="vx-onb-dica">Envie o <b>logo oficial da sua empresa</b> (não uma foto pessoal). PNG ou SVG, de preferência com fundo transparente. Até {Math.round(LOGO_MAX_BYTES / 1024 / 1024)} MB.</div>
            {erros.logo && <div id={`${id}-logo-erro`} className="vx-onb-erro" role="alert">{erros.logo}</div>}
          </div>

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
            <label className="vx-label" id={`${id}-pais`}>País</label>
            <ComboSelect
              name="pais"
              valor={pais}
              onChange={(v) => { setPais(v); setErros((e) => { const { pais: _p, ...resto } = e; return resto; }); }}
              placeholder="Digite ou selecione o país…"
              opcoes={PAISES.map((p) => ({ value: p.code, label: `${p.nome} (${p.moeda})`, extra: `${p.moeda} ${p.code}` }))}
            />
            <div id={`${id}-pais-dica`} className="vx-onb-dica">Comece a digitar o nome do país. Define a moeda dos planos e das campanhas ({moedaDoPais(pais)}).</div>
            {erros.pais && <div id={`${id}-pais-erro`} className="vx-onb-erro" role="alert">{erros.pais}</div>}
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

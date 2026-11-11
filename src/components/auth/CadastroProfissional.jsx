import { useRef, useState } from "react";
import { Eye, EyeOff, Camera, X, CheckCircle, XCircle } from "lucide-react";
import { Campo } from "../ui.jsx";
import Termos from "./Termos.jsx";
import MolduraAuth from "./MolduraAuth.jsx";
import { FUNCOES, ORDEM_FUNCOES } from "../../../shared/funcoes.js";
import { ROTAS, navegar, parametro } from "../../lib/rotas.js";
import { LIMITES, avaliarFoto, GUIA_FOTO, exemploEnquadramento } from "../../../shared/fotoPerfil.js";
import { useI18n } from "../../lib/i18n.jsx";

export default function CadastroProfissional({ onRegister }) {
  const { t } = useI18n();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [verSenhaConfirm, setVerSenhaConfirm] = useState(false);
  const [whats, setWhats] = useState("");
  const [cidade, setCidade] = useState("");
  const [perfil, setPerfil] = useState("sdr");
  const [indicacao, setIndicacao] = useState(() => (parametro("ref") || "").toUpperCase());
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [showTermos, setShowTermos] = useState(false);
  const [loading, setLoading] = useState(false);

  const [foto, setFoto] = useState(null);
  const [fotoPrevia, setFotoPrevia] = useState("");
  const [fotoErro, setFotoErro] = useState("");
  const [mostrarGuia, setMostrarGuia] = useState(false);
  const inputFoto = useRef(null);

  const [curriculo, setCurriculo] = useState(null);
  const [curriculoErro, setCurriculoErro] = useState("");
  const inputCurriculo = useRef(null);

  const [erroSenha, setErroSenha] = useState("");

  const selecionarCurriculo = (arquivo) => {
    if (!arquivo) return;
    setCurriculoErro("");
    const tiposOk = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!tiposOk.includes(arquivo.type)) { setCurriculoErro(t("auth.register.cvFormatError")); return; }
    if (arquivo.size > 8 * 1024 * 1024) { setCurriculoErro(t("auth.register.cvSizeError")); return; }
    const reader = new FileReader();
    reader.onload = () => setCurriculo({ base64: reader.result.split(",")[1], mimetype: arquivo.type, nome: arquivo.name });
    reader.readAsDataURL(arquivo);
  };

  const selecionarFoto = (arquivo) => {
    if (!arquivo) return;
    setFotoErro("");
    const img = new Image();
    img.onload = () => {
      const avaliacao = avaliarFoto({
        mimetype: arquivo.type,
        tamanhoBytes: arquivo.size,
        largura: img.naturalWidth,
        altura: img.naturalHeight,
      });
      if (!avaliacao.aprovada) {
        const problema = avaliacao.problemas[0];
        setFotoErro(problema ? problema.comoResolver : t("auth.register.photoRejected"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setFoto({ base64: reader.result.split(",")[1], mimetype: arquivo.type, largura: img.naturalWidth, altura: img.naturalHeight });
        setFotoPrevia(reader.result);
      };
      reader.readAsDataURL(arquivo);
    };
    img.onerror = () => setFotoErro(t("auth.register.photoReadError"));
    img.src = URL.createObjectURL(arquivo);
  };

  const abrirSeletorFoto = () => {
    if (fotoPrevia) {
      inputFoto.current?.click();
    } else {
      setMostrarGuia(true);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setErroSenha("");
    if (!aceitouTermos) return;
    if (senha.length < 6) { setErroSenha(t("auth.register.minChars")); return; }
    if (senha !== senhaConfirm) { setErroSenha(t("auth.register.passwordMismatch")); return; }
    if (!foto) { setFotoErro(t("auth.register.photoRequired")); return; }
    setLoading(true);
    await onRegister({
      role: "vendedor", nome, email, senha, whats, cidade, perfil,
      aceitouTermos: true, indicacao: indicacao || undefined,
      foto,
      curriculo: curriculo || undefined,
    });
    setLoading(false);
  };

  if (showTermos) return (
    <Termos onAceitar={() => { setAceitouTermos(true); setShowTermos(false); }} onVoltar={() => setShowTermos(false)} />
  );

  return (
    <MolduraAuth
      tarja={t("auth.register.proTag")}
      titulo={t("auth.register.proTitle")}
      subtitulo={t("auth.register.proSubtitle")}
      rodape={
        <>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => navegar(ROTAS.login)}>{t("auth.register.hasAccount")}</button>
          <div style={{ marginTop: 4 }}>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => navegar(ROTAS.cadastroEmpresa)} style={{ fontSize: 12.5 }}>
              {t("auth.register.isCompany")}
            </button>
          </div>
        </>
      }
    >
      <form onSubmit={submit}>
        {/* Foto de perfil */}
        <div style={{ marginBottom: 16 }}>
          <label className="vx-label" style={{ display: "block", marginBottom: 6 }}>
            {t("auth.register.profilePhoto")} <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button type="button" onClick={abrirSeletorFoto}
              style={{
                width: 72, height: 72, borderRadius: "50%", border: `2px dashed ${fotoPrevia ? "var(--brand)" : "var(--border)"}`,
                background: fotoPrevia ? "none" : "var(--bg-2)", cursor: "pointer", overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0,
              }}>
              {fotoPrevia
                ? <img src={fotoPrevia} alt={t("auth.register.photoPreview")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <Camera size={24} style={{ color: "var(--text-3)" }} />}
            </button>
            <div style={{ flex: 1 }}>
              <button type="button" className="vx-btn vx-btn-sm" onClick={abrirSeletorFoto} style={{ minHeight: 36 }}>
                {fotoPrevia ? t("auth.register.changePhoto") : t("auth.register.uploadPhoto")}
              </button>
              <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4 }}>JPG, PNG ou WebP. Até {Math.round(LIMITES.tamanhoMaximoBytes / 1024 / 1024)} MB.</div>
            </div>
            <input ref={inputFoto} type="file" hidden accept="image/jpeg,image/png,image/webp"
              onChange={(e) => { selecionarFoto(e.target.files?.[0]); if (inputFoto.current) inputFoto.current.value = ""; }} />
          </div>
          {fotoErro && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 6 }}>{fotoErro}</div>}
        </div>

        {/* Currículo (opcional) */}
        <div style={{ marginBottom: 16 }}>
          <label className="vx-label" style={{ display: "block", marginBottom: 6 }}>
            {t("auth.register.cv")} <span className="vx-mut" style={{ fontWeight: 400 }}>({t("auth.register.cvHint")})</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="vx-btn vx-btn-sm" onClick={() => inputCurriculo.current?.click()}>
              {curriculo ? t("auth.register.changeFile") : t("auth.register.uploadCv")}
            </button>
            {curriculo && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{curriculo.nome}</span>}
          </div>
          <input ref={inputCurriculo} type="file" hidden
            accept="application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => selecionarCurriculo(e.target.files?.[0])} />
          {curriculoErro && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 6 }}>{curriculoErro}</div>}
        </div>

        <Campo label={t("auth.register.yourName")}>
          <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t("auth.register.namePlaceholder")} required />
        </Campo>
        <Campo label={t("login.email")}>
          <input className="vx-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
        </Campo>

        <Campo label={t("login.password")}>
          <div style={{ position: "relative" }}>
            <input className="vx-input" type={verSenha ? "text" : "password"} value={senha}
              onChange={(e) => { setSenha(e.target.value); setErroSenha(""); }}
              placeholder={t("auth.register.minChars")} required minLength={6}
              style={{ paddingRight: 42 }} />
            <button type="button" onClick={() => setVerSenha(!verSenha)} tabIndex={-1}
              aria-label={verSenha ? t("auth.hidePassword") : t("auth.showPassword")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-3)" }}>
              {verSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Campo>

        {/* Confirmar senha */}
        <Campo label={t("auth.register.confirmPassword")}>
          <div style={{ position: "relative" }}>
            <input className="vx-input" type={verSenhaConfirm ? "text" : "password"} value={senhaConfirm}
              onChange={(e) => { setSenhaConfirm(e.target.value); setErroSenha(""); }}
              placeholder={t("auth.register.repeatPassword")} required minLength={6}
              style={{ paddingRight: 42 }} />
            <button type="button" onClick={() => setVerSenhaConfirm(!verSenhaConfirm)} tabIndex={-1}
              aria-label={verSenhaConfirm ? t("auth.hidePassword") : t("auth.showPassword")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-3)" }}>
              {verSenhaConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Campo>
        {erroSenha && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: -8, marginBottom: 10 }}>{erroSenha}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Campo label="WhatsApp">
              <input className="vx-input" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(11) 90000-0000" inputMode="tel" />
            </Campo>
          </div>
          <div style={{ flex: 1 }}>
            <Campo label={t("auth.register.city")}>
              <input className="vx-input" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder={t("auth.register.cityPlaceholder")} />
            </Campo>
          </div>
        </div>

        <Campo label={t("auth.register.howYouWork")}>
          <select className="vx-input" value={perfil} onChange={(e) => setPerfil(e.target.value)}>
            {ORDEM_FUNCOES.map((k) => (
              <option key={k} value={k}>{FUNCOES[k].nome} — {FUNCOES[k].completo}</option>
            ))}
          </select>
        </Campo>
        <p className="vx-mut" style={{ fontSize: 12, marginTop: -4, marginBottom: 12, lineHeight: 1.5 }}>
          {FUNCOES[perfil]?.descricao}
        </p>

        <Campo label={t("auth.register.referralCode")}>
          <input className="vx-input vx-mono" value={indicacao} placeholder="Ex.: SXMD9JG"
            onChange={(e) => setIndicacao(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
            style={{ letterSpacing: ".08em" }} />
        </Campo>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "12px 0", cursor: "pointer", fontSize: 12.5, color: "var(--text-2)" }}>
          <input type="checkbox" checked={aceitouTermos} onChange={(e) => setAceitouTermos(e.target.checked)} style={{ marginTop: 2 }} />
          <span>
            {t("auth.register.acceptTermsPrefix")}{" "}
            <button type="button" onClick={() => setShowTermos(true)} style={{ color: "var(--brand)", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "inherit" }}>
              {t("auth.register.termsLink")}
            </button>
          </span>
        </label>

        <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={loading || !aceitouTermos}>
          {loading ? t("auth.register.creating") : t("auth.register.createProAccount")}
        </button>
      </form>

      <hr className="vx-sep" />
      <div className="vx-mut" style={{ fontSize: 12.3, lineHeight: 1.6 }}>
        <b style={{ color: "var(--text-2)" }}>{t("auth.register.whatHappensTitle")}</b> {t("auth.register.whatHappensDesc")}
      </div>

      {/* Modal guia de foto */}
      {mostrarGuia && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setMostrarGuia(false); }}>
          <div style={{ background: "var(--bg)", borderRadius: 16, padding: 24, maxWidth: 400, width: "100%", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <button type="button" onClick={() => setMostrarGuia(false)} aria-label={t("app.close")}
              style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-3)" }}>
              <X size={20} />
            </button>
            <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>{GUIA_FOTO.titulo}</h3>

            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 20 }}>
              <div style={{ textAlign: "center" }}>
                <img src={exemploEnquadramento("certo")} alt="Enquadramento correto" style={{ width: 100, height: 100, borderRadius: 12 }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <img src={exemploEnquadramento("errado")} alt="Enquadramento incorreto" style={{ width: 100, height: 100, borderRadius: 12 }} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: "var(--text-2)" }}>{t("auth.register.photoRequirements")}</div>
              {GUIA_FOTO.requisitos.map((r) => (
                <div key={r.chave} style={{ fontSize: 12.5, marginBottom: 4, lineHeight: 1.5 }}>
                  <b>{r.texto}</b> — {r.detalhe}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: "var(--green, #22c55e)" }}>
                  <CheckCircle size={13} style={{ verticalAlign: -2, marginRight: 3 }} />{t("auth.register.recommended")}
                </div>
                {GUIA_FOTO.recomendado.map((t, i) => (
                  <div key={i} style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 2 }}>{t}</div>
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: "var(--red, #ef4444)" }}>
                  <XCircle size={13} style={{ verticalAlign: -2, marginRight: 3 }} />{t("auth.register.avoid")}
                </div>
                {GUIA_FOTO.evitar.map((t, i) => (
                  <div key={i} style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 2 }}>{t}</div>
                ))}
              </div>
            </div>

            <button type="button" className="vx-btn vx-btn-primary vx-btn-block" style={{ minHeight: 44 }}
              onClick={() => { setMostrarGuia(false); inputFoto.current?.click(); }}>
              {t("auth.register.gotItChoosePhoto")}
            </button>
          </div>
        </div>
      )}
    </MolduraAuth>
  );
}

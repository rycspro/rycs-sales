import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { PERMISSOES_MARCA, validarPerfilEmpresa, formatarTicket, LOGO_MAX_BYTES, avaliarLogo } from "../../../shared/onboarding.js";
import { useI18n } from "../../lib/i18n.jsx";

// Etapa 2: perfil da empresa. É daqui que a IA da etapa 4 tira o tom da marca,
// o que pode e o que não pode dizer. Obrigatórios: nome, produto e público.

const VAZIO = { nome: "", produto: "", ticket: "", nicho: "", diferencial: "", publico: "", regrasMarca: "", permissoesMarca: {} };

function Campo({ id, label, obrigatorio, dica, erro, children }) {
  const { t } = useI18n();
  return (
    <div className="vx-onb-campo">
      <label className="vx-label" htmlFor={id}>
        {label}{obrigatorio ? <span aria-hidden="true" style={{ color: "var(--red)" }}> *</span> : <span className="vx-onb-opcional"> ({t("onb.company.recommended")})</span>}
      </label>
      {children}
      {dica && <div id={`${id}-dica`} className="vx-onb-dica">{dica}</div>}
      {erro && <div id={`${id}-erro`} className="vx-onb-erro" role="alert">{erro}</div>}
    </div>
  );
}

const lerArquivo = (arquivo) => new Promise((ok, falha) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => falha(r.error);
  r.readAsDataURL(arquivo);
});

export default function EtapaEmpresa({ aoAtualizar, aoAvancar, aoVoltar }) {
  const { t } = useI18n();
  const id = useId();
  const inputLogo = useRef(null);
  const [dados, setDados] = useState(null); // null = carregando
  const [erroCarga, setErroCarga] = useState("");
  const [logo, setLogo] = useState("");
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [erroLogo, setErroLogo] = useState("");
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setErroCarga("");
    setDados(null);
    const r = await api("/onboarding/empresa");
    if (!r || r.error) { setErroCarga(r?.error || t("onb.company.errLoad")); return; }
    setLogo(r.logo || "");
    setDados({ ...VAZIO, ...r, ticket: r.ticket == null ? "" : formatarTicket(r.ticket).replace("R$ ", "") });
  };
  useEffect(() => { carregar(); }, []);

  const mudar = (campo) => (e) => {
    const valor = e.target.value;
    setDados((d) => ({ ...d, [campo]: valor }));
    if (erros[campo]) setErros((x) => ({ ...x, [campo]: undefined }));
  };
  const alternarPermissao = (chave) =>
    setDados((d) => ({ ...d, permissoesMarca: { ...d.permissoesMarca, [chave]: !d.permissoesMarca?.[chave] } }));

  const enviarLogo = async (arquivo) => {
    if (!arquivo) return;
    setErroLogo("");
    const svgTexto = arquivo.type === "image/svg+xml" ? await arquivo.text() : "";
    const erro = avaliarLogo({ mimetype: arquivo.type, tamanhoBytes: arquivo.size, svgTexto });
    if (erro) { setErroLogo(erro); return; }
    setEnviandoLogo(true);
    try {
      const dataUri = await lerArquivo(arquivo);
      const r = await api("/onboarding/empresa/logo", { base64: dataUri.split(",")[1], mimetype: arquivo.type });
      if (!r || r.error) setErroLogo(r?.error || "Não foi possível enviar o logo. Tente de novo.");
      else setLogo(r.logo);
    } catch {
      setErroLogo("Não foi possível ler o arquivo. Tente outro.");
    }
    setEnviandoLogo(false);
    if (inputLogo.current) inputLogo.current.value = "";
  };

  const removerLogo = async () => {
    setEnviandoLogo(true);
    const r = await api("/onboarding/empresa/logo", { remover: true });
    setEnviandoLogo(false);
    if (r?.ok) setLogo("");
    else setErroLogo(r?.error || "Não foi possível remover o logo.");
  };

  const salvar = async (concluirEtapa) => {
    setErroGeral("");
    if (concluirEtapa) {
      const { erros: e } = validarPerfilEmpresa(dados);
      if (!logo) e.logo = t("onb.access.errLogo");
      setErros(e);
      if (Object.keys(e).length) {
        setErroGeral(t("onb.company.reviewFields"));
        if (e.logo) setErroLogo(e.logo);
        document.getElementById(`${id}-${Object.keys(e)[0]}`)?.focus();
        return false;
      }
    }
    setSalvando(true);
    const r = await api("/onboarding/empresa", { ...dados, concluir: concluirEtapa });
    setSalvando(false);
    if (!r || r.error) {
      if (r?.erros) setErros(r.erros);
      setErroGeral(r?.error || t("onb.company.errSave"));
      return false;
    }
    aoAtualizar(r);
    return r;
  };

  const continuar = async (e) => {
    e.preventDefault();
    const r = await salvar(true);
    if (r) aoAvancar(r);
  };

  // Voltar guarda o rascunho antes, para nada do que foi digitado se perder.
  const voltar = async () => {
    if (dados) await salvar(false);
    aoVoltar();
  };

  if (erroCarga) return (
    <div className="vx-onb-card vx-onb-estado" role="alert" style={{ maxWidth: 560, margin: "0 auto" }}>
      <p>{erroCarga}</p>
      <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 48 }} onClick={carregar}>{t("onb.tryAgain")}</button>
    </div>
  );
  if (!dados) return <div className="vx-onb-estado" role="status">{t("onb.company.loading")}</div>;

  const props = (campo, extra = {}) => ({
    id: `${id}-${campo}`,
    className: "vx-input",
    value: dados[campo] ?? "",
    onChange: mudar(campo),
    "aria-invalid": erros[campo] ? true : undefined,
    "aria-describedby": erros[campo] ? `${id}-${campo}-erro` : extra.dica ? `${id}-${campo}-dica` : undefined,
    ...extra.input,
  });
  const texto = (campo, placeholder, dica) => (
    <textarea {...props(campo, { dica })} rows={4} placeholder={placeholder} maxLength={4000} />
  );

  return (
    <form className="vx-onb-perfil" onSubmit={continuar} noValidate>
      <div>
        <div className="vx-onb-eyebrow">{t("onb.stepOf", { n: 2, total: 6 })}</div>
        <h1 className="vx-disp vx-onb-titulo">{t("onb.company.title")}</h1>
        <p className="vx-mut vx-onb-card-apoio">{t("onb.company.desc")}</p>

        <section className="vx-onb-card vx-onb-secao" aria-labelledby={`${id}-s1`}>
          <h2 id={`${id}-s1`} className="vx-disp">{t("onb.company.identity")}</h2>
          <div className="vx-onb-campo">
            <span className="vx-label" id={`${id}-logo-rotulo`}>Logo <span aria-hidden="true" style={{ color: "var(--red)" }}> *</span></span>
            <div className="vx-onb-logo">
              <div className="vx-onb-logo-previa" aria-hidden={!logo}>
                {logo ? <img src={logo} alt={t("onb.company.currentLogo")} /> : <ImagePlus size={22} aria-hidden="true" />}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="vx-btn" style={{ minHeight: 44 }} disabled={enviandoLogo}
                  aria-describedby={`${id}-logo-rotulo ${id}-logo-dica`} onClick={() => inputLogo.current?.click()}>
                  {enviandoLogo ? t("onb.company.uploading") : logo ? t("onb.access.changeLogo") : t("onb.access.uploadLogo")}
                </button>
                {logo && (
                  <button type="button" className="vx-btn vx-btn-ghost" style={{ minHeight: 44 }} disabled={enviandoLogo} onClick={removerLogo}>
                    <Trash2 size={15} aria-hidden="true" /> {t("onb.access.remove")}
                  </button>
                )}
              </div>
              <input ref={inputLogo} type="file" hidden accept="image/png,image/svg+xml,image/jpeg,image/webp"
                onChange={(e) => enviarLogo(e.target.files?.[0])} />
            </div>
            <div id={`${id}-logo-dica`} className="vx-onb-dica">{t("onb.access.logoHint", { mb: Math.round(LOGO_MAX_BYTES / 1024 / 1024) })}</div>
            {erroLogo && <div className="vx-onb-erro" role="alert">{erroLogo}</div>}
          </div>
          <Campo id={`${id}-nome`} label={t("onb.access.companyName")} obrigatorio erro={erros.nome}>
            <input {...props("nome")} autoComplete="organization" maxLength={100} />
          </Campo>
        </section>

        <section className="vx-onb-card vx-onb-secao" aria-labelledby={`${id}-s2`}>
          <h2 id={`${id}-s2`} className="vx-disp">{t("onb.company.whatYouSell")}</h2>
          <Campo id={`${id}-produto`} label={t("onb.company.product")} obrigatorio erro={erros.produto}>
            {texto("produto", t("onb.company.productPlaceholder"))}
          </Campo>
          <Campo id={`${id}-ticket`} label={t("onb.company.ticket")} erro={erros.ticket} dica={t("onb.company.ticketHint")}>
            <div className="vx-onb-moeda">
              <span aria-hidden="true">R$</span>
              <input {...props("ticket", { dica: true })} inputMode="decimal" placeholder="1.490,00" />
            </div>
          </Campo>
        </section>

        <section className="vx-onb-card vx-onb-secao" aria-labelledby={`${id}-s3`}>
          <h2 id={`${id}-s3`} className="vx-disp">{t("onb.company.marketSection")}</h2>
          <Campo id={`${id}-nicho`} label={t("onb.company.niche")} erro={erros.nicho}>
            {texto("nicho", t("onb.company.nichePlaceholder"))}
          </Campo>
          <Campo id={`${id}-diferencial`} label={t("onb.company.differentiator")} erro={erros.diferencial}>
            {texto("diferencial", t("onb.company.differentiatorPlaceholder"))}
          </Campo>
          <Campo id={`${id}-publico`} label={t("onb.company.audience")} obrigatorio erro={erros.publico}>
            {texto("publico", t("onb.company.audiencePlaceholder"))}
          </Campo>
        </section>

        <section className="vx-onb-card vx-onb-secao" aria-labelledby={`${id}-s4`}>
          <h2 id={`${id}-s4`} className="vx-disp">{t("onb.company.brand")}</h2>
          <Campo id={`${id}-regrasMarca`} label={t("onb.company.brandRules")} erro={erros.regrasMarca}
            dica={t("onb.company.brandRulesHint")}>
            {texto("regrasMarca", t("onb.company.brandRulesPlaceholder"), true)}
          </Campo>
          <fieldset className="vx-onb-permissoes">
            <legend className="vx-label">{t("onb.company.brandPermissions")}</legend>
            {PERMISSOES_MARCA.map((p) => (
              <label key={p.chave}>
                <input type="checkbox" checked={!!dados.permissoesMarca?.[p.chave]} onChange={() => alternarPermissao(p.chave)} />
                {p.label}
              </label>
            ))}
            <div className="vx-onb-dica">{t("onb.company.brandPermissionsHint")}</div>
          </fieldset>
        </section>

        <div aria-live="polite">{erroGeral && <div className="vx-onb-erro" role="alert">{erroGeral}</div>}</div>
        <div className="vx-onb-acoes">
          <button type="button" className="vx-btn" onClick={voltar} disabled={salvando}>{t("onb.back")}</button>
          <button type="submit" className="vx-btn vx-btn-primary" disabled={salvando}>{salvando ? t("onb.saving") : t("onb.saveAndContinue")}</button>
        </div>
      </div>

      <aside className="vx-onb-lateral">
        <div className="vx-onb-card">
          <h2 className="vx-disp">{t("onb.company.whyWeAsk")}</h2>
          <p className="vx-mut">{t("onb.company.whyWeAskDesc")}</p>
          <h3 className="vx-onb-eyebrow" style={{ marginTop: 16 }}>{t("onb.company.inThisStep")}</h3>
          <ul>
            <li>{t("onb.company.stepLogoName")}</li>
            <li>{t("onb.company.stepProductTicket")}</li>
            <li>{t("onb.company.stepNicheAudience")}</li>
            <li>{t("onb.company.stepBrandRules")}</li>
          </ul>
        </div>
      </aside>
    </form>
  );
}

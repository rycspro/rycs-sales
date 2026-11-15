import { useRef, useState } from "react";
import { Eye, EyeOff, Camera, X, CheckCircle, XCircle, Plus, Trash2, Upload, FileText } from "lucide-react";
// Campo e MolduraAuth não são mais usados — layout próprio do Profile Builder
import ComboSelect from "../ui/ComboSelect.jsx";
import Termos from "./Termos.jsx";
import OnboardingProfissional from "./OnboardingProfissional.jsx";
import { FUNCOES, ORDEM_FUNCOES } from "../../../shared/funcoes.js";
import { PAISES, ESTADOS_BR, CIDADES_BR, IDIOMAS, NIVEIS_IDIOMA, telefoneValido, normalizarTelefoneIntl } from "../../../shared/localidades.js";
import CampoTelefone from "../CampoTelefone.jsx";
import { ROTAS, navegar, parametro } from "../../lib/rotas.js";
import { LIMITES, avaliarFoto, GUIA_FOTO, exemploEnquadramento } from "../../../shared/fotoPerfil.js";
import { useI18n } from "../../lib/i18n.jsx";

/* ─── constantes visuais ─── */
const AZUL = "#318CE7";
const MAX_W = 840;

const ETAPAS_KEYS = ["pessoal", "profissional", "experiencia"];

const GENEROS_MAP = [
  { value: "masculino", key: "masculino" },
  { value: "feminino", key: "feminino" },
  { value: "nao-binario", key: "naoBinario" },
  { value: "prefiro-nao-dizer", key: "prefiroNaoDizer" },
];

/* ─── CSS-in-JS scoped ─── */
const css = `
.cp-page{min-height:100dvh;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px 48px;background:var(--bg);overflow-y:auto}
.cp-shell{width:100%;max-width:${MAX_W}px}
.cp-fade{animation:cpIn .25s cubic-bezier(.22,.9,.32,1)}
@keyframes cpIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.cp-fade{animation:none}}

/* header */
.cp-header{text-align:center;margin-bottom:28px}
.cp-logo{height:30px;width:auto;max-width:70%;object-fit:contain;display:block;margin:0 auto 16px}
html.dark .cp-logo{mix-blend-mode:normal;filter:brightness(0) invert(1)}
.cp-badge{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${AZUL};border:1px solid rgba(49,140,231,.22);background:rgba(49,140,231,.06);border-radius:999px;padding:4px 14px;margin-bottom:14px}
.cp-eyebrow{font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${AZUL};margin-bottom:6px}
.cp-titulo{font-family:'Geist','Inter',system-ui,sans-serif;font-size:24px;font-weight:600;letter-spacing:-.025em;color:var(--ink);margin:0 0 6px;line-height:1.25}
.cp-desc{font-size:13.5px;color:var(--muted);line-height:1.55;margin:0}

/* progress */
.cp-progress{display:flex;gap:6px;margin-bottom:24px}
.cp-seg{flex:1;display:flex;flex-direction:column;gap:5px}
.cp-seg-bar{height:4px;border-radius:999px;transition:background .3s}
.cp-seg-label{font-size:10.5px;font-weight:500;text-align:center;letter-spacing:.02em;transition:color .3s}
.cp-step-num{text-align:center;font-size:11.5px;font-weight:600;color:var(--muted);margin-bottom:8px;font-variant-numeric:tabular-nums}

/* card */
.cp-card{background:var(--surface-solid);border:1px solid var(--border-strong);border-radius:16px;padding:28px 32px}

/* foto */
.cp-foto-area{display:flex;align-items:center;gap:16px;padding:18px;background:var(--surface-2);border:1px solid var(--border-strong);border-radius:14px;margin-bottom:20px}
.cp-foto-circle{width:80px;height:80px;border-radius:50%;border:2px dashed var(--border-strong);background:var(--surface-solid);cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0;transition:border-color .2s}
.cp-foto-circle:hover{border-color:${AZUL}}
.cp-foto-circle.has-photo{border-style:solid;border-color:${AZUL}}
.cp-foto-info{flex:1;min-width:0}
.cp-foto-titulo{font-size:14px;font-weight:600;color:var(--ink);margin:0 0 2px}
.cp-foto-desc{font-size:12px;color:var(--muted);line-height:1.45;margin:0 0 10px}
.cp-foto-btn{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:${AZUL};background:rgba(49,140,231,.08);border:1px solid rgba(49,140,231,.18);border-radius:8px;padding:7px 14px;cursor:pointer;transition:background .15s}
.cp-foto-btn:hover{background:rgba(49,140,231,.14)}
.cp-foto-formatos{font-size:11px;color:var(--muted-2);margin-top:6px}

/* grid 2 cols */
.cp-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}

/* seção */
.cp-secao{margin-bottom:4px}
.cp-secao-titulo{font-size:13px;font-weight:600;color:var(--ink);margin:18px 0 10px;display:flex;align-items:center;gap:7px}
.cp-secao-titulo::after{content:'';flex:1;height:1px;background:var(--border)}

/* campo customizado */
.cp-campo{margin-bottom:14px}
.cp-campo-label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:0 0 5px;letter-spacing:.01em}
.cp-campo-label .cp-req{color:var(--red,#ef4444);margin-left:2px}
.cp-campo-label .cp-opt{font-weight:400;color:var(--muted-2);margin-left:4px;font-size:11px}

/* senha wrapper */
.cp-senha-wrap{position:relative}
.cp-senha-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px;color:var(--muted);display:flex}
.cp-senha-toggle:hover{color:var(--ink)}

/* idiomas */
.cp-idioma-row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
.cp-idioma-row>div{flex:1}
.cp-idioma-rem{background:none;border:none;cursor:pointer;padding:4px;color:var(--muted);flex-shrink:0;display:flex}
.cp-idioma-rem:hover{color:var(--red,#ef4444)}

/* currículo */
.cp-curriculo-area{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--surface-2);border:1px solid var(--border-strong);border-radius:12px;margin-bottom:14px}
.cp-curriculo-icon{width:40px;height:40px;border-radius:10px;background:rgba(49,140,231,.08);color:${AZUL};display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cp-curriculo-info{flex:1;min-width:0}

/* checkbox termos */
.cp-termos{display:flex;align-items:flex-start;gap:8px;margin:14px 0;cursor:pointer;font-size:12.5px;color:var(--ink-2,var(--ink))}
.cp-termos input{margin-top:2px;accent-color:${AZUL}}
.cp-termos-link{color:${AZUL};text-decoration:underline;background:none;border:none;padding:0;cursor:pointer;font:inherit}

/* erro */
.cp-erro{color:var(--red,#ef4444);font-size:12.5px;margin-bottom:12px;padding:9px 14px;background:var(--red-50,rgba(239,68,68,.06));border-radius:10px;border:1px solid var(--red-100,rgba(239,68,68,.12))}
.cp-campo-erro{color:var(--red,#ef4444);font-size:12px;margin-top:5px}

/* nav */
.cp-nav{display:flex;gap:10px;margin-top:20px}
.cp-nav-voltar{flex:1;appearance:none;border:1px solid var(--border-strong);background:var(--surface-solid);color:var(--ink);font:inherit;font-size:14px;font-weight:500;border-radius:10px;padding:12px 16px;cursor:pointer;min-height:48px;transition:background .15s}
.cp-nav-voltar:hover{background:var(--surface-2)}
.cp-nav-avancar{flex:2;appearance:none;border:1px solid ${AZUL};background:${AZUL};color:#fff;font:inherit;font-size:14.5px;font-weight:600;border-radius:10px;padding:12px 20px;cursor:pointer;min-height:48px;transition:background .15s;box-shadow:0 2px 8px rgba(49,140,231,.25)}
.cp-nav-avancar:hover:not(:disabled){background:#2b7cd0;border-color:#2b7cd0}
.cp-nav-avancar:disabled{opacity:.5;cursor:not-allowed}
.cp-nav-avancar:focus-visible,.cp-nav-voltar:focus-visible{outline:2px solid ${AZUL};outline-offset:2px}

/* rodapé */
.cp-footer{text-align:center;margin-top:20px}
.cp-footer-link{background:none;border:none;cursor:pointer;color:var(--muted);font:inherit;font-size:13px;font-weight:500;padding:6px 4px;transition:color .15s}
.cp-footer-link:hover{color:${AZUL}}
.cp-footer-empresa{font-size:12px}

/* depois do form */
.cp-depois{margin-top:18px;padding:14px 16px;background:var(--surface-2);border-radius:12px;font-size:12.5px;line-height:1.6;color:var(--muted)}
.cp-depois b{color:var(--ink-2,var(--ink));font-weight:600}

/* perfil desc */
.cp-perfil-desc{font-size:12px;color:var(--muted);line-height:1.5;margin:-6px 0 14px;padding:0 2px}

/* ═══ MOBILE ═══ */
@media(max-width:600px){
  .cp-page{padding:24px 12px 36px}
  .cp-header{margin-bottom:20px}
  .cp-logo{height:26px;margin-bottom:12px}
  .cp-badge{font-size:9px;padding:3px 10px;margin-bottom:10px}
  .cp-eyebrow{font-size:9.5px;margin-bottom:4px}
  .cp-titulo{font-size:20px;margin-bottom:4px}
  .cp-desc{font-size:12.5px}
  .cp-step-num{font-size:10.5px;margin-bottom:6px}
  .cp-progress{gap:4px;margin-bottom:16px}
  .cp-seg-label{font-size:9.5px}
  .cp-card{padding:18px 14px;border-radius:12px}
  .cp-row{grid-template-columns:1fr;gap:0}
  .cp-foto-area{flex-direction:column;text-align:center;gap:12px;padding:16px 14px}
  .cp-foto-circle{width:72px;height:72px}
  .cp-foto-info{text-align:center}
  .cp-foto-titulo{font-size:13px}
  .cp-foto-desc{font-size:11.5px;margin-bottom:8px}
  .cp-campo{margin-bottom:12px}
  .cp-campo-label{font-size:11.5px}
  .cp-secao-titulo{font-size:12px;margin:14px 0 8px}
  .cp-idioma-row{flex-wrap:wrap;gap:6px}
  .cp-idioma-row>div{min-width:calc(50% - 16px);flex:1 1 auto}
  .cp-curriculo-area{flex-wrap:wrap;gap:10px;padding:12px 14px}
  .cp-curriculo-icon{width:36px;height:36px;border-radius:8px}
  .cp-nav{margin-top:16px}
  .cp-nav-voltar{min-height:44px;font-size:13px;padding:10px 12px}
  .cp-nav-avancar{min-height:44px;font-size:13.5px;padding:10px 16px}
  .cp-depois{margin-top:14px;padding:12px 14px;font-size:12px}
  .cp-footer{margin-top:16px}
  .cp-footer-link{font-size:12px}
}

/* ═══ TABLET ═══ */
@media(min-width:601px) and (max-width:768px){
  .cp-page{padding:32px 20px 40px}
  .cp-card{padding:24px 22px}
  .cp-titulo{font-size:22px}
}
`;

export default function CadastroProfissional({ onRegister }) {
  const { t } = useI18n();
  const [onboardingVisto, setOnboardingVisto] = useState(false);
  const [etapa, setEtapa] = useState(0);

  /* ── estado: dados pessoais ── */
  const [nome, setNome] = useState("");
  const [dataNasc, setDataNasc] = useState("");
  const [genero, setGenero] = useState("");
  const [pais, setPais] = useState("BR");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");

  /* ── estado: profissional ── */
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [verSenhaConfirm, setVerSenhaConfirm] = useState(false);
  const [whats, setWhats] = useState("");
  const [perfil, setPerfil] = useState("sdr");
  const [idiomas, setIdiomas] = useState([{ idioma: "Português", nivel: "nativo" }]);

  /* ── estado: foto ── */
  const [foto, setFoto] = useState(null);
  const [fotoPrevia, setFotoPrevia] = useState("");
  const [fotoErro, setFotoErro] = useState("");
  const [mostrarGuia, setMostrarGuia] = useState(false);
  const inputFoto = useRef(null);

  /* ── estado: currículo ── */
  const [curriculo, setCurriculo] = useState(null);
  const [curriculoErro, setCurriculoErro] = useState("");
  const inputCurriculo = useRef(null);

  /* ── estado: geral ── */
  const [indicacao, setIndicacao] = useState(() => (parametro("ref") || "").toUpperCase());
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [showTermos, setShowTermos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erroSenha, setErroSenha] = useState("");
  const [erroEtapa, setErroEtapa] = useState("");

  /* ── handlers de arquivo ── */
  const selecionarCurriculo = (arquivo) => {
    if (!arquivo) return;
    setCurriculoErro("");
    const tiposOk = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!tiposOk.includes(arquivo.type)) { setCurriculoErro(t("cadProf.erros.curriculoFormato")); return; }
    if (arquivo.size > 8 * 1024 * 1024) { setCurriculoErro(t("cadProf.erros.curriculoTamanho")); return; }
    const reader = new FileReader();
    reader.onload = () => setCurriculo({ base64: reader.result.split(",")[1], mimetype: arquivo.type, nome: arquivo.name });
    reader.readAsDataURL(arquivo);
  };

  const selecionarFoto = (arquivo) => {
    if (!arquivo) return;
    setFotoErro("");
    const img = new Image();
    img.onload = () => {
      const avaliacao = avaliarFoto({ mimetype: arquivo.type, tamanhoBytes: arquivo.size, largura: img.naturalWidth, altura: img.naturalHeight });
      if (!avaliacao.aprovada) {
        setFotoErro(avaliacao.problemas[0]?.comoResolver || t("cadProf.erros.fotoReprovada"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setFoto({ base64: reader.result.split(",")[1], mimetype: arquivo.type, largura: img.naturalWidth, altura: img.naturalHeight });
        setFotoPrevia(reader.result);
      };
      reader.readAsDataURL(arquivo);
    };
    img.onerror = () => setFotoErro(t("cadProf.erros.fotoLeitura"));
    img.src = URL.createObjectURL(arquivo);
  };

  const abrirSeletorFoto = () => {
    if (fotoPrevia) inputFoto.current?.click();
    else setMostrarGuia(true);
  };

  /* ── idiomas ── */
  const addIdioma = () => setIdiomas((l) => [...l, { idioma: "", nivel: "basico" }]);
  const remIdioma = (i) => setIdiomas((l) => l.filter((_, j) => j !== i));
  const setIdiomaVal = (i, campo, val) => setIdiomas((l) => l.map((x, j) => j === i ? { ...x, [campo]: val } : x));

  /* ── dados derivados ── */
  const cidadeLabel = pais === "BR" && estado ? (CIDADES_BR[estado] || []).map((c) => ({ value: c, label: c })) : [];
  const estadosOpcoes = pais === "BR" ? ESTADOS_BR.map((e) => ({ value: e.uf, label: `${e.nome} (${e.uf})` })) : [];
  const generosOpcoes = GENEROS_MAP.map((g) => ({ value: g.value, label: t(`cadProf.generos.${g.key}`) }));

  /* ── validação ── */
  const validarEtapa = () => {
    setErroEtapa("");
    if (etapa === 0) {
      if (!foto) { setFotoErro(t("cadProf.erros.fotoObrigatoria")); return false; }
      if (!nome.trim()) { setErroEtapa(t("cadProf.erros.nome")); return false; }
      if (!dataNasc) { setErroEtapa(t("cadProf.erros.dataNasc")); return false; }
      if (!genero) { setErroEtapa(t("cadProf.erros.genero")); return false; }
      if (!pais) { setErroEtapa(t("cadProf.erros.pais")); return false; }
      if (pais === "BR" && !estado) { setErroEtapa(t("cadProf.erros.estado")); return false; }
      if (!cidade) { setErroEtapa(t("cadProf.erros.cidade")); return false; }
    }
    if (etapa === 1) {
      if (!email.trim()) { setErroEtapa(t("cadProf.erros.email")); return false; }
      if (senha.length < 6) { setErroEtapa(t("cadProf.erros.senhaMin")); return false; }
      if (senha !== senhaConfirm) { setErroEtapa(t("cadProf.erros.senhaDif")); return false; }
      if (!whats.trim()) { setErroEtapa(t("cadProf.erros.whatsapp")); return false; }
      if (!telefoneValido(pais, whats)) { setErroEtapa(t("cadProf.erros.whatsInvalido")); return false; }
      if (idiomas.some((i) => !i.idioma)) { setErroEtapa(t("cadProf.erros.idiomas")); return false; }
    }
    return true;
  };

  const avancar = () => {
    if (!validarEtapa()) return;
    setEtapa((e) => Math.min(e + 1, ETAPAS_KEYS.length - 1));
  };

  const voltar = () => setEtapa((e) => Math.max(e - 1, 0));

  const submit = async (e) => {
    e.preventDefault();
    setErroSenha(""); setErroEtapa("");
    if (!aceitouTermos) { setErroEtapa(t("cadProf.erros.termos")); return; }
    if (!foto) { setFotoErro(t("cadProf.erros.fotoObrigatoria")); setEtapa(0); return; }
    if (senha.length < 6) { setErroSenha(t("cadProf.erros.senhaMinCurta")); setEtapa(1); return; }
    if (senha !== senhaConfirm) { setErroSenha(t("cadProf.erros.senhaDif")); setEtapa(1); return; }
    setLoading(true);
    const cidadeCompleta = pais === "BR" && estado ? `${cidade}, ${estado}` : cidade;
    await onRegister({
      role: "vendedor", nome, email, senha, whats: normalizarTelefoneIntl(pais, whats) || whats,
      cidade: cidadeCompleta, pais, estado,
      dataNascimento: dataNasc, genero,
      perfil, idiomas: idiomas.filter((i) => i.idioma),
      aceitouTermos: true, indicacao: indicacao || undefined,
      foto, curriculo: curriculo || undefined,
    });
    setLoading(false);
  };

  /* ── telas auxiliares ── */
  if (!onboardingVisto) return <OnboardingProfissional onConcluir={() => setOnboardingVisto(true)} />;
  if (showTermos) return <Termos onAceitar={() => { setAceitouTermos(true); setShowTermos(false); }} onVoltar={() => setShowTermos(false)} />;

  const etapaInfo = [`s1`, `s2`, `s3`][etapa];

  return (
    <>
      <style>{css}</style>
      <div className="cp-page">
        <div className="cp-shell">

          {/* ══════════ CABEÇALHO ══════════ */}
          <div className="cp-header">
            <img className="cp-logo" src="/logo-rycs-sm.png" alt="RYCS Sales Machine"
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <div className="cp-badge">{t("cadProf.badge")}</div>
            <div className="cp-eyebrow">{t(`cadProf.${etapaInfo}.eyebrow`)}</div>
            <h1 className="cp-titulo">{t(`cadProf.${etapaInfo}.titulo`)}</h1>
            <p className="cp-desc">{t(`cadProf.${etapaInfo}.descricao`)}</p>
          </div>

          {/* ══════════ PROGRESSO ══════════ */}
          <div className="cp-step-num">{t("cadProf.etapa", { n: etapa + 1, total: ETAPAS_KEYS.length })}</div>
          <div className="cp-progress">
            {ETAPAS_KEYS.map((key, i) => (
              <div className="cp-seg" key={key}>
                <div className="cp-seg-bar" style={{
                  background: i < etapa ? AZUL : i === etapa ? AZUL : "var(--border-strong)",
                  opacity: i < etapa ? 0.45 : 1,
                }} />
                <span className="cp-seg-label" style={{
                  color: i <= etapa ? AZUL : "var(--muted-2)",
                  fontWeight: i === etapa ? 700 : 500,
                }}>
                  {t(`cadProf.etapas.${key}`)}
                </span>
              </div>
            ))}
          </div>

          {/* ══════════ CARD DO FORMULÁRIO ══════════ */}
          <div className="cp-card">
            <form onSubmit={submit}>
              <div className="cp-fade" key={`etapa-${etapa}`}>

                {/* ━━━━━━━━ ETAPA 0: Dados pessoais ━━━━━━━━ */}
                {etapa === 0 && (
                  <>
                    {/* Foto de perfil */}
                    <div className="cp-foto-area">
                      <button type="button" className={`cp-foto-circle${fotoPrevia ? " has-photo" : ""}`} onClick={abrirSeletorFoto}
                        aria-label={t("cadProf.foto.adicionar")}>
                        {fotoPrevia
                          ? <img src={fotoPrevia} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <Camera size={26} style={{ color: "var(--muted-2)" }} />}
                      </button>
                      <div className="cp-foto-info">
                        <div className="cp-foto-titulo">{t("cadProf.foto.titulo")}</div>
                        <p className="cp-foto-desc">{t("cadProf.foto.descricao")}</p>
                        <button type="button" className="cp-foto-btn" onClick={abrirSeletorFoto}>
                          <Camera size={14} />
                          {fotoPrevia ? t("cadProf.foto.trocar") : t("cadProf.foto.adicionar")}
                        </button>
                        <div className="cp-foto-formatos">{t("cadProf.foto.formatos", { max: Math.round(LIMITES.tamanhoMaximoBytes / 1024 / 1024) })}</div>
                      </div>
                      <input ref={inputFoto} type="file" hidden accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => { selecionarFoto(e.target.files?.[0]); if (inputFoto.current) inputFoto.current.value = ""; }} />
                    </div>
                    {fotoErro && <div className="cp-campo-erro" style={{ marginTop: -12, marginBottom: 14 }}>{fotoErro}</div>}

                    {/* Nome */}
                    <div className="cp-campo">
                      <label className="cp-campo-label">{t("cadProf.campos.nome")} <span className="cp-req">*</span></label>
                      <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)}
                        placeholder={t("cadProf.campos.nomePlaceholder")} required />
                    </div>

                    {/* Data + Gênero */}
                    <div className="cp-row">
                      <div className="cp-campo">
                        <label className="cp-campo-label">{t("cadProf.campos.dataNasc")} <span className="cp-req">*</span></label>
                        <input className="vx-input" type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)}
                          required style={{ minHeight: 42 }} />
                      </div>
                      <div className="cp-campo">
                        <label className="cp-campo-label">{t("cadProf.campos.genero")} <span className="cp-req">*</span></label>
                        <ComboSelect opcoes={generosOpcoes} valor={genero} onChange={setGenero} placeholder={t("cadProf.selecione")} />
                      </div>
                    </div>

                    {/* País */}
                    <div className="cp-campo">
                      <label className="cp-campo-label">{t("cadProf.campos.pais")} <span className="cp-req">*</span></label>
                      <ComboSelect opcoes={PAISES.map((p) => ({ value: p.code, label: p.nome }))} valor={pais}
                        onChange={(v) => { setPais(v); setEstado(""); setCidade(""); }} placeholder={t("cadProf.selecionePais")} />
                    </div>

                    {/* Estado + Cidade */}
                    {pais === "BR" ? (
                      <div className="cp-row">
                        <div className="cp-campo">
                          <label className="cp-campo-label">{t("cadProf.campos.estado")} <span className="cp-req">*</span></label>
                          <ComboSelect opcoes={estadosOpcoes} valor={estado}
                            onChange={(v) => { setEstado(v); setCidade(""); }} placeholder={t("cadProf.selecione")} />
                        </div>
                        <div className="cp-campo">
                          <label className="cp-campo-label">{t("cadProf.campos.cidade")} <span className="cp-req">*</span></label>
                          <ComboSelect opcoes={cidadeLabel} valor={cidade} onChange={setCidade}
                            placeholder={estado ? t("cadProf.selecione") : t("cadProf.selecioneEstado")} disabled={!estado} />
                        </div>
                      </div>
                    ) : (
                      <div className="cp-row">
                        <div className="cp-campo">
                          <label className="cp-campo-label">{t("cadProf.campos.estadoRegiao")}</label>
                          <input className="vx-input" value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="Ex.: California" />
                        </div>
                        <div className="cp-campo">
                          <label className="cp-campo-label">{t("cadProf.campos.cidade")} <span className="cp-req">*</span></label>
                          <input className="vx-input" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: New York" required />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ━━━━━━━━ ETAPA 1: Profissional ━━━━━━━━ */}
                {etapa === 1 && (
                  <>
                    {/* Seção: Acesso */}
                    <div className="cp-secao">
                      <div className="cp-secao-titulo">{t("cadProf.campos.email")} &amp; {t("cadProf.campos.senha")}</div>
                    </div>

                    <div className="cp-campo">
                      <label className="cp-campo-label">{t("cadProf.campos.email")} <span className="cp-req">*</span></label>
                      <input className="vx-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("cadProf.campos.emailPlaceholder")} required />
                    </div>

                    <div className="cp-row">
                      <div className="cp-campo">
                        <label className="cp-campo-label">{t("cadProf.campos.senha")} <span className="cp-req">*</span></label>
                        <div className="cp-senha-wrap">
                          <input className="vx-input" type={verSenha ? "text" : "password"} value={senha}
                            onChange={(e) => { setSenha(e.target.value); setErroSenha(""); }}
                            placeholder={t("cadProf.campos.senhaPlaceholder")} required minLength={6} style={{ paddingRight: 42 }} />
                          <button type="button" className="cp-senha-toggle" onClick={() => setVerSenha(!verSenha)}
                            tabIndex={-1} aria-label={verSenha ? "Ocultar" : "Mostrar"}>
                            {verSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div className="cp-campo">
                        <label className="cp-campo-label">{t("cadProf.campos.confirmarSenha")} <span className="cp-req">*</span></label>
                        <div className="cp-senha-wrap">
                          <input className="vx-input" type={verSenhaConfirm ? "text" : "password"} value={senhaConfirm}
                            onChange={(e) => { setSenhaConfirm(e.target.value); setErroSenha(""); }}
                            placeholder={t("cadProf.campos.confirmarSenhaPlaceholder")} required minLength={6} style={{ paddingRight: 42 }} />
                          <button type="button" className="cp-senha-toggle" onClick={() => setVerSenhaConfirm(!verSenhaConfirm)}
                            tabIndex={-1} aria-label={verSenhaConfirm ? "Ocultar" : "Mostrar"}>
                            {verSenhaConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    {erroSenha && <div className="cp-campo-erro" style={{ marginBottom: 10 }}>{erroSenha}</div>}

                    <div className="cp-campo">
                      <label className="cp-campo-label">{t("cadProf.campos.whatsapp")} <span className="cp-req">*</span></label>
                      <CampoTelefone pais={pais} value={whats} onChange={(e) => setWhats(e.target.value)} required />
                    </div>

                    {/* Seção: Atuação */}
                    <div className="cp-secao">
                      <div className="cp-secao-titulo">{t("cadProf.campos.atuacao")}</div>
                    </div>

                    <div className="cp-campo">
                      <label className="cp-campo-label">{t("cadProf.campos.atuacao")} <span className="cp-req">*</span></label>
                      <select className="vx-input" value={perfil} onChange={(e) => setPerfil(e.target.value)} style={{ minHeight: 42 }}>
                        {ORDEM_FUNCOES.map((k) => (
                          <option key={k} value={k}>{FUNCOES[k].nome} — {FUNCOES[k].completo}</option>
                        ))}
                      </select>
                    </div>
                    <p className="cp-perfil-desc">{FUNCOES[perfil]?.descricao}</p>

                    {/* Seção: Idiomas */}
                    <div className="cp-secao">
                      <div className="cp-secao-titulo">{t("cadProf.campos.idiomas")}</div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      {idiomas.map((idi, i) => (
                        <div className="cp-idioma-row" key={i}>
                          <div>
                            <ComboSelect opcoes={IDIOMAS} valor={idi.idioma}
                              onChange={(v) => setIdiomaVal(i, "idioma", v)} placeholder="Idioma" />
                          </div>
                          <div>
                            <ComboSelect opcoes={NIVEIS_IDIOMA} valor={idi.nivel}
                              onChange={(v) => setIdiomaVal(i, "nivel", v)} placeholder="Nível" />
                          </div>
                          {idiomas.length > 1 && (
                            <button type="button" className="cp-idioma-rem" onClick={() => remIdioma(i)} title="Remover">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" className="cp-foto-btn" onClick={addIdioma} style={{ marginTop: 4 }}>
                        <Plus size={14} /> {t("cadProf.campos.addIdioma")}
                      </button>
                    </div>
                  </>
                )}

                {/* ━━━━━━━━ ETAPA 2: Experiência ━━━━━━━━ */}
                {etapa === 2 && (
                  <>
                    {/* Currículo */}
                    <div className="cp-curriculo-area">
                      <div className="cp-curriculo-icon">
                        <FileText size={20} />
                      </div>
                      <div className="cp-curriculo-info">
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                          {t("cadProf.campos.curriculo")}
                          <span style={{ fontWeight: 400, color: "var(--muted-2)", marginLeft: 6, fontSize: 11.5 }}>
                            ({t("cadProf.campos.curriculoOpcional")})
                          </span>
                        </div>
                        {curriculo && <span style={{ fontSize: 12, color: "var(--muted)", display: "block", marginTop: 2 }}>{curriculo.nome}</span>}
                      </div>
                      <button type="button" className="cp-foto-btn" onClick={() => inputCurriculo.current?.click()}>
                        <Upload size={14} />
                        {curriculo ? t("cadProf.campos.trocarArquivo") : t("cadProf.campos.enviarCurriculo")}
                      </button>
                      <input ref={inputCurriculo} type="file" hidden
                        accept="application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) => selecionarCurriculo(e.target.files?.[0])} />
                    </div>
                    {curriculoErro && <div className="cp-campo-erro" style={{ marginBottom: 14 }}>{curriculoErro}</div>}

                    {/* Código de indicação */}
                    <div className="cp-campo">
                      <label className="cp-campo-label">
                        {t("cadProf.campos.indicacao")}
                        <span className="cp-opt">({t("cadProf.campos.indicacaoOpcional")})</span>
                      </label>
                      <input className="vx-input" style={{ fontFamily: "'Geist Mono','IBM Plex Mono',monospace", letterSpacing: ".08em" }}
                        value={indicacao} placeholder={t("cadProf.campos.indicacaoPlaceholder")}
                        onChange={(e) => setIndicacao(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} />
                    </div>

                    {/* Termos */}
                    <label className="cp-termos">
                      <input type="checkbox" checked={aceitouTermos} onChange={(e) => setAceitouTermos(e.target.checked)} />
                      <span>
                        {t("cadProf.campos.termos")}{" "}
                        <button type="button" className="cp-termos-link" onClick={() => setShowTermos(true)}>
                          {t("cadProf.campos.termosLink")}
                        </button>
                      </span>
                    </label>
                  </>
                )}
              </div>

              {/* ── Erro da etapa ── */}
              {erroEtapa && <div className="cp-erro">{erroEtapa}</div>}

              {/* ── Navegação ── */}
              <div className="cp-nav">
                {etapa > 0 && (
                  <button type="button" className="cp-nav-voltar" onClick={voltar}>
                    {t("cadProf.voltar")}
                  </button>
                )}
                {etapa < ETAPAS_KEYS.length - 1 ? (
                  <button type="button" className="cp-nav-avancar" onClick={avancar}>
                    {t("cadProf.continuar")}
                  </button>
                ) : (
                  <button className="cp-nav-avancar" type="submit" disabled={loading || !aceitouTermos}>
                    {loading ? t("cadProf.criando") : t("cadProf.criarConta")}
                  </button>
                )}
              </div>
            </form>

            {/* Info pós-form */}
            <div className="cp-depois">
              <b>{t("cadProf.depoisTitulo")}</b> {t("cadProf.depoisTexto")}
            </div>
          </div>

          {/* ══════════ RODAPÉ ══════════ */}
          <div className="cp-footer">
            <button className="cp-footer-link" onClick={() => navegar(ROTAS.login)}>
              {t("cadProf.jaTemConta")}
            </button>
            <div style={{ marginTop: 4 }}>
              <button className="cp-footer-link cp-footer-empresa" onClick={() => navegar(ROTAS.cadastroEmpresa)}>
                {t("cadProf.souEmpresa")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ MODAL: Guia de Foto ══════════ */}
      {mostrarGuia && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setMostrarGuia(false); }}>
          <div style={{ background: "var(--surface-solid)", borderRadius: 16, padding: 28, maxWidth: 420, width: "100%", maxHeight: "90vh", overflowY: "auto", position: "relative", border: "1px solid var(--border-strong)" }}>
            <button type="button" onClick={() => setMostrarGuia(false)} aria-label="Fechar"
              style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--muted)" }}>
              <X size={20} />
            </button>
            <h3 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>{GUIA_FOTO.titulo}</h3>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 22 }}>
              <div style={{ textAlign: "center" }}>
                <img src={exemploEnquadramento("certo")} alt="Correto" style={{ width: 100, height: 100, borderRadius: 12 }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <img src={exemploEnquadramento("errado")} alt="Incorreto" style={{ width: 100, height: 100, borderRadius: 12 }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>Requisitos</div>
              {GUIA_FOTO.requisitos.map((r) => (
                <div key={r.chave} style={{ fontSize: 12.5, marginBottom: 5, lineHeight: 1.5 }}>
                  <b style={{ color: "var(--ink)" }}>{r.texto}</b> — <span style={{ color: "var(--muted)" }}>{r.detalhe}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 5, color: "var(--green, #22c55e)" }}>
                  <CheckCircle size={13} style={{ verticalAlign: -2, marginRight: 3 }} />Recomendado
                </div>
                {GUIA_FOTO.recomendado.map((txt, i) => (
                  <div key={i} style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 2, color: "var(--muted)" }}>{txt}</div>
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 5, color: "var(--red, #ef4444)" }}>
                  <XCircle size={13} style={{ verticalAlign: -2, marginRight: 3 }} />Evitar
                </div>
                {GUIA_FOTO.evitar.map((txt, i) => (
                  <div key={i} style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 2, color: "var(--muted)" }}>{txt}</div>
                ))}
              </div>
            </div>
            <button type="button" className="cp-nav-avancar" style={{ width: "100%" }}
              onClick={() => { setMostrarGuia(false); inputFoto.current?.click(); }}>
              Entendi, escolher foto
            </button>
          </div>
        </div>
      )}
    </>
  );
}

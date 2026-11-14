import { useRef, useState } from "react";
import { Eye, EyeOff, Camera, X, CheckCircle, XCircle, Plus, Trash2, User } from "lucide-react";
import { Campo } from "../ui.jsx";
import ComboSelect from "../ui/ComboSelect.jsx";
import Termos from "./Termos.jsx";
import MolduraAuth from "./MolduraAuth.jsx";
import OnboardingProfissional from "./OnboardingProfissional.jsx";
import { FUNCOES, ORDEM_FUNCOES } from "../../../shared/funcoes.js";
import { PAISES, ESTADOS_BR, CIDADES_BR, IDIOMAS, NIVEIS_IDIOMA } from "../../../shared/localidades.js";
import { ROTAS, navegar, parametro } from "../../lib/rotas.js";
import { LIMITES, avaliarFoto, GUIA_FOTO, exemploEnquadramento } from "../../../shared/fotoPerfil.js";

const ETAPAS = [
  { id: "pessoal", label: "Dados pessoais" },
  { id: "profissional", label: "Profissional" },
  { id: "experiencia", label: "Experiência" },
];

const GENEROS = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "nao-binario", label: "Não-binário" },
  { value: "prefiro-nao-dizer", label: "Prefiro não dizer" },
];

export default function CadastroProfissional({ onRegister }) {
  const [onboardingVisto, setOnboardingVisto] = useState(false);
  const [etapa, setEtapa] = useState(0);

  const [nome, setNome] = useState("");
  const [dataNasc, setDataNasc] = useState("");
  const [genero, setGenero] = useState("");
  const [pais, setPais] = useState("BR");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [verSenhaConfirm, setVerSenhaConfirm] = useState(false);
  const [whats, setWhats] = useState("");
  const [perfil, setPerfil] = useState("sdr");
  const [idiomas, setIdiomas] = useState([{ idioma: "Português", nivel: "nativo" }]);

  const [foto, setFoto] = useState(null);
  const [fotoPrevia, setFotoPrevia] = useState("");
  const [fotoErro, setFotoErro] = useState("");
  const [mostrarGuia, setMostrarGuia] = useState(false);
  const inputFoto = useRef(null);

  const [curriculo, setCurriculo] = useState(null);
  const [curriculoErro, setCurriculoErro] = useState("");
  const inputCurriculo = useRef(null);

  const [indicacao, setIndicacao] = useState(() => (parametro("ref") || "").toUpperCase());
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [showTermos, setShowTermos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erroSenha, setErroSenha] = useState("");
  const [erroEtapa, setErroEtapa] = useState("");

  const selecionarCurriculo = (arquivo) => {
    if (!arquivo) return;
    setCurriculoErro("");
    const tiposOk = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!tiposOk.includes(arquivo.type)) { setCurriculoErro("Envie o currículo em PDF ou Word."); return; }
    if (arquivo.size > 8 * 1024 * 1024) { setCurriculoErro("O arquivo deve ter no máximo 8MB."); return; }
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
        setFotoErro(avaliacao.problemas[0]?.comoResolver || "Foto não aprovada. Tente outra.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setFoto({ base64: reader.result.split(",")[1], mimetype: arquivo.type, largura: img.naturalWidth, altura: img.naturalHeight });
        setFotoPrevia(reader.result);
      };
      reader.readAsDataURL(arquivo);
    };
    img.onerror = () => setFotoErro("Não foi possível ler a imagem. Tente outra.");
    img.src = URL.createObjectURL(arquivo);
  };

  const abrirSeletorFoto = () => {
    if (fotoPrevia) inputFoto.current?.click();
    else setMostrarGuia(true);
  };

  const addIdioma = () => setIdiomas((l) => [...l, { idioma: "", nivel: "basico" }]);
  const remIdioma = (i) => setIdiomas((l) => l.filter((_, j) => j !== i));
  const setIdiomaVal = (i, campo, val) => setIdiomas((l) => l.map((x, j) => j === i ? { ...x, [campo]: val } : x));

  const cidadeLabel = pais === "BR" && estado ? (CIDADES_BR[estado] || []).map((c) => ({ value: c, label: c })) : [];
  const estadosOpcoes = pais === "BR" ? ESTADOS_BR.map((e) => ({ value: e.uf, label: `${e.nome} (${e.uf})` })) : [];

  const validarEtapa = () => {
    setErroEtapa("");
    if (etapa === 0) {
      if (!foto) { setFotoErro("Foto de perfil é obrigatória."); return false; }
      if (!nome.trim()) { setErroEtapa("Preencha seu nome."); return false; }
      if (!dataNasc) { setErroEtapa("Preencha a data de nascimento."); return false; }
      if (!genero) { setErroEtapa("Selecione o gênero."); return false; }
      if (!pais) { setErroEtapa("Selecione o país."); return false; }
      if (pais === "BR" && !estado) { setErroEtapa("Selecione o estado."); return false; }
      if (!cidade) { setErroEtapa("Preencha a cidade."); return false; }
    }
    if (etapa === 1) {
      if (!email.trim()) { setErroEtapa("Preencha o e-mail."); return false; }
      if (senha.length < 6) { setErroEtapa("Senha precisa ter no mínimo 6 caracteres."); return false; }
      if (senha !== senhaConfirm) { setErroEtapa("As senhas não coincidem."); return false; }
      if (!whats.trim()) { setErroEtapa("Preencha o WhatsApp."); return false; }
      if (idiomas.some((i) => !i.idioma)) { setErroEtapa("Preencha todos os idiomas adicionados."); return false; }
    }
    return true;
  };

  const avancar = () => {
    if (!validarEtapa()) return;
    setEtapa((e) => Math.min(e + 1, ETAPAS.length - 1));
  };

  const voltar = () => setEtapa((e) => Math.max(e - 1, 0));

  const submit = async (e) => {
    e.preventDefault();
    setErroSenha(""); setErroEtapa("");
    if (!aceitouTermos) { setErroEtapa("Aceite os Termos de Uso para continuar."); return; }
    if (!foto) { setFotoErro("Foto de perfil é obrigatória."); setEtapa(0); return; }
    if (senha.length < 6) { setErroSenha("Mínimo 6 caracteres."); setEtapa(1); return; }
    if (senha !== senhaConfirm) { setErroSenha("As senhas não coincidem."); setEtapa(1); return; }
    setLoading(true);
    const cidadeCompleta = pais === "BR" && estado ? `${cidade}, ${estado}` : cidade;
    await onRegister({
      role: "vendedor", nome, email, senha, whats,
      cidade: cidadeCompleta, pais, estado,
      dataNascimento: dataNasc, genero,
      perfil, idiomas: idiomas.filter((i) => i.idioma),
      aceitouTermos: true, indicacao: indicacao || undefined,
      foto, curriculo: curriculo || undefined,
    });
    setLoading(false);
  };

  if (!onboardingVisto) return <OnboardingProfissional onConcluir={() => setOnboardingVisto(true)} />;

  if (showTermos) return (
    <Termos onAceitar={() => { setAceitouTermos(true); setShowTermos(false); }} onVoltar={() => setShowTermos(false)} />
  );

  return (
    <MolduraAuth
      semLogo
      tarja="Profissional de vendas"
      titulo="Crie sua conta de profissional"
      subtitulo="Preencha seus dados para começar a receber campanhas e ser remunerado por resultado."
      largura={500}
      rodape={
        <>
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => navegar(ROTAS.login)}>Já tenho conta — entrar</button>
          <div style={{ marginTop: 4 }}>
            <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => navegar(ROTAS.cadastroEmpresa)} style={{ fontSize: 12.5 }}>
              Sou empresa e quero contratar
            </button>
          </div>
        </>
      }
    >
      {/* Barra de progresso */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {ETAPAS.map((et, i) => (
          <div key={et.id} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{
              height: 4, borderRadius: 99,
              background: i <= etapa ? "var(--brand)" : "var(--border-strong)",
              transition: "background .25s",
            }} />
            <span style={{
              fontSize: 10.5, fontWeight: i === etapa ? 700 : 500,
              color: i <= etapa ? "var(--brand)" : "var(--muted)",
              textAlign: "center", letterSpacing: ".02em",
            }}>
              {et.label}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={submit}>
        {/* ══════════ ETAPA 0: Dados pessoais ══════════ */}
        {etapa === 0 && (
          <>
            {/* Foto de perfil */}
            <div style={{ marginBottom: 16 }}>
              <label className="vx-label" style={{ display: "block", marginBottom: 6 }}>
                Foto de perfil <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button type="button" onClick={abrirSeletorFoto}
                  style={{
                    width: 72, height: 72, borderRadius: "50%", border: `2px dashed ${fotoPrevia ? "var(--brand)" : "var(--border)"}`,
                    background: fotoPrevia ? "none" : "var(--bg-2)", cursor: "pointer", overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0,
                  }}>
                  {fotoPrevia
                    ? <img src={fotoPrevia} alt="Prévia" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <Camera size={24} style={{ color: "var(--text-3)" }} />}
                </button>
                <div style={{ flex: 1 }}>
                  <button type="button" className="vx-btn vx-btn-sm" onClick={abrirSeletorFoto} style={{ minHeight: 36 }}>
                    {fotoPrevia ? "Trocar foto" : "Enviar foto"}
                  </button>
                  <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4 }}>JPG, PNG ou WebP. Até {Math.round(LIMITES.tamanhoMaximoBytes / 1024 / 1024)} MB.</div>
                </div>
                <input ref={inputFoto} type="file" hidden accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => { selecionarFoto(e.target.files?.[0]); if (inputFoto.current) inputFoto.current.value = ""; }} />
              </div>
              {fotoErro && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 6 }}>{fotoErro}</div>}
            </div>

            <Campo label="Seu nome *">
              <input className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como você quer ser chamado" required />
            </Campo>

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Campo label="Data de nascimento *">
                  <input className="vx-input" type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)} required
                    style={{ minHeight: 42 }} />
                </Campo>
              </div>
              <div style={{ flex: 1 }}>
                <Campo label="Gênero *">
                  <ComboSelect opcoes={GENEROS} valor={genero} onChange={setGenero} placeholder="Selecione" />
                </Campo>
              </div>
            </div>

            <Campo label="País *">
              <ComboSelect opcoes={PAISES.map((p) => ({ value: p.code, label: p.nome }))} valor={pais}
                onChange={(v) => { setPais(v); setEstado(""); setCidade(""); }} placeholder="Selecione o país" />
            </Campo>

            {pais === "BR" ? (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Campo label="Estado *">
                    <ComboSelect opcoes={estadosOpcoes} valor={estado}
                      onChange={(v) => { setEstado(v); setCidade(""); }} placeholder="Selecione" />
                  </Campo>
                </div>
                <div style={{ flex: 1 }}>
                  <Campo label="Cidade *">
                    <ComboSelect opcoes={cidadeLabel} valor={cidade} onChange={setCidade}
                      placeholder={estado ? "Selecione" : "Selecione o estado"} disabled={!estado} />
                  </Campo>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Campo label="Estado / Região">
                    <input className="vx-input" value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="Ex.: California" />
                  </Campo>
                </div>
                <div style={{ flex: 1 }}>
                  <Campo label="Cidade *">
                    <input className="vx-input" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: New York" required />
                  </Campo>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════ ETAPA 1: Profissional ══════════ */}
        {etapa === 1 && (
          <>
            <Campo label="E-mail *">
              <input className="vx-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
            </Campo>

            <Campo label="Senha *">
              <div style={{ position: "relative" }}>
                <input className="vx-input" type={verSenha ? "text" : "password"} value={senha}
                  onChange={(e) => { setSenha(e.target.value); setErroSenha(""); }}
                  placeholder="Mínimo 6 caracteres" required minLength={6} style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setVerSenha(!verSenha)} tabIndex={-1} aria-label={verSenha ? "Ocultar" : "Mostrar"}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-3)" }}>
                  {verSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Campo>

            <Campo label="Confirmar senha *">
              <div style={{ position: "relative" }}>
                <input className="vx-input" type={verSenhaConfirm ? "text" : "password"} value={senhaConfirm}
                  onChange={(e) => { setSenhaConfirm(e.target.value); setErroSenha(""); }}
                  placeholder="Repita a senha" required minLength={6} style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setVerSenhaConfirm(!verSenhaConfirm)} tabIndex={-1} aria-label={verSenhaConfirm ? "Ocultar" : "Mostrar"}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-3)" }}>
                  {verSenhaConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Campo>
            {erroSenha && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: -8, marginBottom: 10 }}>{erroSenha}</div>}

            <Campo label="WhatsApp *">
              <input className="vx-input" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(11) 90000-0000" inputMode="tel" required />
            </Campo>

            <Campo label="Como você atua hoje *">
              <select className="vx-input" value={perfil} onChange={(e) => setPerfil(e.target.value)} style={{ minHeight: 42 }}>
                {ORDEM_FUNCOES.map((k) => (
                  <option key={k} value={k}>{FUNCOES[k].nome} — {FUNCOES[k].completo}</option>
                ))}
              </select>
            </Campo>
            <p className="vx-mut" style={{ fontSize: 12, marginTop: -4, marginBottom: 14, lineHeight: 1.5 }}>
              {FUNCOES[perfil]?.descricao}
            </p>

            {/* Idiomas */}
            <div style={{ marginBottom: 16 }}>
              <label className="vx-label" style={{ display: "block", marginBottom: 8 }}>Idiomas falados</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {idiomas.map((idi, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <ComboSelect opcoes={IDIOMAS} valor={idi.idioma}
                        onChange={(v) => setIdiomaVal(i, "idioma", v)} placeholder="Idioma" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <ComboSelect opcoes={NIVEIS_IDIOMA} valor={idi.nivel}
                        onChange={(v) => setIdiomaVal(i, "nivel", v)} placeholder="Nível" />
                    </div>
                    {idiomas.length > 1 && (
                      <button type="button" onClick={() => remIdioma(i)} title="Remover"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--muted)", flexShrink: 0 }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={addIdioma}
                style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
                <Plus size={14} /> Adicionar idioma
              </button>
            </div>
          </>
        )}

        {/* ══════════ ETAPA 2: Experiência ══════════ */}
        {etapa === 2 && (
          <>
            {/* Currículo */}
            <div style={{ marginBottom: 16 }}>
              <label className="vx-label" style={{ display: "block", marginBottom: 6 }}>
                Currículo <span className="vx-mut" style={{ fontWeight: 400 }}>(opcional · PDF ou Word)</span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="vx-btn vx-btn-sm" onClick={() => inputCurriculo.current?.click()}>
                  {curriculo ? "Trocar arquivo" : "Enviar currículo"}
                </button>
                {curriculo && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{curriculo.nome}</span>}
              </div>
              <input ref={inputCurriculo} type="file" hidden
                accept="application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => selecionarCurriculo(e.target.files?.[0])} />
              {curriculoErro && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 6 }}>{curriculoErro}</div>}
            </div>

            <Campo label="Código de indicação (opcional)">
              <input className="vx-input vx-mono" value={indicacao} placeholder="Ex.: SXMD9JG"
                onChange={(e) => setIndicacao(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
                style={{ letterSpacing: ".08em" }} />
            </Campo>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "12px 0", cursor: "pointer", fontSize: 12.5, color: "var(--text-2)" }}>
              <input type="checkbox" checked={aceitouTermos} onChange={(e) => setAceitouTermos(e.target.checked)} style={{ marginTop: 2 }} />
              <span>
                Li e aceito os{" "}
                <button type="button" onClick={() => setShowTermos(true)} style={{ color: "var(--brand)", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "inherit" }}>
                  Termos de Uso e Política de Privacidade
                </button>
              </span>
            </label>
          </>
        )}

        {/* Erro da etapa */}
        {erroEtapa && (
          <div style={{ color: "var(--red)", fontSize: 12.5, marginBottom: 10, padding: "8px 12px", background: "var(--red-50)", borderRadius: "var(--radius-sm)", border: "1px solid var(--red-100)" }}>
            {erroEtapa}
          </div>
        )}

        {/* Navegação */}
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          {etapa > 0 && (
            <button type="button" className="vx-btn vx-btn-block" onClick={voltar} style={{ flex: 1 }}>
              Voltar
            </button>
          )}
          {etapa < ETAPAS.length - 1 ? (
            <button type="button" className="vx-btn vx-btn-primary vx-btn-block" onClick={avancar} style={{ flex: 2 }}>
              Próximo
            </button>
          ) : (
            <button className="vx-btn vx-btn-primary vx-btn-block" type="submit" disabled={loading || !aceitouTermos} style={{ flex: 2 }}>
              {loading ? "Criando…" : "Criar conta de profissional"}
            </button>
          )}
        </div>
      </form>

      <hr className="vx-sep" />
      <div className="vx-mut" style={{ fontSize: 12.3, lineHeight: 1.6 }}>
        <b style={{ color: "var(--text-2)" }}>O que acontece depois:</b> sua conta passa por uma triagem curta antes de
        liberar as campanhas. Se o resultado for parcial, você é direcionado ao RYCS Academy para completar a trilha e
        tentar de novo.
      </div>

      {/* Modal guia de foto */}
      {mostrarGuia && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setMostrarGuia(false); }}>
          <div style={{ background: "var(--bg)", borderRadius: 16, padding: 24, maxWidth: 400, width: "100%", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <button type="button" onClick={() => setMostrarGuia(false)} aria-label="Fechar"
              style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-3)" }}>
              <X size={20} />
            </button>
            <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>{GUIA_FOTO.titulo}</h3>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 20 }}>
              <div style={{ textAlign: "center" }}>
                <img src={exemploEnquadramento("certo")} alt="Correto" style={{ width: 100, height: 100, borderRadius: 12 }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <img src={exemploEnquadramento("errado")} alt="Incorreto" style={{ width: 100, height: 100, borderRadius: 12 }} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: "var(--text-2)" }}>Requisitos</div>
              {GUIA_FOTO.requisitos.map((r) => (
                <div key={r.chave} style={{ fontSize: 12.5, marginBottom: 4, lineHeight: 1.5 }}>
                  <b>{r.texto}</b> — {r.detalhe}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: "var(--green, #22c55e)" }}>
                  <CheckCircle size={13} style={{ verticalAlign: -2, marginRight: 3 }} />Recomendado
                </div>
                {GUIA_FOTO.recomendado.map((t, i) => (
                  <div key={i} style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 2 }}>{t}</div>
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: "var(--red, #ef4444)" }}>
                  <XCircle size={13} style={{ verticalAlign: -2, marginRight: 3 }} />Evitar
                </div>
                {GUIA_FOTO.evitar.map((t, i) => (
                  <div key={i} style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 2 }}>{t}</div>
                ))}
              </div>
            </div>
            <button type="button" className="vx-btn vx-btn-primary vx-btn-block" style={{ minHeight: 44 }}
              onClick={() => { setMostrarGuia(false); inputFoto.current?.click(); }}>
              Entendi, escolher foto
            </button>
          </div>
        </div>
      )}
    </MolduraAuth>
  );
}

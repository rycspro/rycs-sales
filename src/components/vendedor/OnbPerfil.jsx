import { useState, useEffect, useRef, useId, useCallback } from "react";
import {
  ArrowRight, MapPin, Briefcase, User, Video, Globe, Heart, Compass,
  Award, Bold, Italic, List, Link2, Eye, EyeOff, Plus, Trash2, Upload,
  X, Linkedin, Instagram, Facebook, Youtube, ExternalLink, FileText,
  CheckCircle,
} from "lucide-react";
import { api, apiDelete } from "../../lib/api.js";

/* ─── constantes ─── */
const AZUL = "#318CE7";
const MAX_BIO = 1500;
const MAX_VIDEO_MB = 30;

const INTERESSES = [
  "Tecnologia", "Empreendedorismo", "Leitura", "Educação",
  "Comunicação", "Criatividade", "Viagens", "Esportes",
  "Finanças", "Inovação", "Desenvolvimento pessoal",
];

const REDES = [
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "linkedin.com/in/seu-perfil" },
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "instagram.com/seu-perfil" },
  { key: "facebook", label: "Facebook", icon: Facebook, placeholder: "facebook.com/seu-perfil" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "youtube.com/@seu-canal" },
  { key: "tiktok", label: "TikTok", icon: ExternalLink, placeholder: "tiktok.com/@seu-perfil" },
  { key: "site", label: "Site pessoal", icon: Globe, placeholder: "www.seusite.com" },
  { key: "portfolioExterno", label: "Portfólio externo", icon: FileText, placeholder: "behance.net/seu-perfil" },
];

const SUGESTOES_BIO = [
  "O que mais me motiva",
  "Meus pontos fortes",
  "Como gosto de trabalhar",
  "O que quero conquistar",
];

const FORMA_TRABALHO = [
  { value: "individual", label: "Individualmente" },
  { value: "equipe", label: "Em equipe" },
  { value: "ambas", label: "Gosto das duas formas" },
];

const ATIVIDADES = [
  "Comunicação e relacionamento", "Criatividade", "Organização",
  "Análise e estratégia", "Negociação", "Resolução de problemas", "Execução prática",
];

const MOTIVACOES = [
  { value: "aprender", label: "Aprender e evoluir" },
  { value: "resultados", label: "Alcançar resultados" },
  { value: "autonomia", label: "Autonomia e flexibilidade" },
  { value: "pessoas", label: "Trabalhar com pessoas" },
  { value: "desafios", label: "Superar desafios" },
];

const ORIENTACOES = [
  { value: "detalhadas", label: "Instruções detalhadas" },
  { value: "autonomia", label: "Objetivos claros com autonomia" },
  { value: "frequente", label: "Acompanhamento frequente" },
  { value: "depende", label: "Depende da atividade" },
];

/* ─── CSS scoped ─── */
const css = `
.sa-wrap{max-width:880px;margin:0 auto}
.sa-hero-card{display:flex;align-items:center;gap:20px;padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:8px}
.sa-avatar{width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--border);flex:none;background:var(--surface-1);display:grid;place-items:center;color:var(--muted);overflow:hidden}
.sa-avatar img{width:100%;height:100%;object-fit:cover}
.sa-hero-info h2{font-size:20px;margin:0 0 2px;font-weight:700}
.sa-hero-info p{font-size:14px;color:var(--muted);margin:0;display:flex;align-items:center;gap:4px}
.sa-section{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;margin-bottom:16px}
.sa-section-head{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.sa-section-head svg{color:${AZUL};flex:none}
.sa-section-head h3{font-size:17px;font-weight:700;margin:0}
.sa-section-desc{font-size:14px;color:var(--muted);line-height:1.6;margin:0 0 16px}
.sa-editor-wrap{position:relative;border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden}
.sa-toolbar{display:flex;gap:2px;padding:6px 8px;border-bottom:1px solid var(--border);background:var(--surface-1)}
.sa-toolbar button{width:32px;height:32px;border:none;background:none;border-radius:var(--radius-sm);display:grid;place-items:center;cursor:pointer;color:var(--ink-2);transition:all .15s}
.sa-toolbar button:hover{background:var(--brand-50);color:${AZUL}}
.sa-editor{min-height:120px;max-height:300px;overflow-y:auto;padding:12px 14px;font-size:14px;line-height:1.7;outline:none;color:var(--ink)}
.sa-editor:empty::before{content:attr(data-placeholder);color:var(--muted);pointer-events:none}
.sa-editor b,.sa-editor strong{font-weight:700}
.sa-editor i,.sa-editor em{font-style:italic}
.sa-editor ul,.sa-editor ol{margin:4px 0;padding-left:20px}
.sa-editor a{color:${AZUL};text-decoration:underline}
.sa-counter{font-size:12px;color:var(--muted);text-align:right;margin-top:6px}
.sa-counter.over{color:var(--red)}
.sa-sugestoes{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.sa-sugestao{padding:6px 14px;border:1px solid var(--border);border-radius:var(--radius-pill);font-size:13px;background:var(--surface);color:var(--ink-2);cursor:pointer;transition:all .15s}
.sa-sugestao:hover{border-color:${AZUL};color:${AZUL};background:var(--brand-50)}
.sa-video-zone{border:2px dashed var(--border);border-radius:var(--radius-md);padding:32px;text-align:center;color:var(--muted);transition:border-color .15s;cursor:pointer;position:relative}
.sa-video-zone:hover{border-color:${AZUL}}
.sa-video-zone input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer}
.sa-video-zone svg{margin-bottom:8px}
.sa-video-preview{position:relative;border-radius:var(--radius-md);overflow:hidden;background:#000}
.sa-video-preview video{width:100%;max-height:360px;display:block}
.sa-video-actions{display:flex;gap:8px;margin-top:10px}
.sa-rede-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.sa-rede-row svg{flex:none;color:var(--muted)}
.sa-rede-row .vx-input{flex:1}
.sa-rede-check{margin-left:auto;display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted);cursor:pointer;flex:none;white-space:nowrap}
.sa-rede-check input{accent-color:${AZUL}}
.sa-chips{display:flex;flex-wrap:wrap;gap:8px}
.sa-chip{padding:8px 16px;border:1px solid var(--border);border-radius:var(--radius-pill);font-size:13px;background:var(--surface);color:var(--ink-2);cursor:pointer;transition:all .15s;user-select:none}
.sa-chip:hover{border-color:${AZUL};color:${AZUL}}
.sa-chip[data-on="1"]{background:var(--brand-50);border-color:${AZUL};color:${AZUL};font-weight:600}
.sa-radio-group{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.sa-radio{padding:8px 16px;border:1px solid var(--border);border-radius:var(--radius-pill);font-size:13px;background:var(--surface);color:var(--ink-2);cursor:pointer;transition:all .15s}
.sa-radio:hover{border-color:${AZUL}}
.sa-radio[data-on="1"]{background:var(--brand-50);border-color:${AZUL};color:${AZUL};font-weight:600}
.sa-pergunta{margin-bottom:16px}
.sa-pergunta-label{font-size:14px;font-weight:600;margin-bottom:8px;color:var(--ink)}
.sa-portfolio-item{border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:10px;position:relative}
.sa-portfolio-rm{position:absolute;top:10px;right:10px;width:28px;height:28px;border:1px solid var(--border);border-radius:var(--radius-sm);display:grid;place-items:center;background:var(--surface);color:var(--muted);cursor:pointer;transition:all .15s}
.sa-portfolio-rm:hover{border-color:var(--red);color:var(--red)}
.sa-portfolio-fields{display:grid;gap:10px}
.sa-portfolio-fields .vx-input{min-height:40px}
.sa-add-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:1px dashed var(--border);border-radius:var(--radius-md);font-size:13px;background:none;color:var(--ink-2);cursor:pointer;transition:all .15s}
.sa-add-btn:hover{border-color:${AZUL};color:${AZUL}}
.sa-priv-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)}
.sa-priv-row:last-child{border:0}
.sa-priv-label{font-size:14px;color:var(--ink-2)}
.sa-priv-toggle{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer}
.sa-priv-toggle input{accent-color:${AZUL}}
.sa-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.sa-msg-discreta{font-size:13px;color:var(--muted);font-style:italic;margin-top:4px;line-height:1.5}
.sa-upload-progress{margin-top:8px}
.sa-upload-bar{height:4px;background:var(--surface-1);border-radius:2px;overflow:hidden}
.sa-upload-fill{height:100%;background:${AZUL};transition:width .3s}
@media(max-width:700px){
  .sa-grid-2{grid-template-columns:1fr}
  .sa-hero-card{flex-direction:column;text-align:center}
  .sa-hero-info p{justify-content:center}
  .sa-rede-row{flex-wrap:wrap}
  .sa-rede-check{margin-left:0}
}
`;

export default function OnbPerfil({ aviso, aoAvancar, modoPerfil = false, apenasPrivacidade = false }) {
  const id = useId();
  const editorRef = useRef(null);

  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Bio
  const [bio, setBio] = useState("");
  const [bioLen, setBioLen] = useState(0);

  // Video
  const [video, setVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [videoSalvo, setVideoSalvo] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Redes sociais
  const [redes, setRedes] = useState({});
  const [redesVisiveis, setRedesVisiveis] = useState({});

  // Interesses
  const [interesses, setInteresses] = useState([]);

  // Jeito de trabalhar
  const [formaTrabalho, setFormaTrabalho] = useState("");
  const [atividades, setAtividades] = useState([]);
  const [motivacao, setMotivacao] = useState("");
  const [orientacao, setOrientacao] = useState("");

  // Portfolio
  const [portfolio, setPortfolio] = useState([]);

  // Privacidade
  const [privacidade, setPrivacidade] = useState({
    bio: true, video: true, redesSociais: true, interesses: true, portfolio: true,
  });

  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const r = await api("/onboarding-pro");
    if (r && !r.error) {
      setPerfil(r.perfil);
      if (r.perfil.bio) {
        setBio(r.perfil.bio);
      }
      if (r.perfil.linkedin) {
        setRedes(prev => ({ ...prev, linkedin: r.perfil.linkedin }));
      }
      if (r.videoApresentacao) setVideoSalvo(r.videoApresentacao);

      const ap = r.apresentacao || {};
      if (ap.redesSociais) setRedes(prev => ({ ...prev, ...ap.redesSociais }));
      if (ap.interesses) setInteresses(ap.interesses);
      if (ap.jeitoTrabalhar) {
        if (ap.jeitoTrabalhar.formaTrabalho) setFormaTrabalho(ap.jeitoTrabalhar.formaTrabalho);
        if (ap.jeitoTrabalhar.atividades) setAtividades(ap.jeitoTrabalhar.atividades);
        if (ap.jeitoTrabalhar.motivacao) setMotivacao(ap.jeitoTrabalhar.motivacao);
        if (ap.jeitoTrabalhar.orientacao) setOrientacao(ap.jeitoTrabalhar.orientacao);
      }
      if (ap.portfolio) setPortfolio(ap.portfolio);
      if (ap.privacidade) setPrivacidade(prev => ({ ...prev, ...ap.privacidade }));
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (editorRef.current && bio && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = bio;
      setBioLen(editorRef.current.textContent.length);
    }
  }, [bio, carregando]);

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.textContent || "";
    setBioLen(text.length);
  };

  const execCmd = (cmd, val) => {
    document.execCommand(cmd, false, val || null);
    editorRef.current?.focus();
    handleEditorInput();
  };

  const inserirSugestao = (txt) => {
    if (!editorRef.current) return;
    const atual = editorRef.current.innerHTML;
    const sep = atual && atual !== "<br>" ? "<br><br>" : "";
    editorRef.current.innerHTML = atual + sep + `<b>${txt}:</b> `;
    editorRef.current.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    handleEditorInput();
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["video/mp4", "video/webm"].includes(file.type)) {
      aviso("Formato não suportado. Use MP4 ou WebM.");
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      aviso(`Vídeo muito grande. Máximo de ${MAX_VIDEO_MB}MB.`);
      return;
    }
    setVideo(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const uploadVideo = async () => {
    if (!video) return;
    setUploadingVideo(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((ok, fail) => {
        reader.onload = () => ok(reader.result.split(",")[1]);
        reader.onerror = fail;
        reader.readAsDataURL(video);
      });
      const r = await api("/onboarding-pro/video", { base64, mimetype: video.type });
      if (r?.ok) {
        setVideoSalvo(videoPreview);
        setVideo(null);
        aviso?.("Vídeo salvo!");
      } else {
        aviso(r?.error || "Erro ao enviar vídeo.");
      }
    } catch {
      aviso("Falha ao enviar vídeo. Tente novamente.");
    }
    setUploadingVideo(false);
  };

  const excluirVideo = async () => {
    const r = await apiDelete("/onboarding-pro/video");
    if (r?.ok) {
      setVideoSalvo("");
      setVideo(null);
      setVideoPreview("");
    }
  };

  const toggleInteresse = (item) => {
    setInteresses(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const toggleAtividade = (item) => {
    setAtividades(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const addPortfolio = () => {
    setPortfolio(prev => [...prev, { titulo: "", descricao: "", link: "" }]);
  };

  const updatePortfolio = (idx, campo, val) => {
    setPortfolio(prev => prev.map((p, i) => i === idx ? { ...p, [campo]: val } : p));
  };

  const removePortfolio = (idx) => {
    setPortfolio(prev => prev.filter((_, i) => i !== idx));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setSalvando(true);

    const bioHtml = editorRef.current?.innerHTML || "";

    if (video && !videoSalvo) {
      await uploadVideo();
    }

    const payload = {
      bio: bioHtml,
      linkedin: redes.linkedin || "",
      redesSociais: redes,
      interesses,
      jeitoTrabalhar: { formaTrabalho, atividades, motivacao, orientacao },
      portfolio: portfolio.filter(p => p.titulo),
      privacidade,
    };

    const r = await api("/onboarding-pro/perfil", payload);
    setSalvando(false);

    if (r?.error) {
      aviso(r.error);
      return;
    }
    if (modoPerfil) { aviso?.("Apresentação atualizada."); window.scrollTo?.({ top: 0, behavior: "smooth" }); }
    else aoAvancar("quiz");
  };

  if (carregando) {
    return <div className="vx-onb-estado">Carregando...</div>;
  }

  const nomeCompleto = [perfil?.nome, perfil?.sobrenome].filter(Boolean).join(" ");
  const local = [perfil?.cidade, perfil?.estado].filter(Boolean).join(", ");

  return (
    <>
      <style>{css}</style>
      <div className="sa-wrap">
        {/* Header */}
        <div className="vx-onb-eyebrow" style={{ marginBottom: 6 }}>
          {apenasPrivacidade ? "Configurações" : modoPerfil ? "Apresentação e personalidade" : "Passo 1 de 3 — Sua Apresentação"}
        </div>
        <h1 className="vx-disp" style={{ fontSize: 28, margin: "0 0 6px" }}>
          {apenasPrivacidade ? "Privacidade do perfil." : modoPerfil ? "Dê personalidade ao seu perfil." : "Agora, vamos dar personalidade ao seu perfil."}
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, margin: "0 0 24px", maxWidth: 600 }}>
          {apenasPrivacidade
            ? "Escolha o que as empresas podem ver no seu perfil. Nada aqui é obrigatório."
            : modoPerfil
            ? "É isto que as empresas veem sobre você além da experiência. Edite quando quiser."
            : "Suas habilidades e experiências já estão cadastradas. Falta apenas mostrar às empresas quem está por trás delas."}
        </p>
        {!apenasPrivacidade && (
          <p className="sa-msg-discreta" style={{ marginBottom: 24 }}>
            Esta parte é sobre você. Compartilhe o que quiser e mostre sua personalidade.
          </p>
        )}

        <form onSubmit={enviar} noValidate>
          {!apenasPrivacidade && (<>
          {/* 1. Identidade */}
          <div className="sa-hero-card">
            <div className="sa-avatar">
              {perfil?.foto
                ? <img src={perfil.foto} alt={nomeCompleto} />
                : <User size={32} />}
            </div>
            <div className="sa-hero-info">
              <h2>{nomeCompleto || "Profissional"}</h2>
              {local && <p><MapPin size={14} /> {local}{perfil?.pais && perfil.pais !== "Brasil" ? `, ${perfil.pais}` : ""}</p>}
              {perfil?.areaAtuacao && <p><Briefcase size={14} /> {perfil.areaAtuacao === "b2b" ? "B2B" : perfil.areaAtuacao === "b2c" ? "B2C" : perfil.areaAtuacao === "ambos" ? "B2B e B2C" : perfil.areaAtuacao}</p>}
            </div>
          </div>

          <div className="sa-grid-2" style={{ marginTop: 16 }}>
            <div>
              {/* 2. Biografia */}
              <div className="sa-section">
                <div className="sa-section-head">
                  <FileText size={20} />
                  <h3>Conte um pouco sobre você</h3>
                </div>
                <p className="sa-section-desc">
                  Este é seu espaço para se apresentar com suas próprias palavras. Fale sobre seus interesses, sua personalidade, o que te motiva e como gosta de trabalhar.
                </p>

                <div className="sa-editor-wrap">
                  <div className="sa-toolbar">
                    <button type="button" onClick={() => execCmd("bold")} title="Negrito"><Bold size={16} /></button>
                    <button type="button" onClick={() => execCmd("italic")} title="Itálico"><Italic size={16} /></button>
                    <button type="button" onClick={() => execCmd("insertUnorderedList")} title="Lista"><List size={16} /></button>
                    <button type="button" onClick={() => {
                      const url = prompt("URL do link:");
                      if (url && /^https?:\/\//i.test(url)) execCmd("createLink", url);
                    }} title="Link"><Link2 size={16} /></button>
                  </div>
                  <div
                    ref={editorRef}
                    className="sa-editor"
                    contentEditable
                    data-placeholder="Escreva sobre você, sua personalidade, o que te motiva..."
                    onInput={handleEditorInput}
                    role="textbox"
                    aria-label="Biografia"
                    aria-multiline="true"
                  />
                </div>
                <div className={`sa-counter${bioLen > MAX_BIO ? " over" : ""}`}>
                  {bioLen}/{MAX_BIO} caracteres
                </div>

                <div className="sa-sugestoes">
                  {SUGESTOES_BIO.map(s => (
                    <button key={s} type="button" className="sa-sugestao" onClick={() => inserirSugestao(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Vídeo */}
              <div className="sa-section">
                <div className="sa-section-head">
                  <Video size={20} />
                  <h3>Apresente-se em vídeo</h3>
                </div>
                <p className="sa-section-desc">
                  Em até 60 segundos, mostre sua comunicação, personalidade e o que torna você um profissional interessante para as empresas.
                </p>

                {videoSalvo && !videoPreview ? (
                  <div className="sa-video-preview">
                    <video src={videoSalvo} controls />
                    <div className="sa-video-actions">
                      <label className="sa-add-btn" style={{ cursor: "pointer" }}>
                        <Upload size={14} /> Substituir
                        <input type="file" accept="video/mp4,video/webm" onChange={handleVideoSelect} hidden />
                      </label>
                      <button type="button" className="sa-add-btn" style={{ borderColor: "var(--red)", color: "var(--red)" }} onClick={excluirVideo}>
                        <Trash2 size={14} /> Excluir
                      </button>
                    </div>
                  </div>
                ) : videoPreview ? (
                  <div className="sa-video-preview">
                    <video src={videoPreview} controls />
                    <div className="sa-video-actions">
                      <button type="button" className="vx-btn vx-btn-primary" style={{ fontSize: 13, padding: "8px 16px" }} onClick={uploadVideo} disabled={uploadingVideo}>
                        {uploadingVideo ? "Enviando..." : "Salvar vídeo"}
                      </button>
                      <button type="button" className="sa-add-btn" onClick={() => { setVideo(null); setVideoPreview(""); }}>
                        <X size={14} /> Cancelar
                      </button>
                    </div>
                    {uploadingVideo && (
                      <div className="sa-upload-progress">
                        <div className="sa-upload-bar"><div className="sa-upload-fill" style={{ width: "60%" }} /></div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="sa-video-zone">
                    <input type="file" accept="video/mp4,video/webm" onChange={handleVideoSelect} />
                    <Upload size={28} />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Enviar vídeo</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>MP4 ou WebM, até {MAX_VIDEO_MB}MB</div>
                  </div>
                )}

                <p className="sa-section-desc" style={{ marginTop: 10, marginBottom: 0, fontSize: 12 }}>
                  Opcional. Você pode adicionar depois.
                </p>
              </div>

              {/* 7. Portfolio */}
              <div className="sa-section">
                <div className="sa-section-head">
                  <Award size={20} />
                  <h3>Mostre do que você se orgulha</h3>
                </div>
                <p className="sa-section-desc">
                  Compartilhe projetos, trabalhos ou conquistas que representem sua trajetória.
                </p>

                {portfolio.map((item, idx) => (
                  <div key={idx} className="sa-portfolio-item">
                    <button type="button" className="sa-portfolio-rm" onClick={() => removePortfolio(idx)}>
                      <Trash2 size={14} />
                    </button>
                    <div className="sa-portfolio-fields">
                      <input
                        className="vx-input"
                        placeholder="Título do projeto ou conquista"
                        value={item.titulo}
                        onChange={e => updatePortfolio(idx, "titulo", e.target.value)}
                        maxLength={100}
                      />
                      <textarea
                        className="vx-input"
                        placeholder="Breve descrição"
                        value={item.descricao}
                        onChange={e => updatePortfolio(idx, "descricao", e.target.value)}
                        rows={2}
                        style={{ resize: "vertical", minHeight: 50 }}
                        maxLength={300}
                      />
                      <input
                        className="vx-input"
                        placeholder="Link externo (opcional)"
                        value={item.link}
                        onChange={e => updatePortfolio(idx, "link", e.target.value)}
                      />
                    </div>
                  </div>
                ))}

                {portfolio.length < 10 && (
                  <button type="button" className="sa-add-btn" onClick={addPortfolio}>
                    <Plus size={14} /> Adicionar item
                  </button>
                )}
              </div>
            </div>

            <div>
              {/* 4. Redes sociais */}
              <div className="sa-section">
                <div className="sa-section-head">
                  <Globe size={20} />
                  <h3>Onde podemos encontrar você?</h3>
                </div>
                <p className="sa-section-desc">
                  Adicione suas redes sociais e permita que as empresas conheçam mais sobre você e seu trabalho.
                </p>

                {REDES.map(r => {
                  const Icon = r.icon;
                  return (
                    <div key={r.key} className="sa-rede-row">
                      <Icon size={18} />
                      <input
                        className="vx-input"
                        placeholder={r.placeholder}
                        value={redes[r.key] || ""}
                        onChange={e => setRedes(prev => ({ ...prev, [r.key]: e.target.value }))}
                      />
                    </div>
                  );
                })}
              </div>

              {/* 5. Interesses */}
              <div className="sa-section">
                <div className="sa-section-head">
                  <Heart size={20} />
                  <h3>O que faz parte do seu mundo?</h3>
                </div>
                <p className="sa-section-desc">
                  Seus interesses ajudam a mostrar um pouco mais sobre quem você é além da sua experiência profissional.
                </p>

                <div className="sa-chips">
                  {INTERESSES.map(item => (
                    <button
                      key={item}
                      type="button"
                      className="sa-chip"
                      data-on={interesses.includes(item) ? "1" : undefined}
                      onClick={() => toggleInteresse(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Jeito de trabalhar */}
              <div className="sa-section">
                <div className="sa-section-head">
                  <Compass size={20} />
                  <h3>Como você gosta de trabalhar?</h3>
                </div>

                <div className="sa-pergunta">
                  <div className="sa-pergunta-label">Você prefere trabalhar de que forma?</div>
                  <div className="sa-radio-group">
                    {FORMA_TRABALHO.map(o => (
                      <button key={o.value} type="button" className="sa-radio"
                        data-on={formaTrabalho === o.value ? "1" : undefined}
                        onClick={() => setFormaTrabalho(o.value)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sa-pergunta">
                  <div className="sa-pergunta-label">Que tipo de atividade mais combina com você?</div>
                  <div className="sa-chips">
                    {ATIVIDADES.map(a => (
                      <button key={a} type="button" className="sa-chip"
                        data-on={atividades.includes(a) ? "1" : undefined}
                        onClick={() => toggleAtividade(a)}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sa-pergunta" style={{ marginTop: 14 }}>
                  <div className="sa-pergunta-label">O que mais te motiva profissionalmente?</div>
                  <div className="sa-radio-group">
                    {MOTIVACOES.map(o => (
                      <button key={o.value} type="button" className="sa-radio"
                        data-on={motivacao === o.value ? "1" : undefined}
                        onClick={() => setMotivacao(o.value)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sa-pergunta">
                  <div className="sa-pergunta-label">Como você prefere receber orientações?</div>
                  <div className="sa-radio-group">
                    {ORIENTACOES.map(o => (
                      <button key={o.value} type="button" className="sa-radio"
                        data-on={orientacao === o.value ? "1" : undefined}
                        onClick={() => setOrientacao(o.value)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
          </>)}

          {apenasPrivacidade && (
            <div className="sa-section" style={{ maxWidth: 560, margin: "0 auto" }}>
              <div className="sa-section-head">
                <Eye size={20} />
                <h3>Privacidade</h3>
              </div>
              <p className="sa-section-desc">
                Escolha o que as empresas podem ver no seu perfil.
              </p>
              {[
                { key: "bio", label: "Biografia" },
                { key: "video", label: "Vídeo de apresentação" },
                { key: "redesSociais", label: "Redes sociais" },
                { key: "interesses", label: "Interesses pessoais" },
                { key: "portfolio", label: "Portfólio e conquistas" },
              ].map(p => (
                <div key={p.key} className="sa-priv-row">
                  <span className="sa-priv-label">{p.label}</span>
                  <label className="sa-priv-toggle">
                    <input type="checkbox" checked={privacidade[p.key] !== false}
                      onChange={e => setPrivacidade(prev => ({ ...prev, [p.key]: e.target.checked }))} />
                    {privacidade[p.key] !== false ? <><Eye size={14} /> Visível</> : <><EyeOff size={14} /> Oculto</>}
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* Botão principal */}
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <button type="submit" className="vx-btn vx-btn-primary vx-btn-block vx-onb-btn" disabled={salvando}
              style={{ maxWidth: 420, margin: "0 auto" }}>
              {salvando ? "Salvando..." : apenasPrivacidade ? "Salvar privacidade" : modoPerfil ? "Salvar apresentação" : <>Continuar para os testes <ArrowRight size={16} /></>}
            </button>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              Todos os campos são opcionais. Você pode editar depois.
            </p>
          </div>
        </form>
      </div>
    </>
  );
}

import { useState, useRef, useId } from "react";
import { Camera, User, ArrowRight } from "lucide-react";
import { api } from "../../lib/api.js";
import { CampoSenha } from "../ui.jsx";
import { GUIA_FOTO, LIMITES, exemploEnquadramento } from "../../../shared/fotoPerfil.js";

export default function OnbPerfil({ aviso, aoAvancar }) {
  const id = useId();
  const fileRef = useRef(null);

  const [nome, setNome] = useState("");
  const [bio, setBio] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [foto, setFoto] = useState(null);
  const [fotoPrevia, setFotoPrevia] = useState(null);
  const [fotoErro, setFotoErro] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState({});

  const aoEscolherFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!LIMITES.tiposAceitos.includes(file.type)) {
      setFotoErro("Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > LIMITES.tamanhoMaximoBytes) {
      setFotoErro(`A imagem precisa ter até ${Math.round(LIMITES.tamanhoMaximoBytes / 1024 / 1024)} MB.`);
      return;
    }

    setFotoErro("");
    setEnviandoFoto(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      const img = new Image();
      img.onload = async () => {
        const r = await api("/onboarding-pro/foto", {
          base64, mimetype: file.type, largura: img.width, altura: img.height,
        });
        setEnviandoFoto(false);
        if (r?.error) {
          setFotoErro(r.avaliacao?.problemas?.map((p) => p.comoResolver).join(" ") || r.error);
          return;
        }
        setFoto(r.foto);
        setFotoPrevia(r.foto);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const enviar = async (e) => {
    e.preventDefault();
    const novosErros = {};
    if (!nome.trim()) novosErros.nome = "Informe seu nome.";
    if (!whatsapp.trim()) novosErros.whatsapp = "WhatsApp é obrigatório.";
    if (!bio.trim()) novosErros.bio = "Conte um pouco sobre você.";
    if (!foto && !fotoPrevia) novosErros.foto = "Foto de perfil é obrigatória.";
    if (Object.keys(novosErros).length) { setErros(novosErros); return; }

    setSalvando(true);
    const r = await api("/onboarding-pro/perfil", { nome, bio, whatsapp, linkedin });
    setSalvando(false);
    if (r?.error) {
      if (r.campo) setErros({ [r.campo]: r.error });
      else aviso(r.error);
      return;
    }
    aoAvancar("quiz");
  };

  return (
    <div className="vx-onb-duas">
      <section className="vx-onb-hero">
        <div className="vx-onb-eyebrow">Passo 1 de 3</div>
        <h1 className="vx-disp" style={{ fontSize: 30, marginTop: 10 }}>Monte seu perfil profissional</h1>
        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, marginTop: 12 }}>
          As empresas escolhem profissionais pelo perfil. Quanto mais completo, mais campanhas você recebe.
        </p>
        <ul className="vx-onb-proximos">
          <li><span>2</span> Quiz de personalidade e experiência</li>
          <li><span>3</span> Oportunidades disponíveis</li>
        </ul>
      </section>

      <section className="vx-onb-card">
        <h2 className="vx-disp vx-onb-card-titulo">Seus dados</h2>
        <p className="vx-mut vx-onb-card-apoio">Campos com * são obrigatórios.</p>

        <form onSubmit={enviar} noValidate>
          {/* Foto de perfil */}
          <div className="vx-onb-campo">
            <label className="vx-label">Foto de perfil *</label>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{
                  width: 80, height: 80, borderRadius: "50%", border: "2px dashed var(--border-strong)",
                  background: "var(--surface-1)", display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", overflow: "hidden", flex: "none", position: "relative",
                }}
                aria-label="Escolher foto de perfil">
                {fotoPrevia
                  ? <img src={fotoPrevia} alt="Prévia" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <Camera size={24} color="var(--muted)" />}
                {enviandoFoto && (
                  <div style={{
                    position: "absolute", inset: 0, background: "rgba(0,0,0,.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 11, fontWeight: 600,
                  }}>Enviando…</div>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }} onChange={aoEscolherFoto} />
              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
                JPG, PNG ou WebP · mínimo 300×300px · até 2 MB
                <br />Foto de rosto, de frente, boa iluminação
              </div>
            </div>
            {fotoErro && <div className="vx-onb-erro" role="alert">{fotoErro}</div>}
            {erros.foto && <div className="vx-onb-erro" role="alert">{erros.foto}</div>}
          </div>

          {/* Nome */}
          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-nome`}>Seu nome *</label>
            <input id={`${id}-nome`} className="vx-input" value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder="Como você quer ser chamado" required
              aria-invalid={erros.nome ? true : undefined} />
            {erros.nome && <div className="vx-onb-erro" role="alert">{erros.nome}</div>}
          </div>

          {/* Bio */}
          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-bio`}>Biografia *</label>
            <textarea id={`${id}-bio`} className="vx-input" rows={3} value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Conte sobre sua experiência, o que você faz de melhor e por que as empresas devem te escolher."
              style={{ resize: "vertical", minHeight: 90 }}
              aria-invalid={erros.bio ? true : undefined} />
            {erros.bio && <div className="vx-onb-erro" role="alert">{erros.bio}</div>}
            <div className="vx-onb-dica">{bio.length}/500 caracteres</div>
          </div>

          {/* WhatsApp */}
          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-whats`}>WhatsApp *</label>
            <input id={`${id}-whats`} className="vx-input" type="tel" inputMode="numeric"
              value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(11) 91234-5678"
              aria-invalid={erros.whatsapp ? true : undefined} />
            {erros.whatsapp && <div className="vx-onb-erro" role="alert">{erros.whatsapp}</div>}
          </div>

          {/* LinkedIn */}
          <div className="vx-onb-campo">
            <label className="vx-label" htmlFor={`${id}-linkedin`}>Perfil no LinkedIn</label>
            <input id={`${id}-linkedin`} className="vx-input" value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://linkedin.com/in/seu-perfil" />
            <div className="vx-onb-dica">Opcional, mas recomendado. As empresas valorizam.</div>
          </div>

          <button type="submit" className="vx-btn vx-btn-primary vx-btn-block vx-onb-btn" disabled={salvando}>
            {salvando ? "Salvando…" : <>Continuar para o quiz <ArrowRight size={16} /></>}
          </button>
        </form>
      </section>
    </div>
  );
}

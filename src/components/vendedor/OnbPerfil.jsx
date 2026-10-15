import { useState, useId } from "react";
import { ArrowRight } from "lucide-react";
import { api } from "../../lib/api.js";

export default function OnbPerfil({ aviso, aoAvancar }) {
  const id = useId();

  const [nome, setNome] = useState("");
  const [bio, setBio] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState({});

  const enviar = async (e) => {
    e.preventDefault();
    const novosErros = {};
    if (!nome.trim()) novosErros.nome = "Informe seu nome.";
    if (!bio.trim()) novosErros.bio = "Conte um pouco sobre você.";
    if (Object.keys(novosErros).length) { setErros(novosErros); return; }

    setSalvando(true);
    const r = await api("/onboarding-pro/perfil", { nome, bio, linkedin });
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

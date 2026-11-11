import { useEffect, useState } from "react";
import { Brain, CheckCircle2, Clock, AlertTriangle, ChevronRight, Mic, MicOff } from "lucide-react";
import { api } from "../../lib/api.js";

function suportaVoz() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function NivelBadge({ nivel }) {
  const cores = {
    inicial: { bg: "#fef3c7", text: "#92400e", label: "Base inicial" },
    utilizavel: { bg: "#dbeafe", text: "#1e40af", label: "Base utilizável" },
    completa: { bg: "#d1fae5", text: "#065f46", label: "Base completa" },
    avancada: { bg: "#ede9fe", text: "#5b21b6", label: "Base avançada" },
  };
  const c = cores[nivel] || cores.inicial;
  return <span style={{ background: c.bg, color: c.text, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{c.label}</span>;
}

function ScoreBar({ score }) {
  const cor = score >= 75 ? "var(--green, #22c55e)" : score >= 50 ? "var(--brand)" : "#f97316";
  return (
    <div style={{ background: "var(--border)", borderRadius: 100, height: 12, overflow: "hidden", marginBottom: 8 }}>
      <div style={{ width: `${score}%`, background: cor, height: "100%", borderRadius: 100, transition: "width 0.8s ease" }} />
    </div>
  );
}

function ResponderLacuna({ lacuna, onSalvar, aviso }) {
  const [texto, setTexto] = useState("");
  const [gravando, setGravando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const recRef = { current: null };

  const toggleVoz = () => {
    if (gravando) { recRef.current?.stop(); setGravando(false); return; }
    if (!suportaVoz()) return aviso("Navegador não suporta voz.");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "pt-BR"; rec.continuous = true; rec.interimResults = true;
    let acc = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) acc += e.results[i][0].transcript + " ";
        else interim = e.results[i][0].transcript;
      }
      setTexto((acc + interim).trim());
    };
    rec.onend = () => setGravando(false);
    rec.start();
    recRef.current = rec;
    setGravando(true);
  };

  const salvar = async () => {
    if (!texto.trim()) return;
    setSalvando(true);
    const r = await api("/brain/lacuna/responder", { lacunaId: lacuna.id, resposta: texto });
    setSalvando(false);
    if (r?.error) return aviso(r.error);
    aviso("Resposta salva! Score atualizado.");
    onSalvar();
  };

  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{lacuna.perguntaSugerida}</p>
      <div style={{ position: "relative" }}>
        <textarea
          className="vx-input"
          style={{ width: "100%", minHeight: 80, fontSize: 13, boxSizing: "border-box" }}
          placeholder={gravando ? "Ouvindo…" : "Responda aqui ou use o microfone"}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        {suportaVoz() && (
          <button onClick={toggleVoz} style={{ position: "absolute", right: 8, top: 8, background: gravando ? "#ef4444" : "var(--brand)", color: "#fff", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            {gravando ? <><MicOff size={12} /> Parar</> : <><Mic size={12} /> Falar</>}
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="vx-btn vx-btn-primary vx-btn-sm" disabled={!texto.trim() || salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar resposta"}</button>
      </div>
    </div>
  );
}

export default function CerebroScore({ onIniciarOnboarding, aviso }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [lacunaAberta, setLacunaAberta] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    const r = await api("/brain/score");
    setDados(r);
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, []);

  if (carregando) {
    return <div style={{ padding: 30, textAlign: "center" }}><Brain size={36} color="var(--brand)" style={{ margin: "0 auto" }} /></div>;
  }

  if (!dados) return null;

  const { score, nivel, dims, lacunas, onboarding, tempoEstimadoMin } = dados;

  return (
    <div className="vx-fade">
      {/* Header Score */}
      <div style={{ background: "linear-gradient(135deg, var(--brand-50, #eff6ff) 0%, var(--brand-100, #dbeafe) 100%)", border: "1.5px solid var(--brand-200, #bfdbfe)", borderRadius: 16, padding: "22px 22px 18px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 40 }}>🧠</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>Cérebro da Operação</span>
              <NivelBadge nivel={nivel} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--brand)", marginBottom: 8 }}>{score}% completo</div>
            <ScoreBar score={score} />
            {tempoEstimadoMin > 0 && (
              <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
                <Clock size={13} /> Faltam aproximadamente {tempoEstimadoMin} minuto(s) para melhorar sua base.
              </div>
            )}
          </div>

          {!onboarding?.ativado && (
            <button className="vx-btn vx-btn-primary" style={{ gap: 7, alignSelf: "center" }} onClick={onIniciarOnboarding}>
              <Brain size={15} /> {onboarding?.temRespostas ? "Continuar de onde parei" : "Ensinar a RYCS"} <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Dimensões */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 12 }}>Categorias</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
          {(dims || []).map((d) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", background: "var(--surface-1, #f8fafc)", borderRadius: 8, border: `1px solid ${d.completo ? "var(--border)" : "var(--orange, #fed7aa)"}` }}>
              <span style={{ fontSize: 16 }}>{d.completo ? "✓" : "○"}</span>
              <span style={{ fontSize: 13, fontWeight: d.completo ? 400 : 600, color: d.completo ? "inherit" : "#92400e" }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lacunas */}
      {lacunas?.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 12 }}>
            Para melhorar seu Cérebro, precisamos saber:
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lacunas.slice(0, 5).map((l) => (
              <div key={l.id} style={{ background: "var(--surface-1, #fefce8)", border: "1px solid var(--orange, #fed7aa)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <AlertTriangle size={15} color="#f97316" />
                  <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{l.label}</span>
                  <span className="vx-chip" style={{ fontSize: 11 }}><Clock size={10} /> ~{l.tempoMin} min</span>
                  <button className="vx-btn vx-btn-sm" style={{ fontSize: 12 }} onClick={() => setLacunaAberta(lacunaAberta?.id === l.id ? null : l)}>
                    {lacunaAberta?.id === l.id ? "Fechar" : "Responder"}
                  </button>
                </div>
                {lacunaAberta?.id === l.id && (
                  <ResponderLacuna lacuna={l} aviso={aviso} onSalvar={() => { setLacunaAberta(null); carregar(); }} />
                )}
              </div>
            ))}
          </div>
          {lacunas.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>+{score >= 90 ? 0 : lacunas.length} dimensões para completar</span>
              <button className="vx-btn vx-btn-primary" style={{ gap: 7, fontSize: 13 }} onClick={onIniciarOnboarding}>
                <Brain size={14} /> Completar em {tempoEstimadoMin} minuto(s)
              </button>
            </div>
          )}
        </div>
      )}

      {score >= 90 && (
        <div style={{ background: "var(--surface-1, #f0fdf4)", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
          <CheckCircle2 size={18} color="#22c55e" />
          <span style={{ fontSize: 14 }}>Sua base está excelente! Treinamentos e campanhas com IA têm ótima qualidade.</span>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Check } from "lucide-react";
import { api } from "../../lib/api.js";
import OnbPerfil from "./OnbPerfil.jsx";
import OnbQuizDisc from "./OnbQuizDisc.jsx";
import OnbOportunidades from "./OnbOportunidades.jsx";

const ETAPAS = [
  { chave: "perfil", n: 1, label: "Perfil" },
  { chave: "quiz", n: 2, label: "Quiz" },
  { chave: "oportunidades", n: 3, label: "Oportunidades" },
];

function estadoEtapa(etapaAtual, chave) {
  const iAtual = ETAPAS.findIndex((e) => e.chave === etapaAtual);
  const i = ETAPAS.findIndex((e) => e.chave === chave);
  if (etapaAtual === "concluido") return "concluida";
  if (i < iAtual) return "concluida";
  if (i === iAtual) return "atual";
  return "pendente";
}

function BarraProgresso({ etapaAtual }) {
  return (
    <div className="vx-onb-topo">
      <div className="vx-onb-topo-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img className="vx-logo" src="/logo-rycs.png" alt="RYCS" style={{ height: 24 }} />
        </div>
        <nav>
          <ol style={{
            display: "flex", alignItems: "center", gap: 0, listStyle: "none",
            margin: 0, padding: 0,
          }}>
            {ETAPAS.map((e, i) => {
              const st = estadoEtapa(etapaAtual, e.chave);
              const concluida = st === "concluida";
              const atual = st === "atual";
              return (
                <li key={e.chave} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && (
                    <div style={{
                      width: 40, height: 2, margin: "0 4px",
                      background: concluida || atual ? "var(--brand)" : "var(--surface-3, #e2e8f0)",
                      transition: "background .4s",
                    }} />
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, transition: "all .3s",
                      background: concluida ? "var(--brand)" : atual ? "var(--brand)" : "var(--surface-3, #e2e8f0)",
                      color: concluida || atual ? "#fff" : "var(--muted)",
                      boxShadow: atual ? "0 0 0 4px var(--brand-50, rgba(59,130,246,.2))" : "none",
                    }}>
                      {concluida ? <Check size={16} strokeWidth={3} /> : e.n}
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: atual ? 700 : 500,
                      color: concluida || atual ? "var(--ink)" : "var(--muted)",
                      transition: "color .3s",
                    }}>{e.label}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
}

export default function OnboardingProfissional({ aviso, recarregar, aoConcluir }) {
  const [etapa, setEtapa] = useState(null);
  const [disc, setDisc] = useState(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    const r = await api("/onboarding-pro");
    if (r && !r.error) {
      setEtapa(r.etapa);
      if (r.disc?.predominante) setDisc(r.disc);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const avancar = (novaEtapa, dados) => {
    setEtapa(novaEtapa);
    if (dados?.disc) setDisc(dados.disc);
    window.scrollTo?.(0, 0);
  };

  if (loading) {
    return (
      <div className="vx-onb">
        <BarraProgresso etapaAtual="perfil" />
        <div className="vx-onb-corpo">
          <div className="vx-onb-estado">Carregando…</div>
        </div>
      </div>
    );
  }

  if (etapa === "concluido") {
    return (
      <div className="vx-onb">
        <BarraProgresso etapaAtual="concluido" />
        <div className="vx-onb-corpo">
          <OnbOportunidades aviso={aviso} disc={disc} aoConcluir={aoConcluir} />
        </div>
      </div>
    );
  }

  return (
    <div className="vx-onb">
      <BarraProgresso etapaAtual={etapa} />
      <div className="vx-onb-corpo">
        {etapa === "perfil" && <OnbPerfil aviso={aviso} aoAvancar={(e) => avancar(e)} />}
        {etapa === "quiz" && <OnbQuizDisc aviso={aviso} aoAvancar={(e, d) => avancar(e, d)} />}
      </div>
    </div>
  );
}

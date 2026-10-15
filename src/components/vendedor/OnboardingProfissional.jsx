import { useState, useEffect, useCallback } from "react";
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
  const total = ETAPAS.length;
  const iAtual = etapaAtual === "concluido" ? total : ETAPAS.findIndex((e) => e.chave === etapaAtual);
  const pct = Math.round(((iAtual) / total) * 100);

  return (
    <div className="vx-onb-topo">
      <div className="vx-onb-topo-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img className="vx-logo" src="/logo-rycs.png" alt="RYCS" style={{ height: 24 }} />
        </div>
        <nav>
          <ol className="vx-onb-passos">
            {ETAPAS.map((e) => {
              const st = estadoEtapa(etapaAtual, e.chave);
              return (
                <li key={e.chave} data-estado={st}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span className="vx-onb-passo-n">
                      {st === "concluida" ? "✓" : e.n}
                    </span>
                    <span className="vx-onb-passo-txt">{e.label}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
      <div style={{ height: 3, background: "var(--surface-3)" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: "var(--brand)",
          borderRadius: "0 2px 2px 0", transition: "width .4s ease",
        }} />
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

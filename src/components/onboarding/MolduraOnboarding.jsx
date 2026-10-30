import BarraProgresso from "./BarraProgresso.jsx";

// Moldura comum das etapas: logo + botão "Sair" no topo claro, e a nova
// BarraProgresso animada (Trilha Neon) em fundo navy logo abaixo.
// `subfase` (0–3 | null) é repassado à barra quando ativa === "ia".

export default function MolduraOnboarding({ etapas, ativa, subfase = null, aoAbrir, aoSair, children }) {
  return (
    <div className="vx-onb">
      <header className="vx-onb-topo">
        <div className="vx-onb-topo-inner">
          <img className="vx-logo" src="/logo-rycs.png" alt="RYCS" style={{ width: 72 }} />
          {aoSair && <button type="button" className="vx-btn vx-btn-sm vx-btn-ghost" style={{ minHeight: 44 }} onClick={aoSair}>Sair</button>}
        </div>
        <BarraProgresso etapas={etapas} ativa={ativa} subfase={subfase} aoAbrir={aoAbrir} />
      </header>
      <main className="vx-onb-corpo vx-fade">{children}</main>
    </div>
  );
}

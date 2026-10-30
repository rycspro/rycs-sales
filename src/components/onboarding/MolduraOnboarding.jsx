import BarraProgresso from "./BarraProgresso.jsx";

// Moldura comum das etapas: logo + botão "Sair" no topo claro, e a nova
// BarraProgresso animada (Trilha Neon) em fundo navy logo abaixo.
// `subfase` (0–3 | null) é repassado à barra quando ativa === "ia".
// `semCabecalho` esconde logo, botão Sair e barra de progresso — usado na
// EtapaAcesso (passo 1), que tem seu próprio layout de quiz.

export default function MolduraOnboarding({ etapas, ativa, subfase = null, aoAbrir, aoSair, semCabecalho = false, children }) {
  return (
    <div className="vx-onb">
      {!semCabecalho && (
        <header className="vx-onb-topo">
          <div className="vx-onb-topo-inner">
            <img className="vx-logo" src="/logo-rycs.png" alt="RYCS" style={{ width: 72 }} />
            {aoSair && <button type="button" className="vx-btn vx-btn-sm vx-btn-ghost" style={{ minHeight: 44 }} onClick={aoSair}>Sair</button>}
          </div>
          <BarraProgresso etapas={etapas} ativa={ativa} subfase={subfase} aoAbrir={aoAbrir} />
        </header>
      )}
      <main className="vx-onb-corpo vx-fade" style={semCabecalho ? { padding: 0, maxWidth: "100%" } : undefined}>{children}</main>
    </div>
  );
}

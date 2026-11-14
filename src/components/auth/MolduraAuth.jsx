// Moldura comum das telas de entrada.
//
// Os ambientes são independentes no conteúdo, não na identidade: logo, largura
// e respiro são os mesmos em todos. O que muda é a tarja de contexto, para a
// pessoa saber em qual porta entrou antes de preencher qualquer campo.

export default function MolduraAuth({ tarja, titulo, subtitulo, largura = 460, children, rodape, logoWidth = 200, compact = false, semLogo = false }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px 24px", overflowY: "auto" }}>
      <div className="vx-fade" style={{ width: "100%", maxWidth: largura }}>
        <div style={{ textAlign: "center", marginBottom: compact ? 10 : 16 }}>
          {!semLogo && <>
            <img className="vx-logo" src="/logo-rycs.png" alt="RYCS Sales Machine"
              onError={(e) => { e.currentTarget.style.display = "none"; const t = e.currentTarget.nextSibling; if (t) t.style.display = "block"; }}
              style={{ width: compact ? logoWidth : Math.min(logoWidth, 120), margin: `0 auto ${compact ? 6 : 10}px` }} />
            <span className="vx-disp" style={{ display: "none", fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "var(--brand)", margin: `0 auto ${compact ? 6 : 10}px` }}>RYCS</span>
          </>}
          {tarja && <div className="vx-eyebrow" style={{ marginBottom: 6 }}>{tarja}</div>}
          {titulo && <div className="vx-disp" style={{ fontSize: 22 }}>{titulo}</div>}
          {subtitulo && <p className="vx-mut" style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>{subtitulo}</p>}
        </div>
        <div className="vx-card" style={{ padding: compact ? 16 : 20 }}>{children}</div>
        {rodape && <div style={{ textAlign: "center", marginTop: 12 }}>{rodape}</div>}
      </div>
    </div>
  );
}

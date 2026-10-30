// Moldura comum das telas de entrada.
//
// Os ambientes são independentes no conteúdo, não na identidade: logo, largura
// e respiro são os mesmos em todos. O que muda é a tarja de contexto, para a
// pessoa saber em qual porta entrou antes de preencher qualquer campo.

export default function MolduraAuth({ tarja, titulo, subtitulo, largura = 460, children, rodape, logoWidth = 200, compact = false }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: compact ? "12px 16px" : 16 }}>
      <div className="vx-fade" style={{ width: "100%", maxWidth: largura }}>
        <div style={{ textAlign: "center", marginBottom: compact ? 14 : 24 }}>
          <img className="vx-logo" src="/logo-rycs.png" alt="RYCS Sales Machine" style={{ width: logoWidth, margin: `0 auto ${compact ? 8 : 14}px` }} />
          {tarja && <div className="vx-eyebrow" style={{ marginBottom: 6 }}>{tarja}</div>}
          {titulo && <div className="vx-disp" style={{ fontSize: 22 }}>{titulo}</div>}
          {subtitulo && <p className="vx-mut" style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.6 }}>{subtitulo}</p>}
        </div>
        <div className="vx-card" style={{ padding: 22 }}>{children}</div>
        {rodape && <div style={{ textAlign: "center", marginTop: 14 }}>{rodape}</div>}
      </div>
    </div>
  );
}

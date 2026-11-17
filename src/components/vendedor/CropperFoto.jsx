import { useEffect, useRef, useState, useCallback } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, RotateCcw, Loader } from "lucide-react";

const AZUL = "#318CE7";
const V = 300;   // lado do visor (px na tela)
const OUT = 600; // resolução de saída do recorte (>= larguraIdeal para nota cheia)
const Z_MIN = 1, Z_MAX = 4;

// Editor de enquadramento da foto de perfil (estilo Instagram): arrasta para
// posicionar, slider de zoom, rotação, e prévia circular em tempo real. Salva o
// recorte SEM escolher outra imagem; a origem é preservada pelo backend.
export default function CropperFoto({ src, inicial, onFechar, onSalvar, enviando }) {
  const imgRef = useRef(null);
  const visorRef = useRef(null);
  const [nat, setNat] = useState(null);           // dimensões naturais da imagem
  const [zoom, setZoom] = useState(inicial?.zoom || 1);
  const [rot, setRot] = useState(inicial?.rotacao || 0);
  const [off, setOff] = useState({ x: (inicial?.oxNorm || 0) * V, y: (inicial?.oyNorm || 0) * V });
  const arrasto = useRef(null);

  // Escala que faz a imagem "cobrir" o visor (como object-fit: cover).
  const coverBase = nat ? Math.max(V / nat.w, V / nat.h) : 1;

  const onImgLoad = (e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight });

  // ── Arrastar (pointer) ────────────────────────────────────────────────────
  const inicioArrasto = (e) => {
    e.preventDefault();
    arrasto.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const mover = (e) => {
    if (!arrasto.current) return;
    setOff({ x: arrasto.current.ox + (e.clientX - arrasto.current.px), y: arrasto.current.oy + (e.clientY - arrasto.current.py) });
  };
  const fimArrasto = () => { arrasto.current = null; };

  // Zoom pela roda do mouse sobre o visor.
  const roda = (e) => {
    e.preventDefault();
    setZoom((z) => Math.min(Z_MAX, Math.max(Z_MIN, +(z - e.deltaY * 0.0015).toFixed(3))));
  };

  // ── Exportar o recorte para um canvas quadrado ────────────────────────────
  const gerar = useCallback(() => {
    const img = imgRef.current;
    if (!img || !nat) return null;
    const k = OUT / V;
    const cv = document.createElement("canvas");
    cv.width = OUT; cv.height = OUT;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.save();
    ctx.translate(OUT / 2 + off.x * k, OUT / 2 + off.y * k);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    const w = nat.w * coverBase * k, h = nat.h * coverBase * k;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    return cv.toDataURL("image/jpeg", 0.92);
  }, [nat, off, rot, zoom, coverBase]);

  const salvar = () => {
    const dataUrl = gerar();
    if (!dataUrl) return;
    onSalvar({
      base64: dataUrl.split(",")[1],
      mimetype: "image/jpeg",
      largura: OUT, altura: OUT,
      enquadramento: { zoom: +zoom.toFixed(3), rotacao: rot, oxNorm: +(off.x / V).toFixed(4), oyNorm: +(off.y / V).toFixed(4) },
    });
  };

  // Fecha com Esc.
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onFechar]);

  const btn = { width: 36, height: 36, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink)" };

  return (
    <div className="vx-overlay" onClick={onFechar} role="dialog" aria-modal="true" aria-label="Editar foto" style={{ zIndex: 1200 }}>
      <div className="vx-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380, width: "92vw" }}>
        <div className="vx-row" style={{ marginBottom: 14 }}>
          <div>
            <div className="vx-eyebrow">Enquadramento</div>
            <h2 className="vx-disp" style={{ margin: "3px 0", fontSize: 19 }}>Editar foto</h2>
          </div>
          <button className="vx-btn vx-btn-ghost" onClick={onFechar} aria-label="Fechar"><X size={16} /></button>
        </div>

        {/* Visor circular com prévia em tempo real */}
        <div
          ref={visorRef}
          onPointerDown={inicioArrasto}
          onPointerMove={mover}
          onPointerUp={fimArrasto}
          onPointerCancel={fimArrasto}
          onWheel={roda}
          style={{
            width: V, height: V, maxWidth: "100%", margin: "0 auto 4px", position: "relative",
            borderRadius: "50%", overflow: "hidden", background: "#fff", cursor: arrasto.current ? "grabbing" : "grab",
            touchAction: "none", boxShadow: `0 0 0 3px ${AZUL}22, 0 0 0 1px ${AZUL}`,
          }}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={onImgLoad}
            style={{
              position: "absolute", left: "50%", top: "50%",
              width: nat ? nat.w * coverBase : "100%", height: nat ? nat.h * coverBase : "100%",
              marginLeft: nat ? -(nat.w * coverBase) / 2 : "-50%", marginTop: nat ? -(nat.h * coverBase) / 2 : "-50%",
              transform: `translate(${off.x}px, ${off.y}px) rotate(${rot}deg) scale(${zoom})`,
              transformOrigin: "center", userSelect: "none", pointerEvents: "none",
            }}
          />
          {/* Grade de terços, sutil */}
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage:
            "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
            backgroundSize: `${V / 3}px ${V / 3}px`, opacity: arrasto.current ? 1 : 0, transition: "opacity .15s" }} />
        </div>
        <p className="vx-mut" style={{ fontSize: 11.5, textAlign: "center", margin: "0 0 14px" }}>Arraste para posicionar · use o zoom e a rotação</p>

        {/* Zoom */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <button type="button" style={btn} aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(Z_MIN, +(z - 0.2).toFixed(2)))}><ZoomOut size={16} /></button>
          <input type="range" min={Z_MIN} max={Z_MAX} step={0.01} value={zoom} onChange={(e) => setZoom(+e.target.value)}
            aria-label="Zoom" style={{ flex: 1, accentColor: AZUL }} />
          <button type="button" style={btn} aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(Z_MAX, +(z + 0.2).toFixed(2)))}><ZoomIn size={16} /></button>
        </div>

        {/* Rotação */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <button type="button" style={btn} aria-label="Girar à esquerda" onClick={() => setRot((r) => r - 90)}><RotateCcw size={16} /></button>
          <input type="range" min={-180} max={180} step={1} value={rot} onChange={(e) => setRot(+e.target.value)}
            aria-label="Rotação" style={{ flex: 1, accentColor: AZUL }} />
          <button type="button" style={btn} aria-label="Girar à direita" onClick={() => setRot((r) => r + 90)}><RotateCw size={16} /></button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="vx-btn" style={{ flex: "0 0 auto" }} onClick={() => { setZoom(1); setRot(0); setOff({ x: 0, y: 0 }); }}>Redefinir</button>
          <button className="vx-btn vx-btn-primary" style={{ flex: 1, justifyContent: "center", background: AZUL, borderColor: AZUL }} disabled={enviando || !nat} onClick={salvar}>
            {enviando ? <><Loader size={15} /> Salvando…</> : "Salvar enquadramento"}
          </button>
        </div>
      </div>
    </div>
  );
}

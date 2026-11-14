import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  HoloCard — cartão titânio perolado com holograma de filme fino.    */
/*  Inclina com o cursor (ou o giroscópio), gira ao arrastar, vira no  */
/*  toque e embaralha o número ao revelar. Porte JSX (sem Tailwind/TS) */
/*  do componente original, com estilos inline + CSS do holograma.     */
/* ------------------------------------------------------------------ */

const INK = "#1d1d1f";
const FONT = "Geist, -apple-system, BlinkMacSystemFont, Inter, 'Segoe UI', Roboto, sans-serif";
const MONO = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9 .02' numOctaves='2' seed='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const CSS = `
.hc-face{position:absolute;inset:0;border-radius:18px;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;color:${INK};
  background:linear-gradient(135deg,#fdfdfe 0%,#ececf1 38%,#f8f8fa 62%,#e2e2e8 100%);
  box-shadow:inset 0 0 0 .5px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.9)}
.hc-layer{position:absolute;pointer-events:none}
.hc-grain{inset:0;opacity:.35;mix-blend-mode:soft-light;background-image:${GRAIN};background-size:200px 200px}
.hc-film{inset:-30%;mix-blend-mode:multiply;opacity:calc(var(--ho,.6) * var(--foil,1));
  background:linear-gradient(115deg,#ffd9ec 0%,#ffe6cf 12%,#fff6c9 22%,#d4f7e4 34%,#c9ecff 46%,#d9d4ff 58%,#f6d0ff 70%,#ffd9ec 82%,#ffe6cf 100%);
  background-size:300% 300%;background-position:var(--hx,50%) var(--hy,50%);
  -webkit-mask-image:radial-gradient(85% 110% at var(--mx,50%) var(--my,50%),#000 0%,rgba(0,0,0,.55) 50%,rgba(0,0,0,.15) 85%);
  mask-image:radial-gradient(85% 110% at var(--mx,50%) var(--my,50%),#000 0%,rgba(0,0,0,.55) 50%,rgba(0,0,0,.15) 85%)}
.hc-film2{inset:-30%;mix-blend-mode:color;opacity:calc(var(--ho,.6) * .55 * var(--foil,1));
  background:conic-gradient(from var(--ca,0deg) at var(--mx,50%) var(--my,50%),#ff9ad5,#ffc58f,#fff08f,#9ff0c6,#8fd6ff,#b8a6ff,#ff9ad5);
  -webkit-mask-image:radial-gradient(60% 80% at var(--mx,50%) var(--my,50%),#000,transparent 75%);
  mask-image:radial-gradient(60% 80% at var(--mx,50%) var(--my,50%),#000,transparent 75%)}
.hc-lines{inset:0;mix-blend-mode:soft-light;opacity:calc(var(--ho,.6) * .5 * var(--foil,1));
  background:repeating-linear-gradient(115deg,rgba(255,255,255,.9) 0 1px,transparent 1px 3px)}
.hc-streak{inset:-40%;mix-blend-mode:soft-light;opacity:.9;transform:translateX(var(--st,0%));
  background:linear-gradient(115deg,transparent 42%,rgba(255,255,255,.95) 49%,rgba(255,255,255,.95) 51%,transparent 58%)}
.hc-glare{inset:0;mix-blend-mode:screen;background:radial-gradient(45% 65% at var(--mx,50%) var(--my,50%),rgba(255,255,255,.55),rgba(255,255,255,0) 65%)}
.hc-edge{inset:0;border-radius:18px;padding:1px;
  background:linear-gradient(var(--ea,135deg),#fff,rgba(0,0,0,.06) 30%,rgba(0,0,0,.04) 70%,rgba(255,255,255,.8));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
.hc-chip{width:44px;height:34px;border-radius:7px;position:relative;overflow:hidden;
  background:linear-gradient(135deg,#e9d6a2,#b89850 45%,#f4e3b0 60%,#9c7c3a);box-shadow:inset 0 0 0 .5px rgba(0,0,0,.35)}
.hc-chip:before,.hc-chip:after{content:"";position:absolute;border:1px solid rgba(80,60,20,.45)}
.hc-chip:before{left:30%;right:30%;top:-1px;bottom:-1px;border-top:0;border-bottom:0}
.hc-chip:after{top:35%;bottom:35%;left:-1px;right:-1px;border-left:0;border-right:0}
.hc-label{display:block;font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:rgba(29,29,31,.45);margin-bottom:4px}
`;

const Layers = () => (
  <>
    <div className="hc-layer hc-grain" />
    <div className="hc-layer hc-film" />
    <div className="hc-layer hc-film2" />
    <div className="hc-layer hc-lines" />
    <div className="hc-layer hc-streak" />
    <div className="hc-layer hc-glare" />
  </>
);

/* embaralha dígitos aleatórios até o alvo, da esquerda para a direita */
function useScramble() {
  return useCallback((el, to, ms = 520) => {
    if (!el) return;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      let out = "";
      for (let i = 0; i < to.length; i++) out += k > (i + 1) / to.length ? to[i] : String((Math.random() * 10) | 0);
      el.textContent = k < 1 ? out : to;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);
}

export const HoloCard = forwardRef(function HoloCard(
  {
    holder = "Alex Morgan",
    number = "4716 0381 9254 4242",
    expires = "09/29",
    cvv = "731",
    tier = "Titanium",
    logo,
    network,
    maxTilt = 14,
    foil = 1,
    motion = true,
    onFlip,
    onReveal,
    className = "",
  },
  ref,
) {
  const groups = (number.replace(/\D/g, "").padStart(16, "0").match(/.{4}/g) ?? []).slice(0, 4);
  const stageRef = useRef(null);
  const cardRef = useRef(null);
  const shadowRef = useRef(null);
  const groupRefs = useRef([]);
  const cvvRef = useRef(null);
  const scramble = useScramble();
  const [shown, setShown] = useState(false);
  const [cvvShown, setCvvShown] = useState(false);
  const [side, setSide] = useState("front");

  const s = useRef({ tx: 0, ty: 0, ttx: 0, tty: 0, ry: 0, vry: 0, target: 0, drag: false, lastX: 0, lastT: 0, moved: 0, lx: 0.5, ly: 0.35, tlx: 0.5, tly: 0.35, raf: 0 });
  const reduce = useRef(false);

  const buzz = (p) => { try { navigator.vibrate?.(p); } catch { /* sem suporte */ } };

  /* loop de animação: suaviza inclinação e luz, gira com inércia, assenta numa face */
  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const st = s.current;
    const loop = () => {
      st.tx += (st.ttx - st.tx) * 0.12;
      st.ty += (st.tty - st.ty) * 0.12;
      st.lx += (st.tlx - st.lx) * 0.12;
      st.ly += (st.tly - st.ly) * 0.12;
      if (!st.drag) {
        st.vry *= 0.95;
        st.ry += st.vry;
        if (Math.abs(st.vry) < 1.2) st.ry += (st.target - st.ry) * (reduce.current ? 1 : 0.09);
        else st.target = Math.round(st.ry / 180) * 180;
      }
      const ry = st.ry + st.ty;
      const spin = ((ry % 360) + 360) % 360;
      const sweep = Math.sin((spin * Math.PI) / 180);
      const card = cardRef.current;
      if (card) {
        card.style.transform = `rotateX(${st.tx}deg) rotateY(${ry}deg)`;
        const mx = st.lx * 100 + sweep * 40;
        const my = st.ly * 100;
        card.style.setProperty("--mx", `${mx}%`);
        card.style.setProperty("--my", `${my}%`);
        card.style.setProperty("--hx", `${mx * 1.6}%`);
        card.style.setProperty("--hy", `${my * 1.2}%`);
        card.style.setProperty("--ho", (0.45 + Math.min(0.5, (Math.abs(st.tx) + Math.abs(st.ty)) / 26 + Math.abs(sweep) * 0.4)).toFixed(3));
        card.style.setProperty("--ca", `${st.ty * 6 + spin}deg`);
        card.style.setProperty("--st", `${st.ty * 4 + sweep * 60}%`);
        card.style.setProperty("--ea", `${135 + st.ty * 3}deg`);
      }
      const sh = shadowRef.current;
      if (sh) sh.style.transform = `translateX(${-st.ty * 1.4}px) scaleX(${(1 - Math.abs(sweep) * 0.45).toFixed(3)})`;
      const face = Math.round(st.target / 180) % 2 === 0 ? "front" : "back";
      setSide((prev) => (prev === face ? prev : face));
      st.raf = requestAnimationFrame(loop);
    };
    st.raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(st.raf);
  }, []);

  useEffect(() => onFlip?.(side), [side, onFlip]);

  const flip = useCallback(() => {
    const st = s.current;
    st.target = Math.round(st.ry / 180) * 180 + 180;
    st.vry = 0;
    buzz(10);
  }, []);

  const shownRef = useRef(false);
  const reveal = useCallback(
    (show) => {
      const next = show ?? !shownRef.current;
      shownRef.current = next;
      setShown(next);
      groupRefs.current.forEach((el, i) => {
        if (!el || i === 3) return;
        setTimeout(() => (next ? scramble(el, groups[i]) : (el.textContent = "••••")), i * 90);
      });
      onReveal?.(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scramble, number, onReveal],
  );

  /* inclinação pelo giroscópio */
  const gyroOn = useRef(false);
  const listenGyro = useCallback(() => {
    if (gyroOn.current) return;
    gyroOn.current = true;
    window.addEventListener("deviceorientation", (e) => {
      if (e.beta == null || e.gamma == null) return;
      const st = s.current;
      const m = reduce.current ? 0 : maxTilt;
      st.ttx = Math.max(-m, Math.min(m, -(e.beta - 45) * 0.5));
      st.tty = Math.max(-m, Math.min(m, e.gamma * 0.6));
      st.tlx = 0.5 + e.gamma / 90;
      st.tly = 0.5 + (e.beta - 45) / 90;
    });
  }, [maxTilt]);

  const enableMotion = useCallback(async () => {
    const DOE = typeof DeviceOrientationEvent !== "undefined" ? DeviceOrientationEvent : undefined;
    try {
      if (DOE?.requestPermission) {
        const r = await DOE.requestPermission();
        if (r !== "granted") return false;
      }
      listenGyro();
      return true;
    } catch {
      return false;
    }
  }, [listenGyro]);

  useEffect(() => {
    if (!motion || !window.matchMedia("(hover: none)").matches) return;
    const DOE = typeof DeviceOrientationEvent !== "undefined" ? DeviceOrientationEvent : undefined;
    if (DOE && typeof DOE.requestPermission !== "function") listenGyro();
  }, [motion, listenGyro]);

  useImperativeHandle(ref, () => ({ flip, reveal, enableMotion }), [flip, reveal, enableMotion]);

  /* ponteiro: inclina no hover, arrasta para girar, toca para virar */
  const onMove = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const st = s.current;
    const m = reduce.current ? 0 : maxTilt;
    st.tlx = px;
    st.tly = py;
    if (!st.drag) {
      if (e.pointerType === "mouse") {
        st.tty = (px - 0.5) * 2 * m;
        st.ttx = -(py - 0.5) * 2 * m;
      }
    } else {
      const now = performance.now();
      const dx = e.clientX - st.lastX;
      st.ry += dx * 0.6;
      st.vry = (dx * 0.6) / Math.max(1, (now - st.lastT) / 16);
      st.lastX = e.clientX;
      st.lastT = now;
      st.moved += Math.abs(dx);
    }
  };
  const onDown = (e) => {
    if (e.target.closest("[data-hc-tap]")) return;
    const st = s.current;
    st.drag = true;
    st.moved = 0;
    st.lastX = e.clientX;
    st.lastT = performance.now();
    st.vry = 0;
    stageRef.current?.setPointerCapture(e.pointerId);
    buzz(6);
  };
  const onUp = () => {
    const st = s.current;
    if (!st.drag) return;
    st.drag = false;
    st.target = Math.round((st.ry + st.vry * 8) / 180) * 180;
    if (st.moved < 4) flip();
  };

  const defaultLogo = (
    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 600, letterSpacing: "-0.04em" }}>
      <span style={{ display: "grid", placeItems: "center", height: 22, width: 22, borderRadius: 7, background: INK }}>
        <span style={{ height: 8, width: 8, transform: "rotate(45deg)", borderRadius: 2, background: "#fff" }} />
      </span>
      RYCS
    </span>
  );
  const defaultNetwork = (
    <span style={{ display: "flex" }} aria-hidden="true">
      <span style={{ height: 30, width: 30, borderRadius: "50%", background: "rgba(29,29,31,.85)" }} />
      <span style={{ height: 30, width: 30, borderRadius: "50%", marginLeft: -12, background: "rgba(29,29,31,.35)" }} />
    </span>
  );

  const labelStyle = { fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(29,29,31,.5)" };

  return (
    <div className={className} style={{ position: "relative", width: "100%", maxWidth: 380, fontFamily: FONT, WebkitFontSmoothing: "antialiased", margin: "0 auto" }}>
      <style>{CSS}</style>
      <div
        ref={stageRef}
        style={{ position: "relative", width: "100%", userSelect: "none", aspectRatio: "1.586", perspective: 1100, touchAction: "none" }}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => {
          const st = s.current;
          if (st.drag) return;
          st.ttx = 0;
          st.tty = 0;
          st.tlx = 0.5;
          st.tly = 0.35;
        }}
      >
        <div ref={shadowRef} style={{ pointerEvents: "none", position: "absolute", bottom: -16, left: "10%", right: "10%", height: 36, borderRadius: "50%", filter: "blur(22px)", background: "rgba(40,40,60,.28)" }} />
        <div
          ref={cardRef}
          role="group"
          aria-roledescription="card"
          aria-label={`Cartão ${tier} terminando em ${groups[3]}, lado ${side === "front" ? "frente" : "verso"}. Arraste para girar, toque para virar.`}
          style={{ position: "absolute", inset: 0, cursor: "grab", transformStyle: "preserve-3d", willChange: "transform", "--foil": String(foil) }}
        >
          {/* frente */}
          <div className="hc-face" aria-hidden={side !== "front"}>
            <Layers />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "22px 24px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {logo ?? defaultLogo}
                <span style={labelStyle}>{tier}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="hc-chip" />
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(29,29,31,.6)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M8.5 7.5a6 6 0 0 1 0 9M12 5a9.5 9.5 0 0 1 0 14M15.5 2.5a13 13 0 0 1 0 19" />
                </svg>
              </div>
              <button
                type="button" data-hc-tap onClick={() => reveal()}
                aria-label={shown ? "Ocultar número do cartão" : "Mostrar número do cartão"}
                style={{ display: "flex", width: "fit-content", gap: 14, fontSize: 20, fontWeight: 500, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: ".06em", fontFamily: MONO, color: INK, textShadow: "0 1px 0 rgba(255,255,255,.8)", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
              >
                {groups.map((g, i) => (
                  <span key={i} ref={(el) => void (groupRefs.current[i] = el)} style={{ display: "inline-block", minWidth: "3.4ch" }}>
                    {i === 3 ? g : "••••"}
                  </span>
                ))}
              </button>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <div style={{ minWidth: 0 }}>
                  <span className="hc-label">Titular</span>
                  <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.01em" }}>{holder}</b>
                </div>
                <div>
                  <span className="hc-label">Validade</span>
                  <b style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{expires}</b>
                </div>
                {network ?? defaultNetwork}
              </div>
            </div>
            <div className="hc-layer hc-edge" />
          </div>

          {/* verso */}
          <div className="hc-face" style={{ transform: "rotateY(180deg)" }} aria-hidden={side !== "back"}>
            <Layers />
            <div style={{ position: "absolute", left: 0, right: 0, top: 24, height: 42, background: "linear-gradient(180deg,#2a2a2e,#111)" }} />
            <button
              type="button" data-hc-tap
              onClick={() => {
                const next = !cvvShown;
                setCvvShown(next);
                if (next) scramble(cvvRef.current, cvv, 380);
                else if (cvvRef.current) cvvRef.current.textContent = "•••";
              }}
              aria-label={cvvShown ? "Ocultar código de segurança" : "Mostrar código de segurança"}
              style={{ position: "absolute", left: 24, right: 24, top: 86, display: "flex", height: 38, alignItems: "center", justifyContent: "flex-end", gap: 10, borderRadius: 8, padding: "0 12px", background: "rgba(255,255,255,.75)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.08)", border: "none", cursor: "pointer" }}
            >
              <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(29,29,31,.45)" }}>CVV</span>
              <span ref={cvvRef} style={{ fontSize: 15, fontWeight: 500, letterSpacing: ".12em", fontFamily: MONO, color: INK }}>•••</span>
            </button>
            <div style={{ position: "absolute", bottom: 18, left: 24, right: 24, fontSize: 10, lineHeight: "14px", color: "rgba(29,29,31,.45)" }}>
              Incline para ver o holograma, arraste para girar, toque no código para revelar.
            </div>
            <div className="hc-layer hc-edge" />
          </div>
        </div>
      </div>
    </div>
  );
});

export default HoloCard;

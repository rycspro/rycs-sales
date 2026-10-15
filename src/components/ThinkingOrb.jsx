import { useEffect, useRef } from "react";

// Orb do Jarvas. Uso: <ThinkingOrb state="speaking" size={200} nivel={ref} />
//
// Uma esfera de vidro com luzes desfocadas girando por dentro, em camadas
// com velocidades diferentes, e um halo por fora. `nivel` é um ref com o
// volume do momento (0 a 1): a voz do Jarvas ou o microfone. O orb lê esse
// valor a cada quadro e pulsa no ritmo do som, sem re-renderizar o React.
//
// Estados:
// - idle:       luz girando devagar, respirando
// - connecting: mais rápido, halo pulsando
// - thinking:   giro acelerado e brilho passando
// - speaking:   reage ao volume da voz do Jarvas
// - listening:  tom mais frio e reage ao volume do microfone
//
// Cores do design system (src/styles.js). Com prefers-reduced-motion, fica
// parado e só muda de tom.

const ESTADOS = ["idle", "connecting", "thinking", "speaking", "listening"];
const VELOCIDADE = { idle: 1, connecting: 0.45, thinking: 0.3, speaking: 0.6, listening: 0.55 };

const CSS = `
.orb{position:relative;flex:none;display:inline-block;--nivel:0;--vel:1}
.orb-halo{position:absolute;inset:-16%;border-radius:50%;
  background:radial-gradient(circle,var(--brand) 0%,var(--indigo,var(--brand)) 38%,transparent 70%);
  filter:blur(calc(var(--d) * .08));opacity:calc(.28 + var(--nivel) * .55);
  transform:scale(calc(.92 + var(--nivel) * .3));transition:opacity .25s}
.orb-esfera{position:absolute;inset:0;border-radius:50%;overflow:hidden;isolation:isolate;
  background:var(--grad-ai,linear-gradient(135deg,var(--indigo),var(--brand)));
  transform:scale(calc(1 + var(--nivel) * .09));
  box-shadow:0 calc(var(--d) * .08) calc(var(--d) * .28) calc(var(--d) * -.08) var(--brand),inset 0 0 calc(var(--d) * .1) rgba(255,255,255,.25)}
.orb-luz{position:absolute;width:85%;height:85%;border-radius:50%;filter:blur(calc(var(--d) * .07))}
.orb-l1{left:-18%;top:-12%;background:radial-gradient(circle,var(--navy) 0%,transparent 65%);opacity:.55;animation:orb-a calc(var(--vel) * 7s) ease-in-out infinite}
.orb-l2{right:-22%;top:6%;background:radial-gradient(circle,var(--indigo,var(--brand)) 0%,transparent 62%);mix-blend-mode:screen;animation:orb-b calc(var(--vel) * 9s) ease-in-out infinite}
.orb-l3{left:4%;bottom:-24%;background:radial-gradient(circle,#fff 0%,transparent 58%);mix-blend-mode:soft-light;opacity:.9;animation:orb-c calc(var(--vel) * 11s) ease-in-out infinite}
.orb-l4{left:22%;top:20%;width:56%;height:56%;background:radial-gradient(circle,#fff 0%,transparent 62%);mix-blend-mode:screen;opacity:calc(.18 + var(--nivel) * .55);animation:orb-b calc(var(--vel) * 6s) ease-in-out infinite reverse}
.orb-giro{position:absolute;inset:-20%;background:conic-gradient(from 0deg,transparent 0 60%,rgba(255,255,255,.28) 72%,transparent 84%);
  mix-blend-mode:overlay;opacity:0;animation:orb-gira calc(var(--vel) * 4s) linear infinite}
.orb[data-state="thinking"] .orb-giro,.orb[data-state="connecting"] .orb-giro{opacity:1}
.orb[data-state="listening"] .orb-l1{background:radial-gradient(circle,var(--indigo,var(--brand)) 0%,transparent 65%);opacity:.8}
.orb[data-state="listening"] .orb-l3{opacity:1;mix-blend-mode:screen}
.orb[data-state="connecting"] .orb-halo{animation:orb-pulsa 1.2s ease-in-out infinite}
.orb-vidro{position:absolute;inset:0;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle at 32% 24%,rgba(255,255,255,.55) 0%,rgba(255,255,255,.08) 22%,transparent 40%),
             radial-gradient(circle at 70% 85%,rgba(255,255,255,.12) 0%,transparent 35%);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.22),inset 0 calc(var(--d) * -.04) calc(var(--d) * .1) rgba(0,0,0,.25)}
@keyframes orb-a{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(28%,18%) scale(1.15)}66%{transform:translate(8%,32%) scale(.9)}}
@keyframes orb-b{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-26%,22%) scale(.9)}66%{transform:translate(-10%,-14%) scale(1.2)}}
@keyframes orb-c{0%,100%{transform:translate(0,0) scale(1.05)}50%{transform:translate(20%,-30%) scale(.88)}}
@keyframes orb-gira{to{transform:rotate(360deg)}}
@keyframes orb-pulsa{0%,100%{opacity:.25;transform:scale(.95)}50%{opacity:.6;transform:scale(1.12)}}
@media (prefers-reduced-motion: reduce){.orb *{animation:none!important}}
`;

let cssInserido = false;
function inserirCss() {
  if (cssInserido || typeof document === "undefined") return;
  const el = document.createElement("style");
  el.dataset.orb = "";
  el.textContent = CSS;
  document.head.appendChild(el);
  cssInserido = true;
}

export default function ThinkingOrb({ state = "idle", size = 64, nivel = null, label, decorativo = false }) {
  inserirCss();
  const estado = ESTADOS.includes(state) ? state : "idle";
  const el = useRef(null);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  // Volume suavizado a cada quadro. Sem fonte de áudio, falando ou ouvindo,
  // uma oscilação leve mantém o orb vivo.
  useEffect(() => {
    if (decorativo && !nivel) return undefined;
    let quadro, atual = 0;
    const passo = (t) => {
      const st = estadoRef.current;
      let alvo = nivel?.current ?? 0;
      if (!nivel?.current && (st === "speaking" || st === "listening")) alvo = 0.18 + Math.sin(t / 180) * 0.08;
      if (st === "idle") alvo = Math.min(alvo, 0.08);
      atual += (alvo - atual) * (alvo > atual ? 0.35 : 0.12);
      el.current?.style.setProperty("--nivel", atual.toFixed(3));
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [nivel, decorativo]);

  return (
    <span ref={el} className="orb" data-state={estado}
      style={{ width: size, height: size, "--d": `${size}px`, "--vel": VELOCIDADE[estado] }}
      role={decorativo ? undefined : "img"} aria-hidden={decorativo || undefined} aria-label={decorativo ? undefined : label}>
      <span className="orb-halo" />
      <span className="orb-esfera">
        <span className="orb-luz orb-l1" />
        <span className="orb-luz orb-l2" />
        <span className="orb-luz orb-l3" />
        <span className="orb-luz orb-l4" />
        <span className="orb-giro" />
      </span>
      <span className="orb-vidro" />
    </span>
  );
}

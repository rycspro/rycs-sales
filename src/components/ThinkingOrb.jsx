// Orb animado do Jarvas. Uso: <ThinkingOrb state="connecting" size={64} />
//
// Estados:
// - idle:       parado, respirando devagar
// - connecting: anel girando em volta (abrindo a conversa)
// - thinking:   gradiente girando por dentro (o "digitando…")
// - speaking:   ondas saindo do orb (texto chegando ou voz falando)
// - listening:  anel pulsando no ritmo de quem fala (microfone aberto)
//
// Cores do design system (src/styles.js): --grad-ai, --brand, --indigo.
// Com prefers-reduced-motion, o orb fica parado e só muda de cor.

const ESTADOS = ["idle", "connecting", "thinking", "speaking", "listening"];
const ROTULOS = { idle: "Jarvas", connecting: "Jarvas conectando", thinking: "Jarvas pensando", speaking: "Jarvas respondendo", listening: "Jarvas ouvindo" };

const CSS = `
.tob{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none}
.tob-nucleo{position:absolute;inset:12%;border-radius:50%;overflow:hidden;
  background:var(--grad-ai,linear-gradient(135deg,var(--brand),var(--indigo,var(--brand))));
  box-shadow:0 0 0 1px rgba(255,255,255,.25) inset,0 6px 22px -6px var(--brand);
  animation:tob-respira 3.2s ease-in-out infinite}
.tob-nucleo::before{content:"";position:absolute;inset:-30%;
  background:conic-gradient(from 0deg,transparent 0 25%,rgba(255,255,255,.55) 40%,transparent 55% 75%,rgba(255,255,255,.35) 88%,transparent);
  opacity:.35;animation:tob-gira 6s linear infinite}
.tob-nucleo::after{content:"";position:absolute;left:22%;top:16%;width:34%;height:26%;border-radius:50%;
  background:radial-gradient(closest-side,rgba(255,255,255,.75),transparent);filter:blur(1px)}
.tob-anel{position:absolute;inset:0;border-radius:50%;opacity:0}
.tob[data-state="connecting"] .tob-anel{opacity:1;border:2px solid transparent;
  border-top-color:var(--brand);border-right-color:var(--indigo,var(--brand));animation:tob-gira .9s linear infinite}
.tob[data-state="connecting"] .tob-nucleo{animation:tob-pulsa 1.4s ease-in-out infinite}
.tob[data-state="thinking"] .tob-nucleo::before{opacity:.9;animation-duration:1.1s}
.tob[data-state="thinking"] .tob-nucleo{animation:tob-pulsa 1.2s ease-in-out infinite}
.tob-onda{position:absolute;inset:12%;border-radius:50%;border:2px solid var(--brand);opacity:0}
.tob[data-state="speaking"] .tob-onda{animation:tob-onda 1.6s ease-out infinite}
.tob[data-state="speaking"] .tob-onda:nth-child(4){animation-delay:.53s}
.tob[data-state="speaking"] .tob-onda:nth-child(5){animation-delay:1.06s}
.tob[data-state="listening"] .tob-nucleo{animation:tob-ouve .55s ease-in-out infinite alternate}
.tob[data-state="listening"] .tob-anel{opacity:1;border:2px solid var(--red,#ef4444);animation:tob-ouve .55s ease-in-out infinite alternate}
@keyframes tob-gira{to{transform:rotate(360deg)}}
@keyframes tob-respira{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
@keyframes tob-pulsa{0%,100%{transform:scale(.94)}50%{transform:scale(1.04)}}
@keyframes tob-ouve{from{transform:scale(.95)}to{transform:scale(1.07)}}
@keyframes tob-onda{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.55);opacity:0}}
@media (prefers-reduced-motion: reduce){.tob *,.tob *::before{animation:none!important}}
`;

let cssInserido = false;
function inserirCss() {
  if (cssInserido || typeof document === "undefined") return;
  const el = document.createElement("style");
  el.dataset.thinkingOrb = "";
  el.textContent = CSS;
  document.head.appendChild(el);
  cssInserido = true;
}

export default function ThinkingOrb({ state = "idle", size = 64, label, decorativo = false }) {
  inserirCss();
  const estado = ESTADOS.includes(state) ? state : "idle";
  return (
    <span className="tob" data-state={estado} style={{ width: size, height: size }}
      role={decorativo ? undefined : "img"} aria-hidden={decorativo || undefined}
      aria-label={decorativo ? undefined : label || ROTULOS[estado]}>
      <span className="tob-anel" />
      <span className="tob-nucleo" />
      <span className="tob-onda" />
      <span className="tob-onda" />
      <span className="tob-onda" />
    </span>
  );
}

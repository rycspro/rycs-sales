import { useEffect, useRef } from "react";

// Orb do Jarvas. Uso: <ThinkingOrb state="speaking" size={184} nivel={ref} />
//
// Design escolhido pelo dono (adaptado do loader "joao-canais" do Uiverse):
// um disco escuro com um anel de luz azul girando por dentro, feito de
// sombras internas que mudam de tom enquanto giram. Nada no centro (pedido
// do dono).
//
// `nivel` é um ref com o volume do momento (0 a 1): a voz do Jarvas ou o
// microfone. O orb lê esse valor a cada quadro e o anel pulsa e brilha no
// ritmo do som, sem re-renderizar o React.
//
// Estados (mudam a velocidade do giro):
// - idle:       devagar
// - connecting: giro do design original
// - thinking:   mais rápido
// - speaking:   reage ao volume da voz do Jarvas
// - listening:  reage ao volume do microfone, tom mais claro
//
// Medidas proporcionais ao tamanho (o design original tem 180px). Cores do
// design system (src/styles.js). Com prefers-reduced-motion, fica parado.

const ESTADOS = ["idle", "connecting", "thinking", "speaking", "listening"];
const VELOCIDADE = { idle: 2.4, connecting: 1, thinking: 0.6, speaking: 0.85, listening: 0.9 };

// Sombra interna do anel, em unidades do design original (180px).
const sombra = (a, b, c) => [
  `0 calc(6 * var(--u)) calc(12 * var(--u)) 0 var(${a}) inset`,
  `0 calc(12 * var(--u)) calc(18 * var(--u)) 0 var(${b}) inset`,
  `0 calc(36 * var(--u)) calc(36 * var(--u)) 0 var(${c}) inset`,
].join(",");

// Brilho externo do anel, com a transparência do design original.
const brilho = (borrao, espalha) => [
  `0 0 calc(${borrao} * var(--u)) calc(${espalha} * var(--u)) color-mix(in srgb, var(--sky) 30%, transparent)`,
  `0 0 calc(${borrao * 2} * var(--u)) calc(${espalha * 1.5} * var(--u)) color-mix(in srgb, var(--blue-vivo) 20%, transparent)`,
].join(",");

const CSS = `
.orb{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;
  --nivel:0;--vel:1;--u:calc(var(--d) / 180);border-radius:50%;user-select:none;-webkit-user-select:none}
.orb-halo{position:absolute;inset:-12%;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,var(--sky) 0%,var(--blue-vivo) 35%,transparent 68%);
  filter:blur(calc(14 * var(--u)));opacity:calc(.12 + var(--nivel) * .55);transform:scale(calc(.9 + var(--nivel) * .25))}
.orb-corpo{position:absolute;inset:0;border-radius:50%;transform:scale(calc(1 + var(--nivel) * .07))}
.orb-disco{position:absolute;inset:0;border-radius:50%;
  background:linear-gradient(0deg,var(--blue-noite),var(--navy) 55%,var(--navy-600));
  box-shadow:0 calc(8 * var(--u)) calc(30 * var(--u)) calc(-8 * var(--u)) var(--blue-vivo)}
.orb-anel{position:absolute;inset:0;border-radius:50%;animation:orb-anel calc(var(--vel) * 2.3s) linear infinite}
.orb[data-state="listening"] .orb-disco{background:linear-gradient(0deg,var(--blue-800),var(--navy) 60%,var(--navy-600))}
@keyframes orb-anel{
  0%{transform:rotate(90deg);box-shadow:${sombra("--sky", "--blue-vivo", "--blue-800")},${brilho(3, 1.2)}}
  25%{transform:rotate(180deg);box-shadow:${sombra("--sky-600", "--sky", "--blue-vivo")},${brilho(6, 2.4)}}
  50%{transform:rotate(270deg);box-shadow:${sombra("--blue-400", "--sky-700", "--blue-vivo")},${brilho(3, 1.2)}}
  75%{transform:rotate(360deg);box-shadow:${sombra("--blue-500", "--sky-600", "--brand")},${brilho(6, 2.4)}}
  100%{transform:rotate(450deg);box-shadow:${sombra("--sky", "--blue-vivo", "--blue-800")},${brilho(3, 1.2)}}
}
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
      <span className="orb-corpo">
        <span className="orb-disco" />
        <span className="orb-anel" />
      </span>
    </span>
  );
}

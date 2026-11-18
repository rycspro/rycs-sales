import { useState } from "react";
import {
  Lock, CheckCircle2, UserRound, ClipboardCheck, GraduationCap, TrendingUp,
  Coins, Gem,
} from "lucide-react";

// =============================================================================
// AchievementBadge — medalha colecionável 3D (estilo "Premium 3D Collectible").
//
// A representação PRINCIPAL de cada conquista é uma imagem 3D renderizada com
// transparência (WebP), carregada de `/badges/<id>.webp` (pasta public/badges).
// Enquanto os 21 assets não existem, cai num SLOT de medalha (moldura metálica
// por categoria) — simples e claramente um placeholder, nunca uma tentativa de
// reproduzir a medalha 3D só com CSS. Basta soltar os arquivos em public/badges
// que a imagem real assume automaticamente.
//
// Estados: "conquistada" (colorida + selo verde), "progresso" (brilho reduzido +
// barra + próximo objetivo) e "bloqueada" (identidade preservada, saturação/
// luminosidade levemente reduzidas + cadeado no canto). Não vira ícone cinza.
//
// Animações: hover sobe + leve inclinação 3D + reflexo metálico + sombra; ao
// desbloquear (`novo`), surge com escala + rotação + partículas douradas.
// Nenhuma animação contínua.
//
// Identidade White Editorial: card branco, azul principal #318CE7.
// =============================================================================

const AZUL = "#318CE7";
const VERDE = "#22c55e";

// Direção de cor por categoria (famílias metálicas da spec). `metalA/metalB` são
// o anel; `esmalte` é o centro; `Symbol` é o símbolo-placeholder do centro.
const TEMAS = {
  perfil: {      rotulo: "Perfil e identidade",        metalA: "#e8edf3", metalB: "#8c97a3", esmalte: AZUL,      Symbol: UserRound },
  avaliacoes: {  rotulo: "Aprendizado e avaliações",   metalA: "#f3e4bf", metalB: "#9a5bd6", esmalte: "#7C3AED", Symbol: ClipboardCheck },
  academy: {     rotulo: "Aprendizado e certificações",metalA: "#f0dca8", metalB: "#7c3aed", esmalte: "#6D28D9", Symbol: GraduationCap },
  performance: { rotulo: "Experiência profissional",   metalA: "#f0c08a", metalB: "#9a5a2b", esmalte: "#E8792B", Symbol: TrendingUp },
  ganhos: {      rotulo: "Ganhos financeiros",         metalA: "#f3e4a8", metalB: "#1f9d55", esmalte: "#16A34A", Symbol: Coins },
};

// Conquistas de maior raridade ganham acabamento platina/diamante + gema. São os
// topos de cada trilha — "conquistas especiais" (gemas/cristais/estrelas).
const ELITE = new Set([
  "perfil-completo", "especialista-academy", "profissional-evolucao",
  "consistencia", "alta-performance", "dez-mil-em-ganhos",
]);

export function temaCategoria(cat) { return TEMAS[cat] || TEMAS.perfil; }

// URL do asset 3D da conquista. Trocar a extensão aqui se usar AVIF.
export function assetMedalha(id) { return `/badges/${id}.webp`; }

export default function AchievementBadge({ conquista, onClick, novo = false }) {
  const cq = conquista;
  const tema = temaCategoria(cq.categoria);
  const elite = ELITE.has(cq.id);
  const estado = cq.desbloqueada
    ? "conquistada"
    : (cq.progresso?.atual > 0 ? "progresso" : "bloqueada");

  const [semAsset, setSemAsset] = useState(false);
  const atual = cq.progresso?.atual ?? 0;
  const alvo = cq.progresso?.alvo ?? 1;
  const pct = Math.max(0, Math.min(100, Math.round((atual / alvo) * 100)));

  return (
    <button
      type="button"
      onClick={() => onClick?.(cq)}
      className={`ab-card ab-${estado}${novo ? " ab-novo" : ""}`}
      aria-label={`${cq.nome} — ${estado === "conquistada" ? "conquistada" : estado === "progresso" ? `em progresso ${atual} de ${alvo}` : "bloqueada"}`}
    >
      <BadgeStyles />

      <div className="ab-stage">
        <div className="ab-medal" style={{ "--metalA": tema.metalA, "--metalB": tema.metalB, "--esmalte": tema.esmalte }}>
          {/* Asset 3D (representação principal) ou slot placeholder */}
          {!semAsset ? (
            <img
              className="ab-img"
              src={assetMedalha(cq.id)}
              alt=""
              width={84}
              height={84}
              loading="lazy"
              draggable={false}
              onError={() => setSemAsset(true)}
            />
          ) : (
            <span className="ab-slot" aria-hidden="true">
              <span className="ab-slot-anel" />
              <span className="ab-slot-centro">
                <tema.Symbol size={26} />
              </span>
              {elite && <span className="ab-gema" aria-hidden="true"><Gem size={13} /></span>}
            </span>
          )}

          {/* Reflexo metálico que atravessa no hover */}
          <span className="ab-shine" aria-hidden="true" />

          {/* Selos de estado */}
          {estado === "conquistada" && (
            <span className="ab-selo ab-selo-ok" aria-hidden="true"><CheckCircle2 size={14} /></span>
          )}
          {estado === "bloqueada" && (
            <span className="ab-selo ab-selo-lock" aria-hidden="true"><Lock size={12} /></span>
          )}

          {/* Partículas douradas ao desbloquear */}
          {novo && (
            <span className="ab-particulas" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => <i key={i} style={{ "--i": i }} />)}
            </span>
          )}
        </div>
      </div>

      <div className="ab-nome">{cq.nome}</div>

      {estado === "conquistada" ? (
        <span className="ab-estado ab-estado-ok"><CheckCircle2 size={11} /> Conquistada</span>
      ) : estado === "progresso" ? (
        <div className="ab-prog">
          <div className="ab-prog-trilho"><div className="ab-prog-fill" style={{ width: `${pct}%` }} /></div>
          <span className="ab-prog-txt">{atual}/{alvo} · próximo objetivo</span>
        </div>
      ) : (
        <span className="ab-estado ab-estado-lock"><Lock size={10} /> Bloqueada</span>
      )}

      {novo && <span className="ab-toast">Conquista desbloqueada!</span>}
    </button>
  );
}

// Estilos escopados (prefixo ab-). Mantém o componente autossuficiente e não
// mexe no design system global.
let estilosInjetados = false;
function BadgeStyles() {
  if (estilosInjetados) return null;
  estilosInjetados = true;
  return (
    <style>{`
    .ab-card{
      position:relative; padding:14px 12px 12px; background:#fff;
      border:1px solid var(--border,#e6e9ee); border-radius:14px; cursor:pointer;
      display:flex; flex-direction:column; align-items:center; gap:7px; font:inherit;
      min-height:168px; transition:box-shadow .25s ease, transform .25s ease, border-color .25s ease;
    }
    .ab-card:hover{ box-shadow:0 14px 30px rgba(16,32,64,.14); border-color:#dfe4ec; }
    .ab-stage{ perspective:520px; width:90px; height:90px; display:flex; align-items:center; justify-content:center; }
    .ab-medal{
      position:relative; width:84px; height:84px; display:flex; align-items:center; justify-content:center;
      transform-style:preserve-3d; transition:transform .3s cubic-bezier(.2,.7,.2,1), filter .3s ease;
      filter:drop-shadow(0 6px 10px rgba(16,32,64,.18));
    }
    .ab-card:hover .ab-medal{ transform:translateY(-6px) rotateX(9deg) rotateY(-10deg); filter:drop-shadow(0 16px 20px rgba(16,32,64,.26)); }
    .ab-img{ width:84px; height:84px; object-fit:contain; display:block; }

    /* Slot placeholder (até os assets 3D existirem) — moldura metálica simples */
    .ab-slot{ position:relative; width:84px; height:84px; display:flex; align-items:center; justify-content:center; }
    .ab-slot-anel{
      position:absolute; inset:0; border-radius:50%;
      background:
        radial-gradient(circle at 32% 26%, rgba(255,255,255,.9), rgba(255,255,255,0) 42%),
        conic-gradient(from 210deg, var(--metalB), var(--metalA), var(--metalB), var(--metalA), var(--metalB));
      padding:7px; box-shadow:inset 0 2px 4px rgba(255,255,255,.5), inset 0 -3px 6px rgba(0,0,0,.25);
    }
    .ab-slot-anel::after{ content:""; position:absolute; inset:7px; border-radius:50%;
      background:radial-gradient(circle at 36% 30%, color-mix(in srgb, var(--esmalte) 72%, #fff), var(--esmalte) 70%);
      box-shadow:inset 0 2px 5px rgba(255,255,255,.4), inset 0 -4px 8px rgba(0,0,0,.28); }
    .ab-slot-centro{ position:relative; z-index:1; color:#fff; filter:drop-shadow(0 1px 1px rgba(0,0,0,.35)); display:flex; }
    .ab-gema{ position:absolute; z-index:2; top:-2px; right:2px; color:#eaf6ff;
      filter:drop-shadow(0 0 4px rgba(120,200,255,.9)); }

    /* Reflexo metálico que atravessa no hover */
    .ab-shine{ position:absolute; inset:0; border-radius:50%; overflow:hidden; pointer-events:none; }
    .ab-shine::before{ content:""; position:absolute; top:-40%; left:-60%; width:60%; height:180%;
      background:linear-gradient(100deg, transparent, rgba(255,255,255,.75), transparent);
      transform:translateX(-120%) rotate(8deg); }
    .ab-card:hover .ab-shine::before{ transition:transform .7s ease; transform:translateX(320%) rotate(8deg); }

    /* Selos de estado */
    .ab-selo{ position:absolute; bottom:-2px; right:-2px; width:20px; height:20px; border-radius:50%;
      display:flex; align-items:center; justify-content:center; background:#fff; box-shadow:0 2px 5px rgba(0,0,0,.2); }
    .ab-selo-ok{ color:${VERDE}; }
    .ab-selo-lock{ color:#64748b; }

    /* Estado bloqueada: preserva identidade, só reduz saturação/luz */
    .ab-bloqueada .ab-medal{ filter:drop-shadow(0 6px 10px rgba(16,32,64,.14)) saturate(.68) brightness(.92); }
    .ab-bloqueada .ab-img, .ab-bloqueada .ab-slot{ opacity:.9; }
    .ab-progresso .ab-medal{ filter:drop-shadow(0 6px 10px rgba(16,32,64,.16)) saturate(.9) brightness(.97); }

    .ab-nome{ font-size:12.5px; font-weight:600; color:var(--ink,#0f172a); line-height:1.25; text-align:center; }
    .ab-estado{ font-size:10.5px; font-weight:700; display:inline-flex; align-items:center; gap:3px; }
    .ab-estado-ok{ color:${VERDE}; }
    .ab-estado-lock{ color:var(--muted-2,#94a3b8); font-weight:600; }
    .ab-prog{ width:100%; display:flex; flex-direction:column; align-items:center; gap:3px; }
    .ab-prog-trilho{ width:84%; height:5px; border-radius:999px; background:var(--surface-2,#eef1f5); overflow:hidden; }
    .ab-prog-fill{ height:100%; border-radius:999px; background:${AZUL}; transition:width .5s ease; }
    .ab-prog-txt{ font-size:10px; color:var(--amber,#d97706); font-variant-numeric:tabular-nums; }

    /* Desbloqueio: escala + rotação + partículas + toast */
    .ab-novo .ab-medal{ animation:ab-pop .7s cubic-bezier(.2,1.2,.3,1) both; }
    @keyframes ab-pop{ 0%{ transform:scale(.5) rotateY(180deg); opacity:0 } 60%{ transform:scale(1.08) rotateY(0) } 100%{ transform:scale(1) } }
    .ab-particulas{ position:absolute; inset:0; pointer-events:none; }
    .ab-particulas i{ position:absolute; top:50%; left:50%; width:5px; height:5px; border-radius:50%;
      background:radial-gradient(circle, #ffe9a8, #e9b949); opacity:0;
      transform:rotate(calc(var(--i) * 45deg)) translateX(0);
      animation:ab-spark .8s ease-out .05s both; }
    @keyframes ab-spark{ 0%{ opacity:0; transform:rotate(calc(var(--i) * 45deg)) translateX(6px) scale(.6) }
      30%{ opacity:1 } 100%{ opacity:0; transform:rotate(calc(var(--i) * 45deg)) translateX(46px) scale(.4) } }
    .ab-toast{ position:absolute; top:-10px; left:50%; transform:translateX(-50%);
      background:${AZUL}; color:#fff; font-size:10.5px; font-weight:700; padding:3px 9px; border-radius:999px;
      white-space:nowrap; box-shadow:0 4px 12px rgba(49,140,231,.4); animation:ab-toast 2.4s ease forwards; }
    @keyframes ab-toast{ 0%{ opacity:0; transform:translate(-50%,6px) } 12%{ opacity:1; transform:translate(-50%,0) }
      80%{ opacity:1 } 100%{ opacity:0; transform:translate(-50%,-6px) } }

    @media (prefers-reduced-motion: reduce){
      .ab-card:hover .ab-medal{ transform:none }
      .ab-shine::before, .ab-novo .ab-medal, .ab-particulas i, .ab-toast{ animation:none !important; transition:none !important }
    }
    `}</style>
  );
}

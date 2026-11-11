import { Check } from "lucide-react";
import { ETAPAS, normalizarEtapas, podeAbrirEtapa } from "../../../shared/onboarding.js";
import { useI18n } from "../../lib/i18n.jsx";

// Subfases exibidas dentro do nó 4 (IA RAG) quando ativa === "ia".
// O índice 0–3 corresponde à fase em andamento; null = IA ainda não começou.
export const SUBFASES_IA_KEYS = [
  "onb.ia.subphase.analyzing",
  "onb.ia.subphase.script",
  "onb.ia.subphase.funnel",
  "onb.ia.subphase.followups",
];

export default function BarraProgresso({ etapas, ativa, subfase = null, aoAbrir }) {
  const { t } = useI18n();
  const e = normalizarEtapas(etapas);
  const ativaObj = ETAPAS.find((x) => x.chave === ativa) || ETAPAS[0];
  const n = ativaObj.n;
  const totalSegs = ETAPAS.length - 1; // 5 segmentos entre 6 nós
  const segsConcluidos = n - 1;

  // Largura da linha preenchida: percentual do espaço entre o centro do nó 1
  // e o centro do nó 6 (por isso subtrai 34px — diâmetro do nó — dos dois lados).
  const fillWidth = segsConcluidos === 0
    ? "0px"
    : segsConcluidos === totalSegs
      ? "calc(100% - 34px)"
      : `calc((100% - 34px) * ${segsConcluidos / totalSegs})`;

  const pctNum = Math.round((segsConcluidos / totalSegs) * 100);

  return (
    <nav
      className="vx-prog"
      role="progressbar"
      aria-valuenow={pctNum}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={t("onb.progress.ariaLabel", { n, total: ETAPAS.length, label: ativaObj.label })}
    >
      <div className="vx-prog-inner">

        {/* ── Mobile: nó + nome + barra thin ── */}
        <div className="vx-prog-mob" aria-hidden="true">
          <div className="vx-prog-mob-circulo">{n}</div>
          <div className="vx-prog-mob-info">
            <div className="vx-prog-mob-rotulo">{ativaObj.label}</div>
            <div className="vx-prog-mob-sub">{t("onb.stepOf", { n, total: ETAPAS.length })}</div>
            <div className="vx-prog-mob-pct">
              <div className="vx-prog-mob-fill" style={{ width: `${pctNum}%` }} />
            </div>
          </div>
        </div>

        {/* ── Desktop: trilha completa ── */}
        <div className="vx-prog-desktop">
          <div className="vx-prog-track">
            {/* linha de fundo (toda a extensão) */}
            <div className="vx-prog-linha-bg" aria-hidden="true" />
            {/* linha preenchida (animada) */}
            <div className="vx-prog-linha-fill" style={{ width: fillWidth }} aria-hidden="true" />

            {ETAPAS.map((etapa) => {
              const estado = etapa.chave === ativa ? "atual"
                : e[etapa.chave] === "concluida" ? "concluida"
                : "pendente";
              const clicavel = aoAbrir && estado !== "atual" && podeAbrirEtapa(etapas, etapa.chave);
              const rotulo = `${etapa.label}: ${estado === "atual" ? t("onb.progress.current") : estado === "concluida" ? t("onb.progress.done") : t("onb.progress.pending")}`;
              const icone = estado === "concluida"
                ? <Check size={14} strokeWidth={3} />
                : etapa.n;

              return (
                <div
                  key={etapa.chave}
                  className="vx-prog-no"
                  data-estado={estado}
                  aria-current={estado === "atual" ? "step" : undefined}
                >
                  <div className="vx-prog-circulo">
                    {clicavel
                      ? (
                        <button
                          type="button"
                          onClick={() => aoAbrir(etapa.chave)}
                          aria-label={rotulo}
                        >
                          {icone}
                        </button>
                      )
                      : <span aria-label={rotulo} aria-hidden={estado !== "pendente" ? undefined : "true"}>{icone}</span>
                    }
                  </div>
                  <div className="vx-prog-rotulo">{etapa.label}</div>
                </div>
              );
            })}
          </div>

          {/* Subfases da IA (visíveis apenas na etapa 4) */}
          {ativa === "ia" && (
            <div className="vx-prog-subfases" role="list" aria-label={t("onb.ia.subphaseLabel")}>
              {SUBFASES_IA_KEYS.map((key, i) => {
                const fase = t(key);
                const sfEstado = subfase == null ? "pendente"
                  : i < subfase ? "concluida"
                  : i === subfase ? "atual"
                  : "pendente";
                return (
                  <span
                    key={fase}
                    className="vx-prog-subfase"
                    data-estado={sfEstado}
                    role="listitem"
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    {sfEstado === "concluida" && "✓ "}{fase}
                  </span>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </nav>
  );
}

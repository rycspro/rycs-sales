import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Star, Gift } from "lucide-react";
import confetti from "canvas-confetti";
import NumberFlow from "@number-flow/react";
import { CICLOS, DESCONTO_ANUAL, mensalidadeNoCiclo } from "../../../shared/planos.js";
import { useI18n } from "../../lib/i18n.jsx";

// Vitrine de planos da empresa. Recriação, no design system do projeto (sem
// Tailwind/shadcn), do bloco de pricing com alternância mensal/anual, card
// "Popular" em destaque, preço animado e confete ao escolher o anual.
export default function PricingPlanos({ plans = [], onContratar, planoAtualChave }) {
  const { t } = useI18n();
  const [anual, setAnual] = useState(false);
  const switchRef = useRef(null);

  const ciclo = anual ? CICLOS.ANUAL : CICLOS.MENSAL;
  const descontoPct = Math.round(DESCONTO_ANUAL * 100);
  // Já existe um plano pago ativo? Então os outros cards viram "Trocar para este plano".
  const temPlanoAtivo = plans.some((p) => p.chave === planoAtualChave);

  const alternar = (ativarAnual) => {
    setAnual(ativarAnual);
    if (ativarAnual && switchRef.current) {
      const r = switchRef.current.getBoundingClientRect();
      confetti({
        particleCount: 50,
        spread: 60,
        startVelocity: 30,
        gravity: 1.2,
        decay: 0.94,
        ticks: 200,
        shapes: ["circle"],
        origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight },
        colors: ["#2563EB", "#4338CA", "#0EA5E9", "#60A5FA"],
      });
    }
  };

  return (
    <div>
      {/* Alternância mensal / anual */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: 26 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: !anual ? "var(--ink)" : "var(--muted)" }}>{t("sub.monthly")}</span>
        <button
          ref={switchRef}
          type="button"
          role="switch"
          aria-checked={anual}
          aria-label="Alternar entre cobrança mensal e anual"
          onClick={() => alternar(!anual)}
          style={{
            width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", padding: 3,
            background: anual ? "var(--brand)" : "var(--surface-3, #d1d5db)", transition: "background .2s", flexShrink: 0,
          }}
        >
          <span style={{
            display: "block", width: 20, height: 20, borderRadius: "50%", background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,.2)", transform: anual ? "translateX(20px)" : "translateX(0)",
            transition: "transform .2s",
          }} />
        </button>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: anual ? "var(--ink)" : "var(--muted)" }}>
          {t("sub.annual")} <span style={{ color: "var(--brand)" }}>({t("sub.save")} {descontoPct}%)</span>
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, alignItems: "start" }}>
        {plans.map((p, index) => {
          const popular = p.chave === "scale";
          const ehAtual = p.chave === planoAtualChave;
          const temTrial = p.trial !== false;
          const mensalidade = mensalidadeNoCiclo(p.chave, ciclo);
          return (
            <motion.article
              key={p.chave}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1.1, type: "spring", stiffness: 100, damping: 26, delay: 0.1 + index * 0.08 }}
              className="vx-card"
              style={{
                position: "relative", padding: "26px 22px", display: "flex", flexDirection: "column",
                border: ehAtual || popular ? "2px solid var(--brand)" : "1px solid var(--border)",
                background: ehAtual ? "var(--brand-50)" : undefined,
                boxShadow: ehAtual || popular ? "var(--shadow-brand)" : "var(--shadow-card)",
                overflow: "hidden",
              }}
            >
              {ehAtual ? (
                <div style={{
                  position: "absolute", top: 0, left: 0, display: "flex", alignItems: "center", gap: 4,
                  background: "var(--brand)", color: "#fff", padding: "4px 10px",
                  borderBottomRightRadius: 12, fontSize: 11, fontWeight: 700,
                }}>
                  <Check size={12} strokeWidth={3} /> {t("sub.yourPlan")}
                </div>
              ) : temTrial ? (
                <div style={{
                  position: "absolute", top: 0, left: 0, display: "flex", alignItems: "center", gap: 4,
                  background: "var(--brand)", color: "#fff", padding: "4px 10px",
                  borderBottomRightRadius: 12, fontSize: 11, fontWeight: 700,
                }}>
                  <Gift size={12} /> {t("sub.sevenDaysFree")}
                </div>
              ) : null}
              {popular && (
                <div style={{
                  position: "absolute", top: 0, right: 0, display: "flex", alignItems: "center", gap: 4,
                  background: "var(--brand)", color: "#fff", padding: "4px 10px",
                  borderBottomLeftRadius: 12, fontSize: 11, fontWeight: 700,
                }}>
                  <Star size={12} fill="currentColor" /> {t("sub.popular")}
                </div>
              )}

              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", letterSpacing: ".04em", textTransform: "uppercase", marginTop: 6 }}>
                {p.nome}
              </div>

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6, margin: "16px 0 2px" }}>
                <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-.03em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                  <NumberFlow
                    value={mensalidade}
                    format={{ style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }}
                    locales="pt-BR"
                    transformTiming={{ duration: 500, easing: "ease-out" }}
                    willChange
                  />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>/mês</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", marginBottom: 4 }}>
                {anual ? t("sub.billedAnnually", { pct: descontoPct }) : t("sub.billedMonthly")}
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 9 }}>
                {p.inclui.map((i) => (
                  <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--text-2, var(--ink))", textAlign: "left" }}>
                    <Check size={15} color="var(--brand)" strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 1 }} /> {i}
                  </li>
                ))}
              </ul>

              <div style={{ borderTop: "1px solid var(--border)", margin: "18px 0 14px" }} />

              <button
                type="button"
                className={`vx-btn vx-btn-block ${ehAtual ? "" : "vx-btn-primary"}`}
                disabled={ehAtual}
                onClick={() => onContratar?.(p.chave, ciclo)}
                style={{ marginTop: "auto", fontWeight: 700 }}
              >
                {ehAtual ? t("sub.currentPlan") : temPlanoAtivo ? t("sub.switchPlan") : temTrial ? t("sub.startTrial") : t("sub.subscribe")}
              </button>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

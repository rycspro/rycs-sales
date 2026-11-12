import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Star, Gift } from "lucide-react";
import confetti from "canvas-confetti";
import NumberFlow from "@number-flow/react";
import { CICLOS, mensalidadeNoCiclo, descontoDoCiclo } from "../../../shared/planos.js";

// Ciclos oferecidos na vitrine, em ordem de compromisso crescente. O desconto
// de cada um mora em shared/planos.js — aqui só exibimos.
const OPCOES_CICLO = [
  { id: CICLOS.MENSAL, label: "Mensal" },
  { id: CICLOS.SEMESTRAL, label: "Semestral" },
  { id: CICLOS.ANUAL, label: "Anual" },
];

const pct = (d) => Math.round(d * 100);

// Vitrine de planos da empresa. Recriação, no design system do projeto (sem
// Tailwind/shadcn), do bloco de pricing com alternância mensal/semestral/anual,
// card "Popular" em destaque, preço animado e confete ao escolher um ciclo com
// desconto.
export default function PricingPlanos({ plans = [], onContratar, planoAtualChave }) {
  const [ciclo, setCiclo] = useState(CICLOS.MENSAL);
  const segRef = useRef(null);

  const descontoAtual = descontoDoCiclo(ciclo);
  // Já existe um plano pago ativo? Então os outros cards viram "Trocar para este plano".
  const temPlanoAtivo = plans.some((p) => p.chave === planoAtualChave);

  const alternar = (novoCiclo) => {
    setCiclo(novoCiclo);
    if (descontoDoCiclo(novoCiclo) > 0 && segRef.current) {
      const r = segRef.current.getBoundingClientRect();
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
      {/* Alternância mensal / semestral / anual */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
        <div
          ref={segRef}
          role="radiogroup"
          aria-label="Ciclo de cobrança"
          style={{
            display: "inline-flex", gap: 4, padding: 4, borderRadius: 999,
            background: "var(--surface-2, #F1F5F9)", border: "1px solid var(--border)",
            flexWrap: "wrap", justifyContent: "center",
          }}
        >
          {OPCOES_CICLO.map((o) => {
            const ativo = ciclo === o.id;
            const desc = descontoDoCiclo(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => alternar(o.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 999, border: "none", cursor: "pointer",
                  fontSize: 13.5, fontWeight: 600, fontFamily: "inherit",
                  color: ativo ? "#fff" : "var(--muted)",
                  background: ativo ? "var(--brand)" : "transparent",
                  boxShadow: ativo ? "var(--shadow-brand, 0 1px 3px rgba(37,99,235,.35))" : "none",
                  transition: "background .2s, color .2s",
                }}
              >
                {o.label}
                {desc > 0 && (
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, lineHeight: 1,
                    padding: "2px 6px", borderRadius: 999,
                    background: ativo ? "rgba(255,255,255,.22)" : "var(--brand-50)",
                    color: ativo ? "#fff" : "var(--brand)",
                  }}>-{pct(desc)}%</span>
                )}
              </button>
            );
          })}
        </div>
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
                  <Check size={12} strokeWidth={3} /> Seu plano
                </div>
              ) : temTrial ? (
                <div style={{
                  position: "absolute", top: 0, left: 0, display: "flex", alignItems: "center", gap: 4,
                  background: "var(--brand)", color: "#fff", padding: "4px 10px",
                  borderBottomRightRadius: 12, fontSize: 11, fontWeight: 700,
                }}>
                  <Gift size={12} /> 7 dias grátis
                </div>
              ) : null}
              {popular && (
                <div style={{
                  position: "absolute", top: 0, right: 0, display: "flex", alignItems: "center", gap: 4,
                  background: "var(--brand)", color: "#fff", padding: "4px 10px",
                  borderBottomLeftRadius: 12, fontSize: 11, fontWeight: 700,
                }}>
                  <Star size={12} fill="currentColor" /> Popular
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
                {ciclo === CICLOS.ANUAL ? `cobrado anualmente · economize ${pct(descontoAtual)}%`
                  : ciclo === CICLOS.SEMESTRAL ? `cobrado a cada 6 meses · economize ${pct(descontoAtual)}%`
                  : "cobrado mensalmente"}
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
                {ehAtual ? "Plano atual" : temPlanoAtivo ? "Trocar para este plano" : temTrial ? "Iniciar período grátis" : "Contratar"}
              </button>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

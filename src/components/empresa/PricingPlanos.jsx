import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Star, Gift, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import NumberFlow from "@number-flow/react";
import { CICLOS, mensalidadeNoCiclo, descontoDoCiclo, PLANOS } from "../../../shared/planos.js";

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
export default function PricingPlanos({ plans = [], onContratar, onUsarGratis, planoAtualChave }) {
  const [ciclo, setCiclo] = useState(CICLOS.MENSAL);
  const segRef = useRef(null);

  const descontoAtual = descontoDoCiclo(ciclo);
  // Já existe um plano pago ativo? Então os outros cards viram "Trocar para este plano".
  const temPlanoAtivo = plans.some((p) => p.chave === planoAtualChave);

  // Plano gratuito: sem mensalidade, exibido como faixa larga acima dos ciclos.
  // Sem assinatura paga, a empresa está no Free por padrão.
  const free = PLANOS.free;
  const noFree = !planoAtualChave || planoAtualChave === "free";

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
      {/* Plano gratuito — faixa larga acima dos ciclos, em 3 camadas:
          esquerda (nome + preço), meio (tópicos), direita (ação). */}
      <div
        className="vx-free-banner"
        style={{
          display: "grid", gridTemplateColumns: "minmax(140px, 190px) 1fr auto",
          alignItems: "center", gap: 24, padding: "20px 24px", marginBottom: 20,
          borderRadius: "var(--radius-lg, 16px)",
          ...(noFree
            ? { border: "none", background: "linear-gradient(120deg, #2563EB 0%, #4338CA 52%, #0EA5E9 100%)", boxShadow: "0 10px 26px rgba(37,99,235,.28)", color: "#fff" }
            : { border: "1px solid var(--border)", background: "var(--bg-card, #fff)", boxShadow: "var(--shadow-card)", color: "var(--ink)" }),
        }}
      >
        {/* Camada 1 — identidade do plano */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderRight: noFree ? "1px solid rgba(255,255,255,.25)" : "1px solid var(--border)", paddingRight: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: noFree ? "rgba(255,255,255,.85)" : "var(--muted)", letterSpacing: ".04em", textTransform: "uppercase" }}>
            {free.nome}
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.03em", color: noFree ? "#fff" : "var(--ink)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>R$ 0</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: noFree ? "rgba(255,255,255,.85)" : "var(--muted)" }}>/mês</span>
          </div>
        </div>

        {/* Camada 2 — tópicos */}
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px 20px" }}>
          {free.inclui.map((i) => {
            const ehIA = /\bIA\b/.test(i);
            return (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: ehIA ? 700 : 500, color: noFree ? "#fff" : "var(--ink)" }}>
                {ehIA
                  ? <Sparkles size={15} color={noFree ? "#fff" : "var(--brand)"} strokeWidth={2.4} style={{ flexShrink: 0 }} />
                  : <Check size={15} color={noFree ? "#fff" : "var(--brand)"} strokeWidth={2.6} style={{ flexShrink: 0 }} />} {i}
              </li>
            );
          })}
        </ul>

        {/* Camada 3 — ação */}
        <button
          type="button"
          disabled={noFree}
          onClick={() => onUsarGratis?.()}
          style={{
            fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0, minWidth: 150,
            padding: "10px 18px", borderRadius: 10, fontFamily: "inherit", fontSize: 13.5,
            cursor: noFree ? "default" : "pointer",
            border: noFree ? "1px solid rgba(255,255,255,.45)" : "1px solid var(--brand)",
            background: noFree ? "rgba(255,255,255,.18)" : "var(--brand)",
            color: noFree ? "#fff" : "#fff",
          }}
        >
          {noFree ? "Plano atual" : "Usar plano grátis"}
        </button>
      </div>

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
              className={`vx-card${ehAtual ? " vx-card--active" : ""}`}
              style={{
                position: "relative", padding: "26px 22px", display: "flex", flexDirection: "column",
                border: popular ? "2px solid var(--brand)" : undefined,
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
                  <Gift size={12} /> 5 dias grátis
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

              <div style={{ fontSize: 13, fontWeight: 700, color: ehAtual ? "rgba(255,255,255,.85)" : "var(--muted)", letterSpacing: ".04em", textTransform: "uppercase", marginTop: 6 }}>
                {p.nome}
              </div>

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6, margin: "16px 0 2px" }}>
                <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-.03em", color: ehAtual ? "#fff" : "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                  <NumberFlow
                    value={mensalidade}
                    format={{ style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }}
                    locales="pt-BR"
                    transformTiming={{ duration: 500, easing: "ease-out" }}
                    willChange
                  />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: ehAtual ? "rgba(255,255,255,.85)" : "var(--muted)" }}>/mês</span>
              </div>
              <div style={{ fontSize: 11.5, color: ehAtual ? "rgba(255,255,255,.7)" : "var(--muted)", textAlign: "center", marginBottom: 4 }}>
                {ciclo === CICLOS.ANUAL ? `cobrado anualmente · economize ${pct(descontoAtual)}%`
                  : ciclo === CICLOS.SEMESTRAL ? `cobrado a cada 6 meses · economize ${pct(descontoAtual)}%`
                  : "cobrado mensalmente"}
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 9 }}>
                {p.inclui.map((i) => (
                  <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: ehAtual ? "#fff" : "var(--text-2, var(--ink))", textAlign: "left" }}>
                    <Check size={15} color={ehAtual ? "#fff" : "var(--brand)"} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 1 }} /> {i}
                  </li>
                ))}
              </ul>

              <div style={{ borderTop: ehAtual ? "1px solid rgba(255,255,255,.25)" : "1px solid var(--border)", margin: "18px 0 14px" }} />

              <button
                type="button"
                className={`vx-btn vx-btn-block ${ehAtual ? "" : "vx-btn-primary"}`}
                disabled={ehAtual}
                onClick={() => onContratar?.(p.chave, ciclo)}
                style={{ marginTop: "auto", fontWeight: 700, ...(ehAtual ? { background: "rgba(255,255,255,.2)", color: "#fff", border: "1px solid rgba(255,255,255,.3)" } : {}) }}
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

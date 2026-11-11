import { Zap, ArrowRight } from "lucide-react";
import { ROTAS, navegar } from "../../lib/rotas.js";
import { useI18n } from "../../lib/i18n.jsx";

// Banner fixo não-dispensável mostrado para empresas no caminho "livre"
// enquanto o onboarding não foi concluído. Vendedores e admins nunca veem.
// - onb.atual === null → concluído → banner some (App.jsx não o renderiza)
// - onb.atual presente → mostra "Iniciar" ou "Continuar"

export default function BannerOnboarding({ onb }) {
  const { t } = useI18n();
  if (!onb || onb.concluido) return null;

  const ETAPAS_LABELS = {
    acesso: t("onb.stepAccess"),
    empresa: t("onb.stepCompany"),
    academy: t("onb.stepAcademy"),
    ia: t("onb.stepAI"),
    plano: t("onb.stepPlan"),
    campanha: t("onb.stepCampaign"),
  };

  const jaIniciou = onb.etapas && Object.values(onb.etapas).some((v) => v !== "pendente");
  const etapaLabel = onb.atual ? (ETAPAS_LABELS[onb.atual] || onb.atual) : null;

  const ir = () => navegar(ROTAS.onboarding + (onb.atual ? `/${onb.atual}` : ""));

  return (
    <div
      role="banner"
      aria-label={t("onb.bannerLabel")}
      style={{
        background: "linear-gradient(90deg,var(--brand) 0%,var(--sky-600,#0ea5e9) 100%)",
        color: "#fff",
        padding: "0 16px",
        minHeight: 48,
        borderRadius: 12,
        marginBottom: 16,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,.14)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 500, flexShrink: 1, minWidth: 0 }}>
        <Zap size={16} strokeWidth={2.5} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {jaIniciou
            ? `${t("onb.bannerContinue")}${etapaLabel ? ` · ${etapaLabel}` : ""}`
            : t("onb.bannerSetup")}
        </span>
      </div>
      <button
        type="button"
        onClick={ir}
        style={{
          display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.35)",
          color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          minHeight: 36, minWidth: 44,
        }}
      >
        {jaIniciou ? t("onb.bannerBtnContinue") : t("onb.bannerBtnStart")} <ArrowRight size={13} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}

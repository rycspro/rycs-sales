import { Shield } from "lucide-react";
import { useI18n } from "../lib/i18n.jsx";

const ROTULOS_KEYS = {
  pagamento: "score.cashUpToDate",
  conferencia: "score.reviewsOnTime",
  aprovacao: "score.acceptsActions",
  clareza: "score.clearCampaign",
  retencao: "score.retainsPros",
};

const EXPLICA_KEYS = {
  pagamento: "score.cashUpToDateDesc",
  conferencia: "score.reviewsOnTimeDesc",
  aprovacao: "score.acceptsActionsDesc",
  clareza: "score.clearCampaignDesc",
  retencao: "score.retainsProsDesc",
};

const cor = (n) => (n >= 80 ? "var(--brand)" : n >= 60 ? "var(--indigo)" : n >= 40 ? "var(--amber)" : "var(--red)");
const RATING_KEYS = { 80: "score.excellent", 60: "score.good", 40: "score.regular", 0: "score.attention" };
function ratingKey(n) { return n >= 80 ? RATING_KEYS[80] : n >= 60 ? RATING_KEYS[60] : n >= 40 ? RATING_KEYS[40] : RATING_KEYS[0]; }

// Nota compacta, para a vitrine que o profissional vê antes de se candidatar.
export function CompanyScoreChip({ nota }) {
  if (nota === undefined || nota === null) return null;
  return (
    <span className="vx-badge" style={{ background: "var(--surface-2)", color: cor(nota) }}>
      <Shield size={11} /> {nota}
    </span>
  );
}

// Painel completo, com as dimensões abertas.
export default function CompanyScore({ nota, dimensoes, compacto = false }) {
  const { t } = useI18n();
  const dims = dimensoes || {};
  const temDados = Object.keys(dims).length > 0;

  return (
    <div className="vx-card" style={{ padding: compacto ? 16 : 20 }}>
      <div className="vx-row" style={{ marginBottom: temDados ? 14 : 0 }}>
        <div>
          <div className="vx-eyebrow">{t("score.title")}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 3 }}>
            <span className="vx-disp vx-mono" style={{ fontSize: 30, color: cor(nota) }}>{nota ?? 0}</span>
            <span className="vx-mut" style={{ fontSize: 13 }}>{t(ratingKey(nota ?? 0))}</span>
          </div>
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--surface-2)",
        }}>
          <Shield size={19} color={cor(nota ?? 0)} strokeWidth={2.1} />
        </div>
      </div>

      {temDados && (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {Object.entries(ROTULOS_KEYS).map(([k, labelKey]) => {
            const v = dims[k] ?? 0;
            return (
              <div key={k}>
                <div className="vx-row" style={{ fontSize: 12.5, marginBottom: 5 }}>
                  <span className="vx-mut" title={t(EXPLICA_KEYS[k])}>{t(labelKey)}</span>
                  <b className="vx-mono" style={{ color: cor(v) }}>{v}</b>
                </div>
                <div className="vx-meter-track">
                  <div className="vx-meter-fill" style={{ width: `${v}%`, background: cor(v) }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!compacto && (
        <p className="vx-mut" style={{ fontSize: 11.5, marginTop: 14 }}>
          {t("score.visibilityNote")}
        </p>
      )}
    </div>
  );
}

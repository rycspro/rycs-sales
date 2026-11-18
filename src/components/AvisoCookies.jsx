import { useState } from "react";
import { escolhaCookies, escolherCookies } from "../lib/rastreio.js";
import { useI18n } from "../lib/i18n.jsx";
import { CONSENTIU, RECUSOU } from "../../shared/metaPixel.js";

// Aviso de cookies de marketing (LGPD). Sem o aceite, o pixel da Meta não
// carrega e o cadastro não vai para a API de Conversões. A escolha vale para
// rycs.pro e app.rycs.pro (cookie no domínio .rycs.pro).
export default function AvisoCookies() {
  const { t } = useI18n();
  const [aberto, setAberto] = useState(() => escolhaCookies() === "");
  if (!aberto) return null;

  const escolher = (valor) => { escolherCookies(valor); setAberto(false); };

  return (
    <div role="region" aria-label={t("cookies.rotulo")} style={{
      position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 60, maxWidth: 560, margin: "0 auto",
      background: "var(--surface-solid)", color: "var(--ink)", border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-pop)", padding: "var(--space-4)",
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)",
    }}>
      <p style={{ margin: 0, flex: "1 1 260px", fontSize: 13.5, lineHeight: 1.5, color: "var(--ink-2)" }}>
        {t("cookies.texto")}
      </p>
      <div style={{ display: "flex", gap: "var(--space-2)", flex: "0 0 auto" }}>
        <button type="button" className="vx-btn vx-btn-ghost" style={{ minHeight: 44 }} onClick={() => escolher(RECUSOU)}>{t("cookies.recusar")}</button>
        <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} onClick={() => escolher(CONSENTIU)}>{t("cookies.aceitar")}</button>
      </div>
    </div>
  );
}

import { useI18n, LANG_LABELS } from "../lib/i18n.jsx";
import { Globe } from "lucide-react";

export default function LangSwitcher({ className = "" }) {
  const { lang, setLang, SUPPORTED } = useI18n();

  return (
    <div className={`lang-switcher ${className}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Globe size={16} style={{ opacity: 0.6 }} />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        aria-label="Language"
        style={{
          background: "transparent",
          border: "1px solid var(--border, #ddd)",
          borderRadius: 6,
          padding: "4px 8px",
          fontSize: 13,
          color: "inherit",
          cursor: "pointer",
        }}
      >
        {SUPPORTED.map((code) => (
          <option key={code} value={code}>{LANG_LABELS[code]}</option>
        ))}
      </select>
    </div>
  );
}

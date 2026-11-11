import { useState, useRef, useEffect } from "react";
import { Bell, Check, X } from "lucide-react";
import { api, apiPatch } from "../lib/api.js";
import { dataCurta } from "../lib/utils.js";
import { useI18n } from "../lib/i18n.jsx";

const TIPO_COR = {
  submissao: "var(--brand)",
  candidatura: "var(--indigo)",
  saque: "var(--amber)",
};

export default function Notificacoes({ items = [], onUpdate }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const naoLidas = items.filter((n) => !n.lida).length;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const marcarTodas = async () => {
    await apiPatch("/notifications/read-all");
    onUpdate?.();
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="vx-btn vx-btn-sm vx-btn-ghost" onClick={() => setOpen(!open)} style={{ position: "relative", padding: "7px 8px" }}>
        <Bell size={18} strokeWidth={2.2} />
        {naoLidas > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, padding: "0 4px",
            borderRadius: 999, background: "var(--red)", color: "#fff", fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{naoLidas > 9 ? "9+" : naoLidas}</span>
        )}
      </button>

      {open && (
        <div className="vx-fade" style={{
          position: "absolute", top: "100%", right: 0, marginTop: 6, width: 340,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-pop)", zIndex: 50, overflow: "hidden",
        }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{t("notifications.title")}</span>
            {naoLidas > 0 && (
              <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={marcarTodas} style={{ fontSize: 11, gap: 4 }}>
                <Check size={13} /> {t("notifications.markRead")}
              </button>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {items.length === 0 && (
              <div style={{ padding: 28, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{t("notifications.none")}</div>
            )}
            {items.map((n) => (
              <div key={n.id} style={{
                padding: "10px 14px", borderBottom: "1px solid var(--border)",
                background: n.lida ? "transparent" : "var(--brand-50)",
                cursor: "default",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: 999, marginTop: 5, flexShrink: 0,
                    background: n.lida ? "var(--border)" : (TIPO_COR[n.tipo] || "var(--brand)"),
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>{n.titulo}</div>
                    {n.corpo && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.35 }}>{n.corpo}</div>}
                    <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 3 }}>{dataCurta(n.criadoEm)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

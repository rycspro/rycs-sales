import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export default function MultiSelect({ opcoes = [], valor = [], onChange, placeholder = "Selecione…", disabled, max }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtradas = busca
    ? opcoes.filter((o) => {
        const label = typeof o === "string" ? o : o.label || "";
        return norm(label).includes(norm(busca));
      })
    : opcoes;

  useEffect(() => {
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const toggle = (val) => {
    const sel = Array.isArray(valor) ? valor : [];
    if (sel.includes(val)) {
      onChange(sel.filter((v) => v !== val));
    } else {
      if (max && sel.length >= max) return;
      onChange([...sel, val]);
    }
  };

  const remover = (val) => {
    onChange((Array.isArray(valor) ? valor : []).filter((v) => v !== val));
  };

  const getLabel = (val) => {
    const o = opcoes.find((o) => (typeof o === "string" ? o : o.value) === val);
    return o ? (typeof o === "string" ? o : o.label || o.value) : val;
  };

  const sel = Array.isArray(valor) ? valor : [];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        className="vx-input"
        style={{
          display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center",
          minHeight: 42, cursor: disabled ? "default" : "pointer", padding: "6px 32px 6px 10px",
          opacity: disabled ? 0.5 : 1,
        }}
        onClick={() => { if (!disabled) { setAberto(!aberto); setTimeout(() => inputRef.current?.focus(), 10); } }}
      >
        {sel.length === 0 && !busca && (
          <span style={{ color: "var(--muted-2)", fontSize: 13 }}>{placeholder}</span>
        )}
        {sel.map((v) => (
          <span key={v} style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            background: "rgba(49,140,231,.1)", color: "#318CE7", border: "1px solid rgba(49,140,231,.2)",
            borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 500, lineHeight: 1.4,
          }}>
            {getLabel(v)}
            <button type="button" onClick={(e) => { e.stopPropagation(); remover(v); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "inherit", display: "flex" }}>
              <X size={12} />
            </button>
          </span>
        ))}
        {aberto && (
          <input ref={inputRef} value={busca} onChange={(e) => setBusca(e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", flex: 1, minWidth: 60, fontSize: 13, color: "var(--ink)", padding: 0 }}
            onClick={(e) => e.stopPropagation()} />
        )}
        <ChevronDown size={15} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted-2)", pointerEvents: "none" }} />
      </div>
      {aberto && filtradas.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          background: "var(--surface-solid)", border: "1px solid var(--border-strong)",
          borderRadius: 10, marginTop: 4, maxHeight: 220, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,.12)",
        }}>
          {filtradas.map((o) => {
            const val = typeof o === "string" ? o : o.value;
            const label = typeof o === "string" ? o : o.label || o.value;
            const checked = sel.includes(val);
            return (
              <div key={val} onClick={() => { toggle(val); setBusca(""); }}
                style={{
                  padding: "9px 14px", cursor: "pointer", fontSize: 13,
                  display: "flex", alignItems: "center", gap: 8,
                  background: checked ? "rgba(49,140,231,.06)" : "transparent",
                  color: "var(--ink)",
                }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: checked ? "2px solid #318CE7" : "2px solid var(--border-strong)",
                  background: checked ? "#318CE7" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 11, fontWeight: 700,
                }}>{checked ? "✓" : ""}</span>
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

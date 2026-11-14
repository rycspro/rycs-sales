import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export default function ComboSelect({ opcoes = [], valor, onChange, placeholder = "Selecione…", disabled, name }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  const filtradas = busca
    ? opcoes.filter((o) => {
        const label = typeof o === "string" ? o : o.label || o.nome || "";
        return label.toLowerCase().includes(busca.toLowerCase());
      })
    : opcoes;

  const labelDoValor = (() => {
    if (!valor) return "";
    const item = opcoes.find((o) => (typeof o === "string" ? o : o.value || o.code || o.uf) === valor);
    if (!item) return valor;
    return typeof item === "string" ? item : item.label || item.nome || valor;
  })();

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  useEffect(() => {
    if (aberto && inputRef.current) inputRef.current.focus();
  }, [aberto]);

  const selecionar = (val) => {
    onChange(val);
    setAberto(false);
    setBusca("");
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        disabled={disabled}
        className="vx-input"
        onClick={() => { setAberto(!aberto); setBusca(""); }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: disabled ? "not-allowed" : "pointer", textAlign: "left",
          color: valor ? "var(--ink)" : "var(--muted)", width: "100%",
          opacity: disabled ? 0.5 : 1, minHeight: 42,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {labelDoValor || placeholder}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          {valor && !disabled && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              style={{ padding: 2, cursor: "pointer", color: "var(--muted)", display: "flex" }}
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown size={15} style={{ color: "var(--muted)", transition: ".15s", transform: aberto ? "rotate(180deg)" : "none" }} />
        </div>
      </button>

      {aberto && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 60,
          background: "var(--surface-solid, #fff)", border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-pop)",
          maxHeight: 240, display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
            <input
              ref={inputRef}
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar…"
              style={{
                width: "100%", border: "none", outline: "none", fontSize: 13,
                fontFamily: "inherit", background: "transparent", color: "var(--ink)",
                padding: "5px 4px",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtradas.length === 0 && (
              <div style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
                Nenhum resultado
              </div>
            )}
            {filtradas.map((o, i) => {
              const val = typeof o === "string" ? o : o.value || o.code || o.uf;
              const label = typeof o === "string" ? o : o.label || o.nome || val;
              const ativo = val === valor;
              return (
                <button
                  key={val + i}
                  type="button"
                  onClick={() => selecionar(val)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "8px 14px", border: "none", cursor: "pointer",
                    fontSize: 13, fontFamily: "inherit",
                    background: ativo ? "var(--brand-50)" : "transparent",
                    color: ativo ? "var(--brand)" : "var(--ink)",
                    fontWeight: ativo ? 600 : 400,
                  }}
                  onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.background = "var(--surface-2)"; }}
                  onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.background = "transparent"; }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

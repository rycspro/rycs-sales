import { paisDe, exemploTelefone } from "../../shared/localidades.js";

// Campo de telefone coerente por país: mostra o DDI (+código) do país escolhido
// como prefixo fixo e um exemplo adequado no placeholder. A pessoa digita só o
// número nacional; a validação e a normalização ficam em shared/localidades.js.
export default function CampoTelefone({ pais = "BR", value, onChange, id, placeholder, invalido = false, required = false, ...rest }) {
  const p = paisDe(pais);
  return (
    <div style={{ display: "flex", alignItems: "stretch" }}>
      <span aria-hidden="true" style={{
        display: "inline-flex", alignItems: "center", padding: "0 11px", whiteSpace: "nowrap",
        border: `1px solid ${invalido ? "var(--danger,#DC2626)" : "var(--border-strong)"}`, borderInlineEnd: "none",
        borderStartStartRadius: "var(--radius-sm)", borderEndStartRadius: "var(--radius-sm)",
        background: "var(--surface-2)", color: "var(--muted)", fontSize: 13.5, fontVariantNumeric: "tabular-nums",
      }}>+{p.ddi}</span>
      <input
        id={id} className="vx-input" type="tel" inputMode="tel" autoComplete="tel-national"
        value={value} onChange={onChange} required={required} aria-invalid={invalido || undefined}
        placeholder={placeholder || exemploTelefone(pais)}
        style={{ flex: 1, minWidth: 0, borderStartStartRadius: 0, borderEndStartRadius: 0 }}
        {...rest}
      />
    </div>
  );
}

import { STATUS } from "../lib/constants.js";

export function Selo({ s }) {
  const v = STATUS[s] || STATUS.analisando;
  const Icon = v.Icon;
  return (
    <span className={`vx-badge vx-badge-${v.tone}`}>
      <Icon size={12} strokeWidth={2.5} />{v.txt}
    </span>
  );
}

export function Medidor({ value, tone = "brand" }) {
  const cor = { brand: "var(--brand)", amber: "var(--amber)", red: "var(--red)", indigo: "var(--indigo)", muted: "var(--muted-2)" }[tone] || "var(--brand)";
  return (
    <div className="vx-meter-track">
      <div className="vx-meter-fill" style={{ width: `${Math.max(3, Math.min(100, value))}%`, background: cor }} />
    </div>
  );
}

export function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="vx-label">{label}</label>
      {children}
    </div>
  );
}

export function Vazio({ titulo, texto, acao }) {
  return (
    <div className="vx-card" style={{ padding: 26, textAlign: "center" }}>
      <div className="vx-disp" style={{ fontSize: 18, marginBottom: 6 }}>{titulo}</div>
      <p className="vx-mut" style={{ margin: "0 0 14px", fontSize: 13.5 }}>{texto}</p>
      {acao}
    </div>
  );
}

export function Stat({ label, value, Icon, tone = "brand", mono = true }) {
  const bg = { brand: "var(--brand-100)", amber: "var(--amber-100)", red: "var(--red-100)", indigo: "var(--indigo-100)", muted: "var(--surface-2)" }[tone];
  const fg = { brand: "var(--brand)", amber: "var(--amber)", red: "var(--red)", indigo: "var(--indigo)", muted: "var(--muted)" }[tone];
  return (
    <div className="vx-stat">
      {Icon && <div className="vx-stat-icon" style={{ background: bg }}><Icon size={16} color={fg} strokeWidth={2.3} /></div>}
      <div className="vx-eyebrow" style={{ marginBottom: 3 }}>{label}</div>
      <div className={"vx-stat-val" + (mono ? " vx-mono" : "")}>{value}</div>
    </div>
  );
}

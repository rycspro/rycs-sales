import { ACOES, CAMPOS, STATUS, MOTIVO_COR } from "../lib/constants.js";
import { money, dataCurta } from "../lib/utils.js";
import { Selo, Medidor } from "./ui.jsx";

export default function CardEnvio({ sub, db, extra }) {
  const c = db.companies.find((x) => x.id === sub.companyId);
  const s = db.sellers.find((x) => x.id === sub.sellerId);
  const st = STATUS[sub.status] || STATUS.analisando;
  return (
    <div className="vx-card" style={{ padding: 16 }}>
      <div className="vx-row" style={{ alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{ACOES[sub.tipo].nome}</div>
          <div className="vx-mut" style={{ fontSize: 12 }}>{c?.nome} · {s?.nome} · {dataCurta(sub.criadoEm)}</div>
        </div>
        <div className="vx-disp vx-mono" style={{ fontSize: 17, color: "var(--brand)" }}>{money(sub.valor)}</div>
      </div>

      <div className="vx-row" style={{ margin: "12px 0 6px" }}>
        <Selo s={sub.status} />
        {typeof sub.confianca === "number" && (
          <span className="vx-mut vx-mono" style={{ fontSize: 11.5 }}>
            {sub.confianca}% · {sub.fonte === "ia" ? "análise por IA" : "checagem local"}
          </span>
        )}
      </div>
      {typeof sub.confianca === "number" && (
        <div style={{ marginBottom: 10 }}>
          <Medidor value={sub.confianca} tone={st.tone === "red" ? "red" : st.tone === "amber" ? "amber" : st.tone === "indigo" ? "indigo" : "brand"} />
        </div>
      )}

      {sub.status === "analisando" && (
        <div className="vx-mut vx-mono" style={{ fontSize: 12, marginBottom: 8 }}>A IA está cruzando os dados enviados…</div>
      )}
      {sub.motivo && (
        <div style={{ fontSize: 12.5, color: MOTIVO_COR[sub.status] || "var(--muted)", marginBottom: 10 }}>{sub.motivo}</div>
      )}

      <div className="vx-mono" style={{ fontSize: 12, color: "var(--ink-2)", background: "var(--surface-2)", padding: 11, borderRadius: 10 }}>
        {ACOES[sub.tipo].prova.map((k) => (
          <div key={k} className="vx-row" style={{ padding: "2px 0", gap: 10 }}>
            <span className="vx-mut">{CAMPOS[k].label}</span>
            <b style={{ textAlign: "right", wordBreak: "break-all" }}>{sub.prova[k]}</b>
          </div>
        ))}
      </div>
      {extra}
    </div>
  );
}

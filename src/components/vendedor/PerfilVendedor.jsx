import { useMemo } from "react";

export default function PerfilVendedor({ eu, db, up, setDb, aviso }) {
  const stats = useMemo(() => {
    const meus = db.submissions.filter((s) => s.sellerId === eu.id);
    const lib = meus.filter((s) => s.status === "liberado");
    const rec = meus.filter((s) => s.status === "recusado");
    const taxa = meus.length ? Math.round((lib.length / meus.length) * 100) : 0;
    return { total: meus.length, lib: lib.length, rec: rec.length, taxa };
  }, [db, eu]);

  return (
    <div className="vx-fade">
      <div className="vx-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: "var(--brand)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 17,
          }}>{eu.nome.slice(0, 1)}</div>
          <div>
            <div className="vx-disp" style={{ fontSize: 19 }}>{eu.nome}</div>
            <div className="vx-mut" style={{ fontSize: 13 }}>
              {eu.perfil === "sdr" ? "SDR" : eu.perfil === "closer" ? "Closer" : "Iniciante"} · {eu.cidade || "—"}
            </div>
          </div>
        </div>
        <hr className="vx-sep" />
        <div className="vx-grid vx-g4">
          {[["Ações enviadas", stats.total], ["Aprovadas", stats.lib], ["Recusadas", stats.rec], ["Aprovação", stats.taxa + "%"]].map(([k, v]) => (
            <div key={k}>
              <div className="vx-eyebrow" style={{ marginBottom: 4 }}>{k}</div>
              <div className="vx-disp vx-mono" style={{ fontSize: 21 }}>{v}</div>
            </div>
          ))}
        </div>
        <hr className="vx-sep" />
        <div className="vx-mut" style={{ fontSize: 12 }}>
          Taxa de aprovação abaixo de 60% em 20 ações tira você do topo da fila das empresas.
        </div>
      </div>

    </div>
  );
}

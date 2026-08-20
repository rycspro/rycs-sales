import { apiPatch } from "../../lib/api.js";

export default function TimeEmpresa({ emp, db, up, aviso }) {
  const pend = db.sellers.filter((s) => s.aplicacoes?.[emp.id] === "pendente");
  const time = db.sellers.filter((s) => s.aplicacoes?.[emp.id] === "aprovado");
  const decidir = (s, st) => {
    apiPatch("/applications", { sellerId: s.id, companyId: emp.id, status: st });
    up((d) => ({ sellers: d.sellers.map((x) => x.id === s.id ? { ...x, aplicacoes: { ...x.aplicacoes, [emp.id]: st } } : x) }));
    aviso(st === "aprovado" ? `${s.nome} entrou no seu time.` : "Candidatura recusada.");
  };
  const perfLabel = (p) => (p === "sdr" ? "SDR" : p === "closer" ? "Closer" : "Iniciante");

  return (
    <>
      <h3 className="vx-disp" style={{ fontSize: 16, marginBottom: 10 }}>Querem vender para você</h3>
      {!pend.length && <p className="vx-mut" style={{ fontSize: 13 }}>Nenhuma solicitação aberta no momento.</p>}
      <div className="vx-grid" style={{ marginBottom: 22 }}>
        {pend.map((s) => (
          <div key={s.id} className="vx-card" style={{ padding: 16 }}>
            <div className="vx-row">
              <div>
                <b>{s.nome}</b>
                <div className="vx-mut" style={{ fontSize: 12 }}>{perfLabel(s.perfil)} · {s.cidade} · nota {s.nota}/100</div>
                <div className="vx-mut" style={{ fontSize: 12 }}>{s.experiencia}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="vx-btn vx-btn-primary vx-btn-sm" style={{ flex: 1 }} onClick={() => decidir(s, "aprovado")}>Aprovar</button>
              <button className="vx-btn vx-btn-danger vx-btn-sm" onClick={() => decidir(s, "recusado")}>Recusar</button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="vx-disp" style={{ fontSize: 16, marginBottom: 10 }}>Seu time ({time.length})</h3>
      <div className="vx-grid">
        {time.map((s) => {
          const subs = db.submissions.filter((x) => x.sellerId === s.id && x.companyId === emp.id);
          const lib = subs.filter((x) => x.status === "liberado").length;
          return (
            <div key={s.id} className="vx-card vx-row" style={{ padding: 15 }}>
              <div>
                <b style={{ fontSize: 13.5 }}>{s.nome}</b>
                <div className="vx-mut" style={{ fontSize: 12 }}>{perfLabel(s.perfil)} · {subs.length} ações enviadas · {lib} aprovadas</div>
              </div>
              <button className="vx-btn vx-btn-sm vx-btn-danger" onClick={() => decidir(s, "recusado")}>Remover</button>
            </div>
          );
        })}
        {!time.length && <p className="vx-mut" style={{ fontSize: 13 }}>Aprove candidatos para montar seu time.</p>}
      </div>
    </>
  );
}

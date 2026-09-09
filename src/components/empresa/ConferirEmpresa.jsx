import { useState } from "react";
import { apiPatch } from "../../lib/api.js";
import CardEnvio from "../CardEnvio.jsx";

export default function ConferirEmpresa({ emp, db, setDb, aviso }) {
  const [motivo, setMotivo] = useState({});
  const revisao = db.submissions.filter((s) => s.companyId === emp.id && s.status === "revisao");
  const iaAprovados = db.submissions.filter((s) => s.companyId === emp.id && s.status === "ia_aprovado");

  const confirmar = async (sub) => {
    const r = await apiPatch(`/submissions/${sub.id}`, { status: "conferido", motivo: "Confirmado manualmente pela empresa." });
    if (!r || r.error) return aviso(r?.error || "Não foi possível confirmar.");
    setDb((d) => ({ ...d, submissions: d.submissions.map((s) => s.id === sub.id ? { ...s, status: "conferido", motivo: "Confirmado manualmente pela empresa." } : s) }));
    aviso("Confirmado. A plataforma libera o pagamento.");
  };
  const recusar = async (sub) => {
    const m = (motivo[sub.id] || "").trim();
    if (!m) return aviso("Escreva o motivo da recusa. O vendedor precisa saber o que corrigir.");
    const r = await apiPatch(`/submissions/${sub.id}`, { status: "recusado", motivo: m });
    if (!r || r.error) return aviso(r?.error || "Não foi possível recusar.");
    setDb((d) => ({ ...d, submissions: d.submissions.map((s) => s.id === sub.id ? { ...s, status: "recusado", motivo: m } : s) }));
    aviso("Ação recusada.");
  };
  const contestar = async (sub) => {
    const r = await apiPatch(`/submissions/${sub.id}`, { status: "revisao", motivo: "Empresa sinalizou dúvida sobre a aprovação automática." });
    if (!r || r.error) return aviso(r?.error || "Não foi possível enviar para revisão.");
    setDb((d) => ({ ...d, submissions: d.submissions.map((s) => s.id === sub.id ? { ...s, status: "revisao", motivo: "Empresa sinalizou dúvida sobre a aprovação automática." } : s) }));
    aviso("Enviado para revisão manual.");
  };

  return (
    <>
      <p className="vx-mut" style={{ fontSize: 13, marginTop: 0 }}>
        A IA analisa toda ação assim que o vendedor envia. Só chega aqui quem ela sinalizou como dúvida —
        o resto segue direto para a liberação da plataforma, mas você pode sinalizar qualquer aprovação abaixo.
      </p>

      <h3 className="vx-disp" style={{ fontSize: 16, margin: "18px 0 10px" }}>
        Revisão manual {revisao.length > 0 && <span className="vx-chip vx-mono" style={{ marginLeft: 6 }}>{revisao.length}</span>}
      </h3>
      {!revisao.length
        ? <p className="vx-mut" style={{ fontSize: 13, marginBottom: 20 }}>Nada pendente de revisão humana no momento.</p>
        : <div className="vx-grid" style={{ marginBottom: 24 }}>
            {revisao.map((sub) => (
              <CardEnvio key={sub.id} sub={sub} db={db} extra={
                <div style={{ marginTop: 12 }}>
                  <input className="vx-input" style={{ marginBottom: 8, fontSize: 13 }} placeholder="Motivo, se for recusar"
                    value={motivo[sub.id] || ""} onChange={(e) => setMotivo({ ...motivo, [sub.id]: e.target.value })} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="vx-btn vx-btn-primary vx-btn-sm" style={{ flex: 1 }} onClick={() => confirmar(sub)}>Confirmei com o cliente</button>
                    <button className="vx-btn vx-btn-danger vx-btn-sm" onClick={() => recusar(sub)}>Recusar</button>
                  </div>
                </div>
              } />
            ))}
          </div>}

      <h3 className="vx-disp" style={{ fontSize: 16, margin: "0 0 10px" }}>
        Aprovados automaticamente pela IA {iaAprovados.length > 0 && <span className="vx-chip vx-mono" style={{ marginLeft: 6 }}>{iaAprovados.length}</span>}
      </h3>
      {!iaAprovados.length
        ? <p className="vx-mut" style={{ fontSize: 13 }}>Nenhum nas últimas horas.</p>
        : <div className="vx-grid">
            {iaAprovados.map((sub) => (
              <CardEnvio key={sub.id} sub={sub} db={db} extra={
                <button className="vx-btn vx-btn-sm vx-btn-block" style={{ marginTop: 10 }} onClick={() => contestar(sub)}>
                  Algo errado — mandar para revisão
                </button>
              } />
            ))}
          </div>}
    </>
  );
}

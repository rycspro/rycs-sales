import { useState } from "react";
import { apiPatch } from "../../lib/api.js";
import CardEnvio from "../CardEnvio.jsx";
import RegrasAprovacao from "./RegrasAprovacao.jsx";
import TrilhaAuditoria from "./TrilhaAuditoria.jsx";

export default function ConferirEmpresa({ emp, db, setDb, aviso }) {
  const [motivo, setMotivo] = useState({});
  const [secao, setSecao] = useState("fila");
  const [trilha, setTrilha] = useState(null);
  const revisao = db.submissions.filter((s) => s.companyId === emp.id && s.status === "revisao");
  // "conferido" entra aqui porque é onde a regra automática deposita a ação:
  // a empresa precisa poder discordar antes de a plataforma repassar.
  const iaAprovados = db.submissions.filter((s) => s.companyId === emp.id && ["ia_aprovado", "conferido"].includes(s.status));

  const botaoTrilha = (sub) => (
    <button className="vx-btn vx-btn-sm vx-btn-ghost" style={{ marginTop: 8 }}
      onClick={() => setTrilha(trilha === sub.id ? null : sub.id)}>
      {trilha === sub.id ? "Ocultar sinais de auditoria" : "Ver sinais de auditoria"}
    </button>
  );

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
      <div className="vx-page-head"><div><div className="vx-eyebrow">Governança de evidências</div><h1 className="vx-disp">Aprovações</h1><p>Revisão manual, recusas, contestações e decisões rastreáveis.</p></div><span className="vx-chip vx-mono">{revisao.length} pendentes</span></div>
      <p className="vx-mut" style={{ fontSize: 13, marginTop: 0 }}>
        A triagem automática verifica consistência e confiança. Evidência manual permanece sujeita a revisão humana e a liberação financeira continua restrita à plataforma.
      </p>

      <div className="vx-seg vx-subnav" style={{ margin: "14px 0 4px" }}>
        {[["fila", "Fila de revisão"], ["regras", "Regras automáticas"]].map(([k, label]) => (
          <button key={k} data-on={secao === k ? "1" : "0"} onClick={() => setSecao(k)}>{label}</button>
        ))}
      </div>

      {secao === "regras" && <RegrasAprovacao aviso={aviso} />}
      {secao === "fila" && <>

      <h3 className="vx-disp" style={{ fontSize: 16, margin: "18px 0 10px" }}>
        Revisão manual {revisao.length > 0 && <span className="vx-chip vx-mono" style={{ marginLeft: 6 }}>{revisao.length}</span>}
      </h3>
      {!revisao.length
        ? <p className="vx-mut" style={{ fontSize: 13, marginBottom: 20 }}>Nada pendente de revisão humana no momento.</p>
        : <div className="vx-grid" style={{ marginBottom: 24 }}>
            {revisao.map((sub) => (
              <CardEnvio key={sub.id} sub={sub} db={db} extra={
                <div style={{ marginTop: 12 }}>
                  {/* Sinais de auditoria aparecem abertos por padrão na fila de revisão */}
                  <TrilhaAuditoria submissionId={sub.id} />
                  <input className="vx-input" style={{ marginTop: 12, marginBottom: 8, fontSize: 13 }} placeholder="Motivo, se for recusar"
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
        Decisões automáticas históricas {iaAprovados.length > 0 && <span className="vx-chip vx-mono" style={{ marginLeft: 6 }}>{iaAprovados.length}</span>}
      </h3>
      {!iaAprovados.length
        ? <p className="vx-mut" style={{ fontSize: 13 }}>Nenhum nas últimas horas.</p>
        : <div className="vx-grid">
            {iaAprovados.map((sub) => (
              <CardEnvio key={sub.id} sub={sub} db={db} extra={
                <>
                  <button className="vx-btn vx-btn-sm vx-btn-block" style={{ marginTop: 10 }} onClick={() => contestar(sub)}>
                    Algo errado — mandar para revisão
                  </button>
                  {botaoTrilha(sub)}
                  {trilha === sub.id && <TrilhaAuditoria submissionId={sub.id} />}
                </>
              } />
            ))}
          </div>}
      </>}
    </>
  );
}

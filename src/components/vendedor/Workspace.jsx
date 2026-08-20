import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { money } from "../../lib/utils.js";
import { TAXA } from "../../lib/constants.js";
import { apiPatch } from "../../lib/api.js";
import Curso from "./Curso.jsx";
import Tarefas from "./Tarefas.jsx";
import MeusEnvios from "./MeusEnvios.jsx";
import Chat from "../Chat.jsx";

function pedirRevisaoHumana(setDb, aviso, sub) {
  const liquido = +(sub.valor * (1 - TAXA)).toFixed(2);
  const motivo = "Vendedor contestou e pediu revisão humana. Motivo original da IA: " + (sub.motivo || "—");
  apiPatch(`/submissions/${sub.id}`, { status: "revisao", motivo });
  setDb((d) => {
    const seller = d.sellers.find((s) => s.id === sub.sellerId);
    if (seller) apiPatch(`/sellers/${seller.id}`, { pendente: +(seller.pendente + liquido).toFixed(2) });
    return {
      ...d,
      submissions: d.submissions.map((s) => s.id === sub.id ? { ...s, status: "revisao", motivo } : s),
      sellers: d.sellers.map((s) => s.id === sub.sellerId ? { ...s, pendente: +(s.pendente + liquido).toFixed(2) } : s),
    };
  });
  aviso("Enviado para conferência humana da empresa.");
}

export default function Workspace({ empresa, eu, db, setDb, up, aviso, voltar }) {
  const [aba, setAba] = useState("tarefas");
  const feitos = eu.curso?.[empresa.id];
  const todosFeitos = feitos === "todos" || (Array.isArray(feitos) && feitos.length === empresa.curso.length);

  return (
    <div className="vx-fade">
      <button className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginBottom: 12, marginLeft: -8 }} onClick={voltar}>
        <ArrowLeft size={14} /> Empresas
      </button>
      <div className="vx-row" style={{ marginBottom: 4 }}>
        <h2 className="vx-disp" style={{ fontSize: 23, margin: 0 }}>{empresa.nome}</h2>
        <span className="vx-chip vx-mono">caixa {money(empresa.saldo)}</span>
      </div>
      <p className="vx-mut" style={{ marginTop: 0, fontSize: 13 }}>{empresa.produto}</p>

      <div className="vx-tabs" style={{ margin: "16px 0 18px" }}>
        {[["tarefas", "Tarefas"], ["curso", "Curso"], ["envios", "Meus envios"], ["chat", "Chat"]].map(([k, t]) => (
          <button key={k} className="vx-tab" data-on={aba === k ? "1" : "0"} onClick={() => setAba(k)}>{t}</button>
        ))}
      </div>

      {aba === "curso" && <Curso empresa={empresa} eu={eu} up={up} aviso={aviso} />}
      {aba === "tarefas" && <Tarefas empresa={empresa} eu={eu} db={db} setDb={setDb} aviso={aviso} liberado={todosFeitos} irCurso={() => setAba("curso")} />}
      {aba === "envios" && <MeusEnvios empresa={empresa} eu={eu} db={db} pedirRevisao={(sub) => pedirRevisaoHumana(setDb, aviso, sub)} />}
      {aba === "chat" && <Chat empresa={empresa} sellerId={eu.id} db={db} up={up} de="vendedor" />}
    </div>
  );
}

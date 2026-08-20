import { Vazio } from "../ui.jsx";
import CardEnvio from "../CardEnvio.jsx";

export default function MeusEnvios({ empresa, eu, db, pedirRevisao }) {
  const lista = db.submissions.filter((s) => s.sellerId === eu.id && (!empresa || s.companyId === empresa.id));
  if (!lista.length)
    return <Vazio titulo="Nada enviado ainda" texto="Registre uma ação na aba Tarefas. Ela aparece aqui com o andamento da análise." />;
  return (
    <div className="vx-grid">
      {lista.map((s) => (
        <CardEnvio key={s.id} sub={s} db={db} extra={
          s.status === "ia_recusado" && pedirRevisao ? (
            <button className="vx-btn vx-btn-sm vx-btn-block" style={{ marginTop: 10 }} onClick={() => pedirRevisao(s)}>
              Pedir revisão humana
            </button>
          ) : null
        } />
      ))}
    </div>
  );
}

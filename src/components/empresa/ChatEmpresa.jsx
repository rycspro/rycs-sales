import { useState } from "react";
import { Vazio } from "../ui.jsx";
import Chat from "../Chat.jsx";

export default function ChatEmpresa({ emp, db, up }) {
  const time = db.sellers.filter((s) => s.aplicacoes?.[emp.id] === "aprovado");
  const [sel, setSel] = useState(time[0]?.id || null);
  if (!time.length) return <Vazio titulo="Sem conversas" texto="O chat abre quando você aprova um vendedor na aba Time." />;
  return (
    <>
      <div className="vx-tabs" style={{ marginBottom: 14 }}>
        {time.map((s) => (
          <button key={s.id} className="vx-tab" data-on={sel === s.id ? "1" : "0"} onClick={() => setSel(s.id)}>{s.nome}</button>
        ))}
      </div>
      {sel && <Chat empresa={emp} sellerId={sel} db={db} up={up} de="empresa" />}
    </>
  );
}

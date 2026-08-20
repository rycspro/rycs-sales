import { money } from "../../lib/utils.js";
import PainelEmpresa from "./PainelEmpresa.jsx";
import ConferirEmpresa from "./ConferirEmpresa.jsx";
import TimeEmpresa from "./TimeEmpresa.jsx";
import TabelaEmpresa from "./TabelaEmpresa.jsx";
import ChatEmpresa from "./ChatEmpresa.jsx";

export default function Empresa({ db, setDb, up, aviso, aba }) {
  const emp = db.companies.find((c) => c.id === db.companyId) || db.companies[0];
  if (!emp) return null;

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <select className="vx-input vx-disp" style={{ width: "auto", fontSize: 16, padding: "8px 12px" }}
          value={emp.id} onChange={(e) => up(() => ({ companyId: e.target.value }))}>
          {db.companies.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <span className="vx-chip vx-mono">caixa {money(emp.saldo)}</span>
      </div>

      {aba === "painel" && <PainelEmpresa emp={emp} db={db} up={up} aviso={aviso} />}
      {aba === "conferir" && <ConferirEmpresa emp={emp} db={db} setDb={setDb} aviso={aviso} />}
      {aba === "time" && <TimeEmpresa emp={emp} db={db} up={up} aviso={aviso} />}
      {aba === "tabela" && <TabelaEmpresa emp={emp} up={up} aviso={aviso} />}
      {aba === "chat" && <ChatEmpresa emp={emp} db={db} up={up} />}
    </div>
  );
}

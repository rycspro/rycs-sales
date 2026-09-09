import { money } from "../../lib/utils.js";
import PainelEmpresa from "./PainelEmpresa.jsx";
import ConferirEmpresa from "./ConferirEmpresa.jsx";
import TimeEmpresa from "./TimeEmpresa.jsx";
import TabelaEmpresa from "./TabelaEmpresa.jsx";
import ChatEmpresa from "./ChatEmpresa.jsx";
import PlanosEmpresa from "./PlanosEmpresa.jsx";
import Indicacoes from "../Indicacoes.jsx";
import QualificacaoEmpresa from "./QualificacaoEmpresa.jsx";
import CadastroEmpresa from "./CadastroEmpresa.jsx";
import CampanhasEmpresa from "./CampanhasEmpresa.jsx";
import LeadsEmpresa from "./LeadsEmpresa.jsx";

export default function Empresa({ db, setDb, up, aviso, aba, recarregar }) {
  const emp = db.companies.find((c) => c.id === db.companyId) || db.companies[0];
  if (!emp) return null;

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        {/* Era um seletor para alternar entre empresas, do tempo em que não
            havia login. Cada conta enxerga só a própria empresa. */}
        <h1 className="vx-disp" style={{ fontSize: 20, margin: 0 }}>{emp.nome}</h1>
        <span className="vx-chip vx-mono">disponível {money(Math.max(0, Number(emp.saldo || 0) - Number(emp.saldoReservado || 0)))}</span>
        {Number(emp.saldoReservado || 0) > 0 && <span className="vx-chip vx-mono">reservado {money(emp.saldoReservado)}</span>}
      </div>

      {aba === "painel" && <PainelEmpresa emp={emp} db={db} up={up} aviso={aviso} />}
      {aba === "cadastro" && <CadastroEmpresa emp={emp} up={up} aviso={aviso} />}
      {aba === "campanhas" && <CampanhasEmpresa emp={emp} db={db} up={up} aviso={aviso} />}
      {aba === "leads" && <LeadsEmpresa emp={emp} db={db} />}
      {aba === "conferir" && <ConferirEmpresa emp={emp} db={db} setDb={setDb} aviso={aviso} />}
      {aba === "time" && <TimeEmpresa emp={emp} db={db} up={up} aviso={aviso} />}
      {aba === "qualificacao" && <QualificacaoEmpresa emp={emp} up={up} aviso={aviso} />}
      {aba === "tabela" && <TabelaEmpresa emp={emp} up={up} aviso={aviso} />}
      {aba === "chat" && <ChatEmpresa emp={emp} db={db} up={up} />}
      {aba === "indicar" && <Indicacoes aviso={aviso} />}
      {aba === "planos" && <PlanosEmpresa aviso={aviso} recarregar={recarregar} />}
    </div>
  );
}

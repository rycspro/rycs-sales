import { useState } from "react";
import { api } from "../../lib/api.js";
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
import { AssistenteEmpresa, BaseConhecimento, RelatoriosEmpresa } from "./EmpresaAI.jsx";

export default function Empresa({ db, setDb, up, aviso, aba, recarregar }) {
  const [secaoCampanhas, setSecaoCampanhas] = useState("campanhas");
  const [secaoConta, setSecaoConta] = useState("cadastro");
  const emp = db.companies.find((c) => c.id === db.companyId) || db.companies[0];
  if (!emp) return null;

  const submenu = (itens, ativo, selecionar) => <div className="vx-seg vx-subnav" style={{ marginBottom: 18 }}>
    {itens.map(([key, label]) => <button key={key} data-on={ativo === key ? "1" : "0"} onClick={() => selecionar(key)}>{label}</button>)}
  </div>;

  const sair = async () => {
    await api("/auth/logout", {});
    window.location.reload();
  };

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
      {aba === "campanhas" && <>
        {submenu([["campanhas", "Campanhas"], ["leads", "Leads"], ["time", "Time"], ["tabela", "Tarefas e valores"]], secaoCampanhas, setSecaoCampanhas)}
        {secaoCampanhas === "campanhas" && <CampanhasEmpresa emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar} />}
        {secaoCampanhas === "leads" && <LeadsEmpresa emp={emp} db={db} />}
        {secaoCampanhas === "time" && <TimeEmpresa emp={emp} db={db} up={up} aviso={aviso} />}
        {secaoCampanhas === "tabela" && <TabelaEmpresa emp={emp} up={up} aviso={aviso} />}
      </>}
      {aba === "academy" && <>
        {submenu([["qualificacao", `Academy ${emp.nome}`]], "qualificacao", () => {})}
        <QualificacaoEmpresa emp={emp} up={up} aviso={aviso} />
      </>}
      {aba === "conferir" && <ConferirEmpresa emp={emp} db={db} setDb={setDb} aviso={aviso} />}
      {aba === "conta" && <>
        {submenu([["cadastro", "Configurações"], ["base", "Base de conhecimento"], ["financeiro", "Financeiro"], ["relatorios", "Relatórios"], ["planos", "Plano"], ["notificacoes", "Notificações"], ["suporte", "Suporte"], ["indicar", "Indicar"], ["sair", "Sair"]], secaoConta, (key) => key === "sair" ? sair() : setSecaoConta(key))}
        {secaoConta === "cadastro" && <CadastroEmpresa emp={emp} up={up} aviso={aviso} />}
        {secaoConta === "base" && <BaseConhecimento emp={emp} db={db} aviso={aviso} />}
        {secaoConta === "financeiro" && <PainelEmpresa emp={emp} db={db} up={up} aviso={aviso} />}
        {secaoConta === "relatorios" && <RelatoriosEmpresa emp={emp} db={db} />}
        {secaoConta === "planos" && <PlanosEmpresa aviso={aviso} recarregar={recarregar} />}
        {secaoConta === "notificacoes" && <div className="vx-card" style={{ padding: 18 }}><div className="vx-disp" style={{ fontSize: 17 }}>Notificações</div><p className="vx-mut" style={{ fontSize: 13 }}>As notificações continuam disponíveis no sino do cabeçalho.</p></div>}
        {secaoConta === "suporte" && <ChatEmpresa emp={emp} db={db} up={up} />}
        {secaoConta === "indicar" && <Indicacoes aviso={aviso} />}
      </>}
      <AssistenteEmpresa emp={emp} contexto={aba} aviso={aviso} />
    </div>
  );
}

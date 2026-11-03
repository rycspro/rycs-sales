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
import FinanceiroEmpresa from "./FinanceiroEmpresa.jsx";
import NotificacoesEmpresa from "./NotificacoesEmpresa.jsx";
import ProfissionaisEmpresa from "./ProfissionaisEmpresa.jsx";
import RycsAcademyEmpresa from "./RycsAcademyEmpresa.jsx";
import { AssistenteEmpresa, BaseConhecimento, RelatoriosEmpresa } from "./EmpresaAI.jsx";
import Assinatura from "./Assinatura.jsx";
import AcademyEmpresaHub from "./AcademyEmpresaHub.jsx";
import BannerCerebro from "./BannerCerebro.jsx";

export default function Empresa({ db, setDb, up, aviso, aba, setAba, recarregar, acesso: acessoProp, consultarAcesso: consultarAcessoProp }) {
  const sair = async () => {
    await api("/auth/logout", {});
    window.location.reload();
  };

  const [secaoCampanhas, setSecaoCampanhas] = useState("campanhas");
  const [secaoConta, setSecaoConta] = useState("cadastro");
  const [secaoAcademy, setSecaoAcademy] = useState("rycs");
  const [camposAcademyPendentes, setCamposAcademyPendentes] = useState([]);
  const emp = db.companies.find((c) => c.id === db.companyId) || db.companies[0];

  // Portão de acesso: prefetched no App.jsx em paralelo com onboarding.
  const acesso = acessoProp === undefined ? null : acessoProp;
  const consultarAcesso = consultarAcessoProp || (() => api("/subscription/access"));

  if (!emp) return null;

  if (acesso === null) return (
    <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}>
      <div className="vx-spinner" />
    </div>
  );

  if (!acesso.liberado) {
    return (
      <div className="vx-fade">
        <div className="vx-row" style={{ marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <h1 className="vx-disp" style={{ fontSize: 20, margin: 0 }}>{emp.nome}</h1>
          <button className="vx-btn vx-btn-sm" onClick={sair}>Sair</button>
        </div>
        <Assinatura emp={emp} acesso={acesso} aviso={aviso}
          aoAtivar={async () => { await consultarAcesso(); await recarregar?.(); }} />
      </div>
    );
  }

  const submenu = (itens, ativo, selecionar) => <div className="vx-seg vx-subnav" style={{ marginBottom: 18 }}>
    {itens.map(([key, label]) => <button key={key} data-on={ativo === key ? "1" : "0"} onClick={() => selecionar(key)}>{label}</button>)}
  </div>;


  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        {/* Era um seletor para alternar entre empresas, do tempo em que não
            havia login. Cada conta enxerga só a própria empresa. */}
        <h1 className="vx-disp" style={{ fontSize: 20, margin: 0 }}>{emp.nome}</h1>
        <span className="vx-chip vx-mono">disponível {money(Math.max(0, Number(emp.saldo || 0) - Number(emp.saldoReservado || 0)))}</span>
        {Number(emp.saldoReservado || 0) > 0 && <span className="vx-chip vx-mono">reservado {money(emp.saldoReservado)}</span>}
      </div>

      {aba === "painel" && <>
        <BannerCerebro onIr={() => { setSecaoAcademy("empresa"); setAba?.("academy"); }} />
        <PainelEmpresa emp={emp} db={db} up={up} aviso={aviso} irParaCampanhas={() => { setSecaoCampanhas("campanhas"); setAba?.("campanhas"); }} />
      </>}
      {aba === "campanhas" && <>
        {submenu([["campanhas", "Campanhas"], ["time", "Time"], ["leads", "Leads"], ["tabela", "Tarefas e valores"]], secaoCampanhas, setSecaoCampanhas)}
        {secaoCampanhas === "campanhas" && <CampanhasEmpresa emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar} />}
        {secaoCampanhas === "leads" && <LeadsEmpresa emp={emp} db={db} aviso={aviso} />}
        {secaoCampanhas === "time" && <TimeEmpresa emp={emp} db={db} up={up} aviso={aviso} />}
        {secaoCampanhas === "tabela" && <TabelaEmpresa emp={emp} db={db} up={up} aviso={aviso} />}
      </>}
      {aba === "profissionais" && <ProfissionaisEmpresa emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar} />}
      {aba === "academy" && <>
        {submenu([["rycs", "Cursos da RYCS"], ["empresa", "Ensinar a RYCS"], ["qualificacao", "Dados da Operação"]], secaoAcademy, setSecaoAcademy)}
        {secaoAcademy === "rycs" && <RycsAcademyEmpresa />}
        {secaoAcademy === "empresa" && <AcademyEmpresaHub emp={emp} aviso={aviso} />}
        {secaoAcademy === "qualificacao" && <QualificacaoEmpresa emp={emp} up={up} aviso={aviso} completarInformacoes={(pendencias) => { setCamposAcademyPendentes(pendencias.map((p) => p.campo)); setSecaoConta("cadastro"); setAba?.("conta"); }} />}
      </>}
      {aba === "conferir" && <ConferirEmpresa emp={emp} db={db} setDb={setDb} aviso={aviso} />}
      {aba === "conta" && <>
        {submenu([["cadastro", "Configurações"], ["base", "Cérebro da Operação"], ["financeiro", "Financeiro"], ["relatorios", "Relatórios"], ["planos", "Plano"], ["notificacoes", "Notificações"], ["suporte", "Suporte"], ["indicar", "Indicar"], ["sair", "Sair"]], secaoConta, (key) => key === "sair" ? sair() : setSecaoConta(key))}
        {secaoConta === "cadastro" && <CadastroEmpresa emp={emp} up={up} aviso={aviso} camposDestacados={camposAcademyPendentes} />}
        {secaoConta === "base" && <BaseConhecimento emp={emp} db={db} aviso={aviso} />}
        {secaoConta === "financeiro" && <FinanceiroEmpresa emp={emp} db={db} aviso={aviso} />}
        {secaoConta === "relatorios" && <RelatoriosEmpresa emp={emp} db={db} />}
        {secaoConta === "planos" && <PlanosEmpresa aviso={aviso} recarregar={recarregar} />}
        {secaoConta === "notificacoes" && <NotificacoesEmpresa aviso={aviso} />}
        {secaoConta === "suporte" && <ChatEmpresa emp={emp} db={db} up={up} />}
        {secaoConta === "indicar" && <Indicacoes aviso={aviso} />}
      </>}
    </div>
  );
}

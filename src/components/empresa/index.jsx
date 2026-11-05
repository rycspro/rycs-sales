import { useState } from "react";
import { api } from "../../lib/api.js";
import FiltroData from "../FiltroData.jsx";
import PainelEmpresa from "./PainelEmpresa.jsx";
import ConferirEmpresa from "./ConferirEmpresa.jsx";
import TimeEmpresa from "./TimeEmpresa.jsx";
import QualificacaoEmpresa from "./QualificacaoEmpresa.jsx";
import CampanhasHub from "./CampanhasHub.jsx";
import FinanceiroEmpresa from "./FinanceiroEmpresa.jsx";
import ProfissionaisEmpresa from "./ProfissionaisEmpresa.jsx";
import ConversasEmpresa from "./ConversasEmpresa.jsx";
import RycsAcademyEmpresa from "./RycsAcademyEmpresa.jsx";
import Assinatura from "./Assinatura.jsx";
import AcademyEmpresaHub from "./AcademyEmpresaHub.jsx";
import BannerCerebro from "./BannerCerebro.jsx";
import InicioEmpresa from "./InicioEmpresa.jsx";
import ConfiguracoesEmpresa from "./ConfiguracoesEmpresa.jsx";
import LeadsDashEmpresa from "./LeadsDashEmpresa.jsx";

const CAMPOS_SORT = {
  inicio:    [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }],
  painel:    [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }],
  campanhas: [{ key: "criadoEm", label: "Data" }, { key: "titulo", label: "Nome" }, { key: "valor", label: "Valor" }],
  leads:     [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }, { key: "statusCliente", label: "Status" }],
  conferir:  [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }, { key: "status", label: "Aprovação" }],
};
const ABAS_COM_FILTRO = new Set(["inicio", "painel", "campanhas", "leads", "conferir"]);

export default function Empresa({ db, setDb, up, aviso, aba, setAba, recarregar, acesso: acessoProp, consultarAcesso: consultarAcessoProp }) {
  const sair = async () => {
    await api("/auth/logout", {});
    window.location.reload();
  };

  const [secaoCampanhas, setSecaoCampanhas] = useState("campanhas");
  const [secaoInsights, setSecaoInsights] = useState("painel");
  const [secaoAcademy, setSecaoAcademy] = useState("rycs");
  const [secaoConferir, setSecaoConferir] = useState("fila");
  const [filtros, setFiltros] = useState({});

  const emp = db.companies.find((c) => c.id === db.companyId) || db.companies[0];
  const filtroAtual = filtros[aba] || null;
  const setFiltroAtual = (f) => setFiltros((prev) => ({ ...prev, [aba]: f }));
  const limparFiltroAtual = () => setFiltros((prev) => ({ ...prev, [aba]: null }));

  const acesso = acessoProp === undefined ? null : acessoProp;
  const consultarAcesso = consultarAcessoProp || (() => api("/subscription/access"));

  if (!emp) {
    if (db.companies.length === 0)
      return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;
    return null;
  }

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

  const submenu = (itens, ativo, selecionar) => (
    <div className="vx-seg vx-subnav" style={{ marginBottom: 18 }}>
      {itens.map(([key, label]) => (
        <button key={key} data-on={ativo === key ? "1" : "0"} onClick={() => selecionar(key)}>{label}</button>
      ))}
    </div>
  );

  const filtroBar = ABAS_COM_FILTRO.has(aba) && (
    <FiltroData
      key={aba}
      campos={CAMPOS_SORT[aba] || []}
      campoInicial={CAMPOS_SORT[aba]?.[0]?.key || ""}
      onAplicar={setFiltroAtual}
      onLimpar={limparFiltroAtual}
    />
  );

  return (
    <div className="vx-fade">
      {aba === "inicio" && <>
        {filtroBar}
        <InicioEmpresa emp={emp} db={db} setAba={setAba} filtroData={filtroAtual} />
      </>}
      {aba === "painel" && <>
        {filtroBar}
        {submenu([["painel", "Insights"], ["financeiro", "Financeiro"]], secaoInsights, setSecaoInsights)}
        {secaoInsights === "painel" && <>
          <BannerCerebro onIr={() => { setSecaoAcademy("empresa"); setAba?.("academy"); }} />
          <PainelEmpresa emp={emp} db={db} up={up} aviso={aviso} filtroData={filtroAtual}
            irParaCampanhas={() => { setSecaoCampanhas("campanhas"); setAba?.("campanhas"); }} />
        </>}
        {secaoInsights === "financeiro" && <FinanceiroEmpresa emp={emp} db={db} aviso={aviso} filtroData={filtroAtual} />}
      </>}
      {aba === "campanhas" && <>
        {filtroBar}
        <CampanhasHub emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar}
          secao={secaoCampanhas} setSecao={setSecaoCampanhas} filtroData={filtroAtual} />
      </>}
      {aba === "profissionais" && <ProfissionaisEmpresa emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar} />}
      {aba === "conversas" && <ConversasEmpresa emp={emp} db={db} up={up} />}
      {aba === "academy" && <>
        {submenu([["rycs", "Cursos da RYCS"], ["empresa", "Ensinar a RYCS"], ["qualificacao", "Dados da Operação"]], secaoAcademy, setSecaoAcademy)}
        {secaoAcademy === "rycs" && <RycsAcademyEmpresa />}
        {secaoAcademy === "empresa" && <AcademyEmpresaHub emp={emp} aviso={aviso} />}
        {secaoAcademy === "qualificacao" && <QualificacaoEmpresa emp={emp} up={up} aviso={aviso} completarInformacoes={() => { setAba?.("configuracoes"); }} />}
      </>}
      {aba === "conferir" && <>
        {filtroBar}
        {submenu([["fila", "Fila de revisão"], ["time", "Time"], ["regras", "Regras automáticas"]], secaoConferir, setSecaoConferir)}
        {secaoConferir === "fila" && <ConferirEmpresa emp={emp} db={db} setDb={setDb} aviso={aviso} secao="fila" recarregar={recarregar} filtroData={filtroAtual} />}
        {secaoConferir === "time" && <TimeEmpresa emp={emp} db={db} up={up} aviso={aviso} />}
        {secaoConferir === "regras" && <ConferirEmpresa emp={emp} db={db} setDb={setDb} aviso={aviso} secao="regras" recarregar={recarregar} filtroData={filtroAtual} />}
      </>}
      {aba === "leads" && <>
        {filtroBar}
        <LeadsDashEmpresa emp={emp} db={db} up={up} recarregar={recarregar} filtroData={filtroAtual} />
      </>}
      {aba === "pagamentos" && <FinanceiroEmpresa emp={emp} db={db} aviso={aviso} />}
      {aba === "configuracoes" && <ConfiguracoesEmpresa emp={emp} up={up} aviso={aviso} db={db} recarregar={recarregar} />}
    </div>
  );
}

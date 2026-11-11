import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import FiltroData from "../FiltroData.jsx";
import PainelEmpresa from "./PainelEmpresa.jsx";
import ConferirEmpresa from "./ConferirEmpresa.jsx";
import TimeEmpresa from "./TimeEmpresa.jsx";
import QualificacaoEmpresa from "./QualificacaoEmpresa.jsx";
import CampanhasEmpresa from "./CampanhasEmpresa.jsx";
import TarefasEmpresa from "./TarefasEmpresa.jsx";
import ValoresEmpresa from "./ValoresEmpresa.jsx";
import FinanceiroEmpresa from "./FinanceiroEmpresa.jsx";
import PagamentosEmpresa, { ModalSaldo } from "./PagamentosEmpresa.jsx";
import ProfissionaisEmpresa from "./ProfissionaisEmpresa.jsx";
import ConversasEmpresa from "./ConversasEmpresa.jsx";
import RycsAcademyEmpresa from "./RycsAcademyEmpresa.jsx";
import AcademyEmpresaHub from "./AcademyEmpresaHub.jsx";
import InicioEmpresa from "./InicioEmpresa.jsx";
import ConfiguracoesEmpresa from "./ConfiguracoesEmpresa.jsx";
import LeadsEmpresa from "./LeadsEmpresa.jsx";

const CAMPOS_SORT = {
  inicio:    [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }],
  painel:     [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }],
  financeiro: [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }],
  campanhas:  [{ key: "criadoEm", label: "Data" }, { key: "titulo", label: "Nome" }, { key: "valor", label: "Valor" }],
  "campanhas-tarefas": [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }],
  leads:      [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }, { key: "statusCliente", label: "Status" }],
  "conferir-fila":   [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }, { key: "status", label: "Aprovação" }],
  "conferir-regras": [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }, { key: "status", label: "Aprovação" }],
};
const ABAS_COM_FILTRO = new Set(["painel", "financeiro", "campanhas", "campanhas-tarefas", "leads", "conferir-fila", "conferir-regras"]);

export default function Empresa({ db, setDb, up, aviso, aba, setAba, recarregar, acesso: acessoProp, consultarAcesso: consultarAcessoProp }) {
  const [secaoCampanhas, setSecaoCampanhas] = useState("campanhas");
  const [modalSaldo, setModalSaldo] = useState(false);
  const [secaoAcademy, setSecaoAcademy] = useState("rycs");
  const [filtros, setFiltros] = useState({});
  // Volta do login da Meta (?meta=...): abre direto em Configurações → Integrações.
  const [voltouDaMeta] = useState(() => new URLSearchParams(window.location.search).has("meta"));
  useEffect(() => { if (voltouDaMeta) setAba?.("configuracoes"); }, []);

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

  // Sem plano ativo a empresa navega por tudo normalmente; só não pode criar
  // campanhas nem conversar com profissionais até aderir a um plano.
  const bloqueado = !acesso.liberado;
  const irParaPlano = () => setAba?.("pagamentos");

  const submenu = (itens, ativo, selecionar) => (
    <div className="vx-seg vx-subnav" style={{ marginBottom: 18 }}>
      {itens.map(([key, label]) => (
        <button key={key} data-on={ativo === key ? "1" : "0"} onClick={() => selecionar(key)}>{label}</button>
      ))}
    </div>
  );

  const filtroBar = ABAS_COM_FILTRO.has(aba) && aba !== "leads" && (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
      <FiltroData
        key={aba}
        campos={CAMPOS_SORT[aba] || []}
        campoInicial={CAMPOS_SORT[aba]?.[0]?.key || ""}
        onAplicar={setFiltroAtual}
        onLimpar={limparFiltroAtual}
      />
    </div>
  );

  return (
    <div className="vx-fade">
      {aba === "inicio" && <>
        {filtroBar}
        <InicioEmpresa emp={emp} db={db} setAba={setAba} filtroData={filtroAtual} />
      </>}
      {aba === "painel" && <>
        {filtroBar}
        <PainelEmpresa emp={emp} db={db} up={up} aviso={aviso} filtroData={filtroAtual} vista="desempenho"
          irParaCampanhas={() => { setSecaoCampanhas("campanhas"); setAba?.("campanhas"); }} />
      </>}
      {aba === "painel-campanhas" && <>
        {filtroBar}
        <PainelEmpresa emp={emp} db={db} up={up} aviso={aviso} filtroData={filtroAtual} vista="campanhas"
          irParaCampanhas={() => { setSecaoCampanhas("campanhas"); setAba?.("campanhas"); }} />
      </>}
      {aba === "financeiro" && <>
        {filtroBar}
        <FinanceiroEmpresa emp={emp} db={db} aviso={aviso} filtroData={filtroAtual} />
      </>}
      {aba === "campanhas" && <>
        {filtroBar}
        <CampanhasEmpresa emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar}
          filtroData={filtroAtual} bloqueado={bloqueado} irParaPlano={irParaPlano} />
      </>}
      {aba === "campanhas-comissoes" && (
        <ValoresEmpresa emp={emp} db={db} up={up} aviso={aviso} escopo="comissoes" />
      )}
      {aba === "campanhas-tarefas" && <>
        {filtroBar}
        <TarefasEmpresa emp={emp} db={db} aviso={aviso} recarregar={recarregar} filtroData={filtroAtual} />
      </>}
      {aba === "profissionais" && <ProfissionaisEmpresa emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar} bloqueado={bloqueado} irParaPlano={irParaPlano} />}
      {aba === "conversas" && <ConversasEmpresa emp={emp} db={db} up={up} bloqueado={bloqueado} irParaPlano={irParaPlano} />}
      {aba === "academy" && <>
        {submenu([["rycs", "Cursos da RYCS"], ["empresa", "Ensinar a RYCS"], ["qualificacao", "Dados da Operação"]], secaoAcademy, setSecaoAcademy)}
        {secaoAcademy === "rycs" && <RycsAcademyEmpresa />}
        {secaoAcademy === "empresa" && <AcademyEmpresaHub emp={emp} aviso={aviso} />}
        {secaoAcademy === "qualificacao" && <QualificacaoEmpresa emp={emp} up={up} aviso={aviso} completarInformacoes={() => { setAba?.("configuracoes"); }} />}
      </>}
      {aba === "conferir-fila" && <>
        {filtroBar}
        <ConferirEmpresa emp={emp} db={db} setDb={setDb} aviso={aviso} secao="fila" recarregar={recarregar} filtroData={filtroAtual} />
      </>}
      {aba === "conferir-time" && <TimeEmpresa emp={emp} db={db} up={up} aviso={aviso} />}
      {aba === "conferir-regras" && <>
        {filtroBar}
        <ConferirEmpresa emp={emp} db={db} setDb={setDb} aviso={aviso} secao="regras" recarregar={recarregar} filtroData={filtroAtual} />
      </>}
      {aba === "leads" && (
        <LeadsEmpresa emp={emp} db={db} aviso={aviso} filtroData={filtroAtual} />
      )}
      {["pagamentos", "pagamentos-campanhas"].includes(aba) && (
        <PagamentosEmpresa emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar}
          secao={aba === "pagamentos-campanhas" ? "campanhas" : "plano"}
          onTrocarSecao={(s) => setAba?.(s === "campanhas" ? "pagamentos-campanhas" : "pagamentos")}
        />
      )}
      {aba === "configuracoes" && <ConfiguracoesEmpresa emp={emp} up={up} aviso={aviso} db={db} recarregar={recarregar} secaoInicial={voltouDaMeta ? "integracoes" : undefined} />}

      {modalSaldo && (
        <ModalSaldo emp={emp} aviso={aviso} aoConfirmar={() => recarregar?.()} onFechar={() => setModalSaldo(false)} />
      )}
    </div>
  );
}

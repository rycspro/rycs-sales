import { useEffect, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api.js";
import FiltroData from "../FiltroData.jsx";
// A tela inicial é a primeira que a empresa vê — carrega junto. As demais abas
// vêm por carregamento sob demanda (code-splitting), o que deixa o carregamento
// inicial no celular bem mais leve: só baixa o código da aba que está aberta.
import InicioEmpresa from "./InicioEmpresa.jsx";
const PainelEmpresa = lazy(() => import("./PainelEmpresa.jsx"));
const ConferirEmpresa = lazy(() => import("./ConferirEmpresa.jsx"));
const TimeEmpresa = lazy(() => import("./TimeEmpresa.jsx"));
const QualificacaoEmpresa = lazy(() => import("./QualificacaoEmpresa.jsx"));
const CampanhasEmpresa = lazy(() => import("./CampanhasEmpresa.jsx"));
const TarefasEmpresa = lazy(() => import("./TarefasEmpresa.jsx"));
const ValoresEmpresa = lazy(() => import("./ValoresEmpresa.jsx"));
const FinanceiroEmpresa = lazy(() => import("./FinanceiroEmpresa.jsx"));
const PagamentosEmpresa = lazy(() => import("./PagamentosEmpresa.jsx"));
const ModalSaldo = lazy(() => import("./PagamentosEmpresa.jsx").then((m) => ({ default: m.ModalSaldo })));
const ProfissionaisEmpresa = lazy(() => import("./ProfissionaisEmpresa.jsx"));
const ConversasEmpresa = lazy(() => import("./ConversasEmpresa.jsx"));
const RycsAcademyEmpresa = lazy(() => import("./RycsAcademyEmpresa.jsx"));
const AcademyEmpresaHub = lazy(() => import("./AcademyEmpresaHub.jsx"));
const ConfiguracoesEmpresa = lazy(() => import("./ConfiguracoesEmpresa.jsx"));
const SuporteEmpresa = lazy(() => import("./SuporteEmpresa.jsx"));
const LeadsEmpresa = lazy(() => import("./LeadsEmpresa.jsx"));
const Integracoes = lazy(() => import("./integracoes/Integracoes.jsx"));
const CaixaCanal = lazy(() => import("./leads/CaixaCanal.jsx"));
const Pedidos = lazy(() => import("./Pedidos.jsx"));
const LojaLeads = lazy(() => import("./LojaLeads.jsx"));
const MateriaisEmpresa = lazy(() => import("./MateriaisEmpresa.jsx"));
const CalendarioComercial = lazy(() => import("../calendario/CalendarioComercial.jsx"));
const AcademyEmpresa = lazy(() => import("./AcademyEmpresa.jsx"));
const MeuTime = lazy(() => import("../gestao/MeuTime.jsx"));
const MetasDesempenho = lazy(() => import("../gestao/MetasDesempenho.jsx"));
const Fechamentos = lazy(() => import("../gestao/Fechamentos.jsx"));
const DiscadoraEmpresa = lazy(() => import("../voice/DiscadoraEmpresa.jsx"));

const CAMPOS_SORT = {
  inicio:    [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }],
  painel:     [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }],
  financeiro: [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }],
  campanhas:  [{ key: "criadoEm", label: "Data" }, { key: "titulo", label: "Nome" }, { key: "valor", label: "Valor" }],
  "campanhas-tarefas": [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }],
  "conferir-fila":   [{ key: "criadoEm", label: "Data" }, { key: "valor", label: "Valor" }, { key: "status", label: "Aprovação" }],
};
const ABAS_COM_FILTRO = new Set(["painel", "financeiro", "campanhas", "campanhas-tarefas", "conferir-fila"]);

export default function Empresa({ db, setDb, up, aviso, aba, setAba, recarregar, acesso: acessoProp, consultarAcesso: consultarAcessoProp }) {
  const [secaoCampanhas, setSecaoCampanhas] = useState("campanhas");
  const [modalSaldo, setModalSaldo] = useState(false);
  const [secaoAcademy, setSecaoAcademy] = useState("rycs");
  const [filtros, setFiltros] = useState({});
  // No celular, o filtro de período vai para a barra de topo (onde ficava o logo
  // da empresa), via portal. No desktop, segue solto na própria linha.
  const [slotTopo, setSlotTopo] = useState(null);
  const [celular, setCelular] = useState(false);
  useEffect(() => {
    setSlotTopo(document.getElementById("vx-mobile-actions"));
    const mq = window.matchMedia("(max-width: 767px)");
    const atualizar = () => setCelular(mq.matches);
    atualizar();
    mq.addEventListener("change", atualizar);
    return () => mq.removeEventListener("change", atualizar);
  }, []);
  // Volta do login da Meta (?meta=...): abre direto em Integrações.
  const [voltouDaMeta] = useState(() => new URLSearchParams(window.location.search).has("meta"));
  useEffect(() => { if (voltouDaMeta) setAba?.("integracoes"); }, []);
  // Volta do checkout do Stripe (?stripe=ok|cancelado|portal): abre Pagamentos.
  // Quem libera o plano é o webhook; aqui só avisamos e recarregamos.
  useEffect(() => {
    const volta = new URLSearchParams(window.location.search).get("stripe");
    if (!volta) return;
    window.history.replaceState(null, "", window.location.pathname);
    setAba?.("pagamentos");
    if (volta === "ok") {
      aviso?.("Pagamento recebido pelo Stripe. Seu plano é liberado em instantes.");
      setTimeout(() => recarregar?.(), 4000);
    } else if (volta === "cancelado") aviso?.("Pagamento internacional não concluído.");
  }, []);

  // Volta do login do Instagram (?instagram=) e do Bling (?erp=).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const instagram = q.get("instagram"), erp = q.get("erp");
    if (!instagram && !erp) return;
    window.history.replaceState(null, "", window.location.pathname);
    setAba?.(instagram ? "leads-instagram" : "integracoes");
    const nome = instagram ? "Instagram" : "ERP";
    const avisos = { conectado: `${nome} conectado.`, cancelado: `Conexão com o ${nome} cancelada.`, sessao: "A sessão de conexão expirou. Tente de novo.", em_uso: "Este Instagram já está conectado em outra empresa." };
    aviso?.(avisos[instagram || erp] || `Não foi possível conectar o ${nome}. Tente de novo.`);
  }, []);
  const [pedidoAberto, setPedidoAberto] = useState("");
  const abrirPedido = (id) => { setPedidoAberto(id); setAba?.("pedidos"); };

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

  // Controle de período, usado tanto solto (própria linha) quanto embutido no
  // header de outras telas (ex.: Campanhas, que o alinha junto aos botões).
  const filtroDataEl = ABAS_COM_FILTRO.has(aba) && aba !== "leads" && (
    <FiltroData
      key={aba}
      campos={CAMPOS_SORT[aba] || []}
      campoInicial={CAMPOS_SORT[aba]?.[0]?.key || ""}
      onAplicar={setFiltroAtual}
      onLimpar={limparFiltroAtual}
      variant={aba === "campanhas" ? "btn" : "default"}
    />
  );

  const filtroBar = filtroDataEl && !celular && (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
      {filtroDataEl}
    </div>
  );
  // Quando embutido no header de telas como Campanhas/Conferir, no celular o
  // filtro já está no topo — não repetir aqui.
  const filtroHeader = celular ? null : filtroDataEl;

  return (
    <div className="vx-fade">
      {celular && slotTopo && filtroDataEl && createPortal(
        <div className="vx-topbar-filtro">{filtroDataEl}</div>, slotTopo)}
      <Suspense fallback={<div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>}>
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
      {aba === "campanhas" && (
        <CampanhasEmpresa emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar}
          filtroData={filtroAtual} filtroBar={filtroHeader} bloqueado={bloqueado} irParaPlano={irParaPlano} />
      )}
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
        {secaoAcademy === "empresa" && <AcademyEmpresaHub emp={emp} aviso={aviso} onIrParaMateriais={() => setAba?.("materiais")} />}
        {secaoAcademy === "qualificacao" && <QualificacaoEmpresa emp={emp} up={up} aviso={aviso} completarInformacoes={() => { setAba?.("outros"); }} />}
      </>}
      {aba === "conferir-fila" && <>
        <ConferirEmpresa emp={emp} db={db} setDb={setDb} aviso={aviso} secao="fila" recarregar={recarregar} filtroData={filtroAtual} filtroBar={filtroHeader} />
      </>}
      {aba === "conferir-time" && <TimeEmpresa emp={emp} db={db} up={up} aviso={aviso} />}
      {aba === "materiais" && <MateriaisEmpresa emp={emp} db={db} aviso={aviso} />}
      {aba === "info-empresa" && <MateriaisEmpresa emp={emp} db={db} aviso={aviso} secao="informacoes" />}
      {aba === "biblioteca" && <MateriaisEmpresa emp={emp} db={db} aviso={aviso} secao="biblioteca" />}
      {aba === "academy-empresa" && <AcademyEmpresa emp={emp} db={db} aviso={aviso} onIrParaMateriais={() => setAba?.("biblioteca")} />}
      {(aba === "leads-whatsapp" || aba === "leads-instagram") && (
        <CaixaCanal key={aba} canal={aba === "leads-instagram" ? "instagram" : "whatsapp"} aviso={aviso}
          time={(db.sellers || []).filter((s) => s.aplicacoes?.[emp.id] === "aprovado")}
          campanhas={(db.campaigns || []).filter((c) => c.companyId === emp.id)}
          onGerarPedido={abrirPedido} onAbrirPipeline={() => setAba?.("integracoes")} />
      )}
      {aba === "discadora" && <DiscadoraEmpresa emp={emp} aviso={aviso}
        time={(db.sellers || []).filter((s) => s.aplicacoes?.[emp.id] === "aprovado")} />}
      {aba === "loja-leads" && <LojaLeads aviso={aviso} />}
      {aba === "calendario" && <CalendarioComercial />}
      {aba === "integracoes" && (
        <Integracoes aviso={aviso} campanhas={(db.campaigns || []).filter((c) => c.companyId === emp.id)}
          onAbrirCanal={(canal) => setAba?.(`leads-${canal}`)} />
      )}
      {aba === "meu-time" && <MeuTime aviso={aviso} />}
      {aba === "metas-desempenho" && <MetasDesempenho aviso={aviso} />}
      {aba === "fechamentos" && <Fechamentos aviso={aviso} />}
      {(aba === "planos" || aba === "pagamentos" || aba === "pagamentos-visibilidade") && (
        <PagamentosEmpresa emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar}
          secao="plano" onTrocarSecao={() => {}} />
      )}
      {aba === "destaques" && (
        <PagamentosEmpresa emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar}
          secao="destaque" onTrocarSecao={() => {}} />
      )}
      {aba === "pagamentos-campanhas" && (
        <PagamentosEmpresa emp={emp} db={db} up={up} aviso={aviso} recarregar={recarregar}
          secao="campanhas"
          onTrocarSecao={(s) => setAba?.(s === "campanhas" ? "pagamentos-campanhas" : "pagamentos")}
        />
      )}
      {(aba === "configuracoes" || aba === "conta") && (
        <ConfiguracoesEmpresa emp={emp} up={up} aviso={aviso} db={db} recarregar={recarregar} secaoInicial="dados" somenteConteudo />
      )}
      {aba === "outros" && (
        <ConfiguracoesEmpresa emp={emp} up={up} aviso={aviso} db={db} recarregar={recarregar} secaoInicial="notificacoes" />
      )}
      {(aba === "suporte" || aba === "suporte-conta") && <SuporteEmpresa emp={emp} aviso={aviso} />}

      {modalSaldo && (
        <ModalSaldo emp={emp} aviso={aviso} aoConfirmar={() => recarregar?.()} onFechar={() => setModalSaldo(false)} />
      )}
      </Suspense>
    </div>
  );
}

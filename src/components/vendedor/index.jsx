import { useState } from "react";
import Cadastro from "./Cadastro.jsx";
import PainelVendedor from "./PainelVendedor.jsx";
import Oportunidades from "./Oportunidades.jsx";
import Workspace from "./Workspace.jsx";
import CampanhaPage from "./CampanhaPage.jsx";
import CampanhasEmpresa from "./CampanhasEmpresa.jsx";
import TreinamentoEmpresa from "./TreinamentoEmpresa.jsx";
import Carteira from "./Carteira.jsx";
import PerfilVendedor from "./PerfilVendedor.jsx";
import AcademyCatalogo from "./AcademyCatalogo.jsx";
import Academy from "./Academy.jsx";
import Indicacoes from "../Indicacoes.jsx";
import Triagem from "./Triagem.jsx";
import OnboardingProfissional from "./OnboardingProfissional.jsx";

export default function Vendedor({ db, setDb, up, aviso, aba, setAba, recarregar }) {
  const [abertaId, setAbertaId] = useState(null);
  const [campanhaAbertaId, setCampanhaAbertaId] = useState(null);
  const [academyFuncao, setAcademyFuncao] = useState(null);
  const [refazendo, setRefazendo] = useState(false);
  // Quando true, o profissional abriu a empresa mas ainda não está aprovado:
  // mostra TreinamentoEmpresa em vez de CampanhasEmpresa.
  const [modoTreinamento, setModoTreinamento] = useState(false);
  const eu = db.sellers.find((s) => s.id === db.sellerId);

  if (!eu) {
    if (db.sellers.length === 0)
      return <div className="vx-fade" style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;
    return <Cadastro db={db} setDb={setDb} up={up} aviso={aviso} />;
  }

  const emOnboarding = eu.onboardingEtapa && eu.onboardingEtapa !== "concluido";
  if (emOnboarding && !refazendo)
    return (
      <OnboardingProfissional
        aviso={aviso}
        recarregar={recarregar}
        aoConcluir={() => recarregar()}
      />
    );

  const precisaAvaliar = eu.status === "triagem" || eu.status === "recusado";
  if (precisaAvaliar || refazendo)
    return (
      <Triagem
        aviso={aviso}
        recarregar={recarregar}
        irAcademy={() => { setRefazendo(false); setAba("academy"); }}
        voltar={refazendo ? () => setRefazendo(false) : null}
      />
    );

  const empresaAberta = db.companies.find((c) => c.id === abertaId);
  const campanhaAberta = db.campaigns?.find((c) => c.id === campanhaAbertaId);

  if (empresaAberta) {
    if (campanhaAberta) {
      return <CampanhaPage campanha={campanhaAberta} empresa={empresaAberta} eu={eu} db={db} setDb={setDb} up={up} aviso={aviso} voltar={() => setCampanhaAbertaId(null)} recarregar={recarregar} />;
    }
    // Profissional aprovado nesta empresa → vai direto para campanhas
    if (eu.aplicacoes?.[empresaAberta.id] === "aprovado" && !modoTreinamento) {
      return (
        <CampanhasEmpresa
          empresa={empresaAberta}
          eu={eu}
          db={db}
          onAbrir={(id) => setCampanhaAbertaId(id)}
          voltar={() => setAbertaId(null)}
          aviso={aviso}
          recarregar={recarregar}
          irAcademy={(funcao) => { setAcademyFuncao(funcao); setAbertaId(null); setAba("academy"); }}
        />
      );
    }
    // Não aprovado ainda → treinamento + certificação
    return (
      <TreinamentoEmpresa
        empresa={empresaAberta}
        eu={eu}
        voltar={() => { setAbertaId(null); setModoTreinamento(false); }}
        onAprovado={() => { setModoTreinamento(false); }}
        aviso={aviso}
        recarregar={recarregar}
      />
    );
  }

  return (
    <>
      {aba === "painel" && <PainelVendedor eu={eu} db={db} abrirEmpresas={() => setAba("oportunidades")} />}
      {aba === "oportunidades" && (
        <Oportunidades
          eu={eu}
          db={db}
          aviso={aviso}
          recarregar={recarregar}
          abrirCampanha={(c) => { setAbertaId(c.companyId); setCampanhaAbertaId(c.id); }}
        />
      )}
      {aba === "academy" && (academyFuncao
        ? <Academy eu={eu} aviso={aviso} funcaoInicial={academyFuncao} recarregar={recarregar} />
        : <AcademyCatalogo eu={eu} aviso={aviso} />)}
      {aba === "carteira" && <Carteira eu={eu} db={db} setDb={setDb} up={up} aviso={aviso} recarregar={recarregar} />}
      {aba === "indicar" && <Indicacoes aviso={aviso} />}
      {aba === "perfil" && <PerfilVendedor eu={eu} db={db} up={up} setDb={setDb} aviso={aviso} refazerAvaliacao={() => setRefazendo(true)} />}
    </>
  );
}

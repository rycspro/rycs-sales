import { useState } from "react";
import Cadastro from "./Cadastro.jsx";
import PainelVendedor from "./PainelVendedor.jsx";
import ListaEmpresas from "./ListaEmpresas.jsx";
import Workspace from "./Workspace.jsx";
import CampanhaPage from "./CampanhaPage.jsx";
import Carteira from "./Carteira.jsx";
import PerfilVendedor from "./PerfilVendedor.jsx";
import AcademyCatalogo from "./AcademyCatalogo.jsx";
import Academy from "./Academy.jsx";
import Indicacoes from "../Indicacoes.jsx";
import Triagem from "./Triagem.jsx";

export default function Vendedor({ db, setDb, up, aviso, aba, setAba, recarregar }) {
  const [abertaId, setAbertaId] = useState(null);
  const [campanhaAbertaId, setCampanhaAbertaId] = useState(null);
  const [academyFuncao, setAcademyFuncao] = useState(null);
  // Refazer a avaliação por escolha própria, já aprovado. A nota é o que a
  // empresa lê antes de aceitar alguém numa campanha, então travar a
  // avaliação na primeira tentativa congelaria a pessoa na versão mais fraca
  // dela — inclusive depois de ela estudar na Academy justamente para melhorar.
  const [refazendo, setRefazendo] = useState(false);
  const eu = db.sellers.find((s) => s.id === db.sellerId);

  if (!eu) return <Cadastro db={db} setDb={setDb} up={up} aviso={aviso} />;
  // Só quem ainda não fez a avaliação fica retido nela. Concluída, o perfil
  // é liberado — pleno acima de 90%, parcial abaixo — e a Academy passa a ser
  // o caminho para elevar a classificação.
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

  if (empresaAberta)
    if (campanhaAberta) {
      return <CampanhaPage campanha={campanhaAberta} empresa={empresaAberta} eu={eu} db={db} setDb={setDb} up={up} aviso={aviso} voltar={() => setCampanhaAbertaId(null)} recarregar={recarregar} />;
    }
    return <Workspace campanha={campanhaAberta} empresa={empresaAberta} eu={eu} db={db} setDb={setDb} up={up} aviso={aviso} voltar={() => { setAbertaId(null); setCampanhaAbertaId(null); }} recarregar={recarregar} />;

  return (
    <>
      {aba === "painel" && <PainelVendedor eu={eu} db={db} abrirEmpresas={() => setAba("empresas")} />}
        {aba === "empresas" && <ListaEmpresas eu={eu} db={db} up={up} aviso={aviso} abrir={(companyId, campaignId = null) => { setAbertaId(companyId); setCampanhaAbertaId(campaignId); }} recarregar={recarregar} irAcademy={(funcao = null) => { setAcademyFuncao(funcao); setAba("academy"); }} />}
      {aba === "academy" && (academyFuncao
        ? <Academy eu={eu} aviso={aviso} funcaoInicial={academyFuncao} recarregar={recarregar} />
        : <AcademyCatalogo eu={eu} aviso={aviso} />)}
      {aba === "carteira" && <Carteira eu={eu} db={db} setDb={setDb} up={up} aviso={aviso} recarregar={recarregar} />}
      {aba === "indicar" && <Indicacoes aviso={aviso} />}
      {aba === "perfil" && <PerfilVendedor eu={eu} db={db} up={up} setDb={setDb} aviso={aviso} refazerAvaliacao={() => setRefazendo(true)} />}
    </>
  );
}

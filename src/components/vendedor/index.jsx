import { useState } from "react";
import Cadastro from "./Cadastro.jsx";
import ListaEmpresas from "./ListaEmpresas.jsx";
import Workspace from "./Workspace.jsx";
import Carteira from "./Carteira.jsx";
import PerfilVendedor from "./PerfilVendedor.jsx";
import Academy from "./Academy.jsx";
import Indicacoes from "../Indicacoes.jsx";
import Triagem from "./Triagem.jsx";

export default function Vendedor({ db, setDb, up, aviso, aba, setAba, recarregar }) {
  const [abertaId, setAbertaId] = useState(null);
  const eu = db.sellers.find((s) => s.id === db.sellerId);

  if (!eu) return <Cadastro db={db} setDb={setDb} up={up} aviso={aviso} />;
  // Só quem ainda não fez a avaliação fica retido nela. Concluída, o perfil
  // é liberado — pleno acima de 90%, parcial abaixo — e a Academy passa a ser
  // o caminho para elevar a classificação.
  if (eu.status === "triagem" || eu.status === "recusado")
    return <Triagem aviso={aviso} recarregar={recarregar} irAcademy={() => setAba("academy")} />;

  const empresaAberta = db.companies.find((c) => c.id === abertaId);

  if (empresaAberta)
    return <Workspace empresa={empresaAberta} eu={eu} db={db} setDb={setDb} up={up} aviso={aviso} voltar={() => setAbertaId(null)} recarregar={recarregar} />;

  return (
    <>
      {aba === "empresas" && <ListaEmpresas eu={eu} db={db} up={up} aviso={aviso} abrir={setAbertaId} />}
      {aba === "academy" && <Academy eu={eu} aviso={aviso} />}
      {aba === "carteira" && <Carteira eu={eu} db={db} setDb={setDb} up={up} aviso={aviso} recarregar={recarregar} />}
      {aba === "indicar" && <Indicacoes aviso={aviso} />}
      {aba === "perfil" && <PerfilVendedor eu={eu} db={db} up={up} setDb={setDb} aviso={aviso} />}
    </>
  );
}

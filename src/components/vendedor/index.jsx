import { useState } from "react";
import Cadastro from "./Cadastro.jsx";
import StatusTriagem from "./StatusTriagem.jsx";
import ListaEmpresas from "./ListaEmpresas.jsx";
import Workspace from "./Workspace.jsx";
import Carteira from "./Carteira.jsx";
import PerfilVendedor from "./PerfilVendedor.jsx";

export default function Vendedor({ db, setDb, up, aviso, aba, recarregar }) {
  const [abertaId, setAbertaId] = useState(null);
  const eu = db.sellers.find((s) => s.id === db.sellerId);

  if (!eu) return <Cadastro db={db} setDb={setDb} up={up} aviso={aviso} />;
  if (eu.status === "triagem" || eu.status === "recusado")
    return <StatusTriagem eu={eu} up={up} db={db} />;

  const empresaAberta = db.companies.find((c) => c.id === abertaId);

  if (empresaAberta)
    return <Workspace empresa={empresaAberta} eu={eu} db={db} setDb={setDb} up={up} aviso={aviso} voltar={() => setAbertaId(null)} />;

  return (
    <>
      {aba === "empresas" && <ListaEmpresas eu={eu} db={db} up={up} aviso={aviso} abrir={setAbertaId} />}
      {aba === "carteira" && <Carteira eu={eu} db={db} setDb={setDb} up={up} aviso={aviso} recarregar={recarregar} />}
      {aba === "perfil" && <PerfilVendedor eu={eu} db={db} up={up} setDb={setDb} aviso={aviso} />}
    </>
  );
}

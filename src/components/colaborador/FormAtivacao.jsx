// Ativação a partir da ficha do profissional: a conta já é conhecida, falta
// escolher o cargo. Usa o mesmo cadastro rápido dos cards de cargos.
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { AdicionarPessoa } from "./Organograma.jsx";

export default function FormAtivacao({ usuario, aviso, pronto, cancelar }) {
  const [cargos, setCargos] = useState(null);
  useEffect(() => {
    api("/admin/colaboradores-organograma").then((r) => setCargos((r?.areas || []).flatMap((a) => a.cargos.map((c) => ({ ...c, area: a.nome })))));
  }, []);
  if (!cargos) return <div className="vx-spinner" />;
  return <AdicionarPessoa usuario={usuario} cargos={cargos} aviso={aviso} cancelar={cancelar} pronto={pronto} />;
}

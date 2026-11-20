// Chave "Colaborador interno" dentro da ficha do profissional no admin.
// Mostra o estado e, se ainda não for colaborador, abre o formulário de ativação.
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { VINCULOS } from "../../../shared/colaboradores.js";
import FormAtivacao from "./FormAtivacao.jsx";

export default function ChaveColaborador({ sellerId, nome, documento, aviso }) {
  const [d, setD] = useState(null);
  const [abrir, setAbrir] = useState(false);
  const carregar = () => api(`/admin/colaboradores-por-profissional/${sellerId}`).then((r) => setD(r || {}));
  // eslint-disable-next-line
  useEffect(() => { carregar(); }, [sellerId]);
  if (!d || !d.usuario) return null;
  const c = d.colaborador;
  return (
    <div className="vx-card" style={{ padding: 14, marginTop: 12 }}>
      {c ? (
        <div style={{ fontSize: 13 }}>
          <b>Colaborador interno</b> · {c.status === "ativo" ? "ativo" : "vínculo encerrado"} · {c.funcao || "sem função"} · {VINCULOS[c.vinculo]}
          <div className="vx-mut" style={{ fontSize: 12 }}>{c.contratoAssinado ? "Contrato assinado" : "Contrato pendente"} · {c.termoAceito ? "termo aceito" : "termo pendente"}. Gerencie na aba Colaboradores.</div>
        </div>
      ) : (
        <>
          <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44, fontSize: 13 }}>
            <input type="checkbox" checked={abrir} onChange={(e) => setAbrir(e.target.checked)} /> <b>Colaborador interno</b> (trabalha para a própria RYCS)
          </label>
          {abrir && (
            <FormAtivacao prefixo={`ch-${sellerId}`} usuario={{ ...d.usuario, nomeProfissional: nome, documento }} aviso={aviso}
              cancelar={() => setAbrir(false)} pronto={() => { setAbrir(false); carregar(); }} />
          )}
        </>
      )}
    </div>
  );
}

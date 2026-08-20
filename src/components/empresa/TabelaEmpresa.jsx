import { useState, useEffect } from "react";
import { apiPatch } from "../../lib/api.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";

export default function TabelaEmpresa({ emp, up, aviso }) {
  const [v, setV] = useState(emp.comissoes);
  useEffect(() => setV(emp.comissoes), [emp.id]);
  const salvar = () => {
    const limpo = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(String(x).replace(",", ".")) || 0]));
    apiPatch(`/companies/${emp.id}`, { comissoes: limpo });
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, comissoes: limpo } : c) }));
    aviso("Tabela atualizada. Vale para as próximas ações.");
  };
  return (
    <>
      <p className="vx-mut" style={{ fontSize: 13, marginTop: 0 }}>
        Você define quanto vale cada ação. Reunião agendada e venda são as duas fontes principais da plataforma —
        as outras servem de combustível para elas.
      </p>
      <div className="vx-card" style={{ padding: 18 }}>
        {ORDEM_ACOES.map((k) => (
          <div key={k} className="vx-row" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <b style={{ fontSize: 13.5 }}>{ACOES[k].nome}</b>
              <div className="vx-mut" style={{ fontSize: 11.5 }}>{ACOES[k].regra}</div>
            </div>
            <input className="vx-input vx-mono" style={{ width: 108, textAlign: "right", flex: "none" }} value={v[k] ?? ""} inputMode="decimal"
              onChange={(e) => setV({ ...v, [k]: e.target.value })} />
          </div>
        ))}
        <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16 }} onClick={salvar}>Salvar tabela</button>
      </div>
    </>
  );
}

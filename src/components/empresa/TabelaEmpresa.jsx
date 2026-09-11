import { useState, useEffect } from "react";
import { apiPatch } from "../../lib/api.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";
import { calcularValorTarefa } from "../../../shared/valorTarefa.js";

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
            <div style={{width:150,flex:"none"}}><input className="vx-input vx-mono" style={{ textAlign: "right" }} value={v[k] ?? ""} inputMode="decimal" aria-label={`Valor bruto de ${ACOES[k].nome}`}
              onChange={(e) => setV({ ...v, [k]: e.target.value })} /><div className="vx-mut" style={{fontSize:10.5,textAlign:"right",marginTop:3}}>Profissional recebe {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(calcularValorTarefa(Number(String(v[k]||0).replace(",",".")),emp.assinatura).liquido)}</div></div>
          </div>
        ))}
        <button className="vx-btn vx-btn-primary vx-btn-block" style={{ marginTop: 16 }} onClick={salvar}>Salvar tabela</button>
        <div className="vx-chart-source">Taxa real do plano: {Math.round(calcularValorTarefa(100,emp.assinatura).percentual*100)}%. Fórmula: líquido = valor bruto - taxa da plataforma. O cálculo é exibido antes da confirmação e não altera valores automaticamente.</div>
      </div>
    </>
  );
}

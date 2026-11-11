import { useEffect, useState } from "react";
import { CircleDollarSign, TrendingUp, User } from "lucide-react";
import { api } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";

export default function ComissoesPanel({ emp }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api("/leads/comissoes").then((r) => { setDados(r); setCarregando(false); }).catch(() => setCarregando(false));
  }, [emp.id]);

  if (carregando) return <div className="vx-mut" style={{ padding: 20 }}>Carregando comissionamento…</div>;
  if (!dados) return <div className="vx-mut" style={{ padding: 20 }}>Não foi possível carregar os dados.</div>;

  const { vendedores = [], total } = dados;

  const totalVendas = vendedores.reduce((s, v) => s + v.totalVendas, 0);
  const totalComissoes = vendedores.reduce((s, v) => s + v.totalComissoes, 0);

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Financeiro da operação</div>
          <h1 className="vx-disp">Comissionamento</h1>
          <p>Vendas fechadas, comissões calculadas automaticamente por campanha.</p>
        </div>
      </div>

      <div className="vx-grid vx-g3" style={{ marginBottom: 18 }}>
        <div className="vx-card" style={{ padding: 14 }}>
          <div className="vx-mut" style={{ fontSize: 12 }}>Fechamentos</div>
          <b className="vx-mono" style={{ fontSize: 20 }}>{total}</b>
        </div>
        <div className="vx-card" style={{ padding: 14 }}>
          <div className="vx-mut" style={{ fontSize: 12 }}>Total em vendas</div>
          <b className="vx-mono" style={{ fontSize: 20 }}>{money(totalVendas)}</b>
        </div>
        <div className="vx-card" style={{ padding: 14 }}>
          <div className="vx-mut" style={{ fontSize: 12 }}>Comissões a pagar</div>
          <b className="vx-mono" style={{ fontSize: 20, color: "var(--brand)" }}>{money(totalComissoes)}</b>
        </div>
      </div>

      {vendedores.length === 0 ? (
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <CircleDollarSign size={26} color="var(--muted)" />
          <div className="vx-disp" style={{ marginTop: 8 }}>Sem fechamentos registrados</div>
          <div className="vx-mut" style={{ fontSize: 13 }}>Ao mover um lead para "Fechado" com o valor da venda, as comissões aparecem aqui.</div>
        </div>
      ) : (
        <div className="vx-grid">
          {vendedores.map((v) => (
            <div key={v.sellerId} className="vx-card" style={{ padding: 16 }}>
              <div className="vx-row" style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={16} color="var(--brand)" />
                  <b>{v.nome}</b>
                </div>
                <span className="vx-chip">{v.fechamentos} fechamento{v.fechamentos !== 1 ? "s" : ""}</span>
              </div>
              <div className="vx-grid vx-g3" style={{ marginBottom: 10 }}>
                <div><div className="vx-mut" style={{ fontSize: 11 }}>Volume de vendas</div><b className="vx-mono">{money(v.totalVendas)}</b></div>
                <div><div className="vx-mut" style={{ fontSize: 11 }}>Comissão total</div><b className="vx-mono" style={{ color: "var(--brand)" }}>{money(v.totalComissoes)}</b></div>
                <div><div className="vx-mut" style={{ fontSize: 11 }}>Taxa média</div><b className="vx-mono">{v.totalVendas > 0 ? (v.totalComissoes / v.totalVendas * 100).toFixed(1) : "—"}%</b></div>
              </div>
              <div className="vx-table-wrap">
                <table className="vx-table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Lead</th><th>Campanha</th><th>Venda</th><th>Comissão</th><th>Data</th></tr></thead>
                  <tbody>
                    {v.leads.map((l) => (
                      <tr key={l.id}>
                        <td>{l.nome}</td>
                        <td>{l.campanhaTitulo || "—"}</td>
                        <td className="vx-mono">{money(l.valorVenda)}</td>
                        <td className="vx-mono" style={{ color: "var(--brand)" }}>{money(l.comissaoCalculada)}</td>
                        <td>{dataCurta(l.atualizadoEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

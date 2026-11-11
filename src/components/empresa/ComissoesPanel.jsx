import { useEffect, useState } from "react";
import { CircleDollarSign, TrendingUp, User } from "lucide-react";
import { api } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { useI18n } from "../../lib/i18n.jsx";

export default function ComissoesPanel({ emp }) {
  const { t } = useI18n();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api("/leads/comissoes").then((r) => { setDados(r); setCarregando(false); }).catch(() => setCarregando(false));
  }, [emp.id]);

  if (carregando) return <div className="vx-mut" style={{ padding: 20 }}>{t("comissions.loading")}</div>;
  if (!dados) return <div className="vx-mut" style={{ padding: 20 }}>{t("comissions.loadError")}</div>;

  const { vendedores = [], total } = dados;

  const totalVendas = vendedores.reduce((s, v) => s + v.totalVendas, 0);
  const totalComissoes = vendedores.reduce((s, v) => s + v.totalComissoes, 0);

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">{t("comissions.eyebrow")}</div>
          <h1 className="vx-disp">{t("comissions.title")}</h1>
          <p>{t("comissions.desc")}</p>
        </div>
      </div>

      <div className="vx-grid vx-g3" style={{ marginBottom: 18 }}>
        <div className="vx-card" style={{ padding: 14 }}>
          <div className="vx-mut" style={{ fontSize: 12 }}>{t("comissions.closings")}</div>
          <b className="vx-mono" style={{ fontSize: 20 }}>{total}</b>
        </div>
        <div className="vx-card" style={{ padding: 14 }}>
          <div className="vx-mut" style={{ fontSize: 12 }}>{t("comissions.totalSales")}</div>
          <b className="vx-mono" style={{ fontSize: 20 }}>{money(totalVendas)}</b>
        </div>
        <div className="vx-card" style={{ padding: 14 }}>
          <div className="vx-mut" style={{ fontSize: 12 }}>{t("comissions.toPay")}</div>
          <b className="vx-mono" style={{ fontSize: 20, color: "var(--brand)" }}>{money(totalComissoes)}</b>
        </div>
      </div>

      {vendedores.length === 0 ? (
        <div className="vx-card" style={{ padding: 28, textAlign: "center" }}>
          <CircleDollarSign size={26} color="var(--muted)" />
          <div className="vx-disp" style={{ marginTop: 8 }}>{t("comissions.noClosings")}</div>
          <div className="vx-mut" style={{ fontSize: 13 }}>{t("comissions.noClosingsDesc")}</div>
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
                <span className="vx-chip">{t("comissions.closingCount", { count: v.fechamentos })}</span>
              </div>
              <div className="vx-grid vx-g3" style={{ marginBottom: 10 }}>
                <div><div className="vx-mut" style={{ fontSize: 11 }}>{t("comissions.salesVolume")}</div><b className="vx-mono">{money(v.totalVendas)}</b></div>
                <div><div className="vx-mut" style={{ fontSize: 11 }}>{t("comissions.totalCommission")}</div><b className="vx-mono" style={{ color: "var(--brand)" }}>{money(v.totalComissoes)}</b></div>
                <div><div className="vx-mut" style={{ fontSize: 11 }}>{t("comissions.avgRate")}</div><b className="vx-mono">{v.totalVendas > 0 ? (v.totalComissoes / v.totalVendas * 100).toFixed(1) : "—"}%</b></div>
              </div>
              <div className="vx-table-wrap">
                <table className="vx-table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Lead</th><th>{t("tasks.th.campaign")}</th><th>{t("comissions.sale")}</th><th>{t("comissions.commission")}</th><th>{t("tasks.th.date")}</th></tr></thead>
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

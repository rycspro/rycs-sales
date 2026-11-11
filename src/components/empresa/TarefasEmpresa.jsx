import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, Filter, Search, XCircle } from "lucide-react";
import { apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES, STATUS, MOTIVO_COR } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";

const STATUS_FILTRO_KEYS = [
  ["", "tasks.filter.all"],
  ["analisando", "tasks.filter.analyzing"],
  ["revisao", "tasks.filter.review"],
  ["liberado", "tasks.filter.released"],
  ["recusado", "tasks.filter.refused"],
  ["ia_aprovado", "tasks.filter.aiApproved"],
];

function ChipStatus({ status }) {
  const s = STATUS[status] || { txt: status, tone: "muted" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600,
      padding: "2px 8px", borderRadius: 20,
      background: `color-mix(in srgb, ${MOTIVO_COR[status] || "var(--muted)"} 12%, transparent)`,
      color: MOTIVO_COR[status] || "var(--muted)",
    }}>
      {s.txt}
    </span>
  );
}

export default function TarefasEmpresa({ emp, db, aviso, recarregar }) {
  const { t } = useI18n();
  const [busca, setBusca] = useState("");
  const [filtroCampaign, setFiltroCampaign] = useState("");
  const [filtroSeller, setFiltroSeller] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  const todasSubmissoes = useMemo(
    () => (db.submissions || []).filter((s) => s.companyId === emp.id),
    [db.submissions, emp.id],
  );
  const campanhas = useMemo(
    () => (db.campaigns || []).filter((c) => c.companyId === emp.id),
    [db.campaigns, emp.id],
  );
  const sellers = useMemo(
    () => (db.sellers || []).filter((s) => s.aplicacoes?.[emp.id] === "aprovado"),
    [db.sellers, emp.id],
  );

  const visiveis = useMemo(() => todasSubmissoes.filter((s) => {
    if (filtroCampaign && s.campaignId !== filtroCampaign) return false;
    if (filtroSeller && s.sellerId !== filtroSeller) return false;
    if (filtroTipo && s.tipo !== filtroTipo) return false;
    if (filtroStatus && s.status !== filtroStatus) return false;
    if (busca) {
      const term = busca.toLowerCase();
      const seller = db.sellers?.find((x) => x.id === s.sellerId);
      const campanha = campanhas.find((c) => c.id === s.campaignId);
      if (!seller?.nome?.toLowerCase().includes(term) && !campanha?.titulo?.toLowerCase().includes(term) && !s.tipo?.includes(term)) return false;
    }
    return true;
  }), [todasSubmissoes, filtroCampaign, filtroSeller, filtroTipo, filtroStatus, busca, db.sellers, campanhas]);

  const stats = useMemo(() => ({
    total: todasSubmissoes.length,
    pendentes: todasSubmissoes.filter((s) => s.status === "analisando" || s.status === "revisao").length,
    liberados: todasSubmissoes.filter((s) => s.status === "liberado").length,
    recusados: todasSubmissoes.filter((s) => s.status === "recusado").length,
    valorTotal: todasSubmissoes.filter((s) => s.status === "liberado").reduce((acc, s) => acc + Number(s.valor || 0), 0),
  }), [todasSubmissoes]);

  const liberar = async (sub) => {
    const r = await apiPatch(`/submissions/${sub.id}`, { status: "liberado" });
    if (!r || r.error) return aviso(r?.error || t("tasks.releaseError"));
    aviso(t("tasks.released"));
    recarregar?.();
  };

  const recusar = async (sub) => {
    const r = await apiPatch(`/submissions/${sub.id}`, { status: "recusado" });
    if (!r || r.error) return aviso(r?.error || t("tasks.refuseError"));
    aviso(t("tasks.refused"));
    recarregar?.();
  };

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">{t("tasks.eyebrow")}</div>
          <h1 className="vx-disp">{t("tasks.title")}</h1>
          <p>{t("tasks.desc")}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          [t("tasks.stat.total"), stats.total.toLocaleString(), Activity],
          [t("tasks.stat.pending"), stats.pendentes.toLocaleString(), Clock],
          [t("tasks.stat.released"), stats.liberados.toLocaleString(), CheckCircle2],
          [t("tasks.stat.refused"), stats.recusados.toLocaleString(), XCircle],
          [t("tasks.stat.valueReleased"), money(stats.valorTotal), AlertTriangle],
        ].map(([label, val, Icon]) => (
          <div key={label} className="vx-glass-panel vx-tile">
            <div className="vx-tile-top"><span>{label}</span><Icon size={17} strokeWidth={1.7} aria-hidden="true" /></div>
            <div className="vx-tile-val">{val}</div>
          </div>
        ))}
      </div>

      <div className="vx-card" style={{ padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 180px" }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-2)" }} />
            <input className="vx-input" style={{ paddingLeft: 28 }} placeholder={t("tasks.searchPlaceholder")}
              value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Filter size={14} style={{ color: "var(--text-2)", flexShrink: 0 }} />
          <select className="vx-input" style={{ flex: "1 1 150px", maxWidth: 200 }} value={filtroCampaign} onChange={(e) => setFiltroCampaign(e.target.value)}>
            <option value="">{t("tasks.allCampaigns")}</option>
            {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
          </select>
          <select className="vx-input" style={{ flex: "1 1 150px", maxWidth: 180 }} value={filtroSeller} onChange={(e) => setFiltroSeller(e.target.value)}>
            <option value="">{t("tasks.allPros")}</option>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <select className="vx-input" style={{ flex: "1 1 140px", maxWidth: 170 }} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">{t("tasks.allTypes")}</option>
            {ORDEM_ACOES.map((k) => <option key={k} value={k}>{ACOES[k]?.nome || k}</option>)}
          </select>
          <select className="vx-input" style={{ flex: "1 1 140px", maxWidth: 160 }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            {STATUS_FILTRO_KEYS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
          </select>
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div className="vx-card" style={{ padding: 40, textAlign: "center" }}>
          <Activity size={28} color="var(--muted)" style={{ marginBottom: 10 }} />
          <div className="vx-disp" style={{ fontSize: 15 }}>{t("tasks.noActivity")}</div>
          <div className="vx-mut" style={{ fontSize: 13, marginTop: 4 }}>{t("tasks.noActivityDesc")}</div>
        </div>
      ) : (
        <div className="vx-table-wrap">
          <table className="vx-table">
            <thead>
              <tr>
                <th>{t("tasks.th.type")}</th>
                <th>{t("misc.professional")}</th>
                <th>{t("tasks.th.campaign")}</th>
                <th>{t("tasks.th.date")}</th>
                <th style={{ textAlign: "right" }}>{t("tasks.th.value")}</th>
                <th>{t("tasks.th.status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.slice(0, 100).map((sub) => {
                const seller = db.sellers?.find((s) => s.id === sub.sellerId);
                const campanha = campanhas.find((c) => c.id === sub.campaignId);
                const acao = ACOES[sub.tipo];
                const Icon = acao?.Icon;
                return (
                  <tr key={sub.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13 }}>
                        {Icon && <Icon size={14} color="var(--brand)" />}
                        {acao?.nome || sub.tipo}
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{seller?.nome || sub.sellerId}</td>
                    <td style={{ fontSize: 12, color: "var(--text-2)" }}>{campanha?.titulo || "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--text-2)" }}>{dataCurta(sub.criadoEm)}</td>
                    <td style={{ textAlign: "right" }} className="vx-mono">{money(sub.valor || 0)}</td>
                    <td><ChipStatus status={sub.status} /></td>
                    <td>
                      {(sub.status === "revisao") && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="vx-btn vx-btn-sm" onClick={() => recusar(sub)}>{t("tasks.refuse")}</button>
                          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => liberar(sub)}>{t("tasks.release")}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visiveis.length > 100 && <div className="vx-chart-source" style={{ marginTop: 8 }}>{t("tasks.showing100", { total: visiveis.length })}</div>}
        </div>
      )}
    </div>
  );
}

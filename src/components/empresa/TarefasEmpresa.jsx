import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, Filter, Search, XCircle } from "lucide-react";
import { apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES, STATUS, MOTIVO_COR } from "../../lib/constants.js";

const STATUS_FILTRO = [
  ["", "Todos"],
  ["analisando", "Analisando"],
  ["revisao", "Revisão"],
  ["liberado", "Liberados"],
  ["recusado", "Recusados"],
  ["ia_aprovado", "Aprovados IA"],
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
    if (!r || r.error) return aviso(r?.error || "Não foi possível liberar.");
    aviso("Tarefa liberada.");
    recarregar?.();
  };

  const recusar = async (sub) => {
    const r = await apiPatch(`/submissions/${sub.id}`, { status: "recusado" });
    if (!r || r.error) return aviso(r?.error || "Não foi possível recusar.");
    aviso("Tarefa recusada.");
    recarregar?.();
  };

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Atividades comerciais</div>
          <h1 className="vx-disp">Tarefas</h1>
          <p>Acompanhe todas as atividades registradas pelos profissionais nas suas campanhas.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          ["Total", stats.total.toLocaleString("pt-BR"), Activity],
          ["Pendentes", stats.pendentes.toLocaleString("pt-BR"), Clock],
          ["Liberadas", stats.liberados.toLocaleString("pt-BR"), CheckCircle2],
          ["Recusadas", stats.recusados.toLocaleString("pt-BR"), XCircle],
          ["Valor liberado", money(stats.valorTotal), AlertTriangle],
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
            <input className="vx-input" style={{ paddingLeft: 28 }} placeholder="Buscar profissional ou campanha…"
              value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Filter size={14} style={{ color: "var(--text-2)", flexShrink: 0 }} />
          <select className="vx-input" style={{ flex: "1 1 150px", maxWidth: 200 }} value={filtroCampaign} onChange={(e) => setFiltroCampaign(e.target.value)}>
            <option value="">Todas as campanhas</option>
            {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
          </select>
          <select className="vx-input" style={{ flex: "1 1 150px", maxWidth: 180 }} value={filtroSeller} onChange={(e) => setFiltroSeller(e.target.value)}>
            <option value="">Todos os profissionais</option>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <select className="vx-input" style={{ flex: "1 1 140px", maxWidth: 170 }} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {ORDEM_ACOES.map((k) => <option key={k} value={k}>{ACOES[k]?.nome || k}</option>)}
          </select>
          <select className="vx-input" style={{ flex: "1 1 140px", maxWidth: 160 }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            {STATUS_FILTRO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div className="vx-card" style={{ padding: 40, textAlign: "center" }}>
          <Activity size={28} color="var(--muted)" style={{ marginBottom: 10 }} />
          <div className="vx-disp" style={{ fontSize: 15 }}>Nenhuma atividade encontrada</div>
          <div className="vx-mut" style={{ fontSize: 13, marginTop: 4 }}>Ajuste os filtros ou aguarde o início da operação.</div>
        </div>
      ) : (
        <div className="vx-table-wrap">
          <table className="vx-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Profissional</th>
                <th>Campanha</th>
                <th>Data</th>
                <th style={{ textAlign: "right" }}>Valor</th>
                <th>Status</th>
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
                          <button className="vx-btn vx-btn-sm" onClick={() => recusar(sub)}>Recusar</button>
                          <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => liberar(sub)}>Liberar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visiveis.length > 100 && <div className="vx-chart-source" style={{ marginTop: 8 }}>Exibindo 100 de {visiveis.length} registros. Use os filtros para refinar.</div>}
        </div>
      )}
    </div>
  );
}

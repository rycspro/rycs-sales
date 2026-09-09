import { useEffect, useMemo, useState } from "react";
import { ContactRound, Filter, TrendingUp } from "lucide-react";
import { api } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { ETAPAS, ORDEM_ETAPAS } from "../../../shared/pipeline.js";

export default function LeadsEmpresa({ emp, db }) {
  const locais = (db.leads || []).filter((l) => l.companyId === emp.id);
  const [leads, setLeads] = useState(locais);
  const [etapa, setEtapa] = useState("");
  useEffect(() => { api("/leads").then((r) => { if (Array.isArray(r)) setLeads(r); }); }, [emp.id]);
  const visiveis = useMemo(() => leads.filter((l) => !etapa || l.etapa === etapa), [leads, etapa]);
  const total = leads.reduce((s, l) => s + Number(l.valorEstimado || 0), 0);
  const ganhos = leads.filter((l) => l.etapa === "ganho").length;

  return <div className="vx-fade">
    <div className="vx-row" style={{ marginBottom: 16, alignItems: "flex-start" }}>
      <div><div className="vx-eyebrow">Execução comercial</div><h2 className="vx-disp" style={{ fontSize: 24, margin: "5px 0" }}>Leads da operação</h2><p className="vx-mut" style={{ margin: 0, fontSize: 13 }}>Acompanhe o funil criado pelos profissionais sem alterar o trabalho deles.</p></div>
      <span className="vx-chip"><ContactRound size={13} /> {leads.length} leads</span>
    </div>
    <div className="vx-grid vx-g4" style={{ marginBottom: 16 }}>
      <div className="vx-card" style={{ padding: 14 }}><div className="vx-mut" style={{ fontSize: 12 }}>Pipeline estimado</div><b className="vx-mono" style={{ fontSize: 19 }}>{money(total)}</b></div>
      <div className="vx-card" style={{ padding: 14 }}><div className="vx-mut" style={{ fontSize: 12 }}>Ganhos</div><b className="vx-mono" style={{ fontSize: 19 }}>{ganhos}</b></div>
      <div className="vx-card" style={{ padding: 14 }}><div className="vx-mut" style={{ fontSize: 12 }}>Conversão</div><b className="vx-mono" style={{ fontSize: 19 }}>{leads.length ? Math.round(ganhos / leads.length * 100) : 0}%</b></div>
      <div className="vx-card" style={{ padding: 14 }}><div className="vx-mut" style={{ fontSize: 12 }}>Campanhas</div><b className="vx-mono" style={{ fontSize: 19 }}>{new Set(leads.map((l) => l.campaignId).filter(Boolean)).size}</b></div>
    </div>
    <div className="vx-card" style={{ padding: 14, marginBottom: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Filter size={15} /><select className="vx-input" style={{ maxWidth: 240 }} value={etapa} onChange={(e) => setEtapa(e.target.value)}><option value="">Todas as etapas</option>{ORDEM_ETAPAS.map((e) => <option key={e} value={e}>{ETAPAS[e].nome}</option>)}</select></div></div>
    <div className="vx-grid">
      {!visiveis.length && <div className="vx-card" style={{ padding: 28, textAlign: "center" }}><TrendingUp size={26} color="var(--muted)" /><div className="vx-disp" style={{ marginTop: 8 }}>Nenhum lead nesta etapa</div><div className="vx-mut" style={{ fontSize: 13, marginTop: 4 }}>Os leads aparecem quando os profissionais começam a executar as campanhas.</div></div>}
      {visiveis.map((l) => <div key={l.id} className="vx-card vx-row" style={{ padding: 14, borderLeft: `3px solid ${ETAPAS[l.etapa]?.cor || "var(--muted)"}` }}><div style={{ minWidth: 0 }}><b>{l.nome}</b><div className="vx-mut" style={{ fontSize: 12 }}>{l.empresa || "Empresa não informada"}{l.cargo ? ` · ${l.cargo}` : ""}</div><div className="vx-mut" style={{ fontSize: 11.5, marginTop: 3 }}>Atualizado {dataCurta(l.atualizadoEm || l.criadoEm)}</div></div><div style={{ textAlign: "right" }}><span className="vx-badge">{ETAPAS[l.etapa]?.nome || l.etapa}</span><div className="vx-mono" style={{ fontSize: 12, marginTop: 5 }}>{money(l.valorEstimado || 0)}</div></div></div>)}
    </div>
  </div>;
}

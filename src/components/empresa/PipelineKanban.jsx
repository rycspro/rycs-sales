import { useState, useMemo } from "react";
import { ArrowRight, CircleDollarSign, Clock, GripVertical, Info, List, Kanban, Plus, Settings, Trash2, User } from "lucide-react";
import { api, apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { ETAPAS, ORDEM_ETAPAS } from "../../../shared/pipeline.js";
import { useI18n } from "../../lib/i18n.jsx";

// Etapas padrão quando a campanha não tem etapas customizadas
const ETAPAS_PADRAO_KEYS = [
  { id: "novo",      key: "pipeline.stage.firstContact", cor: "#8496B4" },
  { id: "contatado", key: "pipeline.stage.contacted", cor: "#5B8CFF" },
  { id: "respondeu", key: "pipeline.stage.replied", cor: "#9AA6FF" },
  { id: "reuniao",   key: "pipeline.stage.meeting", cor: "#9AA6FF" },
  { id: "proposta",  key: "pipeline.stage.proposal", cor: "#F0B45E" },
  { id: "fechado",   key: "pipeline.stage.closed", cor: "#5FD3A0" },
  { id: "perdido",   key: "pipeline.stage.lost", cor: "#FF8A7A" },
];

function etapasDaCampanha(campanha, t) {
  const eps = campanha?.etapasPipeline;
  if (Array.isArray(eps) && eps.length > 0) return eps;
  return ETAPAS_PADRAO_KEYS.map((e) => ({ id: e.id, nome: t(e.key), cor: e.cor }));
}

function corEtapa(etapaId, etapas) {
  const e = etapas.find((x) => x.id === etapaId);
  return e?.cor || ETAPAS[etapaId]?.cor || "#8496B4";
}

function nomeEtapa(etapaId, etapas) {
  const e = etapas.find((x) => x.id === etapaId);
  return e?.nome || ETAPAS[etapaId]?.nome || etapaId;
}

// --- Editor de etapas ---
export function EditorEtapas({ etapas, onChange, onClose }) {
  const { t } = useI18n();
  const [lista, setLista] = useState(etapas.map((e) => ({ ...e })));

  const atualizar = (i, campo, valor) => setLista((prev) => prev.map((e, idx) => idx === i ? { ...e, [campo]: valor } : e));
  const adicionar = () => setLista((prev) => [...prev, { id: `etapa_${Date.now()}`, nome: t("pipeline.editor.newStage"), cor: "#8496B4" }]);
  const remover = (i) => setLista((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
      <div className="vx-row" style={{ marginBottom: 12 }}>
        <div><b>{t("pipeline.editor.title")}</b><div className="vx-mut" style={{ fontSize: 12 }}>{t("pipeline.editor.hint")}</div></div>
        {onClose && <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose}>{t("misc.close")}</button>}
      </div>
      {lista.map((e, i) => (
        <div key={e.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <GripVertical size={14} color="var(--muted)" style={{ cursor: "grab" }} />
          <input
            className="vx-input" style={{ flex: 1 }} value={e.nome}
            onChange={(ev) => atualizar(i, "nome", ev.target.value)}
            placeholder={t("pipeline.editor.stageName")}
          />
          <input type="color" value={e.cor} style={{ width: 36, height: 36, border: "none", padding: 2, background: "transparent", cursor: "pointer" }}
            onChange={(ev) => atualizar(i, "cor", ev.target.value)} />
          <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => remover(i)} disabled={["fechado", "perdido"].includes(e.id)}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="vx-btn vx-btn-sm" onClick={adicionar}><Plus size={13} /> {t("pipeline.editor.addStage")}</button>
        <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => onChange(lista)}>{t("pipeline.editor.saveStages")}</button>
      </div>
    </div>
  );
}

// --- Modal de fechamento (ganho) ---
function ModalFechamento({ lead, onConfirm, onClose }) {
  const { t } = useI18n();
  const [valorVenda, setValorVenda] = useState("");

  const parseBRL = (s) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
  const formatBRL = (v) => v > 0 ? Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="vx-card" style={{ padding: 24, minWidth: 320, maxWidth: 440 }}>
        <div className="vx-disp" style={{ fontSize: 17, marginBottom: 4 }}>{t("pipeline.closing.title")}</div>
        <div className="vx-mut" style={{ fontSize: 13, marginBottom: 16 }}>{t("pipeline.closing.desc")}</div>
        <label>
          <span className="vx-label">{t("pipeline.closing.saleValue")}</span>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-2)", fontSize: 13.5, pointerEvents: "none" }}>R$</span>
            <input className="vx-input vx-mono" style={{ paddingLeft: 30 }} inputMode="decimal"
              value={valorVenda} onChange={(e) => setValorVenda(e.target.value)}
              placeholder="0,00" />
          </div>
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="vx-btn vx-btn-ghost" onClick={onClose}>{t("misc.cancel")}</button>
          <button className="vx-btn vx-btn-primary" onClick={() => onConfirm(parseBRL(valorVenda))} disabled={parseBRL(valorVenda) <= 0}>
            <CircleDollarSign size={14} /> {t("pipeline.closing.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Card do lead no Kanban ---
function LeadCard({ lead, etapas, onMover, sellers = [] }) {
  const seller = sellers.find((s) => s.id === lead.sellerId);
  const cor = corEtapa(lead.etapa, etapas);
  return (
    <div className="vx-card" style={{ padding: 12, marginBottom: 8, borderLeft: `3px solid ${cor}`, cursor: "pointer" }}>
      <b style={{ fontSize: 13 }}>{lead.nome}</b>
      {lead.empresa && <div className="vx-mut" style={{ fontSize: 11.5 }}>{lead.empresa}</div>}
      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
        {seller && <span className="vx-chip" style={{ fontSize: 11 }}><User size={10} /> {seller.nome}</span>}
        {lead.valorEstimado > 0 && <span className="vx-chip" style={{ fontSize: 11 }}><CircleDollarSign size={10} /> {money(lead.valorEstimado)}</span>}
        {lead.atualizadoEm && <span className="vx-chip" style={{ fontSize: 11 }}><Clock size={10} /> {dataCurta(lead.atualizadoEm)}</span>}
      </div>
      {lead.proximaAcao && <div className="vx-mut" style={{ fontSize: 11, marginTop: 4 }}>→ {lead.proximaAcao}</div>}
      <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
        {etapas.filter((e) => e.id !== lead.etapa).slice(0, 3).map((e) => (
          <button key={e.id} className="vx-btn vx-btn-ghost vx-btn-sm"
            style={{ fontSize: 10, padding: "2px 7px", borderColor: e.cor }}
            onClick={() => onMover(lead, e.id)}>
            → {e.nome}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PipelineKanban({ campanha, leads = [], sellers = [], aviso, onLeadsAtualizado }) {
  const { t } = useI18n();
  const [modo, setModo] = useState("kanban");
  const [editandoEtapas, setEditandoEtapas] = useState(false);
  const [filtroSeller, setFiltroSeller] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [modalFechamento, setModalFechamento] = useState(null);

  const etapas = useMemo(() => etapasDaCampanha(campanha, t), [campanha, t]);

  const leadsFiltrados = useMemo(() => leads.filter((l) => {
    if (filtroSeller && l.sellerId !== filtroSeller) return false;
    if (filtroEtapa && l.etapa !== filtroEtapa) return false;
    return true;
  }), [leads, filtroSeller, filtroEtapa]);

  const porEtapa = useMemo(() => {
    const m = {};
    for (const e of etapas) m[e.id] = [];
    for (const l of leadsFiltrados) {
      if (m[l.etapa]) m[l.etapa].push(l);
      else { if (!m["novo"]) m["novo"] = []; m["novo"].push(l); }
    }
    return m;
  }, [leadsFiltrados, etapas]);

  const moverLead = async (lead, novaEtapa) => {
    if (novaEtapa === "fechado" || novaEtapa === "ganho") {
      setModalFechamento({ lead, novaEtapa });
      return;
    }
    const r = await api(`/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ etapa: novaEtapa }) }).catch(() => null);
    if (r?.error) { aviso(r.error); return; }
    onLeadsAtualizado?.();
  };

  const confirmarFechamento = async (valorVenda) => {
    const { lead, novaEtapa } = modalFechamento;
    setModalFechamento(null);
    const r = await apiPatch(`/leads/${lead.id}`, { etapa: novaEtapa, valorVenda }).catch(() => null);
    if (r?.error) { aviso(r.error); return; }
    aviso(t("pipeline.closing.done", { value: money(valorVenda) }));
    onLeadsAtualizado?.();
  };

  const salvarEtapas = async (novasEtapas) => {
    const r = await apiPatch(`/campaigns/${campanha.id}`, { etapasPipeline: novasEtapas }).catch(() => null);
    if (r?.error) { aviso(r.error); return; }
    setEditandoEtapas(false);
    aviso(t("pipeline.editor.saved"));
    onLeadsAtualizado?.();
  };

  return (
    <div className="vx-fade">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <button className={`vx-btn vx-btn-sm ${modo === "kanban" ? "vx-btn-primary" : "vx-btn-ghost"}`} onClick={() => setModo("kanban")}><Kanban size={13} /> Kanban</button>
        <button className={`vx-btn vx-btn-sm ${modo === "lista" ? "vx-btn-primary" : "vx-btn-ghost"}`} onClick={() => setModo("lista")}><List size={13} /> {t("pipeline.list")}</button>
        <button className="vx-btn vx-btn-ghost vx-btn-sm" onClick={() => setEditandoEtapas(!editandoEtapas)}><Settings size={13} /> {t("pipeline.stages")}</button>
        <select className="vx-input" style={{ maxWidth: 180, fontSize: 12 }} value={filtroSeller} onChange={(e) => setFiltroSeller(e.target.value)}>
          <option value="">{t("pipeline.allSellers")}</option>
          {sellers.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select className="vx-input" style={{ maxWidth: 160, fontSize: 12 }} value={filtroEtapa} onChange={(e) => setFiltroEtapa(e.target.value)}>
          <option value="">{t("pipeline.allStages")}</option>
          {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {editandoEtapas && <EditorEtapas etapas={etapas} onChange={salvarEtapas} onClose={() => setEditandoEtapas(false)} />}

      {modo === "kanban" ? (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {etapas.map((etapa) => (
            <div key={etapa.id} style={{ minWidth: 220, maxWidth: 260, flex: "0 0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "6px 10px", borderRadius: 6, background: `${etapa.cor}20`, borderLeft: `3px solid ${etapa.cor}` }}>
                <b style={{ fontSize: 12, color: etapa.cor }}>{etapa.nome}</b>
                <span className="vx-chip" style={{ fontSize: 10, marginLeft: "auto" }}>{(porEtapa[etapa.id] || []).length}</span>
              </div>
              {(porEtapa[etapa.id] || []).map((lead) => (
                <LeadCard key={lead.id} lead={lead} etapas={etapas} sellers={sellers} onMover={moverLead} />
              ))}
              {!(porEtapa[etapa.id] || []).length && (
                <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 12, border: "1px dashed var(--border)", borderRadius: 8 }}>{t("pipeline.empty")}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="vx-table-wrap">
          <table className="vx-table">
            <thead><tr><th>Lead</th><th>{t("pipeline.th.stage")}</th><th>{t("pipeline.th.owner")}</th><th>{t("pipeline.th.estValue")}</th><th>{t("pipeline.th.updated")}</th><th>{t("pipeline.th.action")}</th></tr></thead>
            <tbody>
              {leadsFiltrados.map((l) => {
                const seller = sellers.find((s) => s.id === l.sellerId);
                const cor = corEtapa(l.etapa, etapas);
                return (
                  <tr key={l.id}>
                    <td><b>{l.nome}</b>{l.empresa && <div className="vx-mut" style={{ fontSize: 11 }}>{l.empresa}</div>}</td>
                    <td><span className="vx-badge" style={{ background: `${cor}20`, color: cor }}>{nomeEtapa(l.etapa, etapas)}</span></td>
                    <td>{seller?.nome || "—"}</td>
                    <td className="vx-mono">{money(l.valorEstimado || 0)}</td>
                    <td>{dataCurta(l.atualizadoEm)}</td>
                    <td>
                      <select className="vx-input" style={{ fontSize: 11, padding: "2px 6px" }} value={l.etapa}
                        onChange={(e) => moverLead(l, e.target.value)}>
                        {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {!leadsFiltrados.length && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>{t("pipeline.noLeads")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modalFechamento && (
        <ModalFechamento
          lead={modalFechamento.lead}
          onConfirm={confirmarFechamento}
          onClose={() => setModalFechamento(null)}
        />
      )}
    </div>
  );
}

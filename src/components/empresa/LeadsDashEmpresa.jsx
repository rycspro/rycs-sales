import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Filter } from "lucide-react";
import { Vazio } from "../ui.jsx";
import { money, dataCurta } from "../../lib/utils.js";
import { STATUS_CLIENTE } from "./ConferirEmpresa.jsx";
import { STATUS } from "../../lib/constants.js";

const TIPO_LABEL = {
  agendamento: "Reunião agendada",
  realizada: "Visita realizada",
  venda: "Venda fechada",
  lead: "Lead gerado",
  contato: "Contato",
  follow: "Follow-up",
  ligacao: "Ligação",
  visita: "Visita",
};

function tempoRelativo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - Number(ts);
  const seg = Math.floor(diff / 1000);
  if (seg < 60) return "agora";
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function capitalizar(nome = "") {
  return String(nome).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function iniciais(nome = "") {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("") || "?";
}

function MiniAvatar({ seller }) {
  const nome = capitalizar(seller?.nome || "");
  if (seller?.foto) {
    const src = typeof seller.foto === "string" && seller.foto.startsWith("data:")
      ? seller.foto
      : `/api/sellers/${seller.id}/foto`;
    return (
      <img src={src} alt={nome} loading="lazy" style={{
        width: 30, height: 30, borderRadius: "50%", objectFit: "cover",
        border: "2px solid var(--surface-2)", flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: 30, height: 30, borderRadius: "50%", background: "var(--brand)",
      display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700,
      color: "#fff", flexShrink: 0, fontFamily: "var(--font-disp)",
    }}>
      {iniciais(seller?.nome)}
    </div>
  );
}

function BadgeStatus({ status }) {
  const st = STATUS[status] || STATUS.analisando;
  const cores = {
    indigo: { bg: "#EEF2FF", cor: "#3730A1" },
    amber:  { bg: "#FFFBEB", cor: "#92400E" },
    red:    { bg: "#FEF2F2", cor: "#B91C1C" },
    brand:  { bg: "#F0FDF4", cor: "#166534" },
    muted:  { bg: "#F1F5F9", cor: "#64748B" },
  };
  const c = cores[st.tone] || cores.muted;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, borderRadius: 20,
      padding: "3px 10px", background: c.bg, color: c.cor,
      whiteSpace: "nowrap",
    }}>{st.txt}</span>
  );
}

function BadgeCliente({ statusCliente }) {
  const st = STATUS_CLIENTE[statusCliente] || STATUS_CLIENTE.aguardando;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, borderRadius: 20,
      padding: "3px 10px", background: st.bg, color: st.cor,
      border: `1.5px solid ${st.cor}30`, whiteSpace: "nowrap",
    }}>{st.label}</span>
  );
}

const TH = ({ children, right }) => (
  <th style={{
    padding: "10px 12px", fontSize: 11.5, fontWeight: 600,
    color: "var(--muted)", textAlign: right ? "right" : "left",
    whiteSpace: "nowrap", borderBottom: "1.5px solid var(--border)",
    background: "var(--surface-2)",
  }}>{children}</th>
);

const TD = ({ children, right, muted }) => (
  <td style={{
    padding: "10px 12px", fontSize: 13,
    color: muted ? "var(--muted)" : "var(--ink)",
    textAlign: right ? "right" : "left",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
  }}>{children}</td>
);

export default function LeadsDashEmpresa({ emp, db, recarregar }) {
  const [atualizadoEm, setAtualizadoEm] = useState(Date.now());
  const [refrescando, setRefrescando] = useState(false);
  const [filtroVendedor, setFiltroVendedor] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  const refrescar = useCallback(async () => {
    if (refrescando) return;
    setRefrescando(true);
    await recarregar?.();
    setAtualizadoEm(Date.now());
    setRefrescando(false);
  }, [recarregar, refrescando]);

  useEffect(() => {
    const id = setInterval(refrescar, 30000);
    return () => clearInterval(id);
  }, [refrescar]);

  const todasSubs = (db.submissions || []).filter((s) => s.companyId === emp.id);

  const vendedoresPresentes = [...new Map(
    todasSubs.map((s) => {
      const v = db.sellers?.find((x) => x.id === s.sellerId);
      return [s.sellerId, { id: s.sellerId, nome: capitalizar(v?.nome || "Profissional") }];
    })
  ).values()].sort((a, b) => a.nome.localeCompare(b.nome));

  const tiposPresentes = [...new Set(todasSubs.map((s) => s.tipo).filter(Boolean))];

  const lista = todasSubs
    .filter((s) => {
      if (filtroVendedor && s.sellerId !== filtroVendedor) return false;
      if (filtroTipo && s.tipo !== filtroTipo) return false;
      if (filtroStatus && s.statusCliente !== filtroStatus) return false;
      return true;
    })
    .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

  const temFiltro = filtroVendedor || filtroTipo || filtroStatus;

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 16, alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 className="vx-disp" style={{ fontSize: 18, margin: 0, flex: 1 }}>Leads</h2>
        <span style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: refrescando ? "var(--amber)" : "var(--brand)",
            display: "inline-block", animation: refrescando ? "pulse 1s infinite" : "none",
          }} />
          {refrescando ? "Atualizando…" : `Atualizado ${tempoRelativo(atualizadoEm)}`}
        </span>
        <button
          className="vx-btn vx-btn-sm"
          onClick={refrescar}
          disabled={refrescando}
          style={{ display: "flex", alignItems: "center", gap: 5 }}
        >
          <RefreshCw size={13} style={{ animation: refrescando ? "spin 1s linear infinite" : "none" }} />
          Atualizar
        </button>
      </div>

      <div className="vx-row" style={{ marginBottom: 16, gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Filter size={14} color="var(--muted)" />
        <select
          className="vx-input"
          value={filtroVendedor}
          onChange={(e) => setFiltroVendedor(e.target.value)}
          style={{ fontSize: 13, padding: "5px 10px", minWidth: 160 }}
        >
          <option value="">Todos os vendedores</option>
          {vendedoresPresentes.map((v) => (
            <option key={v.id} value={v.id}>{v.nome}</option>
          ))}
        </select>
        <select
          className="vx-input"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          style={{ fontSize: 13, padding: "5px 10px", minWidth: 160 }}
        >
          <option value="">Todos os tipos</option>
          {tiposPresentes.map((t) => (
            <option key={t} value={t}>{TIPO_LABEL[t] || t}</option>
          ))}
        </select>
        <select
          className="vx-input"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          style={{ fontSize: 13, padding: "5px 10px", minWidth: 160 }}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CLIENTE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {temFiltro && (
          <button
            className="vx-btn vx-btn-sm"
            onClick={() => { setFiltroVendedor(""); setFiltroTipo(""); setFiltroStatus(""); }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {!lista.length ? (
        <Vazio
          titulo={temFiltro ? "Nenhum resultado" : "Nenhuma ação registrada ainda"}
          texto={temFiltro ? "Ajuste os filtros para ver outros registros." : "Quando os vendedores aprovados registrarem ações, elas aparecerão aqui em tempo real."}
        />
      ) : (
        <div className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  <TH>Vendedor</TH>
                  <TH>Campanha / Ação</TH>
                  <TH>Status do cliente</TH>
                  <TH>Aprovação</TH>
                  <TH right>Valor</TH>
                  <TH>Quando</TH>
                </tr>
              </thead>
              <tbody>
                {lista.map((sub) => {
                  const seller = db.sellers?.find((s) => s.id === sub.sellerId);
                  const camp = db.campaigns?.find((c) => c.id === sub.campaignId);
                  return (
                    <tr
                      key={sub.id}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                      style={{ transition: "background .1s" }}
                    >
                      <TD>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <MiniAvatar seller={seller} />
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            {capitalizar(seller?.nome || "Profissional")}
                          </span>
                        </div>
                      </TD>
                      <TD>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>
                          {TIPO_LABEL[sub.tipo] || sub.tipo || "—"}
                        </div>
                        {camp?.titulo && (
                          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                            {camp.titulo}
                          </div>
                        )}
                      </TD>
                      <TD><BadgeCliente statusCliente={sub.statusCliente || "aguardando"} /></TD>
                      <TD><BadgeStatus status={sub.status} /></TD>
                      <TD right>
                        <span style={{ fontWeight: 600, color: "var(--brand)" }}>
                          {money(sub.valor)}
                        </span>
                      </TD>
                      <TD muted>
                        <span title={dataCurta(sub.criadoEm)}>
                          {tempoRelativo(sub.criadoEm)}
                        </span>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
            {lista.length} {lista.length === 1 ? "registro" : "registros"}
            {temFiltro ? " (filtrado)" : ""}
          </div>
        </div>
      )}
    </div>
  );
}

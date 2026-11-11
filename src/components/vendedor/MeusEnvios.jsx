import { useState } from "react";
import { Vazio } from "../ui.jsx";
import CardEnvio from "../CardEnvio.jsx";
import { apiPatch } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { STATUS_CLIENTE } from "../empresa/ConferirEmpresa.jsx";
import { ACOES, STATUS } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";

function capitalizar(nome = "") {
  return String(nome).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function iniciais(nome = "") {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("") || "?";
}

function DropdownStatus({ subId, valor, onChange }) {
  const [salvando, setSalvando] = useState(false);

  const atualizar = async (novoStatus) => {
    setSalvando(true);
    const r = await apiPatch(`/submissions/${subId}`, { statusCliente: novoStatus });
    setSalvando(false);
    if (!r?.error) onChange(novoStatus);
  };

  const st = STATUS_CLIENTE[valor] || STATUS_CLIENTE.aguardando;

  return (
    <select
      value={valor || "aguardando"}
      onChange={(e) => atualizar(e.target.value)}
      disabled={salvando}
      style={{
        appearance: "none", WebkitAppearance: "none",
        background: st.bg, color: st.cor,
        border: `1.5px solid ${st.cor}30`,
        borderRadius: 20, padding: "4px 10px",
        fontSize: 11.5, fontWeight: 600, cursor: "pointer",
        outline: "none", fontFamily: "inherit",
        opacity: salvando ? 0.6 : 1,
      }}
    >
      {Object.entries(STATUS_CLIENTE).map(([k, v]) => (
        <option key={k} value={k}>{v.label}</option>
      ))}
    </select>
  );
}

const TH = ({ children, right }) => (
  <th style={{ padding: "10px 12px", fontSize: 11.5, fontWeight: 600, color: "var(--muted)", textAlign: right ? "right" : "left", whiteSpace: "nowrap", borderBottom: "1.5px solid var(--border)", background: "var(--surface-2)" }}>
    {children}
  </th>
);

const TD = ({ children, right, muted }) => (
  <td style={{ padding: "10px 12px", fontSize: 13, color: muted ? "var(--muted)" : "var(--ink)", textAlign: right ? "right" : "left", borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}>
    {children}
  </td>
);

function TabelaMeusEnvios({ lista, db, up, empresa, pedirRevisao }) {
  const { t } = useI18n();

  if (!lista.length)
    return <Vazio titulo={t("seller.submissions.emptyTitle")} texto={t("seller.submissions.emptyDesc")} />;

  return (
    <div className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr>
              <TH>{t("seller.submissions.company")}</TH>
              <TH>{t("seller.submissions.action")}</TH>
              <TH right>{t("seller.submissions.value")}</TH>
              <TH>{t("seller.submissions.date")}</TH>
              <TH>{t("seller.submissions.clientStatus")}</TH>
              <TH>{t("seller.submissions.approval")}</TH>
            </tr>
          </thead>
          <tbody>
            {[...lista].sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0)).map((sub) => {
              const camp = (db.campaigns || []).find((c) => c.id === sub.campaignId);
              const emp = (db.companies || []).find((c) => c.id === sub.companyId);
              const st = STATUS[sub.status] || STATUS.analisando;
              return (
                <tr key={sub.id}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                  style={{ transition: "background .1s" }}
                >
                  <TD>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{capitalizar(emp?.nome || t("seller.submissions.companyFallback"))}</div>
                    {camp?.titulo && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{camp.titulo}</div>}
                  </TD>
                  <TD>{t(`seller.submissions.types.${sub.tipo}`, {}, sub.tipo || "—")}</TD>
                  <TD right><span style={{ fontWeight: 600, color: "var(--brand)" }}>{money(sub.valor)}</span></TD>
                  <TD muted>{dataCurta(sub.criadoEm)}</TD>
                  <TD>
                    <DropdownStatus
                      subId={sub.id}
                      valor={sub.statusCliente || "aguardando"}
                      onChange={(novoStatus) => up((d) => ({
                        submissions: d.submissions.map((s) => s.id === sub.id ? { ...s, statusCliente: novoStatus } : s),
                      }))}
                    />
                  </TD>
                  <TD>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      <span style={{
                        fontSize: 11.5, fontWeight: 600, borderRadius: 20, padding: "3px 10px",
                        background: st.tone === "indigo" ? "#EEF2FF" : st.tone === "amber" ? "#FFFBEB" : st.tone === "red" ? "#FEF2F2" : st.tone === "brand" ? "#F0FDF4" : "#F1F5F9",
                        color: st.tone === "indigo" ? "#3730A1" : st.tone === "amber" ? "#92400E" : st.tone === "red" ? "#B91C1C" : st.tone === "brand" ? "#166534" : "#64748B",
                      }}>{st.txt}</span>
                      {sub.status === "ia_recusado" && pedirRevisao && (
                        <button className="vx-btn vx-btn-sm" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => pedirRevisao(sub)}>
                          {t("seller.submissions.requestReview")}
                        </button>
                      )}
                    </div>
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MeusEnvios({ empresa, eu, db, up, pedirRevisao }) {
  const lista = db.submissions.filter((s) => s.sellerId === eu.id && (!empresa || s.companyId === empresa.id));
  return <TabelaMeusEnvios lista={lista} db={db} up={up} empresa={empresa} pedirRevisao={pedirRevisao} />;
}

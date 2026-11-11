import { useState } from "react";
import { Briefcase, MapPin, Users, Target, Wallet, Building2, ChevronRight } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";

export default function Oportunidades({ eu, db, aviso, recarregar, abrirCampanha }) {
  const { t } = useI18n();
  const [candidatando, setCandidatando] = useState(null);

  const campanhas = (db.campaigns || []).filter((c) => c.status === "ativa");
  const empresasMap = {};
  for (const c of db.companies || []) empresasMap[c.id] = c;

  const candidatar = async (campanha) => {
    setCandidatando(campanha.id);
    const r = await api(`/campaigns/${campanha.id}/apply`, {});
    setCandidatando(null);
    if (r?.error) return aviso(r.error);
    aviso(t("seller.opportunities.applicationSent"));
    recarregar?.();
  };

  const statusCandidatura = (campanha) => {
    const cands = campanha.candidaturas || [];
    if (!cands.length) return null;
    return cands[0]?.status;
  };

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="vx-disp" style={{ fontSize: 19, margin: 0 }}>{t("seller.opportunities.title")}</h2>
          <p className="vx-mut" style={{ fontSize: 13, marginTop: 4 }}>
            {t("seller.opportunities.subtitle")}
          </p>
        </div>
        <span className="vx-chip vx-mono">{campanhas.length}</span>
      </div>

      {campanhas.length === 0 && (
        <div className="vx-vazio">
          <Target size={36} color="var(--muted)" />
          <div className="vx-disp" style={{ fontSize: 17, marginTop: 10 }}>{t("seller.opportunities.emptyTitle")}</div>
          <p className="vx-mut" style={{ fontSize: 13 }}>{t("seller.opportunities.emptyDesc")}</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {campanhas.map((c) => {
          const empresa = empresasMap[c.companyId] || {};
          const st = statusCandidatura(c);
          const comissoes = typeof c.comissoes === "string" ? JSON.parse(c.comissoes || "{}") : (c.comissoes || {});
          const comissoesAtivas = ORDEM_ACOES.filter((k) => comissoes[k]);

          return (
            <div key={c.id} className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{
                padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14,
                borderBottom: "1px solid var(--border)",
              }}>
                <div style={{ flex: "none" }}>
                  {empresa.logo ? (
                    <img src={empresa.logo} alt="" style={{
                      width: 44, height: 44, borderRadius: 10, objectFit: "cover",
                    }} />
                  ) : (
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: empresa.cor || "var(--brand)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 14, fontWeight: 700,
                    }}>
                      {String(empresa.nome || "?").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
                    {c.titulo || t("seller.opportunities.untitled")}
                  </div>
                  <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {empresa.nome}
                  </div>
                </div>

                {st === "aprovado" && (
                  <span className="vx-badge" style={{ background: "var(--green-50)", color: "var(--green)", fontSize: 11, flex: "none" }}>
                    {t("seller.opportunities.approved")}
                  </span>
                )}
                {st === "pendente" && (
                  <span className="vx-badge" style={{ background: "var(--amber-50)", color: "var(--amber)", fontSize: 11, flex: "none" }}>
                    {t("seller.opportunities.underReview")}
                  </span>
                )}
              </div>

              {c.descricao && (
                <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-light)" }}>
                  <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                    {c.descricao.length > 200 ? c.descricao.slice(0, 200) + "…" : c.descricao}
                  </p>
                </div>
              )}

              <div style={{
                padding: "12px 20px", display: "flex", gap: 16, flexWrap: "wrap",
                borderBottom: "1px solid var(--border-light)",
              }}>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div className="vx-eyebrow" style={{ fontSize: 10.5 }}>{t("seller.opportunities.campaignBalance")}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--brand)", marginTop: 2 }}>
                    <Wallet size={13} style={{ marginRight: 4, verticalAlign: "-1px" }} />
                    {money(c.orcamento || 0)}
                  </div>
                </div>
                {comissoesAtivas.length > 0 && (
                  <div style={{ flex: 2, minWidth: 140 }}>
                    <div className="vx-eyebrow" style={{ fontSize: 10.5 }}>{t("seller.opportunities.valuePerTask")}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                      {comissoesAtivas.map((k) => (
                        <span key={k} className="vx-chip vx-mono" style={{ fontSize: 11.5 }}>
                          {ACOES[k]?.nome || k} <b style={{ color: "var(--brand)" }}>{money(comissoes[k])}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{
                padding: "10px 20px", display: "flex", flexWrap: "wrap", gap: 14,
                fontSize: 12, color: "var(--muted)",
              }}>
                {c.funcao && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Briefcase size={12} /> {c.funcao}
                  </span>
                )}
                {c.regiao && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={12} /> {c.regiao}
                  </span>
                )}
                {c.vagas > 0 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Users size={12} /> {c.vagas} {c.vagas > 1 ? t("seller.opportunities.slotsPlural") : t("seller.opportunities.slot")}
                  </span>
                )}
                {c.objetivo && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Target size={12} /> {c.objetivo}
                  </span>
                )}
              </div>

              <div style={{ padding: "12px 20px" }}>
                {st === "aprovado" ? (
                  <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => abrirCampanha?.(c)}>
                    {t("seller.opportunities.accessCampaign")} <ChevronRight size={14} />
                  </button>
                ) : st === "pendente" ? (
                  <button className="vx-btn vx-btn-block" disabled>{t("seller.opportunities.applicationPending")}</button>
                ) : st === "recusado" ? (
                  <button className="vx-btn vx-btn-block" onClick={() => candidatar(c)}
                    disabled={candidatando === c.id}>
                    {candidatando === c.id ? t("common.sending") : t("seller.opportunities.tryAgain")}
                  </button>
                ) : (
                  <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => candidatar(c)}
                    disabled={candidatando === c.id}>
                    {candidatando === c.id ? t("common.sending") : t("seller.opportunities.apply")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

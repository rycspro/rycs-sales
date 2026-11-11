import { useEffect, useMemo, useState } from "react";
import { Search, AlertTriangle, Gift, Link2, Copy } from "lucide-react";
import { api } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";
import { ORDEM_PLANOS, PLANOS } from "../../../shared/planos.js";
import { useI18n } from "../../lib/i18n.jsx";

// Cobrança das empresas, na visão da plataforma.
//
// Lista TODAS as empresas, inclusive as que nunca assinaram. Mostrar só quem
// tem assinatura esconderia exatamente o grupo que a operação precisa ver: as
// empresas usando a RYCS sem pagar.

const TONS = {
  ativa: "brand",
  premium: "brand",
  trial: "brand",
  pendente: "amber",
  inadimplente: "red",
  sem: "muted",
};

export default function AssinaturasAdmin() {
  const { t } = useI18n();
  const ROTULOS = {
    ativa: t("admin.subs.statusActive"), premium: "Premium", trial: "Trial",
    pendente: t("admin.subs.statusPending"), inadimplente: t("admin.subs.statusOverdue"),
    sem: t("admin.subs.statusNone"),
  };
  const FILTROS = [
    ["todos", t("admin.subs.filterAll")], ["ativa", t("admin.subs.filterActive")],
    ["premium", "Premium"], ["trial", "Trial"],
    ["pendente", t("admin.subs.filterPending")], ["inadimplente", t("admin.subs.filterOverdue")],
    ["sem", t("admin.subs.statusNone")],
  ];
  const [dados, setDados] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [planosTrial, setPlanosTrial] = useState({});
  const [liberando, setLiberando] = useState("");

  // Convite por link: gerado aqui, entregue por fora. O token aparece uma vez
  // só — o servidor guarda apenas o hash e não tem como exibi-lo de novo.
  const [convite, setConvite] = useState(null);
  const [gerando, setGerando] = useState(false);

  const gerarLink = async () => {
    setGerando(true);
    const r = await api("/admin/trial-links", { dias: 7 });
    setGerando(false);
    if (r?.error) return window.alert(r.error);
    setConvite(r);
  };

  const carregar = () => api("/admin/subscriptions").then((r) => setDados(r || { linhas: [], resumo: {} }));
  useEffect(() => { carregar(); }, []);

  const planosPagos = ORDEM_PLANOS.filter((chave) => PLANOS[chave]?.preco > 0);
  const liberarTrial = async (linha) => {
    const plano = planosTrial[linha.companyId] || planosPagos[0]?.chave;
    if (!plano || !window.confirm(t("admin.subs.confirmTrial", { plan: PLANOS[plano].nome, company: linha.empresa }))) return;
    setLiberando(linha.companyId);
    const r = await api(`/admin/subscriptions/${linha.companyId}/secret-trial`, { plano });
    setLiberando("");
    if (r?.error) return window.alert(r.error);
    await carregar();
  };

  const linhas = useMemo(() => {
    let l = dados?.linhas || [];
    if (filtro !== "todos") l = l.filter((x) => x.estado === filtro);
    if (busca) {
      const q = busca.toLowerCase();
      l = l.filter((x) => x.empresa.toLowerCase().includes(q));
    }
    return l;
  }, [dados, filtro, busca]);

  if (!dados) return <div className="vx-fade"><div className="vx-mut" style={{ fontSize: 13 }}>{t("common.loading")}</div></div>;

  const resumo = dados.resumo || {};

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="vx-disp" style={{ fontSize: 22 }}>{t("admin.subs.title")}</div>
          <span className="vx-badge vx-badge-muted">{dados.total} {t("admin.subs.companies")}</span>
        </div>
        <button className="vx-btn vx-btn-sm" onClick={gerarLink} disabled={gerando}>
          <Link2 size={13} /> {gerando ? t("admin.subs.generating") : t("admin.subs.generateTrial")}
        </button>
      </div>

      {convite && (
        <div className="vx-card" style={{ padding: 16, marginBottom: 16, borderColor: "var(--brand)", background: "var(--brand-50)" }}>
          <div className="vx-eyebrow" style={{ color: "var(--brand)", marginBottom: 7 }}>
            {t("admin.subs.trialLinkTitle", { days: convite.dias })}
          </div>
          <div className="vx-mono" style={{
            fontSize: 12, wordBreak: "break-all", background: "var(--surface)",
            border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", lineHeight: 1.5,
          }}>{convite.url}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="vx-btn vx-btn-primary vx-btn-sm"
              onClick={() => { navigator.clipboard?.writeText(convite.url); window.alert(t("admin.subs.linkCopied")); }}>
              <Copy size={13} /> {t("admin.subs.copyLink")}
            </button>
            <button className="vx-btn vx-btn-sm" onClick={() => setConvite(null)}>{t("common.close")}</button>
          </div>
          <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.6 }}>
            {convite.aviso} Vale para uma única empresa, expira em {new Date(convite.expiraEm).toLocaleDateString("pt-BR")},
            e quem resgatar escolhe qualquer plano sem informar cartão.
          </div>
        </div>
      )}

      {/* Quem não está pagando é o número que a operação abre a tela para ver */}
      {(resumo.sem > 0 || resumo.inadimplente > 0) && (
        <div className="vx-card" style={{ padding: "13px 16px", marginBottom: 16, borderColor: "var(--amber)", background: "rgba(240,180,94,.07)" }}>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <AlertTriangle size={16} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
              {resumo.sem > 0 && <><b>{resumo.sem}</b> {t("admin.subs.noSubWarning")} </>}
              {resumo.inadimplente > 0 && <><b>{resumo.inadimplente}</b> {t("admin.subs.overdueWarning")}</>}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--muted)" }} />
          <input className="vx-input" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder={t("admin.subs.searchCompany")} style={{ paddingLeft: 32 }} />
        </div>
        <div className="vx-seg">
          {FILTROS.map(([k, label]) => (
            <button key={k} data-on={filtro === k ? "1" : "0"} onClick={() => setFiltro(k)}>
              {label}{k !== "todos" && resumo[k] ? ` ${resumo[k]}` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
            <thead>
              <tr>
                {[t("admin.subs.colCompany"), t("admin.subs.colPlan"), t("admin.subs.colAmount"), "Status", t("admin.subs.colNextBilling"), t("admin.subs.colAction")].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i === 2 ? "right" : "left", padding: "11px 14px",
                    fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase",
                    color: "var(--muted)", fontWeight: 600, borderBottom: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.companyId}>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)", fontSize: 13.5, fontWeight: 500 }}>
                    {l.empresa}
                    {l.cartaoFinal && <div className="vx-mut vx-mono" style={{ fontSize: 11 }}>•••• {l.cartaoFinal}</div>}
                  </td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                    {l.plano || <span className="vx-mut">—</span>}
                  </td>
                  <td className="vx-mono" style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)", fontSize: 13, textAlign: "right" }}>
                    {l.valor ? money(l.valor) : <span className="vx-mut">—</span>}
                  </td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)" }}>
                    <span className={`vx-badge vx-badge-${TONS[l.estado]}`}>{ROTULOS[l.estado]}</span>
                    {l.falhaMotivo && <div className="vx-mut" style={{ fontSize: 11, marginTop: 3 }}>{l.falhaMotivo}</div>}
                  </td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                    {l.proximaCobranca
                      ? <>{dataCurta(l.proximaCobranca)}{l.estado === "trial" && <div className="vx-mut" style={{ fontSize: 11 }}>{t("admin.subs.trialEnd")}</div>}</>
                      : <span className="vx-mut">—</span>}
                  </td>
                  <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)", minWidth: 210 }}>
                    {l.trialElegivel ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <select className="vx-input" aria-label={t("admin.subs.trialPlanFor", { company: l.empresa })}
                          value={planosTrial[l.companyId] || planosPagos[0]?.chave || ""}
                          onChange={(e) => setPlanosTrial((atual) => ({ ...atual, [l.companyId]: e.target.value }))}
                          style={{ minWidth: 0, padding: "6px 8px", fontSize: 12 }}>
                          {planosPagos.map((chave) => <option key={chave} value={chave}>{PLANOS[chave].nome}</option>)}
                        </select>
                        <button className="vx-btn vx-btn-sm" onClick={() => liberarTrial(l)} disabled={liberando === l.companyId}
                          title={t("admin.subs.grantTrialTitle")}>
                          <Gift size={13} />{liberando === l.companyId ? "…" : t("admin.subs.sevenDays")}
                        </button>
                      </div>
                    ) : l.trialUsado ? <span className="vx-mut" style={{ fontSize: 12 }}>{t("admin.subs.trialUsed")}</span>
                      : <span className="vx-mut" style={{ fontSize: 12 }}>{t("admin.subs.unavailable")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {linhas.length === 0 && (
          <div className="vx-mut" style={{ padding: 20, textAlign: "center", fontSize: 13 }}>
            {t("admin.subs.noCompanies")}
          </div>
        )}
      </div>
    </div>
  );
}

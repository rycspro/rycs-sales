import { useMemo, useState } from "react";
import {
  Award, CalendarCheck, CheckCircle2, Clock3, Handshake, Presentation,
  ShieldCheck, Target, TrendingUp, Wallet, XCircle, Zap,
} from "lucide-react";
import { money } from "../../lib/utils.js";
import { Stat, Medidor, Donut } from "../ui.jsx";
import { desempenhoVendedor, potencialDeGanhos } from "../../../shared/desempenhoVendedor.js";
import { ler as lerArmazenamento, gravar as gravarArmazenamento } from "../../lib/armazenamento.js";
import { useI18n } from "../../lib/i18n.jsx";

const NIVEIS = { starter: "Starter", pro: "Pro", elite: "Elite" };

export default function PainelVendedor({ eu, db, abrirEmpresas }) {
  const { t } = useI18n();
  const [meta, setMeta] = useState(() => {
    return Number(lerArmazenamento("rycs:meta", 0)) || 0;
  });

  const d = useMemo(() => desempenhoVendedor({
    submissions: db.submissions || [], leads: db.leads || [],
    sellerId: eu.id, seller: eu, metaMensal: meta,
  }), [db, eu, meta]);

  const potencial = useMemo(() => potencialDeGanhos({
    companies: db.companies || [], campaigns: db.campaigns || [],
    seller: eu, aplicacoes: eu.aplicacoes || {},
  }), [db, eu]);

  const salvarMeta = (v) => {
    const valor = Math.max(0, Number(String(v).replace(",", ".")) || 0);
    setMeta(valor);
    gravarArmazenamento("rycs:meta", valor);
  };

  const { financeiro: f, performance: p, comercial: c, rycs: r } = d;

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">{t("seller.dashboard.yourPerformance")}</div>
          <h1 className="vx-disp">{t("seller.dashboard.hello", { name: String(eu.nome || "").split(" ")[0] })}</h1>
          <p>{t("seller.dashboard.allNumbersFromActions")}</p>
        </div>
        <span className="vx-chip vx-mono"><Award size={13} /> {NIVEIS[r.nivel] || r.nivel} · score {r.score}</span>
      </div>

      <div className="vx-card" style={{ padding: 20, marginTop: 4, borderLeft: "3px solid var(--brand)" }}>
        <div className="vx-eyebrow"><Zap size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> {t("seller.dashboard.earningPotential")}</div>
        <div className="vx-disp vx-mono" style={{ fontSize: 34, color: "var(--brand)", margin: "6px 0 2px" }}>
          {money(potencial.total)}
        </div>
        {potencial.motivo ? (
          <p className="vx-mut" style={{ fontSize: 13, margin: 0 }}>{potencial.motivo}</p>
        ) : (
          <>
            <p className="vx-mut" style={{ fontSize: 13, margin: "0 0 10px" }}>
              {t("seller.dashboard.inCompanies", { count: potencial.empresas.length })}
            </p>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {potencial.empresas.slice(0, 4).map((e) => (
                <span key={e.companyId} className="vx-chip">
                  {e.empresa} · {t("seller.dashboard.upTo")} {money(e.maiorTarefa)}/{t("seller.dashboard.perAction")}
                </span>
              ))}
            </div>
            {abrirEmpresas && (
              <button className="vx-btn vx-btn-primary" style={{ marginTop: 14 }} onClick={abrirEmpresas}>
                {t("seller.dashboard.viewOpportunities")}
              </button>
            )}
          </>
        )}
        <div className="vx-chart-source">
          {t("seller.dashboard.earningPotentialNote")}
        </div>
      </div>

      <h2 className="vx-disp" style={{ fontSize: 17, margin: "22px 0 10px" }}>{t("seller.dashboard.earnings")}</h2>
      <div className="vx-grid vx-g4">
        <Stat label={t("seller.dashboard.today")} value={money(f.hoje)} Icon={TrendingUp} tone="brand" />
        <Stat label={t("seller.dashboard.last7days")} value={money(f.semana)} Icon={TrendingUp} tone="brand" />
        <Stat label={t("seller.dashboard.thisMonth")} value={money(f.mes)} Icon={TrendingUp} tone="brand" />
        <Stat label={t("seller.dashboard.totalApproved")} value={money(f.historico)} Icon={Award} tone="muted" />
      </div>
      <div className="vx-grid vx-g4" style={{ marginTop: 12 }}>
        <Stat label={t("seller.dashboard.availableForWithdrawal")} value={money(f.disponivel)} Icon={Wallet} tone="brand" />
        <Stat label={t("seller.dashboard.inAudit")} value={money(f.emAuditoria)} Icon={ShieldCheck} tone="amber" />
        <Stat label={t("seller.dashboard.pending")} value={money(f.pendente)} Icon={Clock3} tone="amber" />
        <Stat label={t("seller.dashboard.totalWithdrawn")} value={money(f.sacado)} Icon={Wallet} tone="muted" />
      </div>

      <h2 className="vx-disp" style={{ fontSize: 17, margin: "22px 0 10px" }}>{t("seller.dashboard.performance")}</h2>
      <div className="vx-card" style={{ padding: 18 }}>
        <div className="vx-row" style={{ flexWrap: "wrap", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="vx-eyebrow"><Target size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> {t("seller.dashboard.monthlyGoal")}</div>
            <div className="vx-disp vx-mono" style={{ fontSize: 22, marginTop: 3 }}>
              {money(f.mes)}{p.metaMensal > 0 && <span className="vx-mut" style={{ fontSize: 14 }}> / {money(p.metaMensal)}</span>}
            </div>
          </div>
          <label style={{ width: 160 }}>
            <div className="vx-label">{t("seller.dashboard.setGoal")}</div>
            <input className="vx-input vx-mono" inputMode="decimal" value={p.metaMensal || ""}
              placeholder="0" onChange={(e) => salvarMeta(e.target.value)} />
          </label>
        </div>
        {p.progressoMeta !== null ? (
          <div style={{ marginTop: 12 }}>
            <div className="vx-row" style={{ fontSize: 12.5, marginBottom: 4 }}>
              <span className="vx-mut">{t("seller.dashboard.progress")}</span><b>{p.progressoMeta}%</b>
            </div>
            <Medidor value={p.progressoMeta} tone={p.progressoMeta >= 80 ? "brand" : p.progressoMeta >= 40 ? "amber" : "red"} />
          </div>
        ) : (
          <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
            {t("seller.dashboard.setGoalHint")}
          </p>
        )}
      </div>

      <div className="vx-grid vx-g4" style={{ marginTop: 12 }}>
        <Stat label={t("seller.dashboard.actionsSent")} value={p.executadas} Icon={Presentation} tone="muted" mono />
        <Stat label={t("seller.dashboard.approved")} value={p.aprovadas} Icon={CheckCircle2} tone="brand" mono />
        <Stat label={t("seller.dashboard.inAudit")} value={p.emAuditoria} Icon={ShieldCheck} tone="amber" mono />
        <Stat label={t("seller.dashboard.notApproved")} value={p.recusadas} Icon={XCircle} tone="red" mono />
      </div>

      {p.taxaAprovacao !== null && (
        <div className="vx-card" style={{ padding: 16, marginTop: 12 }}>
          <div className="vx-row" style={{ fontSize: 13, marginBottom: 5 }}>
            <span className="vx-mut">{t("seller.dashboard.approvalRate")}</span>
            <b className="vx-mono">{p.taxaAprovacao}%</b>
          </div>
          <Medidor value={p.taxaAprovacao} tone={p.taxaAprovacao >= 70 ? "brand" : p.taxaAprovacao >= 50 ? "amber" : "red"} />
        </div>
      )}

      <h2 className="vx-disp" style={{ fontSize: 17, margin: "22px 0 10px" }}>{t("seller.dashboard.commercial")}</h2>
      <div className="vx-grid vx-g2">
        <Donut
          titulo={t("seller.dashboard.funnelTitle")}
          itens={[
            { nome: t("seller.dashboard.meetingsScheduled"), valor: c.agendadas },
            { nome: t("seller.dashboard.meetingsHeld"), valor: c.realizadas },
            { nome: t("seller.dashboard.sales"), valor: c.vendas },
          ]}
        />
        <div className="vx-card" style={{ padding: 18 }}>
          <div className="vx-grid vx-g2" style={{ fontSize: 12.5 }}>
            <div><span className="vx-mut">{t("seller.dashboard.leadsInPortfolio")}</span><div className="vx-disp vx-mono" style={{ fontSize: 20 }}>{c.leadsTotais}</div></div>
            <div><span className="vx-mut">{t("seller.dashboard.leadsWorked")}</span><div className="vx-disp vx-mono" style={{ fontSize: 20 }}>{c.leadsTrabalhados}</div></div>
          </div>
          <hr className="vx-sep" />
          <div className="vx-grid vx-g2" style={{ fontSize: 12.5 }}>
            <div>
              <span className="vx-mut">{t("seller.dashboard.attendance")}</span>
              <div className="vx-disp vx-mono" style={{ fontSize: 20 }}>{c.comparecimento === null ? "—" : `${c.comparecimento}%`}</div>
            </div>
            <div>
              <span className="vx-mut">{t("seller.dashboard.conversionToSale")}</span>
              <div className="vx-disp vx-mono" style={{ fontSize: 20, color: "var(--brand)" }}>{c.conversao === null ? "—" : `${c.conversao}%`}</div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="vx-disp" style={{ fontSize: 17, margin: "22px 0 10px" }}>RYCS</h2>
      <div className="vx-grid vx-g3">
        <Stat label="RYCS Score" value={r.score} Icon={Award} tone={r.score >= 70 ? "brand" : r.score >= 50 ? "amber" : "red"} mono />
        <Stat label={t("seller.dashboard.level")} value={NIVEIS[r.nivel] || r.nivel} Icon={TrendingUp} tone="indigo" mono={false} />
        <Stat label={t("seller.dashboard.triageScore")} value={r.scoreTriagem ? `${r.scoreTriagem}%` : "—"} Icon={CalendarCheck} tone="muted" />
      </div>

      <div className="vx-card" style={{ padding: 16, marginTop: 12 }}>
        <div className="vx-eyebrow"><Handshake size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> {t("seller.dashboard.nextActions")}</div>
        <ul className="vx-mut" style={{ fontSize: 13, paddingLeft: 18, margin: "8px 0 0" }}>
          {p.emAuditoria > 0 && <li>{t("seller.dashboard.actionsInAudit", { count: p.emAuditoria })}</li>}
          {c.leadsTotais > c.leadsTrabalhados && <li>{t("seller.dashboard.leadsNoContact", { count: c.leadsTotais - c.leadsTrabalhados })}</li>}
          {potencial.total > 0 && <li>{t("seller.dashboard.fundsAvailable", { amount: money(potencial.total) })}</li>}
          {r.score < 70 && <li>{t("seller.dashboard.completeAcademy")}</li>}
          {!p.executadas && <li>{t("seller.dashboard.sendFirstAction")}</li>}
        </ul>
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { Users, Building2, Banknote, TrendingUp, Activity, Wallet, Target, BarChart3 } from "lucide-react";
import { money, agora, dataCurta } from "../../lib/utils.js";
import { TAXA, ACOES } from "../../lib/constants.js";
import { Stat } from "../ui.jsx";
import { useI18n } from "../../lib/i18n.jsx";

const CORES = {
  brand: "var(--brand)",
  indigo: "var(--indigo)",
  amber: "var(--amber)",
  red: "var(--red)",
  muted: "var(--muted-2)",
};

const STATUS_COR = {
  liberado: "var(--brand)",
  recusado: "var(--red)",
  ia_recusado: "var(--red)",
  revisao: "var(--amber)",
  ia_aprovado: "var(--indigo)",
  conferido: "var(--indigo)",
  analisando: "var(--muted)",
};

function percentual(parte, total) {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

function GraficoPizza({ titulo, descricao, segmentos, centro, centroLabel }) {
  const total = segmentos.reduce((soma, item) => soma + item.valor, 0);
  const circunferencia = 2 * Math.PI * 46;
  let offset = 0;

  return (
    <div className="vx-card rycs-pizza-card" style={{ padding: 18 }}>
      <div className="vx-eyebrow" style={{ marginBottom: 4 }}>{titulo}</div>
      <div className="vx-mut" style={{ fontSize: 12.5, minHeight: 38 }}>{descricao}</div>

      <div className="rycs-pizza-layout">
        <div className="rycs-pizza-wrap">
          <svg viewBox="0 0 128 128" role="img" aria-label={`${titulo}: ${total} itens`}>
            <circle cx="64" cy="64" r="46" fill="none" stroke="var(--surface-3)" strokeWidth="15" />
            {total > 0 && segmentos.filter((item) => item.valor > 0).map((item) => {
              const tamanho = (item.valor / total) * circunferencia;
              const segmento = (
                <circle
                  key={item.label}
                  cx="64"
                  cy="64"
                  r="46"
                  fill="none"
                  stroke={CORES[item.tone] || CORES.muted}
                  strokeWidth="15"
                  strokeDasharray={`${Math.max(0, tamanho - 2)} ${circunferencia}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 64 64)"
                />
              );
              offset += tamanho;
              return segmento;
            })}
          </svg>
          <div className="rycs-pizza-centro">
            <strong className="vx-disp vx-mono">{centro}</strong>
            <span>{centroLabel}</span>
          </div>
        </div>

        <div className="rycs-legenda" aria-label={`Detalhamento: ${titulo}`}>
          {segmentos.map((item) => (
            <div className="rycs-legenda-item" key={item.label}>
              <span className="rycs-legenda-dot" style={{ background: CORES[item.tone] || CORES.muted }} />
              <span className="rycs-legenda-label">{item.label}</span>
              <b className="vx-mono">{item.valor}</b>
              <span className="vx-mut">{percentual(item.valor, total)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlocosIsometricos({ itens }) {
  const maior = Math.max(...itens.map((item) => item.valor), 0);
  const baseY = 138;

  return (
    <svg className="rycs-iso-svg" viewBox="0 0 390 206" role="img" aria-label="Fluxo financeiro em blocos isométricos">
      <defs>
        <linearGradient id="rycs-iso-floor" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--surface-3)" stopOpacity=".7" />
          <stop offset="1" stopColor="var(--surface-2)" stopOpacity=".2" />
        </linearGradient>
      </defs>
      <polygon points="44,147 194,100 346,147 194,193" fill="url(#rycs-iso-floor)" stroke="var(--border)" />
      <path d="M78 151 195 115 311 151M110 165 195 139 279 165" fill="none" stroke="var(--border)" strokeOpacity=".72" />

      {itens.map((item, index) => {
        const x = 72 + index * 113;
        const altura = maior > 0 ? 22 + (item.valor / maior) * 76 : 22;
        const y = baseY - altura;
        const cor = CORES[item.tone] || CORES.brand;
        return (
          <g key={item.label}>
            <polygon points={`${x},${y} ${x + 26},${y - 13} ${x + 52},${y} ${x + 26},${y + 13}`} fill={cor} fillOpacity=".96" />
            <polygon points={`${x},${y} ${x + 26},${y + 13} ${x + 26},${baseY + 13} ${x},${baseY}`} fill={cor} fillOpacity=".54" />
            <polygon points={`${x + 26},${y + 13} ${x + 52},${y} ${x + 52},${baseY} ${x + 26},${baseY + 13}`} fill={cor} fillOpacity=".78" />
            <text x={x + 26} y="174" textAnchor="middle" fill="var(--muted)" fontSize="10" fontWeight="600">{item.label}</text>
            <text x={x + 26} y="190" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="700">{item.valorFormatado}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function DashboardAdmin({ db }) {
  const { t } = useI18n();
  const stats = useMemo(() => {
    const now = agora();
    const dia30 = now - 86400000 * 30;
    const dia7 = now - 86400000 * 7;

    const totalProfissionais = db.sellers.length;
    const profAtivos = db.sellers.filter((s) => s.status === "aprovado" || s.status === "parcial").length;
    const profTriagem = db.sellers.filter((s) => s.status === "triagem" || s.status === "analise").length;
    const profRecusados = db.sellers.filter((s) => s.status === "recusado").length;

    const totalEmpresas = db.companies.length;
    const empComSaldo = db.companies.filter((c) => c.saldo > 0).length;

    const totalSubs = db.submissions.length;
    const subs30d = db.submissions.filter((s) => s.criadoEm > dia30);
    const subs7d = db.submissions.filter((s) => s.criadoEm > dia7);
    const liberados = db.submissions.filter((s) => s.status === "liberado");
    const liberados30d = liberados.filter((s) => s.criadoEm > dia30);

    const valorLiquido = (sub) => sub.liquido !== null && sub.liquido !== undefined && Number.isFinite(Number(sub.liquido))
      ? Number(sub.liquido)
      : Number(sub.valor || 0) * (1 - TAXA);
    const valorTaxa = (sub) => Math.max(0, Number(sub.valor || 0) - valorLiquido(sub));
    const somar = (lista, seletor) => lista.reduce((total, item) => total + seletor(item), 0);

    const gmv = somar(liberados, (s) => Number(s.valor || 0));
    const gmv30d = somar(liberados30d, (s) => Number(s.valor || 0));
    const receita = somar(liberados, valorTaxa);
    const receita30d = somar(liberados30d, valorTaxa);
    const repasses = somar(liberados, valorLiquido);

    const totalSaldo = db.companies.reduce((a, c) => a + Number(c.saldo || 0), 0);
    const totalAportado = db.companies.reduce((a, c) => a + Number(c.totalAportado || 0), 0);
    const totalSacado = db.withdrawals.filter((w) => w.status === "pago").reduce((a, w) => a + Number(w.valor || 0), 0);
    const saquesAtivos = db.withdrawals.filter((w) => w.status === "solicitado").length;
    const destaques = db.companies.filter((c) => c.destaque).length;

    const tipoBreakdown = Object.entries(ACOES).map(([tipo, acao]) => ({
      label: acao.nome,
      valor: liberados.filter((s) => s.tipo === tipo).length,
      tone: ["brand", "indigo", "amber", "muted", "red"][Object.keys(ACOES).indexOf(tipo) % 5],
    }));

    const statusBreakdown = [
      { label: t("admin.dashboard.released"), valor: liberados.length, tone: "brand" },
      { label: t("admin.dashboard.inReview"), valor: db.submissions.filter((s) => ["revisao", "ia_aprovado", "conferido"].includes(s.status)).length, tone: "amber" },
      { label: t("admin.dashboard.rejected"), valor: db.submissions.filter((s) => ["recusado", "ia_recusado"].includes(s.status)).length, tone: "red" },
      { label: t("admin.dashboard.analyzing"), valor: db.submissions.filter((s) => s.status === "analisando").length, tone: "indigo" },
    ];

    const profissionaisBreakdown = [
      { label: t("admin.dashboard.active"), valor: profAtivos, tone: "brand" },
      { label: t("admin.dashboard.underReview"), valor: profTriagem, tone: "amber" },
      { label: t("admin.dashboard.rejectedPros"), valor: profRecusados, tone: "red" },
    ];

    const recentActivity = [...db.submissions].sort((a, b) => b.criadoEm - a.criadoEm).slice(0, 10);

    return {
      totalProfissionais, profAtivos, profTriagem, totalEmpresas, empComSaldo,
      totalSubs, subs30d: subs30d.length, subs7d: subs7d.length,
      gmv, gmv30d, receita, receita30d, repasses, totalSaldo, totalAportado,
      totalSacado, saquesAtivos, destaques, tipoBreakdown, statusBreakdown,
      profissionaisBreakdown, recentActivity,
    };
  }, [db]);

  const fluxoFinanceiro = [
    { label: "GMV", valor: stats.gmv, valorFormatado: money(stats.gmv), tone: "indigo" },
    { label: t("admin.dashboard.rycsFee"), valor: stats.receita, valorFormatado: money(stats.receita), tone: "brand" },
    { label: t("admin.dashboard.payouts"), valor: stats.repasses, valorFormatado: money(stats.repasses), tone: "amber" },
  ];

  return (
    <div className="vx-fade rycs-admin-viz">
      <style>{`
        .rycs-admin-viz .rycs-dashboard-head{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;margin-bottom:18px;flex-wrap:wrap}
        .rycs-admin-viz .rycs-pizza-layout{display:grid;grid-template-columns:minmax(132px,.9fr) minmax(0,1.1fr);align-items:center;gap:14px;margin-top:8px}
        .rycs-admin-viz .rycs-pizza-wrap{width:146px;height:146px;position:relative;margin:auto}
        .rycs-admin-viz .rycs-pizza-wrap svg{display:block;width:100%;height:100%;filter:drop-shadow(0 8px 16px rgba(8,15,32,.08))}
        .rycs-admin-viz .rycs-pizza-centro{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;pointer-events:none}
        .rycs-admin-viz .rycs-pizza-centro strong{font-size:22px;line-height:1.1;letter-spacing:-.03em}
        .rycs-admin-viz .rycs-pizza-centro span{font-size:10.5px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
        .rycs-admin-viz .rycs-legenda{display:grid;gap:8px;min-width:0}
        .rycs-admin-viz .rycs-legenda-item{display:grid;grid-template-columns:8px minmax(0,1fr) auto auto;gap:7px;align-items:center;font-size:12px}
        .rycs-admin-viz .rycs-legenda-dot{width:8px;height:8px;border-radius:999px}
        .rycs-admin-viz .rycs-legenda-label{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .rycs-admin-viz .rycs-legenda-item b{font-size:12px}
        .rycs-admin-viz .rycs-legenda-item .vx-mut{font-size:11px;min-width:28px;text-align:right}
        .rycs-admin-viz .rycs-iso-card{overflow:hidden;background:linear-gradient(145deg,var(--surface),var(--surface-2))}
        .rycs-admin-viz .rycs-iso-svg{display:block;width:100%;max-width:480px;height:auto;margin:2px auto 0}
        .rycs-admin-viz .rycs-iso-notes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px}
        .rycs-admin-viz .rycs-iso-note{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:9px;min-width:0}
        .rycs-admin-viz .rycs-iso-note span{display:block;color:var(--muted);font-size:10.5px;font-weight:600;margin-bottom:3px}
        .rycs-admin-viz .rycs-iso-note b{font-size:12px;white-space:nowrap}
        @media(max-width:460px){.rycs-admin-viz .rycs-pizza-layout{grid-template-columns:1fr}.rycs-admin-viz .rycs-legenda{max-width:270px;margin:0 auto}.rycs-admin-viz .rycs-iso-notes{grid-template-columns:1fr}.rycs-admin-viz .rycs-iso-svg{margin-top:-5px}}
      `}</style>

      <div className="rycs-dashboard-head">
        <div>
          <div className="vx-disp" style={{ fontSize: 22 }}>{t("admin.dashboard.title")}</div>
          <div className="vx-mut" style={{ fontSize: 13 }}>{t("admin.dashboard.subtitle")}</div>
        </div>
        <span className="vx-chip"><Activity size={14} /> {t("admin.dashboard.last7d", { count: stats.subs7d })}</span>
      </div>

      <div className="vx-grid vx-g4" style={{ marginBottom: 22 }}>
        <Stat label={t("admin.dashboard.realizedRevenue")} value={money(stats.receita)} Icon={TrendingUp} tone="brand" />
        <Stat label={t("admin.dashboard.releasedGmv")} value={money(stats.gmv)} Icon={Banknote} tone="amber" />
        <Stat label={t("admin.dashboard.activePros")} value={`${stats.profAtivos}/${stats.totalProfissionais}`} Icon={Users} tone="indigo" mono={false} />
        <Stat label={t("admin.dashboard.companiesWithBalance")} value={`${stats.empComSaldo}/${stats.totalEmpresas}`} Icon={Building2} tone="muted" mono={false} />
      </div>

      <div className="vx-grid vx-g2" style={{ marginBottom: 22 }}>
        <div className="vx-card rycs-iso-card" style={{ padding: 18 }}>
          <div className="vx-row" style={{ alignItems: "flex-start", marginBottom: 2 }}>
            <div>
              <div className="vx-eyebrow" style={{ marginBottom: 4 }}>{t("admin.dashboard.financialFlow")}</div>
              <div className="vx-mut" style={{ fontSize: 12.5 }}>{t("admin.dashboard.financialFlowDesc")}</div>
            </div>
            <span className="vx-badge vx-badge-brand"><TrendingUp size={12} /> 30d {money(stats.receita30d)}</span>
          </div>
          <BlocosIsometricos itens={fluxoFinanceiro} />
          <div className="rycs-iso-notes">
            <div className="rycs-iso-note"><span>{t("admin.dashboard.companyBalance")}</span><b className="vx-mono">{money(stats.totalSaldo)}</b></div>
            <div className="rycs-iso-note"><span>{t("admin.dashboard.totalDeposits")}</span><b className="vx-mono">{money(stats.totalAportado)}</b></div>
            <div className="rycs-iso-note"><span>{t("admin.dashboard.completedWithdrawals")}</span><b className="vx-mono">{money(stats.totalSacado)}</b></div>
          </div>
        </div>

        <div className="vx-card" style={{ padding: 18 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 4 }}>{t("admin.dashboard.operationSignals")}</div>
          <div className="vx-mut" style={{ fontSize: 12.5, marginBottom: 14 }}>{t("admin.dashboard.operationSignalsDesc")}</div>
          <div style={{ display: "grid", gap: 10 }}>
            <div className="vx-row" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span className="vx-mut"><Target size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{t("admin.dashboard.actionsInReview")}</span>
              <b className="vx-mono">{stats.statusBreakdown.find((item) => item.label === t("admin.dashboard.inReview"))?.valor || 0}</b>
            </div>
            <div className="vx-row" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span className="vx-mut"><Wallet size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{t("admin.dashboard.pendingWithdrawals")}</span>
              <span className="vx-badge vx-badge-red">{stats.saquesAtivos}</span>
            </div>
            <div className="vx-row" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span className="vx-mut"><Users size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{t("admin.dashboard.prosUnderReview")}</span>
              <span className="vx-badge vx-badge-amber">{stats.profTriagem}</span>
            </div>
            <div className="vx-row" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span className="vx-mut"><BarChart3 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{t("admin.dashboard.actionsLast30d")}</span>
              <b className="vx-mono">{stats.subs30d}</b>
            </div>
            <div className="vx-row" style={{ padding: "9px 0", fontSize: 13 }}>
              <span className="vx-mut"><Building2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{t("admin.dashboard.featuredCompanies")}</span>
              <b className="vx-mono">{stats.destaques}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="vx-grid vx-g2" style={{ marginBottom: 22 }}>
        <GraficoPizza
          titulo={t("admin.dashboard.actionStatus")}
          descricao={t("admin.dashboard.actionStatusDesc")}
          segmentos={stats.statusBreakdown}
          centro={stats.totalSubs}
          centroLabel={t("admin.dashboard.actions")}
        />
        <GraficoPizza
          titulo={t("admin.dashboard.volumeByType")}
          descricao={t("admin.dashboard.volumeByTypeDesc")}
          segmentos={stats.tipoBreakdown}
          centro={stats.statusBreakdown.find((item) => item.label === t("admin.dashboard.released"))?.valor || 0}
          centroLabel={t("admin.dashboard.released")}
        />
      </div>

      <div className="vx-grid vx-g2" style={{ marginBottom: 22 }}>
        <GraficoPizza
          titulo={t("admin.dashboard.proBase")}
          descricao={t("admin.dashboard.proBaseDesc")}
          segmentos={stats.profissionaisBreakdown}
          centro={stats.totalProfissionais}
          centroLabel={t("admin.dashboard.people")}
        />
        <div className="vx-card" style={{ padding: 18 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 4 }}>{t("admin.dashboard.revenuePace")}</div>
          <div className="vx-mut" style={{ fontSize: 12.5, marginBottom: 16 }}>{t("admin.dashboard.revenuePaceDesc")}</div>
          <div style={{ display: "grid", gap: 13 }}>
            <div>
              <div className="vx-row" style={{ fontSize: 13, marginBottom: 6 }}><span className="vx-mut">{t("admin.dashboard.revenue30d")}</span><b className="vx-mono" style={{ color: "var(--brand)" }}>{money(stats.receita30d)}</b></div>
              <div className="vx-meter-track"><div className="vx-meter-fill" style={{ width: `${Math.max(3, percentual(stats.receita30d, stats.receita))}%`, background: "var(--brand)" }} /></div>
            </div>
            <div>
              <div className="vx-row" style={{ fontSize: 13, marginBottom: 6 }}><span className="vx-mut">{t("admin.dashboard.gmv30d")}</span><b className="vx-mono" style={{ color: "var(--amber)" }}>{money(stats.gmv30d)}</b></div>
              <div className="vx-meter-track"><div className="vx-meter-fill" style={{ width: `${Math.max(3, percentual(stats.gmv30d, stats.gmv))}%`, background: "var(--amber)" }} /></div>
            </div>
            <div className="vx-row" style={{ fontSize: 13, paddingTop: 4 }}>
              <span className="vx-mut">{t("admin.dashboard.effectiveRate")}</span>
              <b className="vx-mono">{stats.gmv > 0 ? `${((stats.receita / stats.gmv) * 100).toFixed(1)}%` : "—"}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="vx-card" style={{ padding: 18 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 10 }}>
          <Activity size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{t("admin.dashboard.recentActivity")}
        </div>
        {stats.recentActivity.length === 0 && <div className="vx-mut" style={{ fontSize: 13 }}>{t("admin.dashboard.noActivity")}</div>}
        {stats.recentActivity.map((s) => {
          const seller = db.sellers.find((sl) => sl.id === s.sellerId);
          const company = db.companies.find((c) => c.id === s.companyId);
          const statusCor = STATUS_COR[s.status] || "var(--muted)";
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 7, height: 7, borderRadius: 999, background: statusCor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{seller?.nome || "—"}</span>
                <span className="vx-mut"> → {ACOES[s.tipo]?.nome || s.tipo} · {company?.nome || "—"}</span>
              </div>
              <span className="vx-mono" style={{ fontSize: 12, color: statusCor, fontWeight: 600 }}>{money(s.valor)}</span>
              <span className="vx-mut" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{dataCurta(s.criadoEm)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

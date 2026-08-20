import { useMemo } from "react";
import { Users, Building2, Banknote, TrendingUp, Activity, Wallet, Target, BarChart3 } from "lucide-react";
import { money, agora, dataCurta } from "../../lib/utils.js";
import { TAXA, ACOES } from "../../lib/constants.js";
import { Stat, Medidor } from "../ui.jsx";

export default function DashboardAdmin({ db }) {
  const stats = useMemo(() => {
    const now = agora();
    const dia30 = now - 86400000 * 30;
    const dia7 = now - 86400000 * 7;

    const totalProfissionais = db.sellers.length;
    const profAtivos = db.sellers.filter((s) => s.status === "aprovado").length;
    const profTriagem = db.sellers.filter((s) => s.status === "triagem").length;

    const totalEmpresas = db.companies.length;
    const empComSaldo = db.companies.filter((c) => c.saldo > 0).length;

    const totalSubs = db.submissions.length;
    const subs30d = db.submissions.filter((s) => s.criadoEm > dia30);
    const subs7d = db.submissions.filter((s) => s.criadoEm > dia7);
    const liberados = db.submissions.filter((s) => s.status === "liberado");
    const liberados30d = liberados.filter((s) => s.criadoEm > dia30);

    const gmv = liberados.reduce((a, s) => a + s.valor, 0);
    const gmv30d = liberados30d.reduce((a, s) => a + s.valor, 0);
    const receita = gmv * TAXA;
    const receita30d = gmv30d * TAXA;

    const totalSaldo = db.companies.reduce((a, c) => a + c.saldo, 0);
    const totalAportado = db.companies.reduce((a, c) => a + (c.totalAportado || 0), 0);

    const taxaAprovacao = totalSubs > 0 ? Math.round((liberados.length / totalSubs) * 100) : 0;

    const saquesAtivos = db.withdrawals.filter((w) => w.status === "solicitado").length;
    const totalSacado = db.withdrawals.filter((w) => w.status === "pago").reduce((a, w) => a + w.valor, 0);

    const destaques = db.companies.filter((c) => c.destaque).length;
    const receitaDestaque = destaques * 490;

    const tipoBreakdown = {};
    liberados.forEach((s) => {
      tipoBreakdown[s.tipo] = (tipoBreakdown[s.tipo] || 0) + 1;
    });

    const recentActivity = [...db.submissions].sort((a, b) => b.criadoEm - a.criadoEm).slice(0, 10);

    return {
      totalProfissionais, profAtivos, profTriagem,
      totalEmpresas, empComSaldo,
      totalSubs, subs30d: subs30d.length, subs7d: subs7d.length,
      gmv, gmv30d, receita, receita30d, receitaDestaque,
      totalSaldo, totalAportado,
      taxaAprovacao, liberados: liberados.length,
      saquesAtivos, totalSacado,
      tipoBreakdown, recentActivity,
    };
  }, [db]);

  return (
    <div className="vx-fade">
      <div className="vx-disp" style={{ fontSize: 22, marginBottom: 18 }}>Dashboard da Plataforma</div>

      <div className="vx-grid vx-g4" style={{ marginBottom: 22 }}>
        <Stat label="Receita total" value={money(stats.receita)} Icon={TrendingUp} tone="brand" />
        <Stat label="GMV (volume liberado)" value={money(stats.gmv)} Icon={Banknote} tone="amber" />
        <Stat label="Profissionais" value={stats.totalProfissionais} Icon={Users} tone="indigo" mono={false} />
        <Stat label="Empresas" value={stats.totalEmpresas} Icon={Building2} tone="muted" mono={false} />
      </div>

      <div className="vx-grid vx-g2" style={{ marginBottom: 22 }}>
        <div className="vx-card" style={{ padding: 18 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Receita últimos 30 dias</div>
          <div className="vx-disp vx-mono" style={{ fontSize: 28, color: "var(--brand)" }}>{money(stats.receita30d)}</div>
          <div className="vx-mut" style={{ fontSize: 12, marginTop: 4 }}>
            Take rate {Math.round(TAXA * 100)}% + Destaques {money(stats.receitaDestaque)}/mês
          </div>
          <hr className="vx-sep" />
          <div className="vx-row" style={{ fontSize: 13 }}>
            <span className="vx-mut">GMV 30 dias</span><b className="vx-mono">{money(stats.gmv30d)}</b>
          </div>
          <div className="vx-row" style={{ fontSize: 13, marginTop: 4 }}>
            <span className="vx-mut">Total aportado (lifetime)</span><b className="vx-mono">{money(stats.totalAportado)}</b>
          </div>
          <div className="vx-row" style={{ fontSize: 13, marginTop: 4 }}>
            <span className="vx-mut">Saldo em caixa (empresas)</span><b className="vx-mono">{money(stats.totalSaldo)}</b>
          </div>
        </div>

        <div className="vx-card" style={{ padding: 18 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Saúde do marketplace</div>
          <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
            <div>
              <div className="vx-row" style={{ fontSize: 13, marginBottom: 4 }}>
                <span className="vx-mut">Taxa de aprovação</span>
                <b style={{ color: stats.taxaAprovacao > 50 ? "var(--brand)" : "var(--amber)" }}>{stats.taxaAprovacao}%</b>
              </div>
              <Medidor value={stats.taxaAprovacao} tone={stats.taxaAprovacao > 50 ? "brand" : "amber"} />
            </div>
            <div>
              <div className="vx-row" style={{ fontSize: 13, marginBottom: 4 }}>
                <span className="vx-mut">Profissionais ativos</span>
                <b>{stats.profAtivos} / {stats.totalProfissionais}</b>
              </div>
              <Medidor value={stats.totalProfissionais > 0 ? (stats.profAtivos / stats.totalProfissionais) * 100 : 0} tone="indigo" />
            </div>
            <div>
              <div className="vx-row" style={{ fontSize: 13, marginBottom: 4 }}>
                <span className="vx-mut">Empresas com saldo</span>
                <b>{stats.empComSaldo} / {stats.totalEmpresas}</b>
              </div>
              <Medidor value={stats.totalEmpresas > 0 ? (stats.empComSaldo / stats.totalEmpresas) * 100 : 0} tone="brand" />
            </div>
          </div>
        </div>
      </div>

      <div className="vx-grid vx-g2" style={{ marginBottom: 22 }}>
        <div className="vx-card" style={{ padding: 18 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Volume por tipo de ação</div>
          {Object.entries(stats.tipoBreakdown).length === 0 && (
            <div className="vx-mut" style={{ fontSize: 13 }}>Nenhuma ação liberada ainda.</div>
          )}
          {Object.entries(stats.tipoBreakdown).map(([tipo, count]) => (
            <div key={tipo} className="vx-row" style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontWeight: 600 }}>{ACOES[tipo]?.nome || tipo}</span>
              <span className="vx-mono" style={{ fontWeight: 600 }}>{count}</span>
            </div>
          ))}
        </div>

        <div className="vx-card" style={{ padding: 18 }}>
          <div className="vx-eyebrow" style={{ marginBottom: 10 }}>Operacional</div>
          <div className="vx-row" style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            <span className="vx-mut">Em triagem</span>
            <span className="vx-badge vx-badge-amber">{stats.profTriagem}</span>
          </div>
          <div className="vx-row" style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            <span className="vx-mut">Saques pendentes</span>
            <span className="vx-badge vx-badge-red">{stats.saquesAtivos}</span>
          </div>
          <div className="vx-row" style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            <span className="vx-mut">Atividades (7 dias)</span>
            <span className="vx-mono" style={{ fontWeight: 600 }}>{stats.subs7d}</span>
          </div>
          <div className="vx-row" style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            <span className="vx-mut">Atividades (30 dias)</span>
            <span className="vx-mono" style={{ fontWeight: 600 }}>{stats.subs30d}</span>
          </div>
          <div className="vx-row" style={{ fontSize: 13, padding: "6px 0" }}>
            <span className="vx-mut">Total sacado (pago)</span>
            <span className="vx-mono" style={{ fontWeight: 600 }}>{money(stats.totalSacado)}</span>
          </div>
        </div>
      </div>

      <div className="vx-card" style={{ padding: 18 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 10 }}>
          <Activity size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Atividade recente
        </div>
        {stats.recentActivity.length === 0 && <div className="vx-mut" style={{ fontSize: 13 }}>Nenhuma atividade.</div>}
        {stats.recentActivity.map((s) => {
          const seller = db.sellers.find((sl) => sl.id === s.sellerId);
          const company = db.companies.find((c) => c.id === s.companyId);
          const statusCor = { liberado: "var(--brand)", recusado: "var(--red)", revisao: "var(--amber)", ia_aprovado: "var(--indigo)", analisando: "var(--muted)", conferido: "var(--indigo)" };
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 7, height: 7, borderRadius: 999, background: statusCor[s.status] || "var(--muted)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{seller?.nome || "—"}</span>
                <span className="vx-mut"> → {ACOES[s.tipo]?.nome || s.tipo} · {company?.nome || "—"}</span>
              </div>
              <span className="vx-mono" style={{ fontSize: 12, color: statusCor[s.status] || "var(--muted)", fontWeight: 600 }}>{money(s.valor)}</span>
              <span className="vx-mut" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{dataCurta(s.criadoEm)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

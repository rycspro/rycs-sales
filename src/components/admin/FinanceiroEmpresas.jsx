import { useMemo } from "react";
import { Wallet, Banknote } from "lucide-react";
import { money, agora } from "../../lib/utils.js";
import { TAXA } from "../../lib/constants.js";
import { Stat, Medidor } from "../ui.jsx";

export default function FinanceiroEmpresas({ db }) {
  const linhas = useMemo(() => db.companies.map((c) => {
    const libs = db.submissions.filter((s) => s.companyId === c.id && s.status === "liberado");
    const totalLiberado = libs.reduce((a, s) => a + s.valor, 0);
    const receitaTaxa = totalLiberado * TAXA;
    const receitaDestaque = c.destaque ? 490 : 0;
    const diasAtivos = Math.max(1, Math.ceil((agora() - c.criadoEm) / 86400000));
    const burnDiario = totalLiberado / diasAtivos;
    const projecaoGastoMensal = burnDiario * 30;
    const projecaoReceitaMensal = projecaoGastoMensal * TAXA + receitaDestaque;
    const runway = burnDiario > 0 ? Math.floor(c.saldo / burnDiario) : null;
    return { c, totalLiberado, receitaTaxa, receitaDestaque, projecaoReceitaMensal, runway, diasAtivos };
  }).sort((a, b) => b.projecaoReceitaMensal - a.projecaoReceitaMensal), [db]);

  const totalSaldo = db.companies.reduce((a, c) => a + c.saldo, 0);
  const totalAportado = db.companies.reduce((a, c) => a + (c.totalAportado || 0), 0);
  const totalProjecao = linhas.reduce((a, l) => a + l.projecaoReceitaMensal, 0);

  return (
    <>
      <div className="vx-grid vx-g2" style={{ marginBottom: 22 }}>
        <Stat label="Saldo somado nas empresas" value={money(totalSaldo)} Icon={Wallet} tone="muted" />
        <Stat label="Total já aportado na plataforma" value={money(totalAportado)} Icon={Banknote} tone="muted" />
      </div>
      <div className="vx-card" style={{ padding: 18, marginBottom: 22 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Projeção de faturamento (próximos 30 dias, todas as empresas)</div>
        <div className="vx-disp vx-mono" style={{ fontSize: 30, color: "var(--brand)" }}>{money(totalProjecao)}</div>
        <div className="vx-mut" style={{ fontSize: 12 }}>Taxa de {Math.round(TAXA * 100)}% sobre o ritmo de gasto atual, mais destaques mensais ativos.</div>
      </div>

      <div className="vx-grid">
        {linhas.map(({ c, totalLiberado, receitaTaxa, projecaoReceitaMensal, runway }) => (
          <div key={c.id} className="vx-card" style={{ padding: 18, borderLeft: `3px solid ${c.cor}` }}>
            <div className="vx-row" style={{ alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="vx-disp" style={{ fontSize: 17 }}>{c.nome}</span>
                {c.destaque && <span className="vx-badge vx-badge-amber">Destaque</span>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="vx-eyebrow">projeção 30 dias</div>
                <div className="vx-disp vx-mono" style={{ fontSize: 19, color: "var(--brand)" }}>{money(projecaoReceitaMensal)}</div>
              </div>
            </div>

            <div className="vx-grid vx-g4" style={{ marginTop: 14, fontSize: 12.5 }}>
              <div><span className="vx-mut">Saldo atual</span><div className="vx-mono" style={{ fontWeight: 600 }}>{money(c.saldo)}</div></div>
              <div><span className="vx-mut">Aportado</span><div className="vx-mono" style={{ fontWeight: 600 }}>{money(c.totalAportado || 0)}</div></div>
              <div><span className="vx-mut">Pago em comissões</span><div className="vx-mono" style={{ fontWeight: 600 }}>{money(totalLiberado)}</div></div>
              <div><span className="vx-mut">Receita até agora</span><div className="vx-mono" style={{ fontWeight: 600, color: "var(--brand)" }}>{money(receitaTaxa + (c.destaque ? 490 : 0))}</div></div>
            </div>

            <hr className="vx-sep" />
            <div className="vx-row" style={{ fontSize: 12.5, marginBottom: 8 }}>
              <span className="vx-mut">Caixa dura, no ritmo atual</span>
              <b style={{ color: runway === null ? "var(--muted)" : runway < 7 ? "var(--red)" : runway < 20 ? "var(--amber)" : "var(--brand)" }}>
                {runway === null ? "sem gasto registrado" : `${runway} dia${runway === 1 ? "" : "s"}`}
              </b>
            </div>
            {runway !== null && (
              <Medidor value={Math.min(100, (runway / 30) * 100)} tone={runway < 7 ? "red" : runway < 20 ? "amber" : "brand"} />
            )}
            {runway !== null && runway < 10 && (
              <div style={{ fontSize: 12, color: "var(--amber)", marginTop: 8 }}>Caixa perto de zerar — vale avisar a empresa para abastecer.</div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

import { Wallet, Clock } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";
import { Stat } from "../ui.jsx";

export default function ListaEmpresas({ eu, db, up, aviso, abrir }) {
  const ordenadas = [...db.companies].sort((a, b) => Number(b.destaque) - Number(a.destaque));
  const candidatar = (c) => {
    api("/applications", { sellerId: eu.id, companyId: c.id });
    up((d) => ({
      sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, aplicacoes: { ...s.aplicacoes, [c.id]: "pendente" } } : s),
    }));
    aviso(`Solicitação enviada para ${c.nome}.`);
  };

  return (
    <div className="vx-fade">
      <div className="vx-grid vx-g2" style={{ marginBottom: 24 }}>
        <Stat label="Disponível para saque" value={money(eu.disponivel)} Icon={Wallet} tone="brand" />
        <Stat label="Em análise" value={money(eu.pendente)} Icon={Clock} tone="amber" />
      </div>

      <div className="vx-row" style={{ marginBottom: 12 }}>
        <h2 className="vx-disp" style={{ fontSize: 19, margin: 0 }}>Empresas na operação</h2>
        <span className="vx-chip vx-mono">{ordenadas.length}</span>
      </div>

      <div className="vx-grid">
        {ordenadas.map((c) => {
          const st = eu.aplicacoes?.[c.id];
          return (
            <div key={c.id} className="vx-card" style={{ padding: 18, borderLeft: `3px solid ${c.cor}` }}>
              <div className="vx-row" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="vx-disp" style={{ fontSize: 17 }}>{c.nome}</span>
                    {c.destaque && <span className="vx-badge vx-badge-amber">Destaque</span>}
                  </div>
                  <div className="vx-mut" style={{ fontSize: 13, marginTop: 4 }}>{c.produto} · ticket {c.ticket}</div>
                  <div className="vx-mut" style={{ fontSize: 12, marginTop: 2 }}>Cliente ideal: {c.icp}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0" }}>
                {ORDEM_ACOES.filter((k) => c.comissoes[k]).slice(0, 3).map((k) => (
                  <span key={k} className="vx-chip vx-mono">{ACOES[k].nome} <b style={{ color: "var(--brand)" }}>{money(c.comissoes[k])}</b></span>
                ))}
              </div>

              {st === "aprovado" ? (
                <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => abrir(c.id)}>Abrir área da empresa</button>
              ) : st === "pendente" ? (
                <button className="vx-btn vx-btn-block" disabled>Aguardando a empresa aprovar</button>
              ) : st === "recusado" ? (
                <button className="vx-btn vx-btn-danger vx-btn-block" disabled>Não aprovado nesta operação</button>
              ) : (
                <button className="vx-btn vx-btn-block" onClick={() => candidatar(c)}>Pedir para vender ({c.vagas} vagas)</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

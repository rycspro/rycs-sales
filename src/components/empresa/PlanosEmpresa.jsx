import { useState, useEffect, useCallback } from "react";
import { Check, Sparkles, TrendingDown } from "lucide-react";
import { api, apiDelete } from "../../lib/api.js";
import { money } from "../../lib/utils.js";

export default function PlanosEmpresa({ aviso, recarregar }) {
  const [planos, setPlanos] = useState([]);
  const [atual, setAtual] = useState(null);
  const [processando, setProcessando] = useState("");
  const [cobranca, setCobranca] = useState(null);

  const carregar = useCallback(async () => {
    const [p, s] = await Promise.all([api("/plans"), api("/subscription")]);
    if (Array.isArray(p)) setPlanos(p);
    if (s && !s.error) setAtual(s);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const contratar = async (chave) => {
    setProcessando(chave);
    const r = await api("/subscription", { plano: chave });
    setProcessando("");
    if (!r || r.error) return aviso(r?.error || "Não foi possível contratar.");
    if (chave === "free") { await carregar(); await recarregar?.(); return aviso(r.message); }
    setCobranca(r);
    await carregar();
    aviso(r.message);
  };

  const cancelar = async () => {
    setProcessando("cancelar");
    const r = await apiDelete("/subscription");
    setProcessando("");
    if (!r || r.error) return aviso(r?.error || "Não foi possível cancelar.");
    await carregar();
    await recarregar?.();
    aviso(r.message);
  };

  if (!planos.length) return <div className="vx-mut" style={{ padding: 20 }}>Carregando planos…</div>;

  const chaveAtual = atual?.plano || "free";
  const takeAtual = atual?.detalhes?.takeRate ?? 0.12;

  return (
    <div className="vx-fade">
      <div className="vx-card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="vx-row" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="vx-eyebrow">Seu plano</div>
            <div className="vx-disp" style={{ fontSize: 20, marginTop: 2 }}>{atual?.detalhes?.nome || "Free"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="vx-eyebrow">Taxa por ação liberada</div>
            <div className="vx-disp vx-mono" style={{ fontSize: 20, color: "var(--brand)" }}>
              {Math.round(takeAtual * 100)}%
            </div>
          </div>
        </div>
        {atual?.assinatura?.status === "pendente" && (
          <div style={{
            marginTop: 12, padding: "10px 12px", borderRadius: 10, fontSize: 12.5,
            background: "var(--amber-50)", border: "1px solid var(--amber-100)", color: "var(--amber)",
          }}>
            Assinatura aguardando o primeiro pagamento. O plano é liberado assim que ele for confirmado.
          </div>
        )}
      </div>

      {cobranca && (
        <div className="vx-card" style={{ padding: 16, marginBottom: 18, background: "var(--brand-50)", borderColor: "var(--brand-100)" }}>
          <div className="vx-disp" style={{ fontSize: 15 }}>Assinatura criada</div>
          <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>{cobranca.message}</p>
          <button className="vx-btn vx-btn-sm vx-btn-ghost" style={{ marginTop: 8 }} onClick={() => setCobranca(null)}>Fechar</button>
        </div>
      )}

      <div className="vx-grid vx-g2">
        {planos.map((p) => {
          const ehAtual = p.chave === chaveAtual;
          const economia = 0.12 - p.takeRate;
          return (
            <div key={p.chave} className="vx-card" style={{
              padding: 20, position: "relative",
              borderColor: ehAtual ? "var(--brand)" : undefined,
            }}>
              {ehAtual && (
                <span className="vx-badge vx-badge-brand" style={{ position: "absolute", top: 14, right: 14 }}>
                  <Check size={11} /> Atual
                </span>
              )}
              <div className="vx-disp" style={{ fontSize: 17 }}>{p.nome}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 6 }}>
                <span className="vx-disp vx-mono" style={{ fontSize: 27 }}>
                  {p.preco === 0 ? "Grátis" : money(p.preco)}
                </span>
                {p.preco > 0 && <span className="vx-mut" style={{ fontSize: 12.5 }}>/mês</span>}
              </div>

              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
                padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                background: "var(--surface-2)", color: economia > 0 ? "var(--brand)" : "var(--muted)",
              }}>
                <TrendingDown size={12} />
                Taxa de {Math.round(p.takeRate * 100)}%
                {economia > 0 && <span className="vx-mut">· −{Math.round(economia * 100)}pp</span>}
              </div>

              <hr className="vx-sep" />
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {p.inclui.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
                    <Check size={14} color="var(--brand)" style={{ flex: "none", marginTop: 2 }} />
                    <span className="vx-mut">{item}</span>
                  </div>
                ))}
              </div>

              <button className={`vx-btn vx-btn-block ${ehAtual ? "" : "vx-btn-primary"}`}
                style={{ marginTop: 16 }}
                disabled={ehAtual || processando === p.chave}
                onClick={() => contratar(p.chave)}>
                {ehAtual ? "Plano atual" : processando === p.chave ? "Processando…" : `Mudar para ${p.nome}`}
              </button>
            </div>
          );
        })}
      </div>

      {chaveAtual !== "free" && (
        <button className="vx-btn vx-btn-danger vx-btn-block" style={{ marginTop: 16 }}
          disabled={processando === "cancelar"} onClick={cancelar}>
          {processando === "cancelar" ? "Cancelando…" : "Cancelar assinatura"}
        </button>
      )}

      <p className="vx-mut" style={{ fontSize: 12, marginTop: 16, display: "flex", gap: 7, alignItems: "flex-start" }}>
        <Sparkles size={13} style={{ flex: "none", marginTop: 2 }} />
        A assinatura é separada do caixa de campanha: o plano define acesso e taxa,
        o caixa paga as ações dos profissionais.
      </p>
    </div>
  );
}

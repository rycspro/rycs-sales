import { apiPatch } from "../../lib/api.js";
import { DESTAQUES, ORDEM_DESTAQUES } from "../../../shared/planos.js";
import { Check } from "lucide-react";

// Preço sem centavos, no mesmo formato dos cards de plano (ex.: "R$ 190").
const precoCurto = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Destaque da empresa na vitrine: quatro versões contratadas à parte, sem
// depender do plano adquirido. Antes vivia como "Posição na vitrine" dentro de
// Insights › Desempenho; movido para Pagamentos › Planos.
export default function DestaqueEmpresa({ emp, up, aviso }) {
  // Compatível com o campo booleano antigo: se havia destaque sem tipo, assume o topo.
  const ativo = emp.destaqueTipo || (emp.destaque ? "topo" : "");

  const selecionar = async (key) => {
    const ligar = ativo !== key;
    const tipo = ligar ? key : "";
    await apiPatch(`/companies/${emp.id}`, { destaque: ligar, destaqueTipo: tipo });
    up((d) => ({ companies: d.companies.map((c) => c.id === emp.id ? { ...c, destaque: ligar, destaqueTipo: tipo } : c) }));
    aviso(ligar ? `${DESTAQUES[key].nome} ativado.` : "Destaque cancelado.");
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ padding: "4px 0 16px" }}>
        <div className="vx-eyebrow">Visibilidade na vitrine</div>
        <h1 className="vx-disp" style={{ margin: "2px 0 3px" }}>Destaque da empresa</h1>
        <p style={{ margin: 0 }}>
          Aumente a visibilidade da sua empresa na vitrine. Disponível para qualquer empresa, independente do plano contratado — cancela quando quiser.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, alignItems: "stretch" }}>
        {ORDEM_DESTAQUES.map((key) => {
          const d = DESTAQUES[key];
          const on = ativo === key;
          return (
            <article
              key={key}
              className="vx-card"
              style={{
                position: "relative", padding: "26px 22px", display: "flex", flexDirection: "column",
                border: on ? "2px solid var(--brand)" : "1px solid var(--border)",
                background: on ? "var(--brand-50)" : undefined,
                boxShadow: on ? "var(--shadow-brand)" : "var(--shadow-card)",
                overflow: "hidden",
              }}
            >
              {on && (
                <div style={{ position: "absolute", top: 0, left: 0, display: "flex", alignItems: "center", gap: 4, background: "var(--brand)", color: "#fff", padding: "4px 10px", borderBottomRightRadius: 12, fontSize: 11, fontWeight: 700 }}>
                  <Check size={12} strokeWidth={3} /> Ativo
                </div>
              )}

              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", letterSpacing: ".04em", textTransform: "uppercase", marginTop: 6 }}>
                {d.nome}
              </div>

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6, margin: "16px 0 2px" }}>
                <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-.03em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{precoCurto(d.preco)}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>/mês</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", marginBottom: 4 }}>
                cobrado mensalmente · cancela quando quiser
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 9 }}>
                {d.itens.map((it) => (
                  <li key={it} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--text-2, var(--ink))", textAlign: "left" }}>
                    <Check size={15} color="var(--brand)" strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 1 }} /> {it}
                  </li>
                ))}
              </ul>

              <div style={{ borderTop: "1px solid var(--border)", margin: "18px 0 14px" }} />

              <button
                type="button"
                className={"vx-btn vx-btn-block " + (on ? "" : "vx-btn-primary")}
                onClick={() => selecionar(key)}
                style={{ marginTop: "auto", fontWeight: 700 }}
              >
                {on ? "Cancelar destaque" : "Ativar destaque"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

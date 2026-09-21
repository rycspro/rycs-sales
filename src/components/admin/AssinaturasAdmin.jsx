import { useEffect, useMemo, useState } from "react";
import { Search, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api.js";
import { money, dataCurta } from "../../lib/utils.js";

// Cobrança das empresas, na visão da plataforma.
//
// Lista TODAS as empresas, inclusive as que nunca assinaram. Mostrar só quem
// tem assinatura esconderia exatamente o grupo que a operação precisa ver: as
// empresas usando a RYCS sem pagar.

const ROTULOS = {
  ativa: "Ativo",
  trial: "Trial",
  pendente: "Pendente",
  inadimplente: "Inadimplente",
  sem: "Sem assinatura",
};

const TONS = {
  ativa: "brand",
  trial: "brand",
  pendente: "amber",
  inadimplente: "red",
  sem: "muted",
};

const FILTROS = [
  ["todos", "Todos"],
  ["ativa", "Ativos"],
  ["trial", "Trial"],
  ["pendente", "Pendentes"],
  ["inadimplente", "Inadimplentes"],
  ["sem", "Sem assinatura"],
];

export default function AssinaturasAdmin() {
  const [dados, setDados] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => { api("/admin/subscriptions").then((r) => setDados(r || { linhas: [], resumo: {} })); }, []);

  const linhas = useMemo(() => {
    let l = dados?.linhas || [];
    if (filtro !== "todos") l = l.filter((x) => x.estado === filtro);
    if (busca) {
      const q = busca.toLowerCase();
      l = l.filter((x) => x.empresa.toLowerCase().includes(q));
    }
    return l;
  }, [dados, filtro, busca]);

  if (!dados) return <div className="vx-fade"><div className="vx-mut" style={{ fontSize: 13 }}>Carregando…</div></div>;

  const resumo = dados.resumo || {};

  return (
    <div className="vx-fade">
      <div className="vx-row" style={{ marginBottom: 16 }}>
        <div className="vx-disp" style={{ fontSize: 22 }}>Cobrança</div>
        <span className="vx-badge vx-badge-muted">{dados.total} empresas</span>
      </div>

      {/* Quem não está pagando é o número que a operação abre a tela para ver */}
      {(resumo.sem > 0 || resumo.inadimplente > 0) && (
        <div className="vx-card" style={{ padding: "13px 16px", marginBottom: 16, borderColor: "var(--amber)", background: "rgba(240,180,94,.07)" }}>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <AlertTriangle size={16} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
              {resumo.sem > 0 && <><b>{resumo.sem}</b> empresa(s) usando a plataforma sem assinatura. </>}
              {resumo.inadimplente > 0 && <><b>{resumo.inadimplente}</b> com pagamento pendente de regularização.</>}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--muted)" }} />
          <input className="vx-input" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa" style={{ paddingLeft: 32 }} />
        </div>
        <div className="vx-seg">
          {FILTROS.map(([k, t]) => (
            <button key={k} data-on={filtro === k ? "1" : "0"} onClick={() => setFiltro(k)}>
              {t}{k !== "todos" && resumo[k] ? ` ${resumo[k]}` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
            <thead>
              <tr>
                {["Empresa", "Plano", "Valor", "Status", "Próxima cobrança"].map((h) => (
                  <th key={h} style={{
                    textAlign: h === "Valor" ? "right" : "left", padding: "11px 14px",
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
                      ? <>{dataCurta(l.proximaCobranca)}{l.estado === "trial" && <div className="vx-mut" style={{ fontSize: 11 }}>fim do trial</div>}</>
                      : <span className="vx-mut">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {linhas.length === 0 && (
          <div className="vx-mut" style={{ padding: 20, textAlign: "center", fontSize: 13 }}>
            Nenhuma empresa neste filtro.
          </div>
        )}
      </div>
    </div>
  );
}

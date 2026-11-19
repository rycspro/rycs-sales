import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { valoresDaLiberacao } from "../../../shared/valorTarefa.js";
import { Vazio } from "../ui.jsx";
import CardEnvio from "../CardEnvio.jsx";

// Tela Liberar: as tarefas confirmadas agrupadas por profissional, com um
// botão que libera o total dele de uma vez. O servidor refaz a conta e move
// o dinheiro numa transação só; aqui os valores servem para conferir antes
// do clique.
export default function LiberarAdmin({ db, paraLiberar, aviso, recarregar }) {
  const [aberto, setAberto] = useState({});
  const [liberando, setLiberando] = useState(null);

  const grupos = useMemo(() => {
    const porSeller = new Map();
    for (const sub of paraLiberar) {
      const plano = db.companies.find((c) => c.id === sub.companyId)?.assinatura;
      const v = valoresDaLiberacao(sub, plano);
      const g = porSeller.get(sub.sellerId) || { sellerId: sub.sellerId, subs: [], liquido: 0, taxa: 0 };
      g.subs.push({ sub, ...v });
      g.liquido += v.liquido;
      g.taxa += v.taxa;
      porSeller.set(sub.sellerId, g);
    }
    return [...porSeller.values()]
      .map((g) => ({
        ...g,
        nome: db.sellers.find((s) => s.id === g.sellerId)?.nome || "Profissional",
        liquido: Math.round(g.liquido * 100) / 100,
        taxa: Math.round(g.taxa * 100) / 100,
      }))
      .sort((a, b) => b.liquido - a.liquido);
  }, [db, paraLiberar]);

  const liberarTudo = async (g) => {
    if (liberando) return;
    const qtd = g.subs.length;
    if (!window.confirm(`Liberar para saque?\n\nProfissional: ${g.nome}\nTarefas: ${qtd}\nTotal para o profissional: ${money(g.liquido)}\nTaxas da empresa: ${money(g.taxa)}`)) return;
    setLiberando(g.sellerId);
    try {
      const r = await api("/submissions/liberar-lote", { sellerId: g.sellerId, ids: g.subs.map((x) => x.sub.id) });
      if (r?.error) return aviso(r.error);
      await recarregar();
      aviso(r.liberadas
        ? `${money(r.liquido)} liberados para ${g.nome} (${r.liberadas} ${r.liberadas === 1 ? "tarefa" : "tarefas"}).`
        : "Essas tarefas já tinham sido liberadas. Nada foi creditado de novo.");
    } finally {
      setLiberando(null);
    }
  };

  if (!grupos.length)
    return <Vazio titulo="Nada para liberar" texto="Ações aprovadas pela IA ou conferidas pela empresa chegam aqui para o repasse final." />;

  return (
    <div className="vx-grid">
      {grupos.map((g) => {
        const qtd = g.subs.length;
        const expandido = !!aberto[g.sellerId];
        const ocupado = liberando === g.sellerId;
        return (
          <div key={g.sellerId} className="vx-card" style={{ padding: 18 }}>
            <div className="vx-row" style={{ alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <b style={{ fontSize: 15 }}>{g.nome}</b>
                <div className="vx-mut" style={{ fontSize: 12.5 }}>{qtd} {qtd === 1 ? "tarefa confirmada" : "tarefas confirmadas"}</div>
              </div>
              <div style={{ textAlign: "right", marginLeft: "auto" }}>
                <div className="vx-disp vx-mono" style={{ fontSize: 20, color: "var(--brand)" }}>{money(g.liquido)}</div>
                <div className="vx-mut vx-mono" style={{ fontSize: 11.5 }}>taxas da empresa {money(g.taxa)}</div>
              </div>
            </div>

            <button
              className="vx-btn vx-btn-sm vx-btn-block"
              style={{ marginTop: 12 }}
              aria-expanded={expandido}
              onClick={() => setAberto((a) => ({ ...a, [g.sellerId]: !a[g.sellerId] }))}
            >
              <ChevronDown size={14} style={{ transform: expandido ? "rotate(180deg)" : "none", transition: ".15s" }} />
              {expandido ? "Ocultar tarefas" : `Ver as ${qtd} ${qtd === 1 ? "tarefa" : "tarefas"}`}
            </button>

            {expandido && (
              <div className="vx-grid" style={{ marginTop: 12 }}>
                {g.subs.map(({ sub, liquido, taxa }) => (
                  <CardEnvio key={sub.id} sub={sub} db={db} extra={
                    <div className="vx-mut vx-mono" style={{ fontSize: 11.5, marginTop: 10 }}>
                      profissional {money(liquido)} · taxa da empresa {money(taxa)}
                    </div>
                  } />
                ))}
              </div>
            )}

            <button
              className="vx-btn vx-btn-primary vx-btn-block"
              style={{ marginTop: 12, minHeight: 44 }}
              disabled={!!liberando}
              onClick={() => liberarTudo(g)}
            >
              {ocupado ? "Liberando…" : `Liberar ${money(g.liquido)} para saque`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

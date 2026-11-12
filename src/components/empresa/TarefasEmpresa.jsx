import { useMemo, useState } from "react";
import { ListChecks, Megaphone, Layers, Coins, Filter, Search } from "lucide-react";
import { money } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";

const STATUS_CAMPANHA = {
  ativa: { txt: "Ativa", cor: "var(--brand)" },
  rascunho: { txt: "Rascunho", cor: "var(--muted)" },
  pausada: { txt: "Pausada", cor: "var(--amber)" },
  encerrada: { txt: "Encerrada", cor: "var(--muted)" },
  cancelada: { txt: "Cancelada", cor: "var(--muted)" },
};

// Normaliza o campo `tarefas` da campanha: hoje é um mapa { tipo: valor }, mas
// versões antigas gravaram um array [{ tipo|acao, valor }]. Devolve sempre pares
// [tipo, valor] com valor configurado (> 0 = ação remunerada e ativa).
function paresDeTarefas(t) {
  if (!t) return [];
  const bruto = Array.isArray(t)
    ? t.map((x) => [x.tipo || x.acao, Number(x.valor || 0)])
    : Object.entries(t).map(([tipo, valor]) => [tipo, Number(valor || 0)]);
  return bruto.filter(([tipo, valor]) => tipo && valor > 0);
}

export default function TarefasEmpresa({ emp, db }) {
  const [busca, setBusca] = useState("");
  const [filtroCampaign, setFiltroCampaign] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  const campanhas = useMemo(
    () => (db.campaigns || []).filter((c) => c.companyId === emp.id),
    [db.campaigns, emp.id],
  );

  // Todas as tarefas configuradas, de todas as campanhas, reunidas num só lugar.
  const tarefas = useMemo(
    () => campanhas.flatMap((c) => paresDeTarefas(c.tarefas).map(([tipo, valor]) => ({ campanha: c, tipo, valor }))),
    [campanhas],
  );

  const visiveis = useMemo(() => tarefas.filter((t) => {
    if (filtroCampaign && t.campanha.id !== filtroCampaign) return false;
    if (filtroTipo && t.tipo !== filtroTipo) return false;
    if (busca) {
      const term = busca.toLowerCase();
      const acao = (ACOES[t.tipo]?.nome || t.tipo).toLowerCase();
      if (!t.campanha.titulo?.toLowerCase().includes(term) && !acao.includes(term)) return false;
    }
    return true;
  }), [tarefas, filtroCampaign, filtroTipo, busca]);

  // Agrupa as tarefas visíveis por campanha, preservando a ordem das campanhas.
  const grupos = useMemo(() => {
    const porCampanha = new Map();
    visiveis.forEach((t) => {
      if (!porCampanha.has(t.campanha.id)) porCampanha.set(t.campanha.id, { campanha: t.campanha, itens: [] });
      porCampanha.get(t.campanha.id).itens.push(t);
    });
    return [...porCampanha.values()];
  }, [visiveis]);

  const stats = useMemo(() => ({
    total: tarefas.length,
    campanhas: new Set(tarefas.map((t) => t.campanha.id)).size,
    tipos: new Set(tarefas.map((t) => t.tipo)).size,
    custo: tarefas.reduce((acc, t) => acc + t.valor, 0),
  }), [tarefas]);

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Operação das campanhas</div>
          <h1 className="vx-disp">Tarefas</h1>
          <p>Todas as tarefas configuradas nas suas campanhas, reunidas em um só lugar.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          ["Tarefas", stats.total.toLocaleString("pt-BR"), ListChecks],
          ["Campanhas", stats.campanhas.toLocaleString("pt-BR"), Megaphone],
          ["Tipos de ação", stats.tipos.toLocaleString("pt-BR"), Layers],
          ["Custo por execução", money(stats.custo), Coins],
        ].map(([label, val, Icon]) => (
          <div key={label} className="vx-glass-panel vx-tile">
            <div className="vx-tile-top"><span>{label}</span><Icon size={17} strokeWidth={1.7} aria-hidden="true" /></div>
            <div className="vx-tile-val">{val}</div>
          </div>
        ))}
      </div>

      <div className="vx-card" style={{ padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 180px" }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-2)" }} />
            <input className="vx-input" style={{ paddingLeft: 28 }} placeholder="Buscar tarefa ou campanha…"
              value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Filter size={14} style={{ color: "var(--text-2)", flexShrink: 0 }} />
          <select className="vx-input" style={{ flex: "1 1 150px", maxWidth: 220 }} value={filtroCampaign} onChange={(e) => setFiltroCampaign(e.target.value)}>
            <option value="">Todas as campanhas</option>
            {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
          </select>
          <select className="vx-input" style={{ flex: "1 1 140px", maxWidth: 180 }} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {ORDEM_ACOES.map((k) => <option key={k} value={k}>{ACOES[k]?.nome || k}</option>)}
          </select>
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="vx-card" style={{ padding: 40, textAlign: "center" }}>
          <ListChecks size={28} color="var(--muted)" style={{ marginBottom: 10 }} />
          <div className="vx-disp" style={{ fontSize: 15 }}>Nenhuma tarefa configurada</div>
          <div className="vx-mut" style={{ fontSize: 13, marginTop: 4 }}>
            {tarefas.length === 0
              ? "As tarefas aparecem aqui assim que você configurar os valores das ações nas suas campanhas."
              : "Ajuste os filtros para ver as tarefas das campanhas."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {grupos.map(({ campanha, itens }) => {
            const st = STATUS_CAMPANHA[campanha.status] || STATUS_CAMPANHA.rascunho;
            const totalCampanha = itens.reduce((acc, t) => acc + t.valor, 0);
            return (
              <div key={campanha.id} className="vx-card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="vx-row" style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Megaphone size={16} color="var(--brand)" style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <b style={{ fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campanha.titulo || "Campanha sem título"}</b>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: st.cor, fontWeight: 600 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.cor }} />{st.txt}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="vx-mut" style={{ fontSize: 11 }}>{itens.length} {itens.length === 1 ? "tarefa" : "tarefas"} · custo por execução</div>
                    <div className="vx-mono" style={{ fontSize: 14, fontWeight: 700 }}>{money(totalCampanha)}</div>
                  </div>
                </div>
                <div className="vx-table-wrap">
                  <table className="vx-table">
                    <thead>
                      <tr>
                        <th>Tarefa</th>
                        <th style={{ textAlign: "right" }}>Valor por execução</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((t) => {
                        const acao = ACOES[t.tipo];
                        const Icon = acao?.Icon;
                        return (
                          <tr key={campanha.id + ":" + t.tipo}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13 }}>
                                {Icon && <Icon size={15} color="var(--brand)" />}
                                {acao?.nome || t.tipo}
                              </div>
                            </td>
                            <td style={{ textAlign: "right" }} className="vx-mono">{money(t.valor)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

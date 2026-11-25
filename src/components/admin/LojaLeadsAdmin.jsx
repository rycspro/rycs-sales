import { useState, useEffect } from "react";
import { Eye, Users, DollarSign, Clock, TrendingUp, Pencil, Check, X } from "lucide-react";
import { api } from "../../lib/api.js";

export default function LojaLeadsAdmin({ aviso }) {
  const [resumo, setResumo] = useState(null);
  const [ciclos, setCiclos] = useState([]);
  const [precos, setPrecos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroCiclo, setFiltroCiclo] = useState("");

  const recarregar = async () => {
    const [r, c, p] = await Promise.all([
      api("/loja-leads/admin/resumo"),
      api(`/loja-leads/admin/ciclos${filtroCiclo ? `?status=${filtroCiclo}` : ""}`),
      api("/loja-leads/precos"),
    ]);
    setResumo(r);
    setCiclos(c?.ciclos || []);
    setPrecos(p?.precos || []);
    setLoading(false);
  };

  useEffect(() => { recarregar(); }, [filtroCiclo]);

  const fecharCiclo = async (cicloId) => {
    if (!confirm("Fechar este ciclo de faturamento?")) return;
    const r = await api("/loja-leads/admin/fechar-ciclo", { cicloId });
    if (r?.error) return aviso?.(r.error);
    aviso?.("Ciclo fechado.");
    recarregar();
  };

  const formatarData = (ts) => ts ? new Date(ts).toLocaleDateString("pt-BR") : "—";

  if (loading) return <div style={{ padding: 24, textAlign: "center" }}><div className="vx-spinner" /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>Loja de Leads — Admin</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Visão geral de consumo, faturamento e preços.
        </p>
      </div>

      {resumo && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Stat label="Contatos no cache" valor={resumo.totalContatos} icone={<Eye size={16} />} />
          <Stat label="Total revelados" valor={resumo.totalConsumo} icone={<TrendingUp size={16} />} destaque />
          <Stat label="Usuários ativos" valor={resumo.totalUsuarios} icone={<Users size={16} />} />
          <Stat label="Revelados (30 dias)" valor={resumo.consumoMes} icone={<Clock size={16} />} />
          <Stat label="Ciclos abertos" valor={resumo.ciclosAbertos} icone={<Clock size={16} />} />
          <Stat label="Faturado (fechados)" valor={`R$ ${(resumo.faturamento || 0).toFixed(2)}`} icone={<DollarSign size={16} />} destaque />
        </div>
      )}

      {resumo?.topUsuarios?.length > 0 && (
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
            Top 10 consumidores
          </span>
          <div style={{ marginTop: 8, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  <th style={thStyle}>Entidade</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Revelados</th>
                </tr>
              </thead>
              <tbody>
                {resumo.topUsuarios.map((u, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={tdStyle}>{u.entityId}</td>
                    <td style={tdStyle}>{u.entityRole}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{u.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Tabela de preços</span>
        </div>
        {precos.map((p) => (
          <PrecoEditor key={p.id} preco={p} aviso={aviso} onAtualizar={recarregar} />
        ))}
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Ciclos de faturamento</span>
          <div className="vx-seg" style={{ alignSelf: "flex-start" }}>
            {[["", "Todos"], ["aberto", "Abertos"], ["fechado", "Fechados"]].map(([v, l]) => (
              <button key={v} data-on={filtroCiclo === v ? "1" : "0"} onClick={() => setFiltroCiclo(v)}>{l}</button>
            ))}
          </div>
        </div>

        {!ciclos.length && (
          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 24 }}>
            Nenhum ciclo encontrado.
          </p>
        )}

        {ciclos.length > 0 && (
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  <th style={thStyle}>Entidade</th>
                  <th style={thStyle}>Período</th>
                  <th style={thStyle}>Contatos</th>
                  <th style={thStyle}>Valor</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {ciclos.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={tdStyle}>
                      <div style={{ fontSize: 12 }}>{c.entityId}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.entityRole}</div>
                    </td>
                    <td style={tdStyle}>{formatarData(c.inicio)} — {formatarData(c.fim)}</td>
                    <td style={tdStyle}>{c.totalContatos}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "var(--brand)" }}>R$ {(c.valorTotal || 0).toFixed(2)}</td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 11, padding: "2px 10px", borderRadius: 10, fontWeight: 600,
                        background: c.status === "fechado" ? "var(--surface)" : "var(--brand)",
                        color: c.status === "fechado" ? "var(--muted)" : "#fff",
                      }}>
                        {c.status === "fechado" ? "Fechado" : "Aberto"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {c.status === "aberto" && (
                        <button type="button" className="vx-btn vx-btn-sm" onClick={() => fecharCiclo(c.id)}
                          style={{ fontSize: 12 }}>
                          Fechar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PrecoEditor({ preco, aviso, onAtualizar }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(preco.valorUnitario.toFixed(2));

  const salvar = async () => {
    const v = parseFloat(valor);
    if (isNaN(v) || v <= 0) return aviso?.("Valor inválido.");
    const r = await api("/loja-leads/admin/precos", { id: preco.id, valorUnitario: v });
    if (r?.error) return aviso?.(r.error);
    aviso?.("Preço atualizado.");
    setEditando(false);
    onAtualizar?.();
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
      background: "var(--surface-2)", borderRadius: 8, marginBottom: 6, border: "1px solid var(--border)",
    }}>
      <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{preco.faixa} contatos</span>
      {editando ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>R$</span>
          <input className="vx-input" value={valor} onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()}
            autoFocus style={{ width: 80, fontSize: 13, minHeight: 32, padding: "4px 8px", textAlign: "right" }} />
          <button type="button" className="vx-btn vx-btn-sm vx-btn-primary" onClick={salvar} style={{ padding: 4 }}>
            <Check size={14} />
          </button>
          <button type="button" className="vx-btn vx-btn-sm" onClick={() => { setEditando(false); setValor(preco.valorUnitario.toFixed(2)); }}
            style={{ padding: 4 }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>R$ {preco.valorUnitario.toFixed(2)}</span>
          <button type="button" className="vx-btn vx-btn-sm" onClick={() => setEditando(true)} style={{ padding: 4 }}>
            <Pencil size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, valor, icone, destaque }) {
  return (
    <div style={{
      flex: 1, minWidth: 140, background: destaque ? "var(--brand-bg, var(--surface))" : "var(--surface-2)",
      borderRadius: 10, padding: "14px 16px", border: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ color: destaque ? "var(--brand)" : "var(--muted)" }}>{icone}</span>
        <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</span>
      </div>
      <div style={{ fontSize: typeof valor === "number" ? 22 : 16, fontWeight: 700, color: "var(--ink)" }}>{valor}</div>
    </div>
  );
}

const thStyle = { padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--ink-2)", fontSize: 12 };
const tdStyle = { padding: "8px 12px", color: "var(--ink)" };

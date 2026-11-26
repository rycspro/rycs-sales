import { useEffect, useState } from "react";
import { api, apiDelete } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import { Vazio } from "../ui.jsx";
import { UserPlus, Trash2, Unplug, AlertTriangle, Wifi, WifiOff, Users, MessageSquare, Shield } from "lucide-react";

export default function EvolutionAdmin({ aviso }) {
  const [aba, setAba] = useState("pilotos");
  const [pilotos, setPilotos] = useState([]);
  const [conexoes, setConexoes] = useState([]);
  const [metricas, setMetricas] = useState(null);
  const [consentimentos, setConsentimentos] = useState([]);
  const [novoSellerId, setNovoSellerId] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [limite, setLimite] = useState(10);

  const carregar = async () => {
    const [p, c, m, cs] = await Promise.all([
      api("/evolution/admin/pilotos"),
      api("/evolution/admin/conexoes"),
      api("/evolution/admin/metricas"),
      api("/evolution/admin/consentimentos"),
    ]);
    if (p?.pilotos) { setPilotos(p.pilotos); setLimite(p.limite); }
    if (c?.conexoes) setConexoes(c.conexoes);
    if (m) setMetricas(m);
    if (cs?.consentimentos) setConsentimentos(cs.consentimentos);
  };

  useEffect(() => { carregar(); }, []);

  const adicionar = async () => {
    if (!novoSellerId.trim()) return aviso?.("Informe o ID do profissional.");
    setOcupado(true);
    try {
      const r = await api("/evolution/admin/pilotos", { sellerId: novoSellerId.trim() });
      if (r?.error) throw new Error(r.error);
      aviso?.(`${r.nome || "Profissional"} autorizado.`);
      setNovoSellerId("");
      carregar();
    } catch (e) { aviso?.(e.message); }
    finally { setOcupado(false); }
  };

  const remover = async (sellerId) => {
    if (!window.confirm("Remover este profissional do piloto? A conexão ativa dele não será desconectada, mas ele não poderá reconectar.")) return;
    await apiDelete(`/evolution/admin/pilotos/${sellerId}`);
    carregar();
  };

  const desconectarAdmin = async (conexaoId) => {
    if (!window.confirm("Desconectar esta instância? O profissional perderá a conexão.")) return;
    const r = await api(`/evolution/admin/desconectar/${conexaoId}`, {});
    if (r?.error) return aviso?.(r.error);
    aviso?.("Desconectado.");
    carregar();
  };

  const abas = [
    { key: "pilotos", label: "Pilotos", Icon: Users },
    { key: "conexoes", label: "Conexões", Icon: Wifi },
    { key: "metricas", label: "Métricas", Icon: MessageSquare },
    { key: "consentimentos", label: "Consentimentos", Icon: Shield },
  ];

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <div className="vx-eyebrow">Administração</div>
          <h1 className="vx-disp">WhatsApp Pessoal (Evolution API)</h1>
          <p>Gerencie o piloto, conexões e métricas da integração via QR Code.</p>
        </div>
      </div>

      <div className="vx-tabs" style={{ marginBottom: 16 }}>
        {abas.map((a) => (
          <button key={a.key} type="button" className={`vx-tab ${aba === a.key ? "vx-tab-active" : ""}`} onClick={() => setAba(a.key)}>
            <a.Icon size={14} aria-hidden="true" /> {a.label}
          </button>
        ))}
      </div>

      {aba === "pilotos" && (
        <section>
          <div className="vx-card" style={{ padding: 18, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Autorizar profissional ({pilotos.length}/{limite})</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input className="vx-input" placeholder="ID do profissional (sellerId)" value={novoSellerId} onChange={(e) => setNovoSellerId(e.target.value)} style={{ flex: 1, minWidth: 200, minHeight: 44 }} />
              <button type="button" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} onClick={adicionar} disabled={ocupado || !novoSellerId.trim()}>
                <UserPlus size={14} aria-hidden="true" /> Autorizar
              </button>
            </div>
            {pilotos.length >= limite && (
              <div className="vx-notice vx-notice-amber" style={{ marginTop: 8, fontSize: 12 }}>
                <AlertTriangle size={14} style={{ verticalAlign: -2 }} /> Limite de {limite} pilotos atingido.
              </div>
            )}
          </div>

          {pilotos.length === 0 ? (
            <Vazio titulo="Nenhum piloto" texto="Autorize profissionais acima para que possam conectar o WhatsApp pessoal." />
          ) : (
            <div className="vx-card" style={{ overflow: "auto" }}>
              <table className="vx-table">
                <thead><tr><th>Profissional</th><th>ID</th><th>Desde</th><th></th></tr></thead>
                <tbody>
                  {pilotos.map((p) => (
                    <tr key={p.sellerId}>
                      <td>{p.nomeVendedor || "—"}</td>
                      <td style={{ fontSize: 11, fontFamily: "monospace" }}>{p.sellerId}</td>
                      <td>{dataCurta(p.criadoEm)}</td>
                      <td>
                        <button type="button" className="vx-btn vx-btn-sm vx-btn-danger" onClick={() => remover(p.sellerId)}>
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {aba === "conexoes" && (
        <section>
          {conexoes.length === 0 ? (
            <Vazio titulo="Nenhuma conexão" texto="Quando profissionais conectarem o WhatsApp pessoal, as conexões aparecerão aqui." />
          ) : (
            <div className="vx-card" style={{ overflow: "auto" }}>
              <table className="vx-table">
                <thead><tr><th>Profissional</th><th>Empresa</th><th>Número</th><th>Status</th><th>Desde</th><th></th></tr></thead>
                <tbody>
                  {conexoes.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nomeVendedor || "—"}</td>
                      <td>{c.nomeEmpresa || "—"}</td>
                      <td>{c.numero ? `+${c.numero}` : "—"}</td>
                      <td style={{ color: c.status === "ativa" ? "var(--green)" : c.status === "desconectada" ? "var(--red)" : "var(--amber)" }}>
                        {c.status === "ativa" ? <><Wifi size={12} style={{ verticalAlign: -1 }} /> Ativa</> : c.status === "desconectada" ? <><WifiOff size={12} style={{ verticalAlign: -1 }} /> Desconectada</> : c.status}
                      </td>
                      <td>{dataCurta(c.criadoEm)}</td>
                      <td>
                        {c.status === "ativa" && (
                          <button type="button" className="vx-btn vx-btn-sm vx-btn-danger" onClick={() => desconectarAdmin(c.id)}>
                            <Unplug size={13} /> Desconectar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {aba === "metricas" && metricas && (
        <section>
          <div className="vx-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Pilotos", valor: `${metricas.totalPilotos}/${metricas.limitePilotos}` },
              { label: "Conexões ativas", valor: metricas.ativas },
              { label: "Total conexões", valor: metricas.totalConexoes },
              { label: "Conversas", valor: metricas.totalConversas },
              { label: "Mensagens", valor: metricas.totalMensagens },
              { label: "Consentimentos", valor: metricas.totalConsentimentos },
            ].map((m) => (
              <div key={m.label} className="vx-card" style={{ padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{m.valor}</div>
                <div className="vx-mut" style={{ fontSize: 12 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {aba === "consentimentos" && (
        <section>
          {consentimentos.length === 0 ? (
            <Vazio titulo="Nenhum consentimento" texto="Os termos aceitos pelos profissionais aparecerão aqui." />
          ) : (
            <div className="vx-card" style={{ overflow: "auto" }}>
              <table className="vx-table">
                <thead><tr><th>Profissional</th><th>Empresa</th><th>IP</th><th>Data</th></tr></thead>
                <tbody>
                  {consentimentos.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nomeVendedor || c.sellerId}</td>
                      <td>{c.nomeEmpresa || c.companyId}</td>
                      <td style={{ fontSize: 11, fontFamily: "monospace" }}>{c.ip || "—"}</td>
                      <td>{dataCurta(c.criadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

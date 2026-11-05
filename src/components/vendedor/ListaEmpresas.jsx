import { useEffect, useState } from "react";
import { api, apiPatch } from "../../lib/api.js";
import { money } from "../../lib/utils.js";
import { ACOES, ORDEM_ACOES } from "../../lib/constants.js";
import { CompanyScoreChip } from "../CompanyScore.jsx";

export default function ListaEmpresas({ eu, db, up, aviso, abrir, recarregar }) {
  const ordenadas = [...db.companies].sort((a, b) => Number(b.destaque) - Number(a.destaque));
  const [convites, setConvites] = useState([]);
  const [msgAberta, setMsgAberta] = useState(null);
  const [mensagem, setMensagem] = useState("");
  useEffect(() => { api("/partnerships/invitations").then((r) => { if (Array.isArray(r)) setConvites(r); }); }, []);

  const candidatar = async (companyId) => {
    const r = await api("/applications", { sellerId: eu.id, companyId, mensagem: mensagem.trim() });
    if (r?.error) return aviso(r.error);
    setMsgAberta(null);
    setMensagem("");
    up?.((d) => ({ sellers: d.sellers.map((s) => s.id === eu.id ? { ...s, aplicacoes: { ...s.aplicacoes, [companyId]: "pendente" } } : s) }));
    if (r?.pendencias?.length) {
      aviso(`Solicitação enviada. Para aumentar suas chances, complete: ${r.pendencias.join(", ")}.`);
    } else {
      aviso("Solicitação enviada. A empresa irá analisar seu perfil.");
    }
  };

  const responderConvite = async (convite, status) => {
    const r = await apiPatch(`/partnerships/${convite.id}`, { status });
    if (r?.error) return aviso(r.error);
    setConvites((lista) => lista.map((c) => c.id === convite.id ? { ...c, status } : c));
    await recarregar?.();
    aviso(status === "aprovado" ? "Parceria aceita. A empresa já aparece na sua operação." : "Convite recusado.");
  };

  return (
    <div className="vx-fade">
      {convites.some((c) => c.status === "pendente") && (
        <section className="vx-card" style={{ padding: 18, marginBottom: 22, borderColor: "var(--brand)" }}>
          <div className="vx-row">
            <div>
              <div className="vx-eyebrow">Convites de parceria</div>
              <div className="vx-disp" style={{ fontSize: 17 }}>Empresas querem trabalhar com você</div>
            </div>
            <span className="vx-chip vx-mono">{convites.filter((c) => c.status === "pendente").length}</span>
          </div>
          {convites.filter((c) => c.status === "pendente").map((c) => (
            <div key={c.id} className="vx-row" style={{ paddingTop: 12, marginTop: 12, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
              <div>
                <b>{c.empresaNome}</b>
                <div className="vx-mut" style={{ fontSize: 12 }}>{c.produto}{c.segmento ? ` · ${c.segmento}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 7 }}>
                <button className="vx-btn vx-btn-danger vx-btn-sm" onClick={() => responderConvite(c, "recusado")}>Recusar</button>
                <button className="vx-btn vx-btn-primary vx-btn-sm" onClick={() => responderConvite(c, "aprovado")}>Aceitar parceria</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="vx-row" style={{ marginBottom: 12 }}>
        <h2 className="vx-disp" style={{ fontSize: 19, margin: 0 }}>Empresas disponíveis</h2>
        <span className="vx-chip vx-mono">{ordenadas.length}</span>
      </div>

      <div className="vx-grid">
        {ordenadas.map((c) => {
          const st = eu.aplicacoes?.[c.id];
          const campanhasCount = (db.campaigns || []).filter((camp) => camp.companyId === c.id && camp.status === "ativa").length;

          return (
            <div key={c.id} className="vx-empresa-card">
              <div className="vx-empresa-topo" style={{ background: c.cor || "var(--brand)" }} />
              <div className="vx-empresa-corpo">
                <div className="vx-empresa-cabeca">
                  <div className="vx-empresa-logo">
                    {c.logo
                      ? <img src={c.logo} alt={c.nome} />
                      : <span>{String(c.nome || "?").slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="vx-disp" style={{ fontSize: 17 }}>{c.nome}</span>
                      {c.destaque && <span className="vx-badge vx-badge-amber">Destaque</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                      <CompanyScoreChip nota={c.nota} />
                      {c.segmento && <span className="vx-mut" style={{ fontSize: 12 }}>{c.segmento}</span>}
                    </div>
                    <div className="vx-mut" style={{ fontSize: 12.5, marginTop: 4 }}>{c.produto}</div>
                  </div>
                </div>

                <div className="vx-empresa-ficha">
                  <div><span className="vx-eyebrow">Ticket médio</span><b>{c.ticket || "—"}</b></div>
                  <div><span className="vx-eyebrow">Segmento</span><b>{c.segmento || "—"}</b></div>
                  <div><span className="vx-eyebrow">Região</span><b>{c.regiao || "Brasil"}</b></div>
                  <div><span className="vx-eyebrow">Campanhas</span><b>{campanhasCount > 0 ? `${campanhasCount} ativas` : "—"}</b></div>
                </div>

                <div className="vx-empresa-icp">
                  <span className="vx-eyebrow">Cliente ideal</span>
                  <p>{c.icp || "A empresa ainda não descreveu o cliente ideal."}</p>
                </div>

                {!!c.diferenciais && (
                  <div className="vx-empresa-icp">
                    <span className="vx-eyebrow">Diferenciais</span>
                    <p>{c.diferenciais}</p>
                  </div>
                )}

                <div className="vx-eyebrow" style={{ marginTop: 14, marginBottom: 6 }}>Comissões por ação</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {ORDEM_ACOES.filter((k) => c.comissoes[k]).map((k) => (
                    <span key={k} className="vx-chip vx-mono">{ACOES[k].nome} <b style={{ color: "var(--brand)" }}>{money(c.comissoes[k])}</b></span>
                  ))}
                </div>

                {st === "aprovado" ? (
                  <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => abrir(c.id)}>
                    Abrir área da empresa
                  </button>
                ) : st === "pendente" ? (
                  <button className="vx-btn vx-btn-block" disabled>Solicitação em análise</button>
                ) : (
                  <>
                    {msgAberta === c.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <textarea
                          style={{ width: "100%", padding: "8px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical", minHeight: 60, maxHeight: 120, boxSizing: "border-box", background: "var(--surface-2)", color: "var(--ink)" }}
                          placeholder="Escreva uma mensagem para a empresa (opcional)"
                          value={mensagem}
                          onChange={(e) => setMensagem(e.target.value)}
                          maxLength={600}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => candidatar(c.id)}>
                            Enviar solicitação
                          </button>
                          <button className="vx-btn vx-btn-block" style={{ flex: "0 0 auto" }} onClick={() => { setMsgAberta(null); setMensagem(""); }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button className="vx-btn vx-btn-primary vx-btn-block" onClick={() => { setMsgAberta(c.id); setMensagem(""); }}>
                        {st === "recusado" ? "Solicitar aprovação novamente" : "Solicitar aprovação"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

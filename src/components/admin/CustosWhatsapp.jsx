import { useEffect, useId, useState } from "react";
import { api } from "../../lib/api.js";
import { valor, pct, categoria, QUEM_PAGA, caixa, ErroMeta } from "./whatsappFormato.jsx";

// Quanto o WhatsApp custou, de onde sai o pagamento e o desempenho de cada
// modelo (entregas, leituras, cliques nos botões e custo), com os números da Meta.

const PERIODOS = [[7, "Últimos 7 dias"], [30, "Últimos 30 dias"], [90, "Últimos 90 dias"]];
const th = { padding: "6px 8px", whiteSpace: "nowrap" };
const td = { padding: "8px" };

export default function CustosWhatsapp({ aviso }) {
  const id = useId();
  const [dias, setDias] = useState(30);
  const [d, setD] = useState(null);
  const [ligando, setLigando] = useState(false);

  const carregar = () => {
    setD(null);
    api(`/admin/whatsapp/custos?dias=${dias}`).then((r) => {
      if (!r || r.error) { aviso?.(r?.error || "Não foi possível consultar a Meta."); setD({ erro: r?.error || "Falha na consulta." }); return; }
      setD(r);
    });
  };
  useEffect(carregar, [dias]); // eslint-disable-line react-hooks/exhaustive-deps

  const ligar = async () => {
    if (!window.confirm("Ligar as estatísticas dos modelos na Meta? Elas passam a contar entregas, leituras, cliques e custo de cada modelo. A Meta pode não deixar desligar depois.")) return;
    setLigando(true);
    const r = await api("/admin/whatsapp/estatisticas/ligar", {});
    setLigando(false);
    if (r?.error) return aviso?.(r.error);
    aviso?.("Estatísticas ligadas. Os números começam a aparecer conforme a Meta processa os envios.");
    carregar();
  };

  const moeda = d?.cobranca?.ok ? d.cobranca.dados.currency : "";
  const c = d?.custos?.ok ? d.custos.dados : null;
  const e = d?.estatisticas;
  const linkCobranca = d?.links?.[0]?.url;
  const insights = d?.cobranca?.ok ? d.cobranca.dados.is_enabled_for_insights : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ maxWidth: 240 }}>
        <label className="vx-label" htmlFor={`${id}-p`}>Período</label>
        <select id={`${id}-p`} className="vx-input" value={dias} onChange={(ev) => setDias(Number(ev.target.value))} style={{ minHeight: 44 }}>
          {PERIODOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {!d ? <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Consultando a Meta...</div>
        : d.erro ? <div className="vx-card" style={{ padding: 18 }}><ErroMeta erro={d.erro} /></div> : (<>
          <div className="vx-card" style={{ padding: 18 }}>
            <div className="vx-disp" style={{ fontSize: 15 }}>De onde sai o pagamento</div>
            {d.cobranca.ok ? (
              <div style={{ fontSize: 13, lineHeight: 1.7, marginTop: 8 }}>
                <div><span className="vx-mut">Quem paga:</span> {QUEM_PAGA[d.cobranca.dados.ownership_type] || d.cobranca.dados.ownership_type || "A Meta não informou."}</div>
                <div><span className="vx-mut">Moeda da cobrança:</span> {d.cobranca.dados.currency || "—"}</div>
                <div><span className="vx-mut">Forma de pagamento:</span> {d.cobranca.dados.primary_funding_id ? `ativa na Meta (código ${d.cobranca.dados.primary_funding_id})` : "a Meta não informa pela API."}</div>
              </div>
            ) : <div style={{ marginTop: 8 }}><ErroMeta erro={d.cobranca.erro} /></div>}
            <p className="vx-mut" style={{ fontSize: 12.5, margin: "8px 0 0", lineHeight: 1.5 }}>
              A Meta não mostra o cartão pela API. Para ver o cartão, trocar a forma de pagamento ou baixar faturas, abra
              {linkCobranca ? <> <a href={linkCobranca} target="_blank" rel="noreferrer">Configurações do negócio → Cobrança e pagamentos</a>.</> : " Configurações do negócio → Cobrança e pagamentos."}
            </p>
          </div>

          <div className="vx-card" style={{ padding: 18 }}>
            <div className="vx-disp" style={{ fontSize: 15 }}>Quanto custou</div>
            <p className="vx-mut" style={{ fontSize: 12.5, margin: "4px 0 0", lineHeight: 1.5 }}>
              Valores da Meta na moeda da conta. A Meta fecha os números por dia, então o dia de hoje pode ainda não aparecer.
              Respostas dentro da janela de 24h de atendimento são grátis.
            </p>
            {!c ? <div style={{ marginTop: 10 }}><ErroMeta erro={d.custos.erro} /></div> : (<>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10, marginTop: 14 }}>
                {[["Total gasto", valor(c.total.custo, moeda)], ["Mensagens cobradas", c.total.cobradas], ["Custo médio por mensagem", valor(c.total.custoPorMensagem, moeda, true)], ["Mensagens no total", c.total.mensagens]].map(([r, v]) => (
                  <div key={r} style={caixa}><div className="vx-mut" style={{ fontSize: 12 }}>{r}</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{v}</div></div>
                ))}
              </div>
              {c.categorias.length > 0 && (
                <div style={{ overflowX: "auto", marginTop: 14 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead><tr style={{ textAlign: "right", color: "var(--muted)" }}>
                      <th scope="col" style={{ ...th, textAlign: "left" }}>Categoria</th><th scope="col" style={th}>Mensagens</th><th scope="col" style={th}>Cobradas</th>
                      <th scope="col" style={th}>Grátis</th><th scope="col" style={th}>Custo</th><th scope="col" style={th}>Por mensagem</th>
                    </tr></thead>
                    <tbody>{c.categorias.map((x) => (
                      <tr key={x.categoria} style={{ borderTop: "1px solid var(--border)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        <th scope="row" style={{ ...td, textAlign: "left", fontWeight: 500 }}>{categoria(x.categoria)}</th>
                        <td style={td}>{x.mensagens}</td><td style={td}>{x.cobradas}</td><td style={td}>{x.gratis}</td>
                        <td style={td}>{valor(x.custo, moeda)}</td><td style={td}>{valor(x.custoPorMensagem, moeda, true)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              {c.dias.length > 0 && (
                <details style={{ marginTop: 12, fontSize: 12.5 }}>
                  <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>Custo por dia</summary>
                  {c.dias.map((x) => (
                    <div key={x.dia} className="vx-row" style={{ gap: 10, padding: "4px 0", borderBottom: "1px solid var(--border)", fontVariantNumeric: "tabular-nums" }}>
                      <span>{x.dia.split("-").reverse().join("/")}</span><span className="vx-mut">{x.mensagens} mensagens</span><span>{valor(x.custo, moeda)}</span>
                    </div>
                  ))}
                </details>
              )}
              {c.total.mensagens === 0 && <p className="vx-mut" style={{ fontSize: 12.5, marginTop: 12 }}>A Meta ainda não registrou mensagens neste período.</p>}
            </>)}
          </div>

          {e && (
            <div className="vx-card" style={{ padding: 18 }}>
              <div className="vx-disp" style={{ fontSize: 15 }}>Desempenho e cliques por modelo</div>
              <p className="vx-mut" style={{ fontSize: 12.5, margin: "4px 0 0", lineHeight: 1.5 }}>
                Números da própria Meta: enviadas, entregues, lidas, cliques nos botões (de link e de resposta rápida) e custo de cada modelo.
                Taxa de clique é sobre as entregues. A Meta guarda até 90 dias.
              </p>
              {!e.ok ? (
                <div style={{ marginTop: 10 }}>
                  <ErroMeta erro={e.erro} />
                  <p className="vx-mut" style={{ fontSize: 12.5, lineHeight: 1.5 }}>Se as estatísticas de modelos estiverem desligadas na conta, ligue aqui. Os números começam a contar a partir daí.</p>
                  <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={ligar} disabled={ligando}>{ligando ? "Ligando…" : "Ligar estatísticas dos modelos"}</button>
                </div>
              ) : e.dados.length === 0 ? (
                <div style={{ marginTop: 10 }}>
                  {insights === false
                    ? <p style={{ fontSize: 12.5, lineHeight: 1.5, margin: "0 0 8px" }}><b>As estatísticas de modelos estão desligadas na conta.</b> Sem elas a Meta não conta entregas, leituras, cliques e custo por modelo.</p>
                    : <p className="vx-mut" style={{ fontSize: 12.5, lineHeight: 1.5, margin: "0 0 8px" }}>A Meta não devolveu números por modelo neste período. Se as estatísticas de modelos estiverem desligadas na conta, ligue aqui.</p>}
                  {insights !== true && <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={ligar} disabled={ligando}>{ligando ? "Ligando…" : "Ligar estatísticas dos modelos"}</button>}
                </div>
              ) : (
                <div style={{ overflowX: "auto", marginTop: 14 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead><tr style={{ textAlign: "right", color: "var(--muted)" }}>
                      <th scope="col" style={{ ...th, textAlign: "left" }}>Modelo</th><th scope="col" style={th}>Enviadas</th><th scope="col" style={th}>Entregues</th>
                      <th scope="col" style={th}>Leitura</th><th scope="col" style={th}>Cliques</th><th scope="col" style={th}>Taxa de clique</th>
                      <th scope="col" style={th}>Custo</th><th scope="col" style={th}>Por entregue</th><th scope="col" style={th}>Por clique no link</th>
                    </tr></thead>
                    <tbody>{e.dados.map((m) => (
                      <tr key={m.id} style={{ borderTop: "1px solid var(--border)", textAlign: "right", fontVariantNumeric: "tabular-nums", verticalAlign: "top" }}>
                        <th scope="row" style={{ ...td, textAlign: "left", fontWeight: 500 }}>
                          {m.nome} <span className="vx-mut" style={{ fontSize: 11.5 }}>{m.idioma} · {categoria(m.categoria)}</span>
                          {m.botoes.length > 0 && (
                            <div className="vx-mut" style={{ fontSize: 11.5, fontWeight: 400, marginTop: 4 }}>
                              {m.botoes.map((b) => <div key={`${b.tipo}|${b.botao}`}>{b.botao || b.tipo}: {b.cliques} {b.cliques === 1 ? "clique" : "cliques"}</div>)}
                            </div>
                          )}
                        </th>
                        <td style={td}>{m.enviados}</td><td style={td}>{m.entregues}</td><td style={td}>{pct(m.taxaLeitura)}</td>
                        <td style={td}>{m.cliques}</td><td style={td}>{pct(m.taxaClique)}</td><td style={td}>{valor(m.custo, moeda)}</td>
                        <td style={td}>{valor(m.custoPorEntregue, moeda, true)}</td><td style={td}>{valor(m.custoPorClique, moeda, true)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>)}
    </div>
  );
}

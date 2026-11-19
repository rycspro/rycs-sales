import { useEffect, useId, useState } from "react";
import { api } from "../../lib/api.js";
import { dataHora, valor, categoria, STATUS_MENSAGEM, Selo } from "./whatsappFormato.jsx";

// Cada mensagem que saiu pelo número oficial, em detalhe: o texto exato, o caminho
// na Meta (enviada, entregue, lida), a cobrança e o que a pessoa respondeu.

const TIPO_COBRANCA = {
  regular: "cobrada", free_customer_service: "grátis (janela de atendimento de 24h)", free_entry_point: "grátis (veio de anúncio)",
};

// Situação mais avançada que a Meta informou; sem aviso, a do envio.
function situacao(m) {
  const s = new Set(m.avisos.map((a) => a.status));
  if (s.has("failed")) return "failed";
  if (s.has("read")) return "read";
  if (s.has("delivered")) return "delivered";
  if (s.has("sent")) return "sent";
  return m.status;
}

export default function MensagensWhatsapp({ aviso, disparos = [] }) {
  const id = useId();
  const [disparo, setDisparo] = useState("");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState(null);
  const [aberta, setAberta] = useState(null);
  const [custos, setCustos] = useState(null);

  const carregar = () => {
    const q = new URLSearchParams({ disparo, busca, limite: "300" });
    api(`/admin/whatsapp/mensagens?${q}`).then((r) => {
      if (r?.error) { aviso?.(r.error); setLista([]); return; }
      setLista(Array.isArray(r) ? r : []);
    });
  };
  useEffect(carregar, [disparo]); // eslint-disable-line react-hooks/exhaustive-deps -- busca só no botão
  useEffect(() => {
    api("/admin/whatsapp/custos?dias=30&estatisticas=0").then((r) => { if (r && !r.error) setCustos(r); });
  }, []);

  // Custo médio por mensagem cobrada de cada categoria, segundo a Meta (30 dias).
  const moeda = custos?.cobranca?.ok ? custos.cobranca.dados.currency : "";
  const medioPor = new Map((custos?.custos?.ok ? custos.custos.dados.categorias : []).map((c) => [String(c.categoria).toUpperCase(), c.custoPorMensagem]));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 10, marginBottom: 14, alignItems: "end" }}>
        <div>
          <label className="vx-label" htmlFor={`${id}-d`}>Disparo</label>
          <select id={`${id}-d`} className="vx-input" value={disparo} onChange={(e) => setDisparo(e.target.value)} style={{ minHeight: 44 }}>
            <option value="">Todas as mensagens</option>
            {disparos.map((d) => <option key={d.id} value={d.id}>{d.template} ({d.idioma}) · {dataHora(d.criadoEm)}</option>)}
          </select>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); carregar(); }} style={{ display: "flex", gap: 8, alignItems: "end" }}>
          <div style={{ flex: 1 }}>
            <label className="vx-label" htmlFor={`${id}-b`}>Buscar por nome ou número</label>
            <input id={`${id}-b`} className="vx-input" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ minHeight: 44 }} />
          </div>
          <button type="submit" className="vx-btn" style={{ minHeight: 44 }}>Buscar</button>
        </form>
      </div>

      {!lista ? <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Carregando...</div>
        : lista.length === 0 ? <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Nenhuma mensagem encontrada.</div>
        : (
          <div className="vx-card" style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 720 }}>
              <div style={{ display: "grid", gridTemplateColumns: COLUNAS, gap: 10, padding: "10px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)" }}>
                <span>Pessoa</span><span>Modelo</span><span>Enviada em</span><span>Situação</span><span>Cobrança</span><span>Respondeu</span>
              </div>
              {lista.map((m) => {
                const aberto = aberta === m.id;
                return (
                  <div key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <button type="button" onClick={() => setAberta(aberto ? null : m.id)} aria-expanded={aberto}
                      style={{ display: "grid", gridTemplateColumns: COLUNAS, gap: 10, padding: "12px 16px", alignItems: "center", fontSize: 13, width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer", color: "var(--ink)", minHeight: 44 }}>
                      <span style={{ minWidth: 0 }}><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nome || "—"}</b><span className="vx-mono vx-mut" style={{ fontSize: 11.5 }}>+{m.numero}</span></span>
                      <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${m.modelo} (${m.idioma})`}>{m.modelo}</span>
                      <span className="vx-mut" style={{ fontSize: 11.5 }}>{dataHora(m.enviadoEm)}</span>
                      <Selo par={STATUS_MENSAGEM[situacao(m)]} />
                      <span style={{ fontSize: 12 }}>{m.cobranca ? (m.cobranca.cobrada === false ? "Grátis" : categoria(m.cobranca.categoria)) : "—"}</span>
                      <span style={{ fontSize: 12 }}>{m.respostas.some((r) => !r.saida) ? "Sim" : m.respostas.some((r) => r.saida) ? "Pediu para sair" : "—"}</span>
                    </button>
                    {aberto && <Detalhe m={m} moeda={moeda} medio={m.cobranca ? medioPor.get(String(m.cobranca.categoria).toUpperCase()) : null} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      {lista?.length >= 300 && <p className="vx-mut" style={{ fontSize: 12 }}>Mostrando as 300 mais recentes. Use o filtro ou a busca para achar outras.</p>}
    </div>
  );
}

const COLUNAS = "minmax(150px,1.3fr) minmax(130px,1.2fr) 110px 90px 100px 90px";

function Detalhe({ m, moeda, medio }) {
  const msg = m.mensagem;
  return (
    <div style={{ padding: "4px 16px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
      <div>
        <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Mensagem enviada</div>
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
          <div style={{ background: "var(--surface)", borderRadius: 10, padding: 12, boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
            {msg.cabecalho && <b style={{ display: "block", fontSize: 13.5, marginBottom: 6 }}>{msg.cabecalho}</b>}
            <div style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", color: "var(--ink)" }}>{msg.corpo || "—"}</div>
            {msg.rodape && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>{msg.rodape}</div>}
            {msg.botoes?.length > 0 && (
              <div style={{ marginTop: 10, borderTop: "1px solid var(--border)" }}>
                {msg.botoes.map((b, i) => (
                  <div key={i} style={{ textAlign: "center", padding: "8px 0", fontSize: 13, color: "var(--brand)", borderBottom: i < msg.botoes.length - 1 ? "1px solid var(--border)" : "none" }}>
                    {b.texto}{b.url ? <span className="vx-mut" style={{ display: "block", fontSize: 11 }}>{b.url}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {!msg.completa && (
          <p className="vx-mut" style={{ fontSize: 12, margin: "6px 0 0", lineHeight: 1.5 }}>
            {m.origem === "Reativação de empresas" ? "Texto do modelo: as variáveis desta mensagem não ficaram registradas." : "Algumas variáveis desta mensagem não ficaram registradas (envio antigo)."}
          </p>
        )}
        <p className="vx-mut" style={{ fontSize: 12, margin: "6px 0 0" }}>{m.origem} · {m.publico} · {m.modelo} ({m.idioma})</p>
      </div>

      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        <div className="vx-eyebrow" style={{ marginBottom: 6 }}>Caminho na Meta</div>
        {m.avisos.length === 0 ? <div className="vx-mut" style={{ fontSize: 12.5 }}>{m.status === "fila" ? "Ainda na fila de envio." : "A Meta ainda não mandou aviso desta mensagem."}</div>
          : m.avisos.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Selo par={STATUS_MENSAGEM[a.status]} /><span className="vx-mut" style={{ fontSize: 12 }}>{dataHora(a.em)}</span>
              {a.erro && <span style={{ color: "var(--red)", fontSize: 12 }}>{a.erro}</span>}
            </div>
          ))}
        {m.erro && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 4 }}>Erro no envio: {m.erro}</div>}

        <div className="vx-eyebrow" style={{ margin: "14px 0 6px" }}>Cobrança</div>
        {!m.cobranca ? <div className="vx-mut" style={{ fontSize: 12.5 }}>A Meta ainda não informou a cobrança desta mensagem.</div> : (
          <>
            <div>{m.cobranca.cobrada === false ? "Não cobrada" : "Cobrada"} · {categoria(m.cobranca.categoria)}{m.cobranca.tipo ? ` · ${TIPO_COBRANCA[m.cobranca.tipo] || m.cobranca.tipo}` : ""}</div>
            {m.cobranca.cobrada !== false && (
              <div className="vx-mut" style={{ fontSize: 12.5 }}>
                {medio != null ? <>Custo estimado: <b style={{ color: "var(--ink)" }}>≈ {valor(medio, moeda, true)}</b> (média que a Meta cobrou por mensagem de {categoria(m.cobranca.categoria)} nos últimos 30 dias). A Meta não informa o valor de cada mensagem.</>
                  : "A Meta ainda não informou o custo desta categoria. O valor aparece em Custos e cliques assim que ela fechar o dia."}
              </div>
            )}
          </>
        )}

        <div className="vx-eyebrow" style={{ margin: "14px 0 6px" }}>Respostas em até 3 dias</div>
        {m.respostas.length === 0 ? <div className="vx-mut" style={{ fontSize: 12.5 }}>Nenhuma.</div>
          : m.respostas.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span className="vx-mut" style={{ fontSize: 12 }}>{dataHora(r.em)}</span>
              <span style={{ color: r.saida ? "var(--red)" : "var(--ink)" }}>{r.texto || `(${r.tipo})`}{r.saida ? " · pediu para sair" : ""}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

import { useEffect, useId, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { dataHora, STATUS_MENSAGEM, Selo } from "./whatsappFormato.jsx";

// Caixa de entrada do WhatsApp oficial da RYCS: quem escreveu, o histórico de
// cada pessoa e a resposta à mão. Texto livre só até 24h depois da última
// mensagem da pessoa (grátis); depois disso, só modelo aprovado (pago).

function useLargo(min = 860) {
  const [largo, setLargo] = useState(() => typeof window === "undefined" || window.innerWidth >= min);
  useEffect(() => {
    const f = () => setLargo(window.innerWidth >= min);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, [min]);
  return largo;
}

const hora = (ts) => (ts ? new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

export default function ConversasWhatsapp({ aviso, onLidas }) {
  const id = useId();
  const largo = useLargo();
  const [filtro, setFiltro] = useState("respostas");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState(null);
  const [aberta, setAberta] = useState(null);

  const carregar = () => {
    const q = new URLSearchParams({ filtro, busca });
    api(`/admin/whatsapp/conversas?${q}`).then((r) => {
      if (r?.error) { aviso?.(r.error); return; }
      setLista(r?.conversas || []);
      onLidas?.(r?.naoLidas || 0);
    });
  };
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 15000);
    return () => clearInterval(t);
  }, [filtro]); // eslint-disable-line react-hooks/exhaustive-deps -- busca só no botão

  const listaEl = (
    <div className="vx-card" style={{ padding: 12, minWidth: 0 }}>
      <div className="vx-seg" style={{ marginBottom: 10 }}>
        {[["respostas", "Quem escreveu"], ["todas", "Todas"]].map(([k, l]) => (
          <button key={k} type="button" data-on={filtro === k ? "1" : "0"} onClick={() => setFiltro(k)}>{l}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); carregar(); }} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <label htmlFor={`${id}-b`} className="vx-sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Buscar conversa</label>
        <input id={`${id}-b`} className="vx-input" placeholder="Nome ou número" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ minHeight: 44, flex: 1 }} />
        <button type="submit" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }}>Buscar</button>
      </form>
      {!lista ? <div className="vx-mut" style={{ padding: 12, fontSize: 13 }}>Carregando...</div>
        : lista.length === 0 ? <div className="vx-mut" style={{ padding: 12, fontSize: 13 }}>{filtro === "respostas" ? "Ninguém escreveu para o número ainda." : "Nenhuma conversa."}</div>
        : (
          <div style={{ display: "flex", flexDirection: "column", maxHeight: largo ? "70vh" : "none", overflowY: "auto" }}>
            {lista.map((c) => {
              const sel = aberta === c.numero;
              return (
                <button key={c.numero} type="button" onClick={() => setAberta(c.numero)} aria-current={sel ? "true" : undefined}
                  style={{ textAlign: "left", padding: "10px 10px", borderRadius: 10, border: "1px solid", borderColor: sel ? "var(--brand)" : "transparent", background: sel ? "var(--brand-50)" : "transparent", cursor: "pointer", color: "var(--ink)", minHeight: 44, display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                      <b style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome || `+${c.numero}`}</b>
                      {c.cadastro && <span className="vx-mut" style={{ fontSize: 11 }}>{c.cadastro.tipo}</span>}
                    </div>
                    <div className="vx-mut" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.ultima?.direcao === "enviada" ? "Você: " : ""}{c.ultima?.texto}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {c.janelaAte && <span style={{ color: "var(--green)" }}>Responder até {hora(c.janelaAte)}</span>}
                      {c.saiu && <span style={{ color: "var(--red)" }}>Pediu para sair</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="vx-mut" style={{ fontSize: 11 }}>{hora(c.ultima?.em)}</div>
                    {c.naoLidas > 0 && <span aria-label={`${c.naoLidas} não lidas`} style={{ display: "inline-block", marginTop: 4, minWidth: 20, padding: "1px 6px", borderRadius: 999, background: "var(--brand)", color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "center" }}>{c.naoLidas}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
    </div>
  );

  if (!largo) {
    return aberta
      ? <Conversa numero={aberta} aviso={aviso} onVoltar={() => { setAberta(null); carregar(); }} onMudou={carregar} />
      : listaEl;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 340px) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
      {listaEl}
      {aberta
        ? <Conversa key={aberta} numero={aberta} aviso={aviso} onMudou={carregar} />
        : <div className="vx-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Escolha uma conversa para ler e responder.</div>}
    </div>
  );
}

function Conversa({ numero, aviso, onVoltar, onMudou }) {
  const id = useId();
  const [c, setC] = useState(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef(null);
  const qtd = useRef(0);

  const carregar = () => api(`/admin/whatsapp/conversas/${numero}`).then((r) => {
    if (r?.error) { aviso?.(r.error); return; }
    setC(r);
  });
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 8000);
    return () => clearInterval(t);
  }, [numero]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (c && c.itens.length !== qtd.current) { qtd.current = c.itens.length; fim.current?.scrollIntoView({ block: "end" }); }
  }, [c]);

  const enviar = async (e) => {
    e?.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    const r = await api(`/admin/whatsapp/conversas/${numero}/responder`, { texto });
    setEnviando(false);
    if (r?.error) return aviso?.(r.error);
    setTexto("");
    carregar();
    onMudou?.();
  };

  if (!c) return <div className="vx-card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Carregando conversa...</div>;
  const aberto = !!c.janelaAte;

  return (
    <div className="vx-card" style={{ padding: 0, overflow: "hidden", minWidth: 0 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {onVoltar && <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} style={{ minHeight: 44 }}>← Conversas</button>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <b style={{ fontSize: 15 }}>{c.nome || `+${c.numero}`}</b>
          <div className="vx-mut" style={{ fontSize: 12 }}>
            +{c.numero}{c.cadastro ? ` · ${c.cadastro.tipo} na plataforma` : " · não encontrado no cadastro"}{c.nomeWhatsapp && c.nomeWhatsapp !== c.nome ? ` · no WhatsApp: ${c.nomeWhatsapp}` : ""}
          </div>
        </div>
      </div>
      {c.saiu && <div role="alert" style={{ padding: "8px 16px", fontSize: 12.5, background: "var(--surface-2)", color: "var(--red)" }}>Esta pessoa pediu para sair. Responda só o que ela perguntar, sem oferta.</div>}

      <div style={{ padding: 16, maxHeight: "58vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, background: "var(--surface-2)" }}>
        {c.itens.length === 0 && <div className="vx-mut" style={{ fontSize: 13, textAlign: "center" }}>Sem mensagens.</div>}
        {c.itens.map((m) => {
          const minha = m.direcao === "enviada";
          return (
            <div key={`${m.direcao}-${m.id}`} style={{ alignSelf: minha ? "flex-end" : "flex-start", maxWidth: "min(80%, 520px)" }}>
              <div style={{ background: minha ? "var(--brand-50)" : "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "8px 12px" }}>
                {minha && (m.origem || m.modelo) && <div className="vx-mut" style={{ fontSize: 11, marginBottom: 4 }}>{[m.origem, m.modelo].filter(Boolean).join(" · ")}</div>}
                <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: m.saida ? "var(--red)" : "var(--ink)" }}>{m.texto || "—"}</div>
                {m.rodape && <div className="vx-mut" style={{ fontSize: 11, marginTop: 4 }}>{m.rodape}</div>}
                {m.botoes?.length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {m.botoes.map((b, i) => <span key={i} style={{ fontSize: 11.5, color: "var(--brand)", border: "1px solid var(--border)", borderRadius: 999, padding: "2px 8px" }}>{b.texto}</span>)}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, marginTop: 2, textAlign: minha ? "right" : "left", display: "flex", gap: 6, justifyContent: minha ? "flex-end" : "flex-start", flexWrap: "wrap" }}>
                <span className="vx-mut">{dataHora(m.em)}</span>
                {minha && m.status && <Selo par={STATUS_MENSAGEM[m.status]} />}
                {m.erro && <span style={{ color: "var(--red)" }}>{m.erro}</span>}
              </div>
            </div>
          );
        })}
        <div ref={fim} />
      </div>

      <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
        {aberto ? (
          <form onSubmit={enviar}>
            <label className="vx-label" htmlFor={`${id}-t`}>Resposta <span className="vx-mut" style={{ fontWeight: 400 }}>· grátis, dá para responder até {dataHora(c.janelaAte)}</span></label>
            <textarea id={`${id}-t`} className="vx-input" rows={3} maxLength={4096} value={texto} onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar(e); }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button type="submit" className="vx-btn vx-btn-primary" disabled={enviando || !texto.trim()} style={{ minHeight: 44 }}>{enviando ? "Enviando…" : "Enviar"}</button>
              <span className="vx-mut" style={{ fontSize: 11.5 }}>Ctrl+Enter também envia</span>
            </div>
          </form>
        ) : <EnviarModelo numero={numero} nome={c.nome} saiu={c.saiu} aviso={aviso} onEnviado={() => { carregar(); onMudou?.(); }} />}
      </div>
    </div>
  );
}

// Fora da janela de 24h: só modelo aprovado, que a Meta cobra.
function EnviarModelo({ numero, nome, saiu, aviso, onEnviado }) {
  const id = useId();
  const [abrir, setAbrir] = useState(false);
  const [modelos, setModelos] = useState(null);
  const [sel, setSel] = useState("");
  const [vars, setVars] = useState([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!abrir || modelos) return;
    api("/admin/whatsapp/templates").then((r) => {
      if (r?.error) { aviso?.(r.error); setModelos([]); return; }
      setModelos((Array.isArray(r) ? r : []).filter((t) => t.suportado));
    });
  }, [abrir]); // eslint-disable-line react-hooks/exhaustive-deps

  const tpl = modelos?.find((t) => `${t.nome}|${t.idioma}` === sel);
  const escolher = (k) => {
    setSel(k);
    const t = modelos.find((x) => `${x.nome}|${x.idioma}` === k);
    setVars((t?.variaveis || []).map((_, i) => (i === 0 && nome ? { origem: "nome", texto: "" } : { origem: "fixo", texto: "" })));
  };
  const previa = tpl ? tpl.corpo.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, ph) => {
    const v = vars[tpl.variaveis.indexOf(ph)];
    return !v ? m : v.origem === "nome" ? (String(nome || "").split(/\s+/)[0] || m) : (v.texto || m);
  }) : "";

  const enviar = async () => {
    if (!window.confirm("Mandar este modelo? A Meta cobra modelos enviados fora da janela de 24h.")) return;
    setEnviando(true);
    const r = await api(`/admin/whatsapp/conversas/${numero}/modelo`, { template: tpl.nome, idioma: tpl.idioma, variaveis: vars });
    setEnviando(false);
    if (r?.error) return aviso?.(r.error);
    aviso?.("Modelo enviado.");
    setAbrir(false);
    onEnviado?.();
  };

  if (saiu) return <div className="vx-mut" style={{ fontSize: 12.5 }}>Passaram 24h desde a última mensagem e esta pessoa pediu para sair: não dá para mandar modelo.</div>;
  if (!abrir) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="vx-mut" style={{ fontSize: 12.5, flex: "1 1 240px" }}>Passaram 24h desde a última mensagem desta pessoa (ou ela nunca escreveu). Para retomar, só com um modelo aprovado, que é pago.</span>
        <button type="button" className="vx-btn vx-btn-sm" onClick={() => setAbrir(true)} style={{ minHeight: 44 }}>Mandar modelo</button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <label className="vx-label" htmlFor={`${id}-m`}>Modelo aprovado</label>
        <select id={`${id}-m`} className="vx-input" value={sel} onChange={(e) => escolher(e.target.value)} style={{ minHeight: 44 }} disabled={!modelos}>
          <option value="">{modelos ? "Escolha um modelo" : "Carregando modelos..."}</option>
          {(modelos || []).map((t) => <option key={`${t.nome}|${t.idioma}`} value={`${t.nome}|${t.idioma}`}>{t.nome} · {t.idioma} · {t.categoria}</option>)}
        </select>
      </div>
      {tpl?.variaveis.map((ph, i) => (
        <div key={ph} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 8, alignItems: "end" }}>
          <div>
            <label className="vx-label" htmlFor={`${id}-o${i}`}>Variável {`{{${ph}}}`}</label>
            <select id={`${id}-o${i}`} className="vx-input" value={vars[i]?.origem} onChange={(e) => setVars((vs) => vs.map((v, j) => (j === i ? { ...v, origem: e.target.value } : v)))} style={{ minHeight: 44 }}>
              {nome && <option value="nome">Primeiro nome</option>}
              <option value="fixo">Texto</option>
            </select>
          </div>
          {vars[i]?.origem === "fixo" && (
            <div>
              <label className="vx-label" htmlFor={`${id}-v${i}`}>Texto para {`{{${ph}}}`}</label>
              <input id={`${id}-v${i}`} className="vx-input" maxLength={300} value={vars[i].texto} onChange={(e) => setVars((vs) => vs.map((v, j) => (j === i ? { ...v, texto: e.target.value } : v)))} style={{ minHeight: 44 }} />
            </div>
          )}
        </div>
      ))}
      {tpl && <div style={{ fontSize: 13, whiteSpace: "pre-wrap", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>{previa}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="vx-btn vx-btn-sm" onClick={() => setAbrir(false)} style={{ minHeight: 44 }}>Cancelar</button>
        <button type="button" className="vx-btn vx-btn-primary" onClick={enviar} disabled={!tpl || enviando || vars.some((v) => v.origem === "fixo" && !v.texto.trim())} style={{ minHeight: 44 }}>{enviando ? "Enviando…" : "Mandar modelo"}</button>
      </div>
    </div>
  );
}

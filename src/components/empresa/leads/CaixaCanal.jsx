import { useEffect, useId, useRef, useState } from "react";
import { Search, Send, Sparkles, ReceiptText, UserPlus, ChevronLeft, Check, CheckCheck, AlertTriangle, Settings2, MessageSquare, Lock } from "lucide-react";
import { api, API_URL } from "../../../lib/api.js";
import ConectarCanal from "./ConectarCanal.jsx";
import AuditoriaConversa from "./AuditoriaConversa.jsx";
import { duracao, LIMITE_TEXTO } from "../../../../shared/canais.js";
import { ETAPAS } from "../../../../shared/pipeline.js";

// Caixa de entrada da aba Leads, no formato do WhatsApp Web: lista à esquerda,
// conversa no meio e auditoria da IA à direita. Serve ao WhatsApp e ao
// Instagram, para a empresa e (só WhatsApp) para o vendedor.

function useLargura() {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 1200 : window.innerWidth));
  useEffect(() => {
    const f = () => setW(window.innerWidth);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return w;
}

const hora = (t) => {
  if (!t) return "";
  const d = new Date(t), hoje = new Date();
  return d.toDateString() === hoje.toDateString()
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};
const horaCheia = (t) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const diaDe = (t) => new Date(t).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
const iniciais = (n) => String(n || "?").replace(/^[@+]/, "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";
const espera = (desde) => (desde ? Math.round((Date.now() - desde) / 60000) : null);

function Avatar({ nome, tam = 42 }) {
  return <span aria-hidden="true" style={{ width: tam, height: tam, borderRadius: "50%", background: "var(--brand-100)", color: "var(--brand)", display: "grid", placeItems: "center", fontWeight: 600, fontSize: tam * 0.36, flexShrink: 0 }}>{iniciais(nome)}</span>;
}

export default function CaixaCanal({ canal, papel = "empresa", aviso, time = [], campanhas = [], onGerarPedido, onAbrirPipeline }) {
  const id = useId();
  const largura = useLargura();
  const largo = largura >= 900;
  const [info, setInfo] = useState(null);
  const [contas, setContas] = useState(false);
  const [novaConta, setNovaConta] = useState(false);
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState(null);
  const [aberta, setAberta] = useState("");
  const [painel, setPainel] = useState(null);

  const carregarInfo = () => api("/canais").then((r) => { if (r && !r.error) setInfo(r); else aviso?.(r?.error || "Não foi possível carregar as conexões."); });
  const carregarLista = () => {
    const q = new URLSearchParams({ canal, tipo, busca });
    return api(`/canais/conversas?${q}`).then((r) => { if (Array.isArray(r?.conversas)) setLista(r.conversas); });
  };
  useEffect(() => { carregarInfo(); setAberta(""); setLista(null); }, [canal]); // eslint-disable-line react-hooks/exhaustive-deps
  const conexoes = (info?.conexoes || []).filter((c) => c.canal === canal);
  const ligada = conexoes.length > 0 || (lista?.length || 0) > 0;
  useEffect(() => {
    carregarLista();
    const t = setInterval(() => { if (!document.hidden) carregarLista(); }, 10000);
    return () => clearInterval(t);
  }, [canal, tipo, busca]); // eslint-disable-line react-hooks/exhaustive-deps
  const carregarPainel = () => { if (papel === "empresa") api(`/canais/auditoria?canal=${canal}`).then((r) => { if (r && !r.error) setPainel(r); }); };
  useEffect(() => { if (ligada) carregarPainel(); }, [canal, ligada, papel, aberta]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!info || (!lista && conexoes.length > 0)) return <div style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;

  if (!ligada) return <ConectarCanal canal={canal} papel={papel} info={info} aviso={aviso} recarregar={() => { carregarInfo(); carregarLista(); }} aberto setAberto={() => {}} />;

  const selecionada = (lista || []).find((c) => c.id === aberta);
  const listaEl = (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, borderRight: largo ? "1px solid var(--border)" : 0 }}>
      <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
        <div style={{ position: "relative" }}>
          <Search size={16} aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted-2)" }} />
          <label htmlFor={`${id}-b`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Buscar conversa</label>
          <input id={`${id}-b`} className="vx-input" placeholder="Buscar por nome ou número" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ paddingLeft: 36, minHeight: 44 }} />
        </div>
        {canal === "instagram" && (
          <div className="vx-seg" style={{ marginTop: 10 }}>
            {[["", "Tudo"], ["direta", "Directs"], ["comentario", "Comentários"]].map(([k, l]) => <button key={k} type="button" data-on={tipo === k ? "1" : "0"} onClick={() => setTipo(k)} style={{ minHeight: 38 }}>{l}</button>)}
          </div>
        )}
      </div>
      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {!lista ? <div className="vx-mut" style={{ padding: 16, fontSize: 13 }}>Carregando…</div>
          : lista.length === 0 ? <div className="vx-mut" style={{ padding: 20, fontSize: 13, textAlign: "center" }}>{busca ? "Nenhuma conversa encontrada." : papel === "vendedor" ? "Quando um lead desta empresa escrever, a conversa aparece aqui." : "As conversas aparecem aqui assim que alguém escrever."}</div>
            : lista.map((c) => {
              const sel = c.id === aberta, min = espera(c.esperandoDesde);
              return (
                <button key={c.id} type="button" onClick={() => setAberta(c.id)} aria-current={sel ? "true" : undefined}
                  style={{ width: "100%", textAlign: "left", display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", border: 0, borderBottom: "1px solid var(--border)", background: sel ? "var(--brand-50)" : "transparent", cursor: "pointer", color: "var(--ink)", font: "inherit" }}>
                  <Avatar nome={c.nome} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <b style={{ fontSize: 14, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</b>
                      <span style={{ fontSize: 11, color: c.naoLidas ? "var(--brand)" : "var(--muted)" }}>{hora(c.ultima.em)}</span>
                    </span>
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="vx-mut" style={{ fontSize: 12.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.ultima.direcao === "enviada" ? "Você: " : ""}{c.ultima.texto}</span>
                      {c.naoLidas > 0 && <span aria-label={`${c.naoLidas} não lidas`} style={{ minWidth: 20, padding: "1px 6px", borderRadius: 999, background: "var(--brand)", color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "center" }}>{c.naoLidas}</span>}
                    </span>
                    <span style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11, marginTop: 2 }}>
                      {c.tipo === "comentario" && <span className="vx-badge vx-badge-indigo">Comentário</span>}
                      {c.lead && <span className="vx-badge vx-badge-brand">{ETAPAS[c.lead.etapa]?.nome || "Lead"}</span>}
                      {c.vendedor && papel === "empresa" && <span className="vx-badge vx-badge-muted">{c.vendedor}</span>}
                      {min >= 60 && <span className="vx-badge vx-badge-amber">Sem resposta há {duracao(min)}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
      </div>
    </div>
  );

  return (
    <>
      {painel && (largo || !aberta) && (painel.auditadas > 0 || painel.esperando > 0) && (
        <div className="vx-grid vx-g4" style={{ marginBottom: 12 }}>
          {[["Esperando resposta há mais de 1h", painel.esperando], ["Conversas auditadas (30 dias)", painel.auditadas], ["Com ponto de atenção", painel.comAtencao], ["Afirmações sem base nos materiais", painel.semFonte]].map(([l, v]) => (
            <div key={l} className="vx-glass-panel vx-tile"><div className="vx-tile-top"><span>{l}</span></div><div className="vx-tile-val">{v}</div></div>
          ))}
        </div>
      )}

      {(largo || !aberta) && <div className="vx-row" style={{ marginBottom: 10, flexWrap: "wrap" }}>
        <span className="vx-mut" style={{ fontSize: 13 }}>{conexoes.length ? conexoes.map((c) => (canal === "instagram" ? `@${c.nome}` : c.vendedor ? `${c.vendedor} (${c.numero})` : c.numero || c.nome)).join(" · ") : "Nenhuma conta conectada agora. O histórico continua abaixo."}</span>
        <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} aria-expanded={contas} onClick={() => setContas(!contas)}><Settings2 size={14} aria-hidden="true" /> Contas conectadas</button>
      </div>}
      {contas && (largo || !aberta) && <ConectarCanal canal={canal} papel={papel} info={info} aviso={aviso} recarregar={() => { carregarInfo(); carregarLista(); }} aberto={novaConta} setAberto={setNovaConta} />}

      <div className="vx-card" style={{ padding: 0, overflow: "hidden", height: largo ? "max(520px, calc(100dvh - 250px))" : "auto", display: "grid", gridTemplateColumns: largo ? "minmax(260px, 340px) minmax(0, 1fr)" : "minmax(0, 1fr)" }}>
        {(largo || !aberta) && listaEl}
        {(largo || aberta) && (aberta
          ? <Conversa key={aberta} id={aberta} canal={canal} papel={papel} largura={largura} resumo={selecionada} aviso={aviso} time={time} campanhas={campanhas}
              onVoltar={largo ? null : () => { setAberta(""); carregarLista(); }} onMudou={carregarLista} onAuditou={carregarPainel} onGerarPedido={onGerarPedido} onAbrirPipeline={onAbrirPipeline} />
          : <div style={{ display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 13, padding: 40, textAlign: "center", background: "var(--surface-2)" }}><div><MessageSquare size={34} aria-hidden="true" style={{ marginBottom: 10, color: "var(--muted-2)" }} /><div>Escolha uma conversa para ler e responder.</div></div></div>)}
      </div>
    </>
  );
}

function Midia({ m }) {
  const url = `${API_URL}/api/canais/mensagens/${m.id}/midia`;
  const [falhou, setFalhou] = useState(false);
  if (falhou) return <span className="vx-mut" style={{ fontSize: 12.5 }}>Arquivo indisponível. Veja pelo celular.</span>;
  if (m.tipo === "imagem" || m.tipo === "figurinha") return <img src={url} alt="Foto da conversa" loading="lazy" onError={() => setFalhou(true)} style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8, display: "block" }} />;
  if (m.tipo === "audio") return <audio src={url} controls preload="none" onError={() => setFalhou(true)} style={{ maxWidth: "100%" }} />;
  if (m.tipo === "video") return <video src={url} controls preload="none" onError={() => setFalhou(true)} style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 8 }} />;
  return <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>Abrir arquivo</a>;
}

const SEM_MIDIA = { imagem: "Foto", audio: "Áudio", video: "Vídeo", documento: "Documento", figurinha: "Figurinha", localizacao: "Localização", contato: "Contato", reacao: "Reação", outro: "Mensagem não exibida aqui" };
const MARCA = { sent: [Check, "var(--muted-2)", "Enviada"], delivered: [CheckCheck, "var(--muted-2)", "Entregue"], read: [CheckCheck, "var(--brand)", "Lida"], played: [CheckCheck, "var(--brand)", "Ouvida"], failed: [AlertTriangle, "var(--red)", "Não entregue"] };

function Conversa({ id, canal, papel, largura, aviso, time, campanhas, onVoltar, onMudou, onAuditou, onGerarPedido, onAbrirPipeline }) {
  const uid = useId();
  const [c, setC] = useState(null);
  const [texto, setTexto] = useState("");
  const [privado, setPrivado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [auditoria, setAuditoria] = useState(largura >= 1280);
  const [criarLead, setCriarLead] = useState(false);
  const [destaque, setDestaque] = useState("");
  const corpo = useRef(null);
  const refs = useRef(new Map());
  const qtd = useRef(0);

  const carregar = () => api(`/canais/conversas/${id}`).then((r) => {
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível abrir a conversa."); return; }
    setC(r);
  });
  useEffect(() => {
    carregar().then(() => onMudou?.());
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 10000);
    return () => clearInterval(t);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (c && c.mensagens.length !== qtd.current && corpo.current) { qtd.current = c.mensagens.length; corpo.current.scrollTop = corpo.current.scrollHeight; }
  }, [c]);

  const irPara = (m) => { refs.current.get(m)?.scrollIntoView({ block: "center", behavior: "smooth" }); setDestaque(m); setTimeout(() => setDestaque(""), 2500); };
  const enviar = async (e) => {
    e?.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    const r = await api(`/canais/conversas/${id}/responder`, { texto, privado });
    setEnviando(false);
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível enviar.");
    setTexto(""); carregar(); onMudou?.();
  };
  const pedido = async () => {
    setGerando(true);
    const r = await api("/pedidos/gerar", { conversaId: id });
    setGerando(false);
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível gerar o pedido.");
    onGerarPedido?.(r.id);
  };

  if (!c) return <div style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;
  const comentario = c.tipo === "comentario";
  const numeroDoVendedor = papel === "empresa" && !!c.vendedor;
  const podeResponder = c.conectada && !numeroDoVendedor && (comentario || !!c.janelaAte);
  const motivo = !c.conectada ? "Esta conta está desconectada." : numeroDoVendedor ? `Número de ${c.vendedor}: você acompanha e só o profissional responde.` : `Passaram 24h desde a última mensagem. Responda pelo aplicativo do ${canal === "instagram" ? "Instagram" : "WhatsApp"}: a mensagem aparece aqui.`;
  const lado = auditoria && largura >= 1100;
  let diaAnterior = "";

  return (
    <div style={{ display: "grid", gridTemplateColumns: lado ? "minmax(0, 1fr) 320px" : "minmax(0, 1fr)", minHeight: 0, minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {onVoltar && <button type="button" className="vx-btn vx-btn-sm" onClick={onVoltar} aria-label="Voltar para a lista" style={{ minHeight: 44, minWidth: 44 }}><ChevronLeft size={16} /></button>}
          <Avatar nome={c.nome} tam={38} />
          <div style={{ flex: "1 1 140px", minWidth: 0 }}>
            <b style={{ fontSize: 15, overflowWrap: "anywhere" }}>{c.nome}</b>
            <div className="vx-mut" style={{ fontSize: 12 }}>{[c.telefone && `+${c.telefone}`, c.usuario && `@${c.usuario}`, comentario && "Comentários no Instagram", c.conta].filter(Boolean).join(" · ")}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {c.lead
              ? <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={onAbrirPipeline} disabled={!onAbrirPipeline}>Lead: {ETAPAS[c.lead.etapa]?.nome || c.lead.etapa}</button>
              : papel === "empresa" && <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} onClick={() => setCriarLead(!criarLead)} aria-expanded={criarLead}><UserPlus size={14} aria-hidden="true" /> Criar lead</button>}
            {papel === "empresa" && <button type="button" className="vx-btn vx-btn-sm" style={{ minHeight: 44 }} disabled={gerando} onClick={pedido}><ReceiptText size={14} aria-hidden="true" /> {gerando ? "Gerando…" : "Gerar pedido"}</button>}
            <button type="button" className={`vx-btn vx-btn-sm${auditoria ? " vx-btn-primary" : ""}`} style={{ minHeight: 44 }} aria-pressed={auditoria} onClick={() => setAuditoria(!auditoria)}><Sparkles size={14} aria-hidden="true" /> Auditoria</button>
          </div>
        </div>

        {criarLead && <NovoLead conversa={c} time={time} campanhas={campanhas} aviso={aviso} onCriado={() => { setCriarLead(false); carregar(); onMudou?.(); }} />}
        {auditoria && !lado && <div style={{ borderBottom: "1px solid var(--border)", maxHeight: "45vh", overflowY: "auto" }}><AuditoriaConversa conversaId={id} aviso={aviso} irPara={irPara} usarSugestao={podeResponder ? setTexto : null} aoAuditar={onAuditou} /></div>}

        <div ref={corpo} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 6, background: "var(--surface-2)", minHeight: 240, maxHeight: largura < 900 ? "55vh" : "none" }}>
          {c.mensagens.length === 0 && <div className="vx-mut" style={{ fontSize: 13, textAlign: "center" }}>Sem mensagens.</div>}
          {c.mensagens.map((m) => {
            const minha = m.direcao === "enviada", dia = diaDe(m.em), novoDia = dia !== diaAnterior;
            diaAnterior = dia;
            const [Marca, corMarca, rotuloMarca] = MARCA[m.status] || [];
            return (
              <div key={m.id} style={{ display: "contents" }}>
                {novoDia && <div style={{ alignSelf: "center", fontSize: 11, color: "var(--muted)", background: "var(--surface-solid)", border: "1px solid var(--border)", borderRadius: 999, padding: "3px 10px", margin: "6px 0" }}>{dia}</div>}
                <div ref={(el) => { if (el) refs.current.set(m.id, el); else refs.current.delete(m.id); }} style={{ alignSelf: minha ? "flex-end" : "flex-start", maxWidth: "min(82%, 560px)" }}>
                  <div style={{ background: minha ? "var(--brand-100)" : "var(--surface-solid)", border: `1px solid ${destaque === m.id ? "var(--brand)" : "var(--border)"}`, borderRadius: 12, padding: "7px 11px" }}>
                    {m.midia ? <Midia m={m} /> : m.tipo !== "texto" && <span className="vx-mut" style={{ fontSize: 12.5 }}>{SEM_MIDIA[m.tipo] || SEM_MIDIA.outro}</span>}
                    {m.texto && <div style={{ fontSize: 13.5, lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.texto}</div>}
                    <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "center", fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
                      <span title={horaCheia(m.em)}>{new Date(m.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      {minha && m.origem === "rycs" && <span>RYCS</span>}
                      {minha && Marca && <Marca size={13} aria-label={rotuloMarca} style={{ color: corMarca }} />}
                    </div>
                    {m.erro && <div style={{ fontSize: 11.5, color: "var(--red)" }}>{m.erro}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
          {podeResponder ? (
            <form onSubmit={enviar}>
              {comentario && (
                <div className="vx-seg" style={{ marginBottom: 8 }}>
                  {[[false, "Responder no comentário"], [true, "Mandar no direct"]].map(([k, l]) => <button key={String(k)} type="button" data-on={privado === k ? "1" : "0"} onClick={() => setPrivado(k)} style={{ minHeight: 38 }}>{l}</button>)}
                </div>
              )}
              <label htmlFor={`${uid}-t`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Mensagem</label>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea id={`${uid}-t`} className="vx-input" rows={Math.min(5, Math.max(1, texto.split("\n").length))} maxLength={LIMITE_TEXTO[canal]} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Digite uma mensagem"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && largura >= 900) { e.preventDefault(); enviar(); } }} style={{ minHeight: 44, resize: "none", flex: 1 }} />
                <button type="submit" className="vx-btn vx-btn-primary" aria-label="Enviar mensagem" disabled={enviando || !texto.trim()} style={{ minHeight: 44, minWidth: 48 }}><Send size={16} /></button>
              </div>
              {!comentario && <div className="vx-mut" style={{ fontSize: 11.5, marginTop: 4 }}>Dá para responder por aqui até {horaCheia(c.janelaAte)}.</div>}
            </form>
          ) : <div className="vx-mut" style={{ fontSize: 12.5, display: "flex", gap: 8, alignItems: "center" }}><Lock size={14} aria-hidden="true" style={{ flexShrink: 0 }} />{motivo}</div>}
        </div>
      </div>
      {lado && <div style={{ borderLeft: "1px solid var(--border)", overflowY: "auto", minHeight: 0 }}><AuditoriaConversa conversaId={id} aviso={aviso} irPara={irPara} usarSugestao={podeResponder ? setTexto : null} aoAuditar={onAuditou} /></div>}
    </div>
  );
}

function NovoLead({ conversa, time, campanhas, aviso, onCriado }) {
  const id = useId();
  const [nome, setNome] = useState(/^[@+]/.test(conversa.nome) ? "" : conversa.nome);
  const [sellerId, setSellerId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const criar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const r = await api(`/canais/conversas/${conversa.id}/lead`, { nome, sellerId, campaignId: campaignId || null });
    setSalvando(false);
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível criar o lead.");
    aviso?.("Lead criado no Pipeline.");
    onCriado();
  };
  return (
    <form onSubmit={criar} style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 10, alignItems: "end" }}>
      <div><label className="vx-label" htmlFor={`${id}-n`}>Nome do lead</label><input id={`${id}-n`} className="vx-input" style={{ minHeight: 44 }} maxLength={160} value={nome} onChange={(e) => setNome(e.target.value)} placeholder={conversa.nome} /></div>
      <div><label className="vx-label" htmlFor={`${id}-s`}>Profissional responsável</label><select id={`${id}-s`} className="vx-input" style={{ minHeight: 44 }} value={sellerId} onChange={(e) => setSellerId(e.target.value)}><option value="">Escolha</option>{time.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
      <div><label className="vx-label" htmlFor={`${id}-c`}>Campanha (opcional)</label><select id={`${id}-c`} className="vx-input" style={{ minHeight: 44 }} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}><option value="">Nenhuma</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}</select></div>
      <button type="submit" className="vx-btn vx-btn-primary" style={{ minHeight: 44 }} disabled={salvando || !sellerId}>{salvando ? "Criando…" : "Criar lead"}</button>
      {time.length === 0 && <div className="vx-mut" style={{ fontSize: 12, gridColumn: "1 / -1" }}>Aprove um profissional em Profissionais para entregar o lead.</div>}
    </form>
  );
}

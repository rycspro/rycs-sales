import { useEffect, useId, useRef, useState, useCallback } from "react";
import {
  Search, Send, ChevronLeft, ChevronRight, Check, CheckCheck, AlertTriangle,
  MessageSquare, MessageCircle, Clock, Eye, Reply, Smartphone, QrCode, RefreshCw,
  Unplug, Wifi, ShieldCheck, X, Plus, Phone, Building2,
  ArrowUpRight, Filter, ExternalLink, Lock,
} from "lucide-react";
import { api, API_URL } from "../../../lib/api.js";
import { ETAPAS } from "../../../../shared/pipeline.js";
import { duracao, LIMITE_TEXTO } from "../../../../shared/canais.js";

// ── Design tokens (RYCS White Editorial) ─────────────────────────────────
const DS = {
  blue: "#318CE7",
  blue50: "rgba(49,140,231,.06)",
  blue100: "rgba(49,140,231,.12)",
  blue200: "rgba(49,140,231,.20)",
  bg: "#F7F8FA",
  card: "#FFFFFF",
  border: "#E5E7EB",
  ink: "#171B24",
  ink2: "#374151",
  muted: "#6B7280",
  muted2: "#9CA3AF",
  green: "#25D366",
  green50: "rgba(37,211,102,.08)",
  orange: "#F59E0B",
  orange50: "rgba(245,158,11,.08)",
  purple: "#8B5CF6",
  purple50: "rgba(139,92,246,.08)",
  radius: 14,
  radiusSm: 10,
  font: "'General Sans', 'Geist', 'Inter', system-ui, sans-serif",
  chatBg: "#F0F4F8",
};

// ── Helpers ──────────────────────────────────────────────────────────────
function useLargura() {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 1200 : window.innerWidth));
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
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

function Avatar({ nome, tam = 42, cor }) {
  return (
    <span style={{
      width: tam, height: tam, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 600,
      fontSize: tam * 0.36, flexShrink: 0, fontFamily: DS.font,
      background: cor || DS.blue100, color: cor ? "#fff" : DS.blue,
    }}>
      {iniciais(nome)}
    </span>
  );
}

// ── Indicadores ─────────────────────────────────────────────────────────
function Indicadores({ lista, naoLidas, onFiltrar }) {
  const ativas = (lista || []).length;
  const nLidas = naoLidas || 0;
  const aguardando = (lista || []).filter((c) => c.esperandoDesde && espera(c.esperandoDesde) >= 60).length;
  const respondidas = (lista || []).filter((c) => c.ultima?.direcao === "enviada" && c.ultima?.em && new Date(c.ultima.em).toDateString() === new Date().toDateString()).length;

  const cards = [
    { label: "Conversas ativas", valor: ativas, cor: DS.blue, bg: DS.blue50, Icon: MessageCircle, filtro: null },
    { label: "Não lidas", valor: nLidas, cor: DS.orange, bg: DS.orange50, Icon: Eye, filtro: "nao-lidas" },
    { label: "Aguardando retorno", valor: aguardando, cor: DS.purple, bg: DS.purple50, Icon: Clock, filtro: "aguardando" },
    { label: "Respondidas hoje", valor: respondidas, cor: DS.green, bg: DS.green50, Icon: Reply, filtro: null },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
      {cards.map((c) => (
        <button key={c.label} type="button" onClick={() => c.filtro && onFiltrar?.(c.filtro)}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
            background: DS.card, border: `1px solid ${DS.border}`, borderRadius: DS.radiusSm,
            cursor: c.filtro ? "pointer" : "default", textAlign: "left", font: "inherit",
            transition: "box-shadow .15s",
          }}>
          <span style={{
            width: 36, height: 36, borderRadius: 8, background: c.bg,
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <c.Icon size={18} style={{ color: c.cor }} />
          </span>
          <span>
            <span style={{ fontSize: 12, color: DS.muted, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".04em" }}>{c.label}</span>
            <span style={{ display: "block", fontSize: 22, fontWeight: 700, color: DS.ink, fontFamily: DS.font, lineHeight: 1.1 }}>{c.valor}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Cabeçalho ───────────────────────────────────────────────────────────
function Cabecalho({ conexao, onGerenciar, onNova }) {
  const conectado = conexao?.status === "ativa";
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 0", gap: 16, flexWrap: "wrap", maxHeight: 80, minHeight: 56,
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: DS.muted }}>Atendimento comercial</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: DS.font, color: DS.ink, lineHeight: 1.15 }}>Conversas</h1>
        <p style={{ margin: 0, fontSize: 13, color: DS.muted2 }}>Todas as suas negociações em um só lugar</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {conexao?.id && (
          <button type="button" onClick={onGerenciar} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
            background: DS.card, border: `1px solid ${DS.border}`, borderRadius: DS.radiusSm,
            cursor: "pointer", font: "inherit", fontSize: 13, color: DS.ink,
          }}>
            <Smartphone size={16} style={{ color: DS.green }} />
            <span style={{ fontWeight: 600 }}>{conexao.nome || conexao.numero ? `+${conexao.numero}` : "WhatsApp"}</span>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: conectado ? DS.green : "#EF4444",
            }} />
            <ChevronRight size={14} style={{ color: DS.muted2 }} />
          </button>
        )}
        <button type="button" onClick={onNova} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 18px",
          background: DS.blue, color: "#fff", border: "none", borderRadius: DS.radiusSm,
          cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, minHeight: 40,
        }}>
          <Plus size={15} /> Nova conversa
        </button>
      </div>
    </div>
  );
}

// ── Caixa de Entrada (coluna esquerda) ──────────────────────────────────
function CaixaEntrada({ lista, busca, setBusca, aba, setAba, aberta, setAberta, filtro, setFiltro }) {
  const id = useId();
  const listaFiltrada = (lista || []).filter((c) => {
    if (aba === "nao-lidas") return c.naoLidas > 0;
    if (aba === "aguardando") return c.esperandoDesde && espera(c.esperandoDesde) >= 30;
    return true;
  });

  return (
    <div style={{
      display: "flex", flexDirection: "column", background: DS.card,
      borderRight: `1px solid ${DS.border}`, minWidth: 0, minHeight: 0,
      borderRadius: `${DS.radius}px 0 0 ${DS.radius}px`,
    }}>
      {/* Título + filtros */}
      <div style={{ padding: "14px 16px 0", borderBottom: `1px solid ${DS.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: DS.ink, fontFamily: DS.font }}>Caixa de entrada</span>
          <button type="button" onClick={() => setFiltro(!filtro)} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
            background: filtro ? DS.blue50 : "transparent", border: `1px solid ${filtro ? DS.blue : DS.border}`,
            borderRadius: 6, cursor: "pointer", font: "inherit", fontSize: 12, color: filtro ? DS.blue : DS.muted,
          }}>
            <Filter size={13} /> Filtros
          </button>
        </div>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: DS.muted2 }} />
          <label htmlFor={`${id}-b`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Buscar conversa</label>
          <input id={`${id}-b`} placeholder="Buscar nome, empresa ou telefone"
            value={busca} onChange={(e) => setBusca(e.target.value)}
            style={{
              width: "100%", padding: "8px 10px 8px 32px", border: `1px solid ${DS.border}`,
              borderRadius: 8, fontSize: 13, color: DS.ink, background: DS.bg,
              outline: "none", minHeight: 38, fontFamily: DS.font,
            }} />
        </div>
        {/* Abas */}
        <div style={{ display: "flex", gap: 0, borderBottom: "none" }}>
          {[["todas", "Todas"], ["nao-lidas", "Não lidas"], ["aguardando", "Aguardando"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setAba(k)}
              style={{
                flex: 1, padding: "7px 0", border: "none", borderBottom: `2px solid ${aba === k ? DS.blue : "transparent"}`,
                background: "transparent", cursor: "pointer", font: "inherit", fontSize: 12.5,
                fontWeight: aba === k ? 600 : 500, color: aba === k ? DS.blue : DS.muted,
                fontFamily: DS.font, transition: "color .15s, border-color .15s",
              }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de conversas */}
      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {!lista ? (
          <div style={{ padding: 24, textAlign: "center" }}><div className="vx-spinner" /></div>
        ) : listaFiltrada.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: DS.muted }}>
            <MessageSquare size={28} style={{ color: DS.muted2, marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>{busca ? "Nenhuma conversa encontrada." : "Nenhuma conversa nesta aba."}</div>
          </div>
        ) : listaFiltrada.map((c) => {
          const sel = c.id === aberta;
          const min = espera(c.esperandoDesde);
          return (
            <button key={c.id} type="button" onClick={() => setAberta(c.id)}
              style={{
                width: "100%", textAlign: "left", display: "flex", gap: 10, alignItems: "center",
                padding: "12px 16px", border: 0, borderBottom: `1px solid ${DS.border}`,
                background: sel ? DS.blue50 : "transparent", cursor: "pointer",
                color: DS.ink, font: "inherit", transition: "background .1s",
              }}>
              <Avatar nome={c.nome} tam={40} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                  <b style={{ fontSize: 13.5, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: DS.font }}>{c.nome}</b>
                  <span style={{ fontSize: 11, color: c.naoLidas ? DS.blue : DS.muted2, flexShrink: 0 }}>{hora(c.ultima?.em)}</span>
                </span>
                {c.lead && (
                  <span style={{ display: "block", fontSize: 11.5, color: DS.blue, fontWeight: 500, marginTop: 1 }}>
                    {c.lead.nome !== c.nome ? c.lead.nome : ""} {ETAPAS[c.lead.etapa]?.nome || ""}
                  </span>
                )}
                <span style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                  <span style={{
                    fontSize: 12.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap", color: c.naoLidas ? DS.ink2 : DS.muted, fontWeight: c.naoLidas ? 500 : 400,
                  }}>
                    {c.ultima?.direcao === "enviada" && <Check size={12} style={{ verticalAlign: -1, marginRight: 3, color: DS.muted2 }} />}
                    {c.ultima?.texto || ""}
                  </span>
                  {c.naoLidas > 0 && (
                    <span style={{
                      minWidth: 20, padding: "1px 6px", borderRadius: 999,
                      background: DS.blue, color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "center",
                    }}>{c.naoLidas}</span>
                  )}
                </span>
                {min >= 60 && (
                  <span style={{ display: "inline-block", marginTop: 3, fontSize: 10.5, color: DS.orange, fontWeight: 500 }}>
                    <Clock size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
                    Sem resposta há {duracao(min)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Mídia ────────────────────────────────────────────────────────────────
function Midia({ m }) {
  const url = `${API_URL}/api/canais/mensagens/${m.id}/midia`;
  const [falhou, setFalhou] = useState(false);
  if (falhou) return <span style={{ fontSize: 12.5, color: DS.muted }}>Arquivo indisponível.</span>;
  if (m.tipo === "imagem" || m.tipo === "figurinha") return <img src={url} alt="Foto" loading="lazy" onError={() => setFalhou(true)} style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 8, display: "block" }} />;
  if (m.tipo === "audio") return <audio src={url} controls preload="none" onError={() => setFalhou(true)} style={{ maxWidth: "100%" }} />;
  if (m.tipo === "video") return <video src={url} controls preload="none" onError={() => setFalhou(true)} style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8 }} />;
  return <a href={url} target="_blank" rel="noreferrer" style={{ color: DS.blue }}>Abrir arquivo</a>;
}

const SEM_MIDIA = { imagem: "Foto", audio: "Áudio", video: "Vídeo", documento: "Documento", figurinha: "Figurinha", localizacao: "Localização", contato: "Contato", reacao: "Reação", outro: "Mensagem não exibida aqui" };
const MARCA = { sent: [Check, DS.muted2, "Enviada"], delivered: [CheckCheck, DS.muted2, "Entregue"], read: [CheckCheck, DS.blue, "Lida"], played: [CheckCheck, DS.blue, "Ouvida"], failed: [AlertTriangle, "#EF4444", "Não entregue"] };

// ── Conversa (coluna central) ───────────────────────────────────────────
function AreaChat({ conversaId, largura, aviso, onVoltar, onMudou, onSelLead }) {
  const uid = useId();
  const [c, setC] = useState(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const corpo = useRef(null);
  const qtd = useRef(0);

  const carregar = useCallback(() => api(`/canais/conversas/${conversaId}`).then((r) => {
    if (!r || r.error) { aviso?.(r?.error || "Não foi possível abrir a conversa."); return; }
    setC(r);
    if (r.lead) onSelLead?.(r);
  }), [conversaId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    carregar().then(() => onMudou?.());
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 8000);
    return () => clearInterval(t);
  }, [conversaId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (c && c.mensagens.length !== qtd.current && corpo.current) {
      qtd.current = c.mensagens.length;
      corpo.current.scrollTop = corpo.current.scrollHeight;
    }
  }, [c]);

  const enviar = async (e) => {
    e?.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    const r = await api(`/canais/conversas/${conversaId}/responder`, { texto });
    setEnviando(false);
    if (!r || r.error) return aviso?.(r?.error || "Não foi possível enviar.");
    setTexto(""); carregar(); onMudou?.();
  };

  if (!c) return <div style={{ display: "grid", placeItems: "center", flex: 1 }}><div className="vx-spinner" /></div>;

  const podeResponder = c.conectada && !!c.janelaAte;
  const motivo = !c.conectada ? "WhatsApp desconectado." : "Janela de 24h expirada. Responda pelo celular.";
  let diaAnterior = "";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, background: DS.card }}>
      {/* Cabeçalho da conversa */}
      <div style={{
        padding: "10px 16px", borderBottom: `1px solid ${DS.border}`,
        display: "flex", gap: 10, alignItems: "center",
      }}>
        {onVoltar && (
          <button type="button" onClick={onVoltar} style={{
            display: "grid", placeItems: "center", width: 36, height: 36,
            border: `1px solid ${DS.border}`, borderRadius: 8, background: "transparent",
            cursor: "pointer", color: DS.ink, flexShrink: 0,
          }}><ChevronLeft size={16} /></button>
        )}
        <Avatar nome={c.nome} tam={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 14, fontFamily: DS.font, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</b>
          <span style={{ fontSize: 11.5, color: DS.muted }}>
            {[c.telefone && `+${c.telefone}`, c.lead && (ETAPAS[c.lead.etapa]?.nome || c.lead.etapa)].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {c.lead && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px",
              borderRadius: 6, fontSize: 11.5, fontWeight: 600,
              background: DS.blue50, color: DS.blue,
            }}>
              {ETAPAS[c.lead.etapa]?.nome || "Lead"}
            </span>
          )}
        </div>
      </div>

      {/* Mensagens */}
      <div ref={corpo} style={{
        flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 4,
        background: DS.chatBg, minHeight: 200,
      }}>
        {c.mensagens.length === 0 && <div style={{ textAlign: "center", color: DS.muted, fontSize: 13, padding: 20 }}>Sem mensagens.</div>}
        {c.mensagens.map((m) => {
          const minha = m.direcao === "enviada";
          const dia = diaDe(m.em);
          const novoDia = dia !== diaAnterior;
          diaAnterior = dia;
          const [MarcaIcon, corMarca, rotuloMarca] = MARCA[m.status] || [];
          return (
            <div key={m.id} style={{ display: "contents" }}>
              {novoDia && (
                <div style={{
                  alignSelf: "center", fontSize: 11, color: DS.muted, background: DS.card,
                  border: `1px solid ${DS.border}`, borderRadius: 999, padding: "3px 12px", margin: "8px 0",
                }}>{dia}</div>
              )}
              <div style={{ alignSelf: minha ? "flex-end" : "flex-start", maxWidth: "min(78%, 520px)" }}>
                <div style={{
                  background: minha ? DS.blue100 : DS.card,
                  border: `1px solid ${minha ? "rgba(49,140,231,.15)" : DS.border}`,
                  borderRadius: minha ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  padding: "8px 12px",
                }}>
                  {m.midia ? <Midia m={m} /> : m.tipo !== "texto" && <span style={{ fontSize: 12.5, color: DS.muted }}>{SEM_MIDIA[m.tipo] || SEM_MIDIA.outro}</span>}
                  {m.texto && <div style={{ fontSize: 13.5, lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: DS.ink }}>{m.texto}</div>}
                  <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "center", fontSize: 10.5, color: DS.muted2, marginTop: 2 }}>
                    <span>{new Date(m.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    {minha && MarcaIcon && <MarcaIcon size={13} aria-label={rotuloMarca} style={{ color: corMarca }} />}
                  </div>
                  {m.erro && <div style={{ fontSize: 11.5, color: "#EF4444", marginTop: 2 }}>{m.erro}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Campo de composição */}
      <div style={{ padding: "10px 16px", borderTop: `1px solid ${DS.border}`, background: DS.card }}>
        {podeResponder ? (
          <form onSubmit={enviar}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <label htmlFor={`${uid}-t`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Mensagem</label>
              <textarea id={`${uid}-t`} rows={Math.min(4, Math.max(1, texto.split("\n").length))}
                maxLength={LIMITE_TEXTO.evolution} value={texto} onChange={(e) => setTexto(e.target.value)}
                placeholder="Digite uma mensagem..."
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && largura >= 900) { e.preventDefault(); enviar(); } }}
                style={{
                  flex: 1, padding: "10px 14px", border: `1px solid ${DS.border}`, borderRadius: DS.radiusSm,
                  fontSize: 13.5, color: DS.ink, background: DS.bg, outline: "none", resize: "none",
                  minHeight: 42, fontFamily: DS.font, lineHeight: 1.45,
                }} />
              <button type="submit" disabled={enviando || !texto.trim()}
                style={{
                  width: 42, height: 42, borderRadius: DS.radiusSm, border: "none",
                  background: texto.trim() ? DS.blue : DS.border, color: "#fff",
                  cursor: texto.trim() ? "pointer" : "default", display: "grid", placeItems: "center",
                  transition: "background .15s",
                }}>
                <Send size={16} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: DS.muted2, marginTop: 4 }}>
              Responda até {horaCheia(c.janelaAte)}
            </div>
          </form>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: DS.muted, padding: "6px 0" }}>
            <Lock size={14} style={{ flexShrink: 0 }} /> {motivo}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Painel de Inteligência Comercial (coluna direita) ───────────────────
function PainelIntel({ conversa, onFechar, largura }) {
  if (!conversa) return null;
  const c = conversa;
  const lead = c.lead;

  return (
    <div style={{
      display: "flex", flexDirection: "column", background: DS.card,
      borderLeft: `1px solid ${DS.border}`, overflowY: "auto",
      borderRadius: `0 ${DS.radius}px ${DS.radius}px 0`,
    }}>
      <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: DS.font, color: DS.ink }}>Detalhes do lead</span>
        {onFechar && (
          <button type="button" onClick={onFechar} style={{
            width: 28, height: 28, borderRadius: 6, border: `1px solid ${DS.border}`,
            background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: DS.muted,
          }}><X size={14} /></button>
        )}
      </div>

      <div style={{ padding: 16, textAlign: "center" }}>
        <Avatar nome={c.nome} tam={56} />
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: DS.font, color: DS.ink, marginTop: 8 }}>{c.nome}</div>
        {c.telefone && <div style={{ fontSize: 13, color: DS.muted, marginTop: 2 }}>+{c.telefone}</div>}
        {lead && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 12px",
            borderRadius: 999, fontSize: 12, fontWeight: 600, marginTop: 8,
            background: DS.blue50, color: DS.blue,
          }}>
            {ETAPAS[lead.etapa]?.nome || lead.etapa}
          </span>
        )}
      </div>

      {/* Informações */}
      <div style={{ padding: "0 16px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: DS.muted, marginBottom: 8 }}>Informações</div>
        {[
          c.telefone && { icon: Phone, label: "Telefone", valor: `+${c.telefone}` },
          c.conta && { icon: Building2, label: "Conta", valor: c.conta },
          lead?.etapa && { icon: ArrowUpRight, label: "Etapa", valor: ETAPAS[lead.etapa]?.nome || lead.etapa },
          c.ultima?.em && { icon: Clock, label: "Último contato", valor: horaCheia(c.ultima.em) },
        ].filter(Boolean).map((item) => (
          <div key={item.label} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${DS.border}` }}>
            <item.icon size={15} style={{ color: DS.muted2, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: DS.muted2 }}>{item.label}</div>
              <div style={{ fontSize: 13, color: DS.ink, fontWeight: 500 }}>{item.valor}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Ações rápidas */}
      <div style={{ padding: "0 16px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: DS.muted, marginBottom: 8 }}>Ações rápidas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lead && (
            <button type="button" style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
              background: DS.bg, border: `1px solid ${DS.border}`, borderRadius: 8,
              cursor: "pointer", font: "inherit", fontSize: 13, color: DS.ink, textAlign: "left",
            }}>
              <ExternalLink size={14} style={{ color: DS.blue }} /> Abrir ficha do lead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Drawer de Gerenciamento WhatsApp ────────────────────────────────────
function WhatsAppDrawer({ aberto, onFechar, info, aviso, recarregar }) {
  const [aceite, setAceite] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [modalQr, setModalQr] = useState(false);
  const pollRef = useRef(null);

  const conectado = info?.status === "ativa";

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (info?.status === "aguardando_qr" || info?.status === "reconectando") {
      pollRef.current = setInterval(async () => {
        const r = await api("/evolution/info");
        if (r?.status === "ativa") { setModalQr(false); setQrCode(""); aviso?.("WhatsApp conectado!"); recarregar?.(); }
      }, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [info?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (info?.qrCode && info.status === "aguardando_qr") setQrCode(info.qrCode);
  }, [info?.qrCode, info?.status]);

  const conectar = async (forcarConsentimento = false) => {
    setOcupado(true);
    try {
      const r = await api("/evolution/conectar", { consentimento: forcarConsentimento || aceite });
      if (!r || r.error) throw new Error(r?.error || "Não foi possível conectar.");
      if (r.qrCode) setQrCode(r.qrCode);
      setModalQr(true);
      recarregar?.();
    } catch (e) { aviso?.(e.message); }
    finally { setOcupado(false); }
  };

  const reconectar = async () => {
    setOcupado(true);
    try {
      const r = await api("/evolution/reconectar", {});
      if (!r || r.error) throw new Error(r?.error || "Não foi possível reconectar.");
      if (r.qrCode) setQrCode(r.qrCode);
      setModalQr(true);
      recarregar?.();
    } catch (e) { aviso?.(e.message); }
    finally { setOcupado(false); }
  };

  const atualizarQr = async () => {
    try {
      const r = await api("/evolution/qrcode");
      if (r?.base64) setQrCode(r.base64);
    } catch (e) { aviso?.(e.message); }
  };

  const desconectar = async () => {
    if (!window.confirm("Desconectar o WhatsApp? As novas mensagens deixam de chegar. O histórico fica guardado.")) return;
    try {
      const r = await api("/evolution/desconectar", {});
      if (!r || r.error) throw new Error(r?.error || "Não foi possível desconectar.");
      aviso?.("WhatsApp desconectado."); setQrCode(""); setModalQr(false);
      recarregar?.();
    } catch (e) { aviso?.(e.message); }
  };

  if (!aberto) return null;

  const STATUS_COR = { ativa: DS.green, aguardando_qr: DS.orange, reconectando: DS.orange, desconectada: "#EF4444" };
  const STATUS_TXT = { ativa: "Conectado", aguardando_qr: "Aguardando QR Code", reconectando: "Reconectando…", desconectada: "Desconectado" };

  return (
    <>
      {/* Overlay */}
      <div onClick={onFechar} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,.3)" }} />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(400px, 90vw)", zIndex: 9999,
        background: DS.card, boxShadow: "-8px 0 32px rgba(0,0,0,.12)",
        display: "flex", flexDirection: "column", overflowY: "auto",
      }}>
        <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: DS.font, color: DS.ink }}>Contas conectadas</h2>
          <button type="button" onClick={onFechar} style={{
            width: 32, height: 32, borderRadius: 8, border: `1px solid ${DS.border}`,
            background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: DS.muted,
          }}><X size={16} /></button>
        </div>

        <div style={{ padding: 20, flex: 1 }}>
          {info?.id ? (
            <div style={{ background: DS.bg, borderRadius: DS.radiusSm, padding: 16, border: `1px solid ${DS.border}` }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <span style={{
                  width: 44, height: 44, borderRadius: 12, background: DS.green50,
                  display: "grid", placeItems: "center",
                }}>
                  <Smartphone size={22} style={{ color: DS.green }} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, fontFamily: DS.font, color: DS.ink }}>{info.nome || "WhatsApp"}</div>
                  {info.numero && <div style={{ fontSize: 13, color: DS.muted }}>+{info.numero}</div>}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: DS.muted }}>Status</span>
                  <span style={{ fontWeight: 600, color: STATUS_COR[info.status] || DS.muted2 }}>{STATUS_TXT[info.status] || info.status}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: DS.muted }}>Sessão</span>
                  <span style={{ fontWeight: 500, color: DS.ink }}>{conectado ? "Ativa" : "Inativa"}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!conectado && info.status === "desconectada" && (
                  <button type="button" onClick={() => conectar(true)} disabled={ocupado}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "8px 14px", background: DS.blue, color: "#fff", border: "none",
                      borderRadius: 8, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, minHeight: 40,
                    }}>
                    <QrCode size={14} /> Reconectar com QR Code
                  </button>
                )}
                {!conectado && info.status !== "desconectada" && (
                  <button type="button" onClick={reconectar} disabled={ocupado}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "8px 14px", background: DS.blue, color: "#fff", border: "none",
                      borderRadius: 8, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, minHeight: 40,
                    }}>
                    <RefreshCw size={14} /> Reconectar
                  </button>
                )}
                {conectado && (
                  <button type="button" onClick={desconectar}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "8px 14px", background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA",
                      borderRadius: 8, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, minHeight: 40,
                    }}>
                    <Unplug size={14} /> Desconectar
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <span style={{
                display: "inline-grid", placeItems: "center", width: 56, height: 56,
                borderRadius: 14, background: DS.green50, marginBottom: 12,
              }}>
                <QrCode size={28} style={{ color: DS.green }} />
              </span>
              <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: DS.font, color: DS.ink, margin: "0 0 6px" }}>Conectar WhatsApp</h3>
              <p style={{ fontSize: 13, color: DS.muted, margin: "0 0 16px", lineHeight: 1.5 }}>
                Conecte seu WhatsApp pessoal por QR Code para atender leads diretamente pela RYCS.
              </p>

              <div style={{
                background: DS.bg, borderRadius: DS.radiusSm, padding: 14,
                border: `1px solid ${DS.border}`, marginBottom: 14, textAlign: "left",
                fontSize: 12.5, lineHeight: 1.5, color: DS.muted,
              }}>
                <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 6, color: DS.orange }} />
                Esta integração usa uma tecnologia não oficial do WhatsApp. A conexão pode sofrer interrupções.
              </div>

              <label style={{
                display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left",
                fontSize: 13, lineHeight: 1.5, cursor: "pointer", marginBottom: 16,
              }}>
                <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} style={{ marginTop: 3 }} />
                <span>
                  <ShieldCheck size={14} style={{ verticalAlign: -2, marginRight: 4, color: DS.green }} />
                  Só conversas com leads são guardadas. Conversas particulares não são importadas. <b>Li e concordo.</b>
                </span>
              </label>

              <button type="button" onClick={conectar} disabled={ocupado || !aceite}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 18px", background: aceite ? DS.green : DS.border, color: "#fff",
                  border: "none", borderRadius: DS.radiusSm, cursor: aceite ? "pointer" : "default",
                  font: "inherit", fontSize: 14, fontWeight: 600, minHeight: 44,
                  transition: "background .15s",
                }}>
                {ocupado ? <RefreshCw size={15} className="vx-spin" /> : <QrCode size={15} />}
                {ocupado ? " Conectando…" : " Conectar com QR Code"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal QR Code */}
      {modalQr && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget && info?.status !== "aguardando_qr") setModalQr(false); }}>
          <div style={{ maxWidth: 400, width: "100%", padding: 24, textAlign: "center", background: DS.card, borderRadius: DS.radius, boxShadow: "0 16px 48px rgba(0,0,0,.2)" }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: DS.font, margin: "0 0 4px", color: DS.ink }}>Escaneie o QR Code</h3>
            <p style={{ fontSize: 13, color: DS.muted, margin: "0 0 16px", lineHeight: 1.5 }}>
              WhatsApp → Aparelhos conectados → Conectar um aparelho
            </p>
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, display: "inline-block", minWidth: 240, minHeight: 240 }}>
              {qrCode ? (
                <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" style={{ width: 220, height: 220, imageRendering: "pixelated" }} />
              ) : (
                <div style={{ width: 220, height: 220, display: "grid", placeItems: "center", color: DS.muted2 }}>
                  <div><RefreshCw size={24} className="vx-spin" /><div style={{ marginTop: 8, fontSize: 13 }}>Gerando QR Code…</div></div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: DS.muted2 }}>
              {info?.status === "ativa" ? (
                <span style={{ color: DS.green }}><Wifi size={14} style={{ verticalAlign: -2 }} /> Conectado!</span>
              ) : "O QR Code expira em ~45 segundos."}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
              <button type="button" onClick={atualizarQr} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                background: DS.bg, border: `1px solid ${DS.border}`, borderRadius: 8,
                cursor: "pointer", font: "inherit", fontSize: 13, color: DS.ink, minHeight: 40,
              }}><RefreshCw size={14} /> Novo QR Code</button>
              <button type="button" onClick={() => setModalQr(false)} style={{
                padding: "8px 14px", background: DS.bg, border: `1px solid ${DS.border}`, borderRadius: 8,
                cursor: "pointer", font: "inherit", fontSize: 13, color: DS.muted, minHeight: 40,
              }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Modal Nova Conversa ─────────────────────────────────────────────────
function NovaConversa({ aberto, onFechar, aviso, onAbrir }) {
  const [busca, setBusca] = useState("");
  const [leads, setLeads] = useState(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    api("/leads?limit=50").then((r) => {
      setLeads(Array.isArray(r?.leads) ? r.leads : []);
      setCarregando(false);
    });
  }, [aberto]);

  if (!aberto) return null;

  const filtrados = (leads || []).filter((l) => {
    if (!busca) return true;
    const t = busca.toLowerCase();
    return (l.nome || "").toLowerCase().includes(t) || (l.telefone || "").includes(t);
  });

  return (
    <>
      <div onClick={onFechar} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,.3)" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(480px, 90vw)", maxHeight: "80vh", zIndex: 9999,
        background: DS.card, borderRadius: DS.radius, boxShadow: "0 16px 48px rgba(0,0,0,.2)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, fontFamily: DS.font, color: DS.ink }}>Nova conversa</h2>
          <button type="button" onClick={onFechar} style={{
            width: 28, height: 28, borderRadius: 6, border: `1px solid ${DS.border}`,
            background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: DS.muted,
          }}><X size={14} /></button>
        </div>

        <div style={{ padding: "12px 20px 0" }}>
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: DS.muted2 }} />
            <input placeholder="Buscar lead por nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px 8px 32px", border: `1px solid ${DS.border}`,
                borderRadius: 8, fontSize: 13, color: DS.ink, background: DS.bg,
                outline: "none", minHeight: 38, fontFamily: DS.font,
              }} />
          </div>
          <p style={{ fontSize: 12, color: DS.muted, marginTop: 6, marginBottom: 0 }}>Selecione um lead das suas empresas para iniciar a conversa.</p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px", minHeight: 0 }}>
          {carregando ? (
            <div style={{ padding: 32, textAlign: "center" }}><div className="vx-spinner" /></div>
          ) : filtrados.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: DS.muted, fontSize: 13 }}>
              {busca ? "Nenhum lead encontrado." : "Você não tem leads disponíveis."}
            </div>
          ) : filtrados.map((l) => (
            <button key={l.id} type="button"
              onClick={() => { onAbrir?.(l); onFechar(); }}
              style={{
                width: "100%", textAlign: "left", display: "flex", gap: 10, alignItems: "center",
                padding: "10px 12px", border: 0, borderBottom: `1px solid ${DS.border}`,
                background: "transparent", cursor: "pointer", color: DS.ink, font: "inherit",
              }}>
              <Avatar nome={l.nome} tam={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: DS.font }}>{l.nome}</div>
                <div style={{ fontSize: 12, color: DS.muted }}>
                  {[l.telefone && `+${l.telefone}`, l.empresa, ETAPAS[l.etapa]?.nome].filter(Boolean).join(" · ")}
                </div>
              </div>
              <MessageCircle size={16} style={{ color: DS.blue, flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Estados vazios ──────────────────────────────────────────────────────
function EstadoVazio({ tipo, onConectar, onNova }) {
  if (tipo === "desconectado") {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 48, textAlign: "center", flex: 1,
      }}>
        <span style={{
          display: "inline-grid", placeItems: "center", width: 72, height: 72,
          borderRadius: 20, background: DS.blue50, marginBottom: 16,
        }}>
          <Smartphone size={36} style={{ color: DS.blue }} />
        </span>
        <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: DS.font, color: DS.ink, margin: "0 0 6px" }}>Conecte seu WhatsApp</h2>
        <p style={{ fontSize: 14, color: DS.muted, margin: "0 0 20px", maxWidth: 360, lineHeight: 1.5 }}>
          Conecte seu WhatsApp pessoal por QR Code para atender leads e negociar diretamente pela RYCS.
        </p>
        <button type="button" onClick={onConectar} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 24px",
          background: DS.blue, color: "#fff", border: "none", borderRadius: DS.radiusSm,
          cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, minHeight: 44,
        }}>
          <QrCode size={16} /> Conectar WhatsApp
        </button>
      </div>
    );
  }

  if (tipo === "sem-conversas") {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 48, textAlign: "center", background: DS.card, borderRadius: DS.radius, flex: 1,
      }}>
        <span style={{
          display: "inline-grid", placeItems: "center", width: 72, height: 72,
          borderRadius: 20, background: DS.blue50, marginBottom: 16,
        }}>
          <MessageCircle size={36} style={{ color: DS.blue }} />
        </span>
        <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: DS.font, color: DS.ink, margin: "0 0 6px" }}>Comece sua primeira conversa</h2>
        <p style={{ fontSize: 14, color: DS.muted, margin: "0 0 20px", maxWidth: 380, lineHeight: 1.5 }}>
          Selecione um dos seus leads e inicie um atendimento pelo WhatsApp.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onNova} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "10px 20px",
            background: DS.blue, color: "#fff", border: "none", borderRadius: DS.radiusSm,
            cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, minHeight: 44,
          }}>
            <Plus size={15} /> Nova conversa
          </button>
        </div>
      </div>
    );
  }

  // Nenhuma conversa selecionada
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 48, textAlign: "center", background: DS.chatBg, flex: 1,
      borderRadius: `0 ${DS.radius}px ${DS.radius}px 0`,
    }}>
      <span style={{
        display: "inline-grid", placeItems: "center", width: 64, height: 64,
        borderRadius: 16, background: DS.blue50, marginBottom: 14,
      }}>
        <MessageSquare size={30} style={{ color: DS.blue }} />
      </span>
      <h3 style={{ fontSize: 17, fontWeight: 700, fontFamily: DS.font, color: DS.ink, margin: "0 0 4px" }}>Selecione uma conversa</h3>
      <p style={{ fontSize: 13, color: DS.muted, margin: 0, maxWidth: 320, lineHeight: 1.5 }}>
        Acompanhe mensagens, negociações e atividades dos seus leads.
      </p>
    </div>
  );
}

// ── Banner compacto de desconexão ───────────────────────────────────────
function BannerDesconectado({ info, onReconectar }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
      background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.18)",
      borderRadius: DS.radiusSm, marginBottom: 12, flexWrap: "wrap",
    }}>
      <Unplug size={16} style={{ color: "#EF4444", flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: DS.ink2, flex: 1, minWidth: 0 }}>
        <b>WhatsApp desconectado</b>
        {info?.numero ? ` (+${info.numero})` : ""}
        {" — "}o histórico está preservado. Reconecte para voltar a enviar mensagens.
      </span>
      <button type="button" onClick={onReconectar} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
        background: DS.blue, color: "#fff", border: "none", borderRadius: 8,
        cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, minHeight: 36,
        whiteSpace: "nowrap",
      }}>
        <RefreshCw size={14} /> Reconectar
      </button>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────
export default function Conversas({ aviso }) {
  const largura = useLargura();
  const desktop = largura >= 1024;
  const tablet = largura >= 768 && largura < 1024;
  const mobile = largura < 768;

  const [info, setInfo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [lista, setLista] = useState(null);
  const [naoLidasTotal, setNaoLidasTotal] = useState(0);
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState("todas");
  const [aberta, setAberta] = useState("");
  const [filtro, setFiltro] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(false);
  const [painel, setPainel] = useState(true);
  const [leadSel, setLeadSel] = useState(null);

  const carregarInfo = useCallback(() => api("/evolution/info").then((r) => {
    if (r && !r.error) setInfo(r);
    setCarregando(false);
    return r;
  }), []);

  const carregarLista = useCallback(() => {
    const q = new URLSearchParams({ canal: "evolution", busca });
    return api(`/canais/conversas?${q}`).then((r) => {
      if (Array.isArray(r?.conversas)) setLista(r.conversas);
      if (r?.naoLidas?.evolution != null) setNaoLidasTotal(r.naoLidas.evolution);
    });
  }, [busca]);

  useEffect(() => { carregarInfo(); }, [carregarInfo]);
  useEffect(() => { carregarLista(); const t = setInterval(() => { if (!document.hidden) carregarLista(); }, 10000); return () => clearInterval(t); }, [carregarLista]);

  const recarregar = () => { carregarInfo(); carregarLista(); };

  if (carregando) return <div style={{ padding: 40, textAlign: "center" }}><div className="vx-spinner" /></div>;

  const conectado = info?.status === "ativa";
  const autorizado = info?.autorizado !== false;
  const configurada = info?.configurada !== false;

  // Não autorizado
  if (configurada && !autorizado && !info?.id) {
    return (
      <div className="vx-fade" style={{ fontFamily: DS.font }}>
        <Cabecalho conexao={null} onGerenciar={() => setDrawer(true)} onNova={() => setModal(true)} />
        <EstadoVazio tipo="desconectado" onConectar={() => setDrawer(true)} />
      </div>
    );
  }

  // Nunca conectou (sem nenhuma conexão, nem desconectada)
  if (!info?.id && !conectado) {
    return (
      <div className="vx-fade" style={{ fontFamily: DS.font }}>
        <Cabecalho conexao={null} onGerenciar={() => setDrawer(true)} onNova={() => setModal(true)} />
        <EstadoVazio tipo="desconectado" onConectar={() => setDrawer(true)} />
        <WhatsAppDrawer aberto={drawer} onFechar={() => setDrawer(false)} info={info} aviso={aviso} recarregar={recarregar} />
      </div>
    );
  }

  const desconectado = info?.status === "desconectada";

  const temConversas = (lista || []).length > 0;
  const mostraPainel = desktop && painel && aberta && leadSel;

  // Coluna central
  const colunaCentral = aberta ? (
    <AreaChat conversaId={aberta} largura={largura} aviso={aviso}
      onVoltar={mobile || tablet ? () => { setAberta(""); carregarLista(); } : null}
      onMudou={carregarLista} onSelLead={setLeadSel} />
  ) : (
    <EstadoVazio tipo={temConversas ? "nenhuma-selecionada" : "sem-conversas"} onNova={() => setModal(true)} />
  );

  // Mobile: lista OU chat
  if (mobile) {
    return (
      <div className="vx-fade" style={{ fontFamily: DS.font, display: "flex", flexDirection: "column", height: "calc(100dvh - 120px)" }}>
        <Cabecalho conexao={info} onGerenciar={() => setDrawer(true)} onNova={() => setModal(true)} />
        {desconectado && <BannerDesconectado info={info} onReconectar={() => setDrawer(true)} />}
        {!aberta ? (
          <>
            <Indicadores lista={lista} naoLidas={naoLidasTotal} onFiltrar={setAba} />
            <div style={{ flex: 1, background: DS.card, borderRadius: DS.radius, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <CaixaEntrada lista={lista} busca={busca} setBusca={setBusca} aba={aba} setAba={setAba} aberta={aberta} setAberta={setAberta} filtro={filtro} setFiltro={setFiltro} />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, background: DS.card, borderRadius: DS.radius, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
            {colunaCentral}
          </div>
        )}
        <WhatsAppDrawer aberto={drawer} onFechar={() => setDrawer(false)} info={info} aviso={aviso} recarregar={recarregar} />
        <NovaConversa aberto={modal} onFechar={() => setModal(false)} aviso={aviso} />
      </div>
    );
  }

  // Desktop/Tablet
  const cols = desktop
    ? `minmax(280px, 320px) minmax(0, 1fr)${mostraPainel ? " 280px" : ""}`
    : `minmax(260px, 300px) minmax(0, 1fr)`;

  return (
    <div className="vx-fade" style={{ fontFamily: DS.font }}>
      <Cabecalho conexao={info} onGerenciar={() => setDrawer(true)} onNova={() => setModal(true)} />
      {desconectado && <BannerDesconectado info={info} onReconectar={() => setDrawer(true)} />}
      <Indicadores lista={lista} naoLidas={naoLidasTotal} onFiltrar={setAba} />

      <div style={{
        display: "grid", gridTemplateColumns: cols,
        height: `max(520px, calc(100dvh - 280px))`,
        border: `1px solid ${DS.border}`, borderRadius: DS.radius,
        overflow: "hidden", background: DS.card,
      }}>
        <CaixaEntrada lista={lista} busca={busca} setBusca={setBusca} aba={aba} setAba={setAba} aberta={aberta} setAberta={setAberta} filtro={filtro} setFiltro={setFiltro} />
        {colunaCentral}
        {mostraPainel && <PainelIntel conversa={leadSel} onFechar={() => setPainel(false)} largura={largura} />}
      </div>

      <WhatsAppDrawer aberto={drawer} onFechar={() => setDrawer(false)} info={info} aviso={aviso} recarregar={recarregar} />
      <NovaConversa aberto={modal} onFechar={() => setModal(false)} aviso={aviso} />
    </div>
  );
}

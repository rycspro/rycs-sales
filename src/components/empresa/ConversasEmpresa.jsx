import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Search, X, ChevronLeft,
  CheckCheck, Check, MapPin, BriefcaseBusiness, CheckCircle2,
} from "lucide-react";
import { api } from "../../lib/api.js";
import { uid, agora } from "../../lib/utils.js";

const PERFIL_LABEL = { sdr: "SDR", bdr: "BDR", closer: "Closer", pap: "Porta a porta", "sem-exp": "Em formação" };
const arr = (v) => Array.isArray(v) ? v : [];

function PerfilModal({ seller, db, empId, onFechar }) {
  const subs = (db.submissions || []).filter((s) => s.companyId === empId && s.sellerId === seller.id);
  const aprovadas = subs.filter((s) => s.status === "liberado").length;
  const taxa = subs.length ? Math.round(aprovadas / subs.length * 100) : 0;
  const nome = capitalizar([seller.nome, seller.sobrenome].filter(Boolean).join(" ") || seller.nome || "");
  const scoreVal = Number(seller.nota || 0);
  const scoreCor = scoreVal >= 80 ? "#0E7490" : scoreVal >= 50 ? "#b45309" : "#dc2626";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onFechar}
    >
      <div
        style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,.18)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* hero */}
        <div style={{ position: "relative", height: 200, background: "#F1F5F9", borderRadius: "20px 20px 0 0", overflow: "hidden" }}>
          {seller.foto
            ? <img src={seller.foto} alt={nome} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
            : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 64, fontWeight: 700, color: "#2563EB", fontFamily: "'Space Grotesk',sans-serif" }}>{iniciais(seller.nome)}</div>
          }
          <button onClick={onFechar} style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,.35)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <X size={16} />
          </button>
          <span style={{ position: "absolute", top: 12, left: 12, background: scoreCor, color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 10px" }}>
            {scoreVal} pts
          </span>
        </div>

        <div style={{ padding: "20px 24px 28px" }}>
          {/* nome + função */}
          <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", color: "#0B1220" }}>{nome}</h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            {seller.perfil && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "#64748B" }}>
                <BriefcaseBusiness size={13} /> {PERFIL_LABEL[seller.perfil] || seller.perfil}
              </span>
            )}
            {(seller.cidade || seller.estado) && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "#64748B" }}>
                <MapPin size={13} /> {[seller.cidade, seller.estado].filter(Boolean).join(", ")}
              </span>
            )}
          </div>

          {/* bio */}
          {(seller.bio || seller.experiencia) && (
            <p style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.65, margin: "0 0 16px" }}>
              {(seller.bio || seller.experiencia).slice(0, 400)}{(seller.bio || seller.experiencia).length > 400 ? "…" : ""}
            </p>
          )}

          {/* métricas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Tarefas", val: `${aprovadas}/${subs.length}` },
              { label: "Aprovação", val: `${taxa}%` },
              { label: "Score", val: scoreVal },
            ].map(({ label, val }) => (
              <div key={label} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#2563EB" }}>{val}</div>
                <div style={{ fontSize: 10.5, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* skills */}
          {arr(seller.skills).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 7 }}>Habilidades</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {arr(seller.skills).map((s) => <span key={s} style={{ background: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 20 }}>{s}</span>)}
              </div>
            </div>
          )}

          {/* certificações */}
          {arr(seller.certificacoes).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 7 }}>Certificações</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {arr(seller.certificacoes).map((c) => (
                  <span key={`${c.funcao}-${c.percentual}`} style={{ display: "flex", alignItems: "center", gap: 4, background: "#F0FDF4", color: "#166534", fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 20 }}>
                    <CheckCircle2 size={11} /> {PERFIL_LABEL[c.funcao] || c.funcao} · {c.percentual}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── utilidades ────────────────────────────────────────────────────────────────

function iniciais(nome = "") {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("") || "?";
}

function capitalizar(nome = "") {
  return String(nome).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function horaOuData(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString())
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function labelData(ts) {
  const d = new Date(ts);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function agruparPorData(msgs) {
  const grupos = [];
  let diaAtual = null;
  for (const m of msgs) {
    const dia = new Date(m.ts).toDateString();
    if (dia !== diaAtual) { grupos.push({ tipo: "separador", label: labelData(m.ts), ts: m.ts }); diaAtual = dia; }
    grupos.push({ tipo: "msg", ...m });
  }
  return grupos;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ nome, foto, size = 40, fontSize = 15 }) {
  const [err, setErr] = useState(false);
  const cores = ["#2563EB", "#7C3AED", "#059669", "#DC2626", "#D97706"];
  const cor = cores[(nome?.charCodeAt(0) || 0) % cores.length];
  if (foto && !err)
    return <img src={foto} alt={nome} onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: cor,
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 700, flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif",
    }}>
      {iniciais(nome)}
    </div>
  );
}

// ── Item da lista de conversas ─────────────────────────────────────────────────

function ItemConversa({ c, ativo, onClick }) {
  const nome = capitalizar(c.seller?.nome || "Profissional");
  const preview = c.ultima
    ? `${c.ultima.de === "empresa" ? "Você: " : ""}${c.ultima.texto}`
    : "Sem mensagens";
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      style={{
        display: "flex", alignItems: "center", gap: 11, width: "100%",
        padding: "11px 14px", textAlign: "left", border: "none", cursor: "pointer",
        background: ativo ? "#EFF6FF" : "transparent",
        borderLeft: `3px solid ${ativo ? "#2563EB" : "transparent"}`,
        transition: "background .12s",
        outline: "none",
      }}
      onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.background = "#F8FAFC"; }}
      onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Avatar nome={c.seller?.nome} foto={c.seller?.foto} size={40} fontSize={14} />
        {c.naoLidas > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2,
            width: 10, height: 10, borderRadius: "50%",
            background: "#2563EB", border: "2px solid #fff",
          }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4, marginBottom: 3 }}>
          <span style={{
            fontWeight: c.naoLidas > 0 ? 700 : 500,
            fontSize: 13.5, color: "#0B1220",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{nome}</span>
          <span style={{ fontSize: 11, color: "#94A3B8", flexShrink: 0 }}>{horaOuData(c.ultima?.ts)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
          <span style={{
            fontSize: 12.5, color: c.naoLidas > 0 ? "#334155" : "#94A3B8",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontWeight: c.naoLidas > 0 ? 500 : 400,
          }}>{preview}</span>
          {c.naoLidas > 0 && (
            <span style={{
              background: "#2563EB", color: "#fff", borderRadius: 20,
              fontSize: 10.5, padding: "1px 6px", fontWeight: 700, flexShrink: 0,
              minWidth: 18, textAlign: "center",
            }}>{c.naoLidas}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Área de mensagens ─────────────────────────────────────────────────────────

function AreaMensagens({ msgs, companyId, nomeEmpresa, seller }) {
  const fimRef = useRef(null);
  const itens = agruparPorData([...msgs].sort((a, b) => a.ts - b.ts));

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length]);

  if (!msgs.length)
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "#94A3B8" }}>
        <MessageSquare size={32} strokeWidth={1.5} />
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500 }}>Nenhuma mensagem ainda</p>
        <p style={{ margin: 0, fontSize: 12, color: "#CBD5E1" }}>Envie a primeira mensagem abaixo</p>
      </div>
    );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 2, scrollbarWidth: "thin", scrollbarColor: "#E2E8F0 transparent" }}>
      {itens.map((item, i) => {
        if (item.tipo === "separador") return (
          <div key={`sep-${item.ts}`} style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 8px", userSelect: "none" }}>
            <div style={{ flex: 1, height: 1, background: "#F1F5F9" }} />
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500, whiteSpace: "nowrap" }}>{item.label}</span>
            <div style={{ flex: 1, height: 1, background: "#F1F5F9" }} />
          </div>
        );
        const meu = item.de === "empresa";
        const lida = !!item.lida;
        return (
          <div key={item.id || i} style={{ display: "flex", justifyContent: meu ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 7, marginBottom: 4 }}>
            {/* avatar do profissional nas mensagens dele */}
            {!meu && (
              <div style={{ flexShrink: 0, marginBottom: 20 }}>
                <Avatar nome={seller?.nome} foto={seller?.foto} size={28} fontSize={10} />
              </div>
            )}
            <div style={{ maxWidth: "72%" }}>
              {/* nome do profissional acima da primeira mensagem de cada grupo */}
              {!meu && seller?.nome && (
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginBottom: 2, paddingLeft: 2 }}>
                  {capitalizar(seller.nome)}
                </div>
              )}
              <div style={{
                background: meu ? "#2563EB" : "#F1F5F9",
                color: meu ? "#fff" : "#1E293B",
                padding: "9px 13px",
                borderRadius: meu ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                fontSize: 13.5, lineHeight: 1.5, wordBreak: "break-word",
                boxShadow: meu ? "0 2px 8px rgba(37,99,235,.2)" : "0 1px 2px rgba(0,0,0,.04)",
              }}>
                {item.texto}
              </div>
              <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 3, display: "flex", alignItems: "center", gap: 3, justifyContent: meu ? "flex-end" : "flex-start", paddingLeft: meu ? 0 : 4, paddingRight: meu ? 4 : 0 }}>
                <span>{new Date(item.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                {meu && (
                  lida
                    ? <CheckCheck size={13} color="#2563EB" strokeWidth={2.5} />
                    : <Check size={13} color="#94A3B8" strokeWidth={2.5} />
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={fimRef} style={{ height: 1 }} />
    </div>
  );
}

// ── Campo de envio ────────────────────────────────────────────────────────────

function CampoEnvio({ onEnviar, enviando }) {
  const [txt, setTxt] = useState("");
  const ref = useRef(null);

  const submeter = () => {
    if (!txt.trim() || enviando) return;
    onEnviar(txt.trim());
    setTxt("");
    ref.current?.focus();
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submeter(); }
  };

  return (
    <div style={{ padding: "12px 16px", borderTop: "1px solid #F1F5F9", background: "#fff", display: "flex", gap: 10, alignItems: "flex-end" }}>
      <textarea
        ref={ref}
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onKeyDown={onKey}
        placeholder="Escreva uma mensagem… (Enter para enviar, Shift+Enter para nova linha)"
        rows={1}
        style={{
          flex: 1, resize: "none", border: "1.5px solid #E2E8F0", borderRadius: 10,
          padding: "10px 13px", fontSize: 13.5, fontFamily: "inherit", lineHeight: 1.5,
          outline: "none", color: "#1E293B", background: "#F8FAFC",
          transition: "border-color .15s",
          maxHeight: 120, overflowY: "auto",
        }}
        onFocus={(e) => { e.target.style.borderColor = "#2563EB"; e.target.style.background = "#fff"; }}
        onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; e.target.style.background = "#F8FAFC"; }}
        onInput={(e) => {
          e.target.style.height = "auto";
          e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
        }}
        aria-label="Campo de mensagem"
      />
      <button
        onClick={submeter}
        disabled={!txt.trim() || enviando}
        aria-label="Enviar mensagem"
        style={{
          width: 40, height: 40, borderRadius: 10, border: "none",
          background: txt.trim() && !enviando ? "#2563EB" : "#E2E8F0",
          color: txt.trim() && !enviando ? "#fff" : "#94A3B8",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: txt.trim() && !enviando ? "pointer" : "not-allowed",
          transition: "background .15s, color .15s",
          flexShrink: 0,
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "nao_lidas", label: "Não lidas" },
];

export default function ConversasEmpresa({ emp, db, up }) {
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [selSellerId, setSelSellerId] = useState(null);
  const [lidosLocal, setLidosLocal] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  const debounceRef = useRef(null);

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // debounce da busca
  const onBusca = (v) => {
    setBusca(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBuscaAtiva(v), 220);
  };

  // agrupa mensagens por vendedor
  const conversas = (() => {
    const por = {};
    for (const m of db.messages || []) {
      if (m.companyId !== emp.id) continue;
      if (!por[m.sellerId]) por[m.sellerId] = [];
      por[m.sellerId].push(m);
    }
    return Object.entries(por).map(([sellerId, msgs]) => {
      const seller = (db.sellers || []).find((s) => s.id === sellerId);
      const ordenadas = [...msgs].sort((a, b) => a.ts - b.ts);
      const ultima = ordenadas[ordenadas.length - 1];
      const naoLidas = msgs.filter((m) => m.de === "vendedor" && !m.lida && !lidosLocal[sellerId]).length;
      return { sellerId, seller, ultima, naoLidas, total: msgs.length };
    }).sort((a, b) => (b.ultima?.ts || 0) - (a.ultima?.ts || 0));
  })();

  const totalNaoLidas = conversas.reduce((s, c) => s + c.naoLidas, 0);

  const filtradas = conversas.filter((c) => {
    if (filtro === "nao_lidas" && c.naoLidas === 0) return false;
    if (!buscaAtiva) return true;
    const nome = (c.seller?.nome || "").toLowerCase();
    return nome.includes(buscaAtiva.toLowerCase());
  });

  const abrirConversa = useCallback((sellerId) => {
    setSelSellerId(sellerId);
    setLidosLocal((prev) => ({ ...prev, [sellerId]: true }));
    api("/messages/ler", { companyId: emp.id, sellerId });
    up((d) => ({
      messages: d.messages.map((m) =>
        m.companyId === emp.id && m.sellerId === sellerId && m.de === "vendedor" ? { ...m, lida: 1 } : m
      ),
    }));
  }, [emp.id, up]);

  const enviarMensagem = useCallback(async (texto) => {
    if (enviando || !selSellerId) return;
    setEnviando(true);
    const id = uid();
    const ts = agora();
    up((d) => ({ messages: [...d.messages, { id, companyId: emp.id, sellerId: selSellerId, de: "empresa", texto, ts, lida: 0 }] }));
    try {
      await api("/messages", { companyId: emp.id, sellerId: selSellerId, de: "empresa", texto });
    } catch {
      up((d) => ({ messages: d.messages.filter((m) => m.id !== id) }));
    } finally {
      setEnviando(false);
    }
  }, [enviando, selSellerId, emp.id, up]);

  const selConv = conversas.find((c) => c.sellerId === selSellerId);
  const msgsSel = selConv
    ? (db.messages || []).filter((m) => m.companyId === emp.id && m.sellerId === selSellerId)
    : [];

  const nomeSel = capitalizar(selConv?.seller?.nome || "Profissional");

  // Mobile: se tem conversa aberta, mostra só o chat
  const mostraLista = !mobile || !selSellerId;
  const mostraChat = !mobile || !!selSellerId;

  return (
    <div style={{ display: "flex", height: mobile ? "calc(100dvh - 56px - env(safe-area-inset-bottom,0px))" : "calc(100vh - 56px)", overflow: "hidden", background: "#F8FAFC" }}>

      {/* ── PAINEL 2: LISTA DE CONVERSAS ─────────────────────────────────── */}
      {mostraLista && (
        <div style={{
          width: mobile ? "100%" : 340,
          minWidth: mobile ? undefined : 280,
          maxWidth: mobile ? undefined : 380,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: mobile ? "none" : "1px solid #E2E8F0",
          background: "#fff",
          height: "100%",
        }}>
          {/* cabeçalho da lista */}
          <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0B1220", fontFamily: "'Space Grotesk', sans-serif" }}>
                  Conversas
                </h2>
                {totalNaoLidas > 0 && (
                  <span style={{ background: "#2563EB", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "1px 7px" }}>
                    {totalNaoLidas}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>{conversas.length} {conversas.length === 1 ? "conversa" : "conversas"}</span>
            </div>

            {/* busca */}
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
              <input
                value={busca}
                onChange={(e) => onBusca(e.target.value)}
                placeholder="Buscar profissional…"
                aria-label="Buscar conversa"
                style={{
                  width: "100%", paddingLeft: 30, paddingRight: busca ? 28 : 10,
                  padding: "8px 10px 8px 30px", border: "1.5px solid #E2E8F0",
                  borderRadius: 8, fontSize: 13, fontFamily: "inherit",
                  outline: "none", color: "#1E293B", background: "#F8FAFC",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#2563EB"; e.target.style.background = "#fff"; }}
                onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; e.target.style.background = "#F8FAFC"; }}
              />
              {busca && (
                <button onClick={() => onBusca("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "#94A3B8" }}>
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* filtros */}
          <div style={{ display: "flex", borderBottom: "1px solid #F1F5F9", padding: "0 16px" }}>
            {FILTROS.map((f) => (
              <button key={f.id} onClick={() => setFiltro(f.id)} style={{
                padding: "8px 12px", border: "none", background: "none", cursor: "pointer",
                fontSize: 12.5, fontWeight: filtro === f.id ? 600 : 400,
                color: filtro === f.id ? "#2563EB" : "#64748B",
                borderBottom: `2px solid ${filtro === f.id ? "#2563EB" : "transparent"}`,
                marginBottom: -1, transition: "color .12s",
              }}>
                {f.label}
                {f.id === "nao_lidas" && totalNaoLidas > 0 && (
                  <span style={{ marginLeft: 5, background: "#EFF6FF", color: "#2563EB", borderRadius: 20, fontSize: 10, padding: "0 5px", fontWeight: 700 }}>{totalNaoLidas}</span>
                )}
              </button>
            ))}
          </div>

          {/* lista */}
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#E2E8F0 transparent" }}>
            {!filtradas.length && (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#94A3B8" }}>
                {buscaAtiva || filtro !== "todas" ? (
                  <>
                    <Search size={28} style={{ margin: "0 auto 10px", display: "block" }} strokeWidth={1.5} />
                    <p style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 500 }}>Nenhum resultado</p>
                    <button onClick={() => { onBusca(""); setFiltro("todas"); }} style={{ background: "none", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12.5, color: "#2563EB", fontWeight: 500 }}>
                      Limpar filtros
                    </button>
                  </>
                ) : (
                  <>
                    <MessageSquare size={32} style={{ margin: "0 auto 10px", display: "block" }} strokeWidth={1.5} />
                    <p style={{ margin: "0 0 6px", fontSize: 13.5, fontWeight: 500 }}>Nenhuma conversa ainda</p>
                    <p style={{ margin: 0, fontSize: 12 }}>Clique no ícone de mensagem no perfil de um profissional para iniciar.</p>
                  </>
                )}
              </div>
            )}
            {filtradas.map((c) => (
              <ItemConversa key={c.sellerId} c={c} ativo={selSellerId === c.sellerId} onClick={() => abrirConversa(c.sellerId)} />
            ))}
          </div>
        </div>
      )}

      {/* ── PAINEL 3: CHAT ───────────────────────────────────────────────── */}
      {mostraChat && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#fff", height: "100%" }}>
          {!selConv ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#94A3B8" }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageSquare size={28} strokeWidth={1.5} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "#334155" }}>Selecione uma conversa</p>
                <p style={{ margin: 0, fontSize: 13, color: "#94A3B8" }}>Escolha um profissional na lista ao lado</p>
              </div>
            </div>
          ) : (
            <>
              {/* cabeçalho do chat */}
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 12, background: "#fff", flexShrink: 0 }}>
                {mobile && (
                  <button onClick={() => setSelSellerId(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#64748B", display: "flex", marginLeft: -4 }}>
                    <ChevronLeft size={20} />
                  </button>
                )}
                <button
                  onClick={() => setPerfilAberto(true)}
                  style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", padding: 0, flex: 1, minWidth: 0, textAlign: "left" }}
                >
                  <Avatar nome={selConv.seller?.nome} foto={selConv.seller?.foto} size={38} fontSize={13} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: "#0B1220", fontFamily: "'Space Grotesk', sans-serif", textDecoration: "underline", textDecorationColor: "#CBD5E1", textUnderlineOffset: 3 }}>{nomeSel}</div>
                    <div style={{ fontSize: 12, color: "#94A3B8" }}>{msgsSel.length} {msgsSel.length === 1 ? "mensagem" : "mensagens"}</div>
                  </div>
                </button>
              </div>

              {perfilAberto && selConv?.seller && (
                <PerfilModal seller={selConv.seller} db={db} empId={emp.id} onFechar={() => setPerfilAberto(false)} />
              )}

              {/* mensagens */}
              <AreaMensagens msgs={msgsSel} companyId={emp.id} nomeEmpresa={emp.nome} seller={selConv?.seller} />

              {/* campo de envio */}
              <CampoEnvio onEnviar={enviarMensagem} enviando={enviando} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

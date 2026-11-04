import { useState, useEffect } from "react";
import { MessageSquare, Search, X } from "lucide-react";
import { api } from "../../lib/api.js";
import { dataCurta } from "../../lib/utils.js";
import Chat from "../Chat.jsx";

function iniciais(nome = "") {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("") || "?";
}

function capitalizar(nome = "") {
  return String(nome).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ConversasEmpresa({ emp, db, up }) {
  const [busca, setBusca] = useState("");
  const [selSellerId, setSelSellerId] = useState(null);
  const [lidosLocal, setLidosLocal] = useState({});

  // Agrupa mensagens por vendedor
  const mensagensPorVendedor = (db.messages || [])
    .filter((m) => m.companyId === emp.id)
    .reduce((acc, m) => {
      if (!acc[m.sellerId]) acc[m.sellerId] = [];
      acc[m.sellerId].push(m);
      return acc;
    }, {});

  // Busca dados dos vendedores (de db.sellers que temos, + outros pelo id)
  const conversas = Object.entries(mensagensPorVendedor).map(([sellerId, msgs]) => {
    const seller = (db.sellers || []).find((s) => s.id === sellerId);
    const ordenadas = [...msgs].sort((a, b) => a.ts - b.ts);
    const ultima = ordenadas[ordenadas.length - 1];
    const naoLidas = msgs.filter((m) => m.de === "vendedor" && !m.lida && !lidosLocal[sellerId]).length;
    return { sellerId, seller, ultima, naoLidas, total: msgs.length };
  }).sort((a, b) => (b.ultima?.ts || 0) - (a.ultima?.ts || 0));

  const filtradas = conversas.filter((c) => {
    const nome = c.seller?.nome || "";
    return !busca || nome.toLowerCase().includes(busca.toLowerCase());
  });

  const abrirConversa = (sellerId) => {
    setSelSellerId(sellerId);
    // marca como lido localmente
    setLidosLocal((prev) => ({ ...prev, [sellerId]: true }));
    // e no servidor
    api("/messages/ler", { companyId: emp.id, sellerId });
    up((d) => ({
      messages: d.messages.map((m) =>
        m.companyId === emp.id && m.sellerId === sellerId && m.de === "vendedor" ? { ...m, lida: 1 } : m
      ),
    }));
  };

  const selConv = filtradas.find((c) => c.sellerId === selSellerId);

  return (
    <div className="vx-fade">
      <div className="vx-page-head">
        <div>
          <h1 className="vx-disp">Conversas</h1>
          <p>Mensagens com profissionais da plataforma.</p>
        </div>
        {conversas.some((c) => c.naoLidas > 0) && (
          <span className="vx-chip" style={{ background: "var(--brand)", color: "#fff" }}>
            {conversas.reduce((t, c) => t + c.naoLidas, 0)} não lidas
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 180px)", minHeight: 400 }}>
        {/* Lista de conversas */}
        <div className="vx-card" style={{ width: 300, minWidth: 260, flexShrink: 0, padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: 11, color: "var(--muted)", pointerEvents: "none" }} />
              <input className="vx-input" style={{ paddingLeft: 30, fontSize: 13 }} placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
            {!filtradas.length && (
              <div style={{ padding: 24, textAlign: "center" }}>
                <MessageSquare size={24} color="var(--muted)" style={{ margin: "0 auto 8px" }} />
                <p className="vx-mut" style={{ fontSize: 13, margin: 0 }}>
                  {busca ? "Nenhum resultado." : "Nenhuma conversa ainda. Clique no ícone de mensagem em um card de profissional."}
                </p>
              </div>
            )}
            {filtradas.map((c) => {
              const nome = capitalizar(c.seller?.nome || "Profissional");
              const fotoUrl = c.seller?.foto || null;
              const ativo = selSellerId === c.sellerId;
              return (
                <button
                  key={c.sellerId}
                  onClick={() => abrirConversa(c.sellerId)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "12px 14px", textAlign: "left", border: "none", cursor: "pointer",
                    background: ativo ? "var(--brand-50, #eff6ff)" : "transparent",
                    borderLeft: ativo ? "3px solid var(--brand)" : "3px solid transparent",
                    transition: "background .1s",
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                    overflow: "hidden", background: "var(--brand)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 700,
                  }}>
                    {fotoUrl
                      ? <img src={fotoUrl} alt={nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : iniciais(c.seller?.nome || "?")}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                      <span style={{ fontWeight: c.naoLidas > 0 ? 700 : 500, fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
                      {c.ultima && <span className="vx-mono" style={{ fontSize: 10.5, color: "var(--muted)", flexShrink: 0 }}>{dataCurta(c.ultima.ts)}</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.ultima?.de === "empresa" ? "Você: " : ""}{c.ultima?.texto || ""}
                      </span>
                      {c.naoLidas > 0 && (
                        <span style={{ background: "var(--brand)", color: "#fff", borderRadius: 20, fontSize: 10, padding: "1px 6px", fontWeight: 700, flexShrink: 0 }}>{c.naoLidas}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Área do chat */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {selConv ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="vx-card" style={{ padding: "12px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                {selConv.seller?.foto
                  ? <img src={selConv.seller.foto} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                  : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>{iniciais(selConv.seller?.nome || "?")}</div>}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{capitalizar(selConv.seller?.nome || "Profissional")}</div>
                  <div className="vx-mut" style={{ fontSize: 12 }}>{selConv.total} mensagem(ns)</div>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <Chat empresa={emp} sellerId={selConv.sellerId} db={db} up={up} de="empresa" />
              </div>
            </div>
          ) : (
            <div className="vx-card" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "var(--muted)" }}>
              <MessageSquare size={36} />
              <p style={{ margin: 0, fontSize: 14 }}>Selecione uma conversa à esquerda</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

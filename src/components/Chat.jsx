import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { api } from "../lib/api.js";
import { uid, agora, dataCurta } from "../lib/utils.js";

export default function Chat({ empresa, sellerId, db, up, de }) {
  const [txt, setTxt] = useState("");
  const fim = useRef(null);
  const msgs = db.messages.filter((m) => m.companyId === empresa.id && m.sellerId === sellerId);
  useEffect(() => { fim.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);

  // vendedor abre o chat → marca mensagens da empresa como lidas
  useEffect(() => {
    if (de !== "vendedor") return;
    api("/messages/ler", { companyId: empresa.id, sellerId });
    up((d) => ({
      messages: d.messages.map((m) =>
        m.companyId === empresa.id && m.sellerId === sellerId && m.de === "empresa" ? { ...m, lida: 1 } : m
      ),
    }));
  }, [empresa.id, sellerId, de]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = () => {
    if (!txt.trim()) return;
    api("/messages", { companyId: empresa.id, sellerId, de, texto: txt.trim() });
    up((d) => ({ messages: [...d.messages, { id: uid(), companyId: empresa.id, sellerId, de, texto: txt.trim(), ts: agora() }] }));
    setTxt("");
  };

  return (
    <div className="vx-card" style={{ padding: 16 }}>
      <div style={{ minHeight: 200, maxHeight: 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {!msgs.length && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "24px 0" }}>
            <p className="vx-mut" style={{ fontSize: 13, textAlign: "center", margin: 0 }}>Sem mensagens ainda.</p>
            <p className="vx-mut" style={{ fontSize: 12, textAlign: "center", margin: 0 }}>Combine aqui script, horário e dúvidas de produto.</p>
          </div>
        )}
        {msgs.map((m) => {
          const meu = m.de === de;
          let card = null;
          try { if (m.anexo) card = JSON.parse(m.anexo); } catch { /* */ }
          return (
            <div key={m.id} style={{ alignSelf: meu ? "flex-end" : "flex-start", maxWidth: "88%" }}>
              {card?.tipo === "lead_card" ? (
                <div style={{
                  background: meu ? "var(--brand)" : "var(--surface-2)", color: meu ? "#fff" : "var(--ink)",
                  borderRadius: 12, overflow: "hidden", fontSize: 13,
                }}>
                  <div style={{ padding: "10px 13px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", opacity: 0.65, marginBottom: 5, textTransform: "uppercase" }}>📋 Lead compartilhado</div>
                    {card.tipo_acao && <div style={{ fontWeight: 600, marginBottom: 2 }}>{card.tipo_acao}</div>}
                    {card.campanha  && <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 2 }}>📢 {card.campanha}</div>}
                    {card.data      && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>🗓 {card.data}</div>}
                    <div style={{ borderTop: `1px solid ${meu ? "rgba(255,255,255,.25)" : "var(--border)"}`, paddingTop: 7, marginTop: 2, display: "flex", flexDirection: "column", gap: 3 }}>
                      {card.contato     && <div style={{ fontSize: 12 }}>👤 {card.contato}</div>}
                      {card.empresa_lead && <div style={{ fontSize: 12 }}>🏢 {card.empresa_lead}</div>}
                      {card.telefone    && <div style={{ fontSize: 12 }}>📞 {card.telefone}</div>}
                      {card.endereco    && <div style={{ fontSize: 12 }}>📍 {card.endereco}</div>}
                      {card.resultado   && <div style={{ fontSize: 12 }}>✅ {card.resultado}</div>}
                    </div>
                    {card.texto_extra && <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, fontStyle: "italic" }}>{card.texto_extra}</div>}
                  </div>
                  {de === "vendedor" && (
                    <button
                      onClick={() => { window.history.pushState({}, "", "/plataforma"); window.dispatchEvent(new PopStateEvent("popstate")); }}
                      style={{
                        display: "block", width: "100%", padding: "9px 13px",
                        background: meu ? "rgba(255,255,255,.18)" : "rgba(37,99,235,.08)",
                        border: "none", borderTop: `1px solid ${meu ? "rgba(255,255,255,.2)" : "var(--border)"}`,
                        color: meu ? "#fff" : "var(--brand)", fontSize: 12.5, fontWeight: 600,
                        cursor: "pointer", textAlign: "center", fontFamily: "inherit",
                      }}
                    >Ver tarefa →</button>
                  )}
                </div>
              ) : (
                <div style={{
                  background: meu ? "var(--brand)" : "var(--surface-2)", color: meu ? "#fff" : "var(--ink)",
                  padding: "9px 12px", borderRadius: 12, fontSize: 13.5,
                }}>{m.texto}</div>
              )}
              <div className="vx-mut vx-mono" style={{ fontSize: 10.5, marginTop: 3, textAlign: meu ? "right" : "left" }}>
                {m.de === "empresa" ? empresa.nome : "vendedor"} · {dataCurta(m.ts)}
              </div>
            </div>
          );
        })}
        <div ref={fim} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input className="vx-input" value={txt} onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") enviar(); }} placeholder="Escreva uma mensagem" />
        <button className="vx-btn vx-btn-primary" onClick={enviar}><Send size={15} /></button>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { api } from "../lib/api.js";
import { uid, agora, dataCurta } from "../lib/utils.js";

export default function Chat({ empresa, sellerId, db, up, de }) {
  const [txt, setTxt] = useState("");
  const fim = useRef(null);
  const msgs = db.messages.filter((m) => m.companyId === empresa.id && m.sellerId === sellerId);
  useEffect(() => { fim.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);

  const enviar = () => {
    if (!txt.trim()) return;
    api("/messages", { companyId: empresa.id, sellerId, de, texto: txt.trim() });
    up((d) => ({ messages: [...d.messages, { id: uid(), companyId: empresa.id, sellerId, de, texto: txt.trim(), ts: agora() }] }));
    setTxt("");
  };

  return (
    <div className="vx-card" style={{ padding: 16 }}>
      <div style={{ maxHeight: 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {!msgs.length && <p className="vx-mut" style={{ fontSize: 13, textAlign: "center" }}>Sem mensagens. Combine aqui script, horário e dúvidas de produto.</p>}
        {msgs.map((m) => {
          const meu = m.de === de;
          return (
            <div key={m.id} style={{ alignSelf: meu ? "flex-end" : "flex-start", maxWidth: "82%" }}>
              <div style={{
                background: meu ? "var(--brand)" : "var(--surface-2)", color: meu ? "#fff" : "var(--ink)",
                padding: "9px 12px", borderRadius: 12, fontSize: 13.5,
              }}>{m.texto}</div>
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

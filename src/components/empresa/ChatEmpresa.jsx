import { useState } from "react";
import { Vazio } from "../ui.jsx";
import Chat from "../Chat.jsx";
import { api } from "../../lib/api.js";
import { useI18n } from "../../lib/i18n.jsx";

export default function ChatEmpresa({ emp, db, up }) {
  const { t } = useI18n();
  const time = db.sellers.filter((s) => {
    const st = s.aplicacoes?.[emp.id];
    return st === "aprovado" || st === "parcial";
  });
  const [sel, setSel] = useState(time[0]?.id || null);

  const abrirConversa = (sellerId) => {
    setSel(sellerId);
    api("/messages/ler", { companyId: emp.id, sellerId });
    up((d) => ({
      messages: d.messages.map((m) =>
        m.companyId === emp.id && m.sellerId === sellerId && m.de === "vendedor" ? { ...m, lida: 1 } : m
      ),
    }));
  };

  if (!time.length) return <Vazio titulo={t("chat.noConversations")} texto={t("chat.noConversationsDesc")} />;
  return (
    <>
      <div className="vx-tabs" style={{ marginBottom: 14 }}>
        {time.map((s) => (
          <button key={s.id} className="vx-tab" data-on={sel === s.id ? "1" : "0"} onClick={() => abrirConversa(s.id)}>{s.nome}</button>
        ))}
      </div>
      {sel && <Chat empresa={emp} sellerId={sel} db={db} up={up} de="empresa" />}
    </>
  );
}

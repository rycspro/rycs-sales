// WhatsApp da própria RYCS (Cloud API): guarda as mensagens recebidas e os
// status de entrega que a Meta envia pelo mesmo webhook de /api/webhooks/meta.
// Por enquanto só armazena — sem tela, sem aviso e sem resposta automática.

import db, { uid, agora } from "../db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
    id TEXT PRIMARY KEY,
    wamid TEXT NOT NULL UNIQUE,
    wabaId TEXT DEFAULT '',
    phoneNumberId TEXT DEFAULT '',
    de TEXT NOT NULL,
    nome TEXT DEFAULT '',
    tipo TEXT NOT NULL,
    texto TEXT DEFAULT '',
    respondendoA TEXT DEFAULT '',
    dados TEXT NOT NULL,
    enviadoEm INTEGER,
    recebidoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_de ON whatsapp_mensagens(de, enviadoEm);

  CREATE TABLE IF NOT EXISTS whatsapp_status (
    id TEXT PRIMARY KEY,
    wamid TEXT NOT NULL,
    status TEXT NOT NULL,
    wabaId TEXT DEFAULT '',
    phoneNumberId TEXT DEFAULT '',
    destinatario TEXT DEFAULT '',
    erro TEXT DEFAULT '',
    dados TEXT NOT NULL,
    ocorreuEm INTEGER,
    recebidoEm INTEGER NOT NULL,
    UNIQUE (wamid, status)
  );
`);

function textoDa(m) {
  switch (m.type) {
    case "text": return m.text?.body || "";
    case "button": return m.button?.text || "";
    case "interactive": return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "";
    case "image": case "video": case "document": return m[m.type]?.caption || m.document?.filename || "";
    case "reaction": return m.reaction?.emoji || "";
    case "location": return [m.location?.name, m.location?.address].filter(Boolean).join(" — ") || `${m.location?.latitude},${m.location?.longitude}`;
    default: return "";
  }
}

const emMs = (t) => (Number(t) > 0 ? Number(t) * 1000 : null);
const inserirMensagem = db.prepare(`INSERT OR IGNORE INTO whatsapp_mensagens
  (id, wamid, wabaId, phoneNumberId, de, nome, tipo, texto, respondendoA, dados, enviadoEm, recebidoEm)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const inserirStatus = db.prepare(`INSERT OR IGNORE INTO whatsapp_status
  (id, wamid, status, wabaId, phoneNumberId, destinatario, erro, dados, ocorreuEm, recebidoEm)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

// Idempotente: a Meta reenvia avisos; o mesmo wamid (e o mesmo status) entra uma vez só.
export function guardarAvisoWhatsapp(corpo) {
  const total = { mensagens: 0, status: 0 };
  if (corpo?.object !== "whatsapp_business_account") return total;
  const ts = agora();
  const msg = inserirMensagem;
  const sts = inserirStatus;
  db.transaction(() => {
    for (const entrada of corpo.entry || []) {
      const wabaId = String(entrada.id || "");
      for (const mudanca of entrada.changes || []) {
        if (mudanca.field !== "messages") continue;
        const v = mudanca.value || {};
        const phoneNumberId = String(v.metadata?.phone_number_id || "");
        const nomes = Object.fromEntries((v.contacts || []).map((c) => [String(c.wa_id), c.profile?.name || ""]));
        for (const m of v.messages || []) {
          if (!m?.id || !m.from) continue;
          total.mensagens += msg.run(uid(), String(m.id), wabaId, phoneNumberId, String(m.from), nomes[m.from] || "",
            String(m.type || "desconhecido"), textoDa(m), String(m.context?.id || ""), JSON.stringify(m), emMs(m.timestamp), ts).changes;
        }
        for (const s of v.statuses || []) {
          if (!s?.id || !s.status) continue;
          const erro = (s.errors || []).map((e) => [e.code, e.title || e.message].filter(Boolean).join(" ")).join("; ");
          total.status += sts.run(uid(), String(s.id), String(s.status), wabaId, phoneNumberId, String(s.recipient_id || ""),
            erro, JSON.stringify(s), emMs(s.timestamp), ts).changes;
        }
      }
    }
  })();
  return total;
}

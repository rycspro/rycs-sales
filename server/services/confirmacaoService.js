import db, { uid, agora } from "../db.js";
import { envioConfigurado, enviarTexto as enviarWhatsapp, numeroWhatsapp } from "./whatsappDisparo.js";
import { sendEmail, urlApp } from "./email.js";

const LIMITE_REENVIOS = 3;
const JANELA_REENVIO_MS = 24 * 60 * 60 * 1000;

function garantirTabela() {
  db.exec(`CREATE TABLE IF NOT EXISTS confirmacao_envios (
    id TEXT PRIMARY KEY,
    leadId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    canal TEXT NOT NULL,
    token TEXT NOT NULL,
    status TEXT DEFAULT 'enviado',
    criadoEm INTEGER NOT NULL,
    erro TEXT
  )`);
}
garantirTabela();

function contarEnviosRecentes(leadId, campaignId) {
  const desde = agora() - JANELA_REENVIO_MS;
  return db.prepare(
    "SELECT COUNT(*) n FROM confirmacao_envios WHERE leadId = ? AND campaignId = ? AND criadoEm > ?"
  ).get(leadId, campaignId, desde).n;
}

function registrarEnvio({ leadId, campaignId, canal, token, status, erro }) {
  db.prepare(
    "INSERT INTO confirmacao_envios (id, leadId, campaignId, canal, token, status, criadoEm, erro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(uid(), leadId, campaignId, canal, token, status, agora(), erro || null);
}

function emailConfirmacaoContato({ nome, linkConfirmacao, campanhaNome }) {
  const APP_URL = urlApp();
  const LOGO_URL = `${APP_URL}/logo-rycs.png`;
  const nomeSafe = String(nome || "").replace(/[<>&"']/g, "").trim().substring(0, 100);
  const campSafe = String(campanhaNome || "").replace(/[<>&"']/g, "").trim().substring(0, 200);
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2937">
      <div style="background:#ffffff;padding:22px 24px 18px;border-bottom:3px solid #2563eb;border-radius:12px 12px 0 0;text-align:center">
        <img src="${LOGO_URL}" alt="RYCS Sales Machine" width="150" style="width:150px;max-width:70%;height:auto;display:inline-block" />
      </div>
      <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 12px;font-size:19px">Confirme seu contato</h2>
        <p style="color:#4b5563;line-height:1.6">Olá, ${nomeSafe}.</p>
        <p style="color:#4b5563;line-height:1.6">Você foi indicado como contato na campanha <b>${campSafe}</b>. Por favor, confirme clicando no botão abaixo.</p>
        <div style="text-align:center;margin:24px 0 18px">
          <a href="${linkConfirmacao}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Confirmar meu contato</a>
        </div>
        <p style="color:#9ca3af;font-size:12px;margin:0">Este link expira em 48 horas. Se você não reconhece esta solicitação, pode ignorá-la com segurança.</p>
        <p style="color:#6b7280;font-size:13px;margin:12px 0 0">Equipe RYCS Sales Machine</p>
      </div>
    </div>`;
}

export async function enviarConfirmacao({ leadId, campaignId, canal, token, lead, campanhaNome }) {
  const APP_URL = urlApp();
  const linkConfirmacao = `${APP_URL}/confirmar/${token}`;
  const nome = (lead.nome || "").trim();

  const enviados = contarEnviosRecentes(leadId, campaignId);
  if (enviados >= LIMITE_REENVIOS) {
    return { enviado: false, motivo: "limite_reenvio", limite: LIMITE_REENVIOS, janela: "24h" };
  }

  if (canal === "whatsapp") {
    if (!envioConfigurado()) {
      registrarEnvio({ leadId, campaignId, canal, token, status: "erro", erro: "whatsapp_nao_configurado" });
      return { enviado: false, motivo: "whatsapp_nao_configurado" };
    }
    const numero = numeroWhatsapp(lead.whatsapp || lead.telefone);
    if (!numero) {
      registrarEnvio({ leadId, campaignId, canal, token, status: "erro", erro: "numero_invalido" });
      return { enviado: false, motivo: "numero_invalido" };
    }
    try {
      const texto = `Olá, ${nome}! Você foi indicado como contato na campanha "${campanhaNome || ""}". Confirme seu contato acessando: ${linkConfirmacao}\n\nEste link expira em 48h.`;
      await enviarWhatsapp({ numero, texto, origem: "confirmacao_contato" });
      registrarEnvio({ leadId, campaignId, canal, token, status: "enviado" });
      return { enviado: true, canal: "whatsapp" };
    } catch (err) {
      registrarEnvio({ leadId, campaignId, canal, token, status: "erro", erro: err.message });
      return { enviado: false, motivo: "erro_envio", detalhe: err.message };
    }
  }

  if (canal === "email") {
    const email = lead.email;
    if (!email) {
      registrarEnvio({ leadId, campaignId, canal, token, status: "erro", erro: "sem_email" });
      return { enviado: false, motivo: "sem_email" };
    }
    try {
      const html = emailConfirmacaoContato({ nome, linkConfirmacao, campanhaNome });
      const result = await sendEmail(email, "Confirme seu contato — RYCS", html);
      registrarEnvio({ leadId, campaignId, canal, token, status: result.ok ? "enviado" : "erro", erro: result.ok ? null : "falha_resend" });
      return { enviado: result.ok, canal: "email" };
    } catch (err) {
      registrarEnvio({ leadId, campaignId, canal, token, status: "erro", erro: err.message });
      return { enviado: false, motivo: "erro_envio", detalhe: err.message };
    }
  }

  if (canal === "sms") {
    registrarEnvio({ leadId, campaignId, canal, token, status: "erro", erro: "provider_nao_configurado" });
    return { enviado: false, motivo: "provider_nao_configurado" };
  }

  return { enviado: false, motivo: "canal_invalido" };
}

export function verificarLimiteReenvio(leadId, campaignId) {
  const enviados = contarEnviosRecentes(leadId, campaignId);
  return { podeReenviar: enviados < LIMITE_REENVIOS, enviosRestantes: Math.max(0, LIMITE_REENVIOS - enviados), janela: "24h" };
}

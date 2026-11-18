// Métricas dos e-mails (entrega, abertura, clique, devolução, spam, descadastro).
//
// O Resend avisa cada evento por webhook (assinado pelo Svix). Guardamos o
// evento bruto e marcamos o envio da sequência correspondente (pelo resendId).
// Para o que já tinha sido enviado antes do webhook existir, há uma
// sincronização que pergunta ao Resend o último evento de cada e-mail.
//
// Abertura e clique só existem se o rastreamento estiver ligado no domínio,
// no painel do Resend. Abertura é aproximada: clientes de e-mail que
// pré-carregam imagens (Apple Mail) contam como aberto.

import db from "../db.js";
import "./sequenciasEmail.js"; // cria email_sequencia_envios antes das colunas novas

db.exec(`
  CREATE TABLE IF NOT EXISTS email_eventos (
    id TEXT PRIMARY KEY,
    resendId TEXT,
    tipo TEXT NOT NULL,
    email TEXT,
    link TEXT,
    em INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_email_eventos_resend ON email_eventos (resendId);
`);

// Colunas novas no envio da sequência (aditivas; nada é apagado).
const COLUNAS = {
  entregueEm: "INTEGER", abertoEm: "INTEGER", aberturas: "INTEGER DEFAULT 0",
  clicadoEm: "INTEGER", cliques: "INTEGER DEFAULT 0", devolvidoEm: "INTEGER",
  devolucaoTipo: "TEXT DEFAULT ''", spamEm: "INTEGER", atrasadoEm: "INTEGER",
};
const existentes = new Set(db.prepare("PRAGMA table_info(email_sequencia_envios)").all().map((c) => c.name));
for (const [nome, def] of Object.entries(COLUNAS)) {
  if (!existentes.has(nome)) db.exec(`ALTER TABLE email_sequencia_envios ADD COLUMN ${nome} ${def}`);
}

export { assinaturaResendValida } from "./assinaturaResend.js";

// ─── Registro de eventos ───────────────────────────────────────────────────
const TIPOS = {
  "email.delivered": "entregue",
  "email.opened": "aberto",
  "email.clicked": "clicado",
  "email.bounced": "devolvido",
  "email.complained": "spam",
  "email.delivery_delayed": "atrasado",
  "email.sent": "enviado",
  "email.failed": "falhou",
};

function marcar(resendId, tipo, em, extra = {}) {
  const U = (sql, ...p) => db.prepare(`UPDATE email_sequencia_envios SET ${sql} WHERE resendId = ?`).run(...p, resendId);
  if (tipo === "entregue") U("entregueEm = COALESCE(entregueEm, ?)", em);
  else if (tipo === "aberto") U("abertoEm = COALESCE(abertoEm, ?), aberturas = COALESCE(aberturas, 0) + 1, entregueEm = COALESCE(entregueEm, ?)", em, em);
  else if (tipo === "clicado") U(`clicadoEm = COALESCE(clicadoEm, ?), cliques = COALESCE(cliques, 0) + 1,
      abertoEm = COALESCE(abertoEm, ?), entregueEm = COALESCE(entregueEm, ?)`, em, em, em);
  else if (tipo === "devolvido") U("devolvidoEm = COALESCE(devolvidoEm, ?), devolucaoTipo = ?", em, String(extra.devolucaoTipo || "").slice(0, 40));
  else if (tipo === "spam") U("spamEm = COALESCE(spamEm, ?)", em);
  else if (tipo === "atrasado") U("atrasadoEm = COALESCE(atrasadoEm, ?)", em);
}

// Evento do webhook. `id` é o svix-id: o Svix reentrega, então ignora repetido.
export function registrarEventoResend(id, evento) {
  const tipo = TIPOS[evento?.type];
  const resendId = evento?.data?.email_id;
  if (!tipo || !resendId) return "ignorado";
  const em = Date.parse(evento.created_at || evento.data?.created_at) || Date.now();
  const novo = db.prepare("INSERT OR IGNORE INTO email_eventos (id, resendId, tipo, email, link, em) VALUES (?, ?, ?, ?, ?, ?)")
    .run(String(id), resendId, tipo, String(evento.data?.to?.[0] || "").toLowerCase(), String(evento.data?.click?.link || "").slice(0, 500), em);
  if (novo.changes === 0) return "duplicado";
  marcar(resendId, tipo, em, { devolucaoTipo: evento.data?.bounce?.type });
  return tipo;
}

// ─── Sincronização (e-mails enviados antes do webhook) ─────────────────────
const ULTIMO_EVENTO = { delivered: "entregue", opened: "aberto", clicked: "clicado", bounced: "devolvido", complained: "spam", delivery_delayed: "atrasado" };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export async function sincronizarStatusResend({ limite = 300 } = {}) {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return { erro: "Resend não configurado." };
  const pendentes = db.prepare(`SELECT resendId FROM email_sequencia_envios
    WHERE status = 'enviado' AND resendId IS NOT NULL AND clicadoEm IS NULL AND devolvidoEm IS NULL AND spamEm IS NULL
    ORDER BY enviadoEm DESC LIMIT ?`).all(limite);
  let atualizados = 0, falhas = 0;
  for (const { resendId } of pendentes) {
    await esperar(550); // limite de requisições por segundo do Resend
    try {
      const r = await fetch(`https://api.resend.com/emails/${resendId}`, { headers: { Authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) { falhas++; continue; }
      const d = await r.json();
      const tipo = ULTIMO_EVENTO[d?.last_event];
      if (!tipo) continue;
      // Só marca a data se ainda não tiver (o webhook é mais preciso).
      const em = Date.parse(d.created_at) || Date.now();
      const linha = db.prepare("SELECT entregueEm, abertoEm, clicadoEm FROM email_sequencia_envios WHERE resendId = ?").get(resendId);
      if (tipo === "aberto" && linha?.abertoEm) continue;
      if (tipo === "entregue" && linha?.entregueEm) continue;
      marcar(resendId, tipo, em);
      atualizados++;
    } catch { falhas++; }
  }
  return { verificados: pendentes.length, atualizados, falhas };
}

// ─── Métricas ──────────────────────────────────────────────────────────────
const taxa = (parte, todo) => (todo > 0 ? Math.round((parte / todo) * 1000) / 10 : null);

// Por passo da sequência (chave sem o "@episódio") e no total.
export function metricasSequencias() {
  const linhas = db.prepare(`SELECT CASE WHEN instr(chave, '@') > 0 THEN substr(chave, 1, instr(chave, '@') - 1) ELSE chave END AS passo,
      email, status, enviadoEm, entregueEm, abertoEm, aberturas, clicadoEm, cliques, devolvidoEm, spamEm, atrasadoEm
    FROM email_sequencia_envios`).all();

  // Descadastro: atribuído ao último e-mail da sequência recebido antes dele.
  const ultimoPorEmail = new Map();
  for (const d of db.prepare("SELECT email, em FROM email_descadastros").all()) {
    let melhor = null;
    for (const l of linhas) if (l.status === "enviado" && l.email === d.email && l.enviadoEm <= d.em && (!melhor || l.enviadoEm > melhor.enviadoEm)) melhor = l;
    if (melhor) ultimoPorEmail.set(d.email, melhor.passo);
  }

  const vazio = () => ({ enviados: 0, falhas: 0, entregues: 0, abertos: 0, aberturas: 0, clicados: 0, cliques: 0, devolvidos: 0, spam: 0, atrasados: 0, descadastros: 0 });
  const por = {};
  const total = vazio();
  for (const l of linhas) {
    const m = (por[l.passo] = por[l.passo] || vazio());
    for (const alvo of [m, total]) {
      if (l.status !== "enviado") { if (l.status === "falhou") alvo.falhas++; continue; }
      alvo.enviados++;
      if (l.entregueEm) alvo.entregues++;
      if (l.abertoEm) alvo.abertos++;
      alvo.aberturas += l.aberturas || 0;
      if (l.clicadoEm) alvo.clicados++;
      alvo.cliques += l.cliques || 0;
      if (l.devolvidoEm) alvo.devolvidos++;
      if (l.spamEm) alvo.spam++;
      if (l.atrasadoEm) alvo.atrasados++;
    }
  }
  for (const passo of ultimoPorEmail.values()) { (por[passo] = por[passo] || vazio()).descadastros++; total.descadastros++; }

  const comTaxas = (m) => ({
    ...m,
    taxaEntrega: taxa(m.entregues, m.enviados),
    taxaAbertura: taxa(m.abertos, m.entregues || m.enviados),
    taxaClique: taxa(m.clicados, m.entregues || m.enviados),
    taxaCliqueSobreAbertura: taxa(m.clicados, m.abertos),
    taxaDevolucao: taxa(m.devolvidos, m.enviados),
    taxaSpam: taxa(m.spam, m.enviados),
    taxaDescadastro: taxa(m.descadastros, m.enviados),
  });
  const passos = {};
  for (const [k, m] of Object.entries(por)) passos[k] = comTaxas(m);

  const eventos = db.prepare("SELECT COUNT(*) AS n, MAX(em) AS ultimo FROM email_eventos").get();
  return {
    total: comTaxas(total),
    passos,
    webhookConfigurado: !!process.env.RESEND_WEBHOOK_SECRET,
    eventosRecebidos: eventos.n,
    ultimoEvento: eventos.ultimo || null,
    linksMaisClicados: db.prepare(`SELECT link, COUNT(*) AS cliques FROM email_eventos WHERE tipo = 'clicado' AND link != ''
      GROUP BY link ORDER BY cliques DESC LIMIT 10`).all(),
  };
}

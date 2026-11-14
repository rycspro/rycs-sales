// Webhooks de entrada: sistemas externos (sites, formulários, automações)
// enviam um POST com os dados de um contato e a RYCS cria o lead e entrega a
// um profissional aprovado — o mesmo destino dos leads da Meta.
//
// Decisão de arquitetura: este serviço é autocontido para NÃO tocar na
// integração da Meta (services/meta.js). Ele reaproveita o mesmo modelo de
// distribuição (profissional aprovado com menos leads → dedupe → leads +
// lead_events → notificação), gravando origem = 'webhook'.

import { randomBytes, timingSafeEqual } from "crypto";
import db, { uid, agora } from "../db.js";
import { notificar } from "../routes/notifications.js";

// ── Schema (aditivo, idempotente) ───────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS webhook_config (
    companyId TEXT PRIMARY KEY,
    secret TEXT NOT NULL,
    modo TEXT NOT NULL DEFAULT 'auto',   -- auto = distribui direto
    ativo INTEGER NOT NULL DEFAULT 1,
    total INTEGER NOT NULL DEFAULT 0,
    ultimoRecebidoEm INTEGER,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_webhook_secret ON webhook_config(secret);
`);

const novoSecret = () => "whk_" + randomBytes(24).toString("hex");

export function baseUrl() {
  return (process.env.PUBLIC_URL || process.env.FRONTEND_URL || "https://app.rycs.pro").replace(/\/+$/, "");
}

export function configDe(companyId) {
  return db.prepare("SELECT * FROM webhook_config WHERE companyId = ?").get(companyId) || null;
}

// Cria (ou retorna) a configuração da empresa. É a "ativação" do webhook.
export function ativar(companyId) {
  const existente = configDe(companyId);
  if (existente) {
    if (!existente.ativo) db.prepare("UPDATE webhook_config SET ativo = 1, atualizadoEm = ? WHERE companyId = ?").run(agora(), companyId);
    return configDe(companyId);
  }
  const ts = agora();
  db.prepare(`INSERT INTO webhook_config (companyId, secret, modo, ativo, total, criadoEm, atualizadoEm)
    VALUES (?, ?, 'auto', 1, 0, ?, ?)`).run(companyId, novoSecret(), ts, ts);
  return configDe(companyId);
}

export function rotacionarSecret(companyId) {
  if (!configDe(companyId)) return ativar(companyId);
  db.prepare("UPDATE webhook_config SET secret = ?, atualizadoEm = ? WHERE companyId = ?").run(novoSecret(), agora(), companyId);
  return configDe(companyId);
}

export function definirAtivo(companyId, ativo) {
  ativar(companyId);
  db.prepare("UPDATE webhook_config SET ativo = ?, atualizadoEm = ? WHERE companyId = ?").run(ativo ? 1 : 0, agora(), companyId);
  return configDe(companyId);
}

// Resumo seguro para a tela (não expõe nada além do necessário).
export function resumoConfig(companyId) {
  const c = configDe(companyId);
  if (!c) return { ativado: false };
  return {
    ativado: true,
    ativo: !!c.ativo,
    url: `${baseUrl()}/api/webhooks/in/${c.secret}`,
    secret: c.secret,
    modo: c.modo,
    total: c.total,
    ultimoRecebidoEm: c.ultimoRecebidoEm || null,
  };
}

function porSecret(secret) {
  if (!secret) return null;
  // Comparação em tempo constante contra cada segredo ativo.
  const alvo = Buffer.from(String(secret));
  for (const c of db.prepare("SELECT * FROM webhook_config WHERE ativo = 1").all()) {
    const atual = Buffer.from(c.secret);
    if (atual.length === alvo.length && timingSafeEqual(atual, alvo)) return c;
  }
  return null;
}

// ── Mapeamento flexível do payload recebido ─────────────────────────────────
const NOMES = ["nome", "name", "full_name", "fullname", "nome_completo"];
const EMAILS = ["email", "e-mail", "e_mail", "mail"];
const TELS = ["telefone", "phone", "phone_number", "whatsapp", "celular", "tel", "fone"];
const EMPRESAS = ["empresa", "company", "company_name", "organizacao", "organização"];
const CARGOS = ["cargo", "job_title", "jobtitle", "position", "funcao", "função"];

function mapear(corpo = {}) {
  // Aceita tanto { nome, email } quanto { data: {...} } ou { fields: {...} }.
  const raiz = (corpo && typeof corpo === "object" && !Array.isArray(corpo)) ? corpo : {};
  const fonte = { ...(raiz.data && typeof raiz.data === "object" ? raiz.data : {}),
                  ...(raiz.fields && typeof raiz.fields === "object" ? raiz.fields : {}),
                  ...raiz };
  const plano = {};
  for (const [k, v] of Object.entries(fonte)) {
    if (v == null || typeof v === "object") continue;
    plano[String(k).toLowerCase().trim()] = String(v);
  }
  const pega = (...k) => k.map((x) => plano[x]).find((x) => x && x.trim()) || "";
  let nome = pega(...NOMES);
  if (!nome) nome = [pega("first_name", "primeiro_nome"), pega("last_name", "sobrenome")].filter(Boolean).join(" ");
  return {
    nome: nome.trim(),
    email: pega(...EMAILS).trim().toLowerCase(),
    telefone: pega(...TELS).replace(/\D/g, ""),
    empresa: pega(...EMPRESAS).trim(),
    cargo: pega(...CARGOS).trim(),
    respostas: plano,
  };
}

// Profissional aprovado com menos leads de webhook nas últimas 24h (round-robin).
function escolherProfissional(companyId) {
  const desde = agora() - 24 * 3600 * 1000;
  return db.prepare(`SELECT a.sellerId,
      (SELECT COUNT(*) FROM leads l WHERE l.sellerId = a.sellerId AND l.companyId = a.companyId AND l.origem = 'webhook' AND l.criadoEm > ?) AS n
    FROM applications a WHERE a.companyId = ? AND a.status = 'aprovado'
    ORDER BY n ASC, RANDOM() LIMIT 1`).get(desde, companyId)?.sellerId || null;
}

// ── Recebimento: cria e distribui o lead ────────────────────────────────────
// Retorna { ok, status } — status: criado | duplicado | sem_profissional.
export function receber(secret, corpo, { ip } = {}) {
  const cfg = porSecret(secret);
  if (!cfg) return { ok: false, status: 401 };

  const p = mapear(corpo);
  if (!p.nome && !p.email && !p.telefone) return { ok: false, status: 422, erro: "Payload sem nome, e-mail ou telefone." };

  const ts = agora();
  db.prepare("UPDATE webhook_config SET total = total + 1, ultimoRecebidoEm = ? WHERE companyId = ?").run(ts, cfg.companyId);

  // Mesma pessoa já existe: avisa quem cuida dela, sem criar lead novo.
  const existente = (p.email || p.telefone) && db.prepare(`SELECT id, sellerId FROM leads WHERE companyId = ?
      AND ((? != '' AND lower(email) = ?) OR (? != '' AND replace(replace(replace(replace(telefone,' ',''),'-',''),'(',''),')','') LIKE '%' || ?))
      ORDER BY criadoEm DESC LIMIT 1`).get(cfg.companyId, p.email, p.email, p.telefone, p.telefone.slice(-10));
  if (existente) {
    db.prepare(`INSERT INTO lead_events (id, leadId, sellerId, tipo, observacao, criadoEm) VALUES (?, ?, ?, 'nota', ?, ?)`)
      .run(uid(), existente.id, existente.sellerId, "Enviou um novo contato por webhook.", ts);
    const vend = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(existente.sellerId);
    if (vend) notificar(vend.id, "lead", "Lead voltou pelo webhook", `${p.nome || "Um lead"} enviou um novo contato. Aproveite o interesse.`);
    return { ok: true, status: "duplicado" };
  }

  const sellerId = escolherProfissional(cfg.companyId);
  if (!sellerId) {
    const u = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(cfg.companyId);
    if (u) notificar(u.id, "lead", "Lead do webhook aguardando profissional", `${p.nome || "Um lead"} chegou por webhook, mas ainda não há profissional aprovado. Ele será entregue assim que houver.`);
    return { ok: true, status: "sem_profissional" };
  }

  const leadId = uid();
  db.transaction(() => {
    db.prepare(`INSERT INTO leads (id, sellerId, companyId, campaignId, nome, empresa, cargo, telefone, email, origem, etapa, valorEstimado, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 'webhook', 'novo', 0, ?, ?)`)
      .run(leadId, sellerId, cfg.companyId, p.nome || "Lead por webhook", p.empresa, p.cargo, p.telefone, p.email, ts, ts);
    const fonte = p.respostas.origem || p.respostas.source || p.respostas.fonte || "";
    db.prepare(`INSERT INTO lead_events (id, leadId, sellerId, tipo, observacao, criadoEm) VALUES (?, ?, ?, 'nota', ?, ?)`)
      .run(uid(), leadId, sellerId, `Lead recebido por webhook.${fonte ? ` Origem: ${String(fonte).slice(0, 80)}.` : ""}`, ts);
  })();

  const vend = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sellerId);
  if (vend) notificar(vend.id, "lead", "Novo lead por webhook", `${p.nome || "Um novo lead"} acabou de chegar por integração. Faça o primeiro contato agora.`);
  return { ok: true, status: "criado" };
}

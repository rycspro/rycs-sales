// Motor das sequências automáticas de e-mail (ver shared/sequenciasEmail.js).
//
// A cada 15 minutos: decide, para cada profissional e empresa, se cabe um
// e-mail agora; respeita 1 por pessoa a cada 20h, a janela de horário, o teto
// diário de aquecimento do domínio e o descadastro. Também inativa (de forma
// reversível) quem recebeu o aviso e não completou o perfil em 3 dias.
import { createHmac, timingSafeEqual } from "crypto";
import db, { uid } from "../db.js";
import { sendEmail, layoutSequencia, urlApp } from "./email.js";
import { notificar } from "../routes/notifications.js";
import { codigoDoUsuario, qualificarIndicacaoProfissional } from "./indicacoes.js";
import { planoAtual } from "./planosProfissional.js";
import { pendenciasPerfil } from "../../shared/perfilVendedor.js";
import {
  DIA, INTERVALO_MIN_POR_PESSOA, DIAS_PARA_INATIVAR, ORDEM_SEQUENCIAS, SEQUENCIAS,
  tetoDoDia, dentroDaJanela, idiomaDoPais, proximoEmailVendedor, proximoEmailEmpresa, montarTexto,
} from "../../shared/sequenciasEmail.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS email_sequencia_envios (
    id TEXT PRIMARY KEY,
    chave TEXT NOT NULL,
    sequencia TEXT NOT NULL,
    destinatarioTipo TEXT NOT NULL,
    destinatarioId TEXT NOT NULL,
    email TEXT NOT NULL,
    idioma TEXT DEFAULT 'pt',
    assunto TEXT DEFAULT '',
    status TEXT NOT NULL,
    resendId TEXT,
    erro TEXT,
    enviadoEm INTEGER NOT NULL,
    UNIQUE (destinatarioTipo, destinatarioId, chave)
  );
  CREATE INDEX IF NOT EXISTS idx_seq_envios_em ON email_sequencia_envios (enviadoEm);
  CREATE TABLE IF NOT EXISTS email_descadastros (
    email TEXT PRIMARY KEY,
    em INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS email_sequencia_config (
    chave TEXT PRIMARY KEY,
    valor TEXT
  );
`);

const SEGREDO = process.env.JWT_SECRET || "salesmachine-dev-secret-change-in-production";
export const sequenciasLigadas = () => process.env.SEQUENCIAS_EMAIL !== "off" && process.env.NODE_ENV !== "test";
const MAX_POR_RODADA = 40;

// Início das sequências: fixado na primeira subida. Âncora de quem já tinha
// conta (não recebe boas-vindas atrasadas) e base do aquecimento do domínio.
export function lancamento() {
  const r = db.prepare("SELECT valor FROM email_sequencia_config WHERE chave = 'lancamento'").get();
  if (r) return Number(r.valor);
  const agora = Date.now();
  db.prepare("INSERT OR IGNORE INTO email_sequencia_config (chave, valor) VALUES ('lancamento', ?)").run(String(agora));
  return Number(db.prepare("SELECT valor FROM email_sequencia_config WHERE chave = 'lancamento'").get().valor);
}

// ─── Descadastro ───────────────────────────────────────────────────────────
const normEmail = (e) => String(e || "").trim().toLowerCase();
export const tokenDescadastro = (email) => createHmac("sha256", SEGREDO).update(`descadastro:${normEmail(email)}`).digest("base64url");
export function validarDescadastro(email, token) {
  const a = Buffer.from(tokenDescadastro(email));
  const b = Buffer.from(String(token || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}
export function linkDescadastro(email) {
  const e = Buffer.from(normEmail(email)).toString("base64url");
  return `${urlApp()}/api/email/descadastro?e=${e}&t=${tokenDescadastro(email)}`;
}
export const emailDoParametro = (e) => { try { return normEmail(Buffer.from(String(e || ""), "base64url").toString("utf8")); } catch { return ""; } };
export function descadastrar(email) {
  db.prepare("INSERT OR IGNORE INTO email_descadastros (email, em) VALUES (?, ?)").run(normEmail(email), Date.now());
}
const descadastrados = () => new Set(db.prepare("SELECT email FROM email_descadastros").all().map((r) => r.email));

// ─── Perfil: reativação e bônus ────────────────────────────────────────────
const SELECT_PERFIL = "SELECT id, nome, email, foto, titulo, bio, disponibilidade, cidade, segmentos, modalidades, skills, perfilCompletoEm, inativoEm FROM sellers";

// Chamado quando o perfil muda (e na rodada, para quem completou por outro caminho).
export function aoAtualizarPerfil(sellerId) {
  const s = db.prepare(`${SELECT_PERFIL} WHERE id = ?`).get(sellerId);
  if (!s || pendenciasPerfil(s).length) return;
  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sellerId);
  if (!s.perfilCompletoEm) db.prepare("UPDATE sellers SET perfilCompletoEm = ? WHERE id = ?").run(Date.now(), sellerId);
  if (s.inativoEm) {
    db.prepare("UPDATE sellers SET inativoEm = NULL, inativoMotivo = '' WHERE id = ?").run(sellerId);
    if (user) notificar(user.id, "conta", "Conta reativada", "Seu perfil está completo e as oportunidades voltaram a aparecer.");
  }
  if (user) qualificarIndicacaoProfissional(user.id);
}

function inativarPerfisIncompletos(agora) {
  const avisados = db.prepare(`
    SELECT s.id, s.nome, s.email, s.foto, s.titulo, s.bio, s.disponibilidade, s.cidade, s.segmentos, s.modalidades, s.skills, e.enviadoEm
    FROM email_sequencia_envios e JOIN sellers s ON s.id = e.destinatarioId
    WHERE e.destinatarioTipo = 'vendedor' AND e.chave = 'onboarding:aviso_inativacao' AND e.status = 'enviado'
      AND e.enviadoEm <= ? AND s.inativoEm IS NULL`).all(agora - DIAS_PARA_INATIVAR * DIA);
  let n = 0;
  for (const s of avisados) {
    if (!pendenciasPerfil(s).length) { aoAtualizarPerfil(s.id); continue; }
    db.prepare("UPDATE sellers SET inativoEm = ?, inativoMotivo = 'perfil_incompleto' WHERE id = ? AND inativoEm IS NULL").run(agora, s.id);
    const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(s.id);
    if (user) notificar(user.id, "conta", "Conta inativa", "Seu perfil ficou incompleto. Complete foto, descrição e dados e a conta volta na hora.");
    n++;
  }
  return n;
}

function registrarPerfisCompletos() {
  const pendentes = db.prepare(`${SELECT_PERFIL} WHERE perfilCompletoEm IS NULL OR inativoEm IS NOT NULL`).all();
  for (const s of pendentes) if (!pendenciasPerfil(s).length) aoAtualizarPerfil(s.id);
}

// ─── Candidatos ────────────────────────────────────────────────────────────
function historico() {
  const enviados = new Map(); // `${tipo}:${id}` → Map(chave → enviadoEm)
  const ultimoPorEmail = new Map();
  for (const r of db.prepare("SELECT destinatarioTipo, destinatarioId, email, chave, enviadoEm FROM email_sequencia_envios WHERE status = 'enviado'").all()) {
    const k = `${r.destinatarioTipo}:${r.destinatarioId}`;
    if (!enviados.has(k)) enviados.set(k, new Map());
    enviados.get(k).set(r.chave, r.enviadoEm);
    ultimoPorEmail.set(r.email, Math.max(ultimoPorEmail.get(r.email) || 0, r.enviadoEm));
  }
  return { enviados, ultimoPorEmail };
}

function dadosGerais(agora) {
  const campanhasAtivas = db.prepare("SELECT COUNT(*) AS n FROM campaigns WHERE status = 'ativa'").get().n;
  const empresasNovasSemana = db.prepare("SELECT COUNT(*) AS n FROM companies WHERE criadoEm >= ? AND statusCadastro = 'aprovada'").get(agora - 7 * DIA).n;
  return { campanhasAtivas, empresasNovasSemana };
}

export function candidatos(agora = Date.now()) {
  const lanc = lancamento();
  const { enviados, ultimoPorEmail } = historico();
  const fora = descadastrados();
  const lista = [];

  const sellers = db.prepare(`
    SELECT s.id, s.nome, s.email, s.pais, s.foto, s.titulo, s.bio, s.disponibilidade, s.cidade, s.segmentos, s.modalidades, s.skills,
           s.criadoEm, s.inativoEm, u.id AS userId, u.ultimoAcessoEm,
           EXISTS (SELECT 1 FROM referrals r WHERE r.indicadorUserId = u.id) AS indicacaoUsada
    FROM sellers s JOIN users u ON u.entityId = s.id AND u.role = 'vendedor'
    WHERE s.status NOT IN ('excluido', 'bloqueado', 'recusado', 'ia_recusado') AND s.email != ''`).all();
  for (const s of sellers) {
    const email = normEmail(s.email);
    if (!email || fora.has(email)) continue;
    const ctx = {
      ancora: Math.max(s.criadoEm || 0, lanc),
      novo: (s.criadoEm || 0) >= lanc,
      perfilCompleto: pendenciasPerfil(s).length === 0,
      inativo: !!s.inativoEm,
      indicacaoUsada: !!s.indicacaoUsada,
      plano: null,
      ultimaAtividade: Math.max(s.ultimoAcessoEm || 0, lanc),
      enviados: enviados.get(`vendedor:${s.id}`) || new Map(),
    };
    // Plano só é consultado quando decide o passo (evita uma consulta por pessoa).
    let passo = proximoEmailVendedor({ ...ctx, plano: "gratis" }, agora);
    if (passo?.chave === "graduacao:planos") {
      const plano = planoAtual(s.id)?.plano || "gratis";
      if (plano !== "gratis") passo = proximoEmailVendedor({ ...ctx, plano }, agora);
    }
    if (!passo) continue;
    if (agora - (ultimoPorEmail.get(email) || 0) < INTERVALO_MIN_POR_PESSOA) continue;
    lista.push({ tipo: "vendedor", id: s.id, userId: s.userId, nome: s.nome, email, idioma: idiomaDoPais(s.pais), seller: s, ancora: ctx.ancora, ...passo });
  }

  const empresas = db.prepare(`
    SELECT c.id, c.nome AS empresa, c.nome, c.pais, u.id AS userId, u.email, u.ultimoAcessoEm
    FROM companies c JOIN users u ON u.entityId = c.id AND u.role = 'empresa'
    WHERE u.email != ''`).all();
  for (const c of empresas) {
    const email = normEmail(c.email);
    if (!email || fora.has(email)) continue;
    const passo = proximoEmailEmpresa({
      ultimaAtividade: Math.max(c.ultimoAcessoEm || 0, lanc),
      enviados: enviados.get(`empresa:${c.id}`) || new Map(),
    }, agora);
    if (!passo) continue;
    if (agora - (ultimoPorEmail.get(email) || 0) < INTERVALO_MIN_POR_PESSOA) continue;
    lista.push({ tipo: "empresa", id: c.id, userId: c.userId, nome: c.nome, empresa: c.empresa, email, idioma: idiomaDoPais(c.pais), ancora: 0, ...passo });
  }

  // Prioridade: ordem das sequências; dentro dela, quem entrou antes.
  lista.sort((a, b) => ORDEM_SEQUENCIAS.indexOf(a.seq) - ORDEM_SEQUENCIAS.indexOf(b.seq) || a.ancora - b.ancora);
  return lista;
}

// Monta o e-mail final (assunto, HTML, texto) de um candidato.
export function montarEmail(c, gerais) {
  const dados = {
    nome: c.nome, empresa: c.empresa, passo: c.passo,
    pendencias: c.seller ? pendenciasPerfil(c.seller) : [],
    codigo: c.tipo === "vendedor" && c.chave.startsWith("indicacoes:") ? codigoDoUsuario(c.userId) : "",
    ...gerais,
  };
  const t = montarTexto(c.chave, c.idioma, dados);
  if (!t) return null;
  const descadastro = linkDescadastro(c.email);
  const link = `${urlApp()}/?aba=${encodeURIComponent(t.aba)}&utm_source=email&utm_medium=sequencia&utm_campaign=${encodeURIComponent(c.chave.split("@")[0])}`;
  const html = layoutSequencia({ ...t, link, descadastro, preheader: t.paragrafos[0]?.replace(/<[^>]+>/g, "") });
  const text = [t.titulo, "", ...t.paragrafos.map((p) => p.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&")), "", `${t.botao}: ${link}`, "", `${t.textoDescadastro}: ${descadastro}`].join("\n");
  return {
    assunto: t.assunto, html, text,
    headers: { "List-Unsubscribe": `<${descadastro}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

function inicioDoDiaBrasilia(agora) {
  const d = new Date(agora - 3 * 60 * 60 * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + 3 * 60 * 60 * 1000;
}

export function enviadosHoje(agora = Date.now()) {
  return db.prepare("SELECT COUNT(*) AS n FROM email_sequencia_envios WHERE status = 'enviado' AND enviadoEm >= ?").get(inicioDoDiaBrasilia(agora)).n;
}

let rodando = false;
export async function rodada(agora = Date.now(), { ignorarJanela = false } = {}) {
  if (rodando) return { ocupado: true };
  rodando = true;
  try {
    registrarPerfisCompletos();
    const inativados = inativarPerfisIncompletos(agora);
    if (!ignorarJanela && !dentroDaJanela(agora)) return { inativados, enviados: 0, foraDaJanela: true };

    const teto = tetoDoDia((agora - lancamento()) / DIA);
    const restante = Math.min(MAX_POR_RODADA, teto - enviadosHoje(agora));
    if (restante <= 0) return { inativados, enviados: 0, tetoAtingido: true };

    const gerais = dadosGerais(agora);
    let enviados = 0, falhas = 0;
    for (const c of candidatos(agora).slice(0, restante)) {
      const m = montarEmail(c, gerais);
      if (!m) continue;
      const r = await sendEmail(c.email, m.assunto, m.html, { text: m.text, headers: m.headers });
      const ok = !!r?.ok;
      // Falha não grava como enviado: a próxima rodada tenta de novo.
      db.prepare(`INSERT INTO email_sequencia_envios (id, chave, sequencia, destinatarioTipo, destinatarioId, email, idioma, assunto, status, resendId, erro, enviadoEm)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT (destinatarioTipo, destinatarioId, chave) DO UPDATE SET status = excluded.status, resendId = excluded.resendId, erro = excluded.erro, enviadoEm = excluded.enviadoEm`)
        .run(uid(), c.chave, c.seq, c.tipo, c.id, c.email, c.idioma, m.assunto, ok ? "enviado" : "falhou", r?.id || null, ok ? null : String(r?.error || "").slice(0, 300), Date.now());
      if (ok) enviados++;
      else if (++falhas >= 3) break; // provedor com problema: para e tenta na próxima rodada
    }
    return { inativados, enviados, falhas };
  } finally {
    rodando = false;
  }
}

export function resumoSequencias(agora = Date.now()) {
  const porChave = db.prepare(`SELECT sequencia, CASE WHEN instr(chave, '@') > 0 THEN substr(chave, 1, instr(chave, '@') - 1) ELSE chave END AS passo,
      SUM(status = 'enviado') AS enviados, SUM(status = 'falhou') AS falhas
    FROM email_sequencia_envios GROUP BY sequencia, passo ORDER BY sequencia, passo`).all();
  return {
    ligado: sequenciasLigadas(),
    lancamento: lancamento(),
    tetoHoje: tetoDoDia((agora - lancamento()) / DIA),
    enviadosHoje: enviadosHoje(agora),
    naFila: candidatos(agora).length,
    sequencias: ORDEM_SEQUENCIAS.map((k) => ({ chave: k, nome: SEQUENCIAS[k].nome, passos: porChave.filter((r) => r.sequencia === k) })),
    descadastros: db.prepare("SELECT COUNT(*) AS n FROM email_descadastros").get().n,
    inativos: db.prepare("SELECT COUNT(*) AS n FROM sellers WHERE inativoEm IS NOT NULL").get().n,
    ultimos: db.prepare("SELECT chave, destinatarioTipo, email, assunto, status, erro, enviadoEm FROM email_sequencia_envios ORDER BY enviadoEm DESC LIMIT 30").all(),
  };
}

export function iniciarSequenciasEmail() {
  if (!sequenciasLigadas()) return;
  lancamento();
  const tick = () => rodada().catch((e) => console.error("[sequencias] rodada:", e.message));
  setTimeout(tick, 60 * 1000).unref?.();
  setInterval(tick, 15 * 60 * 1000).unref?.();
}

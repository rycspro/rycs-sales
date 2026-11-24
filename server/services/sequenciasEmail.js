// Motor das sequências automáticas de e-mail (ver shared/sequenciasEmail.js).
//
// A cada 15 minutos: decide, para cada profissional, se cabe um e-mail agora
// (empresas: ver reativacaoEmpresas.js); respeita 1 por pessoa a cada 20h, a janela de horário, o teto
// diário de aquecimento do domínio e o descadastro. Perfil incompleto gera só
// lembrete: a conta continua ativa e visível para as empresas.
import { createHmac, timingSafeEqual } from "crypto";
import db, { uid } from "../db.js";
import { sendEmail, layoutSequencia, urlApp } from "./email.js";
import { notificar } from "../routes/notifications.js";
import { codigoDoUsuario, qualificarIndicacaoProfissional } from "./indicacoes.js";
import { planoAtual } from "./planosProfissional.js";
import { pendenciasPerfil, COLUNAS_PERFIL } from "../../shared/perfilVendedor.js";
import {
  DIA, INTERVALO_MIN_POR_PESSOA, ORDEM_SEQUENCIAS, SEQUENCIAS,
  tetoDoDia, dentroDaJanela, idiomaDoPais, proximoEmailVendedor, montarTexto,
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
// Resend: no máximo ~2 envios por segundo por conta.
export const PAUSA_ENTRE_ENVIOS_MS = 600;
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
export const limiteDeTaxa = (erro) => /too many requests|rate limit/i.test(String(erro || ""));

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
// `idioma` "en" abre a página de descadastro em inglês (Índia e demais países).
export function linkDescadastro(email, idioma = "pt") {
  const e = Buffer.from(normEmail(email)).toString("base64url");
  return `${urlApp()}/api/email/descadastro?e=${e}&t=${tokenDescadastro(email)}${idioma === "en" ? "&l=en" : ""}`;
}
export const emailDoParametro = (e) => { try { return normEmail(Buffer.from(String(e || ""), "base64url").toString("utf8")); } catch { return ""; } };
export function descadastrar(email) {
  db.prepare("INSERT OR IGNORE INTO email_descadastros (email, em) VALUES (?, ?)").run(normEmail(email), Date.now());
}
export const descadastrados = () => new Set(db.prepare("SELECT email FROM email_descadastros").all().map((r) => r.email));

// ─── Perfil: reativação e bônus ────────────────────────────────────────────
const SELECT_PERFIL = `SELECT id, nome, email, foto, ${COLUNAS_PERFIL}, perfilCompletoEm, inativoEm FROM sellers`;

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

// Contas inativadas pela regra antiga de perfil incompleto, que cobrava campos
// que o cadastro não preenche. A regra saiu; aqui essas contas voltam, sem aviso
// nem e-mail. Roda a cada subida porque, se um deploy voltar para a versão antiga,
// ela inativa de novo. Quem voltou (e quando tinha sido inativado) fica em
// email_sequencia_config, para poder conferir ou desfazer.
export function reativarInativadosPorPerfil(agora = Date.now()) {
  return db.transaction(() => {
    const contas = db.prepare("SELECT id, inativoEm FROM sellers WHERE inativoEm IS NOT NULL AND inativoMotivo = 'perfil_incompleto'").all();
    if (!contas.length) return 0;
    const reativar = db.prepare("UPDATE sellers SET inativoEm = NULL, inativoMotivo = '' WHERE id = ?");
    for (const c of contas) reativar.run(c.id);
    db.prepare("INSERT INTO email_sequencia_config (chave, valor) VALUES (?, ?)")
      .run(`reativacao_perfil_incompleto:${agora}`, JSON.stringify(contas));
    return contas.length;
  })();
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

// Avalia TODO mundo (profissionais e empresas): próximo passo de cada um e o
// que o segura (descadastro, intervalo de 20h). `candidatos` filtra daqui quem
// recebe agora; o painel do admin mostra a lista inteira.
function avaliarTodos(agora) {
  const lanc = lancamento();
  const { enviados, ultimoPorEmail } = historico();
  const fora = descadastrados();
  const lista = [];

  const sellers = db.prepare(`
    SELECT s.id, s.nome, s.email, s.pais, s.foto, s.bio, s.disponibilidade, s.cidade, s.segmentos, s.skills, s.perfilComercial,
           s.criadoEm, s.inativoEm, u.id AS userId, u.ultimoAcessoEm,
           EXISTS (SELECT 1 FROM referrals r WHERE r.indicadorUserId = u.id) AS indicacaoUsada
    FROM sellers s JOIN users u ON u.entityId = s.id AND u.role = 'vendedor'
    WHERE s.status NOT IN ('excluido', 'bloqueado', 'recusado', 'ia_recusado') AND s.email != ''`).all();
  for (const s of sellers) {
    const email = normEmail(s.email);
    if (!email) continue;
    if (fora.has(email)) { lista.push({ tipo: "vendedor", id: s.id, nome: s.nome, email, criadoEm: s.criadoEm, inativo: !!s.inativoEm, descadastrado: true, proximoPasso: null }); continue; }
    // Cada profissional entra pela fase em que está: quem chegou depois do
    // lançamento recebe o boas-vindas; quem já tinha conta conta os dias desde
    // o cadastro real, pula o boas-vindas e começa no primeiro passo que faz
    // sentido para ele (perfil incompleto → "falta pouco"; completo → segue).
    const novo = (s.criadoEm || 0) >= lanc;
    const ctx = {
      ancora: novo ? s.criadoEm : (s.criadoEm || lanc),
      novo,
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
    const espera = passo ? agora - (ultimoPorEmail.get(email) || 0) < INTERVALO_MIN_POR_PESSOA : false;
    lista.push({ tipo: "vendedor", id: s.id, userId: s.userId, nome: s.nome, email, idioma: idiomaDoPais(s.pais), seller: s, ancora: ctx.ancora,
      criadoEm: s.criadoEm, inativo: !!s.inativoEm, descadastrado: false, perfilCompleto: ctx.perfilCompleto, espera,
      proximoPasso: passo ? { chave: passo.chave, seq: passo.seq } : null, ...(passo || {}) });
  }

  const empresas = db.prepare(`
    SELECT c.id, c.nome AS empresa, c.nome, c.pais, c.criadoEm, u.id AS userId, u.email, u.ultimoAcessoEm
    FROM companies c JOIN users u ON u.entityId = c.id AND u.role = 'empresa'
    WHERE u.email != ''`).all();
  for (const c of empresas) {
    const email = normEmail(c.email);
    if (!email) continue;
    // A sequência das empresas agora é a reativação (services/reativacaoEmpresas.js).
    // Aqui elas só aparecem no painel, com o histórico de envios.
    lista.push({ tipo: "empresa", id: c.id, userId: c.userId, nome: c.nome, empresa: c.empresa, email, descadastrado: fora.has(email), proximoPasso: null });
  }
  return { lista, enviados };
}

export function candidatos(agora = Date.now()) {
  const lista = avaliarTodos(agora).lista.filter((c) => c.proximoPasso && !c.espera && !c.descadastrado);

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
  const descadastro = linkDescadastro(c.email, c.idioma);
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
export async function rodada(agora = Date.now(), { ignorarJanela = false, ignorarTeto = false } = {}) {
  if (rodando) return { ocupado: true };
  rodando = true;
  try {
    registrarPerfisCompletos();
    if (!ignorarJanela && !dentroDaJanela(agora)) return { enviados: 0, foraDaJanela: true };

    const teto = tetoDoDia((agora - lancamento()) / DIA);
    // Disparo manual do admin pode passar do teto de aquecimento (pedido do dono).
    const restante = ignorarTeto ? MAX_POR_RODADA : Math.min(MAX_POR_RODADA, teto - enviadosHoje(agora));
    if (restante <= 0) return { enviados: 0, tetoAtingido: true };

    const gerais = dadosGerais(agora);
    let enviados = 0, falhas = 0;
    for (const c of candidatos(agora).slice(0, restante)) {
      const m = montarEmail(c, gerais);
      if (!m) continue;
      // O Resend limita envios por segundo: espaça os envios e, se ele pedir
      // para esperar (limite de taxa), espera e tenta de novo.
      let r;
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        await esperar(PAUSA_ENTRE_ENVIOS_MS * (tentativa === 0 ? 1 : 3 * tentativa));
        r = await sendEmail(c.email, m.assunto, m.html, { text: m.text, headers: m.headers });
        if (r?.ok || !limiteDeTaxa(r?.error)) break;
      }
      const ok = !!r?.ok;
      // Falha não grava como enviado: a próxima rodada tenta de novo.
      db.prepare(`INSERT INTO email_sequencia_envios (id, chave, sequencia, destinatarioTipo, destinatarioId, email, idioma, assunto, status, resendId, erro, enviadoEm)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT (destinatarioTipo, destinatarioId, chave) DO UPDATE SET status = excluded.status, resendId = excluded.resendId, erro = excluded.erro, enviadoEm = excluded.enviadoEm`)
        .run(uid(), c.chave, c.seq, c.tipo, c.id, c.email, c.idioma, m.assunto, ok ? "enviado" : "falhou", r?.id || null, ok ? null : String(r?.error || "").slice(0, 300), Date.now());
      if (ok) enviados++;
      else if (++falhas >= 3) break; // provedor com problema: para e tenta na próxima rodada
    }
    return { enviados, falhas };
  } finally {
    rodando = false;
  }
}

// Painel do admin: cada pessoa com o que já recebeu (ou falhou) e o próximo
// e-mail previsto. `proximo.status`: "na_fila" (sai na próxima rodada),
// "aguardando_intervalo" (recebeu outro há menos de 20h) ou ausente (nada a
// enviar agora).
export function destinatariosSequencias(agora = Date.now()) {
  const envios = new Map();
  for (const r of db.prepare("SELECT * FROM email_sequencia_envios ORDER BY enviadoEm").all()) {
    const k = `${r.destinatarioTipo}:${r.destinatarioId}`;
    if (!envios.has(k)) envios.set(k, []);
    envios.get(k).push({
      chave: r.chave.split("@")[0], status: r.status, erro: r.erro || "", em: r.enviadoEm,
      entregue: !!r.entregueEm, aberto: !!r.abertoEm, clicado: !!r.clicadoEm, devolvido: !!r.devolvidoEm, spam: !!r.spamEm,
    });
  }
  return avaliarTodos(agora).lista.map((c) => ({
    tipo: c.tipo, id: c.id, nome: c.nome || "", email: c.email, criadoEm: c.criadoEm || null,
    inativo: !!c.inativo, descadastrado: !!c.descadastrado, perfilCompleto: c.perfilCompleto ?? null,
    envios: envios.get(`${c.tipo}:${c.id}`) || [],
    proximo: c.proximoPasso ? { chave: c.proximoPasso.chave.split("@")[0], status: c.espera ? "aguardando_intervalo" : "na_fila" } : null,
  }));
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
  try {
    const reativadas = reativarInativadosPorPerfil();
    if (reativadas) console.log(`[sequencias] ${reativadas} conta(s) reativada(s): perfil incompleto não inativa mais.`);
  } catch (e) { console.error("[sequencias] reativação:", e.message); }
  if (!sequenciasLigadas()) return;
  lancamento();
  const tick = () => rodada().catch((e) => console.error("[sequencias] rodada:", e.message));
  setTimeout(tick, 60 * 1000).unref?.();
  setInterval(tick, 15 * 60 * 1000).unref?.();
}

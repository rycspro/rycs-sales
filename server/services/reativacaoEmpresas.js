// Reativação de empresas offline (regras e textos em shared/reativacaoEmpresas.js).
//
// A cada 15 min, em dia útil: tira da sequência quem reativou, inscreve quem
// está parado, manda o e-mail do dia (a partir das 9h) e o WhatsApp dos dias
// 1, 3, 5 e 7 (a partir das 14h). Nada sai sem REACTIVATION_ENABLED=true e
// REACTIVATION_DRY_RUN=false: no modo simulação só registra o que faria.
//
// Idempotência: e-mail em email_sequencia_envios (UNIQUE por empresa + chave
// "reativacao_empresas:dN@<inscrição>") e WhatsApp em reativacao_whatsapp
// (UNIQUE por inscrição + dia). A linha é reservada ANTES do envio.

import db, { uid } from "../db.js";
import { sendEmail, layoutSequencia, urlApp } from "./email.js";
import { linkDescadastro, lancamento, enviadosHoje as enviadosHojeSequencias } from "./sequenciasEmail.js";
import "./emailMetricas.js"; // colunas de bounce/spam em email_sequencia_envios
import * as wa from "./whatsappDisparo.js";
import { tetoDoDia, TEXTO_DESCADASTRO } from "../../shared/sequenciasEmail.js";
import * as R from "../../shared/reativacaoEmpresas.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS reativacao_inscricoes (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    segmento TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativa',
    diaAtual INTEGER NOT NULL DEFAULT 0,
    ultimoPassoEm INTEGER,
    falhasEmail INTEGER NOT NULL DEFAULT 0,
    motivoSaida TEXT DEFAULT '',
    inicioEm INTEGER NOT NULL,
    fimEm INTEGER,
    atualizadoEm INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_reativacao_uma_ativa ON reativacao_inscricoes (companyId) WHERE status = 'ativa';
  CREATE INDEX IF NOT EXISTS idx_reativacao_empresa ON reativacao_inscricoes (companyId, inicioEm);

  CREATE TABLE IF NOT EXISTS reativacao_whatsapp (
    id TEXT PRIMARY KEY,
    inscricaoId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    dia INTEGER NOT NULL,
    modelo TEXT NOT NULL,
    numero TEXT DEFAULT '',
    wamid TEXT DEFAULT '',
    status TEXT NOT NULL,
    erro TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL,
    enviadoEm INTEGER,
    UNIQUE (inscricaoId, dia)
  );
  CREATE INDEX IF NOT EXISTS idx_reativacao_wa_wamid ON reativacao_whatsapp (wamid);

  CREATE TABLE IF NOT EXISTS reativacao_respostas (
    wamid TEXT PRIMARY KEY,
    inscricaoId TEXT DEFAULT '',
    companyId TEXT DEFAULT '',
    acao TEXT NOT NULL,
    de TEXT NOT NULL,
    em INTEGER NOT NULL
  );
`);

// ─── Configuração (variáveis de ambiente) ─────────────────────────────────
const num = (v, padrao) => (Number.isFinite(Number(v)) && String(v ?? "").trim() !== "" ? Number(v) : padrao);
export function config() {
  const e = process.env;
  return {
    ligado: e.REACTIVATION_ENABLED === "true" && e.NODE_ENV !== "test",
    simulacao: e.REACTIVATION_DRY_RUN !== "false",
    diasInativo: Math.max(1, num(e.REACTIVATION_INACTIVE_DAYS, R.INATIVO_PADRAO)),
    maxEmailsDia: Math.max(0, num(e.REACTIVATION_MAX_EMAILS_PER_DAY, 30)),
    remetente: e.REACTIVATION_EMAIL_FROM || "",
    responderPara: e.REACTIVATION_REPLY_TO || "",
    linkAgenda: e.REACTIVATION_AGENDA_URL || "",
    avisoEmail: e.REACTIVATION_NOTIFY_EMAIL || "",
  };
}

const agoraMs = () => Date.now();
const normEmail = (e) => String(e || "").trim().toLowerCase();
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const chaveEmail = (dia, inscricaoId) => `${R.SEQ}:d${dia}@${inscricaoId}`;
const inicioDoDia = (ms) => Date.parse(`${R.dataBrasilia(ms)}T03:00:00Z`);

// ─── Leitura do estado ─────────────────────────────────────────────────────
const sqlEmpresas = `
  SELECT c.id, c.nome, c.criadoEm, c.statusCadastro, c.whatsapp, c.representanteLegal,
         c.whatsappMarketingEm, c.whatsappMarketingSaiuEm, u.email,
         (SELECT MAX(x.ultimoAcessoEm) FROM users x WHERE x.entityId = c.id AND x.role = 'empresa') AS ultimoAcessoEm,
         (SELECT COUNT(*) FROM campaigns k WHERE k.companyId = c.id) AS campanhas,
         (SELECT COUNT(*) FROM campaigns k WHERE k.companyId = c.id AND k.status = 'ativa') AS campanhasAtivas,
         (SELECT MAX(k.criadoEm) FROM campaigns k WHERE k.companyId = c.id) AS ultimaCampanhaEm
  FROM companies c
  JOIN users u ON u.id = (SELECT y.id FROM users y WHERE y.entityId = c.id AND y.role = 'empresa' ORDER BY y.criadoEm LIMIT 1)`;

export const vendedoresAtivos = () =>
  db.prepare("SELECT COUNT(*) AS n FROM sellers WHERE status = 'aprovado' AND inativoEm IS NULL").get().n;

function bloqueios() {
  return {
    descadastro: new Set(db.prepare("SELECT email FROM email_descadastros").all().map((r) => normEmail(r.email))),
    devolvidos: new Set(db.prepare("SELECT DISTINCT email FROM email_sequencia_envios WHERE devolvidoEm IS NOT NULL OR spamEm IS NOT NULL").all().map((r) => normEmail(r.email))),
    whatsappSair: wa.descadastrados(),
  };
}

function canais(c, fora) {
  const email = normEmail(c.email);
  let motivoEmail = "";
  if (!EMAIL_OK.test(email)) motivoEmail = "email_invalido";
  else if (fora.descadastro.has(email)) motivoEmail = "email_descadastrado";
  else if (fora.devolvidos.has(email)) motivoEmail = "email_bounce_ou_spam";
  const digitos = String(c.whatsapp || "").replace(/\D/g, "");
  const numero = digitos ? wa.numeroWhatsapp(`+${digitos}`) : "";
  let motivoWhatsapp = "";
  if (numero && (c.whatsappMarketingSaiuEm || wa.variacoes(numero).some((v) => fora.whatsappSair.has(v)))) motivoWhatsapp = "pediu_para_sair";
  else if (!c.whatsappMarketingEm) motivoWhatsapp = "sem_aceite";
  else if (c.whatsappMarketingSaiuEm) motivoWhatsapp = "pediu_para_sair";
  else if (!numero) motivoWhatsapp = "numero_invalido";
  return { email, motivoEmail, numero, motivoWhatsapp };
}

// ─── Plano do dia (sem escrever nada) ──────────────────────────────────────
// `diaInteiro`: ignora o horário (para a simulação mostrar o dia todo).
export function planejar(agora = agoraMs(), { diaInteiro = false } = {}) {
  const cfg = config();
  const fora = bloqueios();
  const empresas = new Map(db.prepare(sqlEmpresas).all().map((c) => [c.id, c]));
  const ativas = db.prepare("SELECT * FROM reativacao_inscricoes WHERE status = 'ativa'").all();
  const ultimaInscricao = new Map(db.prepare("SELECT companyId, MAX(inicioEm) AS em FROM reativacao_inscricoes GROUP BY companyId").all().map((r) => [r.companyId, r.em]));
  const waFeitos = new Set(db.prepare(`SELECT w.inscricaoId || ':' || w.dia AS k FROM reativacao_whatsapp w
    JOIN reativacao_inscricoes i ON i.id = w.inscricaoId WHERE i.status = 'ativa'`).all().map((r) => r.k));
  const vendedores = vendedoresAtivos();
  const podeEmail = diaInteiro ? R.diaUtil(agora) : R.janelaEmail(agora);
  const podeWhatsapp = diaInteiro ? R.diaUtil(agora) : R.janelaWhatsapp(agora);

  const dadosDe = (c, segmento) => ({
    nome: R.primeiroNome(c.representanteLegal), empresa: c.nome, vendedoresAtivos: vendedores,
    diasInativo: Math.floor((agora - Math.max(c.ultimoAcessoEm || 0, c.ultimaCampanhaEm || 0, c.criadoEm || 0)) / R.DIA),
    linkAgenda: cfg.linkAgenda, prazoOferta: "", segmento,
  });
  const base = (c, insc) => ({ companyId: c?.id || insc?.companyId, empresa: c?.nome || "", email: c ? normEmail(c.email) : "", inscricaoId: insc?.id || null });

  const acoes = [];
  const comInscricao = new Set();
  for (const insc of ativas) {
    comInscricao.add(insc.companyId);
    const c = empresas.get(insc.companyId);
    if (!c) { acoes.push({ ...base(null, insc), tipo: "sair", motivo: "empresa_removida" }); continue; }
    if (R.reativou(c, insc)) { acoes.push({ ...base(c, insc), tipo: "sair", motivo: "reativada" }); continue; }
    const ch = canais(c, fora);
    if (ch.motivoEmail && ch.motivoWhatsapp) { acoes.push({ ...base(c, insc), tipo: "sair", motivo: "sem_canal" }); continue; }
    const dados = dadosDe(c, insc.segmento);
    const passo = R.proximoPasso(insc, agora);
    if (passo?.concluir) { acoes.push({ ...base(c, insc), tipo: "concluir", inscricao: insc }); continue; }
    if (passo && podeEmail) {
      acoes.push({ ...base(c, insc), tipo: "passo", dia: passo.dia, segmento: insc.segmento, inscricao: insc, canais: ch, dados });
      continue;
    }
    const w = R.whatsappDoPasso(insc, agora);
    if (w && !waFeitos.has(`${insc.id}:${w.dia}`) && podeWhatsapp) {
      acoes.push({ ...base(c, insc), tipo: "whatsapp", dia: w.dia, segmento: insc.segmento, inscricao: insc, canais: ch, dados });
    }
  }

  const novas = [];
  if (podeEmail) {
    for (const c of empresas.values()) {
      if (comInscricao.has(c.id)) continue;
      const segmento = R.segmentoDa(c, agora, { diasInativo: cfg.diasInativo });
      if (!segmento) continue;
      const ch = canais(c, fora);
      const motivo = R.motivoDeFora({ ultimaInscricaoEm: ultimaInscricao.get(c.id), motivoEmail: ch.motivoEmail, motivoWhatsapp: ch.motivoWhatsapp }, agora);
      if (motivo) continue;
      novas.push({ ...base(c, null), tipo: "inscrever", dia: 1, segmento, canais: ch, dados: dadosDe(c, segmento), parado: Math.max(c.ultimoAcessoEm || 0, c.criadoEm || 0) });
    }
    // Quem está parado há mais tempo entra primeiro.
    novas.sort((a, b) => a.parado - b.parado);
  }

  // Teto de e-mails do dia: o da reativação e o de aquecimento do domínio.
  const hoje = inicioDoDia(agora);
  const enviadosReativacao = db.prepare("SELECT COUNT(*) AS n FROM email_sequencia_envios WHERE sequencia = ? AND status IN ('enviado','enviando') AND enviadoEm >= ?").get(R.SEQ, hoje).n;
  const tetoGlobal = tetoDoDia((agora - lancamento()) / R.DIA) - enviadosHojeSequencias(agora);
  let vagas = Math.max(0, Math.min(cfg.maxEmailsDia - enviadosReativacao, tetoGlobal));

  for (const a of [...acoes.filter((x) => x.tipo === "passo"), ...novas]) {
    a.texto = R.textoEmail(a.dia, a.segmento, a.dados);
    a.emailPular = a.canais.motivoEmail || a.texto.pular || "";
    if (!a.emailPular) {
      if (vagas > 0) vagas--;
      else a.acimaDoTeto = true;
    }
  }
  // Inscrição nova só se o e-mail do dia 1 couber hoje.
  return { agora, config: cfg, acoes: [...acoes, ...novas.filter((n) => !n.acimaDoTeto)], adiadas: novas.filter((n) => n.acimaDoTeto).length };
}

// ─── E-mail ────────────────────────────────────────────────────────────────
function comUtm(link, dia) {
  try {
    const u = new URL(link);
    u.searchParams.set("utm_source", "email");
    u.searchParams.set("utm_campaign", R.SEQ);
    u.searchParams.set("utm_content", `dia_${dia}`);
    return u.toString();
  } catch { return link; }
}

export function montarEmail({ dia, segmento, texto, email, cfg = config() }) {
  const t = texto;
  const link = t.destino === "agenda" ? comUtm(cfg.linkAgenda, dia) : comUtm(`${urlApp()}/?aba=campanhas`, dia);
  const descadastro = linkDescadastro(email);
  const html = layoutSequencia({
    titulo: t.titulo, paragrafos: t.paragrafos, botao: t.botao, link, rodape: "Martin, da Rycs",
    descadastro, textoDescadastro: TEXTO_DESCADASTRO.pt, preheader: t.preheader,
  });
  const limpo = (p) => p.replace(/<br\/>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const text = [...t.paragrafos.map(limpo), "", `${t.botao}: ${link}`, "", "Martin, da Rycs", "", `${TEXTO_DESCADASTRO.pt}: ${descadastro}`].join("\n");
  return {
    assunto: t.assunto, html, text,
    opcoes: {
      text,
      headers: { "List-Unsubscribe": `<${descadastro}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      ...(cfg.remetente ? { from: cfg.remetente } : {}),
      ...(cfg.responderPara ? { replyTo: cfg.responderPara } : {}),
      tags: [{ name: "sequencia", value: R.SEQ }, { name: "dia", value: `d${dia}` }, { name: "segmento", value: segmento }],
    },
  };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const limiteDeTaxa = (erro) => /too many requests|rate limit/i.test(String(erro || ""));

// Reserva a linha do e-mail antes de enviar. false = já enviado/em envio.
function reservarEmail(a, assunto, status, erro = null) {
  const chave = chaveEmail(a.dia, a.inscricaoId);
  const novo = db.prepare(`INSERT INTO email_sequencia_envios (id, chave, sequencia, destinatarioTipo, destinatarioId, email, idioma, assunto, status, erro, enviadoEm)
    VALUES (?, ?, ?, 'empresa', ?, ?, 'pt', ?, ?, ?, ?) ON CONFLICT (destinatarioTipo, destinatarioId, chave) DO NOTHING`)
    .run(uid(), chave, R.SEQ, a.companyId, a.email, assunto || "", status, erro, agoraMs()).changes;
  if (novo) return true;
  // Falha anterior: pode tentar de novo.
  return db.prepare(`UPDATE email_sequencia_envios SET status = ?, erro = ?, enviadoEm = ?
    WHERE destinatarioTipo = 'empresa' AND destinatarioId = ? AND chave = ? AND status = 'falhou'`)
    .run(status, erro, agoraMs(), a.companyId, chave).changes > 0;
}

async function enviarEmailDoPasso(a) {
  const chave = chaveEmail(a.dia, a.inscricaoId);
  if (a.emailPular) {
    reservarEmail(a, a.texto?.assunto, "pulado", a.emailPular);
    return "pulado";
  }
  const m = montarEmail({ dia: a.dia, segmento: a.segmento, texto: a.texto, email: a.email, cfg: a.cfg });
  if (!reservarEmail(a, m.assunto, "enviando")) return "ja_enviado";
  let r;
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    await esperar(600 * (tentativa === 0 ? 1 : 3 * tentativa));
    r = await sendEmail(a.email, m.assunto, m.html, m.opcoes);
    if (r?.ok || !limiteDeTaxa(r?.error)) break;
  }
  const ok = !!r?.ok;
  db.prepare(`UPDATE email_sequencia_envios SET status = ?, resendId = ?, erro = ?, enviadoEm = ?
    WHERE destinatarioTipo = 'empresa' AND destinatarioId = ? AND chave = ?`)
    .run(ok ? "enviado" : "falhou", r?.id || null, ok ? null : String(r?.error || "").slice(0, 300), agoraMs(), a.companyId, chave);
  return ok ? "enviado" : "falhou";
}

// ─── WhatsApp ──────────────────────────────────────────────────────────────
function registrarWhatsapp(a, status, erro = "") {
  return db.prepare(`INSERT INTO reativacao_whatsapp (id, inscricaoId, companyId, dia, modelo, numero, status, erro, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (inscricaoId, dia) DO NOTHING`)
    .run(uid(), a.inscricaoId, a.companyId, a.dia, R.MODELOS_WHATSAPP[a.dia].nome, a.canais?.numero || "", status, erro, agoraMs()).changes > 0;
}

export function componentesWhatsapp(dia, valores, inscricaoId) {
  const m = R.MODELOS_WHATSAPP[dia];
  const comps = [{ type: "body", parameters: valores.map((text) => ({ type: "text", text })) }];
  m.botoes.forEach((b, i) => {
    if (b.tipo === "URL") comps.push({ type: "button", sub_type: "url", index: String(i), parameters: [{ type: "text", text: R.sufixoLinkWhatsapp(dia) }] });
    else comps.push({ type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload: R.payloadResposta(b.acao, inscricaoId) }] });
  });
  return comps;
}

async function modelosAprovados() {
  if (!wa.envioConfigurado()) return null;
  try {
    const lista = await wa.listarTemplates();
    return new Map(lista.filter((t) => t.idioma === R.IDIOMA_WHATSAPP).map((t) => [t.nome, t]));
  } catch (e) {
    console.warn("[reativacao] modelos do WhatsApp:", e.message);
    return null;
  }
}

const sqlWhatsapp24h = db.prepare("SELECT COUNT(DISTINCT numero) AS n FROM reativacao_whatsapp WHERE status IN ('enviado','enviando') AND enviadoEm > ?");

// Envia os WhatsApps pendentes. Para tudo no primeiro erro de conta.
async function enviarWhatsapps(lista, agora) {
  const res = { enviados: 0, pulados: 0, falhas: 0, parado: "" };
  if (!lista.length) return res;
  const pular = (a, motivo) => { if (registrarWhatsapp(a, "pulado", motivo)) res.pulados++; };
  if (!wa.envioConfigurado()) { for (const a of lista) pular(a, "whatsapp_nao_configurado"); return res; }
  if (wa.bloqueioRecente(agora)) { res.parado = "bloqueio_recente_da_meta"; return res; }
  const modelos = await modelosAprovados();
  if (!modelos) { res.parado = "nao_listou_modelos"; return res; }
  let vagas = wa.vagas24h(agora) - sqlWhatsapp24h.get(agora - R.DIA).n;

  for (const a of lista) {
    if (a.canais.motivoWhatsapp) { pular(a, a.canais.motivoWhatsapp); continue; }
    const tpl = modelos.get(R.MODELOS_WHATSAPP[a.dia].nome);
    if (!tpl) { pular(a, "modelo_nao_aprovado"); continue; }
    const valores = R.parametrosWhatsapp(a.dia, a.dados);
    if (valores.some((v) => !v)) { pular(a, "variavel_vazia"); continue; }
    if (!wa.dentroDoHorario(a.canais.numero, agora)) continue; // tenta na próxima rodada
    if (vagas <= 0) { res.parado = "limite_24h"; break; }
    if (!registrarWhatsapp(a, "enviando")) continue;
    vagas--;
    try {
      const wamid = await wa.enviarTemplate({ numero: a.canais.numero, tpl, componentes: componentesWhatsapp(a.dia, valores, a.inscricaoId) });
      db.prepare("UPDATE reativacao_whatsapp SET status = 'enviado', wamid = ?, enviadoEm = ? WHERE inscricaoId = ? AND dia = ?").run(wamid, agoraMs(), a.inscricaoId, a.dia);
      res.enviados++;
    } catch (err) {
      db.prepare("UPDATE reativacao_whatsapp SET status = 'falhou', erro = ?, enviadoEm = ? WHERE inscricaoId = ? AND dia = ?").run(wa.descreverErro(err), agoraMs(), a.inscricaoId, a.dia);
      res.falhas++;
      if (wa.erroFatal(err)) { res.parado = wa.descreverErro(err); break; }
    }
    await esperar(250);
  }
  return res;
}

// ─── Execução ──────────────────────────────────────────────────────────────
function sair(inscricaoId, motivo, status = "saiu") {
  return db.prepare("UPDATE reativacao_inscricoes SET status = ?, motivoSaida = ?, fimEm = ?, atualizadoEm = ? WHERE id = ? AND status = 'ativa'")
    .run(status, motivo, agoraMs(), agoraMs(), inscricaoId).changes > 0;
}

// WhatsApp de um dia que passou sem sair: fica registrado como pulado.
function fecharWhatsappAnterior(insc) {
  if (!R.DIAS_WHATSAPP.includes(insc.diaAtual)) return;
  registrarWhatsapp({ inscricaoId: insc.id, companyId: insc.companyId, dia: insc.diaAtual }, "pulado", "nao_saiu_no_dia");
}

async function executar(plano) {
  const r = { saidas: 0, concluidas: 0, inscritas: 0, emails: 0, emailsPulados: 0, falhasEmail: 0, whatsapp: null };
  for (const a of plano.acoes) {
    if (a.tipo === "sair" && sair(a.inscricaoId, a.motivo)) r.saidas++;
    if (a.tipo === "concluir") { fecharWhatsappAnterior(a.inscricao); if (sair(a.inscricaoId, "", "concluida")) r.concluidas++; }
  }

  let falhasSeguidas = 0;
  for (const a of plano.acoes.filter((x) => (x.tipo === "passo" || x.tipo === "inscrever") && !x.acimaDoTeto)) {
    if (falhasSeguidas >= 3) break; // provedor com problema: tenta na próxima rodada
    a.cfg = plano.config;
    if (a.tipo === "inscrever") {
      const id = uid();
      const ok = db.prepare(`INSERT INTO reativacao_inscricoes (id, companyId, segmento, inicioEm, atualizadoEm)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`).run(id, a.companyId, a.segmento, plano.agora, plano.agora).changes;
      if (!ok) continue;
      a.inscricaoId = id;
      a.inscricao = { id, companyId: a.companyId, diaAtual: 0, falhasEmail: 0 };
      r.inscritas++;
    }
    const resultado = await enviarEmailDoPasso(a);
    if (resultado === "falhou") {
      falhasSeguidas++;
      r.falhasEmail++;
      const falhas = (a.inscricao.falhasEmail || 0) + 1;
      if (falhas < R.MAX_FALHAS_EMAIL) {
        db.prepare("UPDATE reativacao_inscricoes SET falhasEmail = ?, atualizadoEm = ? WHERE id = ?").run(falhas, agoraMs(), a.inscricaoId);
        continue;
      }
    } else falhasSeguidas = 0;
    if (resultado === "enviado") r.emails++;
    if (resultado === "pulado") r.emailsPulados++;
    fecharWhatsappAnterior(a.inscricao);
    db.prepare("UPDATE reativacao_inscricoes SET diaAtual = ?, ultimoPassoEm = ?, falhasEmail = 0, atualizadoEm = ? WHERE id = ? AND status = 'ativa'")
      .run(a.dia, plano.agora, agoraMs(), a.inscricaoId);
  }

  // WhatsApp: na rodada em que a janela da tarde estiver aberta.
  if (R.janelaWhatsapp(plano.agora)) {
    const depois = planejar(plano.agora).acoes.filter((x) => x.tipo === "whatsapp");
    r.whatsapp = await enviarWhatsapps(depois, plano.agora);
  }
  return r;
}

// ─── Rodada ────────────────────────────────────────────────────────────────
let rodando = false;
let ultimaSimulacao = null;

export function resumirPlano(plano) {
  const linhas = plano.acoes.map((a) => ({
    tipo: a.tipo, empresa: a.empresa, email: a.email, companyId: a.companyId, inscricaoId: a.inscricaoId,
    segmento: a.segmento || a.inscricao?.segmento || "", dia: a.dia || null, motivo: a.motivo || "",
    mensagemEmail: a.texto ? (a.emailPular ? { pular: a.emailPular } : { assunto: a.texto.assunto, acimaDoTeto: !!a.acimaDoTeto }) : null,
    whatsapp: (a.tipo === "whatsapp" || ((a.tipo === "passo" || a.tipo === "inscrever") && R.DIAS_WHATSAPP.includes(a.dia)))
      ? { modelo: R.MODELOS_WHATSAPP[a.dia].nome, pular: a.canais?.motivoWhatsapp || "", horario: `${R.HORA_WHATSAPP}h` } : null,
  }));
  const conta = (t) => linhas.filter((l) => l.tipo === t).length;
  return {
    em: plano.agora, dia: R.dataBrasilia(plano.agora), diaUtil: R.diaUtil(plano.agora),
    totais: {
      inscrever: conta("inscrever"), passos: conta("passo"), whatsapp: linhas.filter((l) => l.whatsapp && !l.whatsapp.pular).length,
      saidas: conta("sair"), concluir: conta("concluir"), adiadasPeloTeto: plano.adiadas,
    },
    linhas,
  };
}

export async function rodada(agora = agoraMs(), { simular = config().simulacao } = {}) {
  if (rodando) return { ocupado: true };
  rodando = true;
  try {
    if (simular) {
      ultimaSimulacao = resumirPlano(planejar(agora));
      const t = ultimaSimulacao.totais;
      if (t.inscrever || t.passos || t.whatsapp || t.saidas) console.log(`[reativacao] simulação: ${JSON.stringify(t)}`);
      return { simulacao: true, ...t };
    }
    return await executar(planejar(agora));
  } finally {
    rodando = false;
  }
}

export function iniciarReativacao() {
  const cfg = config();
  if (!cfg.ligado) return;
  console.log(`[reativacao] ligada${cfg.simulacao ? " em modo simulação (nada é enviado)" : ""}`);
  const tick = () => rodada().catch((e) => console.error("[reativacao] rodada:", e.message));
  setTimeout(tick, 90 * 1000).unref?.();
  setInterval(tick, 15 * 60 * 1000).unref?.();
}

// ─── Respostas no WhatsApp (webhook da Meta) ───────────────────────────────
// Idempotente pelo wamid da resposta: a Meta reenvia avisos.
export async function processarRespostas(corpo) {
  if (corpo?.object !== "whatsapp_business_account") return 0;
  let n = 0;
  for (const entrada of corpo.entry || []) {
    for (const mudanca of entrada.changes || []) {
      for (const m of mudanca.value?.messages || []) {
        const payload = m.type === "button" ? m.button?.payload : m.interactive?.button_reply?.id;
        const p = R.lerPayload(payload);
        if (!p || !m.id || !m.from) continue;
        const insc = p.inscricaoId ? db.prepare("SELECT * FROM reativacao_inscricoes WHERE id = ?").get(p.inscricaoId) : null;
        const novo = db.prepare("INSERT OR IGNORE INTO reativacao_respostas (wamid, inscricaoId, companyId, acao, de, em) VALUES (?, ?, ?, ?, ?, ?)")
          .run(String(m.id), insc?.id || "", insc?.companyId || "", p.acao, String(m.from), agoraMs()).changes;
        if (!novo) continue;
        n++;
        await tratarResposta(p.acao, insc, String(m.from)).catch((e) => console.warn("[reativacao] resposta:", e.message));
      }
    }
  }
  return n;
}

async function tratarResposta(acao, insc, numero) {
  if (acao === "parar") {
    if (insc) {
      db.prepare("UPDATE companies SET whatsappMarketingSaiuEm = COALESCE(whatsappMarketingSaiuEm, ?) WHERE id = ?").run(agoraMs(), insc.companyId);
      sair(insc.id, "whatsapp_parar");
    }
    return;
  }
  if (acao !== "agendar") return; // "Agora não": só fica registrado
  const cfg = config();
  const c = insc ? db.prepare(sqlEmpresas + " WHERE c.id = ?").get(insc.companyId) : null;
  if (wa.envioConfigurado()) {
    const texto = cfg.linkAgenda
      ? `Ótimo! Escolha o melhor horário aqui: ${cfg.linkAgenda}\n\nAté já,\nMartin, da Rycs`
      : "Ótimo! Vou te chamar por aqui para combinar o melhor horário.\n\nMartin, da Rycs";
    await wa.enviarTexto({ numero, texto }).catch((e) => console.warn("[reativacao] resposta agendar:", e.message));
  }
  if (cfg.avisoEmail) {
    const linhas = [
      `<p><b>${c ? escHtml(c.nome) : "Uma empresa"}</b> tocou em "Quero agendar" no WhatsApp da reativação.</p>`,
      `<p>WhatsApp: +${escHtml(numero)}<br/>E-mail: ${c ? escHtml(c.email) : "-"}</p>`,
      cfg.linkAgenda ? "<p>O link da agenda já foi enviado para ela.</p>" : "<p>Ainda não há link de agenda configurado: chame a empresa pelo WhatsApp.</p>",
    ];
    await sendEmail(cfg.avisoEmail, `Reativação: ${c?.nome || "empresa"} quer agendar`, linhas.join(""));
  }
}
const escHtml = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ─── Teste interno ─────────────────────────────────────────────────────────
// Envia todos os e-mails (dia 1 nas duas versões) e os modelos aprovados para
// um e-mail e um número informados pelo admin.
export async function enviarTeste({ email, numero }) {
  const cfg = config();
  const dados = { nome: "Martin", empresa: "Empresa de teste", vendedoresAtivos: vendedoresAtivos(), diasInativo: cfg.diasInativo, linkAgenda: cfg.linkAgenda, prazoOferta: "" };
  const emails = [];
  if (email) {
    const passos = [[1, "nunca_ativou"], [1, "parou_de_usar"], ...[2, 3, 4, 5, 6, 7].map((d) => [d, "nunca_ativou"])];
    for (const [dia, segmento] of passos) {
      const texto = R.textoEmail(dia, segmento, dados);
      if (texto.pular) { emails.push({ dia, segmento, pulado: texto.pular }); continue; }
      const m = montarEmail({ dia, segmento, texto, email, cfg });
      const r = await sendEmail(email, `[Teste] ${m.assunto}`, m.html, m.opcoes);
      emails.push({ dia, segmento, ok: !!r?.ok, erro: r?.ok ? "" : r?.error || "" });
      await esperar(600);
    }
  }
  const whatsapp = [];
  const alvo = numero ? wa.numeroWhatsapp(`+${String(numero).replace(/\D/g, "")}`) : "";
  if (numero && !alvo) whatsapp.push({ erro: "Número inválido. Use DDI + DDD + número." });
  else if (alvo) {
    const modelos = await modelosAprovados();
    for (const dia of R.DIAS_WHATSAPP) {
      const nome = R.MODELOS_WHATSAPP[dia].nome;
      const tpl = modelos?.get(nome);
      if (!tpl) { whatsapp.push({ dia, modelo: nome, pulado: modelos ? "modelo_nao_aprovado" : "whatsapp_nao_configurado" }); continue; }
      try {
        const wamid = await wa.enviarTemplate({ numero: alvo, tpl, componentes: componentesWhatsapp(dia, R.parametrosWhatsapp(dia, dados), "teste") });
        whatsapp.push({ dia, modelo: nome, ok: true, wamid });
      } catch (e) {
        whatsapp.push({ dia, modelo: nome, ok: false, erro: wa.descreverErro(e) });
        if (wa.erroFatal(e)) break;
      }
    }
  }
  return { emails, whatsapp };
}

// ─── Métricas ──────────────────────────────────────────────────────────────
export function metricas() {
  const inscricoes = db.prepare(`SELECT segmento, status, motivoSaida, COUNT(*) AS n FROM reativacao_inscricoes
    GROUP BY segmento, status, motivoSaida ORDER BY segmento, status`).all();
  const email = db.prepare(`SELECT CAST(substr(chave, ${R.SEQ.length + 3}, 1) AS INTEGER) AS dia,
      SUM(status = 'enviado') AS enviados, SUM(status = 'pulado') AS pulados, SUM(status = 'falhou') AS falhas,
      SUM(entregueEm IS NOT NULL) AS entregues, SUM(abertoEm IS NOT NULL) AS abertos, SUM(clicadoEm IS NOT NULL) AS clicados,
      SUM(devolvidoEm IS NOT NULL) AS devolvidos, SUM(spamEm IS NOT NULL) AS spam
    FROM email_sequencia_envios WHERE sequencia = ? GROUP BY dia ORDER BY dia`).all(R.SEQ);
  const whatsapp = db.prepare(`SELECT w.dia, SUM(w.status = 'enviado') AS enviados, SUM(w.status = 'pulado') AS pulados, SUM(w.status = 'falhou') AS falhas,
      SUM(EXISTS (SELECT 1 FROM whatsapp_status s WHERE s.wamid = w.wamid AND w.wamid <> '' AND s.status IN ('delivered','read'))) AS entregues,
      SUM(EXISTS (SELECT 1 FROM whatsapp_status s WHERE s.wamid = w.wamid AND w.wamid <> '' AND s.status = 'read')) AS lidos
    FROM reativacao_whatsapp w GROUP BY w.dia ORDER BY w.dia`).all();
  const respostas = db.prepare("SELECT acao, COUNT(*) AS n FROM reativacao_respostas WHERE inscricaoId <> '' GROUP BY acao").all();

  // Reativadas: em que dia saíram e qual canal tocou por último (clique no
  // e-mail ou resposta no WhatsApp contam antes do simples envio).
  const reativadas = db.prepare("SELECT id, segmento, diaAtual, fimEm FROM reativacao_inscricoes WHERE motivoSaida = 'reativada'").all();
  const ultimoEmail = db.prepare(`SELECT MAX(enviadoEm) AS em, MAX(clicadoEm) AS clique FROM email_sequencia_envios
    WHERE sequencia = ? AND status = 'enviado' AND chave LIKE ? AND enviadoEm <= ?`);
  const ultimoWa = db.prepare("SELECT MAX(enviadoEm) AS em FROM reativacao_whatsapp WHERE inscricaoId = ? AND status = 'enviado' AND enviadoEm <= ?");
  const respondeu = db.prepare("SELECT 1 FROM reativacao_respostas WHERE inscricaoId = ? AND acao = 'agendar' LIMIT 1");
  const porDia = {};
  const porCanal = { email: 0, whatsapp: 0, sem_contato: 0 };
  for (const i of reativadas) {
    const e = ultimoEmail.get(R.SEQ, `%@${i.id}`, i.fimEm);
    const w = ultimoWa.get(i.id, i.fimEm);
    const canal = e.clique ? "email" : respondeu.get(i.id) ? "whatsapp"
      : !e.em && !w.em ? "sem_contato" : (w.em || 0) > (e.em || 0) ? "whatsapp" : "email";
    porCanal[canal]++;
    porDia[i.diaAtual] = (porDia[i.diaAtual] || 0) + 1;
  }
  const taxa = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const somaEmail = email.reduce((s, d) => ({ enviados: s.enviados + d.enviados, abertos: s.abertos + d.abertos, clicados: s.clicados + d.clicados }), { enviados: 0, abertos: 0, clicados: 0 });
  return {
    inscricoes, email: email.map((d) => ({ ...d, taxaAbertura: taxa(d.abertos, d.enviados), taxaClique: taxa(d.clicados, d.enviados) })),
    whatsapp, respostas,
    totais: { ...somaEmail, taxaAbertura: taxa(somaEmail.abertos, somaEmail.enviados), taxaClique: taxa(somaEmail.clicados, somaEmail.enviados), reativadas: reativadas.length },
    reativadas: { porDia, porCanal },
  };
}

export function painel() {
  const { ligado, simulacao, diasInativo, maxEmailsDia, linkAgenda, avisoEmail, remetente } = config();
  return {
    config: { ligado, simulacao, diasInativo, maxEmailsDia, temLinkAgenda: !!linkAgenda, temAviso: !!avisoEmail, temRemetente: !!remetente, whatsappConfigurado: wa.envioConfigurado() },
    pendencias: { caseDia4: !R.CASE, ofertaDia6: !R.OFERTA, linkAgendaDia5: !linkAgenda },
    metricas: metricas(),
    ultimaSimulacao,
  };
}

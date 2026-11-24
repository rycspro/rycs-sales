// Grupo de suporte da empresa no WhatsApp, criado e enviado depois do primeiro
// pagamento do plano.
//
// Criar grupo pela API da Meta só é permitido a conta oficial verificada
// ("Official Business Account"). Enquanto o número da RYCS não for, vale o que
// o admin preparar: o link próprio da empresa ou o grupo padrão. Sem nenhum
// dos dois, o admin é avisado e o convite sai assim que o link entrar.
//
// O convite vai no sistema, por e-mail e pelo WhatsApp oficial, com os mesmos
// freios dos lembretes: só modelo aprovado (ou conversa aberta nas últimas
// 24h), nada para quem pediu para sair, nada com a Meta limitando o número,
// nada entre 22h e 7h. Cada empresa recebe uma vez.

import { randomBytes } from "node:crypto";
import db, { agora } from "../db.js";
import { graph } from "./meta.js";
import { lerCampos } from "./whatsappConta.js";
import { notificar } from "../routes/notifications.js";
import { urlApp } from "./email.js";
import {
  envioConfigurado, enviarTemplate, enviarTexto, numeroWhatsapp, descadastrados, variacoes, bloqueioRecente,
  registrarSaida, listarTemplates, erroFatal, descreverErro,
} from "./whatsappDisparo.js";
import { horarioSilencioso } from "../../shared/lembretesReuniao.js";
import { linkDeGrupo, nomeDoGrupo, MODELO_GRUPO } from "../../shared/grupoSuporte.js";

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const JANELA = 24 * HORA;
const MAX_TENTATIVAS = 5;

db.exec(`
  CREATE TABLE IF NOT EXISTS grupos_suporte (
    companyId TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'aguardando_link',
    origem TEXT NOT NULL DEFAULT '',
    groupId TEXT NOT NULL DEFAULT '',
    requestId TEXT NOT NULL DEFAULT '',
    assunto TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    envio TEXT NOT NULL DEFAULT 'pendente',
    erro TEXT NOT NULL DEFAULT '',
    tentativas INTEGER NOT NULL DEFAULT 0,
    proximaEm INTEGER NOT NULL DEFAULT 0,
    adminAvisadoEm INTEGER,
    avisadoEm INTEGER,
    enviadoEm INTEGER,
    pagoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_grupos_suporte_fila ON grupos_suporte(status, envio, proximaEm);
  CREATE TABLE IF NOT EXISTS grupos_suporte_config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
`);

const de = db.prepare("SELECT * FROM grupos_suporte WHERE companyId = ?");
const ADMINS = db.prepare("SELECT id FROM users WHERE role = 'admin'");
const lerConfig = (chave) => db.prepare("SELECT valor FROM grupos_suporte_config WHERE chave = ?").get(chave)?.valor || "";

export const linkPadrao = () => lerConfig("linkPadrao");
export function definirLinkPadrao(valor) {
  const link = valor ? linkDeGrupo(valor) : "";
  if (valor && !link) throw new Error("Cole o link de convite do grupo (https://chat.whatsapp.com/...).");
  db.prepare("INSERT INTO grupos_suporte_config (chave, valor) VALUES ('linkPadrao', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").run(link);
  if (link) db.prepare("UPDATE grupos_suporte SET proximaEm = 0 WHERE status = 'aguardando_link'").run();
  return link;
}

// Primeiro pagamento confirmado. Idempotente: uma linha por empresa. Nunca
// lança, porque roda dentro do webhook do pagamento.
export function aoPagarPlano(companyId) {
  try {
    if (!companyId || !db.prepare("SELECT 1 FROM companies WHERE id = ?").get(companyId)) return false;
    const t = agora();
    return db.prepare("INSERT OR IGNORE INTO grupos_suporte (companyId, token, pagoEm, atualizadoEm) VALUES (?, ?, ?, ?)")
      .run(companyId, randomBytes(16).toString("hex"), t, t).changes > 0;
  } catch (e) {
    console.error("[grupo-suporte] pagamento:", e?.message);
    return false;
  }
}

function gravarLink(companyId, link, origem, groupId = "") {
  db.prepare(`UPDATE grupos_suporte SET link = ?, origem = ?, groupId = CASE WHEN ? != '' THEN ? ELSE groupId END, status = 'pronto',
    erro = '', proximaEm = 0, atualizadoEm = ? WHERE companyId = ?`).run(link, origem, groupId, groupId, agora(), companyId);
}

export function definirLink(companyId, valor) {
  const link = linkDeGrupo(valor);
  if (!link) throw new Error("Cole o link de convite do grupo (https://chat.whatsapp.com/...).");
  aoPagarPlano(companyId);
  if (!de.get(companyId)) throw new Error("Empresa não encontrada.");
  gravarLink(companyId, link, "manual");
  return de.get(companyId);
}

// ── Grupo pela API da Meta (só conta oficial) ─────────────────────────────

let cacheOficial = { em: 0, valor: false };
async function contaOficial() {
  if (Date.now() - cacheOficial.em < 12 * HORA) return cacheOficial.valor;
  let valor = false;
  try { valor = (await lerCampos(process.env.WHATSAPP_PHONE_NUMBER_ID, ["is_official_business_account"])).is_official_business_account === true; }
  catch (e) { console.warn("[grupo-suporte] conta oficial:", e?.message); }
  cacheOficial = { em: Date.now(), valor };
  return valor;
}
export const esquecerContaOficial = () => { cacheOficial = { em: 0, valor: false }; };

async function pedirGrupo(g, empresa) {
  const assunto = nomeDoGrupo(empresa.nome);
  const r = await graph(`/${process.env.WHATSAPP_PHONE_NUMBER_ID}/groups`, {
    token: process.env.WHATSAPP_TOKEN, metodo: "POST",
    dados: { messaging_product: "whatsapp", subject: assunto, description: "Grupo de suporte da RYCS com a sua empresa.", join_approval_mode: "auto_approve" },
  });
  // O link chega depois, pelo webhook group_lifecycle_update.
  db.prepare("UPDATE grupos_suporte SET status = 'criando', assunto = ?, requestId = ?, groupId = ?, proximaEm = ?, atualizadoEm = ? WHERE companyId = ?")
    .run(assunto, String(r?.request_id || ""), String(r?.group_id || r?.groups?.[0]?.id || ""), agora() + HORA, agora(), g.companyId);
}

// Aviso da Meta: grupo criado (com o link) ou recusado.
export function receberAvisoGrupo(corpo) {
  if (corpo?.object !== "whatsapp_business_account") return 0;
  let n = 0;
  for (const entrada of corpo.entry || []) for (const mudanca of entrada.changes || []) {
    if (mudanca.field !== "group_lifecycle_update") continue;
    for (const grupo of mudanca.value?.groups || []) {
      if (grupo?.type !== "group_create") continue;
      const g = (grupo.request_id && db.prepare("SELECT * FROM grupos_suporte WHERE requestId = ? AND status = 'criando'").get(String(grupo.request_id)))
        || (grupo.group_id && db.prepare("SELECT * FROM grupos_suporte WHERE groupId = ? AND status = 'criando'").get(String(grupo.group_id)))
        || (grupo.subject && db.prepare("SELECT * FROM grupos_suporte WHERE assunto = ? AND status = 'criando' ORDER BY atualizadoEm LIMIT 1").get(String(grupo.subject)));
      if (!g) continue;
      const link = linkDeGrupo(grupo.invite_link);
      if (link) gravarLink(g.companyId, link, "api", String(grupo.group_id || ""));
      else {
        const motivo = (grupo.errors || []).map((e) => [e.code, e.title || e.message].filter(Boolean).join(" ")).join("; ") || "A Meta não devolveu o link do grupo.";
        db.prepare("UPDATE grupos_suporte SET status = 'aguardando_link', erro = ?, proximaEm = 0, atualizadoEm = ? WHERE companyId = ?").run(motivo.slice(0, 300), agora(), g.companyId);
      }
      n++;
    }
  }
  return n;
}

async function prepararGrupo(g, empresa) {
  const padrao = linkPadrao();
  // A API já falhou para esta empresa: não insiste, segue pelo link do admin.
  if (!g.erro && envioConfigurado() && await contaOficial()) {
    try { await pedirGrupo(g, empresa); return; }
    catch (e) { db.prepare("UPDATE grupos_suporte SET erro = ? WHERE companyId = ?").run(descreverErro(e), g.companyId); }
  }
  if (padrao) { gravarLink(g.companyId, padrao, "padrao"); return; }
  if (!g.adminAvisadoEm) {
    for (const u of ADMINS.all()) notificar(u.id, "suporte", "Criar grupo de suporte", `${empresa.nome} pagou o plano. Crie o grupo no WhatsApp e cole o link em WhatsApp → Grupos de suporte: o convite sai sozinho.`);
  }
  db.prepare("UPDATE grupos_suporte SET adminAvisadoEm = COALESCE(adminAvisadoEm, ?), proximaEm = ?, atualizadoEm = ? WHERE companyId = ?")
    .run(agora(), agora() + HORA, agora(), g.companyId);
}

// ── Convite ───────────────────────────────────────────────────────────────

let cacheModelo = { em: 0, ok: false };
async function modeloAprovado() {
  if (Date.now() - cacheModelo.em < 10 * MIN) return cacheModelo.ok;
  let ok = false;
  try { ok = (await listarTemplates()).some((t) => t.nome === MODELO_GRUPO.nome && t.idioma === MODELO_GRUPO.idioma); }
  catch (e) { console.warn("[grupo-suporte] modelos:", e?.message); }
  cacheModelo = { em: Date.now(), ok };
  return ok;
}
export const esquecerModelo = () => { cacheModelo = { em: 0, ok: false }; };

const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";
export const paginaDoGrupo = (token) => `${urlApp()}/grupo-suporte/?t=${token}`;

// Número que escreveu nas últimas 24h: dá para mandar texto livre (grátis).
function conversaAberta(numero, t) {
  const vs = variacoes(numero);
  return db.prepare(`SELECT de FROM whatsapp_mensagens WHERE de IN (${vs.map(() => "?").join(",")}) AND COALESCE(enviadoEm, recebidoEm) > ?
    ORDER BY COALESCE(enviadoEm, recebidoEm) DESC LIMIT 1`).get(...vs, t - JANELA + 5 * MIN)?.de || "";
}

async function enviarConvite(g, empresa) {
  const t = agora();
  if (!g.avisadoEm) {
    const u = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(g.companyId);
    if (u) notificar(u.id, "suporte", "Seu grupo de suporte no WhatsApp está pronto", `Entre no grupo para falar com a equipe da RYCS: ${paginaDoGrupo(g.token)}`);
    db.prepare("UPDATE grupos_suporte SET avisadoEm = ? WHERE companyId = ?").run(t, g.companyId);
  }
  const marcar = (envio, { erro = "", proximaEm = 0, enviadoEm = null } = {}) =>
    db.prepare("UPDATE grupos_suporte SET envio = ?, erro = ?, proximaEm = ?, enviadoEm = COALESCE(?, enviadoEm), atualizadoEm = ? WHERE companyId = ?")
      .run(envio, erro, proximaEm, enviadoEm, t, g.companyId);

  const numero = numeroWhatsapp(empresa.whatsapp, !empresa.pais || empresa.pais === "BR" ? "Brasil" : empresa.pais);
  if (!numero) return marcar("sem_numero");
  const saiu = descadastrados();
  if (variacoes(numero).some((v) => saiu.has(v))) return marcar("pediu_para_sair");
  if (!envioConfigurado()) return marcar("pendente", { erro: "WhatsApp não configurado no servidor", proximaEm: t + HORA });
  if (bloqueioRecente()) return marcar("pendente", { erro: "a Meta está limitando o número; envio suspenso", proximaEm: t + HORA });
  if (horarioSilencioso(t)) return marcar("pendente", { proximaEm: t + 30 * MIN });

  const nome = primeiroNome(empresa.representanteLegal) || empresa.nome;
  try {
    const aberto = conversaAberta(numero, t);
    if (aberto) {
      await enviarTexto({ numero: aberto, origem: "Grupo de suporte", texto: `Olá, ${nome}! O pagamento do plano da ${empresa.nome} foi confirmado. Este é o grupo de suporte da sua empresa na RYCS: ${g.link}` });
    } else if (await modeloAprovado()) {
      const componentes = [
        { type: "body", parameters: [nome, empresa.nome].map((text) => ({ type: "text", text: String(text) })) },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: `grupo-suporte/?t=${g.token}` }] },
      ];
      const wamid = await enviarTemplate({ numero, tpl: MODELO_GRUPO, componentes });
      registrarSaida({ numero, tipo: "template", modelo: MODELO_GRUPO.nome, texto: "Convite para o grupo de suporte", origem: "Grupo de suporte", wamid });
    } else return marcar("aguardando_modelo", { proximaEm: t + 10 * MIN });
    marcar("enviado", { enviadoEm: t });
  } catch (e) {
    const tentativas = g.tentativas + 1;
    db.prepare("UPDATE grupos_suporte SET tentativas = ? WHERE companyId = ?").run(tentativas, g.companyId);
    const desistir = erroFatal(e) || tentativas >= MAX_TENTATIVAS;
    marcar(desistir ? "erro" : "pendente", { erro: descreverErro(e), proximaEm: t + 10 * MIN * tentativas });
    console.warn("[grupo-suporte] envio:", e?.message);
  }
}

// Reenvio pedido pelo admin.
export function pedirEnvio(companyId) {
  aoPagarPlano(companyId);
  if (!de.get(companyId)) throw new Error("Empresa não encontrada.");
  db.prepare("UPDATE grupos_suporte SET envio = 'pendente', erro = '', tentativas = 0, proximaEm = 0, atualizadoEm = ? WHERE companyId = ?").run(agora(), companyId);
  return de.get(companyId);
}

let rodando = false;
export async function processarGrupos() {
  if (rodando) return;
  rodando = true;
  try {
    const t = agora();
    const fila = db.prepare(`SELECT g.*, c.nome, c.whatsapp, c.pais, c.representanteLegal FROM grupos_suporte g JOIN companies c ON c.id = g.companyId
      WHERE g.proximaEm <= ? AND (g.status IN ('aguardando_link', 'criando') OR (g.status = 'pronto' AND g.envio IN ('pendente', 'aguardando_modelo')))
      ORDER BY g.pagoEm LIMIT 20`).all(t);
    for (const linha of fila) {
      const empresa = { nome: linha.nome, whatsapp: linha.whatsapp, pais: linha.pais, representanteLegal: linha.representanteLegal };
      try {
        let g = linha;
        // A Meta não respondeu em 1 hora: segue pelo caminho do admin.
        if (g.status === "criando") {
          db.prepare("UPDATE grupos_suporte SET status = 'aguardando_link', erro = 'A Meta não confirmou a criação do grupo.' WHERE companyId = ?").run(g.companyId);
          g = { ...g, ...de.get(g.companyId) };
        }
        if (g.status === "aguardando_link") { await prepararGrupo(g, empresa); g = de.get(g.companyId); }
        if (g.status === "pronto") await enviarConvite(g, empresa);
      } catch (e) { console.error("[grupo-suporte]", linha.companyId, e?.message); }
    }
  } finally { rodando = false; }
}

export function iniciarGruposSuporte() {
  setTimeout(() => processarGrupos().catch(() => null), 8000).unref?.();
  setInterval(() => processarGrupos().catch((e) => console.error("[grupo-suporte]", e?.message)), MIN).unref?.();
}

// ── Leitura ───────────────────────────────────────────────────────────────

export function grupoDaEmpresa(companyId) {
  const g = de.get(companyId);
  return g?.link ? { link: g.link, pagina: paginaDoGrupo(g.token) } : null;
}
export function grupoDoToken(token) {
  if (!/^[a-f0-9]{32}$/.test(String(token || ""))) return null;
  const g = db.prepare("SELECT g.link, c.nome FROM grupos_suporte g JOIN companies c ON c.id = g.companyId WHERE g.token = ?").get(String(token));
  return g?.link ? { empresa: g.nome, link: g.link } : null;
}
export async function painelGrupos() {
  const itens = db.prepare(`SELECT c.id AS companyId, c.nome, c.assinatura, c.whatsapp, g.status, g.origem, g.link, g.envio, g.erro, g.pagoEm, g.avisadoEm, g.enviadoEm
    FROM companies c LEFT JOIN grupos_suporte g ON g.companyId = c.id
    WHERE g.companyId IS NOT NULL OR EXISTS (SELECT 1 FROM subscriptions s WHERE s.companyId = c.id AND s.status = 'ativa')
    ORDER BY COALESCE(g.pagoEm, 0) DESC, c.nome`).all();
  return {
    itens, linkPadrao: linkPadrao(), modelo: MODELO_GRUPO,
    modeloAprovado: envioConfigurado() ? await modeloAprovado() : false,
    contaOficial: envioConfigurado() ? await contaOficial() : false,
  };
}

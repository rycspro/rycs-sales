// Conversas do WhatsApp oficial da RYCS, para o admin ler e responder à mão.
//
// O número vive só na API da Meta (não existe em nenhum celular), então esta é
// a caixa de entrada dele. Junta o que as pessoas mandaram (webhook) com tudo o
// que saiu para elas: disparos, reativação de empresas, respostas automáticas e
// respostas do admin.
//
// Regra da Meta: texto livre só dentro de 24h depois da última mensagem da
// pessoa (e é grátis). Fora disso, só modelo aprovado.

import db from "../db.js";
import {
  variacoes, numeroWhatsapp, pedidoDeSaida, enviarTexto, enviarTemplate, registrarSaida, listarTemplates,
  validarVariaveis, montarComponentes, descadastrados, bloqueioRecente,
} from "./whatsappDisparo.js";
import { mensagemDoDisparo, mensagemDaReativacao, tabelaExiste } from "./whatsappMetricas.js";

export const JANELA_MS = 24 * 60 * 60 * 1000;
const LIMITE_TEXTO = 4096;

db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_conversas_lidas (
    numero TEXT PRIMARY KEY,
    lidoEm INTEGER NOT NULL
  );
`);

// O mesmo contato com e sem o nono dígito vira uma chave só (a com o nove).
export function chaveNumero(n) {
  const d = String(n || "").replace(/\D/g, "");
  if (/^55\d{10}$/.test(d) && /[6-9]/.test(d[4])) return `${d.slice(0, 4)}9${d.slice(4)}`;
  return d;
}

const primeiroNome = (nome) => {
  const p = String(nome || "").trim().split(/\s+/)[0] || "";
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : "";
};

// Quem é o número na plataforma (profissional ou empresa).
function cadastros() {
  const m = new Map();
  for (const s of db.prepare("SELECT id, nome, whats, pais FROM sellers").all()) {
    const k = chaveNumero(numeroWhatsapp(s.whats, s.pais));
    if (k && !m.has(k)) m.set(k, { tipo: "Profissional", id: s.id, nome: s.nome || "" });
  }
  for (const c of db.prepare("SELECT id, nome, whatsapp, pais FROM companies WHERE COALESCE(whatsapp, '') <> ''").all()) {
    const k = chaveNumero(numeroWhatsapp(c.whatsapp, !c.pais || c.pais === "BR" ? "Brasil" : c.pais));
    if (k && !m.has(k)) m.set(k, { tipo: "Empresa", id: c.id, nome: c.nome || "" });
  }
  return m;
}

const sqlRecebidas = db.prepare(`SELECT wamid, de, nome, tipo, texto, respondendoA, COALESCE(enviadoEm, recebidoEm) AS em,
  json_extract(dados, '$.button.payload') AS payload FROM whatsapp_mensagens ORDER BY em`);

const rotuloTipo = { image: "Foto", audio: "Áudio", video: "Vídeo", document: "Documento", sticker: "Figurinha", location: "Localização", contacts: "Contato", reaction: "Reação" };
const textoRecebido = (r) => {
  const extra = rotuloTipo[r.tipo];
  if (!extra) return r.texto || `(${r.tipo})`;
  return r.texto ? `[${extra}] ${r.texto}` : `[${extra}]`;
};

// Tudo o que saiu para cada número, só com o necessário para a lista.
function saidasResumo() {
  const linhas = db.prepare(`SELECT e.numero, e.enviadoEm AS em, d.template AS modelo FROM whatsapp_envios e
    JOIN whatsapp_disparos d ON d.id = e.disparoId WHERE e.status = 'enviado'`).all().map((l) => ({ ...l, texto: `Modelo ${l.modelo}` }));
  if (tabelaExiste("reativacao_whatsapp")) {
    linhas.push(...db.prepare("SELECT numero, enviadoEm AS em, modelo FROM reativacao_whatsapp WHERE status = 'enviado'").all()
      .map((l) => ({ ...l, texto: `Modelo ${l.modelo}` })));
  }
  linhas.push(...db.prepare("SELECT numero, enviadoEm AS em, texto, modelo FROM whatsapp_saidas").all());
  return linhas;
}

// Lista de conversas. `filtro`: "respostas" (quem escreveu para a RYCS) ou "todas".
export function listarConversas({ filtro = "respostas", busca = "", agoraMs = Date.now() } = {}) {
  const quem = cadastros();
  const lidas = new Map(db.prepare("SELECT numero, lidoEm FROM whatsapp_conversas_lidas").all().map((l) => [l.numero, l.lidoEm]));
  const por = new Map();
  const conversa = (k) => {
    if (!por.has(k)) por.set(k, { numero: k, destino: k, nomeWhatsapp: "", recebidas: 0, naoLidas: 0, ultimaRecebida: null, ultima: null, saiu: false });
    return por.get(k);
  };
  for (const r of sqlRecebidas.all()) {
    const c = conversa(chaveNumero(r.de));
    c.recebidas++;
    c.destino = String(r.de);
    if (r.nome) c.nomeWhatsapp = r.nome;
    if (r.em > (lidas.get(c.numero) || 0)) c.naoLidas++;
    if (!c.ultimaRecebida || r.em >= c.ultimaRecebida) c.ultimaRecebida = r.em;
    if (pedidoDeSaida(r)) c.saiu = true;
    if (!c.ultima || r.em >= c.ultima.em) c.ultima = { direcao: "recebida", texto: textoRecebido(r), em: r.em };
  }
  for (const s of saidasResumo()) {
    const c = conversa(chaveNumero(s.numero));
    if (s.em && (!c.ultima || s.em >= c.ultima.em)) c.ultima = { direcao: "enviada", texto: s.texto, em: s.em };
  }
  const termo = String(busca || "").trim().toLowerCase();
  return [...por.values()]
    .map((c) => {
      const cad = quem.get(c.numero) || null;
      return {
        ...c, cadastro: cad, nome: cad?.nome || c.nomeWhatsapp || "",
        janelaAte: c.ultimaRecebida && c.ultimaRecebida + JANELA_MS > agoraMs ? c.ultimaRecebida + JANELA_MS : null,
      };
    })
    .filter((c) => (filtro === "todas" || c.recebidas > 0) && c.ultima)
    .filter((c) => !termo || c.numero.includes(termo.replace(/\D/g, "") || "§") || c.nome.toLowerCase().includes(termo))
    .sort((a, b) => b.ultima.em - a.ultima.em);
}

const sqlStatus = db.prepare("SELECT status, erro FROM whatsapp_status WHERE wamid = ?");
const ORDEM = { sent: 1, delivered: 2, read: 3 };
function situacao(wamid) {
  if (!wamid) return { status: "", erro: "" };
  let melhor = "";
  for (const s of sqlStatus.all(wamid)) {
    if (s.status === "failed") return { status: "failed", erro: s.erro || "" };
    if ((ORDEM[s.status] || 0) > (ORDEM[melhor] || 0)) melhor = s.status;
  }
  return { status: melhor || "sent", erro: "" };
}

// Histórico completo de um número, do mais antigo para o mais novo. Marca como lida.
export function abrirConversa(numero, { agoraMs = Date.now() } = {}) {
  const k = chaveNumero(numero);
  if (!k) return null;
  const vs = variacoes(k);
  const em = (sql) => db.prepare(sql.replace("§", vs.map(() => "?").join(","))).all(...vs);
  const itens = [];

  let ultimaRecebida = null;
  let destino = k;
  let nomeWhatsapp = "";
  let saiu = false;
  for (const r of em(`SELECT wamid, de, nome, tipo, texto, respondendoA, COALESCE(enviadoEm, recebidoEm) AS em,
      json_extract(dados, '$.button.payload') AS payload FROM whatsapp_mensagens WHERE de IN (§)`)) {
    const s = pedidoDeSaida(r);
    if (s) saiu = true;
    if (!ultimaRecebida || r.em >= ultimaRecebida) { ultimaRecebida = r.em; destino = String(r.de); }
    if (r.nome) nomeWhatsapp = r.nome;
    itens.push({ id: r.wamid, direcao: "recebida", texto: textoRecebido(r), em: r.em, tipo: r.tipo, saida: s });
  }
  for (const e of em(`SELECT e.id, e.nome, e.wamid, e.status, e.erro, e.enviadoEm, e.parametros, d.template, d.idioma, d.templateDados, d.variaveis
      FROM whatsapp_envios e JOIN whatsapp_disparos d ON d.id = e.disparoId WHERE e.numero IN (§) AND e.status IN ('enviado', 'falhou')`)) {
    const m = mensagemDoDisparo(e);
    itens.push({ id: e.id, direcao: "enviada", origem: "Disparo", modelo: e.template, texto: m.corpo, botoes: m.botoes, rodape: m.rodape,
      em: e.enviadoEm, ...(e.status === "falhou" ? { status: "failed", erro: e.erro } : situacao(e.wamid)) });
  }
  if (tabelaExiste("reativacao_whatsapp")) {
    for (const w of em("SELECT id, dia, modelo, wamid, status, erro, enviadoEm FROM reativacao_whatsapp WHERE numero IN (§) AND status IN ('enviado', 'falhou')")) {
      const m = mensagemDaReativacao(w.dia);
      itens.push({ id: w.id, direcao: "enviada", origem: "Reativação de empresas", modelo: w.modelo, texto: m.corpo, botoes: m.botoes,
        em: w.enviadoEm, ...(w.status === "falhou" ? { status: "failed", erro: w.erro } : situacao(w.wamid)) });
    }
  }
  for (const s of em("SELECT id, tipo, texto, modelo, origem, wamid, enviadoEm FROM whatsapp_saidas WHERE numero IN (§)")) {
    itens.push({ id: s.id, direcao: "enviada", origem: s.origem, modelo: s.modelo, texto: s.texto, em: s.enviadoEm, ...situacao(s.wamid) });
  }
  itens.sort((a, b) => (a.em || 0) - (b.em || 0));

  db.prepare("INSERT INTO whatsapp_conversas_lidas (numero, lidoEm) VALUES (?, ?) ON CONFLICT(numero) DO UPDATE SET lidoEm = excluded.lidoEm")
    .run(k, agoraMs);
  const cad = cadastros().get(k) || null;
  return {
    numero: k, destino, cadastro: cad, nome: cad?.nome || nomeWhatsapp || "", nomeWhatsapp, saiu,
    janelaAte: ultimaRecebida && ultimaRecebida + JANELA_MS > agoraMs ? ultimaRecebida + JANELA_MS : null,
    itens,
  };
}

const erro = (msg) => Object.assign(new Error(msg), { validacao: true });

// Resposta em texto livre, dentro da janela de 24h. Vai para o número exato que
// escreveu (o WhatsApp às vezes identifica o celular sem o nono dígito).
export async function responder(numero, texto, { adminId = "", agoraMs = Date.now() } = {}) {
  const t = String(texto || "").trim();
  if (!t) throw erro("Escreva a mensagem.");
  if (t.length > LIMITE_TEXTO) throw erro(`Mensagem muito longa (máximo ${LIMITE_TEXTO} caracteres).`);
  const vs = variacoes(chaveNumero(numero));
  const ultima = db.prepare(`SELECT de, COALESCE(enviadoEm, recebidoEm) AS em FROM whatsapp_mensagens
    WHERE de IN (${vs.map(() => "?").join(",")}) ORDER BY em DESC LIMIT 1`).get(...vs);
  if (!ultima || ultima.em + JANELA_MS <= agoraMs) throw erro("Passaram 24h desde a última mensagem desta pessoa. Agora só dá para mandar um modelo aprovado.");
  const wamid = await enviarTexto({ numero: String(ultima.de), texto: t, origem: "Resposta do admin", adminId });
  return { wamid };
}

// Modelo aprovado mandado para uma pessoa só (para retomar a conversa depois de 24h).
export async function enviarModelo(numero, { template, idioma, variaveis }, { adminId = "" } = {}) {
  if (bloqueioRecente()) throw erro("A Meta avisou nas últimas 24h que está limitando o número por bloqueios. Espere antes de mandar modelos.");
  const k = chaveNumero(numero);
  if (variacoes(k).some((v) => descadastrados().has(v))) throw erro("Esta pessoa pediu para não receber mais mensagens.");
  const tpl = (await listarTemplates()).find((t) => t.nome === template && t.idioma === idioma);
  if (!tpl) throw erro("Modelo não encontrado entre os aprovados.");
  if (!tpl.suportado) throw erro(tpl.motivo);
  if (Array.isArray(variaveis) && variaveis.some((v) => v?.origem === "pendencias")) throw erro("Use nome ou texto fixo nas variáveis.");
  const v = validarVariaveis(tpl, variaveis);
  if (v) throw erro(v);
  const conv = abrirConversa(k);
  const componentes = montarComponentes(tpl, variaveis, primeiroNome(conv.nome));
  if (componentes[0]?.parameters.some((p) => !p.text)) throw erro("Sem nome para preencher a variável. Use texto fixo.");
  const wamid = await enviarTemplate({ numero: conv.destino, tpl, componentes });
  const valores = (componentes[0]?.parameters || []).map((p) => p.text);
  const texto = String(tpl.corpo || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, ph) => valores[tpl.variaveis.indexOf(ph)] ?? m);
  registrarSaida({ numero: conv.destino, tipo: "modelo", texto, modelo: tpl.nome, origem: "Modelo enviado pelo admin", adminId, wamid });
  return { wamid };
}

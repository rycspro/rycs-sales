// Desempenho do WhatsApp oficial da RYCS: o espelho do painel de e-mails.
//
// Junta tudo o que saiu pelo número (disparos do admin e reativação de
// empresas) com o que a Meta avisou pelo webhook (entregue, lido, falhou) e com
// o que as pessoas responderam. Clique em botão de link a Meta não informa, então
// não aparece aqui.

import db from "../db.js";
import { pedidoDeSaida, variacoes, bloqueioRecente } from "./whatsappDisparo.js";
import { MODELOS_WHATSAPP as MODELOS_REATIVACAO } from "../../shared/reativacaoEmpresas.js";

const taxa = (parte, todo) => (todo > 0 ? Math.round((parte / todo) * 1000) / 10 : null);
const JANELA_RESPOSTA_MS = 3 * 24 * 60 * 60 * 1000;
const existe = (tabela) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tabela);

// Só entra o que chegou a ser tentado na Meta: enviado, ou falha com código da
// Meta. "Disparo interrompido" e "Perfil completo antes do envio" nunca saíram.
const tentado = (l) => l.status === "enviado" || (l.status === "falhou" && /^\d/.test(l.erro || ""));

function mensagensEnviadas() {
  const linhas = db.prepare(`SELECT 'Disparo do admin' AS origem, d.template AS modelo, d.idioma, e.numero, e.wamid, e.status, e.erro, e.enviadoEm
    FROM whatsapp_envios e JOIN whatsapp_disparos d ON d.id = e.disparoId WHERE e.status IN ('enviado', 'falhou')`).all();
  if (existe("reativacao_whatsapp")) {
    linhas.push(...db.prepare(`SELECT 'Reativação de empresas' AS origem, modelo, 'pt_BR' AS idioma, numero, wamid, status, erro, enviadoEm
      FROM reativacao_whatsapp WHERE status IN ('enviado', 'falhou')`).all());
  }
  return linhas.filter(tentado);
}

// Avisos da Meta por mensagem: entregue (ou lido), lido e falha na entrega.
function avisosPorMensagem() {
  const porWamid = new Map();
  for (const s of db.prepare("SELECT wamid, status, erro FROM whatsapp_status").all()) {
    const a = porWamid.get(s.wamid) || {};
    if (s.status === "delivered" || s.status === "read") a.entregue = true;
    if (s.status === "read") a.lido = true;
    if (s.status === "failed") { a.falhou = true; a.erro = s.erro; }
    porWamid.set(s.wamid, a);
  }
  return porWamid;
}

// Mensagens que chegaram, por número (em todas as variações do nono dígito).
function recebidasPorNumero() {
  const rows = db.prepare(`SELECT de, tipo, texto, respondendoA, COALESCE(enviadoEm, recebidoEm) AS em,
      json_extract(dados, '$.button.payload') AS payload FROM whatsapp_mensagens ORDER BY em`).all();
  const porNumero = new Map();
  for (const r of rows) {
    r.saida = pedidoDeSaida(r);
    for (const v of variacoes(String(r.de))) {
      if (!porNumero.has(v)) porNumero.set(v, []);
      porNumero.get(v).push(r);
    }
  }
  return { rows, porNumero };
}

export function metricasWhatsapp() {
  const enviadas = mensagensEnviadas();
  const avisos = avisosPorMensagem();
  const { rows: recebidas, porNumero } = recebidasPorNumero();

  // Pedido para sair: atribuído à última mensagem enviada para o número antes dele.
  const saidaDe = new Set();
  const ok = enviadas.filter((l) => l.status === "enviado");
  for (const r of recebidas.filter((x) => x.saida)) {
    let melhor = null;
    for (const l of ok) {
      if (l.enviadoEm <= r.em && variacoes(l.numero).includes(String(r.de)) && (!melhor || l.enviadoEm > melhor.enviadoEm)) melhor = l;
    }
    if (melhor) saidaDe.add(melhor);
  }

  const vazio = () => ({ enviados: 0, falhasEnvio: 0, entregues: 0, lidos: 0, falhasEntrega: 0, responderam: 0, saidas: 0 });
  const por = new Map();
  const total = vazio();
  const erros = new Map();
  let comAviso = 0;

  for (const l of enviadas) {
    const chave = `${l.modelo}|${l.idioma}`;
    if (!por.has(chave)) por.set(chave, { modelo: l.modelo, idioma: l.idioma, origem: l.origem, ...vazio() });
    const m = por.get(chave);
    let erro = "";
    const conta = {};
    if (l.status === "falhou") { conta.falhasEnvio = 1; erro = l.erro; }
    else {
      conta.enviados = 1;
      const a = l.wamid ? avisos.get(l.wamid) : null;
      if (a) comAviso++;
      if (a?.entregue) conta.entregues = 1;
      if (a?.lido) conta.lidos = 1;
      if (a?.falhou) { conta.falhasEntrega = 1; erro = a.erro || "Falha na entrega"; }
      // Respondeu: tocou num botão desta mensagem ou escreveu em até 3 dias. Pedido para sair não conta.
      const respostas = porNumero.get(l.numero) || [];
      if (respostas.some((r) => !r.saida && ((l.wamid && r.respondendoA === l.wamid) || (r.em >= l.enviadoEm && r.em <= l.enviadoEm + JANELA_RESPOSTA_MS)))) conta.responderam = 1;
      if (saidaDe.has(l)) conta.saidas = 1;
    }
    for (const alvo of [m, total]) for (const [k, v] of Object.entries(conta)) alvo[k] += v;
    if (erro) erros.set(erro, (erros.get(erro) || 0) + 1);
  }

  const comTaxas = (m) => {
    const falhas = m.falhasEnvio + m.falhasEntrega;
    return {
      ...m,
      falhas,
      taxaEntrega: taxa(m.entregues, m.enviados),
      taxaLeitura: taxa(m.lidos, m.entregues || m.enviados),
      taxaResposta: taxa(m.responderam, m.entregues || m.enviados),
      taxaFalha: taxa(falhas, m.enviados + m.falhasEnvio),
      taxaSaida: taxa(m.saidas, m.enviados),
    };
  };

  const status = db.prepare("SELECT COUNT(*) AS n, MAX(recebidoEm) AS ultimo FROM whatsapp_status").get();
  return {
    total: comTaxas(total),
    modelos: [...por.values()].map(comTaxas).sort((a, b) => b.enviados - a.enviados || a.modelo.localeCompare(b.modelo)),
    recebidas: {
      mensagens: recebidas.length,
      pessoas: new Set(recebidas.map((r) => String(r.de))).size,
      pediramParaSair: new Set(recebidas.filter((r) => r.saida).map((r) => String(r.de))).size,
      ultima: recebidas.length ? recebidas[recebidas.length - 1].em : null,
    },
    avisosRecebidos: status.n,
    ultimoAviso: status.ultimo || null,
    // Mensagens saíram e nenhuma recebeu aviso da Meta: o webhook não está chegando.
    semAvisoDaMeta: total.enviados > 0 && comAviso === 0,
    bloqueioRecente: bloqueioRecente(),
    errosMaisComuns: [...erros].map(([erro, n]) => ({ erro, n })).sort((a, b) => b.n - a.n).slice(0, 5),
  };
}

// ── Cada mensagem, em detalhe ─────────────────────────────────────────────
// O texto exato que saiu (modelo + valores das variáveis), o caminho na Meta
// (enviada, entregue, lida, falhou), se a Meta cobrou e em que categoria, e o
// que a pessoa respondeu depois.

const preencher = (texto, nomes, valores) => String(texto || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, ph) => {
  const v = valores[nomes.indexOf(ph)];
  return v == null || v === "" ? m : String(v);
});

// Valores das variáveis: os registrados no envio ou, em envio antigo, o que dá
// para refazer (nome e texto fixo). Pendências antigas não foram guardadas.
function valoresDoEnvio(e, variaveis) {
  try { const p = JSON.parse(e.parametros || "null"); if (Array.isArray(p)) return p; } catch { /* envio antigo */ }
  return variaveis.map((v) => (v?.origem === "nome" ? e.nome : v?.origem === "fixo" ? v.texto : null));
}

const sqlAvisos = db.prepare(`SELECT status, COALESCE(ocorreuEm, recebidoEm) AS em, erro,
    json_extract(dados, '$.pricing.billable') AS cobrada, json_extract(dados, '$.pricing.category') AS categoria,
    json_extract(dados, '$.pricing.type') AS tipo
  FROM whatsapp_status WHERE wamid = ? ORDER BY em`);

function caminhoNaMeta(wamid) {
  if (!wamid) return { avisos: [], cobranca: null };
  const avisos = sqlAvisos.all(wamid);
  const comPreco = avisos.find((a) => a.cobrada != null || a.categoria);
  return {
    avisos: avisos.map((a) => ({ status: a.status, em: a.em, erro: a.erro || "" })),
    cobranca: comPreco ? { cobrada: comPreco.cobrada == null ? null : !!comPreco.cobrada, categoria: comPreco.categoria || "", tipo: comPreco.tipo || "" } : null,
  };
}

function respostasA(numero, wamid, enviadoEm) {
  if (!numero || !enviadoEm) return [];
  const vs = variacoes(String(numero));
  return db.prepare(`SELECT tipo, texto, respondendoA, COALESCE(enviadoEm, recebidoEm) AS em, json_extract(dados, '$.button.payload') AS payload
      FROM whatsapp_mensagens WHERE de IN (${vs.map(() => "?").join(",")}) AND COALESCE(enviadoEm, recebidoEm) >= ?
      ORDER BY em LIMIT 20`).all(...vs, enviadoEm)
    .filter((r) => (wamid && r.respondendoA === wamid) || r.em <= enviadoEm + JANELA_RESPOSTA_MS)
    .slice(0, 5)
    .map((r) => ({ tipo: r.tipo, texto: r.texto || "", em: r.em, saida: pedidoDeSaida(r) }));
}

export function detalheMensagens({ disparoId = "", busca = "", limite = 100 } = {}) {
  const lim = Math.min(Math.max(Math.trunc(Number(limite)) || 100, 1), 500);
  const like = `%${String(busca || "").trim()}%`;
  const doAdmin = db.prepare(`SELECT e.id, e.disparoId, e.nome, e.numero, e.wamid, e.status, e.erro, e.enviadoEm, e.parametros,
      d.template, d.idioma, d.templateDados, d.variaveis, d.publico, d.criadoEm
    FROM whatsapp_envios e JOIN whatsapp_disparos d ON d.id = e.disparoId
    WHERE (? = '' OR e.disparoId = ?) AND (e.nome LIKE ? OR e.numero LIKE ?)
    ORDER BY COALESCE(e.enviadoEm, d.criadoEm) DESC, e.rowid DESC LIMIT ?`).all(disparoId, disparoId, like, like, lim)
    .map((e) => {
      let tpl = {};
      let variaveis = [];
      try { tpl = JSON.parse(e.templateDados || "{}"); variaveis = JSON.parse(e.variaveis || "[]"); } catch { /* registro antigo */ }
      const valores = valoresDoEnvio(e, variaveis);
      const nomes = tpl.variaveis || [];
      return {
        id: e.id, origem: "Disparo do admin", disparoId: e.disparoId, publico: e.publico, modelo: e.template, idioma: e.idioma,
        nome: e.nome, numero: e.numero, wamid: e.wamid, status: e.status, erro: e.erro, enviadoEm: e.enviadoEm || null,
        mensagem: {
          cabecalho: tpl.cabecalho || "", corpo: preencher(tpl.corpo, nomes, valores), rodape: tpl.rodape || "",
          botoes: tpl.botoes || [], completa: nomes.every((_, i) => valores[i] != null && valores[i] !== ""),
        },
        ...caminhoNaMeta(e.wamid),
        respostas: respostasA(e.numero, e.wamid, e.enviadoEm),
      };
    });

  let daReativacao = [];
  if (!disparoId && existe("reativacao_whatsapp")) {
    daReativacao = db.prepare(`SELECT w.id, w.dia, w.modelo, w.numero, w.wamid, w.status, w.erro, w.enviadoEm, COALESCE(c.nome, '') AS nome
        FROM reativacao_whatsapp w LEFT JOIN companies c ON c.id = w.companyId
        WHERE w.status IN ('enviado', 'falhou') AND (COALESCE(c.nome, '') LIKE ? OR w.numero LIKE ?)
        ORDER BY w.enviadoEm DESC LIMIT ?`).all(like, like, lim)
      .map((w) => {
        const m = MODELOS_REATIVACAO[w.dia] || {};
        return {
          id: w.id, origem: "Reativação de empresas", disparoId: "", publico: "Empresas paradas", modelo: w.modelo, idioma: "pt_BR",
          nome: w.nome, numero: w.numero, wamid: w.wamid, status: w.status, erro: w.erro, enviadoEm: w.enviadoEm || null,
          // As variáveis da reativação não ficam registradas: o texto vai como está no modelo.
          mensagem: { cabecalho: "", corpo: m.corpo || "", rodape: "", botoes: (m.botoes || []).map((b) => ({ tipo: b.tipo, texto: b.texto })), completa: false },
          ...caminhoNaMeta(w.wamid),
          respostas: respostasA(w.numero, w.wamid, w.enviadoEm),
        };
      });
  }

  return [...doAdmin, ...daReativacao].sort((a, b) => (b.enviadoEm || 0) - (a.enviadoEm || 0)).slice(0, lim);
}

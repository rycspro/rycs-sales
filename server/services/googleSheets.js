// Google Sheets via link público: a empresa cola a URL de uma planilha
// compartilhada ("qualquer pessoa com o link pode ver") e a RYCS importa
// automaticamente os novos contatos como leads — mesma distribuição do webhook
// (profissional aprovado com menos leads nas últimas 24h).
//
// Sem OAuth, sem credenciais do Google. O servidor busca o CSV público:
// https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv&sheet={ABA}

import db, { uid, agora } from "../db.js";
import { notificar } from "../routes/notifications.js";
import { vincularLeadAutomaticamente } from "./campaignAutoEntry.js";

// ── Schema (aditivo, idempotente) ───────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS google_sheets_config (
    companyId TEXT PRIMARY KEY,
    url TEXT NOT NULL DEFAULT '',
    spreadsheetId TEXT DEFAULT '',
    spreadsheetNome TEXT DEFAULT '',
    sheetNome TEXT DEFAULT '',
    mapeamento TEXT DEFAULT '{}',
    ultimaLinha INTEGER DEFAULT 1,
    ativo INTEGER NOT NULL DEFAULT 1,
    total INTEGER NOT NULL DEFAULT 0,
    ultimoImportadoEm INTEGER,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  );
`);

// Migração segura: adiciona coluna url se a tabela já existia sem ela
try { db.exec("ALTER TABLE google_sheets_config ADD COLUMN url TEXT NOT NULL DEFAULT ''"); } catch {}

// ── Helpers ─────────────────────────────────────────────────────────────────
function extrairSpreadsheetId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function csvParaLinhas(csv) {
  const linhas = [];
  let atual = [];
  let campo = "";
  let dentroAspas = false;

  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (dentroAspas) {
      if (c === '"' && csv[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') dentroAspas = false;
      else campo += c;
    } else {
      if (c === '"') dentroAspas = true;
      else if (c === ',') { atual.push(campo); campo = ""; }
      else if (c === '\n' || (c === '\r' && csv[i + 1] === '\n')) {
        if (c === '\r') i++;
        atual.push(campo);
        campo = "";
        if (atual.some(v => v.trim())) linhas.push(atual);
        atual = [];
      } else campo += c;
    }
  }
  atual.push(campo);
  if (atual.some(v => v.trim())) linhas.push(atual);
  return linhas;
}

export async function buscarCsvPublico(spreadsheetId, sheetNome) {
  const sheetParam = sheetNome ? `&sheet=${encodeURIComponent(sheetNome)}` : "";
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv${sheetParam}`;
  const res = await fetch(url);
  if (!res.ok) return { error: `Não foi possível acessar a planilha (${res.status}). Verifique se ela está compartilhada como "qualquer pessoa com o link pode ver".` };
  const texto = await res.text();
  if (!texto.trim()) return { error: "A planilha está vazia." };
  return { linhas: csvParaLinhas(texto) };
}

// ── Config ──────────────────────────────────────────────────────────────────
export function configDe(companyId) {
  return db.prepare("SELECT * FROM google_sheets_config WHERE companyId = ?").get(companyId) || null;
}

export function resumoConfig(companyId) {
  const c = configDe(companyId);
  if (!c || !c.url) return { conectado: false };
  return {
    conectado: true,
    ativo: !!c.ativo,
    url: c.url,
    spreadsheetId: c.spreadsheetId || "",
    spreadsheetNome: c.spreadsheetNome || "",
    sheetNome: c.sheetNome || "",
    mapeamento: JSON.parse(c.mapeamento || "{}"),
    ultimaLinha: c.ultimaLinha || 1,
    total: c.total || 0,
    ultimoImportadoEm: c.ultimoImportadoEm || null,
    configurado: !!(c.spreadsheetId && c.sheetNome && Object.keys(JSON.parse(c.mapeamento || "{}")).length),
  };
}

// ── Conectar (colar URL) ────────────────────────────────────────────────────
export async function conectar(companyId, url) {
  const id = extrairSpreadsheetId(url);
  if (!id) return { error: "URL inválida. Cole o link da planilha do Google Sheets." };

  const r = await buscarCsvPublico(id, "");
  if (r.error) return r;

  const cabecalho = r.linhas?.[0] || [];
  const ts = agora();
  const existente = configDe(companyId);

  if (existente) {
    db.prepare("UPDATE google_sheets_config SET url = ?, spreadsheetId = ?, spreadsheetNome = '', sheetNome = '', mapeamento = '{}', ultimaLinha = 1, ativo = 1, atualizadoEm = ? WHERE companyId = ?")
      .run(url, id, ts, companyId);
  } else {
    db.prepare("INSERT INTO google_sheets_config (companyId, url, spreadsheetId, criadoEm, atualizadoEm) VALUES (?, ?, ?, ?, ?)")
      .run(companyId, url, id, ts, ts);
  }

  return { ok: true, spreadsheetId: id, cabecalho, totalLinhas: r.linhas.length };
}

// ── Preview (pré-visualização) ──────────────────────────────────────────────
export async function preVisualizacao(companyId, sheetNome) {
  const cfg = configDe(companyId);
  if (!cfg?.spreadsheetId) return { error: "Nenhuma planilha conectada." };

  const r = await buscarCsvPublico(cfg.spreadsheetId, sheetNome || "");
  if (r.error) return r;
  return { linhas: r.linhas.slice(0, 10) };
}

// ── Listar abas (via HTML da planilha pública) ──────────────────────────────
export async function listarAbas(companyId) {
  const cfg = configDe(companyId);
  if (!cfg?.spreadsheetId) return { error: "Nenhuma planilha conectada." };

  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${cfg.spreadsheetId}/edit`);
    if (!res.ok) return { abas: [{ nome: "Página1" }] };
    const html = await res.text();
    const nomes = [];
    const regex = /class="docs-sheet-tab-name"[^>]*>([^<]+)</g;
    let m;
    while ((m = regex.exec(html)) !== null) nomes.push(m[1].trim());
    if (!nomes.length) return { abas: [{ nome: "Página1" }] };
    return { abas: nomes.map(n => ({ nome: n })) };
  } catch {
    return { abas: [{ nome: "Página1" }] };
  }
}

// ── Escolher aba + mapeamento ───────────────────────────────────────────────
export function escolher(companyId, { sheetNome, mapeamento, ultimaLinha }) {
  const ts = agora();
  db.prepare("UPDATE google_sheets_config SET sheetNome = ?, mapeamento = ?, ultimaLinha = ?, ativo = 1, atualizadoEm = ? WHERE companyId = ?")
    .run(sheetNome || "", JSON.stringify(mapeamento || {}), ultimaLinha || 1, ts, companyId);
  return resumoConfig(companyId);
}

export function definirAtivo(companyId, ativo) {
  db.prepare("UPDATE google_sheets_config SET ativo = ?, atualizadoEm = ? WHERE companyId = ?").run(ativo ? 1 : 0, agora(), companyId);
  return resumoConfig(companyId);
}

export function desconectar(companyId) {
  db.prepare("DELETE FROM google_sheets_config WHERE companyId = ?").run(companyId);
  return { ok: true };
}

// ── Worker de importação (polling) ──────────────────────────────────────────
function escolherProfissional(companyId) {
  const desde = agora() - 24 * 3600 * 1000;
  return db.prepare(`SELECT a.sellerId,
      (SELECT COUNT(*) FROM leads l WHERE l.sellerId = a.sellerId AND l.companyId = a.companyId AND l.origem = 'google-sheets' AND l.criadoEm > ?) AS n
    FROM applications a WHERE a.companyId = ? AND a.status = 'aprovado'
    ORDER BY n ASC, RANDOM() LIMIT 1`).get(desde, companyId)?.sellerId || null;
}

function extrairCampo(linha, map, campo) {
  const idx = map[campo];
  if (idx == null || idx < 0 || idx >= linha.length) return "";
  return String(linha[idx] || "").trim();
}

async function importarNovasLinhas(cfg) {
  const r = await buscarCsvPublico(cfg.spreadsheetId, cfg.sheetNome || "");
  if (r.error || !r.linhas?.length) return;

  const inicio = (cfg.ultimaLinha || 1);
  const linhasNovas = r.linhas.slice(inicio);
  if (!linhasNovas.length) return;

  const map = JSON.parse(cfg.mapeamento || "{}");
  const ts = agora();
  let importados = 0;

  for (const linha of linhasNovas) {
    if (!linha.some(c => c && String(c).trim())) continue;

    const nome = extrairCampo(linha, map, "nome");
    const email = extrairCampo(linha, map, "email").toLowerCase();
    const telefone = extrairCampo(linha, map, "telefone").replace(/\D/g, "");
    const empresa = extrairCampo(linha, map, "empresa");
    const cargo = extrairCampo(linha, map, "cargo");

    if (!nome && !email && !telefone) continue;

    const existente = (email || telefone) && db.prepare(`SELECT id, sellerId FROM leads WHERE companyId = ?
      AND ((? != '' AND lower(email) = ?) OR (? != '' AND replace(replace(replace(replace(telefone,' ',''),'-',''),'(',''),')','') LIKE '%' || ?))
      ORDER BY criadoEm DESC LIMIT 1`).get(cfg.companyId, email, email, telefone, telefone.slice(-10));

    if (existente) {
      db.prepare("INSERT INTO lead_events (id, leadId, sellerId, tipo, observacao, criadoEm) VALUES (?, ?, ?, 'nota', ?, ?)")
        .run(uid(), existente.id, existente.sellerId, "Contato reenviado via Google Sheets.", ts);
      importados++;
      continue;
    }

    const sellerId = escolherProfissional(cfg.companyId);
    if (!sellerId) continue;

    const leadId = uid();
    db.transaction(() => {
      db.prepare(`INSERT INTO leads (id, sellerId, companyId, campaignId, nome, empresa, cargo, telefone, email, origem, etapa, valorEstimado, criadoEm, atualizadoEm)
        VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 'google-sheets', 'novo', 0, ?, ?)`)
        .run(leadId, sellerId, cfg.companyId, nome || "Lead via Google Sheets", empresa, cargo, telefone, email, ts, ts);
      db.prepare("INSERT INTO lead_events (id, leadId, sellerId, tipo, observacao, criadoEm) VALUES (?, ?, ?, 'nota', 'Lead importado do Google Sheets.', ?)")
        .run(uid(), leadId, sellerId, ts);
    })();

    vincularLeadAutomaticamente(leadId, cfg.companyId, null);
    const vend = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sellerId);
    if (vend) notificar(vend.id, "lead", "Novo lead via Google Sheets", `${nome || "Um novo lead"} foi importado da planilha.`);
    importados++;
  }

  const novaLinha = inicio + linhasNovas.length;
  db.prepare("UPDATE google_sheets_config SET ultimaLinha = ?, total = total + ?, ultimoImportadoEm = ?, atualizadoEm = ? WHERE companyId = ?")
    .run(novaLinha, importados, importados > 0 ? ts : cfg.ultimoImportadoEm, ts, cfg.companyId);
}

export function iniciarWorkerGoogleSheets() {
  const INTERVALO = 5 * 60 * 1000;

  async function rodar() {
    const cfgs = db.prepare("SELECT * FROM google_sheets_config WHERE ativo = 1 AND spreadsheetId != '' AND sheetNome != ''").all();
    for (const cfg of cfgs) {
      try { await importarNovasLinhas(cfg); }
      catch (e) { console.error(`[google-sheets] Erro ao importar para ${cfg.companyId}:`, e.message); }
    }
  }

  setInterval(rodar, INTERVALO);
  setTimeout(rodar, 30000);
}

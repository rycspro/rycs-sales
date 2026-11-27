import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { registrarEventoCampanha } from "../services/campaignEvents.js";
import { vincularLeadAutomaticamente } from "../services/campaignAutoEntry.js";
import { notificar } from "./notifications.js";

const router = Router();

const somenteEmpresa = (req, res) => {
  if (req.user?.role !== "empresa" || !req.user.entityId) { res.status(403).json({ error: "Apenas a empresa gerencia integrações" }); return false; }
  return true;
};

function extrairSheetId(url) {
  const m = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function parseCsv(texto) {
  const linhas = [];
  let atual = [], campo = "", dentroAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroAspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') dentroAspas = false;
      else campo += c;
    } else {
      if (c === '"') dentroAspas = true;
      else if (c === ",") { atual.push(campo.trim()); campo = ""; }
      else if (c === "\n" || (c === "\r" && texto[i + 1] === "\n")) {
        atual.push(campo.trim()); campo = "";
        if (atual.some(Boolean)) linhas.push(atual);
        atual = [];
        if (c === "\r") i++;
      } else campo += c;
    }
  }
  atual.push(campo.trim());
  if (atual.some(Boolean)) linhas.push(atual);
  return linhas;
}

router.post("/google-sheets/preview", async (req, res) => {
  if (!somenteEmpresa(req, res)) return;
  const { url } = req.body || {};
  const sheetId = extrairSheetId(url);
  if (!sheetId) return res.status(400).json({ error: "URL inválida. Cole o link de uma planilha pública do Google Sheets." });

  const gid = String(url).match(/gid=(\d+)/)?.[1] || "0";
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  try {
    const resp = await fetch(csvUrl, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return res.status(422).json({ error: "Não foi possível acessar a planilha. Verifique se o compartilhamento está como \"Qualquer pessoa com o link\"." });
    const texto = await resp.text();
    const linhas = parseCsv(texto);
    if (linhas.length < 2) return res.status(422).json({ error: "A planilha precisa ter ao menos um cabeçalho e uma linha de dados." });

    const cabecalhos = linhas[0];
    const preview = linhas.slice(1, 6).map((l) => {
      const obj = {};
      cabecalhos.forEach((h, i) => { obj[h] = l[i] || ""; });
      return obj;
    });

    res.json({ cabecalhos, preview, totalLinhas: linhas.length - 1 });
  } catch (e) {
    if (e.name === "TimeoutError") return res.status(504).json({ error: "A planilha demorou demais para responder. Tente novamente." });
    res.status(500).json({ error: "Erro ao acessar a planilha." });
  }
});

router.post("/google-sheets/importar", async (req, res) => {
  if (!somenteEmpresa(req, res)) return;
  const companyId = req.user.entityId;
  const { url, mapeamento, campaignId, sellerId, autoDistribuir } = req.body || {};

  if (!campaignId) return res.status(400).json({ error: "Selecione uma campanha." });
  const campanha = db.prepare("SELECT id FROM campaigns WHERE id = ? AND companyId = ?").get(campaignId, companyId);
  if (!campanha) return res.status(404).json({ error: "Campanha não encontrada." });

  if (!mapeamento || !mapeamento.nome) return res.status(400).json({ error: "Mapeie pelo menos a coluna Nome." });

  const sheetId = extrairSheetId(url);
  if (!sheetId) return res.status(400).json({ error: "URL inválida." });

  const gid = String(url).match(/gid=(\d+)/)?.[1] || "0";
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  let linhas;
  try {
    const resp = await fetch(csvUrl, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return res.status(422).json({ error: "Não foi possível acessar a planilha." });
    linhas = parseCsv(await resp.text());
    if (linhas.length < 2) return res.status(422).json({ error: "Planilha sem dados." });
  } catch {
    return res.status(500).json({ error: "Erro ao acessar a planilha." });
  }

  const cabecalhos = linhas[0];
  const idxDe = (campo) => {
    const col = mapeamento[campo];
    return col ? cabecalhos.indexOf(col) : -1;
  };

  let sellerPool = [];
  if (autoDistribuir || !sellerId) {
    const rows = db.prepare("SELECT sellerId FROM applications WHERE companyId = ? AND status = 'aprovado'").all(companyId);
    sellerPool = rows.map((r) => r.sellerId).sort(() => Math.random() - 0.5);
    if (!sellerPool.length) return res.status(422).json({ error: "Nenhum profissional aprovado para distribuir." });
  } else {
    const vinculo = db.prepare("SELECT 1 FROM applications WHERE sellerId = ? AND companyId = ? AND status = 'aprovado'").get(sellerId, companyId);
    if (!vinculo) return res.status(422).json({ error: "Profissional não pertence ao time." });
    sellerPool = [sellerId];
  }

  const existentes = db.prepare("SELECT email, telefone FROM leads WHERE companyId = ?").all(companyId);
  const emails = new Set(existentes.map((l) => String(l.email || "").trim().toLowerCase()).filter(Boolean));
  const telefones = new Set(existentes.map((l) => String(l.telefone || "").replace(/\D/g, "")).filter(Boolean));

  const validos = [], erros = [];
  let duplicados = 0, sellerIdx = 0;
  const iNome = idxDe("nome"), iEmail = idxDe("email"), iTel = idxDe("telefone"), iEmpresa = idxDe("empresa"), iCargo = idxDe("cargo");

  const dados = linhas.slice(1).slice(0, 1000);
  dados.forEach((cols, indice) => {
    const nome = String(cols[iNome] ?? "").trim();
    const email = iEmail >= 0 ? String(cols[iEmail] ?? "").trim().toLowerCase() : "";
    const telefone = iTel >= 0 ? String(cols[iTel] ?? "").replace(/\D/g, "") : "";
    const empresa = iEmpresa >= 0 ? String(cols[iEmpresa] ?? "").trim() : "";
    const cargo = iCargo >= 0 ? String(cols[iCargo] ?? "").trim() : "";

    if (!nome) return erros.push({ linha: indice + 2, erro: "Nome obrigatório" });
    if (!email && !telefone) return erros.push({ linha: indice + 2, erro: "Informe telefone ou e-mail" });
    if ((email && emails.has(email)) || (telefone && telefones.has(telefone))) { duplicados++; return; }
    if (email) emails.add(email);
    if (telefone) telefones.add(telefone);
    const assignedSellerId = sellerPool[sellerIdx++ % sellerPool.length];
    validos.push({ nome, email, telefone, empresa, cargo, sellerId: assignedSellerId });
  });

  const ts = agora();
  db.transaction(() => validos.forEach((l) => {
    const leadId = uid();
    l._leadId = leadId;
    db.prepare(`INSERT INTO leads
      (id, sellerId, companyId, campaignId, nome, empresa, cargo, telefone, email, origem, etapa, valorEstimado, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'google-sheets', 'novo', 0, ?, ?)`)
      .run(leadId, l.sellerId, companyId, campaignId, l.nome, l.empresa, l.cargo, l.telefone, l.email, ts, ts);
    registrarEventoCampanha({ companyId, campaignId, tipo: "LEAD_CREATED", actorId: req.user.id, actorRole: req.user.role, sellerId: l.sellerId, leadId, source: "USER", dados: { origem: "google-sheets" }, criadoEm: ts });
  }))();
  for (const l of validos) {
    if (l._leadId) vincularLeadAutomaticamente(l._leadId, companyId, campaignId);
  }

  const empUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(companyId);
  if (empUser) {
    const resumo = `${validos.length} importado(s)` + (duplicados ? `, ${duplicados} duplicado(s)` : "") + (erros.length ? `, ${erros.length} com erro` : "");
    notificar(empUser.id, "importacao", "Importação Google Sheets concluída", `${resumo} de ${dados.length} linha(s).`);
  }
  const porSeller = {};
  validos.forEach((l) => { porSeller[l.sellerId] = (porSeller[l.sellerId] || 0) + 1; });
  for (const [sid, qtd] of Object.entries(porSeller)) {
    const vendUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sid);
    if (vendUser) notificar(vendUser.id, "importacao", "Novos contatos na sua fila", `${qtd} contato(s) foram atribuídos a você via Google Sheets.`);
  }

  res.json({ totalRecebido: dados.length, importados: validos.length, duplicados, invalidos: erros.length, erros: erros.slice(0, 20) });
});

export default router;

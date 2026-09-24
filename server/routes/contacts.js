import { Router } from "express";
import { randomUUID } from "crypto";
import db from "../db.js";

const router = Router();

// Parse CSV simples (sem dependência externa)
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(/[,;]/).map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ""; });
    return obj;
  }).filter((r) => Object.values(r).some((v) => v));
}

// Normaliza nomes de coluna para campos padronizados
function normalizar(row) {
  const map = {
    nome: ["nome", "name", "contato", "contact", "full_name", "fullname"],
    empresa: ["empresa", "company", "organizacao", "organization"],
    cargo: ["cargo", "role", "funcao", "title", "job_title"],
    telefone: ["telefone", "phone", "celular", "mobile", "tel", "whatsapp"],
    email: ["email", "e-mail", "mail"],
    cidade: ["cidade", "city", "municipio"],
  };
  const out = { nome: "", empresa: "", cargo: "", telefone: "", email: "", cidade: "", extra: {} };
  for (const [campo, aliases] of Object.entries(map)) {
    for (const alias of aliases) {
      if (row[alias] !== undefined) { out[campo] = row[alias]; break; }
    }
  }
  // campos que sobraram vão para extra
  const usados = new Set(Object.values(map).flat());
  for (const [k, v] of Object.entries(row)) {
    if (!usados.has(k) && v) out.extra[k] = v;
  }
  return out;
}

// POST /contacts/upload — recebe base64 do CSV/XLSX e insere
router.post("/upload", (req, res) => {
  const { campaignId, companyId, dados } = req.body;
  if (!campaignId || !companyId || !Array.isArray(dados) || !dados.length) {
    return res.status(400).json({ error: "campaignId, companyId e dados[] são obrigatórios." });
  }

  const agora = Date.now();
  let inseridos = 0, duplicados = 0;

  const upsert = db.prepare(`
    INSERT INTO campaign_contacts
      (id, campaignId, companyId, nome, empresa, cargo, telefone, email, cidade, extra, status, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disponivel', ?)
    ON CONFLICT DO NOTHING
  `);

  // Detecção de duplicata: mesmo telefone OU mesmo email na mesma campanha
  const existeTel = db.prepare("SELECT id FROM campaign_contacts WHERE campaignId=? AND telefone=? AND telefone!=''");
  const existeEmail = db.prepare("SELECT id FROM campaign_contacts WHERE campaignId=? AND email=? AND email!=''");

  const batch = db.transaction(() => {
    for (const row of dados) {
      const n = normalizar(row);
      const isDup = (n.telefone && existeTel.get(campaignId, n.telefone)) ||
                    (n.email && existeEmail.get(campaignId, n.email));
      if (isDup) { duplicados++; continue; }
      upsert.run(randomUUID(), campaignId, companyId, n.nome, n.empresa, n.cargo,
        n.telefone, n.email, n.cidade, JSON.stringify(n.extra), agora);
      inseridos++;
    }
  });
  batch();

  res.json({ inseridos, duplicados, total: dados.length });
});

// GET /contacts/:campaignId — lista contatos da campanha
router.get("/:campaignId", (req, res) => {
  const { campaignId } = req.params;
  const { status, limit = 200, offset = 0 } = req.query;
  let query = "SELECT * FROM campaign_contacts WHERE campaignId=?";
  const params = [campaignId];
  if (status) { query += " AND status=?"; params.push(status); }
  query += " ORDER BY criadoEm DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));
  const total = db.prepare("SELECT COUNT(*) as n FROM campaign_contacts WHERE campaignId=?" + (status ? " AND status=?" : ""))
    .get(...(status ? [campaignId, status] : [campaignId])).n;
  res.json({ contatos: db.prepare(query).all(...params), total });
});

// PATCH /contacts/:id — atualizar status ou distribuição
router.patch("/:id", (req, res) => {
  const { status, sellerId } = req.body;
  const campos = [];
  const vals = [];
  if (status) { campos.push("status=?"); vals.push(status); }
  if (sellerId !== undefined) {
    campos.push("sellerId=?");
    vals.push(sellerId);
    if (sellerId) { campos.push("abordadoEm=?"); vals.push(Date.now()); }
  }
  if (!campos.length) return res.status(400).json({ error: "Nenhum campo para atualizar." });
  vals.push(req.params.id);
  db.prepare(`UPDATE campaign_contacts SET ${campos.join(",")} WHERE id=?`).run(...vals);
  res.json({ ok: true });
});

// POST /contacts/distribuir — distribui contatos disponíveis entre profissionais
router.post("/distribuir", (req, res) => {
  const { campaignId, sellers } = req.body;
  if (!campaignId || !Array.isArray(sellers) || !sellers.length) {
    return res.status(400).json({ error: "campaignId e sellers[] são obrigatórios." });
  }
  const disponiveis = db.prepare(
    "SELECT id FROM campaign_contacts WHERE campaignId=? AND status='disponivel' ORDER BY RANDOM()"
  ).all(campaignId);

  if (!disponiveis.length) return res.json({ distribuidos: 0, porProfissional: {} });

  const update = db.prepare("UPDATE campaign_contacts SET status='distribuido', sellerId=?, abordadoEm=? WHERE id=?");
  const porProfissional = {};
  const agora = Date.now();

  const batch = db.transaction(() => {
    disponiveis.forEach((c, i) => {
      const seller = sellers[i % sellers.length];
      update.run(seller, agora, c.id);
      porProfissional[seller] = (porProfissional[seller] || 0) + 1;
    });
  });
  batch();

  res.json({ distribuidos: disponiveis.length, porProfissional });
});

// DELETE /contacts/:campaignId — limpa lista inteira (só disponíveis)
router.delete("/:campaignId", (req, res) => {
  const r = db.prepare("DELETE FROM campaign_contacts WHERE campaignId=? AND status='disponivel'").run(req.params.campaignId);
  res.json({ removidos: r.changes });
});

export default router;

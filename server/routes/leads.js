import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { ETAPAS, TIPOS_EVENTO, etapaValida, MOTIVOS_PERDA } from "../../shared/pipeline.js";
import { exigirOportunidadesLiberadas } from "../services/acessoProfissional.js";
import { notificar } from "./notifications.js";
import { registrarEventoCampanha } from "../services/campaignEvents.js";

const router = Router();

// Um lead pertence ao vendedor que o cadastrou. A empresa contratante enxerga
// os leads da própria campanha — precisa acompanhar a execução —, mas nunca os
// de outra empresa nem de outro vendedor.
function podeVer(lead, user) {
  if (user.role === "admin") return true;
  if (user.role === "vendedor") return user.entityId === lead.sellerId;
  if (user.role === "empresa") return user.entityId === lead.companyId;
  return false;
}

router.get("/leads", (req, res) => {
  const { role, entityId } = req.user;
  const { etapa, companyId } = req.query;

  let sql = "SELECT * FROM leads WHERE 1=1";
  const args = [];

  if (role === "vendedor") { sql += " AND sellerId = ?"; args.push(entityId); }
  else if (role === "empresa") { sql += " AND companyId = ?"; args.push(entityId); }
  else if (role !== "admin") return res.status(403).json({ error: "Sem permissão" });

  if (etapa && etapaValida(etapa)) { sql += " AND etapa = ?"; args.push(etapa); }
  if (companyId && role !== "empresa") { sql += " AND companyId = ?"; args.push(companyId); }

  sql += " ORDER BY (proximaAcaoEm IS NULL), proximaAcaoEm ASC, atualizadoEm DESC LIMIT 300";
  res.json(db.prepare(sql).all(...args));
});

router.get("/leads/:id", (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
  if (!podeVer(lead, req.user)) return res.status(403).json({ error: "Sem permissão" });

  const eventos = db.prepare("SELECT * FROM lead_events WHERE leadId = ? ORDER BY criadoEm DESC LIMIT 100").all(lead.id);
  res.json({ ...lead, eventos });
});

router.post("/leads/import", (req, res) => {
  const { role, entityId: companyId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas a empresa pode importar listas" });
  const { campaignId, sellerId, linhas } = req.body || {};
  if (!campaignId || !sellerId) return res.status(400).json({ error: "Campanha e profissional responsável são obrigatórios" });
  if (!Array.isArray(linhas) || !linhas.length || linhas.length > 1000) return res.status(400).json({ error: "Envie entre 1 e 1.000 leads" });
  const campanha = db.prepare("SELECT id FROM campaigns WHERE id = ? AND companyId = ?").get(campaignId, companyId);
  if (!campanha) return res.status(404).json({ error: "Campanha não encontrada" });
  const vinculo = db.prepare("SELECT 1 FROM applications WHERE sellerId = ? AND companyId = ? AND status = 'aprovado'").get(sellerId, companyId);
  if (!vinculo) return res.status(422).json({ error: "O profissional escolhido não pertence ao time" });

  const existentes = db.prepare("SELECT email, telefone FROM leads WHERE companyId = ?").all(companyId);
  const emails = new Set(existentes.map((l) => String(l.email || "").trim().toLowerCase()).filter(Boolean));
  const telefones = new Set(existentes.map((l) => String(l.telefone || "").replace(/\D/g, "")).filter(Boolean));
  const validos = [], erros = []; let duplicados = 0;
  linhas.forEach((linha, indice) => {
    const nome = String(linha?.nome || "").trim(), email = String(linha?.email || "").trim().toLowerCase(), telefone = String(linha?.telefone || "").replace(/\D/g, "");
    if (!nome) return erros.push({ linha: indice + 2, erro: "Nome obrigatório" });
    if (!email && !telefone) return erros.push({ linha: indice + 2, erro: "Informe telefone ou e-mail" });
    if ((email && emails.has(email)) || (telefone && telefones.has(telefone))) { duplicados++; return; }
    if (email) emails.add(email); if (telefone) telefones.add(telefone);
    validos.push({ ...linha, nome, email, telefone });
  });
  const ts = agora();
  db.transaction(() => validos.forEach((l) => {
    const leadId = uid();
    db.prepare(`INSERT INTO leads
      (id, sellerId, companyId, campaignId, nome, empresa, cargo, telefone, email, origem, etapa, valorEstimado, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'empresa', 'novo', ?, ?, ?)`)
      .run(leadId, sellerId, companyId, campaignId, l.nome, String(l.empresa || ""), String(l.cargo || ""), l.telefone, l.email, Number(l.valorEstimado) || 0, ts, ts);
    registrarEventoCampanha({ companyId, campaignId, tipo: "LEAD_CREATED", actorId: req.user.id, actorRole: role, sellerId, leadId, source: "USER", dados: { origem: "importacao" }, criadoEm: ts });
  }))();
  // A importação pode acontecer com a empresa em outra tela, e o profissional
  // recebe leads sem ter pedido nada. Os dois precisam saber.
  const resumo = `${validos.length} importado(s)` +
    (duplicados ? `, ${duplicados} duplicado(s)` : "") +
    (erros.length ? `, ${erros.length} com erro` : "");
  const empUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").get(companyId);
  if (empUser) notificar(empUser.id, "importacao", "Importação de leads concluída", `${resumo} de ${linhas.length} linha(s) enviada(s).`);
  const vendUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(sellerId);
  if (vendUser && validos.length) notificar(vendUser.id, "importacao", "Novos leads na sua fila", `${validos.length} lead(s) foram atribuídos a você.`);

  res.json({ totalRecebido: linhas.length, validos: validos.length, invalidos: erros.length, duplicados, ignorados: erros.length + duplicados, importados: validos.length, erros });
});

router.post("/leads", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais criam leads" });
  if (!exigirOportunidadesLiberadas(req, res)) return;

  const { companyId, campaignId, nome, empresa, cargo, telefone, email, valorEstimado } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: "Nome do contato é obrigatório" });
  if (!companyId) return res.status(400).json({ error: "Escolha a campanha ou empresa" });

  // O vendedor só cria lead para empresa na qual foi aprovado — senão daria
  // para inflar o próprio funil com empresas em que nem trabalha.
  const vinculo = db.prepare("SELECT status FROM applications WHERE sellerId = ? AND companyId = ?").get(entityId, companyId);
  if (vinculo?.status !== "aprovado")
    return res.status(403).json({ error: "Você ainda não foi aprovado nesta empresa" });

  if (campaignId) {
    const campanha = db.prepare("SELECT status, aceitaLeadProprio FROM campaigns WHERE id = ? AND companyId = ?").get(campaignId, companyId);
    if (!campanha) return res.status(404).json({ error: "Campanha não encontrada" });
    if (campanha.status !== "ativa") return res.status(422).json({ error: "Campanha não está ativa" });
    if (!campanha.aceitaLeadProprio) return res.status(422).json({ error: "Esta campanha não aceita leads próprios" });
  }

  const emailNormalizado = String(email || "").trim().toLowerCase();
  const telefoneNormalizado = String(telefone || "").replace(/\D/g, "");
  if (emailNormalizado || telefoneNormalizado) {
    const duplicado = db.prepare(`SELECT id, nome, etapa FROM leads WHERE companyId = ? AND
      ((? <> '' AND lower(trim(email)) = ?) OR (? <> '' AND replace(replace(replace(replace(replace(telefone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?))
      LIMIT 1`).get(companyId, emailNormalizado, emailNormalizado, telefoneNormalizado, telefoneNormalizado);
    if (duplicado) return res.status(409).json({ error: "Lead duplicado nesta empresa", duplicado });
  }

  const id = uid();
  const ts = agora();
  db.transaction(() => {
    db.prepare(`INSERT INTO leads (id, sellerId, companyId, campaignId, nome, empresa, cargo, telefone, email, etapa, valorEstimado, criadoEm, atualizadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'novo', ?, ?, ?)`)
      .run(id, entityId, companyId, campaignId || null, nome.trim(), empresa || "", cargo || "",
           telefoneNormalizado, emailNormalizado, Number(valorEstimado) || 0, ts, ts);
    if (campaignId) registrarEventoCampanha({ companyId, campaignId, tipo: "LEAD_CREATED", actorId: req.user.id, actorRole: role, sellerId: entityId, leadId: id, source: "USER", dados: { origem: "proprio" }, criadoEm: ts });
  })();

  res.json({ id, etapa: "novo" });
});

router.patch("/leads/:id", (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
  if (req.user.role !== "vendedor" || req.user.entityId !== lead.sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (!exigirOportunidadesLiberadas(req, res, lead.sellerId)) return;

  const permitidos = ["nome", "empresa", "cargo", "telefone", "email", "valorEstimado", "proximaAcao", "proximaAcaoEm"];
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(req.body)) {
    if (permitidos.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }

  // Mudar de etapa é registrado na linha do tempo: o histórico do funil é o
  // que permite auditar a execução depois.
  const novaEtapa = req.body.etapa;
  if (novaEtapa) {
    if (!etapaValida(novaEtapa)) return res.status(400).json({ error: "Etapa inválida" });
    if (novaEtapa === "perdido" && !String(req.body.motivoPerda || "").trim())
      return res.status(400).json({ error: `Informe o motivo da perda (${MOTIVOS_PERDA.slice(0, 3).join(", ")}…)` });
    sets.push("etapa = ?"); vals.push(novaEtapa);
    if (req.body.motivoPerda) { sets.push("motivoPerda = ?"); vals.push(String(req.body.motivoPerda).slice(0, 120)); }
  }

  if (!sets.length) return res.status(400).json({ error: "Nenhum campo válido" });

  sets.push("atualizadoEm = ?"); vals.push(agora()); vals.push(lead.id);

  db.transaction(() => {
    db.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
    if (novaEtapa && novaEtapa !== lead.etapa) {
      db.prepare(`INSERT INTO lead_events (id, leadId, sellerId, tipo, observacao, etapaAntes, etapaDepois, criadoEm)
                  VALUES (?, ?, ?, 'etapa', ?, ?, ?, ?)`)
        .run(uid(), lead.id, lead.sellerId, req.body.motivoPerda || "", lead.etapa, novaEtapa, agora());
    }
  })();

  res.json({ ok: true, etapa: novaEtapa || lead.etapa });
});

// Registrar uma interação. É aqui que a execução vira evidência.
router.post("/leads/:id/eventos", (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
  if (req.user.role !== "vendedor" || req.user.entityId !== lead.sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (!exigirOportunidadesLiberadas(req, res, lead.sellerId)) return;

  const { tipo, resultado, duracao, valor, observacao, proximaAcao, proximaAcaoEm } = req.body;
  const def = TIPOS_EVENTO[tipo];
  if (!def) return res.status(400).json({ error: "Tipo de interação inválido" });

  for (const campo of def.exige) {
    if (!String(req.body[campo] ?? "").trim())
      return res.status(400).json({ error: `Campo "${campo}" é obrigatório para ${def.nome}` });
  }

  const ts = agora();
  const id = uid();

  db.transaction(() => {
    db.prepare(`INSERT INTO lead_events (id, leadId, sellerId, tipo, resultado, duracao, valor, observacao, criadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, lead.id, lead.sellerId, tipo, String(resultado || "").slice(0, 40),
           Number(duracao) || 0, Number(valor) || 0, String(observacao || "").slice(0, 500), ts);

    // Primeiro contato move o lead sozinho: registrar a ligação e ter de
    // arrastar a etapa na mão seria trabalho duplicado.
    const avanca = lead.etapa === "novo" && ["ligacao", "whatsapp", "email"].includes(tipo);
    const campos = ["atualizadoEm = ?"];
    const args = [ts];
    if (avanca) { campos.push("etapa = ?"); args.push("contatado"); }
    if (proximaAcao !== undefined) { campos.push("proximaAcao = ?"); args.push(String(proximaAcao).slice(0, 160)); }
    if (proximaAcaoEm !== undefined) { campos.push("proximaAcaoEm = ?"); args.push(Number(proximaAcaoEm) || null); }
    args.push(lead.id);
    db.prepare(`UPDATE leads SET ${campos.join(", ")} WHERE id = ?`).run(...args);
  })();

  res.json({ id, ok: true });
});

// Resumo do funil, para a Home do vendedor.
router.get("/leads-resumo", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });

  const porEtapa = {};
  db.prepare("SELECT etapa, COUNT(*) n, SUM(valorEstimado) v FROM leads WHERE sellerId = ? GROUP BY etapa")
    .all(entityId).forEach((r) => { porEtapa[r.etapa] = { quantidade: r.n, valor: r.v || 0 }; });

  const agoraTs = agora();
  const atrasados = db.prepare(
    "SELECT COUNT(*) n FROM leads WHERE sellerId = ? AND proximaAcaoEm IS NOT NULL AND proximaAcaoEm < ? AND etapa NOT IN ('ganho','perdido')"
  ).get(entityId, agoraTs).n;

  const hoje = db.prepare(
    "SELECT COUNT(*) n FROM lead_events WHERE sellerId = ? AND criadoEm > ?"
  ).get(entityId, agoraTs - 86400000).n;

  res.json({ porEtapa, atrasados, interacoesUltimas24h: hoje, etapas: ETAPAS });
});

export default router;

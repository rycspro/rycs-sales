import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { responderComFontes } from "../services/rag.js";

const router = Router();
const STATUS = ["aguardando", "processando", "disponível", "desatualizado", "erro"];
const empresa = (req, res) => {
  if (req.user.role !== "empresa") { res.status(403).json({ error: "Apenas empresas" }); return null; }
  return req.user.entityId;
};
const registrar = (documentId, companyId, acao, versao, atorId) => db.prepare(
  "INSERT INTO knowledge_history (id, documentId, companyId, acao, versao, atorId, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)"
).run(uid(), documentId, companyId, acao, versao, atorId, agora());

router.get("/knowledge", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  res.json(db.prepare("SELECT * FROM knowledge_documents WHERE companyId = ? ORDER BY atualizadoEm DESC").all(companyId));
});

router.post("/knowledge", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const titulo = String(req.body?.titulo || "").trim(), conteudo = String(req.body?.conteudo || "").trim();
  if (!titulo) return res.status(400).json({ error: "Título é obrigatório" });
  const origem = String(req.body?.origem || "texto");
  const status = conteudo ? "disponível" : "aguardando", id = uid(), ts = agora();
  db.prepare(`INSERT INTO knowledge_documents
    (id, companyId, campaignId, titulo, categoria, departamento, nivelAcesso, idioma, versao, origem, responsavel, validadeEm, status, conteudo, atualizadoEm, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, companyId, req.body.campaignId || null, titulo, req.body.categoria || "geral", req.body.departamento || "comercial",
      req.body.nivelAcesso || "empresa", req.body.idioma || "pt-BR", origem, req.body.responsavel || "", req.body.validadeEm || null, status, conteudo, ts, ts);
  registrar(id, companyId, "criado", 1, req.user.id);
  res.json({ id, status });
});

router.patch("/knowledge/:id", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const atual = db.prepare("SELECT * FROM knowledge_documents WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
  if (!atual) return res.status(404).json({ error: "Material não encontrado" });
  const permitidos = ["titulo","categoria","departamento","nivelAcesso","idioma","responsavel","validadeEm","campaignId","conteudo"];
  const sets = [], vals = [];
  for (const [k,v] of Object.entries(req.body || {})) if (permitidos.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  if (!sets.length) return res.status(400).json({ error: "Nenhum campo válido" });
  const versao = atual.versao + 1; sets.push("versao = ?", "status = ?", "atualizadoEm = ?"); vals.push(versao, "disponível", agora(), atual.id, companyId);
  db.prepare(`UPDATE knowledge_documents SET ${sets.join(", ")} WHERE id = ? AND companyId = ?`).run(...vals);
  registrar(atual.id, companyId, "substituído", versao, req.user.id);
  res.json({ ok: true, versao });
});

router.post("/knowledge/:id/reprocess", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const doc = db.prepare("SELECT * FROM knowledge_documents WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
  if (!doc) return res.status(404).json({ error: "Material não encontrado" });
  const status = doc.conteudo?.trim() ? "disponível" : "erro";
  db.prepare("UPDATE knowledge_documents SET status = ?, erro = ?, atualizadoEm = ? WHERE id = ? AND companyId = ?")
    .run(status, status === "erro" ? "Conteúdo ainda não extraído." : "", agora(), doc.id, companyId);
  registrar(doc.id, companyId, "reprocessado", doc.versao, req.user.id);
  res.json({ ok: true, status });
});

router.delete("/knowledge/:id", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const doc = db.prepare("SELECT id FROM knowledge_documents WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
  if (!doc) return res.status(404).json({ error: "Material não encontrado" });
  db.transaction(() => { db.prepare("DELETE FROM knowledge_history WHERE documentId = ? AND companyId = ?").run(doc.id, companyId); db.prepare("DELETE FROM knowledge_documents WHERE id = ? AND companyId = ?").run(doc.id, companyId); })();
  res.json({ ok: true });
});

router.post("/assistant/query", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const pergunta = String(req.body?.pergunta || "").trim();
  if (!pergunta) return res.status(400).json({ error: "Pergunta é obrigatória" });
  const campaignId = req.body.campaignId || null;
  const docs = campaignId
    ? db.prepare(`SELECT * FROM knowledge_documents WHERE companyId = ? AND status = 'disponível'
        AND (validadeEm IS NULL OR validadeEm > ?) AND (campaignId IS NULL OR campaignId = ?)`).all(companyId, agora(), campaignId)
    : db.prepare(`SELECT * FROM knowledge_documents WHERE companyId = ? AND status = 'disponível'
        AND (validadeEm IS NULL OR validadeEm > ?)`).all(companyId, agora());
  let resultado = responderComFontes(pergunta, docs);
  if (/atenção|atencao|problema|pendente|auditoria/i.test(pergunta)) {
    const campanhas = db.prepare("SELECT COUNT(*) n FROM campaigns WHERE companyId = ? AND status <> 'ativa'").get(companyId).n;
    const auditorias = db.prepare("SELECT COUNT(*) n FROM submissions WHERE companyId = ? AND status = 'revisao'").get(companyId).n;
    const atrasados = db.prepare("SELECT COUNT(*) n FROM leads WHERE companyId = ? AND proximaAcaoEm IS NOT NULL AND proximaAcaoEm < ? AND etapa NOT IN ('ganho','perdido')").get(companyId, agora()).n;
    resultado = {
      resposta: `${auditorias} auditoria(s) aguardando conferência, ${campanhas} campanha(s) fora do ar e ${atrasados} lead(s) com próxima ação atrasada.`,
      fontes: [{ documento: "Registros operacionais", documentId: "operacional", secao: "estado atual", versao: 1, atualizadoEm: agora() }],
      confianca: 100, informacaoAusente: false,
      acaoRecomendada: auditorias ? "Abra Conferir e revise as evidências pendentes." : "Revise campanhas e leads sinalizados.",
    };
  }
  db.prepare("INSERT INTO assistant_history (id, companyId, userId, pergunta, resposta, fontes, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(uid(), companyId, req.user.id, pergunta, resultado.resposta, JSON.stringify(resultado.fontes), agora());
  res.json({ ...resultado, requerConfirmacao: true, executado: false });
});

router.get("/assistant/audio-config", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  res.json({ configurado: false, fallback: "web_speech", formatos: ["audio/webm", "audio/mpeg", "audio/wav"] });
});

export default router;

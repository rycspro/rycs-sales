import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { responderComFontes } from "../services/rag.js";
import { extrairTextoPdf } from "../services/reportPdf.js";

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

router.post("/knowledge/import", (req,res)=>{
  const companyId=empresa(req,res);if(!companyId)return;const titulo=String(req.body?.titulo||"").trim(),mimetype=String(req.body?.mimetype||"");if(!titulo)return res.status(400).json({error:"Título é obrigatório"});
  try{const b=Buffer.from(String(req.body?.base64||""),"base64");if(!b.length||b.length>5*1024*1024)return res.status(413).json({error:"Arquivo deve ter até 5 MB"});let conteudo=mimetype==="application/pdf"?extrairTextoPdf(b):b.toString("utf8");conteudo=conteudo.trim();if(conteudo.length<20)return res.status(422).json({error:"Não foi encontrado texto suficiente. Para áudio, vídeo ou documento escaneado, envie a transcrição revisada."});const id=uid(),ts=agora();db.prepare(`INSERT INTO knowledge_documents (id,companyId,titulo,categoria,departamento,nivelAcesso,idioma,versao,origem,responsavel,status,conteudo,atualizadoEm,criadoEm) VALUES (?,?,?,?,?,'empresa','pt-BR',1,?,?,'disponível',?,?,?)`).run(id,companyId,titulo,req.body.categoria||"documento",req.body.departamento||"comercial",mimetype==="application/pdf"?"pdf":"arquivo",req.body.responsavel||"",conteudo,ts,ts);registrar(id,companyId,"importado",1,req.user.id);res.json({id,status:"disponível",caracteres:conteudo.length});}catch(e){res.status(422).json({error:e.message});}
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
      acaoRecomendada: auditorias ? "Abra Aprovações e revise as evidências pendentes." : "Revise campanhas e leads sinalizados.",
    };
  }
  const historyId = uid(), contexto = String(req.body?.contexto || "geral").slice(0, 40);
  db.prepare("INSERT INTO assistant_history (id, companyId, userId, pergunta, resposta, fontes, contexto, status, acao, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, 'proposto', 'registrar_analise', ?)")
    .run(historyId, companyId, req.user.id, pergunta, resultado.resposta, JSON.stringify(resultado.fontes), contexto, agora());
  res.json({ ...resultado, historyId, requerConfirmacao: true, executado: false, proposta: { titulo: `Análise de ${contexto}`, impacto: "Registra esta análise no histórico autorizado da empresa; não altera dados operacionais.", calculo: resultado.fontes?.length ? `${resultado.fontes.length} fonte(s) recuperada(s)` : "Nenhuma fonte suficiente" } });
});

router.get("/assistant/history", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  res.json(db.prepare("SELECT id, pergunta, resposta, fontes, contexto, status, acao, criadoEm, confirmadoEm FROM assistant_history WHERE companyId = ? ORDER BY criadoEm DESC LIMIT 30").all(companyId).map((h)=>({...h,fontes:JSON.parse(h.fontes||"[]")})));
});

router.post("/assistant/confirm/:id", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const item = db.prepare("SELECT * FROM assistant_history WHERE id = ? AND companyId = ?").get(req.params.id, companyId);
  if (!item) return res.status(404).json({ error: "Proposta não encontrada" });
  if (item.status === "executado") return res.json({ ok:true, executado:true, duplicado:true });
  db.prepare("UPDATE assistant_history SET status = 'executado', confirmadoEm = ? WHERE id = ? AND companyId = ?").run(agora(), item.id, companyId);
  res.json({ ok:true, executado:true, acao:item.acao, message:"Análise confirmada e registrada no histórico." });
});

router.post("/assistant/training-draft", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const docs = db.prepare("SELECT id, titulo, conteudo, versao FROM knowledge_documents WHERE companyId = ? AND status = 'disponível' ORDER BY atualizadoEm DESC").all(companyId);
  const trechos = docs.flatMap((d)=>String(d.conteudo||"").split(/(?<=[.!?])\s+|\n+/).map((t)=>t.trim()).filter((t)=>t.length>=35).map((t,i)=>({texto:t.slice(0,420),documento:d.titulo,documentId:d.id,versao:d.versao,secao:i+1}))).slice(0,10);
  if (trechos.length < 5) return res.status(422).json({ error:"Adicione conteúdo suficiente à Base de Conhecimento para gerar ao menos 5 perguntas fundamentadas." });
  const questoes = trechos.slice(0,Math.min(10,trechos.length)).map((t,i)=>{const distratores=trechos.filter((_,n)=>n!==i).slice(0,2).map((x)=>x.texto);return { pergunta:`Qual orientação está registrada na fonte “${t.documento}”?`, opcoes:[t.texto,...distratores].sort((a,b)=>a.length-b.length), correta:0, resposta:t.texto, justificativa:`Resposta baseada exclusivamente em ${t.documento}, seção ${t.secao}, versão ${t.versao}.`, fonte:t };});
  // Recalcula o índice correto depois da ordenação usada para variar a posição.
  questoes.forEach((q)=>{q.correta=q.opcoes.indexOf(q.resposta);});
  const modulos = docs.slice(0,6).map((d)=>({id:`rag-${d.id}`,titulo:d.titulo,conteudo:String(d.conteudo||"").slice(0,1600),fonte:{documentId:d.id,documento:d.titulo,versao:d.versao}}));
  res.json({ modulos, questoes, status:"rascunho", fontes:trechos.map((t)=>t.documentId) });
});

router.get("/assistant/audio-config", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  res.json({ configurado: false, fallback: "web_speech", formatos: ["audio/webm", "audio/mpeg", "audio/wav"] });
});

export default router;

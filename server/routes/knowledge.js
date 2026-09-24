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
  const perfil = String(req.body?.perfil || "sdr").toLowerCase();
  const tipoOperacao = String(req.body?.tipoOperacao || "remota").toLowerCase();
  const companhia = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
  const campanhas = db.prepare("SELECT * FROM campaigns WHERE companyId = ? ORDER BY criadoEm DESC LIMIT 8").all(companyId);
  const docs = db.prepare("SELECT id, titulo, conteudo, versao FROM knowledge_documents WHERE companyId = ? AND status = 'disponível' ORDER BY atualizadoEm DESC").all(companyId);
  const json = (valor, padrao = []) => { try { return JSON.parse(valor || ""); } catch { return padrao; } };
  const materiais = json(companhia?.materiais);
  const conteudosExistentes = [
    ...json(companhia?.curso),
    ...campanhas.flatMap((c) => json(c.treinamento)),
  ].filter((item) => item && (item.titulo || item.conteudo));
  const tem = (valor) => String(valor || "").trim().length > 2;
  const campanhaComProduto = campanhas.find((c) => tem(c.produto) || tem(c.descricao));
  const campanhaComIcp = campanhas.find((c) => tem(c.publico));
  const pendencias = [];
  if (!tem(companhia?.produto) && !campanhaComProduto) pendencias.push({ campo: "produto", label: "Produto ou serviço", destino: "cadastro" });
  if (!tem(companhia?.icp) && !campanhaComIcp) pendencias.push({ campo: "icp", label: "ICP / público-alvo", destino: "cadastro" });
  if (!tem(companhia?.diferenciais) && !docs.length && !materiais.length && !conteudosExistentes.length) pendencias.push({ campo: "diferenciais", label: "Diferenciais ou material comercial", destino: "cadastro" });
  if (!tem(companhia?.objecoes) && !docs.length && !conteudosExistentes.length) pendencias.push({ campo: "objecoes", label: "Objeções e respostas comerciais", destino: "cadastro" });
  if (pendencias.length) return res.status(422).json({
    error: "Faltam informações para gerar um treinamento confiável.", pendencias,
  });

  const produto = companhia.produto || campanhaComProduto?.produto || campanhaComProduto?.descricao;
  const icp = companhia.icp || campanhaComIcp?.publico || "público definido na operação";
  const diferenciais = companhia.diferenciais || materiais.map((m) => m.nome).join(", ") || docs.map((d) => d.titulo).join(", ");
  const objecoes = companhia.objecoes || conteudosExistentes.map((m) => m.conteudo).filter(Boolean).join("\n").slice(0, 1000) || "Consulte os materiais e responda com base no contexto da operação.";
  const perfilNome = { sdr: "SDR", bdr: "BDR", closer: "Closer", pap: "PAP / Porta a Porta", "sem-exp": "Iniciante" }[perfil] || perfil.toUpperCase();
  const canal = tipoOperacao === "pap" || perfil === "pap" ? "presencial / porta a porta" : tipoOperacao;
  const trechos = docs.flatMap((d) => String(d.conteudo || "").split(/(?<=[.!?])\s+|\n+/)
    .map((t) => t.trim()).filter((t) => t.length >= 35)
    .map((texto, i) => ({ texto: texto.slice(0, 420), documento: d.titulo, documentId: d.id, versao: d.versao, secao: i + 1 }))).slice(0, 8);
  const fontes = [
    ...(tem(companhia.produto) || tem(companhia.icp) || tem(companhia.diferenciais) || tem(companhia.objecoes) ? ["cadastro-empresa"] : []),
    ...campanhas.map((c) => `campanha-${c.id}`), ...docs.map((d) => d.id),
    ...materiais.map((m) => `material-${m.id || m.nome}`), ...conteudosExistentes.map((m) => `treinamento-${m.id || m.titulo}`),
  ];
  const modulos = [
    { id: `base-${Date.now()}-1`, titulo: `Produto e proposta de valor para ${perfilNome}`, conteudo: `Produto/serviço: ${produto}\nPúblico-alvo: ${icp}\nDiferenciais: ${diferenciais}\n\nExplique o benefício em linguagem adequada à operação ${canal}.`, fonte: { tipo: "dados da empresa" } },
    { id: `base-${Date.now()}-2`, titulo: `Abordagem ${canal}`, conteudo: `Perfil comercial: ${perfilNome}.\nUse uma abertura objetiva, conectada ao ICP (${icp}), valide a necessidade e defina o próximo passo. Registre o contexto relevante no CRM.`, fonte: { tipo: "perfil e operação" } },
    { id: `base-${Date.now()}-3`, titulo: "Objeções e encaminhamento", conteudo: `Objeções e orientações existentes: ${objecoes}\n\nNão invente condições. Confirme a dúvida, retome o diferencial aplicável e combine um próximo passo concreto.`, fonte: { tipo: "dados comerciais" } },
    ...conteudosExistentes.slice(0, 2).map((m, i) => ({ id: `operacao-${m.id || i}`, titulo: m.titulo || "Material operacional", conteudo: String(m.conteudo || "").slice(0, 1600), fonte: { tipo: "campanha ou onboarding existente" } })),
    ...docs.slice(0, 3).map((d) => ({ id: `rag-${d.id}`, titulo: d.titulo, conteudo: String(d.conteudo || "").slice(0, 1600), fonte: { documentId: d.id, documento: d.titulo, versao: d.versao } })),
  ];
  const basesQuiz = trechos.length >= 3 ? trechos.slice(0, 5) : [
    { texto: produto, documento: "Produto ou serviço" }, { texto: icp, documento: "ICP" }, { texto: diferenciais, documento: "Diferenciais" }, { texto: objecoes, documento: "Objeções" },
  ];
  const questoes = basesQuiz.slice(0, 5).map((t, i) => {
    const distratores = basesQuiz.filter((_, n) => n !== i).slice(0, 2).map((x) => x.texto);
    const opcoes = [t.texto, ...distratores].sort((a, b) => a.length - b.length);
    return { pergunta: `Qual orientação deve guiar a atuação de ${perfilNome} em “${t.documento}”?`, opcoes, correta: opcoes.indexOf(t.texto), justificativa: `Base: ${t.documento}.` };
  });
  res.json({ modulos, questoes, status: "rascunho", fontes: [...new Set(fontes)], perfil, tipoOperacao });
});

router.get("/assistant/audio-config", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  res.json({ configurado: false, fallback: "web_speech", formatos: ["audio/webm", "audio/mpeg", "audio/wav"] });
});

export default router;

import { Router } from "express";
import db, { uid, agora } from "../db.js";

const router = Router();

const empresa = (req, res) => {
  if (req.user.role !== "empresa") { res.status(403).json({ error: "Apenas empresas" }); return null; }
  return req.user.entityId;
};

const DIMENSOES = [
  { id: "produto", label: "Produto / Serviço", peso: 15, campos: ["produto"] },
  { id: "icp", label: "ICP / Persona", peso: 12, campos: ["icp"] },
  { id: "proposta", label: "Proposta de valor", peso: 10, campos: ["produto", "diferenciais"] },
  { id: "diferenciais", label: "Diferenciais", peso: 10, campos: ["diferenciais"] },
  { id: "objecoes", label: "Objeções", peso: 10, campos: ["objecoes"] },
  { id: "processo", label: "Processo comercial", peso: 10, campos: ["processo"] },
  { id: "scripts", label: "Scripts / Argumentação", peso: 8, campos: [] },
  { id: "qualificacao", label: "Qualificação", peso: 8, campos: ["qualificacao"] },
  { id: "provas", label: "Provas / Cases", peso: 8, campos: [] },
  { id: "regras", label: "Regras comerciais", peso: 9, campos: [] },
];

const PERGUNTAS = [
  { id: "q1", texto: "O que sua empresa vende?", campo: "produto", min: 1 },
  { id: "q2", texto: "Quem normalmente compra de você?", campo: "icp", min: 1 },
  { id: "q3", texto: "Qual problema seu produto ou serviço resolve?", campo: "diferenciais", min: 1 },
  { id: "q4", texto: "Por que um cliente escolhe vocês e não outra empresa?", campo: "diferenciais", min: 2 },
  { id: "q5", texto: "Quanto normalmente custa e como funciona sua oferta?", campo: "ticket", min: 1 },
  { id: "q6", texto: "Como vocês conseguem clientes e vendem hoje?", campo: "processo", min: 1 },
  { id: "q7", texto: "Quais são as principais objeções que os clientes apresentam?", campo: "objecoes", min: 1 },
  { id: "q8", texto: "Como você identifica se um cliente é bom ou ruim para sua empresa?", campo: "qualificacao", min: 1 },
  { id: "q9", texto: "Quais provas, cases ou resultados ajudam vocês a vender?", campo: "diferenciais", min: 1 },
  { id: "q10", texto: "Se você tivesse que ensinar um novo vendedor hoje, o que ele jamais poderia deixar de saber?", campo: "processo", min: 1 },
];

function calcularScore(companhia, docs, respostas) {
  const tem = (v, min = 3) => String(v || "").trim().length >= min;
  const docsDisponiveis = docs.filter((d) => d.status === "disponível");
  const nDocs = docsDisponiveis.length;

  const dims = DIMENSOES.map((d) => {
    let completo = false;
    if (d.campos.length > 0) {
      completo = d.campos.some((c) => tem(companhia[c], 10));
    }
    // Bônus se houver docs e respostas
    if (!completo && nDocs >= 2) {
      completo = ["scripts", "provas", "regras"].includes(d.id);
    }
    // Verificar respostas do onboarding
    if (!completo && respostas) {
      const r = typeof respostas === "string" ? JSON.parse(respostas || "{}") : respostas;
      const camposMapeados = PERGUNTAS.filter((p) => p.campo === d.campos[0]).map((p) => r[p.id]);
      if (camposMapeados.some((v) => tem(v, 10))) completo = true;
    }
    return { ...d, completo };
  });

  const total = dims.reduce((acc, d) => acc + d.peso, 0);
  const obtido = dims.filter((d) => d.completo).reduce((acc, d) => acc + d.peso, 0);
  const score = Math.round((obtido / total) * 100);

  const lacunas = dims
    .filter((d) => !d.completo)
    .map((d) => ({
      id: d.id,
      label: d.label,
      impacto: d.peso,
      perguntaSugerida: sugerirPergunta(d.id),
      tempoMin: d.peso >= 10 ? 2 : 1,
    }))
    .sort((a, b) => b.impacto - a.impacto);

  return { score, dims, lacunas };
}

function sugerirPergunta(dimId) {
  const map = {
    produto: "O que exatamente sua empresa vende e para quem?",
    icp: "Descreva o perfil do cliente ideal da sua empresa.",
    proposta: "Qual é o principal resultado que seu produto entrega?",
    diferenciais: "Por que clientes escolhem vocês em vez da concorrência?",
    objecoes: "Como vocês respondem quando o cliente diz que está caro?",
    processo: "Descreva o processo comercial desde o primeiro contato até o fechamento.",
    scripts: "Qual script ou abordagem funciona melhor para sua equipe?",
    qualificacao: "Quais critérios definem se um lead é bom para sua empresa?",
    provas: "Compartilhe um case ou resultado que ajuda a vender.",
    regras: "Existe política de desconto ou regras especiais para vendedores?",
  };
  return map[dimId] || "Conte mais sobre este aspecto da sua operação.";
}

function obterOuCriarOnboarding(companyId) {
  let ob = db.prepare("SELECT * FROM brain_onboarding WHERE companyId = ?").get(companyId);
  if (!ob) {
    const id = uid(), ts = agora();
    db.prepare("INSERT INTO brain_onboarding (id, companyId, etapa, criadoEm, atualizadoEm) VALUES (?, ?, 1, ?, ?)").run(id, companyId, ts, ts);
    ob = db.prepare("SELECT * FROM brain_onboarding WHERE companyId = ?").get(companyId);
  }
  return ob;
}

// GET /brain/score
router.get("/brain/score", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const companhia = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
  const docs = db.prepare("SELECT id, titulo, status FROM knowledge_documents WHERE companyId = ?").all(companyId);
  const ob = obterOuCriarOnboarding(companyId);
  const respostas = JSON.parse(ob.respostas || "{}");
  const { score, dims, lacunas } = calcularScore(companhia, docs, respostas);

  // Atualizar cache
  db.prepare("UPDATE brain_onboarding SET scoreCache = ?, scoreDims = ?, lacunas = ?, atualizadoEm = ? WHERE companyId = ?")
    .run(score, JSON.stringify(dims), JSON.stringify(lacunas), agora(), companyId);

  const nivel = score >= 90 ? "avancada" : score >= 75 ? "completa" : score >= 50 ? "utilizavel" : "inicial";
  const nivelLabel = { avancada: "Base avançada", completa: "Base completa", utilizavel: "Base utilizável", inicial: "Base inicial" }[nivel];

  res.json({
    score, nivel, nivelLabel, dims, lacunas,
    onboarding: {
      etapa: ob.etapa,
      concluida: !!ob.concluida,
      ativado: !!ob.ativado,
      revisado: !!ob.revisado,
      temRespostas: Object.keys(respostas).length > 0,
    },
    docs: docs.length,
    tempoEstimadoMin: Math.ceil(lacunas.slice(0, 5).reduce((a, l) => a + l.tempoMin, 0)),
  });
});

// GET /brain/onboarding
router.get("/brain/onboarding", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const companhia = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
  const ob = obterOuCriarOnboarding(companyId);
  const respostas = JSON.parse(ob.respostas || "{}");

  // Enriquecer perguntas com respostas existentes (empresa ou onboarding)
  const perguntasEnriquecidas = PERGUNTAS.map((p) => {
    const respostaExistente = respostas[p.id] || (companhia[p.campo] && String(companhia[p.campo]).length > 5 ? companhia[p.campo] : "");
    return { ...p, respostaExistente };
  });

  res.json({
    perguntas: perguntasEnriquecidas,
    etapa: ob.etapa,
    concluida: !!ob.concluida,
    ativado: !!ob.ativado,
    revisado: !!ob.revisado,
    respostas,
    resumoIa: ob.resumoIa || "",
  });
});

// POST /brain/onboarding/respostas
router.post("/brain/onboarding/respostas", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const ob = obterOuCriarOnboarding(companyId);
  const respostasAtuais = JSON.parse(ob.respostas || "{}");
  const novas = req.body?.respostas || {};
  const merged = { ...respostasAtuais, ...novas };
  const etapa = Math.max(ob.etapa, req.body?.etapa || ob.etapa);
  db.prepare("UPDATE brain_onboarding SET respostas = ?, etapa = ?, atualizadoEm = ? WHERE companyId = ?")
    .run(JSON.stringify(merged), etapa, agora(), companyId);

  // Salvar campos relevantes na empresa também
  const companhia = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
  const sets = [], vals = [];
  const mapaResposta = { q1: "produto", q2: "icp", q5: "ticket", q6: "processo", q7: "objecoes", q8: "qualificacao" };
  for (const [qid, campo] of Object.entries(mapaResposta)) {
    if (novas[qid] && String(novas[qid]).trim().length > 5) {
      const existente = String(companhia[campo] || "").trim();
      if (!existente || existente.length < 5) {
        sets.push(`${campo} = ?`); vals.push(String(novas[qid]).trim().slice(0, 1000));
      }
    }
  }
  if (sets.length) {
    vals.push(agora(), companyId);
    db.prepare(`UPDATE companies SET ${sets.join(", ")}, atualizadoEm = ? WHERE id = ?`).run(...vals);
  }

  res.json({ ok: true, respostas: merged });
});

// POST /brain/onboarding/organizar
router.post("/brain/onboarding/organizar", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const companhia = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
  const docs = db.prepare("SELECT titulo, conteudo FROM knowledge_documents WHERE companyId = ? AND status = 'disponível' LIMIT 10").all(companyId);
  const ob = obterOuCriarOnboarding(companyId);
  const respostas = JSON.parse(ob.respostas || "{}");

  const tem = (v) => String(v || "").trim().length > 5;
  const pegar = (campo, qid) => respostas[qid] || companhia[campo] || "";

  const resumo = {
    produto: pegar("produto", "q1") || "Não informado",
    clienteIdeal: pegar("icp", "q2") || "Não informado",
    problema: respostas.q3 || "Não informado",
    diferenciais: (respostas.q4 || companhia.diferenciais || "") + (respostas.q9 ? "\n" + respostas.q9 : ""),
    ticket: pegar("ticket", "q5") || "Não informado",
    processo: pegar("processo", "q6") || "Não informado",
    objecoes: pegar("objecoes", "q7") || "Não informado",
    qualificacao: pegar("qualificacao", "q8") || "Não informado",
    ensinamentos: respostas.q10 || "Não informado",
    docs: docs.map((d) => d.titulo),
  };

  const resumoTexto = JSON.stringify(resumo, null, 2);
  db.prepare("UPDATE brain_onboarding SET resumoIa = ?, etapa = 3, atualizadoEm = ? WHERE companyId = ?")
    .run(resumoTexto, agora(), companyId);

  res.json({ ok: true, resumo });
});

// POST /brain/onboarding/revisar
router.post("/brain/onboarding/revisar", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const edicoes = req.body?.edicoes || {};
  db.prepare("UPDATE brain_onboarding SET revisado = 1, etapa = 4, atualizadoEm = ? WHERE companyId = ?").run(agora(), companyId);

  // Aplicar edições manuais
  if (Object.keys(edicoes).length) {
    const campos = ["produto", "icp", "ticket", "diferenciais", "objecoes", "processo", "qualificacao"];
    const sets = [], vals = [];
    for (const [campo, valor] of Object.entries(edicoes)) {
      if (campos.includes(campo) && String(valor).trim().length > 2) {
        sets.push(`${campo} = ?`); vals.push(String(valor).trim().slice(0, 1000));
      }
    }
    if (sets.length) {
      vals.push(agora(), companyId);
      db.prepare(`UPDATE companies SET ${sets.join(", ")}, atualizadoEm = ? WHERE id = ?`).run(...vals);
    }
  }

  res.json({ ok: true });
});

// POST /brain/onboarding/ativar
router.post("/brain/onboarding/ativar", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const ob = db.prepare("SELECT * FROM brain_onboarding WHERE companyId = ?").get(companyId);
  if (!ob) return res.status(404).json({ error: "Onboarding não encontrado" });

  db.prepare("UPDATE brain_onboarding SET ativado = 1, concluida = 1, etapa = 4, atualizadoEm = ? WHERE companyId = ?").run(agora(), companyId);

  // Gerar documentos de conhecimento a partir das respostas
  const respostas = JSON.parse(ob.respostas || "{}");
  const companhia = db.prepare("SELECT * FROM companies WHERE id = ?").get(companyId);
  const blocos = [
    { titulo: "Produto e Proposta de Valor", conteudo: `Produto: ${respostas.q1 || companhia.produto}\nProblema resolvido: ${respostas.q3 || ""}\nDiferenciais: ${respostas.q4 || companhia.diferenciais || ""}`, categoria: "produto" },
    { titulo: "Cliente Ideal (ICP)", conteudo: `ICP: ${respostas.q2 || companhia.icp}\nCritérios de qualificação: ${respostas.q8 || companhia.qualificacao || ""}`, categoria: "icp" },
    { titulo: "Objeções e Respostas", conteudo: respostas.q7 || companhia.objecoes || "", categoria: "objecoes" },
    { titulo: "Processo Comercial", conteudo: `${respostas.q6 || companhia.processo || ""}\n\nO que o vendedor não pode deixar de saber: ${respostas.q10 || ""}`, categoria: "processo" },
    { titulo: "Cases e Provas", conteudo: respostas.q9 || "", categoria: "provas" },
  ].filter((b) => b.conteudo.trim().length > 20);

  const ts = agora();
  for (const bloco of blocos) {
    const existe = db.prepare("SELECT id FROM knowledge_documents WHERE companyId = ? AND titulo = ?").get(companyId, bloco.titulo);
    if (!existe) {
      db.prepare(`INSERT INTO knowledge_documents (id, companyId, titulo, categoria, departamento, nivelAcesso, idioma, versao, origem, status, conteudo, atualizadoEm, criadoEm)
        VALUES (?, ?, ?, ?, 'comercial', 'empresa', 'pt-BR', 1, 'onboarding', 'disponível', ?, ?, ?)`)
        .run(uid(), companyId, bloco.titulo, bloco.categoria || "geral", bloco.conteudo, ts, ts);
    }
  }

  res.json({ ok: true, documentosGerados: blocos.length });
});

// POST /brain/lacuna/responder
router.post("/brain/lacuna/responder", (req, res) => {
  const companyId = empresa(req, res); if (!companyId) return;
  const { lacunaId, resposta } = req.body || {};
  if (!lacunaId || !String(resposta || "").trim()) return res.status(400).json({ error: "Lacuna e resposta obrigatórias" });

  // Criar documento de conhecimento para a lacuna
  const titulo = `Resposta — ${lacunaId}`;
  const ts = agora();
  const id = uid();
  db.prepare(`INSERT INTO knowledge_documents (id, companyId, titulo, categoria, departamento, nivelAcesso, idioma, versao, origem, status, conteudo, atualizadoEm, criadoEm)
    VALUES (?, ?, ?, 'geral', 'comercial', 'empresa', 'pt-BR', 1, 'lacuna', 'disponível', ?, ?, ?)`)
    .run(id, companyId, titulo, String(resposta).trim(), ts, ts);

  // Atualizar o campo correspondente na empresa se for mapeável
  const mapaLacuna = { objecoes: "objecoes", processo: "processo", qualificacao: "qualificacao", diferenciais: "diferenciais", icp: "icp" };
  if (mapaLacuna[lacunaId]) {
    db.prepare(`UPDATE companies SET ${mapaLacuna[lacunaId]} = ?, atualizadoEm = ? WHERE id = ?`).run(String(resposta).trim().slice(0, 1000), ts, companyId);
  }

  res.json({ ok: true, documentoId: id });
});

export default router;

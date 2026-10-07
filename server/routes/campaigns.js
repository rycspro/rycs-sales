import { Router } from "express";
import { sugerirCampanha } from "../services/campanhaAssistida.js";
import db, { uid, agora } from "../db.js";
import { campanhaPodeSerPublicada, STATUS_CAMPANHA, saldoDisponivel, isPremium } from "../../shared/empresa.js";
import { dentroDoLimite } from "../../shared/planos.js";
import { exigirOportunidadesLiberadas } from "../services/acessoProfissional.js";
import { atendeCertificacaoDaCampanha } from "../../shared/campaignAcademy.js";
import { obterOperacaoCampanha, obterVisaoGeralCampanhas } from "../services/campaignOperations.js";
import { registrarEventoCampanha } from "../services/campaignEvents.js";

const router = Router();

function certificacoesDoProfissional(sellerId) {
  const trilhas = db.prepare("SELECT funcao, percentual FROM certifications WHERE sellerId = ?").all(sellerId);
  const cursos = db.prepare(`
    SELECT c.funcao, ce.percentual
    FROM course_certificates ce
    JOIN courses c ON c.id = ce.courseId
    WHERE ce.sellerId = ? AND c.funcao != ''
  `).all(sellerId);
  return [...trilhas, ...cursos];
}

// Rascunho de campanha a partir de um pedido em texto livre. Nada é criado
// nem publicado aqui: devolve a configuração para a empresa revisar na tela.
router.post("/campaigns/sugerir", async (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });

  const brief = String(req.body?.brief || "").trim();
  if (brief.length < 10) return res.status(400).json({ error: "Descreva em uma frase o que você precisa que aconteça." });

  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.user.entityId);
  if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

  const r = await sugerirCampanha({ empresa, brief });
  if (!r.campanha) return res.status(422).json({ error: r.explicacao });
  res.json(r);
});


// Geração de treinamento com IA para uma campanha.
// Usa o contexto da campanha + empresa + Cérebro da Operação.
// Devolve módulos prontos para a empresa revisar — nada é salvo automaticamente.
router.post("/campaigns/treinamento", async (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });

  const { modelo = "rapido", campanha = {}, empresa: empresaCtx = {} } = req.body || {};

  // Contexto do Cérebro da Operação (knowledge base)
  const docs = db.prepare("SELECT titulo, conteudo, origem FROM knowledge_documents WHERE companyId = ? AND status != 'erro' LIMIT 10").all(req.user.entityId);
  const cerebroCtx = docs.length
    ? docs.map((d) => `[${d.origem || "texto"}] ${d.titulo}: ${String(d.conteudo || "").slice(0, 300)}`).join("\n")
    : "";

  const PROMPTS = {
    rapido: "Crie 2 módulos de treinamento rápido: visão geral do produto/serviço e script de abordagem. Cada módulo com título e conteúdo de até 300 palavras.",
    completo: "Crie 4 módulos detalhados: (1) Produto e proposta de valor, (2) Perfil do cliente ideal (ICP), (3) Objeções e respostas, (4) Processo comercial e evidências exigidas.",
    quiz: "Crie 3 módulos de quiz com perguntas de múltipla escolha: título do módulo, conteúdo explicativo curto e 3 perguntas com 4 alternativas cada (indique a correta com [CERTA]).",
    script: "Crie 3 módulos de script operacional: (1) Abordagem inicial, (2) Qualificação do lead, (3) Condução para o próximo passo. Cada um com diálogo modelo.",
  };

  const instrucao = PROMPTS[modelo] || PROMPTS.rapido;

  // Motor interno: estrutura determinística sem IA externa
  const modulosInternos = () => {
    const base = [
      { id: `mod-${Date.now()}-1`, titulo: `${campanha.titulo || "Operação"} — Visão geral`, conteudo: `Produto/serviço: ${empresaCtx.produto || campanha.descricao || "Consulte o material da empresa"}.\nCliente ideal: ${campanha.publico || empresaCtx.icp || "Conforme briefing da campanha"}.\nRegião: ${campanha.regiao || "Nacional"}.\nFunção: ${campanha.funcao?.toUpperCase() || "SDR"}.` },
      { id: `mod-${Date.now()}-2`, titulo: "Script de abordagem", conteudo: `Olá, [nome]! Aqui é [seu nome], da equipe de prospecção. Estou entrando em contato porque atendemos empresas como a sua${campanha.publico ? " — " + campanha.publico : ""}.\n\nPosso compartilhar como temos ajudado esses negócios? Tenho disponibilidade essa semana para uma conversa rápida.` },
    ];
    if (modelo === "completo") {
      base.push(
        { id: `mod-${Date.now()}-3`, titulo: "Objeções e respostas", conteudo: cerebroCtx ? "Use os materiais do Cérebro da Operação como referência." : "Não tenho tempo agora → Entendo! Quanto tempo você teria em uma terça ou quarta? São só 15 minutos.\nJá trabalho com outro fornecedor → Ótimo! Nós não viemos substituir, mas trazer uma comparação honesta." },
        { id: `mod-${Date.now()}-4`, titulo: "Processo e evidências", conteudo: `Após o contato, registre:\n- Nome e cargo do contato\n- Confirmação da reunião (data, horário, participantes)\n- Vídeo ou captura de tela da confirmação\n\nPrazo máximo: ${campanha.prazoHoras || 48}h após o agendamento.` }
      );
    }
    return base;
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ modulos: modulosInternos(), fonte: "interno" });
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const resposta = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system:
        "Você cria módulos de treinamento para profissionais de vendas comissionados. " +
        "Responda APENAS um JSON com a chave 'modulos': array de objetos com 'titulo' e 'conteudo'. " +
        "Máximo 4 módulos. Conteúdo direto, prático, sem introduções genéricas.",
      messages: [{
        role: "user",
        content:
          `Empresa: ${empresaCtx.nome || "—"}\nProduto: ${empresaCtx.produto || "—"}\nTicket: ${empresaCtx.ticket || "—"}\nICP: ${empresaCtx.icp || campanha.publico || "—"}\n` +
          `Campanha: ${campanha.titulo || "—"}\nFunção: ${campanha.funcao || "SDR"}\nRegião: ${campanha.regiao || "—"}\n` +
          (cerebroCtx ? `\nCérebro da Operação:\n${cerebroCtx}\n` : "") +
          `\nInstrução: ${instrucao}`,
      }],
    });

    const texto = resposta.content.map((b) => b.text || "").join("");
    const json = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));
    const modulos = Array.isArray(json.modulos)
      ? json.modulos.slice(0, 4).map((m, i) => ({ id: `mod-${Date.now()}-${i}`, titulo: String(m.titulo || "").slice(0, 120), conteudo: String(m.conteudo || "").slice(0, 2000) }))
      : modulosInternos();

    res.json({ modulos, fonte: "externo" });
  } catch (err) {
    console.error("[treinamento] provedor externo indisponível:", err.message);
    res.json({ modulos: modulosInternos(), fonte: "interno" });
  }
});

router.get("/campaigns", (req, res) => {
  const { role, entityId } = req.user;
  let rows;
  if (role === "empresa") {
    rows = db.prepare("SELECT * FROM campaigns WHERE companyId = ? ORDER BY criadoEm DESC").all(entityId);
  } else {
    rows = db.prepare("SELECT * FROM campaigns ORDER BY criadoEm DESC").all();
  }
  res.json(rows.map(parseCampaign));
});

// Um único contrato agregado abastece os cards do dashboard. Além de evitar
// uma requisição por indicador, todo cálculo permanece isolado por empresa no
// servidor — o cliente nunca escolhe qual companyId consultar.
router.get("/campaigns-overview", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });
  const overview = obterVisaoGeralCampanhas(req.user.entityId);
  if (!overview) return res.status(404).json({ error: "Empresa não encontrada" });
  res.json(overview);
});

router.get("/campaigns/:id/operations", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });
  const operacao = obterOperacaoCampanha(req.user.entityId, req.params.id, {
    periodo: String(req.query.periodo || "7d"),
    de: req.query.de,
    ate: req.query.ate,
  });
  if (!operacao) return res.status(404).json({ error: "Campanha não encontrada" });
  res.json(operacao);
});

router.get("/campaigns/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Campanha não encontrada" });
  if (req.user.role === "empresa" && req.user.entityId !== row.companyId)
    return res.status(403).json({ error: "Sem permissão" });
  if (req.user.role === "vendedor" && row.status !== "ativa")
    return res.status(404).json({ error: "Campanha não encontrada" });
  const campaign = parseCampaign(row);

  const apps = db.prepare("SELECT * FROM campaign_applications WHERE campaignId = ?").all(req.params.id);
  campaign.candidaturas = apps;

  res.json(campaign);
});

router.post("/campaigns", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa" && role !== "admin")
    return res.status(403).json({ error: "Apenas empresas podem criar campanhas" });

  const { titulo, descricao, produto, publico, vagas, comissoes, treinamento, requisitos, objetivo, regiao,
    funcao, orcamento, tarefas, evidencias, criteriosAprovacao, prazoHoras, limitePorProfissional,
    aceitaLeadProprio, exigeCertificacao, duracaoDias, visitasPorDia } = req.body;
  if (!titulo) return res.status(400).json({ error: "Título é obrigatório" });

  const companyId = role === "empresa" ? entityId : req.body.companyId;
  if (!companyId) return res.status(400).json({ error: "companyId é obrigatório" });

  const id = uid();
  const criadoEm = agora();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO campaigns (id, companyId, titulo, descricao, produto, publico, status, vagas, comissoes, treinamento,
        requisitos, objetivo, regiao, funcao, orcamento, tarefas, evidencias, criteriosAprovacao, prazoHoras, duracaoDias,
        limitePorProfissional, aceitaLeadProprio, exigeCertificacao, visitasPorDia, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, companyId, titulo, descricao || "", produto || "", publico || "",
      vagas || 0, JSON.stringify(comissoes || {}), JSON.stringify(treinamento || []),
      requisitos || "", objetivo || "", regiao || "", funcao || "", Number(orcamento) || 0,
      JSON.stringify(tarefas || {}), JSON.stringify(evidencias || {}), JSON.stringify(criteriosAprovacao || {}),
      Math.max(1, Number(prazoHoras) || 48), Math.max(1, Number(duracaoDias) || 30), Math.max(0, Number(limitePorProfissional) || 0),
      aceitaLeadProprio ? 1 : 0, exigeCertificacao ? 1 : 0, Math.max(0, Number(visitasPorDia) || 0), criadoEm);
    registrarEventoCampanha({ companyId, campaignId: id, tipo: "CAMPAIGN_CREATED", actorId: req.user.id, actorRole: role, source: "USER", criadoEm });
  })();

  res.json({ id });
});

router.patch("/campaigns/:id", (req, res) => {
  const { role, entityId } = req.user;
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId)
    return res.status(403).json({ error: "Sem permissão" });

  const allowed = ["titulo", "descricao", "produto", "publico", "vagas", "requisitos", "objetivo", "regiao", "funcao",
    "orcamento", "prazoHoras", "duracaoDias", "limitePorProfissional", "aceitaLeadProprio", "exigeCertificacao", "visitasPorDia"];
  const jsonFields = ["comissoes", "treinamento", "tarefas", "evidencias", "criteriosAprovacao", "modelosVerificacao"];
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(req.body)) {
    if (allowed.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(["aceitaLeadProprio", "exigeCertificacao"].includes(k) ? (v ? 1 : 0) : v);
    }
    else if (jsonFields.includes(k)) { sets.push(`${k} = ?`); vals.push(JSON.stringify(v)); }
  }
  if (!sets.length) return res.status(400).json({ error: "Nenhum campo válido" });
  vals.push(req.params.id);
  db.prepare(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

router.post("/campaigns/:id/status", (req, res) => {
  const { role, entityId } = req.user;
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor") return res.status(403).json({ error: "Sem permissão" });
  const status = String(req.body?.status || "");
  if (!STATUS_CAMPANHA.includes(status)) return res.status(400).json({ error: "Status inválido" });

  if (status === "ativa") {
    const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(campaign.companyId);
    const parsed = parseCampaign(campaign);
    const check = campanhaPodeSerPublicada(parsed, empresa);
    if (!check.ok) return res.status(422).json({ error: "Campanha ainda não pode ser publicada.", pendencias: check.pendencias });
    const ativas = db.prepare("SELECT COUNT(*) n FROM campaigns WHERE companyId = ? AND status = 'ativa' AND id <> ?")
      .get(campaign.companyId, campaign.id).n;
    if (!isPremium(empresa) && !dentroDoLimite(empresa.assinatura, "campanhasAtivas", ativas))
      return res.status(422).json({ error: "Limite de campanhas ativas do plano atingido." });
    if (!isPremium(empresa) && Number(parsed.orcamento) > saldoDisponivel(empresa))
      return res.status(422).json({ error: "O orçamento da campanha supera o saldo disponível." });
  }

  db.transaction(() => {
    db.prepare("UPDATE campaigns SET status = ? WHERE id = ?").run(status, campaign.id);
    const tipo = status === "ativa" ? "CAMPAIGN_PUBLISHED" : status === "pausada" ? "CAMPAIGN_PAUSED" : status === "encerrada" ? "CAMPAIGN_CLOSED" : null;
    if (tipo && status !== campaign.status) registrarEventoCampanha({ companyId: campaign.companyId, campaignId: campaign.id, tipo, actorId: req.user.id, actorRole: role, source: "USER", dados: { statusAnterior: campaign.status, statusNovo: status } });
  })();
  res.json({ ok: true, status });
});

router.post("/campaigns/:id/apply", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais podem se candidatar" });
  if (!exigirOportunidadesLiberadas(req, res)) return;

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (campaign.status !== "ativa") return res.status(400).json({ error: "Campanha não está ativa" });

  const existing = db.prepare("SELECT id FROM campaign_applications WHERE campaignId = ? AND sellerId = ?").get(req.params.id, entityId);
  if (existing) return res.status(409).json({ error: "Já se candidatou a esta campanha" });

  const id = uid();
  const criadoEm = agora();
  db.transaction(() => {
    db.prepare("INSERT INTO campaign_applications (id, campaignId, sellerId, status, criadoEm) VALUES (?, ?, ?, 'pendente', ?)").run(id, req.params.id, entityId, criadoEm);
    registrarEventoCampanha({ companyId: campaign.companyId, campaignId: campaign.id, tipo: "PROFESSIONAL_APPLIED", actorId: req.user.id, actorRole: role, sellerId: entityId, source: "USER", criadoEm });
  })();
  res.json({ id });
});

router.patch("/campaigns/:campaignId/applications/:appId", (req, res) => {
  const { role, entityId } = req.user;
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.campaignId);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId)
    return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor") return res.status(403).json({ error: "Sem permissão" });

  const { status } = req.body;
  if (!["aprovado", "recusado"].includes(status))
    return res.status(400).json({ error: "Status deve ser aprovado ou recusado" });

  const candidatura = db.prepare(
    "SELECT * FROM campaign_applications WHERE id = ? AND campaignId = ?"
  ).get(req.params.appId, campaign.id);
  if (!candidatura) return res.status(404).json({ error: "Candidatura não encontrada" });

  if (status === "aprovado" && campaign.exigeCertificacao) {
    const certificacoes = certificacoesDoProfissional(candidatura.sellerId);
    if (!atendeCertificacaoDaCampanha(campaign, certificacoes))
      return res.status(422).json({ error: "O profissional ainda não possui a certificação exigida pela campanha." });
  }

  db.transaction(() => {
    db.prepare("UPDATE campaign_applications SET status = ? WHERE id = ?").run(status, req.params.appId);
    registrarEventoCampanha({
      companyId: campaign.companyId, campaignId: campaign.id,
      tipo: status === "aprovado" ? "PROFESSIONAL_APPROVED" : "PROFESSIONAL_REJECTED",
      actorId: req.user.id, actorRole: role, sellerId: candidatura.sellerId, source: "USER",
    });
    if (status === "aprovado") {
      db.prepare("INSERT OR REPLACE INTO applications (sellerId, companyId, status) VALUES (?, ?, 'aprovado')")
        .run(candidatura.sellerId, campaign.companyId);
      registrarEventoCampanha({ companyId: campaign.companyId, campaignId: campaign.id, tipo: "PROFESSIONAL_JOINED", actorId: req.user.id, actorRole: role, sellerId: candidatura.sellerId, source: "USER" });
    }
  })();
  res.json({ ok: true });
});

// Quiz de certificação da campanha
router.get("/campaigns/:id/quiz", (req, res) => {
  const { role, entityId } = req.user;
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  const questoes = JSON.parse(campaign.quiz || "[]");
  // Vendedor nunca recebe a alternativa correta
  const semGabarito = questoes.map(({ correta, ...q }) => q);
  const ultima = db.prepare(
    "SELECT * FROM campaign_quiz_attempts WHERE campaignId = ? AND sellerId = ? ORDER BY criadoEm DESC LIMIT 1"
  ).get(req.params.id, entityId);
  const tentativas = db.prepare(
    "SELECT COUNT(*) n FROM campaign_quiz_attempts WHERE campaignId = ? AND sellerId = ?"
  ).get(req.params.id, entityId)?.n || 0;
  res.json({ questoes: semGabarito, notaMinima: campaign.notaMinimaQuiz || 70, maxTentativas: campaign.maxTentativasQuiz || 3, tentativas, ultima });
});

router.post("/campaigns/:id/quiz", (req, res) => {
  const { entityId } = req.user;
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  const questoes = JSON.parse(campaign.quiz || "[]");
  if (!questoes.length) return res.status(422).json({ error: "Esta campanha não possui quiz." });
  const { respostas = [] } = req.body;
  const acertos = questoes.filter((q, i) => respostas[i] !== undefined && String(respostas[i]) === String(q.correta)).length;
  const score = Math.round((acertos / questoes.length) * 100);
  const notaMinima = campaign.notaMinimaQuiz || 70;
  const aprovado = score >= notaMinima ? 1 : 0;
  const id = `cqa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(
    "INSERT INTO campaign_quiz_attempts (id, campaignId, sellerId, score, respostas, aprovado, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, req.params.id, entityId, score, JSON.stringify(respostas), aprovado, Date.now());
  // Erradas: quais temas revisar
  const erradas = questoes
    .filter((q, i) => String(respostas[i]) !== String(q.correta))
    .map((q) => q.modulo || q.tema || "Revisão geral");
  const temasRevisar = [...new Set(erradas)];
  res.json({ score, aprovado: !!aprovado, notaMinima, acertos, total: questoes.length, temasRevisar });
});

function parseCampaign(row) {
  return {
    ...row,
    comissoes: JSON.parse(row.comissoes || "{}"),
    treinamento: JSON.parse(row.treinamento || "[]"),
    tarefas: JSON.parse(row.tarefas || "{}"),
    evidencias: JSON.parse(row.evidencias || "{}"),
    criteriosAprovacao: JSON.parse(row.criteriosAprovacao || "{}"),
    quiz: JSON.parse(row.quiz || "[]").map(({ correta, ...q }) => q),
    aceitaLeadProprio: !!row.aceitaLeadProprio,
    exigeCertificacao: !!row.exigeCertificacao,
  };
}

export default router;

import { Router } from "express";
import { sugerirCampanha } from "../services/campanhaAssistida.js";
import db, { uid, agora } from "../db.js";
import { campanhaPodeSerPublicada, STATUS_CAMPANHA, saldoDisponivel, isPremium } from "../../shared/empresa.js";
import { dentroDoLimite } from "../../shared/planos.js";
import { exigirOportunidadesLiberadas } from "../services/acessoProfissional.js";
import { empresaLiberada } from "../services/acessoEmpresa.js";
import { atendeCertificacaoDaCampanha } from "../../shared/campaignAcademy.js";
import { obterOperacaoCampanha, obterVisaoGeralCampanhas } from "../services/campaignOperations.js";
import { registrarEventoCampanha } from "../services/campaignEvents.js";
import { sanearAlcance, sanearPaisesAceitos, parsePaisesAceitos } from "../../shared/oportunidades.js";

const router = Router();

// País da empresa (ISO-2), para normalizar o alcance geográfico da campanha.
function paisDaEmpresa(companyId) {
  const c = db.prepare("SELECT pais FROM companies WHERE id = ?").get(companyId);
  return c?.pais || "BR";
}

// Marketplace Oportunidades — total EFETIVAMENTE pago aos profissionais por
// empresa (só tarefas concluídas). platform_earnings tem uma linha por tarefa
// aprovada e `liquido` em coluna própria: sem pendente, sem estorno, sem
// depósito. Uma query agregada (não por card). A moeda é a da empresa
// (companies.moeda) — o frontend formata cada card na moeda da empresa.
router.get("/oportunidades/metricas-empresas", (req, res) => {
  const rows = db.prepare(`
    SELECT pe.companyId AS companyId, ROUND(SUM(pe.liquido), 2) AS totalPago, COUNT(*) AS tarefasPagas
    FROM platform_earnings pe
    JOIN companies co ON co.id = pe.companyId
    WHERE co.visivel = 1
    GROUP BY pe.companyId
  `).all();
  const metricas = {};
  for (const r of rows) metricas[r.companyId] = { totalPago: r.totalPago || 0, tarefasPagas: r.tarefasPagas || 0 };
  res.json({ metricas });
});

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
  } else if (role === "admin") {
    rows = db.prepare("SELECT * FROM campaigns ORDER BY criadoEm DESC").all();
  } else {
    // Vendedor: só campanhas ativas de empresas visíveis (mesmo filtro do /state).
    rows = db.prepare(
      `SELECT c.* FROM campaigns c
       JOIN companies co ON co.id = c.companyId
       WHERE c.status = 'ativa' AND co.visivel = 1
       ORDER BY c.criadoEm DESC`
    ).all();
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
  if (req.user.role === "vendedor") {
    const empresa = db.prepare("SELECT visivel FROM companies WHERE id = ?").get(row.companyId);
    if (empresa && empresa.visivel === 0) return res.status(404).json({ error: "Campanha não encontrada" });
  }
  const campaign = parseCampaign(row);

  const apps = db.prepare("SELECT * FROM campaign_applications WHERE campaignId = ?").all(req.params.id);
  campaign.candidaturas = apps;

  res.json(campaign);
});

router.post("/campaigns", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa" && role !== "admin")
    return res.status(403).json({ error: "Apenas empresas podem criar campanhas" });

  // Criar campanha (sempre como rascunho) não exige plano: a empresa pode
  // montar e salvar a campanha sem assinatura. O plano só é exigido para
  // publicar — a trava fica em POST /campaigns/:id/status quando vira "ativa".

  const { titulo, descricao, produto, publico, vagas, comissoes, treinamento, requisitos, objetivo, regiao,
    funcao, orcamento, tarefas, evidencias, criteriosAprovacao, prazoHoras, limitePorProfissional,
    aceitaLeadProprio, exigeCertificacao, duracaoDias, visitasPorDia, cidade, estado, percentualComissao, modoJarvas,
    candidaturasAbertas, alcance, paisesAceitos } = req.body;
  if (!titulo) return res.status(400).json({ error: "Título é obrigatório" });

  const companyId = role === "empresa" ? entityId : req.body.companyId;
  if (!companyId) return res.status(400).json({ error: "companyId é obrigatório" });

  // Alcance geográfico: normalizado contra o país da empresa. Campos têm padrão
  // seguro ('nacional' → só o país da empresa), então criação antiga não quebra.
  const paisEmpresa = paisDaEmpresa(companyId);
  const alcanceLimpo = sanearAlcance(alcance);
  const paisesLimpos = JSON.stringify(sanearPaisesAceitos(paisesAceitos, paisEmpresa, alcanceLimpo));

  // Pipeline padrão para toda nova campanha
  const PIPELINE_PADRAO = JSON.stringify([
    { id: "novo",      nome: "Novo",      cor: "#8496B4" },
    { id: "contatado", nome: "Contatado", cor: "#5B8CFF" },
    { id: "respondeu", nome: "Respondeu", cor: "#9AA6FF" },
    { id: "reuniao",   nome: "Reunião",   cor: "#9AA6FF" },
    { id: "proposta",  nome: "Proposta",  cor: "#F0B45E" },
    { id: "fechado",   nome: "Fechado",   cor: "#5FD3A0" },
    { id: "perdido",   nome: "Perdido",   cor: "#FF8A7A" },
  ]);

  const id = uid();
  const criadoEm = agora();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO campaigns (id, companyId, titulo, descricao, produto, publico, status, vagas, comissoes, treinamento,
        requisitos, objetivo, regiao, funcao, orcamento, tarefas, evidencias, criteriosAprovacao, prazoHoras, duracaoDias,
        limitePorProfissional, aceitaLeadProprio, exigeCertificacao, visitasPorDia, cidade, estado, percentualComissao, modoJarvas, candidaturasAbertas, alcance, paisesAceitos, etapasPipeline, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, companyId, titulo, descricao || "", produto || "", publico || "",
      vagas || 0, JSON.stringify(comissoes || {}), JSON.stringify(treinamento || []),
      requisitos || "", objetivo || "", regiao || "", funcao || "", Number(orcamento) || 0,
      JSON.stringify(tarefas || {}), JSON.stringify(evidencias || {}), JSON.stringify(criteriosAprovacao || {}),
      Math.max(1, Number(prazoHoras) || 48), Math.max(1, Number(duracaoDias) || 30), Math.max(0, Number(limitePorProfissional) || 0),
      aceitaLeadProprio ? 1 : 0, exigeCertificacao ? 1 : 0, Math.max(0, Number(visitasPorDia) || 0),
      cidade || "", estado || "", Number(percentualComissao) || 0, modoJarvas || "", candidaturasAbertas === false ? 0 : 1, alcanceLimpo, paisesLimpos, PIPELINE_PADRAO, criadoEm);
    registrarEventoCampanha({ companyId, campaignId: id, tipo: "CAMPAIGN_CREATED", actorId: req.user.id, actorRole: role, source: "USER", criadoEm });

    // V2 fields — saved via UPDATE to keep INSERT stable
    const v2Plain = ["modeloTrabalho", "restricaoGeo", "origemLeads", "mercado", "nivelExperiencia",
      "disponibilidade", "disponibilidadeDetalhes", "limiteProf", "visibilidade", "objetivoUI",
      "icpTipo", "versao", "processoAdmissao",
      "fonteLeads", "selecaoLeadsTipo", "distribuicaoLeads", "limiteLeadsSimultaneos", "limiteLeadsDia",
      "prazoContatoHoras", "prazoInatividadeHoras"];
    const v2Bool = ["temComissao", "remuneracaoCumulativa"];
    const v2Json = ["paisesRestritos", "regioesRestritas", "cidadesRestritas", "mercadoPaises", "mercadoRegioes",
      "canais", "idiomasExigidos", "requisitosObrigatorios", "requisitosDesejaveis",
      "comissaoConfig", "acoesAtivas", "icpEstruturado", "qualificacaoCriterios", "reuniaoConfig",
      "selecaoLeadsFiltros"];
    const v2Sets = []; const v2Vals = [];
    for (const k of v2Plain) { if (req.body[k] != null) { v2Sets.push(`${k} = ?`); v2Vals.push(req.body[k]); } }
    for (const k of v2Bool) { if (req.body[k] != null) { v2Sets.push(`${k} = ?`); v2Vals.push(req.body[k] ? 1 : 0); } }
    for (const k of v2Json) { if (req.body[k] != null) { v2Sets.push(`${k} = ?`); v2Vals.push(JSON.stringify(req.body[k])); } }
    if (v2Sets.length) {
      v2Vals.push(id);
      db.prepare(`UPDATE campaigns SET ${v2Sets.join(", ")} WHERE id = ?`).run(...v2Vals);
    }
  })();

  res.json({ id });
});

router.patch("/campaigns/:id", (req, res) => {
  const { role, entityId } = req.user;
  if (role === "vendedor") return res.status(403).json({ error: "Sem permissão" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId)
    return res.status(403).json({ error: "Sem permissão" });

  const allowed = ["titulo", "descricao", "produto", "publico", "vagas", "requisitos", "objetivo", "regiao", "funcao",
    "orcamento", "prazoHoras", "duracaoDias", "limitePorProfissional", "aceitaLeadProprio", "exigeCertificacao", "visitasPorDia",
    "cidade", "estado", "lat", "lng", "percentualComissao", "modoJarvas", "candidaturasAbertas",
    "modeloTrabalho", "restricaoGeo", "origemLeads", "mercado", "nivelExperiencia",
    "disponibilidade", "disponibilidadeDetalhes", "limiteProf", "visibilidade", "objetivoUI",
    "temComissao", "remuneracaoCumulativa", "icpTipo", "versao", "processoAdmissao",
    "fonteLeads", "selecaoLeadsTipo", "distribuicaoLeads", "limiteLeadsSimultaneos", "limiteLeadsDia",
    "prazoContatoHoras", "prazoInatividadeHoras", "selecaoLeadsDinamica"];
  const jsonFields = ["comissoes", "treinamento", "tarefas", "evidencias", "criteriosAprovacao", "modelosVerificacao",
    "etapasPipeline", "fluxoDirecionamento", "camposPersonalizados", "modelosCampos",
    "paisesRestritos", "regioesRestritas", "cidadesRestritas", "mercadoPaises", "mercadoRegioes",
    "canais", "idiomasExigidos", "requisitosObrigatorios", "requisitosDesejaveis",
    "comissaoConfig", "acoesAtivas", "icpEstruturado", "qualificacaoCriterios", "reuniaoConfig",
    "selecaoLeadsFiltros"];
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(req.body)) {
    if (allowed.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(["aceitaLeadProprio", "exigeCertificacao", "candidaturasAbertas", "temComissao", "remuneracaoCumulativa"].includes(k) ? (v ? 1 : 0) : v);
    }
    else if (jsonFields.includes(k)) { sets.push(`${k} = ?`); vals.push(JSON.stringify(v)); }
  }
  // Alcance + países aceitos são co-dependentes: normaliza juntos contra o país
  // da empresa (não entram em `allowed` por isso).
  if ("alcance" in req.body || "paisesAceitos" in req.body) {
    const paisEmpresa = paisDaEmpresa(campaign.companyId);
    const alc = sanearAlcance("alcance" in req.body ? req.body.alcance : campaign.alcance);
    const lista = "paisesAceitos" in req.body ? req.body.paisesAceitos : parsePaisesAceitos(campaign.paisesAceitos);
    sets.push("alcance = ?"); vals.push(alc);
    sets.push("paisesAceitos = ?"); vals.push(JSON.stringify(sanearPaisesAceitos(lista, paisEmpresa, alc)));
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
    // Publicar exige plano ativo. Criar e salvar como rascunho é liberado.
    if (role === "empresa" && !empresaLiberada(campaign.companyId))
      return res.status(402).json({ error: "Ative um plano para publicar a campanha.", acao: "escolher-plano" });
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
  if (campaign.candidaturasAbertas === 0) return res.status(400).json({ error: "As candidaturas desta campanha estão encerradas" });

  const existing = db.prepare("SELECT id FROM campaign_applications WHERE campaignId = ? AND sellerId = ?").get(req.params.id, entityId);
  if (existing) return res.status(409).json({ error: "Já se candidatou a esta campanha" });

  const id = uid();
  const criadoEm = agora();
  const mensagem = String(req.body?.mensagem || "").slice(0, 1000).trim();
  const app = db.prepare("SELECT campanhasAuto FROM applications WHERE sellerId = ? AND companyId = ? AND status = 'aprovado'").get(entityId, campaign.companyId);
  let autoAprovado = false;
  if (app) {
    const empDefault = db.prepare("SELECT campanhasAutoDefault FROM companies WHERE id = ?").get(campaign.companyId);
    const efetivo = app.campanhasAuto != null ? !!app.campanhasAuto : !!(empDefault?.campanhasAutoDefault);
    autoAprovado = efetivo;
  }
  const statusCand = autoAprovado ? "aprovado" : "pendente";
  db.transaction(() => {
    db.prepare("INSERT INTO campaign_applications (id, campaignId, sellerId, status, mensagem, criadoEm) VALUES (?, ?, ?, ?, ?, ?)").run(id, req.params.id, entityId, statusCand, mensagem, criadoEm);
    registrarEventoCampanha({ companyId: campaign.companyId, campaignId: campaign.id, tipo: "PROFESSIONAL_APPLIED", actorId: req.user.id, actorRole: role, sellerId: entityId, source: "USER", criadoEm });
    if (autoAprovado) {
      registrarEventoCampanha({ companyId: campaign.companyId, campaignId: campaign.id, tipo: "PROFESSIONAL_APPROVED", actorId: "sistema", actorRole: "sistema", sellerId: entityId, source: "SYSTEM" });
    }
  })();
  res.json({ id, status: statusCand });
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

// Quiz de certificação da campanha (só vendedor)
router.get("/campaigns/:id/quiz", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
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
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
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
    candidaturasAbertas: row.candidaturasAbertas == null ? true : !!row.candidaturasAbertas,
    etapasPipeline: JSON.parse(row.etapasPipeline || "[]"),
    fluxoDirecionamento: JSON.parse(row.fluxoDirecionamento || "[]"),
    camposPersonalizados: JSON.parse(row.camposPersonalizados || "{}"),
    modelosCampos: JSON.parse(row.modelosCampos || "[]"),
    // V2 fields
    paisesRestritos: JSON.parse(row.paisesRestritos || "[]"),
    regioesRestritas: JSON.parse(row.regioesRestritas || "[]"),
    cidadesRestritas: JSON.parse(row.cidadesRestritas || "[]"),
    mercadoPaises: JSON.parse(row.mercadoPaises || "[]"),
    mercadoRegioes: JSON.parse(row.mercadoRegioes || "[]"),
    canais: JSON.parse(row.canais || "[]"),
    idiomasExigidos: JSON.parse(row.idiomasExigidos || "[]"),
    requisitosObrigatorios: JSON.parse(row.requisitosObrigatorios || "[]"),
    requisitosDesejaveis: JSON.parse(row.requisitosDesejaveis || "[]"),
    processoAdmissao: row.processoAdmissao || "manual",
    comissaoConfig: JSON.parse(row.comissaoConfig || "{}"),
    acoesAtivas: JSON.parse(row.acoesAtivas || "[]"),
    icpEstruturado: JSON.parse(row.icpEstruturado || "{}"),
    qualificacaoCriterios: JSON.parse(row.qualificacaoCriterios || "[]"),
    reuniaoConfig: JSON.parse(row.reuniaoConfig || "{}"),
    temComissao: !!row.temComissao,
    remuneracaoCumulativa: !!row.remuneracaoCumulativa,
  };
}

// ── Campanhas salvas (bookmark) ─────────────────────────────────────────
router.get("/campaigns/saved", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const rows = db.prepare("SELECT campaignId FROM saved_campaigns WHERE sellerId = ?").all(req.user.entityId);
  res.json({ ids: rows.map((r) => r.campaignId) });
});

router.post("/campaigns/:id/save", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const campaignId = req.params.id;
  const existing = db.prepare("SELECT id FROM saved_campaigns WHERE sellerId = ? AND campaignId = ?").get(req.user.entityId, campaignId);
  if (existing) return res.json({ ok: true, saved: true });
  db.prepare("INSERT INTO saved_campaigns (id, sellerId, campaignId, criadoEm) VALUES (?, ?, ?, ?)").run(uid(), req.user.entityId, campaignId, agora());
  res.json({ ok: true, saved: true });
});

router.delete("/campaigns/:id/save", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  db.prepare("DELETE FROM saved_campaigns WHERE sellerId = ? AND campaignId = ?").run(req.user.entityId, req.params.id);
  res.json({ ok: true, saved: false });
});

// ── Versionamento de campanha ──────────────────────────────────────────
router.get("/campaigns/:id/versions", (req, res) => {
  const { role, entityId } = req.user;
  const campaign = db.prepare("SELECT companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor") return res.status(403).json({ error: "Sem permissão" });
  const rows = db.prepare("SELECT id, versao, alteradoPor, alteradoRole, motivo, criadoEm FROM campaign_versions WHERE campaignId = ? ORDER BY versao DESC").all(req.params.id);
  res.json(rows);
});

router.post("/campaigns/:id/version", (req, res) => {
  const { role, entityId } = req.user;
  if (role === "vendedor") return res.status(403).json({ error: "Sem permissão" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });
  const versaoAtual = Number(campaign.versao) || 1;
  const novaVersao = versaoAtual + 1;
  const { motivo } = req.body;
  db.transaction(() => {
    db.prepare("INSERT INTO campaign_versions (id, campaignId, versao, snapshot, alteradoPor, alteradoRole, motivo, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      uid(), campaign.id, versaoAtual, JSON.stringify(parseCampaign(campaign)), req.user.id, role, motivo || "", agora()
    );
    db.prepare("UPDATE campaigns SET versao = ? WHERE id = ?").run(novaVersao, campaign.id);
  })();
  res.json({ ok: true, versao: novaVersao });
});

// ── Materiais da campanha ──────────────────────────────────────────────

router.get("/campaigns/:id/materiais", (req, res) => {
  const { role, entityId } = req.user;
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor") {
    const aprovado = db.prepare("SELECT 1 FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(campaign.id, entityId);
    if (!aprovado) return res.status(403).json({ error: "Acesso negado" });
  }

  const materiais = db.prepare(`
    SELECT m.*, mc.categoria AS catCampanha, mc.obrigatoriedade, mc.acaoVinculada, mc.ordem, mc.regraAcesso
    FROM materiais_campanhas mc
    JOIN materiais m ON m.id = mc.materialId
    WHERE mc.campaignId = ? AND m.ativo = 1
    ORDER BY mc.ordem ASC, m.nome ASC
  `).all(campaign.id);

  if (role === "vendedor") {
    const consultas = db.prepare("SELECT materialId, tipo, criadoEm FROM materiais_consultas WHERE campaignId = ? AND sellerId = ?").all(campaign.id, entityId);
    const consultaMap = {};
    for (const c of consultas) { consultaMap[c.materialId] = { tipo: c.tipo, criadoEm: c.criadoEm }; }
    return res.json(materiais.filter(m => m.regraAcesso !== "confidencial").map(m => ({ ...m, consulta: consultaMap[m.id] || null })));
  }
  res.json(materiais);
});

router.put("/campaigns/:id/materiais", (req, res) => {
  const { role, entityId } = req.user;
  if (role === "vendedor") return res.status(403).json({ error: "Sem permissão" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });

  const { materiais } = req.body;
  if (!Array.isArray(materiais)) return res.status(400).json({ error: "Lista de materiais inválida" });

  db.transaction(() => {
    db.prepare("DELETE FROM materiais_campanhas WHERE campaignId = ?").run(campaign.id);
    const ins = db.prepare("INSERT OR IGNORE INTO materiais_campanhas (materialId, campaignId, vinculadoEm, categoria, obrigatoriedade, acaoVinculada, ordem, regraAcesso) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (let i = 0; i < materiais.length; i++) {
      const m = materiais[i];
      ins.run(m.id, campaign.id, agora(), m.categoria || "outros", m.obrigatoriedade || "complementar", m.acaoVinculada || "", i, m.regraAcesso || "todos");
    }
  })();
  res.json({ ok: true, total: materiais.length });
});

router.post("/campaigns/:id/materiais/consulta", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const { materialId } = req.body;
  if (!materialId) return res.status(400).json({ error: "materialId obrigatório" });
  const vinculo = db.prepare("SELECT 1 FROM materiais_campanhas WHERE campaignId = ? AND materialId = ?").get(req.params.id, materialId);
  if (!vinculo) return res.status(404).json({ error: "Material não vinculado" });
  const aprovado = db.prepare("SELECT 1 FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(req.params.id, entityId);
  if (!aprovado) return res.status(403).json({ error: "Acesso negado" });
  const existente = db.prepare("SELECT id FROM materiais_consultas WHERE materialId = ? AND campaignId = ? AND sellerId = ?").get(materialId, req.params.id, entityId);
  if (existente) return res.json({ ok: true, ja: true });
  db.prepare("INSERT INTO materiais_consultas (id, materialId, campaignId, sellerId, tipo, criadoEm) VALUES (?, ?, ?, ?, ?, ?)").run(uid(), materialId, req.params.id, entityId, "visualizacao", agora());
  res.json({ ok: true });
});

// ── Base de leads da campanha ──────────────────────────────────────────

router.get("/campaigns/:id/leads", (req, res) => {
  const { role, entityId } = req.user;
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });

  if (role === "vendedor") {
    const aprovado = db.prepare("SELECT 1 FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(campaign.id, entityId);
    if (!aprovado) return res.status(403).json({ error: "Acesso negado" });
    const meusLeads = db.prepare(`
      SELECT cl.*, l.nome, l.empresa, l.telefone, l.email, l.etapa, l.origem
      FROM campaign_leads cl JOIN leads l ON l.id = cl.leadId
      WHERE cl.campaignId = ? AND cl.sellerId = ?
      ORDER BY cl.criadoEm DESC
    `).all(campaign.id, entityId);
    const disponiveis = db.prepare("SELECT COUNT(*) as total FROM campaign_leads WHERE campaignId = ? AND status = 'disponivel'").get(campaign.id);
    return res.json({ leads: meusLeads, disponiveis: disponiveis.total });
  }

  const leads = db.prepare(`
    SELECT cl.*, l.nome, l.empresa, l.telefone, l.email, l.etapa, l.origem, l.segmento, l.cargo
    FROM campaign_leads cl JOIN leads l ON l.id = cl.leadId
    WHERE cl.campaignId = ?
    ORDER BY cl.criadoEm DESC
  `).all(campaign.id);
  const stats = {
    total: leads.length,
    disponiveis: leads.filter(l => l.status === "disponivel").length,
    atribuidos: leads.filter(l => l.status === "atribuido").length,
    emAtendimento: leads.filter(l => l.status === "em_atendimento").length,
    concluidos: leads.filter(l => l.status === "concluido").length,
  };
  res.json({ leads, stats });
});

router.put("/campaigns/:id/leads", (req, res) => {
  const { role, entityId } = req.user;
  if (role === "vendedor") return res.status(403).json({ error: "Sem permissão" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });

  const { leadIds } = req.body;
  if (!Array.isArray(leadIds)) return res.status(400).json({ error: "Lista de leads inválida" });

  const companyLeads = db.prepare("SELECT id FROM leads WHERE companyId = ? AND id IN (" + leadIds.map(() => "?").join(",") + ")").all(campaign.companyId, ...leadIds);
  const validIds = new Set(companyLeads.map(l => l.id));

  let inseridos = 0;
  db.transaction(() => {
    const ins = db.prepare("INSERT OR IGNORE INTO campaign_leads (id, campaignId, leadId, status, criadoEm) VALUES (?, ?, ?, 'disponivel', ?)");
    for (const lid of leadIds) {
      if (!validIds.has(lid)) continue;
      ins.run(uid(), campaign.id, lid, agora());
      inseridos++;
    }
  })();
  res.json({ ok: true, inseridos });
});

router.post("/campaigns/:id/leads/solicitar", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  const aprovado = db.prepare("SELECT 1 FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(campaign.id, entityId);
  if (!aprovado) return res.status(403).json({ error: "Acesso negado" });

  const limite = Number(campaign.limiteLeadsSimultaneos) || 0;
  if (limite > 0) {
    const ativos = db.prepare("SELECT COUNT(*) as total FROM campaign_leads WHERE campaignId = ? AND sellerId = ? AND status IN ('atribuido', 'em_atendimento')").get(campaign.id, entityId);
    if (ativos.total >= limite) return res.status(400).json({ error: `Limite de ${limite} leads simultâneos atingido` });
  }

  const proximo = db.prepare("SELECT id, leadId FROM campaign_leads WHERE campaignId = ? AND status = 'disponivel' ORDER BY criadoEm ASC LIMIT 1").get(campaign.id);
  if (!proximo) return res.status(404).json({ error: "Nenhum lead disponível no momento" });

  const result = db.prepare("UPDATE campaign_leads SET sellerId = ?, status = 'atribuido', atribuidoEm = ? WHERE id = ? AND status = 'disponivel'").run(entityId, agora(), proximo.id);
  if (result.changes === 0) return res.status(409).json({ error: "Lead já foi atribuído a outro profissional" });

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(proximo.leadId);
  res.json({ ok: true, lead });
});

router.post("/campaigns/:id/leads/devolver", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const { campaignLeadId, motivo } = req.body;
  if (!campaignLeadId) return res.status(400).json({ error: "campaignLeadId obrigatório" });
  const cl = db.prepare("SELECT * FROM campaign_leads WHERE id = ? AND campaignId = ? AND sellerId = ?").get(campaignLeadId, req.params.id, entityId);
  if (!cl) return res.status(404).json({ error: "Lead não encontrado" });
  db.prepare("UPDATE campaign_leads SET sellerId = '', status = 'disponivel', motivoDevolucao = ?, atribuidoEm = NULL WHERE id = ?").run(motivo || "", cl.id);
  res.json({ ok: true });
});

export default router;

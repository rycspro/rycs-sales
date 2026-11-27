import { Router } from "express";
import { sugerirCampanha, gerarICPDeterministico, recomendarAtividadesDeterministico, recomendarComprovacoesDeterministico } from "../services/campanhaAssistida.js";
import db, { uid, agora } from "../db.js";
import { campanhaPodeSerPublicada, STATUS_CAMPANHA, saldoDisponivel, isPremium } from "../../shared/empresa.js";
import { dentroDoLimite } from "../../shared/planos.js";
import { exigirOportunidadesLiberadas } from "../services/acessoProfissional.js";
import { empresaLiberada } from "../services/acessoEmpresa.js";
import { reservarVerbaCampanha, liberarVerbaCampanha, posicaoEmpresa } from "../services/financeiro.js";
import { atendeCertificacaoDaCampanha } from "../../shared/campaignAcademy.js";
import { obterOperacaoCampanha, obterVisaoGeralCampanhas } from "../services/campaignOperations.js";
import { registrarEventoCampanha } from "../services/campaignEvents.js";
import { sanearAlcance, sanearPaisesAceitos, parsePaisesAceitos } from "../../shared/oportunidades.js";
import { calcularPlanejamentoReverso } from "../../shared/planejamentoReverso.js";
import { investimentoRecomendado, capacidadeOperacional } from "../../shared/otimizacaoVerba.js";
import { criarPergunta, criarCriterio } from "../../shared/qualificacaoLeads.js";
import { diagnosticoCampanha } from "../../shared/campaignEngine.js";
import { randomBytes, createHash } from "crypto";
import { enviarConfirmacao, verificarLimiteReenvio } from "../services/confirmacaoService.js";

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
      "prazoContatoHoras", "prazoInatividadeHoras", "operacaoId", "estruturaComercial", "vendaTipoRemuneracao", "modoAcoesRemuneradas", "passoWizard", "ordemOperacao", "modoDistribuicaoVerba", "metaQuantitativa"];
    const v2Bool = ["temComissao", "remuneracaoCumulativa", "incluirNovosAutomaticamente"];
    const v2Json = ["paisesRestritos", "regioesRestritas", "cidadesRestritas", "mercadoPaises", "mercadoRegioes",
      "canais", "idiomasExigidos", "requisitosObrigatorios", "requisitosDesejaveis",
      "comissaoConfig", "acoesAtivas", "icpEstruturado", "qualificacaoCriterios", "reuniaoConfig",
      "selecaoLeadsFiltros", "distribuicaoVerba",
      "planejamentoReverso", "perguntasQualificacao", "criteriosQualificacaoLeads",
      "confirmacaoContato", "remuneracaoPorOrigem", "otimizacaoVerba", "recomendacoesIA"];
    const v2Sets = ["atualizadoEm = ?"]; const v2Vals = [criadoEm];
    for (const k of v2Plain) { if (req.body[k] != null) { v2Sets.push(`${k} = ?`); v2Vals.push(req.body[k]); } }
    for (const k of v2Bool) { if (req.body[k] != null) { v2Sets.push(`${k} = ?`); v2Vals.push(req.body[k] ? 1 : 0); } }
    for (const k of v2Json) { if (req.body[k] != null) { v2Sets.push(`${k} = ?`); v2Vals.push(JSON.stringify(req.body[k])); } }
    // Distribuição automática: aplica defaults operacionais seguros.
    if ((req.body.distribuicaoLeads || "automatica") === "automatica") {
      for (const [k, v] of [["limiteLeadsSimultaneos", 5], ["limiteLeadsDia", 10], ["prazoContatoHoras", 4], ["prazoInatividadeHoras", 48]]) {
        const idx = v2Sets.findIndex((s) => s.startsWith(k + " ="));
        if (idx !== -1) { v2Vals[idx] = v; } else { v2Sets.push(`${k} = ?`); v2Vals.push(v); }
      }
    }

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
    "prazoContatoHoras", "prazoInatividadeHoras", "selecaoLeadsDinamica", "passoWizard", "modoDistribuicaoVerba",
    "incluirNovosAutomaticamente", "metaQuantitativa"];
  const jsonFields = ["comissoes", "treinamento", "tarefas", "evidencias", "criteriosAprovacao", "modelosVerificacao",
    "etapasPipeline", "fluxoDirecionamento", "camposPersonalizados", "modelosCampos",
    "paisesRestritos", "regioesRestritas", "cidadesRestritas", "mercadoPaises", "mercadoRegioes",
    "canais", "idiomasExigidos", "requisitosObrigatorios", "requisitosDesejaveis",
    "comissaoConfig", "acoesAtivas", "icpEstruturado", "qualificacaoCriterios", "reuniaoConfig",
    "selecaoLeadsFiltros", "distribuicaoVerba",
    "planejamentoReverso", "perguntasQualificacao", "criteriosQualificacaoLeads",
    "confirmacaoContato", "remuneracaoPorOrigem", "otimizacaoVerba", "recomendacoesIA"];
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

  // Migra "fila" para "automatica" (opção removida do frontend).
  if (req.body.distribuicaoLeads === "fila") {
    const idx = sets.findIndex((s) => s.startsWith("distribuicaoLeads ="));
    if (idx !== -1) vals[idx] = "automatica";
  }

  // Distribuição automática: o backend define parâmetros operacionais seguros.
  const dist = (req.body.distribuicaoLeads === "fila" ? "automatica" : req.body.distribuicaoLeads) || campaign.distribuicaoLeads;
  if (dist === "automatica") {
    for (const [k, v] of [["limiteLeadsSimultaneos", 5], ["limiteLeadsDia", 10], ["prazoContatoHoras", 4], ["prazoInatividadeHoras", 48]]) {
      const idx = sets.findIndex((s) => s.startsWith(k + " ="));
      if (idx !== -1) { vals[idx] = v; } else { sets.push(`${k} = ?`); vals.push(v); }
    }
  }

  // Toda atualização carimba a última edição — alimenta o "última edição" do
  // card de rascunho e o indicador de salvamento automático.
  sets.push("atualizadoEm = ?"); vals.push(agora());
  vals.push(req.params.id);
  db.prepare(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// Exclusão de rascunho. Só rascunhos podem ser apagados por aqui; campanhas
// publicadas/encerradas seguem o fluxo de status (cancelada/arquivada). Remove
// apenas vínculos exclusivos do rascunho (formas de ganho, links de materiais e
// leads, candidaturas, eventos, versões) — os leads da empresa e os materiais
// da biblioteca são preservados, pois só os vínculos são apagados, não a fonte.
router.delete("/campaigns/:id", (req, res) => {
  const { role, entityId } = req.user;
  if (role === "vendedor") return res.status(403).json({ error: "Sem permissão" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId)
    return res.status(403).json({ error: "Sem permissão" });
  if (campaign.status !== "rascunho")
    return res.status(409).json({ error: "Só rascunhos podem ser excluídos. Arquive a campanha publicada." });

  // Apaga em tabela por tabela, tolerando ausência de alguma (bases antigas).
  const apagarVinculos = (tabela, coluna = "campaignId") => {
    try { db.prepare(`DELETE FROM ${tabela} WHERE ${coluna} = ?`).run(req.params.id); } catch { /* tabela inexistente nesta base */ }
  };
  try {
    db.transaction(() => {
      // Eventos de campanha são imutáveis por gatilho (trilha de auditoria). Para
      // excluir um RASCUNHO (nunca publicado) o gatilho sai e volta dentro da
      // mesma transação — mesmo padrão autorizado da exclusão de empresa
      // (services/exclusaoEmpresa.js) e do reset do Beta. Rollback restaura tudo.
      const gatilho = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'no_delete_campaign_events'").get();
      if (gatilho) db.exec("DROP TRIGGER no_delete_campaign_events");
      // Remove apenas vínculos exclusivos do rascunho. Os leads da empresa e os
      // materiais da biblioteca são preservados — só os vínculos saem, não a fonte.
      for (const t of ["formas_ganho", "materiais_campanhas", "campaign_leads", "campaign_contacts",
        "campaign_versions", "campaign_events", "campaign_applications", "materiais_consultas",
        "eventos_comerciais", "remuneracoes"]) apagarVinculos(t);
      db.prepare("DELETE FROM campaigns WHERE id = ?").run(req.params.id);
      if (gatilho) db.exec(gatilho.sql);
    })();
  } catch (err) {
    console.error("[campaigns] falha ao excluir rascunho:", err.message);
    return res.status(500).json({ error: "Não foi possível excluir o rascunho." });
  }
  res.json({ ok: true });
});

router.post("/campaigns/:id/check-verba", (req, res) => {
  const { role, entityId } = req.user;
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });
  const parsed = parseCampaign(campaign);
  const verba = Number(parsed.orcamento || 0);
  const empresa = db.prepare("SELECT * FROM companies WHERE id = ?").get(campaign.companyId);
  const posicao = posicaoEmpresa(campaign.companyId);
  const disponivel = posicao?.disponivel || 0;
  const faltante = Math.max(0, verba - disponivel);
  res.json({ verba, disponivel, faltante, saldo: posicao?.saldo || 0, reservado: posicao?.reservado || 0 });
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
    const verba = Number(parsed.orcamento || 0);
    if (verba > 0) {
      const posicao = posicaoEmpresa(campaign.companyId);
      if ((posicao?.disponivel || 0) < verba)
        return res.status(422).json({ error: "Saldo insuficiente para cobrir a verba da campanha.", acao: "adicionar-saldo", verba, disponivel: posicao?.disponivel || 0, faltante: verba - (posicao?.disponivel || 0) });
    }
  }

  try {
    db.transaction(() => {
      if (status === "ativa") {
        const verba = Number(parseCampaign(campaign).orcamento || 0);
        if (verba > 0) reservarVerbaCampanha({ companyId: campaign.companyId, campaignId: campaign.id, valor: verba });
      }
      if ((status === "encerrada" || status === "cancelada") && (campaign.status === "ativa" || campaign.status === "pausada")) {
        liberarVerbaCampanha({ companyId: campaign.companyId, campaignId: campaign.id });
      }
      db.prepare("UPDATE campaigns SET status = ? WHERE id = ?").run(status, campaign.id);
      const tipo = status === "ativa" ? "CAMPAIGN_PUBLISHED" : status === "pausada" ? "CAMPAIGN_PAUSED" : status === "encerrada" ? "CAMPAIGN_CLOSED" : null;
      if (tipo && status !== campaign.status) registrarEventoCampanha({ companyId: campaign.companyId, campaignId: campaign.id, tipo, actorId: req.user.id, actorRole: role, source: "USER", dados: { statusAnterior: campaign.status, statusNovo: status } });

      // Propagar status para campanhas vinculadas na mesma operação
      if (campaign.estruturaComercial === "operacao") {
        const vinculadas = db.prepare(
          `SELECT DISTINCT campanhaDestinoId AS lid FROM vinculos_campanhas WHERE campanhaOrigemId = ? AND companyId = ?
           UNION SELECT DISTINCT campanhaOrigemId AS lid FROM vinculos_campanhas WHERE campanhaDestinoId = ? AND companyId = ?`
        ).all(campaign.id, campaign.companyId, campaign.id, campaign.companyId);
        for (const { lid } of vinculadas) {
          if (!lid || lid === campaign.id) continue;
          const sub = db.prepare("SELECT id, status FROM campaigns WHERE id = ?").get(lid);
          if (!sub || sub.status === status) continue;
          if (status === "ativa") {
            db.prepare("UPDATE campaigns SET status = 'ativa' WHERE id = ?").run(lid);
          } else if (status === "pausada" || status === "encerrada" || status === "cancelada") {
            if (sub.status === "ativa" || sub.status === "pausada") {
              db.prepare("UPDATE campaigns SET status = ? WHERE id = ?").run(status, lid);
            }
          }
        }
      }
    })();
    res.json({ ok: true, status });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
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
    selecaoLeadsFiltros: JSON.parse(row.selecaoLeadsFiltros || "{}"),
    distribuicaoVerba: JSON.parse(row.distribuicaoVerba || "{}"),
    planejamentoReverso: JSON.parse(row.planejamentoReverso || "{}"),
    perguntasQualificacao: JSON.parse(row.perguntasQualificacao || "[]"),
    criteriosQualificacaoLeads: JSON.parse(row.criteriosQualificacaoLeads || "[]"),
    confirmacaoContato: JSON.parse(row.confirmacaoContato || "{}"),
    remuneracaoPorOrigem: JSON.parse(row.remuneracaoPorOrigem || "{}"),
    otimizacaoVerba: JSON.parse(row.otimizacaoVerba || "{}"),
    recomendacoesIA: JSON.parse(row.recomendacoesIA || "{}"),
    temComissao: !!row.temComissao,
    remuneracaoCumulativa: !!row.remuneracaoCumulativa,
    incluirNovosAutomaticamente: !!row.incluirNovosAutomaticamente,
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

// ══════════════════════════════════════════════════════════════════════════════
// FORMAS DE GANHO
// ══════════════════════════════════════════════════════════════════════════════

router.get("/campaigns/:id/formas-ganho", (req, res) => {
  const rows = db.prepare("SELECT * FROM formas_ganho WHERE campaignId = ? ORDER BY ordem, criadoEm").all(req.params.id);
  res.json(rows);
});

router.post("/campaigns/:id/formas-ganho", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const camp = db.prepare("SELECT companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp || camp.companyId !== entityId) return res.status(403).json({ error: "Sem acesso" });
  const id = uid();
  const b = req.body;
  if (!b.nome?.trim()) return res.status(400).json({ error: "Nome obrigatório" });
  db.prepare(`INSERT INTO formas_ganho (id, campaignId, nome, descricao, tipoRemuneracao, valor, moeda, eventoComercial, criteriosValidacao, evidenciasNecessarias, metodoAprovacao, limiteRecorrencia, limitePorProfissional, limitePorLead, regraRecorrencia, regraCumulatividade, baseCalculo, condicaoLiberacao, ordem, ativo, criadoEm, origem, modeloOriginalId, condicoesRecebimento, limiteDiario, limiteSemanal, limiteMensal, limiteTotalCampanha, dependeDeAcao, prazoValidacaoHoras, frequenciaPagamento, condicoesAdicionais, campaignVinculadaId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, req.params.id, b.nome.trim(), b.descricao || "", b.tipoRemuneracao || "fixo", Number(b.valor) || 0, b.moeda || "BRL", b.eventoComercial || "",
    typeof b.criteriosValidacao === "object" ? JSON.stringify(b.criteriosValidacao) : b.criteriosValidacao || "{}",
    typeof b.evidenciasNecessarias === "object" ? JSON.stringify(b.evidenciasNecessarias) : b.evidenciasNecessarias || "[]",
    b.metodoAprovacao || "manual", Number(b.limiteRecorrencia) || 0, Number(b.limitePorProfissional) || 0, Number(b.limitePorLead) || 1, b.regraRecorrencia || "unica", b.regraCumulatividade === false ? 0 : 1, b.baseCalculo || "", b.condicaoLiberacao || "", Number(b.ordem) || 0, agora(),
    b.origem || "personalizado", b.modeloOriginalId || "", b.condicoesRecebimento || "",
    Number(b.limiteDiario) || 0, Number(b.limiteSemanal) || 0, Number(b.limiteMensal) || 0, Number(b.limiteTotalCampanha) || 0,
    b.dependeDeAcao || "", Number(b.prazoValidacaoHoras) || 0, b.frequenciaPagamento || "ocorrencia", b.condicoesAdicionais || "", b.campaignVinculadaId || ""
  );
  res.json({ id });
});

router.patch("/campaigns/:cid/formas-ganho/:fid", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const camp = db.prepare("SELECT companyId FROM campaigns WHERE id = ?").get(req.params.cid);
  if (!camp || camp.companyId !== entityId) return res.status(403).json({ error: "Sem acesso" });
  const fg = db.prepare("SELECT * FROM formas_ganho WHERE id = ? AND campaignId = ?").get(req.params.fid, req.params.cid);
  if (!fg) return res.status(404).json({ error: "Forma de ganho não encontrada" });
  const campos = ["nome", "descricao", "tipoRemuneracao", "valor", "moeda", "eventoComercial", "criteriosValidacao", "evidenciasNecessarias", "metodoAprovacao", "limiteRecorrencia", "limitePorProfissional", "limitePorLead", "regraRecorrencia", "regraCumulatividade", "baseCalculo", "condicaoLiberacao", "ativo", "ordem", "origem", "modeloOriginalId", "condicoesRecebimento", "limiteDiario", "limiteSemanal", "limiteMensal", "limiteTotalCampanha", "dependeDeAcao", "prazoValidacaoHoras", "frequenciaPagamento", "condicoesAdicionais", "campaignVinculadaId"];
  const sets = []; const vals = [];
  for (const c of campos) {
    if (req.body[c] !== undefined) {
      let v = req.body[c];
      if (typeof v === "object") v = JSON.stringify(v);
      if (c === "regraCumulatividade") v = v ? 1 : 0;
      if (c === "ativo") v = v ? 1 : 0;
      if (["valor", "limiteRecorrencia", "limitePorProfissional", "limitePorLead", "ordem", "limiteDiario", "limiteSemanal", "limiteMensal", "limiteTotalCampanha", "prazoValidacaoHoras"].includes(c)) v = Number(v) || 0;
      sets.push(`${c} = ?`); vals.push(v);
    }
  }
  if (!sets.length) return res.json({ ok: true });
  sets.push("atualizadoEm = ?"); vals.push(agora());
  vals.push(req.params.fid);
  db.prepare(`UPDATE formas_ganho SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

router.delete("/campaigns/:cid/formas-ganho/:fid", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const camp = db.prepare("SELECT companyId FROM campaigns WHERE id = ?").get(req.params.cid);
  if (!camp || camp.companyId !== entityId) return res.status(403).json({ error: "Sem acesso" });
  db.prepare("DELETE FROM formas_ganho WHERE id = ? AND campaignId = ?").run(req.params.fid, req.params.cid);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// OPERAÇÕES COMERCIAIS
// ══════════════════════════════════════════════════════════════════════════════

router.get("/operacoes", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const ops = db.prepare("SELECT * FROM operacoes_comerciais WHERE companyId = ? ORDER BY criadoEm DESC").all(entityId);
  const result = ops.map((op) => {
    const camps = db.prepare("SELECT id, titulo, funcao, status FROM campaigns WHERE operacaoId = ?").all(op.id);
    return { ...op, campanhas: camps };
  });
  res.json(result);
});

router.post("/operacoes", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const { nome, descricao } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: "Nome obrigatório" });
  const id = uid();
  db.prepare("INSERT INTO operacoes_comerciais (id, companyId, nome, descricao, criadoEm) VALUES (?,?,?,?,?)").run(id, entityId, nome.trim(), descricao || "", agora());
  res.json({ id });
});

router.patch("/operacoes/:id", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const op = db.prepare("SELECT * FROM operacoes_comerciais WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!op) return res.status(404).json({ error: "Operação não encontrada" });
  const { nome, descricao, status } = req.body;
  if (nome !== undefined) db.prepare("UPDATE operacoes_comerciais SET nome = ?, atualizadoEm = ? WHERE id = ?").run(nome, agora(), op.id);
  if (descricao !== undefined) db.prepare("UPDATE operacoes_comerciais SET descricao = ?, atualizadoEm = ? WHERE id = ?").run(descricao, agora(), op.id);
  if (status !== undefined) db.prepare("UPDATE operacoes_comerciais SET status = ?, atualizadoEm = ? WHERE id = ?").run(status, agora(), op.id);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// VÍNCULOS ENTRE CAMPANHAS
// ══════════════════════════════════════════════════════════════════════════════

router.get("/campaigns/:id/vinculos", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const vinculos = db.prepare(`
    SELECT v.*, co.titulo AS origemTitulo, co.funcao AS origemFuncao, cd.titulo AS destinoTitulo, cd.funcao AS destinoFuncao
    FROM vinculos_campanhas v
    JOIN campaigns co ON co.id = v.campanhaOrigemId
    JOIN campaigns cd ON cd.id = v.campanhaDestinoId
    WHERE (v.campanhaOrigemId = ? OR v.campanhaDestinoId = ?) AND v.companyId = ?
  `).all(req.params.id, req.params.id, entityId);
  res.json(vinculos);
});

router.post("/vinculos-campanhas", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const { campanhaOrigemId, campanhaDestinoId, operacaoId, eventoTransferencia, distribuicaoDestino, responsavelRecebimento, infosCompartilhadas, condicoesTransferencia } = req.body;
  if (!campanhaOrigemId || !campanhaDestinoId) return res.status(400).json({ error: "Origem e destino obrigatórios" });
  if (campanhaOrigemId === campanhaDestinoId) return res.status(400).json({ error: "Origem e destino não podem ser iguais" });
  const orig = db.prepare("SELECT companyId FROM campaigns WHERE id = ?").get(campanhaOrigemId);
  const dest = db.prepare("SELECT companyId FROM campaigns WHERE id = ?").get(campanhaDestinoId);
  if (!orig || orig.companyId !== entityId || !dest || dest.companyId !== entityId) return res.status(403).json({ error: "Ambas campanhas devem pertencer à sua empresa" });
  const existente = db.prepare("SELECT id FROM vinculos_campanhas WHERE campanhaOrigemId = ? AND campanhaDestinoId = ?").get(campanhaOrigemId, campanhaDestinoId);
  if (existente) return res.status(409).json({ error: "Vínculo já existe" });
  const circular = db.prepare("SELECT id FROM vinculos_campanhas WHERE campanhaOrigemId = ? AND campanhaDestinoId = ?").get(campanhaDestinoId, campanhaOrigemId);
  if (circular) return res.status(400).json({ error: "Vínculo circular não permitido" });
  const id = uid();
  db.prepare(`INSERT INTO vinculos_campanhas (id, companyId, operacaoId, campanhaOrigemId, campanhaDestinoId, eventoTransferencia, distribuicaoDestino, responsavelRecebimento, infosCompartilhadas, condicoesTransferencia, criadoEm)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, entityId, operacaoId || "", campanhaOrigemId, campanhaDestinoId, eventoTransferencia || "reuniao_agendada", distribuicaoDestino || "equilibrada", responsavelRecebimento || "qualquer",
    typeof infosCompartilhadas === "object" ? JSON.stringify(infosCompartilhadas) : infosCompartilhadas || '["lead","historico","qualificacao"]',
    typeof condicoesTransferencia === "object" ? JSON.stringify(condicoesTransferencia) : condicoesTransferencia || "{}",
    agora()
  );
  res.json({ id });
});

router.delete("/vinculos-campanhas/:id", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const v = db.prepare("SELECT * FROM vinculos_campanhas WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!v) return res.status(404).json({ error: "Vínculo não encontrado" });
  db.prepare("DELETE FROM vinculos_campanhas WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// EVENTOS COMERCIAIS + MOTOR DE REMUNERAÇÃO
// ══════════════════════════════════════════════════════════════════════════════

router.post("/campaigns/:id/eventos", (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && camp.companyId !== entityId) return res.status(403).json({ error: "Sem acesso" });
  if (role === "vendedor") {
    const app = db.prepare("SELECT id FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(req.params.id, entityId);
    if (!app) return res.status(403).json({ error: "Sem acesso" });
  }
  const { tipo, leadId, reuniaoId, dadosEvento, valorVenda, sellerOrigemId, campanhaOrigemId } = req.body;
  if (!tipo) return res.status(400).json({ error: "Tipo do evento obrigatório" });
  const evId = uid();
  const sellerId = role === "vendedor" ? entityId : (req.body.sellerId || "");
  db.prepare(`INSERT INTO eventos_comerciais (id, companyId, campaignId, tipo, leadId, sellerId, sellerOrigemId, campanhaOrigemId, reuniaoId, dadosEvento, valorVenda, criadoEm)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    evId, camp.companyId, req.params.id, tipo, leadId || "", sellerId, sellerOrigemId || "", campanhaOrigemId || "", reuniaoId || "",
    typeof dadosEvento === "object" ? JSON.stringify(dadosEvento) : dadosEvento || "{}",
    Number(valorVenda) || 0, agora()
  );

  // Motor de remuneração: processa formas de ganho ativas que correspondem ao evento
  const formas = db.prepare("SELECT * FROM formas_ganho WHERE campaignId = ? AND ativo = 1 AND eventoComercial = ?").all(req.params.id, tipo);
  const remuneracoesCriadas = [];
  for (const fg of formas) {
    const beneficiarios = [];
    if (sellerId) beneficiarios.push({ sid: sellerId, campId: req.params.id });
    // Verificar se há SDR de origem com bônus configurado
    if (sellerOrigemId && campanhaOrigemId && campanhaOrigemId !== req.params.id) {
      const fgOrigem = db.prepare("SELECT * FROM formas_ganho WHERE campaignId = ? AND ativo = 1 AND eventoComercial = ?").all(campanhaOrigemId, tipo);
      for (const fgo of fgOrigem) {
        beneficiarios.push({ sid: sellerOrigemId, campId: campanhaOrigemId, fg: fgo });
      }
    }
    for (const b of beneficiarios) {
      const formaUsada = b.fg || fg;
      const chave = `${formaUsada.id}:${b.sid}:${evId}`;
      const existe = db.prepare("SELECT id FROM remuneracoes WHERE chaveUnicidade = ?").get(chave);
      if (existe) continue;
      if (formaUsada.limitePorLead > 0 && leadId) {
        const jaPagou = db.prepare("SELECT COUNT(*) n FROM remuneracoes WHERE formaGanhoId = ? AND sellerId = ? AND leadId = ? AND estornado = 0").get(formaUsada.id, b.sid, leadId);
        if (jaPagou.n >= formaUsada.limitePorLead) continue;
      }
      if (formaUsada.limitePorProfissional > 0) {
        const total = db.prepare("SELECT COUNT(*) n FROM remuneracoes WHERE formaGanhoId = ? AND sellerId = ? AND estornado = 0").get(formaUsada.id, b.sid);
        if (total.n >= formaUsada.limitePorProfissional) continue;
      }
      let valorFinal = Number(formaUsada.valor) || 0;
      if (formaUsada.tipoRemuneracao === "comissao" && Number(valorVenda) > 0) {
        valorFinal = Math.round(Number(valorVenda) * (Number(formaUsada.valor) / 100) * 100) / 100;
      }
      const remId = uid();
      db.prepare(`INSERT INTO remuneracoes (id, companyId, campaignId, formaGanhoId, sellerId, eventoComercialId, leadId, tipo, valor, moeda, status, chaveUnicidade, versaoRegra, criadoEm)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?)`).run(
        remId, camp.companyId, b.campId, formaUsada.id, b.sid, evId, leadId || "", formaUsada.tipoRemuneracao, valorFinal, formaUsada.moeda || "BRL",
        formaUsada.metodoAprovacao === "automatico" ? "aprovado" : "pendente", chave, agora()
      );
      remuneracoesCriadas.push({ id: remId, sellerId: b.sid, valor: valorFinal, formaGanho: formaUsada.nome });
    }
  }

  db.prepare("UPDATE eventos_comerciais SET processado = 1 WHERE id = ?").run(evId);
  res.json({ eventoId: evId, remuneracoes: remuneracoesCriadas });
});

router.get("/campaigns/:id/eventos", (req, res) => {
  const rows = db.prepare("SELECT * FROM eventos_comerciais WHERE campaignId = ? ORDER BY criadoEm DESC LIMIT 100").all(req.params.id);
  res.json(rows);
});

// ══════════════════════════════════════════════════════════════════════════════
// REMUNERAÇÕES
// ══════════════════════════════════════════════════════════════════════════════

router.get("/campaigns/:id/remuneracoes", (req, res) => {
  const { role, entityId } = req.user;
  let rows;
  if (role === "empresa") {
    rows = db.prepare(`SELECT r.*, s.nome AS sellerNome, fg.nome AS formaGanhoNome FROM remuneracoes r LEFT JOIN sellers s ON s.id = r.sellerId LEFT JOIN formas_ganho fg ON fg.id = r.formaGanhoId WHERE r.campaignId = ? ORDER BY r.criadoEm DESC`).all(req.params.id);
  } else {
    rows = db.prepare(`SELECT r.*, fg.nome AS formaGanhoNome FROM remuneracoes r LEFT JOIN formas_ganho fg ON fg.id = r.formaGanhoId WHERE r.campaignId = ? AND r.sellerId = ? ORDER BY r.criadoEm DESC`).all(req.params.id, entityId);
  }
  res.json(rows);
});

router.patch("/remuneracoes/:id", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const rem = db.prepare("SELECT * FROM remuneracoes WHERE id = ?").get(req.params.id);
  if (!rem) return res.status(404).json({ error: "Remuneração não encontrada" });
  const camp = db.prepare("SELECT companyId FROM campaigns WHERE id = ?").get(rem.campaignId);
  if (!camp || camp.companyId !== entityId) return res.status(403).json({ error: "Sem acesso" });
  const { status, motivoEstorno } = req.body;
  if (status === "aprovado") {
    db.prepare("UPDATE remuneracoes SET status = 'aprovado', aprovadoPor = ?, aprovadoEm = ? WHERE id = ?").run(entityId, agora(), rem.id);
  } else if (status === "estornado") {
    db.prepare("UPDATE remuneracoes SET estornado = 1, motivoEstorno = ?, status = 'estornado' WHERE id = ?").run(motivoEstorno || "", rem.id);
  } else if (status === "pago") {
    db.prepare("UPDATE remuneracoes SET status = 'pago', pagoEm = ? WHERE id = ?").run(agora(), rem.id);
  }
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// TRANSFERÊNCIAS DE OPORTUNIDADE
// ══════════════════════════════════════════════════════════════════════════════

router.post("/transferencias", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const { vinculoId, leadId, sellerOrigemId, reuniaoId, dadosQualificacao, anotacoes } = req.body;
  if (!vinculoId || !leadId || !sellerOrigemId) return res.status(400).json({ error: "vinculoId, leadId e sellerOrigemId obrigatórios" });
  const vinculo = db.prepare("SELECT * FROM vinculos_campanhas WHERE id = ? AND companyId = ?").get(vinculoId, entityId);
  if (!vinculo) return res.status(404).json({ error: "Vínculo não encontrado" });
  const duplicada = db.prepare("SELECT id FROM transferencias_oportunidade WHERE vinculoId = ? AND leadId = ? AND status NOT IN ('cancelada')").get(vinculoId, leadId);
  if (duplicada) return res.status(409).json({ error: "Transferência já existe para este lead neste vínculo" });

  let sellerDestinoId = "";
  if (vinculo.distribuicaoDestino === "equilibrada") {
    const aprovados = db.prepare("SELECT sellerId FROM campaign_applications WHERE campaignId = ? AND status = 'aprovado'").all(vinculo.campanhaDestinoId);
    if (aprovados.length) {
      const contagem = db.prepare(`SELECT sellerDestinoId, COUNT(*) n FROM transferencias_oportunidade WHERE campanhaDestinoId = ? AND status NOT IN ('cancelada') GROUP BY sellerDestinoId`).all(vinculo.campanhaDestinoId);
      const mapa = Object.fromEntries(contagem.map((c) => [c.sellerDestinoId, c.n]));
      aprovados.sort((a, b) => (mapa[a.sellerId] || 0) - (mapa[b.sellerId] || 0));
      sellerDestinoId = aprovados[0].sellerId;
    }
  }

  const id = uid();
  db.prepare(`INSERT INTO transferencias_oportunidade (id, companyId, vinculoId, leadId, campanhaOrigemId, campanhaDestinoId, sellerOrigemId, sellerDestinoId, reuniaoId, status, dadosQualificacao, anotacoes, historico, criadoEm, atribuidoEm)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, entityId, vinculoId, leadId, vinculo.campanhaOrigemId, vinculo.campanhaDestinoId, sellerOrigemId, sellerDestinoId,
    reuniaoId || "", sellerDestinoId ? "atribuida" : "pendente",
    typeof dadosQualificacao === "object" ? JSON.stringify(dadosQualificacao) : dadosQualificacao || "{}",
    anotacoes || "", "[]", agora(), sellerDestinoId ? agora() : null
  );
  res.json({ id, sellerDestinoId, status: sellerDestinoId ? "atribuida" : "pendente" });
});

router.get("/campaigns/:id/transferencias", (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, l.nome AS leadNome, so.nome AS sellerOrigemNome, sd.nome AS sellerDestinoNome
    FROM transferencias_oportunidade t
    LEFT JOIN leads l ON l.id = t.leadId
    LEFT JOIN sellers so ON so.id = t.sellerOrigemId
    LEFT JOIN sellers sd ON sd.id = t.sellerDestinoId
    WHERE t.campanhaOrigemId = ? OR t.campanhaDestinoId = ?
    ORDER BY t.criadoEm DESC
  `).all(req.params.id, req.params.id);
  res.json(rows);
});

router.patch("/transferencias/:id", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const t = db.prepare("SELECT * FROM transferencias_oportunidade WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!t) return res.status(404).json({ error: "Transferência não encontrada" });
  const { status, sellerDestinoId } = req.body;
  if (sellerDestinoId) {
    db.prepare("UPDATE transferencias_oportunidade SET sellerDestinoId = ?, status = 'atribuida', atribuidoEm = ? WHERE id = ?").run(sellerDestinoId, agora(), t.id);
  }
  if (status) {
    db.prepare("UPDATE transferencias_oportunidade SET status = ? WHERE id = ?").run(status, t.id);
  }
  res.json({ ok: true });
});

// ── Fase 01: Planejamento reverso ──────────────────────────────────────
router.post("/campaigns/:id/planejamento-reverso", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

  const metaQuantidade = Number(req.body.metaQuantidade) || Number(campaign.metaQuantitativa) || 0;
  const objetivoChave = campaign.objetivo || "vendas";
  const tarefas = JSON.parse(campaign.tarefas || "{}");

  // Buscar histórico da empresa quando disponível
  let historico = null;
  try {
    const stats = db.prepare(`
      SELECT COUNT(*) as amostra,
        CAST(SUM(CASE WHEN s.status = 'aprovada' THEN 1 ELSE 0 END) AS REAL) / MAX(COUNT(*), 1) AS taxaAprovacao
      FROM submissions s
      JOIN campaigns c ON c.id = s.campaignId
      WHERE c.companyId = ? AND c.objetivo = ?
    `).get(entityId, objetivoChave);
    if (stats && stats.amostra >= 10) {
      historico = { amostra: stats.amostra, taxaFechamento: stats.taxaAprovacao || 0.25 };
    }
  } catch (_) { /* sem histórico */ }

  const planejamento = calcularPlanejamentoReverso({ objetivoChave, metaQuantidade, historico, tarefas });
  const investimento = investimentoRecomendado({ metaQuantidade, tarefas, etapasPlanejamento: planejamento?.etapas || [] });
  const capacidade = capacidadeOperacional({ orcamento: Number(campaign.orcamento) || 0, tarefas, profissionais: Number(campaign.vagas) || 1, duracaoDias: Number(campaign.duracaoDias) || 30 });

  // Salvar resultado no campaign
  if (planejamento) {
    db.prepare("UPDATE campaigns SET metaQuantitativa = ?, planejamentoReverso = ?, otimizacaoVerba = ? WHERE id = ?").run(
      metaQuantidade,
      JSON.stringify(planejamento),
      JSON.stringify({ investimento, capacidade }),
      campaign.id
    );
  }

  res.json({ planejamento, investimento, capacidade });
});

// ── Fase 01: Gerar perguntas de qualificação por IA ────────────────────
router.post("/campaigns/:id/gerar-qualificacao", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

  const empresa = db.prepare("SELECT nome, segmento, produto, ticket FROM companies WHERE id = ?").get(entityId);

  // Fallback determinístico quando não há API key
  const gerarPerguntasDeterministicas = () => {
    const objetivo = campaign.objetivo || "vendas";
    const base = [
      criarPergunta({ texto: "O contato demonstrou interesse no produto/serviço?", tipo: "sim_nao", obrigatoria: true, ordem: 1 }),
      criarPergunta({ texto: "Qual o cargo ou função do contato?", tipo: "texto_curto", ordem: 2 }),
      criarPergunta({ texto: "O contato tem poder de decisão?", tipo: "escolha_unica", opcoes: ["Sim, decide sozinho", "Precisa consultar", "Não tem poder de decisão"], ordem: 3 }),
    ];
    if (["vendas", "completa", "campo"].includes(objetivo)) {
      base.push(criarPergunta({ texto: "Qual o orçamento disponível para este tipo de solução?", tipo: "valor_monetario", ordem: 4 }));
      base.push(criarPergunta({ texto: "Qual a urgência para resolver esse problema?", tipo: "escala", ordem: 5 }));
    }
    if (["reunioes", "prospeccao"].includes(objetivo)) {
      base.push(criarPergunta({ texto: "O contato confirmou disponibilidade para reunião?", tipo: "sim_nao", ordem: 4 }));
    }
    if (objetivo === "reativacao") {
      base.push(criarPergunta({ texto: "Quanto tempo desde o último contato com a empresa?", tipo: "escolha_unica", opcoes: ["Menos de 3 meses", "3 a 6 meses", "6 a 12 meses", "Mais de 1 ano"], ordem: 4 }));
    }

    const criterios = base.map((p) => criarCriterio({
      perguntaId: p.id,
      condicao: p.tipo === "sim_nao" ? "sim" : "nao_vazio",
      peso: p.obrigatoria ? 2 : 1,
      obrigatoria: p.obrigatoria,
    }));

    return { perguntas: base, criterios, fonte: "interno" };
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json(gerarPerguntasDeterministicas());
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resposta = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system:
        "Você gera perguntas de qualificação de leads para campanhas comerciais. " +
        "Responda APENAS um JSON com 'perguntas' (array de {texto, tipo, obrigatoria, opcoes, ordem}) " +
        "e 'criterios' (array de {perguntaIndex, condicao, peso, obrigatoria, eliminatoria, respostaEsperada}). " +
        "Tipos válidos: sim_nao, texto_curto, escolha_unica, multipla_escolha, numero, valor_monetario, escala. " +
        "Máximo 8 perguntas. Criterio.condicao: igual, contem, maior_que, menor_que, entre, sim, nao, nao_vazio.",
      messages: [{
        role: "user",
        content:
          `Empresa: ${empresa?.nome || "—"}\nSegmento: ${empresa?.segmento || "—"}\nProduto: ${campaign.produto || empresa?.produto || "—"}\nTicket: ${empresa?.ticket || "—"}\n` +
          `Campanha: ${campaign.titulo || "—"}\nObjetivo: ${campaign.objetivo || "vendas"}\nPúblico: ${campaign.publico || "—"}\nFunção: ${campaign.funcao || "SDR"}\n` +
          `\nGere perguntas de qualificação específicas para esta campanha.`,
      }],
    });

    const texto = resposta.content.map((b) => b.text || "").join("");
    const json = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));
    if (!Array.isArray(json.perguntas)) throw new Error("formato inválido");

    const perguntas = json.perguntas.slice(0, 8).map((p, i) => criarPergunta({
      texto: String(p.texto || "").slice(0, 300),
      tipo: p.tipo || "texto_curto",
      obrigatoria: !!p.obrigatoria,
      opcoes: Array.isArray(p.opcoes) ? p.opcoes.slice(0, 10) : [],
      ordem: i + 1,
    }));
    const criterios = (json.criterios || []).slice(0, 8).map((c) => {
      const idx = Number(c.perguntaIndex) || 0;
      return criarCriterio({
        perguntaId: perguntas[idx]?.id || perguntas[0]?.id,
        condicao: c.condicao || "nao_vazio",
        peso: Number(c.peso) || 1,
        obrigatoria: !!c.obrigatoria,
        eliminatoria: !!c.eliminatoria,
        respostaEsperada: c.respostaEsperada || "",
      });
    });

    res.json({ perguntas, criterios, fonte: "externo" });
  } catch (err) {
    console.error("[qualificacao] IA indisponível:", err.message);
    res.json(gerarPerguntasDeterministicas());
  }
});

// ── Fase 01: Confirmação de contato (token criptográfico com hash) ────
router.post("/campaigns/:id/confirmacao-token", (req, res) => {
  const { role, entityId } = req.user;
  const { leadId, submissionId, canal } = req.body;
  if (!leadId) return res.status(400).json({ error: "leadId obrigatório" });

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor") {
    const aprovado = db.prepare("SELECT 1 FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(campaign.id, entityId);
    if (!aprovado) return res.status(403).json({ error: "Sem permissão" });
  }

  const lead = db.prepare("SELECT id, companyId FROM leads WHERE id = ?").get(leadId);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
  if (lead.companyId !== campaign.companyId) return res.status(403).json({ error: "Lead não pertence à empresa desta campanha" });

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiraEm = agora() + (48 * 60 * 60 * 1000);

  db.transaction(() => {
    db.prepare("UPDATE leads SET confirmacaoTokenHash = ?, confirmacaoStatus = 'aguardando', confirmacaoEnviadaEm = ?, confirmacaoCanal = ?, confirmacaoExpiraEm = ? WHERE id = ?")
      .run(tokenHash, agora(), canal || "whatsapp", expiraEm, leadId);
    if (submissionId) {
      const sub = db.prepare("SELECT id FROM submissions WHERE id = ? AND companyId = ?").get(submissionId, campaign.companyId);
      if (sub) db.prepare("UPDATE submissions SET confirmacaoToken = ?, confirmacaoStatus = 'aguardando', confirmacaoExigida = 1 WHERE id = ?").run(tokenHash, submissionId);
    }
  })();

  res.json({ token, expiraEm, linkConfirmacao: `/confirmar/${token}` });
});

// ── Fase 01: Página pública de confirmação (sem IDs internos) ─────────
const confirmacaoRateLimit = new Map();
function checkConfirmacaoRate(ip) {
  const agr = Date.now();
  const janela = 60000;
  const limite = 20;
  const registros = confirmacaoRateLimit.get(ip) || [];
  const recentes = registros.filter(t => agr - t < janela);
  if (recentes.length >= limite) return false;
  recentes.push(agr);
  confirmacaoRateLimit.set(ip, recentes);
  if (confirmacaoRateLimit.size > 10000) {
    for (const [k, v] of confirmacaoRateLimit) { if (v.every(t => agr - t > janela)) confirmacaoRateLimit.delete(k); }
  }
  return true;
}

router.get("/confirmar/:token", (req, res) => {
  if (!checkConfirmacaoRate(req.ip)) return res.status(429).json({ error: "Muitas tentativas" });
  const tokenHash = createHash("sha256").update(req.params.token).digest("hex");
  const lead = db.prepare("SELECT id, nome, confirmacaoStatus, confirmacaoEnviadaEm, confirmacaoExpiraEm FROM leads WHERE confirmacaoTokenHash = ?").get(tokenHash);
  if (!lead) return res.status(404).json({ error: "Token inválido ou expirado" });
  const expirado = lead.confirmacaoExpiraEm ? agora() > lead.confirmacaoExpiraEm : (lead.confirmacaoEnviadaEm && (agora() - lead.confirmacaoEnviadaEm > 48 * 60 * 60 * 1000));
  if (expirado) {
    db.prepare("UPDATE leads SET confirmacaoStatus = 'expirada' WHERE id = ?").run(lead.id);
    return res.status(410).json({ error: "Link expirado" });
  }
  res.json({ nome: lead.nome, status: lead.confirmacaoStatus });
});

router.post("/confirmar/:token", (req, res) => {
  if (!checkConfirmacaoRate(req.ip)) return res.status(429).json({ error: "Muitas tentativas" });
  const tokenHash = createHash("sha256").update(req.params.token).digest("hex");
  const lead = db.prepare("SELECT id, confirmacaoEnviadaEm, confirmacaoStatus, confirmacaoExpiraEm FROM leads WHERE confirmacaoTokenHash = ?").get(tokenHash);
  if (!lead) return res.status(404).json({ error: "Token inválido" });
  if (lead.confirmacaoStatus === "confirmada" || lead.confirmacaoStatus === "nao_reconhecida")
    return res.status(409).json({ error: "Confirmação já respondida", status: lead.confirmacaoStatus });
  const expirado = lead.confirmacaoExpiraEm ? agora() > lead.confirmacaoExpiraEm : (lead.confirmacaoEnviadaEm && (agora() - lead.confirmacaoEnviadaEm > 48 * 60 * 60 * 1000));
  if (expirado) return res.status(410).json({ error: "Link expirado" });

  const { confirmado } = req.body;
  const novoStatus = confirmado ? "confirmada" : "nao_reconhecida";
  db.transaction(() => {
    db.prepare("UPDATE leads SET confirmacaoStatus = ?, confirmacaoRespondidaEm = ?, confirmacaoTokenHash = NULL WHERE id = ?")
      .run(novoStatus, agora(), lead.id);
    db.prepare("UPDATE submissions SET confirmacaoStatus = ? WHERE confirmacaoToken = ?")
      .run(novoStatus, tokenHash);
  })();

  res.json({ status: novoStatus });
});

// ── Fase 01: Recomendações inteligentes da IA (Rico) ───────────────────
router.post("/campaigns/:id/recomendacoes", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

  const diagnostico = diagnosticoCampanha(campaign);

  // Recomendações determinísticas baseadas no diagnóstico
  const recomendacoes = [];
  for (const r of diagnostico.recomendacoes || []) {
    recomendacoes.push({ tipo: "recomendacao", texto: r, fonte: "diagnostico" });
  }
  for (const b of diagnostico.bloqueios || []) {
    recomendacoes.push({ tipo: "bloqueio", texto: b, fonte: "diagnostico" });
  }

  // Recomendações adicionais baseadas no estado da campanha
  const tarefas = JSON.parse(campaign.tarefas || "{}");
  if (!Object.keys(tarefas).length || Object.values(tarefas).every((v) => !Number(v))) {
    recomendacoes.push({ tipo: "recomendacao", texto: "Configure os valores de remuneração por atividade para atrair profissionais qualificados.", fonte: "analise" });
  }
  if (!Number(campaign.orcamento)) {
    recomendacoes.push({ tipo: "bloqueio", texto: "Defina o orçamento da campanha antes de publicar.", fonte: "analise" });
  }
  if (!Number(campaign.metaQuantitativa)) {
    recomendacoes.push({ tipo: "recomendacao", texto: "Defina uma meta quantitativa para calcular o planejamento reverso e otimizar a verba.", fonte: "analise" });
  }

  res.json({ recomendacoes, diagnostico });
});

// ── F2-039 a F2-048: Agenda SDR/Closer (disponibilidade + reuniões) ───────

// F2-039: Profissional define sua disponibilidade na campanha
router.put("/campaigns/:id/disponibilidade", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissional" });
  const camp = db.prepare("SELECT id, companyId, status FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });
  const vinculo = db.prepare("SELECT id FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(camp.id, entityId);
  if (!vinculo) return res.status(403).json({ error: "Profissional não aprovado nesta campanha" });

  const { slots } = req.body;
  if (!Array.isArray(slots)) return res.status(400).json({ error: "slots deve ser um array" });

  const diasValidos = new Set(["seg", "ter", "qua", "qui", "sex", "sab", "dom"]);
  const horaRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  const validados = [];
  for (const s of slots.slice(0, 50)) {
    if (!diasValidos.has(s.diaSemana) || !horaRe.test(s.horaInicio) || !horaRe.test(s.horaFim)) continue;
    if (s.horaInicio >= s.horaFim) continue;
    validados.push(s);
  }

  db.transaction(() => {
    db.prepare("UPDATE campaign_disponibilidade SET ativo = 0 WHERE campaignId = ? AND sellerId = ?").run(camp.id, entityId);
    const ins = db.prepare("INSERT INTO campaign_disponibilidade (id, campaignId, sellerId, diaSemana, horaInicio, horaFim, ativo, criadoEm) VALUES (?, ?, ?, ?, ?, ?, 1, ?)");
    for (const s of validados) {
      ins.run(uid(), camp.id, entityId, s.diaSemana, s.horaInicio, s.horaFim, agora());
    }
  })();

  res.json({ ok: true, slots: validados.length });
});

// F2-040: Listar disponibilidade do profissional na campanha
router.get("/campaigns/:id/disponibilidade", (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });
  const sellerId = role === "empresa" ? req.query.sellerId : entityId;
  if (role === "empresa" && camp.companyId !== entityId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor" && !db.prepare("SELECT 1 FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(camp.id, entityId)) {
    return res.status(403).json({ error: "Sem acesso" });
  }
  const slots = db.prepare("SELECT id, diaSemana, horaInicio, horaFim FROM campaign_disponibilidade WHERE campaignId = ? AND sellerId = ? AND ativo = 1").all(camp.id, sellerId || entityId);
  res.json({ slots });
});

// F2-041: Horários disponíveis para agendamento (público para SDR)
router.get("/campaigns/:id/horarios-disponiveis", (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });

  if (role === "empresa" && camp.companyId !== entityId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor" && !db.prepare("SELECT 1 FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(camp.id, entityId)) {
    return res.status(403).json({ error: "Sem acesso" });
  }

  const { data, closerId } = req.query;
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: "data obrigatória (YYYY-MM-DD)" });

  const diaSemana = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][new Date(data + "T12:00:00").getDay()];

  let closers;
  if (closerId) {
    closers = db.prepare("SELECT sellerId FROM campaign_disponibilidade WHERE campaignId = ? AND sellerId = ? AND diaSemana = ? AND ativo = 1").all(camp.id, closerId, diaSemana);
  } else {
    closers = db.prepare("SELECT DISTINCT sellerId FROM campaign_disponibilidade WHERE campaignId = ? AND diaSemana = ? AND ativo = 1").all(camp.id, diaSemana);
  }

  const ocupados = db.prepare("SELECT sellerCloserId, horaInicio, horaFim FROM campaign_reunioes WHERE sellerCloserId IN (" + closers.map(() => "?").join(",") + ") AND data = ? AND status NOT IN ('cancelada', 'nao_compareceu')").all(...closers.map((c) => c.sellerId), data);
  const ocupadoMap = {};
  for (const o of ocupados) {
    if (!ocupadoMap[o.sellerCloserId]) ocupadoMap[o.sellerCloserId] = [];
    ocupadoMap[o.sellerCloserId].push({ i: o.horaInicio, f: o.horaFim });
  }

  const horarios = [];
  for (const c of closers) {
    const slots = db.prepare("SELECT horaInicio, horaFim FROM campaign_disponibilidade WHERE campaignId = ? AND sellerId = ? AND diaSemana = ? AND ativo = 1").all(camp.id, c.sellerId, diaSemana);
    for (const sl of slots) {
      const conflito = (ocupadoMap[c.sellerId] || []).some((o) => sl.horaInicio < o.f && sl.horaFim > o.i);
      if (!conflito) {
        const seller = db.prepare("SELECT nome FROM sellers WHERE id = ?").get(c.sellerId);
        horarios.push({ closerId: c.sellerId, closerNome: seller?.nome || "", horaInicio: sl.horaInicio, horaFim: sl.horaFim });
      }
    }
  }

  res.json({ data, diaSemana, horarios });
});

// F2-042/043: Agendar reunião (SDR agenda com closer) — reserva atômica
router.post("/campaigns/:id/agendar", (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });

  if (role === "empresa" && camp.companyId !== entityId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor" && !db.prepare("SELECT 1 FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(camp.id, entityId)) {
    return res.status(403).json({ error: "Profissional não aprovado" });
  }

  const { closerId, leadId, data, horaInicio, horaFim, titulo, tipo, linkReuniao, local } = req.body;
  if (!closerId || !data || !horaInicio || !horaFim) return res.status(400).json({ error: "closerId, data, horaInicio e horaFim obrigatórios" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: "data inválida" });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horaInicio) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaFim)) return res.status(400).json({ error: "horário inválido" });
  if (horaInicio >= horaFim) return res.status(400).json({ error: "horaInicio deve ser antes de horaFim" });

  try {
    const reuniao = db.transaction(() => {
      const conflito = db.prepare("SELECT id FROM campaign_reunioes WHERE sellerCloserId = ? AND data = ? AND horaInicio < ? AND horaFim > ? AND status NOT IN ('cancelada', 'nao_compareceu')").get(closerId, data, horaFim, horaInicio);
      if (conflito) throw new Error("Horário já reservado");
      const id = uid();
      const sdrId = role === "vendedor" ? entityId : (req.body.sdrId || "");
      db.prepare(`INSERT INTO campaign_reunioes (id, campaignId, companyId, leadId, sellerSdrId, sellerCloserId, titulo, data, horaInicio, horaFim, status, tipo, linkReuniao, local, criadoEm)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'agendada', ?, ?, ?, ?)`).run(
        id, camp.id, camp.companyId, leadId || "", sdrId, closerId,
        String(titulo || "Reunião").slice(0, 200), data, horaInicio, horaFim,
        String(tipo || "reuniao").slice(0, 30), String(linkReuniao || "").slice(0, 500),
        String(local || "").slice(0, 200), agora()
      );
      return { id, data, horaInicio, horaFim, closerId, status: "agendada" };
    }).immediate();
    registrarEventoCampanha({ companyId: camp.companyId, campaignId: camp.id, tipo: "MEETING_SCHEDULED", actorId: entityId, actorRole: role === "vendedor" ? "profissional" : "empresa", sellerId: closerId, leadId: leadId || null, dados: { reuniaoId: reuniao.id, data, horaInicio } });
    notificarAgendamento({ campaign: camp, reuniao: { ...reuniao, leadId, sellerCloserId: closerId, sellerSdrId: role === "vendedor" ? entityId : (req.body.sdrId || "") }, tipo: "agendada", actorRole: role }).catch(e => console.warn("[notif-agenda]", e.message));
    res.json(reuniao);
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// F2-044: Listar reuniões da campanha
router.get("/campaigns/:id/reunioes", (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });

  if (role === "empresa" && camp.companyId !== entityId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor" && !db.prepare("SELECT 1 FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(camp.id, entityId)) {
    return res.status(403).json({ error: "Sem acesso" });
  }

  let where = "campaignId = ?";
  const params = [camp.id];
  if (role === "vendedor") {
    where += " AND (sellerSdrId = ? OR sellerCloserId = ?)";
    params.push(entityId, entityId);
  }
  if (req.query.status) {
    where += " AND status = ?";
    params.push(req.query.status);
  }

  const reunioes = db.prepare(`SELECT r.*, s1.nome sdrNome, s2.nome closerNome FROM campaign_reunioes r LEFT JOIN sellers s1 ON s1.id = r.sellerSdrId LEFT JOIN sellers s2 ON s2.id = r.sellerCloserId WHERE ${where} ORDER BY r.data DESC, r.horaInicio DESC LIMIT 200`).all(...params);
  res.json({ reunioes });
});

// F2-045: Atualizar status da reunião (workflow completo)
router.patch("/campaigns/:id/reunioes/:reuniaoId", (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });

  if (role === "empresa" && camp.companyId !== entityId) return res.status(403).json({ error: "Sem permissão" });

  const reuniao = db.prepare("SELECT * FROM campaign_reunioes WHERE id = ? AND campaignId = ?").get(req.params.reuniaoId, camp.id);
  if (!reuniao) return res.status(404).json({ error: "Reunião não encontrada" });

  if (role === "vendedor") {
    if (reuniao.sellerSdrId !== entityId && reuniao.sellerCloserId !== entityId) return res.status(403).json({ error: "Sem acesso a esta reunião" });
  }

  const statusValidos = { agendada: ["confirmada", "cancelada", "reagendada"], confirmada: ["realizada", "nao_compareceu", "cancelada", "reagendada"], realizada: ["venda", "negociacao", "perdida"] };
  const { status, anotacoes, resultado, valorVenda, motivoPerda, dadosQualificacao } = req.body;

  if (status) {
    const permitidos = statusValidos[reuniao.status];
    if (!permitidos || !permitidos.includes(status)) return res.status(400).json({ error: `Transição ${reuniao.status} → ${status} não permitida` });
  }

  const sets = [];
  const vals = [];
  if (status) { sets.push("status = ?"); vals.push(status); }
  if (anotacoes !== undefined) { sets.push("anotacoes = ?"); vals.push(String(anotacoes).slice(0, 2000)); }
  if (resultado !== undefined) { sets.push("resultado = ?"); vals.push(String(resultado).slice(0, 500)); }
  if (valorVenda !== undefined) { sets.push("valorVenda = ?"); vals.push(Math.max(0, Number(valorVenda) || 0)); }
  if (motivoPerda !== undefined) { sets.push("motivoPerda = ?"); vals.push(String(motivoPerda).slice(0, 500)); }
  if (dadosQualificacao !== undefined) { sets.push("dadosQualificacao = ?"); vals.push(JSON.stringify(dadosQualificacao).slice(0, 5000)); }
  sets.push("atualizadoEm = ?"); vals.push(agora());
  if (status === "cancelada") { sets.push("canceladoEm = ?"); vals.push(agora()); }

  if (!sets.length) return res.status(400).json({ error: "Nenhum campo para atualizar" });

  vals.push(req.params.reuniaoId, camp.id);
  db.prepare(`UPDATE campaign_reunioes SET ${sets.join(", ")} WHERE id = ? AND campaignId = ?`).run(...vals);

  if (status === "realizada" || status === "venda") {
    registrarEventoCampanha({ companyId: camp.companyId, campaignId: camp.id, tipo: "MEETING_COMPLETED", actorId: entityId, actorRole: role === "vendedor" ? "profissional" : "empresa", sellerId: reuniao.sellerCloserId, leadId: reuniao.leadId || null, dados: { reuniaoId: reuniao.id, resultado: status } });
  }
  if (status === "venda" && Number(valorVenda) > 0) {
    registrarEventoCampanha({ companyId: camp.companyId, campaignId: camp.id, tipo: "SALE_RECORDED", actorId: entityId, actorRole: role === "vendedor" ? "profissional" : "empresa", sellerId: reuniao.sellerCloserId, leadId: reuniao.leadId || null, dados: { reuniaoId: reuniao.id, valorVenda } });
  }
  if (status === "cancelada") {
    notificarAgendamento({ campaign: camp, reuniao, tipo: "cancelada", actorRole: role }).catch(e => console.warn("[notif-agenda]", e.message));
  }

  res.json({ ok: true, status: status || reuniao.status });
});

// F2-046: Reagendar reunião
router.post("/campaigns/:id/reunioes/:reuniaoId/reagendar", (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });

  const reuniao = db.prepare("SELECT * FROM campaign_reunioes WHERE id = ? AND campaignId = ?").get(req.params.reuniaoId, camp.id);
  if (!reuniao) return res.status(404).json({ error: "Reunião não encontrada" });

  if (role === "empresa" && camp.companyId !== entityId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor" && reuniao.sellerSdrId !== entityId && reuniao.sellerCloserId !== entityId) return res.status(403).json({ error: "Sem acesso" });
  if (!["agendada", "confirmada"].includes(reuniao.status)) return res.status(400).json({ error: "Reunião não pode ser reagendada no status atual" });

  const { data, horaInicio, horaFim, closerId } = req.body;
  if (!data || !horaInicio || !horaFim) return res.status(400).json({ error: "data, horaInicio e horaFim obrigatórios" });

  const novoCloser = closerId || reuniao.sellerCloserId;
  try {
    const nova = db.transaction(() => {
      const conflito = db.prepare("SELECT id FROM campaign_reunioes WHERE sellerCloserId = ? AND data = ? AND horaInicio < ? AND horaFim > ? AND status NOT IN ('cancelada', 'nao_compareceu') AND id != ?").get(novoCloser, data, horaFim, horaInicio, reuniao.id);
      if (conflito) throw new Error("Horário já reservado");
      db.prepare("UPDATE campaign_reunioes SET status = 'reagendada', atualizadoEm = ? WHERE id = ?").run(agora(), reuniao.id);
      const novoId = uid();
      db.prepare(`INSERT INTO campaign_reunioes (id, campaignId, companyId, leadId, sellerSdrId, sellerCloserId, titulo, data, horaInicio, horaFim, status, tipo, linkReuniao, local, dadosQualificacao, criadoEm, reagendadoDe)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'agendada', ?, ?, ?, ?, ?, ?)`).run(
        novoId, camp.id, camp.companyId, reuniao.leadId, reuniao.sellerSdrId, novoCloser,
        reuniao.titulo, data, horaInicio, horaFim, reuniao.tipo, reuniao.linkReuniao, reuniao.local,
        reuniao.dadosQualificacao, agora(), reuniao.id
      );
      return { id: novoId, data, horaInicio, horaFim, closerId: novoCloser, reagendadoDe: reuniao.id };
    }).immediate();
    registrarEventoCampanha({ companyId: camp.companyId, campaignId: camp.id, tipo: "MEETING_SCHEDULED", actorId: entityId, actorRole: role === "vendedor" ? "profissional" : "empresa", sellerId: novoCloser, leadId: reuniao.leadId || null, dados: { reuniaoId: nova.id, reagendadoDe: reuniao.id, data, horaInicio } });
    notificarAgendamento({ campaign: camp, reuniao: { ...nova, leadId: reuniao.leadId, sellerCloserId: novoCloser, sellerSdrId: reuniao.sellerSdrId }, tipo: "reagendada", actorRole: role }).catch(e => console.warn("[notif-agenda]", e.message));
    res.json(nova);
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// ── F2-028/031/037: Enviar confirmação ao lead (WhatsApp/Email) ──────────
router.post("/campaigns/:id/enviar-confirmacao", async (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT id, companyId, titulo FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });

  const autorizado = role === "empresa" ? camp.companyId === entityId : !!db.prepare("SELECT 1 FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(camp.id, entityId);
  if (!autorizado) return res.status(403).json({ error: "Sem permissão" });

  const { leadId, canal } = req.body;
  if (!leadId || !canal) return res.status(400).json({ error: "leadId e canal obrigatórios" });
  if (!["whatsapp", "email", "sms"].includes(canal)) return res.status(400).json({ error: "Canal inválido" });

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

  const limite = verificarLimiteReenvio(leadId, camp.id);
  if (!limite.podeReenviar) return res.status(429).json({ error: "Limite de reenvios atingido", ...limite });

  let token = db.prepare("SELECT token FROM campaign_contacts WHERE campaignId = ? AND leadId = ? AND status = 'pendente' AND token IS NOT NULL").get(camp.id, leadId)?.token;
  if (!token) {
    token = uid();
    const existe = db.prepare("SELECT id FROM campaign_contacts WHERE campaignId = ? AND leadId = ?").get(camp.id, leadId);
    if (existe) {
      db.prepare("UPDATE campaign_contacts SET token = ?, status = 'pendente', atualizadoEm = ? WHERE campaignId = ? AND leadId = ?").run(token, agora(), camp.id, leadId);
    } else {
      db.prepare("INSERT INTO campaign_contacts (id, campaignId, leadId, sellerId, token, status, criadoEm) VALUES (?, ?, ?, ?, ?, 'pendente', ?)").run(uid(), camp.id, leadId, role === "vendedor" ? entityId : "", token, agora());
    }
  }

  const resultado = await enviarConfirmacao({ leadId, campaignId: camp.id, canal, token, lead, campanhaNome: camp.titulo });

  if (resultado.enviado) {
    db.prepare("UPDATE leads SET confirmacaoEnvios = COALESCE(confirmacaoEnvios, 0) + 1, confirmacaoUltimoEnvio = ? WHERE id = ?").run(agora(), leadId);
  }

  res.json(resultado);
});

// ── F2-022: Auto-save parcial do questionário ────────────────────────────
router.patch("/campaigns/:id/leads/:leadId/qualificacao-parcial", (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });

  const autorizado = role === "empresa" ? camp.companyId === entityId : !!db.prepare("SELECT 1 FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(camp.id, entityId);
  if (!autorizado) return res.status(403).json({ error: "Sem permissão" });

  const { respostas } = req.body;
  if (!respostas || typeof respostas !== "object") return res.status(400).json({ error: "respostas obrigatório" });

  db.prepare("UPDATE leads SET qualificacaoParcial = ? WHERE id = ?").run(JSON.stringify(respostas).slice(0, 10000), req.params.leadId);
  res.json({ ok: true });
});

// ── F3: Indicadores reais da campanha ────────────────────────────────────
router.get("/campaigns/:id/indicadores", (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && camp.companyId !== entityId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor" && !db.prepare("SELECT 1 FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(camp.id, entityId)) {
    return res.status(403).json({ error: "Sem acesso" });
  }

  const cid = camp.id;
  const totalLeads = db.prepare("SELECT COUNT(*) n FROM campaign_leads WHERE campaignId = ?").get(cid).n;
  const leadsPorStatus = db.prepare("SELECT status, COUNT(*) n FROM campaign_leads WHERE campaignId = ? GROUP BY status").all(cid);
  const profissionaisAtivos = db.prepare("SELECT COUNT(*) n FROM campaign_applications WHERE campaignId = ? AND status = 'aprovado'").get(cid).n;
  const profissionaisPendentes = db.prepare("SELECT COUNT(*) n FROM campaign_applications WHERE campaignId = ? AND status = 'pendente'").get(cid).n;

  const reunioesPorStatus = db.prepare("SELECT status, COUNT(*) n FROM campaign_reunioes WHERE campaignId = ? GROUP BY status").all(cid);
  const reunioesMap = {};
  for (const r of reunioesPorStatus) reunioesMap[r.status] = r.n;

  const vendas = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(valorVenda), 0) total FROM campaign_reunioes WHERE campaignId = ? AND status = 'venda'").get(cid);

  const submissions = db.prepare("SELECT status, COUNT(*) n FROM submissions WHERE campaignId = ? GROUP BY status").all(cid);
  const submissionsMap = {};
  for (const s of submissions) submissionsMap[s.status] = s.n;

  const gastoTotal = db.prepare("SELECT COALESCE(SUM(ABS(valor)), 0) t FROM financial_ledger WHERE companyId = ? AND tipo = 'liquidacao' AND submissionId IN (SELECT id FROM submissions WHERE campaignId = ?)").get(camp.companyId, cid).t;
  const reservado = db.prepare("SELECT COALESCE(SUM(valor), 0) t FROM financial_ledger WHERE companyId = ? AND tipo = 'reserva_campanha' AND dados LIKE ?").get(camp.companyId, `%"campaignId":"${cid}"%`).t;

  const totalReunioes = Object.values(reunioesMap).reduce((a, b) => a + b, 0);
  const taxaConversaoLeadReuniao = totalLeads > 0 ? Math.round(((reunioesMap.realizada || 0) + (vendas.n || 0)) / totalLeads * 100) : 0;
  const taxaConversaoReuniaoVenda = totalReunioes > 0 ? Math.round((vendas.n || 0) / totalReunioes * 100) : 0;

  res.json({
    leads: { total: totalLeads, porStatus: Object.fromEntries(leadsPorStatus.map((l) => [l.status, l.n])) },
    profissionais: { ativos: profissionaisAtivos, pendentes: profissionaisPendentes },
    reunioes: { ...reunioesMap, total: totalReunioes },
    vendas: { total: vendas.n, valorTotal: vendas.total, ticketMedio: vendas.n > 0 ? Math.round(vendas.total / vendas.n * 100) / 100 : 0 },
    submissions: submissionsMap,
    financeiro: { orcamento: camp.orcamento || 0, reservado: Math.round(reservado * 100) / 100, gasto: Math.round(gastoTotal * 100) / 100, disponivel: Math.round(Math.max(0, (camp.orcamento || 0) - gastoTotal) * 100) / 100 },
    conversao: { leadReuniao: taxaConversaoLeadReuniao, reuniaoVenda: taxaConversaoReuniaoVenda },
  });
});

// ── F3: Candidaturas por campanha ────────────────────────────────────────
router.get("/campaigns/:id/candidaturas", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp || camp.companyId !== entityId) return res.status(404).json({ error: "Campanha não encontrada" });

  let where = "ca.campaignId = ?";
  const params = [camp.id];
  if (req.query.status) { where += " AND ca.status = ?"; params.push(req.query.status); }

  const candidaturas = db.prepare(`SELECT ca.*, s.nome, s.email, s.whatsapp, s.cidade, s.estado, s.foto FROM campaign_applications ca LEFT JOIN sellers s ON s.id = ca.sellerId WHERE ${where} ORDER BY ca.criadoEm DESC LIMIT 200`).all(...params);
  res.json({ candidaturas });
});

// ── F3: Remover profissional da campanha ─────────────────────────────────
router.post("/campaigns/:id/remover-profissional", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp || camp.companyId !== entityId) return res.status(404).json({ error: "Campanha não encontrada" });

  const { sellerId, motivo } = req.body;
  if (!sellerId) return res.status(400).json({ error: "sellerId obrigatório" });

  db.transaction(() => {
    db.prepare("UPDATE campaign_applications SET status = 'removido' WHERE campaignId = ? AND sellerId = ?").run(camp.id, sellerId);
    db.prepare("UPDATE campaign_reunioes SET status = 'cancelada', canceladoEm = ?, atualizadoEm = ? WHERE campaignId = ? AND (sellerSdrId = ? OR sellerCloserId = ?) AND status IN ('agendada', 'confirmada')").run(agora(), agora(), camp.id, sellerId, sellerId);
  })();

  registrarEventoCampanha({ companyId: camp.companyId, campaignId: camp.id, tipo: "PROFESSIONAL_REJECTED", actorId: entityId, actorRole: "empresa", sellerId, dados: { motivo: String(motivo || "").slice(0, 300), acao: "removido" } });
  res.json({ ok: true });
});

// ── F3: Adicionar verba à campanha em andamento ─────────────────────────
router.post("/campaigns/:id/adicionar-verba", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const camp = db.prepare("SELECT id, companyId, orcamento FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });

  const { valor } = req.body;
  const v = Math.round((Number(valor) || 0) * 100) / 100;
  if (v <= 0) return res.status(400).json({ error: "Valor inválido" });

  try {
    const posicao = reservarVerbaCampanha({ companyId: entityId, campaignId: camp.id, valor: v });
    db.prepare("UPDATE campaigns SET orcamento = orcamento + ? WHERE id = ?").run(v, camp.id);
    res.json({ ok: true, novoOrcamento: Math.round(((camp.orcamento || 0) + v) * 100) / 100, posicao });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── F3: Pausar campanha ─────────────────────────────────────────────────
router.post("/campaigns/:id/pausar", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const camp = db.prepare("SELECT id, companyId, status FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });
  if (camp.status !== "ativa") return res.status(400).json({ error: "Campanha precisa estar ativa para pausar" });

  db.prepare("UPDATE campaigns SET status = 'pausada', atualizadoEm = ? WHERE id = ?").run(agora(), camp.id);
  registrarEventoCampanha({ companyId: entityId, campaignId: camp.id, tipo: "CAMPAIGN_PAUSED", actorId: entityId, actorRole: "empresa" });
  res.json({ ok: true, status: "pausada" });
});

// ── F3: Retomar campanha ────────────────────────────────────────────────
router.post("/campaigns/:id/retomar", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const camp = db.prepare("SELECT id, companyId, status FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });
  if (camp.status !== "pausada") return res.status(400).json({ error: "Campanha precisa estar pausada para retomar" });

  db.prepare("UPDATE campaigns SET status = 'ativa', atualizadoEm = ? WHERE id = ?").run(agora(), camp.id);
  registrarEventoCampanha({ companyId: entityId, campaignId: camp.id, tipo: "CAMPAIGN_PUBLISHED", actorId: entityId, actorRole: "empresa", dados: { acao: "retomada" } });
  res.json({ ok: true, status: "ativa" });
});

// ── F3: Relatório financeiro por campanha ────────────────────────────────
router.get("/campaigns/:id/financeiro", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const camp = db.prepare("SELECT id, companyId, orcamento FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });

  const cid = camp.id;
  const reservado = db.prepare("SELECT COALESCE(SUM(valor), 0) t FROM financial_ledger WHERE companyId = ? AND tipo = 'reserva_campanha' AND dados LIKE ?").get(entityId, `%"campaignId":"${cid}"%`).t;
  const liberado = db.prepare("SELECT COALESCE(SUM(ABS(valor)), 0) t FROM financial_ledger WHERE companyId = ? AND tipo = 'liberacao_campanha' AND dados LIKE ?").get(entityId, `%"campaignId":"${cid}"%`).t;
  const gasto = db.prepare("SELECT COALESCE(SUM(ABS(valor)), 0) t FROM financial_ledger WHERE companyId = ? AND tipo = 'liquidacao' AND submissionId IN (SELECT id FROM submissions WHERE campaignId = ?)").get(entityId, cid).t;

  const porProfissional = db.prepare(`SELECT s.id, s.nome, COALESCE(SUM(ABS(fl.valor)), 0) total, COUNT(fl.id) qtd FROM financial_ledger fl JOIN sellers s ON s.id = fl.sellerId WHERE fl.companyId = ? AND fl.tipo = 'liquidacao' AND fl.submissionId IN (SELECT id FROM submissions WHERE campaignId = ?) GROUP BY s.id ORDER BY total DESC LIMIT 50`).all(entityId, cid);

  const porFormaGanho = db.prepare(`SELECT fg.nome, fg.tipo, COALESCE(SUM(ABS(fl.valor)), 0) total, COUNT(fl.id) qtd FROM financial_ledger fl JOIN submissions sub ON sub.id = fl.submissionId JOIN formas_ganho fg ON fg.id = sub.formaGanhoId WHERE fl.companyId = ? AND fl.tipo = 'liquidacao' AND sub.campaignId = ? GROUP BY fg.id ORDER BY total DESC`).all(entityId, cid);

  res.json({
    orcamento: camp.orcamento || 0,
    reservado: Math.round(reservado * 100) / 100,
    liberado: Math.round(liberado * 100) / 100,
    gasto: Math.round(gasto * 100) / 100,
    saldoRestante: Math.round(Math.max(0, (camp.orcamento || 0) - gasto) * 100) / 100,
    porProfissional,
    porFormaGanho,
  });
});

// ── Seleção de contatos para campanha ────────────────────────────────────
router.post("/campaigns/:id/contatos/selecionar", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const camp = db.prepare("SELECT id FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });
  const { leadIds } = req.body;
  if (!Array.isArray(leadIds) || !leadIds.length) return res.status(400).json({ error: "leadIds obrigatório" });
  const ins = db.prepare("INSERT OR IGNORE INTO campaign_leads (id, campaignId, leadId, status, criadoEm) VALUES (?, ?, ?, 'disponivel', ?)");
  let adicionados = 0;
  const agr = Date.now();
  for (const lid of leadIds.slice(0, 5000)) {
    const lead = db.prepare("SELECT id FROM leads WHERE id = ? AND companyId = ?").get(lid, entityId);
    if (!lead) continue;
    const r = ins.run(uid(), camp.id, lid, agr);
    if (r.changes) adicionados++;
  }
  const total = db.prepare("SELECT COUNT(*) n FROM campaign_leads WHERE campaignId = ?").get(camp.id).n;
  res.json({ adicionados, total });
});

// ── Distribuição automática de leads ─────────────────────────────────────
router.post("/campaigns/:id/distribuicao-automatica", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const camp = db.prepare("SELECT id FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });
  const profissionais = db.prepare("SELECT sellerId FROM campaign_applications WHERE campaignId = ? AND status = 'aprovado'").all(camp.id);
  if (!profissionais.length) return res.status(400).json({ error: "Nenhum profissional aprovado" });
  const disponiveis = db.prepare("SELECT id FROM campaign_leads WHERE campaignId = ? AND status = 'disponivel'").all(camp.id);
  if (!disponiveis.length) return res.json({ distribuidos: 0, profissionais: profissionais.length });
  const agr = Date.now();
  const upd = db.prepare("UPDATE campaign_leads SET status = 'atribuido', sellerId = ?, atribuidoEm = ? WHERE id = ?");
  let idx = 0;
  for (const lead of disponiveis) {
    upd.run(profissionais[idx % profissionais.length].sellerId, agr, lead.id);
    idx++;
  }
  res.json({ distribuidos: disponiveis.length, profissionais: profissionais.length });
});

// ── Configuração de canais de confirmação ────────────────────────────────
router.patch("/campaigns/:id/configuracao-confirmacao", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const camp = db.prepare("SELECT id FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });
  const { canais, mensagemPersonalizada, prazoHoras } = req.body;
  const config = { canais: canais || {}, mensagemPersonalizada: (mensagemPersonalizada || "").slice(0, 1000), prazoHoras: Number(prazoHoras) || 48 };
  db.prepare("UPDATE campaigns SET configConfirmacao = ?, atualizadoEm = ? WHERE id = ?").run(JSON.stringify(config), Date.now(), camp.id);
  res.json({ ok: true });
});

// ── Cobertura financeira ─────────────────────────────────────────────────
router.get("/campaigns/:id/cobertura-financeira", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const camp = db.prepare("SELECT * FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });
  const posicao = posicaoEmpresa(entityId);
  const formas = db.prepare("SELECT valor FROM formas_ganho WHERE campaignId = ? AND ativo = 1").all(camp.id);
  const totalLeads = db.prepare("SELECT COUNT(*) n FROM campaign_leads WHERE campaignId = ?").get(camp.id).n;
  const custoEstimado = formas.reduce((s, f) => s + (f.valor || 0), 0) * Math.max(1, totalLeads);
  const cobertura = custoEstimado > 0 ? Math.round(((posicao?.disponivel || 0) / custoEstimado) * 10000) / 100 : 100;
  const alertas = [];
  if (cobertura < 50) alertas.push("Verba cobre menos de 50% do custo estimado. Considere adicionar saldo.");
  if (cobertura < 10) alertas.push("Verba crítica: menos de 10% de cobertura.");
  if (totalLeads === 0) alertas.push("Nenhum contato vinculado à campanha.");
  res.json({ verba: camp.orcamento || 0, saldoDisponivel: posicao?.disponivel || 0, custoEstimado: Math.round(custoEstimado * 100) / 100, cobertura, alertas });
});

// ── Agendamentos de campanha (SDR/Closer scheduling) ─────────────────────
router.get("/campaigns/:id/agendamentos", (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });

  let where = "s.campaignId = ?";
  const params = [camp.id];
  if (role === "empresa") {
    if (camp.companyId !== entityId) return res.status(403).json({ error: "Sem permissão" });
  } else if (role === "vendedor") {
    const aprov = db.prepare("SELECT id FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(camp.id, entityId);
    if (!aprov) return res.status(403).json({ error: "Sem permissão" });
    where += " AND s.sellerId = ?";
    params.push(entityId);
  } else { return res.status(403).json({ error: "Sem permissão" }); }

  if (req.query.status) { where += " AND s.status = ?"; params.push(req.query.status); }
  if (req.query.de) { where += " AND s.dataHora >= ?"; params.push(Number(req.query.de)); }
  if (req.query.ate) { where += " AND s.dataHora <= ?"; params.push(Number(req.query.ate)); }

  const rows = db.prepare(`SELECT s.*, l.nome AS leadNome FROM campaign_schedules s LEFT JOIN leads l ON l.id = s.leadId WHERE ${where} ORDER BY s.dataHora ASC LIMIT 500`).all(...params);
  res.json(rows);
});

router.post("/campaigns/:id/agendamentos", (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });

  let sellerId;
  if (role === "empresa") {
    if (camp.companyId !== entityId) return res.status(403).json({ error: "Sem permissão" });
    sellerId = req.body.sellerId;
    if (!sellerId) return res.status(400).json({ error: "sellerId obrigatório para empresa" });
  } else if (role === "vendedor") {
    const aprov = db.prepare("SELECT id FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(camp.id, entityId);
    if (!aprov) return res.status(403).json({ error: "Sem permissão" });
    sellerId = entityId;
  } else { return res.status(403).json({ error: "Sem permissão" }); }

  const { leadId, tipo, titulo, descricao, dataHora, duracao, local: loc, linkOnline, observacoes } = req.body;
  if (!dataHora || dataHora < Date.now()) return res.status(400).json({ error: "dataHora deve ser futura" });
  const tiposValidos = ["reuniao", "visita", "ligacao", "follow", "apresentacao", "outro"];
  if (!tiposValidos.includes(tipo || "reuniao")) return res.status(400).json({ error: "Tipo inválido" });

  const id = uid();
  const agr = Date.now();
  db.prepare(`INSERT INTO campaign_schedules (id, campaignId, sellerId, leadId, tipo, titulo, descricao, dataHora, duracao, status, local, linkOnline, observacoes, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'agendado', ?, ?, ?, ?, ?)`)
    .run(id, camp.id, sellerId, leadId || "", tipo || "reuniao", (titulo || "").slice(0, 200), (descricao || "").slice(0, 1000), dataHora, duracao || 30, (loc || "").slice(0, 300), (linkOnline || "").slice(0, 500), (observacoes || "").slice(0, 1000), agr, agr);

  res.status(201).json({ id, campaignId: camp.id, sellerId, tipo: tipo || "reuniao", dataHora, status: "agendado" });
});

router.patch("/campaigns/:id/agendamentos/:schedId", (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });
  const sched = db.prepare("SELECT * FROM campaign_schedules WHERE id = ? AND campaignId = ?").get(req.params.schedId, camp.id);
  if (!sched) return res.status(404).json({ error: "Agendamento não encontrado" });

  if (role === "empresa") {
    if (camp.companyId !== entityId) return res.status(403).json({ error: "Sem permissão" });
  } else if (role === "vendedor") {
    if (sched.sellerId !== entityId) return res.status(403).json({ error: "Sem permissão" });
  } else { return res.status(403).json({ error: "Sem permissão" }); }

  const statusValidos = { agendado: ["realizado", "cancelado", "reagendado"], reagendado: ["realizado", "cancelado"] };
  if (req.body.status && req.body.status !== sched.status) {
    const permitidos = statusValidos[sched.status] || [];
    if (!permitidos.includes(req.body.status)) return res.status(400).json({ error: `Transição ${sched.status} → ${req.body.status} não permitida` });
  }

  const campos = ["titulo", "descricao", "dataHora", "duracao", "status", "local", "linkOnline", "observacoes"];
  const sets = [];
  const vals = [];
  for (const c of campos) {
    if (req.body[c] !== undefined) { sets.push(`${c} = ?`); vals.push(c === "local" ? req.body[c] : req.body[c]); }
  }
  if (!sets.length) return res.status(400).json({ error: "Nenhum campo para atualizar" });
  sets.push("atualizadoEm = ?");
  vals.push(Date.now());
  vals.push(sched.id);
  db.prepare(`UPDATE campaign_schedules SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ ok: true, id: sched.id });
});

// ── Agendamentos do vendedor (todos as campanhas) ────────────────────────
router.get("/vendedor/agendamentos", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas vendedor" });
  let where = "s.sellerId = ?";
  const params = [entityId];
  if (req.query.status) { where += " AND s.status = ?"; params.push(req.query.status); }
  if (req.query.de) { where += " AND s.dataHora >= ?"; params.push(Number(req.query.de)); }
  if (req.query.ate) { where += " AND s.dataHora <= ?"; params.push(Number(req.query.ate)); }
  const rows = db.prepare(`SELECT s.*, c.titulo AS campanhaTitulo, l.nome AS leadNome
    FROM campaign_schedules s
    LEFT JOIN campaigns c ON c.id = s.campaignId
    LEFT JOIN leads l ON l.id = s.leadId
    WHERE ${where} ORDER BY s.dataHora ASC LIMIT 500`).all(...params);
  res.json(rows);
});

// ── F1-017: Gerar ICP com IA ───────────────────────────────────────────
router.post("/campaigns/gerar-icp", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const { objetivo, funcao, produto, regiao, mercado, empresa: empInput } = req.body;
  try {
    const { gerarICPDeterministico } = await import("../services/campanhaAssistida.js");
    const empresa = db.prepare("SELECT nome, segmento, produto, icp, ticket FROM companies WHERE id = ?").get(entityId) || {};
    const resultado = gerarICPDeterministico(
      { ...empresa, ...(empInput || {}) },
      { objetivo, funcao, produto: produto || empresa.produto, regiao, mercado }
    );
    res.json({ icp: resultado.icp, icpEstruturado: resultado.estruturado, fonte: resultado.fonte });
  } catch (e) {
    res.status(500).json({ error: "Erro ao gerar ICP" });
  }
});

// ── F1-019: Recomendar atividades com IA ────────────────────────────────
router.post("/campaigns/recomendar-atividades", async (req, res) => {
  const { role } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const { objetivo, funcao, mercado, origemLeads, canais, produto } = req.body;
  try {
    const { recomendarAtividadesDeterministico } = await import("../services/campanhaAssistida.js");
    const resultado = recomendarAtividadesDeterministico({ objetivo, funcao, mercado, origemLeads, canais, produto });
    const atividades = resultado.atividades.map((a) => ({ id: a.eventoComercial, nome: a.nome, descricao: a.descricao, valorSugerido: a.valorSugerido }));
    const valores = {};
    resultado.atividades.forEach((a) => { if (a.valorSugerido) valores[a.eventoComercial] = a.valorSugerido; });
    res.json({ atividades, valores, fonte: resultado.fonte });
  } catch (e) {
    res.status(500).json({ error: "Erro ao recomendar atividades" });
  }
});

// ── F1-020: Recomendar comprovações com IA ──────────────────────────────
router.post("/campaigns/recomendar-comprovacoes", async (req, res) => {
  const { role } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const { atividade, funcao, objetivo, canais } = req.body;
  try {
    const { recomendarComprovacoesDeterministico } = await import("../services/campanhaAssistida.js");
    const resultado = recomendarComprovacoesDeterministico([{ nome: atividade, eventoComercial: atividade }]);
    const evidencias = (resultado.comprovacoes[0]?.evidencias || []).map((e) => ({
      id: e.tipo === "captura_tela" ? "envio_imagem" : e.tipo === "contrato" ? "envio_documento" : e.tipo === "convite_calendario" ? "registro_calendario" : e.tipo === "resumo" ? "envio_documento" : e.tipo === "foto_geolocalizacao" ? "envio_imagem" : "evidencia_personalizada",
      nome: e.descricao,
      obrigatoria: e.obrigatoria,
    }));
    res.json({ evidencias, metodoAprovacao: "manual", fonte: resultado.fonte });
  } catch (e) {
    res.status(500).json({ error: "Erro ao recomendar comprovações" });
  }
});

// ── F3: Métricas avançadas (qualificação, funil, confirmações, reuniões) ──

router.get("/campaigns/:id/metricas-avancadas", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa" && role !== "admin") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });

  const cid = campaign.id;

  const qualLeads = db.prepare("SELECT qualificacaoClassificacao AS cls, COUNT(*) AS n FROM leads WHERE campaignId = ? AND qualificacaoClassificacao IS NOT NULL AND qualificacaoClassificacao != '' GROUP BY qualificacaoClassificacao").all(cid);
  const qualMap = Object.fromEntries(qualLeads.map(r => [r.cls, r.n]));

  const qualificados = {
    total: (qualMap.alta || 0) + (qualMap.media || 0) + (qualMap.baixa || 0),
    alta: qualMap.alta || 0, media: qualMap.media || 0, baixa: qualMap.baixa || 0,
    desqualificados: qualMap.desqualificado || 0,
  };

  const etapas = db.prepare("SELECT etapa, COUNT(*) AS total FROM leads WHERE campaignId = ? GROUP BY etapa").all(cid);
  const totalLeads = etapas.reduce((s, e) => s + e.total, 0) || 1;
  const funil = etapas.map(e => ({ etapa: e.etapa, total: e.total, percentual: Math.round((e.total / totalLeads) * 100) }));

  const confStats = db.prepare("SELECT confirmacaoStatus AS st, COUNT(*) AS n FROM leads WHERE campaignId = ? AND confirmacaoStatus IS NOT NULL AND confirmacaoStatus != '' GROUP BY confirmacaoStatus").all(cid);
  const confMap = Object.fromEntries(confStats.map(r => [r.st, r.n]));
  const confirmacoes = {
    enviadas: (confMap.aguardando || 0) + (confMap.confirmada || 0) + (confMap.nao_reconhecida || 0) + (confMap.expirada || 0),
    confirmadas: confMap.confirmada || 0, naoReconhecidas: confMap.nao_reconhecida || 0, expiradas: confMap.expirada || 0,
  };

  const reunStats = db.prepare("SELECT status, COUNT(*) AS n FROM campaign_reunioes WHERE campaignId = ? GROUP BY status").all(cid);
  const reunMap = Object.fromEntries(reunStats.map(r => [r.status, r.n]));
  const agendadas = reunMap.agendada || 0;
  const realizadas = reunMap.realizada || 0;
  const reunioes = {
    agendadas, realizadas, canceladas: reunMap.cancelada || 0, naoCompareceu: reunMap.nao_compareceu || 0,
    taxaComparecimento: agendadas > 0 ? Math.round((realizadas / agendadas) * 100) : 0,
  };

  res.json({ qualificados, funil, confirmacoes, reunioes });
});

// ── F3: Metas, projeções e planejamento vs realizado ────────────────────

router.get("/campaigns/:id/metas-projecoes", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa" && role !== "admin") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });

  const cid = campaign.id;
  const meta = Number(campaign.metaQuantitativa) || 0;
  const duracaoDias = Number(campaign.duracaoDias) || 30;
  const inicio = Number(campaign.criadoEm) || Date.now();
  const diasDecorridos = Math.max(1, Math.ceil((Date.now() - inicio) / (1000 * 60 * 60 * 24)));
  const diasRestantes = Math.max(0, duracaoDias - diasDecorridos);

  const totalLeadsTrabalhados = db.prepare("SELECT COUNT(*) n FROM campaign_leads WHERE campaignId = ? AND status != 'disponivel'").get(cid).n;
  const totalQualificados = db.prepare("SELECT COUNT(*) n FROM leads WHERE campaignId = ? AND qualificacaoClassificacao IN ('alta','media')").get(cid).n;
  const totalReunioes = db.prepare("SELECT COUNT(*) n FROM campaign_reunioes WHERE campaignId = ? AND status IN ('agendada','confirmada','realizada','venda')").get(cid).n;
  const totalReunioesRealizadas = db.prepare("SELECT COUNT(*) n FROM campaign_reunioes WHERE campaignId = ? AND status IN ('realizada','venda')").get(cid).n;
  const totalVendas = db.prepare("SELECT COUNT(*) n FROM campaign_reunioes WHERE campaignId = ? AND status = 'venda'").get(cid).n;

  const ritmo = {
    leadsPorDia: Math.round((totalLeadsTrabalhados / diasDecorridos) * 10) / 10,
    qualificadosPorDia: Math.round((totalQualificados / diasDecorridos) * 10) / 10,
    reunioesPorDia: Math.round((totalReunioes / diasDecorridos) * 10) / 10,
    vendasPorDia: Math.round((totalVendas / diasDecorridos) * 10) / 10,
  };

  const projecao = {
    leadsProjetados: Math.round(ritmo.leadsPorDia * duracaoDias),
    qualificadosProjetados: Math.round(ritmo.qualificadosPorDia * duracaoDias),
    reunioesProjetadas: Math.round(ritmo.reunioesPorDia * duracaoDias),
    vendasProjetadas: Math.round(ritmo.vendasPorDia * duracaoDias),
  };

  let planejamento = null;
  try { planejamento = JSON.parse(campaign.planejamentoReverso || "null"); } catch { /* */ }

  let comparacao = null;
  if (planejamento && planejamento.etapas) {
    comparacao = planejamento.etapas.map(etapa => {
      let realizado = 0;
      if (etapa.id === "vendas") realizado = totalVendas;
      else if (etapa.id === "reunioes_realizadas") realizado = totalReunioesRealizadas;
      else if (etapa.id === "reunioes_agendadas") realizado = totalReunioes;
      else if (etapa.id === "contatos_qualificados" || etapa.id === "leads_qualificados") realizado = totalQualificados;
      else if (etapa.id === "contatos_trabalhados") realizado = totalLeadsTrabalhados;
      return { id: etapa.id, nome: etapa.nome, planejado: etapa.quantidade, realizado, percentual: etapa.quantidade > 0 ? Math.round((realizado / etapa.quantidade) * 100) : 0 };
    });
  }

  const metasDiarias = meta > 0 ? Math.round((meta / duracaoDias) * 10) / 10 : 0;
  res.json({ meta, diasDecorridos, diasRestantes, duracaoDias, realizado: { leadsTrabalhados: totalLeadsTrabalhados, qualificados: totalQualificados, reunioes: totalReunioes, reunioesRealizadas: totalReunioesRealizadas, vendas: totalVendas }, ritmo, projecao, comparacao, metasIntermediarias: { diaria: metasDiarias, semanal: Math.round(metasDiarias * 7), meta, duracaoDias }, planejamento });
});

// ── F3: Alertas proativos ───────────────────────────────────────────────

router.get("/campaigns/:id/alertas", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa" && role !== "admin") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });

  const cid = campaign.id;
  const alertas = [];

  const disponiveis = db.prepare("SELECT COUNT(*) n FROM campaign_leads WHERE campaignId = ? AND status = 'disponivel'").get(cid).n;
  const totalLeads = db.prepare("SELECT COUNT(*) n FROM campaign_leads WHERE campaignId = ?").get(cid).n;
  if (totalLeads > 0 && disponiveis <= Math.max(3, Math.ceil(totalLeads * 0.1))) {
    alertas.push({ tipo: "contatos_baixos", severidade: disponiveis === 0 ? "critica" : "alta", mensagem: disponiveis === 0 ? "Nenhum contato disponível para distribuição." : `Apenas ${disponiveis} contato(s) disponível(is).`, sugestao: "Adicione mais contatos ou importe uma nova lista." });
  }

  const trabalhados = db.prepare("SELECT COUNT(*) n FROM campaign_leads WHERE campaignId = ? AND status != 'disponivel'").get(cid).n;
  const qualificados = db.prepare("SELECT COUNT(*) n FROM leads WHERE campaignId = ? AND qualificacaoClassificacao IN ('alta','media')").get(cid).n;
  if (trabalhados >= 20 && qualificados / trabalhados < 0.05) {
    alertas.push({ tipo: "baixa_conversao", severidade: "alta", mensagem: `Apenas ${Math.round((qualificados / trabalhados) * 100)}% dos contatos trabalhados foram qualificados.`, sugestao: "Revise os critérios de qualificação ou o perfil dos contatos." });
  }

  const tresdiasAtras = Date.now() - (3 * 24 * 60 * 60 * 1000);
  const profAtivos = db.prepare("SELECT sellerId FROM campaign_applications WHERE campaignId = ? AND status = 'aprovado'").all(cid);
  for (const p of profAtivos) {
    const ultimaAtividade = db.prepare("SELECT MAX(criadoEm) m FROM campaign_events WHERE campaignId = ? AND sellerId = ?").get(cid, p.sellerId);
    if (!ultimaAtividade?.m || ultimaAtividade.m < tresdiasAtras) {
      const seller = db.prepare("SELECT nome FROM sellers WHERE id = ?").get(p.sellerId);
      alertas.push({ tipo: "profissional_inativo", severidade: "media", mensagem: `${seller?.nome || "Profissional"} está inativo há mais de 3 dias.`, sugestao: "Entre em contato para verificar disponibilidade." });
    }
  }

  const pendentesAprov = db.prepare("SELECT COUNT(*) n FROM submissions WHERE campaignId = ? AND status = 'pendente'").get(cid).n;
  if (pendentesAprov > 0) {
    alertas.push({ tipo: "pendencias_aprovacao", severidade: pendentesAprov > 10 ? "alta" : "media", mensagem: `${pendentesAprov} tarefa(s) aguardando aprovação.`, sugestao: "Revise e aprove as pendências para manter os profissionais motivados." });
  }

  const orcamento = Number(campaign.orcamento) || 0;
  if (orcamento > 0) {
    const gasto = db.prepare("SELECT COALESCE(SUM(ABS(valor)), 0) t FROM financial_ledger WHERE companyId = ? AND tipo = 'liquidacao' AND submissionId IN (SELECT id FROM submissions WHERE campaignId = ?)").get(campaign.companyId, cid).t;
    const percentualUsado = Math.round((gasto / orcamento) * 100);
    if (percentualUsado >= 80) {
      alertas.push({ tipo: "verba_esgotando", severidade: percentualUsado >= 95 ? "critica" : "alta", mensagem: `${percentualUsado}% da verba da campanha já foi utilizada.`, sugestao: percentualUsado >= 95 ? "Adicione verba imediatamente para evitar a pausa automática." : "Considere adicionar mais verba para manter a campanha ativa." });
    }
  }

  const candPendentes = db.prepare("SELECT COUNT(*) n FROM campaign_applications WHERE campaignId = ? AND status = 'pendente'").get(cid).n;
  if (candPendentes > 0) {
    alertas.push({ tipo: "candidaturas_pendentes", severidade: "media", mensagem: `${candPendentes} candidatura(s) aguardando análise.`, sugestao: "Avalie as candidaturas para expandir a equipe." });
  }

  res.json({ alertas });
});

// ── ESQ-24: Duplicação de campanha ──────────────────────────────────────

router.post("/campaigns/:id/duplicar", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa" && role !== "admin") return res.status(403).json({ error: "Apenas empresa" });
  const original = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!original) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== original.companyId) return res.status(403).json({ error: "Sem permissão" });

  const novoId = uid();
  const cr = agora();

  db.transaction(() => {
    const cols = db.prepare("PRAGMA table_info(campaigns)").all().map(c => c.name).filter(c => c !== "id" && c !== "criadoEm" && c !== "status");
    const selectCols = cols.map(c => `"${c}"`).join(", ");
    db.prepare(`INSERT INTO campaigns (id, ${selectCols}, status, criadoEm) SELECT ?, ${selectCols}, 'rascunho', ? FROM campaigns WHERE id = ?`).run(novoId, cr, original.id);
    db.prepare("UPDATE campaigns SET titulo = ?, versao = 1, passoWizard = 0 WHERE id = ?").run((original.titulo || "Campanha") + " (cópia)", novoId);

    const formas = db.prepare("SELECT * FROM formas_ganho WHERE campaignId = ?").all(original.id);
    for (const fg of formas) {
      const fgId = uid();
      const fgCols = db.prepare("PRAGMA table_info(formas_ganho)").all().map(c => c.name).filter(c => c !== "id" && c !== "campaignId" && c !== "criadoEm");
      const vals = fgCols.map(c => fg[c] ?? null);
      db.prepare(`INSERT INTO formas_ganho (id, campaignId, criadoEm, ${fgCols.map(c => `"${c}"`).join(", ")}) VALUES (?, ?, ?, ${fgCols.map(() => "?").join(", ")})`).run(fgId, novoId, cr, ...vals);
    }

    const materiais = db.prepare("SELECT * FROM materiais_campanhas WHERE campaignId = ?").all(original.id);
    for (const m of materiais) {
      db.prepare("INSERT OR IGNORE INTO materiais_campanhas (materialId, campaignId, vinculadoEm, categoria, obrigatoriedade, acaoVinculada, ordem, regraAcesso) VALUES (?,?,?,?,?,?,?,?)").run(m.materialId, novoId, cr, m.categoria, m.obrigatoriedade, m.acaoVinculada, m.ordem, m.regraAcesso);
    }

    registrarEventoCampanha({ companyId: original.companyId, campaignId: novoId, tipo: "CAMPAIGN_CREATED", actorId: req.user.id, actorRole: role, source: "USER", dados: { duplicadaDe: original.id } });
  })();

  res.json({ id: novoId });
});

// ── F1-017: Geração de ICP via IA ──────────────────────────────────────

router.post("/campaigns/:id/gerar-icp", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  const empresa = db.prepare("SELECT nome, segmento, produto, ticket, icp FROM companies WHERE id = ?").get(entityId);

  const base = gerarICPDeterministico(empresa || {}, campaign);
  if (!process.env.ANTHROPIC_API_KEY) return res.json(base);

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 30000 });
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: "Gere um perfil de cliente ideal (ICP) em JSON: {icp: string, estruturado: {segmento, porte, cargo_decisor, localizacao, ticket_minimo, necessidade, sinais_compra: string[], restricoes: string[]}}. Baseie-se nos dados fornecidos. Não invente dados que não existam.",
      messages: [{ role: "user", content: `Empresa: ${empresa?.nome || "—"}\nSegmento: ${empresa?.segmento || "—"}\nProduto: ${empresa?.produto || campaign.produto || "—"}\nTicket: ${empresa?.ticket || "—"}\nICP atual: ${empresa?.icp || "—"}\nCampanha: ${campaign.titulo || "—"}\nObjetivo: ${campaign.objetivo || "—"}\nPúblico: ${campaign.publico || "—"}\nRegião: ${campaign.regiao || "—"}` }],
    });
    const txt = resp.content.map(b => b.text || "").join("");
    const ia = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
    res.json({ ...ia, fonte: "externo" });
  } catch (err) {
    console.error("[icp] IA indisponível:", err.message);
    res.json(base);
  }
});

// ── F1-019: Recomendação de atividades remuneradas via IA ──────────────

router.post("/campaigns/:id/recomendar-atividades", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

  const base = recomendarAtividadesDeterministico(campaign);
  if (!process.env.ANTHROPIC_API_KEY) return res.json(base);

  try {
    const empresa = db.prepare("SELECT nome, produto, ticket FROM companies WHERE id = ?").get(entityId);
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 30000 });
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: "Recomende atividades remuneradas para uma campanha comercial. JSON: {atividades: [{nome, descricao, tipoRemuneracao: 'fixo'|'comissao', valorSugerido: number, eventoComercial, evidenciasNecessarias: string[], metodoAprovacao: 'manual'|'automatico'}]}. Máx 5. Valores realistas.",
      messages: [{ role: "user", content: `Empresa: ${empresa?.nome || "—"}\nProduto: ${empresa?.produto || "—"}\nTicket: ${empresa?.ticket || "—"}\nObjetivo: ${campaign.objetivo || "vendas"}\nFunção: ${campaign.funcao || "SDR"}` }],
    });
    const txt = resp.content.map(b => b.text || "").join("");
    const ia = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
    if (Array.isArray(ia.atividades)) return res.json({ atividades: ia.atividades.slice(0, 5), fonte: "externo" });
    res.json(base);
  } catch {
    res.json(base);
  }
});

// ── F1-020: Recomendação de comprovações via IA ────────────────────────

router.post("/campaigns/:id/recomendar-comprovacoes", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

  const formas = db.prepare("SELECT * FROM formas_ganho WHERE campaignId = ?").all(campaign.id);
  const base = recomendarComprovacoesDeterministico(formas);
  if (!process.env.ANTHROPIC_API_KEY) return res.json(base);

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 30000 });
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: "Recomende tipos de comprovação para atividades comerciais. JSON: {comprovacoes: [{atividade, evidencias: [{tipo, descricao, obrigatoria: boolean}]}]}. Máx 5.",
      messages: [{ role: "user", content: `Objetivo: ${campaign.objetivo || "vendas"}\nAtividades: ${formas.map(f => f.nome).join(", ") || "—"}\nFunção: ${campaign.funcao || "SDR"}` }],
    });
    const txt = resp.content.map(b => b.text || "").join("");
    const ia = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
    if (Array.isArray(ia.comprovacoes)) return res.json({ comprovacoes: ia.comprovacoes.slice(0, 5), fonte: "externo" });
    res.json(base);
  } catch {
    res.json(base);
  }
});

// ── F3: Análise Rico pós-publicação ─────────────────────────────────────

router.get("/campaigns/:id/analise-rico", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

  const cid = campaign.id;
  const totalLeads = db.prepare("SELECT COUNT(*) n FROM campaign_leads WHERE campaignId = ?").get(cid).n;
  const disponiveis = db.prepare("SELECT COUNT(*) n FROM campaign_leads WHERE campaignId = ? AND status = 'disponivel'").get(cid).n;
  const trabalhados = totalLeads - disponiveis;
  const qualificados = db.prepare("SELECT COUNT(*) n FROM leads WHERE campaignId = ? AND qualificacaoClassificacao IN ('alta','media')").get(cid).n;
  const reunioes = db.prepare("SELECT COUNT(*) n FROM campaign_reunioes WHERE campaignId = ? AND status IN ('agendada','confirmada','realizada','venda')").get(cid).n;
  const vendas = db.prepare("SELECT COUNT(*) n FROM campaign_reunioes WHERE campaignId = ? AND status = 'venda'").get(cid).n;
  const profissionais = db.prepare("SELECT COUNT(*) n FROM campaign_applications WHERE campaignId = ? AND status = 'aprovado'").get(cid).n;
  const gasto = db.prepare("SELECT COALESCE(SUM(ABS(valor)), 0) t FROM financial_ledger WHERE companyId = ? AND tipo = 'liquidacao' AND submissionId IN (SELECT id FROM submissions WHERE campaignId = ?)").get(campaign.companyId, cid).t;
  const orcamento = Number(campaign.orcamento) || 0;
  const diasDecorridos = Math.max(1, Math.ceil((Date.now() - (Number(campaign.criadoEm) || Date.now())) / (1000 * 60 * 60 * 24)));
  const duracaoDias = Number(campaign.duracaoDias) || 30;
  const diasRestantes = Math.max(0, duracaoDias - diasDecorridos);

  const analises = [];
  const acoes = [];

  if (totalLeads === 0) {
    analises.push({ tipo: "gargalo", texto: "A campanha não possui contatos. Sem contatos, não há como gerar resultados." });
    acoes.push("Adicione contatos à campanha: importe uma lista ou selecione da base existente.");
  } else if (disponiveis === 0 && trabalhados > 0) {
    analises.push({ tipo: "gargalo", texto: `Todos os ${totalLeads} contatos já foram distribuídos. Se não houver mais, o ritmo vai cair.` });
    acoes.push("Adicione mais contatos para manter o ritmo de trabalho.");
  }

  if (profissionais === 0) {
    analises.push({ tipo: "gargalo", texto: "Nenhum profissional aprovado. A campanha precisa de profissionais ativos." });
    acoes.push("Aprove candidaturas ou convide profissionais.");
  }

  if (trabalhados >= 10) {
    const taxaQ = qualificados / trabalhados;
    if (taxaQ < 0.1) {
      analises.push({ tipo: "gargalo", texto: `Apenas ${Math.round(taxaQ * 100)}% dos contatos foram qualificados. A taxa esperada é acima de 20%.` });
      acoes.push("Revise o perfil dos contatos ou ajuste os critérios de qualificação.");
    } else if (taxaQ > 0.5) {
      analises.push({ tipo: "positivo", texto: `${Math.round(taxaQ * 100)}% de qualificação é excelente.` });
    }
  }

  if (qualificados >= 5 && reunioes === 0) {
    analises.push({ tipo: "gargalo", texto: `Há ${qualificados} leads qualificados, mas nenhuma reunião agendada.` });
    acoes.push("Verifique se os profissionais estão agendando reuniões.");
  }

  if (orcamento > 0 && gasto > 0) {
    const ritmoGasto = gasto / diasDecorridos;
    const diasAteEsgotamento = ritmoGasto > 0 ? Math.ceil((orcamento - gasto) / ritmoGasto) : duracaoDias;
    if (diasAteEsgotamento < diasRestantes) {
      analises.push({ tipo: "atencao", texto: `A verba será consumida em ~${diasAteEsgotamento} dias, antes do fim planejado.` });
      acoes.push("Avalie adicionar mais verba ou reduzir o ritmo de atividades.");
    }
  }

  const resumo = { diasDecorridos, diasRestantes, totalLeads, trabalhados, qualificados, reunioes, vendas, profissionais, orcamento, gasto };

  if (process.env.ANTHROPIC_API_KEY && trabalhados >= 5) {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 30000 });
      const resp = await client.messages.create({
        model: "claude-haiku-4-5-20251001", max_tokens: 500,
        system: "Analise métricas de campanha comercial. Identifique o principal gargalo e sugira UMA ação concreta. JSON: {analise: string, acao: string}. Não invente dados.",
        messages: [{ role: "user", content: JSON.stringify(resumo) }],
      });
      const txt = resp.content.map(b => b.text || "").join("");
      const ia = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
      if (ia.analise) analises.push({ tipo: "ia", texto: ia.analise });
      if (ia.acao) acoes.push(ia.acao);
    } catch { /* IA indisponível */ }
  }

  res.json({ resumo, analises, acoes, fonte: analises.some(a => a.tipo === "ia") ? "ia+dados" : "dados" });
});

// ── F1: Importar contatos da Loja de Leads para campanha ─────────────
router.post("/campaigns/:id/importar-loja-leads", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

  const { listaId, leadIds } = req.body;
  if (!listaId && !Array.isArray(leadIds)) return res.status(400).json({ error: "Informe listaId ou leadIds" });

  let ids = [];
  if (listaId) {
    const itens = db.prepare("SELECT contatoId FROM lista_contatos WHERE listaId = ? AND listaId IN (SELECT id FROM listas WHERE entityId = ?)").all(listaId, entityId);
    const contatoIds = itens.map(i => i.contatoId);
    if (contatoIds.length === 0) return res.json({ inseridos: 0 });
    const placeholders = contatoIds.map(() => "?").join(",");
    const leads = db.prepare(`SELECT id FROM leads WHERE companyId = ? AND id IN (${placeholders})`).all(campaign.companyId, ...contatoIds);
    const leadsFromContatos = db.prepare(`SELECT l.id FROM leads l JOIN contatos c ON c.id = l.contatoId WHERE l.companyId = ? AND c.id IN (${placeholders})`).all(campaign.companyId, ...contatoIds);
    ids = [...new Set([...leads.map(l => l.id), ...leadsFromContatos.map(l => l.id)])];
  } else {
    const placeholders = leadIds.map(() => "?").join(",");
    const valid = db.prepare(`SELECT id FROM leads WHERE companyId = ? AND id IN (${placeholders})`).all(campaign.companyId, ...leadIds);
    ids = valid.map(l => l.id);
  }

  let inseridos = 0;
  db.transaction(() => {
    const ins = db.prepare("INSERT OR IGNORE INTO campaign_leads (id, campaignId, leadId, status, criadoEm) VALUES (?, ?, ?, 'disponivel', ?)");
    for (const lid of ids) { ins.run(uid(), campaign.id, lid, agora()); inseridos++; }
  })();
  registrarEventoCampanha({ companyId: campaign.companyId, campaignId: campaign.id, tipo: "LEAD_CREATED", actorId: req.user.id, actorRole: "empresa", source: "USER", dados: { fonte: "loja_leads", inseridos, listaId: listaId || null } });
  res.json({ ok: true, inseridos });
});

// ── F1: Importar leads do Meta Ads para campanha ─────────────────────
router.post("/campaigns/:id/importar-meta-leads", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

  const { formId, limite = 100 } = req.body;
  const conexao = db.prepare("SELECT accessToken, whatsappId FROM meta_connections WHERE companyId = ? AND ativo = 1").get(entityId);
  if (!conexao) return res.status(422).json({ error: "Meta Ads não conectado. Configure a integração na seção Integrações.", acao: "conectar_meta" });

  try {
    const url = formId
      ? `https://graph.facebook.com/v19.0/${formId}/leads?limit=${Math.min(500, Number(limite))}&access_token=${conexao.accessToken}`
      : `https://graph.facebook.com/v19.0/${conexao.whatsappId}/lead_gen_forms?limit=5&access_token=${conexao.accessToken}`;
    const resp = await fetch(url);
    if (!resp.ok) return res.status(502).json({ error: "Falha ao buscar leads do Meta Ads" });
    const data = await resp.json();

    const metaLeads = formId ? (data.data || []) : [];
    if (!formId) {
      const forms = data.data || [];
      return res.json({ forms: forms.map(f => ({ id: f.id, name: f.name, status: f.status })), total: forms.length });
    }

    let inseridos = 0;
    db.transaction(() => {
      for (const ml of metaLeads.slice(0, 500)) {
        const campos = {};
        for (const f of (ml.field_data || [])) campos[f.name] = f.values?.[0] || "";
        const nome = campos.full_name || campos.nome || `${campos.first_name || ""} ${campos.last_name || ""}`.trim() || "Lead Meta";
        const email = campos.email || "";
        const telefone = campos.phone_number || campos.telefone || "";

        const existente = db.prepare("SELECT id FROM leads WHERE companyId = ? AND (email = ? OR telefone = ?) AND email != '' AND telefone != ''").get(campaign.companyId, email, telefone);
        let leadId;
        if (existente) {
          leadId = existente.id;
        } else {
          leadId = uid();
          db.prepare("INSERT INTO leads (id, companyId, campaignId, nome, email, telefone, origem, etapa, criadoEm) VALUES (?,?,?,?,?,?,?,?,?)")
            .run(leadId, campaign.companyId, campaign.id, nome.slice(0, 200), email.slice(0, 200), telefone.slice(0, 30), "meta_ads", "novo", agora());
        }
        const r = db.prepare("INSERT OR IGNORE INTO campaign_leads (id, campaignId, leadId, status, criadoEm) VALUES (?, ?, ?, 'disponivel', ?)").run(uid(), campaign.id, leadId, agora());
        if (r.changes > 0) inseridos++;
      }
    })();
    registrarEventoCampanha({ companyId: campaign.companyId, campaignId: campaign.id, tipo: "LEAD_CREATED", actorId: req.user.id, actorRole: "empresa", source: "USER", dados: { fonte: "meta_ads", inseridos, formId } });
    res.json({ ok: true, inseridos, totalMeta: metaLeads.length });
  } catch (err) {
    console.error("[meta-leads]", err.message);
    res.status(502).json({ error: "Erro ao importar leads do Meta Ads" });
  }
});

// ── F1: Rico gerar perguntas de qualificação comercial ───────────────
router.post("/campaigns/:id/gerar-qualificacao-comercial", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ? AND companyId = ?").get(req.params.id, entityId);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  const empresa = db.prepare("SELECT nome, segmento, produto, ticket, icp FROM companies WHERE id = ?").get(entityId);

  const objetivo = campaign.objetivo || "vendas";
  const perguntas = [
    criarPergunta({ texto: "O contato demonstrou interesse no produto/serviço?", tipo: "sim_nao", obrigatoria: true, ordem: 1, categoria: "qualificacao" }),
    criarPergunta({ texto: "Qual o cargo ou função do contato na empresa?", tipo: "texto_curto", ordem: 2, categoria: "qualificacao" }),
    criarPergunta({ texto: "O contato tem poder de decisão de compra?", tipo: "escolha_unica", opcoes: ["Sim, decide sozinho", "Precisa consultar", "Não tem poder de decisão"], ordem: 3, categoria: "qualificacao",
      condicional: { dependeDe: null, condicao: null } }),
    criarPergunta({ texto: "Qual o orçamento disponível para este tipo de solução?", tipo: "valor_monetario", ordem: 4, categoria: "qualificacao",
      condicional: { dependeDe: 0, condicao: "igual", valor: "sim" } }),
    criarPergunta({ texto: "Qual a urgência para resolver o problema?", tipo: "escala", ordem: 5, categoria: "qualificacao",
      condicional: { dependeDe: 0, condicao: "igual", valor: "sim" } }),
  ];

  if (["reunioes", "prospeccao"].includes(objetivo)) {
    perguntas.push(criarPergunta({ texto: "O contato confirmou disponibilidade para reunião?", tipo: "sim_nao", ordem: 6, categoria: "qualificacao",
      condicional: { dependeDe: 2, condicao: "diferente", valor: "Não tem poder de decisão" } }));
  }
  if (objetivo === "reativacao") {
    perguntas.push(criarPergunta({ texto: "Há quanto tempo não há contato com a empresa?", tipo: "escolha_unica", opcoes: ["Menos de 3 meses", "3 a 6 meses", "6 a 12 meses", "Mais de 1 ano"], ordem: 6, categoria: "qualificacao" }));
  }

  const criterios = perguntas.map(p => criarCriterio({ perguntaId: p.id, condicao: p.tipo === "sim_nao" ? "sim" : "nao_vazio", peso: p.obrigatoria ? 2 : 1, obrigatoria: p.obrigatoria }));

  if (req.body.aplicar) {
    db.prepare("UPDATE campaigns SET qualificacaoCriterios = ?, qualificacaoPerguntas = ? WHERE id = ?")
      .run(JSON.stringify(criterios), JSON.stringify(perguntas), campaign.id);
  }

  res.json({ perguntas, criterios, fonte: "interno", categoria: "qualificacao_comercial" });
});

// ── F2: Questionário com perguntas condicionais ──────────────────────
router.post("/campaigns/:id/quiz-condicional", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const { entityId } = req.user;
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

  const questoes = JSON.parse(campaign.qualificacaoPerguntas || campaign.quiz || "[]");
  if (!questoes.length) return res.status(422).json({ error: "Nenhuma pergunta configurada" });

  const { respostas = {}, leadId } = req.body;
  if (!leadId) return res.status(400).json({ error: "leadId obrigatório" });

  const lead = db.prepare("SELECT id FROM campaign_leads WHERE campaignId = ? AND leadId = ? AND sellerId = ?").get(campaign.id, leadId, entityId);
  if (!lead) return res.status(403).json({ error: "Lead não atribuído a este profissional" });

  const visiveisIds = [];
  const respostasValidadas = {};
  for (let i = 0; i < questoes.length; i++) {
    const q = questoes[i];
    const cond = q.condicional;
    if (cond && cond.dependeDe != null && cond.condicao) {
      const respPai = respostas[String(cond.dependeDe)];
      const passa = cond.condicao === "igual" ? String(respPai).toLowerCase() === String(cond.valor).toLowerCase()
        : cond.condicao === "diferente" ? String(respPai).toLowerCase() !== String(cond.valor).toLowerCase()
        : cond.condicao === "nao_vazio" ? !!respPai
        : true;
      if (!passa) continue;
    }
    visiveisIds.push(i);
    if (respostas[String(i)] !== undefined) respostasValidadas[String(i)] = respostas[String(i)];
  }

  const obrigatoriasFaltando = visiveisIds.filter(i => questoes[i].obrigatoria && respostasValidadas[String(i)] === undefined);
  if (obrigatoriasFaltando.length > 0) return res.status(400).json({ error: "Perguntas obrigatórias não respondidas", faltando: obrigatoriasFaltando });

  const criterios = JSON.parse(campaign.qualificacaoCriterios || "[]");
  let score = 0, maxScore = 0;
  for (const c of criterios) {
    maxScore += (c.peso || 1);
    const idx = questoes.findIndex(q => q.id === c.perguntaId);
    if (idx < 0) continue;
    const resp = respostasValidadas[String(idx)];
    if (!resp) continue;
    const passa = c.condicao === "sim" ? String(resp).toLowerCase() === "sim"
      : c.condicao === "nao_vazio" ? !!resp
      : c.condicao === "igual" ? String(resp) === String(c.respostaEsperada)
      : !!resp;
    if (passa) score += (c.peso || 1);
  }
  const scoreNorm = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const classificacao = scoreNorm >= 70 ? "alta" : scoreNorm >= 40 ? "media" : scoreNorm > 0 ? "baixa" : "desqualificado";

  db.prepare("UPDATE leads SET qualificacaoScore = ?, qualificacaoClassificacao = ?, qualificacaoRespostas = ?, qualificacaoEm = ? WHERE id = ?")
    .run(scoreNorm, classificacao, JSON.stringify(respostasValidadas), agora(), leadId);

  res.json({ score: scoreNorm, classificacao, visiveisIds, respostasValidadas });
});

// ── F2: Histórico WhatsApp vinculado ao lead da campanha ─────────────
router.get("/campaigns/:id/leads/:leadId/whatsapp", (req, res) => {
  const { role, entityId } = req.user;
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== camp.companyId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor") {
    const vinc = db.prepare("SELECT 1 FROM campaign_leads WHERE campaignId = ? AND leadId = ? AND sellerId = ?").get(camp.id, req.params.leadId, entityId);
    if (!vinc) return res.status(403).json({ error: "Lead não atribuído" });
  }

  const lead = db.prepare("SELECT id, telefone, whatsapp FROM leads WHERE id = ? AND companyId = ?").get(req.params.leadId, camp.companyId);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
  const numero = lead.whatsapp || lead.telefone;
  if (!numero) return res.json({ mensagens: [], numero: null });

  const mensagens = db.prepare(`SELECT * FROM mensagens WHERE (remetente = ? OR destinatario = ?) AND companyId = ? ORDER BY criadoEm DESC LIMIT 100`)
    .all(numero, numero, camp.companyId);
  res.json({ mensagens, numero, leadId: lead.id, campaignId: camp.id });
});

// ── F2: Notificações de agendamento (email/WhatsApp) ─────────────────
async function notificarAgendamento({ campaign, reuniao, tipo, actorRole }) {
  const lead = reuniao.leadId ? db.prepare("SELECT nome, email, telefone, whatsapp FROM leads WHERE id = ?").get(reuniao.leadId) : null;
  const closer = db.prepare("SELECT nome, email FROM sellers WHERE id = ?").get(reuniao.sellerCloserId);
  const labels = { agendada: "Nova reunião agendada", reagendada: "Reunião reagendada", cancelada: "Reunião cancelada" };
  const titulo = labels[tipo] || "Atualização de reunião";
  const texto = `${titulo}: ${reuniao.data} ${reuniao.horaInicio}-${reuniao.horaFim}${lead ? ` com ${lead.nome}` : ""}`;

  const closerUser = closer ? db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(reuniao.sellerCloserId) : null;
  if (closerUser) {
    db.prepare("INSERT INTO notificacoes (id, userId, tipo, titulo, mensagem, criadoEm) VALUES (?,?,?,?,?,?)")
      .run(uid(), closerUser.id, "reuniao", titulo, texto, agora());
  }
  if (reuniao.sellerSdrId && reuniao.sellerSdrId !== reuniao.sellerCloserId) {
    const sdrUser = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(reuniao.sellerSdrId);
    if (sdrUser) db.prepare("INSERT INTO notificacoes (id, userId, tipo, titulo, mensagem, criadoEm) VALUES (?,?,?,?,?,?)").run(uid(), sdrUser.id, "reuniao", titulo, texto, agora());
  }

  if (lead?.email && tipo !== "cancelada") {
    try {
      const { sendEmail } = await import("../services/email.js");
      await sendEmail(lead.email, titulo, `<p>${texto}</p><p>Campanha: ${campaign.titulo || campaign.id}</p>`);
    } catch (e) { console.warn("[notif-agenda] email:", e.message); }
  }
  if (lead?.whatsapp || lead?.telefone) {
    try {
      const { envioConfigurado, enviarTexto, numeroWhatsapp } = await import("../services/whatsappDisparo.js");
      if (envioConfigurado()) {
        const num = numeroWhatsapp(lead.whatsapp || lead.telefone);
        if (num) await enviarTexto({ numero: num, texto, origem: "notificacao_reuniao" });
      }
    } catch (e) { console.warn("[notif-agenda] whatsapp:", e.message); }
  }
}

// ── F2: Concluir atividade → auditoria → crédito ────────────────────
router.post("/campaigns/:id/atividades/:atividadeId/concluir", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const camp = db.prepare("SELECT id, companyId FROM campaigns WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Campanha não encontrada" });
  const aprovado = db.prepare("SELECT 1 FROM campaign_applications WHERE campaignId = ? AND sellerId = ? AND status = 'aprovado'").get(camp.id, entityId);
  if (!aprovado) return res.status(403).json({ error: "Profissional não aprovado" });

  const fg = db.prepare("SELECT * FROM formas_ganho WHERE id = ? AND campaignId = ?").get(req.params.atividadeId, camp.id);
  if (!fg) return res.status(404).json({ error: "Atividade não encontrada" });

  const { leadId, evidencias = [] } = req.body;
  const idempotencyKey = `camp:${camp.id}:${fg.id}:${entityId}:${leadId || "sem"}`;

  const existente = db.prepare("SELECT id FROM submissions WHERE idempotencyKey = ? AND sellerId = ?").get(idempotencyKey, entityId);
  if (existente) return res.status(409).json({ error: "Atividade já concluída para este lead", submissionId: existente.id });

  const valor = Number(fg.valor) || 0;
  if (valor <= 0) return res.status(422).json({ error: "Atividade sem valor definido" });

  try {
    const result = db.transaction(() => {
      const subId = uid();
      db.prepare(`INSERT INTO submissions (id, sellerId, companyId, campaignId, tipo, valor, status, leadId, idempotencyKey, criadoEm, evidencias) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(subId, entityId, camp.companyId, camp.id, fg.eventoComercial || fg.nome, valor, fg.metodoAprovacao === "automatica" ? "ia_aprovado" : "pendente", leadId || null, idempotencyKey, agora(), JSON.stringify(evidencias));

      const posicao = posicaoEmpresa(camp.companyId);
      if (posicao && posicao.disponivel >= valor) {
        db.prepare("UPDATE companies SET saldoReservado = saldoReservado + ? WHERE id = ?").run(valor, camp.companyId);
        const ciclo = db.prepare("SELECT COUNT(*) n FROM financial_ledger WHERE submissionId = ? AND tipo = 'reserva'").get(subId).n + 1;
        db.prepare(`INSERT OR IGNORE INTO financial_ledger (id, companyId, sellerId, submissionId, tipo, valor, saldoEmpresa, reservadoEmpresa, saldoProfissional, idempotencyKey, dados, criadoEm) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(uid(), camp.companyId, entityId, subId, "reserva", valor, posicao.saldo, posicao.reservado + valor, null, `${subId}:${ciclo}`, JSON.stringify({}), agora());
      }

      registrarEventoCampanha({ companyId: camp.companyId, campaignId: camp.id, tipo: "TASK_COMPLETED", actorId: entityId, actorRole: "profissional", sellerId: entityId, submissionId: subId, leadId, source: "USER", dados: { atividadeId: fg.id, tipo: fg.eventoComercial, valor } });
      return { submissionId: subId, status: fg.metodoAprovacao === "automatica" ? "ia_aprovado" : "pendente" };
    }).immediate();
    res.json(result);
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// ── F2: SMS desabilitado (sem provider configurado) ──────────────────
router.get("/campaigns/canais-disponiveis", (req, res) => {
  const canais = [
    { id: "whatsapp", nome: "WhatsApp", disponivel: true },
    { id: "email", nome: "E-mail", disponivel: true },
    { id: "sms", nome: "SMS", disponivel: false, motivo: "Provider SMS não configurado. Canal desabilitado." },
  ];
  res.json({ canais });
});

// ── F3: Desempenho individual por profissional ──────────────────────
router.get("/campaigns/:id/desempenho-profissionais", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa" && role !== "admin") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });

  const cid = campaign.id;
  const profissionais = db.prepare(`
    SELECT ca.sellerId, s.nome, s.perfil, s.nota, ca.criadoEm as entradaEm
    FROM campaign_applications ca JOIN sellers s ON s.id = ca.sellerId
    WHERE ca.campaignId = ? AND ca.status = 'aprovado'
  `).all(cid);

  const result = profissionais.map(p => {
    const subs = db.prepare("SELECT tipo, status, valor, liquido, criadoEm FROM submissions WHERE campaignId = ? AND sellerId = ?").all(cid, p.sellerId);
    const aprovadas = subs.filter(s => s.status === "liberado" || s.status === "ia_aprovado" || s.status === "conferido");
    const recusadas = subs.filter(s => s.status === "recusado" || s.status === "ia_recusado");
    const pendentes = subs.filter(s => s.status === "pendente" || s.status === "revisao");
    const totalBruto = aprovadas.reduce((s, t) => s + (Number(t.valor) || 0), 0);
    const totalLiquido = aprovadas.reduce((s, t) => s + (Number(t.liquido) || Number(t.valor) || 0), 0);

    const reunioesAgendadas = db.prepare("SELECT COUNT(*) n FROM campaign_reunioes WHERE campaignId = ? AND (sellerSdrId = ? OR sellerCloserId = ?)").get(cid, p.sellerId, p.sellerId).n;
    const reunioesRealizadas = db.prepare("SELECT COUNT(*) n FROM campaign_reunioes WHERE campaignId = ? AND (sellerSdrId = ? OR sellerCloserId = ?) AND status IN ('realizada','venda')").get(cid, p.sellerId, p.sellerId).n;
    const vendas = db.prepare("SELECT COUNT(*) n FROM campaign_reunioes WHERE campaignId = ? AND sellerCloserId = ? AND status = 'venda'").get(cid, p.sellerId).n;
    const leadsAtribuidos = db.prepare("SELECT COUNT(*) n FROM campaign_leads WHERE campaignId = ? AND sellerId = ?").get(cid, p.sellerId).n;
    const leadsConvertidos = db.prepare("SELECT COUNT(*) n FROM campaign_leads WHERE campaignId = ? AND sellerId = ? AND status = 'concluido'").get(cid, p.sellerId).n;

    const porTipo = {};
    for (const s of subs) { porTipo[s.tipo] = (porTipo[s.tipo] || 0) + 1; }

    const taxaAprovacao = subs.length > 0 ? Math.round((aprovadas.length / subs.length) * 100) : 0;
    const taxaConversao = leadsAtribuidos > 0 ? Math.round((leadsConvertidos / leadsAtribuidos) * 100) : 0;

    return {
      sellerId: p.sellerId, nome: p.nome, funcao: p.perfil, nota: p.nota, entradaEm: p.entradaEm,
      tarefas: { total: subs.length, aprovadas: aprovadas.length, recusadas: recusadas.length, pendentes: pendentes.length, porTipo },
      financeiro: { bruto: Math.round(totalBruto * 100) / 100, liquido: Math.round(totalLiquido * 100) / 100 },
      reunioes: { agendadas: reunioesAgendadas, realizadas: reunioesRealizadas, vendas },
      leads: { atribuidos: leadsAtribuidos, convertidos: leadsConvertidos },
      indicadores: { taxaAprovacao, taxaConversao, ticketMedio: aprovadas.length > 0 ? Math.round((totalBruto / aprovadas.length) * 100) / 100 : 0 },
    };
  }).sort((a, b) => b.tarefas.aprovadas - a.tarefas.aprovadas);

  res.json({ profissionais: result });
});

// ── F3: Financeiro detalhado por atividade, profissional e função ────
router.get("/campaigns/:id/financeiro-detalhado", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "empresa" && role !== "admin") return res.status(403).json({ error: "Apenas empresa" });
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
  if (role === "empresa" && entityId !== campaign.companyId) return res.status(403).json({ error: "Sem permissão" });

  const cid = campaign.id;

  const porAtividade = db.prepare(`
    SELECT s.tipo, COUNT(*) as quantidade, SUM(s.valor) as bruto, SUM(COALESCE(s.liquido, s.valor)) as liquido
    FROM submissions s WHERE s.campaignId = ? AND s.status = 'liberado'
    GROUP BY s.tipo
  `).all(cid).map(r => ({ tipo: r.tipo, quantidade: r.quantidade, bruto: Math.round((r.bruto || 0) * 100) / 100, liquido: Math.round((r.liquido || 0) * 100) / 100 }));

  const porProfissional = db.prepare(`
    SELECT s.sellerId, sl.nome, sl.perfil as funcao,
      COUNT(*) as quantidade, SUM(s.valor) as bruto, SUM(COALESCE(s.liquido, s.valor)) as liquido
    FROM submissions s JOIN sellers sl ON sl.id = s.sellerId
    WHERE s.campaignId = ? AND s.status = 'liberado'
    GROUP BY s.sellerId
  `).all(cid).map(r => ({ sellerId: r.sellerId, nome: r.nome, funcao: r.funcao, quantidade: r.quantidade, bruto: Math.round((r.bruto || 0) * 100) / 100, liquido: Math.round((r.liquido || 0) * 100) / 100 }));

  const porFuncao = db.prepare(`
    SELECT sl.perfil as funcao, COUNT(*) as quantidade, SUM(s.valor) as bruto, SUM(COALESCE(s.liquido, s.valor)) as liquido
    FROM submissions s JOIN sellers sl ON sl.id = s.sellerId
    WHERE s.campaignId = ? AND s.status = 'liberado'
    GROUP BY sl.perfil
  `).all(cid).map(r => ({ funcao: r.funcao, quantidade: r.quantidade, bruto: Math.round((r.bruto || 0) * 100) / 100, liquido: Math.round((r.liquido || 0) * 100) / 100 }));

  const movimentacoes = db.prepare(`
    SELECT fl.tipo, fl.valor, fl.criadoEm, fl.dados
    FROM financial_ledger fl
    WHERE fl.companyId = ? AND (fl.dados LIKE ? OR fl.submissionId IN (SELECT id FROM submissions WHERE campaignId = ?))
    ORDER BY fl.criadoEm DESC LIMIT 200
  `).all(campaign.companyId, `%"campaignId":"${cid}"%`, cid).map(r => ({ ...r, dados: JSON.parse(r.dados || "{}") }));

  const orcamento = Number(campaign.orcamento) || 0;
  const totalBruto = porAtividade.reduce((s, r) => s + r.bruto, 0);
  const totalLiquido = porAtividade.reduce((s, r) => s + r.liquido, 0);

  res.json({ orcamento, totalBruto: Math.round(totalBruto * 100) / 100, totalLiquido: Math.round(totalLiquido * 100) / 100, porAtividade, porProfissional, porFuncao, movimentacoes });
});

export default router;

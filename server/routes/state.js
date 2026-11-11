import { Router } from "express";
import db from "../db.js";
import { BETA_DEFAULT_BALANCE, ajustarSaldoBeta, isBetaEnvironment, resetBetaEnvironment } from "../services/betaEnvironment.js";

const router = Router();

const lista = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };

function parseSeller(row) {
  return {
    ...row,
    respostas: lista(row.respostas),
    segmentos: lista(row.segmentos),
    modalidades: lista(row.modalidades),
    regioes: lista(row.regioes),
    skills: lista(row.skills),
  };
}

function parseCompany(row, preloadedDims) {
  return {
    ...row,
    scoreDimensions: preloadedDims || {},
    destaque: !!row.destaque,
    visivel: row.visivel == null ? true : !!row.visivel,
    comissoes: JSON.parse(row.comissoes || "{}"),
    curso: JSON.parse(row.curso || "[]"),
    qualificacao: JSON.parse(row.qualificacao || "{}"),
    materiais: JSON.parse(row.materiais || "[]"),
    aportes: JSON.parse(row.aportes || "[]"),
  };
}

function parseSub(row) {
  return { ...row, prova: JSON.parse(row.prova || "{}"), arquivos: JSON.parse(row.arquivos || "[]") };
}

function parseCampaign(row) {
  return {
    ...row,
    comissoes: JSON.parse(row.comissoes || "{}"),
    treinamento: JSON.parse(row.treinamento || "[]"),
    tarefas: JSON.parse(row.tarefas || "{}"),
    evidencias: JSON.parse(row.evidencias || "{}"),
    criteriosAprovacao: JSON.parse(row.criteriosAprovacao || "{}"),
    quiz: JSON.parse(row.quiz || "[]"),
    aceitaLeadProprio: !!row.aceitaLeadProprio,
    exigeCertificacao: !!row.exigeCertificacao,
  };
}

function buildSellersWithRelations(sellers) {
  const ids = sellers.map((s) => s.id);
  const usarFiltro = ids.length < 200 && ids.length > 0;

  const placeholders = usarFiltro ? ids.map(() => "?").join(",") : null;

  const apps = usarFiltro
    ? db.prepare(`SELECT * FROM applications WHERE sellerId IN (${placeholders})`).all(...ids)
    : db.prepare("SELECT * FROM applications").all();
  const progress = usarFiltro
    ? db.prepare(`SELECT * FROM course_progress WHERE sellerId IN (${placeholders})`).all(...ids)
    : db.prepare("SELECT * FROM course_progress").all();
  const scores = usarFiltro
    ? db.prepare(`SELECT * FROM score_dimensions WHERE sellerId IN (${placeholders})`).all(...ids)
    : db.prepare("SELECT * FROM score_dimensions").all();
  const certifications = usarFiltro
    ? db.prepare(`SELECT * FROM certifications WHERE sellerId IN (${placeholders})`).all(...ids)
    : db.prepare("SELECT * FROM certifications").all();
  const courseCertifications = usarFiltro
    ? db.prepare(`
        SELECT ce.sellerId, c.funcao, ce.percentual, ce.emitidoEm AS criadoEm, ce.codigo, c.titulo AS curso
        FROM course_certificates ce
        JOIN courses c ON c.id = ce.courseId
        WHERE c.funcao != '' AND ce.sellerId IN (${placeholders})
      `).all(...ids)
    : db.prepare(`
        SELECT ce.sellerId, c.funcao, ce.percentual, ce.emitidoEm AS criadoEm, ce.codigo, c.titulo AS curso
        FROM course_certificates ce
        JOIN courses c ON c.id = ce.courseId
        WHERE c.funcao != ''
      `).all();

  return sellers.map((s) => {
    const aplicacoes = {};
    apps.filter((a) => a.sellerId === s.id).forEach((a) => { aplicacoes[a.companyId] = a.status; });

    const curso = {};
    progress.filter((p) => p.sellerId === s.id).forEach((p) => {
      const val = JSON.parse(p.moduleIds || "[]");
      curso[p.companyId] = val;
    });

    const scoreDimensions = {};
    scores.filter((sc) => sc.sellerId === s.id).forEach((sc) => {
      if (!scoreDimensions[sc.role]) scoreDimensions[sc.role] = {};
      scoreDimensions[sc.role][sc.dimension] = sc.valor;
    });

    const aplicacoesDetalhe = {};
    apps.filter((a) => a.sellerId === s.id).forEach((a) => {
      aplicacoesDetalhe[a.companyId] = { status: a.status, criterios: JSON.parse(a.criterios || "[]"), quizScore: a.quizScore, mensagem: a.mensagem || "", criadoEm: a.criadoEm || null, campanhasAuto: a.campanhasAuto };
    });
    return {
      ...parseSeller(s), aplicacoes, aplicacoesDetalhe, curso, scoreDimensions,
      certificacoes: [
        ...certifications.filter((c) => c.sellerId === s.id),
        ...courseCertifications.filter((c) => c.sellerId === s.id).map((c) => ({ ...c, nivel: "course" })),
      ],
    };
  });
}

export function getFullState() {
  const sellers = buildSellersWithRelations(db.prepare("SELECT * FROM sellers").all());

  const allDims = db.prepare("SELECT companyId, dimension, valor FROM company_score_dimensions").all();
  const dimsByCompany = {};
  allDims.forEach((d) => {
    if (!dimsByCompany[d.companyId]) dimsByCompany[d.companyId] = {};
    dimsByCompany[d.companyId][d.dimension] = d.valor;
  });
  const companies = db.prepare("SELECT * FROM companies").all().map((row) => parseCompany(row, dimsByCompany[row.id]));
  const submissions = db.prepare("SELECT * FROM submissions ORDER BY criadoEm DESC").all().map(parseSub);
  const withdrawals = db.prepare("SELECT * FROM withdrawals ORDER BY criadoEm DESC").all();
  const messages = db.prepare("SELECT * FROM messages ORDER BY ts ASC").all();
  const campaigns = db.prepare("SELECT * FROM campaigns ORDER BY criadoEm DESC").all().map(parseCampaign);
  const leads = db.prepare("SELECT * FROM leads ORDER BY atualizadoEm DESC").all();
  const campaignApps = db.prepare("SELECT * FROM campaign_applications").all();

  campaigns.forEach((c) => {
    c.candidaturas = campaignApps.filter((a) => a.campaignId === c.id);
  });

  return { sellers, companies, submissions, withdrawals, messages, campaigns, leads };
}

// Queries diretas por papel — evita carregar o banco inteiro para filtrar em JS.

function getEmpresaState(entityId) {
  const meuId = entityId;

  const dims = db.prepare("SELECT dimension, valor FROM company_score_dimensions WHERE companyId = ?").all(meuId);
  const dimMap = {};
  dims.forEach((d) => { dimMap[d.dimension] = d.valor; });
  const companies = db.prepare("SELECT * FROM companies WHERE id = ?").all(meuId).map((row) => parseCompany(row, dimMap));

  const campaigns = db.prepare("SELECT * FROM campaigns WHERE companyId = ? ORDER BY criadoEm DESC").all(meuId).map(parseCampaign);
  const campIds = campaigns.map((c) => c.id);
  const campaignApps = campIds.length
    ? db.prepare(`SELECT * FROM campaign_applications WHERE campaignId IN (${campIds.map(() => "?").join(",")})`)
        .all(...campIds)
    : [];
  campaigns.forEach((c) => { c.candidaturas = campaignApps.filter((a) => a.campaignId === c.id); });

  const idsCandidatos = new Set(campaignApps.map((a) => a.sellerId));
  const apps = db.prepare("SELECT * FROM applications WHERE companyId = ?").all(meuId);
  apps.forEach((a) => idsCandidatos.add(a.sellerId));

  // Solicitações pendentes de profissionais (com mensagem e data)
  const solicitacoesPendentes = apps
    .filter((a) => a.status === "pendente")
    .map((a) => ({ sellerId: a.sellerId, mensagem: a.mensagem || "", criadoEm: a.criadoEm || null }));

  // inclui também sellers que têm mensagens com esta empresa
  const messages = db.prepare("SELECT * FROM messages WHERE companyId = ? ORDER BY ts ASC").all(meuId);
  messages.forEach((m) => { if (m.sellerId) idsCandidatos.add(m.sellerId); });

  const sellerIds = [...idsCandidatos];
  let sellers = [];
  if (sellerIds.length) {
    const raw = db.prepare(`SELECT * FROM sellers WHERE id IN (${sellerIds.map(() => "?").join(",")})`)
      .all(...sellerIds);
    sellers = buildSellersWithRelations(raw);
  }

  const submissions = db.prepare("SELECT * FROM submissions WHERE companyId = ? ORDER BY criadoEm DESC").all(meuId).map(parseSub);
  const leads = db.prepare("SELECT * FROM leads WHERE companyId = ? ORDER BY atualizadoEm DESC").all(meuId);

  const campanhasAutoDefault = companies[0]?.campanhasAutoDefault ?? 0;

  return { sellers, companies, submissions, withdrawals: [], messages, campaigns, leads, solicitacoesPendentes, campanhasAutoDefault: !!campanhasAutoDefault };
}

function getVendedorState(entityId) {
  const meuId = entityId;
  const rawSeller = db.prepare("SELECT * FROM sellers WHERE id = ?").all(meuId);
  const sellers = buildSellersWithRelations(rawSeller);
  const meuVendedor = sellers[0];
  const oportunidadesLiberadas = ["aprovado", "parcial"].includes(meuVendedor?.status);

  let companies = [];
  if (oportunidadesLiberadas) {
    const allDims = db.prepare("SELECT companyId, dimension, valor FROM company_score_dimensions").all();
    const dimsByCompany = {};
    allDims.forEach((d) => {
      if (!dimsByCompany[d.companyId]) dimsByCompany[d.companyId] = {};
      dimsByCompany[d.companyId][d.dimension] = d.valor;
    });
    companies = db.prepare("SELECT * FROM companies WHERE visivel = 1").all().map((row) => parseCompany(row, dimsByCompany[row.id])).map((c) => ({
      ...c,
      qualificacao: {
        ...c.qualificacao,
        questoes: (c.qualificacao?.questoes || []).map(({ correta, ...q }) => q),
      },
    }));
  }

  const submissions = db.prepare("SELECT * FROM submissions WHERE sellerId = ? ORDER BY criadoEm DESC").all(meuId).map(parseSub);
  const withdrawals = db.prepare("SELECT * FROM withdrawals WHERE sellerId = ? ORDER BY criadoEm DESC").all(meuId);
  const messages = db.prepare("SELECT * FROM messages WHERE sellerId = ? ORDER BY ts ASC").all(meuId);
  const leads = db.prepare("SELECT * FROM leads WHERE sellerId = ? ORDER BY atualizadoEm DESC").all(meuId);

  let campaigns = [];
  if (oportunidadesLiberadas) {
    // Esconde também as campanhas de empresas marcadas como invisíveis.
    campaigns = db.prepare("SELECT * FROM campaigns WHERE status = 'ativa' AND companyId IN (SELECT id FROM companies WHERE visivel = 1) ORDER BY criadoEm DESC").all().map(parseCampaign);
    const campIds = campaigns.map((c) => c.id);
    const campaignApps = campIds.length
      ? db.prepare(`SELECT * FROM campaign_applications WHERE campaignId IN (${campIds.map(() => "?").join(",")}) AND sellerId = ?`)
          .all(...campIds, meuId)
      : [];
    const tentativas = db.prepare(
      "SELECT campaignId, MAX(score) as score, MAX(aprovado) as aprovado FROM campaign_quiz_attempts WHERE sellerId = ? GROUP BY campaignId"
    ).all(meuId);
    const quizByCamp = {};
    tentativas.forEach((t) => { quizByCamp[t.campaignId] = t; });
    campaigns = campaigns.map((c) => {
      const melhor = quizByCamp[c.id];
      return {
        ...c,
        candidaturas: campaignApps.filter((a) => a.campaignId === c.id),
        quiz: c.quiz.map(({ correta, ...q }) => q),
        quizAprovado: melhor ? !!melhor.aprovado : false,
        quizScore: melhor?.score ?? null,
      };
    });
  }

  return { sellers, companies, submissions, withdrawals, messages, campaigns, leads };
}

function getFilteredState(user) {
  const { role, entityId } = user;

  try {
    if (role === "empresa") return getEmpresaState(entityId);
    if (role === "vendedor") return getVendedorState(entityId);
  } catch (err) {
    console.error(`[state] erro em get${role}State(${entityId}):`, err.message);
    return getFullState();
  }

  return getFullState();
}

router.get("/state", (req, res) => {
  const state = getFilteredState(req.user);
  const notifs = db.prepare("SELECT * FROM notifications WHERE userId = ? ORDER BY criadoEm DESC LIMIT 50").all(req.user.id);
  state.notifications = notifs;
  res.json(state);
});

router.post("/state/reset", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas admin pode resetar" });
  if (!isBetaEnvironment()) return res.status(403).json({ error: "Reset indisponível fora do ambiente Beta." });
  if (req.body?.confirmacao !== "RESETAR BETA") return res.status(400).json({ error: "Confirmação inválida." });
  try {
    resetBetaEnvironment();
    res.json({ ok: true, message: "Ambiente Beta restaurado para a base de QA." });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Não foi possível resetar o Beta." });
  }
});

router.post("/state/beta/balance", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas admin pode ajustar saldo Beta" });
  if (!isBetaEnvironment()) return res.status(403).json({ error: "Controle de saldo indisponível fora do ambiente Beta." });
  const acao = req.body?.acao;
  const mapa = {
    add_1000: { valor: 1000, modo: "add" },
    add_10000: { valor: 10000, modo: "add" },
    add_100000: { valor: 100000, modo: "add" },
    zerar: { valor: 0, modo: "set" },
    restaurar: { valor: BETA_DEFAULT_BALANCE, modo: "set" },
  };
  const ajuste = mapa[acao];
  if (!ajuste) return res.status(400).json({ error: "Ação Beta inválida." });
  try {
    const r = ajustarSaldoBeta({ ...ajuste, actorId: req.user.id });
    res.json({ ok: true, saldo: r.saldo, message: "SIMULAÇÃO: saldo Beta ajustado sem valor real." });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Não foi possível ajustar o saldo Beta." });
  }
});

export default router;

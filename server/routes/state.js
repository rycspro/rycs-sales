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
  const apps = db.prepare("SELECT * FROM applications").all();
  const progress = db.prepare("SELECT * FROM course_progress").all();
  const scores = db.prepare("SELECT * FROM score_dimensions").all();
  const certifications = db.prepare("SELECT * FROM certifications").all();
  const courseCertifications = db.prepare(`
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
      aplicacoesDetalhe[a.companyId] = { status: a.status, criterios: JSON.parse(a.criterios || "[]"), quizScore: a.quizScore };
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

function getFilteredState(user) {
  const full = getFullState();
  const { role, entityId } = user;

  if (role === "admin") return full;

  if (role === "vendedor") {
    const meuId = entityId;
    const meuVendedor = full.sellers.find((s) => s.id === meuId);
    const oportunidadesLiberadas = ["aprovado", "parcial"].includes(meuVendedor?.status);
    return {
      sellers: full.sellers.filter((s) => s.id === meuId),
      // A alternativa correta só existe no servidor. O vendedor recebe a
      // pergunta e as opções, nunca o gabarito embutido no cadastro da empresa.
      companies: oportunidadesLiberadas ? full.companies.map((c) => ({
        ...c,
        qualificacao: {
          ...c.qualificacao,
          questoes: (c.qualificacao?.questoes || []).map(({ correta, ...q }) => q),
        },
      })) : [],
      submissions: full.submissions.filter((s) => s.sellerId === meuId),
      withdrawals: full.withdrawals.filter((w) => w.sellerId === meuId),
      messages: full.messages.filter((m) => m.sellerId === meuId),
      campaigns: oportunidadesLiberadas ? (() => {
        const ativas = full.campaigns.filter((c) => c.status === "ativa");
        const tentativas = db.prepare(
          "SELECT campaignId, MAX(score) as score, MAX(aprovado) as aprovado FROM campaign_quiz_attempts WHERE sellerId = ? GROUP BY campaignId"
        ).all(meuId);
        const quizByCamp = {};
        tentativas.forEach((t) => { quizByCamp[t.campaignId] = t; });
        return ativas.map((c) => {
          const melhor = quizByCamp[c.id];
          return {
            ...c,
            candidaturas: c.candidaturas.filter((a) => a.sellerId === meuId),
            quiz: c.quiz.map(({ correta, ...q }) => q),
            quizAprovado: melhor ? !!melhor.aprovado : false,
            quizScore: melhor?.score ?? null,
          };
        });
      })() : [],
      leads: full.leads.filter((l) => l.sellerId === meuId),
    };
  }

  if (role === "empresa") {
    const meuId = entityId;
    const idsCandidatosCampanha = new Set(full.campaigns
      .filter((c) => c.companyId === meuId)
      .flatMap((c) => c.candidaturas.map((a) => a.sellerId)));
    const meusSellers = full.sellers.filter((s) => s.aplicacoes?.[meuId] || idsCandidatosCampanha.has(s.id));
    return {
      sellers: meusSellers,
      companies: full.companies.filter((c) => c.id === meuId),
      submissions: full.submissions.filter((s) => s.companyId === meuId),
      withdrawals: [],
      messages: full.messages.filter((m) => m.companyId === meuId),
      campaigns: full.campaigns.filter((c) => c.companyId === meuId),
      leads: full.leads.filter((l) => l.companyId === meuId),
    };
  }

  return full;
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

import { Router } from "express";
import db from "../db.js";

const router = Router();

function parseSeller(row) {
  return { ...row, respostas: JSON.parse(row.respostas || "[]") };
}

function parseCompany(row) {
  // Dimensões do Company Score viajam junto da empresa: o profissional
  // precisa dela na vitrine, antes de se candidatar.
  const dims = {};
  db.prepare("SELECT dimension, valor FROM company_score_dimensions WHERE companyId = ?").all(row.id)
    .forEach((d) => { dims[d.dimension] = d.valor; });
  return {
    ...row,
    scoreDimensions: dims,
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
    aceitaLeadProprio: !!row.aceitaLeadProprio,
    exigeCertificacao: !!row.exigeCertificacao,
  };
}

function buildSellersWithRelations(sellers) {
  const apps = db.prepare("SELECT * FROM applications").all();
  const progress = db.prepare("SELECT * FROM course_progress").all();
  const scores = db.prepare("SELECT * FROM score_dimensions").all();
  const certifications = db.prepare("SELECT * FROM certifications").all();

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
      certificacoes: certifications.filter((c) => c.sellerId === s.id),
    };
  });
}

export function getFullState() {
  const sellers = buildSellersWithRelations(db.prepare("SELECT * FROM sellers").all());
  const companies = db.prepare("SELECT * FROM companies").all().map(parseCompany);
  const submissions = db.prepare("SELECT * FROM submissions ORDER BY criadoEm DESC").all().map(parseSub);
  const withdrawals = db.prepare("SELECT * FROM withdrawals ORDER BY criadoEm DESC").all();
  const messages = db.prepare("SELECT * FROM messages ORDER BY ts ASC").all();
  const campaigns = db.prepare("SELECT * FROM campaigns ORDER BY criadoEm DESC").all().map(parseCampaign);
  const campaignApps = db.prepare("SELECT * FROM campaign_applications").all();

  campaigns.forEach((c) => {
    c.candidaturas = campaignApps.filter((a) => a.campaignId === c.id);
  });

  return { sellers, companies, submissions, withdrawals, messages, campaigns };
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
      campaigns: oportunidadesLiberadas ? full.campaigns.filter((c) => c.status === "ativa").map((c) => ({
        ...c,
        candidaturas: c.candidaturas.filter((a) => a.sellerId === meuId),
      })) : [],
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
  db.exec("DELETE FROM campaign_applications");
  db.exec("DELETE FROM campaigns");
  db.exec("DELETE FROM score_dimensions");
  db.exec("DELETE FROM uploads");
  db.exec("DELETE FROM messages");
  db.exec("DELETE FROM withdrawals");
  db.exec("DELETE FROM submissions");
  db.exec("DELETE FROM course_progress");
  db.exec("DELETE FROM applications");
  db.exec("DELETE FROM companies");
  db.exec("DELETE FROM sellers");
  res.json({ ok: true, message: "Banco limpo. Reinicie o servidor para popular novamente." });
});

export default router;

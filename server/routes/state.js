import { Router } from "express";
import db from "../db.js";

const router = Router();

function parseSeller(row) {
  return { ...row, respostas: JSON.parse(row.respostas || "[]") };
}

function parseCompany(row) {
  return {
    ...row,
    destaque: !!row.destaque,
    comissoes: JSON.parse(row.comissoes || "{}"),
    curso: JSON.parse(row.curso || "[]"),
    aportes: JSON.parse(row.aportes || "[]"),
  };
}

function parseSub(row) {
  return { ...row, prova: JSON.parse(row.prova || "{}") };
}

function buildSellersWithRelations(sellers) {
  const apps = db.prepare("SELECT * FROM applications").all();
  const progress = db.prepare("SELECT * FROM course_progress").all();

  return sellers.map((s) => {
    const aplicacoes = {};
    apps.filter((a) => a.sellerId === s.id).forEach((a) => { aplicacoes[a.companyId] = a.status; });

    const curso = {};
    progress.filter((p) => p.sellerId === s.id).forEach((p) => {
      const val = JSON.parse(p.moduleIds || "[]");
      curso[p.companyId] = val;
    });

    return { ...parseSeller(s), aplicacoes, curso };
  });
}

export function getFullState() {
  const sellers = buildSellersWithRelations(db.prepare("SELECT * FROM sellers").all());
  const companies = db.prepare("SELECT * FROM companies").all().map(parseCompany);
  const submissions = db.prepare("SELECT * FROM submissions ORDER BY criadoEm DESC").all().map(parseSub);
  const withdrawals = db.prepare("SELECT * FROM withdrawals ORDER BY criadoEm DESC").all();
  const messages = db.prepare("SELECT * FROM messages ORDER BY ts ASC").all();

  return { sellers, companies, submissions, withdrawals, messages };
}

function getFilteredState(user) {
  const full = getFullState();
  const { role, entityId } = user;

  if (role === "admin") return full;

  if (role === "vendedor") {
    const meuId = entityId;
    return {
      sellers: full.sellers.filter((s) => s.id === meuId),
      companies: full.companies,
      submissions: full.submissions.filter((s) => s.sellerId === meuId),
      withdrawals: full.withdrawals.filter((w) => w.sellerId === meuId),
      messages: full.messages.filter((m) => m.sellerId === meuId),
    };
  }

  if (role === "empresa") {
    const meuId = entityId;
    const meusSellers = full.sellers.filter((s) => s.aplicacoes?.[meuId]);
    return {
      sellers: meusSellers,
      companies: full.companies.filter((c) => c.id === meuId),
      submissions: full.submissions.filter((s) => s.companyId === meuId),
      withdrawals: [],
      messages: full.messages.filter((m) => m.companyId === meuId),
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

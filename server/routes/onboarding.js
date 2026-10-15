import { Router } from "express";
import db, { uid, agora } from "../db.js";
import {
  TRIAL_ONBOARDING_DIAS, MOTIVOS_CONVITE_ONBOARDING, estadoConviteOnboarding, conviteServeParaEmail,
  validadeConviteDias, normalizarWhatsapp,
} from "../../shared/onboarding.js";
import { hashToken, novoToken, obterOnboarding, concluir, serializar } from "../services/onboarding.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const conviteDoToken = (token) =>
  db.prepare("SELECT * FROM onboarding_convites WHERE tokenHash = ?").get(hashToken(token));

// ---------------------------------------------------------------------------
// Público: quem abre o link ainda não tem conta.
export const onboardingPublico = Router();

// Diz se o convite serve e para qual e-mail, sem consumi-lo. Revelar o e-mail
// só a quem tem o link é seguro: o link foi gerado para essa pessoa.
onboardingPublico.get("/onboarding/convites/:token", (req, res) => {
  const convite = conviteDoToken(req.params.token);
  const estado = estadoConviteOnboarding(convite);
  if (!estado.ok) return res.status(404).json({ ok: false, motivo: estado.motivo, error: MOTIVOS_CONVITE_ONBOARDING[estado.motivo] });
  res.json({ ok: true, email: convite.email, trialDias: convite.trialDias, expiraEm: convite.expiraEm });
});

// ---------------------------------------------------------------------------
// Autenticado.
const router = Router();

const soEmpresa = (req, res) => {
  if (req.user?.role !== "empresa" || !req.user.entityId) {
    res.status(403).json({ error: "Apenas empresas." });
    return false;
  }
  return true;
};

router.get("/onboarding", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const linha = obterOnboarding(req.user.entityId);
  if (!linha) return res.status(404).json({ error: "Empresa não encontrada." });
  res.json(serializar(linha));
});

// Etapa 1 para quem já tinha conta: falta só o WhatsApp, que é obrigatório.
router.post("/onboarding/acesso", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const whatsapp = normalizarWhatsapp(req.body?.whatsapp);
  if (!whatsapp) return res.status(400).json({ error: "Informe um WhatsApp válido, com DDD.", campo: "whatsapp" });
  db.prepare("UPDATE companies SET whatsapp = ? WHERE id = ?").run(whatsapp, req.user.entityId);
  const linha = concluir(req.user.entityId, "acesso");
  if (!linha) return res.status(409).json({ error: "Não foi possível concluir esta etapa." });
  res.json(serializar(linha));
});

// Convite aberto por quem já tem conta: entra no login e o convite é aplicado
// ao onboarding da empresa. Vale só para o e-mail para o qual foi gerado.
router.post("/onboarding/convites/:token/aplicar", (req, res) => {
  if (!soEmpresa(req, res)) return;
  const convite = conviteDoToken(req.params.token);
  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(req.user.id);
  const estado = conviteServeParaEmail(convite, user?.email);
  if (!estado.ok) return res.status(409).json({ error: MOTIVOS_CONVITE_ONBOARDING[estado.motivo], motivo: estado.motivo });

  const linha = obterOnboarding(req.user.entityId);
  if (!linha) return res.status(404).json({ error: "Empresa não encontrada." });
  if (JSON.parse(linha.etapas || "{}").plano === "concluida")
    return res.status(409).json({ error: "O plano desta empresa já foi escolhido.", motivo: "planoEscolhido" });

  const t = agora();
  let aplicado = false;
  db.transaction(() => {
    const marca = db.prepare("UPDATE onboarding_convites SET usadoEm = ?, usadoPor = ? WHERE id = ? AND usadoEm IS NULL AND revogadoEm IS NULL")
      .run(t, req.user.entityId, convite.id);
    if (!marca.changes) return;
    db.prepare("UPDATE onboarding SET conviteId = ?, trialDias = ?, atualizadoEm = ? WHERE companyId = ?")
      .run(convite.id, convite.trialDias, t, req.user.entityId);
    aplicado = true;
  })();
  if (!aplicado) return res.status(409).json({ error: MOTIVOS_CONVITE_ONBOARDING.usado, motivo: "usado" });
  res.json(serializar(obterOnboarding(req.user.entityId)));
});

// ---------------------------------------------------------------------------
// Admin: gerar, listar e cancelar convites.
const soAdmin = (req, res) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Apenas a plataforma" });
    return false;
  }
  return true;
};

router.post("/admin/onboarding-convites", (req, res) => {
  if (!soAdmin(req, res)) return;
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Informe o e-mail da empresa." });
  const trialDias = req.body?.comTrial ? TRIAL_ONBOARDING_DIAS : 0;
  const validade = validadeConviteDias(req.body?.validadeDias);

  const token = novoToken();
  const id = uid();
  const criadoEm = agora();
  const expiraEm = criadoEm + validade * 86400000;
  db.prepare(`INSERT INTO onboarding_convites (id, tokenHash, email, trialDias, criadoPor, criadoEm, expiraEm, observacao)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, hashToken(token), email, trialDias, req.user.id, criadoEm, expiraEm, String(req.body?.observacao || "").slice(0, 200));

  console.log(`[onboarding] convite gerado por ${req.user.id} — ${trialDias ? `trial ${trialDias} dias` : "sem trial"}, validade ${validade} dias`);

  const base = String(process.env.FRONTEND_URL || "").replace(/\/$/, "");
  res.status(201).json({
    id, email, trialDias, expiraEm, validadeDias: validade,
    // Mostrado uma vez só: o banco guarda apenas o hash.
    url: `${base}/comecar/${token}`,
    aviso: "Copie agora: este link não pode ser exibido de novo.",
  });
});

router.get("/admin/onboarding-convites", (req, res) => {
  if (!soAdmin(req, res)) return;
  const convites = db.prepare("SELECT * FROM onboarding_convites ORDER BY criadoEm DESC LIMIT 200").all().map((c) => {
    const empresa = c.usadoPor ? db.prepare("SELECT nome FROM companies WHERE id = ?").get(c.usadoPor) : null;
    const estado = estadoConviteOnboarding(c);
    return {
      id: c.id, email: c.email, trialDias: c.trialDias, observacao: c.observacao,
      criadoEm: c.criadoEm, expiraEm: c.expiraEm, usadoEm: c.usadoEm, usadoPor: empresa?.nome || null,
      estado: estado.ok ? "disponivel" : estado.motivo,
    };
  });
  res.json({ convites });
});

router.post("/admin/onboarding-convites/:id/revogar", (req, res) => {
  if (!soAdmin(req, res)) return;
  const r = db.prepare("UPDATE onboarding_convites SET revogadoEm = ? WHERE id = ? AND usadoEm IS NULL AND revogadoEm IS NULL")
    .run(agora(), req.params.id);
  if (!r.changes) return res.status(409).json({ error: "Este convite já foi usado ou cancelado." });
  res.json({ ok: true });
});

export default router;

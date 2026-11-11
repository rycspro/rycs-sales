import { Router } from "express";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import {
  metaConfigurada, urlLogin, concluirLogin, conexaoDe, resumoConexao, opcoesDisponiveis,
  configurar, desconectar, metricas, resumoLeads, assinaturaValida, processarAvisoWebhook, ErroMeta,
} from "../services/meta.js";

const SECRET = process.env.JWT_SECRET || "salesmachine-dev-secret-change-in-production";
const somenteEmpresa = (req, res) => {
  if (req.user?.role !== "empresa" || !req.user.entityId) { res.status(403).json({ error: "Apenas a empresa gerencia a integração com a Meta" }); return false; }
  return true;
};
const erroAmigavel = (e) => (e instanceof ErroMeta ? e.message : "Não foi possível falar com a Meta agora. Tente de novo em instantes.");

// ── Público: webhook e retorno do login (a Meta chama sem cookie) ──────

export const metaPublico = Router();

metaPublico.get("/webhooks/meta", (req, res) => {
  const token = process.env.META_VERIFY_TOKEN;
  if (token && req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === token)
    return res.status(200).type("text/plain").send(String(req.query["hub.challenge"] || ""));
  res.sendStatus(403);
});

metaPublico.post("/webhooks/meta", (req, res) => {
  if (!assinaturaValida(req.rawBody, req.get("x-hub-signature-256"))) return res.sendStatus(401);
  // Responde já: a Meta reenvia se demorar. O processamento segue em seguida.
  res.sendStatus(200);
  setImmediate(() => processarAvisoWebhook(req.body).catch((e) => console.warn("[meta] webhook:", e.message)));
});

metaPublico.get("/meta/callback", async (req, res) => {
  const voltar = (q) => res.redirect(`/plataforma?meta=${q}`);
  let estado;
  try { estado = jwt.verify(String(req.query.state || ""), SECRET); } catch { return voltar("erro&motivo=sessao"); }
  if (estado?.tipo !== "meta-login" || !estado.companyId) return voltar("erro&motivo=sessao");
  if (req.query.error || !req.query.code) return voltar("cancelado");
  try {
    await concluirLogin(estado.companyId, String(req.query.code));
    voltar("conectado");
  } catch (e) {
    console.warn("[meta] callback:", e.message);
    voltar("erro&motivo=login");
  }
});

// ── Empresa autenticada ───────────────────────────────────────────────

const router = Router();

router.get("/meta/conexao", (req, res) => {
  if (!somenteEmpresa(req, res)) return;
  res.json(resumoConexao(conexaoDe(req.user.entityId)));
});

router.post("/meta/iniciar", (req, res) => {
  if (!somenteEmpresa(req, res)) return;
  if (!metaConfigurada()) return res.status(503).json({ error: "A integração com a Meta ainda não foi ativada pela RYCS." });
  const state = jwt.sign({ tipo: "meta-login", companyId: req.user.entityId, userId: req.user.id, n: randomBytes(8).toString("hex") }, SECRET, { expiresIn: "15m" });
  res.json({ url: urlLogin(state) });
});

router.get("/meta/opcoes", async (req, res) => {
  if (!somenteEmpresa(req, res)) return;
  try {
    const opcoes = await opcoesDisponiveis(req.user.entityId);
    if (!opcoes) return res.status(404).json({ error: "Conecte a conta da Meta primeiro." });
    res.json(opcoes);
  } catch (e) { res.status(502).json({ error: erroAmigavel(e) }); }
});

router.post("/meta/configurar", async (req, res) => {
  if (!somenteEmpresa(req, res)) return;
  const { pageId, adAccountId, campaignId } = req.body || {};
  if (!pageId) return res.status(400).json({ error: "Escolha a Página do Facebook." });
  try { res.json(await configurar(req.user.entityId, { pageId, adAccountId, campaignId })); }
  catch (e) { res.status(e instanceof ErroMeta && !e.status ? 422 : 502).json({ error: erroAmigavel(e) }); }
});

router.delete("/meta/conexao", async (req, res) => {
  if (!somenteEmpresa(req, res)) return;
  await desconectar(req.user.entityId);
  res.json({ ok: true });
});

router.get("/meta/metricas", async (req, res) => {
  if (!somenteEmpresa(req, res)) return;
  try {
    const dados = await metricas(req.user.entityId, String(req.query.periodo || "last_30d"));
    if (!dados) return res.status(404).json({ error: "Escolha a conta de anúncios para ver as métricas." });
    res.json(dados);
  } catch (e) { res.status(502).json({ error: erroAmigavel(e) }); }
});

router.get("/meta/leads", (req, res) => {
  if (!somenteEmpresa(req, res)) return;
  res.json(resumoLeads(req.user.entityId));
});

export default router;

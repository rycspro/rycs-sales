import { Router, urlencoded } from "express";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import db from "../db.js";
import { ErroMeta } from "../services/meta.js";
import * as canais from "../services/canais.js";
import * as wa from "../services/canaisWhatsapp.js";
import * as ig from "../services/canaisInstagram.js";
import * as auditoria from "../services/auditoriaConversas.js";
import { notificar } from "./notifications.js";

const SECRET = process.env.JWT_SECRET || "salesmachine-dev-secret-change-in-production";
const { erroCanal } = canais;

const responderErro = (res, e) => {
  if (e?.validacao) return res.status(e.http || 400).json({ error: e.message });
  if (e instanceof ErroMeta) return res.status(502).json({ error: `A Meta recusou: ${e.message}` });
  console.error("[canais]", e?.stack || e);
  res.status(500).json({ error: "Não foi possível concluir. Tente de novo em instantes." });
};
const rota = (f) => async (req, res) => { try { await f(req, res); } catch (e) { responderErro(res, e); } };
const soEquipe = (req, res, next) => (["empresa", "vendedor"].includes(req.user?.role) && req.user.entityId ? next() : res.status(403).json({ error: "Sem permissão" }));

// ── Público: retorno do login do Instagram ────────────────────────────────

export const canaisPublico = Router();
canaisPublico.get("/instagram/callback", async (req, res) => {
  const voltar = (q) => res.redirect(`/plataforma?instagram=${q}`);
  let estado;
  try { estado = jwt.verify(String(req.query.state || ""), SECRET); } catch { return voltar("sessao"); }
  if (estado?.tipo !== "instagram-login" || !estado.companyId) return voltar("sessao");
  if (req.query.error || !req.query.code) return voltar("cancelado");
  try {
    const c = await ig.concluirLogin({ companyId: estado.companyId, userId: estado.userId, code: String(req.query.code) });
    ig.importarRecentes(c.id).catch((e) => console.warn("[canais] instagram recentes:", e?.message));
    voltar("conectado");
  } catch (e) {
    console.warn("[canais] instagram callback:", e?.message);
    voltar(e?.http === 409 ? "em_uso" : "erro");
  }
});

// Avisos obrigatórios da Meta, assinados com o segredo do produto Instagram.
const formulario = urlencoded({ extended: false, limit: "20kb" });
canaisPublico.post("/instagram/desautorizar", formulario, (req, res) => {
  const d = ig.lerSignedRequest(req.body?.signed_request);
  if (!d) return res.sendStatus(401);
  ig.desautorizar(d.userId);
  res.json({ ok: true });
});
canaisPublico.post("/instagram/excluir-dados", formulario, (req, res) => {
  const d = ig.lerSignedRequest(req.body?.signed_request);
  if (!d) return res.sendStatus(401);
  const { codigo, apagadas } = ig.excluirDados(d.userId);
  console.log(`[canais] exclusão pedida pela Meta: ${codigo} (${apagadas} conexão(ões))`);
  res.json({ url: `${(process.env.PUBLIC_URL || process.env.FRONTEND_URL || "https://app.rycs.pro").replace(/\/+$/, "")}/exclusao-de-dados/?codigo=${codigo}`, confirmation_code: codigo });
});

// ── Autenticado ───────────────────────────────────────────────────────────

const router = Router();

router.get("/canais", soEquipe, rota((req, res) => {
  const { role, entityId } = req.user;
  const conexoes = role === "empresa"
    ? canais.listarConexoes({ companyId: entityId })
    : db.prepare("SELECT DISTINCT companyId FROM canais_conexoes WHERE sellerId = ?").all(entityId).flatMap((r) => canais.listarConexoes({ companyId: r.companyId, sellerId: entityId }).map((c) => ({ ...c, companyId: r.companyId })));
  const empresas = role === "vendedor"
    ? db.prepare("SELECT c.id, c.nome FROM applications a JOIN companies c ON c.id = a.companyId WHERE a.sellerId = ? AND a.status = 'aprovado' ORDER BY c.nome").all(entityId)
    : undefined;
  res.json({ whatsapp: wa.dadosLogin(), instagram: { configurada: ig.instagramConfigurado() }, conexoes, naoLidas: canais.naoLidas(req.user), empresas });
}));

const exigirConsentimento = (req) => { if (req.body?.consentimento !== true) throw erroCanal("Confirme o aviso sobre o uso das conversas para continuar."); };

router.post("/canais/whatsapp/conectar", soEquipe, rota(async (req, res) => {
  exigirConsentimento(req);
  const vendedor = req.user.role === "vendedor";
  const companyId = vendedor ? String(req.body?.companyId || "") : req.user.entityId;
  if (vendedor && !canais.vendedorAprovado(companyId, req.user.entityId)) throw erroCanal("Escolha uma empresa em que você está aprovado.", 403);
  const c = await wa.conectar({
    user: req.user, companyId, sellerId: vendedor ? req.user.entityId : null,
    code: String(req.body?.code || ""), wabaId: String(req.body?.wabaId || ""), phoneNumberId: String(req.body?.phoneNumberId || ""),
  });
  res.json({ ok: true, id: c.id, numero: c.numero });
}));

router.post("/canais/instagram/iniciar", soEquipe, rota((req, res) => {
  if (req.user.role !== "empresa") throw erroCanal("Só a empresa conecta o Instagram.", 403);
  exigirConsentimento(req);
  if (!ig.instagramConfigurado()) throw erroCanal("A RYCS ainda está ativando esta integração com a Meta.", 503);
  const state = jwt.sign({ tipo: "instagram-login", companyId: req.user.entityId, userId: req.user.id, n: randomBytes(8).toString("hex") }, SECRET, { expiresIn: "15m" });
  res.json({ url: ig.urlLogin(state) });
}));

// Dono da conexão: a empresa nos canais dela, o vendedor no próprio número.
function conexaoDoDono(req, { empresaPodeEncerrar = false } = {}) {
  const c = canais.conexaoPorId(req.params.id);
  const dono = c && (req.user.role === "vendedor" ? c.sellerId === req.user.entityId
    : c.companyId === req.user.entityId && (!c.sellerId || empresaPodeEncerrar));
  if (!dono) throw erroCanal("Conexão não encontrada.", 404);
  return c;
}

router.patch("/canais/conexoes/:id", soEquipe, rota((req, res) => {
  const c = conexaoDoDono(req);
  if (typeof req.body?.auditoriaIA === "boolean") db.prepare("UPDATE canais_conexoes SET auditoriaIA = ? WHERE id = ?").run(req.body.auditoriaIA ? 1 : 0, c.id);
  res.json({ ok: true });
}));

router.delete("/canais/conexoes/:id", soEquipe, rota(async (req, res) => {
  const c = conexaoDoDono(req, { empresaPodeEncerrar: true });
  await (c.canal === "instagram" ? ig : wa).desconectar(c);
  // Apagar o histórico é escolha da empresa, dona das conversas.
  if (req.user.role === "empresa" && !c.sellerId && req.body?.apagarHistorico === true) canais.apagarConexao(c.id);
  res.json({ ok: true });
}));

router.get("/canais/conversas", soEquipe, rota((req, res) => {
  const { canal = "", tipo = "", busca = "", conexaoId = "" } = req.query;
  res.json({ conversas: canais.listarConversas(req.user, { canal: String(canal), tipo: String(tipo), busca: String(busca), conexaoId: String(conexaoId) }), naoLidas: canais.naoLidas(req.user) });
}));

router.get("/canais/conversas/:id", soEquipe, rota((req, res) => {
  const c = canais.abrirConversa(req.user, req.params.id);
  if (!c) throw erroCanal("Conversa não encontrada.", 404);
  res.json(c);
}));

router.post("/canais/conversas/:id/responder", soEquipe, rota(async (req, res) => {
  const v = canais.conversaDoUsuario(req.user, req.params.id);
  if (!v) throw erroCanal("Conversa não encontrada.", 404);
  const r = v.canal === "instagram"
    ? await ig.responder(req.user, v.id, { texto: req.body?.texto, comentarioId: String(req.body?.comentarioId || ""), privado: req.body?.privado === true })
    : await wa.enviarTexto(req.user, v.id, req.body?.texto);
  res.json({ ok: true, ...r });
}));

router.post("/canais/conversas/:id/lead", soEquipe, rota((req, res) => {
  const r = canais.criarLeadDaConversa(req.user, req.params.id, req.body || {});
  const u = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(r.sellerId);
  if (u) notificar(u.id, "lead", "Novo lead", `${r.nome} chegou pela conversa da empresa. Faça o primeiro contato agora.`);
  res.json({ ok: true, leadId: r.leadId });
}));

router.get("/canais/conversas/:id/auditoria", soEquipe, rota((req, res) => res.json({ auditoria: auditoria.ultimaAuditoria(req.user, req.params.id) })));
router.post("/canais/conversas/:id/auditoria", soEquipe, rota(async (req, res) => res.json({ auditoria: await auditoria.auditarConversa(req.user, req.params.id) })));
router.get("/canais/auditoria", soEquipe, rota((req, res) => res.json(auditoria.painelAuditoria(req.user, String(req.query.canal || "whatsapp")))));

const EXIBIVEL = /^(image\/(jpeg|png|webp|gif)|audio\/[\w.+-]+|video\/(mp4|3gpp|webm|quicktime)|application\/pdf)$/;
router.get("/canais/mensagens/:id/midia", soEquipe, rota(async (req, res) => {
  const { buf, mime, arquivo } = await wa.baixarMidia(req.user, req.params.id);
  const exibe = EXIBIVEL.test(mime);
  res.set({
    "Content-Type": exibe ? mime : "application/octet-stream",
    "Content-Disposition": `${exibe ? "inline" : "attachment"}; filename="${arquivo || "arquivo"}"`,
    "Cache-Control": "private, max-age=600",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; media-src 'self'; sandbox",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(buf);
}));

auditoria.iniciarAuditoriaConversas();
setInterval(() => ig.renovarTokens().catch((e) => console.warn("[canais] renovar instagram:", e?.message)), 6 * 60 * 60 * 1000).unref?.();

export default router;

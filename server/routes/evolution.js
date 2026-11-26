// Rotas da integração WhatsApp pessoal via Evolution API.
//
// Público: webhook da Evolution (POST /api/webhooks/evolution).
// Protegido: conexão, QR Code, status, desconexão, envio de mensagem.
// Admin: gestão de pilotos, conexões e métricas.

import { Router } from "express";
import db, { agora } from "../db.js";
import * as evo from "../services/canaisEvolution.js";
import * as canais from "../services/canais.js";

const { erroCanal } = canais;
const rota = (f) => async (req, res) => { try { await f(req, res); } catch (e) { responderErro(res, e); } };
const responderErro = (res, e) => {
  if (e?.validacao) return res.status(e.http || 400).json({ error: e.message });
  console.error("[evolution]", e?.stack || e);
  res.status(500).json({ error: "Não foi possível concluir. Tente de novo em instantes." });
};
const soVendedor = (req, res, next) => (req.user?.role === "vendedor" && req.user.entityId ? next() : res.status(403).json({ error: "Apenas profissionais podem usar o WhatsApp pessoal." }));
const soEquipe = (req, res, next) => (["empresa", "vendedor"].includes(req.user?.role) && req.user.entityId ? next() : res.status(403).json({ error: "Sem permissão" }));
const soAdmin = (req, res, next) => (req.user?.role === "admin" ? next() : res.status(403).json({ error: "Sem permissão" }));

// ── Webhook público ──────────────────────────────────────────────────────

export const evolutionPublico = Router();

evolutionPublico.post("/evolution", (req, res) => {
  const chave = req.headers?.apikey || req.body?.apikey || "";
  const esperada = process.env.EVOLUTION_API_KEY || "";
  if (esperada && chave !== esperada) {
    console.warn("[evolution] webhook: chave inválida");
    return res.sendStatus(401);
  }
  try {
    const n = evo.receberWebhook(req.body);
    if (n > 0) console.log(`[evolution] webhook: ${n} evento(s) processado(s)`);
  } catch (e) { console.error("[evolution] webhook:", e?.message); }
  res.sendStatus(200);
});

// ── Rotas protegidas ─────────────────────────────────────────────────────

const router = Router();

router.get("/evolution/info", soEquipe, rota((req, res) => {
  const configurada = evo.evolutionConfigurada();
  if (req.user.role === "vendedor") {
    const autorizado = evo.pilotoAutorizado(req.user.entityId);
    const dados = autorizado ? evo.dadosConexao(req.user.entityId) : {};
    return res.json({ configurada, autorizado, ...dados });
  }
  res.json({ configurada });
}));

router.post("/evolution/conectar", soVendedor, rota(async (req, res) => {
  if (req.body?.consentimento !== true) throw erroCanal("Confirme o aviso para continuar.");
  // Sem empresa: o WhatsApp pessoal é por profissional e atende todas as empresas dele.
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
  const r = await evo.conectar({ user: req.user, sellerId: req.user.entityId, ip });
  res.json({ ok: true, ...r });
}));

router.get("/evolution/qrcode", soVendedor, rota(async (req, res) => {
  if (!evo.pilotoAutorizado(req.user.entityId)) throw erroCanal("Não autorizado.", 403);
  const qr = await evo.buscarQrCode(req.user.entityId);
  res.json(qr);
}));

router.get("/evolution/status", soVendedor, rota(async (req, res) => {
  if (!evo.pilotoAutorizado(req.user.entityId)) throw erroCanal("Não autorizado.", 403);
  const s = await evo.statusInstancia(req.user.entityId);
  const dados = evo.dadosConexao(req.user.entityId);
  res.json({ ...s, ...dados });
}));

router.post("/evolution/reconectar", soVendedor, rota(async (req, res) => {
  if (!evo.pilotoAutorizado(req.user.entityId)) throw erroCanal("Não autorizado.", 403);
  const conexao = db.prepare("SELECT * FROM canais_conexoes WHERE canal = 'evolution' AND sellerId = ? AND status != 'desconectada' ORDER BY criadoEm DESC LIMIT 1").get(req.user.entityId);
  if (!conexao) throw erroCanal("Nenhuma conexão encontrada. Conecte primeiro.");
  const r = await evo.reconectar(conexao);
  res.json({ ok: true, ...r });
}));

router.post("/evolution/desconectar", soVendedor, rota(async (req, res) => {
  const conexao = db.prepare("SELECT * FROM canais_conexoes WHERE canal = 'evolution' AND sellerId = ? AND status != 'desconectada' ORDER BY criadoEm DESC LIMIT 1").get(req.user.entityId);
  if (!conexao) throw erroCanal("Nenhuma conexão encontrada.");
  await evo.desconectar(conexao);
  res.json({ ok: true });
}));

router.post("/evolution/enviar", soEquipe, rota(async (req, res) => {
  const { conversaId, texto } = req.body || {};
  if (!conversaId || !texto?.trim()) throw erroCanal("Informe a conversa e o texto.");
  const conversa = canais.conversaDoUsuario(req.user, conversaId);
  if (!conversa) throw erroCanal("Conversa não encontrada.", 404);
  const conexao = canais.conexaoPorId(conversa.conexaoId);
  if (!conexao || conexao.canal !== "evolution" || conexao.status !== "ativa") throw erroCanal("O WhatsApp pessoal não está conectado.");

  // IDOR: vendedor só envia nas próprias conexões.
  if (req.user.role === "vendedor" && conexao.sellerId !== req.user.entityId) throw erroCanal("Sem permissão para enviar nesta conexão.", 403);

  const para = conversa.contatoExterno || conversa.telefone;
  if (!para) throw erroCanal("Contato sem número.");
  const r = await evo.enviarTexto(conexao, { para, texto: texto.trim() });

  canais.registrarMensagem(conexao, {
    contato: para, telefone: para, nome: "",
    externoId: r.id,
    direcao: "enviada", origem: "vendedor",
    em: Date.now(),
    tipo: "texto", texto: texto.trim(),
    dados: {}, status: "sent",
    autorUserId: req.user.id,
  });
  res.json({ ok: true, id: r.id });
}));

// ── Admin: gestão de pilotos ─────────────────────────────────────────────

router.get("/evolution/admin/pilotos", soAdmin, rota((req, res) => {
  const pilotos = evo.listarPilotos();
  res.json({ pilotos, limite: 10 });
}));

router.post("/evolution/admin/pilotos", soAdmin, rota((req, res) => {
  const sellerId = String(req.body?.sellerId || "").trim();
  if (!sellerId) throw erroCanal("Informe o sellerId.");
  const vendedor = db.prepare("SELECT id, nome FROM sellers WHERE id = ?").get(sellerId);
  if (!vendedor) throw erroCanal("Profissional não encontrado.", 404);
  evo.adicionarPiloto(sellerId, req.user.id);
  res.json({ ok: true, nome: vendedor.nome });
}));

router.delete("/evolution/admin/pilotos/:sellerId", soAdmin, rota((req, res) => {
  evo.removerPiloto(req.params.sellerId);
  res.json({ ok: true });
}));

// ── Admin: visão geral das conexões ──────────────────────────────────────

router.get("/evolution/admin/conexoes", soAdmin, rota((req, res) => {
  const conexoes = db.prepare(`
    SELECT c.*, s.nome AS nomeVendedor, co.nome AS nomeEmpresa
    FROM canais_conexoes c
    LEFT JOIN sellers s ON s.id = c.sellerId
    LEFT JOIN companies co ON co.id = c.companyId
    WHERE c.canal = 'evolution'
    ORDER BY c.criadoEm DESC
  `).all();
  res.json({ conexoes });
}));

// Admin pode forçar desconexão de qualquer instância.
router.post("/evolution/admin/desconectar/:conexaoId", soAdmin, rota(async (req, res) => {
  const conexao = canais.conexaoPorId(req.params.conexaoId);
  if (!conexao || conexao.canal !== "evolution") throw erroCanal("Conexão não encontrada.", 404);
  await evo.desconectar(conexao);
  res.json({ ok: true });
}));

// Admin pode excluir instância (remove da Evolution API + marca desconectada).
router.delete("/evolution/admin/conexoes/:conexaoId", soAdmin, rota(async (req, res) => {
  const conexao = canais.conexaoPorId(req.params.conexaoId);
  if (!conexao || conexao.canal !== "evolution") throw erroCanal("Conexão não encontrada.", 404);
  await evo.excluir(conexao);
  res.json({ ok: true });
}));

// ── Admin: métricas ──────────────────────────────────────────────────────

router.get("/evolution/admin/metricas", soAdmin, rota((req, res) => {
  const totalConexoes = db.prepare("SELECT COUNT(*) AS n FROM canais_conexoes WHERE canal = 'evolution'").get().n;
  const ativas = db.prepare("SELECT COUNT(*) AS n FROM canais_conexoes WHERE canal = 'evolution' AND status = 'ativa'").get().n;
  const totalConversas = db.prepare("SELECT COUNT(*) AS n FROM canais_conversas cv JOIN canais_conexoes cx ON cx.id = cv.conexaoId WHERE cx.canal = 'evolution'").get().n;
  const totalMensagens = db.prepare("SELECT COUNT(*) AS n FROM canais_mensagens m JOIN canais_conversas cv ON cv.id = m.conversaId JOIN canais_conexoes cx ON cx.id = cv.conexaoId WHERE cx.canal = 'evolution'").get().n;
  const totalPilotos = db.prepare("SELECT COUNT(*) AS n FROM evolution_pilotos").get().n;
  const totalConsentimentos = db.prepare("SELECT COUNT(*) AS n FROM evolution_consentimentos").get().n;
  res.json({ totalConexoes, ativas, totalConversas, totalMensagens, totalPilotos, limitePilotos: 10, totalConsentimentos });
}));

// ── Admin: consentimentos ────────────────────────────────────────────────

router.get("/evolution/admin/consentimentos", soAdmin, rota((req, res) => {
  const lista = db.prepare(`
    SELECT ec.*, s.nome AS nomeVendedor, co.nome AS nomeEmpresa
    FROM evolution_consentimentos ec
    LEFT JOIN sellers s ON s.id = ec.sellerId
    LEFT JOIN companies co ON co.id = ec.companyId
    ORDER BY ec.criadoEm DESC LIMIT 100
  `).all();
  res.json({ consentimentos: lista });
}));

export default router;

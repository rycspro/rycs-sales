// Rotas da integração WhatsApp pessoal via Evolution API.
//
// Público: webhook da Evolution (POST /api/webhooks/evolution).
// Protegido: conexão, QR Code, status, desconexão, envio de mensagem.

import { Router } from "express";
import * as evo from "../services/canaisEvolution.js";
import * as canais from "../services/canais.js";
import { notificar } from "./notifications.js";

const { erroCanal } = canais;
const rota = (f) => async (req, res) => { try { await f(req, res); } catch (e) { responderErro(res, e); } };
const responderErro = (res, e) => {
  if (e?.validacao) return res.status(e.http || 400).json({ error: e.message });
  console.error("[evolution]", e?.stack || e);
  res.status(500).json({ error: "Não foi possível concluir. Tente de novo em instantes." });
};
const soVendedor = (req, res, next) => (req.user?.role === "vendedor" && req.user.entityId ? next() : res.status(403).json({ error: "Apenas profissionais podem usar o WhatsApp pessoal." }));
const soEquipe = (req, res, next) => (["empresa", "vendedor"].includes(req.user?.role) && req.user.entityId ? next() : res.status(403).json({ error: "Sem permissão" }));

// ── Webhook público ──────────────────────────────────────────────────────

export const evolutionPublico = Router();

evolutionPublico.post("/evolution", (req, res) => {
  // Valida que veio da Evolution API (apikey no header ou no corpo).
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

// Info geral: a integração está configurada?
router.get("/evolution/info", soEquipe, rota((req, res) => {
  const configurada = evo.evolutionConfigurada();
  const dados = req.user.role === "vendedor" ? evo.dadosConexao(req.user.entityId) : {};
  res.json({ configurada, ...dados });
}));

// Iniciar conexão (gera QR Code).
router.post("/evolution/conectar", soVendedor, rota(async (req, res) => {
  if (req.body?.consentimento !== true) throw erroCanal("Confirme o aviso para continuar.");
  const companyId = String(req.body?.companyId || "");
  if (!companyId) throw erroCanal("Escolha a empresa.");
  const r = await evo.conectar({ user: req.user, companyId, sellerId: req.user.entityId });
  res.json({ ok: true, ...r });
}));

// Buscar QR Code atualizado.
router.get("/evolution/qrcode", soVendedor, rota(async (req, res) => {
  const qr = await evo.buscarQrCode(req.user.entityId);
  res.json(qr);
}));

// Status da conexão.
router.get("/evolution/status", soVendedor, rota(async (req, res) => {
  const s = await evo.statusInstancia(req.user.entityId);
  const dados = evo.dadosConexao(req.user.entityId);
  res.json({ ...s, ...dados });
}));

// Reconectar (gera novo QR Code).
router.post("/evolution/reconectar", soVendedor, rota(async (req, res) => {
  const conexao = db.prepare("SELECT * FROM canais_conexoes WHERE canal = 'evolution' AND sellerId = ? AND status != 'desconectada' ORDER BY criadoEm DESC LIMIT 1").get(req.user.entityId);
  if (!conexao) throw erroCanal("Nenhuma conexão encontrada. Conecte primeiro.");
  const r = await evo.reconectar(conexao);
  res.json({ ok: true, ...r });
}));

// Desconectar.
router.post("/evolution/desconectar", soVendedor, rota(async (req, res) => {
  const conexao = db.prepare("SELECT * FROM canais_conexoes WHERE canal = 'evolution' AND sellerId = ? AND status != 'desconectada' ORDER BY criadoEm DESC LIMIT 1").get(req.user.entityId);
  if (!conexao) throw erroCanal("Nenhuma conexão encontrada.");
  await evo.desconectar(conexao);
  res.json({ ok: true });
}));

// Enviar mensagem de texto.
router.post("/evolution/enviar", soEquipe, rota(async (req, res) => {
  const { conversaId, texto } = req.body || {};
  if (!conversaId || !texto?.trim()) throw erroCanal("Informe a conversa e o texto.");
  const conversa = canais.conversaDoUsuario(req.user, conversaId);
  if (!conversa) throw erroCanal("Conversa não encontrada.", 404);
  const conexao = canais.conexaoPorId(conversa.conexaoId);
  if (!conexao || conexao.canal !== "evolution" || conexao.status !== "ativa") throw erroCanal("O WhatsApp pessoal não está conectado.");

  const para = conversa.contatoExterno || conversa.telefone;
  if (!para) throw erroCanal("Contato sem número.");
  const r = await evo.enviarTexto(conexao, { para, texto: texto.trim() });

  // Registra a mensagem enviada no banco.
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

// Importar db para rotas que fazem queries diretas.
import db from "../db.js";

export default router;

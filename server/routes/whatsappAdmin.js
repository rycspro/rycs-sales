import { Router } from "express";
import * as wa from "../services/whatsappDisparo.js";

const router = Router();

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito ao administrador." });
  next();
}

function exigirConfig(req, res, next) {
  const faltando = wa.faltandoConfig();
  if (faltando.length) return res.status(503).json({ error: `Envio de WhatsApp não configurado. Falta: ${faltando.join(", ")}.` });
  next();
}

const erroMeta = (res, e) => res.status(502).json({ error: `A Meta recusou: ${e?.message || "erro desconhecido"}` });

// O template é sempre conferido na Meta: só segue se estiver aprovado agora.
async function templateAprovado(nome, idioma) {
  const lista = await wa.listarTemplates();
  return lista.find((t) => t.nome === nome && t.idioma === idioma) || null;
}

// Freios de segurança que a tela mostra ao admin.
const freios = () => ({
  limite24h: wa.LIMITE_24H, vagas24h: wa.vagas24h(), lotePadrao: wa.LOTE_PADRAO, loteMaximo: wa.LOTE_MAXIMO,
  horario: wa.HORARIO, bloqueioRecente: wa.bloqueioRecente(),
});

// GET /api/admin/whatsapp — configuração, públicos e histórico
router.get("/admin/whatsapp", requireAdmin, (req, res) => {
  res.json({
    configurado: wa.envioConfigurado(),
    faltando: wa.faltandoConfig(),
    publicos: Object.entries(wa.PUBLICOS).map(([key, p]) => ({ key, label: p.label })),
    disparos: wa.listarDisparos(),
    freios: freios(),
  });
});

// GET /api/admin/whatsapp/templates — templates aprovados na Meta
router.get("/admin/whatsapp/templates", requireAdmin, exigirConfig, async (req, res) => {
  try { res.json(await wa.listarTemplates()); } catch (e) { erroMeta(res, e); }
});

// POST /api/admin/whatsapp/preview — quantos recebem e quantos ficam de fora
router.post("/admin/whatsapp/preview", requireAdmin, (req, res) => {
  const d = wa.destinatarios(req.body?.publico, { template: String(req.body?.template || "") || undefined });
  if (!d) return res.status(400).json({ error: "Público inválido." });
  res.json({
    publicoLabel: d.label, quantidade: d.lista.length, total: d.total, semNumero: d.semNumero,
    descadastrados: d.descadastrados, duplicados: d.duplicados, jaReceberam: d.jaReceberam, freios: freios(),
  });
});

// POST /api/admin/whatsapp/teste — envia o template para um número só
router.post("/admin/whatsapp/teste", requireAdmin, exigirConfig, async (req, res) => {
  const { para, template, idioma, variaveis, nomeTeste } = req.body || {};
  const numero = wa.numeroWhatsapp(para, "Brasil");
  if (!numero) return res.status(400).json({ error: "Número de teste inválido. Use DDD + número, ou +DDI para outro país." });
  try {
    const tpl = await templateAprovado(template, idioma);
    if (!tpl) return res.status(400).json({ error: "Template não encontrado entre os aprovados." });
    if (!tpl.suportado) return res.status(400).json({ error: tpl.motivo });
    const erro = wa.validarVariaveis(tpl, variaveis);
    if (erro) return res.status(400).json({ error: erro });
    const componentes = wa.montarComponentes(tpl, variaveis, String(nomeTeste || "").trim() || "Teste");
    const wamid = await wa.enviarTemplate({ numero, tpl, componentes });
    res.json({ ok: true, wamid });
  } catch (e) { erroMeta(res, e); }
});

// POST /api/admin/whatsapp/disparar — cria o disparo e envia em segundo plano
router.post("/admin/whatsapp/disparar", requireAdmin, exigirConfig, async (req, res) => {
  const { publico, template, idioma, variaveis, limite } = req.body || {};
  if (wa.disparoEmAndamento()) return res.status(409).json({ error: "Já existe um disparo em andamento. Aguarde terminar." });
  if (wa.bloqueioRecente()) return res.status(409).json({ error: "A Meta avisou nas últimas 24h que está limitando o número por bloqueios. Espere antes de disparar de novo." });
  try {
    const tpl = await templateAprovado(template, idioma);
    if (!tpl) return res.status(400).json({ error: "Template não encontrado entre os aprovados." });
    if (!tpl.suportado) return res.status(400).json({ error: tpl.motivo });
    const erro = wa.validarVariaveis(tpl, variaveis);
    if (erro) return res.status(400).json({ error: erro });
    // Confere de novo depois da ida à Meta: dois cliques seguidos não viram dois disparos.
    if (wa.disparoEmAndamento()) return res.status(409).json({ error: "Já existe um disparo em andamento. Aguarde terminar." });
    const d = wa.criarDisparo({ adminId: req.user.id, tpl, variaveis, publico, limite });
    wa.processarDisparo(d.id).catch(() => null);
    res.json({ ok: true, id: d.id, quantidade: d.lista.length });
  } catch (e) {
    if (e?.codigo !== undefined || e?.status) return erroMeta(res, e);
    res.status(400).json({ error: e.message });
  }
});

// GET /api/admin/whatsapp/disparos/:id/falhas
router.get("/admin/whatsapp/disparos/:id/falhas", requireAdmin, (req, res) => {
  res.json(wa.falhasDoDisparo(req.params.id));
});

export default router;

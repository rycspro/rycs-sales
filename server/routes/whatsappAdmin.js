import { Router } from "express";
import * as wa from "../services/whatsappDisparo.js";
import { metricasWhatsapp, detalheMensagens } from "../services/whatsappMetricas.js";
import * as conta from "../services/whatsappConta.js";
import * as conversas from "../services/whatsappConversas.js";

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

// GET /api/admin/whatsapp — configuração, públicos, histórico e desempenho.
// O desempenho vem junto para atualizar sozinho enquanto um disparo corre.
router.get("/admin/whatsapp", requireAdmin, (req, res) => {
  let metricas = null;
  try { metricas = metricasWhatsapp(); } catch (e) { console.error("[whatsapp] métricas:", e?.message); }
  let naoLidas = 0;
  try { naoLidas = conversas.listarConversas().reduce((s, c) => s + c.naoLidas, 0); } catch (e) { console.error("[whatsapp] conversas:", e?.message); }
  res.json({
    metricas,
    naoLidas,
    configurado: wa.envioConfigurado(),
    faltando: wa.faltandoConfig(),
    publicos: Object.entries(wa.PUBLICOS).map(([key, p]) => ({ key, label: p.label, pendencias: !!p.comPendencias })),
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
    // No teste não há vendedor: as pendências vão marcadas como exemplo.
    const componentes = wa.montarComponentes(tpl, variaveis, String(nomeTeste || "").trim() || "Teste", "foto de perfil e cidade (exemplo)");
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

// GET /api/admin/whatsapp/conversas — caixa de entrada do número oficial
router.get("/admin/whatsapp/conversas", requireAdmin, (req, res) => {
  const lista = conversas.listarConversas({ filtro: req.query.filtro === "todas" ? "todas" : "respostas", busca: String(req.query.busca || "") });
  res.json({ conversas: lista.slice(0, 300), naoLidas: lista.reduce((s, c) => s + c.naoLidas, 0) });
});

// GET /api/admin/whatsapp/conversas/:numero — histórico completo (marca como lida)
router.get("/admin/whatsapp/conversas/:numero", requireAdmin, (req, res) => {
  const c = conversas.abrirConversa(req.params.numero);
  if (!c) return res.status(400).json({ error: "Número inválido." });
  res.json(c);
});

const erroConversa = (res, e) => (e?.validacao ? res.status(400).json({ error: e.message }) : erroMeta(res, e));

// POST /api/admin/whatsapp/conversas/:numero/responder — texto livre (janela de 24h)
router.post("/admin/whatsapp/conversas/:numero/responder", requireAdmin, exigirConfig, async (req, res) => {
  try { res.json(await conversas.responder(req.params.numero, req.body?.texto, { adminId: req.user.id })); } catch (e) { erroConversa(res, e); }
});

// POST /api/admin/whatsapp/conversas/:numero/modelo — modelo aprovado para uma pessoa
router.post("/admin/whatsapp/conversas/:numero/modelo", requireAdmin, exigirConfig, async (req, res) => {
  const { template, idioma, variaveis } = req.body || {};
  try { res.json(await conversas.enviarModelo(req.params.numero, { template, idioma, variaveis }, { adminId: req.user.id })); } catch (e) { erroConversa(res, e); }
});

// GET /api/admin/whatsapp/mensagens — cada mensagem enviada, em detalhe
router.get("/admin/whatsapp/mensagens", requireAdmin, (req, res) => {
  res.json(detalheMensagens({ disparoId: String(req.query.disparo || ""), busca: String(req.query.busca || ""), limite: req.query.limite }));
});

// GET /api/admin/whatsapp/conta — número, conta, perfil, modelos, apps e links da Meta
router.get("/admin/whatsapp/conta", requireAdmin, exigirConfig, async (req, res) => {
  const [base, modelos] = await Promise.all([conta.contaWhatsapp(), conta.tentar(conta.modelosMeta)]);
  res.json({ ...base, modelos, freios: freios() });
});

// GET /api/admin/whatsapp/custos?dias=30 — custos por categoria e desempenho por modelo
router.get("/admin/whatsapp/custos", requireAdmin, exigirConfig, async (req, res) => {
  const dias = [7, 30, 90].includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
  const [custos, cobranca, modelos] = await Promise.all([
    conta.tentar(() => conta.custosWhatsapp(dias)), conta.tentar(conta.cobrancaWhatsapp), conta.tentar(conta.modelosMeta),
  ]);
  const estatisticas = req.query.estatisticas === "0" ? null
    : modelos.ok ? await conta.tentar(() => conta.estatisticasModelos(dias, modelos.dados.filter((m) => m.status === "APPROVED")))
      : { ok: false, erro: modelos.erro };
  res.json({ dias, custos, cobranca, estatisticas, links: conta.linksMeta() });
});

// GET /api/admin/whatsapp/saldo — gastos do WhatsApp, saldo estimado e conta de anúncios
router.get("/admin/whatsapp/saldo", requireAdmin, exigirConfig, async (req, res) => {
  res.json(await conta.saldoMeta());
});

// POST /api/admin/whatsapp/recargas — registra uma recarga feita na Meta
router.post("/admin/whatsapp/recargas", requireAdmin, (req, res) => {
  try { res.json(conta.registrarRecarga(req.body || {}, req.user.id)); } catch (e) {
    res.status(e?.validacao ? 400 : 500).json({ error: e?.message || "Falha ao registrar." });
  }
});

// DELETE /api/admin/whatsapp/recargas/:id — apaga uma recarga lançada errada
router.delete("/admin/whatsapp/recargas/:id", requireAdmin, (req, res) => {
  res.json({ ok: conta.apagarRecarga(req.params.id) > 0 });
});

// POST /api/admin/whatsapp/estatisticas/ligar — liga as estatísticas de modelos na Meta
router.post("/admin/whatsapp/estatisticas/ligar", requireAdmin, exigirConfig, async (req, res) => {
  try { res.json(await conta.ligarEstatisticas()); } catch (e) { erroMeta(res, e); }
});

// POST /api/admin/whatsapp/perfil — atualiza o perfil público do número
router.post("/admin/whatsapp/perfil", requireAdmin, exigirConfig, async (req, res) => {
  try { res.json(await conta.salvarPerfil(req.body || {})); } catch (e) {
    if (e?.validacao) return res.status(400).json({ error: e.message });
    erroMeta(res, e);
  }
});

// POST /api/admin/whatsapp/disparos/:id/liberar-horario — envia agora, fora das 8h–20h
router.post("/admin/whatsapp/disparos/:id/liberar-horario", requireAdmin, exigirConfig, async (req, res) => {
  try { res.json(await wa.liberarHorario(req.params.id)); } catch (e) {
    res.status(e?.validacao ? 400 : 500).json({ error: e?.message || "Falha ao liberar." });
  }
});

// GET /api/admin/whatsapp/disparos/:id/falhas
router.get("/admin/whatsapp/disparos/:id/falhas", requireAdmin, (req, res) => {
  res.json(wa.falhasDoDisparo(req.params.id));
});

export default router;

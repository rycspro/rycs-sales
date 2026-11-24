import { Router } from "express";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import * as erp from "../services/erp.js";
import * as pedidos from "../services/pedidos.js";

const SECRET = process.env.JWT_SECRET || "salesmachine-dev-secret-change-in-production";
const rota = (f) => async (req, res) => {
  try { await f(req, res); } catch (e) {
    if (e?.validacao) return res.status(e.http || 400).json({ error: e.message, erros: e.erros });
    console.error("[erp]", e?.stack || e);
    res.status(500).json({ error: "Não foi possível concluir. Tente de novo em instantes." });
  }
};

// ── Público: retorno do login do Bling e entrada do ERP genérico ──────────

export const erpPublico = Router();

erpPublico.get("/erp/bling/callback", async (req, res) => {
  const voltar = (q) => res.redirect(`/plataforma?erp=${q}`);
  let estado;
  try { estado = jwt.verify(String(req.query.state || ""), SECRET); } catch { return voltar("sessao"); }
  if (estado?.tipo !== "bling-login" || !estado.companyId) return voltar("sessao");
  if (req.query.error || !req.query.code) return voltar("cancelado");
  try { await erp.concluirBling(estado.companyId, String(req.query.code)); voltar("conectado"); }
  catch (e) { console.warn("[erp] bling callback:", e?.message); voltar("erro"); }
});

erpPublico.post("/erp/in/:segredo", (req, res) => {
  const r = erp.receberDoErp(req.params.segredo, req.body);
  if (!r) return res.status(401).json({ ok: false, erro: "Não autorizado." });
  res.status(202).json({ ok: true, ...r });
});

// ── Empresa ───────────────────────────────────────────────────────────────

const router = Router();
const soEmpresa = (req, res, next) => (req.user?.role === "empresa" && req.user.entityId ? next() : res.status(403).json({ error: "Apenas a empresa acessa o ERP e os pedidos" }));

router.get("/erp", soEmpresa, rota((req, res) => res.json(erp.resumoErp(req.user.entityId))));
router.post("/erp/conectar", soEmpresa, rota(async (req, res) => res.json(await erp.conectarErp(req.user.entityId, String(req.body?.provedor || ""), req.body?.dados || {}))));
router.post("/erp/bling/iniciar", soEmpresa, rota((req, res) => {
  if (!erp.blingConfigurado()) return res.status(503).json({ error: "A RYCS ainda está ativando a conexão com o Bling." });
  const state = jwt.sign({ tipo: "bling-login", companyId: req.user.entityId, n: randomBytes(8).toString("hex") }, SECRET, { expiresIn: "15m" });
  res.json({ url: erp.urlBling(state) });
}));
router.post("/erp/sincronizar", soEmpresa, rota((req, res) => { erp.sincronizarEmSegundoPlano(req.user.entityId); res.json({ ok: true }); }));
router.delete("/erp", soEmpresa, rota((req, res) => { erp.desconectarErp(req.user.entityId); res.json({ ok: true }); }));

router.get("/pedidos", soEmpresa, rota((req, res) => res.json({ pedidos: pedidos.listarPedidos(req.user.entityId, { status: String(req.query.status || "") }), erp: erp.resumoErp(req.user.entityId) })));
router.get("/pedidos/catalogo", soEmpresa, rota((req, res) => res.json({ produtos: pedidos.catalogo(req.user.entityId, String(req.query.busca || "")) })));
router.get("/pedidos/clientes", soEmpresa, rota((req, res) => res.json({ clientes: erp.buscarContatos(req.user.entityId, String(req.query.busca || "")) })));
router.post("/pedidos", soEmpresa, rota((req, res) => res.json(pedidos.criarManual(req.user.entityId, req.user.id, req.body))));
router.post("/pedidos/gerar", soEmpresa, rota(async (req, res) => res.json(await pedidos.gerar(req.user.entityId, req.user.id, { conversaId: String(req.body?.conversaId || ""), leadId: String(req.body?.leadId || "") }))));
router.get("/pedidos/:id", soEmpresa, rota((req, res) => {
  const p = pedidos.pedidoDe(req.user.entityId, req.params.id);
  return p ? res.json(p) : res.status(404).json({ error: "Pedido não encontrado." });
}));
router.patch("/pedidos/:id", soEmpresa, rota((req, res) => res.json(pedidos.editar(req.user.entityId, req.params.id, req.body || {}))));
router.post("/pedidos/:id/aprovar", soEmpresa, rota((req, res) => res.json(pedidos.aprovar(req.user.entityId, req.params.id, req.user.id))));
router.post("/pedidos/:id/enviar", soEmpresa, rota(async (req, res) => res.json(await pedidos.enviarAoErp(req.user.entityId, req.params.id, { reenviar: req.body?.reenviar === true }))));
router.post("/pedidos/:id/cancelar", soEmpresa, rota((req, res) => res.json(pedidos.cancelar(req.user.entityId, req.params.id))));

erp.iniciarErp();

export default router;

import { Router } from "express";
import {
  buscarPlaces, salvarContatos, revelarContato, contatosRevelados,
  resumoConsumo, listarPastas, criarPasta, renomearPasta, excluirPasta,
  listarListas, criarLista, renomearLista, excluirLista,
  adicionarContatoLista, removerContatoLista, contatosDaLista, listarPrecos,
  cicloAtual, historicoFaturas, fecharCiclo,
  adminResumo, adminAtualizarPreco, adminListarCiclos,
  vincularListaCampanha, desvincularLista, listarVinculosDaLista,
  listarVinculosDaCampanha, sincronizarVinculosAutomaticos, indicadoresLista,
} from "../services/lojaLeads.js";

const router = Router();

function entityDe(req) {
  const r = req.user?.role;
  if (r === "empresa") return { entityId: req.user.entityId, entityRole: "empresa" };
  if (r === "vendedor") return { entityId: req.user.entityId, entityRole: "vendedor" };
  return null;
}

// ── Buscar contatos via Google Places ───────────────────────────────────────
router.post("/loja-leads/buscar", async (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  const { texto, regiao, pageToken } = req.body || {};
  if (!texto) return res.status(400).json({ error: "Informe o que buscar." });

  const r = await buscarPlaces(texto, { regiao, pageToken });
  if (r.error) return res.status(400).json(r);

  const ids = salvarContatos(r.contatos);
  const contatos = r.contatos.map((c, i) => ({ ...c, id: ids[i] }));

  // Marcar quais já foram revelados
  const revelados = new Set(contatosRevelados(ent.entityId).map((c) => c.id));
  for (const c of contatos) c.revelado = revelados.has(c.id);

  res.json({ contatos, nextPageToken: r.nextPageToken });
});

// ── Revelar contato (registrar consumo) ─────────────────────────────────────
router.post("/loja-leads/revelar", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  const { contatoId } = req.body || {};
  if (!contatoId) return res.status(400).json({ error: "Informe o contato." });
  const r = revelarContato(ent.entityId, ent.entityRole, contatoId);
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

// ── Contatos revelados ──────────────────────────────────────────────────────
router.get("/loja-leads/revelados", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  res.json({ contatos: contatosRevelados(ent.entityId) });
});

// ── Resumo de consumo ───────────────────────────────────────────────────────
router.get("/loja-leads/consumo", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  res.json(resumoConsumo(ent.entityId));
});

// ── Pastas ──────────────────────────────────────────────────────────────────
router.get("/loja-leads/pastas", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  res.json({ pastas: listarPastas(ent.entityId, ent.entityRole) });
});

router.post("/loja-leads/pastas", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  const { nome, cor } = req.body || {};
  res.json(criarPasta(ent.entityId, ent.entityRole, nome, cor));
});

// ── Listas ──────────────────────────────────────────────────────────────────
router.get("/loja-leads/listas/:pastaId", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  res.json({ listas: listarListas(req.params.pastaId) });
});

router.post("/loja-leads/listas", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  const { pastaId, nome, descricao } = req.body || {};
  if (!pastaId) return res.status(400).json({ error: "Informe a pasta." });
  const r = criarLista(pastaId, ent.entityId, ent.entityRole, nome, descricao);
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

router.post("/loja-leads/listas/adicionar", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  const { listaId, contatoId } = req.body || {};
  if (!listaId || !contatoId) return res.status(400).json({ error: "Informe lista e contato." });
  res.json(adicionarContatoLista(listaId, contatoId));
});

router.get("/loja-leads/listas/:listaId/contatos", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  res.json({ contatos: contatosDaLista(req.params.listaId) });
});

// ── Renomear / excluir pasta ────────────────────────────────────────────────
router.patch("/loja-leads/pastas/:id", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  const { nome, cor } = req.body || {};
  res.json(renomearPasta(req.params.id, ent.entityId, nome, cor));
});

router.delete("/loja-leads/pastas/:id", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  const r = excluirPasta(req.params.id, ent.entityId);
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

// ── Renomear / excluir lista ────────────────────────────────────────────────
router.patch("/loja-leads/listas/:id", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  const { nome, descricao } = req.body || {};
  res.json(renomearLista(req.params.id, ent.entityId, nome, descricao));
});

router.delete("/loja-leads/listas/:id", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  const r = excluirLista(req.params.id, ent.entityId);
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

router.post("/loja-leads/listas/remover", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  const { listaId, contatoId } = req.body || {};
  if (!listaId || !contatoId) return res.status(400).json({ error: "Informe lista e contato." });
  res.json(removerContatoLista(listaId, contatoId));
});

// ── Vincular lista à campanha ───────────────────────────────────────────────
router.post("/loja-leads/vincular", (req, res) => {
  const ent = entityDe(req);
  if (!ent || ent.entityRole !== "empresa") return res.status(403).json({ error: "Apenas empresas podem vincular listas a campanhas." });
  const { listaId, campaignId, modo } = req.body || {};
  if (!listaId || !campaignId) return res.status(400).json({ error: "Informe lista e campanha." });
  const r = vincularListaCampanha(listaId, campaignId, ent.entityId, modo);
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

router.delete("/loja-leads/vinculos/:id", (req, res) => {
  const ent = entityDe(req);
  if (!ent || ent.entityRole !== "empresa") return res.status(403).json({ error: "Acesso negado." });
  const r = desvincularLista(req.params.id, ent.entityId);
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

router.get("/loja-leads/vinculos/lista/:listaId", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  res.json({ vinculos: listarVinculosDaLista(req.params.listaId) });
});

router.get("/loja-leads/vinculos/campanha/:campaignId", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  res.json({ vinculos: listarVinculosDaCampanha(req.params.campaignId) });
});

router.post("/loja-leads/sincronizar/:campaignId", (req, res) => {
  const ent = entityDe(req);
  if (!ent || ent.entityRole !== "empresa") return res.status(403).json({ error: "Acesso negado." });
  const r = sincronizarVinculosAutomaticos(req.params.campaignId);
  res.json(r);
});

router.get("/loja-leads/listas/:listaId/indicadores", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  res.json(indicadoresLista(req.params.listaId));
});

// ── Ciclo de faturamento ────────────────────────────────────────────────────
router.get("/loja-leads/ciclo", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  res.json(cicloAtual(ent.entityId, ent.entityRole));
});

router.get("/loja-leads/faturas", (req, res) => {
  const ent = entityDe(req);
  if (!ent) return res.status(403).json({ error: "Acesso negado." });
  res.json({ faturas: historicoFaturas(ent.entityId, ent.entityRole) });
});

// ── Preços ──────────────────────────────────────────────────────────────────
router.get("/loja-leads/precos", (_req, res) => {
  res.json({ precos: listarPrecos() });
});

// ── Admin ───────────────────────────────────────────────────────────────────
const somenteAdmin = (req, res) => {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Acesso restrito." }); return false; }
  return true;
};

router.get("/loja-leads/admin/resumo", (req, res) => {
  if (!somenteAdmin(req, res)) return;
  res.json(adminResumo());
});

router.get("/loja-leads/admin/ciclos", (req, res) => {
  if (!somenteAdmin(req, res)) return;
  const { status } = req.query;
  res.json({ ciclos: adminListarCiclos(status) });
});

router.post("/loja-leads/admin/fechar-ciclo", (req, res) => {
  if (!somenteAdmin(req, res)) return;
  const { cicloId } = req.body || {};
  if (!cicloId) return res.status(400).json({ error: "Informe o ciclo." });
  const r = fecharCiclo(cicloId);
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

router.post("/loja-leads/admin/precos", (req, res) => {
  if (!somenteAdmin(req, res)) return;
  const { id, valorUnitario } = req.body || {};
  if (!id || valorUnitario == null) return res.status(400).json({ error: "Informe id e valor." });
  const r = adminAtualizarPreco(id, valorUnitario);
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

export default router;

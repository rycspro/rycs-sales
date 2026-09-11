import { Router } from "express";
import db from "../db.js";
import {
  politicaVigente, salvarPolitica, consultar, consultarPorTarefa,
  filaDeRevisao, revisar, dataset, metricas, estadoDaFila, capacidadesDisponiveis,
} from "../services/audit/index.js";
import { sinaisDe } from "../services/audit/sinais.js";
import { FONTES, POLITICAS_PADRAO } from "../../shared/audit/politica.js";
import { ESTADOS_VISIVEIS } from "../../shared/audit/decisao.js";
import { notificar } from "./notifications.js";

const router = Router();

// Quem pode ver uma auditoria: o profissional que a originou, a empresa
// contratante e a plataforma. Ninguém mais — as evidências têm nome e telefone
// de clientes reais.
function podeVer(req, pedido) {
  const { role, entityId } = req.user;
  if (role === "admin") return true;
  if (role === "vendedor") return entityId === pedido.sellerId;
  if (role === "empresa") return entityId === pedido.companyId;
  return false;
}

// O que cada papel enxerga é diferente. O profissional vê o resultado e os
// motivos; empresa e plataforma veem também os sinais antifraude, que
// revelariam ao profissional exatamente o que burlar.
function projetar(pedido, role) {
  const base = {
    id: pedido.id,
    taskId: pedido.taskId,
    status: pedido.status,
    decisao: pedido.decisao,
    score: pedido.score,
    cobertura: pedido.cobertura,
    motivo: pedido.motivo,
    detalhe: pedido.detalhe,
    politica: { nome: pedido.politicaSnapshot?.nome, versao: pedido.policyVersao },
    criadoEm: pedido.criadoEm,
    concluidoEm: pedido.concluidoEm,
    visivel: pedido.status === "concluido"
      ? ESTADOS_VISIVEIS[pedido.decisao] || ESTADOS_VISIVEIS.processando
      : ESTADOS_VISIVEIS.processando,
    explicacao: {
      aprovado: pedido.explicacao?.aprovado || [],
      problemas: pedido.explicacao?.problemas || [],
      naoVerificado: pedido.explicacao?.naoVerificado || [],
    },
  };
  if (role === "vendedor") return base;
  return { ...base, itens: pedido.explicacao?.itens || [], sinais: sinaisDe(pedido.id) };
}

// --------------------------------------------------------- consultas ----

router.get("/audit/task/:taskId", (req, res) => {
  const pedido = consultarPorTarefa(req.params.taskId);
  if (!pedido) return res.status(404).json({ error: "Esta ação não tem auditoria registrada." });
  if (!podeVer(req, pedido)) return res.status(403).json({ error: "Sem permissão" });
  res.json(projetar(pedido, req.user.role));
});

router.get("/audit/:id", (req, res) => {
  const pedido = consultar(req.params.id);
  if (!pedido) return res.status(404).json({ error: "Auditoria não encontrada" });
  if (!podeVer(req, pedido)) return res.status(403).json({ error: "Sem permissão" });
  res.json(projetar(pedido, req.user.role));
});

// ---------------------------------------------------------- políticas ----

router.get("/audit/policies/:tipo", (req, res) => {
  const { role, entityId } = req.user;
  if (!["empresa", "admin"].includes(role)) return res.status(403).json({ error: "Sem permissão" });
  const companyId = role === "empresa" ? entityId : (req.query.companyId || null);
  const politica = politicaVigente({ companyId, tipo: req.params.tipo });
  res.json({
    politica,
    herdada: politica ? politica.companyId === null : false,
    fontes: FONTES,
    modelos: POLITICAS_PADRAO.filter((p) => p.tipo === req.params.tipo),
    capacidades: capacidadesDisponiveis(),
  });
});

router.post("/audit/policies", (req, res) => {
  const { role, entityId, id } = req.user;
  if (!["empresa", "admin"].includes(role)) return res.status(403).json({ error: "Sem permissão" });
  // Empresa só escreve política da própria empresa. A política da plataforma
  // (companyId null) é exclusiva do admin.
  const companyId = role === "empresa" ? entityId : (req.body?.companyId || null);
  const r = salvarPolitica({ companyId, politica: req.body?.politica, criadoPor: id });
  if (r.erro) return res.status(400).json({ error: r.erro });
  res.json(r);
});

// ----------------------------------------------------- revisão humana ----

router.get("/audit/review/queue", (req, res) => {
  const { role, entityId } = req.user;
  if (!["empresa", "admin"].includes(role)) return res.status(403).json({ error: "Sem permissão" });
  res.json({ fila: filaDeRevisao({ companyId: role === "empresa" ? entityId : null }) });
});

router.post("/audit/:id/review", (req, res) => {
  const { role, id: revisorId } = req.user;
  if (!["empresa", "admin"].includes(role)) return res.status(403).json({ error: "Sem permissão" });

  const pedido = consultar(req.params.id);
  if (!pedido) return res.status(404).json({ error: "Auditoria não encontrada" });
  if (!podeVer(req, pedido)) return res.status(403).json({ error: "Sem permissão" });

  const { decisao, motivo } = req.body || {};
  if (decisao !== "revisao" && !String(motivo || "").trim())
    return res.status(400).json({ error: "Escreva o motivo da decisão. O profissional precisa saber o que aconteceu." });

  const r = revisar({ auditRequestId: pedido.id, revisorId, revisorRole: role, decisaoFinal: decisao, motivo });
  if (r.erro) return res.status(400).json({ error: r.erro });

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(pedido.sellerId);
  if (user) {
    const texto = {
      aprovado: "Sua evidência foi aprovada na revisão humana.",
      recusado: "Sua evidência não foi aprovada na revisão humana.",
      revisao: "Pedimos uma nova evidência para esta ação.",
    }[decisao];
    notificar(user.id, "submissao", "Resultado da revisão", motivo ? `${texto}\n\n${motivo}` : texto);
  }

  res.json(r);
});

// ------------------------------------------------- painel da plataforma ----

router.get("/audit/engine/status", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });
  res.json({
    capacidades: capacidadesDisponiveis(),
    fila: estadoDaFila(),
    metricas: metricas({ dias: Number(req.query.dias) || 7 }),
  });
});

// Dataset de feedback humano. É o insumo de um modelo próprio no futuro, então
// sai sem conteúdo de evidência: só entrada do motor, decisão e correção.
router.get("/audit/engine/dataset", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });
  res.json({ registros: dataset({ limite: Math.min(5000, Number(req.query.limite) || 1000) }) });
});

export default router;

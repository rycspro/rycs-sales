// Motor de gamificação do profissional.
//
// Calcula XP e conquistas a partir de DADOS REAIS (tarefas, certificados,
// avaliações, perfil, ganhos) e os grava de forma IDEMPOTENTE: cada evento tem
// uma chave única por profissional, então reprocessar (no login, num hook, ou
// na rotina retroativa) nunca concede XP em dobro. Nada vem do frontend.
//
// Esta camada é SEPARADA de sellers.nota (RYCS Score) e sellers.nivel
// (operacional) — não lê nem escreve nesses campos.

import db, { agora, uid } from "../db.js";
import { CONQUISTAS, CONQUISTA_POR_ID, nivelPorXp, XP_POR_TAREFA_ADICIONAL } from "../../shared/gamificacao.js";
import { selectSellers } from "./sellerLeve.js";

const n = (v) => Number(v) || 0;

function contarConcluidas(tabela, sellerId) {
  try {
    const r = db.prepare(`SELECT COUNT(*) AS c FROM ${tabela} WHERE sellerId = ? AND status = 'concluido'`).get(sellerId);
    return r?.c || 0;
  } catch { return 0; }
}

// Métricas reais do profissional — a base de tudo. Uma leitura só, sem efeitos.
export function metricas(sellerId) {
  const seller = db.prepare(selectSellers("WHERE id = ?")).get(sellerId);
  if (!seller) return null;

  let pc = {};
  try { pc = JSON.parse(seller.perfilComercial || "{}") || {}; } catch {}
  const temLista = (k) => Array.isArray(pc[k]) && pc[k].length > 0;

  const tarefasAprovadas = db.prepare("SELECT COUNT(*) AS c FROM submissions WHERE sellerId = ? AND status = 'liberado'").get(sellerId)?.c || 0;
  const ganhosConfirmados = Math.round((db.prepare(
    "SELECT COALESCE(SUM(COALESCE(liquido, valor)), 0) AS s FROM submissions WHERE sellerId = ? AND status = 'liberado'"
  ).get(sellerId)?.s || 0) * 100) / 100;
  const saquePago = (db.prepare("SELECT COUNT(*) AS c FROM withdrawals WHERE sellerId = ? AND status = 'pago'").get(sellerId)?.c || 0) > 0 ? 1 : 0;

  let certificados = 0, treinosConcluidos = 0;
  try { certificados = db.prepare("SELECT COUNT(*) AS c FROM course_certificates WHERE sellerId = ?").get(sellerId)?.c || 0; } catch {}
  try { treinosConcluidos = db.prepare("SELECT COUNT(*) AS c FROM course_enrollments WHERE sellerId = ? AND concluidoEm IS NOT NULL").get(sellerId)?.c || 0; } catch {}

  // Avaliações distintas (instrumentos diferentes). DISC conta uma vez, seja a
  // versão nova (disc_assessments) ou o resultado legado (sellers.disc).
  let discLegado = false;
  try { discLegado = !!(JSON.parse(seller.disc || "{}")?.predominante); } catch {}
  const discFeito = discLegado || contarConcluidas("disc_assessments", sellerId) > 0;
  const avaliacoesDistintas =
    (discFeito ? 1 : 0) +
    (contarConcluidas("bigfive_assessments", sellerId) > 0 ? 1 : 0) +
    (contarConcluidas("autossabotagem_assessments", sellerId) > 0 ? 1 : 0) +
    (contarConcluidas("inteligencia_emocional_assessments", sellerId) > 0 ? 1 : 0);

  const bioTexto = String(seller.bio || "").replace(/<[^>]*>/g, "").trim();
  const perfilEssencial = !!(seller.nome && seller.whats && seller.cidade && (temLista("areasAtuacao") || temLista("cargosExp"))) ? 1 : 0;
  const perfilCompleto = !!(perfilEssencial && temLista("areasAtuacao") && temLista("habilidades") && temLista("segmentos") && pc.disponibilidade && pc.anosExperiencia) ? 1 : 0;

  return {
    contaCriada: 1,
    perfilEssencial,
    perfilCompleto,
    bioSalva: bioTexto.length >= 20 ? 1 : 0,
    videoEnviado: String(seller.videoApresentacao || "").length > 0 ? 1 : 0,
    avaliacoesDistintas,
    certificados,
    treinosConcluidos,
    tarefasAprovadas,
    ganhosConfirmados,
    saquePago,
  };
}

const insXp = db.prepare("INSERT OR IGNORE INTO gamification_xp (id, sellerId, chave, xp, motivo, criadoEm) VALUES (?, ?, ?, ?, ?, ?)");
const insBadge = db.prepare("INSERT OR IGNORE INTO gamification_badges (id, sellerId, badgeId, criadoEm) VALUES (?, ?, ?, ?)");

// Reconhece conquistas e concede XP a partir das métricas reais. Idempotente:
// seguro para rodar no login, em hooks de evento e como rotina retroativa.
export function avaliarProfissional(sellerId) {
  const m = metricas(sellerId);
  if (!m) return { novas: [] };
  const ts = agora();
  const novas = [];

  const jaTem = new Set(
    db.prepare("SELECT badgeId FROM gamification_badges WHERE sellerId = ?").all(sellerId).map((r) => r.badgeId)
  );

  const tx = db.transaction(() => {
    for (const c of CONQUISTAS) {
      const atingiu = n(m[c.metrica]) >= c.alvo;
      if (!atingiu || jaTem.has(c.id)) continue;
      const okBadge = insBadge.run(uid(), sellerId, c.id, ts);
      if (okBadge.changes && c.xp > 0) insXp.run(uid(), sellerId, `badge:${c.id}`, c.xp, `Conquista: ${c.nome}`, ts);
      if (okBadge.changes) novas.push(c.id);
    }

    // XP incremental por tarefa aprovada além da primeira (a primeira já é
    // recompensada pela conquista "Primeira Entrega").
    const liberadas = db.prepare("SELECT id FROM submissions WHERE sellerId = ? AND status = 'liberado' ORDER BY criadoEm ASC, id ASC").all(sellerId);
    liberadas.slice(1).forEach((s) => {
      insXp.run(uid(), sellerId, `tarefa:${s.id}`, XP_POR_TAREFA_ADICIONAL, "Tarefa aprovada", ts);
    });
  });
  tx();

  return { novas };
}

// Estado completo para a tela (depois de avaliar). Não escreve nada.
export function estadoGamificacao(sellerId) {
  const m = metricas(sellerId) || {};
  const xpTotal = db.prepare("SELECT COALESCE(SUM(xp), 0) AS s FROM gamification_xp WHERE sellerId = ?").get(sellerId)?.s || 0;
  const nivel = nivelPorXp(xpTotal);

  const desbloqueadas = {};
  db.prepare("SELECT badgeId, criadoEm FROM gamification_badges WHERE sellerId = ?").all(sellerId)
    .forEach((r) => { desbloqueadas[r.badgeId] = r.criadoEm; });

  const conquistas = CONQUISTAS.map((c) => {
    const atual = Math.min(n(m[c.metrica]), c.alvo);
    const desbloqueada = !!desbloqueadas[c.id];
    return {
      id: c.id, categoria: c.categoria, nome: c.nome, descricao: c.descricao, xp: c.xp,
      desbloqueada,
      conquistadoEm: desbloqueadas[c.id] || null,
      progresso: { atual, alvo: c.alvo, pct: c.alvo ? Math.min(100, Math.round((atual / c.alvo) * 100)) : 0 },
    };
  });

  const conquistadas = conquistas.filter((c) => c.desbloqueada).length;

  // Missões: próximas conquistas alcançáveis (não desbloqueadas), mais perto do
  // alvo primeiro, com o destino na plataforma.
  const DESTINO = {
    perfil: "perfil", avaliacoes: "testes", academy: "academy",
    performance: "oportunidades", ganhos: "oportunidades",
  };
  const missoes = conquistas
    .filter((c) => !c.desbloqueada && c.xp > 0)
    .sort((a, b) => b.progresso.pct - a.progresso.pct)
    .slice(0, 4)
    .map((c) => ({
      id: c.id, nome: c.nome, descricao: c.descricao, xp: c.xp,
      categoria: c.categoria, destino: DESTINO[c.categoria] || "painel",
      progresso: c.progresso,
    }));

  return {
    xp: xpTotal,
    nivel,
    conquistas,
    resumo: { conquistadas, total: conquistas.length },
    missoes,
    metricas: m,
  };
}

// RYCS Club — camada administrativa (imagens, prêmios, resgates).
//
// Reutiliza as MÉTRICAS reais do motor de gamificação (server/services/
// gamificacao.js) para calcular elegibilidade de prêmios (Modelo A — desbloqueio
// por marco). Não toca em finanças, score ou nível operacional. Prêmios nascem
// em rascunho e só aparecem ao profissional quando publicados.

import db, { agora, uid } from "../db.js";
import { metricas } from "./gamificacao.js";

// Métricas que um prêmio pode usar como critério. Lista fechada e validada no
// backend — o admin escolhe de um menu, nunca escreve regra arbitrária.
export const METRICAS_PREMIO = {
  tarefasAprovadas: "Tarefas aprovadas",
  avaliacoesDistintas: "Avaliações concluídas",
  certificados: "Certificados conquistados",
  treinosConcluidos: "Treinamentos concluídos",
  ganhosConfirmados: "Ganhos confirmados (R$)",
  perfilCompleto: "Perfil completo",
};

export const ESTADOS_RESGATE = ["solicitado", "analise", "aprovado", "enviado", "entregue", "recusado"];

// ── Imagens configuráveis (banner, níveis, medalhas) ──────────────────────────
export function imagensConfig() {
  const map = {};
  for (const r of db.prepare("SELECT chave, url FROM club_config").all()) if (r.url) map[r.chave] = r.url;
  return map;
}

export function setImagem(chave, url) {
  db.prepare(`INSERT INTO club_config (chave, url, atualizadoEm) VALUES (?, ?, ?)
    ON CONFLICT(chave) DO UPDATE SET url = excluded.url, atualizadoEm = excluded.atualizadoEm`)
    .run(String(chave), String(url || ""), agora());
}

// ── Prêmios ───────────────────────────────────────────────────────────────────
function serializarPremio(p, m, resgate) {
  const valor = Number(m?.[p.metrica] || 0);
  const alvo = Number(p.alvo || 0);
  const atual = Math.min(valor, alvo);
  return {
    id: p.id, nome: p.nome, descricao: p.descricao, tipo: p.tipo,
    imagem: p.imagem || "", status: p.status,
    paises: safeJson(p.paises, []), quantidade: p.quantidade ?? null,
    requisito: {
      metrica: p.metrica, label: METRICAS_PREMIO[p.metrica] || p.metrica,
      alvo, atual, pct: alvo ? Math.min(100, Math.round((atual / alvo) * 100)) : 0,
    },
    elegivel: alvo > 0 && valor >= alvo,
    resgate: resgate ? { estado: resgate.estado, criadoEm: resgate.criadoEm } : null,
  };
}

function safeJson(s, fb) { try { return JSON.parse(s); } catch { return fb; } }

// Visão do profissional: só prêmios publicados, com progresso e elegibilidade.
export function premiosDoProfissional(sellerId) {
  const m = metricas(sellerId) || {};
  const resgates = {};
  db.prepare("SELECT * FROM club_redemptions WHERE sellerId = ?").all(sellerId).forEach((r) => { resgates[r.prizeId] = r; });
  return db.prepare("SELECT * FROM club_prizes WHERE status = 'publicado' ORDER BY ordem ASC, criadoEm ASC").all()
    .map((p) => serializarPremio(p, m, resgates[p.id]));
}

// Visão do admin: todos os prêmios (qualquer status), sem métrica de um seller.
export function premiosAdmin() {
  return db.prepare("SELECT * FROM club_prizes ORDER BY ordem ASC, criadoEm ASC").all()
    .map((p) => serializarPremio(p, {}, null));
}

export function salvarPremio(dados, id) {
  const ts = agora();
  const metrica = METRICAS_PREMIO[dados.metrica] ? dados.metrica : "";
  const tipo = dados.tipo === "digital" ? "digital" : "fisico";
  const status = ["rascunho", "publicado", "arquivado"].includes(dados.status) ? dados.status : "rascunho";
  const paises = JSON.stringify(Array.isArray(dados.paises) ? dados.paises : []);
  const quantidade = dados.quantidade === null || dados.quantidade === undefined || dados.quantidade === "" ? null : Math.max(0, parseInt(dados.quantidade, 10) || 0);
  if (id) {
    const existe = db.prepare("SELECT id FROM club_prizes WHERE id = ?").get(id);
    if (!existe) return null;
    db.prepare(`UPDATE club_prizes SET nome=?, descricao=?, tipo=?, imagem=?, metrica=?, alvo=?, paises=?, quantidade=?, status=?, ordem=?, atualizadoEm=? WHERE id=?`)
      .run(String(dados.nome || "").trim(), String(dados.descricao || ""), tipo, String(dados.imagem || ""), metrica, Number(dados.alvo) || 0, paises, quantidade, status, parseInt(dados.ordem, 10) || 0, ts, id);
    return db.prepare("SELECT * FROM club_prizes WHERE id = ?").get(id);
  }
  const novo = uid();
  db.prepare(`INSERT INTO club_prizes (id, nome, descricao, tipo, imagem, metrica, alvo, paises, quantidade, status, ordem, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(novo, String(dados.nome || "").trim() || "Novo prêmio", String(dados.descricao || ""), tipo, String(dados.imagem || ""), metrica, Number(dados.alvo) || 0, paises, quantidade, status, parseInt(dados.ordem, 10) || 0, ts, ts);
  return db.prepare("SELECT * FROM club_prizes WHERE id = ?").get(novo);
}

export function removerPremio(id) {
  db.prepare("DELETE FROM club_prizes WHERE id = ?").run(id);
}

// ── Resgates ──────────────────────────────────────────────────────────────────
// Cria um pedido de resgate — só se o prêmio está publicado, elegível e ainda
// não resgatado. Nesta versão não há automação de envio.
export function solicitarResgate(sellerId, prizeId, endereco) {
  const p = db.prepare("SELECT * FROM club_prizes WHERE id = ? AND status = 'publicado'").get(prizeId);
  if (!p) return { error: "Prêmio indisponível." };
  const valor = Number(metricas(sellerId)?.[p.metrica] || 0);
  if (!(Number(p.alvo) > 0 && valor >= Number(p.alvo))) return { error: "Você ainda não atingiu o requisito deste prêmio." };
  const existe = db.prepare("SELECT id FROM club_redemptions WHERE sellerId = ? AND prizeId = ?").get(sellerId, prizeId);
  if (existe) return { error: "Você já solicitou o resgate deste prêmio." };
  if (p.tipo === "fisico" && !String(endereco || "").trim()) return { error: "Informe o endereço de entrega.", precisaEndereco: true };
  const ts = agora();
  db.prepare(`INSERT INTO club_redemptions (id, sellerId, prizeId, estado, endereco, criadoEm, atualizadoEm) VALUES (?, ?, ?, 'solicitado', ?, ?, ?)`)
    .run(uid(), sellerId, prizeId, p.tipo === "fisico" ? String(endereco).trim() : "", ts, ts);
  return { ok: true };
}

export function resgatesAdmin() {
  return db.prepare(`
    SELECT r.*, s.nome AS sellerNome, p.nome AS prizeNome, p.tipo AS prizeTipo
    FROM club_redemptions r
    LEFT JOIN sellers s ON s.id = r.sellerId
    LEFT JOIN club_prizes p ON p.id = r.prizeId
    ORDER BY r.criadoEm DESC
  `).all();
}

export function atualizarResgate(id, estado) {
  if (!ESTADOS_RESGATE.includes(estado)) return { error: "Estado inválido." };
  const r = db.prepare("SELECT id FROM club_redemptions WHERE id = ?").get(id);
  if (!r) return { error: "Resgate não encontrado." };
  db.prepare("UPDATE club_redemptions SET estado = ?, atualizadoEm = ? WHERE id = ?").run(estado, agora(), id);
  return { ok: true };
}

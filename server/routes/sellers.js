import { Router } from "express";
import { avaliarFoto } from "../../shared/fotoPerfil.js";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { emailCadastroCompletadoAdmin } from "../services/email.js";

const ADMIN_NOTIF_EMAIL = process.env.ADMIN_NOTIF_EMAIL || "contato@martinbusiness.com.br";

function cadastroCompleto(s) {
  if (!s.foto || !s.titulo || !s.bio || !s.disponibilidade || !s.cidade) return false;
  for (const campo of ["segmentos", "modalidades", "skills"]) {
    let lista = []; try { lista = JSON.parse(s[campo] || "[]"); } catch {}
    if (!lista.length) return false;
  }
  return true;
}

function notificarCadastroCompleto(sellerId) {
  const s = db.prepare("SELECT id, nome, email, foto, titulo, bio, disponibilidade, cidade, segmentos, modalidades, skills, cadastroCompletadoNotificado FROM sellers WHERE id = ?").get(sellerId);
  if (!s || !cadastroCompleto(s) || s.cadastroCompletadoNotificado) return;
  db.prepare("UPDATE sellers SET cadastroCompletadoNotificado = 1 WHERE id = ?").run(sellerId);
  emailCadastroCompletadoAdmin({ nomeProfissional: s.nome, emailProfissional: s.email, adminEmail: ADMIN_NOTIF_EMAIL });
}

const router = Router();

// Cache de 60s para a lista base de profissionais (sem dados de empresa)
let _profCache = null;
let _profCacheTs = 0;
function getProfissionaisBase() {
  const now = Date.now();
  if (_profCache && now - _profCacheTs < 60000) return _profCache;
  _profCache = db.prepare(`SELECT id, nome, sobrenome, pais, cidade, estado, perfil, experiencia, nota, nivel, video, perfilComercial,
    CASE WHEN foto IS NOT NULL AND foto != '' THEN 1 ELSE 0 END AS temFoto,
    titulo, bio, segmentos, modalidades, skills, disponibilidade, dataNascimento, genero, criadoEm, status
    FROM sellers WHERE status IN ('aprovado','parcial') ORDER BY nota DESC, criadoEm DESC LIMIT 200`).all();
  _profCacheTs = now;
  return _profCache;
}
export function invalidarCacheProfissionais() { _profCacheTs = 0; }

router.get("/professionals/active", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });
  const companyId = req.user.entityId;
  const rows = getProfissionaisBase();
  const certificacoes = db.prepare("SELECT sellerId, funcao, nivel, percentual FROM certifications").all();
  const pedidos = new Map(db.prepare("SELECT sellerId, status FROM partnership_requests WHERE companyId = ?").all(companyId).map((p) => [p.sellerId, p.status]));
  const notas = new Map(db.prepare("SELECT sellerId, observacao FROM professional_notes WHERE companyId = ?").all(companyId).map((n) => [n.sellerId, n.observacao]));
  const metricas = new Map(db.prepare(`
    SELECT sellerId,
      COUNT(*) tarefas,
      SUM(CASE WHEN status = 'liberado' THEN 1 ELSE 0 END) aprovadas,
      SUM(CASE WHEN status = 'recusado' THEN 1 ELSE 0 END) recusadas,
      SUM(CASE WHEN status = 'liberado' THEN COALESCE(liquido, valor, 0) ELSE 0 END) ganhos,
      SUM(CASE WHEN status = 'liberado' AND tipo = 'agendamento' THEN 1 ELSE 0 END) reunioes,
      SUM(CASE WHEN status = 'liberado' AND tipo = 'realizada' THEN 1 ELSE 0 END) visitas,
      SUM(CASE WHEN status = 'liberado' AND tipo = 'venda' THEN 1 ELSE 0 END) vendas
    FROM submissions WHERE companyId = ? GROUP BY sellerId
  `).all(companyId).map((m) => [m.sellerId, m]));
  const campanhas = db.prepare(`
    SELECT ca.sellerId, c.id, c.titulo, c.funcao, c.regiao, c.status, ca.status candidaturaStatus
    FROM campaign_applications ca JOIN campaigns c ON c.id = ca.campaignId
    WHERE c.companyId = ?
    ORDER BY ca.criadoEm DESC
  `).all(companyId);
  const leads = new Map(db.prepare("SELECT sellerId, COUNT(*) total FROM leads WHERE companyId = ? GROUP BY sellerId").all(companyId).map((l) => [l.sellerId, l.total]));
  res.json(rows.map((s) => {
    let perfilComercial = {}; try { perfilComercial = JSON.parse(s.perfilComercial || "{}"); } catch {}
    const lista = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };
    const m = metricas.get(s.id) || {};
    const cs = campanhas.filter((c) => c.sellerId === s.id);
    const ativas = cs.filter((c) => c.candidaturaStatus === "aprovado" && c.status !== "encerrada");
    return {
      ...s, perfilComercial,
      foto: s.temFoto ? `/api/sellers/${s.id}/foto` : null,
      temFoto: undefined,
      segmentos: lista(s.segmentos), modalidades: lista(s.modalidades), skills: lista(s.skills),
      certificacoes: certificacoes.filter((c) => c.sellerId === s.id),
      campanhas: cs,
      campanhasAtivas: ativas.length,
      tarefasRealizadas: Number(m.tarefas || 0),
      tarefasAprovadas: Number(m.aprovadas || 0),
      tarefasRecusadas: Number(m.recusadas || 0),
      taxaAprovacao: Number(m.tarefas || 0) ? Math.round(Number(m.aprovadas || 0) / Number(m.tarefas || 0) * 100) : 0,
      ganhosTotais: Number(m.ganhos || 0),
      reunioesGeradas: Number(m.reunioes || 0),
      visitas: Number(m.visitas || 0),
      vendas: Number(m.vendas || 0),
      resultadosGerados: Number(m.reunioes || 0) + Number(m.visitas || 0) + Number(m.vendas || 0) + Number(leads.get(s.id) || 0),
      leadsGerados: Number(leads.get(s.id) || 0),
      observacaoInterna: notas.get(s.id) || "",
      parceria: pedidos.get(s.id) || null,
    };
  }));
});

// Foto do profissional — retorna a data URI como imagem real com cache de 1h
router.get("/sellers/:id/foto", (req, res) => {
  const row = db.prepare("SELECT foto FROM sellers WHERE id = ?").get(req.params.id);
  if (!row?.foto) return res.status(404).end();
  const dataUri = row.foto;
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return res.status(404).end();
  const [, mime, b64] = match;
  const buf = Buffer.from(b64, "base64");
  res.set({
    "Content-Type": mime,
    "Cache-Control": "public, max-age=3600, immutable",
    "Content-Length": buf.length,
  });
  res.end(buf);
});

router.post("/professionals/:id/note", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });
  const seller = db.prepare("SELECT id FROM sellers WHERE id = ? AND status IN ('aprovado','parcial')").get(req.params.id);
  if (!seller) return res.status(404).json({ error: "Profissional ativo não encontrado" });
  const observacao = String(req.body?.observacao || "").slice(0, 1200);
  db.prepare(`INSERT INTO professional_notes (companyId, sellerId, observacao, atualizadoEm)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(companyId, sellerId) DO UPDATE SET observacao = excluded.observacao, atualizadoEm = excluded.atualizadoEm`)
    .run(req.user.entityId, seller.id, observacao, agora());
  res.json({ ok: true, observacao });
});

router.post("/professionals/:id/partnership", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });
  const seller = db.prepare("SELECT id, status FROM sellers WHERE id = ? AND status IN ('aprovado','parcial')").get(req.params.id);
  if (!seller) return res.status(404).json({ error: "Profissional ativo não encontrado" });
  const id = uid();
  const mensagem = String(req.body?.mensagem || "").slice(0, 600);
  db.prepare(`INSERT INTO partnership_requests (id, companyId, sellerId, status, mensagem, origem, criadoEm)
    VALUES (?, ?, ?, 'pendente', ?, 'empresa', ?)
    ON CONFLICT(companyId, sellerId) DO UPDATE SET status = 'pendente', mensagem = excluded.mensagem, criadoEm = excluded.criadoEm, respondidoEm = NULL`)
    .run(id, req.user.entityId, seller.id, mensagem, agora());
  const user = db.prepare("SELECT id FROM users WHERE role = 'vendedor' AND entityId = ?").get(seller.id);
  const company = db.prepare("SELECT nome FROM companies WHERE id = ?").get(req.user.entityId);
  if (user) notificar(user.id, "parceria", `${company?.nome || "Uma empresa"} solicitou parceria`, "Revise o convite na área de empresas.");
  res.json({ id, status: "pendente" });
});

router.get("/partnerships/invitations", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  res.json(db.prepare(`SELECT p.*, c.nome AS empresaNome, c.produto, c.segmento
    FROM partnership_requests p JOIN companies c ON c.id = p.companyId
    WHERE p.sellerId = ? ORDER BY p.criadoEm DESC`).all(req.user.entityId));
});

router.patch("/partnerships/:id", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const status = req.body?.status;
  if (!["aprovado", "recusado"].includes(status)) return res.status(400).json({ error: "Resposta inválida" });
  const pedido = db.prepare("SELECT * FROM partnership_requests WHERE id = ? AND sellerId = ?").get(req.params.id, req.user.entityId);
  if (!pedido) return res.status(404).json({ error: "Convite não encontrado" });
  db.transaction(() => {
    db.prepare("UPDATE partnership_requests SET status = ?, respondidoEm = ? WHERE id = ?").run(status, agora(), pedido.id);
    if (status === "aprovado") db.prepare(`INSERT INTO applications (sellerId, companyId, status) VALUES (?, ?, 'aprovado')
      ON CONFLICT(sellerId, companyId) DO UPDATE SET status = 'aprovado'`).run(pedido.sellerId, pedido.companyId);
  })();
  const user = db.prepare("SELECT id FROM users WHERE role = 'empresa' AND entityId = ?").get(pedido.companyId);
  if (user) notificar(user.id, "parceria", status === "aprovado" ? "Parceria aceita" : "Parceria recusada", status === "aprovado" ? "O profissional já aparece no seu Time." : "O profissional recusou o convite.");
  res.json({ ok: true, status });
});

router.post("/sellers", (req, res) => {
  if (req.user.role !== "vendedor" && req.user.role !== "admin")
    return res.status(403).json({ error: "Sem permissão" });

  const { nome, email, whats, cidade, perfil, experiencia, pix, nota, video, respostas } = req.body;
  const id = uid();
  db.prepare(`
    INSERT INTO sellers (id, nome, email, whats, cidade, perfil, experiencia, status, nota, pix, disponivel, pendente, sacado, respostas, video, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'triagem', ?, ?, 0, 0, 0, ?, ?, ?)
  `).run(id, nome, email, whats, cidade || "", perfil || "sdr", experiencia || "", nota || 100, pix || "", JSON.stringify(respostas || []), video || "", agora());
  res.json({ id });
});

router.patch("/sellers/:id", (req, res) => {
  const { id } = req.params;
  const { role, entityId } = req.user;

  if (role === "vendedor" && entityId !== id)
    return res.status(403).json({ error: "Sem permissão para editar outro vendedor" });

  const fields = req.body;
  // Campos financeiros (disponivel/pendente/sacado) NUNCA podem ser escritos
  // pelo próprio vendedor: valem dinheiro real via Pix. Só o servidor os move,
  // ao liberar uma ação ou processar um saque.
  const sellerFields = ["nome", "sobrenome", "pais", "email", "whats", "cidade", "estado", "perfil", "experiencia",
    "pix", "pixTipo", "video", "titulo", "bio", "disponibilidade", "cidadeBase", "estadoBase", "raioKm", "latBase", "lngBase", "dataNascimento", "genero"];
  // Campos de lista chegam como array e são guardados como JSON.
  const camposLista = ["segmentos", "modalidades", "regioes", "skills"];
  const adminFields = [...sellerFields, "status", "nota"];
  const allowed = role === "admin" ? adminFields : sellerFields;

  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) {
      sets.push(`${k} = ?`);
      // Texto livre entra com teto: bio sem limite é convite para o campo
      // virar depósito de qualquer coisa.
      vals.push(typeof v === "string" ? v.slice(0, k === "bio" ? 1200 : 300) : v);
    } else if (camposLista.includes(k) && role !== "empresa") {
      sets.push(`${k} = ?`);
      vals.push(JSON.stringify((Array.isArray(v) ? v : []).slice(0, 20).map((x) => String(x).slice(0, 60))));
    }
  }
  if (!sets.length) return res.status(400).json({ error: "nenhum campo válido" });
  vals.push(id);
  db.prepare(`UPDATE sellers SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  notificarCadastroCompleto(id);
  res.json({ ok: true });
});

// Tabelas que penduram dados no vendedor. A ordem importa: os filhos saem
// antes do pai, senão a foreign key barra a exclusão.
const DEPENDENTES = [
  ["assessment_answers", "sellerId"],
  ["assessments", "sellerId"],
  ["lead_events", "sellerId"],
  ["leads", "sellerId"],
  ["academy_attempts", "sellerId"],
  ["academy_progress", "sellerId"],
  ["certifications", "sellerId"],
  ["score_dimensions", "sellerId"],
  ["course_progress", "sellerId"],
  ["campaign_applications", "sellerId"],
  ["applications", "sellerId"],
  ["partnership_requests", "sellerId"],
  ["messages", "sellerId"],
  ["submissions", "sellerId"],
  ["withdrawals", "sellerId"],
];

// Exclusão definitiva de um profissional. Só a plataforma pode chamar.
//
// O registro em platform_earnings NÃO é apagado: é o livro de receita da
// plataforma, não dado do vendedor. Apagar histórico contábil junto com a
// conta transformaria um cadastro removido em um buraco na auditoria.
router.delete("/sellers/:id", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });

  const { id } = req.params;
  const vendedor = db.prepare("SELECT id, nome, email, disponivel, pendente FROM sellers WHERE id = ?").get(id);
  if (!vendedor) return res.status(404).json({ error: "Profissional não encontrado" });

  // Conta com dinheiro parado é recusada por padrão: apagar o cadastro faria
  // a plataforma ficar com um saldo que era de alguém. Quem insiste assume a
  // decisão explicitamente com ?forcar=true.
  const saqueAberto = db.prepare(
    "SELECT COUNT(*) n FROM withdrawals WHERE sellerId = ? AND status = 'solicitado'"
  ).get(id).n;
  const saldo = (vendedor.disponivel || 0) + (vendedor.pendente || 0);
  const forcar = req.query.forcar === "true";

  if (!forcar && (saldo > 0 || saqueAberto)) {
    return res.status(409).json({
      error: "Profissional com valores em aberto",
      disponivel: vendedor.disponivel,
      pendente: vendedor.pendente,
      saquesAbertos: saqueAberto,
      comoProsseguir: "Repasse o saldo antes de excluir, ou repita com ?forcar=true.",
    });
  }

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(id);
  const removidos = {};

  db.transaction(() => {
    for (const [tabela, coluna] of DEPENDENTES) {
      const r = db.prepare(`DELETE FROM ${tabela} WHERE ${coluna} = ?`).run(id);
      if (r.changes) removidos[tabela] = r.changes;
    }
    if (user) {
      for (const tabela of ["notifications", "uploads"]) {
        const r = db.prepare(`DELETE FROM ${tabela} WHERE userId = ?`).run(user.id);
        if (r.changes) removidos[tabela] = r.changes;
      }
      const ref = db.prepare(
        "DELETE FROM referrals WHERE indicadorUserId = ? OR indicadoUserId = ?"
      ).run(user.id, user.id);
      if (ref.changes) removidos.referrals = ref.changes;
      db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    }
    db.prepare("DELETE FROM sellers WHERE id = ?").run(id);
  })();

  console.log(`[admin] profissional excluído: ${vendedor.nome} <${vendedor.email}>`);
  res.json({ removido: { id, nome: vendedor.nome, email: vendedor.email }, registros: removidos, forcado: forcar });
});

// Foto de perfil.
//
// Guardada como data URI no próprio registro: um avatar de até 2 MB não
// justifica depender de S3 configurado, e sem storage o upload seria só
// aparência. Quando o bucket existir, esta rota passa a gravar a chave em vez
// do conteúdo — quem consome lê `foto` do mesmo jeito.
router.post("/sellers/:id/foto", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "admin" && entityId !== req.params.id)
    return res.status(403).json({ error: "Sem permissão" });

  const { base64, mimetype, largura, altura } = req.body || {};
  if (!base64) return res.status(400).json({ error: "Envie a imagem" });

  const tamanhoBytes = Math.round((String(base64).length * 3) / 4);
  const avaliacao = avaliarFoto({ mimetype, tamanhoBytes, largura: Number(largura), altura: Number(altura) });

  if (!avaliacao.aprovada) {
    return res.status(422).json({
      error: "A foto não passou na verificação de apresentação.",
      avaliacao,
    });
  }

  const dataUri = `data:${mimetype};base64,${base64}`;
  db.prepare("UPDATE sellers SET foto = ?, fotoScore = ? WHERE id = ?")
    .run(dataUri, avaliacao.score, req.params.id);
  notificarCadastroCompleto(req.params.id);
  res.json({ ok: true, avaliacao, foto: dataUri });
});

router.delete("/sellers/:id/foto", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "admin" && entityId !== req.params.id)
    return res.status(403).json({ error: "Sem permissão" });
  db.prepare("UPDATE sellers SET foto = '', fotoScore = NULL WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;

import { Router } from "express";
import { enviarDataUri } from "../services/midia.js";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { avaliarFoto } from "../../shared/fotoPerfil.js";
import { detalharScore, pontosVendedor, explicacaoScore, perfilCompleto, COLUNAS_PERFIL } from "../../shared/perfilVendedor.js";
import { aoAtualizarPerfil } from "../services/sequenciasEmail.js";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { emailCadastroCompletadoAdmin } from "../services/email.js";
import { ordenarComDesempate, pode, TOLERANCIA_DESEMPATE } from "../../shared/planosProfissional.js";
import { planosAtuais } from "../services/planosProfissional.js";
import { nivelPorXp, FAIXAS } from "../../shared/gamificacao.js";

const ADMIN_NOTIF_EMAIL = process.env.ADMIN_NOTIF_EMAIL || "contato@martinbusiness.com.br";

const cadastroCompleto = perfilCompleto;

function notificarCadastroCompleto(sellerId) {
  const s = db.prepare(`SELECT id, nome, email, foto, ${COLUNAS_PERFIL}, cadastroCompletadoNotificado FROM sellers WHERE id = ?`).get(sellerId);
  if (!s || !cadastroCompleto(s)) return;
  // Reativa conta inativada por perfil incompleto e conta o bônus de indicação.
  try { aoAtualizarPerfil(sellerId); } catch (e) { console.warn("[perfil] pós-completo:", e.message); }
  if (s.cadastroCompletadoNotificado) return;
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
  _profCache = db.prepare(`SELECT id, nome, sobrenome, pais, cidade, estado, perfil, experiencia, nota, scoreTriagem, nivel, video, perfilComercial,
    CASE WHEN foto IS NOT NULL AND foto != '' THEN 1 ELSE 0 END AS temFoto,
    CASE WHEN curriculo IS NOT NULL AND curriculo != '' THEN 1 ELSE 0 END AS temCurriculo, curriculoNome,
    titulo, bio, segmentos, modalidades, skills, disponibilidade, dataNascimento, genero, criadoEm, status, xpRespostas, disc
    FROM sellers WHERE inativoEm IS NULL ORDER BY nota DESC, criadoEm DESC LIMIT 200`).all();
  _profCacheTs = now;
  return _profCache;
}
export function invalidarCacheProfissionais() { _profCacheTs = 0; }

router.get("/professionals/active", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });
  const companyId = req.user.entityId;
  // Desempate do Pro: só reordena dentro da mesma faixa de Score; com a
  // tolerância pendente (null) a lista sai como sempre saiu.
  let rows = getProfissionaisBase();
  if (TOLERANCIA_DESEMPATE) {
    const planos = planosAtuais();
    rows = ordenarComDesempate(rows, (s) => pode(planos.get(s.id) || "gratis", "desempateScore"));
  }
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
  // Patente/nível do profissional (gamificação): XP acumulado por conquistas.
  const xpPorSeller = new Map(db.prepare("SELECT sellerId, COALESCE(SUM(xp), 0) AS xp FROM gamification_xp GROUP BY sellerId").all().map((r) => [r.sellerId, r.xp]));
  res.json(rows.map((s) => {
    let perfilComercial = {}; try { perfilComercial = JSON.parse(s.perfilComercial || "{}"); } catch {}
    const lista = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };
    let xp = {}, disc = {};
    try { xp = JSON.parse(s.xpRespostas || "{}"); } catch {}
    try { disc = JSON.parse(s.disc || "{}"); } catch {}
    const { pos: pontosPositivos, neg: pontosNegativos } = (() => { const r = pontosVendedor(xp, disc); return { pos: r.positivos, neg: r.negativos }; })();
    const m = metricas.get(s.id) || {};
    const cs = campanhas.filter((c) => c.sellerId === s.id);
    const ativas = cs.filter((c) => c.candidaturaStatus === "aprovado" && c.status !== "encerrada");
    return {
      ...s, perfilComercial,
      xpRespostas: undefined, disc: undefined,
      scoreDetalhe: detalharScore(xp, disc),
      scoreExplicacao: explicacaoScore(xp, disc),
      pontosPositivos, pontosNegativos,
      foto: s.temFoto ? `/api/sellers/${s.id}/foto` : null,
      temFoto: undefined,
      curriculo: s.temCurriculo ? `/api/sellers/${s.id}/curriculo` : null,
      temCurriculo: undefined,
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
      nivelGamificacao: (() => {
        const n = nivelPorXp(xpPorSeller.get(s.id) || 0);
        return { chave: n.chave, nome: n.nome, cor: n.cor, numero: n.numero, xp: n.xp, totalNiveis: FAIXAS.length, progresso: n.progresso, proximoNome: n.proximo?.nome || null };
      })(),
    };
  }));
});

// Pré-visualização do próprio perfil como as empresas o veem (a MESMA ficha de
// /professionals/active, para um único profissional: o dono logado). Reaproveita
// a mesma montagem/score, sem os campos específicos de uma empresa (métricas de
// tarefas, parceria, observação interna), que dependem de um companyId e não
// existem numa prévia neutra. É o perfil "público" que qualquer empresa vê antes
// de interagir. Não expõe xpRespostas/disc crus (iguais à rota de empresa).
router.get("/professionals/me", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  const sellerId = req.user.entityId;
  if (!sellerId) return res.status(403).json({ error: "Perfil profissional não encontrado" });

  const s = getProfissionaisBase().find((r) => r.id === sellerId);
  if (!s) return res.status(404).json({ error: "Profissional não encontrado" });

  const certificacoes = db.prepare("SELECT sellerId, funcao, nivel, percentual FROM certifications WHERE sellerId = ?").all(sellerId);
  // Canais de contato próprios (não vêm na base compartilhada): é o próprio dono
  // vendo o perfil, então exibi-los aqui não expõe dado de terceiro.
  const contato = db.prepare("SELECT whats, email FROM sellers WHERE id = ?").get(sellerId) || {};
  let perfilComercial = {}; try { perfilComercial = JSON.parse(s.perfilComercial || "{}"); } catch {}
  const lista = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };
  let xp = {}, disc = {};
  try { xp = JSON.parse(s.xpRespostas || "{}"); } catch {}
  try { disc = JSON.parse(s.disc || "{}"); } catch {}
  const { positivos: pontosPositivos, negativos: pontosNegativos } = pontosVendedor(xp, disc);

  res.json({
    ...s, perfilComercial,
    whats: contato.whats || null, email: contato.email || null,
    xpRespostas: undefined, disc: undefined,
    scoreDetalhe: detalharScore(xp, disc),
    scoreExplicacao: explicacaoScore(xp, disc),
    pontosPositivos, pontosNegativos,
    foto: s.temFoto ? `/api/sellers/${s.id}/foto` : null,
    temFoto: undefined,
    curriculo: s.temCurriculo ? `/api/sellers/${s.id}/curriculo` : null,
    temCurriculo: undefined,
    segmentos: lista(s.segmentos), modalidades: lista(s.modalidades), skills: lista(s.skills),
    certificacoes,
    // Sem contexto de empresa: campanhas/métricas específicas ficam neutras.
    campanhas: [],
    campanhasAtivas: 0,
    tarefasRealizadas: 0, tarefasAprovadas: 0, tarefasRecusadas: 0, taxaAprovacao: 0,
    ganhosTotais: 0, reunioesGeradas: 0, visitas: 0, vendas: 0,
    resultadosGerados: 0, leadsGerados: 0,
    observacaoInterna: "",
    parceria: null,
    nivelGamificacao: (() => {
      const totalXp = db.prepare("SELECT COALESCE(SUM(xp), 0) AS xp FROM gamification_xp WHERE sellerId = ?").get(sellerId)?.xp || 0;
      const n = nivelPorXp(totalXp);
      return { chave: n.chave, nome: n.nome, cor: n.cor, numero: n.numero, xp: n.xp, totalNiveis: FAIXAS.length, progresso: n.progresso, proximoNome: n.proximo?.nome || null };
    })(),
    ehPreviaPropria: true,
  });
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

// Currículo do profissional — a empresa (e o admin) pode visualizar; o próprio
// profissional também. Serve o arquivo com o nome original, inline no navegador.
router.get("/sellers/:id/curriculo", (req, res) => {
  const papel = req.user?.role;
  if (!["empresa", "admin"].includes(papel) && req.user?.entityId !== req.params.id)
    return res.status(403).json({ error: "Sem permissão" });
  const row = db.prepare("SELECT curriculo, curriculoNome FROM sellers WHERE id = ?").get(req.params.id);
  if (!row?.curriculo) return res.status(404).end();
  const match = String(row.curriculo).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return res.status(404).end();
  const [, mime, b64] = match;
  const buf = Buffer.from(b64, "base64");
  const ext = mime === "application/pdf" ? ".pdf" : (mime.includes("word") || mime.includes("officedocument")) ? ".docx" : "";
  let nome = String(row.curriculoNome || "curriculo").replace(/[^\w.\- ]+/g, "_");
  if (ext && !nome.toLowerCase().endsWith(ext)) nome += ext;
  res.set({
    "Content-Type": mime,
    "Content-Disposition": `inline; filename="${nome}"`,
    "Cache-Control": "private, max-age=600",
    "Content-Length": buf.length,
  });
  res.end(buf);
});

// Enviar / trocar o currículo pelo próprio profissional (depois do cadastro).
// Só o dono mexe no próprio currículo. PDF ou Word, até ~8MB (mesma regra do
// cadastro em auth.js).
const CURRICULO_TIPOS = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

// Vídeo de apresentação do profissional, que o /state entrega como endereço.
// Mesma regra do currículo: empresa, admin e o próprio profissional.
router.get("/sellers/:id/video-apresentacao", (req, res) => {
  const papel = req.user?.role;
  if (!["empresa", "admin"].includes(papel) && req.user?.entityId !== req.params.id)
    return res.status(403).json({ error: "Sem permissão" });
  const row = db.prepare("SELECT videoApresentacao FROM sellers WHERE id = ?").get(req.params.id);
  enviarDataUri(req, res, row?.videoApresentacao);
});

router.post("/sellers/:id/curriculo", (req, res) => {
  if (req.user.role !== "vendedor" || req.user.entityId !== req.params.id)
    return res.status(403).json({ error: "Sem permissão" });
  const seller = db.prepare("SELECT id FROM sellers WHERE id = ?").get(req.params.id);
  if (!seller) return res.status(404).json({ error: "Profissional não encontrado" });

  const { base64, mimetype, nome } = req.body || {};
  if (!base64 || !mimetype) return res.status(400).json({ error: "Envie o arquivo do currículo." });
  if (!CURRICULO_TIPOS.includes(mimetype))
    return res.status(422).json({ error: "Envie o currículo em PDF ou Word.", campo: "curriculo" });
  const bytes = Math.round((String(base64).length * 3) / 4);
  if (bytes > 8 * 1024 * 1024)
    return res.status(422).json({ error: "O currículo deve ter no máximo 8MB.", campo: "curriculo" });

  const dataUri = `data:${mimetype};base64,${base64}`;
  const nomeLimpo = String(nome || "curriculo").slice(0, 160);
  db.prepare("UPDATE sellers SET curriculo = ?, curriculoNome = ? WHERE id = ?")
    .run(dataUri, nomeLimpo, req.params.id);

  res.json({ ok: true, curriculoNome: nomeLimpo, url: `/api/sellers/${req.params.id}/curriculo` });
});

router.delete("/sellers/:id/curriculo", (req, res) => {
  if (req.user.role !== "vendedor" || req.user.entityId !== req.params.id)
    return res.status(403).json({ error: "Sem permissão" });
  db.prepare("UPDATE sellers SET curriculo = '', curriculoNome = '' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.post("/professionals/:id/note", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });
  const seller = db.prepare("SELECT id FROM sellers WHERE id = ?").get(req.params.id);
  if (!seller) return res.status(404).json({ error: "Profissional não encontrado" });
  const observacao = String(req.body?.observacao || "").slice(0, 1200);
  db.prepare(`INSERT INTO professional_notes (companyId, sellerId, observacao, atualizadoEm)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(companyId, sellerId) DO UPDATE SET observacao = excluded.observacao, atualizadoEm = excluded.atualizadoEm`)
    .run(req.user.entityId, seller.id, observacao, agora());
  res.json({ ok: true, observacao });
});

router.post("/professionals/:id/partnership", (req, res) => {
  if (req.user.role !== "empresa") return res.status(403).json({ error: "Apenas empresas" });
  const seller = db.prepare("SELECT id, status FROM sellers WHERE id = ?").get(req.params.id);
  if (!seller) return res.status(404).json({ error: "Profissional não encontrado" });
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
    VALUES (?, ?, ?, ?, ?, ?, ?, 'aprovado', ?, ?, 0, 0, 0, ?, ?, ?)
  `).run(id, nome, email, whats, cidade || "", perfil || "sdr", experiencia || "", nota || 100, pix || "", JSON.stringify(respostas || []), video || "", agora());
  res.json({ id });
});

// ─── ADMIN: Redefinir senha de um profissional ────────────────────────────────
router.post("/admin/sellers/:id/reset-senha", (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Apenas admin" });
  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuário do profissional não encontrado" });
  const novaSenha = randomBytes(8).toString("base64url");
  db.prepare("UPDATE users SET senha = ? WHERE id = ?").run(bcrypt.hashSync(novaSenha, 10), user.id);
  res.json({ ok: true, novaSenha });
});

router.patch("/sellers/:id", (req, res) => {
  const { id } = req.params;
  const { role, entityId } = req.user;

  if (role === "empresa") return res.status(403).json({ error: "Empresas não podem editar perfis de profissionais" });
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
  // perfilComercial é um bloco JSON. Mesclamos as chaves do currículo comercial
  // (as mesmas do cadastro) preservando o resto do objeto — nunca sobrescrever
  // disc/experiencia nem perder o que já existe.
  if (fields.perfilComercial && typeof fields.perfilComercial === "object" && !Array.isArray(fields.perfilComercial) && role !== "empresa") {
    const row = db.prepare("SELECT perfilComercial FROM sellers WHERE id = ?").get(id);
    let atual = {};
    try { atual = JSON.parse(row?.perfilComercial || "{}") || {}; } catch {}
    const limpo = {};
    for (const c of ["areasAtuacao", "habilidades", "segmentos", "ferramentas", "conhecimentos", "equipamentos"]) {
      if (Array.isArray(fields.perfilComercial[c]))
        limpo[c] = fields.perfilComercial[c].slice(0, 40).map((x) => String(x).slice(0, 80));
    }
    for (const c of ["anosExperiencia", "disponibilidade"]) {
      if (typeof fields.perfilComercial[c] === "string")
        limpo[c] = fields.perfilComercial[c].slice(0, 80);
    }
    if (Array.isArray(fields.perfilComercial.cargosExp))
      limpo.cargosExp = fields.perfilComercial.cargosExp.slice(0, 20).map((x) => String(x).slice(0, 40));
    if (Array.isArray(fields.perfilComercial.formacoes))
      limpo.formacoes = fields.perfilComercial.formacoes.slice(0, 20)
        .map((f) => ({ tipo: String(f?.tipo || "").slice(0, 60), descricao: String(f?.descricao || "").slice(0, 200) }))
        .filter((f) => f.tipo || f.descricao);
    if (Array.isArray(fields.perfilComercial.idiomas))
      limpo.idiomas = fields.perfilComercial.idiomas.slice(0, 20)
        .map((i) => ({ idioma: String(i?.idioma || "").slice(0, 40), nivel: String(i?.nivel || "").slice(0, 40) }))
        .filter((i) => i.idioma);
    sets.push("perfilComercial = ?");
    vals.push(JSON.stringify({ ...atual, ...limpo }));
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

  const { base64, mimetype, largura, altura, original, enquadramento } = req.body || {};
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
  // `original` acompanha o upload de uma imagem NOVA (Trocar): guardamos a origem
  // sem recorte para o editor poder reajustar depois. No reenquadramento (Editar)
  // ele não vem, e a origem é preservada. `enquadramento` são os parâmetros do
  // recorte (zoom, rotação, deslocamento) — JSON pequeno.
  const colunas = ["foto = ?", "fotoScore = ?"];
  const valores = [dataUri, avaliacao.score];
  if (original?.base64 && original?.mimetype) {
    colunas.push("fotoOriginal = ?");
    valores.push(`data:${original.mimetype};base64,${original.base64}`);
  }
  if (enquadramento !== undefined) {
    colunas.push("fotoEnquadramento = ?");
    valores.push(JSON.stringify(enquadramento || {}));
  }
  valores.push(req.params.id);
  db.prepare(`UPDATE sellers SET ${colunas.join(", ")} WHERE id = ?`).run(...valores);
  notificarCadastroCompleto(req.params.id);
  res.json({ ok: true, avaliacao, foto: dataUri });
});

// Imagem ORIGINAL (sem recorte), para o editor de enquadramento. Cai na foto
// recortada quando ainda não há original guardada (usuários antigos).
router.get("/sellers/:id/foto-original", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "admin" && entityId !== req.params.id) return res.status(403).end();
  const row = db.prepare("SELECT fotoOriginal, foto FROM sellers WHERE id = ?").get(req.params.id);
  const uri = row?.fotoOriginal || row?.foto;
  if (!uri) return res.status(404).end();
  const m = /^data:([^;]+);base64,(.*)$/s.exec(uri);
  if (!m) return res.status(404).end();
  res.set("Content-Type", m[1]);
  res.send(Buffer.from(m[2], "base64"));
});

router.delete("/sellers/:id/foto", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "admin" && entityId !== req.params.id)
    return res.status(403).json({ error: "Sem permissão" });
  db.prepare("UPDATE sellers SET foto = '', fotoScore = NULL, fotoOriginal = '', fotoEnquadramento = '{}' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;

// Canais de atendimento da aba Leads (WhatsApp e Instagram): conexões,
// conversas e mensagens num lugar só. Quem fala com a Meta são os arquivos
// canaisWhatsapp.js e canaisInstagram.js; aqui ficam o banco e as permissões.
//
// Número da empresa: todas as conversas são da empresa.
// Número do vendedor: é pessoal. A conversa só é guardada se o contato for um
// lead que esse vendedor atende para essa empresa. O resto do WhatsApp dele
// não entra no banco e ninguém da RYCS ou da empresa enxerga.

import db, { uid, agora } from "../db.js";
import { mesmoTelefone, chaveTelefone, janelaAberta } from "../../shared/canais.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS canais_conexoes (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    sellerId TEXT,
    canal TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativa',
    contaId TEXT NOT NULL DEFAULT '',
    externoId TEXT NOT NULL,
    nome TEXT NOT NULL DEFAULT '',
    numero TEXT NOT NULL DEFAULT '',
    foto TEXT NOT NULL DEFAULT '',
    token TEXT NOT NULL DEFAULT '',
    tokenExpiraEm INTEGER,
    tokenRenovadoEm INTEGER,
    coexistencia INTEGER NOT NULL DEFAULT 0,
    auditoriaIA INTEGER NOT NULL DEFAULT 1,
    consentimentoEm INTEGER NOT NULL,
    consentimentoUserId TEXT NOT NULL,
    dados TEXT NOT NULL DEFAULT '{}',
    ultimoEventoEm INTEGER,
    ultimoErro TEXT NOT NULL DEFAULT '',
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    UNIQUE (canal, externoId)
  );
  CREATE INDEX IF NOT EXISTS idx_canais_conexoes_empresa ON canais_conexoes(companyId, canal);

  CREATE TABLE IF NOT EXISTS canais_conversas (
    id TEXT PRIMARY KEY,
    conexaoId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    sellerId TEXT,
    canal TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'direta',
    contatoExterno TEXT NOT NULL,
    contatoAlternativo TEXT NOT NULL DEFAULT '',
    nome TEXT NOT NULL DEFAULT '',
    usuario TEXT NOT NULL DEFAULT '',
    telefone TEXT NOT NULL DEFAULT '',
    leadId TEXT,
    midiaId TEXT NOT NULL DEFAULT '',
    ultimaEm INTEGER NOT NULL DEFAULT 0,
    ultimaRecebidaEm INTEGER,
    ultimaTexto TEXT NOT NULL DEFAULT '',
    ultimaDirecao TEXT NOT NULL DEFAULT '',
    naoLidas INTEGER NOT NULL DEFAULT 0,
    auditadaAte INTEGER NOT NULL DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    UNIQUE (conexaoId, tipo, contatoExterno)
  );
  CREATE INDEX IF NOT EXISTS idx_canais_conversas_lista ON canais_conversas(companyId, canal, ultimaEm);
  CREATE INDEX IF NOT EXISTS idx_canais_conversas_lead ON canais_conversas(leadId);

  CREATE TABLE IF NOT EXISTS canais_mensagens (
    id TEXT PRIMARY KEY,
    conversaId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    externoId TEXT NOT NULL,
    direcao TEXT NOT NULL,
    origem TEXT NOT NULL DEFAULT 'cliente',
    tipo TEXT NOT NULL DEFAULT 'texto',
    texto TEXT NOT NULL DEFAULT '',
    dados TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT '',
    erro TEXT NOT NULL DEFAULT '',
    autorUserId TEXT NOT NULL DEFAULT '',
    em INTEGER NOT NULL,
    criadoEm INTEGER NOT NULL,
    UNIQUE (conversaId, externoId)
  );
  CREATE INDEX IF NOT EXISTS idx_canais_mensagens_conversa ON canais_mensagens(conversaId, em);
  CREATE INDEX IF NOT EXISTS idx_canais_mensagens_externo ON canais_mensagens(externoId);

  CREATE TABLE IF NOT EXISTS canais_auditorias (
    id TEXT PRIMARY KEY,
    conversaId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    motor TEXT NOT NULL,
    resultado TEXT NOT NULL,
    ateMensagemEm INTEGER NOT NULL,
    criadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_canais_auditorias_conversa ON canais_auditorias(conversaId, criadoEm);
`);

// Coluna nova (aditiva): apelido por conexão. Fica aqui porque a tabela é
// criada neste arquivo — em db.js ela ainda não existe num banco novo.
if (!db.prepare("PRAGMA table_info(canais_conexoes)").all().some((c) => c.name === "apelido")) {
  db.exec("ALTER TABLE canais_conexoes ADD COLUMN apelido TEXT DEFAULT ''");
}

export const erroCanal = (msg, status = 400) => Object.assign(new Error(msg), { validacao: true, http: status });

// ── Conexões ──────────────────────────────────────────────────────────────

export const conexaoPorExterno = (canal, externoId) =>
  db.prepare("SELECT * FROM canais_conexoes WHERE canal = ? AND externoId = ?").get(canal, String(externoId || "")) || null;
export const conexaoPorId = (id) => db.prepare("SELECT * FROM canais_conexoes WHERE id = ?").get(id) || null;

export function salvarConexao(c) {
  const t = agora();
  const existe = conexaoPorExterno(c.canal, c.externoId);
  if (existe && (existe.companyId !== c.companyId || (existe.sellerId || null) !== (c.sellerId || null))) {
    if (existe.status !== "desconectada") throw erroCanal(c.canal === "whatsapp" ? "Este número já está conectado em outra conta da RYCS." : "Este Instagram já está conectado em outra conta da RYCS.", 409);
    // Número que mudou de dono: a conexão antiga fica guardada com o histórico
    // de quem a fez, e a nova começa do zero.
    db.prepare("UPDATE canais_conexoes SET externoId = externoId || '#' || id, atualizadoEm = ? WHERE id = ?").run(t, existe.id);
  }
  const atual = conexaoPorExterno(c.canal, c.externoId);
  if (atual) {
    db.prepare(`UPDATE canais_conexoes SET status = 'ativa', contaId = ?, nome = ?, numero = ?, foto = ?, token = ?, tokenExpiraEm = ?, tokenRenovadoEm = ?,
      coexistencia = ?, consentimentoEm = ?, consentimentoUserId = ?, dados = ?, ultimoErro = '', atualizadoEm = ? WHERE id = ?`)
      .run(c.contaId || "", c.nome || "", c.numero || "", c.foto || "", c.token, c.tokenExpiraEm || null, t, c.coexistencia ? 1 : 0, t, c.userId, JSON.stringify(c.dados || {}), t, atual.id);
    return conexaoPorId(atual.id);
  }
  const id = uid();
  db.prepare(`INSERT INTO canais_conexoes (id, companyId, sellerId, canal, contaId, externoId, nome, numero, foto, token, tokenExpiraEm, tokenRenovadoEm,
    coexistencia, consentimentoEm, consentimentoUserId, dados, criadoEm, atualizadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, c.companyId, c.sellerId || null, c.canal, c.contaId || "", String(c.externoId), c.nome || "", c.numero || "", c.foto || "", c.token,
      c.tokenExpiraEm || null, t, c.coexistencia ? 1 : 0, t, c.userId, JSON.stringify(c.dados || {}), t, t);
  return conexaoPorId(id);
}

export function marcarErroConexao(id, erro, { expirou = false } = {}) {
  db.prepare("UPDATE canais_conexoes SET ultimoErro = ?, status = CASE WHEN ? THEN 'expirada' ELSE status END, atualizadoEm = ? WHERE id = ?")
    .run(String(erro || "").slice(0, 300), expirou ? 1 : 0, agora(), id);
}

export function encerrarConexao(id) {
  db.prepare("UPDATE canais_conexoes SET status = 'desconectada', token = '', atualizadoEm = ? WHERE id = ?").run(agora(), id);
}

// Apaga a conexão com todo o histórico dela.
export function apagarConexao(id) {
  db.transaction(() => {
    db.prepare("DELETE FROM canais_auditorias WHERE conversaId IN (SELECT id FROM canais_conversas WHERE conexaoId = ?)").run(id);
    db.prepare("DELETE FROM canais_mensagens WHERE conversaId IN (SELECT id FROM canais_conversas WHERE conexaoId = ?)").run(id);
    db.prepare("DELETE FROM canais_conversas WHERE conexaoId = ?").run(id);
    db.prepare("DELETE FROM canais_conexoes WHERE id = ?").run(id);
  })();
}

const resumo = (c) => ({
  id: c.id, canal: c.canal, status: c.status, nome: c.nome, numero: c.numero, foto: c.foto, coexistencia: !!c.coexistencia,
  auditoriaIA: !!c.auditoriaIA, sellerId: c.sellerId, vendedor: c.vendedor || "", ultimoEventoEm: c.ultimoEventoEm, ultimoErro: c.ultimoErro, criadoEm: c.criadoEm,
});
export function listarConexoes({ companyId, canal, sellerId = undefined }) {
  const cond = ["c.companyId = ?", "c.status != 'desconectada'"], args = [companyId];
  if (canal) { cond.push("c.canal = ?"); args.push(canal); }
  if (sellerId !== undefined) { cond.push("c.sellerId = ?"); args.push(sellerId); }
  return db.prepare(`SELECT c.*, s.nome AS vendedor FROM canais_conexoes c LEFT JOIN sellers s ON s.id = c.sellerId WHERE ${cond.join(" AND ")} ORDER BY c.criadoEm`).all(...args).map(resumo);
}

// ── Entrada de mensagens ──────────────────────────────────────────────────

export function leadDoTelefone({ companyId, sellerId = null, telefone }) {
  const chave = chaveTelefone(telefone);
  if (!chave) return null;
  const linhas = db.prepare(`SELECT id, nome, telefone, sellerId FROM leads WHERE companyId = ? AND telefone != '' ${sellerId ? "AND sellerId = ?" : ""}
    AND replace(replace(replace(replace(replace(telefone,' ',''),'-',''),'(',''),')',''),'+','') LIKE ? ORDER BY criadoEm DESC`)
    .all(companyId, ...(sellerId ? [sellerId] : []), `%${chave.slice(-8)}`);
  return linhas.find((l) => mesmoTelefone(l.telefone, telefone)) || null;
}

// WhatsApp pessoal (Evolution): o profissional atende várias empresas com um só
// número. Acha o lead entre as empresas onde ele está APROVADO — nunca em outras,
// o que mantém o isolamento. Prefere lead do próprio vendedor e o mais recente.
export function leadDoTelefoneEntreEmpresas({ sellerId, telefone }) {
  const chave = chaveTelefone(telefone);
  if (!chave || !sellerId) return null;
  const linhas = db.prepare(`SELECT l.id, l.nome, l.telefone, l.sellerId, l.companyId FROM leads l
    JOIN applications a ON a.companyId = l.companyId AND a.sellerId = ? AND a.status = 'aprovado'
    WHERE l.telefone != '' AND replace(replace(replace(replace(replace(l.telefone,' ',''),'-',''),'(',''),')',''),'+','') LIKE ?
    ORDER BY (l.sellerId = ?) DESC, l.criadoEm DESC`)
    .all(sellerId, `%${chave.slice(-8)}`, sellerId);
  return linhas.find((l) => mesmoTelefone(l.telefone, telefone)) || null;
}

export const vendedorAprovado = (companyId, sellerId) =>
  !!db.prepare("SELECT 1 FROM applications WHERE sellerId = ? AND companyId = ? AND status = 'aprovado'").get(String(sellerId || ""), companyId);

// Grava uma mensagem, criando a conversa se for a primeira. Idempotente pelo
// id da Meta. Devolve null quando a conversa não deve ser guardada.
export function registrarMensagem(conexao, m) {
  const contato = String(m.contato || m.contatoAlternativo || "");
  if (!contato || !m.externoId) return null;
  const tipo = m.conversaTipo || "direta";
  const telefone = m.telefone || "";
  // WhatsApp pessoal (Evolution) é por profissional: a mensagem é roteada para a
  // empresa do lead correspondente, entre as empresas onde o vendedor está
  // aprovado. Os demais canais seguem presos à empresa da conexão.
  const multiEmpresa = conexao.canal === "evolution" && !conexao.companyId;
  let lead = null;
  if (multiEmpresa) {
    lead = telefone ? leadDoTelefoneEntreEmpresas({ sellerId: conexao.sellerId, telefone }) : null;
  } else {
    // Vendedor que saiu da empresa: o número dele para de alimentar a empresa.
    if (conexao.sellerId && !vendedorAprovado(conexao.companyId, conexao.sellerId)) return null;
    lead = telefone ? leadDoTelefone({ companyId: conexao.companyId, sellerId: conexao.sellerId, telefone }) : null;
  }

  return db.transaction(() => {
    let conv = db.prepare(`SELECT * FROM canais_conversas WHERE conexaoId = ? AND tipo = ? AND (contatoExterno = ?
      OR (? != '' AND (contatoAlternativo = ? OR contatoExterno = ?)))`).get(conexao.id, tipo, contato, m.contatoAlternativo || "", m.contatoAlternativo || "", m.contatoAlternativo || "");
    // WhatsApp pessoal do vendedor: só guarda conversa com lead de empresa onde atende.
    if (conexao.sellerId && !lead && !conv?.leadId) return null;
    // A conversa/mensagem pertencem à empresa do lead (no multi-empresa); nos
    // demais canais, à empresa da conexão. Conversa existente mantém a sua.
    const companyIdMsg = conv?.companyId || lead?.companyId || conexao.companyId || "";
    const t = agora();
    if (!conv) {
      const id = uid();
      db.prepare(`INSERT INTO canais_conversas (id, conexaoId, companyId, sellerId, canal, tipo, contatoExterno, contatoAlternativo, nome, usuario, telefone, leadId, midiaId, criadoEm)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, conexao.id, companyIdMsg, conexao.sellerId || null, conexao.canal, tipo, contato, m.contatoAlternativo || "", m.nome || "", m.usuario || "", telefone, lead?.id || null, m.midiaId || "", t);
      conv = db.prepare("SELECT * FROM canais_conversas WHERE id = ?").get(id);
    } else {
      db.prepare(`UPDATE canais_conversas SET nome = CASE WHEN ? != '' THEN ? ELSE nome END, usuario = CASE WHEN ? != '' THEN ? ELSE usuario END,
        telefone = CASE WHEN telefone = '' THEN ? ELSE telefone END, contatoAlternativo = CASE WHEN contatoAlternativo = '' THEN ? ELSE contatoAlternativo END,
        leadId = COALESCE(leadId, ?) WHERE id = ?`)
        .run(m.nome || "", m.nome || "", m.usuario || "", m.usuario || "", telefone, m.contatoAlternativo || "", lead?.id || null, conv.id);
    }
    const em = m.em || t;
    const r = db.prepare(`INSERT OR IGNORE INTO canais_mensagens (id, conversaId, companyId, externoId, direcao, origem, tipo, texto, dados, status, autorUserId, em, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uid(), conv.id, conv.companyId, String(m.externoId), m.direcao, m.origem || "cliente", m.tipo || "texto", String(m.texto || "").slice(0, 8000),
        JSON.stringify(m.dados || {}), m.status || "", m.autorUserId || "", em, t);
    if (!r.changes) return { conversaId: conv.id, nova: false };

    const historico = m.origem === "historico";
    db.prepare(`UPDATE canais_conversas SET
        ultimaTexto = CASE WHEN ? >= ultimaEm THEN ? ELSE ultimaTexto END, ultimaDirecao = CASE WHEN ? >= ultimaEm THEN ? ELSE ultimaDirecao END,
        ultimaEm = MAX(ultimaEm, ?),
        ultimaRecebidaEm = CASE WHEN ? THEN MAX(COALESCE(ultimaRecebidaEm, 0), ?) ELSE ultimaRecebidaEm END,
        naoLidas = CASE WHEN ? THEN naoLidas + 1 WHEN ? THEN 0 ELSE naoLidas END WHERE id = ?`)
      .run(em, rotulo(m), em, m.direcao, em, m.direcao === "recebida" && !historico ? 1 : 0, em,
        m.direcao === "recebida" && !historico ? 1 : 0, m.direcao === "enviada" && !historico ? 1 : 0, conv.id);
    db.prepare("UPDATE canais_conexoes SET ultimoEventoEm = ? WHERE id = ?").run(t, conexao.id);
    return { conversaId: conv.id, nova: true };
  })();
}

const TIPOS = { imagem: "Foto", audio: "Áudio", video: "Vídeo", documento: "Documento", figurinha: "Figurinha", localizacao: "Localização", contato: "Contato", reacao: "Reação", outro: "Mensagem não suportada" };
export const rotulo = (m) => (m.tipo && m.tipo !== "texto" ? `[${TIPOS[m.tipo] || m.tipo}]${m.texto ? ` ${m.texto}` : ""}` : String(m.texto || "")).slice(0, 300);

const ORDEM = { enviando: 0, sent: 1, delivered: 2, read: 3, played: 3 };
export function atualizarStatus(conexao, externoId, status, erro = "") {
  const m = db.prepare(`SELECT m.id, m.status FROM canais_mensagens m JOIN canais_conversas c ON c.id = m.conversaId
    WHERE m.externoId = ? AND c.conexaoId = ? AND m.direcao = 'enviada'`).get(String(externoId), conexao.id);
  if (!m) return false;
  if (status !== "failed" && (ORDEM[status] ?? -1) <= (ORDEM[m.status] ?? -1)) return false;
  db.prepare("UPDATE canais_mensagens SET status = ?, erro = ? WHERE id = ?").run(status, erro, m.id);
  return true;
}

// ── Leitura, com permissão ────────────────────────────────────────────────
//
// Empresa: conversas dos números e do Instagram dela, e as dos vendedores com
// leads dela. Vendedor: só as do próprio número.

function filtroUsuario(user) {
  if (user?.role === "empresa" && user.entityId) return { sql: "v.companyId = ? AND (v.sellerId IS NULL OR EXISTS (SELECT 1 FROM leads lx WHERE lx.id = v.leadId AND lx.companyId = v.companyId))", args: [user.entityId] };
  if (user?.role === "vendedor" && user.entityId) return { sql: "v.sellerId = ?", args: [user.entityId] };
  throw erroCanal("Sem permissão", 403);
}

export function conversaDoUsuario(user, id) {
  const f = filtroUsuario(user);
  return db.prepare(`SELECT v.* FROM canais_conversas v WHERE v.id = ? AND ${f.sql}`).get(id, ...f.args) || null;
}

export function listarConversas(user, { canal, tipo = "", busca = "", conexaoId = "", limite = 200, agoraMs = agora() } = {}) {
  const f = filtroUsuario(user);
  const cond = [f.sql], args = [...f.args];
  if (canal) { cond.push("v.canal = ?"); args.push(canal); }
  if (tipo) { cond.push("v.tipo = ?"); args.push(tipo); }
  if (conexaoId) { cond.push("v.conexaoId = ?"); args.push(conexaoId); }
  const termo = String(busca || "").trim().toLowerCase();
  if (termo) {
    const numeros = termo.replace(/\D/g, "");
    cond.push(`(lower(v.nome) LIKE ? OR lower(v.usuario) LIKE ? OR lower(COALESCE(l.nome, '')) LIKE ?${numeros.length >= 4 ? " OR v.telefone LIKE ?" : ""})`);
    args.push(`%${termo}%`, `%${termo}%`, `%${termo}%`, ...(numeros.length >= 4 ? [`%${numeros}%`] : []));
  }
  return db.prepare(`SELECT v.*, l.nome AS leadNome, l.etapa AS leadEtapa, s.nome AS vendedor, x.nome AS contaNome, x.numero AS contaNumero
    FROM canais_conversas v JOIN canais_conexoes x ON x.id = v.conexaoId
    LEFT JOIN leads l ON l.id = v.leadId LEFT JOIN sellers s ON s.id = v.sellerId
    WHERE ${cond.join(" AND ")} ORDER BY v.ultimaEm DESC LIMIT ?`).all(...args, Math.min(500, limite)).map((v) => apresentar(v, agoraMs));
}

function apresentar(v, agoraMs) {
  return {
    id: v.id, canal: v.canal, tipo: v.tipo, nome: v.leadNome || v.nome || (v.usuario ? `@${v.usuario}` : v.telefone ? `+${v.telefone}` : "Contato"),
    usuario: v.usuario, telefone: v.telefone, vendedor: v.vendedor || "", conta: v.contaNome || v.contaNumero || "", conexaoId: v.conexaoId,
    lead: v.leadId ? { id: v.leadId, nome: v.leadNome, etapa: v.leadEtapa } : null,
    naoLidas: v.naoLidas, ultima: { em: v.ultimaEm, texto: v.ultimaTexto, direcao: v.ultimaDirecao },
    janelaAte: janelaAberta(v.ultimaRecebidaEm, agoraMs),
    esperandoDesde: v.ultimaDirecao === "recebida" ? v.ultimaEm : null,
  };
}

export function abrirConversa(user, id, { marcarLida = true, agoraMs = agora() } = {}) {
  const v = conversaDoUsuario(user, id);
  if (!v) return null;
  if (marcarLida && v.naoLidas) db.prepare("UPDATE canais_conversas SET naoLidas = 0 WHERE id = ?").run(id);
  const linha = db.prepare(`SELECT v.*, l.nome AS leadNome, l.etapa AS leadEtapa, s.nome AS vendedor, x.nome AS contaNome, x.numero AS contaNumero, x.status AS contaStatus
    FROM canais_conversas v JOIN canais_conexoes x ON x.id = v.conexaoId LEFT JOIN leads l ON l.id = v.leadId LEFT JOIN sellers s ON s.id = v.sellerId WHERE v.id = ?`).get(id);
  const mensagens = db.prepare("SELECT id, direcao, origem, tipo, texto, dados, status, erro, em FROM (SELECT * FROM canais_mensagens WHERE conversaId = ? ORDER BY em DESC LIMIT 500) ORDER BY em").all(id)
    .map((m) => { const d = ler(m.dados, {}); return { ...m, dados: undefined, midia: !!(d.midiaId || d.url), comentarioId: d.comentarioId || null, linkMidia: d.permalink || null }; });
  return { ...apresentar(linha, agoraMs), conectada: linha.contaStatus === "ativa", mensagens };
}

export const ler = (json, padrao) => { try { return JSON.parse(json || "") ?? padrao; } catch { return padrao; } };

export function naoLidas(user) {
  const f = filtroUsuario(user);
  return Object.fromEntries(db.prepare(`SELECT v.canal, SUM(v.naoLidas) AS n FROM canais_conversas v WHERE ${f.sql} GROUP BY v.canal`).all(...f.args).map((r) => [r.canal, r.n || 0]));
}

// Liga a conversa a um lead novo. A empresa escolhe o profissional aprovado.
export function criarLeadDaConversa(user, id, { sellerId, campaignId = null, nome = "" }) {
  if (user.role !== "empresa") throw erroCanal("Só a empresa transforma conversa em lead.", 403);
  const v = conversaDoUsuario(user, id);
  if (!v) throw erroCanal("Conversa não encontrada.", 404);
  if (v.leadId && db.prepare("SELECT 1 FROM leads WHERE id = ?").get(v.leadId)) throw erroCanal("Esta conversa já está ligada a um lead.", 409);
  if (!vendedorAprovado(user.entityId, sellerId))
    throw erroCanal("Escolha um profissional aprovado da sua empresa.");
  const campanha = campaignId && db.prepare("SELECT id FROM campaigns WHERE id = ? AND companyId = ?").get(campaignId, user.entityId) ? campaignId : null;
  const t = agora();
  const leadId = uid();
  const nomeLead = String(nome || "").trim() || v.nome || (v.usuario ? `@${v.usuario}` : "") || (v.telefone ? `+${v.telefone}` : "Contato");
  db.transaction(() => {
    db.prepare(`INSERT INTO leads (id, sellerId, companyId, campaignId, nome, telefone, email, origem, etapa, valorEstimado, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, '', ?, 'novo', 0, ?, ?)`).run(leadId, sellerId, user.entityId, campanha, nomeLead.slice(0, 160), v.telefone || "", v.canal, t, t);
    db.prepare("INSERT INTO lead_events (id, leadId, sellerId, tipo, observacao, criadoEm) VALUES (?, ?, ?, 'nota', ?, ?)")
      .run(uid(), leadId, sellerId, `Lead criado a partir de ${v.canal === "instagram" ? (v.tipo === "comentario" ? "um comentário no Instagram" : "um direct do Instagram") : "uma conversa do WhatsApp"}${v.usuario ? ` (@${v.usuario})` : ""}.`, t);
    db.prepare("UPDATE canais_conversas SET leadId = ? WHERE id = ?").run(leadId, id);
  })();
  return { leadId, sellerId, nome: nomeLead };
}

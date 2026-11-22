// Agenda comercial interna da RYCS.
//
// Empresas que vêm dos anúncios respondem o quiz (app.rycs.pro/diagnostico),
// escolhem um horário livre e a reunião cai na agenda de um closer liberado
// pelo admin. Nada depende de Calendly, Google Agenda ou Outlook.
//
// Regras que o código garante:
// - Só closers liberados pelo admin (profissionais aprovados) publicam
//   horários e veem reuniões — e cada um só vê as próprias.
// - Horários do mesmo closer não se sobrepõem.
// - Um horário tem no máximo uma reunião ativa (índice único parcial).
// - O endpoint público só devolve início e fim; nunca contato nem respostas.
// - As respostas ficam gravadas com o texto lido pela empresa.
// - Cancelar preserva a reunião; revogar o closer preserva o histórico.
import { randomUUID } from "node:crypto";
import { registrarRespostas, QUIZ_VERSAO, DURACOES_AGENDA as DURACOES } from "../../shared/quizDiagnostico.js";
import { limparOrigem } from "../../shared/jornada.js";

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;
// Antecedência mínima para alguém reservar (e para o closer publicar).
export const ANTECEDENCIA = HORA;
// Até onde o closer publica e até onde o quiz mostra.
const HORIZONTE_PUBLICAR = 90 * DIA;
const HORIZONTE_PUBLICO = 30 * DIA;
const MAX_POR_LOTE = 48;
const ID_VISITANTE = /^[A-Za-z0-9_-]{8,64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function criarSchemaAgenda(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agenda_closers (
      userId TEXT PRIMARY KEY REFERENCES users(id),
      ativo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS agenda_horarios (
      id TEXT PRIMARY KEY,
      closerId TEXT NOT NULL REFERENCES users(id),
      inicio INTEGER NOT NULL,
      fim INTEGER NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_agenda_horarios ON agenda_horarios(closerId, inicio, fim);
    CREATE INDEX IF NOT EXISTS idx_agenda_horarios_inicio ON agenda_horarios(inicio);
    CREATE TABLE IF NOT EXISTS agenda_reunioes (
      id TEXT PRIMARY KEY,
      horarioId TEXT NOT NULL REFERENCES agenda_horarios(id),
      empresa TEXT NOT NULL,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      telefone TEXT NOT NULL,
      respostas TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'agendada',
      criadoEm INTEGER NOT NULL,
      atualizadoEm INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_reserva ON agenda_reunioes(horarioId) WHERE status <> 'cancelada';
  `);
  // Colunas novas entram por ALTER: o banco local de quem já rodou a
  // primeira versão desta tabela continua valendo.
  const colunas = new Set(db.prepare("PRAGMA table_info(agenda_reunioes)").all().map((c) => c.name));
  const adicionar = (nome, tipo) => { if (!colunas.has(nome)) db.exec(`ALTER TABLE agenda_reunioes ADD COLUMN ${nome} ${tipo}`); };
  adicionar("quizVersao", "TEXT NOT NULL DEFAULT ''");
  adicionar("origem", "TEXT NOT NULL DEFAULT '{}'");
  adicionar("visitanteId", "TEXT NOT NULL DEFAULT ''");
  adicionar("atualizadoPor", "TEXT NOT NULL DEFAULT ''");
  db.exec("CREATE INDEX IF NOT EXISTS idx_agenda_reunioes_email ON agenda_reunioes(email, status)");
}

export class ErroAgenda extends Error {
  constructor(status, mensagem, codigo = "") { super(mensagem); this.status = status; this.codigo = codigo; }
}
const falhar = (status, mensagem, codigo) => { throw new ErroAgenda(status, mensagem, codigo); };
const json = (texto, padrao) => { try { return JSON.parse(texto); } catch { return padrao; } };
const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";

export function criarAgenda(db, agora = Date.now) {
  // Closer liberado = acesso ativo + conta de profissional aprovada.
  const SQL_LIBERADO = `SELECT u.id FROM agenda_closers a
    JOIN users u ON u.id = a.userId JOIN sellers s ON s.id = u.entityId
    WHERE a.userId = ? AND a.ativo = 1 AND u.role = 'vendedor' AND s.status = 'aprovado'`;
  const liberado = (id) => !!db.prepare(SQL_LIBERADO).get(id);
  const reservaAtiva = "EXISTS (SELECT 1 FROM agenda_reunioes r WHERE r.horarioId = h.id AND r.status <> 'cancelada')";

  function acesso(user) {
    if (user?.role === "admin") return "admin";
    if (user?.role === "vendedor" && liberado(user.id)) return "closer";
    return falhar(403, "Acesso restrito aos closers liberados pela RYCS.");
  }
  // Admin age em qualquer agenda; o closer, só na própria.
  function exigirDono(user, closerId) {
    if (acesso(user) !== "admin" && user.id !== closerId) falhar(403, "Sem acesso à agenda deste closer.");
  }

  function liberar(user, userId, ativo) {
    if (user?.role !== "admin") falhar(403, "Apenas administradores liberam closers.");
    if (typeof ativo !== "boolean" || typeof userId !== "string") falhar(400, "Informe o profissional e se o acesso fica ativo.");
    const existe = db.prepare("SELECT u.id, s.status FROM users u JOIN sellers s ON s.id = u.entityId WHERE u.id = ? AND u.role = 'vendedor'").get(userId);
    if (!existe) falhar(404, "Profissional não encontrado.");
    if (ativo && existe.status !== "aprovado") falhar(400, "Só profissionais aprovados podem atender a agenda.");
    db.prepare("INSERT INTO agenda_closers (userId, ativo) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET ativo = excluded.ativo").run(userId, ativo ? 1 : 0);
    // Revogar não mexe nas reuniões: o admin decide o que fazer com elas.
    const pendentes = db.prepare(`SELECT COUNT(*) n FROM agenda_reunioes r JOIN agenda_horarios h ON h.id = r.horarioId
      WHERE h.closerId = ? AND r.status = 'agendada' AND h.fim > ?`).get(userId, agora()).n;
    return { ok: true, reunioesFuturas: pendentes };
  }

  // Um horário (sem `fim`) ou uma sequência de horários de `duracao` minutos
  // entre `inicio` e `fim`. Horários passados ou ocupados são pulados e
  // contados; o resto é criado de uma vez.
  function publicar(user, { closerId = user?.id, inicio, fim, duracao } = {}) {
    exigirDono(user, closerId);
    if (!liberado(closerId)) falhar(400, "Este closer não está com o acesso à agenda ativo.");
    if (!DURACOES.includes(duracao)) falhar(400, "Escolha uma duração válida.");
    if (!Number.isSafeInteger(inicio) || (fim != null && !Number.isSafeInteger(fim))) falhar(400, "Informe data e horário válidos.");
    const passo = duracao * MIN;
    const ate = fim ?? inicio + passo;
    if (ate < inicio + passo) falhar(400, "O fim precisa ser depois do início, com espaço para ao menos uma reunião.");
    const inicios = [];
    for (let t = inicio; t + passo <= ate; t += passo) inicios.push(t);
    if (inicios.length > MAX_POR_LOTE) falhar(400, `Publique no máximo ${MAX_POR_LOTE} horários por vez.`);
    if (inicio > agora() + HORIZONTE_PUBLICAR) falhar(400, "Publique horários para os próximos 90 dias.");

    return db.transaction(() => {
      const conflito = db.prepare(`SELECT 1 FROM agenda_horarios h WHERE h.closerId = ? AND h.inicio < ? AND h.fim > ?
        AND (h.ativo = 1 OR ${reservaAtiva})`);
      const inserir = db.prepare("INSERT INTO agenda_horarios (id, closerId, inicio, fim) VALUES (?, ?, ?, ?)");
      const resultado = { criados: 0, ocupados: 0, passados: 0 };
      for (const t of inicios) {
        if (t < agora() + ANTECEDENCIA) { resultado.passados++; continue; }
        if (conflito.get(closerId, t + passo, t)) { resultado.ocupados++; continue; }
        inserir.run(randomUUID(), closerId, t, t + passo);
        resultado.criados++;
      }
      if (!resultado.criados) {
        falhar(409, resultado.passados && !resultado.ocupados
          ? "Os horários precisam começar ao menos 1 hora à frente."
          : "Esse período já está ocupado na agenda deste closer.");
      }
      return resultado;
    }).immediate();
  }

  // Público: só início e fim, sem closer nem contato. Horários iguais de
  // closers diferentes viram um só; quem atende é decidido na reserva.
  function horariosPublicos() {
    const t = agora();
    return db.prepare(`SELECT DISTINCT h.inicio, h.fim FROM agenda_horarios h
      JOIN agenda_closers a ON a.userId = h.closerId AND a.ativo = 1
      JOIN users u ON u.id = h.closerId AND u.role = 'vendedor'
      JOIN sellers s ON s.id = u.entityId AND s.status = 'aprovado'
      WHERE h.ativo = 1 AND h.inicio >= ? AND h.inicio <= ? AND NOT ${reservaAtiva}
      ORDER BY h.inicio, h.fim LIMIT 400`).all(t + ANTECEDENCIA, t + HORIZONTE_PUBLICO);
  }

  function reservar(body = {}) {
    const texto = (campo, max) => (typeof body[campo] === "string" ? body[campo].trim().replace(/\s+/g, " ") : "").slice(0, max);
    const empresa = texto("empresa", 160);
    const nome = texto("nome", 120);
    const email = texto("email", 254).toLowerCase();
    const telefone = texto("telefone", 30);
    const digitos = telefone.replace(/\D/g, "");
    if (!empresa || !nome) falhar(400, "Informe o nome da empresa e o seu nome.");
    if (!EMAIL.test(email)) falhar(400, "Informe um e-mail válido.");
    if (digitos.length < 10 || digitos.length > 15) falhar(400, "Informe o WhatsApp com DDD.");
    const respostas = registrarRespostas(body.respostas);
    if (!respostas) falhar(400, "Responda todas as perguntas do quiz antes de agendar.");
    if (body.aceite !== true) falhar(400, "Confirme o uso dos dados para a conversa.");
    const { inicio, fim } = body;
    if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(fim)) falhar(400, "Escolha um horário.");
    const origem = JSON.stringify(limparOrigem(body.origem));
    const visitanteId = ID_VISITANTE.test(String(body.visitanteId || "")) ? body.visitanteId : "";

    return db.transaction(() => {
      const t = agora();
      if (inicio < t + ANTECEDENCIA) falhar(409, "Esse horário não está mais disponível. Escolha outro.", "HORARIO_INDISPONIVEL");
      const duplicada = db.prepare(`SELECT 1 FROM agenda_reunioes r JOIN agenda_horarios h ON h.id = r.horarioId
        WHERE r.email = ? AND r.status = 'agendada' AND h.fim > ?`).get(email, t);
      if (duplicada) falhar(409, "Já existe uma conversa marcada para este e-mail. Para mudar o horário, fale com a RYCS.", "EMAIL_COM_REUNIAO");
      // Entre os closers livres nesse horário, atende quem tem menos
      // reuniões futuras — a fila se distribui sozinha.
      const livre = db.prepare(`SELECT h.id, h.closerId, s.nome,
          (SELECT COUNT(*) FROM agenda_reunioes r2 JOIN agenda_horarios h2 ON h2.id = r2.horarioId
            WHERE h2.closerId = h.closerId AND r2.status = 'agendada' AND h2.fim > ?) AS carga
        FROM agenda_horarios h
        JOIN agenda_closers a ON a.userId = h.closerId AND a.ativo = 1
        JOIN users u ON u.id = h.closerId AND u.role = 'vendedor'
        JOIN sellers s ON s.id = u.entityId AND s.status = 'aprovado'
        WHERE h.ativo = 1 AND h.inicio = ? AND h.fim = ? AND NOT ${reservaAtiva}
        ORDER BY carga, h.id LIMIT 1`).get(t, inicio, fim);
      if (!livre) falhar(409, "Esse horário acabou de ser reservado. Escolha outro.", "HORARIO_INDISPONIVEL");
      const id = randomUUID();
      db.prepare(`INSERT INTO agenda_reunioes (id, horarioId, empresa, nome, email, telefone, respostas, quizVersao, origem, visitanteId, criadoEm, atualizadoEm)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, livre.id, empresa, nome, email, telefone, JSON.stringify(respostas), QUIZ_VERSAO, origem, visitanteId, t, t);
      return { id, inicio, fim, closer: primeiroNome(livre.nome) };
    }).immediate();
  }

  function painel(user) {
    const papel = acesso(user);
    const admin = papel === "admin";
    const t = agora();
    const filtro = admin ? "" : " AND h.closerId = ?";
    const args = admin ? [] : [user.id];

    const horarios = db.prepare(`SELECT h.id, h.closerId, h.inicio, h.fim, s.nome AS closer
      FROM agenda_horarios h JOIN users u ON u.id = h.closerId JOIN sellers s ON s.id = u.entityId
      WHERE h.ativo = 1 AND h.fim > ? AND NOT ${reservaAtiva}${filtro}
      ORDER BY h.inicio LIMIT 1000`).all(t, ...args);

    const reunioes = db.prepare(`SELECT r.id, r.horarioId, r.empresa, r.nome, r.email, r.telefone, r.respostas, r.status,
        r.quizVersao, r.origem, r.criadoEm, r.atualizadoEm, h.inicio, h.fim, h.closerId, s.nome AS closer,
        COALESCE(a.ativo, 0) AS closerAtivo
      FROM agenda_reunioes r JOIN agenda_horarios h ON h.id = r.horarioId
      JOIN users u ON u.id = h.closerId JOIN sellers s ON s.id = u.entityId
      LEFT JOIN agenda_closers a ON a.userId = h.closerId
      WHERE 1 = 1${filtro} ORDER BY h.inicio DESC LIMIT 1000`).all(...args)
      .map((r) => ({ ...r, closerAtivo: !!r.closerAtivo, respostas: json(r.respostas, []), origem: json(r.origem, {}) }));

    if (!admin) return { admin, horarios, reunioes };

    // Admin: quem pode atender (aprovados) + quem já teve acesso.
    const closers = db.prepare(`SELECT u.id, s.nome, s.perfil, s.status, COALESCE(a.ativo, 0) AS ativo
      FROM users u JOIN sellers s ON s.id = u.entityId LEFT JOIN agenda_closers a ON a.userId = u.id
      WHERE u.role = 'vendedor' AND (s.status = 'aprovado' OR a.userId IS NOT NULL)
      ORDER BY COALESCE(a.ativo, 0) DESC, CASE WHEN s.perfil = 'closer' THEN 0 ELSE 1 END, s.nome LIMIT 3000`).all()
      .map((c) => ({ ...c, ativo: !!c.ativo }));
    return { admin, horarios, reunioes, closers };
  }

  function retirar(user, id) {
    return db.transaction(() => {
      const h = db.prepare("SELECT * FROM agenda_horarios WHERE id = ?").get(id);
      if (!h) falhar(404, "Horário não encontrado.");
      exigirDono(user, h.closerId);
      if (db.prepare("SELECT 1 FROM agenda_reunioes WHERE horarioId = ? AND status <> 'cancelada'").get(id)) falhar(409, "Este horário tem reunião. Cancele a reunião antes.");
      db.prepare("UPDATE agenda_horarios SET ativo = 0 WHERE id = ?").run(id);
      return { ok: true };
    }).immediate();
  }

  // agendada → cancelada | realizada | nao_compareceu. O registro nunca some.
  function status(user, id, novo, { reabrir = false } = {}) {
    if (!["cancelada", "realizada", "nao_compareceu"].includes(novo)) falhar(400, "Status inválido.");
    return db.transaction(() => {
      const r = db.prepare("SELECT r.id, r.status, r.horarioId, h.closerId, h.inicio FROM agenda_reunioes r JOIN agenda_horarios h ON h.id = r.horarioId WHERE r.id = ?").get(id);
      if (!r) falhar(404, "Reunião não encontrada.");
      exigirDono(user, r.closerId);
      if (r.status !== "agendada") falhar(409, "Esta reunião já foi encerrada.");
      const t = agora();
      if (novo !== "cancelada" && r.inicio > t) falhar(400, "Só dá para registrar o resultado depois do horário da reunião.");
      db.prepare("UPDATE agenda_reunioes SET status = ?, atualizadoEm = ?, atualizadoPor = ? WHERE id = ?").run(novo, t, user.id, id);
      let reaberto = false;
      if (novo === "cancelada") {
        // Reabrir devolve o horário ao quiz; sem reabrir (o padrão), ele sai
        // da agenda — normalmente o closer cancela porque não pode atender.
        reaberto = reabrir === true && r.inicio >= t + ANTECEDENCIA && liberado(r.closerId);
        db.prepare("UPDATE agenda_horarios SET ativo = ? WHERE id = ?").run(reaberto ? 1 : 0, r.horarioId);
      }
      return { ok: true, reaberto };
    }).immediate();
  }

  return { acesso, liberar, publicar, horariosPublicos, reservar, painel, retirar, status };
}

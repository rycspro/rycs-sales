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
import { randomUUID, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { registrarRespostas, QUIZ_VERSAO, DURACOES_AGENDA as DURACOES, INTERVALOS_AGENDA as INTERVALOS, PERGUNTAS_QUIZ } from "../../shared/quizDiagnostico.js";
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
  adicionar("precadastroId", "TEXT NOT NULL DEFAULT ''");
  adicionar("whatsVerificado", "INTEGER NOT NULL DEFAULT 0");
  // Depois de realizada: fechou, não fechou ou em negociação. É o que ensina
  // quais respostas do diagnóstico viram venda.
  adicionar("resultadoVenda", "TEXT NOT NULL DEFAULT ''");
  db.exec("CREATE INDEX IF NOT EXISTS idx_agenda_reunioes_email ON agenda_reunioes(email, status)");
  // Pré-cadastro da empresa: nasce quando ela informa o contato depois do
  // quiz, antes de verificar o WhatsApp e de reservar. Fica guardado mesmo se
  // ela não agendar, para a equipe retomar o contato. Só o navegador que criou
  // tem o token (guardado em hash) para continuar.
  db.exec(`
    CREATE TABLE IF NOT EXISTS empresas_precadastro (
      id TEXT PRIMARY KEY,
      tokenHash TEXT NOT NULL,
      empresa TEXT NOT NULL,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      telefone TEXT NOT NULL,
      respostas TEXT NOT NULL,
      quizVersao TEXT NOT NULL DEFAULT '',
      origem TEXT NOT NULL DEFAULT '{}',
      visitanteId TEXT NOT NULL DEFAULT '',
      reuniaoId TEXT NOT NULL DEFAULT '',
      criadoEm INTEGER NOT NULL,
      atualizadoEm INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_precadastro_data ON empresas_precadastro(criadoEm);
    -- Disponibilidade semanal (ex.: seg a sex, 8h às 20h): gera os horários
    -- sozinha para as próximas semanas. Uma regra por pessoa.
    CREATE TABLE IF NOT EXISTS agenda_disponibilidade (
      id TEXT PRIMARY KEY,
      closerId TEXT NOT NULL UNIQUE REFERENCES users(id),
      dias TEXT NOT NULL,
      inicioMin INTEGER NOT NULL,
      fimMin INTEGER NOT NULL,
      duracao INTEGER NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      criadoEm INTEGER NOT NULL,
      atualizadoEm INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agenda_config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
  `);
  // De quanto em quanto tempo começa uma reunião (0 = colado, igual à duração).
  const colunasRegra = new Set(db.prepare("PRAGMA table_info(agenda_disponibilidade)").all().map((c) => c.name));
  if (!colunasRegra.has("intervalo")) db.exec("ALTER TABLE agenda_disponibilidade ADD COLUMN intervalo INTEGER NOT NULL DEFAULT 0");
  const colunasHorario = new Set(db.prepare("PRAGMA table_info(agenda_horarios)").all().map((c) => c.name));
  if (!colunasHorario.has("regraId")) db.exec("ALTER TABLE agenda_horarios ADD COLUMN regraId TEXT NOT NULL DEFAULT ''");
  db.exec("CREATE INDEX IF NOT EXISTS idx_agenda_horarios_regra ON agenda_horarios(regraId, closerId, inicio)");
}

export class ErroAgenda extends Error {
  constructor(status, mensagem, codigo = "") { super(mensagem); this.status = status; this.codigo = codigo; }
}
const falhar = (status, mensagem, codigo) => { throw new ErroAgenda(status, mensagem, codigo); };
const json = (texto, padrao) => { try { return JSON.parse(texto); } catch { return padrao; } };
const hashToken = (token) => createHash("sha256").update(String(token)).digest("hex");
const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";

// Horário de Brasília: UTC−3 o ano todo (sem horário de verão desde 2019).
// O servidor roda em UTC; a disponibilidade é pensada no relógio de Brasília.
const FUSO_MS = 3 * 60 * 60 * 1000;
const DIAS_GERADOS = 14;
const spParaUtc = (y, m, d, minutos) => Date.UTC(y, m, d, 0, minutos) + FUSO_MS;
function diasSP(t, n) {
  const hoje = new Date(t - FUSO_MS);
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + k));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: d.getUTCDay() };
  });
}
const paraMinutos = (hhmm) => {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || ""));
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const paraHora = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function criarAgenda(db, agora = Date.now) {
  // Atende a agenda: o admin (agenda da "Equipe RYCS") ou o profissional
  // aprovado com acesso liberado pelo admin.
  const JUNTA_ATENDENTE = `JOIN users u ON u.id = h.closerId
    LEFT JOIN agenda_closers a ON a.userId = h.closerId LEFT JOIN sellers s ON s.id = u.entityId`;
  const PODE_ATENDER = "(u.role = 'admin' OR (u.role = 'vendedor' AND a.ativo = 1 AND s.status = 'aprovado'))";
  const NOME_ATENDENTE = "COALESCE(s.nome, 'Equipe RYCS')";
  const liberado = (id) => !!db.prepare(`SELECT u.id FROM users u LEFT JOIN agenda_closers a ON a.userId = u.id
    LEFT JOIN sellers s ON s.id = u.entityId WHERE u.id = ? AND ${PODE_ATENDER}`).get(id);
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
    return db.prepare(`SELECT DISTINCT h.inicio, h.fim FROM agenda_horarios h ${JUNTA_ATENDENTE}
      WHERE h.ativo = 1 AND ${PODE_ATENDER} AND h.inicio >= ? AND h.inicio <= ? AND NOT ${reservaAtiva}
      ORDER BY h.inicio, h.fim LIMIT 400`).all(t + ANTECEDENCIA, t + HORIZONTE_PUBLICO);
  }

  // Contato + respostas + aceite, validados do mesmo jeito no pré-cadastro e na reserva.
  function validarContato(body = {}) {
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
    if (!respostas) falhar(400, "Responda todas as perguntas do quiz antes de continuar.");
    if (body.aceite !== true) falhar(400, "Confirme o uso dos dados para a reunião.");
    return {
      empresa, nome, email, telefone, respostas,
      origem: JSON.stringify(limparOrigem(body.origem)),
      visitanteId: ID_VISITANTE.test(String(body.visitanteId || "")) ? body.visitanteId : "",
    };
  }

  // Cria o pré-cadastro, ou atualiza o mesmo (id + token) se a pessoa voltou
  // para corrigir os dados antes de agendar.
  function salvarPrecadastro(body = {}) {
    const c = validarContato(body);
    const t = agora();
    return db.transaction(() => {
      if (typeof body.id === "string" && typeof body.token === "string") {
        const atual = db.prepare("SELECT id, tokenHash, reuniaoId FROM empresas_precadastro WHERE id = ?").get(body.id);
        if (atual && tokenConfere(atual.tokenHash, body.token) && !atual.reuniaoId) {
          db.prepare(`UPDATE empresas_precadastro SET empresa = ?, nome = ?, email = ?, telefone = ?, respostas = ?, quizVersao = ?, atualizadoEm = ? WHERE id = ?`)
            .run(c.empresa, c.nome, c.email, c.telefone, JSON.stringify(c.respostas), QUIZ_VERSAO, t, atual.id);
          return { id: atual.id, token: body.token };
        }
      }
      const id = randomUUID();
      const token = randomBytes(24).toString("base64url");
      db.prepare(`INSERT INTO empresas_precadastro (id, tokenHash, empresa, nome, email, telefone, respostas, quizVersao, origem, visitanteId, criadoEm, atualizadoEm)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, hashToken(token), c.empresa, c.nome, c.email, c.telefone, JSON.stringify(c.respostas), QUIZ_VERSAO, c.origem, c.visitanteId, t, t);
      return { id, token };
    }).immediate();
  }

  function tokenConfere(hash, token) {
    const a = Buffer.from(hash, "hex"), b = Buffer.from(hashToken(token), "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  function lerPrecadastro(id, token) {
    const p = typeof id === "string" && typeof token === "string" && db.prepare("SELECT * FROM empresas_precadastro WHERE id = ?").get(id);
    if (!p || !tokenConfere(p.tokenHash, token)) falhar(404, "Não encontramos seu pré-cadastro. Preencha os dados de novo.", "PRECADASTRO_INVALIDO");
    return p;
  }

  // `confiavel` vem do servidor (pré-cadastro e WhatsApp verificado), nunca do corpo público.
  function reservar(body = {}, confiavel = null) {
    const { empresa, nome, email, telefone, respostas, origem, visitanteId } = confiavel?.contato || validarContato(body);
    const { inicio, fim } = body;
    if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(fim)) falhar(400, "Escolha um horário.");

    return db.transaction(() => {
      const t = agora();
      if (inicio < t + ANTECEDENCIA) falhar(409, "Esse horário não está mais disponível. Escolha outro.", "HORARIO_INDISPONIVEL");
      const duplicada = db.prepare(`SELECT 1 FROM agenda_reunioes r JOIN agenda_horarios h ON h.id = r.horarioId
        WHERE r.email = ? AND r.status = 'agendada' AND h.fim > ?`).get(email, t);
      if (duplicada) falhar(409, "Já existe uma reunião marcada para este e-mail. Para mudar o horário, fale com a RYCS.", "EMAIL_COM_REUNIAO");
      // Entre os closers livres nesse horário, atende quem tem menos
      // reuniões futuras — a fila se distribui sozinha.
      const livre = db.prepare(`SELECT h.id, h.closerId, ${NOME_ATENDENTE} AS nome,
          (SELECT COUNT(*) FROM agenda_reunioes r2 JOIN agenda_horarios h2 ON h2.id = r2.horarioId
            WHERE h2.closerId = h.closerId AND r2.status = 'agendada' AND h2.fim > ?) AS carga
        FROM agenda_horarios h ${JUNTA_ATENDENTE}
        WHERE h.ativo = 1 AND ${PODE_ATENDER} AND h.inicio = ? AND h.fim = ? AND NOT ${reservaAtiva}
        ORDER BY carga, h.id LIMIT 1`).get(t, inicio, fim);
      if (!livre) falhar(409, "Esse horário acabou de ser reservado. Escolha outro.", "HORARIO_INDISPONIVEL");
      const id = randomUUID();
      const precadastroId = confiavel?.precadastroId || "";
      db.prepare(`INSERT INTO agenda_reunioes (id, horarioId, empresa, nome, email, telefone, respostas, quizVersao, origem, visitanteId, precadastroId, whatsVerificado, criadoEm, atualizadoEm)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, livre.id, empresa, nome, email, telefone, JSON.stringify(respostas), confiavel?.quizVersao || QUIZ_VERSAO, origem, visitanteId,
          precadastroId, confiavel?.whatsVerificado ? 1 : 0, t, t);
      if (precadastroId) db.prepare("UPDATE empresas_precadastro SET reuniaoId = ?, atualizadoEm = ? WHERE id = ?").run(id, t, precadastroId);
      return { id, inicio, fim, closer: primeiroNome(livre.nome) };
    }).immediate();
  }

  // Reserva de quem passou pelo pré-cadastro. `verificacao` diz se o WhatsApp
  // foi confirmado; quando a verificação está ligada, ela é obrigatória.
  function reservarPrecadastro(body = {}, verificacao = { disponivel: false }) {
    const p = lerPrecadastro(body.id, body.token);
    if (p.reuniaoId) {
      const r = db.prepare("SELECT r.id, r.status, h.inicio, h.fim FROM agenda_reunioes r JOIN agenda_horarios h ON h.id = r.horarioId WHERE r.id = ?").get(p.reuniaoId);
      if (r && r.status === "agendada") falhar(409, "Sua reunião já está agendada. Para mudar o horário, fale com a RYCS.", "EMAIL_COM_REUNIAO");
    }
    if (verificacao.disponivel && !verificacao.verificado) falhar(409, "Confirme seu WhatsApp antes de agendar.", "WHATSAPP_NAO_VERIFICADO");
    const numero = verificacao.verificado ? verificacao.numero : "";
    return reservar(body, {
      precadastroId: p.id,
      whatsVerificado: !!numero,
      quizVersao: p.quizVersao,
      contato: {
        empresa: p.empresa, nome: p.nome, email: p.email,
        // O WhatsApp que mandou o código é o que vale para o closer.
        telefone: numero ? `+${numero}` : p.telefone,
        respostas: json(p.respostas, []), origem: p.origem, visitanteId: p.visitanteId,
      },
    });
  }

  function painel(user) {
    const papel = acesso(user);
    const admin = papel === "admin";
    const t = agora();
    const filtro = admin ? "" : " AND h.closerId = ?";
    const args = admin ? [] : [user.id];

    const horarios = db.prepare(`SELECT h.id, h.closerId, h.inicio, h.fim, h.regraId, ${NOME_ATENDENTE} AS closer
      FROM agenda_horarios h ${JUNTA_ATENDENTE}
      WHERE h.ativo = 1 AND h.fim > ? AND NOT ${reservaAtiva}${filtro}
      ORDER BY h.inicio LIMIT 1000`).all(t, ...args);

    const reunioes = db.prepare(`SELECT r.id, r.horarioId, r.empresa, r.nome, r.email, r.telefone, r.respostas, r.status,
        r.quizVersao, r.origem, r.whatsVerificado, r.resultadoVenda, r.criadoEm, r.atualizadoEm, h.inicio, h.fim, h.closerId, ${NOME_ATENDENTE} AS closer,
        CASE WHEN ${PODE_ATENDER} THEN 1 ELSE 0 END AS closerAtivo
      FROM agenda_reunioes r JOIN agenda_horarios h ON h.id = r.horarioId ${JUNTA_ATENDENTE}
      WHERE 1 = 1${filtro} ORDER BY h.inicio DESC LIMIT 1000`).all(...args)
      .map((r) => ({ ...r, closerAtivo: !!r.closerAtivo, whatsVerificado: !!r.whatsVerificado, respostas: json(r.respostas, []), origem: json(r.origem, {}) }));

    const disponibilidade = db.prepare(`SELECT d.closerId, d.dias, d.inicioMin, d.fimMin, d.duracao, d.intervalo, d.ativo, ${NOME_ATENDENTE} AS closer
      FROM agenda_disponibilidade d JOIN users u ON u.id = d.closerId LEFT JOIN sellers s ON s.id = u.entityId
      WHERE 1 = 1${admin ? "" : " AND d.closerId = ?"} ORDER BY d.ativo DESC, closer`).all(...args)
      .map((d) => ({ closerId: d.closerId, closer: d.closer, ativo: !!d.ativo, dias: json(d.dias, []), inicio: paraHora(d.inicioMin), fim: paraHora(d.fimMin), duracao: d.duracao, intervalo: d.intervalo || d.duracao }));

    if (!admin) return { admin, eu: user.id, horarios, reunioes, disponibilidade };

    // Admin: quem pode atender (aprovados) + quem já teve acesso.
    const closers = db.prepare(`SELECT u.id, s.nome, s.perfil, s.status, COALESCE(a.ativo, 0) AS ativo
      FROM users u JOIN sellers s ON s.id = u.entityId LEFT JOIN agenda_closers a ON a.userId = u.id
      WHERE u.role = 'vendedor' AND (s.status = 'aprovado' OR a.userId IS NOT NULL)
      ORDER BY COALESCE(a.ativo, 0) DESC, CASE WHEN s.perfil = 'closer' THEN 0 ELSE 1 END, s.nome LIMIT 3000`).all()
      .map((c) => ({ ...c, ativo: !!c.ativo }));
    // Pré-cadastros que ainda não viraram reunião: a equipe retoma o contato.
    const precadastros = db.prepare(`SELECT id, empresa, nome, email, telefone, respostas, origem, criadoEm
      FROM empresas_precadastro WHERE reuniaoId = '' ORDER BY criadoEm DESC LIMIT 500`).all()
      .map((p) => ({ ...p, respostas: json(p.respostas, []), origem: json(p.origem, {}) }));
    return { admin, eu: user.id, horarios, reunioes, disponibilidade, closers, precadastros, aprendizado: aprendizado() };
  }

  // Para cada resposta do quiz atual: quantas empresas a escolheram e quantas
  // agendaram, compareceram e fecharam. Contagem real, sem previsão.
  function aprendizado() {
    const linhas = db.prepare(`SELECT p.respostas, p.reuniaoId, r.status, r.resultadoVenda
      FROM empresas_precadastro p LEFT JOIN agenda_reunioes r ON r.id = p.reuniaoId
      WHERE p.quizVersao = ?`).all(QUIZ_VERSAO);
    const conta = new Map();
    for (const l of linhas) {
      for (const x of json(l.respostas, [])) {
        const k = `${x.id}:${x.opcao}`;
        const c = conta.get(k) || { total: 0, agendaram: 0, compareceram: 0, fecharam: 0 };
        c.total++;
        if (l.reuniaoId && l.status && l.status !== "cancelada") c.agendaram++;
        if (l.status === "realizada") c.compareceram++;
        if (l.resultadoVenda === "fechou") c.fecharam++;
        conta.set(k, c);
      }
    }
    return {
      versao: QUIZ_VERSAO,
      diagnosticos: linhas.length,
      perguntas: PERGUNTAS_QUIZ.map((p) => ({
        id: p.id, titulo: p.titulo,
        opcoes: p.opcoes.map((o) => ({ id: o.id, texto: o.texto, ...(conta.get(`${p.id}:${o.id}`) || { total: 0, agendaram: 0, compareceram: 0, fecharam: 0 }) })),
      })),
    };
  }

  function resultadoVenda(user, id, resultado) {
    if (!["fechou", "nao_fechou", "negociando"].includes(resultado)) falhar(400, "Resultado inválido.");
    return db.transaction(() => {
      const r = db.prepare("SELECT r.id, r.status, h.closerId FROM agenda_reunioes r JOIN agenda_horarios h ON h.id = r.horarioId WHERE r.id = ?").get(id);
      if (!r) falhar(404, "Reunião não encontrada.");
      exigirDono(user, r.closerId);
      if (r.status !== "realizada") falhar(409, "Registre a reunião como realizada antes do resultado da venda.");
      db.prepare("UPDATE agenda_reunioes SET resultadoVenda = ?, atualizadoEm = ?, atualizadoPor = ? WHERE id = ?").run(resultado, agora(), user.id, id);
      return { ok: true };
    }).immediate();
  }

  // Gera os horários das regras semanais para os próximos 14 dias. Pula o
  // que já existe (inclusive horário que alguém retirou de propósito) e o
  // que bate com outro compromisso da mesma pessoa.
  function gerarDisponibilidade() {
    const t = agora();
    const regras = db.prepare("SELECT * FROM agenda_disponibilidade WHERE ativo = 1").all();
    const existe = db.prepare("SELECT 1 FROM agenda_horarios WHERE closerId = ? AND inicio = ? AND regraId = ?");
    const conflito = db.prepare(`SELECT 1 FROM agenda_horarios h WHERE h.closerId = ? AND h.inicio < ? AND h.fim > ? AND (h.ativo = 1 OR ${reservaAtiva})`);
    const inserir = db.prepare("INSERT INTO agenda_horarios (id, closerId, inicio, fim, regraId) VALUES (?, ?, ?, ?, ?)");
    let criados = 0;
    db.transaction(() => {
      for (const r of regras) {
        if (!liberado(r.closerId)) continue;
        const dias = new Set(json(r.dias, []));
        for (const dia of diasSP(t, DIAS_GERADOS)) {
          if (!dias.has(dia.dow)) continue;
          for (let m = r.inicioMin; m + r.duracao <= r.fimMin; m += r.intervalo || r.duracao) {
            const ini = spParaUtc(dia.y, dia.m, dia.d, m);
            const fim = ini + r.duracao * MIN;
            if (ini < t + ANTECEDENCIA || existe.get(r.closerId, ini, r.id) || conflito.get(r.closerId, fim, ini)) continue;
            inserir.run(randomUUID(), r.closerId, ini, fim, r.id);
            criados++;
          }
        }
      }
    }).immediate();
    return criados;
  }

  // Horários futuros ainda livres criados por uma regra (somem quando a regra muda).
  const limparGerados = (regraId) => db.prepare(`DELETE FROM agenda_horarios WHERE regraId = ? AND inicio > ?
    AND NOT EXISTS (SELECT 1 FROM agenda_reunioes r WHERE r.horarioId = agenda_horarios.id)`).run(regraId, agora());

  function salvarDisponibilidade(user, { closerId = user?.id, dias, inicio, fim, duracao, intervalo = duracao } = {}) {
    exigirDono(user, closerId);
    if (!liberado(closerId)) falhar(400, "Esta pessoa não está com o acesso à agenda ativo.");
    const lista = Array.isArray(dias) ? [...new Set(dias)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort() : [];
    const ini = paraMinutos(inicio), fimMin = paraMinutos(fim);
    if (!lista.length) falhar(400, "Escolha ao menos um dia da semana.");
    if (!DURACOES.includes(duracao)) falhar(400, "Escolha uma duração válida.");
    if (intervalo !== duracao && (!INTERVALOS.includes(intervalo) || intervalo < duracao)) falhar(400, "O intervalo entre reuniões precisa ser maior ou igual à duração.");
    if (ini == null || fimMin == null || fimMin - ini < duracao) falhar(400, "O horário final precisa caber ao menos uma reunião depois do inicial.");
    const t = agora();
    const regraId = db.transaction(() => {
      const atual = db.prepare("SELECT id FROM agenda_disponibilidade WHERE closerId = ?").get(closerId);
      const id = atual?.id || randomUUID();
      if (atual) {
        db.prepare("UPDATE agenda_disponibilidade SET dias = ?, inicioMin = ?, fimMin = ?, duracao = ?, intervalo = ?, ativo = 1, atualizadoEm = ? WHERE id = ?")
          .run(JSON.stringify(lista), ini, fimMin, duracao, intervalo, t, id);
        limparGerados(id);
      } else {
        db.prepare("INSERT INTO agenda_disponibilidade (id, closerId, dias, inicioMin, fimMin, duracao, intervalo, criadoEm, atualizadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(id, closerId, JSON.stringify(lista), ini, fimMin, duracao, intervalo, t, t);
      }
      return id;
    }).immediate();
    return { ok: true, regraId, criados: gerarDisponibilidade() };
  }

  function desativarDisponibilidade(user, closerId = user?.id) {
    exigirDono(user, closerId);
    const regra = db.prepare("SELECT id FROM agenda_disponibilidade WHERE closerId = ?").get(closerId);
    if (!regra) falhar(404, "Não há disponibilidade semanal para desativar.");
    db.transaction(() => {
      db.prepare("UPDATE agenda_disponibilidade SET ativo = 0, atualizadoEm = ? WHERE id = ?").run(agora(), regra.id);
      limparGerados(regra.id);
    }).immediate();
    return { ok: true };
  }

  // Uma vez só: a conta da plataforma ganha agenda de seg a sex, 8h às 20h,
  // reuniões de 30 min começando de hora em hora (8h, 9h… 19h). Depois disso,
  // quem manda é o painel.
  function garantirAgendaPadrao(emailAdmin = "") {
    ajustarPadraoDeHoraEmHora();
    if (db.prepare("SELECT 1 FROM agenda_config WHERE chave = 'agendaPadrao'").get()) return null;
    const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY (lower(email) = ?) DESC, criadoEm LIMIT 1").get(String(emailAdmin).toLowerCase());
    if (!admin) return null;
    const t = agora();
    db.transaction(() => {
      if (!db.prepare("SELECT 1 FROM agenda_disponibilidade").get()) {
        db.prepare("INSERT INTO agenda_disponibilidade (id, closerId, dias, inicioMin, fimMin, duracao, intervalo, criadoEm, atualizadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(randomUUID(), admin.id, JSON.stringify([1, 2, 3, 4, 5]), 8 * 60, 20 * 60, 30, 60, t, t);
      }
      db.prepare("INSERT INTO agenda_config (chave, valor) VALUES ('agendaPadrao', ?)").run(String(t));
    }).immediate();
    return admin.id;
  }

  // A primeira agenda padrão saiu de meia em meia hora. Uma vez só: se ela
  // continua do jeito que foi criada, passa a ser de hora em hora. Horários
  // livres de meia hora somem; reunião já marcada não muda.
  function ajustarPadraoDeHoraEmHora() {
    if (db.prepare("SELECT 1 FROM agenda_config WHERE chave = 'agendaPadraoHora'").get()) return;
    db.transaction(() => {
      const regra = db.prepare(`SELECT d.id FROM agenda_disponibilidade d JOIN users u ON u.id = d.closerId
        WHERE u.role = 'admin' AND d.dias = '[1,2,3,4,5]' AND d.inicioMin = 480 AND d.fimMin = 1200 AND d.duracao = 30 AND d.intervalo IN (0, 30)`).get();
      if (regra) {
        db.prepare("UPDATE agenda_disponibilidade SET intervalo = 60, atualizadoEm = ? WHERE id = ?").run(agora(), regra.id);
        limparGerados(regra.id);
      }
      db.prepare("INSERT INTO agenda_config (chave, valor) VALUES ('agendaPadraoHora', ?)").run(String(agora()));
    }).immediate();
  }

  // Admin passa a reunião para outro profissional (ou para a própria agenda).
  // O horário antigo volta a ficar livre para outra empresa.
  function transferir(user, reuniaoId, closerId) {
    if (user?.role !== "admin") falhar(403, "Apenas administradores transferem reuniões.");
    if (typeof closerId !== "string" || !liberado(closerId)) falhar(400, "Escolha alguém com acesso ativo à agenda.");
    return db.transaction(() => {
      const r = db.prepare("SELECT r.id, r.status, h.closerId, h.inicio, h.fim FROM agenda_reunioes r JOIN agenda_horarios h ON h.id = r.horarioId WHERE r.id = ?").get(reuniaoId);
      if (!r) falhar(404, "Reunião não encontrada.");
      if (r.status !== "agendada" || r.fim <= agora()) falhar(409, "Só dá para transferir reuniões futuras agendadas.");
      if (r.closerId === closerId) falhar(400, "A reunião já está com essa pessoa.");
      let destino = db.prepare(`SELECT h.id FROM agenda_horarios h WHERE h.closerId = ? AND h.inicio = ? AND h.fim = ? AND h.ativo = 1 AND NOT ${reservaAtiva}`).get(closerId, r.inicio, r.fim);
      if (!destino) {
        if (db.prepare(`SELECT 1 FROM agenda_horarios h WHERE h.closerId = ? AND h.inicio < ? AND h.fim > ? AND (h.ativo = 1 OR ${reservaAtiva})`).get(closerId, r.fim, r.inicio))
          falhar(409, "Essa pessoa já tem outro compromisso nesse horário.");
        destino = { id: randomUUID() };
        db.prepare("INSERT INTO agenda_horarios (id, closerId, inicio, fim) VALUES (?, ?, ?, ?)").run(destino.id, closerId, r.inicio, r.fim);
      }
      db.prepare("UPDATE agenda_reunioes SET horarioId = ?, atualizadoEm = ?, atualizadoPor = ? WHERE id = ?").run(destino.id, agora(), user.id, reuniaoId);
      return { ok: true };
    }).immediate();
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

  return {
    acesso, liberar, publicar, horariosPublicos, salvarPrecadastro, lerPrecadastro, reservar, reservarPrecadastro, painel, retirar, status,
    resultadoVenda, aprendizado, gerarDisponibilidade, salvarDisponibilidade, desativarDisponibilidade, garantirAgendaPadrao, transferir,
  };
}

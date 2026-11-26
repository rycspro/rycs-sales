import { criarSchemaAgenda } from "./services/agendaComercial.js";
import { criarSchemaCalendario } from "./services/calendarioComercial.js";
import { criarSchemaGestaoInterna } from "./services/gestaoInterna.js";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { accessSync, constants } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Em produção o banco PRECISA viver no volume persistente (/data). Se ficar no
// container, é apagado a cada deploy — e cada cadastro novo some no deploy
// seguinte. Prioridade: DB_PATH do ambiente > /data/data.db (se gravável, em
// produção) > arquivo local (dev). O fallback evita derrubar o app se /data
// não estiver montado/gravável, mas avisa alto para a config ser corrigida.
function resolverDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.NODE_ENV === "production") {
    try {
      accessSync("/data", constants.W_OK);
      return "/data/data.db";
    } catch {
      console.warn("[db] ALERTA: /data não está gravável e DB_PATH não foi definido — o banco vive no container e SERÁ APAGADO no próximo deploy. Configure DB_PATH=/data/data.db.");
    }
  }
  return join(__dirname, "data.db");
}

const DB_PATH = resolverDbPath();
const db = new Database(DB_PATH);
console.log(`[db] ${DB_PATH}`);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("cache_size = -32000");
db.pragma("temp_store = MEMORY");
db.pragma("synchronous = NORMAL");
db.pragma("busy_timeout = 5000");

// Marcador persistente exclusivo do banco Beta. Ele não contém dados de
// negócio e permite que operações de teste confirmem o alvo antes de agir.
db.exec(`CREATE TABLE IF NOT EXISTS beta_environment (id INTEGER PRIMARY KEY CHECK (id = 1), resetAt INTEGER NOT NULL)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sellers (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    whats TEXT NOT NULL,
    cidade TEXT DEFAULT '',
    perfil TEXT DEFAULT 'sdr',
    experiencia TEXT DEFAULT '',
    status TEXT DEFAULT 'triagem',
    nota INTEGER DEFAULT 100,
    nivel TEXT DEFAULT 'starter',
    pix TEXT DEFAULT '',
    disponivel REAL DEFAULT 0,
    pendente REAL DEFAULT 0,
    sacado REAL DEFAULT 0,
    respostas TEXT DEFAULT '[]',
    video TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    produto TEXT NOT NULL,
    ticket TEXT DEFAULT '',
    icp TEXT DEFAULT '',
    plano TEXT DEFAULT 'saldo',
    destaque INTEGER DEFAULT 0,
    saldo REAL DEFAULT 0,
    vagas INTEGER DEFAULT 0,
    cor TEXT DEFAULT '#2563EB',
    totalAportado REAL DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    comissoes TEXT DEFAULT '{}',
    curso TEXT DEFAULT '[]',
    aportes TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    produto TEXT DEFAULT '',
    publico TEXT DEFAULT '',
    status TEXT DEFAULT 'ativa',
    vagas INTEGER DEFAULT 0,
    comissoes TEXT DEFAULT '{}',
    treinamento TEXT DEFAULT '[]',
    requisitos TEXT DEFAULT '',
    objetivo TEXT DEFAULT '',
    regiao TEXT DEFAULT '',
    funcao TEXT DEFAULT '',
    orcamento REAL DEFAULT 0,
    reservado REAL DEFAULT 0,
    tarefas TEXT DEFAULT '{}',
    evidencias TEXT DEFAULT '{}',
    criteriosAprovacao TEXT DEFAULT '{}',
    prazoHoras INTEGER DEFAULT 48,
    duracaoDias INTEGER DEFAULT 30,
    limitePorProfissional INTEGER DEFAULT 0,
    aceitaLeadProprio INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS campaign_applications (
    id TEXT PRIMARY KEY,
    campaignId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (campaignId) REFERENCES campaigns(id),
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );

  -- Linha do tempo operacional unificada. As tabelas de origem continuam
  -- sendo a fonte de verdade; este log append-only permite montar feed,
  -- analytics e contexto de IA sem varrer cada módulo a cada acesso.
  CREATE TABLE IF NOT EXISTS campaign_events (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    tipo TEXT NOT NULL,
    actorId TEXT,
    actorRole TEXT DEFAULT 'sistema',
    sellerId TEXT,
    submissionId TEXT,
    leadId TEXT,
    source TEXT DEFAULT 'SYSTEM',
    dados TEXT DEFAULT '{}',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (campaignId) REFERENCES campaigns(id)
  );

  CREATE TABLE IF NOT EXISTS applications (
    sellerId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    PRIMARY KEY (sellerId, companyId),
    FOREIGN KEY (sellerId) REFERENCES sellers(id),
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS partnership_requests (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    criadoEm INTEGER NOT NULL,
    respondidoEm INTEGER,
    UNIQUE(companyId, sellerId),
    FOREIGN KEY (companyId) REFERENCES companies(id),
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );

  CREATE TABLE IF NOT EXISTS professional_notes (
    companyId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    observacao TEXT DEFAULT '',
    atualizadoEm INTEGER NOT NULL,
    PRIMARY KEY (companyId, sellerId),
    FOREIGN KEY (companyId) REFERENCES companies(id),
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );

  CREATE TABLE IF NOT EXISTS course_progress (
    sellerId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    moduleIds TEXT DEFAULT '[]',
    PRIMARY KEY (sellerId, companyId),
    FOREIGN KEY (sellerId) REFERENCES sellers(id),
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    campaignId TEXT,
    leadId TEXT,
    tipo TEXT NOT NULL,
    valor REAL DEFAULT 0,
    liquido REAL,
    prova TEXT DEFAULT '{}',
    arquivos TEXT DEFAULT '[]',
    status TEXT DEFAULT 'analisando',
    confianca INTEGER,
    motivo TEXT,
    fonte TEXT,
    idempotencyKey TEXT,
    proofHash TEXT DEFAULT '',
    auditVersion TEXT DEFAULT '',
    riskLevel TEXT DEFAULT 'medio',
    reviewRequired INTEGER DEFAULT 1,
    reviewedBy TEXT,
    reviewedEm INTEGER,
    reviewChecklist TEXT DEFAULT '[]',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (sellerId) REFERENCES sellers(id),
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  -- A prova bruta continua no snapshot de submission para o participante
  -- autorizado; esta tabela guarda um recibo lacrado de cada campo sem
  -- duplicar telefone, documento ou link em texto aberto.
  CREATE TABLE IF NOT EXISTS submission_evidence (
    id TEXT PRIMARY KEY,
    submissionId TEXT NOT NULL,
    campo TEXT NOT NULL,
    origem TEXT NOT NULL,
    valueHash TEXT NOT NULL,
    metadados TEXT DEFAULT '{}',
    hash TEXT NOT NULL,
    criadoPor TEXT,
    criadoEm INTEGER NOT NULL,
    UNIQUE (submissionId, campo, origem)
  );

  -- Livro append-only: toda mudança relevante recebe um hash HMAC encadeado
  -- ao evento anterior. A tabela de submissions é a projeção atual; esta é a
  -- fonte de comprovação de como o estado foi alcançado.
  CREATE TABLE IF NOT EXISTS submission_events (
    id TEXT PRIMARY KEY,
    submissionId TEXT NOT NULL,
    sequencia INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    atorId TEXT,
    atorRole TEXT NOT NULL,
    statusAnterior TEXT,
    statusNovo TEXT,
    motivoCodigo TEXT DEFAULT '',
    observacao TEXT DEFAULT '',
    checklist TEXT DEFAULT '[]',
    dados TEXT DEFAULT '{}',
    hashAnterior TEXT DEFAULT '',
    hash TEXT NOT NULL,
    criadoEm INTEGER NOT NULL,
    UNIQUE (submissionId, sequencia)
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    valor REAL NOT NULL,
    pix TEXT NOT NULL,
    status TEXT DEFAULT 'solicitado',
    asaasId TEXT,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    de TEXT NOT NULL,
    texto TEXT NOT NULL,
    ts INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id),
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    corpo TEXT DEFAULT '',
    lida INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    role TEXT NOT NULL,
    entityId TEXT,
    resetToken TEXT,
    resetExpira INTEGER,
    aceitouTermos INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS score_dimensions (
    sellerId TEXT NOT NULL,
    dimension TEXT NOT NULL,
    valor INTEGER DEFAULT 0,
    role TEXT DEFAULT 'geral',
    atualizadoEm INTEGER NOT NULL,
    PRIMARY KEY (sellerId, dimension, role),
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );

  -- RYCS Academy: progresso nos módulos, tentativas de prova e certificações.
  CREATE TABLE IF NOT EXISTS academy_progress (
    sellerId TEXT NOT NULL,
    funcao TEXT NOT NULL,
    modulosVistos TEXT DEFAULT '[]',
    atualizadoEm INTEGER NOT NULL,
    PRIMARY KEY (sellerId, funcao),
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );

  CREATE TABLE IF NOT EXISTS academy_attempts (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    funcao TEXT NOT NULL,
    acertos INTEGER NOT NULL,
    total INTEGER NOT NULL,
    percentual INTEGER NOT NULL,
    aprovado INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );

  CREATE TABLE IF NOT EXISTS certifications (
    sellerId TEXT NOT NULL,
    funcao TEXT NOT NULL,
    nivel TEXT DEFAULT 'certified',
    percentual INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    PRIMARY KEY (sellerId, funcao),
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );

  -- Reputação da empresa, espelhando o score do profissional.
  CREATE TABLE IF NOT EXISTS company_score_dimensions (
    companyId TEXT NOT NULL,
    dimension TEXT NOT NULL,
    valor INTEGER DEFAULT 0,
    atualizadoEm INTEGER NOT NULL,
    PRIMARY KEY (companyId, dimension),
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  -- Assinatura do plano SaaS, separada do caixa de campanha.
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    plano TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    asaasId TEXT,
    valor REAL DEFAULT 0,
    inicio INTEGER,
    proximaCobranca INTEGER,
    trialOrigem TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS credit_subscription_attempts (
    companyId TEXT PRIMARY KEY,
    id TEXT NOT NULL,
    customerId TEXT NOT NULL,
    plano TEXT NOT NULL,
    ciclo TEXT NOT NULL,
    dados TEXT NOT NULL,
    criadoEm INTEGER NOT NULL
  );

  -- Convites de trial. O token NÃO é guardado: fica só o hash dele.
  -- Um vazamento do banco entregaria acessos gratuitos de graça, e link de
  -- convite é credencial como qualquer outra.
  CREATE TABLE IF NOT EXISTS trial_links (
    id TEXT PRIMARY KEY,
    tokenHash TEXT UNIQUE NOT NULL,
    dias INTEGER NOT NULL,
    plano TEXT DEFAULT '',          -- vazio = a empresa escolhe qualquer plano
    criadoPor TEXT,
    criadoEm INTEGER NOT NULL,
    expiraEm INTEGER,               -- o convite vence mesmo sem ser usado
    usadoPor TEXT,                  -- companyId que resgatou
    usadoEm INTEGER,
    subscriptionId TEXT,
    observacao TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL,
    valor REAL NOT NULL,
    validadeEm INTEGER,
    limiteTotal INTEGER DEFAULT 0,
    limitePorEmpresa INTEGER DEFAULT 1,
    planos TEXT DEFAULT '[]',
    status TEXT DEFAULT 'ativo',
    criadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS voucher_redemptions (
    id TEXT PRIMARY KEY,
    voucherId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    subscriptionId TEXT NOT NULL,
    valorOriginal REAL NOT NULL,
    desconto REAL NOT NULL,
    valorFinal REAL NOT NULL,
    status TEXT DEFAULT 'reservado',
    criadoEm INTEGER NOT NULL,
    confirmadoEm INTEGER,
    UNIQUE(voucherId, companyId, subscriptionId)
  );

  CREATE TABLE IF NOT EXISTS company_reports (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    titulo TEXT NOT NULL,
    periodo TEXT DEFAULT '',
    status TEXT DEFAULT 'processando',
    origem TEXT DEFAULT 'operacional',
    dados TEXT DEFAULT '{}',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  -- Member Get Member. A recompensa só vira "qualificada" quando o indicado
  -- produz atividade real; até lá fica pendente e nada é creditado.
  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    codigo TEXT NOT NULL,
    indicadorUserId TEXT NOT NULL,
    indicadoUserId TEXT NOT NULL UNIQUE,
    papelIndicador TEXT NOT NULL,
    papelIndicado TEXT NOT NULL,
    valor REAL DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    criadoEm INTEGER NOT NULL,
    qualificadoEm INTEGER,
    FOREIGN KEY (indicadorUserId) REFERENCES users(id),
    FOREIGN KEY (indicadoUserId) REFERENCES users(id)
  );

  -- Depósitos manuais: a empresa declara que pagou, e um admin confirma o
  -- recebimento. É o único caminho por onde entra saldo sem gateway, então
  -- guarda quem confirmou — crédito manual sem rastro é buraco de auditoria.
  CREATE TABLE IF NOT EXISTS deposit_requests (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    valor REAL NOT NULL,
    status TEXT DEFAULT 'pendente',
    referencia TEXT DEFAULT '',
    observacao TEXT DEFAULT '',
    confirmadoPor TEXT,
    criadoEm INTEGER NOT NULL,
    confirmadoEm INTEGER,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  -- Triagem de entrada da Academy. Guarda toda tentativa: o histórico é o
  -- que permite auditar depois se um score foi manipulado.
  CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    tentativa INTEGER NOT NULL,
    score REAL NOT NULL,
    status TEXT NOT NULL,
    categorias TEXT DEFAULT '{}',
    perfil TEXT DEFAULT '{}',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );

  CREATE TABLE IF NOT EXISTS assessment_answers (
    id TEXT PRIMARY KEY,
    assessmentId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    questionId TEXT NOT NULL,
    resposta TEXT DEFAULT '',
    pontos REAL DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (assessmentId) REFERENCES assessments(id)
  );

  -- Central de leads: o funil que o vendedor opera.
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    campaignId TEXT,
    nome TEXT NOT NULL,
    empresa TEXT DEFAULT '',
    cargo TEXT DEFAULT '',
    telefone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    origem TEXT DEFAULT 'proprio',
    etapa TEXT DEFAULT 'novo',
    valorEstimado REAL DEFAULT 0,
    motivoPerda TEXT DEFAULT '',
    proximaAcao TEXT DEFAULT '',
    proximaAcaoEm INTEGER,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    FOREIGN KEY (sellerId) REFERENCES sellers(id),
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  -- Linha do tempo do lead. Cada evento é evidência de execução: é o que
  -- responde "a tarefa aconteceu?" em vez de "o vendedor disse que fez".
  CREATE TABLE IF NOT EXISTS lead_events (
    id TEXT PRIMARY KEY,
    leadId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    tipo TEXT NOT NULL,
    resultado TEXT DEFAULT '',
    duracao INTEGER DEFAULT 0,
    valor REAL DEFAULT 0,
    observacao TEXT DEFAULT '',
    etapaAntes TEXT DEFAULT '',
    etapaDepois TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (leadId) REFERENCES leads(id)
  );

  -- Receita da plataforma (take rate), registrada a cada ação liberada.
  CREATE TABLE IF NOT EXISTS platform_earnings (
    id TEXT PRIMARY KEY,
    submissionId TEXT NOT NULL UNIQUE,
    companyId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    bruto REAL NOT NULL,
    taxa REAL NOT NULL,
    liquido REAL NOT NULL,
    criadoEm INTEGER NOT NULL
  );

  -- Livro financeiro único. Saldos nas entidades são projeções rápidas; este
  -- histórico explica cada reserva, liberação, estorno, crédito e saque.
  CREATE TABLE IF NOT EXISTS financial_ledger (
    id TEXT PRIMARY KEY,
    companyId TEXT,
    sellerId TEXT,
    submissionId TEXT,
    tipo TEXT NOT NULL,
    valor REAL NOT NULL,
    saldoEmpresa REAL,
    reservadoEmpresa REAL,
    saldoProfissional REAL,
    idempotencyKey TEXT,
    dados TEXT DEFAULT '{}',
    criadoEm INTEGER NOT NULL,
    UNIQUE (tipo, idempotencyKey)
  );

  -- Eventos já processados do gateway, para que reentregas do webhook não
  -- creditem o mesmo pagamento duas vezes.
  CREATE TABLE IF NOT EXISTS gateway_events (
    id TEXT PRIMARY KEY,
    evento TEXT NOT NULL,
    payload TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    submissionId TEXT,
    filename TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    size INTEGER NOT NULL,
    url TEXT NOT NULL,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    campaignId TEXT,
    titulo TEXT NOT NULL,
    categoria TEXT DEFAULT 'geral',
    departamento TEXT DEFAULT 'comercial',
    nivelAcesso TEXT DEFAULT 'empresa',
    idioma TEXT DEFAULT 'pt-BR',
    versao INTEGER DEFAULT 1,
    origem TEXT DEFAULT 'texto',
    responsavel TEXT DEFAULT '',
    validadeEm INTEGER,
    status TEXT DEFAULT 'aguardando',
    conteudo TEXT DEFAULT '',
    erro TEXT DEFAULT '',
    atualizadoEm INTEGER NOT NULL,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS knowledge_history (
    id TEXT PRIMARY KEY,
    documentId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    acao TEXT NOT NULL,
    versao INTEGER NOT NULL,
    atorId TEXT,
    criadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assistant_history (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    userId TEXT NOT NULL,
    pergunta TEXT NOT NULL,
    resposta TEXT NOT NULL,
    fontes TEXT DEFAULT '[]',
    criadoEm INTEGER NOT NULL
  );

  -- Não existe rota que atualize eventos ou evidências. Esta trava protege o
  -- histórico também contra alterações acidentais feitas por código futuro.
  CREATE TRIGGER IF NOT EXISTS no_update_submission_events
  BEFORE UPDATE ON submission_events
  BEGIN
    SELECT RAISE(ABORT, 'Eventos de auditoria são imutáveis');
  END;

  CREATE TRIGGER IF NOT EXISTS no_update_submission_evidence
  BEFORE UPDATE ON submission_evidence
  BEGIN
    SELECT RAISE(ABORT, 'Evidências de auditoria são imutáveis');
  END;

  CREATE TRIGGER IF NOT EXISTS no_update_campaign_events
  BEFORE UPDATE ON campaign_events
  BEGIN
    SELECT RAISE(ABORT, 'Eventos de campanha são imutáveis');
  END;

  CREATE TRIGGER IF NOT EXISTS no_delete_campaign_events
  BEFORE DELETE ON campaign_events
  BEGIN
    SELECT RAISE(ABORT, 'Eventos de campanha são imutáveis');
  END;

  -- =====================================================================
  -- RYCS AUDIT ENGINE
  --
  -- Política é dado versionado: uma auditoria guarda a VERSÃO que a julgou,
  -- e não um ponteiro para a política de hoje. Sem isso, mudar um peso
  -- reescreveria retroativamente o motivo de toda decisão passada.
  -- =====================================================================

  CREATE TABLE IF NOT EXISTS audit_policies (
    id TEXT PRIMARY KEY,
    companyId TEXT,                    -- NULL = política padrão da plataforma
    tipo TEXT NOT NULL,                -- tipo de tarefa que esta política audita
    nome TEXT NOT NULL,
    versao INTEGER NOT NULL DEFAULT 1,
    criterios TEXT NOT NULL DEFAULT '[]',
    limiares TEXT NOT NULL DEFAULT '{}',
    ativo INTEGER NOT NULL DEFAULT 1,
    criadoPor TEXT,
    criadoEm INTEGER NOT NULL,
    UNIQUE (companyId, tipo, versao)
  );

  CREATE TABLE IF NOT EXISTS audit_requests (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,              -- submissions.id
    sellerId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    policyId TEXT,
    policyVersao INTEGER,
    politicaSnapshot TEXT DEFAULT '{}',-- cópia da política no momento do julgamento
    status TEXT NOT NULL DEFAULT 'pendente',
    score REAL,
    cobertura REAL,
    decisao TEXT,
    motivo TEXT DEFAULT '',
    detalhe TEXT DEFAULT '',
    explicacao TEXT DEFAULT '{}',
    tentativas INTEGER NOT NULL DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    iniciadoEm INTEGER,
    concluidoEm INTEGER
  );

  CREATE TABLE IF NOT EXISTS audit_evidences (
    id TEXT PRIMARY KEY,
    auditRequestId TEXT NOT NULL,
    tipo TEXT NOT NULL,                -- imagem | audio | video | texto | geo | metadata
    referencia TEXT DEFAULT '',        -- chave no storage ou id do upload
    hash TEXT,                         -- SHA-256 do conteúdo
    hashPerceptual TEXT,               -- reservado para pHash
    metadata TEXT DEFAULT '{}',
    origem TEXT DEFAULT 'vendedor',
    criadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_signals (
    id TEXT PRIMARY KEY,
    auditRequestId TEXT NOT NULL,
    chave TEXT NOT NULL,               -- GPS_DISTANCE, IMAGE_DUPLICATE, ...
    valor TEXT DEFAULT '',
    severidade TEXT DEFAULT 'info',    -- info | atencao | critico
    detalhe TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_provider_runs (
    id TEXT PRIMARY KEY,
    auditRequestId TEXT,
    capacidade TEXT NOT NULL,
    operacao TEXT DEFAULT '',
    provider TEXT,
    modelo TEXT,
    status TEXT NOT NULL,
    latenciaMs INTEGER DEFAULT 0,
    custoEstimado REAL,
    tokensEntrada INTEGER,
    tokensSaida INTEGER,
    erro TEXT,
    criadoEm INTEGER NOT NULL
  );

  -- Fila de processamento assíncrono. Auditoria pesada não roda dentro do
  -- request do vendedor: ele envia, recebe "em auditoria" e a fila processa.
  CREATE TABLE IF NOT EXISTS audit_jobs (
    id TEXT PRIMARY KEY,
    auditRequestId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    tentativas INTEGER NOT NULL DEFAULT 0,
    proximaTentativaEm INTEGER,
    ultimoErro TEXT,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  );

  -- Revisão humana e correção de decisão da IA. As duas colunas finais são o
  -- começo do dataset próprio da RYCS: quando uma pessoa discorda do motor,
  -- essa discordância é o rótulo mais valioso que existe.
  CREATE TABLE IF NOT EXISTS audit_reviews (
    id TEXT PRIMARY KEY,
    auditRequestId TEXT NOT NULL,
    revisorId TEXT NOT NULL,
    revisorRole TEXT NOT NULL,
    decisaoAnterior TEXT,
    decisaoFinal TEXT NOT NULL,
    concordouComMotor INTEGER NOT NULL DEFAULT 1,
    motivo TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_requests_task ON audit_requests (taskId);
  CREATE INDEX IF NOT EXISTS idx_audit_requests_status ON audit_requests (status);
  CREATE INDEX IF NOT EXISTS idx_audit_jobs_status ON audit_jobs (status, proximaTentativaEm);
  CREATE INDEX IF NOT EXISTS idx_audit_evidences_hash ON audit_evidences (hash);
  CREATE INDEX IF NOT EXISTS idx_audit_signals_request ON audit_signals (auditRequestId);
  CREATE INDEX IF NOT EXISTS idx_provider_runs_request ON audit_provider_runs (auditRequestId);

  -- =====================================================================
  -- RYCS ACADEMY
  --
  -- Curso é dado, não código. As trilhas nasceram fixas em shared/academy.js
  -- e continuam funcionando; daqui para frente o catálogo vive no banco e a
  -- plataforma cria, edita e publica sem deploy.
  -- =====================================================================

  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    titulo TEXT NOT NULL,
    subtitulo TEXT DEFAULT '',
    descricao TEXT DEFAULT '',
    categoria TEXT DEFAULT 'Vendas',
    nivel TEXT DEFAULT 'fundamentos',
    professor TEXT DEFAULT 'RYCS',
    capa TEXT DEFAULT '',
    requisitos TEXT DEFAULT '',
    funcao TEXT DEFAULT '',          -- liga o curso à certificação de função
    gratuito INTEGER NOT NULL DEFAULT 1,
    preco REAL NOT NULL DEFAULT 0,
    notaMinima INTEGER NOT NULL DEFAULT 70,
    status TEXT NOT NULL DEFAULT 'rascunho',
    ordem INTEGER DEFAULT 0,
    criadoPor TEXT,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS course_modules (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    titulo TEXT NOT NULL,
    resumo TEXT DEFAULT '',
    ordem INTEGER DEFAULT 0,
    FOREIGN KEY (courseId) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS course_lessons (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    moduleId TEXT NOT NULL,
    titulo TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'texto',   -- texto | video
    conteudo TEXT DEFAULT '',
    videoUrl TEXT DEFAULT '',
    materiais TEXT DEFAULT '[]',
    duracaoMin INTEGER DEFAULT 5,
    ordem INTEGER DEFAULT 0,
    FOREIGN KEY (courseId) REFERENCES courses(id),
    FOREIGN KEY (moduleId) REFERENCES course_modules(id)
  );

  CREATE TABLE IF NOT EXISTS course_questions (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    pergunta TEXT NOT NULL,
    alternativas TEXT NOT NULL DEFAULT '[]',
    correta INTEGER NOT NULL DEFAULT 0,
    explicacao TEXT DEFAULT '',
    ordem INTEGER DEFAULT 0,
    FOREIGN KEY (courseId) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS course_enrollments (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    origem TEXT DEFAULT 'gratuito',   -- gratuito | compra | cortesia
    criadoEm INTEGER NOT NULL,
    concluidoEm INTEGER,
    UNIQUE (courseId, sellerId)
  );

  -- Progresso por aula: é o que permite "continuar de onde parou".
  CREATE TABLE IF NOT EXISTS course_lesson_progress (
    sellerId TEXT NOT NULL,
    courseId TEXT NOT NULL,
    lessonId TEXT NOT NULL,
    concluidoEm INTEGER NOT NULL,
    PRIMARY KEY (sellerId, lessonId)
  );

  CREATE TABLE IF NOT EXISTS course_attempts (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    acertos INTEGER NOT NULL,
    total INTEGER NOT NULL,
    percentual INTEGER NOT NULL,
    aprovado INTEGER NOT NULL DEFAULT 0,
    respostas TEXT DEFAULT '{}',
    criadoEm INTEGER NOT NULL
  );

  -- Certificado emitido. O código é público e serve para conferência: um
  -- certificado sem como verificar não vale como credencial.
  CREATE TABLE IF NOT EXISTS course_certificates (
    id TEXT PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    courseId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    percentual INTEGER NOT NULL,
    emitidoEm INTEGER NOT NULL,
    UNIQUE (courseId, sellerId)
  );

  CREATE INDEX IF NOT EXISTS idx_courses_status ON courses (status, ordem);
  CREATE INDEX IF NOT EXISTS idx_modules_course ON course_modules (courseId, ordem);
  CREATE INDEX IF NOT EXISTS idx_lessons_course ON course_lessons (courseId, ordem);
  CREATE INDEX IF NOT EXISTS idx_progress_seller ON course_lesson_progress (sellerId, courseId);
  CREATE INDEX IF NOT EXISTS idx_enroll_seller ON course_enrollments (sellerId);
`);

// =====================================================================
// INFORMAÇÕES DA EMPRESA (base de conhecimento estruturada em Materiais)
//
// Uma única tabela flexível serve as quatro seções (sobre, produtos,
// abordagens, processos). Campos próprios de cada seção vivem em `dados`
// (JSON): características/benefícios/preço de um produto, etapas[] de um
// procedimento, etc. Isso evita quatro esquemas paralelos e permite blocos
// personalizados. Privacidade por empresa via companyId + authMiddleware.
// A Academy consome estas entradas para gerar capacitação.
// =====================================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS company_info_entries (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    secao TEXT NOT NULL,            -- sobre | produtos | abordagens | processos
    tipo TEXT DEFAULT 'bloco',      -- bloco | produto | orientacao | procedimento | custom
    titulo TEXT DEFAULT '',
    descricao TEXT DEFAULT '',
    conteudo TEXT DEFAULT '',
    dados TEXT DEFAULT '{}',        -- JSON: campos flexíveis por seção
    anexos TEXT DEFAULT '[]',       -- JSON: ids de materiais vinculados da biblioteca
    ordem INTEGER DEFAULT 0,
    status TEXT DEFAULT 'rascunho', -- rascunho | salvo
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );
  CREATE INDEX IF NOT EXISTS idx_company_info ON company_info_entries (companyId, secao, ordem);

  -- Fontes usadas para gerar/compor um treinamento da Academy. Guarda a versão
  -- da fonte no momento do uso, para a "atualização inteligente" detectar quando
  -- uma informação de Materiais mudou depois que o treino foi criado.
  CREATE TABLE IF NOT EXISTS course_sources (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    fonteTipo TEXT NOT NULL,       -- informacao | documento | arquivo
    fonteId TEXT NOT NULL,         -- id lógico da fonte (ex.: info-<id>, doc-<id>)
    rotulo TEXT DEFAULT '',
    versao INTEGER DEFAULT 1,
    criadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_course_sources ON course_sources (companyId, courseId);
`);

const uid = () => randomUUID();
const agora = () => Date.now();

// CREATE TABLE IF NOT EXISTS não altera tabelas já existentes, então colunas
// novas precisam ser adicionadas à parte para não quebrar bancos em uso.
function adicionarColuna(tabela, coluna, definicao) {
  const existe = db.prepare(`PRAGMA table_info(${tabela})`).all().some((c) => c.name === coluna);
  if (!existe) db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
}

adicionarColuna("companies", "documento", "TEXT DEFAULT ''");
adicionarColuna("companies", "asaasCustomerId", "TEXT");
adicionarColuna("withdrawals", "falhaMotivo", "TEXT");
// Prazo de processamento interno previsto (pelo plano ativo na solicitação).
adicionarColuna("withdrawals", "processaAte", "INTEGER");
// `plano` já existia com outro sentido ('saldo'/'destaque'); a assinatura
// SaaS vive em coluna própria para não misturar os dois conceitos.
adicionarColuna("companies", "assinatura", "TEXT DEFAULT 'free'");
adicionarColuna("companies", "nota", "INTEGER DEFAULT 0");
adicionarColuna("companies", "qualificacao", "TEXT DEFAULT '{}'");
adicionarColuna("companies", "razaoSocial", "TEXT DEFAULT ''");
adicionarColuna("companies", "endereco", "TEXT DEFAULT ''");
adicionarColuna("companies", "segmento", "TEXT DEFAULT ''");
adicionarColuna("companies", "regiao", "TEXT DEFAULT ''");
adicionarColuna("companies", "diferenciais", "TEXT DEFAULT ''");
adicionarColuna("companies", "objecoes", "TEXT DEFAULT ''");
adicionarColuna("companies", "representanteLegal", "TEXT DEFAULT ''");
adicionarColuna("companies", "contatoFinanceiro", "TEXT DEFAULT ''");
adicionarColuna("companies", "contatoComercial", "TEXT DEFAULT ''");
adicionarColuna("companies", "materiais", "TEXT DEFAULT '[]'");
adicionarColuna("companies", "statusCadastro", "TEXT DEFAULT 'rascunho'");
adicionarColuna("companies", "situacaoCadastral", "TEXT DEFAULT ''");
adicionarColuna("companies", "dataAbertura", "TEXT DEFAULT ''");
adicionarColuna("companies", "naturezaJuridica", "TEXT DEFAULT ''");
adicionarColuna("companies", "cnaes", "TEXT DEFAULT ''");
adicionarColuna("companies", "telefoneEmpresa", "TEXT DEFAULT ''");
adicionarColuna("companies", "emailEmpresa", "TEXT DEFAULT ''");
adicionarColuna("companies", "saldoReservado", "REAL DEFAULT 0");
adicionarColuna("companies", "destaqueTipo", "TEXT DEFAULT ''");
// Assinatura recorrente (Asaas) do destaque/visibilidade — guardada para poder
// cancelar a recorrência no gateway quando a empresa encerrar o destaque.
adicionarColuna("companies", "destaqueAsaasId", "TEXT");
adicionarColuna("companies", "visivel", "INTEGER DEFAULT 1");
adicionarColuna("companies", "aprovadoPor", "TEXT");
// Regras de aprovação automática configuradas pela empresa. Guardadas como
// JSON: o conjunto muda com o produto e uma coluna por critério viraria uma
// migração a cada ajuste.
adicionarColuna("companies", "regrasAprovacao", "TEXT DEFAULT '{}'");
// Logo da empresa, guardada como data URI — mesma decisão da foto do perfil:
// um logotipo pequeno não justifica depender de S3 configurado.
adicionarColuna("companies", "logo", "TEXT DEFAULT ''");
adicionarColuna("companies", "aprovadoEm", "INTEGER");
adicionarColuna("campaigns", "exigeCertificacao", "INTEGER DEFAULT 0");
adicionarColuna("campaigns", "funcao", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "objetivo", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "regiao", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "orcamento", "REAL DEFAULT 0");
adicionarColuna("campaigns", "reservado", "REAL DEFAULT 0");
adicionarColuna("campaigns", "tarefas", "TEXT DEFAULT '{}'");
adicionarColuna("campaigns", "evidencias", "TEXT DEFAULT '{}'");
adicionarColuna("campaigns", "criteriosAprovacao", "TEXT DEFAULT '{}'");
adicionarColuna("campaigns", "prazoHoras", "INTEGER DEFAULT 48");
adicionarColuna("campaigns", "duracaoDias", "INTEGER DEFAULT 30");
adicionarColuna("campaigns", "limitePorProfissional", "INTEGER DEFAULT 0");
adicionarColuna("campaigns", "aceitaLeadProprio", "INTEGER DEFAULT 0");
adicionarColuna("users", "codigoIndicacao", "TEXT");
adicionarColuna("sellers", "pixTipo", "TEXT DEFAULT ''");
adicionarColuna("sellers", "estado", "TEXT DEFAULT ''");
adicionarColuna("sellers", "documento", "TEXT DEFAULT ''");
adicionarColuna("sellers", "tipoVendedor", "TEXT DEFAULT ''");
adicionarColuna("sellers", "perfilComercial", "TEXT DEFAULT '{}'");
adicionarColuna("sellers", "scoreTriagem", "REAL DEFAULT 0");
// Decisão humana da triagem. Separada do score para preservar quem decidiu,
// quando decidiu e qual justificativa foi comunicada ao profissional.
adicionarColuna("sellers", "notaTriagem", "TEXT DEFAULT ''");
adicionarColuna("sellers", "decididoPor", "TEXT");
adicionarColuna("sellers", "decididoEm", "INTEGER");
adicionarColuna("sellers", "emailVerificado", "INTEGER DEFAULT 0");
// Perfil profissional — o currículo comercial do vendedor dentro da RYCS.
// A foto fica como data URI: um avatar pequeno não justifica depender de S3
// configurado, e sem storage o upload seria só aparência.
adicionarColuna("sellers", "foto", "TEXT DEFAULT ''");
adicionarColuna("sellers", "fotoScore", "INTEGER");
// Imagem original (sem recorte) e parâmetros do enquadramento, para o editor de
// foto reabrir e reajustar sem perder a imagem de origem.
adicionarColuna("sellers", "fotoOriginal", "TEXT DEFAULT ''");
adicionarColuna("sellers", "fotoEnquadramento", "TEXT DEFAULT '{}'");
// Currículo enviado no cadastro (data URI) + nome original do arquivo, visível à empresa.
adicionarColuna("sellers", "curriculo", "TEXT DEFAULT ''");
adicionarColuna("sellers", "curriculoNome", "TEXT DEFAULT ''");
adicionarColuna("sellers", "titulo", "TEXT DEFAULT ''");
adicionarColuna("sellers", "bio", "TEXT DEFAULT ''");
adicionarColuna("sellers", "segmentos", "TEXT DEFAULT '[]'");
adicionarColuna("sellers", "modalidades", "TEXT DEFAULT '[]'");
adicionarColuna("sellers", "regioes", "TEXT DEFAULT '[]'");
adicionarColuna("sellers", "skills", "TEXT DEFAULT '[]'");
adicionarColuna("sellers", "disponibilidade", "TEXT DEFAULT ''");
adicionarColuna("sellers", "cadastroCompletadoNotificado", "INTEGER DEFAULT 0");
adicionarColuna("companies", "diaFechamento", "INTEGER");
adicionarColuna("companies", "diaPagamento", "INTEGER");
adicionarColuna("companies", "modalidadePagamento", "TEXT DEFAULT 'pre'");
adicionarColuna("companies", "limiteCredito", "REAL DEFAULT 0");
// Moeda de operação da empresa (ISO 4217). Travada no primeiro depósito: todo o
// caixa, reserva, liquidação, repasse e take rate rodam nesta moeda.
adicionarColuna("companies", "moeda", "TEXT DEFAULT 'BRL'");
adicionarColuna("companies", "pais", "TEXT DEFAULT 'BR'");

// Carteiras por moeda: quando a empresa troca de país/moeda, a carteira antiga
// fica arquivada (status='arquivada') e nasce uma nova em branco na nova moeda.
// A carteira ativa é sempre a que bate com companies.moeda.
db.exec(`
  CREATE TABLE IF NOT EXISTS company_wallets (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    moeda TEXT NOT NULL,
    saldo REAL NOT NULL DEFAULT 0,
    reservado REAL NOT NULL DEFAULT 0,
    totalAportado REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ativa',
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );
  CREATE INDEX IF NOT EXISTS idx_company_wallets_company ON company_wallets(companyId, status);
`);
// Depósito multi-moeda: moeda do aporte, gateway usado e sessão do Stripe.
adicionarColuna("deposit_requests", "moeda", "TEXT DEFAULT 'BRL'");
adicionarColuna("deposit_requests", "gateway", "TEXT DEFAULT 'manual'");
adicionarColuna("deposit_requests", "stripeSessionId", "TEXT");
adicionarColuna("submissions", "dataLiberacao", "INTEGER");
adicionarColuna("submissions", "leadId", "TEXT");
adicionarColuna("submissions", "idempotencyKey", "TEXT");
adicionarColuna("submissions", "proofHash", "TEXT DEFAULT ''");
adicionarColuna("submissions", "auditVersion", "TEXT DEFAULT ''");
adicionarColuna("submissions", "riskLevel", "TEXT DEFAULT 'medio'");
adicionarColuna("submissions", "reviewRequired", "INTEGER DEFAULT 1");
adicionarColuna("submissions", "reviewedBy", "TEXT");
adicionarColuna("submissions", "reviewedEm", "INTEGER");
adicionarColuna("submissions", "reviewChecklist", "TEXT DEFAULT '[]'");
adicionarColuna("submissions", "statusCliente", "TEXT DEFAULT 'aguardando'");
// Liberações feitas juntas pela tela Liberar compartilham o mesmo lote, para
// o histórico mostrar cada clique como uma linha só.
adicionarColuna("platform_earnings", "loteId", "TEXT");
adicionarColuna("lead_events", "submissionId", "TEXT");
adicionarColuna("course_progress", "quizScore", "INTEGER");
adicionarColuna("course_progress", "quizAnswers", "TEXT DEFAULT '[]'");
adicionarColuna("applications", "criterios", "TEXT DEFAULT '[]'");
adicionarColuna("applications", "quizScore", "INTEGER");
// Aprovação de profissionais: mensagem do vendedor, datas, config de campanhas
adicionarColuna("applications", "mensagem", "TEXT DEFAULT ''");
adicionarColuna("applications", "criadoEm", "INTEGER");
adicionarColuna("applications", "respondidoEm", "INTEGER");
// null = usar default da empresa, 0 = manual por campanha, 1 = auto em todas
adicionarColuna("applications", "campanhasAuto", "INTEGER");
adicionarColuna("partnership_requests", "mensagem", "TEXT DEFAULT ''");
adicionarColuna("partnership_requests", "origem", "TEXT DEFAULT 'empresa'");
// Mensagem que o profissional envia ao se candidatar a uma campanha específica.
adicionarColuna("campaign_applications", "mensagem", "TEXT DEFAULT ''");
// Default da empresa: 0 = cada campanha precisa aprovação manual, 1 = auto
adicionarColuna("companies", "campanhasAutoDefault", "INTEGER DEFAULT 0");

// Migração única: profissionais aprovados antes do sistema de aprovação voltam
// para "pendente" para que a empresa revise cada um na página de Aprovações.
{
  const jaRodou = db.prepare("SELECT COUNT(*) n FROM applications WHERE criadoEm IS NOT NULL AND status = 'pendente'").get().n;
  const semCriadoEm = db.prepare("SELECT COUNT(*) n FROM applications WHERE status = 'aprovado' AND criadoEm IS NULL").get().n;
  if (semCriadoEm > 0) {
    const now = Date.now();
    const resetAprovados = db.prepare(
      "UPDATE applications SET status = 'pendente', criadoEm = ? WHERE status = 'aprovado' AND criadoEm IS NULL"
    ).run(now);
    if (resetAprovados.changes > 0) console.log(`[migracao] ${resetAprovados.changes} aprovação(ões) antiga(s) enviada(s) para revisão na página Aprovações`);

    // Sellers que interagem com empresas (campanhas, mensagens) mas não têm
    // registro em applications precisam de um para aparecer na fila.
    const semApp = db.prepare(`
      SELECT DISTINCT ca.sellerId, c.companyId
      FROM campaign_applications ca
      JOIN campaigns c ON c.id = ca.campaignId
      WHERE NOT EXISTS (SELECT 1 FROM applications a WHERE a.sellerId = ca.sellerId AND a.companyId = c.companyId)
    `).all();
    if (semApp.length) {
      const ins = db.prepare("INSERT OR IGNORE INTO applications (sellerId, companyId, status, criadoEm) VALUES (?, ?, 'pendente', ?)");
      let criados = 0;
      for (const { sellerId, companyId } of semApp) {
        const r = ins.run(sellerId, companyId, now);
        if (r.changes) criados++;
      }
      if (criados) console.log(`[migracao] ${criados} profissional(is) sem application adicionado(s) à fila de aprovação`);
    }
  }
}

adicionarColuna("assistant_history", "contexto", "TEXT DEFAULT ''");
adicionarColuna("assistant_history", "status", "TEXT DEFAULT 'proposto'");
adicionarColuna("assistant_history", "acao", "TEXT DEFAULT 'registrar_analise'");
adicionarColuna("assistant_history", "confirmadoEm", "INTEGER");
adicionarColuna("subscriptions", "valorOriginal", "REAL DEFAULT 0");
adicionarColuna("subscriptions", "desconto", "REAL DEFAULT 0");
adicionarColuna("subscriptions", "voucherId", "TEXT");
adicionarColuna("subscriptions", "paymentId", "TEXT");
adicionarColuna("subscriptions", "invoiceUrl", "TEXT");
// Período gratuito. Guardado na própria assinatura porque é dela que a regra
// de acesso decide: trial vencido sem cobrança confirmada vira inadimplente.
adicionarColuna("subscriptions", "trialFim", "INTEGER");
adicionarColuna("subscriptions", "trialDias", "INTEGER DEFAULT 0");
// Identifica como o período gratuito foi concedido sem misturar o trial
// interno da operação com assinaturas normais do gateway.
adicionarColuna("subscriptions", "trialOrigem", "TEXT DEFAULT ''");
// Forma de pagamento escolhida no checkout ("CREDIT_CARD" ou "PIX"). Só o
// meio, nunca o cartão: número e CVV não passam pelo nosso banco.
adicionarColuna("subscriptions", "formaPagamento", "TEXT DEFAULT ''");
// Últimos quatro dígitos e bandeira, que o Asaas devolve depois de tokenizar.
// É o suficiente para a empresa reconhecer o cartão na tela.
adicionarColuna("subscriptions", "cartaoFinal", "TEXT DEFAULT ''");
adicionarColuna("subscriptions", "cartaoBandeira", "TEXT DEFAULT ''");
adicionarColuna("subscriptions", "falhaMotivo", "TEXT");
// Pix Automático: autorização no Asaas (a assinatura de lá só nasce quando ela é ativada).
adicionarColuna("subscriptions", "asaasAutorizacaoId", "TEXT");
adicionarColuna("subscriptions", "atualizadoEm", "INTEGER");
// Ciclo de cobrança: MENSAL (padrão) ou ANUAL (12 meses com desconto).
adicionarColuna("subscriptions", "ciclo", "TEXT DEFAULT 'MENSAL'");
adicionarColuna("subscriptions", "motivoCancelamento", "TEXT DEFAULT ''");
adicionarColuna("subscriptions", "canceladoEm", "INTEGER");
// Assinatura nascida de uma proposta Enterprise (propostas_plano.id).
adicionarColuna("subscriptions", "propostaId", "TEXT");

// Propostas Enterprise: plano-base, ciclo, valor e condições combinados com
// uma empresa, pagos por um link. Mesmo cuidado do convite de trial: o token
// não é guardado, só o hash — o link vale um desconto e é credencial.
// A proposta pode ser editada até ser paga (mesmo link). Se o que a empresa
// aceita mudar, o aceite é zerado e ela aceita de novo — assim o aceite
// gravado é sempre o do texto e dos valores que estão aqui.
db.exec(`
  CREATE TABLE IF NOT EXISTS propostas_plano (
    id TEXT PRIMARY KEY,
    tokenHash TEXT UNIQUE NOT NULL,
    cliente TEXT NOT NULL,             -- nome do cliente, para o admin reconhecer
    companyId TEXT,                    -- vazio = a primeira empresa que aceitar fica com ela
    planoBase TEXT NOT NULL,
    ciclo TEXT NOT NULL,
    valorOriginal REAL NOT NULL,       -- preço cheio do ciclo, sem desconto
    valorFinal REAL NOT NULL,          -- o que a empresa paga por ciclo
    nicho TEXT DEFAULT '',
    territorio TEXT DEFAULT '',
    condicoes TEXT NOT NULL,
    status TEXT DEFAULT 'aberta',      -- aberta | cancelada
    criadoPor TEXT,
    criadoEm INTEGER NOT NULL,
    expiraEm INTEGER NOT NULL,
    aceitoEm INTEGER,
    aceitoPor TEXT,                    -- users.id de quem marcou "li e aceito"
    aceiteHash TEXT                    -- hash do que foi aceito (valores + condições)
  );
  CREATE INDEX IF NOT EXISTS idx_subscriptions_proposta ON subscriptions(propostaId);
`);
// Forma de pagamento da proposta: PIX | CREDIT_CARD | AMBOS. As propostas
// criadas antes desta coluna eram só Pix.
adicionarColuna("propostas_plano", "formaPagamento", "TEXT DEFAULT 'PIX'");
adicionarColuna("propostas_plano", "editadoEm", "INTEGER");

// Lista de contatos por campanha
db.prepare(`
  CREATE TABLE IF NOT EXISTS campaign_contacts (
    id TEXT PRIMARY KEY,
    campaignId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    nome TEXT DEFAULT '',
    empresa TEXT DEFAULT '',
    cargo TEXT DEFAULT '',
    telefone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    cidade TEXT DEFAULT '',
    extra TEXT DEFAULT '{}',
    status TEXT DEFAULT 'disponivel',
    sellerId TEXT,
    abordadoEm INTEGER,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (campaignId) REFERENCES campaigns(id)
  )
`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_contacts_campaign ON campaign_contacts(campaignId, status)`).run();
adicionarColuna("campaigns", "modelosVerificacao", "TEXT DEFAULT '{}'");
adicionarColuna("campaigns", "quiz", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "notaMinimaQuiz", "INTEGER DEFAULT 70");
adicionarColuna("campaigns", "produto", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "icp", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "prazoFim", "INTEGER DEFAULT 0");
adicionarColuna("campaigns", "modeloOperacao", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "maxTentativasQuiz", "INTEGER DEFAULT 3");
adicionarColuna("campaigns", "visitasPorDia", "INTEGER DEFAULT 0");

// Cérebro da Operação — onboarding inteligente (Lote 7D-2)
db.prepare(`
  CREATE TABLE IF NOT EXISTS brain_onboarding (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL REFERENCES companies(id),
    etapa INTEGER DEFAULT 1,
    concluida INTEGER DEFAULT 0,
    respostas TEXT DEFAULT '{}',
    materiais TEXT DEFAULT '[]',
    resumoIa TEXT DEFAULT '',
    revisado INTEGER DEFAULT 0,
    ativado INTEGER DEFAULT 0,
    scoreCache REAL DEFAULT 0,
    scoreDims TEXT DEFAULT '{}',
    lacunas TEXT DEFAULT '[]',
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  )
`).run();
db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_brain_onboarding_company ON brain_onboarding(companyId)`).run();
adicionarColuna("companies", "diferenciais", "TEXT DEFAULT ''");
adicionarColuna("companies", "objecoes", "TEXT DEFAULT ''");
adicionarColuna("companies", "processo", "TEXT DEFAULT ''");
adicionarColuna("companies", "qualificacao", "TEXT DEFAULT ''");
adicionarColuna("companies", "materiais", "TEXT DEFAULT '[]'");
adicionarColuna("companies", "atualizadoEm", "INTEGER DEFAULT 0");
adicionarColuna("companies", "tipoEmpresa", "TEXT DEFAULT 'padrao'");

// A plataforma deixou de ser portão de entrada: concluir a avaliação libera o
// perfil na hora, e quem decide a entrada numa campanha é a empresa.
//
// Quem já tinha respondido e estava parado esperando análise é liberado junto.
// Sem isso, essas pessoas ficariam presas para sempre numa fila que ninguém
// mais atende — o código que as tirava de lá deixou de existir.
//
// 'recusado' não é tocado: foi decisão humana sobre um caso concreto, e
// reverter em massa apagaria esse julgamento.
// Score começa em 100 (inocente até que prove o contrário).
// Sellers com nota = 0 ou NULL nunca tiveram atividade — resetar para 100.
const notaReset = db.prepare("UPDATE sellers SET nota = 100 WHERE nota = 0 OR nota IS NULL").run();
if (notaReset.changes > 0) console.log(`[migracao] ${notaReset.changes} vendedor(es) com nota zerada → 100`);

// Empresas com nota = 0 ou NULL nunca tiveram atividade — resetar para 100.
const notaResetEmpresas = db.prepare("UPDATE companies SET nota = 100 WHERE nota = 0 OR nota IS NULL").run();
if (notaResetEmpresas.changes > 0) console.log(`[migracao] ${notaResetEmpresas.changes} empresa(s) com nota zerada → 100`);

// Removidos os hardcodes que marcavam empresas específicas (INNER Energia,
// Martin Business) como premium no boot, sem pagamento. Agora só é plano pago
// quem tem assinatura real (subscriptions) ou premium/isenção do admin. A
// normalização dos falsos premium/pagos roda mais abaixo, depois que as
// tabelas company_billing/company_billing_history são criadas.

// Pós-pago foi REMOVIDO da plataforma: toda empresa, de qualquer plano (inclusive
// Premium), volta a pré-pago e passa a precisar de saldo em caixa para rodar
// campanhas. Aditiva e idempotente — a cada boot só altera as linhas que ainda
// estiverem em "pos". Nenhum dado financeiro (saldo, depósitos, histórico) é tocado.
const posPagoResetEmpresas = db.prepare(
  "UPDATE companies SET modalidadePagamento = 'pre' WHERE modalidadePagamento = 'pos'"
).run();
if (posPagoResetEmpresas.changes > 0) console.log(`[migracao] ${posPagoResetEmpresas.changes} empresa(s) em pós-pago voltaram a pré-pago`);

// Habilitação operacional é um portão à parte do plano: premium tira a
// mensalidade, não aprova o cadastro. A Martin Business School é aprovada aqui
// porque a decisão já está tomada — e o botão "Aprovar empresa" do admin exige
// o cadastro completo, que ela ainda não tem.
const martinAprovada = db.prepare(
  "UPDATE companies SET statusCadastro = 'aprovada', aprovadoEm = COALESCE(aprovadoEm, ?) WHERE nome LIKE '%Martin%Business%' AND statusCadastro != 'aprovada'"
).run(Date.now());
if (martinAprovada.changes > 0) console.log(`[migracao] Martin Business School aprovada para operar`);

const liberados = db.prepare("UPDATE sellers SET status = 'aprovado' WHERE status = 'analise'").run();
if (liberados.changes > 0) {
  console.log(`[migracao] ${liberados.changes} profissional(is) liberado(s) da fila de análise`);
}

// Mesma mudança do lado da empresa: cadastro completo aprova na hora, então
// ninguém fica parado em 'em_analise' esperando um passo que não existe mais.
// 'rascunho' não é tocado — ali o cadastro ainda está incompleto, e aprovar
// empresa sem CNPJ é o que essa checagem existe para impedir.
const empresasLiberadas = db.prepare(
  "UPDATE companies SET statusCadastro = 'aprovada', aprovadoEm = COALESCE(aprovadoEm, ?) WHERE statusCadastro = 'em_analise'"
).run(Date.now());
if (empresasLiberadas.changes > 0) {
  console.log(`[migracao] ${empresasLiberadas.changes} empresa(s) liberada(s) da fila de análise`);
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_idempotency
    ON submissions(sellerId, idempotencyKey) WHERE idempotencyKey IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_submissions_lead ON submissions(leadId);
  -- Contagens por profissional e status (gamificação, painel) sem tocar na
  -- tabela: status e criadoEm ficam gravados depois da prova, que pode ter
  -- fotos de MBs, e ler esses campos pela tabela percorria a foto inteira.
  CREATE INDEX IF NOT EXISTS idx_submissions_seller_status ON submissions(sellerId, status, criadoEm, id, valor, liquido);
  CREATE INDEX IF NOT EXISTS idx_submission_evidence_submission ON submission_evidence(submissionId);
  CREATE INDEX IF NOT EXISTS idx_submission_events_submission ON submission_events(submissionId, sequencia);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_events_submission
    ON lead_events(submissionId) WHERE submissionId IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_financial_ledger_company ON financial_ledger(companyId, criadoEm);
  CREATE INDEX IF NOT EXISTS idx_financial_ledger_seller ON financial_ledger(sellerId, criadoEm);
  CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign ON campaign_events(companyId, campaignId, criadoEm DESC);
  CREATE INDEX IF NOT EXISTS idx_campaign_events_seller ON campaign_events(sellerId, criadoEm DESC);
  CREATE TABLE IF NOT EXISTS campaign_quiz_attempts (
    id TEXT PRIMARY KEY,
    campaignId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    score INTEGER NOT NULL,
    respostas TEXT DEFAULT '[]',
    aprovado INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (campaignId) REFERENCES campaigns(id)
  );
  CREATE INDEX IF NOT EXISTS idx_campaign_knowledge ON knowledge_documents(companyId, status, atualizadoEm);
  CREATE INDEX IF NOT EXISTS idx_assistant_company ON assistant_history(companyId, criadoEm);
  CREATE INDEX IF NOT EXISTS idx_partnership_seller ON partnership_requests(sellerId, status, criadoEm);
  CREATE INDEX IF NOT EXISTS idx_voucher_redemptions ON voucher_redemptions(voucherId, companyId, status);
  CREATE INDEX IF NOT EXISTS idx_company_reports ON company_reports(companyId, criadoEm);
`);

// Registros anteriores à linha do tempo são projetados uma única vez. Cada
// item usa um id determinístico e source=BACKFILL; assim o feed aproveita o
// histórico real sem fingir que conhece a hora de aprovações antigas.
db.exec(`
  INSERT OR IGNORE INTO campaign_events
    (id, companyId, campaignId, tipo, actorRole, source, dados, criadoEm)
  SELECT 'backfill:campaign:' || id, companyId, id, 'CAMPAIGN_CREATED', 'sistema', 'BACKFILL', '{}', criadoEm
    FROM campaigns;

  INSERT OR IGNORE INTO campaign_events
    (id, companyId, campaignId, tipo, actorRole, sellerId, source, dados, criadoEm)
  SELECT 'backfill:application:' || ca.id, c.companyId, ca.campaignId, 'PROFESSIONAL_APPLIED', 'profissional', ca.sellerId, 'BACKFILL', '{}', ca.criadoEm
    FROM campaign_applications ca JOIN campaigns c ON c.id = ca.campaignId;

  INSERT OR IGNORE INTO campaign_events
    (id, companyId, campaignId, tipo, actorRole, sellerId, submissionId, source, dados, criadoEm)
  SELECT 'backfill:submission:' || s.id, s.companyId, s.campaignId, 'TASK_COMPLETED', 'profissional', s.sellerId, s.id, 'BACKFILL', json_object('tipo', s.tipo, 'status', s.status), s.criadoEm
    FROM submissions s WHERE s.campaignId IS NOT NULL;

  INSERT OR IGNORE INTO campaign_events
    (id, companyId, campaignId, tipo, actorRole, sellerId, leadId, source, dados, criadoEm)
  SELECT 'backfill:lead:' || l.id, l.companyId, l.campaignId, 'LEAD_CREATED', 'profissional', l.sellerId, l.id, 'BACKFILL', '{}', l.criadoEm
    FROM leads l WHERE l.campaignId IS NOT NULL;
`);

// Cobrança e acesso administrativo por empresa
db.exec(`
  CREATE TABLE IF NOT EXISTS company_billing (
    companyId TEXT PRIMARY KEY,
    billing_status TEXT NOT NULL DEFAULT 'ativa',
    access_status TEXT NOT NULL DEFAULT 'ativo',
    isencao_motivo TEXT DEFAULT NULL,
    isencao_ate INTEGER DEFAULT NULL,
    updatedAt INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS company_billing_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    companyId TEXT NOT NULL,
    campo TEXT NOT NULL,
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    motivo TEXT DEFAULT NULL,
    adminId TEXT NOT NULL,
    criadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS email_sequences (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    companyId TEXT,
    userId TEXT,
    email TEXT NOT NULL,
    passo INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ativa',
    proximoEnvio INTEGER NOT NULL,
    criadoEm INTEGER NOT NULL,
    resolvidoEm INTEGER DEFAULT NULL
  );
`);

// Normaliza os FALSOS premium/pagos de QUALQUER conta: empresa marcada premium
// ou com plano pago em companies.assinatura, mas SEM assinatura real
// (subscriptions) e SEM ação do admin (company_billing_history / isenção).
// Essas voltam ao gratuito e passam a seguir os limites do plano Free.
// Pagantes reais e empresas premium/isentas pelo admin ficam intactos.
// Aditiva e idempotente. Roda aqui porque depende de company_billing*.
{
  const normaliza = db.prepare(`
    UPDATE companies SET tipoEmpresa = 'padrao', assinatura = 'free'
    WHERE (tipoEmpresa = 'premium' OR (assinatura IS NOT NULL AND assinatura NOT IN ('free','')))
      AND id NOT IN (SELECT companyId FROM subscriptions WHERE status != 'cancelada')
      AND id NOT IN (SELECT DISTINCT companyId FROM company_billing_history WHERE campo IN ('tipoEmpresa','plano'))
      AND id NOT IN (SELECT companyId FROM company_billing WHERE billing_status = 'isenta')
  `).run();
  if (normaliza.changes > 0) console.log(`[migracao] ${normaliza.changes} empresa(s) sem pagamento/isenção voltaram ao plano gratuito`);
}

// Templates de e-mail predefinidos
db.exec(`
  CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    assunto TEXT NOT NULL,
    preheader TEXT DEFAULT '',
    conteudo TEXT NOT NULL,
    cta TEXT DEFAULT '',
    tipo TEXT NOT NULL DEFAULT 'custom',
    criadoEm INTEGER NOT NULL
  );
`);

// Semear templates padrão se não existirem
const templateCount = db.prepare("SELECT COUNT(*) as n FROM email_templates").get();
if (templateCount.n === 0) {
  const tpls = [
    { id: "tpl_boasvindas", nome: "Boas-vindas", tipo: "boasvindas", assunto: "Bem-vindo à Hicks Pro, {{first_name}}!", preheader: "Sua conta está pronta.", conteudo: "Olá, {{first_name}}!\n\nSua empresa {{company_name}} está agora ativa na Hicks Pro.\n\nAqui você vai organizar operações comerciais, acompanhar campanhas e capacitar sua equipe de vendas.\n\nBoa jornada!", cta: "Acessar plataforma" },
    { id: "tpl_academy", nome: "Academy incompleto", tipo: "academy", assunto: "Seu Academy ainda pode ficar mais completo, {{first_name}}", preheader: "Seu Cérebro está {{brain_score}}% completo.", conteudo: "Olá, {{first_name}}!\n\nPercebemos que o Academy da {{company_name}} ainda tem itens pendentes.\n\nUm Academy completo ajuda os profissionais a entenderem melhor sua operação e aumenta a qualidade dos resultados.\n\nLeva poucos minutos — vale completar agora.", cta: "Completar Academy" },
    { id: "tpl_campanha_pronta", nome: "Campanha pronta", tipo: "campanha", assunto: "Sua campanha está pronta para começar, {{first_name}}", preheader: "Tudo configurado e pronto para o primeiro resultado.", conteudo: "Olá, {{first_name}}!\n\nA campanha da {{company_name}} está configurada e aguardando sua aprovação para ir ao ar.\n\nProfissionais qualificados já estão disponíveis para atuar.", cta: "Abrir campanha" },
    { id: "tpl_campanha_inativa", nome: "Campanha sem atividade", tipo: "campanha", assunto: "Há uma campanha esperando por você, {{first_name}}", preheader: "Retome agora e acelere seus resultados.", conteudo: "Olá, {{first_name}}!\n\nA campanha da {{company_name}} está sem movimentação há alguns dias.\n\nRetome agora e aproveite os profissionais disponíveis.", cta: "Retomar campanha" },
    { id: "tpl_recuperar_acesso", nome: "Recuperação de acesso", tipo: "recuperacao", assunto: "Recupere seu acesso à Hicks Pro", preheader: "Seu acesso está disponível.", conteudo: "Olá!\n\nIdentificamos uma solicitação de recuperação de acesso à sua conta na Hicks Pro.\n\nClique no botão abaixo para recuperar o acesso.", cta: "Recuperar acesso" },
    { id: "tpl_reativar", nome: "Reativação de conta", tipo: "reativacao", assunto: "Sentimos sua falta na Hicks Pro, {{first_name}}", preheader: "Seu ambiente continua aqui, preservado.", conteudo: "Olá, {{first_name}}!\n\nSua empresa {{company_name}} e toda a sua operação continuam preservadas na Hicks Pro: campanhas, Academy, Cérebro e histórico.\n\nVolte quando quiser — tudo está esperando por você.", cta: "Voltar para minha conta" },
    { id: "tpl_pgto_pendente", nome: "Pagamento pendente", tipo: "financeiro", assunto: "Pagamento pendente na sua conta, {{first_name}}", preheader: "Regularize e mantenha seu acesso.", conteudo: "Olá, {{first_name}}!\n\nHá um pagamento pendente na conta da {{company_name}} na Hicks Pro.\n\nRegularize para manter seu acesso sem interrupção.", cta: "Ver pagamento" },
    { id: "tpl_pgto_confirmado", nome: "Pagamento confirmado", tipo: "financeiro", assunto: "Pagamento recebido — obrigado, {{first_name}}!", preheader: "Tudo certo com sua conta.", conteudo: "Olá, {{first_name}}!\n\nConfirmamos o recebimento do pagamento da {{company_name}}.\n\nSua conta está ativa e com todos os recursos disponíveis.", cta: "" },
    { id: "tpl_conta_liberada", nome: "Conta liberada", tipo: "acesso", assunto: "Seu acesso foi liberado, {{first_name}}!", preheader: "Bem-vindo de volta.", conteudo: "Olá, {{first_name}}!\n\nO acesso da {{company_name}} à Hicks Pro foi liberado.\n\nTudo está preservado e pronto para continuar.", cta: "Acessar plataforma" },
    { id: "tpl_convite", nome: "Convite para empresa", tipo: "convite", assunto: "Você foi convidado para {{company_name}} na Hicks Pro", preheader: "Acesse agora e comece.", conteudo: "Olá!\n\nVocê foi convidado para acessar a empresa {{company_name}} na plataforma Hicks Pro.\n\nClique abaixo para aceitar o convite.", cta: "Aceitar convite" },
  ];
  const ins = db.prepare("INSERT INTO email_templates (id,nome,assunto,preheader,conteudo,cta,tipo,criadoEm) VALUES (?,?,?,?,?,?,?,?)");
  const now = Date.now();
  for (const t of tpls) ins.run(t.id, t.nome, t.assunto, t.preheader, t.conteudo, t.cta, t.tipo, now);
}

// Templates TRANSACIONAIS editáveis no admin: os comprovantes de pagamento.
// Semeados com INSERT OR IGNORE (idempotente) para existirem mesmo depois da
// tabela já ter sido criada. Variáveis disponíveis: {{nome}}, {{valor}}, {{plano}}.
{
  const txTemplates = [
    { id: "tx_comprovante_campanha", nome: "Comprovante — Depósito de campanha", tipo: "transacional", assunto: "Pagamento confirmado — seu caixa está pronto! 🚀", preheader: "Seu saldo já está disponível.", conteudo: "Olá, {{nome}}!\n\nRecebemos seu depósito de {{valor}} e ele já está no caixa das suas campanhas. Agora é com você: ative campanhas, libere pagamentos aos profissionais e acelere seus resultados. Bora vender! 💪", cta: "Ir para Campanhas" },
    { id: "tx_comprovante_plano", nome: "Comprovante — Plano ativado", tipo: "transacional", assunto: "Plano ativado com sucesso! 🎉", preheader: "Seu plano já está ativo.", conteudo: "Olá, {{nome}}!\n\nSeu plano {{plano}} está ativo! O pagamento de {{valor}} foi confirmado e você já tem acesso a todos os recursos. Conte com a RYCS para escalar sua operação comercial.", cta: "Ver meu plano" },
    { id: "tx_comprovante_visibilidade", nome: "Comprovante — Destaque / Visibilidade", tipo: "transacional", assunto: "Destaque ativado — sua empresa em evidência! ✨", preheader: "Sua empresa agora aparece em destaque.", conteudo: "Olá, {{nome}}!\n\nRecebemos o pagamento de {{valor}} do seu destaque na vitrine. Sua empresa agora aparece com prioridade para os melhores profissionais. Aproveite a visibilidade extra!", cta: "Ver visibilidade" },
  ];
  const insTx = db.prepare("INSERT OR IGNORE INTO email_templates (id,nome,assunto,preheader,conteudo,cta,tipo,criadoEm) VALUES (?,?,?,?,?,?,?,?)");
  const tnow = Date.now();
  for (const t of txTemplates) insTx.run(t.id, t.nome, t.assunto, t.preheader, t.conteudo, t.cta, t.tipo, tnow);
}

// Onboarding da empresa (docs/onboarding/SPEC.md). Progresso salvo no
// servidor, uma linha por empresa; convites gerados no admin, presos a um
// e-mail, com o token guardado só como hash.
db.exec(`
  CREATE TABLE IF NOT EXISTS onboarding (
    companyId TEXT PRIMARY KEY,
    etapas TEXT NOT NULL DEFAULT '{}',
    origem TEXT NOT NULL DEFAULT 'site',   -- site | convite | existente
    conviteId TEXT,
    trialDias INTEGER NOT NULL DEFAULT 0,  -- trial que a etapa 5 vai oferecer
    concluidoEm INTEGER,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS onboarding_convites (
    id TEXT PRIMARY KEY,
    tokenHash TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    trialDias INTEGER NOT NULL DEFAULT 0,  -- 0 = convite sem trial
    criadoPor TEXT,
    criadoEm INTEGER NOT NULL,
    expiraEm INTEGER NOT NULL,
    usadoEm INTEGER,
    usadoPor TEXT,                         -- companyId
    revogadoEm INTEGER,
    observacao TEXT DEFAULT ''
  );
`);
adicionarColuna("companies", "whatsapp", "TEXT DEFAULT ''");
adicionarColuna("companies", "nicho", "TEXT DEFAULT ''");
adicionarColuna("companies", "regrasMarca", "TEXT DEFAULT ''");
adicionarColuna("companies", "permissoesMarca", "TEXT DEFAULT '{}'");
adicionarColuna("companies", "servicos", "TEXT DEFAULT '[]'");

// Etapa 3: materiais da Marketing Academy. O arquivo fica no storage; aqui só
// a chave, os metadados e o texto extraído para a IA.
db.exec(`
  CREATE TABLE IF NOT EXISTS academy_materiais (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    categoria TEXT NOT NULL,             -- apresentacao | material | foto | video | audio | link
    nome TEXT NOT NULL,
    chave TEXT,                          -- chave no storage (vazio para link)
    url TEXT,                            -- só para link
    mimetype TEXT DEFAULT '',
    tamanho INTEGER DEFAULT 0,
    statusIndexacao TEXT NOT NULL DEFAULT 'pendente',  -- pendente | indexado | sem_texto | erro
    textoExtraido TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_academy_materiais_empresa ON academy_materiais(companyId);

  -- Etapa 4: cada geração da IA é uma versão. Pedir ajustes cria outra; as
  -- anteriores ficam guardadas.
  CREATE TABLE IF NOT EXISTS ia_geracoes (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    versao INTEGER NOT NULL,
    status TEXT NOT NULL,                -- pendente | processando | falhou | pronta | aprovada | substituida
    fases TEXT NOT NULL DEFAULT '{}',
    contexto TEXT DEFAULT '',
    conteudo TEXT NOT NULL DEFAULT '{}',
    aprovacoes TEXT NOT NULL DEFAULT '{}',
    pedidoAjuste TEXT DEFAULT '',
    erro TEXT DEFAULT '',
    tentativas INTEGER NOT NULL DEFAULT 0,
    aprovadoEm INTEGER,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ia_geracoes_empresa ON ia_geracoes(companyId, versao);
`);
adicionarColuna("companies", "suporteNome", "TEXT DEFAULT ''");
adicionarColuna("companies", "suporteWhatsapp", "TEXT DEFAULT ''");
adicionarColuna("companies", "suporteEmail", "TEXT DEFAULT ''");
adicionarColuna("onboarding", "campanhaId", "TEXT");
// Leitura dos materiais da etapa 3 pela IA: versão do leitor que já leu o
// arquivo (sobe quando o leitor aprende um formato novo) e como foi lido.
adicionarColuna("academy_materiais", "leituraVersao", "INTEGER DEFAULT 0");
adicionarColuna("academy_materiais", "leitura", "TEXT DEFAULT ''");
// Estratégias aprovadas no onboarding, aplicadas à campanha (somente leitura).
adicionarColuna("campaigns", "estrategias", "TEXT DEFAULT ''");
adicionarColuna("users", "resetEnviadoEm", "INTEGER");

// Dois caminhos de entrada para empresas (Atualização 2):
//   "guiado"  — fluxo de 6 etapas (padrão anterior); bloqueia a plataforma.
//   "livre"   — "Criar conta": etapa 1 auto-concluída, plataforma livre, banner.
adicionarColuna("onboarding", "caminho", "TEXT NOT NULL DEFAULT 'guiado'");
// Confirmação de e-mail para o caminho "livre" (enviada pelo Resend).
adicionarColuna("users", "emailVerificado", "INTEGER NOT NULL DEFAULT 0");
adicionarColuna("users", "emailConfirmToken", "TEXT");
adicionarColuna("users", "emailConfirmExpira", "INTEGER");

// Funil de analytics: registra eventos-chave do onboarding para medir conversão.
db.exec(`
  CREATE TABLE IF NOT EXISTS onboarding_eventos (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    evento TEXT NOT NULL,
    dados TEXT NOT NULL DEFAULT '{}',
    criadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_onb_eventos_empresa ON onboarding_eventos(companyId, criadoEm);
  CREATE INDEX IF NOT EXISTS idx_onb_eventos_tipo ON onboarding_eventos(evento, criadoEm);
`);

// Jornada desde o primeiro clique: visitante anônimo (id no navegador) com a
// origem de primeiro toque (UTM/fbclid), e os passos do cadastro antes de a
// conta existir. Ao criar a conta, o visitante fica ligado ao usuário.
db.exec(`
  CREATE TABLE IF NOT EXISTS jornada_visitantes (
    visitanteId TEXT PRIMARY KEY,
    origem TEXT NOT NULL DEFAULT '{}',
    papel TEXT NOT NULL DEFAULT '',
    primeiroEm INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS jornada_eventos (
    id TEXT PRIMARY KEY,
    visitanteId TEXT NOT NULL,
    evento TEXT NOT NULL,
    papel TEXT NOT NULL DEFAULT '',
    etapa TEXT NOT NULL DEFAULT '',
    criadoEm INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_jornada_evento_unico ON jornada_eventos(visitanteId, evento, papel, etapa);
  CREATE INDEX IF NOT EXISTS idx_jornada_evento_data ON jornada_eventos(criadoEm);
`);
adicionarColuna("users", "origem", "TEXT DEFAULT '{}'");
adicionarColuna("users", "visitanteId", "TEXT DEFAULT ''");
db.exec("CREATE INDEX IF NOT EXISTS idx_users_visitante ON users(visitanteId)");
// WhatsApp do profissional confirmado por código (services/whatsappVerificacao.js).
adicionarColuna("sellers", "whatsVerificadoNumero", "TEXT DEFAULT ''");
adicionarColuna("sellers", "whatsVerificadoEm", "INTEGER");

// Conta fixa da plataforma. O e-mail fica no código; a senha nunca — este
// repositório é público, e o admin aprova saques e vê todas as empresas.
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@rycs.pro").toLowerCase().trim();

function seedAdmin() {
  const definida = process.env.ADMIN_PASSWORD;
  const atual = db.prepare("SELECT id, senha FROM users WHERE role = 'admin'").get();

  if (atual) {
    // ADMIN_PASSWORD é a fonte da verdade: trocá-la no painel e reimplantar é
    // o caminho de recuperação do admin. Sem isto, esquecer a senha tranca a
    // plataforma para fora — o reset por e-mail depende do Resend configurado.
    if (definida && !bcrypt.compareSync(definida, atual.senha)) {
      db.prepare("UPDATE users SET email = ?, senha = ? WHERE id = ?").run(
        ADMIN_EMAIL, bcrypt.hashSync(definida, 10), atual.id
      );
      console.log("[seed] Senha do admin sincronizada com ADMIN_PASSWORD.");
    }
    return;
  }

  // Sem ADMIN_PASSWORD, gera uma senha forte e mostra no log uma única vez:
  // é preferível a subir sem nenhum admin e ficar trancado para fora.
  const senha = definida || randomBytes(12).toString("base64url");

  db.prepare("INSERT INTO users (id, email, senha, role, entityId, aceitouTermos, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    uid(), ADMIN_EMAIL, bcrypt.hashSync(senha, 10), "admin", null, 1, agora()
  );

  if (definida) {
    console.log(`[seed] Admin da plataforma: ${ADMIN_EMAIL}`);
  } else {
    console.log(`[seed] Admin da plataforma: ${ADMIN_EMAIL}`);
    console.log(`[seed] Senha gerada (anote agora): ${senha}`);
    console.log("[seed] Defina ADMIN_PASSWORD no Railway para fixar a senha.");
  }
}
seedAdmin();

// INNER Energia — empresa parceira com ciclo especial de pagamento.
// Fechamento dia 30 · Repasse dia 15 do mês seguinte.
(function seedInnerEnergia() {
  const existente = db.prepare("SELECT id FROM companies WHERE nome = 'INNER Energia'").get();
  if (existente) return;

  const companyId = uid();
  const userId = uid();

  db.prepare(`
    INSERT INTO companies (id, nome, produto, ticket, icp, plano, destaque, saldo, vagas, cor,
      totalAportado, criadoEm, comissoes, curso, aportes, statusCadastro, assinatura,
      segmento, diaFechamento, diaPagamento, modalidadePagamento, limiteCredito)
    VALUES (?, ?, ?, ?, ?, 'saldo', 0, 0, 20, '#F97316',
      0, ?, '{}', '[]', '[]', 'aprovada', 'pro',
      'Energia', 30, 15, 'pos', 50000)
  `).run(
    companyId,
    "INNER Energia",
    "Comercialização de energia elétrica e soluções em eficiência energética",
    "Variável conforme contrato",
    "Empresas com alto consumo energético e gestores de facilities",
    agora()
  );

  // Conta empresa vinculada
  const emailEmpresa = "empresa@innerenergia.com.br";
  const senhaTemp = "Inner@2025";
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, aceitouTermos, criadoEm) VALUES (?, ?, ?, 'empresa', ?, 1, ?)")
    .run(userId, emailEmpresa, bcrypt.hashSync(senhaTemp, 10), companyId, agora());

  console.log(`[seed] INNER Energia criada — companyId: ${companyId}`);
  console.log(`[seed] Login empresa INNER: ${emailEmpresa} | senha: ${senhaTemp}`);
  console.log("[seed] Modalidade: pós-pago | Ciclo: fechamento dia 30 · repasse dia 15 do mês seguinte");
})();

// Onboarding do profissional: etapa atual e perfil DISC.
adicionarColuna("sellers", "onboardingEtapa", "TEXT DEFAULT 'perfil'");
adicionarColuna("sellers", "linkedin", "TEXT DEFAULT ''");
adicionarColuna("sellers", "disc", "TEXT DEFAULT '{}'");
adicionarColuna("sellers", "discRespostas", "TEXT DEFAULT '{}'");
adicionarColuna("sellers", "xpRespostas", "TEXT DEFAULT '{}'");

// Features: pipeline, geolocalização, comissionamento, campos personalizados, Rico
adicionarColuna("campaigns", "cidade", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "estado", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "estado", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "lat", "REAL");
adicionarColuna("campaigns", "lng", "REAL");
adicionarColuna("campaigns", "percentualComissao", "REAL DEFAULT 0");
adicionarColuna("campaigns", "etapasPipeline", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "fluxoDirecionamento", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "modoJarvas", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "camposPersonalizados", "TEXT DEFAULT '{}'");
adicionarColuna("campaigns", "modelosCampos", "TEXT DEFAULT '[]'");
// Candidaturas abertas (1) ou encerradas (0). Não há limite de profissionais —
// a empresa apenas liga/desliga a entrada de novas candidaturas na campanha.
adicionarColuna("campaigns", "candidaturasAbertas", "INTEGER DEFAULT 1");

// Alcance geográfico da campanha (marketplace Oportunidades): a empresa declara
// se a campanha é nacional, internacional ou ambas, e escolhe os países aceitos
// (ISO-2). 'nacional' = só o país da empresa; 'internacional'/'ambas' usam a
// lista paisesAceitos. Classifica a campanha nas abas Nacional/Internacional.
adicionarColuna("campaigns", "alcance", "TEXT DEFAULT 'nacional'");
adicionarColuna("campaigns", "paisesAceitos", "TEXT DEFAULT '[]'");
// Backfill: campanhas existentes viram 'nacional' e aceitam o país da empresa.
(() => {
  const sem = db.prepare("SELECT c.id, co.pais AS pais FROM campaigns c JOIN companies co ON co.id = c.companyId WHERE c.paisesAceitos IS NULL OR c.paisesAceitos = '' OR c.paisesAceitos = '[]'").all();
  if (!sem.length) return;
  const upd = db.prepare("UPDATE campaigns SET alcance = CASE WHEN alcance IS NULL OR alcance = '' THEN 'nacional' ELSE alcance END, paisesAceitos = ? WHERE id = ?");
  db.transaction(() => sem.forEach((r) => upd.run(JSON.stringify([r.pais || "BR"]), r.id)))();
  console.log(`[migração] alcance/paisesAceitos preenchido em ${sem.length} campanha(s)`);
})();
adicionarColuna("sellers", "cidadeBase", "TEXT DEFAULT ''");
adicionarColuna("sellers", "estadoBase", "TEXT DEFAULT ''");
adicionarColuna("sellers", "raioKm", "REAL DEFAULT 50");
adicionarColuna("sellers", "latBase", "REAL");
adicionarColuna("sellers", "lngBase", "REAL");
adicionarColuna("leads", "valorVenda", "REAL DEFAULT 0");
adicionarColuna("leads", "comissaoCalculada", "REAL DEFAULT 0");
adicionarColuna("leads", "responsavelEtapaId", "TEXT DEFAULT ''");
adicionarColuna("leads", "segmento", "TEXT DEFAULT ''");
adicionarColuna("sellers", "dataNascimento", "TEXT DEFAULT ''");
adicionarColuna("sellers", "sobrenome", "TEXT DEFAULT ''");
adicionarColuna("sellers", "pais", "TEXT DEFAULT 'Brasil'");
adicionarColuna("sellers", "genero", "TEXT DEFAULT ''");
adicionarColuna("messages", "lida", "INTEGER DEFAULT 0");
adicionarColuna("messages", "anexo", "TEXT DEFAULT ''");
adicionarColuna("sellers", "apresentacaoData", "TEXT DEFAULT '{}'");
adicionarColuna("sellers", "videoApresentacao", "TEXT DEFAULT ''");

// Backfill: campanhas existentes sem pipeline recebem as etapas padrão
(() => {
  const PIPELINE_PADRAO = JSON.stringify([
    { id: "novo",      nome: "Primeiro contato", cor: "#8496B4" },
    { id: "contatado", nome: "Contatado", cor: "#5B8CFF" },
    { id: "respondeu", nome: "Respondeu", cor: "#9AA6FF" },
    { id: "reuniao",   nome: "Reunião",   cor: "#9AA6FF" },
    { id: "proposta",  nome: "Proposta",  cor: "#F0B45E" },
    { id: "fechado",   nome: "Fechado",   cor: "#5FD3A0" },
    { id: "perdido",   nome: "Perdido",   cor: "#FF8A7A" },
  ]);
  const sem = db.prepare("SELECT id FROM campaigns WHERE etapasPipeline IS NULL OR etapasPipeline = '[]' OR etapasPipeline = ''").all();
  if (!sem.length) return;
  const upd = db.prepare("UPDATE campaigns SET etapasPipeline = ? WHERE id = ?");
  db.transaction(() => sem.forEach((r) => upd.run(PIPELINE_PADRAO, r.id)))();
  console.log(`[migração] pipeline padrão adicionado a ${sem.length} campanha(s)`);
})();

// Migração: recalcular scoreTriagem dos profissionais que completaram o
// onboarding DISC mas ficaram com score 0 ou null.
(() => {
  const pendentes = db.prepare(
    "SELECT id, xpRespostas, disc FROM sellers WHERE onboardingEtapa = 'concluido' AND (scoreTriagem IS NULL OR scoreTriagem = 0)"
  ).all();
  if (!pendentes.length) return;

  // Import dinâmico evitado: reimplementa a fórmula inline (idêntica à de onboardingProfissional.js).
  function calcScore(xp, disc) {
    let s = 0;
    s += Math.min(Number(xp?.xp1) || 0, 4) * 7.5;
    const canais = Array.isArray(xp?.xp2) ? xp.xp2.filter((c) => c !== "Ainda não tenho canal definido") : [];
    s += Math.min(canais.length, 6) * 3;
    s += ({ ambos: 12, b2b: 10, b2c: 8, nenhuma: 2 })[xp?.xp3] || 2;
    s += ({ integral: 20, meio: 15, parcial: 10, pontual: 5 })[xp?.xp4] || 5;
    if (disc?.predominante) s += 10;
    if (disc?.secundario && disc.secundario !== disc.predominante) s += 5;
    s += 5;
    return Math.min(Math.floor(s * 100) / 100, 100);
  }

  const upd = db.prepare("UPDATE sellers SET scoreTriagem = ? WHERE id = ?");
  let n = 0;
  for (const row of pendentes) {
    const xp = JSON.parse(row.xpRespostas || "{}");
    const disc = JSON.parse(row.disc || "{}");
    const score = calcScore(xp, disc);
    if (score > 0) { upd.run(score, row.id); n++; }
  }
  if (n) console.log(`[migração] scoreTriagem recalculado para ${n} profissional(is)`);
})();

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_seller ON messages(sellerId, companyId);
  CREATE INDEX IF NOT EXISTS idx_submissions_seller ON submissions(sellerId, criadoEm DESC);
  CREATE INDEX IF NOT EXISTS idx_submissions_company ON submissions(companyId, criadoEm DESC);
  CREATE INDEX IF NOT EXISTS idx_withdrawals_seller ON withdrawals(sellerId, criadoEm DESC);
  CREATE INDEX IF NOT EXISTS idx_leads_seller ON leads(sellerId, atualizadoEm DESC);
  CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(companyId, atualizadoEm DESC);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId, criadoEm DESC);
  CREATE INDEX IF NOT EXISTS idx_score_dimensions_seller ON score_dimensions(sellerId);
  CREATE INDEX IF NOT EXISTS idx_applications_seller ON applications(sellerId);
  CREATE INDEX IF NOT EXISTS idx_campaign_apps_seller ON campaign_applications(sellerId);
  CREATE INDEX IF NOT EXISTS idx_course_certs_seller ON course_certificates(sellerId);
`);

// Backfill: inferir gênero dos profissionais pelo primeiro nome (nomes BR)
(() => {
  const sem = db.prepare("SELECT id, nome FROM sellers WHERE genero IS NULL OR genero = ''").all();
  if (!sem.length) return;

  const FEM = new Set(["ana","maria","julia","juliana","fernanda","camila","beatriz","larissa","leticia","mariana","patricia","luciana","gabriela","amanda","bruna","viviane","vivian","natalia","natasha","isabela","isabelle","jessica","jéssica","caroline","carolina","adriana","alessandra","aline","alice","alicia","andreia","angela","bianca","carla","claudia","cristina","danielle","daniela","debora","denise","elaine","elisa","elisabete","elizabete","elizandra","emanuela","emanuele","erica","érica","fabiana","fatima","fátima","flavia","flávia","franciele","francine","francesca","gisele","gisela","giovana","giovanna","heloisa","heloísa","ingrid","irene","isis","ivana","jana","janaina","jaqueline","joana","joseane","josiane","joyce","karen","katia","kátia","karina","kelly","layla","leila","liliane","lilian","lisa","lorena","luana","luiza","luíza","lucia","lúcia","luciane","luciele","madalena","magda","maira","maíra","marcela","marcia","márcia","marilene","marina","marisol","marta","mayara","mayra","michelle","milena","miriam","mônica","monica","nadia","nádia","nicoli","nicole","norma","paloma","paula","paulinha","priscila","rafaela","raquel","rebeca","rebecca","regiane","renata","roberta","rosa","rosana","rosangela","rosane","sabrina","samara","samantha","sandra","simone","sonia","sônia","stephanie","sueli","suzane","suzana","tamara","tamires","tatiane","tatiana","thaisa","thais","thaís","thalia","valentina","vanessa","veronica","verónica","victoria","vitoria","vitória","yasmin","yara","zelia","cecilia","cintia","cíntia","clarice","cleonice","conceicao","conceição","cynthia","daiane","dayana","edilaine","edna","eduarda","eliana","eliziane","ellen","evelyn","fabielle","gleice","gleicy","grace","graciela","hildete","iracema","iris","íris","ivanete","ivete","jacqueline","jamile","jamili","janayna","jandira","jenifer","jennifer","joelma","josefa","judith","keila","lais","laís","lara","lenise","liane","lidiane","lindalva","liz","loraine","lorraine","luana","luane","lucelia","lucelaine","lucimara","lucineia","lunara","lydia","lygia","mabel","manuela","marcelina","margareth","margarida","mariangela","marilei","marilucia","mariluce","marinalva","marinete","marinilda","maristela","marli","marlise","marly","meireles","mercia","micheli","micaela","mikaela","mikaella","mirele","naiara","naiane","naomi","nathalia","nathalie","nayara","nayra","neuza","nivia","nívea","odete","odila","olga","olivia","paola","perla","pérola","poliane","poliana","queila","queli","rafaelle","raimunda","ramona","rita","renata","roseli","roseliane","roselia","rosilaine","rosilei","rosileide","rosimar","rosimeire","rosineide","rosinete","rosinei","rosinha","selma","silmara","silvia","silvana","siane","sidneia","solange","sonara","soraia","suelen","sueli","suiane","suzy","tamyres","telma","tereza","terezinha","thaysa","thereza","valeria","valéria","valesca","valquiria","vanda","vera","verenice","zenaide","celia","célia","clélia","clelia","dircilene","elenice","elenita","eleonora","elizângela","elizangela","eunice","girlene","gislaine","gislene","glamour","grecia","iraci","irmã","isolde","ivanilde","ivonete","izabel","jailma","jailse","jair","jairany","jalisse","jamara","jamine","janete","jandira","jania","janice","janiely","janiele","jaqueline","josefina","joselene","joseliane","josenilda","josenilde","josiane","josiany","josieli","josielle","josimara","josinalda","josinete","josinei","josiney","josineide","joyciane","jucinara","jucineia","leidiane","leila","leilane","leidilane","leidilei","lene","leninha","leonice","leonilda","leonor","leontina","liamara","liara","liane","lidiane","lidiana","liduina","ligiane","ligiana","lindalva","lindamara","lindinalva","lindinei","lindivane","lindomar","lucélia","lucelia","lucelina","luciene","luciete","lucilene","lucimara","lucimeire","lucineia","lucineide","lucineide","lucinete","lucinei","lucineia","lucinha","ludivar","lurdes","maeli","maelise","maely","maeva","maiane","maiara","maiele","maise","malvina","marcelaine","marcelina","marcely","marcia","maristela"]);

  const MASC = new Set(["joao","joão","jose","josé","carlos","pedro","luis","luís","luiz","paulo","marcos","marcelo","rafael","rodrigo","fernando","diego","thiago","tiago","anderson","andre","antonio","antônio","alexandre","alex","alan","adilson","adriano","afonso","agnaldo","agostinho","airton","alberto","alcides","aldair","alfredo","alisson","allan","almir","alton","augusto","aurelio","aurélio","artur","arthur","breno","bruno","caio","caleb","calebe","camilo","candido","cândido","caue","cauê","celso","cesar","césar","christian","christiano","ciro","cleber","clebson","cleison","cleiton","cleivam","clovis","clóvis","conrado","cristiano","daniel","dario","dário","davi","david","denilson","dennis","dilmar","dirceu","dorival","edimar","edinaldo","edino","edivaldo","edmar","edney","edson","eduardo","edvaldo","efraim","elias","elio","eliseu","elson","elton","elvis","emanuel","emerson","ernandes","ernani","ernesto","estevam","evaldo","evandro","everton","ezequiel","fabiano","fabio","fábio","fabricio","fabrício","felipe","felicio","felix","félix","filipe","flavio","francisco","franco","frederico","gabriel","geraldo","gerson","gilberto","gilmar","gilson","giovani","guilherme","gustavo","hamilton","heitor","helton","henrique","hercules","hércules","humberto","igor","iran","irineu","ivan","ivanildo","ivo","jackson","jadiel","jairo","jamil","jarbas","jardel","jean","jefferson","jerônimo","jonas","jonatan","jonathan","jorge","josue","josué","jovani","junior","júnior","juraci","kalel","kaue","kauê","kayke","kayky","kevin","kleber","kledson","leandro","leon","leonan","leonel","leonidas","lucio","lúcio","luciano","lucas","luis","luiz","manoel","manuel","marcio","márcio","marco","mario","mário","mateus","matheus","mathias","mauricio","mauro","maxwell","maycon","menocchio","merlan","michel","miguel","milson","moises","moisés","moroni","murilo","natan","natanael","nathanael","neil","nelson","nicolas","nicolás","nildo","nilson","nilton","nivan","nivaldo","noel","nonato","normando","odair","odilon","olavo","omar","orlando","oscar","osvaldo","pablo","paulo","pedro","plácido","raimundo","ramiro","raul","reginaldo","reinaldo","renan","renato","rener","renildo","ricard","ricardo","richardson","roberto","rodolfo","rodrigo","rogerio","rogério","ronaldo","roney","roni","rubens","rui","samuel","sandoval","sandro","santiago","saul","saulo","sebastiao","sebastião","sergio","sérgio","sidnei","sidney","silvio","silvano","simao","simão","talles","thiago","tiago","tobias","tony","tulio","túlio","ulisses","valentim","valerio","valério","valmir","valter","vanderlei","vasco","victor","vidal","vinicius","vinícius","vitor","wandei","wanderlei","washington","welber","wellington","wellison","wendell","wender","wescley","wesley","weverton","wilder","william","willian","willson","wilson","xisto","yago","yuri","zacarias","abner","abimael","abraao","abraão","acacio","acácio","adailton","adalberto","adauto","adelar","adelino","adenir","adhemar","adilson","adimar","adinael","adinho","adino","adlei","admar","admilton","adnilson","adolfo","adorindo","adriel","adrien","adsoniel","agamenon","agapito","agnaldo","aibson","ailon","aimar","ainand","airto","aiton","aiuri","aiuton","alair","alairo","alarico","albertino","albino","alceu","alcides","alcione","alcy","aldecir","aldemar","aldemiro","aldenor","aldenei","aldenildo","aldino","aldir","aldisio","aldivo","aldo","aldrin","alecsandro","alejandro","alercio","alericio","alerson","alcemar","altamir","altairo","altamiro","alternir","altevir","altino","alton","altovir","alvanir","alvemar","alves","alvino","amancio","amandio","amaro","amaro","ambrosio","amilcar","amilton","aminson","amir","amos","anastacio","anatolio","anddrey","anelio","anesio","aneval","anfrisio","anicio","anisal","anisio","anizio","anselmo","antenor","apolo","aquiles","argemiro","aristides","armando","armelindo","armin","arnaldo","arnoldo","arquimedes","asterio","ataide","avner","axel","ayrton","azael","baldur","benigno","benjamin","bento","bernardo","blaine","boaz","boanerges","braian","brian","bráulio","cairo","callistro","candido","caue","cayke","cayo","celcino","celino","celmo","celso","cezar","charlles","charles","charlie","chico","christoph","ciro","claiton","claudio","clementino","cleso","cleumar","clebson","clézio","clifton","clodison","clodoaldo","custodio","damiao","damião","delcio","delmar","denie","denio","derivaldo","derley","derlisson","deusmar","deuzenir","divaldo","divanildo","diomar","djair","donizete","ebenezar","edevaldo","edgard","edipo","edislane","edivar","edley","edmar","edmo","edoardo","edraldo","edvanildo","edwards","egídio","elber","elbio","eleazar","elenildo","eliomar","elionai","elir","elito","elival","eliziel","eloir","elves","emanoel","emilio","émilio","emir","emiro","eneas","êneas","enio","enoque","erivelto","ermindo","etevaldo","ethan","evandro","fontes","gecimar","geovane","geovani","geovany","gerlan","glauco","gleison","gleidson","gleisson","godofredo","hermes","hernane","hilario","hilio","hiram","inocencio","irineu","ivanilson","ivonei","jabez","jadison","jairinho","jairinton","jalmir","janio","jânio","jansen","jarlon","javan","javier","janderson","jandiel","jandir","jeferson","jéferson","jhon","jonatas","jorlan","jorgemar","josenildo","josimar","jurandi","jurandir","kalel","keven","kledge","kleidson","kleisson","lael","laercio","lailson","lambert","larcenio","leiro","leomir","leones","leôncio","levy","lindir","lindomar","lionel","lisandro","lodovico","lomar","lorival","ludimar","ludovico","ludivar","luimar","luizão","luizinho","lurdes","macio","magno","marcolino","marimôn","maritimo","marivaldo","mazinho","maxwell","maykcon","maykson","merlan","merlison","merlan","miron","mitson","nadilson","natan","natanael","nathanael","nattan","neidson","nelcimar","nemezio","nemésio","nenem","nereu","nerivaldo","nicias","nildo","nildomar","nivanor","odair","odilon","olavo","olegario","olimpio","olivaldo","omar","orlan","orlandino","orlio","ormar","ortencio","ovidio","plácido","platon","poldo","porfirio","porfírio","primo","rael","ranieri","rener","renildo","renzo","reri","ribamar","rivelino","ritson","rogerio","rolando","romain","ronan","roney","roni","ronil","ronivaldo","ronivam","rooger","rosaldo","rosendo","rosivaldo","ruben","rúben","rudomar","rui","salatiel","salomao","salomão","sandro","santino","sidnei","silverio","silvério","silverino","simao","sirlei","sixto","soares","stenio","stênio","stéfano","tallys","tertius","thadeu","timoteo","timóteo","tommaso","toninho","tonnie","tucker","tudor","ubismar","ulisson","ulmar","uriel","vaguiner","valdecir","valdei","valdemar","valdenir","valdenor","valderon","valdir","valdomiro","valentim","vaner","vanir","vanlor","vannier","varley","venceslau","wando","wandson","welker","weller","wilder","wildson","wiliam","willon","witor","witton","xisto","zelmar","zenobio","zélio"]);

  function inferir(nome) {
    if (!nome) return null;
    const p = nome.trim().split(/\s+/)[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
    if (FEM.has(p)) return "feminino";
    if (MASC.has(p)) return "masculino";
    return null;
  }

  const upd = db.prepare("UPDATE sellers SET genero = ? WHERE id = ?");
  let n = 0;
  db.transaction(() => {
    for (const s of sem) {
      const g = inferir(s.nome);
      if (g) { upd.run(g, s.id); n++; }
    }
  })();
  if (n) console.log(`[migração] gênero inferido para ${n} de ${sem.length} profissional(is)`);
})();

// Migração: normalizar estado + extrair estado da cidade para todos os profissionais.
(() => {
  const UF = {
    AC:"Acre",AL:"Alagoas",AP:"Amapá",AM:"Amazonas",BA:"Bahia",CE:"Ceará",
    DF:"Distrito Federal",ES:"Espírito Santo",GO:"Goiás",MA:"Maranhão",
    MT:"Mato Grosso",MS:"Mato Grosso do Sul",MG:"Minas Gerais",PA:"Pará",
    PB:"Paraíba",PR:"Paraná",PE:"Pernambuco",PI:"Piauí",RJ:"Rio de Janeiro",
    RN:"Rio Grande do Norte",RS:"Rio Grande do Sul",RO:"Rondônia",RR:"Roraima",
    SC:"Santa Catarina",SP:"São Paulo",SE:"Sergipe",TO:"Tocantins",
  };
  const SIGLAS = new Set(Object.keys(UF));
  const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const POR_NOME = {};
  for (const [sigla, nome] of Object.entries(UF)) {
    POR_NOME[strip(nome)] = nome;
    POR_NOME[sigla.toLowerCase()] = nome;
  }
  const NOMES_VALIDOS = new Set(Object.values(UF));

  // Cidades conhecidas → estado (cobre todos os casos reais do banco)
  const CIDADE_ESTADO = {};
  const map = (cidades, uf) => cidades.forEach((c) => { CIDADE_ESTADO[strip(c)] = UF[uf]; });
  map(["Sorocaba","São Paulo","Sao Paulo","Guarulhos","Campinas","São José dos Campos",
    "Ribeirão Preto","Santos","Osasco","Santo André","São Bernardo do Campo","Mauá",
    "Taboão da Serra","Suzano","Indaiatuba","Limeira","Rio Claro","Itu","Piracicaba",
    "Bauru","Marília","Presidente Prudente","Araçatuba","São Carlos","Ubatuba",
    "Pindamonhangaba","Praia Grande","São Vicente","Cerquilho","Iepê","Jundiaí",
    "Franca","Araraquara","Barueri","Diadema","Carapicuíba","Cotia","Atibaia",
    "Sao Vicente","Taubaté","Mogi das Cruzes","Itapevi"], "SP");
  map(["Curitiba","Londrina","Maringá","Apucarana","Cascavel","Ponta Grossa",
    "Foz do Iguaçu","Guarapuava","Paranaguá","Toledo","Umuarama"], "PR");
  map(["Rio de Janeiro","Niterói","São Gonçalo","Duque de Caxias","Nova Iguaçu",
    "Petrópolis","Volta Redonda","Campos dos Goytacazes","Mendes","Três Rios"], "RJ");
  map(["Belo Horizonte","Uberlândia","Contagem","Juiz de Fora","Betim","Montes Claros",
    "Uberaba","Governador Valadares","Ipatinga","Santa Luzia","Pedralva","São Carlos"], "MG");
  map(["Porto Alegre","Caxias do Sul","Pelotas","Canoas","Santa Maria","Novo Hamburgo",
    "Pantano Grande","Pântano Grande"], "RS");
  map(["Florianópolis","Joinville","Blumenau","Chapecó","Criciúma","Itajaí","Lages"], "SC");
  map(["Goiânia","Aparecida de Goiânia","Anápolis","Rio Verde"], "GO");
  map(["Brasília","Brasilia","Taguatinga","Ceilândia"], "DF");
  map(["Cuiabá","Várzea Grande","Rondonópolis","Sinop"], "MT");
  map(["Campo Grande","Dourados","Três Lagoas"], "MS");
  map(["Salvador","Feira de Santana","Vitória da Conquista","Camaçari","Itabuna",
    "Lauro de Freitas","Pindaí","Pindai"], "BA");
  map(["Recife","Olinda","Jaboatão dos Guararapes","Caruaru","Petrolina"], "PE");
  map(["Fortaleza","Caucaia","Juazeiro do Norte","Sobral","Maracanaú"], "CE");
  map(["Belém","Ananindeua","Marabá","Santarém","Castanhal"], "PA");
  map(["São Luís","São Luis","Imperatriz","Timon","Tutóia","Tutoia"], "MA");
  map(["Manaus","Parintins","Itacoatiara"], "AM");
  map(["Natal","Mossoró","Parnamirim"], "RN");
  map(["João Pessoa","Campina Grande","Santa Rita"], "PB");
  map(["Maceió","Arapiraca"], "AL");
  map(["Aracaju","Nossa Senhora do Socorro"], "SE");
  map(["Teresina","Parnaíba"], "PI");
  map(["Vitória","Vila Velha","Serra","Cariacica"], "ES");
  map(["Macapá","Santana"], "AP");
  map(["Porto Velho","Ji-Paraná"], "RO");
  map(["Boa Vista"], "RR");
  map(["Rio Branco"], "AC");
  map(["Palmas","Araguaína"], "TO");

  function siglaParaEstado(sigla) {
    const up = sigla.toUpperCase().replace(/[\s.]/g, "");
    return UF[up] || null;
  }

  function normalizarEstado(raw) {
    if (!raw) return "";
    const s = raw.trim();
    if (NOMES_VALIDOS.has(s)) return s;
    const up = s.toUpperCase().replace(/[\s.]/g, "");
    if (UF[up]) return UF[up];
    const key = strip(s);
    if (POR_NOME[key]) return POR_NOME[key];
    return s;
  }

  // Extrai sigla de UF do campo cidade: "Sorocaba SP", "Sorocaba, SP", "Sorocaba - SP", "Sorocaba/SP", "Sorocaba-SP"
  function extrairSiglaDaCidade(cidade) {
    if (!cidade) return { cidade: "", sigla: null };
    let s = cidade.trim();
    // Padrões: "Cidade, UF", "Cidade - UF", "Cidade / UF", "Cidade-UF", "Cidade UF"
    const m = s.match(/^(.+?)\s*[,\-\/]\s*([A-Za-z]{2})\s*$/);
    if (m) {
      const uf = m[2].toUpperCase();
      if (SIGLAS.has(uf)) return { cidade: m[1].trim(), sigla: uf };
    }
    // "Cidade UF" no final (sem separador)
    const m2 = s.match(/^(.+?)\s+([A-Za-z]{2})\s*$/);
    if (m2) {
      const uf = m2[2].toUpperCase();
      if (SIGLAS.has(uf)) return { cidade: m2[1].trim(), sigla: uf };
    }
    return { cidade: s, sigla: null };
  }

  // Capitaliza nome da cidade
  function capitalizarCidade(nome) {
    const preps = new Set(["de","do","da","dos","das","e"]);
    return nome.toLowerCase().replace(/\b\w+/g, (w, i) =>
      i > 0 && preps.has(w) ? w : w[0].toUpperCase() + w.slice(1)
    ).trim();
  }

  // --- Passo 1: normalizar quem já tem estado preenchido ---
  const comEstado = db.prepare("SELECT id, estado FROM sellers WHERE estado IS NOT NULL AND estado != ''").all();
  const updEstado = db.prepare("UPDATE sellers SET estado = ? WHERE id = ?");
  let n1 = 0;
  db.transaction(() => {
    for (const row of comEstado) {
      const corrigido = normalizarEstado(row.estado);
      if (corrigido !== row.estado) { updEstado.run(corrigido, row.id); n1++; }
    }
  })();

  // --- Passo 2: profissionais sem estado — extrair do campo cidade ---
  const semEstado = db.prepare("SELECT id, cidade, estado FROM sellers WHERE estado IS NULL OR estado = ''").all();
  const updAmbos = db.prepare("UPDATE sellers SET cidade = ?, estado = ? WHERE id = ?");
  const updSoEstado = db.prepare("UPDATE sellers SET estado = ? WHERE id = ?");
  let n2 = 0;
  const naoResolvidos = [];
  db.transaction(() => {
    for (const row of semEstado) {
      const cidadeOriginal = (row.cidade || "").trim();
      if (!cidadeOriginal) continue;

      const { cidade: cidadeLimpa, sigla } = extrairSiglaDaCidade(cidadeOriginal);

      if (sigla) {
        const estado = UF[sigla];
        const cidadeFinal = capitalizarCidade(cidadeLimpa);
        updAmbos.run(cidadeFinal, estado, row.id);
        n2++;
        continue;
      }

      // Sem sigla no campo — tentar inferir pela cidade
      const key = strip(cidadeLimpa);
      if (CIDADE_ESTADO[key]) {
        const cidadeFinal = capitalizarCidade(cidadeLimpa);
        updAmbos.run(cidadeFinal, CIDADE_ESTADO[key], row.id);
        n2++;
        continue;
      }

      naoResolvidos.push(`"${cidadeOriginal}"`);
    }
  })();

  if (n1) console.log(`[migração] estado corrigido em ${n1} profissional(is) que já tinham estado`);
  if (n2) console.log(`[migração] estado extraído/inferido para ${n2} profissional(is) a partir da cidade`);
  if (naoResolvidos.length) console.log(`[migração] ${naoResolvidos.length} cidade(s) não resolvida(s): ${naoResolvidos.join(", ")}`);

  const distintos = db.prepare("SELECT estado, COUNT(*) as n FROM sellers WHERE estado IS NOT NULL AND estado != '' GROUP BY estado ORDER BY n DESC").all();
  console.log(`[migração] estados: ${distintos.map((r) => `${r.estado}(${r.n})`).join(", ")}`);
  const restam = db.prepare("SELECT COUNT(*) as n FROM sellers WHERE estado IS NULL OR estado = ''").get();
  const total = db.prepare("SELECT COUNT(*) as n FROM sellers").get();
  console.log(`[migração] ${total.n} profissionais, ${total.n - restam.n} com estado, ${restam.n} sem`);
})();

// Voucher de cortesia: 99% de desconto, código "Ricardo Martin" (normalizado
// para RICARDOMARTIN). Idempotente — o código é UNIQUE, então só entra uma vez.
try {
  db.prepare(`INSERT OR IGNORE INTO vouchers (id, codigo, tipo, valor, validadeEm, limiteTotal, limitePorEmpresa, planos, status, criadoEm)
    VALUES (?, 'RICARDOMARTIN', 'percentual', 99, NULL, 0, 1, '[]', 'ativo', ?)`).run(uid(), agora());
} catch (e) { console.warn("[seed] voucher cortesia:", e.message); }

db.exec(`CREATE TABLE IF NOT EXISTS saved_cards (
  id TEXT PRIMARY KEY,
  companyId TEXT NOT NULL,
  apelido TEXT DEFAULT '',
  bandeira TEXT DEFAULT '',
  final4 TEXT DEFAULT '',
  token TEXT NOT NULL,
  holderName TEXT DEFAULT '',
  tipo TEXT DEFAULT 'CREDIT_CARD',
  criadoEm INTEGER NOT NULL
)`);

// Biblioteca de Materiais da empresa (Central de Conhecimento).
db.exec(`
  CREATE TABLE IF NOT EXISTS materiais (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    categoria TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    chave TEXT,
    url TEXT,
    mimetype TEXT DEFAULT '',
    tamanho INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    atualizadoEm INTEGER NOT NULL,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );
  CREATE INDEX IF NOT EXISTS idx_materiais_empresa ON materiais(companyId);

  CREATE TABLE IF NOT EXISTS materiais_campanhas (
    materialId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    vinculadoEm INTEGER NOT NULL,
    PRIMARY KEY (materialId, campaignId),
    FOREIGN KEY (materialId) REFERENCES materiais(id),
    FOREIGN KEY (campaignId) REFERENCES campaigns(id)
  );
  CREATE INDEX IF NOT EXISTS idx_matcamp_material ON materiais_campanhas(materialId);
  CREATE INDEX IF NOT EXISTS idx_matcamp_campanha ON materiais_campanhas(campaignId);
`);
// Materiais importados do onboarding (academy_materiais) guardam aqui a origem,
// para a importação ser idempotente e não reimportar o mesmo arquivo.
adicionarColuna("materiais", "origemAcademyId", "TEXT DEFAULT ''");

// Academy da empresa: dono do treinamento. Vazio = curso da plataforma RYCS
// (como sempre foi); preenchido = treinamento criado por uma empresa.
adicionarColuna("courses", "companyId", "TEXT DEFAULT ''");
// Origem do treinamento: criado manualmente pela empresa ou gerado pela IA.
adicionarColuna("courses", "origem", "TEXT DEFAULT 'manual'");
// Regras gerais da Academy da empresa (JSON): sequência obrigatória etc.
adicionarColuna("companies", "academyConfig", "TEXT DEFAULT '{}'");
// Disponibilidade de um treinamento por campanha + se a conclusão é exigida
// para executar tarefas. Aditivo, não altera nada existente.
db.exec(`
  CREATE TABLE IF NOT EXISTS course_campaigns (
    courseId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    obrigatorio INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    PRIMARY KEY (courseId, campaignId)
  );
  CREATE INDEX IF NOT EXISTS idx_course_campaigns_course ON course_campaigns(courseId);
  CREATE INDEX IF NOT EXISTS idx_course_campaigns_campaign ON course_campaigns(campaignId);
`);

// Voucher RICARDOMARTIN: ilimitado (sem limite total nem por empresa)
db.prepare("UPDATE vouchers SET limiteTotal = 0, limitePorEmpresa = 0 WHERE codigo = 'RICARDOMARTIN' AND (limiteTotal != 0 OR limitePorEmpresa != 0)").run();

// Central de Testes — DISC (perfil comportamental), instrumento rycs-disc-v1-24.
// Tabela própria, separada do DISC antigo (sellers.disc, 8 perguntas), que é
// preservado. Uma linha por (profissional, versão): refazer sobrescreve a
// própria tentativa, sem tocar no resultado histórico do instrumento antigo.
db.exec(`
  CREATE TABLE IF NOT EXISTS disc_assessments (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    versao TEXT NOT NULL,
    algoritmo TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'andamento',
    respostas TEXT DEFAULT '{}',
    ordem TEXT DEFAULT '{}',
    progresso INTEGER DEFAULT 0,
    contagens TEXT DEFAULT '{}',
    saldos TEXT DEFAULT '{}',
    resultado TEXT DEFAULT '{}',
    compartilharEmpresas INTEGER DEFAULT 0,
    iniciadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    concluidoEm INTEGER,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_disc_assessments_seller_versao ON disc_assessments(sellerId, versao);
  CREATE INDEX IF NOT EXISTS idx_disc_assessments_seller ON disc_assessments(sellerId, iniciadoEm DESC);
`);

// Avaliação Big Five (IPIP-50) — instrumento próprio, separado do DISC. Persiste
// versão do instrumento, idioma, chave de correção, respostas, pontuação e data
// de conclusão. Compartilhamento com empresas é privado por padrão (= 0). O
// resultado NUNCA toca perfilComercial, score comercial, ranking ou campanhas.
db.exec(`
  CREATE TABLE IF NOT EXISTS bigfive_assessments (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    versao TEXT NOT NULL,
    idioma TEXT DEFAULT '',
    chave TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'andamento',
    respostas TEXT DEFAULT '{}',
    progresso INTEGER DEFAULT 0,
    resultado TEXT DEFAULT '{}',
    compartilharEmpresas INTEGER DEFAULT 0,
    iniciadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    concluidoEm INTEGER,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bigfive_assessments_seller_versao ON bigfive_assessments(sellerId, versao);
  CREATE INDEX IF NOT EXISTS idx_bigfive_assessments_seller ON bigfive_assessments(sellerId, iniciadoEm DESC);
`);

// Avaliação Padrões de Autossabotagem (instrumento autoral rycs-autossabotagem-
// v1-40) — tabela própria, separada do DISC e do Big Five. Persiste versão do
// instrumento, idioma, chave, versão do algoritmo, respostas, pontuação (soma e
// média por padrão, dentro de `resultado`) e data de conclusão. Compartilhamento
// com empresas é privado por padrão (= 0). O resultado NUNCA toca perfilComercial,
// score comercial, ranking ou campanhas.
db.exec(`
  CREATE TABLE IF NOT EXISTS autossabotagem_assessments (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    versao TEXT NOT NULL,
    idioma TEXT DEFAULT '',
    chave TEXT DEFAULT '',
    algoritmo TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'andamento',
    respostas TEXT DEFAULT '{}',
    progresso INTEGER DEFAULT 0,
    resultado TEXT DEFAULT '{}',
    compartilharEmpresas INTEGER DEFAULT 0,
    iniciadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    concluidoEm INTEGER,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_autossabotagem_assessments_seller_versao ON autossabotagem_assessments(sellerId, versao);
  CREATE INDEX IF NOT EXISTS idx_autossabotagem_assessments_seller ON autossabotagem_assessments(sellerId, iniciadoEm DESC);
`);

// Avaliação Inteligência Emocional (instrumento autoral rycs-inteligencia-
// emocional-v1-30) — tabela própria, separada das demais avaliações. Persiste
// versão do instrumento, idioma, chave, versão do algoritmo, respostas, pontuação
// (soma e média por competência, dentro de `resultado`) e data de conclusão.
// Compartilhamento com empresas é privado por padrão (= 0). O resultado NUNCA
// toca perfilComercial, score comercial, ranking ou campanhas.
db.exec(`
  CREATE TABLE IF NOT EXISTS inteligencia_emocional_assessments (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    versao TEXT NOT NULL,
    idioma TEXT DEFAULT '',
    chave TEXT DEFAULT '',
    algoritmo TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'andamento',
    respostas TEXT DEFAULT '{}',
    progresso INTEGER DEFAULT 0,
    resultado TEXT DEFAULT '{}',
    compartilharEmpresas INTEGER DEFAULT 0,
    iniciadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    concluidoEm INTEGER,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_inteligencia_emocional_assessments_seller_versao ON inteligencia_emocional_assessments(sellerId, versao);
  CREATE INDEX IF NOT EXISTS idx_inteligencia_emocional_assessments_seller ON inteligencia_emocional_assessments(sellerId, iniciadoEm DESC);
`);

// Avaliação RIASEC — Interesses Profissionais (instrumento autoral rycs-riasec-
// v1-36) — tabela própria, separada das demais avaliações. Persiste versão do
// instrumento, idioma, chave, versão do algoritmo, respostas, pontuação (soma e
// média por dimensão, dimensões destacadas e código exploratório, dentro de
// `resultado`) e data de conclusão. Compartilhamento com empresas é privado por
// padrão (= 0). O resultado NUNCA toca perfilComercial, score comercial, ranking
// ou campanhas.
db.exec(`
  CREATE TABLE IF NOT EXISTS riasec_assessments (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    versao TEXT NOT NULL,
    idioma TEXT DEFAULT '',
    chave TEXT DEFAULT '',
    algoritmo TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'andamento',
    respostas TEXT DEFAULT '{}',
    progresso INTEGER DEFAULT 0,
    resultado TEXT DEFAULT '{}',
    compartilharEmpresas INTEGER DEFAULT 0,
    iniciadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    concluidoEm INTEGER,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_riasec_assessments_seller_versao ON riasec_assessments(sellerId, versao);
  CREATE INDEX IF NOT EXISTS idx_riasec_assessments_seller ON riasec_assessments(sellerId, iniciadoEm DESC);
`);

// Gamificação do profissional (camada separada do RYCS Score / nível operacional).
// Aditivo e idempotente: o XP é um livro-razão com chave única por evento, então
// reprocessar nunca concede pontos em dobro.
db.exec(`
  CREATE TABLE IF NOT EXISTS gamification_xp (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    chave TEXT NOT NULL,        -- idempotência: "badge:<id>", "tarefa:<submissionId>"...
    xp INTEGER NOT NULL DEFAULT 0,
    motivo TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_gamification_xp_seller_chave ON gamification_xp(sellerId, chave);

  CREATE TABLE IF NOT EXISTS gamification_badges (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    badgeId TEXT NOT NULL,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_gamification_badges_seller_badge ON gamification_badges(sellerId, badgeId);
`);

// ── RYCS Club: imagens configuráveis, prêmios e resgates ──────────────────────
// Camada administrativa do Club. Nada aqui toca em finanças, score ou nível
// operacional. Imagens ficam por "slot" (banner, nível, medalha); prêmios
// nascem em rascunho e só aparecem ao profissional quando publicados.
db.exec(`
  CREATE TABLE IF NOT EXISTS club_config (
    chave TEXT PRIMARY KEY,        -- 'banner', 'nivel:<chave>', 'medalha:<badgeId>'
    url TEXT DEFAULT '',
    atualizadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS club_prizes (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    tipo TEXT DEFAULT 'fisico',          -- 'fisico' | 'digital'
    imagem TEXT DEFAULT '',
    metrica TEXT DEFAULT '',             -- métrica do engine (ex.: 'tarefasAprovadas')
    alvo REAL DEFAULT 0,                 -- marco para desbloquear (Modelo A)
    paises TEXT DEFAULT '[]',            -- JSON de códigos de país; [] = todos
    quantidade INTEGER,                  -- NULL = ilimitado
    status TEXT DEFAULT 'rascunho',      -- 'rascunho' | 'publicado' | 'arquivado'
    ordem INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS club_redemptions (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    prizeId TEXT NOT NULL,
    estado TEXT DEFAULT 'solicitado',    -- solicitado|analise|aprovado|enviado|entregue|recusado
    endereco TEXT DEFAULT '',
    observacao TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_club_redemptions_seller_prize ON club_redemptions(sellerId, prizeId);
`);

// ── Planos do profissional (Grátis/Pro/Premium) ──────────────────────────────
// Separado de `subscriptions` (que é da empresa). O plano em vigor não fica
// gravado: sai de planoDoProfissional() em shared/planosProfissional.js, a
// partir de pagoAte. Docs: docs/rycs/planos-pro-premium.md.
db.exec(`
  CREATE TABLE IF NOT EXISTS assinaturas_profissional (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    plano TEXT NOT NULL,                 -- 'pro' | 'premium'
    ciclo TEXT NOT NULL DEFAULT 'anual',
    status TEXT NOT NULL DEFAULT 'pendente', -- pendente|ativa|atrasada|cancelada|reembolsada|expirada
    origem TEXT NOT NULL DEFAULT 'asaas',    -- asaas|admin|migracao
    asaasId TEXT,
    asaasCustomerId TEXT,
    ultimoPaymentId TEXT,
    valor REAL DEFAULT 0,
    inicio INTEGER,
    pagoAte INTEGER,
    proximaCobranca INTEGER,
    canceladoEm INTEGER,
    motivo TEXT DEFAULT '',
    criadoPor TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE INDEX IF NOT EXISTS idx_assinaturas_profissional_seller ON assinaturas_profissional(sellerId);

  CREATE TABLE IF NOT EXISTS uso_profissional (
    sellerId TEXT NOT NULL,
    recurso TEXT NOT NULL,               -- 'minutosDiscadora' | 'lembretesWhatsApp' | ...
    periodo TEXT NOT NULL,               -- 'AAAA-MM' no fuso America/Sao_Paulo
    usado REAL DEFAULT 0,
    avisado80 INTEGER DEFAULT 0,
    avisado100 INTEGER DEFAULT 0,
    PRIMARY KEY (sellerId, recurso, periodo)
  );
`);
adicionarColuna("sellers", "asaasCustomerId", "TEXT");

// Compra avulsa de curso da Academy (Pix pelo Asaas, externalReference
// "curso:<id>"). A matrícula só nasce do pagamento confirmado no webhook.
db.exec(`
  CREATE TABLE IF NOT EXISTS course_purchases (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    valor REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente', -- pendente|paga|reembolsada|expirada
    asaasId TEXT,
    asaasCustomerId TEXT,
    pagoEm INTEGER,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_course_purchases_seller ON course_purchases(sellerId, courseId);
`);

// Avaliação Comunicação Profissional (instrumento autoral situacional rycs-
// comunicacao-profissional-v1-20) — tabela própria, separada das demais. Persiste
// versão, idioma, versão do gabarito (coluna `chave`), versão do algoritmo,
// respostas (letra por questão), pontuação (acertos totais e por competência,
// dentro de `resultado`) e data de conclusão. Compartilhamento privado por padrão
// (= 0). O resultado NUNCA toca perfilComercial, score, ranking ou campanhas.
db.exec(`
  CREATE TABLE IF NOT EXISTS comunicacao_assessments (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    versao TEXT NOT NULL,
    idioma TEXT DEFAULT '',
    chave TEXT DEFAULT '',
    algoritmo TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'andamento',
    respostas TEXT DEFAULT '{}',
    progresso INTEGER DEFAULT 0,
    resultado TEXT DEFAULT '{}',
    compartilharEmpresas INTEGER DEFAULT 0,
    iniciadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    concluidoEm INTEGER,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_comunicacao_assessments_seller_versao ON comunicacao_assessments(sellerId, versao);
  CREATE INDEX IF NOT EXISTS idx_comunicacao_assessments_seller ON comunicacao_assessments(sellerId, iniciadoEm DESC);
`);

// Avaliação Organização e Produtividade (instrumento autoral situacional rycs-
// organizacao-produtividade-v1-20) — tabela própria, separada das demais.
// Persiste versão, idioma, versão do gabarito (coluna `chave`), versão do
// algoritmo, respostas (letra por questão), pontuação (acertos totais e por
// competência, dentro de `resultado`) e data de conclusão. Compartilhamento
// privado por padrão (= 0). O resultado NUNCA toca perfilComercial, score,
// ranking ou campanhas.
db.exec(`
  CREATE TABLE IF NOT EXISTS organizacao_assessments (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    versao TEXT NOT NULL,
    idioma TEXT DEFAULT '',
    chave TEXT DEFAULT '',
    algoritmo TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'andamento',
    respostas TEXT DEFAULT '{}',
    progresso INTEGER DEFAULT 0,
    resultado TEXT DEFAULT '{}',
    compartilharEmpresas INTEGER DEFAULT 0,
    iniciadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    concluidoEm INTEGER,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_organizacao_assessments_seller_versao ON organizacao_assessments(sellerId, versao);
  CREATE INDEX IF NOT EXISTS idx_organizacao_assessments_seller ON organizacao_assessments(sellerId, iniciadoEm DESC);
`);

// Sequências de e-mail do funil e regras que elas anunciam.
// perfilCompletoEm: primeira vez que o perfil ficou completo (âncora da
// sequência de indicações). inativoEm: conta inativada por perfil incompleto,
// reversível — volta sozinha quando o perfil é completado.
adicionarColuna("sellers", "perfilCompletoEm", "INTEGER");
adicionarColuna("sellers", "inativoEm", "INTEGER");
adicionarColuna("sellers", "inativoMotivo", "TEXT DEFAULT ''");
adicionarColuna("sellers", "bonusIndicacaoBlocos", "INTEGER DEFAULT 0");
adicionarColuna("users", "ultimoAcessoEm", "INTEGER");
// WhatsApp de marketing da empresa: aceite no cadastro e pedido para sair.
adicionarColuna("companies", "whatsappMarketingEm", "INTEGER");
adicionarColuna("companies", "whatsappMarketingSaiuEm", "INTEGER");
// Indicações: 'v1' é a regra antiga (valor fixo no pagamento) e continua
// valendo para quem já estava pendente. 'v2' paga a ativação da empresa e um
// percentual da primeira mensalidade, cada um uma única vez.
adicionarColuna("referrals", "regra", "TEXT DEFAULT 'v1'");
adicionarColuna("referrals", "ativadaEm", "INTEGER");
adicionarColuna("referrals", "pagamentoEm", "INTEGER");

// Avaliação Julgamento Situacional Profissional (instrumento autoral situacional
// rycs-julgamento-situacional-v1-25) — tabela própria, separada das demais.
// Persiste versão, idioma, versão do gabarito (coluna `chave`), versão do
// algoritmo, respostas (letra por questão), pontuação (acertos totais e por
// competência, dentro de `resultado`) e data de conclusão. Compartilhamento
// privado por padrão (= 0). O resultado NUNCA toca perfilComercial, score,
// ranking ou campanhas.
db.exec(`
  CREATE TABLE IF NOT EXISTS julgamento_assessments (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    versao TEXT NOT NULL,
    idioma TEXT DEFAULT '',
    chave TEXT DEFAULT '',
    algoritmo TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'andamento',
    respostas TEXT DEFAULT '{}',
    progresso INTEGER DEFAULT 0,
    resultado TEXT DEFAULT '{}',
    compartilharEmpresas INTEGER DEFAULT 0,
    iniciadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    concluidoEm INTEGER,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_julgamento_assessments_seller_versao ON julgamento_assessments(sellerId, versao);
  CREATE INDEX IF NOT EXISTS idx_julgamento_assessments_seller ON julgamento_assessments(sellerId, iniciadoEm DESC);
`);

// Avaliação Raciocínio Lógico e Analítico (autoral, com gabarito). Gabarito só
// no servidor (shared/raciocinioLogico.js). Compartilhamento privado por padrão.
db.exec(`
  CREATE TABLE IF NOT EXISTS raciocinio_assessments (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    versao TEXT NOT NULL,
    idioma TEXT DEFAULT '',
    chave TEXT DEFAULT '',
    algoritmo TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'andamento',
    respostas TEXT DEFAULT '{}',
    progresso INTEGER DEFAULT 0,
    resultado TEXT DEFAULT '{}',
    compartilharEmpresas INTEGER DEFAULT 0,
    iniciadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    concluidoEm INTEGER,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_raciocinio_assessments_seller_versao ON raciocinio_assessments(sellerId, versao);
  CREATE INDEX IF NOT EXISTS idx_raciocinio_assessments_seller ON raciocinio_assessments(sellerId, iniciadoEm DESC);
`);

// Avaliação Resolução de Problemas (situacional autoral, com gabarito). Gabarito
// só no servidor (shared/resolucaoProblemas.js). Compartilhamento privado por padrão.
db.exec(`
  CREATE TABLE IF NOT EXISTS resolucao_assessments (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    versao TEXT NOT NULL,
    idioma TEXT DEFAULT '',
    chave TEXT DEFAULT '',
    algoritmo TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'andamento',
    respostas TEXT DEFAULT '{}',
    progresso INTEGER DEFAULT 0,
    resultado TEXT DEFAULT '{}',
    compartilharEmpresas INTEGER DEFAULT 0,
    iniciadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    concluidoEm INTEGER,
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_resolucao_assessments_seller_versao ON resolucao_assessments(sellerId, versao);
  CREATE INDEX IF NOT EXISTS idx_resolucao_assessments_seller ON resolucao_assessments(sellerId, iniciadoEm DESC);
`);

// Programa de Afiliados (Incremento A) — camada ADITIVA sobre o programa de
// indicações existente (tabela `referrals`). Enquanto a flag AFILIADOS_ENABLED
// estiver desligada, estas tabelas apenas materializam/auditam dados derivados
// das indicações atuais; NENHUM crédito novo é feito e a política vigente
// continua sendo a de 30% da primeira mensalidade. Valores de comissão vivem em
// CENTAVOS INTEIROS (nunca ponto flutuante). A conversão para o saldo em reais
// só ocorre na fronteira do crédito, reaproveitando o caminho existente.
db.exec(`
  -- Atribuição permanente AFILIADO → EMPRESA (não "usuário que clicou").
  -- Uma atribuição ativa por empresa (UNIQUE companyId).
  CREATE TABLE IF NOT EXISTS affiliate_attributions (
    id TEXT PRIMARY KEY,
    affiliateUserId TEXT NOT NULL,
    affiliateCode TEXT DEFAULT '',
    companyId TEXT NOT NULL,
    referralId TEXT,
    metodo TEXT DEFAULT 'primeiro_vinculo',
    status TEXT NOT NULL DEFAULT 'ativo',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_attr_company ON affiliate_attributions(companyId);
  CREATE INDEX IF NOT EXISTS idx_affiliate_attr_affiliate ON affiliate_attributions(affiliateUserId, criadoEm DESC);

  -- Contabilização de comissões em CENTAVOS INTEIROS. Uma comissão por evento
  -- financeiro elegível (UNIQUE idempotencyKey). O percentual é congelado
  -- (percentualSnapshot) no momento da constituição.
  CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id TEXT PRIMARY KEY,
    affiliateUserId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    subscriptionId TEXT,
    provider TEXT DEFAULT '',
    providerPaymentId TEXT DEFAULT '',
    policy TEXT DEFAULT '',
    percentualSnapshot REAL NOT NULL DEFAULT 0,
    moeda TEXT NOT NULL DEFAULT 'BRL',
    baseCents INTEGER NOT NULL DEFAULT 0,
    comissaoCents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'identificada',
    idempotencyKey TEXT NOT NULL,
    criadoEm INTEGER NOT NULL,
    disponivelEm INTEGER,
    creditadoEm INTEGER,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_comm_idem ON affiliate_commissions(idempotencyKey);
  CREATE INDEX IF NOT EXISTS idx_affiliate_comm_affiliate ON affiliate_commissions(affiliateUserId, status, criadoEm DESC);
  CREATE INDEX IF NOT EXISTS idx_affiliate_comm_company ON affiliate_commissions(companyId);

  -- Níveis configuráveis (proposta inicial, inativos até aprovação). Mudanças
  -- não alteram retroativamente comissões já constituídas (snapshot acima).
  CREATE TABLE IF NOT EXISTS affiliate_commission_tiers (
    id TEXT PRIMARY KEY,
    chave TEXT NOT NULL,
    nome TEXT NOT NULL,
    minCompanies INTEGER NOT NULL DEFAULT 0,
    percentual REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 0,
    effectiveFrom INTEGER,
    effectiveUntil INTEGER,
    criadoEm INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_tier_chave ON affiliate_commission_tiers(chave);

  -- Histórico auditável de transições de estado das comissões.
  CREATE TABLE IF NOT EXISTS affiliate_commission_events (
    id TEXT PRIMARY KEY,
    commissionId TEXT NOT NULL,
    eventType TEXT NOT NULL,
    previousStatus TEXT,
    newStatus TEXT,
    dados TEXT DEFAULT '{}',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (commissionId) REFERENCES affiliate_commissions(id)
  );
  CREATE INDEX IF NOT EXISTS idx_affiliate_comm_events ON affiliate_commission_events(commissionId, criadoEm DESC);
`);

// Parceria de Canal (shared/parceriaCanal.js) — profissional que traz uma
// carteira de empresas e ganha fechamento + recorrência + uso enquanto elas
// pagam. Aditivo: só quem o admin ativa aqui sai da regra comum de indicação.
// Percentual NULL = padrão de shared/parceriaCanal.js.
db.exec(`
  CREATE TABLE IF NOT EXISTS channel_partners (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativo',
    pctFechamento REAL,
    pctRecorrencia REAL,
    pctUso REAL,
    observacao TEXT DEFAULT '',
    ativadoPor TEXT,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_partners_user ON channel_partners(userId);
`);
// Comissões da parceria usam affiliate_commissions (policy = 'canal-v1').
// tipo: fechamento | recorrencia | uso; referencia: cobrança ou ação de origem.
adicionarColuna("affiliate_commissions", "tipo", "TEXT DEFAULT ''");
adicionarColuna("affiliate_commissions", "referencia", "TEXT DEFAULT ''");
db.exec("CREATE INDEX IF NOT EXISTS idx_affiliate_comm_status_lib ON affiliate_commissions(status, disponivelEm)");
// Pedidos de parceria vindos de rycs.pro/parceiros (visitante sem conta).
// status: novo | aprovado | arquivado. Aprovar = o admin ativou o parceiro.
db.exec(`
  CREATE TABLE IF NOT EXISTS channel_partner_requests (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    whats TEXT DEFAULT '',
    cidade TEXT DEFAULT '',
    base INTEGER,
    segmento TEXT DEFAULT '',
    mensagem TEXT DEFAULT '',
    visitanteId TEXT DEFAULT '',
    origem TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'novo',
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_partner_requests_status ON channel_partner_requests(status, criadoEm DESC);
  CREATE INDEX IF NOT EXISTS idx_partner_requests_email ON channel_partner_requests(email);
`);

// Colaboradores internos (docs/colaboradores/SPEC.md e shared/colaboradores.js).
// Só tabelas novas. Lançamentos não se editam nem se apagam: correção é um
// novo lançamento (ajuste ou estorno), com chave única para não duplicar.
db.exec(`
  CREATE TABLE IF NOT EXISTS colaboradores (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    nome TEXT NOT NULL,
    cpf TEXT DEFAULT '',
    funcao TEXT DEFAULT '',
    vinculo TEXT NOT NULL DEFAULT 'clt',
    regime TEXT DEFAULT 'presencial',
    dataInicio TEXT NOT NULL,
    jornadaHoras REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ativo',
    dataSaida TEXT,
    motivoSaida TEXT DEFAULT '',
    criadoPor TEXT,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_colab_user ON colaboradores(userId);

  CREATE TABLE IF NOT EXISTS colab_regras (
    id TEXT PRIMARY KEY,
    colaboradorId TEXT NOT NULL,
    versao INTEGER NOT NULL,
    regra TEXT NOT NULL,
    vigenciaInicio TEXT NOT NULL,
    motivo TEXT DEFAULT '',
    criadoPor TEXT,
    criadoEm INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_colab_regras_versao ON colab_regras(colaboradorId, versao);

  CREATE TABLE IF NOT EXISTS colab_contrato_modelos (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL DEFAULT 'contrato',
    vinculo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    versao INTEGER NOT NULL,
    texto TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    criadoPor TEXT,
    criadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS colab_contratos (
    id TEXT PRIMARY KEY,
    colaboradorId TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'contrato',
    modeloId TEXT,
    modeloVersao INTEGER,
    regraVersao INTEGER,
    titulo TEXT DEFAULT '',
    texto TEXT NOT NULL,
    hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    codigoHash TEXT,
    codigoExpira INTEGER,
    codigoTentativas INTEGER DEFAULT 0,
    assinadoEm INTEGER,
    ip TEXT,
    userAgent TEXT,
    criadoPor TEXT,
    criadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_colab_contratos ON colab_contratos(colaboradorId, criadoEm DESC);

  CREATE TABLE IF NOT EXISTS colab_termo_aceites (
    id TEXT PRIMARY KEY,
    colaboradorId TEXT NOT NULL,
    userId TEXT NOT NULL,
    versao TEXT NOT NULL,
    ip TEXT,
    userAgent TEXT,
    criadoEm INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_colab_termo ON colab_termo_aceites(colaboradorId, versao);

  CREATE TABLE IF NOT EXISTS colab_tarefas (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    atribuicao TEXT NOT NULL DEFAULT 'pessoa',
    alvo TEXT DEFAULT '',
    prazoData TEXT,
    recorrencia TEXT NOT NULL DEFAULT 'unica',
    valorCents INTEGER,
    tipoProva TEXT NOT NULL DEFAULT 'texto',
    aprovacao TEXT NOT NULL DEFAULT 'manual',
    contaMeta INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ativa',
    sugeridaPorIA INTEGER DEFAULT 0,
    criadoPor TEXT,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER
  );

  CREATE TABLE IF NOT EXISTS colab_ocorrencias (
    id TEXT PRIMARY KEY,
    tarefaId TEXT NOT NULL,
    colaboradorId TEXT,
    chave TEXT NOT NULL,
    dataRef TEXT NOT NULL,
    prazoEm INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberta',
    prova TEXT DEFAULT '{}',
    provaHash TEXT,
    repetida INTEGER DEFAULT 0,
    checagens TEXT DEFAULT '{}',
    observacaoIA TEXT DEFAULT '',
    enviadoEm INTEGER,
    foraJornada INTEGER DEFAULT 0,
    autoAprovada INTEGER DEFAULT 0,
    conferidaAdmin INTEGER DEFAULT 0,
    motivo TEXT DEFAULT '',
    revisadoPor TEXT,
    revisadoEm INTEGER,
    reservadaEm INTEGER,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (tarefaId) REFERENCES colab_tarefas(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_colab_ocor_chave ON colab_ocorrencias(chave);
  CREATE INDEX IF NOT EXISTS idx_colab_ocor_colab ON colab_ocorrencias(colaboradorId, dataRef);
  CREATE INDEX IF NOT EXISTS idx_colab_ocor_hash ON colab_ocorrencias(provaHash);

  CREATE TABLE IF NOT EXISTS colab_lancamentos (
    id TEXT PRIMARY KEY,
    colaboradorId TEXT NOT NULL,
    mes TEXT NOT NULL,
    tipo TEXT NOT NULL,
    origemTipo TEXT NOT NULL,
    origemId TEXT NOT NULL,
    valorCents INTEGER NOT NULL,
    descricao TEXT DEFAULT '',
    motivo TEXT DEFAULT '',
    autor TEXT,
    chave TEXT NOT NULL,
    criadoEm INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_colab_lanc_chave ON colab_lancamentos(chave);
  CREATE INDEX IF NOT EXISTS idx_colab_lanc_mes ON colab_lancamentos(colaboradorId, mes);
  CREATE INDEX IF NOT EXISTS idx_colab_lanc_origem ON colab_lancamentos(colaboradorId, origemTipo, origemId);

  CREATE TABLE IF NOT EXISTS colab_fechamentos (
    id TEXT PRIMARY KEY,
    mes TEXT NOT NULL,
    fechadoPor TEXT,
    fechadoEm INTEGER NOT NULL,
    resumo TEXT DEFAULT '{}'
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_colab_fech_mes ON colab_fechamentos(mes);

  CREATE TABLE IF NOT EXISTS colab_ausencias (
    id TEXT PRIMARY KEY,
    colaboradorId TEXT NOT NULL,
    dataInicio TEXT NOT NULL,
    dataFim TEXT NOT NULL,
    tipo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pedida',
    observacao TEXT DEFAULT '',
    pedidoPor TEXT,
    decididoPor TEXT,
    decididoEm INTEGER,
    criadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_colab_aus ON colab_ausencias(colaboradorId, dataInicio);

  CREATE TABLE IF NOT EXISTS colab_feriados (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    nome TEXT NOT NULL,
    criadoPor TEXT,
    criadoEm INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_colab_feriados ON colab_feriados(data);

  CREATE TABLE IF NOT EXISTS colab_registros (
    id TEXT PRIMARY KEY,
    colaboradorId TEXT NOT NULL,
    tipo TEXT NOT NULL,
    data TEXT NOT NULL,
    em INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_colab_reg ON colab_registros(colaboradorId, data);

  CREATE TABLE IF NOT EXISTS colab_avisos (
    id TEXT PRIMARY KEY,
    colaboradorId TEXT,
    destino TEXT NOT NULL,
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    texto TEXT DEFAULT '',
    dados TEXT DEFAULT '{}',
    chave TEXT NOT NULL,
    lidoEm INTEGER,
    resolvidoEm INTEGER,
    criadoEm INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_colab_avisos_chave ON colab_avisos(chave);
  CREATE INDEX IF NOT EXISTS idx_colab_avisos ON colab_avisos(destino, colaboradorId, criadoEm DESC);

  CREATE TABLE IF NOT EXISTS colab_contestacoes (
    id TEXT PRIMARY KEY,
    colaboradorId TEXT NOT NULL,
    alvoTipo TEXT NOT NULL,
    alvoId TEXT NOT NULL,
    texto TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberta',
    resposta TEXT DEFAULT '',
    decididoPor TEXT,
    decididoEm INTEGER,
    criadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS colab_relatorios (
    id TEXT PRIMARY KEY,
    colaboradorId TEXT NOT NULL,
    periodo TEXT NOT NULL,
    referencia TEXT NOT NULL,
    inicio TEXT NOT NULL,
    fim TEXT NOT NULL,
    dados TEXT DEFAULT '{}',
    resumo TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_colab_rel ON colab_relatorios(colaboradorId, periodo, referencia);

  CREATE TABLE IF NOT EXISTS colab_auditoria (
    id TEXT PRIMARY KEY,
    autorId TEXT,
    acao TEXT NOT NULL,
    colaboradorId TEXT,
    alvoTipo TEXT DEFAULT '',
    alvoId TEXT DEFAULT '',
    dados TEXT DEFAULT '{}',
    criadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_colab_audit ON colab_auditoria(colaboradorId, criadoEm DESC);

  CREATE TABLE IF NOT EXISTS colab_config (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    atualizadoEm INTEGER
  );
`);
// Assinatura própria da plataforma: nome digitado pelo colaborador e código
// de verificação impresso no documento assinado.
adicionarColuna("colab_contratos", "nomeDigitado", "TEXT");
adicionarColuna("colab_contratos", "codigoVerificacao", "TEXT");
// Organograma: áreas (Marketing, Administrativo…) e cargos dentro delas.
db.exec(`
  CREATE TABLE IF NOT EXISTS colab_areas (
    id TEXT PRIMARY KEY,
    chave TEXT,
    nome TEXT NOT NULL,
    icone TEXT DEFAULT '',
    ordem INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS colab_cargos (
    id TEXT PRIMARY KEY,
    areaId TEXT NOT NULL,
    chave TEXT,
    nome TEXT NOT NULL,
    vinculo TEXT NOT NULL DEFAULT 'clt',
    regime TEXT DEFAULT 'presencial',
    jornadaHoras REAL DEFAULT 40,
    regra TEXT DEFAULT '{}',
    tarefas TEXT DEFAULT '[]',
    ordem INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (areaId) REFERENCES colab_areas(id)
  );
  CREATE INDEX IF NOT EXISTS idx_colab_cargos_area ON colab_cargos(areaId, ordem);
`);
adicionarColuna("colaboradores", "cargoId", "TEXT");
adicionarColuna("colaboradores", "dados", "TEXT DEFAULT '{}'");


// Loja de Leads → Campanha: origem do contato no pool
adicionarColuna("campaign_contacts", "origem", "TEXT DEFAULT 'manual'");
adicionarColuna("campaign_contacts", "listaOrigemId", "TEXT");

// Vitrine institucional: descrição visível para profissionais
adicionarColuna("companies", "descricaoInstitucional", "TEXT DEFAULT ''");

// Campanhas salvas pelo profissional (bookmark)
db.exec(`
  CREATE TABLE IF NOT EXISTS saved_campaigns (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    criadoEm INTEGER NOT NULL,
    UNIQUE(sellerId, campaignId)
  );
  CREATE INDEX IF NOT EXISTS idx_saved_campaigns_seller ON saved_campaigns(sellerId);
`);

// ── Evolution API: piloto (feature flag) ─────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS evolution_pilotos (
    sellerId TEXT PRIMARY KEY,
    autorizadoPor TEXT NOT NULL,
    criadoEm INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS evolution_consentimentos (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    texto TEXT NOT NULL,
    ip TEXT NOT NULL DEFAULT '',
    criadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_evo_consentimentos_seller ON evolution_consentimentos(sellerId);
`);

// ── Feature flag: discadora por empresa ──────────────────────────────
adicionarColuna("companies", "voice_habilitada", "INTEGER DEFAULT 0");

// =====================================================================
// RYCS VOICE — Discadora comercial nativa
// =====================================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS voice_providers (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    nome TEXT NOT NULL,
    config TEXT DEFAULT '{}',
    status TEXT DEFAULT 'ativo',
    criadoEm INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS voice_company_settings (
    companyId TEXT PRIMARY KEY,
    ativo INTEGER DEFAULT 0,
    modalidades TEXT DEFAULT '["mobile"]',
    horarioInicio TEXT DEFAULT '08:00',
    horarioFim TEXT DEFAULT '20:00',
    diasOperacao TEXT DEFAULT '["seg","ter","qua","qui","sex"]',
    metaDiaria INTEGER DEFAULT 30,
    maxTentativas INTEGER DEFAULT 3,
    intervaloRetentativa INTEGER DEFAULT 3600,
    scriptPadrao TEXT DEFAULT '',
    resultadosDisponiveis TEXT DEFAULT '[]',
    regrasDistribuicao TEXT DEFAULT '{}',
    gravacaoAtiva INTEGER DEFAULT 0,
    limiteMinutosMensal INTEGER DEFAULT 0,
    campanhasAutorizadas TEXT DEFAULT '[]',
    profissionaisAutorizados TEXT DEFAULT '[]',
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS voice_queues (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    campaignId TEXT,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    estrategia TEXT DEFAULT 'ordem',
    status TEXT DEFAULT 'ativa',
    prioridade INTEGER DEFAULT 0,
    maxTentativas INTEGER DEFAULT 3,
    intervaloRetentativa INTEGER DEFAULT 3600,
    horarioInicio TEXT DEFAULT '08:00',
    horarioFim TEXT DEFAULT '20:00',
    diasOperacao TEXT DEFAULT '["seg","ter","qua","qui","sex"]',
    config TEXT DEFAULT '{}',
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );
  CREATE INDEX IF NOT EXISTS idx_voice_queues_company ON voice_queues(companyId);

  CREATE TABLE IF NOT EXISTS voice_queue_members (
    id TEXT PRIMARY KEY,
    queueId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    papel TEXT DEFAULT 'operador',
    ativo INTEGER DEFAULT 1,
    criadoEm INTEGER NOT NULL,
    UNIQUE(queueId, sellerId),
    FOREIGN KEY (queueId) REFERENCES voice_queues(id),
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE INDEX IF NOT EXISTS idx_voice_qm_queue ON voice_queue_members(queueId);
  CREATE INDEX IF NOT EXISTS idx_voice_qm_seller ON voice_queue_members(sellerId);

  CREATE TABLE IF NOT EXISTS voice_queue_leads (
    id TEXT PRIMARY KEY,
    queueId TEXT NOT NULL,
    leadId TEXT NOT NULL,
    posicao INTEGER DEFAULT 0,
    tentativas INTEGER DEFAULT 0,
    ultimaTentativa INTEGER,
    proximaTentativa INTEGER,
    status TEXT DEFAULT 'pendente',
    prioridade INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    UNIQUE(queueId, leadId),
    FOREIGN KEY (queueId) REFERENCES voice_queues(id),
    FOREIGN KEY (leadId) REFERENCES leads(id)
  );
  CREATE INDEX IF NOT EXISTS idx_voice_ql_queue ON voice_queue_leads(queueId, status);
  CREATE INDEX IF NOT EXISTS idx_voice_ql_lead ON voice_queue_leads(leadId);

  CREATE TABLE IF NOT EXISTS voice_lead_reservations (
    id TEXT PRIMARY KEY,
    queueId TEXT NOT NULL,
    leadId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    status TEXT DEFAULT 'ativa',
    expiraEm INTEGER NOT NULL,
    criadoEm INTEGER NOT NULL,
    liberadoEm INTEGER,
    FOREIGN KEY (queueId) REFERENCES voice_queues(id),
    FOREIGN KEY (leadId) REFERENCES leads(id),
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE INDEX IF NOT EXISTS idx_voice_res_queue ON voice_lead_reservations(queueId, status);
  CREATE INDEX IF NOT EXISTS idx_voice_res_lead ON voice_lead_reservations(leadId, status);
  CREATE INDEX IF NOT EXISTS idx_voice_res_seller ON voice_lead_reservations(sellerId, status);

  CREATE TABLE IF NOT EXISTS voice_calls (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    campaignId TEXT,
    queueId TEXT,
    leadId TEXT,
    sellerId TEXT NOT NULL,
    providerId TEXT DEFAULT 'mobile',
    numeroOrigem TEXT DEFAULT '',
    numeroDestino TEXT NOT NULL,
    status TEXT DEFAULT 'iniciada',
    resultado TEXT DEFAULT '',
    observacao TEXT DEFAULT '',
    origemDados TEXT DEFAULT 'declarado',
    iniciadaEm INTEGER NOT NULL,
    atendidaEm INTEGER,
    encerradaEm INTEGER,
    duracaoTotal INTEGER DEFAULT 0,
    duracaoTarifavel INTEGER DEFAULT 0,
    providerCallId TEXT DEFAULT '',
    gravacaoRef TEXT DEFAULT '',
    metadados TEXT DEFAULT '{}',
    validado INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id),
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE INDEX IF NOT EXISTS idx_voice_calls_company ON voice_calls(companyId, criadoEm);
  CREATE INDEX IF NOT EXISTS idx_voice_calls_seller ON voice_calls(sellerId, criadoEm);
  CREATE INDEX IF NOT EXISTS idx_voice_calls_lead ON voice_calls(leadId);
  CREATE INDEX IF NOT EXISTS idx_voice_calls_queue ON voice_calls(queueId);

  CREATE TABLE IF NOT EXISTS voice_call_events (
    id TEXT PRIMARY KEY,
    callId TEXT NOT NULL,
    tipo TEXT NOT NULL,
    dados TEXT DEFAULT '{}',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (callId) REFERENCES voice_calls(id)
  );
  CREATE INDEX IF NOT EXISTS idx_voice_ce_call ON voice_call_events(callId);

  CREATE TABLE IF NOT EXISTS voice_call_dispositions (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    codigo TEXT NOT NULL,
    nome TEXT NOT NULL,
    categoria TEXT DEFAULT 'neutro',
    ativo INTEGER DEFAULT 1,
    ordem INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    UNIQUE(companyId, codigo)
  );

  CREATE TABLE IF NOT EXISTS voice_callbacks (
    id TEXT PRIMARY KEY,
    leadId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    queueId TEXT,
    agendadoPara INTEGER NOT NULL,
    observacao TEXT DEFAULT '',
    status TEXT DEFAULT 'pendente',
    callId TEXT,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (leadId) REFERENCES leads(id),
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE INDEX IF NOT EXISTS idx_voice_cb_seller ON voice_callbacks(sellerId, status);
  CREATE INDEX IF NOT EXISTS idx_voice_cb_agenda ON voice_callbacks(agendadoPara);

  CREATE TABLE IF NOT EXISTS voice_scripts (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    campaignId TEXT,
    queueId TEXT,
    nome TEXT NOT NULL,
    abertura TEXT DEFAULT '',
    qualificacao TEXT DEFAULT '',
    argumentacao TEXT DEFAULT '',
    objecoes TEXT DEFAULT '',
    encerramento TEXT DEFAULT '',
    agendamento TEXT DEFAULT '',
    ativo INTEGER DEFAULT 1,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );
  CREATE INDEX IF NOT EXISTS idx_voice_scripts_company ON voice_scripts(companyId);

  CREATE TABLE IF NOT EXISTS voice_do_not_call (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    telefone TEXT NOT NULL,
    motivo TEXT DEFAULT '',
    criadoPor TEXT,
    criadoEm INTEGER NOT NULL,
    UNIQUE(companyId, telefone)
  );
  CREATE INDEX IF NOT EXISTS idx_voice_dnc ON voice_do_not_call(companyId, telefone);

  CREATE TABLE IF NOT EXISTS voice_usage_events (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    sellerId TEXT,
    callId TEXT,
    tipo TEXT NOT NULL,
    minutos REAL DEFAULT 0,
    custo REAL DEFAULT 0,
    simulado INTEGER DEFAULT 0,
    idempotencyKey TEXT UNIQUE,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );
  CREATE INDEX IF NOT EXISTS idx_voice_usage_company ON voice_usage_events(companyId, criadoEm);

  CREATE TABLE IF NOT EXISTS voice_recordings (
    id TEXT PRIMARY KEY,
    callId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    url TEXT DEFAULT '',
    duracao INTEGER DEFAULT 0,
    formato TEXT DEFAULT 'wav',
    tamanho INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    retencaoAte INTEGER,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (callId) REFERENCES voice_calls(id)
  );

  CREATE TABLE IF NOT EXISTS voice_audit_logs (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    userId TEXT NOT NULL,
    acao TEXT NOT NULL,
    entidade TEXT NOT NULL,
    entidadeId TEXT NOT NULL,
    dados TEXT DEFAULT '{}',
    ip TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_voice_audit ON voice_audit_logs(companyId, criadoEm);

  CREATE TABLE IF NOT EXISTS voice_sessions (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    companyId TEXT NOT NULL,
    queueId TEXT,
    status TEXT DEFAULT 'ativo',
    modalidade TEXT DEFAULT 'mobile',
    iniciadoEm INTEGER NOT NULL,
    pausadoEm INTEGER,
    encerradoEm INTEGER,
    totalLigacoes INTEGER DEFAULT 0,
    totalAtendidas INTEGER DEFAULT 0,
    tempoTotal INTEGER DEFAULT 0,
    FOREIGN KEY (sellerId) REFERENCES sellers(id),
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );
  CREATE INDEX IF NOT EXISTS idx_voice_sess_seller ON voice_sessions(sellerId, status);
`);

criarSchemaAgenda(db);
criarSchemaCalendario(db);
criarSchemaGestaoInterna(db);

// ── Campaign Ecosystem v2: novos campos condicionais ────────────────────
adicionarColuna("campaigns", "modeloTrabalho", "TEXT DEFAULT 'remoto'");
adicionarColuna("campaigns", "restricaoGeo", "TEXT DEFAULT 'nenhuma'");
adicionarColuna("campaigns", "paisesRestritos", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "regioesRestritas", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "cidadesRestritas", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "origemLeads", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "mercado", "TEXT DEFAULT 'pais_todo'");
adicionarColuna("campaigns", "mercadoPaises", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "mercadoRegioes", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "canais", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "nivelExperiencia", "TEXT DEFAULT 'indiferente'");
adicionarColuna("campaigns", "idiomasExigidos", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "disponibilidade", "TEXT DEFAULT 'flexivel'");
adicionarColuna("campaigns", "disponibilidadeDetalhes", "TEXT DEFAULT '{}'");
adicionarColuna("campaigns", "requisitosObrigatorios", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "requisitosDesejaveis", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "processoAdmissao", "TEXT DEFAULT 'manual'");
adicionarColuna("campaigns", "limiteProf", "INTEGER DEFAULT 0");
adicionarColuna("campaigns", "visibilidade", "TEXT DEFAULT 'publica'");
adicionarColuna("campaigns", "objetivoUI", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "temComissao", "INTEGER DEFAULT 0");
adicionarColuna("campaigns", "comissaoConfig", "TEXT DEFAULT '{}'");
adicionarColuna("campaigns", "remuneracaoCumulativa", "INTEGER DEFAULT 1");
adicionarColuna("campaigns", "acoesAtivas", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "icpTipo", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "icpEstruturado", "TEXT DEFAULT '{}'");
adicionarColuna("campaigns", "qualificacaoCriterios", "TEXT DEFAULT '[]'");
adicionarColuna("campaigns", "reuniaoConfig", "TEXT DEFAULT '{}'");
adicionarColuna("campaigns", "versao", "INTEGER DEFAULT 1");

// Histórico de versões de campanha (versionamento de alterações)
db.exec(`
  CREATE TABLE IF NOT EXISTS campaign_versions (
    id TEXT PRIMARY KEY,
    campaignId TEXT NOT NULL,
    versao INTEGER NOT NULL,
    snapshot TEXT NOT NULL,
    alteradoPor TEXT,
    alteradoRole TEXT DEFAULT 'empresa',
    motivo TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (campaignId) REFERENCES campaigns(id)
  );
  CREATE INDEX IF NOT EXISTS idx_campaign_versions_camp ON campaign_versions(campaignId, versao);
`);

// ── Materiais de campanha: colunas extras na junction ──────────────────
adicionarColuna("materiais_campanhas", "categoria", "TEXT DEFAULT 'outros'");
adicionarColuna("materiais_campanhas", "obrigatoriedade", "TEXT DEFAULT 'complementar'");
adicionarColuna("materiais_campanhas", "acaoVinculada", "TEXT DEFAULT ''");
adicionarColuna("materiais_campanhas", "ordem", "INTEGER DEFAULT 0");
adicionarColuna("materiais_campanhas", "regraAcesso", "TEXT DEFAULT 'todos'");
adicionarColuna("materiais", "tipo", "TEXT DEFAULT 'arquivo'");

// ── Consulta de materiais pelo profissional ────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS materiais_consultas (
    id TEXT PRIMARY KEY,
    materialId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    tipo TEXT DEFAULT 'visualizacao',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (materialId) REFERENCES materiais(id),
    FOREIGN KEY (campaignId) REFERENCES campaigns(id),
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE INDEX IF NOT EXISTS idx_matconsulta_camp ON materiais_consultas(campaignId, sellerId);
`);

// ── Base de leads da campanha ──────────────────────────────────────────
adicionarColuna("campaigns", "fonteLeads", "TEXT DEFAULT 'profissional'");
adicionarColuna("campaigns", "selecaoLeadsTipo", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "selecaoLeadsFiltros", "TEXT DEFAULT '{}'");
adicionarColuna("campaigns", "selecaoLeadsDinamica", "INTEGER DEFAULT 0");
adicionarColuna("campaigns", "distribuicaoLeads", "TEXT DEFAULT 'fila'");
adicionarColuna("campaigns", "limiteLeadsSimultaneos", "INTEGER DEFAULT 0");
adicionarColuna("campaigns", "limiteLeadsDia", "INTEGER DEFAULT 0");
adicionarColuna("campaigns", "prazoContatoHoras", "INTEGER DEFAULT 0");
adicionarColuna("campaigns", "prazoInatividadeHoras", "INTEGER DEFAULT 0");

db.exec(`
  CREATE TABLE IF NOT EXISTS campaign_leads (
    id TEXT PRIMARY KEY,
    campaignId TEXT NOT NULL,
    leadId TEXT NOT NULL,
    sellerId TEXT DEFAULT '',
    status TEXT DEFAULT 'disponivel',
    atribuidoEm INTEGER,
    primeiroContatoEm INTEGER,
    ultimaAtividadeEm INTEGER,
    motivoDevolucao TEXT DEFAULT '',
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (campaignId) REFERENCES campaigns(id),
    FOREIGN KEY (leadId) REFERENCES leads(id)
  );
  CREATE INDEX IF NOT EXISTS idx_camplead_camp ON campaign_leads(campaignId, status);
  CREATE INDEX IF NOT EXISTS idx_camplead_seller ON campaign_leads(sellerId);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_camplead_uniq ON campaign_leads(campaignId, leadId);
`);

// ── Formas de ganho configuráveis ──────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS formas_ganho (
    id TEXT PRIMARY KEY,
    campaignId TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    tipoRemuneracao TEXT NOT NULL DEFAULT 'fixo',
    valor REAL DEFAULT 0,
    moeda TEXT DEFAULT 'BRL',
    eventoComercial TEXT DEFAULT '',
    criteriosValidacao TEXT DEFAULT '{}',
    evidenciasNecessarias TEXT DEFAULT '[]',
    metodoAprovacao TEXT DEFAULT 'manual',
    limiteRecorrencia INTEGER DEFAULT 0,
    limitePorProfissional INTEGER DEFAULT 0,
    limitePorLead INTEGER DEFAULT 1,
    regraRecorrencia TEXT DEFAULT 'unica',
    regraCumulatividade INTEGER DEFAULT 1,
    baseCalculo TEXT DEFAULT '',
    condicaoLiberacao TEXT DEFAULT '',
    ativo INTEGER DEFAULT 1,
    ordem INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER,
    FOREIGN KEY (campaignId) REFERENCES campaigns(id)
  );
  CREATE INDEX IF NOT EXISTS idx_fg_camp ON formas_ganho(campaignId, ativo);
`);

// ── Operações comerciais (agrupamento de campanhas) ────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS operacoes_comerciais (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    status TEXT DEFAULT 'ativa',
    criadoEm INTEGER NOT NULL,
    atualizadoEm INTEGER,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );
  CREATE INDEX IF NOT EXISTS idx_opcom_company ON operacoes_comerciais(companyId);
`);
adicionarColuna("campaigns", "operacaoId", "TEXT DEFAULT ''");
adicionarColuna("campaigns", "estruturaComercial", "TEXT DEFAULT 'independente'");

// ── Vínculos entre campanhas (continuidade comercial) ──────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS vinculos_campanhas (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    operacaoId TEXT DEFAULT '',
    campanhaOrigemId TEXT NOT NULL,
    campanhaDestinoId TEXT NOT NULL,
    eventoTransferencia TEXT DEFAULT 'reuniao_agendada',
    distribuicaoDestino TEXT DEFAULT 'equilibrada',
    responsavelRecebimento TEXT DEFAULT 'qualquer',
    infosCompartilhadas TEXT DEFAULT '["lead","historico","qualificacao"]',
    condicoesTransferencia TEXT DEFAULT '{}',
    ativo INTEGER DEFAULT 1,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id),
    FOREIGN KEY (campanhaOrigemId) REFERENCES campaigns(id),
    FOREIGN KEY (campanhaDestinoId) REFERENCES campaigns(id)
  );
  CREATE INDEX IF NOT EXISTS idx_vinccamp_orig ON vinculos_campanhas(campanhaOrigemId);
  CREATE INDEX IF NOT EXISTS idx_vinccamp_dest ON vinculos_campanhas(campanhaDestinoId);
`);

// ── Eventos comerciais ─────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS eventos_comerciais (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    tipo TEXT NOT NULL,
    leadId TEXT DEFAULT '',
    sellerId TEXT DEFAULT '',
    sellerOrigemId TEXT DEFAULT '',
    campanhaOrigemId TEXT DEFAULT '',
    oportunidadeId TEXT DEFAULT '',
    reuniaoId TEXT DEFAULT '',
    dadosEvento TEXT DEFAULT '{}',
    valorVenda REAL DEFAULT 0,
    processado INTEGER DEFAULT 0,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id),
    FOREIGN KEY (campaignId) REFERENCES campaigns(id)
  );
  CREATE INDEX IF NOT EXISTS idx_evcom_camp ON eventos_comerciais(campaignId, tipo);
  CREATE INDEX IF NOT EXISTS idx_evcom_lead ON eventos_comerciais(leadId, tipo);
  CREATE INDEX IF NOT EXISTS idx_evcom_seller ON eventos_comerciais(sellerId);
`);

// ── Transferência de oportunidades ─────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS transferencias_oportunidade (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    vinculoId TEXT NOT NULL,
    leadId TEXT NOT NULL,
    campanhaOrigemId TEXT NOT NULL,
    campanhaDestinoId TEXT NOT NULL,
    sellerOrigemId TEXT NOT NULL,
    sellerDestinoId TEXT DEFAULT '',
    reuniaoId TEXT DEFAULT '',
    status TEXT DEFAULT 'pendente',
    dadosQualificacao TEXT DEFAULT '{}',
    anotacoes TEXT DEFAULT '',
    historico TEXT DEFAULT '[]',
    criadoEm INTEGER NOT NULL,
    atribuidoEm INTEGER,
    FOREIGN KEY (companyId) REFERENCES companies(id),
    FOREIGN KEY (vinculoId) REFERENCES vinculos_campanhas(id),
    FOREIGN KEY (leadId) REFERENCES leads(id)
  );
  CREATE INDEX IF NOT EXISTS idx_transf_dest ON transferencias_oportunidade(campanhaDestinoId, status);
  CREATE INDEX IF NOT EXISTS idx_transf_seller ON transferencias_oportunidade(sellerDestinoId);
`);

// ── Remunerações geradas por eventos ───────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS remuneracoes (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    campaignId TEXT NOT NULL,
    formaGanhoId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    eventoComercialId TEXT DEFAULT '',
    leadId TEXT DEFAULT '',
    tipo TEXT DEFAULT 'fixo',
    valor REAL DEFAULT 0,
    moeda TEXT DEFAULT 'BRL',
    status TEXT DEFAULT 'pendente',
    chaveUnicidade TEXT NOT NULL,
    aprovadoPor TEXT DEFAULT '',
    aprovadoEm INTEGER,
    pagoEm INTEGER,
    estornado INTEGER DEFAULT 0,
    motivoEstorno TEXT DEFAULT '',
    versaoRegra INTEGER DEFAULT 1,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id),
    FOREIGN KEY (campaignId) REFERENCES campaigns(id),
    FOREIGN KEY (formaGanhoId) REFERENCES formas_ganho(id),
    FOREIGN KEY (sellerId) REFERENCES sellers(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_remun_uniq ON remuneracoes(chaveUnicidade);
  CREATE INDEX IF NOT EXISTS idx_remun_camp ON remuneracoes(campaignId, sellerId, status);
  CREATE INDEX IF NOT EXISTS idx_remun_seller ON remuneracoes(sellerId, status);
`);

export default db;
export { uid, agora };

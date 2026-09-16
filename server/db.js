import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Em produção aponte DB_PATH para um volume persistente (ex.: /data/data.db).
// Sem volume, o banco vive no container e é apagado a cada deploy.
const DB_PATH = process.env.DB_PATH || join(__dirname, "data.db");
const db = new Database(DB_PATH);
console.log(`[db] ${DB_PATH}`);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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
    nota INTEGER DEFAULT 0,
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
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
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
adicionarColuna("sellers", "titulo", "TEXT DEFAULT ''");
adicionarColuna("sellers", "bio", "TEXT DEFAULT ''");
adicionarColuna("sellers", "segmentos", "TEXT DEFAULT '[]'");
adicionarColuna("sellers", "modalidades", "TEXT DEFAULT '[]'");
adicionarColuna("sellers", "regioes", "TEXT DEFAULT '[]'");
adicionarColuna("sellers", "skills", "TEXT DEFAULT '[]'");
adicionarColuna("sellers", "disponibilidade", "TEXT DEFAULT ''");
adicionarColuna("submissions", "leadId", "TEXT");
adicionarColuna("submissions", "idempotencyKey", "TEXT");
adicionarColuna("submissions", "proofHash", "TEXT DEFAULT ''");
adicionarColuna("submissions", "auditVersion", "TEXT DEFAULT ''");
adicionarColuna("submissions", "riskLevel", "TEXT DEFAULT 'medio'");
adicionarColuna("submissions", "reviewRequired", "INTEGER DEFAULT 1");
adicionarColuna("submissions", "reviewedBy", "TEXT");
adicionarColuna("submissions", "reviewedEm", "INTEGER");
adicionarColuna("submissions", "reviewChecklist", "TEXT DEFAULT '[]'");
adicionarColuna("lead_events", "submissionId", "TEXT");
adicionarColuna("course_progress", "quizScore", "INTEGER");
adicionarColuna("course_progress", "quizAnswers", "TEXT DEFAULT '[]'");
adicionarColuna("applications", "criterios", "TEXT DEFAULT '[]'");
adicionarColuna("applications", "quizScore", "INTEGER");
adicionarColuna("assistant_history", "contexto", "TEXT DEFAULT ''");
adicionarColuna("assistant_history", "status", "TEXT DEFAULT 'proposto'");
adicionarColuna("assistant_history", "acao", "TEXT DEFAULT 'registrar_analise'");
adicionarColuna("assistant_history", "confirmadoEm", "INTEGER");
adicionarColuna("subscriptions", "valorOriginal", "REAL DEFAULT 0");
adicionarColuna("subscriptions", "desconto", "REAL DEFAULT 0");
adicionarColuna("subscriptions", "voucherId", "TEXT");
adicionarColuna("subscriptions", "paymentId", "TEXT");
adicionarColuna("subscriptions", "invoiceUrl", "TEXT");

// A plataforma deixou de ser portão de entrada: concluir a avaliação libera o
// perfil na hora, e quem decide a entrada numa campanha é a empresa.
//
// Quem já tinha respondido e estava parado esperando análise é liberado junto.
// Sem isso, essas pessoas ficariam presas para sempre numa fila que ninguém
// mais atende — o código que as tirava de lá deixou de existir.
//
// 'recusado' não é tocado: foi decisão humana sobre um caso concreto, e
// reverter em massa apagaria esse julgamento.
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
  CREATE INDEX IF NOT EXISTS idx_submission_evidence_submission ON submission_evidence(submissionId);
  CREATE INDEX IF NOT EXISTS idx_submission_events_submission ON submission_events(submissionId, sequencia);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_events_submission
    ON lead_events(submissionId) WHERE submissionId IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_financial_ledger_company ON financial_ledger(companyId, criadoEm);
  CREATE INDEX IF NOT EXISTS idx_financial_ledger_seller ON financial_ledger(sellerId, criadoEm);
  CREATE INDEX IF NOT EXISTS idx_knowledge_company ON knowledge_documents(companyId, status, atualizadoEm);
  CREATE INDEX IF NOT EXISTS idx_assistant_company ON assistant_history(companyId, criadoEm);
  CREATE INDEX IF NOT EXISTS idx_partnership_seller ON partnership_requests(sellerId, status, criadoEm);
  CREATE INDEX IF NOT EXISTS idx_voucher_redemptions ON voucher_redemptions(voucherId, companyId, status);
  CREATE INDEX IF NOT EXISTS idx_company_reports ON company_reports(companyId, criadoEm);
`);

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

export default db;
export { uid, agora };

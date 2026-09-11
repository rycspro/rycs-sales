-- PostgreSQL migration: initial schema
-- Run when migrating from SQLite to PostgreSQL

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  role TEXT NOT NULL,
  "entityId" TEXT,
  "resetToken" TEXT,
  "resetExpira" BIGINT,
  "aceitouTermos" BOOLEAN DEFAULT FALSE,
  "criadoEm" BIGINT NOT NULL
);

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
  "perfilComercial" TEXT DEFAULT '{}',
  "scoreTriagem" REAL DEFAULT 0,
  "notaTriagem" TEXT DEFAULT '',
  "decididoPor" TEXT,
  "decididoEm" BIGINT,
  "criadoEm" BIGINT NOT NULL
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
  "totalAportado" REAL DEFAULT 0,
  "criadoEm" BIGINT NOT NULL,
  comissoes TEXT DEFAULT '{}',
  curso TEXT DEFAULT '[]',
  qualificacao TEXT DEFAULT '{}',
  aportes TEXT DEFAULT '[]'
  ,razaoSocial TEXT DEFAULT ''
  ,documento TEXT DEFAULT ''
  ,endereco TEXT DEFAULT ''
  ,segmento TEXT DEFAULT ''
  ,regiao TEXT DEFAULT ''
  ,diferenciais TEXT DEFAULT ''
  ,objecoes TEXT DEFAULT ''
  ,representanteLegal TEXT DEFAULT ''
  ,contatoFinanceiro TEXT DEFAULT ''
  ,contatoComercial TEXT DEFAULT ''
  ,materiais TEXT DEFAULT '[]'
  ,statusCadastro TEXT DEFAULT 'rascunho'
  ,saldoReservado REAL DEFAULT 0
  ,assinatura TEXT DEFAULT 'free'
  ,qualificacao TEXT DEFAULT '{}'
  ,"asaasCustomerId" TEXT
  ,"aprovadoPor" TEXT
  ,"aprovadoEm" BIGINT
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id),
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
  "criteriosAprovacao" TEXT DEFAULT '{}',
  "prazoHoras" INTEGER DEFAULT 48,
  "limitePorProfissional" INTEGER DEFAULT 0,
  "aceitaLeadProprio" BOOLEAN DEFAULT FALSE,
  "exigeCertificacao" BOOLEAN DEFAULT FALSE,
  "criadoEm" BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  "sellerId" TEXT NOT NULL REFERENCES sellers(id),
  "companyId" TEXT NOT NULL REFERENCES companies(id),
  status TEXT DEFAULT 'pendente',
  criterios TEXT DEFAULT '[]',
  "quizScore" INTEGER,
  PRIMARY KEY ("sellerId", "companyId")
);

CREATE TABLE IF NOT EXISTS course_progress (
  "sellerId" TEXT NOT NULL REFERENCES sellers(id),
  "companyId" TEXT NOT NULL REFERENCES companies(id),
  "moduleIds" TEXT DEFAULT '[]',
  "quizScore" INTEGER,
  "quizAnswers" TEXT DEFAULT '[]',
  PRIMARY KEY ("sellerId", "companyId")
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  "sellerId" TEXT NOT NULL REFERENCES sellers(id),
  "companyId" TEXT NOT NULL REFERENCES companies(id),
  "campaignId" TEXT REFERENCES campaigns(id),
  tipo TEXT NOT NULL,
  valor REAL DEFAULT 0,
  liquido REAL,
  prova TEXT DEFAULT '{}',
  status TEXT DEFAULT 'analisando',
  confianca INTEGER,
  motivo TEXT,
  fonte TEXT,
  "criadoEm" BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  "sellerId" TEXT NOT NULL REFERENCES sellers(id),
  valor REAL NOT NULL,
  pix TEXT NOT NULL,
  status TEXT DEFAULT 'solicitado',
  "asaasId" TEXT,
  "criadoEm" BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id),
  "sellerId" TEXT NOT NULL REFERENCES sellers(id),
  de TEXT NOT NULL,
  texto TEXT NOT NULL,
  ts BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id),
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  corpo TEXT DEFAULT '',
  lida INTEGER DEFAULT 0,
  "criadoEm" BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS score_dimensions (
  "sellerId" TEXT NOT NULL REFERENCES sellers(id),
  dimension TEXT NOT NULL,
  valor INTEGER DEFAULT 0,
  role TEXT DEFAULT 'geral',
  "atualizadoEm" BIGINT NOT NULL,
  PRIMARY KEY ("sellerId", dimension, role)
);

CREATE INDEX IF NOT EXISTS idx_submissions_seller ON submissions("sellerId");
CREATE INDEX IF NOT EXISTS idx_submissions_company ON submissions("companyId");
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications("userId");
CREATE INDEX IF NOT EXISTS idx_withdrawals_seller ON withdrawals("sellerId");
CREATE INDEX IF NOT EXISTS idx_campaigns_company ON campaigns("companyId");

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  "sellerId" TEXT NOT NULL REFERENCES sellers(id),
  tentativa INTEGER NOT NULL,
  score REAL NOT NULL,
  status TEXT NOT NULL,
  categorias TEXT DEFAULT '{}',
  perfil TEXT DEFAULT '{}',
  "criadoEm" BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessment_answers (
  id TEXT PRIMARY KEY,
  "assessmentId" TEXT NOT NULL REFERENCES assessments(id),
  "sellerId" TEXT NOT NULL REFERENCES sellers(id),
  "questionId" TEXT NOT NULL,
  resposta TEXT DEFAULT '',
  pontos REAL DEFAULT 0,
  "criadoEm" BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessments_seller ON assessments("sellerId", "criadoEm");
CREATE INDEX IF NOT EXISTS idx_assessment_answers_assessment ON assessment_answers("assessmentId");

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY, "companyId" TEXT NOT NULL REFERENCES companies(id), "campaignId" TEXT,
  titulo TEXT NOT NULL, categoria TEXT DEFAULT 'geral', departamento TEXT DEFAULT 'comercial',
  "nivelAcesso" TEXT DEFAULT 'empresa', idioma TEXT DEFAULT 'pt-BR', versao INTEGER DEFAULT 1,
  origem TEXT DEFAULT 'texto', responsavel TEXT DEFAULT '', "validadeEm" BIGINT,
  status TEXT DEFAULT 'aguardando', conteudo TEXT DEFAULT '', erro TEXT DEFAULT '',
  "atualizadoEm" BIGINT NOT NULL, "criadoEm" BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS knowledge_history (
  id TEXT PRIMARY KEY, "documentId" TEXT NOT NULL, "companyId" TEXT NOT NULL,
  acao TEXT NOT NULL, versao INTEGER NOT NULL, "atorId" TEXT, "criadoEm" BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS assistant_history (
  id TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  pergunta TEXT NOT NULL, resposta TEXT NOT NULL, fontes TEXT DEFAULT '[]', "criadoEm" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_company ON knowledge_documents("companyId", status, "atualizadoEm");
CREATE INDEX IF NOT EXISTS idx_assistant_company ON assistant_history("companyId", "criadoEm");

CREATE TABLE IF NOT EXISTS financial_ledger (
  id TEXT PRIMARY KEY,
  "companyId" TEXT,
  "sellerId" TEXT,
  "submissionId" TEXT,
  tipo TEXT NOT NULL,
  valor REAL NOT NULL,
  "saldoEmpresa" REAL,
  "reservadoEmpresa" REAL,
  "saldoProfissional" REAL,
  "idempotencyKey" TEXT,
  dados TEXT DEFAULT '{}',
  "criadoEm" BIGINT NOT NULL,
  UNIQUE (tipo, "idempotencyKey")
);

CREATE INDEX IF NOT EXISTS idx_financial_ledger_company ON financial_ledger("companyId", "criadoEm");
CREATE INDEX IF NOT EXISTS idx_financial_ledger_seller ON financial_ledger("sellerId", "criadoEm");

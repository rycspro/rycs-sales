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
  aportes TEXT DEFAULT '[]'
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
  "criadoEm" BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  "sellerId" TEXT NOT NULL REFERENCES sellers(id),
  "companyId" TEXT NOT NULL REFERENCES companies(id),
  status TEXT DEFAULT 'pendente',
  PRIMARY KEY ("sellerId", "companyId")
);

CREATE TABLE IF NOT EXISTS course_progress (
  "sellerId" TEXT NOT NULL REFERENCES sellers(id),
  "companyId" TEXT NOT NULL REFERENCES companies(id),
  "moduleIds" TEXT DEFAULT '[]',
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

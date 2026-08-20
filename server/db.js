import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
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
    tipo TEXT NOT NULL,
    valor REAL DEFAULT 0,
    liquido REAL,
    prova TEXT DEFAULT '{}',
    arquivos TEXT DEFAULT '[]',
    status TEXT DEFAULT 'analisando',
    confianca INTEGER,
    motivo TEXT,
    fonte TEXT,
    criadoEm INTEGER NOT NULL,
    FOREIGN KEY (sellerId) REFERENCES sellers(id),
    FOREIGN KEY (companyId) REFERENCES companies(id)
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
`);

const uid = () => Math.random().toString(36).slice(2, 9);
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

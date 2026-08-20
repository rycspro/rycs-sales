import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, "data.db"));

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

function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) as n FROM sellers").get().n;
  if (count > 0) return;

  const e1 = uid(), e2 = uid(), e3 = uid();
  const s1 = uid(), s2 = uid(), s3 = uid();
  const now = agora();

  const cursoPadrao = (items) =>
    items.map((t) => ({ id: uid(), titulo: t[0], min: t[1], conteudo: t[2] }));

  const insertSeller = db.prepare(`
    INSERT INTO sellers (id, nome, email, whats, cidade, perfil, experiencia, status, nota, nivel, pix, disponivel, pendente, sacado, respostas, video, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSeller.run(s1, "Rafa Lima", "rafa@email.com", "(11) 9 8123-4477", "Guarulhos, SP", "sdr", "6 meses em telecom", "aprovado", 78, "starter", "rafa@email.com", 44, 0, 132, "[]", "", now - 86400000 * 9);
  insertSeller.run(s2, "Bruna Sato", "bruna@email.com", "(21) 9 9670-1188", "Niterói, RJ", "closer", "2 anos em software B2B", "triagem", 88, "starter", "", 0, 0, 0, JSON.stringify(["Levanto a dor antes do preço", "Ligo no mesmo dia", "Peço o próximo passo na hora"]), "", now - 3600000 * 5);
  insertSeller.run(s3, "Diego Moura", "diego@email.com", "(31) 9 9004-2210", "Belo Horizonte, MG", "sem-exp", "Primeira vez em vendas", "triagem", 41, "starter", "", 0, 0, 0, JSON.stringify(["Mando proposta por e-mail", "Espero o cliente responder", "Falo o preço logo no começo"]), "", now - 3600000 * 30);

  const insertCompany = db.prepare(`
    INSERT INTO companies (id, nome, produto, ticket, icp, plano, destaque, saldo, vagas, cor, totalAportado, criadoEm, comissoes, curso, aportes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCompany.run(e1, "Nexo CRM", "CRM para distribuidoras", "R$ 890/mês", "Distribuidoras de 10 a 80 funcionários", "saldo", 1, 4200, 12, "#2563EB", 9800, now - 86400000 * 41,
    JSON.stringify({ agendamento: 5, venda: 250, realizada: 8, ligacao: 10, follow: 0.5 }),
    JSON.stringify(cursoPadrao([
      ["O que a Nexo vende", 4, "CRM com rota de vendedor externo e catálogo. Substitui planilha e WhatsApp solto. Implanta em 7 dias."],
      ["Quem é o cliente certo", 5, "Distribuidora com equipe de rua. Dor: pedido perdido, vendedor sem histórico, dono sem visão do funil."],
      ["Abordagem que funciona", 6, "Abra pelo prejuízo: 'quantos pedidos você perdeu esse mês por falta de follow?'. Nunca abra por funcionalidade."],
      ["Objeções e o que responder", 6, "'Já uso planilha' → mostre custo do retrabalho. 'Tá caro' → compare com um pedido médio perdido."],
    ])),
    JSON.stringify([
      { valor: 5000, ts: now - 86400000 * 41 }, { valor: 3000, ts: now - 86400000 * 24 }, { valor: 1800, ts: now - 86400000 * 8 },
    ])
  );

  insertCompany.run(e2, "SolarUp Energia", "Energia solar para comércio", "R$ 38.000", "Comércios com conta de luz acima de R$ 1.500", "destaque", 1, 1560, 8, "#B45309", 6000, now - 86400000 * 19,
    JSON.stringify({ agendamento: 12, venda: 900, realizada: 20, ligacao: 6, follow: 0.5 }),
    JSON.stringify(cursoPadrao([
      ["Como funciona o sistema", 5, "Placa, inversor e homologação na concessionária. Payback médio de 38 meses."],
      ["Conta de luz é o filtro", 4, "Sem conta acima de R$ 1.500 não há economia relevante. Peça a conta antes de agendar."],
      ["Agendamento com o dono", 5, "Só o dono decide. Se falar com o gerente, o agendamento não conta."],
    ])),
    JSON.stringify([
      { valor: 4000, ts: now - 86400000 * 19 }, { valor: 2000, ts: now - 86400000 * 6 },
    ])
  );

  insertCompany.run(e3, "Ativa Contábil", "Contabilidade para prestadores", "R$ 320/mês", "Autônomos abrindo CNPJ e MEIs migrando para ME", "saldo", 0, 700, 20, "#3730A1", 3400, now - 86400000 * 63,
    JSON.stringify({ agendamento: 4, venda: 120, realizada: 6, ligacao: 4, follow: 0.5 }),
    JSON.stringify(cursoPadrao([
      ["Abertura de CNPJ na prática", 4, "Prazo de 5 dias úteis, taxa inclusa no primeiro mês. Diferença entre MEI, ME e Simples."],
      ["Gatilho de troca de contador", 5, "Atraso em guia, multa e contador que some. É aí que a conversa abre."],
    ])),
    JSON.stringify([
      { valor: 2000, ts: now - 86400000 * 63 }, { valor: 1400, ts: now - 86400000 * 30 },
    ])
  );

  db.prepare("INSERT INTO applications (sellerId, companyId, status) VALUES (?, ?, ?)").run(s1, e1, "aprovado");
  db.prepare("INSERT INTO course_progress (sellerId, companyId, moduleIds) VALUES (?, ?, ?)").run(s1, e1, '"todos"');

  const insertSub = db.prepare(`
    INSERT INTO submissions (id, sellerId, companyId, tipo, valor, liquido, prova, status, confianca, motivo, fonte, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSub.run(uid(), s1, e1, "agendamento", 5, null,
    JSON.stringify({ cliente: "Marcos — Distribuidora Vila Nova", telefone: "(11) 9 9812-3344", datahora: "20/08 às 10h", video: "https://drive.link/video-01" }),
    "revisao", 58, "Primeira ação deste vendedor com esta empresa — confirme com o cliente antes de liberar.", "ia", now - 3600000 * 3
  );
  insertSub.run(uid(), s1, e1, "ligacao", 10, null,
    JSON.stringify({ cliente: "Sônia — Atacado Bela Vista", telefone: "(11) 9 9711-2200", duracao: "7", video: "https://drive.link/video-88" }),
    "ia_aprovado", 91, "Dados específicos e coerentes, vídeo anexado. Consistente com a regra.", "ia", now - 3600000 * 20
  );
  insertSub.run(uid(), s1, e1, "follow", 0.5, 0.44,
    JSON.stringify({ cliente: "Marcos — Distribuidora Vila Nova", telefone: "(11) 9 9812-3344", canal: "WhatsApp", video: "https://drive.link/video-02" }),
    "liberado", 88, "Aprovado automaticamente pela IA.", "ia", now - 86400000 * 2
  );

  db.prepare("INSERT INTO messages (id, companyId, sellerId, de, texto, ts) VALUES (?, ?, ?, ?, ?, ?)").run(
    uid(), e1, s1, "empresa", "Rafa, o agendamento das 10h da Vila Nova o cliente confirmou por aqui. Segue firme.", now - 3600000 * 2
  );

  // Seed demo campaigns
  const c1 = uid();
  db.prepare(`
    INSERT INTO campaigns (id, companyId, titulo, descricao, produto, publico, status, vagas, comissoes, treinamento, requisitos, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(c1, e1, "Prospecção Distribuidoras SP",
    "Prospectar distribuidoras na Grande SP para demonstração do CRM Nexo",
    "CRM para distribuidoras", "Distribuidoras de 10 a 80 funcionários na Grande SP",
    "ativa", 5,
    JSON.stringify({ ligacao: 10, agendamento: 5, realizada: 8, venda: 250 }),
    JSON.stringify([{ id: uid(), titulo: "Pitch de abertura", conteudo: "Abra pelo prejuízo do pedido perdido" }]),
    "Experiência em prospecção B2B, mínimo score 60",
    now - 86400000 * 5
  );

  const hash = bcrypt.hashSync("123456", 10);
  const insertUser = db.prepare("INSERT INTO users (id, email, senha, role, entityId, aceitouTermos, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)");
  insertUser.run(uid(), "rafa@email.com", hash, "vendedor", s1, 1, now);
  insertUser.run(uid(), "nexo@email.com", hash, "empresa", e1, 1, now);
  insertUser.run(uid(), "admin@email.com", hash, "admin", null, 1, now);

  // Seed score dimensions for Rafa
  const insertScore = db.prepare("INSERT INTO score_dimensions (sellerId, dimension, valor, role, atualizadoEm) VALUES (?, ?, ?, ?, ?)");
  insertScore.run(s1, "performance", 82, "sdr", now);
  insertScore.run(s1, "conhecimento", 70, "sdr", now);
  insertScore.run(s1, "comunicacao", 85, "sdr", now);
  insertScore.run(s1, "confiabilidade", 78, "sdr", now);
  insertScore.run(s1, "conversao", 65, "sdr", now);
  insertScore.run(s1, "qualidade", 80, "sdr", now);
  insertScore.run(s1, "consistencia", 75, "sdr", now);

  console.log("Banco populado com dados semente.");
}

seedIfEmpty();

export default db;
export { uid, agora };

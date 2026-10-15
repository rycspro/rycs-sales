import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import db from "./db.js";
import { authMiddleware } from "./middleware/auth.js";
import { ACOES, CAMPOS, SISTEMA_AUDITOR } from "../shared/acoes.js";
import authRoutes from "./routes/auth.js";
import stateRoutes from "./routes/state.js";
import sellersRoutes from "./routes/sellers.js";
import companiesRoutes from "./routes/companies.js";
import applicationsRoutes from "./routes/applications.js";
import submissionsRoutes from "./routes/submissions.js";
import withdrawalsRoutes from "./routes/withdrawals.js";
import messagesRoutes from "./routes/messages.js";
import courseRoutes from "./routes/course.js";
import notificationsRoutes from "./routes/notifications.js";
import campaignsRoutes from "./routes/campaigns.js";
import uploadsRoutes from "./routes/uploads.js";
import paymentRoutes from "./routes/payments.js";
import academyRoutes from "./routes/academy.js";
import subscriptionRoutes from "./routes/subscriptions.js";
import referralRoutes from "./routes/referrals.js";
import depositRoutes from "./routes/deposits.js";
import leadRoutes from "./routes/leads.js";
import triagemRoutes from "./routes/triagem.js";
import knowledgeRoutes from "./routes/knowledge.js";
import contactsRoutes from "./routes/contacts.js";
import reportRoutes from "./routes/reports.js";
import auditRoutes from "./routes/audit.js";
import courseRoutes2 from "./routes/courses.js";
import brainRoutes from "./routes/brain.js";
import emailAdminRoutes from "./routes/emailAdmin.js";
import billingRoutes from "./routes/billing.js";
import onboardingRoutes, { onboardingPublico } from "./routes/onboarding.js";
import { iniciarWorkerIA } from "./services/iaOnboarding.js";
import onboardingProRoutes from "./routes/onboardingProfissional.js";
import jarvasRoutes from "./routes/jarvas.js";
import { semearCatalogo } from "./services/academy.js";
import { garantirDadosCriticosProfissionalBeta, isBetaEnvironment, resetBetaEnvironment } from "./services/betaEnvironment.js";
// O registro dos adapters acontece no import: cada arquivo se declara na
// camada de providers. Trocar de fornecedor é trocar esta linha.
import "./services/audit/providers/anthropic.js";
import { semearPoliticasPadrao, iniciarWorker, capacidadesDisponiveis } from "./services/audit/index.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.get("/api/health", (_, res) => res.json({ status: "ok" }));
app.get("/api/environment", (_, res) => res.json({ environment: process.env.RYCS_ENVIRONMENT === "beta" ? "beta" : "production" }));
const isProd = process.env.NODE_ENV === "production";

// A ausência da chave não pode derrubar todo o backend: o motor de auditoria
// possui fallback local e a rota dedicada informa indisponibilidade.
const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// --- Security ---
app.use(helmet({ contentSecurityPolicy: false }));
app.set("trust proxy", 1);

const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";

// Origens permitidas.
//
// O produto vive em mais de um host: a landing em rycs.pro e www.rycs.pro, o
// app em app.rycs.pro. Permitir só o FRONTEND_URL derrubava todo mundo que
// chegava pela landing — e o navegador manda Origin também em POST de mesma
// origem, então a quebra atingia login, não só chamada entre domínios.
//
// CORS_ORIGINS aceita lista separada por vírgula para acrescentar outras.
function origensPermitidas() {
  const lista = new Set([FRONTEND]);

  for (const extra of String(process.env.CORS_ORIGINS || "").split(",")) {
    const limpo = extra.trim();
    if (limpo) lista.add(limpo);
  }

  // A família do domínio: apex, www e app são o mesmo produto. Derivar aqui
  // evita depender de alguém lembrar de listar as três em toda instalação.
  try {
    const { protocol, hostname } = new URL(FRONTEND);
    const raiz = hostname.replace(/^(www|app)\./, "");
    if (raiz.includes(".")) {
      for (const h of [raiz, `www.${raiz}`, `app.${raiz}`]) lista.add(`${protocol}//${h}`);
    }
  } catch { /* FRONTEND_URL malformada: fica só com o valor bruto */ }

  return lista;
}

const PERMITIDAS = origensPermitidas();
console.log(`[cors] origens permitidas: ${[...PERMITIDAS].join(", ")}`);

app.use(cors({
  origin(origin, callback) {
    // Sem Origin é requisição que não veio de navegador — curl, webhook,
    // healthcheck. Não há o que restringir.
    if (!origin) return callback(null, true);
    if (PERMITIDAS.has(origin)) return callback(null, true);
    if (!isProd && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);

    // Recusa NÃO é erro de servidor. Devolver `false` omite o cabeçalho e
    // deixa o navegador aplicar a política, que é o comportamento correto.
    // Lançar transformava uma decisão de política em 500 — e era isso que
    // deixava o app fora do ar para quem vinha da landing.
    console.warn(`[cors] origem recusada: ${String(origin).slice(0, 120)}`);
    callback(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: "15mb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Muitas tentativas. Aguarde 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: "Limite de requisições atingido." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/admin/login", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/onboarding/convites", authLimiter);
app.use("/api", apiLimiter);

// --- Routes ---
app.use("/api", authRoutes);
// Antes das rotas protegidas: o gateway chama o webhook sem cookie, e o
// authMiddleware registrado abaixo responderia 401 antes de chegar aqui.
app.use("/api", paymentRoutes);
// Consulta do convite de onboarding: quem abre o link ainda não tem conta.
app.use("/api", onboardingPublico);

app.use("/api", authMiddleware, stateRoutes);
app.use("/api", authMiddleware, sellersRoutes);
app.use("/api", authMiddleware, companiesRoutes);
app.use("/api", authMiddleware, applicationsRoutes);
app.use("/api", authMiddleware, submissionsRoutes);
app.use("/api", authMiddleware, withdrawalsRoutes);
app.use("/api", authMiddleware, messagesRoutes);
app.use("/api", authMiddleware, courseRoutes);
app.use("/api", authMiddleware, notificationsRoutes);
app.use("/api", authMiddleware, campaignsRoutes);
app.use("/api", authMiddleware, uploadsRoutes);
app.use("/api", authMiddleware, academyRoutes);
app.use("/api", authMiddleware, subscriptionRoutes);
app.use("/api", authMiddleware, referralRoutes);
app.use("/api", authMiddleware, depositRoutes);
app.use("/api", authMiddleware, leadRoutes);
app.use("/api", authMiddleware, triagemRoutes);
app.use("/api", authMiddleware, knowledgeRoutes);
app.use("/api", authMiddleware, contactsRoutes);
app.use("/api", authMiddleware, reportRoutes);
app.use("/api", authMiddleware, auditRoutes);
app.use("/api", authMiddleware, courseRoutes2);
app.use("/api", authMiddleware, brainRoutes);
app.use("/api", authMiddleware, emailAdminRoutes);
app.use("/api", authMiddleware, billingRoutes);
app.use("/api", authMiddleware, onboardingRoutes);
app.use("/api", authMiddleware, onboardingProRoutes);
app.use("/api", authMiddleware, jarvasRoutes);

// --- AI Audit ---
app.post("/api/analisar", authMiddleware, async (req, res) => {
  const { tipo, prova } = req.body;

  if (!tipo || !prova || !ACOES[tipo]) {
    return res.status(400).json({ error: "tipo e prova são obrigatórios" });
  }
  if (!client) return res.status(503).json({ error: "Auditoria por IA não configurada neste ambiente" });

  const acao = ACOES[tipo];
  const linhas = acao.prova
    .map((c) => `${CAMPOS[c]?.label || c}: ${prova[c] || "(vazio)"}`)
    .join("\n");
  const mensagem = `Ação: ${acao.nome}\nRegra: ${acao.regra}\n\nDados enviados pelo vendedor:\n${linhas}`;

  try {
    const resposta = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: SISTEMA_AUDITOR,
      messages: [{ role: "user", content: mensagem }],
    });

    const texto = resposta.content
      .map((b) => b.text || "")
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    const j = JSON.parse(texto);
    const veredito = ["aprovado", "revisao", "recusado"].includes(j.veredito)
      ? j.veredito
      : "revisao";
    const confianca = Math.max(0, Math.min(100, Math.round(Number(j.confianca) || 50)));
    const motivo = String(j.motivo || "Analisado pela IA.").slice(0, 200);

    res.json({ veredito, confianca, motivo, fonte: "ia" });
  } catch (err) {
    console.error("Erro na API Anthropic:", err.message);
    res.status(502).json({ error: "Falha ao consultar a IA", detail: err.message });
  }
});

// --- Serve frontend in production ---
if (isProd) {
  const { dirname, join } = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  app.use(express.static(join(__dirname, "../dist")));
  app.get("*", (req, res) => {
    // Não devolva o HTML para assets inexistentes: o browser recusaria o
    // módulo por MIME type e a página ficaria em branco. 404 é mais honesto.
    if (req.path.startsWith("/assets/")) return res.status(404).end();
    res.sendFile(join(__dirname, "../dist/index.html"));
  });
}

// RYCS Audit Engine: políticas padrão no primeiro boot e worker da fila.
// O worker vive no mesmo processo — adequado ao volume atual e sem adicionar
// Redis a um MVP. O contrato da fila não muda quando isso virar serviço à
// parte.
// Primeiro boot do serviço Beta recebe somente a massa sintética. O marcador
// mora no mesmo volume isolado, portanto nunca executa em bancos já usados.
if (isBetaEnvironment() && !db.prepare("SELECT 1 FROM beta_environment WHERE id = 1").get()) resetBetaEnvironment();
garantirDadosCriticosProfissionalBeta();
semearPoliticasPadrao();
semearCatalogo();
const capacidades = capacidadesDisponiveis();
console.log("[audit] capacidades:", Object.entries(capacidades)
  .map(([c, v]) => `${c}=${v.disponivel ? v.provider : "não configurado"}`).join(" "));

// Rede de segurança: erro não tratado vira JSON com identificador, nunca uma
// página de stack trace. O CORS que derrubava o app aparecia como um 500 mudo;
// com isto, qualquer falha futura deixa um rastro procurável no log.
app.use((err, req, res, _next) => {
  const ref = Math.random().toString(36).slice(2, 10);
  console.error(`[erro ${ref}] ${req.method} ${req.path}:`, err?.message || err);
  if (res.headersSent) return;
  res.status(err?.status || 500).json({
    error: "Falha ao processar a requisição.",
    referencia: ref,
  });
});

app.listen(PORT, () => {
  console.log(`RYCS API rodando em http://localhost:${PORT} [${isProd ? "PRODUÇÃO" : "DEV"}]`);
  iniciarWorker();
  iniciarWorkerIA();
});

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

const app = express();
const PORT = process.env.PORT || 3001;

app.get("/api/health", (_, res) => res.json({ status: "ok" }));
const isProd = process.env.NODE_ENV === "production";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- Security ---
app.use(helmet({ contentSecurityPolicy: false }));
app.set("trust proxy", 1);

const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({
  origin: isProd ? [FRONTEND] : ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true,
}));

app.use(express.json({ limit: "5mb" }));
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
app.use("/api", apiLimiter);

// --- Routes ---
app.use("/api", authRoutes);
// Antes das rotas protegidas: o gateway chama o webhook sem cookie, e o
// authMiddleware registrado abaixo responderia 401 antes de chegar aqui.
app.use("/api", paymentRoutes);

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

// --- AI Audit ---
app.post("/api/analisar", authMiddleware, async (req, res) => {
  const { tipo, prova } = req.body;

  if (!tipo || !prova || !ACOES[tipo]) {
    return res.status(400).json({ error: "tipo e prova são obrigatórios" });
  }

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

app.listen(PORT, () => {
  console.log(`RYCS API rodando em http://localhost:${PORT} [${isProd ? "PRODUÇÃO" : "DEV"}]`);
});

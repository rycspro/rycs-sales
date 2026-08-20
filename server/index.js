import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
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

const app = express();
const PORT = process.env.PORT || 3001;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"], credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Auth routes (login/register/logout/me) — public
app.use("/api", authRoutes);

// Protected routes — require login
app.use("/api", authMiddleware, stateRoutes);
app.use("/api", authMiddleware, sellersRoutes);
app.use("/api", authMiddleware, companiesRoutes);
app.use("/api", authMiddleware, applicationsRoutes);
app.use("/api", authMiddleware, submissionsRoutes);
app.use("/api", authMiddleware, withdrawalsRoutes);
app.use("/api", authMiddleware, messagesRoutes);
app.use("/api", authMiddleware, courseRoutes);

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

app.listen(PORT, () => {
  console.log(`Sales Machine API rodando em http://localhost:${PORT}`);
});

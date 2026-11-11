import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { empresaLiberada } from "../services/acessoEmpresa.js";

const router = Router();

router.get("/messages", (req, res) => {
  const { companyId, sellerId } = req.query;
  const { role, entityId } = req.user;

  if (role === "vendedor" && sellerId && entityId !== sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (role === "empresa" && companyId && entityId !== companyId)
    return res.status(403).json({ error: "Sem permissão" });

  // Sem parâmetros, a consulta antiga devolvia as mensagens da plataforma
  // inteira — as checagens acima só disparam quando os filtros são enviados.
  // Agora cada papel fica preso à própria conversa.
  let rows;
  if (role === "admin") {
    rows = companyId && sellerId
      ? db.prepare("SELECT * FROM messages WHERE companyId = ? AND sellerId = ? ORDER BY ts ASC").all(companyId, sellerId)
      : db.prepare("SELECT * FROM messages ORDER BY ts ASC").all();
  } else if (role === "vendedor") {
    rows = db.prepare("SELECT * FROM messages WHERE sellerId = ? ORDER BY ts ASC").all(entityId);
  } else if (role === "empresa") {
    rows = db.prepare("SELECT * FROM messages WHERE companyId = ? ORDER BY ts ASC").all(entityId);
  } else {
    rows = [];
  }
  res.json(rows);
});

router.post("/messages", (req, res) => {
  const { companyId, sellerId, texto, anexo } = req.body;
  const { role, entityId } = req.user;

  if (!texto?.trim() && !anexo) return res.status(400).json({ error: "Mensagem vazia" });
  if (!companyId || !sellerId) return res.status(400).json({ error: "companyId e sellerId são obrigatórios" });

  // A rota não verificava nada: qualquer usuário inseria mensagens em qualquer
  // conversa, assinando como quisesse. O remetente agora vem da sessão, nunca
  // do corpo — era o caminho para uma falsa mensagem "da empresa" pedindo Pix.
  if (role === "vendedor" && entityId !== sellerId)
    return res.status(403).json({ error: "Sem permissão" });
  if (role === "empresa" && entityId !== companyId)
    return res.status(403).json({ error: "Sem permissão" });
  // Conversar com profissionais exige plano ativo.
  if (role === "empresa" && !empresaLiberada(entityId))
    return res.status(402).json({ error: "Ative um plano para conversar com profissionais.", acao: "escolher-plano" });
  if (role === "vendedor") {
    const vinculo = db.prepare("SELECT 1 FROM applications WHERE sellerId = ? AND companyId = ? AND status = 'aprovado'").get(sellerId, companyId);
    if (!vinculo) return res.status(403).json({ error: "Conversa disponível apenas para vínculos aprovados" });
  }
  if (role === "empresa") {
    const prof = db.prepare("SELECT 1 FROM sellers WHERE id = ? AND status IN ('aprovado','parcial')").get(sellerId);
    if (!prof) return res.status(403).json({ error: "Profissional não encontrado ou inativo" });
  }

  const de = role === "empresa" ? "empresa" : role === "vendedor" ? "vendedor" : "plataforma";
  const id = uid();
  const textoFinal = String(texto || "").slice(0, 2000);
  const anexoFinal = anexo ? String(anexo).slice(0, 5000000) : "";
  db.prepare("INSERT INTO messages (id, companyId, sellerId, de, texto, ts, anexo) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, companyId, sellerId, de, textoFinal, agora(), anexoFinal);
  res.json({ id, de });
});

router.post("/messages/apagar", (req, res) => {
  const { sellerId, companyId } = req.body;
  const { role, entityId } = req.user;
  if (role !== "empresa" || entityId !== companyId) return res.status(403).json({ error: "Sem permissão" });
  if (!sellerId || !companyId) return res.status(400).json({ error: "sellerId e companyId obrigatórios" });
  db.prepare("DELETE FROM messages WHERE companyId = ? AND sellerId = ?").run(companyId, sellerId);
  res.json({ ok: true });
});

router.post("/messages/ler", (req, res) => {
  const { sellerId, companyId } = req.body;
  const { role, entityId } = req.user;
  if (role === "empresa" && entityId !== companyId) return res.status(403).json({ error: "Sem permissão" });
  if (role === "vendedor" && entityId !== sellerId) return res.status(403).json({ error: "Sem permissão" });
  db.prepare("UPDATE messages SET lida = 1 WHERE companyId = ? AND sellerId = ? AND de != ?")
    .run(companyId, sellerId, role === "empresa" ? "empresa" : "vendedor");
  res.json({ ok: true });
});

export default router;

import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { TRILHAS, trilhaDaFuncao, NOTA_APROVACAO, nivelDoSelo } from "../../shared/academy.js";

const router = Router();

// A trilha vai sem o gabarito: as respostas certas nunca saem do servidor.
function trilhaPublica(t) {
  return {
    funcao: t.funcao,
    titulo: t.titulo,
    resumo: t.resumo,
    modulos: t.modulos,
    totalQuestoes: t.prova.length,
    notaAprovacao: NOTA_APROVACAO,
    prova: t.prova.map((q, i) => ({ i, pergunta: q.pergunta, alternativas: q.alternativas })),
  };
}

router.get("/academy/trilhas", (req, res) => {
  res.json(Object.values(TRILHAS).map(trilhaPublica));
});

router.get("/academy/trilhas/:funcao", (req, res) => {
  const t = TRILHAS[req.params.funcao];
  if (!t) return res.status(404).json({ error: "Trilha não encontrada" });
  res.json(trilhaPublica(t));
});

// Estado do profissional: módulos vistos, certificações e tentativas.
router.get("/academy/meu-progresso", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.json({ progresso: [], certificacoes: [], tentativas: [] });

  res.json({
    progresso: db.prepare("SELECT * FROM academy_progress WHERE sellerId = ?").all(entityId)
      .map((p) => ({ ...p, modulosVistos: JSON.parse(p.modulosVistos || "[]") })),
    certificacoes: db.prepare("SELECT * FROM certifications WHERE sellerId = ?").all(entityId),
    tentativas: db.prepare("SELECT * FROM academy_attempts WHERE sellerId = ? ORDER BY criadoEm DESC LIMIT 20").all(entityId),
  });
});

router.patch("/academy/progresso", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });

  const { funcao, moduloIndex } = req.body;
  if (!TRILHAS[funcao]) return res.status(400).json({ error: "Trilha inválida" });

  const atual = db.prepare("SELECT modulosVistos FROM academy_progress WHERE sellerId = ? AND funcao = ?").get(entityId, funcao);
  const vistos = new Set(JSON.parse(atual?.modulosVistos || "[]"));
  vistos.add(Number(moduloIndex));
  const lista = JSON.stringify([...vistos].sort((a, b) => a - b));

  if (atual) {
    db.prepare("UPDATE academy_progress SET modulosVistos = ?, atualizadoEm = ? WHERE sellerId = ? AND funcao = ?")
      .run(lista, agora(), entityId, funcao);
  } else {
    db.prepare("INSERT INTO academy_progress (sellerId, funcao, modulosVistos, atualizadoEm) VALUES (?, ?, ?, ?)")
      .run(entityId, funcao, lista, agora());
  }
  res.json({ ok: true, modulosVistos: JSON.parse(lista) });
});

// Correção da prova. As respostas chegam como índices; a comparação com o
// gabarito acontece só aqui.
router.post("/academy/prova/:funcao", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais podem fazer a prova" });

  const trilha = TRILHAS[req.params.funcao];
  if (!trilha) return res.status(404).json({ error: "Trilha não encontrada" });

  const respostas = req.body?.respostas;
  if (!Array.isArray(respostas) || respostas.length !== trilha.prova.length)
    return res.status(400).json({ error: `Responda todas as ${trilha.prova.length} questões.` });

  const acertos = trilha.prova.reduce((n, q, i) => n + (Number(respostas[i]) === q.correta ? 1 : 0), 0);
  const total = trilha.prova.length;
  const percentual = Math.round((acertos / total) * 100);
  const aprovado = percentual >= NOTA_APROVACAO;

  const vendedor = db.prepare("SELECT nota FROM sellers WHERE id = ?").get(entityId);
  const aprovadas = db.prepare("SELECT COUNT(*) n FROM submissions WHERE sellerId = ? AND status = 'liberado'").get(entityId).n;
  const nivel = nivelDoSelo(aprovadas, vendedor?.nota || 0);

  db.transaction(() => {
    db.prepare(`INSERT INTO academy_attempts (id, sellerId, funcao, acertos, total, percentual, aprovado, criadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uid(), entityId, trilha.funcao, acertos, total, percentual, aprovado ? 1 : 0, agora());

    if (aprovado) {
      // Recertificar não rebaixa: mantém o melhor desempenho já obtido.
      const anterior = db.prepare("SELECT percentual FROM certifications WHERE sellerId = ? AND funcao = ?").get(entityId, trilha.funcao);
      const melhor = Math.max(percentual, anterior?.percentual || 0);
      db.prepare(`INSERT INTO certifications (sellerId, funcao, nivel, percentual, criadoEm)
                  VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT(sellerId, funcao) DO UPDATE SET nivel = excluded.nivel, percentual = ?`)
        .run(entityId, trilha.funcao, nivel, melhor, agora(), melhor);
    }
  })();

  if (aprovado) {
    const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(entityId);
    if (user) notificar(user.id, "academy", `Certificação ${trilha.titulo} conquistada!`, `Você acertou ${percentual}% e recebeu o selo.`);
  }

  // O gabarito só volta depois de responder, para a pessoa aprender com o erro.
  res.json({
    acertos, total, percentual, aprovado, nivel: aprovado ? nivel : null,
    correcao: trilha.prova.map((q, i) => ({
      i, correta: q.correta, acertou: Number(respostas[i]) === q.correta,
    })),
  });
});

export default router;

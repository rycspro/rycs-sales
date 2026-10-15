import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { notificar } from "./notifications.js";
import { calcular } from "../services/triagem.js";
import { perguntasPublicas, CATEGORIAS, FAIXAS, TOTAL_PERGUNTAS } from "../../shared/triagem.js";
import { montarDossie, narrativa, montarDossieDisc, narrativaDisc } from "../services/dossie.js";
import { emailStatusProfissional } from "../services/email.js";

const router = Router();

// Concluir a avaliação libera a conta na hora. A plataforma não é mais o
// portão: quem decide se um profissional entra é a EMPRESA, ao aprovar a
// candidatura dele numa campanha.
//
// A razão é de produto, não técnica. O portão da plataforma criava uma fila
// invisível: a pessoa se cadastrava, respondia 17 perguntas e ficava parada
// sem prazo nem motivo. Vendedor bom não espera — vai vender em outro lugar.
// E a decisão que importa sempre foi a da empresa, que conhece o próprio
// produto e o próprio funil.
//
// A avaliação continua: ela mede o perfil, sugere a função e alimenta o score
// que a empresa lê antes de aprovar. Ela informa, não bloqueia.
//
// A plataforma mantém o poder de intervir depois — a rota de decisão abaixo
// segue existindo para moderar quem já está dentro.
export const STATUS_LIBERADOS = ["aprovado", "parcial"];
export const DECISOES = {
  aprovado: "aprovado",
  parcial: "parcial",
  recusado: "recusado",
};

router.get("/triagem/perguntas", (req, res) => {
  if (req.user.role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });
  res.json({
    perguntas: perguntasPublicas(),
    categorias: CATEGORIAS,
    faixas: FAIXAS,
    total: TOTAL_PERGUNTAS,
  });
});

router.get("/triagem/minhas", (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais" });

  const tentativas = db.prepare(
    "SELECT id, tentativa, score, status, categorias, perfil, criadoEm FROM assessments WHERE sellerId = ? ORDER BY criadoEm DESC"
  ).all(entityId).map((a) => ({
    ...a,
    categorias: JSON.parse(a.categorias || "{}"),
    perfil: JSON.parse(a.perfil || "{}"),
  }));

  const vendedor = db.prepare("SELECT status, scoreTriagem, perfilComercial FROM sellers WHERE id = ?").get(entityId);

  res.json({
    tentativas,
    atual: tentativas[0] || null,
    statusConta: vendedor?.status || "triagem",
    emAnalise: vendedor?.status === "analise",
  });
});

router.post("/triagem", async (req, res) => {
  const { role, entityId } = req.user;
  if (role !== "vendedor") return res.status(403).json({ error: "Apenas profissionais fazem a triagem" });

  const respostas = req.body?.respostas;
  if (!respostas || typeof respostas !== "object")
    return res.status(400).json({ error: "Envie as respostas da avaliação" });

  // Não dá para pular etapas: todas as perguntas precisam vir respondidas.
  const publicas = perguntasPublicas();
  const faltando = publicas.filter((p) => {
    const r = respostas[p.id];
    if (p.tipo === "multipla") return !Array.isArray(r) || r.length === 0;
    if (p.tipo === "aberta") return !String(r || "").trim();
    return r === undefined || r === null || r === "";
  });
  if (faltando.length)
    return res.status(400).json({ error: `Faltam ${faltando.length} respostas.`, faltando: faltando.map((p) => p.id) });

  // O score é calculado aqui. Nada do que o cliente enviar altera o resultado
  // além das próprias respostas.
  const r = calcular(respostas);
  const anteriores = db.prepare("SELECT COUNT(*) n FROM assessments WHERE sellerId = ?").get(entityId).n;
  const assessmentId = uid();
  const ts = agora();

  db.transaction(() => {
    db.prepare(`INSERT INTO assessments (id, sellerId, tentativa, score, status, categorias, perfil, criadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(assessmentId, entityId, anteriores + 1, r.score, r.status,
           JSON.stringify(r.categorias), JSON.stringify(r.perfil), ts);

    // Toda resposta é guardada — sem isso não há como auditar uma nota depois.
    const ins = db.prepare(`INSERT INTO assessment_answers (id, assessmentId, sellerId, questionId, resposta, pontos, criadoEm)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const d of r.detalhe) {
      ins.run(uid(), assessmentId, entityId, d.id, JSON.stringify(respostas[d.id] ?? null), d.pontos, ts);
    }

    // Liberada na hora. O score fica registrado e vai junto para a empresa,
    // que é quem decide a entrada numa campanha.
    db.prepare("UPDATE sellers SET status = 'aprovado', scoreTriagem = ?, perfilComercial = ?, perfil = ? WHERE id = ?")
      .run(r.score, JSON.stringify(r.perfil), r.perfil.funcaoSugerida || "sdr", entityId);
  })();

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(entityId);
  if (user) {
    notificar(user.id, "triagem", "Perfil liberado",
      `Você fez ${r.score}%. Seu perfil já está ativo e as empresas podem ver você. ` +
      `Candidate-se às campanhas que combinam com o seu perfil — cada empresa aprova o próprio time.`);
  }
  const vendedor = db.prepare("SELECT nome, email FROM sellers WHERE id = ?").get(entityId);
  if (vendedor?.email) await emailStatusProfissional(vendedor.nome, vendedor.email, "aprovado");

  res.json({
    assessmentId,
    score: r.score,
    status: r.status,
    categorias: r.categorias,
    perfil: r.perfil,
    tentativa: anteriores + 1,
    statusConta: "aprovado",
    proximoPasso: "empresas",
  });
});

// Visão da plataforma: desempenho agregado e por categoria.
router.get("/triagem/painel", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });

  const todas = db.prepare("SELECT score, status, categorias FROM assessments").all();
  const porStatus = {};
  const somaCat = {};
  for (const a of todas) {
    porStatus[a.status] = (porStatus[a.status] || 0) + 1;
    const c = JSON.parse(a.categorias || "{}");
    for (const [k, v] of Object.entries(c)) somaCat[k] = (somaCat[k] || 0) + v;
  }
  const mediaCat = {};
  for (const [k, v] of Object.entries(somaCat)) mediaCat[k] = Number((v / todas.length).toFixed(1));

  res.json({
    totalAvaliacoes: todas.length,
    mediaGeral: todas.length ? Number((todas.reduce((a, x) => a + x.score, 0) / todas.length).toFixed(2)) : 0,
    porStatus,
    mediaPorCategoria: mediaCat,
  });
});

// ---------------------------------------------------------------------------
// Fila da plataforma
// ---------------------------------------------------------------------------

// Reconstrói as respostas de uma tentativa a partir do que foi guardado.
// Nada é recalculado aqui: o dossiê lê o que já foi pontuado no envio.
function tentativaCompleta(assessmentId) {
  const a = db.prepare("SELECT * FROM assessments WHERE id = ?").get(assessmentId);
  if (!a) return null;

  const linhas = db.prepare(
    "SELECT questionId, resposta, pontos FROM assessment_answers WHERE assessmentId = ?"
  ).all(assessmentId);

  const respostas = {};
  const detalhe = [];
  for (const l of linhas) {
    try { respostas[l.questionId] = JSON.parse(l.resposta); } catch { respostas[l.questionId] = l.resposta; }
    detalhe.push({ id: l.questionId, pontos: l.pontos, nota: "" });
  }

  return {
    id: a.id,
    tentativa: a.tentativa,
    score: a.score,
    status: a.status,
    categorias: JSON.parse(a.categorias || "{}"),
    perfil: JSON.parse(a.perfil || "{}"),
    criadoEm: a.criadoEm,
    respostas,
    detalhe,
  };
}

// Antes isto era uma fila de espera: só quem estava em 'analise'. Ninguém
// fica mais em análise, então a consulta passou a devolver lista vazia para
// sempre — e a plataforma perdeu de vista todo mundo que já se avaliou.
//
// Vira um diretório: todos que concluíram a avaliação, com o que precisa para
// entender a especialidade de cada um sem abrir o dossiê completo.
router.get("/triagem/fila", (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });

  const fila = db.prepare(`
    SELECT s.id, s.nome, s.email, s.cidade, s.perfil, s.status, s.scoreTriagem, s.criadoEm, s.perfilComercial,
           (SELECT COUNT(*) FROM assessments WHERE sellerId = s.id) AS tentativas,
           (SELECT MAX(criadoEm) FROM assessments WHERE sellerId = s.id) AS avaliadoEm
    FROM sellers s
    WHERE EXISTS (SELECT 1 FROM assessments WHERE sellerId = s.id)
    ORDER BY avaliadoEm DESC
  `).all().map((s) => ({ ...s, perfilComercial: JSON.parse(s.perfilComercial || "{}") }));

  res.json({ fila });
});

// O dossiê que a plataforma lê antes de decidir: todas as respostas, o que o
// profissional entrega hoje e o que ainda não entrega.
router.get("/triagem/:sellerId/dossie", async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });

  const vendedor = db.prepare("SELECT id, nome, email, cidade, status, criadoEm, foto, whats, linkedin, bio, perfil FROM sellers WHERE id = ?")
    .get(req.params.sellerId);
  if (!vendedor) return res.status(404).json({ error: "Profissional não encontrado" });

  const ultima = db.prepare(
    "SELECT id FROM assessments WHERE sellerId = ? ORDER BY criadoEm DESC LIMIT 1"
  ).get(vendedor.id);

  if (ultima) {
    const t = tentativaCompleta(ultima.id);
    const dossie = montarDossie(t);
    dossie.narrativa = await narrativa(dossie);
    const historico = db.prepare(
      "SELECT tentativa, score, status, criadoEm FROM assessments WHERE sellerId = ? ORDER BY criadoEm DESC"
    ).all(vendedor.id);
    return res.json({ vendedor, avaliadoEm: t.criadoEm, dossie, historico });
  }

  const seller = db.prepare(
    "SELECT disc, xpRespostas, scoreTriagem, onboardingEtapa, criadoEm FROM sellers WHERE id = ?"
  ).get(vendedor.id);

  if (seller?.onboardingEtapa === "concluido" && seller.disc) {
    const dossie = montarDossieDisc(seller);
    dossie.narrativa = await narrativaDisc(dossie);
    return res.json({ vendedor, avaliadoEm: seller.criadoEm, dossie, historico: [] });
  }

  return res.status(404).json({ error: "Este profissional ainda não fez a avaliação" });
});

// A decisão. Só a plataforma, e sempre com registro de quem decidiu.
router.post("/triagem/:sellerId/decidir", async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Apenas a plataforma" });

  const decisao = DECISOES[req.body?.decisao];
  if (!decisao)
    return res.status(400).json({ error: "Decisão inválida. Use aprovado, parcial ou recusado." });

  const vendedor = db.prepare("SELECT id, nome, email, status FROM sellers WHERE id = ?").get(req.params.sellerId);
  if (!vendedor) return res.status(404).json({ error: "Profissional não encontrado" });
  // Antes esta rota só agia sobre quem estava em análise. Como ninguém mais
  // fica em análise, essa trava tornaria a moderação impossível: a plataforma
  // perderia a capacidade de suspender alguém já liberado.
  if (vendedor.status === decisao)
    return res.status(409).json({ error: `Este profissional já está como ${decisao}.` });

  const nota = String(req.body?.nota || "").slice(0, 500);
  db.prepare("UPDATE sellers SET status = ?, notaTriagem = ?, decididoPor = ?, decididoEm = ? WHERE id = ?")
    .run(decisao, nota, req.user.id, agora(), vendedor.id);

  const user = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'vendedor'").get(vendedor.id);
  if (user) {
    const msg = {
      aprovado: "Perfil aprovado pela plataforma. As oportunidades já estão liberadas.",
      parcial: "Perfil aprovado parcialmente. Você já acessa as oportunidades e a Academy eleva sua classificação.",
      recusado: "Seu perfil ainda não foi aprovado. Complete a Academy e refaça a avaliação.",
    }[decisao];
    notificar(user.id, "triagem", "Resultado da análise", nota ? `${msg}\n\n${nota}` : msg);
  }
  if (vendedor.email) await emailStatusProfissional(vendedor.nome, vendedor.email, decisao, nota);

  console.log(`[admin] triagem decidida: ${vendedor.nome} → ${decisao}`);
  res.json({ id: vendedor.id, status: decisao });
});

export default router;

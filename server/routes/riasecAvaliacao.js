import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { isBetaEnvironment } from "../services/betaEnvironment.js";
import {
  RIASEC_VERSAO, RIASEC_IDIOMA, RIASEC_CHAVE, RIASEC_ALGORITMO, RIASEC_TOTAL,
  RIASEC_EXPERIMENTAL, RIASEC_PENDENCIAS, RIASEC_INSTRUMENTO, RIASEC_FONTE, RIASEC_ESCALA,
  riasecDisponivel, itensPublicos, dimensoesPublicas, ALTERNATIVAS,
  sanearRespostas, contarRespondidos, validarRespostas, calcularResultado,
  montarRelatorio,
} from "../../shared/riasec.js";

const router = Router();

// Disponível quando a flag explícita estiver ligada (RIASEC_DISPONIVEL != 0) OU
// em ambiente beta. Com RIASEC_DISPONIVEL=0 e fora do beta, fica "Em breve".
function disponivel() {
  return riasecDisponivel() || isBetaEnvironment();
}

// Toda rota exige papel profissional; o dono é sempre req.user.entityId. O
// sellerId nunca vem do corpo — impede acesso à avaliação de outro profissional.
function exigirVendedor(req, res) {
  if (req.user.role !== "vendedor") {
    res.status(403).json({ error: "Apenas profissionais" });
    return null;
  }
  if (!req.user.entityId) {
    res.status(403).json({ error: "Perfil profissional não encontrado" });
    return null;
  }
  return req.user.entityId;
}

function carregarTentativa(sellerId) {
  return db.prepare("SELECT * FROM riasec_assessments WHERE sellerId = ? AND versao = ?")
    .get(sellerId, RIASEC_VERSAO);
}

function parseJson(v, fallback) {
  try { return JSON.parse(v ?? ""); } catch { return fallback; }
}

function resumoTentativa(row) {
  if (!row) return { status: "nao_iniciado", progresso: 0, compartilhar: false };
  return {
    status: row.status,
    progresso: row.progresso || 0,
    compartilhar: !!row.compartilharEmpresas,
    iniciadoEm: row.iniciadoEm,
    concluidoEm: row.concluidoEm || null,
  };
}

// Conteúdo estável do instrumento, enviado ao cliente (sem a chave de resposta).
function conteudoInstrumento() {
  return {
    versao: RIASEC_VERSAO,
    instrumento: RIASEC_INSTRUMENTO,
    fonte: RIASEC_FONTE,
    idioma: RIASEC_IDIOMA,
    escala: RIASEC_ESCALA,
    total: RIASEC_TOTAL,
    experimental: RIASEC_EXPERIMENTAL,
    alternativas: ALTERNATIVAS,
    dimensoes: dimensoesPublicas(),
  };
}

// -----------------------------------------------------------------------------
// GET /riasec — estado atual + conteúdo para o profissional.
// -----------------------------------------------------------------------------
router.get("/riasec", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  const respostas = row ? parseJson(row.respostas, {}) : {};

  const base = {
    ...conteudoInstrumento(),
    disponivel: disponivel(),
    pendencias: RIASEC_PENDENCIAS,
    tentativa: resumoTentativa(row),
    respostas,
  };

  if (row && row.status === "andamento") {
    base.itens = itensPublicos();
  }

  if (row && row.status === "concluido") {
    const resultado = parseJson(row.resultado, {});
    base.resultado = resultado;
    base.relatorio = montarRelatorio(resultado);
    base.concluidoEm = row.concluidoEm;
  }

  res.json(base);
});

// -----------------------------------------------------------------------------
// POST /riasec/iniciar — cria/retoma a tentativa. Refazer sobrescreve a própria
// tentativa concluída, sem tocar em outros dados.
// -----------------------------------------------------------------------------
router.post("/riasec/iniciar", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;
  if (!disponivel()) return res.status(403).json({ error: "Avaliação indisponível no momento." });

  const seller = db.prepare("SELECT id FROM sellers WHERE id = ?").get(sellerId);
  if (!seller) return res.status(404).json({ error: "Profissional não encontrado" });

  let row = carregarTentativa(sellerId);
  const ts = agora();

  if (row && row.status === "andamento") {
    return res.json({
      ok: true, retomada: true,
      itens: itensPublicos(), alternativas: ALTERNATIVAS,
      respostas: parseJson(row.respostas, {}), tentativa: resumoTentativa(row),
    });
  }

  if (row) {
    db.prepare(`UPDATE riasec_assessments SET
      status = 'andamento', respostas = '{}', progresso = 0, resultado = '{}',
      iniciadoEm = ?, atualizadoEm = ?, concluidoEm = NULL
      WHERE sellerId = ? AND versao = ?`)
      .run(ts, ts, sellerId, RIASEC_VERSAO);
  } else {
    db.prepare(`INSERT INTO riasec_assessments
      (id, sellerId, versao, idioma, chave, algoritmo, status, respostas, progresso, iniciadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, 'andamento', '{}', 0, ?, ?)`)
      .run(uid(), sellerId, RIASEC_VERSAO, RIASEC_IDIOMA, RIASEC_CHAVE, RIASEC_ALGORITMO, ts, ts);
  }

  row = carregarTentativa(sellerId);
  res.json({
    ok: true, retomada: false,
    itens: itensPublicos(), alternativas: ALTERNATIVAS,
    respostas: {}, tentativa: resumoTentativa(row),
  });
});

// -----------------------------------------------------------------------------
// POST /riasec/progresso — salva o mapa de respostas (auto-save). Saneia cada
// entrada (item conhecido, valor 1–5), sem concluir.
// -----------------------------------------------------------------------------
router.post("/riasec/progresso", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  if (!row || row.status !== "andamento")
    return res.status(409).json({ error: "Nenhuma avaliação em andamento." });

  const { respostas } = req.body || {};
  if (!respostas || typeof respostas !== "object")
    return res.status(400).json({ error: "Envie o mapa de respostas." });

  const limpas = sanearRespostas(respostas);
  const progresso = contarRespondidos(limpas);

  db.prepare("UPDATE riasec_assessments SET respostas = ?, progresso = ?, atualizadoEm = ? WHERE sellerId = ? AND versao = ?")
    .run(JSON.stringify(limpas), progresso, agora(), sellerId, RIASEC_VERSAO);

  res.json({ ok: true, progresso, total: RIASEC_TOTAL });
});

// -----------------------------------------------------------------------------
// POST /riasec/concluir — valida tudo no servidor, calcula a pontuação e persiste
// de forma transacional e idempotente. Não toca em perfilComercial.
// -----------------------------------------------------------------------------
router.post("/riasec/concluir", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  if (!row) return res.status(409).json({ error: "Nenhuma avaliação iniciada." });

  if (row.status === "concluido") {
    const resultado = parseJson(row.resultado, {});
    return res.json({ ok: true, jaConcluido: true, resultado, relatorio: montarRelatorio(resultado) });
  }

  const corpoResp = req.body?.respostas;
  const respostas = corpoResp && typeof corpoResp === "object"
    ? sanearRespostas(corpoResp)
    : parseJson(row.respostas, {});

  const validacao = validarRespostas(respostas);
  if (!validacao.ok)
    return res.status(400).json({ error: validacao.erro, codigo: validacao.codigo });

  const resultado = calcularResultado(respostas);
  const ts = agora();
  resultado.concluidoEm = ts;

  const concluir = db.transaction(() => {
    db.prepare(`UPDATE riasec_assessments SET
      status = 'concluido', respostas = ?, progresso = ?, resultado = ?,
      atualizadoEm = ?, concluidoEm = ?
      WHERE sellerId = ? AND versao = ? AND status = 'andamento'`)
      .run(
        JSON.stringify(respostas), RIASEC_TOTAL,
        JSON.stringify(resultado), ts, ts, sellerId, RIASEC_VERSAO,
      );
  });
  concluir();

  res.json({ ok: true, resultado, relatorio: montarRelatorio(resultado) });
});

// -----------------------------------------------------------------------------
// POST /riasec/compartilhamento — visibilidade do resultado para empresas.
// Privado por padrão; só muda com consentimento explícito (spec, seção 10), e
// pode ser revogado.
// -----------------------------------------------------------------------------
router.post("/riasec/compartilhamento", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  if (!row || row.status !== "concluido")
    return res.status(409).json({ error: "Conclua a avaliação antes de definir o compartilhamento." });

  const compartilhar = req.body?.compartilhar === true ? 1 : 0;
  db.prepare("UPDATE riasec_assessments SET compartilharEmpresas = ?, atualizadoEm = ? WHERE sellerId = ? AND versao = ?")
    .run(compartilhar, agora(), sellerId, RIASEC_VERSAO);

  res.json({ ok: true, compartilhar: !!compartilhar });
});

export default router;

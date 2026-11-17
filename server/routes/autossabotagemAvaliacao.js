import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { isBetaEnvironment } from "../services/betaEnvironment.js";
import {
  AUTO_VERSAO, AUTO_IDIOMA, AUTO_CHAVE, AUTO_ALGORITMO, AUTO_TOTAL, AUTO_EXPERIMENTAL,
  AUTO_PENDENCIAS, AUTO_INSTRUMENTO, AUTO_FONTE, AUTO_ESCALA,
  autossabotagemDisponivel, itensPublicos, padroesPublicos, ALTERNATIVAS,
  sanearRespostas, contarRespondidos, validarRespostas, calcularResultado,
  montarRelatorio,
} from "../../shared/autossabotagem.js";

const router = Router();

// Disponível quando a flag explícita estiver ligada (AUTOSSABOTAGEM_DISPONIVEL=1)
// OU em ambiente beta (uso interno). Em produção, sem a flag, o questionário fica
// fora do ar — "Em breve" — durante a revisão interna (spec, seção 13).
function disponivel() {
  return autossabotagemDisponivel() || isBetaEnvironment();
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
  return db.prepare("SELECT * FROM autossabotagem_assessments WHERE sellerId = ? AND versao = ?")
    .get(sellerId, AUTO_VERSAO);
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
    versao: AUTO_VERSAO,
    instrumento: AUTO_INSTRUMENTO,
    fonte: AUTO_FONTE,
    idioma: AUTO_IDIOMA,
    escala: AUTO_ESCALA,
    total: AUTO_TOTAL,
    experimental: AUTO_EXPERIMENTAL,
    alternativas: ALTERNATIVAS,
    padroes: padroesPublicos(),
  };
}

// -----------------------------------------------------------------------------
// GET /autossabotagem — estado atual + conteúdo para o profissional.
// -----------------------------------------------------------------------------
router.get("/autossabotagem", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  const respostas = row ? parseJson(row.respostas, {}) : {};

  const base = {
    ...conteudoInstrumento(),
    disponivel: disponivel(),
    pendencias: AUTO_PENDENCIAS,
    tentativa: resumoTentativa(row),
    respostas,
  };

  // Itens só quando há tentativa em andamento (durante o preenchimento).
  if (row && row.status === "andamento") {
    base.itens = itensPublicos();
  }

  // Resultado + relatório quando concluída.
  if (row && row.status === "concluido") {
    const resultado = parseJson(row.resultado, {});
    base.resultado = resultado;
    base.relatorio = montarRelatorio(resultado);
    base.concluidoEm = row.concluidoEm;
  }

  res.json(base);
});

// -----------------------------------------------------------------------------
// POST /autossabotagem/iniciar — cria/retoma a tentativa. Refazer sobrescreve a
// própria tentativa concluída, sem tocar em nenhum outro dado do profissional.
// -----------------------------------------------------------------------------
router.post("/autossabotagem/iniciar", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;
  if (!disponivel()) return res.status(403).json({ error: "Avaliação indisponível no momento." });

  const seller = db.prepare("SELECT id FROM sellers WHERE id = ?").get(sellerId);
  if (!seller) return res.status(404).json({ error: "Profissional não encontrado" });

  let row = carregarTentativa(sellerId);
  const ts = agora();

  if (row && row.status === "andamento") {
    // Retoma a tentativa existente, preservando as respostas.
    return res.json({
      ok: true, retomada: true,
      itens: itensPublicos(), alternativas: ALTERNATIVAS,
      respostas: parseJson(row.respostas, {}), tentativa: resumoTentativa(row),
    });
  }

  if (row) {
    // Refaz: zera respostas, progresso e resultado; volta a "andamento".
    db.prepare(`UPDATE autossabotagem_assessments SET
      status = 'andamento', respostas = '{}', progresso = 0, resultado = '{}',
      iniciadoEm = ?, atualizadoEm = ?, concluidoEm = NULL
      WHERE sellerId = ? AND versao = ?`)
      .run(ts, ts, sellerId, AUTO_VERSAO);
  } else {
    db.prepare(`INSERT INTO autossabotagem_assessments
      (id, sellerId, versao, idioma, chave, algoritmo, status, respostas, progresso, iniciadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, 'andamento', '{}', 0, ?, ?)`)
      .run(uid(), sellerId, AUTO_VERSAO, AUTO_IDIOMA, AUTO_CHAVE, AUTO_ALGORITMO, ts, ts);
  }

  row = carregarTentativa(sellerId);
  res.json({
    ok: true, retomada: false,
    itens: itensPublicos(), alternativas: ALTERNATIVAS,
    respostas: {}, tentativa: resumoTentativa(row),
  });
});

// -----------------------------------------------------------------------------
// POST /autossabotagem/progresso — salva o mapa de respostas (auto-save). Saneia
// cada entrada (item conhecido, valor 1–5), sem concluir.
// -----------------------------------------------------------------------------
router.post("/autossabotagem/progresso", (req, res) => {
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

  db.prepare("UPDATE autossabotagem_assessments SET respostas = ?, progresso = ?, atualizadoEm = ? WHERE sellerId = ? AND versao = ?")
    .run(JSON.stringify(limpas), progresso, agora(), sellerId, AUTO_VERSAO);

  res.json({ ok: true, progresso, total: AUTO_TOTAL });
});

// -----------------------------------------------------------------------------
// POST /autossabotagem/concluir — valida tudo no servidor, calcula a pontuação e
// persiste de forma transacional e idempotente. Não toca em perfilComercial.
// -----------------------------------------------------------------------------
router.post("/autossabotagem/concluir", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  if (!row) return res.status(409).json({ error: "Nenhuma avaliação iniciada." });

  // Já concluída: idempotente — devolve o resultado existente.
  if (row.status === "concluido") {
    const resultado = parseJson(row.resultado, {});
    return res.json({ ok: true, jaConcluido: true, resultado, relatorio: montarRelatorio(resultado) });
  }

  // Aceita respostas finais no corpo (último auto-save) ou usa as persistidas.
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
    db.prepare(`UPDATE autossabotagem_assessments SET
      status = 'concluido', respostas = ?, progresso = ?, resultado = ?,
      atualizadoEm = ?, concluidoEm = ?
      WHERE sellerId = ? AND versao = ? AND status = 'andamento'`)
      .run(
        JSON.stringify(respostas), AUTO_TOTAL,
        JSON.stringify(resultado), ts, ts, sellerId, AUTO_VERSAO,
      );
  });
  concluir();

  res.json({ ok: true, resultado, relatorio: montarRelatorio(resultado) });
});

// -----------------------------------------------------------------------------
// POST /autossabotagem/compartilhamento — visibilidade do resultado para
// empresas. Privado por padrão; só muda com autorização explícita (spec, seção 9).
// -----------------------------------------------------------------------------
router.post("/autossabotagem/compartilhamento", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  if (!row || row.status !== "concluido")
    return res.status(409).json({ error: "Conclua a avaliação antes de definir o compartilhamento." });

  const compartilhar = req.body?.compartilhar === true ? 1 : 0;
  db.prepare("UPDATE autossabotagem_assessments SET compartilharEmpresas = ?, atualizadoEm = ? WHERE sellerId = ? AND versao = ?")
    .run(compartilhar, agora(), sellerId, AUTO_VERSAO);

  res.json({ ok: true, compartilhar: !!compartilhar });
});

export default router;

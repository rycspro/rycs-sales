import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { isBetaEnvironment } from "../services/betaEnvironment.js";
import {
  COM_VERSAO, COM_IDIOMA, COM_GABARITO_VERSAO, COM_ALGORITMO, COM_TOTAL,
  COM_EXPERIMENTAL, COM_PENDENCIAS, COM_INSTRUMENTO, COM_FONTE,
  comunicacaoDisponivel, itensPublicos, competenciasPublicas,
  sanearRespostas, contarRespondidos, validarRespostas, calcularResultado,
  montarRelatorio,
} from "../../shared/comunicacaoProfissional.js";

const router = Router();

function disponivel() {
  return comunicacaoDisponivel() || isBetaEnvironment();
}

// Toda rota exige papel profissional; o dono é sempre req.user.entityId. O
// sellerId nunca vem do corpo — impede acesso à tentativa de outro profissional.
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
  return db.prepare("SELECT * FROM comunicacao_assessments WHERE sellerId = ? AND versao = ?")
    .get(sellerId, COM_VERSAO);
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

// Conteúdo estável do instrumento (sem gabarito).
function conteudoInstrumento() {
  return {
    versao: COM_VERSAO,
    instrumento: COM_INSTRUMENTO,
    fonte: COM_FONTE,
    idioma: COM_IDIOMA,
    total: COM_TOTAL,
    experimental: COM_EXPERIMENTAL,
    competencias: competenciasPublicas(),
  };
}

// -----------------------------------------------------------------------------
// GET /comunicacao — estado atual. Durante o preenchimento envia os itens SEM
// gabarito; concluída, envia resultado + relatório (com revisão).
// -----------------------------------------------------------------------------
router.get("/comunicacao", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  const respostas = row ? parseJson(row.respostas, {}) : {};

  const base = {
    ...conteudoInstrumento(),
    disponivel: disponivel(),
    pendencias: COM_PENDENCIAS,
    tentativa: resumoTentativa(row),
    respostas,
  };

  // Itens (sem gabarito) só quando há tentativa em andamento.
  if (row && row.status === "andamento") {
    base.itens = itensPublicos();
  }

  // Resultado + relatório (com revisão) só quando concluída.
  if (row && row.status === "concluido") {
    const resultado = parseJson(row.resultado, {});
    base.resultado = resultado;
    base.relatorio = montarRelatorio(resultado, respostas);
    base.concluidoEm = row.concluidoEm;
  }

  res.json(base);
});

// -----------------------------------------------------------------------------
// POST /comunicacao/iniciar — cria ou retoma. Primeira versão: UMA tentativa
// concluída por profissional (spec, seção 8). Concluída não é reiniciada — os
// resultados não podem ser alterados.
// -----------------------------------------------------------------------------
router.post("/comunicacao/iniciar", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;
  if (!disponivel()) return res.status(403).json({ error: "Avaliação indisponível no momento." });

  const seller = db.prepare("SELECT id FROM sellers WHERE id = ?").get(sellerId);
  if (!seller) return res.status(404).json({ error: "Profissional não encontrado" });

  const row = carregarTentativa(sellerId);
  const ts = agora();

  // Já concluída: não reinicia nem altera. Apenas sinaliza.
  if (row && row.status === "concluido") {
    return res.status(409).json({ error: "Avaliação já concluída.", jaConcluido: true });
  }

  if (row && row.status === "andamento") {
    return res.json({
      ok: true, retomada: true,
      itens: itensPublicos(),
      respostas: parseJson(row.respostas, {}), tentativa: resumoTentativa(row),
    });
  }

  db.prepare(`INSERT INTO comunicacao_assessments
    (id, sellerId, versao, idioma, chave, algoritmo, status, respostas, progresso, iniciadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?, ?, ?, 'andamento', '{}', 0, ?, ?)`)
    .run(uid(), sellerId, COM_VERSAO, COM_IDIOMA, COM_GABARITO_VERSAO, COM_ALGORITMO, ts, ts);

  const novo = carregarTentativa(sellerId);
  res.json({
    ok: true, retomada: false,
    itens: itensPublicos(),
    respostas: {}, tentativa: resumoTentativa(novo),
  });
});

// -----------------------------------------------------------------------------
// POST /comunicacao/progresso — auto-save. Saneia cada entrada (questão conhecida,
// letra válida), sem concluir e sem aceitar alteração de tentativa concluída.
// -----------------------------------------------------------------------------
router.post("/comunicacao/progresso", (req, res) => {
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

  db.prepare("UPDATE comunicacao_assessments SET respostas = ?, progresso = ?, atualizadoEm = ? WHERE sellerId = ? AND versao = ?")
    .run(JSON.stringify(limpas), progresso, agora(), sellerId, COM_VERSAO);

  res.json({ ok: true, progresso, total: COM_TOTAL });
});

// -----------------------------------------------------------------------------
// POST /comunicacao/concluir — corrige no servidor e persiste de forma
// transacional e idempotente. Não toca em perfilComercial. Não devolve gabarito
// antes de concluir — só depois, no relatório.
// -----------------------------------------------------------------------------
router.post("/comunicacao/concluir", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  if (!row) return res.status(409).json({ error: "Nenhuma avaliação iniciada." });

  // Já concluída: idempotente — devolve o resultado existente.
  if (row.status === "concluido") {
    const resultado = parseJson(row.resultado, {});
    const respostas = parseJson(row.respostas, {});
    return res.json({ ok: true, jaConcluido: true, resultado, relatorio: montarRelatorio(resultado, respostas) });
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
    db.prepare(`UPDATE comunicacao_assessments SET
      status = 'concluido', respostas = ?, progresso = ?, resultado = ?,
      atualizadoEm = ?, concluidoEm = ?
      WHERE sellerId = ? AND versao = ? AND status = 'andamento'`)
      .run(
        JSON.stringify(respostas), COM_TOTAL,
        JSON.stringify(resultado), ts, ts, sellerId, COM_VERSAO,
      );
  });
  concluir();

  res.json({ ok: true, resultado, relatorio: montarRelatorio(resultado, respostas) });
});

// -----------------------------------------------------------------------------
// POST /comunicacao/compartilhamento — visibilidade do resultado para empresas.
// Privado por padrão; só muda com consentimento explícito (spec, seção 10).
// -----------------------------------------------------------------------------
router.post("/comunicacao/compartilhamento", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  if (!row || row.status !== "concluido")
    return res.status(409).json({ error: "Conclua a avaliação antes de definir o compartilhamento." });

  const compartilhar = req.body?.compartilhar === true ? 1 : 0;
  db.prepare("UPDATE comunicacao_assessments SET compartilharEmpresas = ?, atualizadoEm = ? WHERE sellerId = ? AND versao = ?")
    .run(compartilhar, agora(), sellerId, COM_VERSAO);

  res.json({ ok: true, compartilhar: !!compartilhar });
});

export default router;

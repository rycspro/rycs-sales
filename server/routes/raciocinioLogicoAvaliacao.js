import { Router } from "express";
import db, { uid, agora } from "../db.js";
import { isBetaEnvironment } from "../services/betaEnvironment.js";
import {
  RL_VERSAO, RL_IDIOMA, RL_CHAVE, RL_ALGORITMO, RL_TOTAL, RL_EXPERIMENTAL,
  RL_PENDENCIAS, RL_INSTRUMENTO, RL_FONTE,
  raciocinioDisponivel, itensPublicos, competenciasPublicas,
  sanearRespostas, contarRespondidos, validarRespostas, calcularResultado,
  montarRelatorio,
} from "../../shared/raciocinioLogico.js";

const router = Router();

// Disponível quando RACIOCINIO_DISPONIVEL != 0 OU em ambiente beta. Com a flag
// em 0 e fora do beta, fica "Em breve" (revisão interna).
function disponivel() {
  return raciocinioDisponivel() || isBetaEnvironment();
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
  return db.prepare("SELECT * FROM raciocinio_assessments WHERE sellerId = ? AND versao = ?")
    .get(sellerId, RL_VERSAO);
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

// Conteúdo estável do instrumento enviado ao cliente — SEM gabarito nem
// explicações (itens públicos trazem só enunciado + alternativas).
function conteudoInstrumento() {
  return {
    versao: RL_VERSAO,
    instrumento: RL_INSTRUMENTO,
    fonte: RL_FONTE,
    idioma: RL_IDIOMA,
    total: RL_TOTAL,
    experimental: RL_EXPERIMENTAL,
    competencias: competenciasPublicas(),
  };
}

// -----------------------------------------------------------------------------
// GET /raciocinio — estado atual + conteúdo para o profissional.
// -----------------------------------------------------------------------------
router.get("/raciocinio", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  const respostas = row ? parseJson(row.respostas, {}) : {};

  const base = {
    ...conteudoInstrumento(),
    disponivel: disponivel(),
    pendencias: RL_PENDENCIAS,
    tentativa: resumoTentativa(row),
    respostas,
  };

  // Itens (sem gabarito) só enquanto há tentativa em andamento.
  if (row && row.status === "andamento") {
    base.itens = itensPublicos();
  }

  // Resultado + relatório (com revisão/gabarito) só após a conclusão.
  if (row && row.status === "concluido") {
    const resultado = parseJson(row.resultado, {});
    base.resultado = resultado;
    base.relatorio = montarRelatorio(resultado, respostas);
    base.concluidoEm = row.concluidoEm;
  }

  res.json(base);
});

// -----------------------------------------------------------------------------
// POST /raciocinio/iniciar — cria ou RETOMA a tentativa. Uma tentativa concluída
// NÃO é refeita nesta versão (não permitir refazer imediatamente o mesmo
// conjunto para substituir a nota — spec, seção 7): devolve o resultado.
// -----------------------------------------------------------------------------
router.post("/raciocinio/iniciar", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;
  if (!disponivel()) return res.status(403).json({ error: "Avaliação indisponível no momento." });

  const seller = db.prepare("SELECT id FROM sellers WHERE id = ?").get(sellerId);
  if (!seller) return res.status(404).json({ error: "Profissional não encontrado" });

  const row = carregarTentativa(sellerId);
  const ts = agora();

  if (row && row.status === "concluido") {
    const resultado = parseJson(row.resultado, {});
    const respostas = parseJson(row.respostas, {});
    return res.json({ ok: true, jaConcluido: true, resultado, relatorio: montarRelatorio(resultado, respostas) });
  }

  if (row && row.status === "andamento") {
    return res.json({
      ok: true, retomada: true,
      itens: itensPublicos(),
      respostas: parseJson(row.respostas, {}), tentativa: resumoTentativa(row),
    });
  }

  db.prepare(`INSERT INTO raciocinio_assessments
    (id, sellerId, versao, idioma, chave, algoritmo, status, respostas, progresso, iniciadoEm, atualizadoEm)
    VALUES (?, ?, ?, ?, ?, ?, 'andamento', '{}', 0, ?, ?)`)
    .run(uid(), sellerId, RL_VERSAO, RL_IDIOMA, RL_CHAVE, RL_ALGORITMO, ts, ts);

  const nova = carregarTentativa(sellerId);
  res.json({
    ok: true, retomada: false,
    itens: itensPublicos(),
    respostas: {}, tentativa: resumoTentativa(nova),
  });
});

// -----------------------------------------------------------------------------
// POST /raciocinio/progresso — salva o mapa de respostas (auto-save). Saneia
// cada entrada (questão conhecida, alternativa válida), sem concluir nem corrigir.
// -----------------------------------------------------------------------------
router.post("/raciocinio/progresso", (req, res) => {
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

  db.prepare("UPDATE raciocinio_assessments SET respostas = ?, progresso = ?, atualizadoEm = ? WHERE sellerId = ? AND versao = ?")
    .run(JSON.stringify(limpas), progresso, agora(), sellerId, RL_VERSAO);

  res.json({ ok: true, progresso, total: RL_TOTAL });
});

// -----------------------------------------------------------------------------
// POST /raciocinio/concluir — valida tudo no servidor, corrige pelo gabarito e
// persiste de forma transacional e idempotente. Não toca em perfilComercial.
// Após concluída, as respostas não podem ser alteradas.
// -----------------------------------------------------------------------------
router.post("/raciocinio/concluir", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  if (!row) return res.status(409).json({ error: "Nenhuma avaliação iniciada." });

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
    db.prepare(`UPDATE raciocinio_assessments SET
      status = 'concluido', respostas = ?, progresso = ?, resultado = ?,
      atualizadoEm = ?, concluidoEm = ?
      WHERE sellerId = ? AND versao = ? AND status = 'andamento'`)
      .run(
        JSON.stringify(respostas), RL_TOTAL,
        JSON.stringify(resultado), ts, ts, sellerId, RL_VERSAO,
      );
  });
  concluir();

  res.json({ ok: true, resultado, relatorio: montarRelatorio(resultado, respostas) });
});

// -----------------------------------------------------------------------------
// POST /raciocinio/compartilhamento — visibilidade do resultado para empresas.
// Privado por padrão; só muda com consentimento explícito, e pode ser revogado.
// Não altera ranking, score comercial ou acesso a campanhas.
// -----------------------------------------------------------------------------
router.post("/raciocinio/compartilhamento", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  if (!row || row.status !== "concluido")
    return res.status(409).json({ error: "Conclua a avaliação antes de definir o compartilhamento." });

  const compartilhar = req.body?.compartilhar === true ? 1 : 0;
  db.prepare("UPDATE raciocinio_assessments SET compartilharEmpresas = ?, atualizadoEm = ? WHERE sellerId = ? AND versao = ?")
    .run(compartilhar, agora(), sellerId, RL_VERSAO);

  res.json({ ok: true, compartilhar: !!compartilhar });
});

export default router;

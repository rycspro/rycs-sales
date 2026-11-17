import { Router } from "express";
import db, { uid, agora } from "../db.js";
import {
  DISC_V2_VERSAO, DISC_V2_ALGORITMO, DISC_V2_BLOCOS, DISC_V2_EXPERIMENTAL,
  discV2Disponivel, blocosPublicos, dimensoesPublicas, gerarOrdem,
  validarRespostas, calcularResultado, contarRespondidos, montarRelatorio,
} from "../../shared/discV2.js";

const router = Router();

// Toda rota exige papel profissional; o dono é sempre req.user.entityId. Não há
// como um profissional ler ou mexer na avaliação de outro: o sellerId nunca vem
// do corpo, só do token.
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
  return db.prepare("SELECT * FROM disc_assessments WHERE sellerId = ? AND versao = ?")
    .get(sellerId, DISC_V2_VERSAO);
}

function parseJson(v, fallback) {
  try { return JSON.parse(v ?? ""); } catch { return fallback; }
}

// Resultado histórico do DISC antigo (8 perguntas), preservado e identificado.
function discAntigo(sellerId) {
  const row = db.prepare("SELECT disc FROM sellers WHERE id = ?").get(sellerId);
  const antigo = parseJson(row?.disc, {});
  if (!antigo?.predominante) return null;
  return {
    versao: "rycs-disc-legado-8",
    predominante: antigo.predominante,
    secundario: antigo.secundario || null,
    label: antigo.label || "",
    percentuais: antigo.percentuais || {},
  };
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

// -----------------------------------------------------------------------------
// GET /disc/avaliacao — estado atual + conteúdo para o profissional.
// -----------------------------------------------------------------------------
router.get("/disc/avaliacao", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  const ordem = row ? parseJson(row.ordem, {}) : {};
  const respostas = row ? parseJson(row.respostas, {}) : {};

  const base = {
    versao: DISC_V2_VERSAO,
    totalBlocos: DISC_V2_BLOCOS,
    experimental: DISC_V2_EXPERIMENTAL,
    disponivel: discV2Disponivel(),
    dimensoes: dimensoesPublicas(),
    tentativa: resumoTentativa(row),
    respostas,
    historicoAntigo: discAntigo(sellerId),
  };

  // Blocos só quando há tentativa em andamento (mantém a ordem embaralhada).
  if (row && row.status === "andamento") {
    base.blocos = blocosPublicos(ordem);
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
// POST /disc/avaliacao/iniciar — cria/retoma a tentativa. Refazer sobrescreve a
// própria tentativa concluída (não toca o histórico do instrumento antigo).
// -----------------------------------------------------------------------------
router.post("/disc/avaliacao/iniciar", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;
  if (!discV2Disponivel()) return res.status(403).json({ error: "Avaliação indisponível no momento." });

  const seller = db.prepare("SELECT id FROM sellers WHERE id = ?").get(sellerId);
  if (!seller) return res.status(404).json({ error: "Profissional não encontrado" });

  let row = carregarTentativa(sellerId);
  const ts = agora();

  if (row && row.status === "andamento") {
    // Retoma a tentativa existente, preservando ordem e respostas.
    const ordem = parseJson(row.ordem, {});
    return res.json({ ok: true, retomada: true, blocos: blocosPublicos(ordem), respostas: parseJson(row.respostas, {}), tentativa: resumoTentativa(row) });
  }

  const ordem = gerarOrdem();
  if (row) {
    // Refaz: zera respostas e progresso, nova ordem, volta a "andamento".
    db.prepare(`UPDATE disc_assessments SET
      status = 'andamento', respostas = '{}', ordem = ?, progresso = 0,
      contagens = '{}', saldos = '{}', resultado = '{}',
      iniciadoEm = ?, atualizadoEm = ?, concluidoEm = NULL
      WHERE sellerId = ? AND versao = ?`)
      .run(JSON.stringify(ordem), ts, ts, sellerId, DISC_V2_VERSAO);
  } else {
    db.prepare(`INSERT INTO disc_assessments
      (id, sellerId, versao, algoritmo, status, respostas, ordem, progresso, iniciadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, 'andamento', '{}', ?, 0, ?, ?)`)
      .run(uid(), sellerId, DISC_V2_VERSAO, DISC_V2_ALGORITMO, JSON.stringify(ordem), ts, ts);
  }

  row = carregarTentativa(sellerId);
  res.json({ ok: true, retomada: false, blocos: blocosPublicos(ordem), respostas: {}, tentativa: resumoTentativa(row) });
});

// -----------------------------------------------------------------------------
// POST /disc/avaliacao/progresso — salva o mapa de respostas (auto-save).
// Valida cada entrada contra as alternativas oficiais, sem concluir.
// -----------------------------------------------------------------------------
router.post("/disc/avaliacao/progresso", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  if (!row || row.status !== "andamento")
    return res.status(409).json({ error: "Nenhuma avaliação em andamento." });

  const { respostas } = req.body || {};
  if (!respostas || typeof respostas !== "object")
    return res.status(400).json({ error: "Envie o mapa de respostas." });

  // Saneia: mantém só blocos/alternativas válidos e MAIS ≠ MENOS. Entradas
  // inválidas são descartadas silenciosamente (o cliente ainda está preenchendo).
  const { BLOCOS_LIMPOS, limpas } = sanearRespostas(respostas);
  if (BLOCOS_LIMPOS === false)
    return res.status(400).json({ error: "Respostas em formato inválido." });

  const progresso = contarRespondidos(limpas);
  db.prepare("UPDATE disc_assessments SET respostas = ?, progresso = ?, atualizadoEm = ? WHERE sellerId = ? AND versao = ?")
    .run(JSON.stringify(limpas), progresso, agora(), sellerId, DISC_V2_VERSAO);

  res.json({ ok: true, progresso, totalBlocos: DISC_V2_BLOCOS });
});

// Mantém apenas respostas cujas alternativas pertencem ao bloco e são distintas.
function sanearRespostas(respostas) {
  // Reaproveita a validação por alternativa oficial importando o mapa indireto:
  // montamos um mapa { blocoId: { altId: true } } a partir dos blocos públicos.
  const publicos = blocosPublicos();
  const validAlt = {};
  for (const b of publicos) validAlt[b.id] = new Set(b.alternativas.map((a) => a.id));

  const limpas = {};
  for (const [blocoId, r] of Object.entries(respostas)) {
    if (!validAlt[blocoId] || !r || typeof r !== "object") continue;
    const mais = typeof r.mais === "string" ? r.mais : null;
    const menos = typeof r.menos === "string" ? r.menos : null;
    const entrada = {};
    if (mais && validAlt[blocoId].has(mais)) entrada.mais = mais;
    if (menos && validAlt[blocoId].has(menos) && menos !== entrada.mais) entrada.menos = menos;
    if (entrada.mais || entrada.menos) limpas[blocoId] = entrada;
  }
  return { BLOCOS_LIMPOS: true, limpas };
}

// -----------------------------------------------------------------------------
// POST /disc/avaliacao/concluir — valida tudo no servidor, calcula e persiste de
// forma transacional e idempotente.
// -----------------------------------------------------------------------------
router.post("/disc/avaliacao/concluir", (req, res) => {
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
    ? sanearRespostas(corpoResp).limpas
    : parseJson(row.respostas, {});

  const validacao = validarRespostas(respostas);
  if (!validacao.ok)
    return res.status(400).json({ error: validacao.erro, codigo: validacao.codigo });

  const resultado = calcularResultado(respostas);
  const ts = agora();

  const concluir = db.transaction(() => {
    db.prepare(`UPDATE disc_assessments SET
      status = 'concluido', respostas = ?, progresso = ?,
      contagens = ?, saldos = ?, resultado = ?,
      atualizadoEm = ?, concluidoEm = ?
      WHERE sellerId = ? AND versao = ? AND status = 'andamento'`)
      .run(
        JSON.stringify(respostas), DISC_V2_BLOCOS,
        JSON.stringify(resultado.contagens), JSON.stringify(resultado.saldos),
        JSON.stringify(resultado), ts, ts, sellerId, DISC_V2_VERSAO,
      );
  });
  concluir();

  res.json({ ok: true, resultado, relatorio: montarRelatorio(resultado) });
});

// -----------------------------------------------------------------------------
// POST /disc/avaliacao/compartilhamento — controle explícito de visibilidade do
// resultado para empresas. Privado por padrão.
// -----------------------------------------------------------------------------
router.post("/disc/avaliacao/compartilhamento", (req, res) => {
  const sellerId = exigirVendedor(req, res);
  if (!sellerId) return;

  const row = carregarTentativa(sellerId);
  if (!row || row.status !== "concluido")
    return res.status(409).json({ error: "Conclua a avaliação antes de definir o compartilhamento." });

  const compartilhar = req.body?.compartilhar === true ? 1 : 0;
  db.prepare("UPDATE disc_assessments SET compartilharEmpresas = ?, atualizadoEm = ? WHERE sellerId = ? AND versao = ?")
    .run(compartilhar, agora(), sellerId, DISC_V2_VERSAO);

  res.json({ ok: true, compartilhar: !!compartilhar });
});

export default router;

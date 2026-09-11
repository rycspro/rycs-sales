// Orquestrador do RYCS Audit Engine.
//
//   TASK → EVIDENCE → INGESTION → NORMALIZATION → DETERMINISTIC VALIDATION
//        → FRAUD SIGNALS → AI ANALYSIS → POLICY → SCORING → DECISION
//
// A ordem não é estética: é roteamento de custo. Os estágios gratuitos rodam
// primeiro, e um estágio caro só é chamado quando a política tem critério que
// depende dele E os estágios baratos não resolveram a questão sozinhos.
//
// Nenhum estágio decide. Todos produzem veredicto por critério; quem decide é
// o Decision Engine, sobre a nota que o Scoring Engine calculou.

import db, { uid, agora } from "../../db.js";
import { normalizarPolitica, estagiosNecessarios } from "../../../shared/audit/politica.js";
import { pontuar, explicar, RESULTADOS } from "../../../shared/audit/scoring.js";
import { decidir, DECISOES } from "../../../shared/audit/decisao.js";
import { avaliar as avaliarDeterministico, normalizarProva } from "../regras.js";
import { ACOES } from "../../../shared/acoes.js";
import { avaliarGeo, avaliarReuso, avaliarMetadados, persistirSinais } from "./sinais.js";
import { executar, STATUS } from "./providers/index.js";
import { validarVisao, validarTranscricao, validarSemantica, esquemaSemantico } from "./providers/contratos.js";
import { registrarEstagio } from "./observabilidade.js";

const CHAVES = {
  campos: "campos_obrigatorios",
  reuso: "evidencia_nao_reutilizada",
  geo: "distancia_do_endereco",
  ambiente: "ambiente_comercial",
  manipulacao: "imagem_sem_manipulacao",
  duracao: "duracao_minima",
};

async function medir(nome, auditRequestId, taskId, fn) {
  const inicio = Date.now();
  try {
    const saida = await fn();
    registrarEstagio({ auditRequestId, taskId, estagio: nome, status: "ok", duracaoMs: Date.now() - inicio });
    return { ok: true, saida };
  } catch (err) {
    registrarEstagio({ auditRequestId, taskId, estagio: nome, status: "erro", duracaoMs: Date.now() - inicio, erro: err.message });
    return { ok: false, erro: { estagio: nome, mensagem: String(err.message).slice(0, 300) } };
  }
}

// ------------------------------------------------------------- estágios ----

function estagioDeterministico({ tipo, prova }) {
  const acao = ACOES[tipo];
  const camposReq = acao?.prova || [];
  const provaNormalizada = normalizarProva(prova, camposReq);
  const r = avaliarDeterministico({ tipo, prova: provaNormalizada, camposReq, contexto: {} });

  // A checagem determinística responde um critério: os campos estão completos
  // e plausíveis. O motivo dela vira o detalhe.
  return {
    provaNormalizada,
    veredictos: {
      [CHAVES.campos]: {
        resultado: r.veredito === "recusado" ? RESULTADOS.negado : RESULTADOS.atendido,
        confianca: Math.max(0, Math.min(1, (Number(r.confianca) || 0) / 100)),
        detalhe: r.motivo,
      },
    },
    risco: r.risco,
    sinaisTexto: r.sinais || [],
  };
}

function estagioSinais({ auditRequestId, sellerId, evidencias, geo }) {
  const veredictos = {};
  const sinais = [];

  const arquivo = evidencias.find((e) => ["imagem", "video", "audio"].includes(e.tipo));
  if (arquivo) {
    const reuso = avaliarReuso({ hash: arquivo.hash, sellerId, auditRequestId });
    veredictos[CHAVES.reuso] = { resultado: reuso.resultado, confianca: reuso.confianca, detalhe: reuso.detalhe };
    sinais.push(...reuso.sinais);

    const meta = avaliarMetadados({ metadata: arquivo.metadata || {} });
    sinais.push(...meta.sinais);
  }

  if (geo) {
    const g = avaliarGeo(geo);
    veredictos[CHAVES.geo] = { resultado: g.resultado, confianca: g.confianca, detalhe: g.detalhe };
    if (g.sinal) sinais.push(g.sinal);
  }

  persistirSinais(auditRequestId, sinais);
  return { veredictos, sinais };
}

async function estagioVisao({ auditRequestId, evidencias, criterios }) {
  const imagem = evidencias.find((e) => e.tipo === "imagem");
  if (!imagem) return { veredictos: {}, indisponivel: false };

  const r = await executar({
    capacidade: "visao", operacao: "analisar_visita", auditRequestId,
    entrada: { referencia: imagem.referencia, metadata: imagem.metadata },
  });

  if (r.status !== STATUS.ok) {
    // Sem provedor ou com falha, os critérios de visão ficam inconclusivos.
    // O Decision Engine trata isso como revisão humana, nunca como reprovação.
    return {
      veredictos: Object.fromEntries(criterios.map((c) => [c.chave, {
        resultado: RESULTADOS.inconclusivo, confianca: 0,
        detalhe: r.status === STATUS.indisponivel
          ? "Análise automatizada de imagem ainda não configurada nesta instalação."
          : `Provedor de visão indisponível (${r.status}).`,
      }])),
      indisponivel: r.status === STATUS.indisponivel,
    };
  }

  const v = validarVisao(r.resultado);
  if (!v.valido) {
    return {
      veredictos: Object.fromEntries(criterios.map((c) => [c.chave, {
        resultado: RESULTADOS.inconclusivo, confianca: 0,
        detalhe: `Resposta do provedor recusada pela validação: ${v.motivo}`,
      }])),
      indisponivel: false,
    };
  }

  const d = v.dados;
  const veredictos = {};
  if (criterios.some((c) => c.chave === CHAVES.ambiente)) {
    veredictos[CHAVES.ambiente] = d.ambienteComercial === null
      ? { resultado: RESULTADOS.inconclusivo, confianca: 0, detalhe: "Provedor não avaliou o ambiente." }
      : { resultado: d.ambienteComercial ? RESULTADOS.atendido : RESULTADOS.negado, confianca: d.confianca, detalhe: d.observacao || "Avaliação de ambiente comercial." };
  }
  if (criterios.some((c) => c.chave === CHAVES.manipulacao)) {
    veredictos[CHAVES.manipulacao] = d.possivelManipulacao === null
      ? { resultado: RESULTADOS.inconclusivo, confianca: 0, detalhe: "Provedor não avaliou manipulação." }
      : { resultado: d.possivelManipulacao ? RESULTADOS.negado : RESULTADOS.atendido, confianca: d.confianca, detalhe: d.possivelManipulacao ? "Sinais de edição detectados." : "Sem sinais de edição." };
  }
  return { veredictos, indisponivel: false, dados: d };
}

async function estagioTranscricao({ auditRequestId, evidencias }) {
  const midia = evidencias.find((e) => e.tipo === "audio" || e.tipo === "video");
  if (!midia) return { transcricao: null, indisponivel: false };

  const r = await executar({
    capacidade: "transcricao", operacao: "transcrever_reuniao", auditRequestId,
    entrada: { referencia: midia.referencia, metadata: midia.metadata },
  });

  if (r.status !== STATUS.ok) return { transcricao: null, indisponivel: r.status === STATUS.indisponivel, status: r.status };

  const t = validarTranscricao(r.resultado);
  return t.valido ? { transcricao: t.dados, indisponivel: false } : { transcricao: null, indisponivel: false, motivo: t.motivo };
}

async function estagioSemantico({ auditRequestId, transcricao, criterios }) {
  if (!criterios.length) return { veredictos: {} };

  const inconclusivo = (detalhe) => Object.fromEntries(criterios.map((c) => [c.chave, { resultado: RESULTADOS.inconclusivo, confianca: 0, detalhe }]));

  if (!transcricao) return { veredictos: inconclusivo("Sem transcrição disponível para avaliar os critérios de conteúdo.") };

  const r = await executar({
    capacidade: "semantica", operacao: "avaliar_criterios", auditRequestId,
    entrada: { transcricao: transcricao.texto, segmentos: transcricao.segmentos, esquema: esquemaSemantico(criterios) },
  });

  if (r.status !== STATUS.ok) {
    return { veredictos: inconclusivo(r.status === STATUS.indisponivel
      ? "Análise semântica ainda não configurada nesta instalação."
      : `Provedor semântico indisponível (${r.status}).`) };
  }

  const s = validarSemantica(r.resultado, criterios.map((c) => c.chave));
  if (!s.valido) return { veredictos: inconclusivo(`Resposta do provedor recusada pela validação: ${s.motivo}`) };

  const veredictos = inconclusivo("Critério não retornado pelo provedor.");
  for (const a of s.dados.avaliacoes) {
    veredictos[a.chave] = {
      resultado: a.atendido ? RESULTADOS.atendido : RESULTADOS.negado,
      confianca: a.confianca,
      detalhe: a.justificativa,
      evidencia: a.evidencia,
    };
  }
  return { veredictos };
}

function estagioDuracao({ transcricao, duracaoMinimaSegundos }) {
  if (!duracaoMinimaSegundos) return {};
  if (!transcricao) return { [CHAVES.duracao]: { resultado: RESULTADOS.inconclusivo, confianca: 0, detalhe: "Sem mídia transcrita para medir duração." } };
  const d = transcricao.duracaoSegundos || 0;
  return {
    [CHAVES.duracao]: {
      resultado: d >= duracaoMinimaSegundos ? RESULTADOS.atendido : RESULTADOS.negado,
      confianca: 1,
      detalhe: `${Math.round(d / 60)} min de conversa; mínimo exigido ${Math.round(duracaoMinimaSegundos / 60)} min.`,
    },
  };
}

// -------------------------------------------------------------- executar ----

export async function processar(auditRequestId) {
  const pedido = db.prepare("SELECT * FROM audit_requests WHERE id = ?").get(auditRequestId);
  if (!pedido) throw new Error("Pedido de auditoria não encontrado");

  const politica = normalizarPolitica(JSON.parse(pedido.politicaSnapshot || "{}"));
  const evidencias = db.prepare("SELECT * FROM audit_evidences WHERE auditRequestId = ?").all(auditRequestId)
    .map((e) => ({ ...e, metadata: JSON.parse(e.metadata || "{}") }));

  const tarefa = db.prepare("SELECT tipo, prova FROM submissions WHERE id = ?").get(pedido.taskId);
  const prova = tarefa ? JSON.parse(tarefa.prova || "{}") : {};
  const contexto = JSON.parse(evidencias.find((e) => e.tipo === "metadata")?.metadata?.contexto ? "{}" : "{}");

  const necessarios = new Set(estagiosNecessarios(politica));
  const criteriosDe = (fonte) => politica.criterios.filter((c) => c.fonte === fonte);

  db.prepare("UPDATE audit_requests SET status = 'processando', iniciadoEm = ? WHERE id = ?").run(agora(), auditRequestId);

  let veredictos = {};
  const erros = [];

  // 1. Determinístico — sempre roda: é grátis e resolve a maior parte.
  const det = await medir("deterministico", auditRequestId, pedido.taskId, async () =>
    estagioDeterministico({ tipo: tarefa?.tipo, prova }));
  if (det.ok) veredictos = { ...veredictos, ...det.saida.veredictos };
  else erros.push(det.erro);

  // 2. Sinais e geo — também gratuitos.
  const geoEvid = evidencias.find((e) => e.tipo === "geo");
  const sin = await medir("sinais", auditRequestId, pedido.taskId, async () =>
    estagioSinais({
      auditRequestId, sellerId: pedido.sellerId, evidencias,
      geo: geoEvid ? { capturado: geoEvid.metadata?.capturado, esperado: geoEvid.metadata?.esperado, toleranciaMetros: geoEvid.metadata?.tolerancia } : null,
    }));
  if (sin.ok) veredictos = { ...veredictos, ...sin.saida.veredictos };
  else erros.push(sin.erro);

  // 3. Visão — só se a política pedir.
  if (necessarios.has("visao")) {
    const vis = await medir("visao", auditRequestId, pedido.taskId, async () =>
      estagioVisao({ auditRequestId, evidencias, criterios: criteriosDe("visao") }));
    if (vis.ok) veredictos = { ...veredictos, ...vis.saida.veredictos };
    else erros.push(vis.erro);
  }

  // 4. Transcrição — só se houver critério de transcrição ou semântico.
  let transcricao = null;
  if (necessarios.has("transcricao") || necessarios.has("semantica")) {
    const tr = await medir("transcricao", auditRequestId, pedido.taskId, async () =>
      estagioTranscricao({ auditRequestId, evidencias }));
    if (tr.ok) transcricao = tr.saida.transcricao;
    else erros.push(tr.erro);

    veredictos = { ...veredictos, ...estagioDuracao({ transcricao, duracaoMinimaSegundos: Number(contexto?.duracaoMinimaSegundos) || Number(politica.duracaoMinimaSegundos) || 0 }) };
  }

  // 5. Semântica — o estágio mais caro, por último.
  if (necessarios.has("semantica")) {
    const sem = await medir("semantica", auditRequestId, pedido.taskId, async () =>
      estagioSemantico({ auditRequestId, transcricao, criterios: criteriosDe("semantica") }));
    if (sem.ok) veredictos = { ...veredictos, ...sem.saida.veredictos };
    else erros.push(sem.erro);
  }

  // 6. Scoring e decisão.
  const resultado = pontuar({ politica, veredictos });
  const decisao = decidir({ politica, resultado, errosDeEstagio: erros });
  const explicacao = explicar(resultado);

  db.prepare(`UPDATE audit_requests
    SET status = 'concluido', score = ?, cobertura = ?, decisao = ?, motivo = ?, detalhe = ?, explicacao = ?, concluidoEm = ?
    WHERE id = ?`)
    .run(resultado.score, resultado.cobertura, decisao.decisao, decisao.motivo, decisao.detalhe,
      JSON.stringify({ ...explicacao, itens: resultado.itens, transcricaoDisponivel: !!transcricao }), agora(), auditRequestId);

  return { auditRequestId, score: resultado.score, cobertura: resultado.cobertura, decisao, explicacao, erros };
}

export { DECISOES, CHAVES };

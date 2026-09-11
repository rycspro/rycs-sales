// Fila de auditoria.
//
// O vendedor envia, a API grava a evidência, cria o pedido e devolve na hora.
// O processamento pesado — transcrição, visão, semântica — acontece fora do
// request. Segurar uma requisição HTTP esperando um modelo responder é como se
// perde o app em produção.
//
// A implementação é uma tabela e um laço no próprio processo. É o adequado ao
// volume atual e não adiciona Redis, Bull ou worker separado a um MVP. O que
// importa é que o CONTRATO já é de fila: `enfileirar` e `processarProximo` não
// mudam quando isso virar BullMQ, SQS ou Cloud Tasks — troca-se o miolo deste
// arquivo e o resto do motor não fica sabendo.

import db, { uid, agora } from "../../db.js";
import { processar } from "./pipeline.js";
import { registrarEstagio } from "./observabilidade.js";

export const MAX_TENTATIVAS = Number(process.env.AUDIT_MAX_TENTATIVAS) || 3;
const INTERVALO_MS = Number(process.env.AUDIT_WORKER_INTERVALO_MS) || 4000;

// Espera crescente entre tentativas: um provedor que caiu raramente volta no
// segundo seguinte, e insistir só multiplica a falha.
const esperaDaTentativa = (n) => Math.min(5 * 60000, 5000 * 2 ** (n - 1));

export function enfileirar(auditRequestId) {
  const ts = agora();
  const id = uid();
  db.prepare(`INSERT INTO audit_jobs (id, auditRequestId, status, tentativas, proximaTentativaEm, criadoEm, atualizadoEm)
              VALUES (?, ?, 'pendente', 0, ?, ?, ?)`).run(id, auditRequestId, ts, ts, ts);
  return id;
}

function proximoJob() {
  // Reivindicação atômica: marca como processando antes de devolver, para o
  // mesmo job não sair duas vezes se houver mais de um consumidor.
  return db.transaction(() => {
    const job = db.prepare(`
      SELECT * FROM audit_jobs
      WHERE status = 'pendente' AND (proximaTentativaEm IS NULL OR proximaTentativaEm <= ?)
      ORDER BY criadoEm ASC LIMIT 1
    `).get(agora());
    if (!job) return null;
    db.prepare("UPDATE audit_jobs SET status = 'processando', tentativas = tentativas + 1, atualizadoEm = ? WHERE id = ?")
      .run(agora(), job.id);
    return { ...job, tentativas: job.tentativas + 1 };
  })();
}

export async function processarProximo() {
  const job = proximoJob();
  if (!job) return null;

  try {
    const r = await processar(job.auditRequestId);
    db.prepare("UPDATE audit_jobs SET status = 'concluido', atualizadoEm = ? WHERE id = ?").run(agora(), job.id);
    return { job: job.id, ...r };
  } catch (err) {
    const mensagem = String(err.message).slice(0, 300);
    const esgotou = job.tentativas >= MAX_TENTATIVAS;

    db.prepare(`UPDATE audit_jobs SET status = ?, ultimoErro = ?, proximaTentativaEm = ?, atualizadoEm = ? WHERE id = ?`)
      .run(esgotou ? "falhou" : "pendente", mensagem,
        esgotou ? null : agora() + esperaDaTentativa(job.tentativas), agora(), job.id);

    // Esgotadas as tentativas, a ação NÃO é reprovada: vai para revisão
    // humana. Falha nossa de processamento não é falta do profissional.
    if (esgotou) {
      db.prepare(`UPDATE audit_requests
        SET status = 'concluido', decisao = 'revisao', motivo = 'erro_de_estagio',
            detalhe = ?, concluidoEm = ? WHERE id = ?`)
        .run(`A auditoria automática falhou ${job.tentativas} vez(es). Enviada para revisão humana.`, agora(), job.auditRequestId);
    }

    registrarEstagio({ auditRequestId: job.auditRequestId, estagio: "fila", status: esgotou ? "esgotado" : "retry", duracaoMs: 0, erro: mensagem });
    return { job: job.id, erro: mensagem, esgotou };
  }
}

let timer = null;

// O laço só roda em processo de servidor. Em teste, cada caso chama
// `processarProximo` diretamente e controla o tempo.
export function iniciarWorker() {
  if (timer) return timer;
  const tick = async () => {
    try {
      // Drena até esvaziar antes de dormir: uma rajada de envios não fica
      // presa um item por intervalo.
      let processou = true;
      while (processou) processou = !!(await processarProximo());
    } catch (err) {
      console.error("[audit] worker:", err.message);
    }
  };
  timer = setInterval(tick, INTERVALO_MS);
  timer.unref?.();
  console.log(`[audit] worker de auditoria ativo (intervalo ${INTERVALO_MS} ms)`);
  return timer;
}

export function pararWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

export function estadoDaFila() {
  const linhas = db.prepare("SELECT status, COUNT(*) n FROM audit_jobs GROUP BY status").all();
  return Object.fromEntries(linhas.map((l) => [l.status, l.n]));
}

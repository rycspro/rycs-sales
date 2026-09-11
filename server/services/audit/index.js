// Porta de entrada do RYCS Audit Engine.
//
// É o único ponto que o resto da aplicação conhece. Rotas chamam `solicitar`
// e leem `consultar`; nada fora daqui sabe que existe fila, provedor ou
// estágio.

import db, { uid, agora } from "../../db.js";
import { normalizarPolitica, POLITICAS_PADRAO, politicaValida } from "../../../shared/audit/politica.js";
import { hashConteudo } from "./sinais.js";
import { canonicalizarUrl } from "../auditTrail.js";
import { enfileirar } from "./fila.js";
import { capacidadesDisponiveis } from "./providers/index.js";

export { metricas } from "./observabilidade.js";
export { estadoDaFila, processarProximo, iniciarWorker, pararWorker } from "./fila.js";
export { capacidadesDisponiveis };

// A política vigente: a da empresa, se houver; senão a padrão da plataforma.
// Sempre a maior versão ativa.
export function politicaVigente({ companyId, tipo }) {
  const daEmpresa = db.prepare(
    "SELECT * FROM audit_policies WHERE companyId = ? AND tipo = ? AND ativo = 1 ORDER BY versao DESC LIMIT 1"
  ).get(companyId, tipo);
  if (daEmpresa) return hidratar(daEmpresa);

  const daPlataforma = db.prepare(
    "SELECT * FROM audit_policies WHERE companyId IS NULL AND tipo = ? AND ativo = 1 ORDER BY versao DESC LIMIT 1"
  ).get(tipo);
  return daPlataforma ? hidratar(daPlataforma) : null;
}

function hidratar(linha) {
  return {
    id: linha.id,
    companyId: linha.companyId,
    ...normalizarPolitica({
      nome: linha.nome, tipo: linha.tipo, versao: linha.versao,
      criterios: JSON.parse(linha.criterios || "[]"),
      limiares: JSON.parse(linha.limiares || "{}"),
      ativo: !!linha.ativo,
    }),
  };
}

export function salvarPolitica({ companyId = null, politica, criadoPor = null }) {
  const check = politicaValida(politica);
  if (!check.valida) return { erro: check.erros.join(" ") };

  // Editar nunca sobrescreve: cria a próxima versão e desativa a anterior.
  // Auditorias antigas continuam explicáveis pela versão que as julgou.
  const atual = db.prepare(
    "SELECT MAX(versao) v FROM audit_policies WHERE companyId IS ? AND tipo = ?"
  ).get(companyId, check.politica.tipo);
  const versao = (atual?.v || 0) + 1;
  const id = uid();

  db.transaction(() => {
    db.prepare("UPDATE audit_policies SET ativo = 0 WHERE companyId IS ? AND tipo = ?").run(companyId, check.politica.tipo);
    db.prepare(`INSERT INTO audit_policies (id, companyId, tipo, nome, versao, criterios, limiares, ativo, criadoPor, criadoEm)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
      .run(id, companyId, check.politica.tipo, check.politica.nome, versao,
        JSON.stringify(check.politica.criterios), JSON.stringify(check.politica.limiares), criadoPor, agora());
  })();

  return { id, versao, politica: { ...check.politica, versao } };
}

export function semearPoliticasPadrao() {
  const existe = db.prepare("SELECT COUNT(*) n FROM audit_policies WHERE companyId IS NULL").get().n;
  if (existe) return 0;
  let n = 0;
  for (const p of POLITICAS_PADRAO) {
    const r = salvarPolitica({ companyId: null, politica: p, criadoPor: "sistema" });
    if (!r.erro) n++;
  }
  if (n) console.log(`[audit] ${n} política(s) padrão da plataforma criada(s)`);
  return n;
}

// Abre a auditoria de uma tarefa. Retorna imediatamente: o processamento fica
// para a fila.
export function solicitar({ taskId, sellerId, companyId, tipo, evidencias = [] }) {
  const politica = politicaVigente({ companyId, tipo });
  if (!politica) {
    return { erro: `Nenhuma política de auditoria ativa para tarefas do tipo "${tipo}".` };
  }

  const id = uid();
  const ts = agora();

  db.transaction(() => {
    db.prepare(`INSERT INTO audit_requests
      (id, taskId, sellerId, companyId, policyId, policyVersao, politicaSnapshot, status, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?)`)
      .run(id, taskId, sellerId, companyId, politica.id, politica.versao, JSON.stringify(politica), ts);

    const ins = db.prepare(`INSERT INTO audit_evidences
      (id, auditRequestId, tipo, referencia, hash, metadata, origem, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const e of evidencias) {
      // Sem os bytes do arquivo ainda dá para detectar reuso: o mesmo link de
      // gravação enviado em duas ações é um padrão real de fraude, e a URL
      // canônica é hasheável sem baixar nada.
      const url = canonicalizarUrl(e.referencia);
      const hash = e.hash
        || (e.conteudo ? hashConteudo(e.conteudo) : null)
        || (url ? hashConteudo(Buffer.from(`url:${url}`)) : null);
      ins.run(uid(), id, e.tipo, String(e.referencia || ""), hash,
        JSON.stringify(e.metadata || {}), e.origem || "vendedor", ts);
    }
  })();

  enfileirar(id);
  return { id, status: "pendente", politica: { nome: politica.nome, versao: politica.versao } };
}

export function consultar(auditRequestId) {
  const r = db.prepare("SELECT * FROM audit_requests WHERE id = ?").get(auditRequestId);
  if (!r) return null;
  return {
    ...r,
    politicaSnapshot: JSON.parse(r.politicaSnapshot || "{}"),
    explicacao: JSON.parse(r.explicacao || "{}"),
  };
}

export function consultarPorTarefa(taskId) {
  const r = db.prepare("SELECT id FROM audit_requests WHERE taskId = ? ORDER BY criadoEm DESC LIMIT 1").get(taskId);
  return r ? consultar(r.id) : null;
}

// Fila de revisão humana: tudo que o motor não fechou sozinho.
export function filaDeRevisao({ companyId = null, limite = 50 } = {}) {
  const where = companyId ? "AND r.companyId = ?" : "";
  const args = companyId ? [companyId, limite] : [limite];
  return db.prepare(`
    SELECT r.id, r.taskId, r.sellerId, r.companyId, r.score, r.cobertura, r.decisao, r.motivo, r.detalhe, r.criadoEm,
           s.tipo, s.valor, v.nome AS profissional, c.nome AS empresa
    FROM audit_requests r
    LEFT JOIN submissions s ON s.id = r.taskId
    LEFT JOIN sellers v ON v.id = r.sellerId
    LEFT JOIN companies c ON c.id = r.companyId
    WHERE r.status = 'concluido' AND r.decisao = 'revisao'
      AND NOT EXISTS (SELECT 1 FROM audit_reviews w WHERE w.auditRequestId = r.id)
      ${where}
    ORDER BY r.concluidoEm ASC LIMIT ?
  `).all(...args);
}

// Decisão humana. O campo `concordouComMotor` é o começo do dataset próprio:
// quando uma pessoa discorda da máquina, essa discordância é o rótulo mais
// valioso que a plataforma pode acumular.
export function revisar({ auditRequestId, revisorId, revisorRole, decisaoFinal, motivo = "" }) {
  const pedido = db.prepare("SELECT decisao FROM audit_requests WHERE id = ?").get(auditRequestId);
  if (!pedido) return { erro: "Auditoria não encontrada" };
  if (!["aprovado", "recusado", "revisao"].includes(decisaoFinal)) return { erro: "Decisão inválida" };

  const id = uid();
  db.prepare(`INSERT INTO audit_reviews
    (id, auditRequestId, revisorId, revisorRole, decisaoAnterior, decisaoFinal, concordouComMotor, motivo, criadoEm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, auditRequestId, revisorId, revisorRole, pedido.decisao, decisaoFinal,
      pedido.decisao === decisaoFinal ? 1 : 0, String(motivo).slice(0, 600), agora());

  return { id, decisaoAnterior: pedido.decisao, decisaoFinal };
}

// Dataset de feedback humano, pronto para estudo futuro de modelo próprio.
// Entrada do motor, resultado do motor, resultado humano, resultado final.
export function dataset({ limite = 1000 } = {}) {
  return db.prepare(`
    SELECT r.id, r.taskId, s.tipo AS tarefa, r.policyVersao, r.score, r.cobertura,
           r.decisao AS decisaoMotor, r.motivo, w.decisaoFinal AS decisaoHumana,
           w.concordouComMotor, r.explicacao, r.criadoEm
    FROM audit_requests r
    LEFT JOIN audit_reviews w ON w.auditRequestId = r.id
    LEFT JOIN submissions s ON s.id = r.taskId
    WHERE r.status = 'concluido'
    ORDER BY r.criadoEm DESC LIMIT ?
  `).all(limite).map((l) => ({
    ...l,
    explicacao: JSON.parse(l.explicacao || "{}"),
    decisaoFinal: l.decisaoHumana || l.decisaoMotor,
  }));
}

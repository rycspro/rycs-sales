// Exclusão definitiva de uma empresa pela plataforma.
//
// A versão anterior apagava uma lista fixa de tabelas. Cada tabela nova com
// chave estrangeira para a empresa (ou para as campanhas dela) que não
// entrava na lista fazia o banco recusar a exclusão com "FOREIGN KEY
// constraint failed", e o admin via só um erro genérico.
//
// Agora as dependências saem do próprio banco: segue as chaves estrangeiras a
// partir de companies, em qualquer profundidade, e depois limpa as tabelas
// que guardam o companyId sem chave estrangeira.
//
// Os eventos de auditoria das campanhas da empresa também saem (decisão do
// dono do produto: a exclusão pelo admin vale sempre).
//
// Fica de fora o histórico financeiro da plataforma (platform_earnings e
// financial_ledger): é a receita e o livro-caixa já realizados, não dado da
// empresa, e não prende a exclusão.

import db from "../db.js";

const PRESERVAR = new Set(["platform_earnings", "financial_ledger"]);
const LOTE = 400;

const tabelas = () => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((t) => t.name);

// Quem aponta para `tabela`: [{ filho, coluna, alvo }].
function referencias(tabela) {
  const lista = [];
  for (const t of tabelas()) {
    for (const fk of db.prepare(`SELECT * FROM pragma_foreign_key_list(?)`).all(t)) {
      if (fk.table === tabela) lista.push({ filho: t, coluna: fk.from, alvo: fk.to || "id" });
    }
  }
  return lista;
}

function emLotes(valores, fn) {
  for (let i = 0; i < valores.length; i += LOTE) fn(valores.slice(i, i + LOTE));
}

// Apaga de `tabela` as linhas em que `coluna` está em `valores`, depois de
// apagar tudo o que aponta para elas.
function apagar(tabela, coluna, valores, removidos, caminho = new Set()) {
  if (!valores.length || caminho.has(tabela)) return;
  const dentro = new Set(caminho).add(tabela);
  for (const ref of referencias(tabela)) {
    const chaves = [];
    emLotes(valores, (lote) => {
      const marcas = lote.map(() => "?").join(",");
      for (const r of db.prepare(`SELECT "${ref.alvo}" AS v FROM "${tabela}" WHERE "${coluna}" IN (${marcas})`).all(...lote)) chaves.push(r.v);
    });
    apagar(ref.filho, ref.coluna, [...new Set(chaves)], removidos, dentro);
  }
  emLotes(valores, (lote) => {
    const r = db.prepare(`DELETE FROM "${tabela}" WHERE "${coluna}" IN (${lote.map(() => "?").join(",")})`).run(...lote);
    if (r.changes) removidos[tabela] = (removidos[tabela] || 0) + r.changes;
  });
}

const temColuna = (tabela, coluna) => db.prepare(`SELECT 1 FROM pragma_table_info(?) WHERE name = ?`).get(tabela, coluna);

// Arquivos no storage a remover depois do commit (a transação não alcança o
// bucket).
export function arquivosDaEmpresa(companyId) {
  if (!temColuna("academy_materiais", "chave")) return [];
  return db.prepare("SELECT chave FROM academy_materiais WHERE companyId = ? AND chave IS NOT NULL AND chave != ''").all(companyId).map((r) => r.chave);
}

export function excluirEmpresa(companyId) {
  const removidos = {};
  const usuarios = db.prepare("SELECT id FROM users WHERE entityId = ? AND role = 'empresa'").all(companyId).map((u) => u.id);

  db.transaction(() => {
    // Eventos de campanha são imutáveis por gatilho (trilha de auditoria). A
    // exclusão da empresa pela plataforma é a exceção autorizada pelo dono do
    // produto em 2026-10-15, como o reset do Beta (services/betaEnvironment.js):
    // o gatilho sai e volta dentro desta mesma transação. Se algo falhar, o
    // rollback devolve tudo, gatilho incluído.
    const gatilho = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'no_delete_campaign_events'").get();
    if (gatilho) db.exec("DROP TRIGGER no_delete_campaign_events");

    // 1. Tudo o que tem chave estrangeira para a empresa, em cascata.
    apagar("companies", "id", [companyId], removidos);
    // A linha da empresa já saiu acima; o resto é limpeza do que não tem FK.

    // 2. Tabelas com companyId sem chave estrangeira.
    for (const t of tabelas()) {
      if (PRESERVAR.has(t) || !temColuna(t, "companyId")) continue;
      const r = db.prepare(`DELETE FROM "${t}" WHERE companyId = ?`).run(companyId);
      if (r.changes) removidos[t] = (removidos[t] || 0) + r.changes;
    }

    // 3. Conta de acesso e o que pende dela.
    if (usuarios.length) {
      for (const t of tabelas()) {
        if (t === "users" || PRESERVAR.has(t)) continue;
        if (temColuna(t, "userId")) {
          const r = db.prepare(`DELETE FROM "${t}" WHERE userId IN (${usuarios.map(() => "?").join(",")})`).run(...usuarios);
          if (r.changes) removidos[t] = (removidos[t] || 0) + r.changes;
        }
      }
      const ref = !tabelas().includes("referrals") ? { changes: 0 } : db.prepare(`DELETE FROM referrals WHERE indicadorUserId IN (${usuarios.map(() => "?").join(",")}) OR indicadoUserId IN (${usuarios.map(() => "?").join(",")})`).run(...usuarios, ...usuarios);
      if (ref.changes) removidos.referrals = (removidos.referrals || 0) + ref.changes;
      apagar("users", "id", usuarios, removidos);
    }

    // 4. Convites usados pela empresa ficam, sem apontar para ela.
    for (const t of ["onboarding_convites", "trial_links"]) {
      if (temColuna(t, "usadoPor")) db.prepare(`UPDATE "${t}" SET usadoPor = NULL WHERE usadoPor = ?`).run(companyId);
    }

    if (gatilho) db.exec(gatilho.sql);
  })();

  return removidos;
}

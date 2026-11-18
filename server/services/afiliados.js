// =============================================================================
// Programa de Afiliados — serviço (Incremento A: fundação segura, sem mover
// dinheiro novo).
//
// Deriva do programa de indicações EXISTENTE (tabela `referrals`), sem tocar nas
// rotas de pagamento/crédito atuais. Faz duas coisas:
//   1) Materializa a atribuição PERMANENTE afiliado → EMPRESA (estrutural; a
//      comissão pertence ao afiliado que originou a empresa, não ao usuário que
//      clicou). Idempotente via UNIQUE(companyId).
//   2) Monta o resumo da Jornada de Indicações a partir dos dados reais.
//
// NENHUM crédito novo acontece aqui. A tabela `affiliate_commissions` só é
// preenchida pelo motor real (Incremento B), atrás da flag AFILIADOS_ENABLED.
// A política vigente continua sendo 30% da primeira mensalidade (regra atual).
// =============================================================================
import db, { uid, agora } from "../db.js";
import {
  afiliadosAtivo, NIVEIS_PROPOSTA, montarTrilha, nivelDe, proximoNivel,
} from "../../shared/afiliados.js";
import { PCT_PRIMEIRA_MENSALIDADE } from "../../shared/indicacoes.js";

// Empresas indicadas por este afiliado, derivadas das indicações existentes.
// Uma linha por empresa (o indicado é o usuário-empresa; a empresa é entityId).
function empresasIndicadasRaw(affiliateUserId) {
  return db.prepare(`
    SELECT r.id AS referralId, r.codigo AS affiliateCode, r.status AS refStatus,
           r.valor AS comissaoReais, r.pagamentoEm, r.ativadaEm, r.criadoEm,
           u.entityId AS companyId,
           c.nome AS companyNome, c.statusCadastro, c.assinatura, c.plano
    FROM referrals r
    JOIN users u ON u.id = r.indicadoUserId AND u.role = 'empresa'
    LEFT JOIN companies c ON c.id = u.entityId
    WHERE r.indicadorUserId = ? AND r.papelIndicado = 'empresa'
    ORDER BY r.criadoEm DESC
  `).all(affiliateUserId);
}

// Materializa (idempotente) a atribuição permanente afiliado → empresa. Só cria;
// NUNCA troca o afiliado de uma empresa já atribuída (UNIQUE companyId + verifica
// antes). Retorna quantas novas atribuições foram criadas.
export function materializarAtribuicoes(affiliateUserId) {
  const empresas = empresasIndicadasRaw(affiliateUserId).filter((e) => e.companyId);
  let criadas = 0;
  const inserir = db.transaction((linhas) => {
    for (const e of linhas) {
      const existe = db.prepare("SELECT id FROM affiliate_attributions WHERE companyId = ?").get(e.companyId);
      if (existe) continue; // vínculo já existe — não substitui
      db.prepare(`INSERT OR IGNORE INTO affiliate_attributions
        (id, affiliateUserId, affiliateCode, companyId, referralId, metodo, status, criadoEm)
        VALUES (?, ?, ?, ?, ?, 'primeiro_vinculo', 'ativo', ?)`)
        .run(uid(), affiliateUserId, e.affiliateCode || "", e.companyId, e.referralId, e.criadoEm || agora());
      criadas += 1;
    }
  });
  inserir(empresas);
  return criadas;
}

// Nº de empresas pagantes distintas elegíveis = empresas cujo pagamento do plano
// foi confirmado (pagamentoEm preenchido na regra v2 = 30% já constituído).
export function empresasPagantes(affiliateUserId) {
  const { n } = db.prepare(`
    SELECT COUNT(DISTINCT u.entityId) AS n
    FROM referrals r
    JOIN users u ON u.id = r.indicadoUserId AND u.role = 'empresa'
    WHERE r.indicadorUserId = ? AND r.papelIndicado = 'empresa' AND r.pagamentoEm IS NOT NULL
  `).get(affiliateUserId);
  return Number(n || 0);
}

// Níveis ativos configurados pelo admin (se houver); senão, a proposta padrão.
export function niveisVigentes() {
  const rows = db.prepare("SELECT chave, nome, minCompanies AS min, percentual AS pct FROM affiliate_commission_tiers WHERE active = 1 ORDER BY minCompanies ASC").all();
  return rows.length ? rows : NIVEIS_PROPOSTA;
}

// Resumo da Jornada de Indicações para o profissional (dados reais).
export function resumoAfiliado(userId) {
  // Estrutural: garante que os vínculos afiliado→empresa estão persistidos.
  materializarAtribuicoes(userId);

  const empresas = empresasIndicadasRaw(userId);
  const pagantes = empresasPagantes(userId);
  const niveis = niveisVigentes();

  // Comissões já recebidas (creditadas pela regra vigente) em reais.
  const recebidas = empresas
    .filter((e) => e.refStatus === "pago" && e.comissaoReais > 0)
    .reduce((a, e) => a + Number(e.comissaoReais || 0), 0);

  const nivelAtual = nivelDe(pagantes, niveis);
  const proximo = proximoNivel(pagantes, niveis);

  // Política efetivamente vigente. Enquanto a flag/novos níveis não forem
  // aprovados, o percentual aplicável é o atual (30% da primeira mensalidade).
  const politicaVigente = {
    tipo: "primeira-mensalidade",
    percentual: Math.round(PCT_PRIMEIRA_MENSALIDADE * 100),
    recorrencia: "primeira-mensalidade",
    ativa: afiliadosAtivo(),
  };
  const percentualAtual = afiliadosAtivo() ? nivelAtual.pct : politicaVigente.percentual;

  return {
    ativo: afiliadosAtivo(),
    politicaVigente,
    indicadores: {
      comissoesRecebidas: Math.round(recebidas * 100) / 100,
      // Em Incremento A não há "bucket" de afiliado separado antes do saque:
      // o crédito segue direto para o saldo disponível da Carteira (regra atual).
      comissoesDisponiveis: 0,
      comissoesPendentes: 0,
      empresasIndicadas: empresas.length,
      clientesPagantes: pagantes,
      percentualAtual,
    },
    nivelAtual: { chave: nivelAtual.chave, nome: nivelAtual.nome, pct: nivelAtual.pct },
    proximoNivel: proximo ? { nome: proximo.nome, pct: proximo.pct, faltam: proximo.faltam } : null,
    trilha: montarTrilha(pagantes, niveis),
    empresas: empresas.map((e) => ({
      companyId: e.companyId || null,
      nome: e.companyNome || "Empresa",
      statusCadastro: e.statusCadastro || null,
      assinatura: e.assinatura || null,
      pagante: !!e.pagamentoEm,
      comissaoRecebida: e.refStatus === "pago" ? Math.round(Number(e.comissaoReais || 0) * 100) / 100 : 0,
      linhaDoTempo: {
        cadastro: !!e.criadoEm,
        aprovado: !!e.ativadaEm,
        pagamentoConfirmado: !!e.pagamentoEm,
        comissaoConstituida: e.refStatus === "pago",
      },
      criadoEm: e.criadoEm,
    })),
  };
}

// Visão administrativa (somente leitura): afiliados com empresas e comissões.
export function listarAfiliadosAdmin() {
  const linhas = db.prepare(`
    SELECT r.indicadorUserId AS affiliateUserId,
           u.email AS affiliateEmail,
           COUNT(DISTINCT CASE WHEN r.papelIndicado = 'empresa' THEN iu.entityId END) AS empresas,
           COUNT(DISTINCT CASE WHEN r.papelIndicado = 'empresa' AND r.pagamentoEm IS NOT NULL THEN iu.entityId END) AS pagantes,
           SUM(CASE WHEN r.papelIndicado = 'empresa' AND r.status = 'pago' THEN r.valor ELSE 0 END) AS comissoesReais
    FROM referrals r
    JOIN users u ON u.id = r.indicadorUserId
    JOIN users iu ON iu.id = r.indicadoUserId
    WHERE u.role = 'vendedor'
    GROUP BY r.indicadorUserId
    ORDER BY pagantes DESC, empresas DESC
    LIMIT 500
  `).all();
  return linhas.map((l) => ({
    affiliateUserId: l.affiliateUserId,
    contato: l.affiliateEmail,
    empresas: Number(l.empresas || 0),
    clientesPagantes: Number(l.pagantes || 0),
    comissoesRecebidas: Math.round(Number(l.comissoesReais || 0) * 100) / 100,
    nivel: nivelDe(Number(l.pagantes || 0), niveisVigentes()).nome,
  }));
}

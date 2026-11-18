// =============================================================================
// Programa de Afiliados — configuração e matemática pura (Incremento A)
//
// Camada ADITIVA sobre o programa de indicações existente (shared/indicacoes.js
// + server/services/indicacoes.js). NÃO substitui nada: enquanto a flag estiver
// desligada, a política vigente continua sendo a atual (30% da primeira
// mensalidade — PCT_PRIMEIRA_MENSALIDADE), e NADA de dinheiro novo é movimentado.
//
// PRIORIDADE: integridade financeira. Por isso:
//  - toda contabilização de comissão usa CENTAVOS INTEIROS (nunca ponto
//    flutuante) — a conversão para reais só acontece na fronteira do crédito,
//    reaproveitando o caminho existente (creditar + financial_ledger UNIQUE).
//  - o percentual aplicável é "congelado" (snapshot) no momento em que a
//    comissão é constituída; mudar níveis depois não altera comissões já
//    constituídas.
//  - a tabela de níveis progressivos (Starter/Bronze/Ouro/Elite) é uma PROPOSTA
//    configurável e NÃO é aplicada até aprovação administrativa + flag ligada.
// =============================================================================

export const AFIL_VERSAO = "afiliados-v1";

// Flag mestre do novo programa. DESLIGADA por padrão: enquanto não for ligada e
// aprovada, o programa roda em modo "sombra" (só materializa/visualiza dados
// derivados das indicações existentes, sem mover dinheiro novo nem aplicar os
// percentuais progressivos).
export const afiliadosAtivo = () =>
  String(process.env.AFILIADOS_ENABLED ?? "0").trim() === "1";

// -----------------------------------------------------------------------------
// Níveis progressivos — PROPOSTA inicial (Etapa 3). Percentuais configuráveis e
// inativos até aprovação. `min` = mínimo de EMPRESAS pagantes distintas no nível.
// -----------------------------------------------------------------------------
export const NIVEIS_PROPOSTA = [
  { chave: "starter", nome: "Starter", min: 0, pct: 10, emblema: null },
  { chave: "bronze", nome: "Bronze", min: 3, pct: 15, emblema: null },
  { chave: "ouro", nome: "Ouro", min: 5, pct: 20, emblema: null },
  { chave: "elite", nome: "Elite", min: 10, pct: 30, emblema: null },
];

// Estados do ciclo de vida da comissão (Etapa 8).
export const ESTADOS_COMISSAO = [
  "identificada", "pendente", "em_validacao", "disponivel", "paga", "cancelada", "estornada",
];

// Métodos de atribuição (Etapa 4) — política padrão: primeiro vínculo válido.
export const ATRIBUICAO = { PRIMEIRO_VINCULO: "primeiro_vinculo", ADMIN: "ajuste_admin" };

// -----------------------------------------------------------------------------
// Dinheiro em centavos inteiros. NUNCA acumule comissões em ponto flutuante.
// -----------------------------------------------------------------------------
export function reaisParaCents(reais) {
  // Entradas vêm como REAL (reais) do schema atual. Arredonda para o centavo.
  return Math.round((Number(reais) || 0) * 100);
}
export function centsParaReais(cents) {
  return Math.round(Number(cents) || 0) / 100;
}

// Comissão em centavos: base (centavos inteiros) × percentual / 100, arredondada
// ao centavo. Tudo inteiro até a divisão final — sem erro de float acumulado.
export function comissaoCents(baseCents, percentual) {
  const base = Math.trunc(Number(baseCents) || 0);
  const pct = Number(percentual) || 0;
  if (base <= 0 || pct <= 0) return 0;
  return Math.round((base * pct) / 100);
}

// -----------------------------------------------------------------------------
// Progressão de níveis a partir do nº de empresas pagantes distintas elegíveis.
// -----------------------------------------------------------------------------
function niveisOrdenados(niveis) {
  return [...(niveis && niveis.length ? niveis : NIVEIS_PROPOSTA)].sort((a, b) => a.min - b.min);
}

export function nivelDe(qualificados, niveis = NIVEIS_PROPOSTA) {
  const q = Math.max(0, Math.trunc(Number(qualificados) || 0));
  const ord = niveisOrdenados(niveis);
  let atual = ord[0];
  for (const n of ord) if (q >= n.min) atual = n;
  return atual;
}

export function proximoNivel(qualificados, niveis = NIVEIS_PROPOSTA) {
  const q = Math.max(0, Math.trunc(Number(qualificados) || 0));
  const ord = niveisOrdenados(niveis);
  const proximo = ord.find((n) => n.min > q) || null;
  return proximo ? { ...proximo, faltam: Math.max(0, proximo.min - q) } : null;
}

// Monta a trilha para o frontend: cada nível com progresso e estado
// desbloqueado/bloqueado, sem prometer valores (depende do plano pago).
export function montarTrilha(qualificados, niveis = NIVEIS_PROPOSTA) {
  const q = Math.max(0, Math.trunc(Number(qualificados) || 0));
  const ord = niveisOrdenados(niveis);
  const atual = nivelDe(q, ord);
  return ord.map((n) => ({
    chave: n.chave,
    nome: n.nome,
    pct: n.pct,
    min: n.min,
    emblema: n.emblema || null,
    desbloqueado: q >= n.min,
    atual: n.chave === atual.chave,
  }));
}

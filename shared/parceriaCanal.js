// =============================================================================
// Parceria de Canal — regras e matemática pura.
//
// Parceiro de canal é um profissional que traz uma carteira de empresas e, em
// vez de participação societária, ganha sobre o que essas empresas pagam à
// RYCS enquanto continuam clientes:
//   - fechamento: % da primeira mensalidade de cada empresa;
//   - recorrência: % de cada mensalidade seguinte, por nível da carteira;
//   - uso: % da taxa que a RYCS cobra sobre as ações liberadas das empresas.
//
// Substitui, para quem é parceiro ativo, a regra comum de indicação (30% só da
// primeira mensalidade). Quem não é parceiro continua exatamente como antes.
//
// Os percentuais padrão moram aqui; o admin pode fixar outros por parceiro
// (negociação individual). Dinheiro sempre em centavos inteiros.
// =============================================================================
import { comissaoCents } from "./afiliados.js";

export const POLITICA_CANAL = "canal-v1";

// Percentuais padrão (em %).
export const PCT_FECHAMENTO = 50;
export const PCT_USO = 10;

// Níveis da recorrência. `min` = empresas pagantes ativas na carteira.
export const NIVEIS_CANAL = [
  { chave: "partner", nome: "Partner", min: 0, pct: 20 },
  { chave: "pro", nome: "Partner Pro", min: 25, pct: 25 },
  { chave: "ultra", nome: "Partner Ultra", min: 100, pct: 30 },
];

export const TIPOS_COMISSAO_CANAL = {
  fechamento: "Fechamento",
  recorrencia: "Recorrência",
  uso: "Uso da plataforma",
};

export const STATUS_COMISSAO_CANAL = {
  pendente: "Aguardando liberação",
  disponivel: "Liberada",
  cancelada: "Cancelada",
  estornada: "Estornada",
};

const inteiro = (n) => Math.max(0, Math.trunc(Number(n) || 0));

export function nivelCanal(pagantes) {
  const q = inteiro(pagantes);
  let atual = NIVEIS_CANAL[0];
  for (const n of NIVEIS_CANAL) if (q >= n.min) atual = n;
  return atual;
}

export function proximoNivelCanal(pagantes) {
  const q = inteiro(pagantes);
  const prox = NIVEIS_CANAL.find((n) => n.min > q);
  return prox ? { ...prox, faltam: prox.min - q } : null;
}

// Percentual informado pelo admin: número entre 0 e 100, ou null (= padrão).
export function normalizarPct(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined; // inválido
  return Math.round(n * 100) / 100;
}

// Percentuais que valem para um parceiro agora. Override do admin ganha do
// padrão; recorrência fixa ignora os níveis.
export function percentuaisDoParceiro(parceiro, pagantes) {
  const nivel = nivelCanal(pagantes);
  const fixo = parceiro?.pctRecorrencia;
  return {
    fechamento: parceiro?.pctFechamento ?? PCT_FECHAMENTO,
    recorrencia: fixo ?? nivel.pct,
    uso: parceiro?.pctUso ?? PCT_USO,
    nivel,
    recorrenciaFixa: fixo != null,
  };
}

// Comissão sobre uma cobrança de plano, em centavos.
//
// Plano semestral/anual cobra N meses de uma vez. O fechamento é sobre UMA
// mensalidade — sem isso, um plano anual pagaria 50% de 12 meses. Na primeira
// cobrança, o equivalente a um mês leva o % de fechamento e o resto leva a
// recorrência; renovações levam só a recorrência.
export function comissaoMensalidade({ valorCents, meses = 1, primeira, pctFechamento, pctRecorrencia }) {
  const base = inteiro(valorCents);
  const n = Math.max(1, inteiro(meses) || 1);
  if (base <= 0) return { cents: 0, partes: [] };
  if (!primeira) {
    const c = comissaoCents(base, pctRecorrencia);
    return { cents: c, partes: [{ tipo: "recorrencia", baseCents: base, pct: pctRecorrencia, cents: c }] };
  }
  const umMes = Math.round(base / n);
  const resto = base - umMes;
  const partes = [{ tipo: "fechamento", baseCents: umMes, pct: pctFechamento, cents: comissaoCents(umMes, pctFechamento) }];
  if (resto > 0) partes.push({ tipo: "recorrencia", baseCents: resto, pct: pctRecorrencia, cents: comissaoCents(resto, pctRecorrencia) });
  return { cents: partes.reduce((a, p) => a + p.cents, 0), partes };
}

// A comissão fica "aguardando liberação" até o 1º dia do mês seguinte ao do
// pagamento (00:00 de Brasília, UTC-3 fixo). É a janela em que um estorno
// ainda cancela a comissão sem precisar descontar do saldo do parceiro.
export function liberacaoDaComissao(ts = Date.now()) {
  const brt = new Date(Number(ts) - 3 * 3600 * 1000);
  return Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth() + 1, 1, 3, 0, 0);
}

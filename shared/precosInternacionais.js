// Cobrança internacional (Stripe, em dólar), para empresas fora do Brasil.
//
// Decisão comercial: os mesmos números da tabela em reais (shared/planos.js),
// só que em USD — Start US$ 399, Growth US$ 799… Para uma tabela própria de
// um plano, basta preencher PRECOS_USD abaixo; o anual segue o mesmo
// DESCONTO_ANUAL do Brasil.
import { PLANOS, CICLOS, descontoDoCiclo, mesesDoCiclo } from "./planos.js";

export const MOEDA_INTERNACIONAL = "USD";

// Ex.: { starter: 99, growth: 199 } — vazio = mesmos números do Brasil.
export const PRECOS_USD = {};

const arred2 = (n) => Math.round(n * 100) / 100;

export function precoInternacional(chave) {
  const p = PLANOS[chave];
  if (!p) return 0;
  return Number(PRECOS_USD[chave] ?? p.precoUSD ?? p.preco) || 0;
}

export function valorInternacionalNoCiclo(chave, ciclo = CICLOS.MENSAL) {
  const base = precoInternacional(chave);
  return arred2(base * (1 - descontoDoCiclo(ciclo)) * mesesDoCiclo(ciclo));
}

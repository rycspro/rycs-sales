// Moedas suportadas na plataforma. A empresa opera numa única moeda (travada no
// primeiro depósito) e TODA a cadeia roda nela: caixa, reserva, liquidação,
// repasse ao profissional e take rate (que é sempre a mesma %, independente da
// moeda). O Real entra/sai por Pix (Asaas); as demais, por cartão no Stripe
// (entrada) e Stripe Connect (saída/saque do profissional).
//
// A lista cobre as moedas de apresentação aceitas pelo Stripe. `digitos: 0`
// marca as moedas SEM casas decimais (o Stripe cobra no inteiro, sem × 100).

export const MOEDAS = [
  { code: "BRL", nome: "Real brasileiro", simbolo: "R$", digitos: 2 },
  { code: "USD", nome: "Dólar americano", simbolo: "US$", digitos: 2 },
  { code: "EUR", nome: "Euro", simbolo: "€", digitos: 2 },
  { code: "GBP", nome: "Libra esterlina", simbolo: "£", digitos: 2 },
  { code: "INR", nome: "Rúpia indiana", simbolo: "₹", digitos: 2 },
  { code: "CAD", nome: "Dólar canadense", simbolo: "C$", digitos: 2 },
  { code: "AUD", nome: "Dólar australiano", simbolo: "A$", digitos: 2 },
  { code: "NZD", nome: "Dólar neozelandês", simbolo: "NZ$", digitos: 2 },
  { code: "MXN", nome: "Peso mexicano", simbolo: "MX$", digitos: 2 },
  { code: "ARS", nome: "Peso argentino", simbolo: "AR$", digitos: 2 },
  { code: "CLP", nome: "Peso chileno", simbolo: "CLP$", digitos: 0 },
  { code: "COP", nome: "Peso colombiano", simbolo: "CO$", digitos: 2 },
  { code: "PEN", nome: "Sol peruano", simbolo: "S/", digitos: 2 },
  { code: "UYU", nome: "Peso uruguaio", simbolo: "$U", digitos: 2 },
  { code: "CHF", nome: "Franco suíço", simbolo: "CHF", digitos: 2 },
  { code: "SEK", nome: "Coroa sueca", simbolo: "kr", digitos: 2 },
  { code: "NOK", nome: "Coroa norueguesa", simbolo: "kr", digitos: 2 },
  { code: "DKK", nome: "Coroa dinamarquesa", simbolo: "kr", digitos: 2 },
  { code: "PLN", nome: "Zloty polonês", simbolo: "zł", digitos: 2 },
  { code: "CZK", nome: "Coroa tcheca", simbolo: "Kč", digitos: 2 },
  { code: "HUF", nome: "Forint húngaro", simbolo: "Ft", digitos: 2 },
  { code: "RON", nome: "Leu romeno", simbolo: "lei", digitos: 2 },
  { code: "BGN", nome: "Lev búlgaro", simbolo: "лв", digitos: 2 },
  { code: "TRY", nome: "Lira turca", simbolo: "₺", digitos: 2 },
  { code: "ZAR", nome: "Rand sul-africano", simbolo: "R", digitos: 2 },
  { code: "AED", nome: "Dirham dos Emirados", simbolo: "د.إ", digitos: 2 },
  { code: "SAR", nome: "Riyal saudita", simbolo: "﷼", digitos: 2 },
  { code: "ILS", nome: "Shekel israelense", simbolo: "₪", digitos: 2 },
  { code: "JPY", nome: "Iene japonês", simbolo: "¥", digitos: 0 },
  { code: "CNY", nome: "Yuan chinês", simbolo: "¥", digitos: 2 },
  { code: "HKD", nome: "Dólar de Hong Kong", simbolo: "HK$", digitos: 2 },
  { code: "SGD", nome: "Dólar de Singapura", simbolo: "S$", digitos: 2 },
  { code: "KRW", nome: "Won sul-coreano", simbolo: "₩", digitos: 0 },
  { code: "MYR", nome: "Ringgit malaio", simbolo: "RM", digitos: 2 },
  { code: "THB", nome: "Baht tailandês", simbolo: "฿", digitos: 2 },
  { code: "IDR", nome: "Rupia indonésia", simbolo: "Rp", digitos: 2 },
  { code: "PHP", nome: "Peso filipino", simbolo: "₱", digitos: 2 },
  { code: "VND", nome: "Dong vietnamita", simbolo: "₫", digitos: 0 },
];

export const MOEDA_PADRAO = "BRL";

const POR_CODE = Object.fromEntries(MOEDAS.map((m) => [m.code, m]));

// Normaliza qualquer entrada para um code válido (default: BRL).
export const normalizarMoeda = (v) => {
  const c = String(v || "").toUpperCase();
  return POR_CODE[c] ? c : MOEDA_PADRAO;
};

export const moedaDe = (code) => POR_CODE[normalizarMoeda(code)];

export const ehMoedaValida = (code) => !!POR_CODE[String(code || "").toUpperCase()];

// Moedas sem casa decimal (o Stripe cobra o valor inteiro, sem multiplicar por 100).
export const semCentavos = (code) => moedaDe(code).digitos === 0;

// Valor → menor unidade que o Stripe espera (centavos, ou o inteiro quando a
// moeda não tem casa decimal).
export const paraMenorUnidade = (valor, code) =>
  semCentavos(code) ? Math.round(Number(valor) || 0) : Math.round((Number(valor) || 0) * 100);

// Formata um valor na moeda, em pt-BR, usando o Intl (cai no símbolo próprio da lista).
export function formatarMoeda(valor, code) {
  const m = moedaDe(code);
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency", currency: m.code,
      minimumFractionDigits: m.digitos, maximumFractionDigits: m.digitos,
    }).format(Number(valor) || 0);
  } catch {
    const n = (Number(valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: m.digitos, maximumFractionDigits: m.digitos });
    return `${m.simbolo} ${n}`;
  }
}

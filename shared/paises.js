// Países suportados no cadastro da empresa. O país determina a moeda em que
// a empresa opera (planos + campanhas) e o gateway de cobrança: BRL → Asaas,
// resto → Stripe. Mantém a lista enxuta (principais mercados); outros países
// caem no fallback "Outro" com USD.

export const PAISES = [
  { code: "BR", nome: "Brasil",            moeda: "BRL", locales: ["pt-BR", "pt"] },
  { code: "US", nome: "Estados Unidos",    moeda: "USD", locales: ["en", "en-US"] },
  { code: "PT", nome: "Portugal",          moeda: "EUR", locales: ["pt-PT"] },
  { code: "ES", nome: "Espanha",           moeda: "EUR", locales: ["es-ES"] },
  { code: "MX", nome: "México",            moeda: "MXN", locales: ["es-MX"] },
  { code: "AR", nome: "Argentina",         moeda: "ARS", locales: ["es-AR"] },
  { code: "CL", nome: "Chile",             moeda: "CLP", locales: ["es-CL"] },
  { code: "CO", nome: "Colômbia",          moeda: "COP", locales: ["es-CO"] },
  { code: "PE", nome: "Peru",              moeda: "PEN", locales: ["es-PE"] },
  { code: "UY", nome: "Uruguai",           moeda: "UYU", locales: ["es-UY"] },
  { code: "CA", nome: "Canadá",            moeda: "CAD", locales: ["en-CA", "fr-CA"] },
  { code: "GB", nome: "Reino Unido",       moeda: "GBP", locales: ["en-GB"] },
  { code: "FR", nome: "França",            moeda: "EUR", locales: ["fr", "fr-FR"] },
  { code: "DE", nome: "Alemanha",          moeda: "EUR", locales: ["de", "de-DE"] },
  { code: "IT", nome: "Itália",            moeda: "EUR", locales: ["it", "it-IT"] },
  { code: "IN", nome: "Índia",             moeda: "INR", locales: ["hi", "hi-IN", "en-IN"] },
  { code: "AU", nome: "Austrália",         moeda: "AUD", locales: ["en-AU"] },
  { code: "NZ", nome: "Nova Zelândia",     moeda: "NZD", locales: ["en-NZ"] },
  { code: "JP", nome: "Japão",             moeda: "JPY", locales: ["ja"] },
  { code: "CN", nome: "China",             moeda: "CNY", locales: ["zh", "zh-CN"] },
  { code: "KR", nome: "Coreia do Sul",     moeda: "KRW", locales: ["ko"] },
  { code: "CH", nome: "Suíça",             moeda: "CHF", locales: ["de-CH"] },
  { code: "SE", nome: "Suécia",            moeda: "SEK", locales: ["sv"] },
  { code: "NO", nome: "Noruega",           moeda: "NOK", locales: ["no", "nb"] },
  { code: "DK", nome: "Dinamarca",         moeda: "DKK", locales: ["da"] },
  { code: "PL", nome: "Polônia",           moeda: "PLN", locales: ["pl"] },
  { code: "TR", nome: "Turquia",           moeda: "TRY", locales: ["tr"] },
  { code: "ZA", nome: "África do Sul",     moeda: "ZAR", locales: ["af", "en-ZA"] },
  { code: "AE", nome: "Emirados Árabes",   moeda: "AED", locales: ["ar-AE"] },
  { code: "SA", nome: "Arábia Saudita",    moeda: "SAR", locales: ["ar-SA"] },
  { code: "IL", nome: "Israel",            moeda: "ILS", locales: ["he"] },
  { code: "RU", nome: "Rússia",            moeda: "RUB", locales: ["ru"] },
  { code: "OUTRO", nome: "Outro país",     moeda: "USD", locales: [] },
];

// Bandeira (emoji) a partir do código ISO-3166 de 2 letras (BR, US, DE…),
// montada com os símbolos indicadores regionais Unicode. Serve para mostrar a
// bandeira ao lado do nome do país em vez de um ícone de localização genérico —
// menos ruído visual e identificação imediata do país. Código "OUTRO" ou
// inválido cai num globo neutro.
export function bandeiraPais(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🌐";
  const base = 0x1F1E6; // 🇦 (Regional Indicator Symbol Letter A)
  return String.fromCodePoint(base + (c.charCodeAt(0) - 65), base + (c.charCodeAt(1) - 65));
}

const POR_CODE = Object.fromEntries(PAISES.map((p) => [p.code, p]));
const POR_LOCALE = {};
for (const p of PAISES) for (const l of p.locales) POR_LOCALE[l.toLowerCase()] = p.code;

export const paisPorCode = (code) => POR_CODE[String(code || "").toUpperCase()] || null;

// Dado um locale (ex. "pt-BR"), devolve o país padrão. Cai no exato primeiro;
// se não achar, tenta só a parte de idioma ("pt" para "pt-XX"); senão, Brasil.
export function paisPadraoPorLocale(locale) {
  const l = String(locale || "").toLowerCase();
  if (POR_LOCALE[l]) return POR_LOCALE[l];
  const base = l.split("-")[0];
  if (POR_LOCALE[base]) return POR_LOCALE[base];
  return "BR";
}

export const moedaDoPais = (code) => paisPorCode(code)?.moeda || "USD";

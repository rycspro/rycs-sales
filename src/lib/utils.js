// Moeda e locale padrão da UI. Atualizados pelo App.jsx a partir de emp.moeda
// quando a empresa carrega — assim toda chamada `money()` reflete a moeda da
// empresa, sem precisar passar o parâmetro em centenas de pontos de uso.
let MOEDA_UI = "BRL";
let LOCALE_UI = "pt-BR";
const LOCALE_POR_MOEDA = {
  BRL: "pt-BR", USD: "en-US", EUR: "de-DE", GBP: "en-GB", CAD: "en-CA",
  AUD: "en-AU", NZD: "en-NZ", MXN: "es-MX", ARS: "es-AR", CLP: "es-CL",
  COP: "es-CO", PEN: "es-PE", UYU: "es-UY", CHF: "de-CH", SEK: "sv-SE",
  NOK: "nb-NO", DKK: "da-DK", PLN: "pl-PL", TRY: "tr-TR", ZAR: "en-ZA",
  AED: "ar-AE", SAR: "ar-SA", ILS: "he-IL", JPY: "ja-JP", CNY: "zh-CN",
  HKD: "zh-HK", SGD: "en-SG", KRW: "ko-KR", MYR: "ms-MY", THB: "th-TH",
  IDR: "id-ID", PHP: "en-PH", VND: "vi-VN", INR: "hi-IN", RUB: "ru-RU",
  HUF: "hu-HU", CZK: "cs-CZ", RON: "ro-RO", BGN: "bg-BG",
};

export function setMoedaUi(moeda) {
  const m = String(moeda || "BRL").toUpperCase();
  MOEDA_UI = m;
  LOCALE_UI = LOCALE_POR_MOEDA[m] || "en-US";
}

export const money = (n, moeda) => {
  const m = String(moeda || MOEDA_UI).toUpperCase();
  const l = LOCALE_POR_MOEDA[m] || LOCALE_UI;
  try { return (Number(n) || 0).toLocaleString(l, { style: "currency", currency: m }); }
  catch { return `${m} ${(Number(n) || 0).toFixed(2)}`; }
};

export const uid = () => Math.random().toString(36).slice(2, 9);

export const agora = () => Date.now();

export const dataCurta = (ts) =>
  new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Moeda e locale padrão da UI. Atualizados pelo App.jsx a partir de emp.moeda
// quando a empresa carrega — assim toda chamada `money()` reflete a moeda da
// empresa, sem precisar passar o parâmetro em centenas de pontos de uso.
let MOEDA_UI = "BRL";

export function setMoedaUi(moeda) {
  MOEDA_UI = String(moeda || "BRL").toUpperCase();
}

// BRL → pt-BR (R$ 399,00). Resto → en-US pra ter prefixos distintos
// (MX$, A$, C$, HK$, CN¥, ₹…) sem ambiguidade entre moedas tipo dólar.
const localeDaMoeda = (m) => m === "BRL" ? "pt-BR" : "en-US";

export const money = (n, moeda) => {
  const m = String(moeda || MOEDA_UI).toUpperCase();
  try { return (Number(n) || 0).toLocaleString(localeDaMoeda(m), { style: "currency", currency: m }); }
  catch { return `${m} ${(Number(n) || 0).toFixed(2)}`; }
};

export const uid = () => Math.random().toString(36).slice(2, 9);

export const agora = () => Date.now();

export const dataCurta = (ts) =>
  new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

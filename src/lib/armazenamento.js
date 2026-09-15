// Acesso a localStorage que nunca lança.
//
// Ler `localStorage` parece inofensivo e não é: o próprio ACESSO à API dispara
// exceção em vários contextos reais — Safari em navegação privada, navegador
// com dados de site bloqueados, webview dentro de aplicativo (Instagram,
// Facebook, WhatsApp) e Android WebView com armazenamento desligado.
//
// Isso derrubou o app em produção: a leitura do tema estava no primeiro estado
// do componente raiz, sem proteção. Quando a exceção acontecia, a raiz falhava
// na renderização e o app inteiro não montava — tela em branco, num navegador
// em que "não abre" e em outro abre normalmente.
//
// Preferência de interface é conveniência. Nunca deve custar o app inteiro.

let disponivel = null;

function testar() {
  if (disponivel !== null) return disponivel;
  try {
    const chave = "__rycs_teste__";
    window.localStorage.setItem(chave, "1");
    window.localStorage.removeItem(chave);
    disponivel = true;
  } catch {
    disponivel = false;
  }
  return disponivel;
}

export function ler(chave, padrao = null) {
  if (!testar()) return padrao;
  try {
    const valor = window.localStorage.getItem(chave);
    return valor === null ? padrao : valor;
  } catch {
    return padrao;
  }
}

export function gravar(chave, valor) {
  if (!testar()) return false;
  try {
    // Cota estourada também lança, mesmo com o armazenamento disponível.
    window.localStorage.setItem(chave, String(valor));
    return true;
  } catch {
    return false;
  }
}

export function remover(chave) {
  if (!testar()) return false;
  try {
    window.localStorage.removeItem(chave);
    return true;
  } catch {
    return false;
  }
}

export function lerJson(chave, padrao = null) {
  const bruto = ler(chave, null);
  if (bruto === null) return padrao;
  try {
    return JSON.parse(bruto);
  } catch {
    return padrao;
  }
}

export function gravarJson(chave, valor) {
  try {
    return gravar(chave, JSON.stringify(valor));
  } catch {
    return false;
  }
}

export const armazenamentoDisponivel = () => testar();

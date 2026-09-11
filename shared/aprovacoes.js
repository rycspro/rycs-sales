// Regras de aprovação automática da empresa.
//
// A decisão automática NUNCA libera dinheiro: ela substitui apenas a conferência
// da empresa, levando a ação de "revisão manual" para "conferida". O repasse
// continua passando pela plataforma, como em qualquer ação conferida à mão.
//
// O mesmo arquivo é lido pelo servidor, que decide, e pela tela, que explica —
// duas cópias da regra acabariam divergindo, e a empresa veria na tela um
// critério diferente do que roda de verdade.

export const VERSAO_REGRAS = 1;

// Ações que jamais são aprovadas sozinhas. Venda move o maior valor da
// plataforma e é o alvo óbvio de fraude; conferir à mão é barato perto disso.
export const SEMPRE_MANUAL = ["venda"];

export const PADRAO = {
  ativo: false,
  tipos: [],              // ações elegíveis à decisão automática
  confiancaMinima: 85,    // abaixo disso, revisão humana
  valorMaximo: 50,        // teto por ação, em reais
  amostragem: 10,         // % das elegíveis que continua indo para revisão
};

export function normalizarRegras(bruto) {
  const r = { ...PADRAO, ...(bruto || {}) };
  return {
    ativo: !!r.ativo,
    tipos: (Array.isArray(r.tipos) ? r.tipos : []).filter((t) => !SEMPRE_MANUAL.includes(t)),
    confiancaMinima: Math.min(100, Math.max(50, Math.round(Number(r.confiancaMinima) || PADRAO.confiancaMinima))),
    valorMaximo: Math.max(0, Number(r.valorMaximo) || 0),
    amostragem: Math.min(100, Math.max(0, Math.round(Number(r.amostragem) || 0))),
  };
}

// Por que a ação foi ou não aprovada sozinha. O motivo volta para a trilha de
// auditoria e para a tela: "não passou" sem dizer o porquê é o tipo de decisão
// que ninguém consegue contestar depois.
//
// A regra age sobre RISCO e CONFIANÇA, não sobre um veredito de aprovação: a
// triagem interna nunca emite "aprovado" — ela classifica o risco e sempre
// devolve para conferência. O que a empresa configura aqui é de quem é essa
// conferência quando o risco é baixo, não se ela existe.
export function avaliarRegras({ regras, tipo, valor, confianca, veredito, risco, sorteio }) {
  const r = normalizarRegras(regras);

  if (!r.ativo) return { automatica: false, motivo: "Aprovação automática desligada nesta empresa.", regras: r };
  if (veredito === "recusado") return { automatica: false, motivo: "Triagem recusou a evidência.", regras: r };
  if (risco && risco !== "baixo")
    return { automatica: false, motivo: `Triagem classificou o risco como ${risco}.`, regras: r };
  if (SEMPRE_MANUAL.includes(tipo)) return { automatica: false, motivo: "Este tipo de ação exige conferência humana.", regras: r };
  if (!r.tipos.includes(tipo)) return { automatica: false, motivo: "Tipo de ação fora da lista elegível.", regras: r };
  if (Number(confianca) < r.confiancaMinima)
    return { automatica: false, motivo: `Confiança ${confianca}% abaixo do mínimo de ${r.confiancaMinima}%.`, regras: r };
  if (r.valorMaximo > 0 && Number(valor) > r.valorMaximo)
    return { automatica: false, motivo: `Valor acima do teto automático de R$ ${r.valorMaximo.toFixed(2)}.`, regras: r };

  // Amostragem: uma fatia das elegíveis continua indo para revisão humana.
  // Sem isso ninguém olharia mais nenhuma ação aprovada sozinha, e um erro de
  // regra ficaria invisível até virar prejuízo.
  const sorte = Number.isFinite(sorteio) ? sorteio : Math.random() * 100;
  if (r.amostragem > 0 && sorte < r.amostragem)
    return { automatica: false, motivo: `Sorteada para amostragem manual (${r.amostragem}% das elegíveis).`, regras: r, amostrada: true };

  return {
    automatica: true,
    motivo: `Risco baixo, confiança ${confianca}% ≥ ${r.confiancaMinima}% e valor dentro do teto de R$ ${r.valorMaximo.toFixed(2)}.`,
    regras: r,
  };
}

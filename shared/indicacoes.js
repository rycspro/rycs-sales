// Member Get Member.
//
// A recompensa nunca é paga por cadastro. Ela só existe quando o indicado
// produz atividade real — primeira ação aprovada, no caso do profissional, ou
// primeiro depósito confirmado, no caso da empresa. Pagar por inscrição
// transformaria o programa em recrutamento e abriria a porta para farmar
// contas falsas.

export const RECOMPENSAS = {
  // quem indicou → o que ganha, e o que o indicado precisa fazer
  vendedor: {
    vendedor: { valor: 25, comoRecebe: "saldo disponível" },
    empresa: { valor: 100, comoRecebe: "saldo disponível" },
  },
  empresa: {
    vendedor: { valor: 25, comoRecebe: "caixa de campanha" },
    empresa: { valor: 150, comoRecebe: "caixa de campanha" },
  },
};

export const GATILHOS = {
  vendedor: "primeira ação aprovada",
  empresa: "primeiro depósito confirmado",
};

export function recompensaDe(papelIndicador, papelIndicado) {
  return RECOMPENSAS[papelIndicador]?.[papelIndicado] || null;
}

// Código curto, sem caracteres ambíguos (0/O, 1/I/L) para funcionar quando
// alguém dita por telefone ou digita de um print.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function gerarCodigo(tamanho = 7) {
  let s = "";
  for (let i = 0; i < tamanho; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return s;
}

export const normalizarCodigo = (c) =>
  String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

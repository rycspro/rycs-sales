// Member Get Member.
//
// A recompensa nunca é paga por cadastro. Ela só existe quando o indicado
// produz atividade real — primeira ação aprovada, no caso do profissional, ou
// primeiro depósito confirmado, no caso da empresa. Pagar por inscrição
// transformaria o programa em recrutamento e abriria a porta para farmar
// contas falsas.

// Profissional que indica empresa (regra 'v2'): duas recompensas, cada uma
// paga uma única vez — a ativação (cadastro da empresa aprovado pela RYCS) e
// um percentual da primeira mensalidade quando ela assina um plano pago.
export const VALOR_EMPRESA_ATIVA = 1.5;
export const PCT_PRIMEIRA_MENSALIDADE = 0.3;

// Profissional que indica profissionais: bônus a cada bloco de indicados que
// completam o perfil. Indicado que só se cadastra não conta.
export const BONUS_INDICACAO_PROFISSIONAIS = { bloco: 10, valor: 3 };

export const RECOMPENSAS = {
  // quem indicou → o que ganha, e o que o indicado precisa fazer
  vendedor: {
    empresa: {
      valor: VALOR_EMPRESA_ATIVA,
      percentual: PCT_PRIMEIRA_MENSALIDADE,
      comoRecebe: "saldo disponível",
      descricao: `R$ ${VALOR_EMPRESA_ATIVA.toFixed(2).replace(".", ",")} quando o cadastro da empresa é aprovado, e mais ${Math.round(PCT_PRIMEIRA_MENSALIDADE * 100)}% da primeira mensalidade quando ela assina um plano pago.`,
    },
    vendedor: {
      valor: BONUS_INDICACAO_PROFISSIONAIS.valor,
      bloco: BONUS_INDICACAO_PROFISSIONAIS.bloco,
      comoRecebe: "saldo disponível",
      descricao: `R$ ${BONUS_INDICACAO_PROFISSIONAIS.valor.toFixed(2).replace(".", ",")} a cada ${BONUS_INDICACAO_PROFISSIONAIS.bloco} profissionais indicados que completam o perfil.`,
    },
  },
  empresa: {
    empresa: { valor: 150, comoRecebe: "caixa de campanha" },
  },
};

export const GATILHOS = {
  empresa: "pagamento confirmado de um plano elegível",
  vendedor: "o indicado completar o perfil",
};

export function recompensaDe(papelIndicador, papelIndicado) {
  return RECOMPENSAS[papelIndicador]?.[papelIndicado] || null;
}

// Valor da recompensa sobre a primeira mensalidade de um plano (regra 'v2').
export const valorPrimeiraMensalidade = (precoMensal) =>
  Math.round((Number(precoMensal) || 0) * PCT_PRIMEIRA_MENSALIDADE * 100) / 100;

// Quantos bônus de bloco cabem num total de indicados qualificados.
export const blocosDeBonus = (qualificados) =>
  Math.floor((Number(qualificados) || 0) / BONUS_INDICACAO_PROFISSIONAIS.bloco);

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

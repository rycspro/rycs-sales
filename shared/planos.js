// Planos de assinatura da empresa contratante.
//
// A assinatura é separada do caixa de campanha: o plano dá acesso e limites,
// o caixa paga as ações. O take rate cai conforme o plano — é o que torna
// a assinatura vantajosa para quem opera volume.

export const PLANOS = {
  free: {
    nome: "Free",
    preco: 0,
    takeRate: 0.12,
    limites: { campanhasAtivas: 1, vendedores: 3, destaque: false },
    inclui: [
      "1 campanha ativa",
      "Até 3 profissionais",
      "Auditoria por IA",
      "Take rate de 12%",
    ],
  },
  starter: {
    nome: "Starter",
    preco: 200,
    takeRate: 0.10,
    limites: { campanhasAtivas: 3, vendedores: 10, destaque: false },
    inclui: [
      "3 campanhas ativas",
      "Até 10 profissionais",
      "Take rate de 10%",
      "Relatórios de campanha",
    ],
  },
  growth: {
    nome: "Growth",
    preco: 697,
    takeRate: 0.08,
    limites: { campanhasAtivas: 10, vendedores: 40, destaque: true },
    inclui: [
      "10 campanhas ativas",
      "Até 40 profissionais",
      "Take rate de 8%",
      "Destaque na vitrine",
      "Exigir profissionais certificados",
    ],
  },
  scale: {
    nome: "Scale",
    preco: 2700,
    takeRate: 0.06,
    limites: { campanhasAtivas: 50, vendedores: 200, destaque: true },
    inclui: [
      "50 campanhas ativas",
      "Até 200 profissionais",
      "Take rate de 6%",
      "Destaque na vitrine",
      "Acesso antecipado a novos recursos",
    ],
  },
};

export const ORDEM_PLANOS = ["free", "starter", "growth", "scale"];

export const PLANO_PADRAO = "free";

export const planoDe = (chave) => PLANOS[chave] || PLANOS[PLANO_PADRAO];

// O take rate efetivo vem do plano. Sem assinatura ativa, vale o Free.
export const takeRateDoPlano = (chave) => planoDe(chave).takeRate;

export function dentroDoLimite(chave, recurso, quantidadeAtual) {
  const limite = planoDe(chave).limites[recurso];
  if (typeof limite !== "number") return true;
  return quantidadeAtual < limite;
}

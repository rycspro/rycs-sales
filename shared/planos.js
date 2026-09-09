// Planos de assinatura da empresa contratante.
//
// A assinatura é separada do caixa de campanha: o plano dá acesso e limites,
// o caixa paga as ações. O take rate cai conforme o plano — é o que torna
// a assinatura vantajosa para quem opera volume.

export const PLANOS = {
  free: {
    nome: "Sandbox",
    preco: 0,
    takeRate: 0.12,
    limites: { campanhasAtivas: 0, vendedores: 0, destaque: false },
    inclui: [
      "Configuração da conta",
      "Campanhas em rascunho",
      "Sem publicação de campanha",
      "Take rate de 12%",
    ],
  },
  starter: {
    nome: "Start",
    preco: 499,
    takeRate: 0.12,
    limites: { campanhasAtivas: 1, vendedores: 5, destaque: false },
    inclui: [
      "1 campanha ativa",
      "Até 5 profissionais ativos",
      "Take rate de 12%",
      "Painel operacional",
    ],
  },
  growth: {
    nome: "Growth",
    preco: 999,
    takeRate: 0.09,
    limites: { campanhasAtivas: 3, vendedores: 20, destaque: true },
    inclui: [
      "3 campanhas ativas",
      "Até 20 profissionais ativos",
      "Take rate de 9%",
      "Destaque na vitrine",
      "Exigir profissionais certificados",
    ],
  },
  scale: {
    nome: "Scale",
    preco: 2700,
    takeRate: 0.07,
    limites: { campanhasAtivas: 10, vendedores: 100, destaque: true },
    inclui: [
      "10 campanhas ativas",
      "Até 100 profissionais ativos",
      "Take rate de 7%",
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

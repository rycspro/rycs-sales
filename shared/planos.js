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
    takeRate: 0.30,
    limites: { campanhasAtivas: 1, vendedores: 5, destaque: false },
    inclui: [
      "1 campanha ativa",
      "Até 5 profissionais ativos",
      "Take rate de 30%",
      "Painel operacional",
    ],
  },
  growth: {
    nome: "Growth",
    preco: 999.90,
    takeRate: 0.15,
    limites: { campanhasAtivas: 3, vendedores: 20, destaque: true },
    inclui: [
      "3 campanhas ativas",
      "Até 20 profissionais ativos",
      "Take rate de 15%",
      "Destaque na vitrine",
      "Exigir profissionais certificados",
    ],
  },
  // Plano concedido pela plataforma, não vendido no checkout.
  //
  // Empresa premium não paga mensalidade — por isso preço zero e sem limite de
  // campanhas ou profissionais. O take rate repete o do Free, que já era o
  // efetivo de quem era premium antes deste registro existir: premium isenta
  // de assinatura, não de comissão sobre ação entregue.
  //
  // Fora de ORDEM_PLANOS de propósito: não aparece em /plans nem na vitrine de
  // planos da empresa. Quem concede é o admin, na tela de Cobrança e Acesso.
  premium: {
    nome: "Premium",
    preco: 0,
    takeRate: 0.12,
    limites: { campanhasAtivas: Infinity, vendedores: Infinity, destaque: true },
    inclui: [
      "Sem mensalidade",
      "Campanhas ativas sem limite",
      "Profissionais sem limite",
      "Destaque na vitrine",
      "Pagamento de planos opcional",
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

// Pix Automático: o Asaas só registra a autorização junto com um primeiro Pix
// pago na hora. A RYCS cobra este valor simbólico no cadastro; a mensalidade
// do plano é debitada depois, automaticamente (decidido com o dono do produto
// em 2026-10-15).
export const TAXA_ATIVACAO_PIX_AUTOMATICO = 1;

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

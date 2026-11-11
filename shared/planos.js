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
      "Taxa por movimentações de 12%",
    ],
  },
  starter: {
    nome: "Start",
    preco: 399,
    takeRate: 0.20,
    trial: false,
    limites: { campanhasAtivas: 1, vendedores: 5, destaque: false },
    inclui: [
      "1 campanha ativa",
      "Até 5 profissionais ativos",
      "Taxa por movimentações de 20%",
      "Painel operacional completo",
    ],
  },
  growth: {
    nome: "Growth",
    preco: 799,
    takeRate: 0.15,
    trial: true,
    limites: { campanhasAtivas: 10, vendedores: 50, destaque: false },
    inclui: [
      "10 campanhas ativas",
      "Até 50 profissionais ativos",
      "Taxa por movimentações de 15%",
      "Painel operacional completo",
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
    preco: 1499,
    takeRate: 0.10,
    trial: true,
    ia: true,
    limites: { campanhasAtivas: 25, vendedores: 250, destaque: true },
    inclui: [
      "25 campanhas ativas",
      "Até 250 profissionais ativos",
      "Taxa por movimentações de 10%",
      "Campanhas com IA",
      "Destaque na vitrine",
      "Painel operacional completo",
    ],
  },
  // Plano topo, vendido no checkout (chave própria para não colidir com o
  // "premium" concedido pelo admin, que é isenção e fica fora da vitrine).
  enterprise: {
    nome: "Premium",
    preco: 3000,
    takeRate: 0.05,
    trial: true,
    ia: true,
    limites: { campanhasAtivas: Infinity, vendedores: Infinity, destaque: true },
    inclui: [
      "Campanhas ilimitadas",
      "Profissionais ilimitados",
      "Taxa por movimentações de 5%",
      "Campanhas com IA",
      "Assistente inteligente Jarvis",
      "Destaque na vitrine",
      "Suporte prioritário",
      "Painel operacional completo",
    ],
  },
};

// Pix Automático: o Asaas só registra a autorização junto com um primeiro Pix
// pago na hora. A RYCS cobra este valor simbólico no cadastro; a mensalidade
// do plano é debitada depois, automaticamente (decidido com o dono do produto
// em 2026-10-15).
export const TAXA_ATIVACAO_PIX_AUTOMATICO = 1;

// Cobrança anual: mesma mensalidade com desconto, cobrada de uma vez por 12
// meses. O percentual mora aqui — nunca fixado na tela — para que mudar a
// oferta não exija tocar em componente.
export const DESCONTO_ANUAL = 0.30;

export const CICLOS = { MENSAL: "MENSAL", ANUAL: "ANUAL" };

const arred2 = (n) => Math.round(n * 100) / 100;

// Mensalidade exibida em cada ciclo (no anual, já com o desconto aplicado).
export function mensalidadeNoCiclo(chave, ciclo = CICLOS.MENSAL) {
  const preco = planoDe(chave).preco;
  return ciclo === CICLOS.ANUAL ? arred2(preco * (1 - DESCONTO_ANUAL)) : preco;
}

// Valor efetivamente cobrado: no anual, 12 mensalidades com desconto, de uma vez.
export function valorCobradoNoCiclo(chave, ciclo = CICLOS.MENSAL) {
  const preco = planoDe(chave).preco;
  return ciclo === CICLOS.ANUAL ? arred2(mensalidadeNoCiclo(chave, ciclo) * 12) : preco;
}

export const ORDEM_PLANOS = ["free", "starter", "growth", "scale", "enterprise"];

export const PLANO_PADRAO = "free";

export const planoDe = (chave) => PLANOS[chave] || PLANOS[PLANO_PADRAO];

// O take rate efetivo vem do plano. Sem assinatura ativa, vale o Free.
export const takeRateDoPlano = (chave) => planoDe(chave).takeRate;

// Criação de campanha com IA só nos planos que a incluem (Scale e Premium).
export const planoTemIA = (chave) => !!PLANOS[chave]?.ia;
export const PLANOS_COM_IA = ORDEM_PLANOS.filter((k) => PLANOS[k]?.ia).map((k) => PLANOS[k].nome);

export function dentroDoLimite(chave, recurso, quantidadeAtual) {
  const limite = planoDe(chave).limites[recurso];
  if (typeof limite !== "number") return true;
  return quantidadeAtual < limite;
}

// Destaque da empresa na vitrine: contratado à parte, independente do plano
// adquirido. Quatro versões; a empresa ativa uma e cancela quando quiser. O
// preço mora aqui para não ficar fixado na tela.
export const DESTAQUES = {
  selo: {
    nome: "Selo de empresa em destaque",
    preco: 49,
    itens: [
      "Selo visual de destaque no seu perfil",
      "Diferencia sua empresa em todas as listagens",
    ],
  },
  busca: {
    nome: "Prioridade na busca",
    preco: 90,
    itens: [
      "Sua empresa sobe nos resultados de busca",
      "Mais visível quando o profissional procura campanhas",
    ],
  },
  topo: {
    nome: "Destaque no topo",
    preco: 140,
    itens: [
      "Sua empresa aparece no topo da lista de campanhas",
      "Primeira empresa que o profissional vê",
    ],
  },
  total: {
    nome: "Destaque total",
    preco: 190,
    itens: [
      "Selo de destaque no perfil",
      "Prioridade na busca",
      "Topo da lista de campanhas",
      "Tudo em um só pacote",
    ],
  },
};

export const ORDEM_DESTAQUES = ["selo", "busca", "topo", "total"];

export const destaqueDe = (chave) => DESTAQUES[chave] || null;

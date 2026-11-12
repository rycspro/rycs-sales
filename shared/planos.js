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

// Cobrança por período: mesma mensalidade com desconto, cobrada de uma vez por
// N meses. Os percentuais moram aqui — nunca fixados na tela — para que mudar a
// oferta não exija tocar em componente.
export const DESCONTO_ANUAL = 0.30;
export const DESCONTO_SEMESTRAL = 0.15;

export const CICLOS = { MENSAL: "MENSAL", SEMESTRAL: "SEMESTRAL", ANUAL: "ANUAL" };

// Meses cobrados de uma vez e desconto aplicado em cada ciclo. Mensal é a base
// (1 mês, sem desconto); semestral e anual cobram adiantado com desconto.
export const MESES_CICLO = { MENSAL: 1, SEMESTRAL: 6, ANUAL: 12 };
export const DESCONTO_CICLO = { MENSAL: 0, SEMESTRAL: DESCONTO_SEMESTRAL, ANUAL: DESCONTO_ANUAL };

export const mesesDoCiclo = (ciclo) => MESES_CICLO[ciclo] ?? 1;
export const descontoDoCiclo = (ciclo) => DESCONTO_CICLO[ciclo] ?? 0;

// Normaliza qualquer entrada de ciclo para uma chave válida (default: mensal).
export const normalizarCiclo = (v) => {
  const c = String(v || "").toUpperCase();
  return CICLOS[c] ? c : CICLOS.MENSAL;
};

const arred2 = (n) => Math.round(n * 100) / 100;

// Mensalidade exibida em cada ciclo (nos ciclos com desconto, já aplicado).
export function mensalidadeNoCiclo(chave, ciclo = CICLOS.MENSAL) {
  const preco = planoDe(chave).preco;
  return arred2(preco * (1 - descontoDoCiclo(ciclo)));
}

// Valor efetivamente cobrado: as N mensalidades do ciclo, com desconto, de uma vez.
export function valorCobradoNoCiclo(chave, ciclo = CICLOS.MENSAL) {
  return arred2(mensalidadeNoCiclo(chave, ciclo) * mesesDoCiclo(ciclo));
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
// Planos de destaque da empresa na vitrine. `prioridade` define a hierarquia de
// posicionamento (maior = aparece antes) nas campanhas ativas e na busca; sem
// plano = prioridade 0. As chaves internas (selo/busca/topo/total) são mantidas
// por compatibilidade com destaqueTipo já gravado — o que muda é a apresentação.
export const DESTAQUES = {
  selo: {
    nome: "Destaque",
    preco: 39.9,
    prioridade: 1,
    frase: "Seja encontrado antes da concorrência.",
    itens: [
      "Prioridade de exibição na página de campanhas ativas, acima das empresas sem destaque",
      "Posicionamento preferencial nos resultados de busca de campanhas",
    ],
  },
  busca: {
    nome: "Destaque Plus",
    preco: 59.9,
    prioridade: 2,
    frase: "Leve suas oportunidades diretamente aos profissionais certos.",
    itens: [
      "Todos os benefícios do Destaque",
      "Prioridade superior ao plano Destaque nas campanhas ativas",
      "Disparo personalizado de e-mails para profissionais compatíveis com sua marca e campanhas",
    ],
  },
  topo: {
    nome: "Destaque Pro",
    preco: 99.9,
    prioridade: 3,
    popular: true,
    frase: "Descubra os melhores profissionais antes das outras empresas.",
    itens: [
      "Todos os benefícios do Destaque Plus",
      "Prioridade superior aos planos Destaque e Plus",
      "Notificações antecipadas sobre novos profissionais com score elevado",
      "Alertas de profissionais com alta compatibilidade com suas campanhas",
    ],
  },
  total: {
    nome: "Destaque Elite",
    preco: 150,
    prioridade: 4,
    frase: "A RYCS encontra e convida os melhores profissionais por você.",
    itens: [
      "Todos os benefícios do Destaque Pro",
      "Prioridade máxima nas campanhas ativas, acima de todos os demais planos",
      "Convites automáticos e personalizados para profissionais com maior compatibilidade e score alto",
      "Reengajamento automático de profissionais convidados que demonstraram interesse, mas ainda não se candidataram",
    ],
  },
};

export const ORDEM_DESTAQUES = ["selo", "busca", "topo", "total"];

export const destaqueDe = (chave) => DESTAQUES[chave] || null;

// Prioridade de destaque de uma empresa (0 = sem plano de destaque).
export const prioridadeDestaque = (chave) => DESTAQUES[chave]?.prioridade || 0;

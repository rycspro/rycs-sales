import { PLANOS, planoDe } from "./planos.js";

// Regra de acesso da empresa à plataforma.
//
// Uma função só, pura, usada pelo servidor e pela tela. O motivo de ser única:
// se o backend e o frontend decidissem separado, existiria o estado em que a
// tela libera e a API recusa — a empresa vê o painel, clica, e leva erro sem
// entender. Pior ainda o inverso: a tela bloqueia quem já pagou.
//
// Nada aqui apaga nem esconde dado. Bloquear acesso é diferente de remover
// empresa: a conta continua inteira, com campanhas, saldo e histórico, e volta
// a funcionar assim que a assinatura regularizar.

export const ESTADOS = {
  ativa:      "ativa",       // assinatura paga e em dia
  trial:      "trial",       // período gratuito correndo, cartão já cadastrado
  pendente:   "pendente",    // checkout criado, primeiro pagamento não confirmado
  inadimplente: "inadimplente", // cobrança falhou ou venceu
  sem:        "sem",         // nunca assinou, ou está no plano gratuito antigo
};

// Quem entra na plataforma. Trial conta como acesso liberado: o cartão já foi
// cadastrado, e cobrar para deixar entrar durante o período gratuito seria
// contradizer a própria oferta.
export const LIBERADOS = [ESTADOS.ativa, ESTADOS.trial];

const agoraPadrao = () => Date.now();

// O plano "free" é herança do modelo antigo, em que existia conta gratuita.
// Ele não é mais oferecido, então empresa nele conta como SEM assinatura — e
// cai na mesma tela de escolha que uma empresa nova.
const semPlanoPago = (chave) => !chave || chave === "free" || !PLANOS[chave]?.preco;

export function estadoDaAssinatura(assinatura, agora = agoraPadrao()) {
  if (!assinatura) return ESTADOS.sem;

  const status = String(assinatura.status || "").toLowerCase();

  if (status === "cancelada" || status === "cancelled") return ESTADOS.sem;
  if (status === "inadimplente" || status === "overdue") return ESTADOS.inadimplente;

  // Trial vencido não é trial: vira inadimplente até o gateway confirmar a
  // primeira cobrança. Sem esta checagem, uma assinatura esquecida em
  // 'trial' daria acesso vitalício de graça.
  if (status === "trial" || status === "trialing") {
    const fim = Number(assinatura.trialFim || 0);
    if (fim && agora > fim) return ESTADOS.inadimplente;
    return ESTADOS.trial;
  }

  if (status === "ativa" || status === "active") return ESTADOS.ativa;
  if (status === "pendente" || status === "pending") return ESTADOS.pendente;

  return ESTADOS.sem;
}

// A decisão que a tela e a API consultam. Devolve o estado, se libera, e o que
// dizer a quem está do outro lado.
export function acessoDaEmpresa({ empresa = {}, assinatura = null } = {}, agora = agoraPadrao()) {
  const estado = estadoDaAssinatura(assinatura, agora);

  // Empresa que assinou antes deste sistema pode ter `assinatura` preenchida na
  // própria tabela companies sem linha em subscriptions. Isso conta como ativa:
  // ela pagou de alguma forma, e derrubar o acesso dela agora seria punir o
  // cliente por uma mudança nossa.
  if (estado === ESTADOS.sem && !semPlanoPago(empresa.assinatura)) {
    return {
      estado: ESTADOS.ativa,
      liberado: true,
      plano: empresa.assinatura,
      titulo: "",
      mensagem: "",
      acao: null,
    };
  }

  // Sem assinatura não tem plano a exibir. O "free" é resquício do modelo
  // antigo e apareceria no painel como plano "Sandbox" ao lado de "Sem
  // assinatura" — duas informações que se contradizem na mesma linha.
  const bruto = assinatura?.plano || empresa.assinatura || null;
  const plano = estado === ESTADOS.sem || semPlanoPago(bruto) ? null : bruto;
  const nomePlano = plano && PLANOS[plano] ? planoDe(plano).nome : null;

  const textos = {
    [ESTADOS.ativa]: { titulo: "", mensagem: "", acao: null },
    [ESTADOS.trial]: { titulo: "", mensagem: "", acao: null },
    [ESTADOS.sem]: {
      titulo: "Ative seu plano para continuar usando a RYCS",
      mensagem: "Escolha um plano para publicar campanhas e receber profissionais.",
      acao: "escolher-plano",
    },
    [ESTADOS.pendente]: {
      titulo: "Estamos confirmando seu pagamento",
      mensagem: nomePlano
        ? `Assim que o pagamento do plano ${nomePlano} for confirmado, seu acesso é liberado automaticamente.`
        : "Assim que o pagamento for confirmado, seu acesso é liberado automaticamente.",
      acao: "aguardar",
    },
    [ESTADOS.inadimplente]: {
      titulo: "Não conseguimos processar seu pagamento",
      mensagem: "Atualize a forma de pagamento para voltar a usar a plataforma. Seus dados continuam salvos.",
      acao: "atualizar-pagamento",
    },
  };

  return {
    estado,
    liberado: LIBERADOS.includes(estado),
    plano,
    ...textos[estado],
  };
}

// Dias restantes do período gratuito, para a tela avisar antes de cobrar.
export function diasDeTrialRestantes(assinatura, agora = agoraPadrao()) {
  const fim = Number(assinatura?.trialFim || 0);
  if (!fim || agora >= fim) return 0;
  return Math.ceil((fim - agora) / 86400000);
}

// Data em que a primeira cobrança acontece. Com trial, é o fim dele; sem
// trial, é hoje — e a tela precisa dizer isso antes de a pessoa confirmar.
export function primeiraCobranca({ trialDias = 0 } = {}, agora = agoraPadrao()) {
  return new Date(agora + Number(trialDias || 0) * 86400000);
}

export const formatarData = (d) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

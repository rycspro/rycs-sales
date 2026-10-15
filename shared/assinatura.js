import { PLANOS, planoDe } from "./planos.js";
import { isPremium } from "./empresa.js";

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
  trialFim:   "trial_terminado", // período gratuito acabou, e não havia cartão
  sem:        "sem",         // nunca assinou, ou está no plano gratuito antigo
  premium:    "premium",     // marcada premium pela plataforma: não precisa pagar
};

// Quem entra na plataforma. Trial conta como acesso liberado: o cartão já foi
// cadastrado, e cobrar para deixar entrar durante o período gratuito seria
// contradizer a própria oferta.
export const LIBERADOS = [ESTADOS.ativa, ESTADOS.trial, ESTADOS.premium];

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
    if (fim && agora > fim) {
      // Trial com cartão cadastrado que venceu é cobrança que não entrou.
      // Trial de cortesia que venceu é só o fim do período — dizer "não
      // conseguimos processar seu pagamento" a quem nunca deu cartão manda a
      // pessoa procurar um problema que não existe.
      const semCartao = !assinatura.formaPagamento || assinatura.formaPagamento === "ADMIN_TRIAL";
      return semCartao ? ESTADOS.trialFim : ESTADOS.inadimplente;
    }
    return ESTADOS.trial;
  }

  if (status === "ativa" || status === "active") return ESTADOS.ativa;
  if (status === "pendente" || status === "pending") return ESTADOS.pendente;

  return ESTADOS.sem;
}

// A decisão que a tela e a API consultam. Devolve o estado, se libera, e o que
// dizer a quem está do outro lado.
export function acessoDaEmpresa({ empresa = {}, assinatura = null } = {}, agora = agoraPadrao()) {
  // Empresa premium entra sem passar pela cobrança. Quem marca é o admin, na
  // tela de Cobrança e Acesso, e a marca mora na empresa — não na assinatura.
  //
  // Pagar continua possível: se ela assinou um plano, é o plano dela que
  // aparece. Premium remove a obrigação, não a opção. Bloqueio de acesso é
  // decidido antes desta função, e continua valendo acima do premium.
  if (isPremium(empresa)) {
    const assinado = assinatura?.plano || empresa.assinatura || null;
    return {
      estado: ESTADOS.premium,
      liberado: true,
      plano: assinado && PLANOS[assinado] && PLANOS[assinado].preco ? assinado : "premium",
      titulo: "",
      mensagem: "",
      acao: null,
    };
  }

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
    [ESTADOS.premium]: { titulo: "", mensagem: "", acao: null },
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
    [ESTADOS.trialFim]: {
      titulo: "Seu período gratuito terminou",
      mensagem: "Escolha um plano para continuar usando a RYCS. Suas campanhas, seu saldo e seu histórico continuam salvos.",
      acao: "escolher-plano",
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

// Primeiro débito do Pix Automático: no fim do trial e nunca antes de 3 dias,
// como o cartão sem trial. O Asaas agenda cada débito de 2 a 10 dias úteis
// antes do vencimento, e a autorização pode levar até o dia seguinte para
// ficar ativa: por isso o vencimento fica a pelo menos 3 dias úteis de hoje.
// Fim de semana conta como dia corrido, não útil (feriado não é considerado).
export function primeiroDebitoPixAutomatico({ trialDias = 0 } = {}, agora = agoraPadrao()) {
  const dia = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 15)); // 12h em Brasília
  const hoje = dia(new Date(agora - 3 * 3600000));
  let venc = new Date(hoje.getTime() + Math.max(Number(trialDias) || 0, 3) * 86400000);
  let uteis = 0;
  for (let d = new Date(hoje.getTime() + 86400000); d <= venc; d = new Date(d.getTime() + 86400000)) if (d.getUTCDay() % 6) uteis++;
  while (uteis < 3) {
    venc = new Date(venc.getTime() + 86400000);
    if (venc.getUTCDay() % 6) uteis++;
  }
  return venc;
}

export const formatarData = (d) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

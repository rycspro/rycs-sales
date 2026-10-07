import { takeRateDoPlano } from "./planos.js";

export function calcularValorTarefa(valorBruto, plano) {
  const bruto = Math.max(0, Math.round((Number(valorBruto) || 0) * 100) / 100);
  const percentual = takeRateDoPlano(plano);
  const taxa = Math.round(bruto * percentual * 100) / 100;
  const liquido = Math.round((bruto - taxa) * 100) / 100;
  return { bruto, percentual, taxa, liquido };
}

// -------------------------------------------------------------------------
// Sugestão de valor por tarefa
//
// Determinística e rastreável: cada número traz de onde veio. O que a
// plataforma NÃO faz é chamar isso de "valor de mercado" — não existe fonte
// externa auditável para isso aqui, e afirmar teria o peso de um dado que
// ninguém consegue conferir.
//
// A sugestão nunca altera a tabela sozinha: ela é exibida, a empresa aceita,
// edita ou ignora.
// -------------------------------------------------------------------------

// Peso de cada tarefa no funil. Reunião agendada é a âncora — é a ação que a
// operação compra de fato — e as demais são proporções dela.
const PESO_NO_FUNIL = {
  agendamento: 1,
  realizada: 1.8,
  venda: 12,
  ligacao: 0.35,
  follow: 0.12,
};

// Faixa aceitável em torno da sugestão. Abaixo do piso o profissional tende a
// ignorar a campanha; acima do teto a empresa paga por volume que não converte.
const PISO = 0.7;
const TETO = 1.45;

const arredondar = (v) => Math.round(v * 100) / 100;

export function sugerirValores({ ticketMedio, margem = 0.3, conversaoReuniaoVenda, historico = {}, plano }) {
  const ticket = Number(ticketMedio) || 0;
  const fatores = [];
  const fontes = [];

  if (!ticket) {
    return {
      disponivel: false,
      ausentes: ["ticket médio"],
      motivo: "Sem ticket médio não há como sugerir valor: qualquer número seria arbitrário.",
    };
  }

  // Conversão: histórico da própria empresa primeiro, parâmetro depois. Sem
  // nenhum dos dois a sugestão não sai — inventar uma taxa seria inventar o
  // resultado inteiro.
  const conversaoHistorica = historico.realizadas > 0 ? historico.vendas / historico.realizadas : 0;
  const conversao = conversaoHistorica || Number(conversaoReuniaoVenda) || 0;
  if (!conversao) {
    return {
      disponivel: false,
      ausentes: ["taxa de conversão de reunião em venda"],
      motivo: "Sem conversão conhecida, o valor por reunião não tem como ser ancorado na receita.",
    };
  }

  if (conversaoHistorica) {
    fontes.push({ nome: "histórico da empresa", detalhe: `${historico.vendas} venda(s) em ${historico.realizadas} reunião(ões) realizada(s)` });
    fatores.push(`Conversão de ${(conversaoHistorica * 100).toFixed(1)}% medida na sua operação`);
  } else {
    fontes.push({ nome: "parâmetro informado pelo proprietário", detalhe: `conversão de ${(conversao * 100).toFixed(1)}%` });
    fatores.push("Conversão informada por você, ainda sem histórico para conferir");
  }

  const margemUtil = Math.min(0.9, Math.max(0.05, Number(margem) || 0.3));
  fatores.push(`Margem de ${(margemUtil * 100).toFixed(0)}% sobre o ticket de ${ticket.toFixed(2)}`);

  const comparecimento = historico.agendadas > 0 ? historico.realizadas / historico.agendadas : 0;
  if (comparecimento) {
    fontes.push({ nome: "comparecimento da empresa", detalhe: `${historico.realizadas} de ${historico.agendadas} agendadas` });
    fatores.push(`Comparecimento de ${(comparecimento * 100).toFixed(0)}% já descontado`);
  }

  // Receita marginal de uma reunião agendada: ticket × margem × conversão,
  // ajustado pelo comparecimento quando ele é conhecido.
  const margemPorVenda = ticket * margemUtil;
  const receitaPorAgendada = margemPorVenda * conversao * (comparecimento || 1);

  // A empresa não pode pagar a reunião inteira pelo que ela gera, senão a
  // operação empata. Um terço da margem marginal é o que sobra saudável.
  const base = receitaPorAgendada / 3;
  fatores.push("Teto de um terço da margem que a reunião gera, para a operação não empatar");

  const amostra = (historico.agendadas || 0) + (historico.realizadas || 0) + (historico.vendas || 0);
  const confianca = conversaoHistorica
    ? (amostra >= 50 ? "alta" : amostra >= 10 ? "média" : "baixa")
    : "baixa";

  const tarefas = Object.entries(PESO_NO_FUNIL).map(([tipo, peso]) => {
    const bruto = arredondar(base * peso);
    const calculo = calcularValorTarefa(bruto, plano);
    return {
      tipo,
      ...calculo,
      minimo: arredondar(bruto * PISO),
      maximo: arredondar(bruto * TETO),
    };
  });

  return {
    disponivel: true,
    tarefas,
    fatores,
    fontes,
    amostra,
    confianca,
    premissas: { ticket, margem: margemUtil, conversao, comparecimento: comparecimento || null },
    receitaPorAgendada: arredondar(receitaPorAgendada),
  };
}

// Calcula o valor por visita a partir do orçamento mensal e meta diária de visitas.
// Fórmula: orcamento / diasUteis / visitasPorDia = valor por visita.
export function sugerirValorVisita({ orcamento, visitasPorDia, ticketMedio, diasUteis = 22, plano }) {
  const orc = Number(orcamento) || 0;
  const vpd = Number(visitasPorDia) || 0;
  const ticket = Number(ticketMedio) || 0;

  if (!vpd) {
    return { disponivel: false, motivo: "Informe quantas visitas por dia cada profissional deve realizar." };
  }
  if (!orc && !ticket) {
    return { disponivel: false, motivo: "Informe o orçamento mensal ou o ticket médio para calcular o valor por visita." };
  }

  let valorVisita;
  let fonte;
  if (orc > 0) {
    valorVisita = orc / diasUteis / vpd;
    fonte = `Orçamento R$${orc.toFixed(2)} ÷ ${diasUteis} dias ÷ ${vpd} visitas/dia`;
  } else {
    // Sem orçamento, usa proporção do ticket (0,8% por visita)
    valorVisita = ticket * 0.008;
    fonte = `${(0.008 * 100).toFixed(1)}% do ticket de R$${ticket.toFixed(2)}`;
  }

  const comissaoVenda = ticket > 0 ? arredondar(ticket * 0.08) : 0;
  const visitaCalc = calcularValorTarefa(arredondar(valorVisita), plano);
  const vendaCalc = calcularValorTarefa(comissaoVenda, plano);

  return {
    disponivel: true,
    valorVisita: visitaCalc,
    comissaoVenda: vendaCalc,
    fonte,
    premissas: { orcamento: orc, visitasPorDia: vpd, diasUteis, ticket },
  };
}

// Quanto a tabela custa e devolve num volume alvo. É o que liga o valor da
// tarefa ao ROI antes de a empresa confirmar.
export function impactoNoRoi({ tarefas, metaAgendadas, ticketMedio, conversao, comparecimento = 1 }) {
  const agendadas = Math.max(0, Math.round(Number(metaAgendadas) || 0));
  const valorAgendada = tarefas.find((t) => t.tipo === "agendamento");
  if (!agendadas || !valorAgendada) return null;

  const realizadas = Math.round(agendadas * (comparecimento || 1));
  const vendas = Math.round(realizadas * (Number(conversao) || 0));
  const valorRealizada = tarefas.find((t) => t.tipo === "realizada")?.bruto || 0;
  const valorVenda = tarefas.find((t) => t.tipo === "venda")?.bruto || 0;

  const investimento = arredondar(agendadas * valorAgendada.bruto + realizadas * valorRealizada + vendas * valorVenda);
  const receita = arredondar(vendas * (Number(ticketMedio) || 0));

  return {
    agendadas, realizadas, vendas, investimento, receita,
    roi: investimento > 0 ? arredondar(((receita - investimento) / investimento) * 100) : null,
    custoPorVenda: vendas > 0 ? arredondar(investimento / vendas) : null,
  };
}

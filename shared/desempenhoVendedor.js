// Indicadores do painel do profissional.
//
// Cálculo puro, compartilhado entre servidor e tela: os mesmos registros que
// pagam o profissional são os que alimentam o painel dele. Uma segunda conta,
// feita só para a tela, acabaria divergindo do que a carteira mostra — e
// divergência em número de dinheiro destrói confiança rápido.

const n = (v) => Number(v) || 0;
const DIA = 86400000;

const inicioDoDia = (ts = Date.now()) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const inicioDoMes = (ts = Date.now()) => {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// O que o profissional efetivamente recebe é o líquido, não o bruto da tarefa:
// mostrar bruto no painel e pagar líquido na carteira seria mentir com número
// verdadeiro.
const liquidoDe = (s) => (s.liquido != null ? n(s.liquido) : n(s.valor));

export function desempenhoVendedor({ submissions = [], leads = [], sellerId, seller = {}, agora = Date.now(), metaMensal = 0 }) {
  const meus = submissions.filter((s) => s.sellerId === sellerId);
  const liberadas = meus.filter((s) => s.status === "liberado");
  const recusadas = meus.filter((s) => ["recusado", "ia_recusado"].includes(s.status));
  const emAuditoria = meus.filter((s) => ["analisando", "revisao", "conferido", "ia_aprovado"].includes(s.status));

  const somaDesde = (desde) => liberadas.filter((s) => n(s.criadoEm) >= desde).reduce((t, s) => t + liquidoDe(s), 0);

  const hoje = somaDesde(inicioDoDia(agora));
  const semana = somaDesde(agora - 7 * DIA);
  const mes = somaDesde(inicioDoMes(agora));
  const historico = liberadas.reduce((t, s) => t + liquidoDe(s), 0);

  // O que já foi enviado e ainda não virou saldo. É a resposta à pergunta que
  // o profissional realmente faz: "quanto ainda tenho para receber?".
  const emAnalise = emAuditoria.reduce((t, s) => t + liquidoDe(s), 0);

  const decididas = liberadas.length + recusadas.length;
  const taxaAprovacao = decididas ? Math.round((liberadas.length / decididas) * 100) : null;

  const porTipo = (tipo) => liberadas.filter((s) => s.tipo === tipo).length;
  const agendadas = porTipo("agendamento");
  const realizadas = porTipo("realizada");
  const vendas = porTipo("venda");

  const meusLeads = leads.filter((l) => l.sellerId === sellerId);
  const leadsTrabalhados = meusLeads.filter((l) => l.etapa && l.etapa !== "novo").length;

  const meta = n(metaMensal);
  const progressoMeta = meta > 0 ? Math.min(100, Math.round((mes / meta) * 100)) : null;

  return {
    financeiro: {
      hoje, semana, mes, historico,
      disponivel: n(seller.disponivel),
      pendente: n(seller.pendente),
      emAuditoria: Math.round(emAnalise * 100) / 100,
      sacado: n(seller.sacado),
    },
    performance: {
      metaMensal: meta,
      progressoMeta,
      executadas: meus.length,
      aprovadas: liberadas.length,
      recusadas: recusadas.length,
      emAuditoria: emAuditoria.length,
      taxaAprovacao,
    },
    comercial: {
      leadsTrabalhados,
      leadsTotais: meusLeads.length,
      agendadas, realizadas, vendas,
      // Conversão da ponta à ponta: quantas reuniões agendadas viraram venda.
      conversao: agendadas ? Math.round((vendas / agendadas) * 100) : null,
      comparecimento: agendadas ? Math.round((realizadas / agendadas) * 100) : null,
    },
    rycs: {
      score: n(seller.nota),
      nivel: seller.nivel || "starter",
      scoreTriagem: n(seller.scoreTriagem),
      perfil: seller.perfil || null,
    },
  };
}

// "Potencial de ganhos disponível": quanto existe, agora, em tarefas que este
// profissional pode executar. Só conta empresa em que ele foi aprovado e com
// caixa para pagar — prometer valor que a empresa não tem é o caminho mais
// curto para o profissional trabalhar de graça.
export function potencialDeGanhos({ companies = [], campaigns = [], seller = {}, aplicacoes = {} }) {
  const habilitadas = companies.filter((c) => aplicacoes[c.id] === "aprovado");

  const itens = [];
  for (const empresa of habilitadas) {
    const caixa = Math.max(0, n(empresa.saldo) - n(empresa.saldoReservado));
    if (caixa <= 0) continue;

    const campanhasAtivas = campaigns.filter((c) => c.companyId === empresa.id && c.status === "ativa");
    const tabela = campanhasAtivas.length
      ? campanhasAtivas.reduce((acc, c) => ({ ...acc, ...(c.tarefas || {}) }), {})
      : (empresa.comissoes || {});

    const maiorTarefa = Math.max(0, ...Object.values(tabela).map(n));
    if (maiorTarefa <= 0) continue;

    // O teto é o caixa da empresa: ela não consegue pagar mais do que tem.
    itens.push({
      companyId: empresa.id,
      empresa: empresa.nome,
      caixaDisponivel: Math.round(caixa * 100) / 100,
      maiorTarefa,
      tabela,
      campanhas: campanhasAtivas.length,
    });
  }

  const total = itens.reduce((t, i) => t + i.caixaDisponivel, 0);
  return {
    total: Math.round(total * 100) / 100,
    empresas: itens.sort((a, b) => b.caixaDisponivel - a.caixaDisponivel),
    // Sem empresa aprovada o potencial é zero e o motivo precisa aparecer:
    // um "R$ 0,00" sem explicação parece defeito.
    motivo: !habilitadas.length
      ? "Você ainda não foi aprovado em nenhuma empresa."
      : !itens.length
        ? "As empresas em que você atua estão sem caixa disponível no momento."
        : null,
  };
}

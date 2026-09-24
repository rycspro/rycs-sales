import { valorMonetario } from "./analytics.js";

export const TIPOS_RELATORIO = {
  financeiro: "Financeiro", reunioes_agendadas: "Reuniões agendadas", reunioes_realizadas: "Reuniões realizadas", visitas: "Visitas",
  tarefas: "Tarefas", profissionais: "Profissionais", performance_campanha: "Performance por campanha", conversao: "Conversão",
};
const numero = (valor) => Number(valor) || 0;
const moeda = (valor) => `R$ ${numero(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function dadosRelatorio({ tipo, submissions = [], campaigns = [], professionals = [] }) {
  const aprovadas = submissions.filter((item) => item.status === "liberado");
  const porTipo = (chave) => aprovadas.filter((item) => item.tipo === chave);
  const investimento = aprovadas.reduce((total, item) => total + numero(item.valor), 0);
  const retorno = porTipo("venda").reduce((total, item) => total + valorMonetario(item.prova?.valorContrato), 0);
  const agendadas = porTipo("agendamento").length, realizadas = porTipo("realizada").length, visitas = porTipo("visita").length, vendas = porTipo("venda").length;
  const base = { agendadas, realizadas, visitas, vendas, investimento, retorno, roi: investimento ? ((retorno - investimento) / investimento) * 100 : null };
  const linhas = (chave, titulo) => porTipo(chave).map((item) => ({ titulo, detalhe: item.status, valor: moeda(item.valor) }));
  if (tipo === "reunioes_agendadas") return { ...base, titulo: "Reuniões agendadas", resumo: [{ rotulo: "Agendadas", valor: agendadas }], linhas: linhas("agendamento", "Reunião agendada") };
  if (tipo === "reunioes_realizadas") return { ...base, titulo: "Reuniões realizadas", resumo: [{ rotulo: "Realizadas", valor: realizadas }], linhas: linhas("realizada", "Reunião realizada") };
  if (tipo === "visitas") return { ...base, titulo: "Visitas", resumo: [{ rotulo: "Visitas aprovadas", valor: visitas }], linhas: linhas("visita", "Visita") };
  if (tipo === "tarefas") return { ...base, titulo: "Tarefas", resumo: [{ rotulo: "Registradas", valor: submissions.length }, { rotulo: "Aprovadas", valor: aprovadas.length }, { rotulo: "Em análise/revisão", valor: submissions.length - aprovadas.length }], linhas: submissions.map((item) => ({ titulo: item.tipo, detalhe: item.status, valor: moeda(item.valor) })) };
  if (tipo === "profissionais") return { ...base, titulo: "Profissionais", resumo: [{ rotulo: "Profissionais ativos", valor: professionals.length }, { rotulo: "Tarefas aprovadas", valor: aprovadas.length }], linhas: professionals.map((item) => ({ titulo: item.nome, detalhe: item.perfil || "Profissional", valor: "Ativo" })) };
  if (tipo === "performance_campanha") return { ...base, titulo: "Performance por campanha", resumo: [{ rotulo: "Campanhas", valor: campaigns.length }, { rotulo: "Tarefas aprovadas", valor: aprovadas.length }], linhas: campaigns.map((campaign) => { const itens = submissions.filter((item) => item.campaignId === campaign.id); return { titulo: campaign.titulo, detalhe: `${itens.filter((item) => item.status === "liberado").length} tarefas aprovadas`, valor: `${itens.length} registradas` }; }) };
  if (tipo === "conversao") return { ...base, titulo: "Conversão", resumo: [{ rotulo: "Agendadas", valor: agendadas }, { rotulo: "Realizadas", valor: realizadas }, { rotulo: "Vendas", valor: vendas }, { rotulo: "Agendada → realizada", valor: agendadas ? `${((realizadas / agendadas) * 100).toFixed(1)}%` : "Indisponível" }, { rotulo: "Realizada → venda", valor: realizadas ? `${((vendas / realizadas) * 100).toFixed(1)}%` : "Indisponível" }], linhas: [] };
  return { ...base, titulo: "Relatório financeiro", resumo: [{ rotulo: "Investimento", valor: moeda(investimento) }, { rotulo: "Retorno", valor: moeda(retorno) }, { rotulo: "ROI", valor: base.roi == null ? "Indisponível" : `${base.roi.toFixed(1)}%` }], linhas: [] };
}

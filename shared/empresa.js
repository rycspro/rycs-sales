export const STATUS_EMPRESA = ["rascunho", "em_analise", "aprovada", "suspensa"];
export const STATUS_CAMPANHA = ["rascunho", "em_revisao", "ativa", "pausada", "encerrada"];

export const EVIDENCIAS_PILOTO = {
  agendamento: ["cliente", "telefone", "datahora", "video"],
  realizada: ["cliente", "telefone", "video"],
};

export function camposPendentesEmpresa(empresa = {}) {
  const obrigatorios = [
    ["nome", "Nome fantasia"],
    ["razaoSocial", "Razão social"],
    ["documento", "CNPJ ou CPF"],
    ["endereco", "Endereço"],
    ["representanteLegal", "Representante legal"],
    ["contatoFinanceiro", "Contato financeiro"],
    ["contatoComercial", "Contato comercial"],
    ["produto", "Produto ou serviço"],
    ["segmento", "Segmento"],
    ["icp", "ICP"],
  ];
  return obrigatorios.filter(([chave]) => !String(empresa[chave] || "").trim()).map(([, label]) => label);
}

export function campanhaPodeSerPublicada(campanha = {}, empresa = {}) {
  const pendencias = [];
  if (empresa.statusCadastro !== "aprovada") pendencias.push("empresa ainda não aprovada");
  if (!empresa.assinatura || empresa.assinatura === "free") pendencias.push("plano pago ainda não ativo");
  if (Number(empresa.saldo || 0) - Number(empresa.saldoReservado || 0) <= 0) pendencias.push("caixa sem saldo disponível");
  if (!String(campanha.titulo || "").trim()) pendencias.push("título");
  if (!String(campanha.objetivo || "").trim()) pendencias.push("objetivo");
  if (!String(campanha.publico || "").trim()) pendencias.push("ICP da campanha");
  if (!String(campanha.regiao || "").trim()) pendencias.push("região");
  if (!String(campanha.funcao || "").trim()) pendencias.push("função comercial");
  if (!Number(campanha.orcamento || 0)) pendencias.push("orçamento");
  const tarefas = campanha.tarefas || {};
  if (!Number(tarefas.agendamento || 0) && !Number(tarefas.realizada || 0)) pendencias.push("ao menos uma tarefa piloto remunerada");
  const treinamento = campanha.treinamento || [];
  if (!treinamento.length) pendencias.push("treinamento");
  return { ok: pendencias.length === 0, pendencias };
}

export const saldoDisponivel = (empresa = {}) =>
  Math.max(0, Number(empresa.saldo || 0) - Number(empresa.saldoReservado || 0));

export const STATUS_EMPRESA = ["rascunho", "em_analise", "aprovada", "suspensa"];
export const STATUS_CAMPANHA = ["rascunho", "em_revisao", "ativa", "pausada", "encerrada", "cancelada"];

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

export const isPremium = (empresa = {}) => empresa.tipoEmpresa === "premium";

// Pós-pago foi REMOVIDO da plataforma: toda empresa, de qualquer plano (inclusive
// Premium), opera exclusivamente com saldo pré-pago — só roda campanha com caixa
// depositado. A função é mantida (sempre false) para não quebrar imports.
export const isPosPago = () => false;

// Os requisitos de publicação, um a um, com o rótulo que a tela mostra e a
// pendência que o servidor devolve.
//
// Lista única porque antes eram duas: esta regra e uma cópia dela dentro do
// wizard de campanha. As duas discordavam — a empresa premium via "Plano
// ativo" em vermelho no checklist enquanto a regra real já a tinha liberado,
// e o painel acusava uma pendência que ninguém conseguia resolver.
//
// Requisito que não se aplica à empresa sai da lista em vez de aparecer
// satisfeito: premium não precisa de plano nem de caixa, e mostrar esses itens
// marcados em verde sugeriria que ela pagou algo.
// Uma campanha tem pipeline se tiver ao menos as etapas padrão ou etapas customizadas definidas.
function temPipeline(campanha = {}) {
  const etapas = campanha.etapasPipeline;
  if (!etapas) return false;
  if (Array.isArray(etapas)) return etapas.length > 0;
  try { const p = JSON.parse(etapas); return Array.isArray(p) && p.length > 0; } catch { return false; }
}

export function requisitosPublicacao(campanha = {}, empresa = {}) {
  const premium = isPremium(empresa);
  // Pós-pago removido: toda empresa precisa de caixa para publicar e rodar.
  const precisaDeCaixa = true;
  const tarefas = campanha.tarefas || {};
  const disponivel = saldoDisponivel(empresa);

  return [
    ["Empresa aprovada", "empresa ainda não aprovada", empresa.statusCadastro === "aprovada", true],
    ["Plano ativo", "plano pago ainda não ativo", !!empresa.assinatura && empresa.assinatura !== "free", !premium],
    ["Caixa com saldo", "caixa sem saldo disponível", Number(empresa.saldo || 0) - Number(empresa.saldoReservado || 0) > 0, precisaDeCaixa],
    ["Título", "título", !!String(campanha.titulo || "").trim(), true],
    ["Objetivo", "objetivo", !!String(campanha.objetivo || "").trim(), true],
    ["ICP", "ICP da campanha", !!String(campanha.publico || "").trim(), true],
    ["Região", "região", !!String(campanha.regiao || "").trim(), true],
    ["Cidade", "cidade da campanha", !!String(campanha.cidade || "").trim(), true],
    ["Estado", "estado da campanha", !!String(campanha.estado || "").trim(), true],
    ["Função", "função comercial", !!String(campanha.funcao || "").trim(), true],
    ["Orçamento", "orçamento", Number(campanha.orcamento || 0) > 0, precisaDeCaixa],
    ["Tarefa remunerada", "ao menos uma tarefa remunerada", Object.values(tarefas).some((valor) => Number(valor) > 0), true],
    ["Treinamento obrigatório", "treinamento", (campanha.treinamento || []).length > 0, true],
    ["Pipeline configurado", "pipeline da campanha não configurado (etapas obrigatórias)", temPipeline(campanha), true],
    ["Saldo suficiente", "orçamento superior ao saldo disponível", Number(campanha.orcamento || 0) <= disponivel, precisaDeCaixa],
  ]
    .filter(([, , , aplica]) => aplica)
    .map(([label, pendencia, ok]) => ({ label, pendencia, ok }));
}

export function campanhaPodeSerPublicada(campanha = {}, empresa = {}) {
  const pendencias = requisitosPublicacao(campanha, empresa).filter((r) => !r.ok).map((r) => r.pendencia);
  return { ok: pendencias.length === 0, pendencias };
}

// Saldo que a empresa pode comprometer. Toda empresa opera pré-pago, sem
// exceção de plano: saldo − reservado (nunca ilimitado).
export const saldoDisponivel = (empresa = {}) =>
  Math.max(0, Number(empresa.saldo || 0) - Number(empresa.saldoReservado || 0));

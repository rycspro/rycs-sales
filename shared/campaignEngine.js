// Motor de configuração condicional de campanhas.
// Fonte central de regras: determina campos visíveis, obrigatórios, opcionais,
// sugestões de ações, evidências e critérios de publicação com base no objetivo,
// modelo de trabalho e configurações da empresa.
//
// Compartilhado entre frontend e backend — o backend é autoridade final.

import { ACOES, ORDEM_ACOES } from "./acoes.js";
import { OBJETIVOS } from "./objetivosCampanha.js";
import { FUNCOES } from "./funcoes.js";

// ── Modelos de trabalho ─────────────────────────────────────────────────
export const MODELOS_TRABALHO = {
  remoto: {
    id: "remoto",
    nome: "Remoto",
    descricao: "O profissional pode executar as atividades a distância.",
    icone: "Laptop",
  },
  presencial: {
    id: "presencial",
    nome: "Presencial",
    descricao: "O profissional precisa atuar fisicamente em uma determinada região.",
    icone: "MapPin",
  },
  hibrido: {
    id: "hibrido",
    nome: "Híbrido",
    descricao: "A operação combina atividades remotas e presenciais.",
    icone: "Building2",
  },
};

// ── Restrições geográficas dos profissionais ────────────────────────────
export const RESTRICOES_GEO = {
  nenhuma: { id: "nenhuma", label: "Não, podem trabalhar de qualquer lugar" },
  paises: { id: "paises", label: "Somente profissionais de determinados países" },
  regioes: { id: "regioes", label: "Somente profissionais de determinadas regiões" },
  cidades: { id: "cidades", label: "Somente profissionais de determinadas cidades" },
};

// ── Mercado de atuação ──────────────────────────────────────────────────
export const MERCADOS = {
  pais_todo: { id: "pais_todo", label: "Em todo o meu país" },
  regioes_pais: { id: "regioes_pais", label: "Em regiões específicas do meu país" },
  outros_paises: { id: "outros_paises", label: "Em outros países" },
  global: { id: "global", label: "Em qualquer lugar do mundo" },
};

// ── Origem dos leads ────────────────────────────────────────────────────
export const ORIGENS_LEAD = {
  empresa: { id: "empresa", label: "Minha empresa fornecerá os leads" },
  profissional: { id: "profissional", label: "O profissional encontrará os leads" },
  ambos: { id: "ambos", label: "Ambas as opções" },
};

// ── Canais de abordagem ─────────────────────────────────────────────────
export const CANAIS = [
  { id: "whatsapp", nome: "WhatsApp", icone: "MessageCircle" },
  { id: "ligacao", nome: "Ligação telefônica", icone: "Phone" },
  { id: "email", nome: "E-mail", icone: "Mail" },
  { id: "linkedin", nome: "LinkedIn", icone: "Linkedin" },
  { id: "instagram", nome: "Instagram", icone: "Instagram" },
  { id: "presencial", nome: "Visita presencial", icone: "MapPin" },
  { id: "outro", nome: "Outros canais", icone: "Globe" },
];

// ── Experiência ─────────────────────────────────────────────────────────
export const NIVEIS_EXPERIENCIA = [
  { id: "iniciante", label: "Aceito iniciantes" },
  { id: "preferencia", label: "Prefiro profissionais com experiência" },
  { id: "exigido", label: "Exijo experiência comprovada" },
  { id: "indiferente", label: "Não tenho preferência" },
];

// ── Processo de admissão ────────────────────────────────────────────────
export const PROCESSOS_ADMISSAO = [
  { id: "manual", label: "Aprovação manual", descricao: "A empresa analisa e aprova cada candidatura." },
  { id: "ia", label: "Aprovação com IA", descricao: "A inteligência artificial avalia o perfil e decide a aprovação automaticamente." },
  { id: "automatico", label: "Aprovação automática", descricao: "Profissionais que atendam aos requisitos são admitidos automaticamente." },
  { id: "convite", label: "Somente por convite", descricao: "A campanha é destinada aos profissionais convidados." },
];

// ── Objetivos expandidos (compatível com spec seção 5) ──────────────────
export const OBJETIVOS_UI = {
  encontrar_clientes: {
    id: "encontrar_clientes",
    objetivo: "leads",
    nome: "Encontrar novos clientes",
    descricao: "Encontrar empresas ou pessoas que correspondam ao perfil de cliente desejado.",
    funcaoSugerida: "bdr",
    icone: "Search",
  },
  qualificar: {
    id: "qualificar",
    objetivo: "leads",
    nome: "Qualificar oportunidades",
    descricao: "Conversar com potenciais clientes e identificar oportunidades comerciais reais.",
    funcaoSugerida: "sdr",
    icone: "Filter",
  },
  agendar_reunioes: {
    id: "agendar_reunioes",
    objetivo: "reunioes",
    nome: "Agendar reuniões",
    descricao: "Prospectar, qualificar e agendar reuniões comerciais.",
    funcaoSugerida: "sdr",
    icone: "Calendar",
  },
  realizar_vendas: {
    id: "realizar_vendas",
    objetivo: "vendas",
    nome: "Realizar vendas",
    descricao: "Negociar com potenciais clientes e concluir vendas.",
    funcaoSugerida: "closer",
    icone: "HandCoins",
  },
  visitas_comerciais: {
    id: "visitas_comerciais",
    objetivo: "visitas",
    nome: "Realizar visitas comerciais",
    descricao: "Abordar clientes presencialmente, realizar visitas e gerar oportunidades.",
    funcaoSugerida: "pap",
    icone: "Footprints",
  },
  reativar_clientes: {
    id: "reativar_clientes",
    objetivo: "reativacao",
    nome: "Reativar clientes",
    descricao: "Retomar o contato com clientes antigos, leads inativos ou oportunidades perdidas.",
    funcaoSugerida: "sdr",
    icone: "RotateCcw",
  },
  personalizar: {
    id: "personalizar",
    objetivo: "completa",
    nome: "Personalizar operação",
    descricao: "Configurar uma operação com objetivos, funções e ações personalizadas.",
    funcaoSugerida: null,
    icone: "Settings",
  },
};

export const ORDEM_OBJETIVOS_UI = [
  "encontrar_clientes", "qualificar", "agendar_reunioes",
  "realizar_vendas", "visitas_comerciais", "reativar_clientes", "personalizar",
];

// ── Origem dos profissionais por função ─────────────────────────────────
export const ORIGENS_PROFISSIONAIS = {
  rycs: { id: "rycs", label: "Contratar profissionais pela RYCS" },
  interno: { id: "interno", label: "Utilizar profissionais da minha empresa" },
  ambos: { id: "ambos", label: "Utilizar ambos" },
};

// ── Seleção rápida de atividades por função (spec Etapa 6.2) ───────────
export const SELECAO_RAPIDA = {
  bdr: [
    { id: "contato", nome: "Contato encontrado" },
    { id: "lead_validado", nome: "Contato validado" },
    { id: "lead_qualificado", nome: "Contato qualificado" },
  ],
  sdr: [
    { id: "ligacao", nome: "Contato na discadora" },
    { id: "contato", nome: "Contato no WhatsApp" },
    { id: "lead_qualificado", nome: "Lead qualificado" },
    { id: "agendamento", nome: "Reunião agendada" },
    { id: "bonus_comparecimento", nome: "Bônus por comparecimento" },
  ],
  closer: [
    { id: "realizada", nome: "Reunião realizada" },
    { id: "venda", nome: "Comissão por venda" },
  ],
  pap: [
    { id: "visita", nome: "Visita realizada" },
    { id: "lead_qualificado", nome: "Contato qualificado" },
    { id: "venda", nome: "Venda realizada" },
  ],
};

// ── Ações expandidas (spec seção 22) ────────────────────────────────────
export const ACOES_DISPONIVEIS = [
  { id: "lead_encontrado", nome: "Lead encontrado", grupo: "prospeccao" },
  { id: "lead_cadastrado", nome: "Lead cadastrado", grupo: "prospeccao" },
  { id: "lead_validado", nome: "Lead validado", grupo: "prospeccao" },
  { id: "ligacao", nome: "Ligação realizada", grupo: "contato" },
  { id: "contato", nome: "Contato efetivo", grupo: "contato" },
  { id: "abordagem", nome: "Abordagem realizada", grupo: "contato" },
  { id: "follow", nome: "Follow-up realizado", grupo: "contato" },
  { id: "lead_qualificado", nome: "Lead qualificado", grupo: "qualificacao" },
  { id: "agendamento", nome: "Reunião agendada", grupo: "reuniao" },
  { id: "realizada", nome: "Reunião realizada", grupo: "reuniao" },
  { id: "visita", nome: "Visita comercial realizada", grupo: "presencial" },
  { id: "proposta", nome: "Proposta apresentada", grupo: "negociacao" },
  { id: "venda", nome: "Venda concluída", grupo: "fechamento" },
  { id: "bonus_comparecimento", nome: "Bônus por comparecimento", grupo: "reuniao" },
];

// Sugestões de ações por função (spec seção 22)
export const SUGESTOES_ACOES = {
  bdr: ["lead_encontrado", "lead_cadastrado", "lead_validado", "contato"],
  sdr: ["contato", "lead_qualificado", "agendamento", "realizada"],
  closer: ["realizada", "proposta", "venda"],
  pap: ["visita", "contato", "lead_qualificado", "venda"],
};

// ── Motor de regras condicionais ────────────────────────────────────────

// Determina quais campos de localização são necessários com base no modelo
// de trabalho e nas restrições selecionadas.
export function regrasLocalizacao(campanha = {}) {
  const modelo = campanha.modeloTrabalho || "remoto";
  const restricao = campanha.restricaoGeo || "nenhuma";

  if (modelo === "remoto") {
    if (restricao === "nenhuma") {
      return { pais: false, estado: false, cidade: false, regiao: false, endereco: false };
    }
    if (restricao === "paises") {
      return { pais: true, estado: false, cidade: false, regiao: false, endereco: false };
    }
    if (restricao === "regioes") {
      return { pais: true, estado: true, cidade: false, regiao: true, endereco: false };
    }
    if (restricao === "cidades") {
      return { pais: true, estado: true, cidade: true, regiao: false, endereco: false };
    }
  }

  // Presencial ou híbrido: território é obrigatório
  return { pais: true, estado: true, cidade: true, regiao: true, endereco: modelo === "presencial" };
}

// Determina se a campanha precisa de configurações de reunião
export function precisaDeReuniao(campanha = {}) {
  const obj = OBJETIVOS_UI[campanha.objetivoUI];
  if (!obj) return false;
  const objetivo = obj.objetivo;
  return objetivo === "reunioes" || objetivo === "completa";
}

// Determina se a campanha precisa de configurações de território presencial
export function precisaDePresencial(campanha = {}) {
  const modelo = campanha.modeloTrabalho || "remoto";
  return modelo === "presencial" || modelo === "hibrido";
}

// Determina ações sugeridas para a campanha
export function acoesSugeridas(campanha = {}) {
  const funcao = campanha.funcao || "sdr";
  return SUGESTOES_ACOES[funcao] || SUGESTOES_ACOES.sdr;
}

// ── Validação de publicação (substitui requisitosPublicacao) ────────────
// A diferença crucial: campos de localização só são exigidos quando o modelo
// de trabalho os torna necessários.
export function diagnosticoCampanha(campanha = {}, empresa = {}) {
  const loc = regrasLocalizacao(campanha);
  const tarefas = typeof campanha.tarefas === "string"
    ? JSON.parse(campanha.tarefas || "{}") : (campanha.tarefas || {});
  const temTarefaRemunerada = Object.values(tarefas).some((v) => Number(v) > 0);

  const saldo = Math.max(0, Number(empresa.saldo || 0) - Number(empresa.saldoReservado || 0));
  const orcamento = Number(campanha.orcamento || 0);

  const bloqueios = [];
  const recomendacoes = [];

  // Bloqueios reais
  if (!String(campanha.titulo || "").trim()) bloqueios.push({ campo: "titulo", msg: "Defina um título para a campanha" });
  if (!campanha.objetivoUI && !String(campanha.objetivo || "").trim()) bloqueios.push({ campo: "objetivo", msg: "Escolha um objetivo para a campanha" });
  if (!temTarefaRemunerada) bloqueios.push({ campo: "tarefas", msg: "Configure ao menos uma ação remunerada" });
  if (empresa.statusCadastro !== "aprovada") bloqueios.push({ campo: "empresa", msg: "O cadastro da empresa precisa ser aprovado" });

  // Localização — só bloqueia quando o modelo exige
  if (loc.cidade && !String(campanha.cidade || "").trim()) bloqueios.push({ campo: "cidade", msg: "Defina a cidade (operação presencial)" });
  if (loc.estado && !String(campanha.estado || "").trim() && precisaDePresencial(campanha)) bloqueios.push({ campo: "estado", msg: "Defina o estado (operação presencial)" });

  // Financeiro
  if (orcamento > 0 && orcamento > saldo) bloqueios.push({ campo: "orcamento", msg: "Orçamento superior ao saldo disponível" });

  // Operação multi-função: validar config de cada função
  if (campanha.estruturaComercial === "operacao" && Array.isArray(campanha.funcoesOperacao)) {
    for (const fn of campanha.funcoesOperacao) {
      const cfg = campanha[`config_${fn}`] || {};
      const fnTarefas = typeof cfg.tarefas === "string" ? JSON.parse(cfg.tarefas || "{}") : (cfg.tarefas || {});
      const fnTemTarefa = Object.values(fnTarefas).some((v) => Number(v) > 0);
      if (!fnTemTarefa) {
        const nome = FUNCOES[fn]?.nome || fn.toUpperCase();
        bloqueios.push({ campo: `config_${fn}.tarefas`, msg: `Configure ao menos uma ação remunerada para ${nome}` });
      }
    }
  }

  // Recomendações (não bloqueiam)
  if (!String(campanha.publico || "").trim()) recomendacoes.push({ campo: "publico", msg: "Descreva o perfil do cliente ideal (ICP)" });
  if (!String(campanha.funcao || "").trim() && campanha.estruturaComercial !== "operacao") recomendacoes.push({ campo: "funcao", msg: "Defina a função comercial" });
  if (!(campanha.treinamento || []).length) recomendacoes.push({ campo: "treinamento", msg: "Vincule um treinamento da Academy" });
  if (!String(campanha.descricao || "").trim()) recomendacoes.push({ campo: "descricao", msg: "Adicione uma descrição das atividades" });
  if (!loc.regiao && !String(campanha.regiao || "").trim() && campanha.modeloTrabalho !== "remoto") {
    recomendacoes.push({ campo: "regiao", msg: "Defina a região de atuação" });
  }
  if (orcamento <= 0) recomendacoes.push({ campo: "orcamento", msg: "Defina um orçamento para a campanha" });

  return {
    pronta: bloqueios.length === 0,
    bloqueios,
    recomendacoes,
    localizacao: loc,
  };
}

// ── Campos visíveis por etapa ───────────────────────────────────────────
export function camposVisiveis(campanha = {}) {
  const modelo = campanha.modeloTrabalho || "remoto";
  const loc = regrasLocalizacao(campanha);
  const origemLeads = campanha.origemLeads || "";

  return {
    // Etapa 2 — Estrutura
    restricaoGeo: modelo === "remoto",
    paisesRestritos: modelo === "remoto" && campanha.restricaoGeo === "paises",
    regioesRestritas: modelo === "remoto" && campanha.restricaoGeo === "regioes",
    cidadesRestritas: modelo === "remoto" && campanha.restricaoGeo === "cidades",
    territorioPais: loc.pais,
    territorioEstado: loc.estado,
    territorioCidade: loc.cidade,
    territorioRegiao: loc.regiao,
    territorioEndereco: loc.endereco,
    distribuicaoLeads: origemLeads === "empresa" || origemLeads === "ambos",
    mineracaoLeads: origemLeads === "profissional" || origemLeads === "ambos",
    configuracaoReuniao: precisaDeReuniao(campanha),
    visitasPorDia: precisaDePresencial(campanha),

    // Etapa 3 — Perfil
    experienciaDetalhes: campanha.nivelExperiencia === "exigido",
    idiomasDetalhes: true,
    disponibilidadeDetalhes: campanha.disponibilidade === "especifica",

    // Etapa 4 — Remuneração
    comissao: campanha.temComissao === true,
    cumulativo: (campanha.acoesAtivas || []).length > 1,
  };
}

// ── Migração de campanha antiga para nova estrutura ─────────────────────
// Campanhas existentes que não têm os novos campos continuam funcionando:
// os defaults fazem com que a validação antiga e a nova coexistam.
export function migrarCampanhaAntiga(c = {}) {
  return {
    ...c,
    modeloTrabalho: c.modeloTrabalho || (c.modeloOperacao || "remoto"),
    restricaoGeo: c.restricaoGeo || "nenhuma",
    origemLeads: c.origemLeads || (c.aceitaLeadProprio ? "profissional" : "empresa"),
    objetivoUI: c.objetivoUI || null,
    mercado: c.mercado || "pais_todo",
    canais: c.canais || [],
    nivelExperiencia: c.nivelExperiencia || "indiferente",
    processoAdmissao: c.processoAdmissao || "manual",
    temComissao: c.temComissao ?? (Number(c.percentualComissao) > 0),
    remuneracaoCumulativa: c.remuneracaoCumulativa ?? true,
    visibilidade: c.visibilidade || "publica",
    acoesAtivas: c.acoesAtivas || Object.keys(typeof c.tarefas === "string" ? JSON.parse(c.tarefas || "{}") : (c.tarefas || {})),
  };
}

// ── Status ──────────────────────────────────────────────────────────────
export const STATUS_CAMPANHA_V2 = [
  { id: "rascunho", nome: "Rascunho", cor: "#8496B4" },
  { id: "ativa", nome: "Ativa", cor: "#22c55e" },
  { id: "pausada", nome: "Pausada", cor: "#F59E0B" },
  { id: "encerrada", nome: "Encerrada", cor: "#EF4444" },
  { id: "arquivada", nome: "Arquivada", cor: "#6B7280" },
];

// ── Indicadores por objetivo (spec seção 37) ────────────────────────────
export const INDICADORES_POR_OBJETIVO = {
  leads: ["leads_encontrados", "leads_validos", "taxa_validacao", "custo_lead_valido"],
  reunioes: ["leads_trabalhados", "contatos_efetivos", "leads_qualificados", "reunioes_agendadas", "reunioes_realizadas", "taxa_comparecimento", "custo_reuniao"],
  vendas: ["oportunidades_trabalhadas", "propostas_apresentadas", "vendas_concluidas", "taxa_conversao", "receita_atribuida", "comissoes"],
  visitas: ["visitas_realizadas", "contatos_gerados", "oportunidades_qualificadas", "vendas_concluidas", "custo_resultado"],
  completa: ["leads_trabalhados", "reunioes_agendadas", "reunioes_realizadas", "vendas_concluidas", "taxa_conversao"],
  reativacao: ["leads_trabalhados", "contatos_efetivos", "reunioes_agendadas", "clientes_reativados"],
};

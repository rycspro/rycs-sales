// RYCS Audit Policy Engine — contrato da política de auditoria.
//
// A política é DADO, não código. Cada empresa e cada tipo de tarefa podem ter
// critérios, pesos e limiares próprios, versionados. Quando um critério muda,
// nasce uma versão nova: auditorias antigas continuam explicáveis pela versão
// que as julgou, e não pela que está valendo hoje.
//
// Este arquivo é compartilhado entre servidor e cliente de propósito. O
// servidor decide; a tela precisa explicar a mesma regra. Duas cópias da
// política divergiriam, e a empresa veria um critério diferente do que rodou.

export const VERSAO_CONTRATO = 1;

// De onde vem a resposta de cada critério. O estágio barato vem antes do caro:
// é o que permite ao pipeline parar sem gastar IA quando o determinístico já
// resolveu.
export const FONTES = {
  deterministico: { nome: "Validação determinística", custo: "nenhum", ordem: 1 },
  sinal: { nome: "Sinal antifraude", custo: "nenhum", ordem: 2 },
  geo: { nome: "Geolocalização", custo: "nenhum", ordem: 3 },
  visao: { nome: "Análise de imagem", custo: "provedor externo", ordem: 4 },
  transcricao: { nome: "Transcrição de áudio", custo: "provedor externo", ordem: 5 },
  semantica: { nome: "Análise semântica", custo: "provedor externo", ordem: 6 },
};

export const ORDEM_FONTES = Object.keys(FONTES).sort((a, b) => FONTES[a].ordem - FONTES[b].ordem);

export const LIMIARES_PADRAO = { aprovar: 70, revisar: 50 };

// Um critério não atendido só derruba a auditoria se for obrigatório. Os
// demais custam peso, e o conjunto decide — é o que evita reprovar alguém por
// um único sinal isolado.
export function normalizarCriterio(bruto, indice = 0) {
  const chave = String(bruto?.chave || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (!chave) return null;
  return {
    chave,
    descricao: String(bruto?.descricao || "").slice(0, 400),
    fonte: FONTES[bruto?.fonte] ? bruto.fonte : "deterministico",
    peso: Math.max(0, Math.min(100, Number(bruto?.peso) || 0)),
    obrigatorio: !!bruto?.obrigatorio,
    // Abaixo da confiança mínima o critério não conta como atendido nem como
    // negado: vira inconclusivo, e inconclusivo manda para revisão humana.
    confiancaMinima: Math.max(0, Math.min(1, Number(bruto?.confiancaMinima ?? 0.6))),
    ordem: Number.isFinite(Number(bruto?.ordem)) ? Number(bruto.ordem) : indice,
  };
}

export function normalizarPolitica(bruto) {
  const criterios = (Array.isArray(bruto?.criterios) ? bruto.criterios : [])
    .map(normalizarCriterio)
    .filter(Boolean);

  const limiares = {
    aprovar: Math.max(1, Math.min(100, Number(bruto?.limiares?.aprovar) || LIMIARES_PADRAO.aprovar)),
    revisar: Math.max(0, Math.min(100, Number(bruto?.limiares?.revisar) || LIMIARES_PADRAO.revisar)),
  };
  // Limiar de revisão acima do de aprovação tornaria a faixa de revisão vazia
  // e aprovaria nota baixa. Preferimos corrigir a favor da revisão humana.
  if (limiares.revisar > limiares.aprovar) limiares.revisar = limiares.aprovar;

  return {
    nome: String(bruto?.nome || "Política sem nome").slice(0, 120),
    tipo: String(bruto?.tipo || "").trim(),
    versao: Math.max(1, Math.round(Number(bruto?.versao) || 1)),
    criterios: criterios.sort((a, b) => a.ordem - b.ordem),
    limiares,
    ativo: bruto?.ativo !== false,
  };
}

export function politicaValida(politica) {
  const p = normalizarPolitica(politica);
  const erros = [];
  if (!p.tipo) erros.push("Informe o tipo de tarefa que esta política audita.");
  if (!p.criterios.length) erros.push("A política precisa de pelo menos um critério.");
  const pesoTotal = p.criterios.reduce((n, c) => n + c.peso, 0);
  if (pesoTotal <= 0) erros.push("A soma dos pesos precisa ser maior que zero.");
  const chaves = p.criterios.map((c) => c.chave);
  if (new Set(chaves).size !== chaves.length) erros.push("Há critérios com a mesma chave.");
  return { valida: erros.length === 0, erros, politica: p, pesoTotal };
}

// Quais estágios esta política realmente exige. Serve ao roteamento de custo:
// se nenhum critério é semântico, o pipeline nunca chama o provedor caro.
export function estagiosNecessarios(politica) {
  const p = normalizarPolitica(politica);
  return ORDEM_FONTES.filter((f) => p.criterios.some((c) => c.fonte === f));
}

// -------------------------------------------------------------------------
// Políticas de referência
//
// Existem para a plataforma não nascer vazia e para servirem de exemplo do
// formato. São ponto de partida editável, não regra fixa no código.
// -------------------------------------------------------------------------

export const POLITICAS_PADRAO = [
  {
    nome: "Visita presencial — padrão RYCS",
    tipo: "visita",
    versao: 1,
    limiares: { aprovar: 70, revisar: 50 },
    criterios: [
      { chave: "campos_obrigatorios", descricao: "Todos os campos de comprovação preenchidos e plausíveis", fonte: "deterministico", peso: 15, obrigatorio: true },
      { chave: "evidencia_nao_reutilizada", descricao: "A foto não foi enviada antes por este ou por outro profissional", fonte: "sinal", peso: 20, obrigatorio: true },
      { chave: "distancia_do_endereco", descricao: "Localização capturada compatível com o endereço esperado", fonte: "geo", peso: 25 },
      { chave: "ambiente_comercial", descricao: "A imagem mostra um estabelecimento ou ambiente comercial", fonte: "visao", peso: 25, confiancaMinima: 0.7 },
      { chave: "imagem_sem_manipulacao", descricao: "Sem sinais de edição ou montagem na imagem", fonte: "visao", peso: 15, confiancaMinima: 0.6 },
    ],
  },
  {
    nome: "Reunião realizada — padrão RYCS",
    tipo: "realizada",
    versao: 1,
    limiares: { aprovar: 70, revisar: 50 },
    criterios: [
      { chave: "campos_obrigatorios", descricao: "Todos os campos de comprovação preenchidos e plausíveis", fonte: "deterministico", peso: 10, obrigatorio: true },
      { chave: "evidencia_nao_reutilizada", descricao: "A gravação não foi enviada antes", fonte: "sinal", peso: 15, obrigatorio: true },
      { chave: "duracao_minima", descricao: "A reunião atingiu a duração mínima definida pela empresa", fonte: "transcricao", peso: 10 },
      { chave: "decisor_presente", descricao: "Quem decide participou da conversa", fonte: "semantica", peso: 20, confiancaMinima: 0.7 },
      { chave: "descoberta_realizada", descricao: "O profissional investigou a necessidade e a situação atual do cliente", fonte: "semantica", peso: 20, confiancaMinima: 0.7 },
      { chave: "solucao_apresentada", descricao: "A solução foi apresentada ligada ao problema levantado", fonte: "semantica", peso: 15, confiancaMinima: 0.7 },
      { chave: "proximo_passo_definido", descricao: "A conversa terminou com data e responsável definidos", fonte: "semantica", peso: 10, confiancaMinima: 0.7 },
    ],
  },
];

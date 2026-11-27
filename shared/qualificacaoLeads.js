// Motor de qualificação de leads para campanhas.
//
// Gera perguntas de qualificação específicas para cada campanha, com base no
// objetivo, segmento, público e produto. Suporta múltiplos tipos de resposta,
// perguntas condicionais, critérios de pontuação e classificação.
//
// Compartilhado entre frontend e backend — backend é autoridade final.

const n = (v) => Number(v) || 0;

// Tipos de resposta suportados
export const TIPOS_RESPOSTA = [
  { id: "sim_nao", nome: "Sim ou Não" },
  { id: "texto_curto", nome: "Texto curto" },
  { id: "texto_longo", nome: "Texto longo" },
  { id: "escolha_unica", nome: "Escolha única" },
  { id: "multipla_escolha", nome: "Múltipla escolha" },
  { id: "numero", nome: "Número" },
  { id: "valor_monetario", nome: "Valor monetário" },
  { id: "data", nome: "Data" },
  { id: "escala", nome: "Escala (1-10)" },
  { id: "nao_informado", nome: "Não informado" },
];

// Classificação de prioridade
export const CLASSIFICACOES = {
  alta: { id: "alta", nome: "Alta prioridade", cor: "#16A34A", min: 70 },
  media: { id: "media", nome: "Média prioridade", cor: "#F59E0B", min: 40 },
  baixa: { id: "baixa", nome: "Baixa prioridade", cor: "#EF4444", min: 0 },
};

// Status da qualificação
export const STATUS_QUALIFICACAO = {
  pendente: { id: "pendente", nome: "Pendente", cor: "#8496B4" },
  em_andamento: { id: "em_andamento", nome: "Em andamento", cor: "#3B82F6" },
  qualificado: { id: "qualificado", nome: "Qualificado", cor: "#16A34A" },
  desqualificado: { id: "desqualificado", nome: "Desqualificado", cor: "#EF4444" },
  insuficiente: { id: "insuficiente", nome: "Informações insuficientes", cor: "#F59E0B" },
};

// Calcula o score normalizado (0-100) a partir das respostas e critérios
export function calcularScore(respostas = [], criterios = []) {
  if (!criterios.length) return { score: 0, preenchimento: 0, classificacao: "pendente" };

  let pesoTotal = 0;
  let pesoAtendido = 0;
  let respondidas = 0;
  let obrigatoriasAusentes = 0;
  let eliminatorioFalhou = false;

  for (const criterio of criterios) {
    const peso = n(criterio.peso) || 1;
    pesoTotal += peso;

    const resposta = respostas.find((r) => r.perguntaId === criterio.perguntaId);
    if (!resposta || resposta.valor == null || resposta.valor === "") {
      if (criterio.obrigatoria) obrigatoriasAusentes++;
      continue;
    }

    respondidas++;

    // Verifica critério eliminatório
    if (criterio.eliminatoria && !avaliarCriterio(resposta.valor, criterio)) {
      eliminatorioFalhou = true;
      continue;
    }

    if (avaliarCriterio(resposta.valor, criterio)) {
      pesoAtendido += peso;
    }
  }

  const score = pesoTotal > 0 ? Math.round((pesoAtendido / pesoTotal) * 100) : 0;
  const preenchimento = criterios.length > 0 ? Math.round((respondidas / criterios.length) * 100) : 0;

  let classificacao;
  if (eliminatorioFalhou) {
    classificacao = "desqualificado";
  } else if (obrigatoriasAusentes > 0) {
    classificacao = "pendente";
  } else if (preenchimento < 50) {
    classificacao = "insuficiente";
  } else if (score >= CLASSIFICACOES.alta.min) {
    classificacao = "alta";
  } else if (score >= CLASSIFICACOES.media.min) {
    classificacao = "media";
  } else {
    classificacao = "baixa";
  }

  return {
    score,
    preenchimento,
    classificacao,
    respondidas,
    total: criterios.length,
    obrigatoriasAusentes,
    eliminatorioFalhou,
  };
}

// Avalia se uma resposta atende a um critério
function avaliarCriterio(valor, criterio) {
  if (!criterio.respostaEsperada && !criterio.condicao) return true;

  const condicao = criterio.condicao || "igual";
  const esperado = criterio.respostaEsperada;

  switch (condicao) {
    case "igual": return String(valor).toLowerCase() === String(esperado).toLowerCase();
    case "contem": return String(valor).toLowerCase().includes(String(esperado).toLowerCase());
    case "maior_que": return n(valor) > n(esperado);
    case "menor_que": return n(valor) < n(esperado);
    case "entre": {
      const [min, max] = (esperado || "").split(",").map(Number);
      return n(valor) >= min && n(valor) <= max;
    }
    case "sim": return String(valor).toLowerCase() === "sim" || valor === true;
    case "nao": return String(valor).toLowerCase() === "não" || String(valor).toLowerCase() === "nao" || valor === false;
    case "nao_vazio": return valor != null && String(valor).trim() !== "";
    default: return true;
  }
}

// Classifica prioridade a partir do score
export function classificarPrioridade(score) {
  if (score >= CLASSIFICACOES.alta.min) return "alta";
  if (score >= CLASSIFICACOES.media.min) return "media";
  return "baixa";
}

// Verifica se perguntas condicionais devem ser exibidas
export function perguntasVisiveis(perguntas = [], respostas = []) {
  return perguntas.filter((p) => {
    if (!p.condicionalDe) return true;
    const respRef = respostas.find((r) => r.perguntaId === p.condicionalDe);
    if (!respRef) return false;
    if (p.condicionalValor) {
      return String(respRef.valor).toLowerCase() === String(p.condicionalValor).toLowerCase();
    }
    return respRef.valor != null && String(respRef.valor).trim() !== "";
  });
}

// Gera uma estrutura de pergunta padrão
export function criarPergunta(dados = {}) {
  return {
    id: dados.id || `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    texto: dados.texto || "",
    tipo: dados.tipo || "texto_curto",
    obrigatoria: dados.obrigatoria ?? false,
    opcoes: dados.opcoes || [],
    condicionalDe: dados.condicionalDe || null,
    condicionalValor: dados.condicionalValor || null,
    ordem: n(dados.ordem),
  };
}

// Gera uma estrutura de critério padrão
export function criarCriterio(dados = {}) {
  return {
    perguntaId: dados.perguntaId || "",
    respostaEsperada: dados.respostaEsperada || "",
    condicao: dados.condicao || "nao_vazio",
    peso: n(dados.peso) || 1,
    importancia: dados.importancia || "media",
    obrigatoria: dados.obrigatoria ?? false,
    eliminatoria: dados.eliminatoria ?? false,
  };
}

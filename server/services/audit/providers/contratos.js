// Contratos de saída dos provedores.
//
// O motor nunca lê texto livre devolvido por um modelo. Cada capacidade tem um
// formato fixo, validado aqui antes de virar veredicto. Um modelo que devolve
// prosa, JSON quebrado ou campo faltando não derruba a auditoria: o resultado
// é rejeitado e o critério fica inconclusivo, que manda para revisão humana.
//
// Isso é o que mantém a regra de negócio na RYCS e não no fornecedor.

const num01 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
};

const bool = (v) => (typeof v === "boolean" ? v : null);

function falha(motivo) {
  return { valido: false, motivo, dados: null };
}

// ---------------------------------------------------------------- visão ----
// Esperado do VisionProvider. Campos ausentes viram null e o critério que
// dependia deles fica inconclusivo — nunca "false".
export function validarVisao(bruto) {
  if (!bruto || typeof bruto !== "object") return falha("Resposta de visão não é um objeto.");

  const confianca = num01(bruto.confidence ?? bruto.confianca);
  if (confianca === null) return falha("Resposta de visão sem confiança numérica entre 0 e 1.");

  return {
    valido: true,
    motivo: "",
    dados: {
      ambienteComercial: bool(bruto.business_environment_detected ?? bruto.ambienteComercial),
      fachadaDetectada: bool(bruto.storefront_detected ?? bruto.fachadaDetectada),
      pessoaPresente: bool(bruto.person_detected ?? bruto.pessoaPresente),
      conteudoSuspeito: bool(bruto.suspicious_content ?? bruto.conteudoSuspeito),
      possivelManipulacao: bool(bruto.possible_manipulation ?? bruto.possivelManipulacao),
      confianca,
      observacao: String(bruto.notes ?? bruto.observacao ?? "").slice(0, 400),
    },
  };
}

// --------------------------------------------------------- transcrição ----
export function validarTranscricao(bruto) {
  if (!bruto || typeof bruto !== "object") return falha("Resposta de transcrição não é um objeto.");
  const texto = String(bruto.text ?? bruto.texto ?? "").trim();
  if (!texto) return falha("Transcrição vazia.");

  const segmentos = (Array.isArray(bruto.segments ?? bruto.segmentos) ? (bruto.segments ?? bruto.segmentos) : [])
    .map((s) => ({
      inicio: Number(s.start ?? s.inicio) || 0,
      fim: Number(s.end ?? s.fim) || 0,
      texto: String(s.text ?? s.texto ?? "").slice(0, 2000),
      locutor: s.speaker ?? s.locutor ?? null,
      confianca: num01(s.confidence ?? s.confianca),
    }))
    .filter((s) => s.texto);

  const duracao = Number(bruto.duration ?? bruto.duracao) ||
    (segmentos.length ? segmentos[segmentos.length - 1].fim : 0);

  return {
    valido: true,
    motivo: "",
    dados: {
      texto: texto.slice(0, 200000),
      segmentos,
      duracaoSegundos: duracao,
      idioma: String(bruto.language ?? bruto.idioma ?? "").slice(0, 12) || null,
      confianca: num01(bruto.confidence ?? bruto.confianca),
      locutores: [...new Set(segmentos.map((s) => s.locutor).filter(Boolean))],
    },
  };
}

// ----------------------------------------------------------- semântica ----
// O provedor recebe a transcrição e os critérios da política e devolve um
// veredicto por critério, com o trecho que sustenta a resposta. É o trecho que
// permite mostrar POR QUE a auditoria aprovou ou reprovou.
export function validarSemantica(bruto, criteriosEsperados = []) {
  const lista = Array.isArray(bruto?.criteria ?? bruto?.criterios) ? (bruto.criteria ?? bruto.criterios) : null;
  if (!lista) return falha("Resposta semântica sem a lista de critérios.");

  const esperados = new Set(criteriosEsperados);
  const avaliacoes = [];

  for (const item of lista) {
    const chave = String(item?.criterion_id ?? item?.chave ?? "").trim();
    if (!chave || (esperados.size && !esperados.has(chave))) continue;

    const confianca = num01(item.confidence ?? item.confianca);
    const atendido = bool(item.met ?? item.atendido);
    if (confianca === null || atendido === null) continue;

    avaliacoes.push({
      chave,
      atendido,
      confianca,
      justificativa: String(item.reasoning ?? item.justificativa ?? "").slice(0, 600),
      evidencia: (Array.isArray(item.evidence ?? item.evidencia) ? (item.evidence ?? item.evidencia) : [])
        .slice(0, 5)
        .map((e) => ({ inicio: Number(e.start ?? e.inicio) || 0, fim: Number(e.end ?? e.fim) || 0, trecho: String(e.text ?? e.trecho ?? "").slice(0, 500) })),
    });
  }

  if (!avaliacoes.length) return falha("Nenhum critério da política foi avaliado de forma utilizável.");
  return { valido: true, motivo: "", dados: { avaliacoes } };
}

// O prompt/esquema que um adapter semântico deve pedir ao modelo. Fica aqui
// para todos os adapters pedirem a mesma coisa — se cada um pedisse do seu
// jeito, a validação acima passaria a depender do fornecedor.
export function esquemaSemantico(criterios) {
  return {
    instrucao:
      "Avalie cada critério contra a transcrição fornecida. Responda APENAS com JSON no formato indicado. " +
      "Um critério só é atendido quando a transcrição mostra que aconteceu, não quando uma palavra aparece. " +
      "Cite o trecho que sustenta cada resposta. Se não houver base, responda met=false com confiança baixa.",
    formato: {
      criteria: [{ criterion_id: "string", met: "boolean", confidence: "number 0..1", reasoning: "string", evidence: [{ start: "number", end: "number", text: "string" }] }],
    },
    criterios: criterios.map((c) => ({ criterion_id: c.chave, description: c.descricao, weight: c.peso })),
  };
}

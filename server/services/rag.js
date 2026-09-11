const termos = (texto) => String(texto || "").toLocaleLowerCase("pt-BR")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{3,}/g) || [];

export function recuperarTrechos(pergunta, documentos, limite = 4) {
  const busca = new Set(termos(pergunta));
  return documentos.map((doc) => {
    const partes = String(doc.conteudo || "").split(/\n{2,}|(?<=[.!?])\s+/).filter(Boolean);
    const melhor = partes.map((trecho, secao) => ({
      trecho: trecho.slice(0, 900), secao: secao + 1,
      pontos: termos(trecho).reduce((n, t) => n + (busca.has(t) ? 1 : 0), 0),
    })).sort((a, b) => b.pontos - a.pontos)[0];
    return melhor ? { ...melhor, documento: doc.titulo, documentId: doc.id, versao: doc.versao, atualizadoEm: doc.atualizadoEm } : null;
  }).filter((x) => x?.pontos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, limite);
}

export function responderComFontes(pergunta, documentos) {
  const fontes = recuperarTrechos(pergunta, documentos);
  if (!fontes.length) return {
    resposta: "Não encontrei informação suficiente nas fontes autorizadas da empresa.",
    fontes: [], confianca: 0, informacaoAusente: true,
    acaoRecomendada: "Adicione ou atualize um material relacionado na base de conhecimento.",
  };
  return {
    resposta: fontes.map((f) => f.trecho).join("\n\n"), fontes,
    confianca: Math.min(95, 45 + fontes.reduce((n, f) => n + f.pontos * 8, 0)),
    informacaoAusente: false, acaoRecomendada: "Revise as fontes antes de executar qualquer alteração.",
  };
}

export const termos = (texto) => String(texto || "").toLocaleLowerCase("pt-BR")
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

// Aulas inteiras, não trechos soltos: uma técnica de vendas só faz sentido com
// o passo a passo junto. A nota é quantos termos distintos da base aparecem na
// aula, dividida pela raiz do tamanho dela (aula longa não ganha só por ser
// longa). Aulas dos cursos em `prioridade` ganham bônus. Para quando o total
// de texto chega a `maxCaracteres`.
export function escolherAulas(base, aulas, { prioridade = [], maxCaracteres = 30000, maxPorAula = 6000 } = {}) {
  const busca = new Set(termos(base));
  const notas = aulas.map((a) => {
    const proprios = new Set(termos(`${a.titulo} ${a.conteudo}`));
    let comuns = 0;
    for (const t of proprios) if (busca.has(t)) comuns++;
    const bonus = prioridade.some((re) => re.test(a.curso || "")) ? 1.5 : 1;
    return { ...a, nota: (comuns / Math.sqrt(Math.max(proprios.size, 1))) * bonus };
  }).filter((a) => a.nota > 0).sort((x, y) => y.nota - x.nota);
  const escolhidas = [];
  let total = 0;
  for (const a of notas) {
    const conteudo = String(a.conteudo).slice(0, maxPorAula);
    if (total + conteudo.length > maxCaracteres) continue;
    total += conteudo.length;
    escolhidas.push({ ...a, conteudo });
  }
  return escolhidas;
}

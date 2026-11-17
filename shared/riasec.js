// =============================================================================
// RIASEC — Interesses Profissionais — inventário autoral RYCS (36 atividades)
//
// Inventário VOLUNTÁRIO de interesses, baseado nas seis categorias da teoria
// vocacional de Holland (Realista, Investigativo, Artístico, Social,
// Empreendedor, Convencional). 36 atividades, 6 por dimensão. Ajuda o
// profissional a identificar atividades que despertam seu interesse,
// independentemente de experiência ou habilidade atual.
//
// NATUREZA (importante): instrumento AUTORAL da RYCS. NÃO é um instrumento
// psicométrico oficialmente validado, NÃO mede habilidade/competência e NÃO
// determina quais profissões a pessoa pode exercer. Os resultados são apenas
// INTERESSE autorrelatado (soma e média 1–5). O "código exploratório" (3 letras)
// é um resumo descritivo dos interesses declarados, nunca uma classificação
// profissional definitiva. Sem percentis e sem comparação com normas.
//
// SEGURANÇA / CHAVE: o mapeamento atividade → dimensão é a "chave" do teste e
// vive só aqui (servidor). O frontend recebe apenas os itens públicos (sem a
// dimensão) via `itensPublicos()` — a spec exige NÃO mostrar a dimensão durante
// o preenchimento. A pontuação SEMPRE usa a chave oficial daqui.
//
// I18N: os identificadores (versão, ids de item, dimensões, escala) são ESTÁVEIS
// e independentes de idioma. Só os textos são traduzíveis. Nunca use texto
// traduzido como identificador.
// =============================================================================

export const RIASEC_VERSAO = "rycs-riasec-v1-36";
export const RIASEC_INSTRUMENTO = "RYCS — RIASEC Interesses Profissionais (36 atividades)";
export const RIASEC_IDIOMA = "pt-BR";
export const RIASEC_FONTE =
  "Inventário autoral RYCS, baseado nas seis categorias da teoria vocacional de Holland (RIASEC)";
export const RIASEC_CHAVE = "rycs-riasec-v1";
export const RIASEC_ALGORITMO = "soma-media-codigo-v1";
export const RIASEC_TOTAL = 36;
export const RIASEC_ESCALA = 5; // interesse 1–5
export const RIASEC_ITENS_POR_DIMENSAO = 6;

// Experimental: o rótulo acompanha o resultado enquanto houver revisão interna.
export const RIASEC_EXPERIMENTAL = true;

// Pendências de revisão (spec, seção 12).
export const RIASEC_PENDENCIAS = [
  "Revisão interna das 36 atividades quanto a clareza, redundância e vieses antes da liberação geral.",
  "Instrumento autoral, não psicométrico: resultados apresentados apenas como interesse autorrelatado (média 1–5), nunca como percentis, aptidão ou classificação profissional.",
  "Revisão interna dos textos interpretativos das seis dimensões.",
];

// Flag de disponibilização. LIGADA por padrão (liberada aos profissionais).
// Pode ser desligada com RIASEC_DISPONIVEL=0 (ex.: pausar para revisão), e segue
// ligada em ambiente beta — ver a rota.
export const riasecDisponivel = () =>
  String(process.env.RIASEC_DISPONIVEL ?? "1").trim() !== "0";

// -----------------------------------------------------------------------------
// As seis dimensões, na ordem de apresentação do gráfico (R→I→A→S→E→C). `chave`
// interno estável; cor é uma variação discreta do azul institucional (spec,
// seção 7). `descricao` = texto interpretativo (spec, seção 8). `resumo` = frase
// curta para a interpretação combinada. `atividades` = exemplos de exploração
// (spec, seção 7), apresentados como possibilidades, nunca recomendações.
// -----------------------------------------------------------------------------
export const ORDEM_DIMENSOES = ["R", "I", "A", "S", "E", "C"];

export const DIMENSOES_RIASEC = {
  R: {
    chave: "R",
    nome: "Realista",
    cor: "#318CE7",
    descricao: "Você demonstrou interesse por atividades práticas, execução técnica e trabalho com ferramentas, equipamentos ou objetos físicos.",
    resumo: "execução prática e técnica",
    atividades: ["Operação técnica", "Manutenção", "Atividades práticas"],
  },
  I: {
    chave: "I",
    nome: "Investigativo",
    cor: "#4A9BEB",
    descricao: "Você demonstrou interesse por pesquisa, análise de informações e compreensão de problemas.",
    resumo: "pesquisa e análise de informações",
    atividades: ["Pesquisa", "Análise de dados", "Diagnóstico de problemas"],
  },
  A: {
    chave: "A",
    nome: "Artístico",
    cor: "#2D7FD0",
    descricao: "Você demonstrou interesse por atividades criativas, expressão de ideias e desenvolvimento de conteúdos originais.",
    resumo: "criação e expressão de ideias",
    atividades: ["Criação de conteúdo", "Design", "Comunicação criativa"],
  },
  S: {
    chave: "S",
    nome: "Social",
    cor: "#5CA8EF",
    descricao: "Você demonstrou interesse por atividades que envolvem orientação, ensino, colaboração e desenvolvimento de pessoas.",
    resumo: "interação e desenvolvimento de pessoas",
    atividades: ["Treinamento", "Atendimento", "Orientação de pessoas"],
  },
  E: {
    chave: "E",
    nome: "Empreendedor",
    cor: "#1E6FB8",
    descricao: "Você demonstrou interesse por negociação, liderança, apresentação de ideias e busca de oportunidades.",
    resumo: "negociação e busca de oportunidades",
    atividades: ["Vendas", "Negociação", "Desenvolvimento de negócios"],
  },
  C: {
    chave: "C",
    nome: "Convencional",
    cor: "#73B4F2",
    descricao: "Você demonstrou interesse por organização, controle de informações e execução de processos estruturados.",
    resumo: "organização e controle de processos",
    atividades: ["Rotinas administrativas", "Organização de informações", "Controle de processos"],
  },
};

// Nota global de interpretação, sempre exibida com o resultado (spec, seções 6,
// 8 e 10). Descritiva, voluntária e não-diagnóstica.
export const RIASEC_NOTA_GLOBAL =
  "Este mapa descreve seus interesses declarados por atividades — não suas habilidades, competências " +
  "ou aptidão para profissões. As médias (de 1 a 5) refletem apenas o quanto você disse gostar de cada " +
  "tipo de atividade; não são percentis nem comparação com normas populacionais. O código RIASEC é um " +
  "resumo exploratório dos seus interesses, não uma classificação profissional definitiva nem recomendação " +
  "de carreira. Inventário autoral RYCS, voluntário, baseado nas categorias de Holland; não é instrumento " +
  "psicométrico validado.";

// Cabeçalhos de seções do relatório (spec, seção 7).
export const RIASEC_TITULO_DESTAQUES = "Suas áreas de interesse mais destacadas";
export const RIASEC_TITULO_EXPLORACAO = "Atividades que você pode gostar de explorar";

// -----------------------------------------------------------------------------
// Alternativas de resposta (escala de interesse 1–5). `valor` é o identificador
// estável; `texto` é traduzível (spec, seção 4).
// -----------------------------------------------------------------------------
export const ALTERNATIVAS = [
  { valor: 1, texto: "Nenhum interesse" },
  { valor: 2, texto: "Pouco interesse" },
  { valor: 3, texto: "Interesse moderado" },
  { valor: 4, texto: "Muito interesse" },
  { valor: 5, texto: "Interesse extremamente alto" },
];

// -----------------------------------------------------------------------------
// As 36 atividades (spec, seção 5). Cada item:
//   id        → identificador estável (r01..c06)
//   texto     → atividade exibida ao participante
//   dimensao  → R | I | A | S | E | C (interno; NUNCA enviado ao cliente)
// -----------------------------------------------------------------------------
export const ITENS_RIASEC = [
  // R — Realista
  { id: "r01", dimensao: "R", texto: "Montar, instalar ou ajustar equipamentos." },
  { id: "r02", dimensao: "R", texto: "Realizar reparos simples em ferramentas ou dispositivos." },
  { id: "r03", dimensao: "R", texto: "Trabalhar com atividades práticas que exigem coordenação manual." },
  { id: "r04", dimensao: "R", texto: "Operar equipamentos utilizados em processos produtivos." },
  { id: "r05", dimensao: "R", texto: "Construir ou modificar objetos físicos." },
  { id: "r06", dimensao: "R", texto: "Executar tarefas técnicas seguindo instruções práticas." },
  // I — Investigativo
  { id: "i01", dimensao: "I", texto: "Investigar as causas de um problema complexo." },
  { id: "i02", dimensao: "I", texto: "Analisar dados para identificar padrões." },
  { id: "i03", dimensao: "I", texto: "Pesquisar informações para compreender um assunto." },
  { id: "i04", dimensao: "I", texto: "Testar hipóteses para descobrir a melhor solução." },
  { id: "i05", dimensao: "I", texto: "Comparar diferentes explicações para um problema." },
  { id: "i06", dimensao: "I", texto: "Elaborar análises que ajudem outras pessoas a tomar decisões." },
  // A — Artístico
  { id: "a01", dimensao: "A", texto: "Criar peças visuais ou materiais gráficos." },
  { id: "a02", dimensao: "A", texto: "Desenvolver ideias originais para campanhas e projetos." },
  { id: "a03", dimensao: "A", texto: "Produzir textos criativos ou roteiros." },
  { id: "a04", dimensao: "A", texto: "Explorar diferentes estilos de comunicação visual." },
  { id: "a05", dimensao: "A", texto: "Criar conteúdos que expressem ideias de maneira original." },
  { id: "a06", dimensao: "A", texto: "Participar de projetos que permitam liberdade criativa." },
  // S — Social
  { id: "s01", dimensao: "S", texto: "Ensinar alguém a desenvolver uma habilidade." },
  { id: "s02", dimensao: "S", texto: "Orientar pessoas diante de dificuldades." },
  { id: "s03", dimensao: "S", texto: "Ajudar colegas a compreender novos processos." },
  { id: "s04", dimensao: "S", texto: "Participar de atividades voltadas ao desenvolvimento de pessoas." },
  { id: "s05", dimensao: "S", texto: "Escutar alguém e ajudá-lo a organizar suas ideias." },
  { id: "s06", dimensao: "S", texto: "Colaborar em iniciativas que beneficiem outras pessoas." },
  // E — Empreendedor
  { id: "e01", dimensao: "E", texto: "Apresentar uma proposta comercial a um cliente." },
  { id: "e02", dimensao: "E", texto: "Negociar condições para fechar um acordo." },
  { id: "e03", dimensao: "E", texto: "Liderar uma equipe em busca de objetivos." },
  { id: "e04", dimensao: "E", texto: "Identificar oportunidades para iniciar um negócio." },
  { id: "e05", dimensao: "E", texto: "Convencer pessoas a apoiar uma ideia." },
  { id: "e06", dimensao: "E", texto: "Planejar estratégias para aumentar resultados comerciais." },
  // C — Convencional
  { id: "c01", dimensao: "C", texto: "Organizar documentos e registros." },
  { id: "c02", dimensao: "C", texto: "Conferir informações para identificar inconsistências." },
  { id: "c03", dimensao: "C", texto: "Manter planilhas e controles atualizados." },
  { id: "c04", dimensao: "C", texto: "Seguir procedimentos para garantir a qualidade de um processo." },
  { id: "c05", dimensao: "C", texto: "Classificar informações de maneira estruturada." },
  { id: "c06", dimensao: "C", texto: "Planejar rotinas administrativas e acompanhar prazos." },
];

const ITEM_POR_ID = Object.fromEntries(ITENS_RIASEC.map((i) => [i.id, i]));

// Metadados das dimensões para o frontend (sem expor a chave — a relação
// item → dimensão não sai daqui).
export function dimensoesPublicas() {
  return ORDEM_DIMENSOES.map((d) => ({
    chave: DIMENSOES_RIASEC[d].chave,
    nome: DIMENSOES_RIASEC[d].nome,
    cor: DIMENSOES_RIASEC[d].cor,
  }));
}

// Itens públicos: só id + texto, na ordem oficial. Nunca revela a dimensão
// avaliada (spec, seção 4: "Não mostrar a dimensão RIASEC durante o preenchimento").
export function itensPublicos() {
  return ITENS_RIASEC.map((i) => ({ id: i.id, texto: i.texto }));
}

function respostaValida(v) {
  return Number.isInteger(v) && v >= 1 && v <= RIASEC_ESCALA;
}

// Saneia um mapa de respostas: mantém só itens conhecidos com valor inteiro 1–5.
export function sanearRespostas(respostas) {
  const limpas = {};
  if (!respostas || typeof respostas !== "object") return limpas;
  for (const [id, valor] of Object.entries(respostas)) {
    const v = Number(valor);
    if (ITEM_POR_ID[id] && respostaValida(v)) limpas[id] = v;
  }
  return limpas;
}

// Número de itens respondidos (para progresso).
export function contarRespondidos(respostas) {
  if (!respostas || typeof respostas !== "object") return 0;
  let n = 0;
  for (const item of ITENS_RIASEC) {
    if (respostaValida(Number(respostas[item.id]))) n += 1;
  }
  return n;
}

// -----------------------------------------------------------------------------
// Validação server-side: todas as 36 atividades respondidas, cada uma inteiro
// 1–5 (spec, seção 11).
// -----------------------------------------------------------------------------
export function validarRespostas(respostas) {
  if (!respostas || typeof respostas !== "object")
    return { ok: false, codigo: "FORMATO", erro: "Respostas ausentes ou inválidas." };

  const faltando = [];
  for (const item of ITENS_RIASEC) {
    const v = Number(respostas[item.id]);
    if (!respostaValida(v)) faltando.push(item.id);
  }
  if (faltando.length)
    return { ok: false, codigo: "INCOMPLETO", erro: `Faltam ${faltando.length} respostas.`, faltando };

  for (const id of Object.keys(respostas)) {
    if (!ITEM_POR_ID[id])
      return { ok: false, codigo: "ITEM_INVALIDO", erro: `Item desconhecido: ${id}.` };
  }
  return { ok: true };
}

// Dimensões ordenadas pela média (desc); em empate, mantém a ordem de
// apresentação. Recebe o mapa `dimensoes` do resultado.
function ordenarPorMedia(dimensoes) {
  return ORDEM_DIMENSOES
    .map((d, i) => ({ chave: d, media: dimensoes?.[d]?.media || 0, ordem: i }))
    .sort((a, b) => (b.media - a.media) || (a.ordem - b.ordem));
}

// Três dimensões mais destacadas, PRESERVANDO EMPATES no corte (spec, seções 6
// e 7). Se a 3ª empata com as seguintes, todas as empatadas entram.
export function dimensoesDestaque(resultado) {
  const ordenado = ordenarPorMedia(resultado?.dimensoes || {});
  if (ordenado.length <= 3) return ordenado.map((d) => d.chave);
  const corte = ordenado[2].media; // média da 3ª colocada
  return ordenado.filter((d) => d.media >= corte).map((d) => d.chave);
}

// Código exploratório de três letras (spec, seção 6). Só é gerado quando as três
// primeiras dimensões têm ordem ÚNICA — médias estritamente decrescentes entre a
// 1ª, a 2ª, a 3ª e a 4ª. Havendo qualquer empate que impeça a ordem única,
// retorna null (o relatório então mostra as dimensões empatadas, sem forçar código).
export function codigoExploratorio(resultado) {
  const o = ordenarPorMedia(resultado?.dimensoes || {});
  if (o.length < 4) return null;
  const ordemUnica = o[0].media > o[1].media && o[1].media > o[2].media && o[2].media > o[3].media;
  return ordemUnica ? o.slice(0, 3).map((d) => d.chave).join("") : null;
}

// -----------------------------------------------------------------------------
// Cálculo das seis dimensões (spec, seção 6). Para cada dimensão: SOMA das 6
// respostas (6–30) e MÉDIA (1–5, uma casa). Também computa as dimensões
// destacadas e o código exploratório (quando houver ordem única), persistidos no
// resultado. NÃO calcula percentis nem compara com normas.
// -----------------------------------------------------------------------------
export function calcularResultado(respostas) {
  const acc = {};
  for (const d of ORDEM_DIMENSOES) acc[d] = { soma: 0, itens: 0 };

  for (const item of ITENS_RIASEC) {
    const v = Number(respostas?.[item.id]);
    if (!respostaValida(v)) continue;
    acc[item.dimensao].soma += v;
    acc[item.dimensao].itens += 1;
  }

  const dimensoes = {};
  for (const d of ORDEM_DIMENSOES) {
    const { soma, itens } = acc[d];
    dimensoes[d] = {
      chave: d,
      soma, // 6–30 quando completo
      itens,
      // Média na escala 1–5 (uma casa decimal). Não é percentil nem aptidão.
      media: itens ? Math.round((soma / itens) * 10) / 10 : 0,
      maximo: itens * RIASEC_ESCALA,
    };
  }

  const resultadoParcial = { dimensoes };
  const destaques = dimensoesDestaque(resultadoParcial);
  const codigo = codigoExploratorio(resultadoParcial);

  return {
    versao: RIASEC_VERSAO,
    instrumento: RIASEC_INSTRUMENTO,
    idioma: RIASEC_IDIOMA,
    fonte: RIASEC_FONTE,
    chave: RIASEC_CHAVE,
    algoritmo: RIASEC_ALGORITMO,
    escala: RIASEC_ESCALA,
    experimental: RIASEC_EXPERIMENTAL,
    dimensoes,
    destaques,
    codigo,
  };
}

// Junta frases em linguagem natural: "a", "a e b", "a, b e c".
function juntarFrases(itens) {
  if (!itens.length) return "";
  if (itens.length === 1) return itens[0];
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

// -----------------------------------------------------------------------------
// Relatório interpretativo DETERMINÍSTICO (sem IA). Seis dimensões, destaques,
// código exploratório (ou empate preservado) e interpretação combinada a partir
// de textos controlados. Nunca diagnóstico, aptidão ou recomendação de carreira.
// -----------------------------------------------------------------------------
export function montarRelatorio(resultado) {
  const dims = resultado?.dimensoes || {};
  const dimensoes = ORDEM_DIMENSOES.map((d) => {
    const meta = DIMENSOES_RIASEC[d];
    const r = dims[d] || { soma: 0, media: 0, itens: 0, maximo: 0 };
    return {
      chave: d,
      nome: meta.nome,
      cor: meta.cor,
      soma: r.soma,
      media: r.media,
      maximo: r.maximo,
      descricao: meta.descricao,
      atividades: meta.atividades,
    };
  });

  const chavesDestaque = Array.isArray(resultado?.destaques) && resultado.destaques.length
    ? resultado.destaques
    : dimensoesDestaque(resultado);
  const destaques = chavesDestaque.map((c) => dimensoes.find((d) => d.chave === c)).filter(Boolean);
  const codigo = resultado?.codigo ?? codigoExploratorio(resultado);

  // Interpretação combinada a partir das frases controladas das dimensões em
  // destaque. Apenas descritiva.
  const resumos = chavesDestaque.map((c) => DIMENSOES_RIASEC[c]?.resumo).filter(Boolean);
  const descricaoCombinada = resumos.length
    ? `Suas respostas indicam maior interesse por atividades que envolvem ${juntarFrases(resumos)}.`
    : "";

  return {
    instrumento: RIASEC_INSTRUMENTO,
    fonte: RIASEC_FONTE,
    experimental: RIASEC_EXPERIMENTAL,
    escala: RIASEC_ESCALA,
    notaGlobal: RIASEC_NOTA_GLOBAL,
    tituloDestaques: RIASEC_TITULO_DESTAQUES,
    tituloExploracao: RIASEC_TITULO_EXPLORACAO,
    codigo,
    empateNoCodigo: !codigo,
    descricaoCombinada,
    destaques,
    dimensoes,
  };
}

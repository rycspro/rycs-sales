// =============================================================================
// Padrões de Autossabotagem — instrumento autoral RYCS (40 afirmações)
//
// Avaliação VOLUNTÁRIA de autoconhecimento profissional. 40 afirmações
// distribuídas em OITO padrões de comportamento (5 afirmações por padrão). Ajuda
// o profissional a reconhecer hábitos e reações que podem dificultar seu
// desenvolvimento.
//
// NATUREZA (importante): instrumento AUTORAL da RYCS, inspirado em conceitos
// gerais de autoconhecimento e comportamento. NÃO é o teste de "Sabotadores" de
// Shirzad Chamine, NÃO é diagnóstico psicológico e NÃO possui validade
// psicométrica comprovada. Os resultados são apresentados apenas como FREQUÊNCIA
// autorrelatada (soma e média 1–5), nunca como percentis, scores de risco ou
// classificações clínicas.
//
// SEGURANÇA / CHAVE: o mapeamento afirmação → padrão é a "chave" do teste e vive
// só aqui (servidor). O frontend recebe apenas os itens públicos (sem o padrão)
// via `itensPublicos()` — a spec exige NÃO mostrar o padrão durante o teste. A
// pontuação SEMPRE usa a chave oficial daqui, nunca padrões vindos do cliente.
//
// I18N: os identificadores (versão, ids de item, padrões, escala) são ESTÁVEIS e
// independentes de idioma. Só os textos são traduzíveis. Nunca use texto
// traduzido como identificador.
// =============================================================================

export const AUTO_VERSAO = "rycs-autossabotagem-v1-40";
export const AUTO_INSTRUMENTO = "RYCS — Padrões de Autossabotagem (40 afirmações)";
export const AUTO_IDIOMA = "pt-BR";
export const AUTO_FONTE =
  "Instrumento autoral RYCS, inspirado em conceitos gerais de autoconhecimento e comportamento";
export const AUTO_CHAVE = "rycs-autossabotagem-v1";
export const AUTO_ALGORITMO = "soma-media-v1";
export const AUTO_TOTAL = 40;
export const AUTO_ESCALA = 5; // frequência 1–5
export const AUTO_ITENS_POR_PADRAO = 5;

// Experimental: liberada inicialmente sob feature flag para revisão interna
// (spec, seção 13). O rótulo "experimental" sempre acompanha o resultado.
export const AUTO_EXPERIMENTAL = true;

// Pendências de revisão antes da liberação geral (spec, seção 12).
export const AUTO_PENDENCIAS = [
  "Revisão interna das 40 afirmações quanto a clareza, redundância e vieses culturais antes da liberação geral.",
  "Instrumento autoral, sem validade psicométrica comprovada: resultados apresentados apenas como frequência autorrelatada (média 1–5), nunca como percentis ou diagnóstico.",
  "Revisão interna dos textos interpretativos dos oito padrões.",
];

// Flag de disponibilização. DESLIGADA por padrão: a avaliação só aparece aos
// profissionais quando AUTOSSABOTAGEM_DISPONIVEL=1 (ou, no servidor, em ambiente
// beta — ver a rota). Mantém o questionário fora do ar durante a revisão interna.
export const autossabotagemDisponivel = () =>
  String(process.env.AUTOSSABOTAGEM_DISPONIVEL ?? "0").trim() === "1";

// -----------------------------------------------------------------------------
// Os oito padrões, na ordem de apresentação do gráfico (A→H). `chave` interno
// estável. Conteúdo interpretativo (spec, seções 7 e 8), sempre descritivo e
// não-diagnóstico: representa / cotidiano / atencao / reflexao / acao.
// -----------------------------------------------------------------------------
export const ORDEM_PADROES = ["A", "B", "C", "D", "E", "F", "G", "H"];

export const PADROES_AUTO = {
  A: {
    chave: "A",
    nome: "Autocrítica excessiva",
    cor: "#318CE7",
    descricao: "Você relatou comportamentos relacionados à cobrança pessoal e à dificuldade de reconhecer os próprios resultados.",
    cotidiano: "Pode aparecer ao remoer erros já resolvidos, minimizar elogios ou sentir que nenhuma entrega foi suficientemente boa.",
    atencao: "Vale observar quando a autocrítica deixa de orientar melhorias e passa a desgastar sua confiança e motivação.",
    reflexao: "Procure observar se suas avaliações pessoais consideram também os progressos e aprendizados.",
    acao: "Registre uma conquista e um aprendizado ao finalizar uma tarefa importante.",
  },
  B: {
    chave: "B",
    nome: "Perfeccionismo",
    cor: "#318CE7",
    descricao: "Suas respostas indicam frequência de comportamentos relacionados à revisão excessiva e à busca por resultados ideais.",
    cotidiano: "Pode surgir ao adiar entregas em busca do resultado perfeito ou ao dedicar muito tempo a detalhes de baixo impacto.",
    atencao: "Merece atenção quando o padrão de qualidade atrasa entregas ou gera cansaço desproporcional ao ganho real.",
    reflexao: "Considere quando melhorar um detalhe realmente contribui para a qualidade da entrega.",
    acao: "Defina critérios objetivos de conclusão antes de iniciar uma atividade.",
  },
  C: {
    chave: "C",
    nome: "Necessidade de aprovação",
    cor: "#318CE7",
    descricao: "Você relatou situações em que a percepção dos outros pode influenciar suas decisões.",
    cotidiano: "Pode aparecer ao evitar discordar, aceitar demandas acima da capacidade ou depender do retorno alheio para se sentir seguro(a).",
    atencao: "Vale observar quando o desejo de agradar faz você deixar de lado prioridades ou limites importantes.",
    reflexao: "Observe quando o desejo de agradar interfere nas suas prioridades.",
    acao: "Pratique comunicar um limite de maneira respeitosa e objetiva.",
  },
  D: {
    chave: "D",
    nome: "Controle excessivo",
    cor: "#318CE7",
    descricao: "Suas respostas sugerem preferência por acompanhar de perto situações e decisões.",
    cotidiano: "Pode surgir ao ter dificuldade de aceitar métodos diferentes, antecipar muitos detalhes ou se incomodar com imprevistos.",
    atencao: "Merece atenção quando a necessidade de controle sobrecarrega você ou limita a autonomia de quem trabalha ao seu lado.",
    reflexao: "Considere quais aspectos realmente precisam estar sob seu controle.",
    acao: "Em uma atividade de baixo risco, experimente permitir que outra pessoa escolha o método de execução.",
  },
  E: {
    chave: "E",
    nome: "Evitação de conflitos",
    cor: "#318CE7",
    descricao: "Você relatou comportamentos relacionados ao adiamento de conversas difíceis.",
    cotidiano: "Pode aparecer ao permanecer em silêncio para evitar tensão, concordar sem convicção ou adiar assuntos delicados.",
    atencao: "Vale observar quando evitar o conflito mantém problemas sem solução ou acumula desconfortos ao longo do tempo.",
    reflexao: "Observe se evitar uma conversa está ajudando a resolver o problema ou apenas adiando sua resolução.",
    acao: "Prepare uma conversa objetiva sobre uma situação simples que precisa ser esclarecida.",
  },
  F: {
    chave: "F",
    nome: "Preocupação antecipatória",
    cor: "#318CE7",
    descricao: "Suas respostas indicam frequência de pensamentos relacionados a possíveis dificuldades futuras.",
    cotidiano: "Pode surgir ao imaginar problemas que ainda não ocorreram ou ao ter dificuldade de relaxar diante de incertezas.",
    atencao: "Merece atenção quando a antecipação de cenários negativos dificulta decisões ou consome energia desnecessária.",
    reflexao: "Diferencie problemas que já existem de situações que ainda são apenas possibilidades.",
    acao: "Liste o que está sob seu controle e uma próxima ação concreta.",
  },
  G: {
    chave: "G",
    nome: "Hiperprodutividade",
    cor: "#318CE7",
    descricao: "Você relatou comportamentos associados à dificuldade de desacelerar e estabelecer limites de trabalho.",
    cotidiano: "Pode aparecer ao sentir desconforto em pausas, assumir mais tarefas do que cabe ou priorizar resultados em vez do descanso.",
    atencao: "Vale observar quando a rotina não deixa espaço suficiente para recuperação e descanso.",
    reflexao: "Considere se sua rotina permite períodos suficientes de recuperação.",
    acao: "Planeje uma pausa e respeite seu horário de encerramento.",
  },
  H: {
    chave: "H",
    nome: "Dificuldade de delegar",
    cor: "#318CE7",
    descricao: "Suas respostas indicam frequência de comportamentos relacionados à centralização de atividades.",
    cotidiano: "Pode surgir ao preferir executar sozinho(a), acompanhar cada detalhe após delegar ou refazer o trabalho de outras pessoas.",
    atencao: "Merece atenção quando a centralização sobrecarrega você e limita o desenvolvimento da equipe.",
    reflexao: "Observe quais tarefas poderiam ser realizadas por outras pessoas com orientações claras.",
    acao: "Escolha uma atividade simples para delegar, definindo resultado esperado e prazo.",
  },
};

// Nota global de interpretação, sempre exibida com o resultado. Descritiva,
// voluntária e não-diagnóstica (spec, seções 6, 8 e 9).
export const AUTO_NOTA_GLOBAL =
  "Este relatório descreve a frequência de comportamentos a partir das suas respostas. " +
  "Nenhum padrão é um diagnóstico ou classificação clínica. Médias mais altas indicam apenas " +
  "que você relatou com mais frequência os comportamentos daquele conjunto de afirmações — não " +
  "existem padrões melhores ou piores, e esta avaliação não infere saúde mental. " +
  "Instrumento autoral RYCS, voluntário, inspirado em conceitos gerais de autoconhecimento e " +
  "comportamento; não é o teste de Sabotadores de Shirzad Chamine nem substitui avaliação profissional.";

// Cabeçalho da seção de destaques (spec, seção 6): nunca "seus três sabotadores".
export const AUTO_TITULO_DESTAQUES = "Padrões mais frequentes nas suas respostas";

// -----------------------------------------------------------------------------
// Alternativas de resposta (escala de frequência 1–5). `valor` é o identificador
// estável; `texto` é traduzível (spec, seção 4).
// -----------------------------------------------------------------------------
export const ALTERNATIVAS = [
  { valor: 1, texto: "Nunca ou quase nunca" },
  { valor: 2, texto: "Raramente" },
  { valor: 3, texto: "Às vezes" },
  { valor: 4, texto: "Frequentemente" },
  { valor: 5, texto: "Quase sempre" },
];

// -----------------------------------------------------------------------------
// As 40 afirmações (spec, seção 5). Cada item:
//   id      → identificador estável (a01..h05)
//   texto   → afirmação exibida ao participante
//   padrao  → A..H (interno; NUNCA enviado ao cliente)
// Todas as afirmações são diretas (frequência maior = mais do padrão); não há
// itens reversos neste instrumento.
// -----------------------------------------------------------------------------
export const ITENS_AUTO = [
  // PADRÃO A — Autocrítica excessiva
  { id: "a01", padrao: "A", texto: "Costumo ser mais duro comigo mesmo do que seria com outra pessoa." },
  { id: "a02", padrao: "A", texto: "Quando cometo um erro, continuo pensando nele por muito tempo." },
  { id: "a03", padrao: "A", texto: "Tenho dificuldade de reconhecer minhas conquistas." },
  { id: "a04", padrao: "A", texto: "Frequentemente sinto que poderia ter feito mais, mesmo após uma boa entrega." },
  { id: "a05", padrao: "A", texto: "Quando recebo uma crítica, tendo a questionar minha capacidade." },
  // PADRÃO B — Perfeccionismo
  { id: "b01", padrao: "B", texto: "Adio a conclusão de tarefas porque ainda encontro detalhes para melhorar." },
  { id: "b02", padrao: "B", texto: "Tenho dificuldade de entregar algo quando não considero o resultado ideal." },
  { id: "b03", padrao: "B", texto: "Costumo revisar meu trabalho mais vezes do que o necessário." },
  { id: "b04", padrao: "B", texto: "Pequenos erros podem me incomodar bastante." },
  { id: "b05", padrao: "B", texto: "Às vezes gasto muito tempo em detalhes pouco importantes." },
  // PADRÃO C — Necessidade de aprovação
  { id: "c01", padrao: "C", texto: "Tenho dificuldade de discordar quando receio desagradar alguém." },
  { id: "c02", padrao: "C", texto: "A opinião das outras pessoas influencia muito minha confiança." },
  { id: "c03", padrao: "C", texto: "Aceito compromissos mesmo quando minha agenda já está cheia." },
  { id: "c04", padrao: "C", texto: "Sinto desconforto quando percebo que alguém não gostou de uma decisão minha." },
  { id: "c05", padrao: "C", texto: "Às vezes deixo minhas prioridades de lado para atender expectativas alheias." },
  // PADRÃO D — Controle excessivo
  { id: "d01", padrao: "D", texto: "Fico desconfortável quando não consigo acompanhar todas as etapas de um trabalho." },
  { id: "d02", padrao: "D", texto: "Tenho dificuldade de aceitar métodos diferentes dos meus." },
  { id: "d03", padrao: "D", texto: "Mudanças inesperadas podem me deixar excessivamente preocupado." },
  { id: "d04", padrao: "D", texto: "Costumo tentar antecipar e controlar muitos detalhes de uma situação." },
  { id: "d05", padrao: "D", texto: "Tenho dificuldade de deixar outras pessoas conduzirem decisões que me afetam." },
  // PADRÃO E — Evitação de conflitos
  { id: "e01", padrao: "E", texto: "Adio conversas difíceis mesmo quando sei que são necessárias." },
  { id: "e02", padrao: "E", texto: "Prefiro permanecer em silêncio para evitar uma discussão." },
  { id: "e03", padrao: "E", texto: "Tenho dificuldade de comunicar insatisfação diretamente." },
  { id: "e04", padrao: "E", texto: "Às vezes concordo com algo apenas para evitar tensão." },
  { id: "e05", padrao: "E", texto: "Problemas de relacionamento podem permanecer sem solução porque evito abordá-los." },
  // PADRÃO F — Preocupação antecipatória
  { id: "f01", padrao: "F", texto: "Frequentemente imagino problemas que ainda não aconteceram." },
  { id: "f02", padrao: "F", texto: "Tenho dificuldade de relaxar quando existe alguma incerteza." },
  { id: "f03", padrao: "F", texto: "Antes de começar algo importante, penso bastante no que pode dar errado." },
  { id: "f04", padrao: "F", texto: "Costumo antecipar consequências negativas mesmo quando ainda tenho poucas informações." },
  { id: "f05", padrao: "F", texto: "A possibilidade de imprevistos pode dificultar minhas decisões." },
  // PADRÃO G — Hiperprodutividade
  { id: "g01", padrao: "G", texto: "Sinto desconforto quando não estou realizando alguma atividade produtiva." },
  { id: "g02", padrao: "G", texto: "Tenho dificuldade de fazer pausas sem pensar nas tarefas pendentes." },
  { id: "g03", padrao: "G", texto: "Frequentemente assumo mais atividades do que consigo realizar com tranquilidade." },
  { id: "g04", padrao: "G", texto: "Às vezes priorizo resultados profissionais em detrimento do descanso." },
  { id: "g05", padrao: "G", texto: "Tenho dificuldade de reconhecer quando preciso diminuir o ritmo." },
  // PADRÃO H — Dificuldade de delegar
  { id: "h01", padrao: "H", texto: "Prefiro executar uma tarefa sozinho a explicar como ela deve ser feita." },
  { id: "h02", padrao: "H", texto: "Tenho dificuldade de confiar que outra pessoa entregará o resultado esperado." },
  { id: "h03", padrao: "H", texto: "Costumo assumir atividades que poderiam ser realizadas por outras pessoas." },
  { id: "h04", padrao: "H", texto: "Mesmo após delegar, sinto necessidade de acompanhar cada detalhe." },
  { id: "h05", padrao: "H", texto: "Às vezes refaço o trabalho de alguém em vez de orientar melhorias." },
];

const ITEM_POR_ID = Object.fromEntries(ITENS_AUTO.map((i) => [i.id, i]));

// Metadados dos padrões para o frontend (sem expor nada da chave — a relação
// item → padrão não sai daqui).
export function padroesPublicos() {
  return ORDEM_PADROES.map((p) => ({
    chave: PADROES_AUTO[p].chave,
    nome: PADROES_AUTO[p].nome,
    cor: PADROES_AUTO[p].cor,
  }));
}

// Itens públicos: só id + texto, na ordem oficial. Nunca revela o padrão
// avaliado (spec, seção 4: "Não exibir o padrão comportamental durante o teste").
export function itensPublicos() {
  return ITENS_AUTO.map((i) => ({ id: i.id, texto: i.texto }));
}

function respostaValida(v) {
  return Number.isInteger(v) && v >= 1 && v <= AUTO_ESCALA;
}

// Saneia um mapa de respostas: mantém só itens conhecidos com valor inteiro 1–5.
// Usado no auto-save (o participante ainda está preenchendo).
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
  for (const item of ITENS_AUTO) {
    if (respostaValida(Number(respostas[item.id]))) n += 1;
  }
  return n;
}

// -----------------------------------------------------------------------------
// Validação server-side: todas as 40 afirmações respondidas, cada uma inteiro
// 1–5 (spec, seção 11).
// -----------------------------------------------------------------------------
export function validarRespostas(respostas) {
  if (!respostas || typeof respostas !== "object")
    return { ok: false, codigo: "FORMATO", erro: "Respostas ausentes ou inválidas." };

  const faltando = [];
  for (const item of ITENS_AUTO) {
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

// -----------------------------------------------------------------------------
// Cálculo dos oito padrões (spec, seção 6). Para cada padrão: SOMA das 5
// respostas (5–25) e MÉDIA (1–5). NÃO calcula percentis, scores de risco nem
// classificações clínicas. Pressupõe respostas já validadas (ou ignora itens
// inválidos, para progresso).
// -----------------------------------------------------------------------------
export function calcularResultado(respostas) {
  const acc = {};
  for (const p of ORDEM_PADROES) acc[p] = { soma: 0, itens: 0 };

  for (const item of ITENS_AUTO) {
    const v = Number(respostas?.[item.id]);
    if (!respostaValida(v)) continue;
    acc[item.padrao].soma += v;
    acc[item.padrao].itens += 1;
  }

  const padroes = {};
  for (const p of ORDEM_PADROES) {
    const { soma, itens } = acc[p];
    padroes[p] = {
      chave: p,
      soma, // 5–25 quando completo
      itens,
      // Média na escala 1–5 (duas casas). Não é percentil nem score de risco.
      media: itens ? Math.round((soma / itens) * 100) / 100 : 0,
      // Máximo teórico da soma, para desenhar a barra (itens × 5).
      maximo: itens * AUTO_ESCALA,
    };
  }

  return {
    versao: AUTO_VERSAO,
    instrumento: AUTO_INSTRUMENTO,
    idioma: AUTO_IDIOMA,
    fonte: AUTO_FONTE,
    chave: AUTO_CHAVE,
    algoritmo: AUTO_ALGORITMO,
    escala: AUTO_ESCALA,
    experimental: AUTO_EXPERIMENTAL,
    padroes,
  };
}

// Padrões em destaque: os três com maior média, PRESERVANDO EMPATES (spec,
// seção 6). Se o 3º colocado empata com os seguintes, todos os empatados entram.
// Ordena por média (desc); em empate de média, mantém a ordem de apresentação.
export function padroesDestaque(resultado) {
  const dims = resultado?.padroes || {};
  const ordenado = ORDEM_PADROES
    .map((p, i) => ({ chave: p, media: dims[p]?.media || 0, ordem: i }))
    .sort((a, b) => (b.media - a.media) || (a.ordem - b.ordem));
  if (ordenado.length <= 3) return ordenado.map((d) => d.chave);
  const corte = ordenado[2].media; // média do 3º colocado
  return ordenado.filter((d) => d.media >= corte).map((d) => d.chave);
}

// -----------------------------------------------------------------------------
// Relatório interpretativo DETERMINÍSTICO (sem IA). Oito padrões, cada um com
// soma, média e textos (representa / cotidiano / atenção / reflexão / ação), mais
// a lista de destaques. Textos próprios, sempre descritivos — nunca diagnóstico,
// score de risco ou ranking.
// -----------------------------------------------------------------------------
export function montarRelatorio(resultado) {
  const dims = resultado?.padroes || {};
  const padroes = ORDEM_PADROES.map((p) => {
    const meta = PADROES_AUTO[p];
    const r = dims[p] || { soma: 0, media: 0, itens: 0, maximo: 0 };
    return {
      chave: p,
      nome: meta.nome,
      cor: meta.cor,
      soma: r.soma,
      media: r.media,
      maximo: r.maximo,
      descricao: meta.descricao,
      cotidiano: meta.cotidiano,
      atencao: meta.atencao,
      reflexao: meta.reflexao,
      acao: meta.acao,
    };
  });

  const chavesDestaque = padroesDestaque(resultado);
  const destaques = chavesDestaque.map((c) => padroes.find((d) => d.chave === c));

  return {
    instrumento: AUTO_INSTRUMENTO,
    fonte: AUTO_FONTE,
    experimental: AUTO_EXPERIMENTAL,
    escala: AUTO_ESCALA,
    notaGlobal: AUTO_NOTA_GLOBAL,
    tituloDestaques: AUTO_TITULO_DESTAQUES,
    destaques,
    padroes,
  };
}

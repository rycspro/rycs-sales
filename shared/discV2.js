// =============================================================================
// DISC — Perfil comportamental (instrumento próprio da RYCS)
//
// Avaliação comportamental inspirada nas quatro dimensões do modelo DISC. NÃO é
// um instrumento DISC oficial, licenciado ou psicometricamente validado: é um
// recurso experimental de autoconhecimento. O resultado nunca aprova, reprova
// ou exclui ninguém de oportunidades.
//
// Esta versão tem 24 blocos, cada um com 4 alternativas (uma por dimensão). O
// participante escolhe a que MAIS e a que MENOS combina com ele. A pontuação é
// por SALDO (MAIS − MENOS) por dimensão.
//
// Convivência com o DISC antigo (8 perguntas, em shared/discQuiz.js): este é um
// instrumento SEPARADO, com versão própria. Resultados antigos são preservados
// e nunca recalculados por este algoritmo. Ver docs em CLAUDE.md / seção DISC.
//
// IMPORTANTE (internacionalização): os identificadores (versão, blocos,
// alternativas, dimensões) são ESTÁVEIS e independentes de idioma. Os textos
// (perguntas, alternativas, interpretações) são o conteúdo traduzível. Nunca
// use texto traduzido como identificador de resposta.
//
// IMPORTANTE (segurança): o mapeamento alternativa → dimensão é a "chave" do
// teste e vive só no servidor. O frontend recebe apenas blocos públicos (sem
// dimensão) via `blocosPublicos()`. A pontuação SEMPRE usa as alternativas
// oficiais daqui, nunca dimensões enviadas pelo cliente.
// =============================================================================

export const DISC_V2_VERSAO = "rycs-disc-v1-24";
export const DISC_V2_ALGORITMO = "saldo-v1";
export const DISC_V2_BLOCOS = 24;

// Avaliação experimental até a revisão interna das perguntas, pontuação e
// interpretações. O rótulo "experimental" sempre acompanha o resultado.
export const DISC_V2_EXPERIMENTAL = true;

// Flag de disponibilização para revisão interna antes de liberar a todos os
// profissionais. Ligada por padrão; desligue com DISC_V2_DISPONIVEL=0.
export const discV2Disponivel = () =>
  String(process.env.DISC_V2_DISPONIVEL ?? "1").trim() !== "0";

export const DIMENSOES_V2 = {
  D: {
    letra: "D",
    nome: "Dominância",
    palavra: "Direção",
    cor: "#E26B60",
    descricao: "Tendência a valorizar iniciativa, autonomia, objetivos claros e decisões diretas.",
    agir: "Você tende a assumir a frente, buscar objetivos claros e decidir com rapidez diante dos desafios.",
    comunicar: "Costuma ir direto ao ponto, com foco no resultado e na decisão a ser tomada.",
    trabalhar: "Prefere autonomia, metas de entrega e liberdade para avançar sem muitos intermediários.",
    desenvolver: "Pode se beneficiar ao abrir mais espaço para a escuta e para o ritmo das outras pessoas antes de decidir.",
  },
  I: {
    letra: "I",
    nome: "Influência",
    palavra: "Interação",
    cor: "#E3AE42",
    descricao: "Tendência a valorizar comunicação, interação, troca de ideias e envolvimento com pessoas.",
    agir: "Você tende a mobilizar e envolver pessoas, explorando possibilidades em conversa e com entusiasmo.",
    comunicar: "Costuma se comunicar de forma envolvente, com exemplos e abertura para o diálogo.",
    trabalhar: "Prefere ambientes colaborativos, com interação frequente e espaço para novas conexões.",
    desenvolver: "Pode se beneficiar ao reservar momentos de foco individual e de atenção aos detalhes.",
  },
  S: {
    letra: "S",
    nome: "Estabilidade",
    palavra: "Constância",
    cor: "#46A88B",
    descricao: "Tendência a valorizar colaboração, constância, escuta e continuidade.",
    agir: "Você tende a manter um ritmo constante, preservar a tranquilidade e apoiar a equipe de forma contínua.",
    comunicar: "Costuma escutar com atenção, dar espaço ao outro e falar com calma.",
    trabalhar: "Prefere rotinas previsíveis, transições graduais e compromissos contínuos.",
    desenvolver: "Pode se beneficiar ao lidar com mudanças mais rápidas e ao expor posições com mais firmeza quando necessário.",
  },
  C: {
    letra: "C",
    nome: "Conformidade",
    palavra: "Critério",
    cor: "#568FE0",
    descricao: "Tendência a valorizar análise, organização, precisão e critérios bem definidos.",
    agir: "Você tende a examinar requisitos, analisar impactos e organizar as informações antes de agir.",
    comunicar: "Costuma estruturar os argumentos e apoiar o que diz em dados e critérios.",
    trabalhar: "Prefere critérios definidos, organização detalhada e atenção à qualidade da entrega.",
    desenvolver: "Pode se beneficiar ao decidir com informação parcial quando o contexto pedir agilidade.",
  },
};

export const DIMS = ["D", "I", "S", "C"];

// -----------------------------------------------------------------------------
// Os 24 blocos. Cada alternativa tem um id ESTÁVEL e opaco (não revela a
// dimensão) e um `dim` interno usado só no servidor.
// -----------------------------------------------------------------------------
export const BLOCOS = [
  { id: "b01", titulo: "Iniciando um projeto", pergunta: "Ao iniciar um projeto, você costuma:", alternativas: [
    { id: "b01a", dim: "D", texto: "Definir rapidamente os objetivos." },
    { id: "b01b", dim: "I", texto: "Conversar com as pessoas envolvidas." },
    { id: "b01c", dim: "S", texto: "Entender as necessidades da equipe." },
    { id: "b01d", dim: "C", texto: "Examinar os requisitos." },
  ] },
  { id: "b02", titulo: "Resolvendo problemas", pergunta: "Diante de um problema, você tende a:", alternativas: [
    { id: "b02a", dim: "D", texto: "Tomar a iniciativa de resolver." },
    { id: "b02b", dim: "I", texto: "Buscar ideias em conversas." },
    { id: "b02c", dim: "S", texto: "Procurar preservar a tranquilidade." },
    { id: "b02d", dim: "C", texto: "Investigar a causa." },
  ] },
  { id: "b03", titulo: "Participando de reuniões", pergunta: "Em uma reunião, você prefere:", alternativas: [
    { id: "b03a", dim: "D", texto: "Ir direto às decisões." },
    { id: "b03b", dim: "I", texto: "Estimular a participação." },
    { id: "b03c", dim: "S", texto: "Escutar os diferentes pontos." },
    { id: "b03d", dim: "C", texto: "Organizar as informações." },
  ] },
  { id: "b04", titulo: "Recebendo tarefas", pergunta: "Ao receber uma tarefa, você costuma:", alternativas: [
    { id: "b04a", dim: "D", texto: "Buscar autonomia para executar." },
    { id: "b04b", dim: "I", texto: "Alinhar expectativas conversando." },
    { id: "b04c", dim: "S", texto: "Seguir uma sequência consistente." },
    { id: "b04d", dim: "C", texto: "Conferir critérios e detalhes." },
  ] },
  { id: "b05", titulo: "Trabalhando sob pressão", pergunta: "Quando está sob pressão, você tende a:", alternativas: [
    { id: "b05a", dim: "D", texto: "Priorizar decisões rápidas." },
    { id: "b05b", dim: "I", texto: "Mobilizar pessoas para ajudar." },
    { id: "b05c", dim: "S", texto: "Manter um ritmo constante." },
    { id: "b05d", dim: "C", texto: "Reavaliar riscos e informações." },
  ] },
  { id: "b06", titulo: "Enfrentando mudanças", pergunta: "Diante de mudanças, você costuma:", alternativas: [
    { id: "b06a", dim: "D", texto: "Assumir a frente da adaptação." },
    { id: "b06b", dim: "I", texto: "Explorar possibilidades com outras pessoas." },
    { id: "b06c", dim: "S", texto: "Buscar uma transição gradual." },
    { id: "b06d", dim: "C", texto: "Analisar os impactos." },
  ] },
  { id: "b07", titulo: "Lidando com conflitos", pergunta: "Em um conflito profissional, você tende a:", alternativas: [
    { id: "b07a", dim: "D", texto: "Abordar diretamente a divergência." },
    { id: "b07b", dim: "I", texto: "Tentar construir entendimento." },
    { id: "b07c", dim: "S", texto: "Procurar reduzir tensões." },
    { id: "b07d", dim: "C", texto: "Examinar os fatos envolvidos." },
  ] },
  { id: "b08", titulo: "Trabalhando em equipe", pergunta: "Ao colaborar com uma equipe, você costuma:", alternativas: [
    { id: "b08a", dim: "D", texto: "Organizar a direção do trabalho." },
    { id: "b08b", dim: "I", texto: "Aproximar os participantes." },
    { id: "b08c", dim: "S", texto: "Oferecer apoio contínuo." },
    { id: "b08d", dim: "C", texto: "Cuidar da qualidade da entrega." },
  ] },
  { id: "b09", titulo: "Tomando decisões", pergunta: "Quando precisa tomar uma decisão, você tende a:", alternativas: [
    { id: "b09a", dim: "D", texto: "Escolher e avançar." },
    { id: "b09b", dim: "I", texto: "Considerar as pessoas envolvidas." },
    { id: "b09c", dim: "S", texto: "Buscar uma opção estável." },
    { id: "b09d", dim: "C", texto: "Comparar evidências." },
  ] },
  { id: "b10", titulo: "Apresentando ideias", pergunta: "Ao apresentar uma ideia, você prefere:", alternativas: [
    { id: "b10a", dim: "D", texto: "Destacar o objetivo principal." },
    { id: "b10b", dim: "I", texto: "Usar exemplos envolventes." },
    { id: "b10c", dim: "S", texto: "Explicar com calma." },
    { id: "b10d", dim: "C", texto: "Estruturar os argumentos." },
  ] },
  { id: "b11", titulo: "Recebendo críticas", pergunta: "Quando recebe uma crítica, você costuma:", alternativas: [
    { id: "b11a", dim: "D", texto: "Discutir os pontos diretamente." },
    { id: "b11b", dim: "I", texto: "Procurar compreender a percepção." },
    { id: "b11c", dim: "S", texto: "Escutar antes de reagir." },
    { id: "b11d", dim: "C", texto: "Verificar o que pode ser corrigido." },
  ] },
  { id: "b12", titulo: "Aprendendo tarefas novas", pergunta: "Diante de uma tarefa desconhecida, você prefere:", alternativas: [
    { id: "b12a", dim: "D", texto: "Experimentar rapidamente." },
    { id: "b12b", dim: "I", texto: "Trocar ideias antes de começar." },
    { id: "b12c", dim: "S", texto: "Receber orientações graduais." },
    { id: "b12d", dim: "C", texto: "Estudar o procedimento." },
  ] },
  { id: "b13", titulo: "Organizando prioridades", pergunta: "Ao organizar suas prioridades, você costuma:", alternativas: [
    { id: "b13a", dim: "D", texto: "Focar nos resultados imediatos." },
    { id: "b13b", dim: "I", texto: "Considerar os compromissos com pessoas." },
    { id: "b13c", dim: "S", texto: "Manter a rotina organizada." },
    { id: "b13d", dim: "C", texto: "Avaliar prazos e dependências." },
  ] },
  { id: "b14", titulo: "Conversas difíceis", pergunta: "Em uma conversa difícil, você tende a:", alternativas: [
    { id: "b14a", dim: "D", texto: "Expressar sua posição claramente." },
    { id: "b14b", dim: "I", texto: "Buscar criar abertura para diálogo." },
    { id: "b14c", dim: "S", texto: "Dar espaço para o outro falar." },
    { id: "b14d", dim: "C", texto: "Organizar os argumentos." },
  ] },
  { id: "b15", titulo: "Assumindo responsabilidades", pergunta: "Ao assumir uma responsabilidade, você prefere:", alternativas: [
    { id: "b15a", dim: "D", texto: "Ter poder de decisão." },
    { id: "b15b", dim: "I", texto: "Coordenar com outras pessoas." },
    { id: "b15c", dim: "S", texto: "Manter compromissos contínuos." },
    { id: "b15d", dim: "C", texto: "Trabalhar com critérios definidos." },
  ] },
  { id: "b16", titulo: "Novas oportunidades", pergunta: "Quando surge uma oportunidade, você costuma:", alternativas: [
    { id: "b16a", dim: "D", texto: "Avaliar e agir rapidamente." },
    { id: "b16b", dim: "I", texto: "Compartilhar a possibilidade." },
    { id: "b16c", dim: "S", texto: "Considerar a continuidade do trabalho." },
    { id: "b16d", dim: "C", texto: "Verificar sua viabilidade." },
  ] },
  { id: "b17", titulo: "Ambientes desconhecidos", pergunta: "Ao chegar a um ambiente novo, você tende a:", alternativas: [
    { id: "b17a", dim: "D", texto: "Buscar entender os desafios." },
    { id: "b17b", dim: "I", texto: "Conhecer as pessoas." },
    { id: "b17c", dim: "S", texto: "Observar a dinâmica existente." },
    { id: "b17d", dim: "C", texto: "Conhecer as regras e processos." },
  ] },
  { id: "b18", titulo: "Reconhecendo erros", pergunta: "Ao explicar um erro, você costuma:", alternativas: [
    { id: "b18a", dim: "D", texto: "Assumir a responsabilidade diretamente." },
    { id: "b18b", dim: "I", texto: "Conversar sobre o ocorrido." },
    { id: "b18c", dim: "S", texto: "Procurar restaurar a confiança." },
    { id: "b18d", dim: "C", texto: "Identificar a causa." },
  ] },
  { id: "b19", titulo: "Planejamento diário", pergunta: "Ao planejar seu dia, você prefere:", alternativas: [
    { id: "b19a", dim: "D", texto: "Definir metas de entrega." },
    { id: "b19b", dim: "I", texto: "Reservar tempo para interações." },
    { id: "b19c", dim: "S", texto: "Estabelecer uma rotina previsível." },
    { id: "b19d", dim: "C", texto: "Organizar atividades detalhadamente." },
  ] },
  { id: "b20", titulo: "Ajudando colegas", pergunta: "Quando um colega precisa de ajuda, você tende a:", alternativas: [
    { id: "b20a", dim: "D", texto: "Propor uma solução objetiva." },
    { id: "b20b", dim: "I", texto: "Incentivar e conversar." },
    { id: "b20c", dim: "S", texto: "Acompanhar até ele conseguir." },
    { id: "b20d", dim: "C", texto: "Explicar o procedimento." },
  ] },
  { id: "b21", titulo: "Trabalhando individualmente", pergunta: "Quando trabalha sozinho, você costuma:", alternativas: [
    { id: "b21a", dim: "D", texto: "Estabelecer seus próprios desafios." },
    { id: "b21b", dim: "I", texto: "Buscar oportunidades de interação." },
    { id: "b21c", dim: "S", texto: "Manter um ritmo consistente." },
    { id: "b21d", dim: "C", texto: "Revisar seu trabalho cuidadosamente." },
  ] },
  { id: "b22", titulo: "Imprevistos", pergunta: "Quando acontece um imprevisto, você tende a:", alternativas: [
    { id: "b22a", dim: "D", texto: "Decidir o próximo passo." },
    { id: "b22b", dim: "I", texto: "Alinhar rapidamente com os envolvidos." },
    { id: "b22c", dim: "S", texto: "Reorganizar sem perder a calma." },
    { id: "b22d", dim: "C", texto: "Reavaliar as condições." },
  ] },
  { id: "b23", titulo: "Finalizando entregas", pergunta: "Ao concluir uma entrega, você costuma:", alternativas: [
    { id: "b23a", dim: "D", texto: "Partir para o próximo objetivo." },
    { id: "b23b", dim: "I", texto: "Compartilhar os resultados." },
    { id: "b23c", dim: "S", texto: "Verificar se todos estão atendidos." },
    { id: "b23d", dim: "C", texto: "Conferir os detalhes finais." },
  ] },
  { id: "b24", titulo: "Pensando no futuro", pergunta: "Ao pensar no futuro profissional, você tende a:", alternativas: [
    { id: "b24a", dim: "D", texto: "Buscar desafios maiores." },
    { id: "b24b", dim: "I", texto: "Imaginar novas conexões." },
    { id: "b24c", dim: "S", texto: "Valorizar continuidade e segurança." },
    { id: "b24d", dim: "C", texto: "Planejar possibilidades e riscos." },
  ] },
];

const BLOCO_POR_ID = Object.fromEntries(BLOCOS.map((b) => [b.id, b]));

// Metadados das dimensões para o frontend (sem expor a chave de resposta).
export function dimensoesPublicas() {
  return DIMS.map((d) => ({
    letra: DIMENSOES_V2[d].letra,
    nome: DIMENSOES_V2[d].nome,
    cor: DIMENSOES_V2[d].cor,
    descricao: DIMENSOES_V2[d].descricao,
  }));
}

// Blocos sem a dimensão. `ordem` (opcional) = { blocoId: [altId,...] } para
// manter o embaralhamento estável ao retomar a tentativa.
export function blocosPublicos(ordem) {
  return BLOCOS.map((b) => {
    let alts = b.alternativas;
    const ord = ordem?.[b.id];
    if (Array.isArray(ord) && ord.length === alts.length) {
      const porId = Object.fromEntries(alts.map((a) => [a.id, a]));
      const reordenadas = ord.map((id) => porId[id]).filter(Boolean);
      if (reordenadas.length === alts.length) alts = reordenadas;
    }
    return {
      id: b.id,
      titulo: b.titulo,
      pergunta: b.pergunta,
      alternativas: alts.map((a) => ({ id: a.id, texto: a.texto })),
    };
  });
}

// Gera uma ordem embaralhada por bloco (uma vez por tentativa).
export function gerarOrdem() {
  const ordem = {};
  for (const b of BLOCOS) {
    const ids = b.alternativas.map((a) => a.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    ordem[b.id] = ids;
  }
  return ordem;
}

function dimDaAlternativa(blocoId, altId) {
  const bloco = BLOCO_POR_ID[blocoId];
  if (!bloco) return null;
  const alt = bloco.alternativas.find((a) => a.id === altId);
  return alt ? alt.dim : null;
}

// -----------------------------------------------------------------------------
// Validação server-side das respostas. respostas = { blocoId: { mais, menos } }
// -----------------------------------------------------------------------------
export function validarRespostas(respostas) {
  if (!respostas || typeof respostas !== "object")
    return { ok: false, codigo: "FORMATO", erro: "Respostas ausentes ou inválidas." };

  for (const bloco of BLOCOS) {
    const r = respostas[bloco.id];
    if (!r || typeof r !== "object" || !r.mais || !r.menos)
      return { ok: false, codigo: "INCOMPLETO", erro: `O bloco ${bloco.id} está incompleto.` };
    if (r.mais === r.menos)
      return { ok: false, codigo: "IGUAIS", erro: `No bloco ${bloco.id}, MAIS e MENOS devem ser diferentes.` };
    const dimMais = dimDaAlternativa(bloco.id, r.mais);
    const dimMenos = dimDaAlternativa(bloco.id, r.menos);
    if (!dimMais || !dimMenos)
      return { ok: false, codigo: "ALTERNATIVA", erro: `Alternativa inválida no bloco ${bloco.id}.` };
  }

  // Blocos a mais que não pertencem ao instrumento.
  for (const id of Object.keys(respostas)) {
    if (!BLOCO_POR_ID[id])
      return { ok: false, codigo: "BLOCO_INVALIDO", erro: `Bloco desconhecido: ${id}.` };
  }

  return { ok: true };
}

// -----------------------------------------------------------------------------
// Cálculo das quatro dimensões por SALDO (MAIS − MENOS).
// Pressupõe respostas já validadas (ou valida internamente para progresso).
// -----------------------------------------------------------------------------
export function calcularResultado(respostas) {
  const contagens = { D: { mais: 0, menos: 0 }, I: { mais: 0, menos: 0 }, S: { mais: 0, menos: 0 }, C: { mais: 0, menos: 0 } };

  for (const bloco of BLOCOS) {
    const r = respostas[bloco.id];
    if (!r?.mais || !r?.menos) continue;
    const dimMais = dimDaAlternativa(bloco.id, r.mais);
    const dimMenos = dimDaAlternativa(bloco.id, r.menos);
    if (dimMais) contagens[dimMais].mais += 1;
    if (dimMenos) contagens[dimMenos].menos += 1;
  }

  const saldos = {};
  for (const d of DIMS) saldos[d] = contagens[d].mais - contagens[d].menos;

  // Ordena por saldo (desc), desempate estável pela ordem fixa D, I, S, C.
  const ordenadas = [...DIMS].sort((a, b) => saldos[b] - saldos[a] || DIMS.indexOf(a) - DIMS.indexOf(b));
  const [p1, p2, p3] = ordenadas;

  // Regra de apresentação (determinística, sem limiares arbitrários de
  // "significância"):
  //  - empate no topo → apresentação neutra (sem predominante).
  //  - predominante = maior saldo (estritamente maior que o 2º).
  //  - combinação (par) só quando o 2º é positivo e estritamente maior que o
  //    3º (destacado de forma clara). Caso contrário, só a dimensão principal.
  const empateTopo = saldos[p1] === saldos[p2];
  const predominante = empateTopo ? null : p1;
  const mostrarCombinacao = !!predominante && saldos[p2] > saldos[p3] && saldos[p2] > 0;
  const secundario = mostrarCombinacao ? p2 : null;

  let apresentacao = "neutra";
  let label = "";
  if (predominante && secundario) { apresentacao = "combinacao"; label = `${predominante} + ${secundario}`; }
  else if (predominante) { apresentacao = "unica"; label = predominante; }
  else { apresentacao = "neutra"; label = ordenadas.slice(0, 2).join(" / "); }

  return {
    versao: DISC_V2_VERSAO,
    algoritmo: DISC_V2_ALGORITMO,
    contagens,
    saldos,
    ordem: ordenadas,
    predominante,
    secundario,
    apresentacao,
    label,
  };
}

// Número de blocos respondidos (para progresso).
export function contarRespondidos(respostas) {
  if (!respostas || typeof respostas !== "object") return 0;
  let n = 0;
  for (const bloco of BLOCOS) {
    const r = respostas[bloco.id];
    if (r?.mais && r?.menos && r.mais !== r.menos) n += 1;
  }
  return n;
}

// -----------------------------------------------------------------------------
// Relatório interpretativo DETERMINÍSTICO (sem IA generativa). Textos próprios
// da RYCS, descrevendo preferências relativas — nunca diagnóstico.
// -----------------------------------------------------------------------------
export function montarRelatorio(resultado) {
  const { predominante, secundario, apresentacao } = resultado;
  const dp = predominante ? DIMENSOES_V2[predominante] : null;
  const ds = secundario ? DIMENSOES_V2[secundario] : null;

  let titulo, frase;
  if (apresentacao === "combinacao" && dp && ds) {
    titulo = `${dp.palavra} e ${ds.palavra}`;
    frase = `Suas respostas sugerem preferência por ${dp.palavra.toLowerCase()} e por ${ds.palavra.toLowerCase()}: ${dp.agir.toLowerCase()}`;
  } else if (apresentacao === "unica" && dp) {
    titulo = dp.palavra;
    frase = `Suas respostas destacam ${dp.nome.toLowerCase()}. ${dp.agir}`;
  } else {
    titulo = "Preferências observadas";
    frase = "Suas respostas ficaram próximas entre as dimensões destacadas, sem uma tendência única predominante. Veja abaixo a distribuição das suas escolhas.";
  }

  const comoAgir = dp
    ? dp.agir + (ds ? ` ${ds.agir}` : "")
    : "Suas escolhas se distribuíram entre as dimensões, sem uma tendência única marcante.";
  const comunicacao = dp
    ? dp.comunicar + (ds ? ` ${ds.comunicar}` : "")
    : "Sua forma de comunicar combina características de mais de uma dimensão.";
  const trabalho = dp
    ? dp.trabalhar + (ds ? ` ${ds.trabalhar}` : "")
    : "Sua maneira de trabalhar combina preferências de mais de uma dimensão.";
  const desenvolver = dp
    ? dp.desenvolver
    : "Observe as dimensões com menor frequência de escolha como oportunidades de reflexão, sem tomá-las como deficiências.";

  return {
    cardPrincipal: { titulo, frase },
    secoes: {
      comoAgir,
      comunicacao,
      trabalho,
      desenvolver,
      entendendo:
        "Este relatório descreve preferências relativas observadas nas suas respostas. Não é um diagnóstico psicológico e não determina competência, caráter ou adequação a uma profissão. É um instrumento experimental de autoconhecimento da RYCS.",
    },
  };
}

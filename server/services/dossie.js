import { PERGUNTAS, CATEGORIAS, ORDEM_CATEGORIAS, FAIXAS } from "../../shared/triagem.js";
import { leituraProfissional } from "./inteligencia.js";

// Dossiê de triagem: o que a plataforma lê antes de aprovar um profissional.
//
// A leitura é montada aqui, por regra, e não por chamada de IA. O motivo é o
// mesmo da auditoria: um parecer que decide o acesso de alguém precisa ser
// explicável e idêntico para respostas idênticas. Se o texto mudasse a cada
// geração, duas contas iguais poderiam receber pareceres diferentes — e não
// haveria como defender a decisão depois.
//
// Quando ANTHROPIC_API_KEY está configurada, uma narrativa curta é somada por
// cima como leitura auxiliar. Ela nunca substitui os números: entra como
// campo separado, marcado como opinião, e a recomendação continua vindo da
// regra.

const porId = new Map(PERGUNTAS.map((p) => [p.id, p]));

// O que cada categoria significa em entrega concreta. É isso que a plataforma
// quer saber: não "tirou 80 em negociação", e sim o que a pessoa consegue
// fazer na operação de um cliente.
const ENTREGA = {
  prospeccao:   { forte: "abre lista fria e mantém cadência própria",        fraco: "depende de lista pronta e para no primeiro silêncio" },
  negociacao:   { forte: "defende preço sem recorrer a desconto",            fraco: "cede desconto como primeira resposta à objeção" },
  reunioes:     { forte: "conduz reunião e ancora preço no custo do problema", fraco: "apresenta produto antes de entender a dor" },
  experiencia:  { forte: "já operou ticket alto e conhece mais de um setor", fraco: "pouca bagagem de ticket e de segmento" },
  comunicacao:  { forte: "conduz por perguntas e deixa o cliente falar",     fraco: "fala mais do que escuta na primeira conversa" },
  qualificacao: { forte: "confirma dor, orçamento e decisor antes de agendar", fraco: "agenda por interesse, sem checar quem decide" },
  objecoes:     { forte: "trata o 'vou pensar' com pergunta e data",          fraco: "aceita o 'vou pensar' e fica no aguardo" },
  fechamento:   { forte: "encerra com data, responsável e ação",             fraco: "encerra sem próximo passo definido" },
  disciplina:   { forte: "ataca lead novo na mesma hora",                    fraco: "demora a fazer o primeiro contato" },
  conhecimento: { forte: "entende a divisão entre qualificar e fechar",      fraco: "confunde os papéis do funil" },
};

// Perfis operacionais e o que cada um exige. A prontidão sai da comparação
// entre o exigido e o que a avaliação mostrou.
const FUNCOES = {
  sdr:    { nome: "SDR",    exige: { prospeccao: 65, qualificacao: 60, disciplina: 60, comunicacao: 55 } },
  closer: { nome: "Closer", exige: { negociacao: 70, objecoes: 65, fechamento: 60, reunioes: 65 } },
  bdr:    { nome: "BDR",    exige: { prospeccao: 70, disciplina: 65, objecoes: 55 } },
};

const FORTE = 75;
const FRACO = 50;

const faixaDe = (status) => FAIXAS[status]?.nome || status;

// Prontidão por função: quanto do exigido a pessoa já cobre, e o que falta.
function prontidao(categorias) {
  return Object.entries(FUNCOES).map(([chave, f]) => {
    const itens = Object.entries(f.exige).map(([cat, minimo]) => ({
      categoria: CATEGORIAS[cat].nome,
      exigido: minimo,
      obtido: categorias[cat] ?? 0,
      atende: (categorias[cat] ?? 0) >= minimo,
    }));
    const atendidos = itens.filter((i) => i.atende).length;
    const cobertura = Math.round((atendidos / itens.length) * 100);
    return {
      funcao: chave,
      nome: f.nome,
      cobertura,
      veredito: cobertura === 100 ? "pronto" : cobertura >= 50 ? "com acompanhamento" : "não recomendado",
      faltam: itens.filter((i) => !i.atende).map((i) => `${i.categoria} (${i.obtido}% de ${i.exigido}%)`),
    };
  }).sort((a, b) => b.cobertura - a.cobertura);
}

// As respostas abertas são o único lugar onde a pessoa escreve com as próprias
// palavras. Vão inteiras para o dossiê — é o que permite à plataforma discordar
// da nota da rubrica.
function discursivas(respostas, detalhe) {
  const notas = new Map(detalhe.map((d) => [d.id, d]));
  return PERGUNTAS.filter((p) => p.tipo === "aberta").map((p) => ({
    pergunta: p.texto,
    resposta: String(respostas?.[p.id] ?? "").trim(),
    pontos: notas.get(p.id)?.pontos ?? 0,
    leitura: notas.get(p.id)?.nota || "",
  }));
}

// Todas as respostas em texto legível — a plataforma pediu o resumo de todas
// as questões, não só das abertas.
function espelho(respostas, detalhe) {
  const notas = new Map(detalhe.map((d) => [d.id, d]));
  return PERGUNTAS.map((p) => {
    const r = respostas?.[p.id];
    let texto;
    if (p.tipo === "multipla") {
      const marcadas = (Array.isArray(r) ? r : []).map((i) => p.opcoes[i]?.[0]).filter(Boolean);
      texto = marcadas.length ? marcadas.join(", ") : "—";
    } else if (p.tipo === "aberta") {
      texto = String(r ?? "").trim() || "—";
    } else {
      texto = p.opcoes?.[Number(r)]?.[0] ?? "—";
    }
    return {
      id: p.id,
      categoria: CATEGORIAS[p.categoria].nome,
      pergunta: p.texto,
      resposta: texto,
      pontos: notas.get(p.id)?.pontos ?? 0,
      aberta: p.tipo === "aberta",
    };
  });
}

// Sinais que merecem olho humano antes de aprovar. Não bloqueiam nada
// sozinhos: são o que a plataforma confere no dossiê.
function alertas(categorias, abertas, perfil) {
  const lista = [];

  const passivas = abertas.filter((a) => a.leitura === "resposta indica postura passiva");
  if (passivas.length)
    lista.push(`${passivas.length} resposta(s) aberta(s) indicam postura passiva diante de silêncio ou objeção.`);

  const curtas = abertas.filter((a) => a.resposta.length < 40);
  if (curtas.length)
    lista.push(`${curtas.length} resposta(s) aberta(s) muito curtas — pouco material para avaliar raciocínio.`);

  const zeradas = ORDEM_CATEGORIAS.filter((c) => (categorias[c] ?? 0) < 25);
  if (zeradas.length)
    lista.push(`Abaixo de 25% em ${zeradas.map((c) => CATEGORIAS[c].nome).join(", ")}.`);

  if ((categorias.disciplina ?? 0) < FRACO && (categorias.prospeccao ?? 0) < FRACO)
    lista.push("Prospecção e disciplina baixas juntas: risco de lead parado na fila.");

  if (perfil.ticketMaximo === "Nunca vendi")
    lista.push("Declara nunca ter vendido — a experiência do dossiê vem só da avaliação.");

  return lista;
}

export function montarDossie({ score, status, categorias, perfil, detalhe, respostas, tentativa }) {
  const fortes = ORDEM_CATEGORIAS.filter((c) => (categorias[c] ?? 0) >= FORTE);
  const fracas = ORDEM_CATEGORIAS.filter((c) => (categorias[c] ?? 0) < FRACO);
  const abertas = discursivas(respostas, detalhe);
  const funcoes = prontidao(categorias);
  const melhor = funcoes[0];

  // Uma linha que a plataforma lê antes de qualquer número.
  const veredito = melhor.veredito === "pronto"
    ? `Entrega ${melhor.nome} de forma autônoma.`
    : melhor.veredito === "com acompanhamento"
      ? `Entrega ${melhor.nome} com acompanhamento; ainda não sozinho.`
      : "Ainda não cobre o mínimo de nenhuma função da operação.";

  return {
    resumo: {
      score,
      faixa: faixaDe(status),
      tentativa,
      predominante: perfil.predominante,
      veredito,
      entregaHoje: fortes.map((c) => ENTREGA[c].forte),
      naoEntregaAinda: fracas.map((c) => ENTREGA[c].fraco),
    },
    categorias: ORDEM_CATEGORIAS.map((c) => ({
      chave: c,
      nome: CATEGORIAS[c].nome,
      peso: CATEGORIAS[c].peso,
      valor: categorias[c] ?? 0,
      leitura: (categorias[c] ?? 0) >= FORTE ? "forte" : (categorias[c] ?? 0) >= FRACO ? "mediano" : "frágil",
    })),
    funcoes,
    declarado: {
      ticketMaximo: perfil.ticketMaximo || "—",
      segmentos: perfil.segmentos || [],
      capacidadeDiaria: perfil.capacidadeDiaria || "—",
      formatos: perfil.formatos || [],
      velocidadeContato: perfil.velocidadeContato || "—",
    },
    abertas,
    respostas: espelho(respostas, detalhe),
    alertas: alertas(categorias, abertas, perfil),
    recomendacao: recomendar(score, melhor, fracas),
  };
}

// A recomendação é sugestão, não decisão: quem aprova é a plataforma.
function recomendar(score, melhor, fracas) {
  if (score > 90 && melhor.veredito === "pronto")
    return { acao: "aprovado", texto: `Aprovar como ${melhor.nome}. Cobre todos os mínimos da função.` };
  if (melhor.veredito !== "não recomendado")
    return {
      acao: "parcial",
      texto: `Aprovar parcialmente como ${melhor.nome}, com a Academy focada em ${fracas.length ? fracas.map((c) => CATEGORIAS[c].nome).join(", ") : "reforço geral"}.`,
    };
  return {
    acao: "parcial",
    texto: "Liberar apenas a Academy até a próxima tentativa: nenhuma função tem o mínimo coberto.",
  };
}

// Leitura do dossiê. Duas fontes, nesta ordem:
//
//   1. Provedor externo, quando há chave configurada.
//   2. Motor de leitura interno — determinístico, sem custo, sempre disponível.
//
// Antes, sem chave, o campo vinha nulo e a tela ficava com um buraco. O motor
// interno fecha esse buraco sem inventar nada: ele escreve o que os números já
// dizem, e nada além disso.
//
// `fonte` acompanha o texto porque quem lê precisa saber de onde ele veio. A
// informação fica no dado; como a tela rotula isso é decisão de produto, num
// lugar só.
export async function narrativa(dossie) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { texto: leituraProfissional(dossie), fonte: "interno" };
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const linhas = dossie.respostas
      .map((r) => `[${r.categoria}] ${r.pergunta}\n  → ${r.resposta}`)
      .join("\n");

    const resposta = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system:
        "Você lê respostas de uma avaliação comercial e descreve, em português do Brasil, " +
        "o que a pessoa consegue entregar na operação de um cliente. Máximo 4 frases. " +
        "Seja concreto e direto: o que ela faz bem, o que ainda não faz, e em que tipo de " +
        "operação ela se encaixa. Não invente dados que não estejam nas respostas, não dê " +
        "nota e não recomende aprovar ou recusar.",
      messages: [{
        role: "user",
        content: `Score ${dossie.resumo.score}% · perfil ${dossie.resumo.predominante}\n\n${linhas}`,
      }],
    });

    const texto = resposta.content.map((b) => b.text || "").join("").trim();
    return texto
      ? { texto, fonte: "externo" }
      : { texto: leituraProfissional(dossie), fonte: "interno" };
  } catch (err) {
    // Falha do provedor não pode deixar a tela vazia: cai para o motor interno.
    console.error("[dossie] provedor externo indisponível, usando motor interno:", err.message);
    return { texto: leituraProfissional(dossie), fonte: "interno" };
  }
}

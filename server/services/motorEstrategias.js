// Motor interno de estratégias da etapa 4: roda dentro da RYCS, sem provedor
// externo, sem chave de API e sem custo por chamada.
//
// Duas partes:
//
// 1. IDENTIFICADOR. Lê o texto do perfil e dos materiais da etapa 3 (o que a
//    leitura interna extraiu de PDFs, apresentações, documentos, fotos e
//    vídeos) e separa as frases em fatos comerciais: benefícios, diferenciais,
//    provas, preços, garantias, prazos, dores e público. Perguntas seguidas de
//    resposta (FAQ) viram objeções já respondidas pela própria empresa.
//
// 2. MONTADOR. Escreve o script, o funil de WhatsApp e os follow-ups com as
//    técnicas do Academy da RYCS:
//    - "WhatsApp comercial sem parecer spam": mensagem de quatro linhas (quem
//      é, por que essa pessoa, o problema, uma pergunta curta); nunca duas
//      mensagens seguidas; segunda tentativa com ângulo diferente; encerramento
//      educado na terceira.
//    - "SDR: da lista à reunião qualificada": qualificar por situação,
//      problema, impacto, decisão e momento, uma pergunta por vez.
//    - Trilha Challenger: ensinar algo sobre o problema antes do produto
//      (dor → custo → novo caminho → solução) e propor o próximo passo em vez
//      de perguntar qual seria.
//    As aulas usadas em cada geração vão junto, em `fontes`.
//
// Como o motor do dossiê (services/inteligencia.js), o texto é função pura
// dos dados: a mesma entrada gera a mesma saída. Ele não inventa: frase sem
// fato que a sustente sai na forma genérica, e o que a permissão da marca não
// deixa (preço, desconto, prazo) é encaminhado ao contato de suporte.

const sem = (t) => String(t || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");

// ---------------------------------------------------------------------------
// 1. Identificador

const CATEGORIAS = {
  preco: /r\$\s?\d|\b\d+[.,]?\d*\s?reais\b|a partir de|por mes\b|\/mes\b|parcela|mensalidade|investimento de/,
  prova: /\b\d+[.,]?\d*\s?%|\b\d[\d.]*\+?\s?(mil\s)?(clientes|empresas|lojas|usuarios|vendas|projetos|alunos|pacientes|contratos|cidades|estados)\b|\b\d+\s?anos de (mercado|experiencia|historia|atuacao)|certificad|premi|depoimento|\bcase\b|reconhecid|avaliacao|nota \d/,
  garantia: /garantia|devolucao|devolvemos|reembolso|teste gratis|gratis por|sem fidelidade|sem multa|cancel(e|ar) quando/,
  prazo: /\bem (ate )?\d+\s?(dias?|horas?|semanas?|minutos?)\b|\bentrega|implantac|implementac|instalac|\bprazo/,
  beneficio: /\breduz|\bdiminu|\baument|economi|\bganh[ae]|mais rapid|agilidade|automatiz|\bevit[ae]|\bevitar|elimin|facilit|simplific|sem precisar|sem dor de cabeca|\bmelhor[ae]|otimiz|\bresultado|\bcontrole d|tranquilidade|seguranca/,
  diferencial: /\bunic[oa]s?\b|exclusiv|diferencia|\bso (a|o|nos)\b|primeir[oa]s? (do|da|no|na)|patente|tecnologia propria|metodo proprio|diferente d/,
  dor: /problema|dificuldade|\bperde|\bperda|desperdic|gasta(m)? (muito|demais)|\bdemora|atraso|retrabalho|falta de|sem controle|dor de cabeca|prejuizo|\bmulta/,
  publico: /\bpara (empresas|quem|lojas|negocios|clinicas|escritorios|profissionais|pessoas|industrias|distribuidoras|familias|condominios)|ideal para|indicad[oa] para|voltad[oa] para|atendemos|nossos clientes sao/,
};

const OBJECOES = [
  { chave: "preco", rotulo: "Está caro", re: /caro|preco|valor|custa|investimento|pagar|orcamento/ },
  { chave: "tempo", rotulo: "Não tenho tempo para isso agora", re: /tempo|demora|demorado|trabalhoso|complicad|dificil de (usar|implantar)/ },
  { chave: "concorrente", rotulo: "Já tenho um fornecedor", re: /ja (uso|tenho|temos|trabalho)|concorr|fornecedor|diferen[cç]a|por que voces/ },
  { chave: "confianca", rotulo: "Não sei se funciona para mim", re: /funciona|garantia|seguro|confi|resultado|e se nao/ },
  { chave: "depois", rotulo: "Vou pensar / me chama depois", re: /depois|pensar|momento|mais para frente|agora nao/ },
];

const SOLUCAO = /\breduz|\belimin|\bevit|\bdiminu|\bacab[ae] com|\bresolv|\bsem (perder|retrabalho|atraso|dor)/;

const limpar = (f) => f.replace(/^[\s\-–•*·>#\d.)]+/, "").replace(/\s+/g, " ").trim();

export function frasesDe(texto) {
  return String(texto || "")
    .split(/\n+|(?<=[.!;])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"“])/)
    .map(limpar)
    .filter((f) => f.length >= 15 && f.length <= 280 && /[a-zà-ú]{3}/i.test(f));
}

// Pares pergunta → resposta: linha terminada em "?" seguida de uma que não é.
export function perguntasERespostas(texto) {
  const linhas = String(texto || "").split(/\n+/).map(limpar).filter(Boolean);
  const pares = [];
  for (let i = 0; i < linhas.length - 1; i++) {
    const p = linhas[i], r = linhas[i + 1];
    if (p.endsWith("?") && p.length <= 200 && !r.endsWith("?") && r.length >= 20) {
      pares.push({ pergunta: p, resposta: r.slice(0, 400) });
      i++;
    }
  }
  return pares;
}

export function identificarFatos(textos, { termosProduto = "" } = {}) {
  const produto = new Set((sem(termosProduto).match(/[a-z0-9]{4,}/g) || []));
  const vistas = new Set();
  const fatos = Object.fromEntries(Object.keys(CATEGORIAS).map((c) => [c, []]));
  const objecoes = [];

  for (const texto of textos) {
    for (const par of perguntasERespostas(texto)) {
      const tipo = OBJECOES.find((o) => o.re.test(sem(par.pergunta)));
      if (tipo && !objecoes.some((o) => o.chave === tipo.chave)) objecoes.push({ chave: tipo.chave, rotulo: tipo.rotulo, ...par });
    }
    for (const frase of frasesDe(texto)) {
      if (frase.endsWith("?")) continue;
      const n = sem(frase);
      const chave = n.replace(/[^a-z0-9]/g, "").slice(0, 80);
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      const pontosBase = (/\d/.test(frase) ? 1 : 0) + ((n.match(/[a-z0-9]{4,}/g) || []).some((t) => produto.has(t)) ? 1 : 0)
        - (frase.length > 180 ? 1 : 0);
      const cats = Object.keys(CATEGORIAS).filter((cat) => CATEGORIAS[cat].test(n));
      // Frase de problema com verbo de solução ("elimina o retrabalho") é
      // benefício; sem ele ("perdem pedidos por falta de controle"), é dor.
      if (cats.includes("dor")) {
        const solucao = SOLUCAO.test(n);
        const tira = solucao ? "dor" : "beneficio";
        if (solucao && !cats.includes("beneficio")) cats.push("beneficio");
        if (cats.includes(tira)) cats.splice(cats.indexOf(tira), 1);
      }
      for (const cat of cats) fatos[cat].push({ frase, pontos: pontosBase });
    }
  }
  for (const cat of Object.keys(fatos)) {
    // Ordenação estável: empate fica na ordem em que apareceu.
    fatos[cat] = fatos[cat].map((f, i) => ({ ...f, i })).sort((a, b) => b.pontos - a.pontos || a.i - b.i).map((f) => f.frase);
  }
  return { ...fatos, objecoes };
}

// Resumo extrativo para material longo: as frases que carregam fato
// comercial, na ordem do texto, até o limite. Nada é reescrito.
export function resumoExtrativo(texto, limite = 15000) {
  const marcadas = frasesDe(texto).filter((f) => Object.values(CATEGORIAS).some((re) => re.test(sem(f))));
  const pares = perguntasERespostas(texto).map((p) => `${p.pergunta}\n${p.resposta}`);
  const saida = [];
  let total = 0;
  for (const f of [...marcadas, ...pares]) {
    if (total + f.length > limite) break;
    total += f.length + 1;
    saida.push(f);
  }
  return saida.join("\n");
}

// ---------------------------------------------------------------------------
// 2. Montador

const B2B = /empresa|negocio|loja|clinica|escritorio|industria|distribuidor|comercio|cnpj|b2b|gestor|dono|socio|varejo|atacad|restaurante|condominio|franquia|construtora|imobiliaria/;
const FORMAL = /formal|senhor|senhora|sem girias|nao use girias|linguagem tecnica|corporativ/;

const primeira = (lista) => lista?.[0] || "";
const ponto = (f) => (f && !/[.!?]$/.test(f) ? `${f}.` : f);
const minuscInicio = (f) => (f ? f[0].toLocaleLowerCase("pt-BR") + f.slice(1) : f);
const curtaPublico = (p) => {
  const t = String(p || "").split(/[.;\n]/)[0].trim();
  return t.length > 90 ? `${t.slice(0, 87).replace(/\s+\S*$/, "")}…` : t;
};

// Pedido de ajuste: o motor interno entende ajustes de forma, não de conteúdo.
export function lerAjuste(pedido = "") {
  const p = sem(pedido);
  const ajuste = {};
  if (/curt|menor|resum|enxut|direto/.test(p)) ajuste.curto = true;
  if (/informal|descontrai|leve|proxim/.test(p)) ajuste.formal = false;
  else if (/formal|senhor|serio|profission/.test(p)) ajuste.formal = true;
  if (/(sem|tir\w*|nao use|nao usar|remov\w*)\s+(os\s+)?emoji/.test(p)) ajuste.emojis = false;
  else if (/emoji/.test(p)) ajuste.emojis = true;
  if (/(sem|nao (fal\w*|mencion\w*|cit\w*)( de| o| os)?)\s+(preco|valor)/.test(p)) ajuste.semPreco = true;
  if (/(sem|nao (fal\w*|mencion\w*|cit\w*)( de| o| os)?)\s+prazo/.test(p)) ajuste.semPrazo = true;
  const entendido = Object.keys(ajuste).length > 0;
  return { ajuste, entendido };
}

export function montarEstrategias({ empresa = {}, permissoes = {}, materiais = [], aulas = [], pedidoAjuste = "" }) {
  const { ajuste, entendido } = lerAjuste(pedidoAjuste);
  const textos = [
    [empresa.produto, empresa.diferenciais, empresa.icp, empresa.nicho].filter(Boolean).join("\n"),
    ...materiais.map((m) => m.texto).filter(Boolean),
  ];
  const f = identificarFatos(textos, { termosProduto: `${empresa.produto || ""} ${empresa.nicho || ""}` });

  const b2b = B2B.test(sem(`${empresa.icp} ${empresa.nicho} ${empresa.segmento} ${empresa.produto}`));
  const formal = ajuste.formal ?? FORMAL.test(sem(empresa.regrasMarca));
  const emojis = ajuste.emojis ?? !!permissoes.usarEmojis;
  const curto = !!ajuste.curto;
  const podePreco = !!permissoes.informarPrecos && !ajuste.semPreco;
  const podePrazo = !!permissoes.combinarPrazos && !ajuste.semPrazo;
  const podeDesconto = !!permissoes.oferecerDescontos;

  const oi = formal ? "Olá, {nome}, tudo bem?" : "Oi, {nome}, tudo bem?";
  const voce = formal ? "o senhor ou a senhora" : "você";
  const sua = b2b ? "na sua operação" : "no seu dia a dia";
  const e1 = emojis ? " 👋" : "";
  const e2 = emojis ? " ✅" : "";
  const publico = curtaPublico(empresa.icp) || (b2b ? "empresas como a sua" : "pessoas no seu momento");

  const dor = primeira(f.dor);
  const beneficios = f.beneficio.slice(0, curto ? 1 : 3);
  const diferencial = primeira(f.diferencial) || (empresa.diferenciais ? "{diferencial}" : "");
  const prova = f.prova.find((p) => !beneficios.includes(p)) || "";
  const garantia = primeira(f.garantia);
  const prazo = podePrazo ? primeira(f.prazo) : "";
  const preco = podePreco ? primeira(f.preco) : "";

  const linhaPreco = podePreco
    ? (preco ? ponto(preco) : "O investimento é {ticket}.")
    : "Os valores certinhos para o seu caso você recebe com o nosso time: {contato de suporte}.";
  const linhaPrazo = podePrazo
    ? (prazo ? ponto(prazo) : "")
    : (f.prazo.length ? "Os prazos o nosso time confirma com você: {contato de suporte}." : "");

  // --- Script (conversa do vendedor) ---------------------------------------
  const abertura = [
    `${oi} Aqui é da {empresa}.${e1}`,
    `Falo com ${minuscInicio(publico)} sobre {produto}.`,
    !curto && dor ? `Uma coisa que vemos muito: ${minuscInicio(ponto(dor))}` : "",
    `Posso te fazer uma pergunta rápida sobre como ${b2b ? "vocês fazem isso hoje" : "você resolve isso hoje"}?`,
  ].filter(Boolean).join("\n");

  const perguntas = [
    `Situação: hoje, como ${b2b ? "vocês resolvem" : "você resolve"} isso ${sua}?`,
    `Problema: o que mais atrapalha nesse processo${dor ? ` (por exemplo: ${minuscInicio(dor.replace(/[.!]$/, ""))})` : ""}?`,
    `Impacto: quanto isso custa ${b2b ? "por mês, em dinheiro ou em tempo da equipe" : "para você, em dinheiro ou em tempo"}?`,
    b2b ? "Decisão: além de você, quem participa da decisão?" : "",
    "Momento: resolver isso é para agora ou para os próximos meses?",
  ].filter(Boolean);
  const qualificacao = [
    "Uma pergunta por vez, esperando a resposta antes da próxima:",
    ...(curto ? perguntas.slice(0, 3) : perguntas).map((p) => `- ${p}`),
  ].join("\n");

  const oferta = [
    "Pelo que você me contou, é exatamente aí que o {produto} ajuda:",
    ...(beneficios.length ? beneficios.map((b) => `- ${ponto(b)}`) : ["- {diferencial}"]),
    !curto && diferencial && !beneficios.includes(diferencial) ? `O que nos diferencia: ${minuscInicio(ponto(diferencial))}` : "",
    prova ? `${ponto(prova)}${e2}` : "",
    !curto ? linhaPrazo : "",
    linhaPreco,
  ].filter(Boolean).join("\n");

  const proximoPasso = b2b
    ? "Proponho o próximo passo: uma conversa de 15 minutos para eu entender o seu cenário e mostrar como ficaria. Amanhã de manhã ou à tarde fica melhor?"
    : "Proponho o próximo passo: eu te mostro como ficaria no seu caso, em poucos minutos. Hoje ou amanhã fica melhor?";
  const fechamento = [
    "Faz sentido para você seguir?",
    proximoPasso,
    garantia ? `E para você ficar tranquilo: ${minuscInicio(ponto(garantia))}` : "",
    podeDesconto && !curto ? "Se fecharmos nesta conversa, eu verifico com a {empresa} uma condição especial para você." : "",
  ].filter(Boolean).join("\n");

  // --- Funil de WhatsApp (mensagens prontas + quando usar) ------------------
  const quando = (t) => (curto ? "" : `\nQuando usar: ${t}`);
  const funil = {
    boasVindas: `${oi} Aqui é da {empresa}, que bom falar com ${voce}.${e1} Para eu te ajudar do jeito certo: o que te fez procurar {produto} agora?`
      + quando("na primeira resposta de quem chegou pelo anúncio ou indicação. Texto curto, sem áudio."),
    qualificacao: `Entendi. E hoje, como ${b2b ? "vocês fazem isso" : "você faz isso"}? O que mais tem dado trabalho?`
      + quando("depois que a pessoa disse o que procura. Uma pergunta por mensagem; espere a resposta."),
    oferta: [
      `Pelo que você contou, o {produto} resolve justamente isso: ${minuscInicio(ponto(beneficios[0] || "{diferencial}"))}`,
      prova ? ponto(prova) : "",
      podePreco ? linhaPreco : "",
    ].filter(Boolean).join(" ") + quando("quando a dor estiver clara. Liga o problema que a pessoa contou ao que o produto faz."),
    objecoes: montarObjecoes({ f, podePreco, linhaPreco, prova, garantia, diferencial, dor, prazo, b2b, curto }),
    fechamento: `${b2b ? "Vamos marcar 15 minutos para eu te mostrar como ficaria?" : "Quer que eu te mostre como ficaria no seu caso?"} Amanhã de manhã ou à tarde?${e2}`
      + quando("quando a pessoa já entendeu a oferta. Proponha o próximo passo em vez de perguntar qual seria."),
  };

  // --- Follow-ups (cadência do Academy: nunca duas sem resposta seguidas) ---
  const followups = [
    { quando: "Após 1 dia", mensagem: `${oi} Vi que ficou pendente a nossa conversa sobre {produto}. Faz sentido continuarmos?` },
    { quando: "Após 3 dias", mensagem: prova
      ? `${oi} Uma informação que pode ajudar na sua decisão: ${minuscInicio(ponto(prova))} Quer que eu te mostre como seria no seu caso?`
      : `${oi} Pensei no que você me contou: ${minuscInicio(ponto(beneficios[0] || "o {produto} foi feito para esse tipo de situação"))} Quer ver como seria no seu caso?` },
    !curto && (dor || diferencial) ? { quando: "Após 6 dias", mensagem: dor
      ? `${oi} Muita gente só percebe o custo disso depois: ${minuscInicio(ponto(dor))} Vale uma conversa rápida esta semana?`
      : `${oi} Uma coisa que pouca gente sabe: ${minuscInicio(ponto(diferencial))} Vale uma conversa rápida esta semana?` } : null,
    { quando: "Após 10 dias", mensagem: `${oi} Não quero te incomodar, então esta é a minha última mensagem por aqui. Se em algum momento fizer sentido falar de {produto}, é só me chamar. Fico à disposição.` },
  ].filter(Boolean);

  // Aulas do Academy que deram a base desta geração.
  const fontes = aulas.slice(0, 8).map((a) => `${a.curso} — ${a.titulo}`);

  return {
    script: { abertura, qualificacao, oferta, fechamento },
    funil,
    followups,
    fontes,
    fatos: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.length])),
    ajusteEntendido: pedidoAjuste ? entendido : null,
  };
}

function montarObjecoes({ f, podePreco, linhaPreco, prova, garantia, diferencial, dor, prazo, b2b, curto }) {
  // Primeiro as que a própria empresa responde nos materiais (FAQ); depois as
  // mais comuns, com a resposta montada a partir dos fatos.
  const daEmpresa = f.objecoes.map((o) => `Se disser "${o.rotulo}": ${ponto(o.resposta)}`);
  const respondidas = new Set(f.objecoes.map((o) => o.chave));
  const padrao = {
    preco: `Se disser "Está caro": entendo. Antes do preço, vale olhar quanto custa continuar como está${dor ? ` — ${minuscInicio(dor.replace(/[.!]$/, ""))}` : ""}. ${prova ? ponto(prova) : ""} ${podePreco ? "" : linhaPreco}`.replace(/\s+/g, " ").trim(),
    concorrente: `Se disser "Já tenho um fornecedor": ótimo, então ${b2b ? "vocês já sabem" : "você já sabe"} o valor de resolver isso. A diferença está aqui: ${minuscInicio(ponto(diferencial || "{diferencial}"))} Vale comparar?`,
    confianca: `Se disser "Não sei se funciona para mim": ${prova ? ponto(prova) : "faz sentido ter essa dúvida."} ${garantia ? ponto(garantia) : "Posso te mostrar como seria no seu caso antes de qualquer decisão."}`.trim(),
    depois: `Se disser "Vou pensar": claro. Para eu não te mandar mensagem à toa, o que falta para decidir: ${b2b ? "orçamento, aprovação de alguém ou o momento" : "valor, confiança ou o momento"}?`,
    tempo: `Se disser "Não tenho tempo agora": justamente por isso a conversa é curta. ${prazo ? ponto(prazo) : "Em 15 minutos você vê se faz sentido."}`,
  };
  const ordem = curto ? ["preco", "depois"] : ["preco", "concorrente", "confianca", "depois", "tempo"];
  const extras = ordem.filter((k) => !respondidas.has(k)).map((k) => padrao[k]);
  return [...daEmpresa, ...extras].slice(0, curto ? 3 : 6).join("\n");
}

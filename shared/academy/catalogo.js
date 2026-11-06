// Catálogo inicial da RYCS Academy.
//
// Este arquivo é SEMENTE, não fonte da verdade. No primeiro boot o conteúdo
// daqui vira linha em `courses`, e a partir daí quem manda é o banco: a
// plataforma edita, adiciona módulo e publica sem deploy. Mexer aqui depois
// não altera curso já publicado.
//
// A capa é um SVG gerado a partir do próprio curso. Não é foto de banco de
// imagens e não finge ser: é identidade visual consistente, gerada, sem
// depender de arquivo externo que precisaria de storage.

export const CATEGORIAS = [
  "Plataforma RYCS",
  "Prospecção", "SDR", "BDR", "Cold Call", "WhatsApp", "Vendas consultivas",
  "Negociação", "Fechamento", "Follow-up", "Porta a porta", "Social Selling",
  "CRM", "Objeções", "Comunicação", "Gestão de carteira", "Produtividade",
];

export const NIVEIS_CURSO = {
  fundamentos: { nome: "Fundamentos", cor: "#5B8CFF" },
  intermediario: { nome: "Intermediário", cor: "#7C6CFF" },
  avancado: { nome: "Avançado", cor: "#F0B45E" },
};

// Capa gerada: gradiente por categoria + inicial + faixa diagonal. Fica como
// data URI, então não há requisição extra nem arquivo para hospedar.
export function gerarCapa({ titulo, categoria, cor = "#5B8CFF" }) {
  const escapar = (t) => String(t).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const linhas = String(titulo).split(" ").reduce((acc, p) => {
    const ultima = acc[acc.length - 1];
    if (ultima && (ultima + " " + p).length <= 18) acc[acc.length - 1] = ultima + " " + p;
    else acc.push(p);
    return acc;
  }, []).slice(0, 3);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${cor}" stop-opacity=".95"/>
<stop offset="1" stop-color="#070B14" stop-opacity=".98"/>
</linearGradient>
</defs>
<rect width="480" height="270" fill="#070B14"/>
<rect width="480" height="270" fill="url(#g)"/>
<circle cx="410" cy="46" r="118" fill="#fff" opacity=".05"/>
<circle cx="52" cy="236" r="84" fill="#fff" opacity=".04"/>
<text x="34" y="52" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#fff" opacity=".7" letter-spacing="2">${escapar(String(categoria).toUpperCase())}</text>
${linhas.map((l, i) => `<text x="34" y="${138 + i * 34}" font-family="system-ui,sans-serif" font-size="30" font-weight="700" fill="#fff">${escapar(l)}</text>`).join("")}
<rect x="34" y="${150 + linhas.length * 34}" width="52" height="4" rx="2" fill="#fff" opacity=".8"/>
<text x="34" y="246" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="#fff" opacity=".6">RYCS ACADEMY</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

const aula = (titulo, duracaoMin, conteudo, tipo = "texto") => ({ titulo, duracaoMin, conteudo, tipo });
const modulo = (titulo, resumo, aulas) => ({ titulo, resumo, aulas });
const questao = (pergunta, alternativas, correta, explicacao) => ({ pergunta, alternativas, correta, explicacao });

// -------------------------------------------------------------------------
// Curso âncora: SDR completo.
//
// É o modelo de profundidade que o catálogo deve seguir — cinco módulos,
// dezenove aulas, prova de dez questões. Cada aula fecha com algo que o
// profissional consegue aplicar na próxima ligação, não com teoria solta.
// -------------------------------------------------------------------------

const SDR = {
  slug: "sdr-completo",
  titulo: "SDR: da lista à reunião qualificada",
  subtitulo: "O ofício inteiro de quem abre portas em vendas B2B",
  categoria: "SDR",
  nivel: "fundamentos",
  professor: "RYCS Academy",
  funcao: "sdr",
  gratuito: true,
  preco: 0,
  descricao:
    "O SDR não vende: ele compra tempo do closer. Este curso percorre o ofício inteiro — " +
    "entender o papel, montar lista, abrir conversa, qualificar com critério, contornar as " +
    "objeções de quem não pediu para ser abordado e passar o bastão sem perder contexto. " +
    "Ao final você faz a prova e, com 70% ou mais, recebe o certificado que libera campanhas " +
    "que exigem certificação.",
  requisitos: "Nenhum. O curso começa do zero e assume que você nunca prospectou.",
  modulos: [
    modulo("O papel do SDR", "O que você entrega, o que não é seu trabalho e como isso é medido.", [
      aula("O SDR não vende", 6,
        "O SDR não fecha contrato. Ele produz uma coisa só: reunião com a pessoa certa, no problema certo, na hora certa.\n\n" +
        "Isso muda tudo na forma de trabalhar. Se o seu produto fosse a venda, você insistiria até o cliente ceder. Como o seu produto é a reunião qualificada, insistir com quem não tem o problema é destruir o seu próprio resultado — você entrega ao closer uma agenda cheia de conversa que não vai a lugar nenhum, e o closer para de confiar no que você marca.\n\n" +
        "A pergunta que define o seu dia não é \"quantas pessoas eu falei?\". É \"quantas dessas conversas viraram reunião que o closer agradeceu?\".\n\n" +
        "**Aplique hoje:** antes de marcar a próxima reunião, responda em uma frase por que esse cliente tem o problema que a sua empresa resolve. Se você não conseguir, a reunião não está qualificada."),
      aula("Reunião marcada não é resultado", 5,
        "Existe um vício clássico na profissão: bater meta de reuniões marcadas. O número sobe, o gestor comemora, e três semanas depois ninguém entende por que nada fechou.\n\n" +
        "Reunião com quem não decide é retrabalho. Reunião com quem não tem o problema é retrabalho. Reunião com quem não tem orçamento nem caminho para conseguir é retrabalho. Em todos os casos você gastou uma hora do closer e uma hora do cliente para produzir nada.\n\n" +
        "O indicador honesto é reunião **realizada e aproveitada**. Se metade do que você marca não acontece ou não avança, o problema não está no closer.\n\n" +
        "**Aplique hoje:** acompanhe por uma semana quantas das suas reuniões marcadas de fato aconteceram. Esse número é o seu verdadeiro desempenho."),
      aula("Como o seu trabalho é medido na RYCS", 5,
        "Na plataforma, cada ação sua vira uma evidência auditada. Reunião agendada, reunião realizada, call conectada e follow-up têm valores definidos pela empresa contratante, e cada uma precisa de comprovação.\n\n" +
        "A auditoria não é burocracia: é o que permite a empresa pagar por resultado sem conhecer você. Quanto mais consistente a sua evidência, mais rápido a liberação e maior o seu RYCS Score.\n\n" +
        "Evidência reciclada, dado inventado ou contato repetido são detectados. Não vale o risco: uma recusa derruba seu score e o score é o que te coloca no topo da fila das empresas.\n\n" +
        "**Aplique hoje:** confira se você consegue comprovar as três últimas ações que registrou. Se não conseguiria, ajuste o seu processo de registro antes de escalar volume."),
      aula("O ciclo completo, do lead ao bastão", 6,
        "O fluxo do SDR tem seis etapas e cada uma tem um critério de saída claro:\n\n" +
        "1. **Lista** — contatos que se parecem com o cliente ideal.\n" +
        "2. **Pesquisa** — o mínimo que justifica a abordagem ser sobre ele, não sobre você.\n" +
        "3. **Cadência** — sequência planejada de tentativas por canais diferentes.\n" +
        "4. **Conversa** — abertura, problema, dimensionamento.\n" +
        "5. **Qualificação** — dor reconhecida, decisor mapeado, orçamento plausível.\n" +
        "6. **Passagem** — reunião agendada e contexto transferido ao closer.\n\n" +
        "Pular a etapa 2 é o erro mais comum e o mais caro: sem pesquisa, a etapa 4 vira pitch genérico e a 5 vira chute.\n\n" +
        "**Aplique hoje:** identifique em qual dessas seis etapas você perde mais gente. É ali que está o seu gargalo, não no volume."),
    ]),

    modulo("Construir a lista certa", "Onde o resultado é decidido antes da primeira ligação.", [
      aula("ICP: o cliente que você quer, não o que aceita", 6,
        "ICP é o perfil de cliente ideal: quem tem o problema com intensidade suficiente para pagar para resolvê-lo, e para quem a sua solução funciona bem.\n\n" +
        "Um ICP útil é específico. \"Empresas do Brasil\" não é ICP. \"Distribuidoras de 10 a 80 funcionários que ainda controlam pedido em planilha\" é.\n\n" +
        "Três perguntas montam um ICP:\n" +
        "- Quem sofre o problema todo mês, não uma vez por ano?\n" +
        "- Quem já tenta resolver de algum jeito ruim hoje?\n" +
        "- Quem consegue decidir e pagar sem processo de seis meses?\n\n" +
        "**Aplique hoje:** escreva o ICP da campanha que você está atendendo em uma frase. Se levar mais de uma, ainda está largo demais."),
      aula("Sinais de compra em lista fria", 7,
        "Nem toda lista é igualmente fria. Sinais observáveis separam quem provavelmente tem o problema agora de quem talvez tenha algum dia:\n\n" +
        "- **Contratação** — quem está contratando para uma área geralmente está com pressão nela.\n" +
        "- **Expansão** — filial nova, linha nova, região nova.\n" +
        "- **Troca de liderança** — gestor novo costuma revisar fornecedor e processo.\n" +
        "- **Tecnologia visível** — o que aparece no site, na vaga, no anúncio.\n" +
        "- **Movimento público** — rodada, prêmio, aquisição, mudança de sede.\n\n" +
        "Um sinal não prova nada sozinho, mas dois ou três juntos mudam a probabilidade e, principalmente, te dão o que dizer na abertura.\n\n" +
        "**Aplique hoje:** pegue dez contatos da sua lista e procure um sinal em cada. Os que tiverem sinal vão para o topo da fila."),
      aula("Higiene de lista: o que descartar antes de ligar", 5,
        "Tempo gasto com contato ruim é tempo que não volta. Descarte antes de discar:\n\n" +
        "- Telefone com quantidade de dígitos impossível ou DDD inexistente.\n" +
        "- E-mail genérico quando a campanha exige o decisor.\n" +
        "- Empresa fora do porte ou do segmento do ICP.\n" +
        "- Contato já trabalhado por outro profissional na mesma campanha.\n\n" +
        "Esse último é importante na RYCS: contato duplicado entre profissionais é detectado pela auditoria e queima a evidência dos dois.\n\n" +
        "**Aplique hoje:** antes de começar o dia, limpe a lista. Vinte contatos bons rendem mais que cem sujos."),
      aula("Quantos contatos por dia fazem sentido", 5,
        "A resposta honesta é: depende do ticket e da profundidade da pesquisa.\n\n" +
        "Ticket baixo e ciclo curto suportam volume alto com pesquisa rasa. Ticket alto exige pesquisa real, e aí trinta contatos bem feitos valem mais que cem disparos.\n\n" +
        "O erro é escolher o volume primeiro e a qualidade depois. Escolha o padrão de qualidade que a campanha exige e descubra quantos contatos cabem nele.\n\n" +
        "**Aplique hoje:** cronometre quanto tempo você leva para pesquisar e abordar bem um contato. Multiplique pelo que você consegue sustentar sem cair de qualidade — esse é o seu número."),
    ]),

    modulo("A primeira conversa", "Abertura, problema e o direito de continuar falando.", [
      aula("Os primeiros quinze segundos", 7,
        "Quem atende uma ligação sua não pediu para ser abordado. Você tem uns quinze segundos para justificar a interrupção.\n\n" +
        "O que **não** funciona: apresentar a empresa, listar funcionalidade, perguntar \"como vai você?\", falar preço para filtrar.\n\n" +
        "O que funciona é nomear um problema que a pessoa reconheça como dela:\n\n" +
        "> \"Marcos, aqui é a Ana, da [empresa]. Liguei porque a gente tem trabalhado com distribuidoras que ainda fecham pedido por planilha e perdem margem em erro de digitação. Isso acontece aí ou vocês já resolveram?\"\n\n" +
        "Repare: problema específico, pergunta que aceita \"não\", e permissão explícita para a pessoa encerrar. Dar saída aumenta a chance de continuar.\n\n" +
        "**Aplique hoje:** escreva a sua abertura em três linhas. Se ela descreve a sua empresa em vez do problema do cliente, reescreva."),
      aula("Conduzir por perguntas, não por apresentação", 6,
        "Numa conversa comercial, quem fala mais deve ser o cliente. O seu papel é conduzir.\n\n" +
        "Apresentar cedo é o vício mais comum de quem está começando: a ansiedade empurra para mostrar o produto antes de saber se há problema. O resultado é o cliente educado dizendo \"manda material por e-mail\".\n\n" +
        "Perguntas que abrem conversa de verdade:\n" +
        "- \"Como vocês fazem isso hoje?\"\n" +
        "- \"O que acontece quando dá errado?\"\n" +
        "- \"Quanto isso custa por mês, entre retrabalho e perda?\"\n" +
        "- \"Já tentaram resolver antes? O que aconteceu?\"\n\n" +
        "**Aplique hoje:** na próxima conversa, conte quantos minutos você falou e quantos o cliente falou. Se a proporção não for pelo menos 30/70, você apresentou cedo demais."),
      aula("Dimensionar o custo do problema", 7,
        "Problema sem número não gera urgência. \"A gente perde alguns pedidos\" não move ninguém; \"a gente perde uns oito pedidos por mês, de uns dois mil cada\" move.\n\n" +
        "O número precisa sair da boca do cliente, não da sua. Valor que você afirma é argumento; valor que ele calcula é conclusão — e ninguém discute a própria conclusão.\n\n" +
        "Sequência que funciona:\n" +
        "1. Frequência: \"com que frequência isso acontece?\"\n" +
        "2. Impacto unitário: \"quanto custa cada vez?\"\n" +
        "3. Consolidação: \"então são uns X por mês?\"\n\n" +
        "**Aplique hoje:** leve toda conversa até um número dito pelo cliente. Sem ele, a reunião que você marcar vai morrer na proposta."),
      aula("Registrar o que importa para o closer", 5,
        "A conversa termina e o contexto evapora se você não registrar. O closer que recebe \"cliente interessado\" precisa refazer toda a descoberta — e o cliente percebe que ninguém conversou internamente.\n\n" +
        "O mínimo que todo registro precisa ter:\n" +
        "- Problema com as palavras do cliente.\n" +
        "- Número que ele mesmo disse.\n" +
        "- Como resolvem hoje.\n" +
        "- Quem decide e quem influencia.\n" +
        "- O que ele espera da reunião.\n\n" +
        "**Aplique hoje:** registre sua próxima conversa nesse formato. Leva dois minutos e dobra o aproveitamento da reunião."),
    ]),

    modulo("Qualificar com critério", "Separar quem vai avançar de quem só foi educado.", [
      aula("Os três filtros que não se negociam", 7,
        "Antes de agendar, confirme três coisas:\n\n" +
        "**Problema reconhecido.** Não basta existir; a pessoa precisa reconhecer. Cliente que não acha que tem problema não compra solução.\n\n" +
        "**Decisor mapeado.** A pessoa decide, ou você sabe quem decide e como ela entra na conversa.\n\n" +
        "**Orçamento plausível.** Não precisa ter valor aprovado, mas precisa haver caminho. Empresa que não tem como pagar não vira cliente por insistência.\n\n" +
        "Faltando qualquer um dos três, você não tem reunião qualificada — tem conversa agendada.\n\n" +
        "**Aplique hoje:** revise as reuniões que você marcou nesta semana contra os três filtros. As que falharem explicam seus no-shows."),
      aula("Interesse não é qualificação", 5,
        "\"Achei interessante, me manda mais informação\" é a frase mais enganosa da prospecção. Ela parece avanço e quase sempre é gentileza.\n\n" +
        "Interesse é barato. O que separa interesse de intenção é a disposição de gastar algo: tempo na agenda, presença de outra pessoa, um dado interno.\n\n" +
        "Teste simples: peça algo pequeno. \"Para a reunião render, você consegue levantar quantos pedidos vocês fecham por mês?\" Quem tem intenção levanta. Quem foi educado some.\n\n" +
        "**Aplique hoje:** peça um dado antes de confirmar a agenda. O no-show cai."),
      aula("Reunião com quem não decide", 5,
        "Às vezes você só consegue chegar em quem não decide. Isso não é perda de tempo automaticamente — mas muda o objetivo.\n\n" +
        "Com um influenciador, a reunião não é para vender: é para entender o processo e conseguir acesso a quem decide. Tratá-la como reunião de venda produz uma apresentação para alguém que não pode dizer sim.\n\n" +
        "Pergunte diretamente: \"além de você, quem mais precisa estar nessa conversa para a gente sair com uma decisão?\"\n\n" +
        "**Aplique hoje:** em toda reunião que agendar, confirme quem estará presente. Reunião com participante errado é retrabalho que conta contra você."),
      aula("Quando desqualificar e seguir em frente", 6,
        "Desqualificar rápido é uma habilidade, não uma derrota. Cada hora gasta em quem não vai comprar é uma hora que não foi para quem ia.\n\n" +
        "Sinais para encerrar com elegância:\n" +
        "- Não reconhece o problema depois de duas tentativas de dimensionar.\n" +
        "- Não há decisor acessível em horizonte razoável.\n" +
        "- Acabaram de contratar um concorrente com contrato longo.\n" +
        "- O porte está claramente fora do que a solução atende.\n\n" +
        "Encerre deixando porta aberta: \"parece que não é o momento. Posso voltar daqui uns meses?\" Isso preserva a lista para o futuro.\n\n" +
        "**Aplique hoje:** escolha três contatos que você vem insistindo sem avanço e desqualifique conscientemente."),
    ]),

    modulo("Cadência, objeções e passagem", "O que fazer quando não respondem e como entregar bem.", [
      aula("Cadência: o silêncio não é resposta", 7,
        "A maioria das oportunidades morre no primeiro silêncio, porque a maioria dos profissionais desiste ali.\n\n" +
        "Cadência é sequência planejada: canais diferentes, horários diferentes, ângulos diferentes, ao longo de dias. Não é repetir a mesma mensagem.\n\n" +
        "Exemplo de cadência de duas semanas:\n" +
        "- Dia 1: ligação de manhã.\n" +
        "- Dia 2: WhatsApp curto com o problema.\n" +
        "- Dia 4: ligação à tarde.\n" +
        "- Dia 7: e-mail com um caso parecido.\n" +
        "- Dia 10: ligação em outro horário.\n" +
        "- Dia 14: mensagem de encerramento — \"vou parar de insistir, me avise se mudar\".\n\n" +
        "A mensagem de encerramento tem a maior taxa de resposta de toda a cadência. Use.\n\n" +
        "**Aplique hoje:** escreva a sua cadência e execute sem improviso por duas semanas."),
      aula("As quatro objeções de abertura", 7,
        "Quem não pediu para ser abordado usa sempre as mesmas quatro saídas:\n\n" +
        "**\"Não tenho interesse.\"** — Vem antes de saber do que se trata. Responda com o problema, não com o produto: \"entendo. Só para eu não insistir à toa: erro de digitação em pedido acontece aí?\"\n\n" +
        "**\"Manda por e-mail.\"** — É saída educada. \"Mando sim. Para eu mandar o que interessa e não um material genérico, me diz uma coisa: como vocês fazem isso hoje?\"\n\n" +
        "**\"Estou sem tempo.\"** — Pode ser verdade. \"Claro. Prefere que eu ligue amanhã de manhã ou depois das cinco?\" Alternativa fechada, não pergunta aberta.\n\n" +
        "**\"Já temos fornecedor.\"** — Ótimo sinal: tem o problema e paga por ele. \"Perfeito, então o tema é relevante aí. O que funciona bem e o que te incomoda no atual?\"\n\n" +
        "**Aplique hoje:** escreva a sua resposta para as quatro e treine em voz alta antes de discar."),
      aula("Contornar não é insistir", 5,
        "Contornar objeção é diferente de insistir. Insistir é repetir o pedido com mais energia; contornar é mudar o ângulo da conversa.\n\n" +
        "Quem insiste queima o contato e às vezes a lista inteira. Quem contorna faz uma pergunta que devolve a conversa para o problema.\n\n" +
        "Regra prática: se você já contornou duas vezes e a pessoa continua fechada, encerre e volte na cadência. Terceira insistência na mesma ligação não converte — irrita.\n\n" +
        "**Aplique hoje:** observe quantas vezes você tenta na mesma ligação. Se for mais de duas, corte."),
      aula("A passagem de bastão", 6,
        "A reunião está marcada. Falta a parte que decide se ela vai render.\n\n" +
        "Uma passagem completa entrega ao closer:\n" +
        "- O problema nas palavras do cliente.\n" +
        "- O número que o cliente disse.\n" +
        "- Quem estará na sala e quem decide.\n" +
        "- O que já foi tentado antes.\n" +
        "- O que o cliente espera da reunião.\n\n" +
        "E entrega ao cliente uma confirmação com data, horário, duração e quem participa. Confirmação escrita derruba no-show.\n\n" +
        "**Aplique hoje:** monte um modelo de passagem e use em toda reunião. Pergunte ao closer depois se faltou algo — o feedback dele melhora seu processo mais rápido que qualquer curso."),
    ]),
  ],
  prova: [
    questao("Qual é a entrega principal do SDR?",
      ["Fechar o contrato", "Reunião com a pessoa certa, no problema certo", "Enviar o máximo de propostas", "Gerar o maior número de ligações"], 1,
      "O SDR compra tempo do closer entregando reunião qualificada. Fechamento é entrega do closer."),
    questao("Numa primeira ligação, o que você faz primeiro?",
      ["Apresento o produto e as funcionalidades", "Falo o preço para filtrar rápido", "Nomeio um problema que a pessoa possa reconhecer", "Conto a história da empresa"], 2,
      "Quem atende não pediu para ser abordado. Só um problema reconhecível justifica a interrupção."),
    questao("O cliente diz 'manda por e-mail'. Qual é a melhor resposta?",
      ["Mandar e aguardar retorno", "Insistir que a ligação é rápida", "Concordar e perguntar como fazem hoje, para enviar algo específico", "Dizer que o material não explica bem"], 2,
      "É uma saída educada. Concordar e devolver uma pergunta mantém a conversa sem confronto."),
    questao("Qual destes NÃO é um dos três filtros de qualificação?",
      ["Problema reconhecido pelo cliente", "Decisor mapeado", "Orçamento plausível", "Cliente ter demonstrado interesse"], 3,
      "Interesse é barato e quase sempre gentileza. Não substitui problema, decisor e orçamento."),
    questao("O custo do problema deve ser dito por quem?",
      ["Pelo vendedor, para dar credibilidade", "Pelo cliente, calculando com suas perguntas", "Pelo material de marketing", "Não precisa ser dito"], 1,
      "Valor que você afirma é argumento; valor que o cliente calcula é conclusão — e ele não discute a própria conclusão."),
    questao("Quantas tentativas antes de considerar um contato perdido?",
      ["Uma ou duas", "Três a cinco, sempre pelo mesmo canal", "Seis ou mais, variando canal, horário e ângulo", "Tentar indefinidamente até responder"], 2,
      "Cadência é sequência planejada com canais e ângulos diferentes, não repetição da mesma mensagem."),
    questao("Reunião marcada com quem não decide:",
      ["Conta como resultado, o volume importa", "Serve para entender o processo e conseguir acesso ao decisor", "Deve ser tratada como reunião de venda normal", "Deve ser sempre recusada"], 1,
      "Não é perda automática, mas o objetivo muda: mapear processo e conseguir acesso, não apresentar solução."),
    questao("Numa conversa comercial, quem deve falar mais?",
      ["O vendedor, para mostrar domínio", "O cliente, conduzido por perguntas", "Meio a meio", "Depende do produto"], 1,
      "Apresentar cedo produz o 'manda material por e-mail'. Conduzir por perguntas produz descoberta."),
    questao("O que uma boa passagem de bastão precisa ter?",
      ["Apenas data e horário da reunião", "Nome e telefone do contato", "Problema nas palavras do cliente, número dito por ele, quem decide e expectativa", "Um resumo dizendo que o cliente está interessado"], 2,
      "Sem contexto o closer refaz a descoberta, e o cliente percebe que ninguém conversou internamente."),
    questao("Por que evidência reciclada é um problema na RYCS?",
      ["Porque dá trabalho registrar", "Porque a auditoria detecta e a recusa derruba o RYCS Score", "Porque a empresa não gosta", "Não é um problema real"], 1,
      "A auditoria compara evidências; reuso é detectado, a ação é recusada e o score cai — e o score define sua posição na fila das empresas."),
  ],
};

// -------------------------------------------------------------------------
// Demais cursos do catálogo inicial.
// -------------------------------------------------------------------------

const COLD_CALL = {
  slug: "cold-call-na-pratica",
  titulo: "Cold call na prática",
  subtitulo: "O que dizer quando a pessoa atende e não te conhece",
  categoria: "Cold Call",
  nivel: "intermediario",
  professor: "RYCS Academy",
  funcao: "",
  gratuito: true,
  preco: 0,
  descricao:
    "Ligação fria é o canal mais rápido e o mais desconfortável. Este curso trata do que " +
    "acontece nos primeiros segundos, de como sustentar a conversa sem virar pitch e de como " +
    "encerrar sem queimar o contato para a próxima tentativa.",
  requisitos: "Recomendado depois de 'SDR: da lista à reunião qualificada'.",
  modulos: [
    modulo("Antes de discar", "Preparo que muda o resultado da ligação.", [
      aula("Pesquisa mínima viável", 5,
        "Você não precisa de meia hora de pesquisa por contato. Precisa de três coisas: o que a empresa faz, um sinal recente e o nome de quem você quer falar.\n\n" +
        "Com isso a abertura deixa de ser genérica. Sem isso, qualquer script soa como telemarketing.\n\n" +
        "**Aplique hoje:** limite a pesquisa a dois minutos por contato e veja se a abertura melhora mesmo assim."),
      aula("Estado antes da ligação", 4,
        "Ligação fria é atividade de repetição sob rejeição. Quem liga tenso transmite tensão, e quem atende responde à energia antes de responder ao conteúdo.\n\n" +
        "Duas coisas ajudam de verdade: ficar de pé e fazer a primeira ligação do dia com o contato menos importante da lista.\n\n" +
        "**Aplique hoje:** reorganize a fila para aquecer antes de chegar nos contatos que importam."),
    ]),
    modulo("A ligação", "Abertura, condução e encerramento.", [
      aula("Abertura que não parece script", 6,
        "Script decorado soa decorado. O que funciona é ter a estrutura na cabeça e as palavras no momento.\n\n" +
        "Estrutura: nome + empresa + problema específico + pergunta que aceita não.\n\n" +
        "A pergunta que aceita 'não' é a parte que a maioria pula, e é justamente o que reduz a defesa de quem atende.\n\n" +
        "**Aplique hoje:** grave sua abertura e ouça. Se você não continuaria na linha, reescreva."),
      aula("Sustentar sem virar apresentação", 6,
        "Conseguiu passar dos quinze segundos. O erro seguinte é comemorar e começar a apresentar.\n\n" +
        "A ligação fria não é para vender: é para descobrir se vale marcar uma conversa. Pergunte mais, fale menos, e proponha a reunião quando houver problema dimensionado.\n\n" +
        "**Aplique hoje:** proíba-se de falar do produto por três minutos na próxima ligação."),
      aula("Encerrar preservando o contato", 5,
        "Nem toda ligação vira reunião, e tudo bem. O que não pode é queimar o contato.\n\n" +
        "Encerramento que preserva: agradece, resume o que entendeu e pede permissão para voltar em um prazo. Isso mantém o contato na lista para a próxima cadência.\n\n" +
        "**Aplique hoje:** encerre as recusas de hoje pedindo permissão para voltar em 90 dias."),
    ]),
  ],
  prova: [
    questao("Qual é o objetivo de uma cold call?",
      ["Vender na ligação", "Descobrir se vale marcar uma conversa", "Apresentar o produto completo", "Conseguir o e-mail do contato"], 1,
      "Ligação fria qualifica; quem tenta vender nela costuma receber 'manda material'."),
    questao("Por que a pergunta de abertura deve aceitar 'não'?",
      ["Para encerrar mais rápido", "Porque reduz a defesa de quem atende", "Para cumprir roteiro", "Não deve aceitar não"], 1,
      "Dar saída explícita baixa a guarda e aumenta a chance de a conversa continuar."),
    questao("Qual é a pesquisa mínima antes de discar?",
      ["Meia hora por contato", "O que a empresa faz, um sinal recente e o nome do decisor", "Apenas o telefone", "O faturamento da empresa"], 1,
      "Pesquisa mínima viável: suficiente para a abertura ser sobre ele, rápida o bastante para sustentar volume."),
    questao("Como encerrar uma ligação que não virou reunião?",
      ["Desligar rapidamente", "Insistir mais uma vez", "Resumir o entendido e pedir permissão para voltar em um prazo", "Prometer enviar proposta"], 2,
      "Encerramento que preserva mantém o contato disponível para a próxima cadência."),
    questao("O que fazer ao passar dos primeiros quinze segundos?",
      ["Apresentar o produto", "Continuar perguntando e dimensionando o problema", "Pedir o e-mail", "Propor a reunião imediatamente"], 1,
      "Comemorar e apresentar é o erro seguinte mais comum. A descoberta continua."),
  ],
};

const WHATSAPP = {
  slug: "whatsapp-comercial",
  titulo: "WhatsApp comercial sem parecer spam",
  subtitulo: "Mensagem que abre conversa em vez de ser bloqueada",
  categoria: "WhatsApp",
  nivel: "fundamentos",
  professor: "RYCS Academy",
  funcao: "",
  gratuito: true,
  preco: 0,
  descricao:
    "O WhatsApp virou o canal comercial mais usado do Brasil e o mais mal utilizado. " +
    "Este curso trata de estrutura de mensagem, timing, uso de áudio e o limite entre " +
    "acompanhar e perturbar.",
  requisitos: "Nenhum.",
  modulos: [
    modulo("A mensagem", "Estrutura do que funciona.", [
      aula("Por que mensagem longa não é lida", 5,
        "Mensagem comercial longa em WhatsApp tem destino previsível: rolagem e silêncio.\n\n" +
        "A estrutura que funciona tem quatro linhas: quem é você, por que está falando com essa pessoa especificamente, o problema, e uma pergunta curta.\n\n" +
        "**Aplique hoje:** corte sua mensagem padrão pela metade e meça a resposta."),
      aula("Áudio: quando ajuda e quando atrapalha", 5,
        "Áudio de primeira abordagem quase nunca é ouvido por quem não te conhece. Já no meio de uma conversa ativa, áudio curto acelera e humaniza.\n\n" +
        "Regra: texto para abrir, áudio para aprofundar, nunca áudio de três minutos.\n\n" +
        "**Aplique hoje:** se você abre por áudio, troque por texto e compare."),
      aula("Timing e frequência", 5,
        "Horário comercial, dias úteis, e nunca duas mensagens seguidas sem resposta.\n\n" +
        "O padrão que funciona é mensagem, espera de dois a três dias, segunda tentativa com ângulo diferente, e encerramento educado na terceira.\n\n" +
        "**Aplique hoje:** revise se você está mandando mensagem em cima de mensagem — é o caminho mais rápido para o bloqueio."),
    ]),
  ],
  prova: [
    questao("Qual estrutura funciona melhor numa primeira mensagem?",
      ["Texto longo explicando tudo", "Quatro linhas: quem é, por que essa pessoa, o problema e uma pergunta", "Só um áudio", "Link da proposta"], 1,
      "Mensagem longa não é lida; estrutura curta e específica abre conversa."),
    questao("Quando o áudio ajuda?",
      ["Na primeira abordagem", "No meio de uma conversa já ativa, e curto", "Sempre", "Nunca"], 1,
      "Áudio de abertura raramente é ouvido por quem não te conhece."),
    questao("Qual é o caminho mais rápido para ser bloqueado?",
      ["Mandar mensagem curta", "Mandar mensagens seguidas sem resposta", "Perguntar como fazem hoje", "Encerrar educadamente"], 1,
      "Mensagem em cima de mensagem é a definição de spam para quem recebe."),
  ],
};


// -------------------------------------------------------------------------
// Trilha Challenger — três cursos, um por contexto de aplicação.
//
// O método Challenger inverte a lógica do vendedor simpático: em vez de
// construir relacionamento e esperar o cliente pedir, o vendedor ENSINA algo
// que o cliente não sabia, ADAPTA a conversa para quem está ouvindo e ASSUME o
// controle do processo. Os três cursos aplicam o mesmo método em contextos
// diferentes, porque a execução muda bastante entre uma videochamada, uma
// ligação fria e uma abordagem de qualificação.
// -------------------------------------------------------------------------

const CHALLENGER_BASE = [
  aula("Os cinco perfis de vendedor", 7,
    "A pesquisa que originou o método classificou vendedores em cinco perfis: o **Trabalhador esforçado**, o **Construtor de relacionamento**, o **Lobo solitário**, o **Solucionador de problemas reativo** e o **Desafiador**.\n\n" +
    "O achado contraintuitivo: em vendas complexas, o Construtor de relacionamento — o vendedor mais simpático, o que todo mundo gosta — é o que tem o PIOR desempenho. E o Desafiador é o melhor, por uma margem que cresce conforme a venda fica mais complexa.\n\n" +
    "O motivo é simples quando se entende: relacionamento é consequência de valor entregue, não caminho para ele. O cliente não compra porque gosta de você; ele passa a gostar de você porque a conversa mudou o jeito dele de enxergar o próprio problema.\n\n" +
    "**Aplique hoje:** identifique qual perfil é o seu padrão. Quase todo vendedor brasileiro é treinado para ser Construtor de relacionamento."),
  aula("Ensinar, adaptar, assumir o controle", 7,
    "O Desafiador faz três coisas que os outros perfis não fazem:\n\n" +
    "**Ensina.** Traz uma informação que o cliente não tinha e que muda a forma dele ver a operação. Não é sobre o produto — é sobre o negócio do cliente.\n\n" +
    "**Adapta.** A mesma ideia é dita de um jeito para o financeiro e de outro para o operacional. Não é mudar o conteúdo; é mudar o que dói em cada um.\n\n" +
    "**Assume o controle.** Fala de dinheiro sem constrangimento, discorda quando precisa e conduz o processo em vez de perguntar \"o que você acha?\" o tempo todo.\n\n" +
    "A ordem importa: assumir o controle sem ter ensinado nada é ser o vendedor chato. É o ensinar que compra o direito de conduzir.\n\n" +
    "**Aplique hoje:** escreva uma informação sobre o setor do seu cliente que ele provavelmente não sabe e que muda a conta dele."),
  aula("O insight comercial: o que ensinar", 8,
    "Insight comercial não é curiosidade nem estatística solta. É uma informação que satisfaz três condições:\n\n" +
    "1. O cliente não sabia.\n" +
    "2. Muda o cálculo que ele faz sobre o próprio problema.\n" +
    "3. Leva, naturalmente, para algo em que você é forte.\n\n" +
    "A terceira condição é a que separa insight de conversa interessante. Se o seu insight leva o cliente a uma conclusão que qualquer concorrente atende igual, você educou o mercado de graça.\n\n" +
    "Exemplo ruim: \"o mercado de energia cresceu 20%\". Exemplo bom: \"empresas do seu porte costumam olhar a conta de luz e ignorar a demanda contratada, que é onde está a maior parte do desperdício — e é justamente o que a maioria dos fornecedores não mexe\".\n\n" +
    "**Aplique hoje:** teste o seu insight contra as três condições. Se falhar em qualquer uma, não é insight."),
  aula("Reframe: a virada da conversa", 7,
    "O reframe é o momento em que o cliente reorganiza o problema na cabeça. Ele acontece assim:\n\n" +
    "1. **Aquecimento** — você descreve o problema dele melhor do que ele descreveria. Isso compra atenção.\n" +
    "2. **Reframe** — você mostra que a causa não é a que ele pensava.\n" +
    "3. **Afogamento racional** — você dimensiona o custo dessa causa real, com números.\n" +
    "4. **Impacto emocional** — você liga o número ao dia a dia de quem está ouvindo.\n" +
    "5. **Novo caminho** — você mostra como seria resolver isso, ainda sem falar do produto.\n" +
    "6. **Sua solução** — só agora.\n\n" +
    "Quem pula direto para o passo 6 faz uma apresentação. Quem percorre os seis faz uma venda.\n\n" +
    "**Aplique hoje:** monte os seis passos para o seu produto. Leva uma hora e serve para o resto do ano."),
  aula("Assumir o controle sem ser arrogante", 6,
    "Assumir o controle é a parte que mais gera resistência em quem foi treinado para agradar. A confusão é entre firmeza e arrogância.\n\n" +
    "Firmeza é: propor o próximo passo em vez de perguntar se pode; discordar com fundamento quando o cliente diz algo que vai custar caro a ele; falar de preço no momento certo sem pedir desculpas.\n\n" +
    "Arrogância é: desmerecer a operação atual do cliente, tratar a objeção como ignorância, impor prazo que só serve à sua meta.\n\n" +
    "A régua prática: você está sendo firme quando a tensão que cria é sobre o **problema dele**, e arrogante quando é sobre **você ter razão**.\n\n" +
    "**Aplique hoje:** na próxima conversa, proponha o próximo passo em vez de perguntar qual seria."),
];

const CHALLENGER_PROVA_BASE = [
  questao("Segundo a pesquisa que originou o método, qual perfil tem o pior desempenho em vendas complexas?",
    ["Lobo solitário", "Construtor de relacionamento", "Trabalhador esforçado", "Desafiador"], 1,
    "É o achado contraintuitivo do método: o vendedor mais simpático é o que menos vende em venda complexa."),
  questao("O que o Desafiador ensina ao cliente?",
    ["As funcionalidades do produto", "Algo sobre o negócio do cliente que ele não sabia", "A história da empresa", "As condições comerciais"], 1,
    "Ensinar é sobre o negócio do cliente, nunca sobre o produto. O produto entra no fim."),
  questao("Um insight comercial precisa levar naturalmente a quê?",
    ["A qualquer solução do mercado", "A algo em que você é forte", "Ao menor preço", "A uma nova reunião"], 1,
    "Sem essa condição você educa o mercado de graça e o concorrente colhe."),
  questao("Qual é a ordem correta no reframe?",
    ["Solução, aquecimento, reframe", "Aquecimento, reframe, dimensionamento, impacto, novo caminho, solução", "Preço, produto, problema", "Reframe, solução, aquecimento"], 1,
    "Quem pula para a solução faz apresentação; quem percorre os seis passos faz venda."),
  questao("Qual é a diferença entre firmeza e arrogância?",
    ["Firmeza é falar alto", "A tensão da firmeza é sobre o problema do cliente; a da arrogância é sobre você ter razão", "Não há diferença prática", "Arrogância funciona melhor"], 1,
    "A régua é para onde aponta a tensão que você cria."),
];

const CHALLENGER_VIDEO = {
  slug: "challenger-videochamada",
  titulo: "Challenger em videochamada",
  subtitulo: "Conduzir e criar tensão construtiva por trás de uma tela",
  categoria: "Negociação",
  nivel: "avancado",
  professor: "RYCS Academy",
  funcao: "closer",
  gratuito: true,
  preco: 0,
  descricao:
    "A videochamada tirou do vendedor quase tudo que sustentava a presença: a sala, o aperto de mão, " +
    "o silêncio confortável. Este curso aplica o método Challenger ao formato remoto — como ensinar " +
    "com a tela compartilhada, como sustentar o reframe sem ler a sala, e como assumir o controle " +
    "quando o cliente está com a câmera fechada e três abas abertas.",
  requisitos: "Experiência com reuniões comerciais. Recomendado para quem conduz negociação.",
  modulos: [
    modulo("O método Challenger", "A base que os três cursos compartilham.", CHALLENGER_BASE),
    modulo("Adaptação ao formato remoto", "O que muda quando não há sala.", [
      aula("Presença sem sala", 7,
        "Numa reunião presencial, a presença vem de graça: você ocupa espaço, o cliente não tem para onde olhar. Na tela, você concorre com e-mail, WhatsApp e a próxima reunião.\n\n" +
        "O que devolve presença no remoto:\n" +
        "- **Câmera aberta e enquadramento de meio-busto.** Rosto pequeno no canto da tela não conduz nada.\n" +
        "- **Primeiros noventa segundos sem tela compartilhada.** Compartilhar cedo transforma você em narrador de slide.\n" +
        "- **Pausas deliberadas.** No remoto a tentação de preencher silêncio é maior, e é no silêncio que o cliente processa o reframe.\n\n" +
        "**Aplique hoje:** na próxima call, não compartilhe nada nos primeiros dois minutos."),
      aula("Ensinar com a tela, não pela tela", 7,
        "O erro clássico do remoto é abrir a apresentação de 40 slides e narrar. Isso mata o método: o Challenger ensina numa conversa, não numa exposição.\n\n" +
        "A tela serve para **uma coisa de cada vez**: um número, um gráfico simples, um cálculo feito ao vivo com os dados que o cliente acabou de dar. Fazer a conta na frente dele, com os números dele, vale mais que qualquer slide pronto.\n\n" +
        "Regra prática: se o slide funcionaria enviado por e-mail, ele não deveria estar na reunião.\n\n" +
        "**Aplique hoje:** substitua o deck por uma planilha em branco e faça a conta ao vivo."),
      aula("Ler sinais quando não há sala", 6,
        "Presencialmente você lê postura, olhar e o movimento de quem se inclina para frente. No remoto, sobra pouco — e é preciso compensar com pergunta explícita.\n\n" +
        "Sinais que ainda dá para ler: tempo de resposta, se a pessoa abre a câmera ao ser questionada, se toma nota, se chama alguém para ver a tela.\n\n" +
        "E a pergunta que substitui a leitura da sala: \"isso bate com o que você vê aí ou estou falando de um problema que não é o seu?\". É desconfortável e é exatamente por isso que funciona.\n\n" +
        "**Aplique hoje:** faça essa pergunta no meio da próxima call, não no fim."),
      aula("Controle do processo à distância", 6,
        "Sem sala, o cliente encerra a reunião fechando uma aba. O controle precisa ser construído no começo, não resgatado no fim.\n\n" +
        "Três movimentos:\n" +
        "1. **Contrato inicial** — \"temos 40 minutos; proponho 10 entendendo a operação, 15 no que costuma dar errado e 15 decidindo se faz sentido seguir. Funciona?\"\n" +
        "2. **Marcos audíveis** — \"então até aqui a gente concordou que X. Posso seguir?\"\n" +
        "3. **Próximo passo antes do fim** — proponha aos 35 minutos, não aos 39.\n\n" +
        "**Aplique hoje:** use o contrato inicial na próxima reunião e observe a diferença no encerramento."),
    ]),
    modulo("Negociação e fechamento remoto", "Preço, objeção e decisão na tela.", [
      aula("Falar de preço em videochamada", 7,
        "No remoto, preço mal conduzido gera o pior dos silêncios: o cliente com a câmera fechada, sem reação visível, e o vendedor preenchendo o vazio com desconto.\n\n" +
        "O que fazer:\n" +
        "- Ancore no custo do problema que ELE dimensionou antes. Se você não dimensionou, não fale preço.\n" +
        "- Diga o número e **pare**. Conte até cinco mentalmente.\n" +
        "- Se vier silêncio, pergunte: \"o que passou pela sua cabeça agora?\"\n\n" +
        "O desconto oferecido antes da objeção é o sinal mais caro de insegurança que existe.\n\n" +
        "**Aplique hoje:** ensaie dizer o preço e ficar em silêncio. É mais difícil do que parece."),
      aula("As objeções que só existem no remoto", 6,
        "**\"Vou levar para o time e te retorno.\"** — No remoto isso é quase sempre o fim. Responda: \"faz sentido. Para não virar telefone sem fio, consigo 20 minutos com quem mais precisa entender isso?\"\n\n" +
        "**\"Manda a proposta que eu analiso.\"** — Proposta enviada sem próxima data é proposta morta. \"Mando hoje. Já deixo 20 minutos na quinta para a gente ver junto — se você decidir antes, cancelamos.\"\n\n" +
        "**Câmera fechada e silêncio.** — Nomeie: \"percebi que ficou quieto. É porque não faz sentido ou porque está processando?\"\n\n" +
        "**Aplique hoje:** nunca encerre uma call sem data marcada para o próximo passo."),
      aula("Fechar sem o aperto de mão", 6,
        "O fechamento remoto precisa de algo concreto no lugar do gesto físico: um documento aberto na tela, um cronograma preenchido junto, um e-mail redigido ali mesmo.\n\n" +
        "Co-criar o próximo passo na tela compartilhada, com o cliente vendo você escrever, produz comprometimento que nenhuma promessa verbal produz no remoto.\n\n" +
        "**Aplique hoje:** na próxima call que avançar, abra um documento e escreva o plano junto com o cliente antes de desligar."),
    ]),
  ],
  prova: [
    ...CHALLENGER_PROVA_BASE,
    questao("Por que não compartilhar a tela nos primeiros minutos de uma videochamada?",
      ["Por questão técnica", "Porque transforma o vendedor em narrador de slide e mata a conversa", "Para economizar tempo", "Porque o cliente não gosta"], 1,
      "O Challenger ensina numa conversa. Slide cedo vira exposição, e exposição não cria reframe."),
    questao("Depois de dizer o preço em uma videochamada, o que fazer?",
      ["Justificar imediatamente", "Oferecer uma condição melhor", "Parar e esperar a reação", "Mudar de assunto"], 2,
      "Desconto oferecido antes da objeção é o sinal mais caro de insegurança que existe."),
    questao("O cliente diz 'manda a proposta que eu analiso'. Qual é a melhor resposta?",
      ["Enviar e aguardar", "Enviar e já deixar uma data marcada para revisar juntos", "Insistir para decidir na hora", "Perguntar o orçamento"], 1,
      "Proposta enviada sem próxima data é proposta morta, especialmente no remoto."),
    questao("Qual pergunta substitui a leitura da sala no remoto?",
      ["Você entendeu?", "Isso bate com o que você vê aí ou estou falando de um problema que não é o seu?", "Posso continuar?", "Tem alguma dúvida?"], 1,
      "É desconfortável e por isso funciona: força uma resposta real em vez de concordância educada."),
  ],
};

const CHALLENGER_COLD = {
  slug: "challenger-cold-call",
  titulo: "Challenger no cold call",
  subtitulo: "Ensinar algo novo em sessenta segundos, para quem não te conhece",
  categoria: "Cold Call",
  nivel: "avancado",
  professor: "RYCS Academy",
  funcao: "",
  gratuito: true,
  preco: 0,
  descricao:
    "Aplicar o método Challenger numa ligação fria parece impossível: não há relacionamento, " +
    "não há contexto e há uns quinze segundos de paciência. Este curso comprime o método ao " +
    "essencial — um insight que cabe em duas frases, dito para quem não pediu para ouvir.",
  requisitos: "Recomendado depois de 'Cold call na prática'.",
  modulos: [
    modulo("O método Challenger", "A base que os três cursos compartilham.", CHALLENGER_BASE),
    modulo("Challenger comprimido", "O método em sessenta segundos.", [
      aula("O insight de duas frases", 7,
        "Na ligação fria não existe espaço para os seis passos do reframe. O que cabe é a versão comprimida: **uma observação sobre o setor dele + uma consequência que ele não calculou**.\n\n" +
        "> \"Marcos, a maioria das distribuidoras que a gente atende controla pedido em planilha e acha que o custo disso é o tempo de digitação. Na prática o custo maior é o pedido que sai errado e volta — e esse ninguém contabiliza. Acontece aí?\"\n\n" +
        "Duas frases, um reframe, uma pergunta que aceita não. Isso é Challenger em ligação fria.\n\n" +
        "**Aplique hoje:** escreva o seu insight em duas frases. Se não couber, ainda não está claro o suficiente."),
      aula("Tensão construtiva sem parecer agressivo", 6,
        "Criar tensão com quem não te conhece é arriscado: a linha entre provocar reflexão e soar arrogante é fina no telefone, onde não há expressão facial para suavizar.\n\n" +
        "O que mantém do lado certo:\n" +
        "- Atribua a observação a um grupo, não à pessoa: \"a maioria das empresas do setor\", não \"vocês\".\n" +
        "- Ofereça saída explícita: \"pode ser que aí já esteja resolvido\".\n" +
        "- Pergunte, não afirme: \"acontece aí?\" em vez de \"vocês têm esse problema\".\n\n" +
        "**Aplique hoje:** revise seu script e troque toda afirmação sobre o cliente por pergunta."),
      aula("Quando o cliente discorda do insight", 6,
        "Vai acontecer: \"aqui a gente não tem esse problema\". Há duas possibilidades, e confundi-las custa caro.\n\n" +
        "**Ele realmente resolveu.** Ótimo — desqualifique com elegância e peça uma indicação. Insistir aqui queima o contato.\n\n" +
        "**Ele não mediu.** Aí vale uma pergunta: \"legal. Vocês chegaram a medir quanto custa por mês ou é percepção?\" A pergunta é respeitosa e costuma abrir a conversa, porque quase ninguém mediu.\n\n" +
        "A diferença entre as duas aparece na resposta seguinte. Se vier um número, ele resolveu. Se vier \"acho que é pouco\", ele não mediu.\n\n" +
        "**Aplique hoje:** prepare essa pergunta e use na próxima discordância."),
      aula("Do insight para a reunião", 6,
        "O objetivo da ligação fria continua sendo a reunião qualificada — o insight é o que compra os quinze segundos seguintes, não o que fecha negócio.\n\n" +
        "A transição: depois que o cliente reconhece o problema e dá um sinal de dimensionamento, proponha com alternativa fechada.\n\n" +
        "> \"Faz sentido a gente olhar isso com calma? Tenho quinta às 10 ou sexta às 16.\"\n\n" +
        "Não pergunte se ele quer marcar. Proponha dois horários.\n\n" +
        "**Aplique hoje:** use alternativa fechada em todas as propostas de agenda de hoje."),
    ]),
  ],
  prova: [
    ...CHALLENGER_PROVA_BASE,
    questao("Como fica o reframe numa ligação fria?",
      ["Os seis passos completos", "Comprimido em uma observação sobre o setor e uma consequência não calculada", "Substituído por apresentação do produto", "Não se aplica"], 1,
      "Não há espaço para os seis passos; cabe a versão de duas frases."),
    questao("Como criar tensão sem soar arrogante no telefone?",
      ["Afirmar com convicção sobre a empresa dele", "Atribuir a observação a um grupo e perguntar em vez de afirmar", "Falar mais alto", "Citar concorrentes pelo nome"], 1,
      "Sem expressão facial para suavizar, a atribuição ao grupo e a pergunta mantêm a conversa respeitosa."),
    questao("O cliente diz que não tem o problema. O que fazer?",
      ["Insistir que tem", "Encerrar imediatamente", "Perguntar se mediram ou é percepção", "Mudar de produto"], 2,
      "A resposta separa quem resolveu de quem não mediu — e quase ninguém mediu."),
    questao("Como propor a reunião ao fim de uma cold call?",
      ["Perguntar se ele quer marcar", "Propor dois horários específicos", "Pedir para ele sugerir", "Enviar link da agenda por e-mail"], 1,
      "Alternativa fechada converte mais que pergunta aberta."),
  ],
};

const CHALLENGER_SDR = {
  slug: "challenger-sdr",
  titulo: "Challenger para SDR",
  subtitulo: "Qualificar ensinando, em vez de interrogar",
  categoria: "SDR",
  nivel: "intermediario",
  professor: "RYCS Academy",
  funcao: "sdr",
  gratuito: true,
  preco: 0,
  descricao:
    "O SDR tradicional qualifica com uma lista de perguntas e soa como formulário. " +
    "Este curso aplica o método Challenger à qualificação: ensinar algo no meio da descoberta, " +
    "usar o reframe para separar quem tem o problema de quem só foi educado, e passar ao closer " +
    "uma reunião onde o cliente já mudou de ideia sobre algo.",
  requisitos: "Recomendado depois de 'SDR: da lista à reunião qualificada'.",
  modulos: [
    modulo("O método Challenger", "A base que os três cursos compartilham.", CHALLENGER_BASE),
    modulo("Qualificar ensinando", "O método aplicado à descoberta.", [
      aula("Por que a qualificação soa como interrogatório", 6,
        "A qualificação clássica é uma lista: tem orçamento? quem decide? qual o prazo? Cada pergunta serve ao vendedor e nenhuma serve ao cliente — e ele sente isso.\n\n" +
        "O resultado é o cliente respondendo por educação, dando as respostas que encerram a ligação mais rápido. Você qualifica com dado falso e marca reunião que não existe.\n\n" +
        "A alternativa Challenger: cada pergunta vem depois de algo que você ensinou, e por isso a resposta vale.\n\n" +
        "**Aplique hoje:** conte quantas perguntas você faz antes de entregar qualquer informação útil."),
      aula("Ensinar para qualificar melhor", 7,
        "Sequência que funciona: **informação → pergunta**, nunca pergunta solta.\n\n" +
        "Em vez de \"quantas reuniões vocês fazem por mês?\", faça:\n\n" +
        "> \"A gente vê que distribuidoras desse porte costumam fazer umas trinta reuniões por mês e fechar cinco. O que puxa o número para baixo quase sempre é o no-show, não a conversão. Como está isso aí?\"\n\n" +
        "A pergunta é a mesma. O que mudou é que agora o cliente tem uma referência, sabe que você conhece o setor, e a resposta dele vem com contexto em vez de número inventado.\n\n" +
        "**Aplique hoje:** reescreva suas três perguntas de qualificação nesse formato."),
      aula("O reframe como filtro de qualificação", 7,
        "O reframe não serve só para convencer — serve para **filtrar**. Quem tem o problema reage; quem não tem, não reage.\n\n" +
        "Quando você apresenta a causa real de um problema e o cliente responde \"nossa, é exatamente isso\", você qualificou. Quando ele responde \"interessante\", você não qualificou nada.\n\n" +
        "\"Interessante\" é a palavra mais perigosa da prospecção: parece avanço e significa indiferença educada.\n\n" +
        "**Aplique hoje:** trate \"interessante\" como não. Peça um dado logo em seguida e veja se a pessoa gasta esforço."),
      aula("Passar uma reunião onde o cliente já mudou de ideia", 6,
        "A melhor passagem de bastão que um SDR entrega não é \"cliente interessado\". É:\n\n" +
        "> \"Ele achava que o problema era conversão. Quando mostrei que o no-show dele é de 40%, ele parou e disse que nunca tinha olhado. Pediu para trazer o gerente comercial na reunião.\"\n\n" +
        "O closer que recebe isso entra numa conversa que já começou. A reunião não é apresentação: é continuação.\n\n" +
        "Reunião em que o cliente já mudou de ideia sobre algo converte várias vezes mais que reunião de cliente curioso.\n\n" +
        "**Aplique hoje:** registre, em toda passagem, qual foi a ideia que mudou na cabeça do cliente. Se nenhuma mudou, a reunião é fraca."),
  ]),
  ],
  prova: [
    ...CHALLENGER_PROVA_BASE,
    questao("Por que a qualificação clássica soa como interrogatório?",
      ["Porque são muitas perguntas", "Porque cada pergunta serve ao vendedor e nenhuma ao cliente", "Porque é feita por telefone", "Porque o cliente tem pressa"], 1,
      "O cliente sente e responde por educação, dando o dado que encerra a ligação mais rápido."),
    questao("Qual é a sequência do Challenger aplicada à qualificação?",
      ["Pergunta, depois informação", "Informação, depois pergunta", "Só perguntas", "Só informação"], 1,
      "A informação dá referência ao cliente e faz a resposta dele valer alguma coisa."),
    questao("O cliente responde 'interessante' ao seu reframe. O que isso significa?",
      ["Que ele está qualificado", "Que é indiferença educada e não qualificou nada", "Que precisa de mais informação", "Que o preço é o problema"], 1,
      "'Interessante' parece avanço e significa indiferença. Quem tem o problema reage de outro jeito."),
    questao("Qual é a melhor passagem de bastão para o closer?",
      ["Cliente interessado, ligar amanhã", "Qual ideia mudou na cabeça do cliente durante a conversa", "Nome, telefone e e-mail", "O orçamento estimado"], 1,
      "Reunião em que o cliente já mudou de ideia sobre algo converte muito mais que reunião de curioso."),
  ],
};

// -------------------------------------------------------------------------
// Curso de boas-vindas: como a RYCS funciona, passo a passo.
//
// É o primeiro curso que todo profissional deveria fazer. Não ensina técnica
// de venda: ensina a plataforma — o caminho do cadastro ao primeiro pagamento,
// quais são as telas, o que cada ação gera e por que a evidência auditada é o
// que faz a empresa pagar por resultado sem conhecer você. Segue a jornada
// real: Painel, Oportunidades, Academy, Carteira, Indicar, Perfil.
// -------------------------------------------------------------------------

const PLATAFORMA = {
  slug: "como-a-rycs-funciona",
  titulo: "Como a RYCS funciona, passo a passo",
  subtitulo: "Do cadastro ao primeiro pagamento, tela por tela",
  categoria: "Plataforma RYCS",
  nivel: "fundamentos",
  professor: "RYCS Academy",
  funcao: "",
  gratuito: true,
  preco: 0,
  descricao:
    "Antes de prospectar qualquer cliente, entenda onde você está. Este curso percorre a " +
    "plataforma inteira do ponto de vista do profissional: o que é a RYCS, como o dinheiro " +
    "chega até você, como entrar e ser aprovado, como encontrar campanhas, como registrar e " +
    "comprovar o seu trabalho, como receber e como crescer de nível. Ao final você faz a prova " +
    "e, com 70% ou mais, recebe o certificado de reconhecimento da plataforma.",
  requisitos: "Nenhum. É o ponto de partida para quem acabou de chegar à RYCS.",
  modulos: [
    modulo("O que é a RYCS", "O modelo, os papéis e como o dinheiro chega até você.", [
      aula("A RYCS fica no meio, de propósito", 5,
        "A RYCS conecta dois lados: a **empresa**, que precisa de resultado comercial, e o **profissional**, que faz esse trabalho. Entre os dois fica a plataforma — e ela fica no meio de propósito.\n\n" +
        "Você não negocia preço com a empresa, não corre atrás de pagamento e não depende de conhecer ninguém lá dentro. A empresa também não escolhe você pela sua cara: escolhe pela sua evidência de trabalho e pelo seu histórico. A RYCS intermedia tudo — treinamento, distribuição de campanhas, auditoria e pagamento.\n\n" +
        "Isso protege os dois lados. A empresa paga por resultado comprovado; você trabalha sabendo que o combinado está registrado na plataforma, não num acordo de boca.\n\n" +
        "**Guarde isto:** a empresa compra resultado, não horas. Quem organiza esse resultado em algo pagável é a plataforma."),
      aula("Os papéis: empresa, profissional e RYCS", 5,
        "Três papéis se encontram na plataforma:\n\n" +
        "- **Empresa** — cria campanhas com um produto, um público-alvo, um treinamento e valores por atividade. Ela quer gente vendendo para ela sem montar um time fixo.\n" +
        "- **Profissional (você)** — se cadastra, é avaliado, entra em campanhas e executa o trabalho comercial. Pode atuar como SDR, BDR, Closer ou PAP (porta a porta).\n" +
        "- **RYCS** — a plataforma que recruta, treina, distribui, audita e paga.\n\n" +
        "Empresa e profissional não conversam direto. Todo o fluxo passa pela plataforma, e é isso que torna possível uma empresa confiar em alguém que nunca viu.\n\n" +
        "**Aplique hoje:** decida em qual papel você quer começar. A RYCS te mede por função, então começar com foco rende mais que tentar tudo ao mesmo tempo."),
      aula("Como o dinheiro chega até você", 6,
        "O caminho do dinheiro é simples de entender e importante de confiar:\n\n" +
        "1. A empresa define quanto vale cada atividade da campanha — por exemplo, um valor por conversa conectada, outro por reunião agendada, outro por reunião realizada e um percentual por venda. Esses valores quem fixa é a empresa, não você.\n" +
        "2. Você executa a atividade e registra a evidência na plataforma.\n" +
        "3. A RYCS audita a evidência.\n" +
        "4. Aprovada, a atividade vira saldo na sua **Carteira**.\n" +
        "5. Você saca o saldo liberado.\n\n" +
        "A RYCS faz a ponte financeira entre empresa e profissional (split), então você recebe da plataforma, não da empresa diretamente.\n\n" +
        "**Guarde isto:** nenhuma atividade vira dinheiro antes de ser comprovada e auditada. A evidência é a moeda.\n\n" +
        "[[demo:ciclo]]", "interativo"),
      aula("As telas que você vai usar", 5,
        "O menu do profissional tem seis lugares, e cada um tem uma função clara:\n\n" +
        "- **Painel** — sua visão geral: score, atividade recente, para onde ir.\n" +
        "- **Oportunidades** — as empresas e campanhas disponíveis para você.\n" +
        "- **Academy** — os cursos e certificações, inclusive este.\n" +
        "- **Carteira** — seu saldo, o que está liberado e o saque.\n" +
        "- **Indicar** — convidar outros profissionais e ganhar por isso.\n" +
        "- **Perfil** — seu score por função, seu nível e o que a empresa vê de você.\n\n" +
        "No menu da conta ficam ainda **Minha Conta** e **Configurações**.\n\n" +
        "**Aplique hoje:** abra cada uma das seis telas uma vez. Só de reconhecer onde fica cada coisa, o resto do curso fica mais fácil.\n\n" +
        "[[demo:menu]]", "interativo"),
    ]),

    modulo("Entrar e ser aprovado", "Cadastro, onboarding, avaliação e perfil.", [
      aula("Cadastro e onboarding", 5,
        "Ao entrar na RYCS você passa por um onboarding guiado. Ele é curto e serve para a plataforma entender quem você é: dados, função que pretende exercer e o básico de como você trabalha.\n\n" +
        "O onboarding é salvo no servidor e pode ser retomado — se você sair no meio, volta de onde parou. Não dá para pular etapa pela URL: cada passo libera o próximo.\n\n" +
        "Não é uma formalidade. O que você preenche aqui alimenta a forma como as empresas vão te enxergar depois.\n\n" +
        "**Aplique hoje:** termine o onboarding com calma e honestidade. Informação torta aqui vira campanha errada lá na frente."),
      aula("A triagem: por que você é avaliado", 6,
        "Depois do cadastro vem a **triagem** — a avaliação inicial. A plataforma não libera campanha para qualquer um: ela confere se você está pronto para representar uma empresa.\n\n" +
        "Enquanto você está em triagem, as telas de trabalho ficam bloqueadas e a plataforma te direciona para a avaliação. Isso não é punição: é o que faz valer o seu certificado e o que faz a empresa confiar em quem a RYCS envia.\n\n" +
        "Se a avaliação não passar de primeira, você pode estudar na Academy e refazer. O caminho está sempre aberto.\n\n" +
        "**Aplique hoje:** encare a triagem como a primeira impressão que a plataforma tem de você. Se precisar, estude antes de tentar."),
      aula("Seu Perfil é o seu currículo na RYCS", 5,
        "O **Perfil** é o que a empresa vê — não o seu nome na agenda dela, mas o seu histórico na plataforma: função, score por função, nível e certificações.\n\n" +
        "Você não precisa se vender para cada empresa. O perfil faz isso por você, com base no que você já comprovou. Quanto mais consistente o seu trabalho, mais forte o perfil, e mais no topo da fila você fica.\n\n" +
        "**Aplique hoje:** abra o seu Perfil e veja o que já aparece. É assim que a empresa te vê hoje.\n\n" +
        "[[ir:perfil|Abrir meu Perfil]]", "interativo"),
    ]),

    modulo("Encontrar trabalho", "Oportunidades, treinamento da empresa e certificação.", [
      aula("Oportunidades: onde o trabalho aparece", 5,
        "A tela **Oportunidades** lista as empresas e campanhas disponíveis para o seu perfil. Cada campanha diz o que a empresa vende, para quem, o que espera de você e quanto paga por atividade.\n\n" +
        "Não é uma lista fixa igual para todo mundo: ela leva em conta a sua função e o seu histórico. Ler a campanha inteira antes de aplicar evita entrar em algo que não combina com você.\n\n" +
        "**Aplique hoje:** abra uma campanha e localize três coisas: o público-alvo, o que conta como atividade paga e o valor de cada uma.\n\n" +
        "[[ir:oportunidades|Abrir Oportunidades]]", "interativo"),
      aula("Treinamento e certificação da empresa", 6,
        "Ao abrir uma empresa em que você ainda não foi aprovado, a plataforma mostra o **treinamento** daquela empresa antes de liberar as campanhas. Faz sentido: cada empresa tem produto, público e argumentos próprios, e você precisa dominá-los para representá-la.\n\n" +
        "Algumas campanhas exigem **certificação** — você estuda, faz a prova e só então é liberado. É o mesmo princípio da Academy: o selo é conquistado, não comprado.\n\n" +
        "Depois de aprovado naquela empresa, a tela passa a mostrar as campanhas direto, sem repetir o treinamento.\n\n" +
        "**Aplique hoje:** se uma campanha pede certificação, faça o curso ligado a ela antes de tentar aplicar. O atalho é estudar, não forçar."),
      aula("Aplicar e ser aprovado na campanha", 5,
        "Aprovado no treinamento, você aplica para a campanha. A partir daí ela aparece como sua, e a página da campanha passa a ser o seu posto de trabalho: é de lá que você registra cada atividade.\n\n" +
        "Estar aprovado numa empresa não te prende a ela. Você pode atuar em várias campanhas, de empresas diferentes, respeitando o que cada uma exige.\n\n" +
        "**Aplique hoje:** depois de aprovado, abra a página da campanha e encontre onde se registra uma atividade. É ali que o seu trabalho vira evidência."),
    ]),

    modulo("Trabalhar e comprovar", "Registrar atividades, evidência e auditoria.", [
      aula("Toda atividade vira evidência", 6,
        "Na RYCS, trabalhar e comprovar são a mesma ação. Cada conversa, reunião agendada, reunião realizada ou venda que você registra precisa vir com a prova daquilo: o contato, o que aconteceu, o combinado.\n\n" +
        "Não é controle por desconfiança. É o que permite a empresa pagar por resultado sem acompanhar você em tempo real. A evidência é o que transforma esforço em algo pagável.\n\n" +
        "**Aplique hoje:** antes de registrar qualquer atividade, pergunte-se: eu conseguiria comprovar isto se a plataforma perguntasse? Se não, ajuste antes de registrar.\n\n" +
        "[[demo:evidencia]]", "interativo"),
      aula("Como a auditoria funciona", 6,
        "Toda evidência registrada passa por auditoria — boa parte com apoio de IA, em volume. A auditoria confere se a atividade é real, se não está duplicada e se bate com o que a campanha pede.\n\n" +
        "Dado inventado, evidência reciclada e contato repetido entre profissionais são detectados. Uma recusa não só derruba aquela atividade: derruba o seu score, e o score é o que te coloca na frente das empresas.\n\n" +
        "O lado bom: evidência consistente acelera a sua liberação e levanta o seu score com o tempo.\n\n" +
        "**Guarde isto:** não vale o risco de forçar. Um registro falso custa mais caro que dez registros honestos valem."),
      aula("Contato duplicado e o trabalho em equipe", 5,
        "Numa mesma campanha, vários profissionais podem estar prospectando ao mesmo tempo. Trabalhar o mesmo contato que outra pessoa já pegou queima a evidência dos dois — a auditoria detecta a duplicidade.\n\n" +
        "Por isso a higiene de lista importa: antes de abordar, confirme que aquele contato é seu para trabalhar dentro das regras da campanha.\n\n" +
        "**Aplique hoje:** ao montar seu dia, separe contatos que claramente são seus para trabalhar. Qualidade de lista evita retrabalho e recusa."),
    ]),

    modulo("Receber e crescer", "Carteira, saque, score, níveis e indicações.", [
      aula("Carteira: saldo, liberação e saque", 6,
        "A **Carteira** é onde o seu trabalho vira dinheiro visível. Cada atividade aprovada soma saldo. Parte dele fica liberada para saque conforme as regras da plataforma e da campanha.\n\n" +
        "Você saca o saldo liberado pela própria Carteira. Como a RYCS intermedia o pagamento (split), você recebe da plataforma, com histórico de cada valor e de onde ele veio.\n\n" +
        "**Aplique hoje:** abra a Carteira e identifique a diferença entre saldo total, saldo liberado e o que já foi sacado. Entender isso evita ansiedade sobre quando o dinheiro chega.\n\n" +
        "[[demo:carteira]]\n\n[[ir:carteira|Abrir a Carteira]]", "interativo"),
      aula("O RYCS Score e por que ele decide tudo", 6,
        "O **RYCS Score** é a sua reputação medida pela plataforma. Ele não é uma nota única: combina dimensões como desempenho, conhecimento, comunicação, confiabilidade, conversão, qualidade e consistência.\n\n" +
        "O score é **por função** — o seu desempenho como SDR não se mistura com o de Closer — e o que é recente pesa mais que o que é antigo. Score bom te coloca no topo da fila das empresas; score ruim te tira dela.\n\n" +
        "**Aplique hoje:** veja no seu Perfil quais dimensões do score estão mais fracas. É nelas que uma semana de atenção rende mais pontos.\n\n" +
        "[[demo:score]]", "interativo"),
      aula("Níveis e certificações", 5,
        "Conforme você acumula trabalho comprovado, boas avaliações e treinamento, você sobe de **nível** na plataforma. Nível mais alto significa mais acesso e mais confiança das empresas.\n\n" +
        "A **Academy** é parte desse crescimento: cada curso concluído e certificado fortalece o seu perfil, e alguns certificados liberam campanhas que exigem certificação. O selo é conquistado com curso e prova — nunca comprado.\n\n" +
        "**Aplique hoje:** escolha o próximo curso da Academy ligado à sua função. Terminar este é o primeiro passo; o segundo é o da sua especialidade."),
      aula("Indicar: crescer trazendo gente boa", 4,
        "A tela **Indicar** te deixa convidar outros profissionais para a RYCS. Quando alguém entra pela sua indicação e trabalha, você é reconhecido por isso.\n\n" +
        "É uma forma honesta de crescer: você ganha trazendo gente que realmente trabalha, não números vazios. Indicação de quem sustenta boa evidência vale muito mais do que volume.\n\n" +
        "**Aplique hoje:** pense em uma pessoa que você sabe que seria um bom profissional na plataforma. Essa é a indicação que vale a pena fazer.\n\n" +
        "[[ir:indicar|Abrir Indicar]]", "interativo"),
      aula("O ciclo completo, do zero ao pagamento", 5,
        "Juntando tudo, a sua jornada na RYCS é um ciclo que se repete e melhora:\n\n" +
        "1. **Cadastro e onboarding** — a plataforma te conhece.\n" +
        "2. **Triagem** — você é avaliado e liberado.\n" +
        "3. **Oportunidades** — você encontra empresas e campanhas.\n" +
        "4. **Treinamento e certificação** — você fica apto para a empresa.\n" +
        "5. **Trabalho com evidência** — você executa e comprova.\n" +
        "6. **Auditoria** — a plataforma valida.\n" +
        "7. **Carteira e saque** — a evidência vira dinheiro.\n" +
        "8. **Score e níveis** — o histórico te coloca na frente da próxima campanha.\n\n" +
        "Cada volta deixa o seu perfil mais forte e o próximo trabalho mais fácil de conseguir.\n\n" +
        "**Guarde isto:** a plataforma recompensa consistência. Quem comprova bem e com constância sobe; quem força atalho, cai.\n\n" +
        "[[demo:ciclo]]", "interativo"),
    ]),
  ],
  prova: [
    questao("Qual é o papel da RYCS entre a empresa e o profissional?",
      ["Ela só divulga vagas e sai do caminho", "Ela intermedia tudo: treinamento, distribuição, auditoria e pagamento", "Ela deixa empresa e profissional negociarem direto", "Ela apenas processa o pagamento no fim"], 1,
      "A RYCS fica no meio de propósito: é ela que recruta, treina, distribui campanhas, audita e paga."),
    questao("Quando uma atividade registrada vira dinheiro na sua Carteira?",
      ["Assim que você registra", "Quando a empresa te liga", "Depois de ser comprovada e auditada", "No fim do mês, automaticamente"], 2,
      "Nenhuma atividade vira saldo antes de ser comprovada e passar pela auditoria. A evidência é a moeda."),
    questao("O que acontece enquanto você está em triagem?",
      ["Você já pode aplicar para qualquer campanha", "As telas de trabalho ficam bloqueadas e a plataforma te leva para a avaliação", "Seu perfil fica invisível para sempre", "Você recebe um adiantamento"], 1,
      "A triagem avalia se você está pronto para representar uma empresa; até passar, o trabalho fica bloqueado."),
    questao("Para que serve o treinamento que aparece ao abrir uma empresa nova?",
      ["É opcional e pode ser pulado pela URL", "Prepara você no produto e no público daquela empresa antes de liberar as campanhas", "Serve só para a empresa, não para você", "É o mesmo para todas as empresas"], 1,
      "Cada empresa tem produto e público próprios; o treinamento te deixa apto a representá-la, e algumas campanhas ainda exigem certificação."),
    questao("Por que registrar evidência de cada atividade?",
      ["Para a plataforma te vigiar", "Porque é o que permite a empresa pagar por resultado sem acompanhar você em tempo real", "Porque a empresa exige ligar para cada cliente", "Não é obrigatório"], 1,
      "A evidência transforma esforço em algo pagável e auditável — é o que sustenta o modelo."),
    questao("O que a auditoria detecta e penaliza?",
      ["Apenas erros de digitação", "Dado inventado, evidência reciclada e contato duplicado entre profissionais", "Somente atrasos", "Nada, ela só confirma"], 1,
      "A auditoria, muitas vezes com IA, pega fraude e duplicidade. Uma recusa derruba a atividade e o seu score."),
    questao("O que caracteriza o RYCS Score?",
      ["Uma nota única e geral", "Várias dimensões, medido por função, com o recente pesando mais", "Só o número de reuniões marcadas", "Um valor que você compra com nível"], 1,
      "O score combina dimensões (desempenho, confiabilidade, conversão, qualidade...), é por função e dá mais peso ao recente."),
    questao("Onde você acompanha saldo, saldo liberado e saque?",
      ["No Painel", "Na Carteira", "No Perfil", "Em Oportunidades"], 1,
      "A Carteira é onde o trabalho comprovado vira dinheiro visível e de onde você saca o saldo liberado."),
    questao("Como se conquista um certificado da Academy?",
      ["Comprando o selo", "Fazendo o curso e passando na prova", "Pedindo para a empresa", "Automaticamente ao se cadastrar"], 1,
      "O selo é conquistado com curso e prova, nunca comprado, e alguns certificados liberam campanhas que o exigem."),
    questao("Qual é a ordem correta do ciclo na plataforma?",
      ["Carteira → triagem → cadastro → campanha", "Cadastro → triagem → oportunidades → trabalho com evidência → auditoria → carteira", "Campanha → pagamento → cadastro → score", "Oportunidades → saque → onboarding → prova"], 1,
      "A jornada vai do cadastro e triagem às oportunidades, ao trabalho comprovado, à auditoria e, enfim, à Carteira — e o histórico alimenta o próximo ciclo."),
  ],
};

export const CATALOGO_INICIAL = [PLATAFORMA, SDR, CHALLENGER_SDR, COLD_CALL, CHALLENGER_COLD, CHALLENGER_VIDEO, WHATSAPP];

// Estatísticas derivadas, usadas no card e na página do curso.
export function resumirCurso(curso) {
  const aulas = (curso.modulos || []).flatMap((m) => m.aulas || []);
  return {
    modulos: (curso.modulos || []).length,
    aulas: aulas.length,
    duracaoMin: aulas.reduce((n, a) => n + (Number(a.duracaoMin) || 0), 0),
    questoes: (curso.prova || []).length,
  };
}

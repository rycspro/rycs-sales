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

const aula = (titulo, duracaoMin, conteudo) => ({ titulo, duracaoMin, conteudo, tipo: "texto" });
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

export const CATALOGO_INICIAL = [SDR, COLD_CALL, WHATSAPP];

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

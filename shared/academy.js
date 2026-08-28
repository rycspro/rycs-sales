// RYCS Academy — trilhas de formação por função.
//
// Cada trilha tem módulos de conteúdo e uma prova. Aprovado, o profissional
// ganha a certificação daquela função, que aparece como selo no perfil e
// libera candidatura em campanhas que exigem certificação.

export const NOTA_APROVACAO = 70; // % de acerto para certificar

// Níveis do selo. O nível sobe com desempenho na prova e ações aprovadas em
// campo — certificar é a porta de entrada, não o teto.
export const NIVEIS = {
  certified: { nome: "Certified", cor: "#2563EB", minAcoes: 0, minScore: 0 },
  pro: { nome: "Pro", cor: "#7C3AED", minAcoes: 25, minScore: 70 },
  elite: { nome: "Elite", cor: "#B45309", minAcoes: 100, minScore: 85 },
};

export const ORDEM_NIVEIS = ["certified", "pro", "elite"];

export function nivelDoSelo(acoesAprovadas, score) {
  if (acoesAprovadas >= NIVEIS.elite.minAcoes && score >= NIVEIS.elite.minScore) return "elite";
  if (acoesAprovadas >= NIVEIS.pro.minAcoes && score >= NIVEIS.pro.minScore) return "pro";
  return "certified";
}

const t = (titulo, min, conteudo) => ({ titulo, min, conteudo });
const q = (pergunta, alternativas, correta) => ({ pergunta, alternativas, correta });

export const TRILHAS = {
  sdr: {
    funcao: "sdr",
    titulo: "Fundamentos de SDR",
    resumo: "Qualificação, cadência e agendamento com quem decide.",
    modulos: [
      t("O papel do SDR", 5, "O SDR não vende: ele compra tempo do closer. Sua entrega é uma reunião com a pessoa certa, no problema certo. Reunião com quem não decide é retrabalho, não resultado."),
      t("Qualificação antes do agendamento", 7, "Antes de marcar, confirme três coisas: existe um problema reconhecido, existe orçamento ou caminho para ele, e a pessoa na linha participa da decisão. Faltando qualquer uma, a reunião provavelmente não acontece."),
      t("Cadência que funciona", 6, "Um contato não é uma tentativa. Cadência é sequência: ligação, mensagem, e-mail, variando horário ao longo de dias. A maior parte das respostas vem entre a terceira e a sexta tentativa — quem para na segunda perde justamente onde estava o resultado."),
      t("Abrindo pelo problema", 6, "Abra pelo prejuízo que a pessoa já vive, nunca pela funcionalidade. 'Quantos pedidos você perdeu esse mês por falta de follow?' abre conversa. 'Nosso CRM tem integração com WhatsApp' fecha."),
      t("Registrando a ação corretamente", 4, "Toda ação precisa de prova: nome do cliente, telefone, e o vídeo ou gravação. Prova incompleta é recusada pela auditoria, e recusa derruba seu score."),
    ],
    prova: [
      q("O cliente diz 'me manda por e-mail que eu vejo depois'. Qual a melhor resposta?",
        ["Mandar o e-mail e aguardar retorno", "Perguntar o que precisa estar no e-mail e propor 15 minutos ainda na semana", "Insistir para falar naquele momento", "Registrar como perdido"], 1),
      q("Quantas tentativas, em média, antes de considerar um contato perdido?",
        ["1 ou 2", "3 a 5", "6 ou mais, variando canal e horário", "Apenas 1, para não incomodar"], 2),
      q("O que precisa estar confirmado antes de agendar?",
        ["Só o interesse da pessoa", "Problema reconhecido, caminho para orçamento e participação na decisão", "Apenas o horário disponível", "O preço aceito"], 1),
      q("Por onde abrir a primeira conversa?",
        ["Pelo preço, para filtrar rápido", "Pelas funcionalidades do produto", "Pelo problema que o cliente vive hoje", "Pela história da empresa"], 2),
      q("Uma reunião agendada com alguém que não participa da decisão:",
        ["Conta normalmente, o volume importa", "É retrabalho e tende a não acontecer", "Deve ser registrada como venda", "Vale mais que uma reunião com o decisor"], 1),
      q("O que torna uma ação auditável?",
        ["O relato do vendedor", "Dados do cliente mais vídeo ou gravação comprovando", "Apenas o horário", "A confirmação verbal do closer"], 1),
    ],
  },

  bdr: {
    funcao: "bdr",
    titulo: "Fundamentos de BDR",
    resumo: "Prospecção fria, construção de lista e abertura de mercado.",
    modulos: [
      t("BDR não é SDR", 5, "O SDR trabalha demanda que já existe. O BDR cria demanda onde não havia: lista fria, contato que nunca ouviu falar da empresa. A taxa de resposta é menor por natureza — o que sustenta o resultado é volume qualificado e consistência."),
      t("Construindo a lista certa", 7, "Lista ruim derruba qualquer discurso. Defina o perfil por sinais observáveis: porte, setor, região, sinal de dor. Uma lista de 50 contas certas rende mais que 500 aleatórias."),
      t("Primeira frase em contato frio", 6, "Você tem poucos segundos. Diga quem você é, por que está ligando para aquela empresa especificamente, e faça uma pergunta que a pessoa saiba responder. Genérico é desligado na hora."),
      t("Lidando com a rejeição", 5, "Em contato frio, a maioria diz não — e isso é o esperado, não fracasso. O erro é levar para o pessoal e reduzir o volume no dia seguinte. Consistência diária vale mais que um dia excepcional."),
      t("Passando o bastão", 5, "Sua entrega termina numa reunião aceita pelo closer, com contexto registrado. Reunião sem contexto obriga o closer a começar do zero e queima a oportunidade."),
    ],
    prova: [
      q("A diferença central entre BDR e SDR é:",
        ["O BDR trabalha demanda existente", "O BDR cria demanda em contas frias", "Não há diferença prática", "O BDR só fecha contratos"], 1),
      q("O que mais compromete uma operação de prospecção fria?",
        ["O horário das ligações", "A qualidade da lista", "O nome do produto", "O tamanho da equipe"], 1),
      q("Numa abertura fria, o que funciona melhor?",
        ["Um discurso genérico e rápido", "Dizer por que está ligando para aquela empresa especificamente", "Começar pelo preço", "Perguntar se tem cinco minutos"], 1),
      q("Receber muitos 'não' em contato frio significa:",
        ["Que a abordagem está errada por definição", "Que é o comportamento esperado do canal", "Que a lista deve ser descartada", "Que a função não serve para você"], 1),
      q("Uma reunião passada ao closer deve incluir:",
        ["Apenas data e hora", "O contexto e a dor levantada", "Somente o telefone", "O valor do contrato já negociado"], 1),
    ],
  },

  closer: {
    funcao: "closer",
    titulo: "Fundamentos de Closer",
    resumo: "Condução da reunião, objeções e fechamento.",
    modulos: [
      t("A reunião tem estrutura", 6, "Abertura, diagnóstico, proposta, próximo passo. Pular o diagnóstico para apresentar mais cedo é o erro mais comum: você passa a defender um preço sem ter estabelecido valor."),
      t("Diagnóstico antes da proposta", 7, "Pergunte sobre o processo atual, o custo do problema e o que já tentaram. O cliente precisa dizer em voz alta quanto aquilo custa. Valor que você afirma é argumento; valor que ele calcula é conclusão."),
      t("Objeções são pedidos de informação", 7, "'Está caro' quase nunca é sobre preço — é falta de valor estabelecido. Compare com o custo do problema que ele mesmo quantificou. 'Vou pensar' costuma esconder uma dúvida não dita: pergunte qual é."),
      t("Fechando com próximo passo concreto", 6, "Toda reunião termina com data, responsável e ação definidos. 'Entro em contato' não é próximo passo. Sem isso, a negociação esfria e você perde para a inércia, não para o concorrente."),
      t("Registrando a venda", 4, "Venda exige contrato assinado ou primeiro pagamento confirmado. Anexe o documento e o vídeo do fechamento — proposta enviada não é venda."),
    ],
    prova: [
      q("A ordem correta de uma reunião de vendas é:",
        ["Proposta, diagnóstico, abertura", "Abertura, diagnóstico, proposta, próximo passo", "Preço primeiro, depois diagnóstico", "Apresentação do produto e fechamento"], 1),
      q("'Está caro' normalmente indica:",
        ["Que o preço realmente está alto", "Que falta valor estabelecido", "Que o cliente não tem dinheiro", "Que a negociação acabou"], 1),
      q("Por que o diagnóstico vem antes da proposta?",
        ["Para preencher tempo", "Para o cliente quantificar o custo do problema", "Porque é o padrão do mercado", "Para adiar o preço"], 1),
      q("O que caracteriza um próximo passo válido?",
        ["'Entro em contato em breve'", "Data, responsável e ação definidos", "O cliente prometer pensar", "O envio da proposta"], 1),
      q("Uma venda pode ser registrada quando:",
        ["A proposta foi enviada", "O cliente disse que vai fechar", "Há contrato assinado ou pagamento confirmado", "A reunião foi positiva"], 2),
      q("'Vou pensar' geralmente esconde:",
        ["Desinteresse total", "Uma dúvida não dita", "Falta de tempo", "Problema de agenda"], 1),
    ],
  },

  pap: {
    funcao: "pap",
    titulo: "Fundamentos de Porta a Porta",
    resumo: "Abordagem presencial, leitura de contexto e segurança.",
    modulos: [
      t("Os primeiros dez segundos", 5, "Presencialmente a pessoa decide por postura antes do conteúdo. Apresente-se, diga de onde veio e por que está ali, sem invadir espaço. Crachá visível e distância respeitosa mudam a taxa de escuta."),
      t("Lendo o contexto antes de falar", 6, "Comércio em horário de pico não escuta ninguém. Observe movimento, disponibilidade e quem manda no lugar. Voltar num horário melhor rende mais que insistir na hora errada."),
      t("Falando com quem decide", 6, "No comércio, quem atende raramente decide. Pergunte pelo responsável de forma direta e cordial. Apresentação completa para quem não decide é tempo perdido duas vezes."),
      t("Segurança em campo", 5, "Trabalhe em horários de movimento, avise sua rota, e não insista diante de recusa firme ou hostilidade. Nenhuma comissão justifica risco pessoal."),
      t("Comprovando a ação em campo", 4, "Registre no local: nome do estabelecimento, responsável, e o vídeo curto da abordagem ou da confirmação. Memória não é prova."),
    ],
    prova: [
      q("Na abordagem presencial, o que pesa nos primeiros segundos?",
        ["O preço oferecido", "A postura e a apresentação", "O material impresso", "O tamanho da equipe"], 1),
      q("Abordar um comércio em horário de pico:",
        ["É ideal, há mais gente", "Tende a não ser escutado; melhor retornar", "Não faz diferença", "Garante falar com o dono"], 1),
      q("Quem atende no balcão normalmente:",
        ["É quem decide a compra", "Raramente é quem decide", "Sempre encaminha ao dono", "Decide junto com o dono"], 1),
      q("Diante de recusa firme ou hostilidade, o correto é:",
        ["Insistir até conseguir", "Encerrar de forma cordial e seguir", "Retornar no dia seguinte no mesmo horário", "Registrar como agendamento"], 1),
      q("A comprovação de uma ação em campo deve ser feita:",
        ["No fim do dia, de memória", "No local, com dados e vídeo", "Na semana seguinte", "Apenas se houver venda"], 1),
    ],
  },

  "sem-exp": {
    funcao: "sem-exp",
    titulo: "Primeiros passos em vendas",
    resumo: "O essencial para começar com o pé direito.",
    modulos: [
      t("Vender é resolver problema", 5, "Venda não é convencer alguém a comprar o que não precisa. É encontrar quem tem o problema que seu produto resolve e mostrar isso com clareza. Quem parte daí sustenta a carreira."),
      t("Escutar mais do que falar", 6, "Iniciante fala demais por insegurança. A regra prática: quem pergunta conduz. Faça perguntas abertas e deixe a pessoa explicar o problema com as palavras dela."),
      t("O básico da rotina", 5, "Resultado em vendas é consequência de constância, não de inspiração. Blocos fixos de prospecção no dia valem mais que esforço concentrado uma vez por semana."),
      t("Como funciona a RYCS", 6, "Você escolhe campanhas, executa ações, comprova com vídeo, e a auditoria libera o pagamento. Comprovação incompleta é recusada — e recusas derrubam seu score, que define seu acesso às melhores campanhas."),
    ],
    prova: [
      q("Vender, na prática, é:",
        ["Convencer qualquer pessoa a comprar", "Encontrar quem tem o problema que o produto resolve", "Oferecer o menor preço", "Insistir até o cliente ceder"], 1),
      q("Numa conversa de vendas, quem conduz é:",
        ["Quem fala mais", "Quem pergunta", "Quem apresenta primeiro", "Quem oferece desconto"], 1),
      q("O que mais sustenta resultado em vendas?",
        ["Inspiração pontual", "Constância na rotina", "Sorte com bons leads", "Trabalhar até tarde"], 1),
      q("Na RYCS, o pagamento é liberado quando:",
        ["A ação é registrada", "A auditoria aprova a comprovação", "O mês fecha", "A empresa gosta do vendedor"], 1),
    ],
  },
};

export const trilhaDaFuncao = (funcao) => TRILHAS[funcao] || TRILHAS["sem-exp"];

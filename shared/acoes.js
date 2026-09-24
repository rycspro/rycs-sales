export const CAMPOS = {
  // contato
  cliente:       { label: "Nome do contato", ph: "Ex.: Marcos — Padaria Vila Nova" },
  empresa:       { label: "Empresa do contato", ph: "Ex.: Padaria Vila Nova Ltda." },
  telefone:      { label: "Telefone / WhatsApp", ph: "(11) 9 9999-9999" },
  email:         { label: "E-mail do contato", ph: "contato@empresa.com.br" },
  cargo:         { label: "Cargo / papel", ph: "Ex.: CEO, Diretor Comercial" },
  cidade:        { label: "Cidade / região", ph: "Ex.: São Paulo, SP" },
  // ação
  canal:         { label: "Canal utilizado", ph: "WhatsApp, e-mail, ligação, presencial…" },
  duracao:       { label: "Duração (min)", ph: "Ex.: 6" },
  resultado:     { label: "Resultado da ação", ph: "Descreva o que ocorreu e o desfecho" },
  observacoes:   { label: "Observações", ph: "Informações adicionais relevantes" },
  // qualificação
  interesse:     { label: "Interesse identificado", ph: "O que o cliente quer resolver ou conquistar" },
  necessidade:   { label: "Necessidade / dor", ph: "Dor principal ou problema declarado" },
  fit:           { label: "Fit com o produto", ph: "O cliente tem perfil? Justifique" },
  objecoes:      { label: "Objeções levantadas", ph: "Ex.: orçamento, timing, concorrente" },
  proximo_passo: { label: "Próximo passo", ph: "O que foi combinado para avançar?" },
  // follow-up
  proximo_follow:{ label: "Próximo follow-up", ph: "Data ou prazo do próximo contato" },
  // reunião
  datahora:      { label: "Data e hora", ph: "22/08/2026 às 15h30" },
  modalidade:    { label: "Modalidade", ph: "Remota (Google Meet, Zoom…) ou Presencial" },
  link_reuniao:  { label: "Link / local da reunião", ph: "https://meet.google.com/xxx ou Endereço" },
  // visita
  endereco:      { label: "Endereço / local visitado", ph: "Rua, número, bairro, cidade" },
  // venda
  documento:     { label: "CNPJ ou CPF do cliente", ph: "00.000.000/0001-00" },
  valorContrato: { label: "Valor do contrato / pedido (R$)", ph: "Ex.: 4200" },
  produto:       { label: "Produto / serviço vendido", ph: "Ex.: Plano Growth anual" },
  // legado — mantidos para compatibilidade com submissions antigas
  contrato:      { label: "Link do contrato ou pagamento", ph: "https://..." },
  video:         { label: "Link do vídeo / gravação", ph: "Drive, YouTube não listado, Loom…" },
};

export const ACOES = {
  ligacao: {
    nome: "Cold call",
    regra: "Ligação atendida pelo decisor, acima de 2 minutos. Suba o vídeo ou a gravação da call.",
    prova: ["cliente", "telefone", "duracao", "video"],
  },
  contato: {
    nome: "Contato",
    regra: "Primeiro contato válido com o lead. Informe o contato, canal e evidência da abordagem.",
    prova: ["cliente", "telefone", "canal", "video"],
  },
  lead_qualificado: {
    nome: "Qualificação",
    regra: "Lead qualificado com dor, perfil e próximo passo registrados. Grave a evidência da qualificação.",
    prova: ["cliente", "telefone", "canal", "video"],
  },
  follow: {
    nome: "Follow-up",
    regra: "Retomada de contato com resposta do cliente. Grave a tela mostrando a conversa.",
    prova: ["cliente", "telefone", "canal", "video"],
  },
  agendamento: {
    nome: "Reunião agendada",
    regra: "Cliente confirmou dia e hora. Grave a tela com a confirmação do cliente.",
    prova: ["cliente", "telefone", "datahora", "video"],
  },
  realizada: {
    nome: "Reunião realizada",
    regra: "Reunião aconteceu do início ao fim. Suba a gravação completa.",
    prova: ["cliente", "telefone", "video"],
  },
  visita: {
    nome: "PAP/visita",
    regra: "Visita presencial ou porta a porta realizada. Envie evidência verificável da execução.",
    prova: ["cliente", "telefone", "video"],
  },
  venda: {
    nome: "Venda fechada",
    regra: "Contrato assinado ou primeiro pagamento confirmado. Anexe o contrato e o vídeo do fechamento.",
    prova: ["cliente", "documento", "valorContrato", "contrato", "video"],
  },
};

export const ORDEM_ACOES = ["contato", "lead_qualificado", "follow", "agendamento", "realizada", "visita", "ligacao", "venda"];

export const TAXA = 0.12;

export const SISTEMA_AUDITOR = `Você é o auditor automático da Sales Machine, um SaaS que paga vendedores freelancers por ação
comprovada (agendamento, call, follow-up, reunião realizada, venda). Você recebe os dados que o vendedor
preencheu para comprovar uma ação, incluindo o link de um vídeo que ele diz comprovar a execução.
Você NÃO tem acesso ao conteúdo do vídeo, apenas ao link e aos campos de texto. Sua função é uma triagem
de consistência e sinais de fraude, não uma confirmação definitiva:
- o link de vídeo foi realmente preenchido e tem formato de URL válido;
- os dados (nome do cliente, telefone, valores) parecem reais e específicos, não genéricos como "teste",
  "cliente 1", "aaaa", números repetidos ou claramente inválidos;
- os campos são coerentes entre si e com a regra da ação.
Responda SOMENTE em JSON, sem markdown, sem texto fora do JSON, no formato exato:
{"veredito":"aprovado"|"revisao"|"recusado","confianca":0-100,"motivo":"até 20 palavras, direto, em português"}
Use "aprovado" quando tudo é consistente e específico. Use "revisao" quando algo é plausível mas merece
um humano checar (ex.: primeira ação do vendedor, valor muito alto, dado incompleto). Use "recusado" só
quando há sinal claro de dado inventado, placeholder ou link de vídeo ausente/inválido.`;

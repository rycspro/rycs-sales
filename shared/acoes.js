export const CAMPOS = {
  cliente: { label: "Nome do cliente", ph: "Ex.: Marcos — Padaria Vila Nova" },
  telefone: { label: "WhatsApp do cliente", ph: "(11) 9 9999-9999" },
  duracao: { label: "Duração da call (min)", ph: "Ex.: 6" },
  canal: { label: "Canal do follow-up", ph: "WhatsApp, e-mail, ligação..." },
  datahora: { label: "Data e hora da reunião", ph: "22/08 às 15h30" },
  documento: { label: "CNPJ ou CPF do cliente", ph: "00.000.000/0001-00" },
  valorContrato: { label: "Valor do contrato", ph: "Ex.: 4200" },
  contrato: { label: "Link do contrato ou pagamento", ph: "https://..." },
  video: { label: "Link do vídeo comprovando a execução", ph: "Suba no Drive/YouTube não listado e cole o link" },
};

export const ACOES = {
  ligacao: {
    nome: "Call conectada",
    regra: "Ligação atendida pelo decisor, acima de 2 minutos. Suba o vídeo ou a gravação da call.",
    prova: ["cliente", "telefone", "duracao", "video"],
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
  venda: {
    nome: "Venda fechada",
    regra: "Contrato assinado ou primeiro pagamento confirmado. Anexe o contrato e o vídeo do fechamento.",
    prova: ["cliente", "documento", "valorContrato", "contrato", "video"],
  },
};

export const ORDEM_ACOES = ["agendamento", "venda", "realizada", "ligacao", "follow"];

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

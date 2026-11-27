// Configuração de confirmação de contato por link.
//
// Quando uma campanha exige confirmação do cliente, o profissional pode
// enviar um link exclusivo por WhatsApp, SMS ou e-mail. O cliente confirma
// ou não reconhece o contato sem precisar de cadastro na RYCS.

export const CANAIS_CONFIRMACAO = [
  { id: "whatsapp", nome: "WhatsApp", icone: "MessageCircle" },
  { id: "email", nome: "E-mail", icone: "Mail" },
  { id: "sms", nome: "SMS", icone: "Phone" },
];

export const STATUS_CONFIRMACAO = {
  nao_enviada: { id: "nao_enviada", nome: "Não enviada", cor: "#8496B4" },
  aguardando: { id: "aguardando", nome: "Aguardando confirmação", cor: "#3B82F6" },
  confirmada: { id: "confirmada", nome: "Confirmada", cor: "#16A34A" },
  nao_reconhecida: { id: "nao_reconhecida", nome: "Não reconhecida", cor: "#EF4444" },
  expirada: { id: "expirada", nome: "Expirada", cor: "#F59E0B" },
  pendente_revisao: { id: "pendente_revisao", nome: "Pendente de revisão", cor: "#8B5CF6" },
  falha_envio: { id: "falha_envio", nome: "Falha no envio", cor: "#DC2626" },
};

// Duração padrão do token (48h)
export const EXPIRACAO_PADRAO_HORAS = 48;

// Máximo de reenvios por atividade
export const MAX_REENVIOS = 3;

// Monta a mensagem de confirmação adaptada ao idioma
export function montarMensagemConfirmacao({ nomeCliente, nomeProfissional, nomeEmpresa, assunto, linkConfirmacao, idioma = "pt-BR" }) {
  if (idioma.startsWith("en")) {
    return `Hello, ${nomeCliente || "there"}!\n${nomeProfissional} mentioned they spoke with you on behalf of ${nomeEmpresa}${assunto ? ` about ${assunto}` : ""}.\nTo confirm this contact, please click the link below:\n${linkConfirmacao}\nIt's quick and no sign-up is needed.`;
  }
  if (idioma.startsWith("es")) {
    return `¡Hola, ${nomeCliente || ""}!\n${nomeProfissional} nos informó que conversó con usted representando a ${nomeEmpresa}${assunto ? ` sobre ${assunto}` : ""}.\nPara confirmar este contacto, acceda al siguiente enlace:\n${linkConfirmacao}\nLa confirmación es rápida y no requiere registro.`;
  }
  return `Olá, ${nomeCliente || ""}!\n${nomeProfissional} informou que conversou com você representando a empresa ${nomeEmpresa}${assunto ? ` sobre ${assunto}` : ""}.\nPara confirmar que esse contato aconteceu, acesse o link abaixo:\n${linkConfirmacao}\nA confirmação é rápida e não exige cadastro.`;
}

// Verifica se um canal está disponível
export function canalDisponivel(canal, integracoes = {}) {
  if (canal === "whatsapp") return !!integracoes.whatsapp;
  if (canal === "email") return !!integracoes.email || true; // e-mail sempre disponível via SMTP
  if (canal === "sms") return !!integracoes.sms;
  return false;
}

// Configuração padrão de confirmação de contato
export function configConfirmacaoPadrao() {
  return {
    habilitada: false,
    canais: ["whatsapp", "email"],
    expiracaoHoras: EXPIRACAO_PADRAO_HORAS,
    exigirIdentificacaoEmpresarial: false,
    paisIdentificacao: "BR",
  };
}

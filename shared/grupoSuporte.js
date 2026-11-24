// Grupo de suporte no WhatsApp que a empresa recebe depois de pagar o plano.

const LINK = /^https:\/\/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]{10,60})\/?(?:\?.*)?$/;

// Link de convite limpo (sem parâmetros), ou "" se não for um convite de grupo.
export function linkDeGrupo(valor) {
  const m = LINK.exec(String(valor || "").trim());
  return m ? `https://chat.whatsapp.com/${m[1]}` : "";
}

// Nome do grupo: até 128 caracteres (limite da Meta).
export const nomeDoGrupo = (empresa) => `RYCS + ${String(empresa || "").replace(/\s+/g, " ").trim() || "Cliente"}`.slice(0, 128);

// Modelo (Utilidade, pt_BR). O botão abre a página da RYCS com o botão do
// grupo, porque a Meta recusa botão apontando direto para chat.whatsapp.com.
export const MODELO_GRUPO = {
  nome: "rycs_grupo_suporte",
  idioma: "pt_BR",
  categoria: "UTILITY",
  corpo: "Olá, {{1}}! O pagamento do plano da {{2}} foi confirmado e o grupo de suporte da sua empresa na RYCS está pronto.\n\nÉ por ele que nossa equipe acompanha a sua operação e responde as suas dúvidas. Toque no botão para entrar.",
  exemplo: ["Ana", "Clínica Vida"],
  botao: { texto: "Entrar no grupo", url: "https://app.rycs.pro/{{1}}", exemplo: "https://app.rycs.pro/grupo-suporte/?t=exemplo" },
};

export const STATUS_GRUPO = {
  aguardando_link: "Falta o link do grupo",
  criando: "Criando o grupo na Meta",
  pronto: "Grupo pronto",
};
export const STATUS_ENVIO_GRUPO = {
  pendente: "Na fila",
  enviado: "Enviado no WhatsApp",
  aguardando_modelo: "Aguardando o modelo ser aprovado",
  sem_numero: "Empresa sem WhatsApp",
  pediu_para_sair: "Pediu para não receber",
  erro: "Falhou",
};

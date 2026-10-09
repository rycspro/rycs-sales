// Saque do profissional: o piso, num lugar só.
//
// Era duas constantes. O servidor exigia R$ 20, a tela dizia R$ 10 — e o
// comentário ao lado do número da tela afirmava que os dois eram iguais. Quem
// tinha R$ 15 na carteira via o botão liberado, preenchia o valor e levava
// "Valor mínimo: R$ 20,00" de volta, sem nada na tela que explicasse de onde
// saiu esse número.
//
// O piso existe porque cada Pix tem custo fixo: abaixo dele, a transferência
// come parte relevante do que o profissional recebe.
export const SAQUE_MINIMO = 10;

// O que fazer com o status que o gateway devolve ao criar a transferência.
//
// Antes esta resposta era descartada: o saque nascia "solicitado" e só mudava
// quando o webhook TRANSFER_DONE chegasse. Um Pix que o Asaas já tinha
// concluído aparecia como "Processando" na carteira — e, se o webhook falhasse
// ou não estivesse configurado, aparecia assim para sempre, sobre um dinheiro
// que já estava na conta do profissional.
//
// Status desconhecido espera o webhook de propósito. Chutar "pago" sobre um
// nome que não reconhecemos marcaria como entregue um Pix que não saiu.
const CONCLUIDO = ["DONE"];
const RECUSADO = ["FAILED", "CANCELLED"];

export function decidirSaque(statusGateway) {
  const s = String(statusGateway || "").trim().toUpperCase();
  if (CONCLUIDO.includes(s)) return "pago";
  if (RECUSADO.includes(s)) return "recusado";
  return "aguardando";
}

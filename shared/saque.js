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

// Resposta à validação automática de saque do Asaas.
//
// Aprova só a transferência que corresponde a um saque registrado aqui: mesmo
// valor, ainda vivo, e sem outra transferência já ligada a ele. Qualquer outra
// coisa — Pix feito com uma chave de API vazada, valor adulterado, segundo
// envio para o mesmo saque — é recusada, e o Asaas cancela a transferência.
const ENCERRADO = ["cancelado", "falhou"];

export function avaliarTransferencia(transfer, saque) {
  const recusar = (refuseReason) => ({ status: "REFUSED", refuseReason });
  if (!transfer?.id) return recusar("Transferência inválida");
  if (!saque) return recusar("Transferência sem saque correspondente na RYCS");
  if (ENCERRADO.includes(saque.status)) return recusar("Saque já encerrado na RYCS");
  if (saque.asaasId && saque.asaasId !== transfer.id) return recusar("Saque já tem outra transferência");
  if (Math.abs(Number(transfer.value) - Number(saque.valor)) > 0.005) return recusar("Valor diferente do saque solicitado");
  return { status: "APPROVED" };
}

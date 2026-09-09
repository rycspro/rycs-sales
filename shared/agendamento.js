const telefoneNormalizado = (valor) => String(valor || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

export function dadosAgendamentoCorrespondemAoLead(prova, lead) {
  if (!lead) return false;
  return String(prova?.cliente || "").trim().toLocaleLowerCase("pt-BR") === String(lead.nome || "").trim().toLocaleLowerCase("pt-BR")
    && telefoneNormalizado(prova?.telefone) === telefoneNormalizado(lead.telefone);
}

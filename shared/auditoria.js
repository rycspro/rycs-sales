// Política de auditoria de tarefas.
//
// Esta é a fonte única de verdade entre interface e servidor. Ela não tenta
// "provar" um evento externo com IA: define o que é obrigatório, o que exige
// revisão humana e o que o revisor precisa efetivamente conferir.

export const VERSAO_AUDITORIA = "interna-2026.09.1";

export const STATUS_AUDITORIA = {
  revisao: "revisao",
  conferido: "conferido",
  recusado: "recusado",
  liberado: "liberado",
  iaRecusado: "ia_recusado",
};

export const MOTIVOS_RECUSA = [
  { codigo: "evidencia_incompleta", label: "Evidência incompleta ou ilegível" },
  { codigo: "dados_inconsistentes", label: "Dados não conferem com a tarefa" },
  { codigo: "duplicidade", label: "Evidência ou contato já utilizado" },
  { codigo: "nao_confirmado", label: "Cliente não confirmou a ação" },
  { codigo: "fora_da_regra", label: "Ação fora da regra da campanha" },
  { codigo: "indicio_fraude", label: "Indício de fraude ou adulteração" },
  { codigo: "outro", label: "Outro motivo justificado" },
];

export const CHECKLIST_REVISAO = {
  ligacao: [
    { id: "identidade", label: "Cliente e contato conferem com o registro" },
    { id: "execucao", label: "A gravação ou evidência mostra uma ligação atendida" },
    { id: "duracao", label: "A duração atende ao mínimo definido na tarefa" },
  ],
  follow: [
    { id: "identidade", label: "Cliente e contato conferem com o registro" },
    { id: "resposta", label: "Há resposta ou continuidade real do cliente" },
    { id: "canal", label: "O canal declarado corresponde à evidência" },
  ],
  agendamento: [
    { id: "identidade", label: "Cliente e contato conferem com o registro" },
    { id: "confirmacao", label: "O cliente confirmou data e horário" },
    { id: "datahora", label: "Data e horário estão legíveis e são plausíveis" },
  ],
  realizada: [
    { id: "identidade", label: "Cliente e contato conferem com o registro" },
    { id: "presenca", label: "A evidência demonstra que a reunião ocorreu" },
    { id: "completude", label: "A prova cobre a interação, não apenas um convite" },
  ],
  venda: [
    { id: "identidade", label: "Cliente e documento conferem com o contrato" },
    { id: "contrato", label: "Contrato ou comprovante está legível e vinculado ao cliente" },
    { id: "valor", label: "Valor declarado confere com a evidência" },
    { id: "fechamento", label: "A evidência demonstra assinatura ou pagamento" },
  ],
};

// Prova manual nunca é suficiente para pagamento automático. Mesmo um envio
// estruturalmente perfeito precisa de confirmação registrada por um revisor.
export const POLITICA_POR_ACAO = Object.fromEntries(
  Object.keys(CHECKLIST_REVISAO).map((tipo) => [tipo, {
    exigeRevisaoHumana: true,
    exigeSegundaRevisaoAcimaDe: 1000,
    maximoPorContatoEm24h: 2,
  }])
);

export function checklistDoTipo(tipo) {
  return CHECKLIST_REVISAO[tipo] || [];
}

export function idsChecklistDoTipo(tipo) {
  return checklistDoTipo(tipo).map((item) => item.id);
}

export function motivoRecusaValido(codigo) {
  return MOTIVOS_RECUSA.some((motivo) => motivo.codigo === codigo);
}

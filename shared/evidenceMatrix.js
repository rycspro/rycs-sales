// Matriz de evidências por tipo de tarefa.
// A campanha pode sobrescrever minEvidence, required e optional via modelosVerificacao.
// Esta configuração é a referência padrão do sistema.

export const EVIDENCE_SLOTS = {
  contact_proof:           { label: "Comprovação do contato", ph: "Link (print, print da conversa, etc.)", isUrl: true },
  qualification_summary:   { label: "Resumo da qualificação", ph: "Interesse, necessidade, fit, objeções e próximo passo", isText: true },
  follow_proof:            { label: "Evidência do follow-up", ph: "Link da conversa, print ou registro da chamada", isUrl: true },
  scheduling_confirmation: { label: "Confirmação do agendamento", ph: "Link do print com a confirmação do cliente", isUrl: true },
  meeting_data:            { label: "Dados da reunião", ph: "Contato · empresa · data · hora · modalidade · link/local", isText: true },
  video_or_recording:      { label: "Vídeo ou gravação da reunião", ph: "Link do Drive, YouTube não listado, Loom, etc.", isUrl: true },
  meeting_summary:         { label: "Resumo estruturado da reunião", ph: "Participante, empresa, duração, necessidade, interesse, objeções, resultado, próximo passo", isText: true },
  call_log:                { label: "Registro da ligação", ph: "Log da chamada, duração, número e resultado", isText: true },
  call_recording:          { label: "Gravação da call (se habilitada)", ph: "Link da gravação ou arquivo", isUrl: true },
  visit_proof:             { label: "Prova da visita", ph: "Foto, geolocalização ou evidência do estabelecimento (link)", isUrl: true },
  visit_result:            { label: "Resultado da visita", ph: "Empresa/local, contato, resultado e próximo passo", isText: true },
  closing_proof:           { label: "Comprovação do fechamento", ph: "Link do pedido, contrato, aceite ou comprovante", isUrl: true },
  sale_data:               { label: "Dados da venda", ph: "Cliente, produto/serviço, valor, data e status", isText: true },
};

// Configuração padrão. A campanha pode sobrescrever qualquer campo.
export const EVIDENCE_MATRIX = {
  contato: {
    minEvidence: 1,
    required: ["contact_proof"],
    optional: [],
    requiredFields: ["cliente", "telefone", "canal"],
  },
  lead_qualificado: {
    minEvidence: 2,
    required: ["contact_proof", "qualification_summary"],
    optional: [],
    requiredFields: ["cliente", "telefone", "interesse", "necessidade", "proximo_passo"],
  },
  follow: {
    minEvidence: 1,
    required: ["follow_proof"],
    optional: [],
    requiredFields: ["cliente", "telefone", "canal", "resultado", "proximo_follow"],
  },
  agendamento: {
    minEvidence: 2,
    required: ["scheduling_confirmation", "meeting_data"],
    optional: [],
    requiredFields: ["cliente", "telefone", "datahora", "modalidade"],
  },
  realizada: {
    minEvidence: 2,
    required: ["video_or_recording", "meeting_summary"],
    optional: [],
    requiredFields: ["cliente", "duracao", "necessidade", "resultado", "proximo_passo"],
  },
  ligacao: {
    minEvidence: 1,
    required: ["call_log"],
    optional: ["call_recording"],
    requiredFields: ["cliente", "telefone", "duracao", "resultado"],
  },
  visita: {
    minEvidence: 2,
    required: ["visit_proof", "visit_result"],
    optional: [],
    requiredFields: ["cliente", "endereco", "resultado"],
  },
  venda: {
    minEvidence: 2,
    required: ["closing_proof", "sale_data"],
    optional: [],
    requiredFields: ["cliente", "documento", "valorContrato"],
  },
};

// Resolve a configuração efetiva: base + sobrescrita da campanha
export function resolveMatrix(tipo, campanhaConfig) {
  const base = EVIDENCE_MATRIX[tipo];
  if (!base) return null;
  if (!campanhaConfig) return base;
  return { ...base, ...campanhaConfig };
}

// Valida prova completa e devolve lista de erros legíveis
export function validateProva(tipo, prova, evidencias, campanhaConfig) {
  const matrix = resolveMatrix(tipo, campanhaConfig);
  if (!matrix) return [];
  const erros = [];

  for (const field of matrix.requiredFields || []) {
    if (!String(prova[field] || "").trim()) {
      const LABELS = {
        cliente: "Nome do contato", telefone: "Telefone", canal: "Canal",
        resultado: "Resultado", proximo_passo: "Próximo passo", proximo_follow: "Próximo follow-up",
        interesse: "Interesse", necessidade: "Necessidade identificada",
        datahora: "Data e hora", modalidade: "Modalidade",
        duracao: "Duração", empresa: "Empresa",
        endereco: "Endereço/local", documento: "CNPJ ou CPF", valorContrato: "Valor do contrato",
      };
      erros.push(`Campo obrigatório: ${LABELS[field] || field}`);
    }
  }

  const evidFilled = (evidencias || []).filter((e) => String(e.valor || "").trim());
  const count = evidFilled.length;

  if (count < matrix.minEvidence) {
    erros.push(`Faltam evidências: ${count} de ${matrix.minEvidence} obrigatória${matrix.minEvidence > 1 ? "s" : ""}`);
  }

  for (let i = 0; i < matrix.required.length; i++) {
    const slot = matrix.required[i];
    const item = evidFilled[i];
    if (!item || !String(item.valor || "").trim()) {
      const { label } = EVIDENCE_SLOTS[slot] || { label: slot };
      erros.push(`Evidência obrigatória ausente: ${label}`);
    }
    const valorTrim = String(item?.valor || "").trim();
    const ehArquivoEnviado = valorTrim.startsWith("data:");
    if (item && EVIDENCE_SLOTS[slot]?.isUrl && !ehArquivoEnviado && !/^https?:\/\/\S+/i.test(valorTrim)) {
      const { label } = EVIDENCE_SLOTS[slot] || { label: slot };
      erros.push(`${label}: cole um link válido (http:// ou https://)`);
    }
  }

  return erros;
}

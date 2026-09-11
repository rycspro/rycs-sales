// RYCS Audit Decision Engine.
//
// Converte a nota do Scoring Engine em decisão. É aqui que moram as regras que
// não podem ser contornadas por peso nenhum — e o failsafe.
//
// Princípio inegociável: falha de provedor externo NUNCA reprova ninguém.
// Se a API de visão caiu, o profissional não fez nada de errado; quem não
// conseguiu verificar foi a plataforma. Nesse caso a decisão é revisão humana.

import { normalizarPolitica } from "./politica.js";
import { RESULTADOS } from "./scoring.js";

export const DECISOES = {
  aprovado: "aprovado",
  revisao: "revisao",
  recusado: "recusado",
  falha: "falha_processamento",
};

export const MOTIVOS = {
  obrigatorio_negado: "Critério obrigatório não foi cumprido.",
  obrigatorio_inconclusivo: "Critério obrigatório não pôde ser verificado.",
  cobertura_insuficiente: "Parte relevante dos critérios não pôde ser verificada.",
  acima_do_limiar: "Nota acima do limiar de aprovação da política.",
  faixa_de_revisao: "Nota na faixa que exige conferência humana.",
  abaixo_do_limiar: "Nota abaixo do limiar mínimo da política.",
  sem_nota: "Nenhum critério pôde ser avaliado.",
  erro_de_estagio: "Um estágio da auditoria falhou.",
};

// Abaixo desta cobertura a nota não representa a política: uma nota alta
// calculada sobre 30% dos critérios diria mais sobre o que faltou medir do que
// sobre o trabalho do profissional.
export const COBERTURA_MINIMA = 60;

export function decidir({ politica, resultado, errosDeEstagio = [] }) {
  const p = normalizarPolitica(politica);
  const { limiares } = p;

  // 1. Falha de infraestrutura vem antes de tudo. Não é decisão sobre a
  //    evidência, é ausência de condição para decidir.
  if (errosDeEstagio.length) {
    return {
      decisao: DECISOES.revisao,
      motivo: MOTIVOS.erro_de_estagio,
      detalhe: `Estágio(s) com falha: ${errosDeEstagio.map((e) => e.estagio).join(", ")}. A ação vai para revisão humana — falha nossa não reprova o profissional.`,
      automatica: false,
      limiares,
    };
  }

  // 2. Obrigatório negado com confiança é reprovação, independente da nota.
  if (resultado.obrigatoriosNegados.length) {
    return {
      decisao: DECISOES.recusado,
      motivo: MOTIVOS.obrigatorio_negado,
      detalhe: `Não cumprido: ${resultado.obrigatoriosNegados.join(", ")}.`,
      automatica: true,
      limiares,
    };
  }

  // 3. Obrigatório que não deu para verificar é revisão, nunca recusa.
  if (resultado.obrigatoriosInconclusivos.length) {
    return {
      decisao: DECISOES.revisao,
      motivo: MOTIVOS.obrigatorio_inconclusivo,
      detalhe: `Sem verificação para: ${resultado.obrigatoriosInconclusivos.join(", ")}.`,
      automatica: false,
      limiares,
    };
  }

  if (resultado.score === null) {
    return { decisao: DECISOES.revisao, motivo: MOTIVOS.sem_nota, detalhe: "Nenhum critério da política pôde ser avaliado.", automatica: false, limiares };
  }

  if (resultado.cobertura < COBERTURA_MINIMA) {
    return {
      decisao: DECISOES.revisao,
      motivo: MOTIVOS.cobertura_insuficiente,
      detalhe: `Apenas ${resultado.cobertura}% do peso da política foi verificado; o mínimo para decidir sozinho é ${COBERTURA_MINIMA}%.`,
      automatica: false,
      limiares,
    };
  }

  if (resultado.score >= limiares.aprovar)
    return { decisao: DECISOES.aprovado, motivo: MOTIVOS.acima_do_limiar, detalhe: `${resultado.score} ≥ ${limiares.aprovar}.`, automatica: true, limiares };

  if (resultado.score >= limiares.revisar)
    return { decisao: DECISOES.revisao, motivo: MOTIVOS.faixa_de_revisao, detalhe: `${resultado.score} entre ${limiares.revisar} e ${limiares.aprovar}.`, automatica: false, limiares };

  return { decisao: DECISOES.recusado, motivo: MOTIVOS.abaixo_do_limiar, detalhe: `${resultado.score} < ${limiares.revisar}.`, automatica: true, limiares };
}

// Estado que o vendedor vê. Separado da decisão técnica porque a linguagem é
// outra: ninguém precisa ler "falha_processamento" para saber o que aconteceu.
export const ESTADOS_VISIVEIS = {
  processando: { nome: "Em auditoria", texto: "Processando evidências…", tom: "amber" },
  [DECISOES.aprovado]: { nome: "Aprovada", texto: "Evidência aprovada pela auditoria.", tom: "brand" },
  [DECISOES.revisao]: { nome: "Precisa de revisão", texto: "Uma pessoa vai conferir esta evidência.", tom: "indigo" },
  [DECISOES.recusado]: { nome: "Não aprovada", texto: "A evidência não cumpriu os critérios da política.", tom: "red" },
  [DECISOES.falha]: { nome: "Precisa de revisão", texto: "Não conseguimos processar automaticamente. Uma pessoa vai conferir.", tom: "indigo" },
};

export const RESULTADOS_CRITERIO = RESULTADOS;

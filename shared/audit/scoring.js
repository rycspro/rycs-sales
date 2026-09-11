// RYCS Audit Scoring Engine.
//
// Recebe os veredictos por critério que o pipeline produziu e devolve uma nota
// de 0 a 100 com a conta aberta. A nota nunca é um número solto: cada critério
// entra na resposta com peso, resultado, confiança e de onde a resposta veio.
//
// Regras que valem para qualquer política:
//
// 1. Critério sem resposta é INCONCLUSIVO, não é "não atendido". Falta de
//    informação não é prova contra o profissional.
// 2. Critério abaixo da confiança mínima também é inconclusivo.
// 3. Peso de critério inconclusivo sai do denominador. Cobrar por um estágio
//    que não rodou puniria o profissional pela indisponibilidade de um
//    provedor externo.
// 4. Critério obrigatório negado com confiança derruba a auditoria.

import { normalizarPolitica } from "./politica.js";

export const RESULTADOS = {
  atendido: "atendido",
  negado: "negado",
  inconclusivo: "inconclusivo",
};

const arredondar = (v) => Math.round(v * 100) / 100;

// `veredictos` é um mapa chave → { resultado, confianca, evidencia, fonte, detalhe }
export function pontuar({ politica, veredictos = {} }) {
  const p = normalizarPolitica(politica);

  const itens = p.criterios.map((c) => {
    const v = veredictos[c.chave];
    const confianca = Math.max(0, Math.min(1, Number(v?.confianca ?? 0)));
    const bruto = v?.resultado;

    let resultado;
    let motivo = "";

    if (!v || !RESULTADOS[bruto]) {
      resultado = RESULTADOS.inconclusivo;
      motivo = v ? "Resposta do estágio em formato inesperado." : "Estágio não produziu resposta para este critério.";
    } else if (bruto === RESULTADOS.inconclusivo) {
      resultado = RESULTADOS.inconclusivo;
      motivo = v.detalhe || "Estágio não conseguiu concluir.";
    } else if (confianca < c.confiancaMinima) {
      resultado = RESULTADOS.inconclusivo;
      motivo = `Confiança ${(confianca * 100).toFixed(0)}% abaixo do mínimo de ${(c.confiancaMinima * 100).toFixed(0)}% exigido por este critério.`;
    } else {
      resultado = bruto;
      motivo = v.detalhe || "";
    }

    return {
      chave: c.chave,
      descricao: c.descricao,
      fonte: c.fonte,
      peso: c.peso,
      obrigatorio: c.obrigatorio,
      confiancaMinima: c.confiancaMinima,
      resultado,
      confianca,
      motivo,
      evidencia: Array.isArray(v?.evidencia) ? v.evidencia.slice(0, 10) : [],
    };
  });

  const conclusivos = itens.filter((i) => i.resultado !== RESULTADOS.inconclusivo);
  const pesoAvaliado = conclusivos.reduce((n, i) => n + i.peso, 0);
  const pesoAtendido = conclusivos
    .filter((i) => i.resultado === RESULTADOS.atendido)
    .reduce((n, i) => n + i.peso, 0);

  // Sem nenhum critério conclusivo não existe nota: existe ausência de nota.
  // Devolver zero seria afirmar que o profissional falhou em tudo.
  const score = pesoAvaliado > 0 ? arredondar((pesoAtendido / pesoAvaliado) * 100) : null;

  const obrigatoriosNegados = itens.filter((i) => i.obrigatorio && i.resultado === RESULTADOS.negado);
  const obrigatoriosInconclusivos = itens.filter((i) => i.obrigatorio && i.resultado === RESULTADOS.inconclusivo);

  const pesoTotal = p.criterios.reduce((n, c) => n + c.peso, 0);
  const cobertura = pesoTotal > 0 ? arredondar((pesoAvaliado / pesoTotal) * 100) : 0;

  return {
    score,
    cobertura,
    pesoTotal,
    pesoAvaliado,
    pesoAtendido,
    itens,
    obrigatoriosNegados: obrigatoriosNegados.map((i) => i.chave),
    obrigatoriosInconclusivos: obrigatoriosInconclusivos.map((i) => i.chave),
    politica: { nome: p.nome, tipo: p.tipo, versao: p.versao, limiares: p.limiares },
  };
}

// Texto que o vendedor, a empresa e a revisão interna leem. A mesma decisão
// precisa ser explicável para os três — "reprovado" sem motivo não é uma
// decisão que alguém consiga contestar.
export function explicar(resultado) {
  const atendidos = resultado.itens.filter((i) => i.resultado === RESULTADOS.atendido);
  const negados = resultado.itens.filter((i) => i.resultado === RESULTADOS.negado);
  const inconclusivos = resultado.itens.filter((i) => i.resultado === RESULTADOS.inconclusivo);

  return {
    score: resultado.score,
    cobertura: resultado.cobertura,
    aprovado: atendidos.map((i) => ({ chave: i.chave, descricao: i.descricao, peso: i.peso, confianca: i.confianca })),
    problemas: negados.map((i) => ({
      chave: i.chave, descricao: i.descricao, peso: i.peso,
      obrigatorio: i.obrigatorio, confianca: i.confianca, motivo: i.motivo,
    })),
    naoVerificado: inconclusivos.map((i) => ({
      chave: i.chave, descricao: i.descricao, peso: i.peso,
      obrigatorio: i.obrigatorio, motivo: i.motivo,
    })),
  };
}

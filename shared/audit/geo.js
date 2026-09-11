// Cálculo geoespacial e leitura de metadados do RYCS Audit Engine.
//
// Funções puras: entram dados, sai veredicto. Sem banco e sem estado, para
// serem testáveis isoladamente e reutilizáveis pela tela quando ela precisar
// explicar a mesma conta que o servidor fez.

import { RESULTADOS } from "./scoring.js";

export const SEVERIDADE = { info: "info", atencao: "atencao", critico: "critico" };

// Distância entre dois pontos na superfície da Terra. Haversine é suficiente
// para a escala envolvida — a diferença para uma fórmula elipsoidal é de
// centímetros em alguns quilômetros, e a tolerância aqui é de dezenas de
// metros.
export function distanciaMetros(a, b) {
  if (![a?.lat, a?.lon, b?.lat, b?.lon].every((v) => Number.isFinite(Number(v)))) return null;
  const R = 6371000;
  const rad = (g) => (Number(g) * Math.PI) / 180;
  const dLat = rad(b.lat) - rad(a.lat);
  const dLon = rad(b.lon) - rad(a.lon);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

// A tolerância é configurável e nunca fica presa no código: um comércio de rua
// e um galpão industrial não têm o mesmo raio razoável.
export const TOLERANCIA_PADRAO_METROS = Number(process.env.AUDIT_GEO_TOLERANCIA_M) || 150;

export function avaliarGeo({ capturado, esperado, toleranciaMetros = TOLERANCIA_PADRAO_METROS }) {
  const distancia = distanciaMetros(capturado, esperado);

  if (distancia === null) {
    return {
      resultado: RESULTADOS.inconclusivo,
      confianca: 0,
      detalhe: !capturado ? "Localização não foi capturada nesta visita." : "Endereço esperado da empresa não tem coordenadas cadastradas.",
      sinal: null,
    };
  }

  // A precisão declarada pelo aparelho entra na conta: 40 metros de erro com
  // precisão de 100 metros não é evidência contra ninguém.
  const precisao = Number(capturado?.precisao) || 0;
  const margem = toleranciaMetros + Math.min(precisao, 200);
  const dentro = distancia <= margem;

  return {
    resultado: dentro ? RESULTADOS.atendido : RESULTADOS.negado,
    // Quanto mais longe do limite, mais confiante é a leitura, para os dois
    // lados. Em cima da linha, a confiança cai e o critério tende a virar
    // inconclusivo pela confiança mínima da política.
    confianca: Math.max(0, Math.min(1, Math.abs(distancia - margem) / Math.max(margem, 1))),
    detalhe: `${distancia} m do endereço esperado (tolerância ${toleranciaMetros} m + precisão ${Math.round(precisao)} m).`,
    sinal: {
      chave: "GPS_DISTANCE",
      valor: String(distancia),
      severidade: dentro ? SEVERIDADE.info : SEVERIDADE.atencao,
      detalhe: `distância ${distancia} m, margem ${margem} m`,
    },
  };
}

// Metadados do arquivo. EXIF não é prova: pode ser removido por qualquer app
// de mensagem e forjado por qualquer editor. Entra como um sinal entre vários,
// nunca como veredicto.
export function avaliarMetadados({ metadata = {}, enviadoEm = Date.now() }) {
  const sinais = [];
  const exif = metadata.exif || {};

  if (!Object.keys(exif).length) {
    sinais.push({
      chave: "EXIF_AUSENTE", valor: "1", severidade: SEVERIDADE.info,
      detalhe: "Sem EXIF. Comum em imagens recebidas por aplicativo de mensagem; não indica fraude por si só.",
    });
  }

  if (exif.Software) {
    sinais.push({
      chave: "IMAGE_EDITED", valor: String(exif.Software).slice(0, 80), severidade: SEVERIDADE.atencao,
      detalhe: `Arquivo processado por "${String(exif.Software).slice(0, 80)}".`,
    });
  }

  const capturaEm = Number(metadata.capturadoEm) || Number(exif.DateTimeOriginal) || null;
  if (capturaEm) {
    const horas = Math.abs(enviadoEm - capturaEm) / 3600000;
    if (horas > 48) {
      sinais.push({
        chave: "CAPTURE_DELAY", valor: String(Math.round(horas)), severidade: SEVERIDADE.atencao,
        detalhe: `Imagem capturada ${Math.round(horas)} h antes do envio.`,
      });
    }
  }

  if (metadata.largura && metadata.altura && (metadata.largura < 480 || metadata.altura < 480)) {
    sinais.push({
      chave: "LOW_RESOLUTION", valor: `${metadata.largura}x${metadata.altura}`, severidade: SEVERIDADE.atencao,
      detalhe: "Resolução baixa para análise confiável de conteúdo.",
    });
  }

  return { sinais };
}

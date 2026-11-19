// Arquivos (foto, vídeo, áudio) que o cliente envia como data URI ficam
// guardados assim no banco, mas não viajam no /state: lá viram um endereço
// curto que o servidor resolve sob demanda. `t` diz o tipo, para a tela saber
// se desenha <img>, <video> ou <audio> sem baixar o arquivo; `v` muda quando
// o conteúdo muda, para o cache não mostrar a versão antiga.

export function tipoMidia(valor) {
  const v = String(valor || "");
  const dado = v.match(/^data:(image|video|audio)\//);
  if (dado) return dado[1];
  const url = v.match(/^\/api\/[^?]+\?(?:[^#]*&)?t=(image|video|audio)(?:&|$)/);
  return url ? url[1] : null;
}

export function versaoDataUri(dataUri) {
  const s = String(dataUri || "");
  return `${s.length.toString(36)}${s.slice(-10).replace(/[^A-Za-z0-9]/g, "")}`;
}

export function enderecoMidia(base, dataUri, extra = {}) {
  const tipo = tipoMidia(dataUri) || "arquivo";
  const params = new URLSearchParams({ ...extra, t: tipo, v: versaoDataUri(dataUri) });
  return `${base}?${params.toString()}`;
}

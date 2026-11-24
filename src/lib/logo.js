// Prepara o logo da empresa para envio. O dono manda o arquivo que tiver, de
// qualquer tamanho e proporção; aqui ele é reduzido no navegador até caber no
// limite guardado pela plataforma (LOGO_MAX_BYTES, 1 MB). Sem corte e sem
// distorção: só diminui.

import { LOGO_MAX_BYTES, LOGO_ORIGINAL_MAX_BYTES, avaliarLogo, tipoDoLogo, formatarTamanho } from "../../shared/onboarding.js";

const LADOS = [1600, 1200, 900, 700, 512, 384, 256];

const ler = (blob) => new Promise((ok, falha) => {
  const r = new FileReader();
  r.onerror = () => falha(r.error);
  r.onload = () => ok(String(r.result));
  r.readAsDataURL(blob);
});

const abrirImagem = (url) => new Promise((ok, falha) => {
  const img = new Image();
  img.onerror = () => falha(new Error("imagem"));
  img.onload = () => ok(img);
  img.src = url;
});

const paraBlob = (canvas, tipo, q) => new Promise((ok) => canvas.toBlob(ok, tipo, q));

async function reduzir(arquivo, tipo) {
  const url = URL.createObjectURL(arquivo.type ? arquivo : new Blob([arquivo], { type: tipo }));
  try {
    const img = await abrirImagem(url);
    // SVG sem largura/altura próprias chega com 0: usa um quadrado.
    const w = img.naturalWidth || 1024, h = img.naturalHeight || 1024;
    const vetor = tipo === "image/svg+xml";
    for (const lado of LADOS) {
      const escala = vetor ? lado / Math.max(w, h) : Math.min(1, lado / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w * escala));
      canvas.height = Math.max(1, Math.round(h * escala));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      // JPG não tem transparência: continua JPG, que fica bem menor que PNG.
      const saida = tipo === "image/jpeg" ? ["image/jpeg", 0.9] : ["image/png"];
      const blob = await paraBlob(canvas, ...saida);
      if (blob && blob.size > 0 && blob.size <= LOGO_MAX_BYTES) return { dataUri: await ler(blob), mimetype: blob.type };
    }
    throw new Error("Não conseguimos reduzir esta imagem. Envie uma versão menor do logo.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Devolve { dataUri, mimetype } pronto para enviar, ou lança um Error com a
// mensagem que a tela mostra.
export async function prepararLogo(arquivo) {
  const tipo = tipoDoLogo(arquivo?.type, arquivo?.name);
  if (!tipo) throw new Error("Este arquivo não é uma imagem. Envie PNG, JPG, WebP, SVG, GIF, AVIF, BMP ou HEIC.");
  if (arquivo.size > LOGO_ORIGINAL_MAX_BYTES) throw new Error(`Arquivo muito grande. Envie um logo de até ${formatarTamanho(LOGO_ORIGINAL_MAX_BYTES)}.`);
  const svgTexto = tipo === "image/svg+xml" ? await arquivo.text() : "";
  // Já está dentro do que a plataforma guarda: vai como veio.
  if (!avaliarLogo({ mimetype: tipo, tamanhoBytes: arquivo.size, svgTexto })) {
    const dataUri = await ler(arquivo);
    return { dataUri: dataUri.replace(/^data:[^;,]*/, `data:${tipo}`), mimetype: tipo };
  }
  try {
    return await reduzir(arquivo, tipo);
  } catch (e) {
    if (e?.message && e.message !== "imagem") throw e;
    throw new Error(tipo === "image/heic"
      ? "Este navegador não abre fotos HEIC. Exporte o logo em PNG ou JPG e envie de novo."
      : "Não foi possível abrir esta imagem. Tente exportar em PNG ou JPG.");
  }
}

export const ACEITA_LOGO = "image/*,.svg,.heic,.heif,.avif,.webp";

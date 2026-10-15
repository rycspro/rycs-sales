// Leitura dos materiais da etapa 3 (Marketing Academy) para a IA da etapa 4.
//
// Cada arquivo vira um texto curto que o estrategista consegue usar: a
// "ficha" do material. A ficha fica guardada em academy_materiais
// (textoExtraido), então pedir ajustes ou gerar de novo não lê tudo outra vez.
//
// Por formato:
// - TXT, DOCX, PPTX (slides e notas), XLSX: texto extraído aqui mesmo.
//   Texto longo vira ficha pela Claude; curto vai como está.
// - PDF: a Claude lê o arquivo inteiro, com imagens e gráficos. Se não der
//   (grande demais, IA fora do ar), vale o texto extraído localmente.
// - Fotos: a Claude descreve o que a foto mostra que ajuda a vender.
// - Vídeos: o ffmpeg tira quadros ao longo do vídeo e separa o áudio; a fala
//   é transcrita (OpenAI, com OPENAI_API_KEY) e a Claude faz a ficha com os
//   quadros e a transcrição.
// - Áudios: transcrição, e ficha se for longa.
// - PPT, DOC, XLS e KEY (formatos antigos/fechados): não são lidos; a tela
//   pede para exportar em PDF.
//
// Sem ffmpeg ou sem chave de transcrição, o que der para ler é lido e o resto
// fica registrado em `leitura`. Nada é inventado no lugar.

import { execFile } from "child_process";
import { promisify } from "util";
import { inflateRawSync } from "zlib";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { extrairTextoPdf } from "./reportPdf.js";
import { lerBuffer, baixarPara } from "./arquivos.js";
import { extensaoDe, FORMATOS_SEM_LEITURA } from "../../shared/onboarding.js";

const executar = promisify(execFile);

// Sobe quando o leitor aprende um formato: materiais lidos por uma versão
// anterior são lidos de novo na próxima análise.
export const LEITURA_VERSAO = 2;

const MB = 1024 * 1024;
export const MAX_TEXTO_MATERIAL = 15000;   // acima disso, vira ficha
const MAX_TEXTO_PARA_FICHA = 150000;
const MAX_PDF_IA = 20 * MB;                // o pedido à API tem limite de 32 MB em base64
const MAX_IMAGEM_IA = 3.5 * MB;            // 5 MB em base64; acima disso, reduz com ffmpeg
const MAX_AUDIO_TRANSCRICAO = 24 * MB;     // limite da API de transcrição: 25 MB
const QUADROS_VIDEO = 8;
const MAX_MINUTOS_FALA = 60;

const MODELO_TRANSCRICAO = process.env.TRANSCRICAO_MODELO || "whisper-1";
export const transcricaoDisponivel = () => !!process.env.OPENAI_API_KEY;

// ---------------------------------------------------------------------------
// Office (DOCX, PPTX, XLSX são zip com XML dentro). Leitor de zip mínimo, só
// com o zlib do Node, para não trazer dependência nova.

const LIMITE_DESCOMPACTADO = 50 * MB;

export function lerZip(buffer, filtro = () => true) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Arquivo compactado inválido.");
  const quantos = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  const arquivos = [];
  let total = 0;
  for (let n = 0; n < quantos && p + 46 <= buffer.length; n++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) break;
    const metodo = buffer.readUInt16LE(p + 10);
    const tamanho = buffer.readUInt32LE(p + 20);
    const lenNome = buffer.readUInt16LE(p + 28);
    const lenExtra = buffer.readUInt16LE(p + 30);
    const lenComentario = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    const nome = buffer.toString("utf8", p + 46, p + 46 + lenNome);
    p += 46 + lenNome + lenExtra + lenComentario;
    if (!filtro(nome) || local + 30 > buffer.length) continue;
    const inicio = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const bruto = buffer.subarray(inicio, inicio + tamanho);
    let dados = null;
    if (metodo === 0) dados = bruto;
    // Teto de saída: um zip pequeno não pode virar gigabytes na memória.
    else if (metodo === 8) dados = inflateRawSync(bruto, { maxOutputLength: LIMITE_DESCOMPACTADO - total });
    if (!dados) continue;
    total += dados.length;
    arquivos.push({ nome, texto: dados.toString("utf8") });
  }
  return arquivos;
}

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
const decodificar = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENTIDADES[e] ?? m;
});

// Texto das tags <prefixo:t>, com quebra de linha a cada parágrafo.
function textoXml(xml, tag, paragrafo) {
  return xml
    .replace(new RegExp(`</${paragrafo}>`, "g"), "\n")
    .match(new RegExp(`<${tag}(?:\\s[^>]*)?>[^<]*</${tag}>|\\n`, "g"))
    ?.map((t) => (t === "\n" ? "\n" : decodificar(t.replace(/<[^>]+>/g, ""))))
    .join("")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() || "";
}

const numero = (nome) => Number((nome.match(/(\d+)\.xml$/) || [])[1] || 0);

export function textoOffice(buffer, ext) {
  if (ext === "docx") {
    const [doc] = lerZip(buffer, (n) => n === "word/document.xml");
    return doc ? textoXml(doc.texto, "w:t", "w:p") : "";
  }
  if (ext === "pptx") {
    const xmls = lerZip(buffer, (n) => /^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(n));
    const slides = xmls.filter((x) => x.nome.includes("/slides/")).sort((a, b) => numero(a.nome) - numero(b.nome));
    const notas = new Map(xmls.filter((x) => x.nome.includes("notesSlide")).map((x) => [numero(x.nome), textoXml(x.texto, "a:t", "a:p")]));
    return slides.map((s) => {
      const n = numero(s.nome);
      const nota = notas.get(n);
      return [`[Slide ${n}]`, textoXml(s.texto, "a:t", "a:p"), nota ? `Notas: ${nota}` : ""].filter(Boolean).join("\n");
    }).join("\n\n");
  }
  if (ext === "xlsx") {
    const xmls = lerZip(buffer, (n) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
    const comp = xmls.find((x) => x.nome === "xl/sharedStrings.xml");
    const strings = comp ? (comp.texto.match(/<si>[\s\S]*?<\/si>/g) || []).map((si) => textoXml(si, "t", "si").replace(/\n/g, " ")) : [];
    return xmls.filter((x) => x.nome.includes("worksheets")).sort((a, b) => numero(a.nome) - numero(b.nome)).map((plan) => {
      const linhas = (plan.texto.match(/<row[\s\S]*?<\/row>/g) || []).map((row) =>
        (row.match(/<c\s[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []).map((c) => {
          const tipo = (c.match(/\st="(\w+)"/) || [])[1];
          if (tipo === "inlineStr") return textoXml(c, "t", "is");
          const v = (c.match(/<v>([^<]*)<\/v>/) || [])[1];
          if (v == null) return "";
          return tipo === "s" ? strings[Number(v)] ?? "" : decodificar(v);
        }).join("\t").replace(/\t+$/, "")).filter((l) => l.trim());
      return [`[Planilha ${numero(plan.nome)}]`, ...linhas].join("\n");
    }).join("\n\n");
  }
  return "";
}

// ---------------------------------------------------------------------------
// ffmpeg (instalado na imagem de produção pelo Dockerfile).

let ffmpegOk = null;
export async function ffmpegDisponivel() {
  if (ffmpegOk === null) {
    try { await executar("ffmpeg", ["-version"]); await executar("ffprobe", ["-version"]); ffmpegOk = true; } catch { ffmpegOk = false; }
  }
  return ffmpegOk;
}

const ff = (args) => executar("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { timeout: 10 * 60 * 1000 });

async function duracaoSegundos(arquivo) {
  const { stdout } = await executar("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", arquivo], { timeout: 60000 });
  return Number(stdout.trim()) || 0;
}

async function quadrosDoVideo(arquivo, pasta) {
  const dur = await duracaoSegundos(arquivo);
  const quadros = [];
  for (let i = 0; i < QUADROS_VIDEO; i++) {
    const destino = join(pasta, `quadro-${i}.jpg`);
    // -ss antes de -i: busca direto no ponto, sem decodificar o vídeo inteiro.
    try {
      await ff(["-ss", String(dur ? (dur * (i + 0.5)) / QUADROS_VIDEO : i), "-i", arquivo, "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", "-q:v", "4", destino]);
      quadros.push(readFileSync(destino));
    } catch { /* quadro que não sai (fim do vídeo, trecho corrompido) fica de fora */ }
  }
  return { quadros, dur };
}

// Áudio mono, 16 kHz, 32 kbps: uma hora de fala cabe em ~15 MB.
async function audioParaTranscricao(arquivo, pasta) {
  const destino = join(pasta, "fala.mp3");
  await ff(["-i", arquivo, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", "-t", String(MAX_MINUTOS_FALA * 60), destino]);
  return destino;
}

async function reduzirImagem(buffer, pasta) {
  const origem = join(pasta, "foto-original");
  const destino = join(pasta, "foto.jpg");
  writeFileSync(origem, buffer);
  await ff(["-i", origem, "-vf", "scale='min(1568,iw)':-2", "-q:v", "3", destino]);
  return readFileSync(destino);
}

// ---------------------------------------------------------------------------
// Transcrição (OpenAI). Único provedor além da Claude, decidido com o dono
// do produto em 2026-10-15 para ler a fala de vídeos e áudios.

const TIPO_AUDIO = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4" };

export async function transcrever(caminho, ext = "mp3") {
  if (!transcricaoDisponivel()) return null;
  const form = new FormData();
  form.append("file", new Blob([readFileSync(caminho)], { type: TIPO_AUDIO[ext] || "audio/mpeg" }), `fala.${ext}`);
  form.append("model", MODELO_TRANSCRICAO);
  form.append("language", "pt");
  form.append("response_format", "text");
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const r = await fetch(`${base}/audio/transcriptions`, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form,
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  if (!r.ok) throw new Error(`Transcrição recusada (HTTP ${r.status}).`);
  return (await r.text()).trim();
}

// ---------------------------------------------------------------------------
// Pedidos à Claude. `descrever(blocos, pedido)` vem de iaOnboarding.js.

const FICHA = `Faça a ficha comercial deste material, em tópicos curtos:
- oferta: o que a empresa vende e como funciona;
- benefícios e diferenciais;
- provas: números, clientes, depoimentos, certificações e garantias, exatamente como aparecem;
- preços, condições e prazos, só se aparecerem;
- público, dores e situações de uso;
- objeções que o material responde, e como responde;
- termos, frases e tom que a marca usa.
Registre só o que está no material. Tópico sem informação fica de fora. Até 600 palavras.`;

const FOTO = `Descreva, em até 120 palavras, o que esta foto mostra que ajuda a vender: produto ou serviço, uso, ambiente, público, resultado, e qualquer texto visível (transcreva). Só o que se vê; nada de suposição.`;

const imagem = (buffer, tipo = "image/jpeg") => ({ type: "image", source: { type: "base64", media_type: tipo, data: buffer.toString("base64") } });
const TIPO_IMAGEM = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

async function fichaDeTexto(texto, descrever) {
  if (texto.length <= MAX_TEXTO_MATERIAL || !descrever) return texto.slice(0, MAX_TEXTO_MATERIAL);
  try {
    return await descrever([{ type: "text", text: texto.slice(0, MAX_TEXTO_PARA_FICHA) }], FICHA);
  } catch {
    return texto.slice(0, MAX_TEXTO_MATERIAL);
  }
}

// ---------------------------------------------------------------------------
// Leitura de um material. Devolve { status, texto, leitura }:
// status: indexado | sem_texto | erro (erro é lido de novo na próxima vez).

export async function lerMaterial(m, { descrever = null } = {}) {
  const ext = extensaoDe(m.nome);
  if (!m.chave) return { status: "sem_texto", texto: "", leitura: "Sem arquivo." };
  if (FORMATOS_SEM_LEITURA.includes(ext))
    return { status: "sem_texto", texto: "", leitura: `Formato .${ext} não é lido. Exporte em PDF para a IA aproveitar.` };

  const pasta = mkdtempSync(join(tmpdir(), "rycs-leitura-"));
  try {
    if (ext === "txt" || ["docx", "pptx", "xlsx"].includes(ext)) {
      const buffer = await lerBuffer(m.chave);
      const texto = ext === "txt" ? buffer.toString("utf8") : textoOffice(buffer, ext);
      if (!texto.trim()) return { status: "sem_texto", texto: "", leitura: "Nenhum texto encontrado no arquivo." };
      return { status: "indexado", texto: await fichaDeTexto(texto.trim(), descrever), leitura: "Texto extraído do arquivo." };
    }

    if (ext === "pdf") {
      const buffer = await lerBuffer(m.chave);
      if (descrever && buffer.length <= MAX_PDF_IA) {
        try {
          const ficha = await descrever([{ type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } }], FICHA);
          if (ficha) return { status: "indexado", texto: ficha, leitura: "Lido pela IA, com imagens e gráficos." };
        } catch { /* cai para o texto local */ }
      }
      const texto = extrairTextoPdf(buffer).trim();
      if (!texto) return { status: descrever ? "erro" : "sem_texto", texto: "", leitura: "PDF sem texto legível." };
      return { status: "indexado", texto: await fichaDeTexto(texto, descrever), leitura: "Só o texto do PDF." };
    }

    if (TIPO_IMAGEM[ext]) {
      if (!descrever) return { status: "erro", texto: "", leitura: "A IA não está ativa para ler fotos." };
      let buffer = await lerBuffer(m.chave);
      let tipo = TIPO_IMAGEM[ext];
      if (buffer.length > MAX_IMAGEM_IA) {
        if (!(await ffmpegDisponivel())) return { status: "sem_texto", texto: "", leitura: "Foto grande demais para a IA ler." };
        buffer = await reduzirImagem(buffer, pasta);
        tipo = "image/jpeg";
      }
      const descricao = await descrever([imagem(buffer, tipo)], FOTO);
      return descricao ? { status: "indexado", texto: descricao, leitura: "Descrita pela IA." } : { status: "erro", texto: "", leitura: "A IA não descreveu a foto." };
    }

    if (["mp4", "mov", "mp3", "wav", "m4a"].includes(ext)) {
      const video = ["mp4", "mov"].includes(ext);
      const temFfmpeg = await ffmpegDisponivel();
      const arquivo = await baixarPara(m.chave, join(pasta, `original.${ext}`));
      const notas = [];

      // Fala
      let fala = "";
      if (!transcricaoDisponivel()) notas.push("fala não transcrita (transcrição não configurada)");
      else {
        try {
          let audio = null, extAudio = "mp3";
          if (temFfmpeg) audio = await audioParaTranscricao(arquivo, pasta);
          else if (!video && statSync(arquivo).size <= MAX_AUDIO_TRANSCRICAO) { audio = arquivo; extAudio = ext; }
          if (audio) fala = (await transcrever(audio, extAudio)) || "";
          else notas.push("fala não transcrita (arquivo grande demais)");
        } catch (e) {
          notas.push(video ? "vídeo sem fala legível" : "fala não transcrita");
          console.warn(`[leitura] transcrição de ${m.id}: ${e.message}`);
        }
      }

      if (!video) {
        if (!fala) return { status: transcricaoDisponivel() ? "erro" : "sem_texto", texto: "", leitura: `Áudio: ${notas.join("; ")}.` };
        return { status: "indexado", texto: await fichaDeTexto(`Transcrição do áudio:\n${fala}`, descrever), leitura: "Áudio transcrito." };
      }

      // Imagens do vídeo
      let quadros = [], dur = 0;
      if (temFfmpeg) ({ quadros, dur } = await quadrosDoVideo(arquivo, pasta));
      else notas.push("quadros não extraídos (ffmpeg ausente)");

      if (!quadros.length && !fala) return { status: "sem_texto", texto: "", leitura: `Vídeo: ${notas.join("; ") || "nada legível"}.` };
      if (!descrever) {
        if (!fala) return { status: "erro", texto: "", leitura: "A IA não está ativa para ver o vídeo." };
        return { status: "indexado", texto: `Transcrição do vídeo:\n${fala.slice(0, MAX_TEXTO_MATERIAL)}`, leitura: "Só a fala do vídeo." };
      }
      const blocos = [
        ...quadros.map((q) => imagem(q)),
        { type: "text", text: [
          quadros.length ? `Acima: ${quadros.length} quadros do vídeo "${m.nome}", em ordem${dur ? `, ao longo de ${Math.round(dur)} segundos` : ""}.` : `Vídeo "${m.nome}" sem imagens extraídas.`,
          fala ? `Transcrição da fala:\n${fala.slice(0, MAX_TEXTO_PARA_FICHA)}` : "Sem transcrição da fala.",
        ].join("\n\n") },
      ];
      const ficha = await descrever(blocos, `${FICHA}\nInclua o que o vídeo mostra (demonstração, ambiente, textos na tela).`);
      return {
        status: "indexado", texto: ficha,
        leitura: ["Vídeo lido pela IA", quadros.length ? `${quadros.length} quadros` : "", fala ? "fala transcrita" : "", ...notas].filter(Boolean).join(", ") + ".",
      };
    }

    return { status: "sem_texto", texto: "", leitura: "Formato não lido." };
  } catch (e) {
    console.warn(`[leitura] material ${m.id}: ${e.message}`);
    return { status: "erro", texto: "", leitura: "Não foi possível ler o arquivo." };
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

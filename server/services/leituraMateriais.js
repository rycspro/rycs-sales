// Leitura dos materiais da etapa 3 (Marketing Academy) para a etapa 4.
//
// Cada arquivo vira um texto curto que o motor de estratégias consegue usar:
// a "ficha" do material. A ficha fica guardada em academy_materiais
// (textoExtraido), então pedir ajustes ou gerar de novo não lê tudo outra vez.
//
// Tudo roda dentro do servidor da RYCS, sem provedor externo:
// - TXT, DOCX, PPTX (slides e notas), XLSX: texto extraído aqui mesmo.
// - PDF: texto do arquivo; PDF escaneado (só imagem) passa por OCR.
// - Fotos: OCR (Tesseract) lê o texto que aparece na imagem.
// - Vídeos: o ffmpeg tira quadros ao longo do vídeo (OCR do texto na tela) e
//   separa o áudio, que o whisper.cpp transcreve localmente.
// - Áudios: transcrição local.
// - Texto longo vira resumo extrativo: só as frases com fato comercial
//   (services/motorEstrategias.js), sem reescrever nada.
// - PPT, DOC, XLS e KEY (formatos antigos/fechados): não são lidos; a tela
//   pede para exportar em PDF.
//
// Ferramentas instaladas pelo Dockerfile: ffmpeg, tesseract (com português),
// poppler (pdftoppm) e whisper.cpp com o modelo em /modelos.
//
// Se houver chave da Claude (ANTHROPIC_API_KEY), ela é usada no lugar do OCR
// para ler PDFs, fotos e vídeos com mais profundidade; se houver chave da
// OpenAI e não houver whisper local, a fala vai para a OpenAI. Nenhuma das
// duas é necessária. Sem uma ferramenta, o que der para ler é lido e o resto
// fica registrado em `leitura`. Nada é inventado no lugar.

import { execFile } from "child_process";
import { promisify } from "util";
import { inflateRawSync } from "zlib";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir, availableParallelism } from "os";
import { join } from "path";
import { extrairTextoPdf } from "./reportPdf.js";
import { lerBuffer, baixarPara } from "./arquivos.js";
import { resumoExtrativo } from "./motorEstrategias.js";
import { extensaoDe, FORMATOS_SEM_LEITURA } from "../../shared/onboarding.js";

const executar = promisify(execFile);

// Sobe quando o leitor aprende um formato: materiais lidos por uma versão
// anterior são lidos de novo na próxima análise.
export const LEITURA_VERSAO = 3;

const MB = 1024 * 1024;
export const MAX_TEXTO_MATERIAL = 15000;   // acima disso, vira ficha
const MAX_TEXTO_PARA_FICHA = 150000;
const MAX_PDF_IA = 20 * MB;                // o pedido à API tem limite de 32 MB em base64
const MAX_IMAGEM_IA = 3.5 * MB;            // 5 MB em base64; acima disso, reduz com ffmpeg
const MAX_AUDIO_TRANSCRICAO = 24 * MB;     // limite da API de transcrição: 25 MB
const QUADROS_VIDEO = 8;
const MAX_MINUTOS_FALA = 30;               // transcrição local roda na CPU do servidor
const MAX_PAGINAS_OCR = 20;

const MODELO_TRANSCRICAO = process.env.TRANSCRICAO_MODELO || "whisper-1";
const transcricaoExterna = () => !!process.env.OPENAI_API_KEY;
const WHISPER_BIN = process.env.WHISPER_BIN || "whisper-cli";
const WHISPER_MODELO = process.env.WHISPER_MODELO || "/modelos/ggml-small-q5_1.bin";

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

async function reduzirImagem(buffer, pasta) {
  const origem = join(pasta, "foto-original");
  const destino = join(pasta, "foto.jpg");
  writeFileSync(origem, buffer);
  await ff(["-i", origem, "-vf", "scale='min(1568,iw)':-2", "-q:v", "3", destino]);
  return readFileSync(destino);
}

// ---------------------------------------------------------------------------
// Ferramentas locais: OCR e transcrição.

const disponiveis = new Map();
async function temComando(nome, args = ["--version"]) {
  if (!disponiveis.has(nome)) {
    disponiveis.set(nome, executar(nome, args, { timeout: 30000 }).then(() => true, () => false));
  }
  return disponiveis.get(nome);
}
const temTesseract = () => temComando("tesseract");
const temPdftoppm = () => temComando("pdftoppm", ["-v"]);
const temWhisper = async () => existsSync(WHISPER_MODELO) && (await temComando(WHISPER_BIN, ["--help"]));

// Linha de OCR que é texto de verdade: duas palavras de três letras ou mais e
// maioria de letras. Corta o "ruído" que o OCR acha em fotos sem texto.
function linhasLegiveis(texto) {
  return String(texto || "").split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => {
    const letras = (l.match(/[a-zà-ú]/gi) || []).length;
    return (l.match(/[a-zà-ú]{3,}/gi) || []).length >= 2 && letras / Math.max(l.length, 1) >= 0.6;
  });
}

async function ocr(caminho) {
  const { stdout } = await executar("tesseract", [caminho, "stdout", "-l", "por+eng", "--psm", "3"], { timeout: 120000, maxBuffer: 20 * MB });
  return linhasLegiveis(stdout).join("\n");
}

async function ocrPdf(buffer, pasta) {
  const origem = join(pasta, "doc.pdf");
  writeFileSync(origem, buffer);
  await executar("pdftoppm", ["-r", "150", "-l", String(MAX_PAGINAS_OCR), "-png", origem, join(pasta, "pagina")], { timeout: 10 * 60 * 1000 });
  const paginas = readdirSync(pasta).filter((n) => n.startsWith("pagina")).sort();
  const textos = [];
  for (const pg of paginas) textos.push(await ocr(join(pasta, pg)));
  return textos.filter(Boolean).join("\n\n");
}

const TIPO_AUDIO = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4" };

async function transcreverOpenAI(caminho, ext = "mp3") {
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

// Fala de um vídeo ou áudio. Local (whisper.cpp) sempre que possível.
// Devolve { fala, nota }.
async function transcreverFala(arquivo, ext, pasta) {
  const temFfmpeg = await ffmpegDisponivel();
  if (temFfmpeg && (await temWhisper())) {
    const wav = join(pasta, "fala.wav");
    await ff(["-i", arquivo, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-t", String(MAX_MINUTOS_FALA * 60), wav]);
    const threads = String(Math.max(1, Math.min(availableParallelism(), 8)));
    await executar(WHISPER_BIN, ["-m", WHISPER_MODELO, "-f", wav, "-l", "pt", "-t", threads, "-nt", "-np", "-otxt", "-of", join(pasta, "fala")],
      { timeout: 60 * 60 * 1000, maxBuffer: 20 * MB });
    // O whisper marca trechos sem fala entre colchetes ("[Música]", "[Som de fone]").
    const fala = readFileSync(join(pasta, "fala.txt"), "utf8").replace(/\[[^\]]{0,60}\]|\([^)]{0,30}\)/g, " ").replace(/\s+/g, " ").trim();
    return { fala, nota: "fala transcrita na RYCS" };
  }
  if (transcricaoExterna()) {
    if (temFfmpeg) {
      const mp3 = join(pasta, "fala.mp3");
      await ff(["-i", arquivo, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", "-t", String(MAX_MINUTOS_FALA * 60), mp3]);
      return { fala: await transcreverOpenAI(mp3, "mp3"), nota: "fala transcrita" };
    }
    if (TIPO_AUDIO[ext] && statSync(arquivo).size <= MAX_AUDIO_TRANSCRICAO) return { fala: await transcreverOpenAI(arquivo, ext), nota: "fala transcrita" };
  }
  return { fala: "", nota: "fala não transcrita (transcrição indisponível no servidor)" };
}

// ---------------------------------------------------------------------------
// Pedidos à Claude, quando houver chave. `descrever(blocos, pedido)` vem de
// iaOnboarding.js; sem chave, é null e tudo segue pelo caminho interno.

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

// Texto longo: ficha pela Claude, se houver; senão, resumo extrativo.
async function fichaDeTexto(texto, descrever) {
  if (texto.length <= MAX_TEXTO_MATERIAL) return texto;
  if (descrever) {
    try { return await descrever([{ type: "text", text: texto.slice(0, MAX_TEXTO_PARA_FICHA) }], FICHA); } catch { /* segue interno */ }
  }
  return resumoExtrativo(texto, MAX_TEXTO_MATERIAL) || texto.slice(0, MAX_TEXTO_MATERIAL);
}

// ---------------------------------------------------------------------------
// Leitura de um material. Devolve { status, texto, leitura }:
// status: indexado | sem_texto | erro (erro é lido de novo na próxima vez).

export async function lerMaterial(m, { descrever = null } = {}) {
  const ext = extensaoDe(m.nome);
  if (!m.chave) return { status: "sem_texto", texto: "", leitura: "Sem arquivo." };
  if (FORMATOS_SEM_LEITURA.includes(ext))
    return { status: "sem_texto", texto: "", leitura: `Formato .${ext} não é lido. Exporte em PDF para aproveitar o conteúdo.` };

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
          if (ficha) return { status: "indexado", texto: ficha, leitura: "Lido com imagens e gráficos." };
        } catch { /* segue interno */ }
      }
      let texto = extrairTextoPdf(buffer).trim();
      let leitura = "Texto do PDF.";
      if (!texto && (await temPdftoppm()) && (await temTesseract())) {
        texto = (await ocrPdf(buffer, pasta)).trim();
        leitura = `PDF escaneado, lido por OCR (até ${MAX_PAGINAS_OCR} páginas).`;
      }
      if (!texto) return { status: "sem_texto", texto: "", leitura: "PDF sem texto legível." };
      return { status: "indexado", texto: await fichaDeTexto(texto, descrever), leitura };
    }

    if (TIPO_IMAGEM[ext]) {
      let buffer = await lerBuffer(m.chave);
      if (descrever) {
        let tipo = TIPO_IMAGEM[ext];
        let enviar = buffer;
        if (buffer.length > MAX_IMAGEM_IA && (await ffmpegDisponivel())) { enviar = await reduzirImagem(buffer, pasta); tipo = "image/jpeg"; }
        if (enviar.length <= MAX_IMAGEM_IA) {
          try {
            const descricao = await descrever([imagem(enviar, tipo)], FOTO);
            if (descricao) return { status: "indexado", texto: descricao, leitura: "Foto descrita." };
          } catch { /* segue interno */ }
        }
      }
      if (!(await temTesseract())) return { status: "sem_texto", texto: "", leitura: "Leitura de imagem indisponível no servidor." };
      const caminho = join(pasta, `foto.${ext}`);
      writeFileSync(caminho, buffer);
      buffer = null;
      const texto = await ocr(caminho);
      if (texto.length < 15) return { status: "sem_texto", texto: "", leitura: "Foto sem texto legível. A leitura interna aproveita o texto que aparece nas imagens." };
      return { status: "indexado", texto: `Texto na foto:\n${texto.slice(0, MAX_TEXTO_MATERIAL)}`, leitura: "Texto da foto lido por OCR." };
    }

    if (["mp4", "mov", "mp3", "wav", "m4a"].includes(ext)) {
      const video = ["mp4", "mov"].includes(ext);
      const arquivo = await baixarPara(m.chave, join(pasta, `original.${ext}`));
      const notas = [];

      let fala = "";
      try {
        const r = await transcreverFala(arquivo, ext, pasta);
        fala = r.fala;
        notas.push(r.nota);
      } catch (e) {
        notas.push(video ? "vídeo sem fala legível" : "fala não transcrita");
        console.warn(`[leitura] transcrição de ${m.id}: ${e.message}`);
      }

      if (!video) {
        if (!fala) return { status: "sem_texto", texto: "", leitura: `Áudio: ${notas.join("; ")}.` };
        return { status: "indexado", texto: await fichaDeTexto(`Transcrição do áudio:\n${fala}`, descrever), leitura: "Áudio transcrito." };
      }

      let quadros = [], dur = 0;
      if (await ffmpegDisponivel()) ({ quadros, dur } = await quadrosDoVideo(arquivo, pasta));
      else notas.push("quadros não extraídos (ffmpeg ausente)");

      if (descrever && (quadros.length || fala)) {
        try {
          const blocos = [
            ...quadros.map((q) => imagem(q)),
            { type: "text", text: [
              quadros.length ? `Acima: ${quadros.length} quadros do vídeo "${m.nome}", em ordem${dur ? `, ao longo de ${Math.round(dur)} segundos` : ""}.` : `Vídeo "${m.nome}" sem imagens extraídas.`,
              fala ? `Transcrição da fala:\n${fala.slice(0, MAX_TEXTO_PARA_FICHA)}` : "Sem transcrição da fala.",
            ].join("\n\n") },
          ];
          const ficha = await descrever(blocos, `${FICHA}\nInclua o que o vídeo mostra (demonstração, ambiente, textos na tela).`);
          if (ficha) return { status: "indexado", texto: ficha, leitura: `Vídeo lido: ${[`${quadros.length} quadros`, ...notas].join(", ")}.` };
        } catch { /* segue interno */ }
      }

      // Caminho interno: OCR do texto na tela + fala.
      let tela = [];
      if (quadros.length && (await temTesseract())) {
        const vistas = new Set();
        for (const [i, q] of quadros.entries()) {
          const caminho = join(pasta, `ocr-${i}.jpg`);
          writeFileSync(caminho, q);
          for (const linha of (await ocr(caminho)).split("\n")) {
            const chave = linha.toLowerCase().replace(/[^a-z0-9à-ú]/g, "");
            if (linha && !vistas.has(chave)) { vistas.add(chave); tela.push(linha); }
          }
        }
        notas.push(`${quadros.length} quadros lidos por OCR`);
      }
      const partes = [
        tela.length ? `Texto na tela:\n${tela.join("\n")}` : "",
        fala ? `Fala:\n${fala}` : "",
      ].filter(Boolean).join("\n\n");
      if (!partes) return { status: "sem_texto", texto: "", leitura: `Vídeo: ${notas.join("; ") || "nada legível"}.` };
      return { status: "indexado", texto: await fichaDeTexto(partes, null), leitura: `Vídeo: ${notas.join(", ")}.` };
    }

    return { status: "sem_texto", texto: "", leitura: "Formato não lido." };
  } catch (e) {
    console.warn(`[leitura] material ${m.id}: ${e.message}`);
    return { status: "erro", texto: "", leitura: "Não foi possível ler o arquivo." };
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

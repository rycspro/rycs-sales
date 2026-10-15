// Armazenamento de arquivos enviados pelas empresas (Marketing Academy).
//
// Em produção: bucket compatível com S3 (bucket da Railway). O arquivo nunca
// vai para o banco; o banco guarda só a chave e os metadados.
// Fora de produção, sem bucket configurado, grava em disco ao lado do banco,
// para dar para testar o fluxo inteiro localmente.
//
// Variáveis: S3_BUCKET, S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY
// (as mesmas de routes/uploads.js). Também aceita os nomes que a Railway cria
// ao conectar um bucket ao serviço: BUCKET, ENDPOINT, REGION,
// ACCESS_KEY_ID, SECRET_ACCESS_KEY.

import { createReadStream, createWriteStream, mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Transform } from "stream";
import { pipeline } from "stream/promises";

const env = (...nomes) => nomes.map((n) => process.env[n]).find(Boolean) || "";

function configS3() {
  const bucket = env("S3_BUCKET", "BUCKET");
  if (!bucket) return null;
  return {
    bucket,
    endpoint: env("S3_ENDPOINT", "ENDPOINT"),
    region: env("S3_REGION", "REGION") || "auto",
    accessKeyId: env("S3_ACCESS_KEY", "ACCESS_KEY_ID"),
    secretAccessKey: env("S3_SECRET_KEY", "SECRET_ACCESS_KEY"),
    pathStyle: env("S3_URL_STYLE") === "path",
  };
}

const PRODUCAO = process.env.NODE_ENV === "production";
const pastaLocal = () => process.env.ARQUIVOS_DIR
  || join(dirname(process.env.DB_PATH || join(dirname(fileURLToPath(import.meta.url)), "..", "data.db")), "arquivos");

export function armazenamentoDisponivel() {
  return !!configS3() || !PRODUCAO || !!process.env.ARQUIVOS_DIR;
}

let cliente = null;
async function s3() {
  if (cliente) return cliente;
  const c = configS3();
  const { S3Client } = await import("@aws-sdk/client-s3");
  cliente = new S3Client({
    region: c.region,
    endpoint: c.endpoint || undefined,
    forcePathStyle: c.pathStyle,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  return cliente;
}

export class ArquivoGrandeDemais extends Error {}

// Conta os bytes enquanto passam e interrompe se passar do limite. O tamanho
// declarado pelo navegador não basta: é o cliente quem diz.
function limitador(maxBytes) {
  let total = 0;
  const t = new Transform({
    transform(pedaco, _enc, cb) {
      total += pedaco.length;
      if (total > maxBytes) return cb(new ArquivoGrandeDemais("Arquivo maior que o limite."));
      cb(null, pedaco);
    },
  });
  t.total = () => total;
  return t;
}

// Grava o stream na chave. Devolve o tamanho real gravado.
export async function salvar(chave, origem, { contentType, maxBytes }) {
  const contador = limitador(maxBytes);
  const c = configS3();
  if (c) {
    const { Upload } = await import("@aws-sdk/lib-storage");
    const corpo = origem.pipe(contador);
    origem.on("error", (e) => corpo.destroy(e));
    const envio = new Upload({
      client: await s3(),
      params: { Bucket: c.bucket, Key: chave, Body: corpo, ContentType: contentType || "application/octet-stream" },
    });
    contador.on("error", () => envio.abort().catch(() => {}));
    await envio.done();
    return contador.total();
  }
  if (PRODUCAO && !process.env.ARQUIVOS_DIR) throw new Error("Armazenamento de arquivos não configurado.");
  const destino = join(pastaLocal(), chave);
  mkdirSync(dirname(destino), { recursive: true });
  try {
    await pipeline(origem, contador, createWriteStream(destino));
  } catch (e) {
    rmSync(destino, { force: true });
    throw e;
  }
  return contador.total();
}

// Lê o arquivo inteiro (só para documentos pequenos, na extração de texto).
export async function lerBuffer(chave, maxBytes = 60 * 1024 * 1024) {
  const c = configS3();
  let stream;
  if (c) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const r = await (await s3()).send(new GetObjectCommand({ Bucket: c.bucket, Key: chave }));
    stream = r.Body;
  } else {
    stream = createReadStream(join(pastaLocal(), chave));
  }
  const partes = [];
  let total = 0;
  for await (const p of stream) {
    total += p.length;
    if (total > maxBytes) throw new ArquivoGrandeDemais("Arquivo grande demais para leitura.");
    partes.push(p);
  }
  return Buffer.concat(partes);
}

export async function remover(chave) {
  const c = configS3();
  if (c) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await (await s3()).send(new DeleteObjectCommand({ Bucket: c.bucket, Key: chave }));
    return;
  }
  rmSync(join(pastaLocal(), chave), { force: true });
}

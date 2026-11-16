import { Router } from "express";
import { randomBytes } from "crypto";
import db, { uid, agora } from "../db.js";

const router = Router();

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/webm", "application/pdf"];

// Nome de arquivo do cliente nunca entra cru na chave S3: remove barras,
// "..", e qualquer caractere fora de um conjunto seguro.
export function sanitizarNome(nome) {
  const base = String(nome || "arquivo").replace(/[\\/]/g, "_").replace(/\.\.+/g, "_");
  return (base.replace(/[^\w.\- ]+/g, "_").trim() || "arquivo").slice(-120);
}

// Quem pode ver/baixar um upload: o próprio dono, o admin, ou — quando ligado a
// uma submissão — o vendedor/empresa participantes.
function podeVerUpload(req, up) {
  const { role, id, entityId } = req.user;
  if (role === "admin" || up.userId === id) return true;
  if (up.submissionId) {
    const sub = db.prepare("SELECT sellerId, companyId FROM submissions WHERE id = ?").get(up.submissionId);
    if (sub && ((role === "vendedor" && entityId === sub.sellerId) || (role === "empresa" && entityId === sub.companyId))) return true;
  }
  return false;
}

let s3Client = null;

async function getS3() {
  if (s3Client) return s3Client;
  if (!process.env.S3_BUCKET) return null;
  const { S3Client } = await import("@aws-sdk/client-s3");
  s3Client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
  });
  return s3Client;
}

router.post("/uploads/presign", async (req, res) => {
  const { filename, mimetype, size, submissionId } = req.body;

  if (!filename || !mimetype) return res.status(400).json({ error: "filename e mimetype são obrigatórios" });
  if (!ALLOWED_TYPES.includes(mimetype)) return res.status(400).json({ error: `Tipo ${mimetype} não permitido` });

  // `undefined > MAX_SIZE` é falso, então omitir o campo passava pela
  // validação. Agora o tamanho é obrigatório e precisa ser um número real —
  // ainda assim vem do cliente, então o limite de verdade tem de estar na
  // política do bucket.
  const tamanho = Number(size);
  if (!Number.isFinite(tamanho) || tamanho <= 0)
    return res.status(400).json({ error: "Tamanho do arquivo é obrigatório" });
  if (tamanho > MAX_SIZE) return res.status(400).json({ error: "Arquivo muito grande (máx 50MB)" });

  const s3 = await getS3();
  if (!s3) {
    const id = uid();
    db.prepare("INSERT INTO uploads (id, userId, submissionId, filename, mimetype, size, url, s3key, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      id, req.user.id, submissionId || null, sanitizarNome(filename), mimetype, tamanho, `local://${id}`, null, agora()
    );
    return res.json({ id, method: "local", message: "S3 não configurado. Em produção, configure S3_BUCKET." });
  }

  try {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

    // Identificador gerado pelo servidor + nome sanitizado: o cliente não
    // controla a chave (sem traversal/injeção).
    const key = `uploads/${req.user.id}/${Date.now()}-${randomBytes(6).toString("hex")}-${sanitizarNome(filename)}`;
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: mimetype,
    });

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
    const publicUrl = `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`;

    const id = uid();
    db.prepare("INSERT INTO uploads (id, userId, submissionId, filename, mimetype, size, url, s3key, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      id, req.user.id, submissionId || null, sanitizarNome(filename), mimetype, tamanho, publicUrl, key, agora()
    );

    res.json({ id, presignedUrl, publicUrl, method: "s3" });
  } catch (err) {
    console.error("Erro S3:", err.message);
    res.status(500).json({ error: "Erro ao gerar URL de upload" });
  }
});

router.get("/uploads", (req, res) => {
  const { submissionId } = req.query;
  if (submissionId) {
    // Os arquivos são vídeos de comprovação com nome e telefone de clientes
    // reais. Só quem participa da ação — vendedor, empresa contratante ou a
    // plataforma — pode vê-los.
    const sub = db.prepare("SELECT sellerId, companyId FROM submissions WHERE id = ?").get(submissionId);
    if (!sub) return res.status(404).json({ error: "Ação não encontrada" });

    const { role, entityId } = req.user;
    const podeVer =
      role === "admin" ||
      (role === "vendedor" && entityId === sub.sellerId) ||
      (role === "empresa" && entityId === sub.companyId);
    if (!podeVer) return res.status(403).json({ error: "Sem permissão" });

    const rows = db.prepare("SELECT * FROM uploads WHERE submissionId = ? ORDER BY criadoEm DESC").all(submissionId);
    return res.json(rows);
  }
  const rows = db.prepare("SELECT * FROM uploads WHERE userId = ? ORDER BY criadoEm DESC LIMIT 50").all(req.user.id);
  res.json(rows);
});

// Download por URL assinada e curta — apenas para quem tem permissão sobre o
// arquivo. Prepara a transição para bucket privado: o cliente deixa de usar a
// URL pública e passa a pedir uma URL assinada aqui.
router.get("/uploads/:id/url", async (req, res) => {
  const up = db.prepare("SELECT * FROM uploads WHERE id = ?").get(req.params.id);
  if (!up) return res.status(404).json({ error: "Arquivo não encontrado" });
  if (!podeVerUpload(req, up)) return res.status(403).json({ error: "Sem permissão" });

  const s3 = await getS3();
  // Sem S3 (ou sem chave): devolve a referência atual (compatibilidade).
  if (!s3 || !up.s3key) return res.json({ url: up.url, assinado: false });

  try {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: up.s3key }), { expiresIn: 300 });
    res.json({ url, assinado: true, expiraEm: 300 });
  } catch (err) {
    console.error("Erro ao assinar download:", err.message);
    res.status(500).json({ error: "Erro ao gerar link de download" });
  }
});

// Deriva a chave S3 a partir da URL pública legada (sem tocar nos arquivos).
export function derivarS3Key(url, endpoint = process.env.S3_ENDPOINT, bucket = process.env.S3_BUCKET) {
  if (!endpoint || !bucket || !url || url.startsWith("local://")) return null;
  const prefixo = `${endpoint}/${bucket}/`;
  return url.startsWith(prefixo) ? url.slice(prefixo.length) : null;
}

// Migração idempotente: preenche `s3key` dos uploads antigos para que o
// download assinado funcione quando o bucket for privado. Re-executável.
export function backfillS3Keys({ aplicar = true } = {}) {
  const rows = db.prepare("SELECT id, url FROM uploads WHERE s3key IS NULL AND url NOT LIKE 'local://%'").all();
  const upd = db.prepare("UPDATE uploads SET s3key = ? WHERE id = ?");
  let atualizados = 0;
  for (const r of rows) {
    const k = derivarS3Key(r.url);
    if (k) { if (aplicar) upd.run(k, r.id); atualizados++; }
  }
  return { candidatos: rows.length, atualizados, modo: aplicar ? "aplicado" : "simulacao" };
}

// Rota admin para disparar/simular a migração (?dry=1 só simula).
router.post("/admin/uploads/backfill-keys", (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito ao administrador." });
  res.json(backfillS3Keys({ aplicar: req.query.dry !== "1" }));
});

export default router;

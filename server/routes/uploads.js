import { Router } from "express";
import { randomBytes } from "crypto";
import db, { uid, agora } from "../db.js";

const router = Router();

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/webm", "application/pdf"];

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
  if (size > MAX_SIZE) return res.status(400).json({ error: "Arquivo muito grande (máx 50MB)" });

  const s3 = await getS3();
  if (!s3) {
    const id = uid();
    db.prepare("INSERT INTO uploads (id, userId, submissionId, filename, mimetype, size, url, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      id, req.user.id, submissionId || null, filename, mimetype, size || 0, `local://${id}`, agora()
    );
    return res.json({ id, method: "local", message: "S3 não configurado. Em produção, configure S3_BUCKET." });
  }

  try {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

    const key = `uploads/${req.user.id}/${Date.now()}-${randomBytes(4).toString("hex")}-${filename}`;
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: mimetype,
    });

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
    const publicUrl = `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`;

    const id = uid();
    db.prepare("INSERT INTO uploads (id, userId, submissionId, filename, mimetype, size, url, criadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      id, req.user.id, submissionId || null, filename, mimetype, size || 0, publicUrl, agora()
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

export default router;

import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente, assinar } from "./apoio/servidor.js";
import { derivarS3Key } from "../server/routes/uploads.js";

// V6 — Migração idempotente de referências legadas: preenche s3key a partir da
// URL pública, sem tocar nos arquivos. Rollback não precisa tornar nada público.

const EP = "https://s3.ex";
const BK = "meu-bucket";

test("derivarS3Key extrai a chave e ignora local://", () => {
  assert.equal(derivarS3Key(`${EP}/${BK}/uploads/u1/arq.png`, EP, BK), "uploads/u1/arq.png");
  assert.equal(derivarS3Key("local://abc", EP, BK), null);
  assert.equal(derivarS3Key("https://outro/x/y.png", EP, BK), null);
});

test("backfill preenche s3key dos uploads antigos (idempotente) e é admin-only", async (t) => {
  const { base, dbPath } = await subirServidor(t, { S3_ENDPOINT: EP, S3_BUCKET: BK });
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  await req("/auth/register", { body: { role: "vendedor", email: "upmig@exemplo.invalid", senha: "123456", aceitouTermos: true } });
  const uid = db.prepare("SELECT id FROM users WHERE email = 'upmig@exemplo.invalid'").get().id;
  const ag = Date.now();
  db.prepare("INSERT INTO uploads (id, userId, filename, mimetype, size, url, s3key, criadoEm) VALUES ('up1',?,'a.png','image/png',10,?,NULL,?)").run(uid, `${EP}/${BK}/uploads/u1/a.png`, ag);
  db.prepare("INSERT INTO uploads (id, userId, filename, mimetype, size, url, s3key, criadoEm) VALUES ('up2',?,'b.png','image/png',10,'local://up2',NULL,?)").run(uid, ag);

  const ckAdmin = assinar({ id: "admin-mig", role: "admin", entityId: null });

  // Simulação não grava.
  let r = await req("/admin/uploads/backfill-keys?dry=1", { cookie: ckAdmin, method: "POST", body: {} });
  assert.equal(r.corpo.atualizados, 1);
  assert.equal(db.prepare("SELECT s3key FROM uploads WHERE id='up1'").get().s3key, null, "dry-run não altera");

  // Aplica: só o upload com URL de bucket é migrado; local:// é ignorado.
  r = await req("/admin/uploads/backfill-keys", { cookie: ckAdmin, method: "POST", body: {} });
  assert.equal(r.corpo.atualizados, 1);
  assert.equal(db.prepare("SELECT s3key FROM uploads WHERE id='up1'").get().s3key, "uploads/u1/a.png");
  assert.equal(db.prepare("SELECT s3key FROM uploads WHERE id='up2'").get().s3key, null);

  // Idempotente: segunda execução não muda nada.
  r = await req("/admin/uploads/backfill-keys", { cookie: ckAdmin, method: "POST", body: {} });
  assert.equal(r.corpo.atualizados, 0, "re-execução não altera");

  // Admin-only.
  const reg = await req("/auth/register", { body: { role: "vendedor", email: "mig@exemplo.invalid", senha: "123456", aceitouTermos: true } });
  assert.equal((await req("/admin/uploads/backfill-keys", { cookie: reg.cookie, method: "POST", body: {} })).status, 403);
});

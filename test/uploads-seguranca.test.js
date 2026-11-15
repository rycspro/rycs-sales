import test from "node:test";
import assert from "node:assert/strict";
import { subirServidor, cliente } from "./apoio/servidor.js";
import { sanitizarNome } from "../server/routes/uploads.js";

// V6 — Uploads: nome sanitizado (sem traversal/injeção de chave) e download
// por URL com checagem de dono.

test("sanitizarNome remove barras e '..'", () => {
  assert.equal(sanitizarNome("../../etc/passwd").includes("/"), false);
  assert.equal(sanitizarNome("../../etc/passwd").includes(".."), false);
  assert.equal(sanitizarNome("foto boa.png"), "foto boa.png");
  assert.ok(sanitizarNome("a".repeat(500)).length <= 120);
});

test("download de upload exige permissão sobre o arquivo", async (t) => {
  const { base } = await subirServidor(t);
  const req = cliente(base);

  const regA = await req("/auth/register", { body: { role: "vendedor", email: "upA@exemplo.invalid", senha: "123456", aceitouTermos: true } });
  const regB = await req("/auth/register", { body: { role: "vendedor", email: "upB@exemplo.invalid", senha: "123456", aceitouTermos: true } });

  // Dono cria um upload (modo local — S3 desligado nos testes).
  const up = await req("/uploads/presign", { cookie: regA.cookie, body: { filename: "../../segredo.png", mimetype: "image/png", size: 1000 } });
  assert.equal(up.status, 200, JSON.stringify(up.corpo));
  const id = up.corpo.id;

  // Dono acessa a URL do próprio arquivo.
  let r = await req("/uploads/" + id + "/url", { cookie: regA.cookie });
  assert.equal(r.status, 200, "dono acessa");

  // Outro usuário não acessa.
  r = await req("/uploads/" + id + "/url", { cookie: regB.cookie });
  assert.equal(r.status, 403, "terceiro é bloqueado");

  // Arquivo inexistente → 404.
  r = await req("/uploads/inexistente/url", { cookie: regA.cookie });
  assert.equal(r.status, 404);
});

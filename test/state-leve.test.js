// O /state não pode carregar imagem nem arquivo embutido: logo da empresa,
// foto e currículo do profissional vão por URL. Banco temporário, servidor à parte.

import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente, assinar } from "./apoio/servidor.js";

const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
const logo = `data:image/png;base64,${PNG.toString("base64")}${"A".repeat(40_000)}`;

test("/state manda logo, foto e currículo por URL, e a logo é servida com cache", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const db = new Database(dbPath);
  t.after(() => db.close());
  const agora = Date.now();
  db.prepare("INSERT INTO companies (id, nome, produto, whatsapp, saldo, aportes, logo, visivel, criadoEm) VALUES ('e1', 'Emp', 'X', '1', 0, '[]', ?, 1, ?)").run(logo, agora);
  db.prepare("INSERT INTO sellers (id, nome, email, whats, foto, curriculo, criadoEm) VALUES ('s1', 'Ana', 'a@t.dev', '1', ?, ?, ?)").run(logo, `data:application/pdf;base64,${"B".repeat(200_000)}`, agora);
  db.prepare("INSERT INTO sellers (id, nome, email, whats, criadoEm) VALUES ('s2', 'Bia', 'b@t.dev', '1', ?)").run(agora);
  const req = cliente(base);

  for (const [quem, cookie] of [
    ["admin", assinar({ id: "u-a", role: "admin", entityId: "admin" })],
    ["vendedor", assinar({ id: "u-s1", role: "vendedor", entityId: "s1" })],
  ]) {
    const r = await req("/state", { cookie });
    assert.equal(r.status, 200, quem);
    const texto = JSON.stringify(r.corpo);
    assert.ok(!texto.includes("base64,"), `${quem}: nada embutido no /state`);
    assert.ok(texto.length < 30_000, `${quem}: /state leve (${texto.length} bytes)`);
    const emp = r.corpo.companies.find((c) => c.id === "e1");
    assert.match(emp.logo, /^\/api\/companies\/e1\/logo\?v=\w+$/, quem);
    const ana = r.corpo.sellers.find((s) => s.id === "s1");
    assert.equal(ana.foto, "/api/sellers/s1/foto", quem);
    if (quem === "admin") {
      assert.equal(ana.curriculo, "/api/sellers/s1/curriculo");
      assert.equal(r.corpo.sellers.find((s) => s.id === "s2").foto, null, "sem foto continua sem foto");
    }
  }

  const cookie = assinar({ id: "u-s1", role: "vendedor", entityId: "s1" });
  const est = await req("/state", { cookie });
  const url = est.corpo.companies.find((c) => c.id === "e1").logo;
  const img = await fetch(base.replace(/\/api$/, "") + url, { headers: { Cookie: cookie } });
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/png");
  assert.match(img.headers.get("cache-control"), /max-age=31536000/);
  assert.match(img.headers.get("content-security-policy"), /sandbox/);
  const bytes = Buffer.from(await img.arrayBuffer());
  assert.deepEqual(bytes.subarray(0, PNG.length), PNG);

  // Logo nova muda a URL, para o cache não mostrar a antiga.
  db.prepare("UPDATE companies SET logo = ? WHERE id = 'e1'").run(logo + "QUJD");
  const depois = (await req("/state", { cookie })).corpo.companies.find((c) => c.id === "e1").logo;
  assert.notEqual(depois, url);
  assert.equal((await fetch(base + "/companies/nao-existe/logo", { headers: { Cookie: cookie } })).status, 404);
});

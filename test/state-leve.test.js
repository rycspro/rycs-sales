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
    assert.match(emp.logo, /^\/api\/companies\/e1\/logo\?t=image&v=\w+$/, quem);
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

test("/state manda foto de prova e anexo de chat por endereço, e só quem pode abre", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const db = new Database(dbPath);
  t.after(() => db.close());
  const agora = Date.now();
  const foto = `data:image/jpeg;base64,${Buffer.from("foto-da-visita").toString("base64")}${"A".repeat(60_000)}`;
  const audio = `data:audio/webm;base64,${Buffer.from("audio-do-chat").toString("base64")}`;
  db.prepare("INSERT INTO companies (id, nome, produto, whatsapp, saldo, aportes, visivel, criadoEm) VALUES ('e1', 'Emp', 'X', '1', 0, '[]', 1, ?)").run(agora);
  db.prepare("INSERT INTO companies (id, nome, produto, whatsapp, saldo, aportes, visivel, criadoEm) VALUES ('e2', 'Outra', 'X', '1', 0, '[]', 1, ?)").run(agora);
  for (const id of ["s1", "s2"]) db.prepare("INSERT INTO sellers (id, nome, email, whats, criadoEm) VALUES (?, ?, ?, '1', ?)").run(id, id, `${id}@t.dev`, agora);
  const prova = { nome: "Cliente", evidencias: [{ slot: "foto", valor: foto, metadata: { latitude: -23.5 } }, { slot: "link", valor: "https://exemplo.com" }] };
  db.prepare("INSERT INTO submissions (id, sellerId, companyId, tipo, valor, prova, status, criadoEm) VALUES ('sub1', 's1', 'e1', 'visita', 5, ?, 'conferido', ?)").run(JSON.stringify(prova), agora);
  db.prepare("INSERT INTO messages (id, companyId, sellerId, de, texto, ts, anexo) VALUES ('m1', 'e1', 's1', 'empresa', '', ?, ?)").run(agora, JSON.stringify({ tipo: "audio", nome: "a.webm", dados: audio }));
  const req = cliente(base);
  const ck = {
    admin: assinar({ id: "u-a", role: "admin", entityId: "admin" }),
    empresa: assinar({ id: "u-e1", role: "empresa", entityId: "e1" }),
    vendedor: assinar({ id: "u-s1", role: "vendedor", entityId: "s1" }),
    outraEmpresa: assinar({ id: "u-e2", role: "empresa", entityId: "e2" }),
    outroVendedor: assinar({ id: "u-s2", role: "vendedor", entityId: "s2" }),
  };
  const abrir = (url, cookie, headers = {}) => fetch(base.replace(/\/api$/, "") + url, { headers: { Cookie: cookie, ...headers } });

  let urlFoto, urlAudio;
  for (const quem of ["admin", "empresa", "vendedor"]) {
    const r = await req("/state", { cookie: ck[quem] });
    assert.equal(r.status, 200, quem);
    assert.ok(!JSON.stringify(r.corpo).includes("base64,"), `${quem}: nada embutido`);
    const sub = r.corpo.submissions.find((x) => x.id === "sub1");
    assert.match(sub.prova.evidencias[0].valor, /^\/api\/submissions\/sub1\/midia\?c=evidencias\.0\.valor&t=image&v=\w+$/, quem);
    assert.equal(sub.prova.evidencias[1].valor, "https://exemplo.com", "link continua link");
    assert.equal(sub.prova.evidencias[0].metadata.latitude, -23.5, "metadados ficam");
    const anexo = JSON.parse(r.corpo.messages.find((m) => m.id === "m1").anexo);
    assert.equal(anexo.tipo, "audio");
    assert.match(anexo.dados, /^\/api\/messages\/m1\/anexo\?t=audio&v=\w+$/, quem);
    urlFoto = sub.prova.evidencias[0].valor; urlAudio = anexo.dados;
  }

  for (const quem of ["admin", "empresa", "vendedor"]) {
    const r = await abrir(urlFoto, ck[quem]);
    assert.equal(r.status, 200, quem);
    assert.equal(r.headers.get("content-type"), "image/jpeg");
    assert.ok(Buffer.from(await r.arrayBuffer()).subarray(0, 14).equals(Buffer.from("foto-da-visita")), quem);
  }
  for (const quem of ["outraEmpresa", "outroVendedor"]) {
    assert.equal((await abrir(urlFoto, ck[quem])).status, 403, `${quem} não vê a prova`);
    assert.equal((await abrir(urlAudio, ck[quem])).status, 403, `${quem} não ouve o anexo`);
  }

  // Pedido parcial (Safari) para áudio/vídeo.
  const parcial = await abrir(urlAudio, ck.vendedor, { Range: "bytes=0-4" });
  assert.equal(parcial.status, 206);
  assert.equal(Buffer.from(await parcial.arrayBuffer()).toString(), "audio");

  // Caminho que não é arquivo não vaza texto da prova.
  assert.equal((await abrir("/api/submissions/sub1/midia?c=nome", ck.admin)).status, 404);
  // GET /messages também entrega o anexo por endereço.
  const msgs = await req("/messages", { cookie: ck.empresa });
  assert.ok(!JSON.stringify(msgs.corpo).includes("base64,"));
});

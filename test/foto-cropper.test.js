import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, assinar } from "./apoio/servidor.js";

// Editor de enquadramento: a origem (sem recorte) é preservada e os parâmetros
// do recorte são guardados; reenquadrar não apaga a origem; o original é
// protegido por dono/admin.
test("Foto: original preservado, enquadramento salvo e acesso restrito", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const db = new Database(dbPath);
  db.pragma("foreign_keys = OFF");
  t.after(() => db.close());

  const seller = (id, email) => {
    db.prepare("INSERT INTO sellers (id, nome, email, whats, criadoEm) VALUES (?, ?, ?, ?, ?)")
      .run(id, "Prof " + id, email, "11999999999", Date.now());
    db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'vendedor', ?, ?)")
      .run("u-" + id, email, id, Date.now());
  };
  seller("s1", "s1@foto.invalid");
  seller("s2", "s2@foto.invalid");

  const tok1 = assinar({ id: "u-s1", role: "vendedor", entityId: "s1" });
  const tok2 = assinar({ id: "u-s2", role: "vendedor", entityId: "s2" });

  const req = async (path, { body, cookie, method } = {}) => {
    const r = await fetch(base + path, {
      method: method || (body !== undefined ? "POST" : "GET"),
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, corpo: r.headers.get("content-type")?.includes("json") ? await r.json().catch(() => null) : null, ctype: r.headers.get("content-type") };
  };

  // Upload de imagem NOVA (Trocar): guarda a origem e o enquadramento inicial.
  const up = await req("/sellers/s1/foto", {
    cookie: tok1,
    body: { base64: "QUFBQQ==", mimetype: "image/jpeg", largura: 600, altura: 600, original: { base64: "QkJCQg==", mimetype: "image/png" }, enquadramento: { zoom: 2, rotacao: 0 } },
  });
  assert.equal(up.status, 200);

  let row = db.prepare("SELECT foto, fotoOriginal, fotoEnquadramento FROM sellers WHERE id = 's1'").get();
  assert.match(row.foto, /^data:image\/jpeg;base64,/);
  assert.equal(row.fotoOriginal, "data:image/png;base64,QkJCQg==");
  assert.equal(JSON.parse(row.fotoEnquadramento).zoom, 2);

  // A origem é servida como imagem, só para o dono.
  const orig = await req("/sellers/s1/foto-original", { cookie: tok1 });
  assert.equal(orig.status, 200);
  assert.match(orig.ctype, /image\/png/);
  assert.equal((await req("/sellers/s1/foto-original", { cookie: tok2 })).status, 403);

  // Reenquadrar (Editar): mostra novo recorte SEM enviar original — a origem
  // permanece intacta e os parâmetros são atualizados.
  const recorte = await req("/sellers/s1/foto", {
    cookie: tok1,
    body: { base64: "Q0NDQw==", mimetype: "image/jpeg", largura: 600, altura: 600, enquadramento: { zoom: 3, rotacao: 90 } },
  });
  assert.equal(recorte.status, 200);
  row = db.prepare("SELECT fotoOriginal, fotoEnquadramento FROM sellers WHERE id = 's1'").get();
  assert.equal(row.fotoOriginal, "data:image/png;base64,QkJCQg==", "origem preservada");
  assert.equal(JSON.parse(row.fotoEnquadramento).rotacao, 90);

  // Sem original guardada, /foto-original cai na foto recortada (usuário antigo).
  db.prepare("UPDATE sellers SET fotoOriginal = '' WHERE id = 's1'");
  const fallback = await req("/sellers/s1/foto-original", { cookie: tok1 });
  assert.equal(fallback.status, 200);
});

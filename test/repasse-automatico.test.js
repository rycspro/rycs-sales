// Repasse automático: liberar tarefas manda o Pix sozinho para a chave do
// profissional, sem ele pedir saque. Servidor à parte, banco temporário e
// Asaas falso local.

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import Database from "better-sqlite3";
import { subirServidor, cliente, assinar } from "./apoio/servidor.js";

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = assinar({ id: "u-admin", role: "admin", entityId: "admin" });

function asaasFalso(t) {
  const transferencias = [];
  const s = http.createServer((req, res) => {
    let corpo = "";
    req.on("data", (d) => { corpo += d; });
    req.on("end", () => {
      let resposta = [404, { errors: [{ description: "rota falsa" }] }];
      if (req.method === "POST" && req.url === "/transfers") {
        const b = JSON.parse(corpo);
        transferencias.push(b);
        resposta = [200, { id: `tra_${transferencias.length}`, status: "DONE", value: b.value }];
      }
      res.writeHead(resposta[0], { "Content-Type": "application/json" });
      res.end(JSON.stringify(resposta[1]));
    });
  });
  s.listen(0);
  t.after(() => s.close());
  return { base: `http://127.0.0.1:${s.address().port}`, transferencias };
}

test("liberar manda o Pix sozinho; sem chave avisa; abaixo do mínimo guarda", async (t) => {
  const asaas = asaasFalso(t);
  const { base, dbPath } = await subirServidor(t, { ASAAS_API_KEY: "chave-falsa", ASAAS_BASE_URL_TESTE: asaas.base });
  const db = new Database(dbPath);
  t.after(() => db.close());
  const agora = Date.now();
  db.prepare("INSERT INTO companies (id, nome, produto, whatsapp, saldo, saldoReservado, totalAportado, aportes, criadoEm) VALUES ('e1', 'Emp', 'X', '1', 200, 200, 200, '[]', ?)").run(agora);
  const pessoas = [["comPix", "11999990000", "PHONE"], ["semPix", null, null], ["pouco", "a@b.dev", "EMAIL"]];
  for (const [id, pix, pixTipo] of pessoas) {
    db.prepare("INSERT INTO sellers (id, nome, email, whats, pix, pixTipo, criadoEm) VALUES (?, ?, ?, '1', ?, ?, ?)").run(id, id, `${id}@t.dev`, pix, pixTipo, agora);
    db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'vendedor', ?, ?)").run(`u-${id}`, `${id}@t.dev`, id, agora);
  }
  const criar = (id, sellerId) => db.prepare(
    "INSERT INTO submissions (id, sellerId, companyId, tipo, valor, liquido, status, criadoEm) VALUES (?, ?, 'e1', 'visita', 5, 4, 'conferido', ?)",
  ).run(id, sellerId, agora);
  ["a1", "a2", "a3"].forEach((id) => criar(id, "comPix"));
  ["b1", "b2", "b3"].forEach((id) => criar(id, "semPix"));
  criar("c1", "pouco"); // R$ 4: abaixo do mínimo de R$ 10

  const req = cliente(base);
  const liberar = (sellerId, ids) => req("/submissions/liberar-lote", { cookie: admin, body: { sellerId, ids } });
  assert.equal((await liberar("comPix", ["a1", "a2", "a3"])).status, 200);
  assert.equal((await liberar("semPix", ["b1", "b2", "b3"])).status, 200);
  assert.equal((await liberar("pouco", ["c1"])).status, 200);

  const vendedor = (id) => db.prepare("SELECT disponivel, sacado, pix FROM sellers WHERE id = ?").get(id);
  for (let i = 0; i < 30 && vendedor("comPix").sacado === 0; i++) await esperar(200);
  await esperar(400);

  // Com chave: os R$ 12 foram para a chave dele, sem pedir saque.
  assert.equal(asaas.transferencias.length, 1, "um Pix, só para quem tem chave e saldo acima do mínimo");
  assert.equal(asaas.transferencias[0].value, 12);
  assert.equal(asaas.transferencias[0].pixAddressKeyType, "PHONE");
  assert.deepEqual({ disponivel: vendedor("comPix").disponivel, sacado: vendedor("comPix").sacado }, { disponivel: 0, sacado: 12 });
  const saque = db.prepare("SELECT status, valor FROM withdrawals WHERE sellerId = 'comPix'").all();
  assert.deepEqual(saque, [{ status: "pago", valor: 12 }]);
  assert.ok(db.prepare("SELECT COUNT(*) n FROM notifications WHERE userId = 'u-comPix' AND titulo = 'Pix a caminho'").get().n >= 1);

  // Sem chave: saldo guardado e aviso para cadastrar.
  assert.equal(vendedor("semPix").disponivel, 12);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM withdrawals WHERE sellerId = 'semPix'").get().n, 0);
  assert.ok(db.prepare("SELECT COUNT(*) n FROM notifications WHERE userId = 'u-semPix' AND titulo = 'Cadastre sua chave Pix'").get().n >= 1);

  // Abaixo do mínimo: fica acumulando.
  assert.equal(vendedor("pouco").disponivel, 4);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM withdrawals WHERE sellerId = 'pouco'").get().n, 0);

  // Repetir a liberação não manda outro Pix.
  await liberar("comPix", ["a1", "a2", "a3"]);
  await esperar(600);
  assert.equal(asaas.transferencias.length, 1);
});

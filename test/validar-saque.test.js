// Validação automática de saque do Asaas: aprova só a transferência que bate
// com um saque registrado aqui. Servidor à parte, banco temporário, sem Asaas.

import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente } from "./apoio/servidor.js";

test("validar-saque: sem token funciona, token errado é barrado, só aprova saque nosso", async (t) => {
  const { base, dbPath } = await subirServidor(t, { ASAAS_WEBHOOK_TOKEN: "tok-certo" });
  const db = new Database(dbPath);
  t.after(() => db.close());
  db.prepare("INSERT INTO sellers (id, nome, email, whats, criadoEm) VALUES ('s1', 'Ana', 'a@t.dev', '1', ?)").run(Date.now());
  db.prepare("INSERT INTO withdrawals (id, sellerId, valor, pix, status, asaasId, criadoEm) VALUES ('w1', 's1', 50, 'chave', 'solicitado', 'tra_1', ?)").run(Date.now());
  const req = cliente(base);
  const validar = (transfer, headers = {}) => req("/payments/validar-saque", { headers, body: { type: "TRANSFER", transfer } });

  const semToken = await validar({ id: "tra_1", value: 50 });
  assert.equal(semToken.status, 200);
  assert.equal(semToken.corpo.status, "APPROVED", "saque nosso, mesmo valor, sem token: aprovado");

  assert.equal((await validar({ id: "tra_1", value: 50 }, { "asaas-access-token": "tok-certo" })).corpo.status, "APPROVED");
  assert.equal((await validar({ id: "tra_1", value: 50 }, { "asaas-access-token": "errado" })).status, 401, "token errado não passa");

  assert.equal((await validar({ id: "tra_x", value: 50 })).corpo.status, "REFUSED", "transferência sem saque: recusada");
  assert.equal((await validar({ id: "tra_1", value: 500 })).corpo.status, "REFUSED", "valor diferente: recusada");
  assert.equal((await req("/payments/validar-saque", { body: { type: "BILL", transfer: { id: "tra_1" } } })).corpo.status, "REFUSED", "outro tipo: recusado");
  assert.equal(db.prepare("SELECT status FROM withdrawals WHERE id = 'w1'").get().status, "solicitado", "a validação não altera o saque");
});

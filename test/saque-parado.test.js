// Saque parado em "solicitado": em até 5 minutos termina pago ou com o valor
// de volta. Servidor real à parte, banco temporário e um Asaas falso local.

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import Database from "better-sqlite3";
import { subirServidor } from "./apoio/servidor.js";

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function asaasFalso(t, responder) {
  const s = http.createServer((req, res) => {
    const [status, json] = responder(req);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(json));
  });
  s.listen(0);
  t.after(() => s.close());
  return `http://127.0.0.1:${s.address().port}`;
}

test("saque parado há mais de 5 min: pago, recusado, cancelado e devolvido, ou espera se não dá para cancelar", async (t) => {
  const cancelados = [];
  const STATUS = { tra_pago: "DONE", tra_recusado: "FAILED", tra_parado: "PENDING", tra_a_caminho: "BANK_PROCESSING", tra_novo: "PENDING" };
  const baseAsaas = asaasFalso(t, (req) => {
    const id = req.url.split("/").pop();
    if (req.method === "DELETE") {
      if (id === "tra_a_caminho") return [400, { errors: [{ description: "Transferência não pode ser cancelada" }] }];
      cancelados.push(id);
      return [200, { deleted: true, id }];
    }
    return STATUS[id] ? [200, { id, status: STATUS[id] }] : [404, { errors: [{ description: "não existe" }] }];
  });
  const { dbPath } = await subirServidor(t, { ASAAS_API_KEY: "chave-falsa", ASAAS_BASE_URL_TESTE: baseAsaas, SAQUES_PARADOS_INTERVALO_MS: "300" });
  const db = new Database(dbPath);
  t.after(() => db.close());

  const ha10min = Date.now() - 10 * 60 * 1000;
  db.prepare("INSERT INTO sellers (id, nome, email, whats, disponivel, sacado, criadoEm) VALUES ('s1', 'Ana', 'a@t.dev', '1', 0, 0, ?)").run(ha10min);
  const saque = (id, asaasId, valor, criadoEm = ha10min) =>
    db.prepare("INSERT INTO withdrawals (id, sellerId, valor, pix, status, asaasId, criadoEm) VALUES (?, 's1', ?, 'chave', 'solicitado', ?, ?)").run(id, valor, asaasId, criadoEm);
  saque("w_pago", "tra_pago", 10);
  saque("w_recusado", "tra_recusado", 20);
  saque("w_parado", "tra_parado", 30);
  saque("w_a_caminho", "tra_a_caminho", 40);
  saque("w_novo", "tra_novo", 50, Date.now()); // pedido agora: ainda dentro dos 5 minutos

  const status = (id) => db.prepare("SELECT status FROM withdrawals WHERE id = ?").get(id).status;
  for (let i = 0; i < 40 && (status("w_pago") === "solicitado" || status("w_parado") === "solicitado"); i++) await esperar(200);

  assert.equal(status("w_pago"), "pago", "Pix concluído: pago");
  assert.equal(status("w_recusado"), "falhou", "recusado: devolvido");
  assert.equal(status("w_parado"), "falhou", "parado: cancelado no banco e devolvido");
  assert.deepEqual(cancelados, ["tra_parado"], "só cancela no banco o que ainda está processando");
  assert.equal(status("w_a_caminho"), "solicitado", "banco não deixou cancelar: não devolve (evita pagar duas vezes)");
  assert.equal(status("w_novo"), "solicitado", "dentro dos 5 minutos: não mexe");

  const ana = db.prepare("SELECT disponivel, sacado FROM sellers WHERE id = 's1'").get();
  assert.equal(ana.disponivel, 50, "voltaram 20 (recusado) + 30 (parado)");
  assert.equal(ana.sacado, 10, "só o pago conta como sacado");

  // Rodadas seguintes não devolvem de novo.
  await esperar(900);
  assert.equal(db.prepare("SELECT disponivel FROM sellers WHERE id = 's1'").get().disponivel, 50);
  assert.ok(db.prepare("SELECT falhaMotivo FROM withdrawals WHERE id = 'w_parado'").get().falhaMotivo.includes("5 minutos"));
});

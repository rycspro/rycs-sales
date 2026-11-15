import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente } from "./apoio/servidor.js";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const TOKEN = "token-webhook-concorrencia";

// (A) Idempotência sob concorrência: vários eventos do Asaas para o MESMO
// pagamento (inclusive tipos diferentes), disparados em paralelo, creditam o
// caixa uma única vez — a trava está no INSERT único do ledger.
test("webhooks simultâneos do mesmo pagamento creditam o caixa uma só vez", async (t) => {
  const { base, dbPath } = await subirServidor(t, { ASAAS_WEBHOOK_TOKEN: TOKEN });
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  await req("/auth/register", { body: { role: "empresa", email: "conc@exemplo.invalid", senha: "12345678", whats: "11912345678", nome: "Conc SA", logo: { mimetype: "image/png", base64: PNG }, aceitouTermos: true } });
  const companyId = db.prepare("SELECT entityId FROM users WHERE email = 'conc@exemplo.invalid'").get().entityId;

  const payment = { id: "pay_conc_1", value: 200, externalReference: companyId };
  const enviar = (event) => req("/payments/webhook", { headers: { "asaas-access-token": TOKEN }, body: { event, payment } });

  // Dois tipos distintos + repetições, tudo em paralelo.
  await Promise.all([
    enviar("PAYMENT_CONFIRMED"),
    enviar("PAYMENT_RECEIVED"),
    enviar("PAYMENT_RECEIVED"),
    enviar("PAYMENT_CONFIRMED"),
    enviar("PAYMENT_RECEIVED"),
  ]);

  const emp = db.prepare("SELECT saldo, totalAportado FROM companies WHERE id = ?").get(companyId);
  assert.equal(emp.saldo, 200, "creditado uma única vez sob concorrência");
  assert.equal(emp.totalAportado, 200);
  const linhas = db.prepare("SELECT COUNT(*) n FROM financial_ledger WHERE tipo='deposito' AND idempotencyKey = ?").get(payment.id).n;
  assert.equal(linhas, 1, "um único lançamento no ledger");
});

// (B) Sem gasto duplo: saques simultâneos que somados excedem o saldo não
// podem sacar o mesmo saldo duas vezes nem deixar o saldo negativo.
test("saques simultâneos não consomem o mesmo saldo duas vezes", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  const r = await req("/auth/register", { body: { role: "vendedor", email: "saqueconc@exemplo.invalid", senha: "123456", aceitouTermos: true } });
  const ck = r.cookie;
  const sellerId = db.prepare("SELECT entityId FROM users WHERE email = 'saqueconc@exemplo.invalid'").get().entityId;
  db.prepare("UPDATE sellers SET disponivel = 100, pix = 'chave-pix', pixTipo = 'aleatoria' WHERE id = ?").run(sellerId);

  // Três saques de 80 em paralelo sobre saldo de 100: só um pode passar.
  const resultados = await Promise.all([
    req("/payments/withdraw", { cookie: ck, body: { valor: 80 } }),
    req("/payments/withdraw", { cookie: ck, body: { valor: 80 } }),
    req("/payments/withdraw", { cookie: ck, body: { valor: 80 } }),
  ]);

  const ok = resultados.filter((x) => x.status === 200).length;
  const recusados = resultados.filter((x) => x.status === 400).length;
  assert.equal(ok, 1, "exatamente um saque é aceito");
  assert.equal(recusados, 2, "os outros dois são recusados por saldo");

  const atual = db.prepare("SELECT disponivel FROM sellers WHERE id = ?").get(sellerId).disponivel;
  assert.equal(atual, 20, "debitou um único saque (100 - 80)");
  assert.ok(atual >= 0, "saldo nunca fica negativo");

  const saques = db.prepare("SELECT COUNT(*) n FROM withdrawals WHERE sellerId = ?").get(sellerId).n;
  assert.equal(saques, 1, "um único saque registrado");
});

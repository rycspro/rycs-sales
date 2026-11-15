import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { subirServidor, cliente } from "./apoio/servidor.js";

// Auditoria crítica é DURÁVEL e ATÔMICA com a operação financeira: o registro
// de saque é gravado na MESMA transação do débito. Saque recusado não deixa
// nem débito nem trilha; saque aceito deixa os dois.

test("trilha crítica de saque é atômica com o débito", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const req = cliente(base);
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  t.after(() => db.close());

  const reg = await req("/auth/register", { body: { role: "vendedor", email: "aud@exemplo.invalid", senha: "123456", aceitouTermos: true } });
  const ck = reg.cookie;
  const id = db.prepare("SELECT entityId FROM users WHERE email = 'aud@exemplo.invalid'").get().entityId;
  db.prepare("UPDATE sellers SET disponivel = 30, pix = 'c', pixTipo = 'aleatoria' WHERE id = ?").run(id);

  const trilhas = () => db.prepare("SELECT COUNT(*) n FROM security_audit WHERE acao = 'saque_solicitado' AND alvo = ?").get(id).n;
  const saques = () => db.prepare("SELECT COUNT(*) n FROM withdrawals WHERE sellerId = ?").get(id).n;

  // Saque além do saldo → recusado: nenhum débito e nenhuma trilha.
  let r = await req("/payments/withdraw", { cookie: ck, body: { valor: 100 } });
  assert.equal(r.status, 400);
  assert.equal(trilhas(), 0, "saque recusado não gera trilha");
  assert.equal(saques(), 0, "saque recusado não gera registro");
  assert.equal(db.prepare("SELECT disponivel FROM sellers WHERE id = ?").get(id).disponivel, 30, "saldo intacto");

  // Saque válido → débito e trilha juntos (atômicos).
  r = await req("/payments/withdraw", { cookie: ck, body: { valor: 30 } });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  assert.equal(trilhas(), 1, "saque aceito gera exatamente uma trilha");
  assert.equal(saques(), 1, "saque aceito gera exatamente um registro");

  // A trilha não expõe dados sensíveis (sem a chave Pix completa em claro).
  const ev = db.prepare("SELECT contexto FROM security_audit WHERE acao = 'saque_solicitado' AND alvo = ?").get(id);
  assert.ok(!String(ev.contexto).includes("123456"), "sem senha na trilha");
});

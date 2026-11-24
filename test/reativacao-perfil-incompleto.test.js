import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "rycs-reat-"));
Object.assign(process.env, { DB_PATH: join(dir, "test.db"), JWT_SECRET: "segredo-teste-reat", NODE_ENV: "test", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "" });
const { default: db } = await import("../server/db.js");
const seq = await import("../server/services/sequenciasEmail.js");
test.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

const ts = Date.now();
const seller = (id, inativoEm, motivo) => {
  db.prepare("INSERT INTO sellers (id, nome, email, whats, status, criadoEm, inativoEm, inativoMotivo) VALUES (?, ?, ?, '', 'aprovado', ?, ?, ?)")
    .run(id, id, `${id}@x.invalid`, ts, inativoEm, motivo);
  db.prepare("INSERT INTO users (id, email, senha, role, entityId, criadoEm) VALUES (?, ?, 'x', 'vendedor', ?, ?)").run(`u-${id}`, `${id}@x.invalid`, id, ts);
};
const conta = (id) => db.prepare("SELECT inativoEm, inativoMotivo FROM sellers WHERE id = ?").get(id);

test("reativa só quem a regra de perfil incompleto inativou, sem aviso, e guarda a lista", () => {
  seller("a", ts - 1000, "perfil_incompleto");
  seller("b", ts - 2000, "perfil_incompleto");
  seller("c", ts - 3000, "outro_motivo");
  seller("d", null, "");
  assert.equal(seq.reativarInativadosPorPerfil(ts), 2);
  for (const id of ["a", "b", "d"]) assert.deepEqual(conta(id), { inativoEm: null, inativoMotivo: "" });
  assert.equal(conta("c").inativoEm, ts - 3000, "outro motivo fica como está");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM notifications").get().n, 0);
  const registro = JSON.parse(db.prepare("SELECT valor FROM email_sequencia_config WHERE chave LIKE 'reativacao_perfil_incompleto:%'").get().valor);
  assert.deepEqual(registro.map((c) => [c.id, c.inativoEm]).sort(), [["a", ts - 1000], ["b", ts - 2000]]);
  // Sem ninguém para reativar, a próxima subida não faz nada.
  assert.equal(seq.reativarInativadosPorPerfil(ts + 1), 0);
});

test("perfil incompleto com aviso vencido não inativa mais", async () => {
  db.prepare("INSERT INTO email_sequencia_envios (id, chave, sequencia, destinatarioTipo, destinatarioId, email, status, enviadoEm) VALUES ('e1', 'onboarding:aviso_inativacao', 'onboarding', 'vendedor', 'a', 'a@x.invalid', 'enviado', ?)")
    .run(ts - 10 * 24 * 60 * 60 * 1000);
  // 2h UTC = 23h em Brasília: fora da janela, a rodada não envia nada.
  const r = await seq.rodada(Date.UTC(2026, 10, 25, 2));
  assert.deepEqual(r, { enviados: 0, foraDaJanela: true });
  assert.equal(conta("a").inativoEm, null);
});

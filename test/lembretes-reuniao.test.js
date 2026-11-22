import test from "node:test";
import assert from "node:assert/strict";
import { cronogramaLembretes, mensagemLembrete, horarioSilencioso, MODELOS_LEMBRETE } from "../shared/lembretesReuniao.js";

const HORA = 3600000;
const brasilia = (y, m, d, h, min = 0) => Date.UTC(y, m - 1, d, h + 3, min); // UTC−3

test("reunião na segunda 10h marcada na sexta 8h: confirmação, 48h, 24h, 2h e 1h antes (sem madrugada)", () => {
  const inicio = brasilia(2027, 1, 18, 10);
  const agora = brasilia(2027, 1, 15, 8);
  const lista = cronogramaLembretes(inicio, agora);
  assert.deepEqual(lista.map((l) => l.tipo), ["confirmacao", "lembrete-48h", "lembrete-24h", "em-breve-2h", "em-breve-1h"]);
  assert.equal(lista[0].enviarEm, agora);
  assert.equal(lista.at(-1).enviarEm, inicio - HORA);
  assert.ok(lista.every((l) => !horarioSilencioso(l.enviarEm)));
});

test("reunião às 8h: o de 2h antes (6h) não sai; o de 1h antes (7h) sai", () => {
  const inicio = brasilia(2027, 1, 19, 8);
  const tipos = cronogramaLembretes(inicio, brasilia(2027, 1, 18, 9)).map((l) => l.tipo);
  assert.ok(!tipos.includes("em-breve-2h"));
  assert.ok(tipos.includes("em-breve-1h"));
});

test("marcada 3 horas antes: confirmação e os avisos de 2h e 1h; nenhum lembrete de 12h colado", () => {
  const inicio = brasilia(2027, 1, 18, 15);
  const tipos = cronogramaLembretes(inicio, inicio - 3 * HORA).map((l) => l.tipo);
  assert.deepEqual(tipos, ["confirmacao", "em-breve-2h", "em-breve-1h"]);
});

test("textos: variáveis do modelo e e-mail com data e hora de Brasília, nome escapado", () => {
  const inicio = brasilia(2027, 1, 18, 10);
  const c = mensagemLembrete("confirmacao", { nome: "Ana <b>Souza</b>", inicio, telefone: "(11) 91234-5678" }, brasilia(2027, 1, 15, 8));
  assert.deepEqual(c.variaveis, ["Ana", "segunda-feira, 18/01", "10:00"]);
  assert.match(c.assunto, /segunda-feira, 18\/01, às 10:00/);
  const l = mensagemLembrete("lembrete-24h", { nome: "<i>Bia</i>", inicio }, inicio - 24 * HORA);
  assert.deepEqual(l.variaveis, ["<i>Bia</i>", "amanhã", "10:00"]);
  assert.ok(l.paragrafos.join("").includes("&lt;i&gt;Bia&lt;/i&gt;"));
  const b = mensagemLembrete("em-breve-1h", { nome: "Caio", inicio }, inicio - HORA);
  assert.deepEqual(b.variaveis, ["Caio", "1 hora", "10:00"]);
  for (const m of Object.values(MODELOS_LEMBRETE)) assert.equal(m.exemplo.length, 3);
});

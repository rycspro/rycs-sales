import test from "node:test";
import assert from "node:assert/strict";

// O wrapper existe por causa de um incidente real: ler localStorage no
// primeiro estado do componente raiz derrubava o app inteiro quando o
// navegador bloqueava o armazenamento. Estes testes fixam o contrato de que
// nada aqui lança, em nenhum cenário.

async function carregar({ storage }) {
  global.window = { localStorage: storage };
  // Cada caso precisa do módulo novo: ele guarda em memória se o
  // armazenamento está disponível.
  const mod = await import(`../src/lib/armazenamento.js?t=${Math.random()}`);
  return mod;
}

const memoria = () => {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
  };
};

const explode = () => ({
  get getItem() { throw new Error("acesso negado"); },
  get setItem() { throw new Error("acesso negado"); },
  get removeItem() { throw new Error("acesso negado"); },
});

test("com armazenamento normal, lê e grava", async () => {
  const { ler, gravar, remover, armazenamentoDisponivel } = await carregar({ storage: memoria() });
  assert.equal(armazenamentoDisponivel(), true);
  assert.equal(gravar("tema", "dark"), true);
  assert.equal(ler("tema"), "dark");
  remover("tema");
  assert.equal(ler("tema", "padrao"), "padrao");
});

test("navegador que bloqueia armazenamento não derruba nada", async () => {
  // Safari privado, webview de aplicativo, dados de site bloqueados: o acesso
  // à própria API lança. Antes isso quebrava a renderização da raiz.
  const { ler, gravar, remover, armazenamentoDisponivel } = await carregar({ storage: explode() });
  assert.equal(armazenamentoDisponivel(), false);
  assert.equal(ler("tema", "dark"), "dark", "deve cair no padrão");
  assert.equal(gravar("tema", "light"), false, "deve falhar sem lançar");
  assert.equal(remover("tema"), false);
});

test("cota estourada no setItem não lança", async () => {
  const cheio = { ...memoria(), setItem: (k) => { if (k !== "__rycs_teste__") throw new Error("QuotaExceeded"); } };
  const { gravar } = await carregar({ storage: cheio });
  assert.equal(gravar("grande", "x".repeat(100)), false);
});

test("JSON inválido devolve o padrão em vez de lançar", async () => {
  const s = memoria();
  s.setItem("rascunho", "{isso não é json");
  const { lerJson } = await carregar({ storage: s });
  assert.deepEqual(lerJson("rascunho", { vazio: true }), { vazio: true });
});

test("valor ausente devolve o padrão, e string vazia é valor válido", async () => {
  const s = memoria();
  s.setItem("vazio", "");
  const { ler } = await carregar({ storage: s });
  assert.equal(ler("nao-existe", "padrao"), "padrao");
  assert.equal(ler("vazio", "padrao"), "", "string vazia foi gravada de propósito");
});

test("gravarJson sobrevive a estrutura circular", async () => {
  const { gravarJson } = await carregar({ storage: memoria() });
  const circular = {}; circular.ele = circular;
  assert.equal(gravarJson("x", circular), false);
});

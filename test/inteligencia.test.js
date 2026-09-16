import test from "node:test";
import assert from "node:assert/strict";
import { leituraEmpresa, leituraProfissional } from "../server/services/inteligencia.js";

// O motor escreve texto que vai à frente de decisão sobre pessoa e sobre
// dinheiro. Três propriedades precisam valer sempre, e todas são fáceis de
// quebrar sem perceber ao mexer no texto.

const empresaBase = {
  identidade: { nome: "Ativa Contábil", segmento: "—" },
  oferta: {
    produto: "Contabilidade para prestadores",
    icp: "Autônomos abrindo CNPJ e MEIs migrando para ME",
    ticket: "R$ 320/mês",
  },
  operacao: { campanhasTotais: 0 },
  conduta: { acoesRecebidas: 0, taxaAprovacao: null, horasMediasParaDecidir: null },
  perfilIdeal: {
    faixaDeTicket: "Ticket baixo",
    ticketEstimado: 320,
    exigeDaOperacao: "Volume alto e ciclo curto. Pede vendedor de cadência, não de negociação longa.",
    funcoesQueAbriu: [],
    sugestao: "SDR ou PAP",
  },
  alertas: [],
};

test("a leitura preserva sigla que o usuário escreveu", () => {
  const t = leituraEmpresa(empresaBase);
  // Emendar no meio da frase não pode destruir sigla: um .toLowerCase() cru
  // transformaria CNPJ em cnpj e o texto perderia credibilidade na hora.
  assert.match(t, /CNPJ/);
  assert.match(t, /MEIs/);
  assert.match(t, /ME\b/);
  assert.doesNotMatch(t, /cnpj/);
});

test("a leitura não achata maiúscula depois de ponto interno", () => {
  const t = leituraEmpresa(empresaBase);
  assert.match(t, /Volume alto e ciclo curto\. Pede vendedor/);
  assert.doesNotMatch(t, /\. pede /);
});

test("contagem de ações concorda em número", () => {
  const uma = leituraEmpresa({ ...empresaBase, conduta: { acoesRecebidas: 1, taxaAprovacao: 100, horasMediasParaDecidir: 5 } });
  const varias = leituraEmpresa({ ...empresaBase, conduta: { acoesRecebidas: 3, taxaAprovacao: 100, horasMediasParaDecidir: 5 } });
  assert.match(uma, /Recebeu 1 ação,/);
  assert.match(varias, /Recebeu 3 ações,/);
  assert.doesNotMatch(varias, /ação\(ões\)/);
});

test("mesma entrada gera exatamente o mesmo texto", () => {
  // A propriedade central do motor: sem isso, dois cadastros iguais receberiam
  // pareceres diferentes e nenhuma decisão seria defensável depois.
  assert.equal(leituraEmpresa(empresaBase), leituraEmpresa(structuredClone(empresaBase)));
});

test("faixa de ticket muda o encaixe sugerido", () => {
  const alto = leituraEmpresa({
    ...empresaBase,
    perfilIdeal: { ...empresaBase.perfilIdeal, faixaDeTicket: "Ticket alto", ticketEstimado: 38000, sugestao: "Closer" },
  });
  assert.match(alto, /Ticket alto/);
  assert.match(alto, /Closer/);
});

test("campo ausente vira declaração de ausência, nunca suposição", () => {
  const semProduto = leituraEmpresa({ ...empresaBase, oferta: { ...empresaBase.oferta, produto: "—" } });
  assert.match(semProduto, /não declarou o que vende/);
});

test("profissional sem dossiê não gera texto inventado", () => {
  assert.equal(leituraProfissional(null), null);
  assert.equal(leituraProfissional({}), null);
});

test("profissional pronto é descrito como autônomo na função", () => {
  const t = leituraProfissional({
    resumo: { score: 92 },
    categorias: [
      { chave: "prospeccao", nome: "Prospecção", valor: 88 },
      { chave: "disciplina", nome: "Disciplina", valor: 80 },
      { chave: "negociacao", nome: "Negociação", valor: 60 },
    ],
    funcoes: [{ funcao: "sdr", nome: "SDR", veredito: "pronto", cobertura: 100, itens: [{ atende: true }, { atende: true }] }],
    declarado: { ticketMaximo: "Até 2 mil", capacidadeDiaria: "40", formatos: [] },
    alertas: [],
  });
  assert.match(t, /Perfil de SDR/);
  assert.match(t, /opera sozinho/);
  assert.match(t, /prospecção em 88%/);
});

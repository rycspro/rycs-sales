import test from "node:test";
import assert from "node:assert/strict";
import { PERGUNTAS_QUALIFICACAO, qualificarLead, classificar, perguntasDoFormulario } from "../shared/qualificacaoEmpresa.js";

// Como a Meta devolve as perguntas próprias: chave e resposta em minúsculas, com "_".
const comoMeta = (t) => t.toLowerCase().replace(/\s+/g, "_");

test("nota é a média dos critérios e a classificação segue a nota", () => {
  const outros = { company_name: "Exemplo Climatização" };
  const escolhas = [0, 0, 1, 0, 1, 2, 2, 1, 1, 0, 1, 1, 0]; // índice da opção em cada pergunta
  PERGUNTAS_QUALIFICACAO.forEach((p, i) => { outros[comoMeta(p.pergunta)] = comoMeta(p.opcoes[escolhas[i]][0]); });
  outros[comoMeta("Qual o segmento da sua empresa?")] = comoMeta("Serviços");

  const q = qualificarLead(outros);
  const esperado = PERGUNTAS_QUALIFICACAO.reduce((s, p, i) => s + p.opcoes[escolhas[i]][1], 0) / PERGUNTAS_QUALIFICACAO.length;
  assert.equal(q.respondidas, 13);
  assert.equal(q.nota, Math.round(esperado * 10) / 10);
  assert.equal(q.segmento, "Serviços");
  assert.equal(q.criterios[0].criterio, "Necessidade comercial");
  assert.equal(q.criterios[0].resposta, "Sim, é a prioridade agora");
  assert.equal(q.classificacao, classificar(q.nota).nome);
});

test("faixas: 4 ou mais é alta, de 3 a 3,9 é média, abaixo de 3 é baixa", () => {
  assert.equal(classificar(4.2).nome, "Alta prioridade");
  assert.equal(classificar(4).nome, "Alta prioridade");
  assert.equal(classificar(3.5).nome, "Média prioridade");
  assert.equal(classificar(2.9).nome, "Baixa prioridade");
});

test("chave cortada e resposta com acento diferente ainda casam", () => {
  const p = PERGUNTAS_QUALIFICACAO[10]; // faturamento
  const q = qualificarLead({ [comoMeta(p.pergunta).slice(0, 20)]: "acima_de_r$_100_mil" });
  assert.equal(q.respondidas, 1);
  assert.equal(q.nota, 5);
});

test("lead sem perguntas de qualificação (ex.: profissionais) fica sem nota", () => {
  assert.equal(qualificarLead({ whatsapp_number: "+91 98765 43210" }), null);
  assert.equal(qualificarLead({}), null);
  assert.equal(qualificarLead({ [comoMeta(PERGUNTAS_QUALIFICACAO[0].pergunta)]: "resposta_que_nao_existe" }), null);
});

test("formulário criado pela plataforma: chaves únicas e lead dele recebe nota", () => {
  const perguntas = perguntasDoFormulario();
  const proprias = perguntas.filter((p) => p.type === "CUSTOM");
  assert.equal(proprias.length, 14);
  assert.equal(new Set(proprias.map((p) => p.key)).size, 14);
  for (const p of proprias) {
    assert.match(p.key, /^[a-z0-9_]+$/);
    assert.equal(new Set(p.options.map((o) => o.key)).size, p.options.length);
  }
  // A Meta devolve a chave da pergunta; a resposta pode vir como chave ou texto da opção.
  for (const comoResposta of [(o) => o.key, (o) => o.value]) {
    const outros = { company_name: "Exemplo" };
    for (const p of proprias) outros[p.key] = comoResposta(p.options[0]);
    const q = qualificarLead(outros);
    assert.equal(q.respondidas, 13);
    assert.equal(q.nota, 5);
    assert.equal(q.segmento, "Serviços");
  }
});

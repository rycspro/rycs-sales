import test from "node:test";
import assert from "node:assert/strict";
import { agruparCampanhas, chaveDia, tipoPeloNome, SEM_CAMPANHA } from "../shared/campanhas.js";

const dia1 = Date.parse("2026-11-10T15:00:00-03:00");
const dia2 = Date.parse("2026-11-11T15:00:00-03:00");
const prof = (campanha, conjunto, anuncio) => ({ utm_source: "facebook", utm_campaign: campanha, utm_term: conjunto, utm_content: anuncio });

const visitantes = [
  { origem: prof("PROF-IN", "Mumbai", "Video A"), papel: "vendedor", em: dia1 },
  { origem: prof("PROF-IN", "Mumbai", "Video A"), papel: "", em: dia1 },
  { origem: prof("PROF-IN", "Delhi", "Video B"), papel: "vendedor", em: dia2 },
  { origem: prof("EMP-GLOBAL", "Donos", "Carrossel"), papel: "empresa", em: dia1 },
];
const contas = [
  { origem: prof("PROF-IN", "Mumbai", "Video A"), papel: "vendedor", pais: "IN", criadoEm: dia1, marcos: { email: true, perfil: dia1, candidatura: null } },
  { origem: prof("PROF-IN", "Delhi", "Video B"), papel: "vendedor", pais: "IN", criadoEm: dia2, marcos: { email: false } },
  { origem: prof("EMP-GLOBAL", "Donos", "Carrossel"), papel: "empresa", pais: "US", criadoEm: dia2, marcos: { email: true, saldo: dia2 }, depositos: { USD: 250 } },
];
const gastos = [
  { campanha: "PROF-IN", conjunto: "Mumbai", anuncio: "Video A", gasto: 30, impressoes: 1000, cliques: 40 },
  { campanha: "PROF-IN", conjunto: "Delhi", anuncio: "Video B", gasto: 10, impressoes: 400, cliques: 9 },
  { campanha: "EMP-GLOBAL", conjunto: "Donos", anuncio: "Carrossel", gasto: 50, impressoes: 900, cliques: 12 },
  { campanha: "Prof BR novembro", conjunto: "Brasil", anuncio: "Img 1", gasto: 5, impressoes: 100, cliques: 2 },
];
const gastosDia = [{ campanha: "PROF-IN", dia: "2026-11-10", gasto: 30 }, { campanha: "PROF-IN", dia: "2026-11-11", gasto: 10 }];

test("campanhas de profissionais: só as do tipo, com contas, marcos, países e gasto", () => {
  const r = agruparCampanhas({ tipo: "vendedor", visitantes, contas, gastos, gastosDia });
  assert.deepEqual(r.campanhas.map((c) => c.nome), ["PROF-IN", "Prof BR novembro"], "EMP-GLOBAL é de empresas; a sem dados entra pelo nome");
  const c = r.campanhas[0];
  assert.equal(c.tipo, "vendedor");
  assert.equal(c.visitas, 3);
  assert.equal(c.abriram, 2);
  assert.equal(c.contas, 2);
  assert.deepEqual(c.marcos, { email: 1, perfil: 1 });
  assert.deepEqual(c.paises, { IN: 2 });
  assert.equal(c.gasto, 40);
  assert.equal(c.custoPorConta, 20);
  // Ordem: mais contas, depois mais visitas (Mumbai teve 2).
  assert.deepEqual(c.conjuntos.map((s) => [s.nome, s.contas, s.gasto]), [["Mumbai", 1, 30], ["Delhi", 1, 10]]);
  assert.deepEqual(c.dias, [
    { dia: "2026-11-10", visitas: 2, contas: 1, leads: 0, gasto: 30 },
    { dia: "2026-11-11", visitas: 1, contas: 1, leads: 0, gasto: 10 },
  ]);
  assert.equal(r.total.contas, 2);
  assert.equal(r.total.gasto, 45);
});

test("campanhas de empresas: depósito por moeda e sem gasto vira custo nulo", () => {
  const r = agruparCampanhas({ tipo: "empresa", visitantes, contas });
  assert.deepEqual(r.campanhas.map((c) => c.nome), ["EMP-GLOBAL"]);
  const c = r.campanhas[0];
  assert.deepEqual(c.marcos, { email: 1, saldo: 1 });
  assert.deepEqual(c.depositos, { USD: 250 });
  assert.deepEqual(c.paises, { US: 1 });
  assert.equal(c.custoPorConta, null);
  assert.equal(r.total.temGasto, false);
});

test("sem UTM a conta cai em '(sem campanha)'; dia no fuso de Brasília; tipo pelo nome", () => {
  const r = agruparCampanhas({ tipo: "vendedor", contas: [{ origem: { fbclid: "x" }, papel: "vendedor", pais: "BR", criadoEm: dia1, marcos: {} }] });
  assert.equal(r.campanhas[0].nome, SEM_CAMPANHA);
  assert.equal(chaveDia(Date.parse("2026-11-11T01:30:00Z")), "2026-11-10");
  assert.equal(tipoPeloNome("Cadastro Profissionais Índia"), "vendedor");
  assert.equal(tipoPeloNome("Empresas mundo"), "empresa");
  assert.equal(tipoPeloNome("Black Friday"), "");
});

test("leads de formulário instantâneo entram por campanha, com custo por lead e quantos viraram conta", () => {
  const leads = [
    { campanha: "[SELLERS] [INDIA]", conjunto: "[INDIA] [INGLES] [TODOS]", anuncio: "Ad 1", em: dia1, conta: true },
    { campanha: "[SELLERS] [INDIA]", conjunto: "[INDIA] [INGLES] [TODOS]", anuncio: "Ad 1", em: dia1, conta: false },
    { campanha: "[SELLERS] [INDIA]", conjunto: "[INDIA] [INGLES] [TODOS]", anuncio: "Ad 2", em: dia2, conta: false },
    { campanha: "[COMPANIES] [WORLD]", conjunto: "x", anuncio: "y", em: dia2, conta: false },
  ];
  const gastosForm = [{ campanha: "[SELLERS] [INDIA]", conjunto: "[INDIA] [INGLES] [TODOS]", anuncio: "Ad 1", gasto: 3, impressoes: 10, cliques: 2 }];
  const r = agruparCampanhas({ tipo: "vendedor", leads, gastos: gastosForm });
  assert.deepEqual(r.campanhas.map((c) => c.nome), ["[SELLERS] [INDIA]"], "[COMPANIES] é campanha de empresas");
  const c = r.campanhas[0];
  assert.equal(c.leads, 3);
  assert.equal(c.leadsConta, 1);
  assert.equal(c.custoPorLead, 1);
  assert.deepEqual(c.dias.map((d) => [d.dia, d.leads]), [["2026-11-10", 2], ["2026-11-11", 1]]);
  assert.equal(agruparCampanhas({ tipo: "empresa", leads }).campanhas[0].nome, "[COMPANIES] [WORLD]");
});

test("campos do formulário: padrão da Meta, nome em duas partes e perguntas próprias", async () => {
  const { lerCamposLead, chaveTelefone } = await import("../shared/campanhas.js");
  assert.deepEqual(lerCamposLead([
    { name: "first_name", values: ["Ravi"] }, { name: "last_name", values: ["Kumar"] },
    { name: "email", values: [" Ravi@Exemplo.IN "] }, { name: "phone_number", values: ["+91 98765-43210"] },
    { name: "years_of_experience", values: ["3"] }, { name: "vazio", values: [""] },
  ]), { nome: "Ravi Kumar", email: "ravi@exemplo.in", telefone: "+91 98765-43210", cidade: "", pais: "", outros: { years_of_experience: "3" } });
  assert.deepEqual(lerCamposLead("lixo"), { nome: "", email: "", telefone: "", cidade: "", pais: "", outros: {} });
  assert.equal(chaveTelefone("+91 98765-43210"), "9876543210");
});

import test from "node:test";
import assert from "node:assert/strict";
import { camposPendentesEmpresa, campanhaPodeSerPublicada, requisitosPublicacao, saldoDisponivel } from "../shared/empresa.js";
import { planoDe, dentroDoLimite } from "../shared/planos.js";

const empresaPronta = {
  nome: "Nexo", razaoSocial: "Nexo Ltda", documento: "12345678000190", endereco: "São Paulo",
  representanteLegal: "Maria", contatoFinanceiro: "financeiro@nexo.com", contatoComercial: "vendas@nexo.com",
  produto: "CRM", segmento: "SaaS", icp: "Empresas B2B", statusCadastro: "aprovada",
  assinatura: "starter", saldo: 5000, saldoReservado: 1000,
};

test("cadastro empresarial completo não tem pendências", () => {
  assert.deepEqual(camposPendentesEmpresa(empresaPronta), []);
});

test("saldo disponível desconta reservas", () => {
  assert.equal(saldoDisponivel(empresaPronta), 4000);
});

test("campanha pronta pode ser publicada", () => {
  const campanha = { titulo: "Piloto", objetivo: "Agendar", publico: "B2B", regiao: "Brasil", cidade: "São Paulo", estado: "SP", funcao: "sdr", orcamento: 2000, tarefas: { agendamento: 80 }, treinamento: [{ titulo: "Produto" }], etapasPipeline: [{ id: "novo", nome: "Novo" }] };
  assert.deepEqual(campanhaPodeSerPublicada(campanha, empresaPronta), { ok: true, pendencias: [] });
});

test("qualquer tarefa remunerada atende o requisito de publicação", () => {
  const campanha = { titulo: "Prospecção", objetivo: "Contato", publico: "B2B", regiao: "Brasil", cidade: "São Paulo", estado: "SP", funcao: "bdr", orcamento: 1000, tarefas: { ligacao: 5 }, treinamento: [{ titulo: "Produto" }], etapasPipeline: [{ id: "novo", nome: "Novo" }] };
  assert.equal(campanhaPodeSerPublicada(campanha, empresaPronta).ok, true);
});

test("campanha sem caixa ou treinamento fica bloqueada", () => {
  const campanha = { titulo: "Piloto", objetivo: "Agendar", publico: "B2B", regiao: "Brasil", funcao: "sdr", orcamento: 2000, tarefas: { agendamento: 80 }, treinamento: [] };
  const resultado = campanhaPodeSerPublicada(campanha, { ...empresaPronta, saldoReservado: 5000 });
  assert.equal(resultado.ok, false);
  assert.ok(resultado.pendencias.includes("caixa sem saldo disponível"));
  assert.ok(resultado.pendencias.includes("treinamento"));
});

test("planos seguem preços e taxas aprovados no plano de produto", () => {
  assert.deepEqual([planoDe("starter").preco, planoDe("starter").takeRate], [499, 0.30]);
  assert.deepEqual([planoDe("growth").preco, planoDe("growth").takeRate], [999.90, 0.15]);
  assert.deepEqual([planoDe("scale").preco, planoDe("scale").takeRate], [2700, 0.07]);
  assert.equal(dentroDoLimite("starter", "campanhasAtivas", 0), true);
  assert.equal(dentroDoLimite("starter", "campanhasAtivas", 1), false);
});

// Campanha completa: o que falta nos testes abaixo é sempre da empresa.
const campanha = { titulo: "Piloto", objetivo: "Agendar", publico: "B2B", regiao: "Brasil", cidade: "São Paulo", estado: "SP", funcao: "sdr", orcamento: 2000, tarefas: { agendamento: 80 }, treinamento: [{ titulo: "Produto" }], etapasPipeline: [{ id: "novo", nome: "Novo" }] };

test("premium não vê plano no checklist, mas precisa de caixa como todos", () => {
  // Premium não paga mensalidade, então "Plano ativo" não se aplica a ela.
  // Mas o pós-pago foi removido da plataforma: premium também só roda campanha
  // com saldo em caixa — os itens de caixa aparecem no checklist, e sem saldo
  // ela não publica.
  const premium = { statusCadastro: "aprovada", tipoEmpresa: "premium", saldo: 0 };
  const rotulos = requisitosPublicacao(campanha, premium).map((r) => r.label);
  assert.equal(rotulos.includes("Plano ativo"), false);
  assert.equal(rotulos.includes("Caixa com saldo"), true);
  assert.equal(rotulos.includes("Orçamento"), true);
  assert.equal(rotulos.includes("Empresa aprovada"), true);
  assert.equal(campanhaPodeSerPublicada(campanha, premium).ok, false);
});

test("checklist e regra de publicação nunca discordam", () => {
  const empresa = { statusCadastro: "rascunho", assinatura: "free", saldo: 0 };
  const reprovados = requisitosPublicacao(campanha, empresa).filter((r) => !r.ok).map((r) => r.pendencia);
  assert.deepEqual(reprovados, campanhaPodeSerPublicada(campanha, empresa).pendencias);
});

test("sem caixa ninguém publica; com caixa premium publica sem precisar de plano", () => {
  const base = { statusCadastro: "aprovada", assinatura: "free" };
  // Pós-pago removido: sem saldo, nem premium nem padrão publicam.
  assert.equal(campanhaPodeSerPublicada(campanha, { ...base, tipoEmpresa: "premium", saldo: 0 }).ok, false);
  assert.equal(campanhaPodeSerPublicada(campanha, { ...base, tipoEmpresa: "padrao", saldo: 0 }).ok, false);
  // Com caixa suficiente, premium publica sem plano pago (não paga mensalidade);
  // padrão continua barrado pelo plano free.
  assert.equal(campanhaPodeSerPublicada(campanha, { ...base, tipoEmpresa: "premium", saldo: 5000 }).ok, true);
  assert.equal(campanhaPodeSerPublicada(campanha, { ...base, tipoEmpresa: "padrao", saldo: 5000 }).ok, false);
});

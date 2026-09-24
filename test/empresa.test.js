import test from "node:test";
import assert from "node:assert/strict";
import { camposPendentesEmpresa, campanhaPodeSerPublicada, saldoDisponivel } from "../shared/empresa.js";
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
  const campanha = { titulo: "Piloto", objetivo: "Agendar", publico: "B2B", regiao: "Brasil", funcao: "sdr", orcamento: 2000, tarefas: { agendamento: 80 }, treinamento: [{ titulo: "Produto" }] };
  assert.deepEqual(campanhaPodeSerPublicada(campanha, empresaPronta), { ok: true, pendencias: [] });
});

test("qualquer tarefa remunerada atende o requisito de publicação", () => {
  const campanha = { titulo: "Prospecção", objetivo: "Contato", publico: "B2B", regiao: "Brasil", funcao: "bdr", orcamento: 1000, tarefas: { ligacao: 5 }, treinamento: [{ titulo: "Produto" }] };
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

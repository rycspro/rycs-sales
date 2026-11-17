import test from "node:test";
import assert from "node:assert/strict";
import {
  PLANOS_PROFISSIONAL, PERMISSOES, pode, limite, desconto, planoDoProfissional,
  estenderPeriodo, periodoDaCota, avaliarConsumo, ordenarComDesempate, BENEFICIOS_VITRINE,
  mensalidadeProfissional, valorProfissionalNoCiclo,
} from "../shared/planosProfissional.js";
import { SAQUE_MINIMO, saqueMinimoPara } from "../shared/saque.js";
import { PLANOS } from "../shared/planos.js";

const AGORA = Date.UTC(2026, 10, 17, 12);
const DIA = 86_400_000;

test("mensalidade cheia em reais vem de um lugar só", () => {
  assert.equal(PLANOS_PROFISSIONAL.gratis.preco, 0);
  assert.equal(PLANOS_PROFISSIONAL.pro.preco, 29.9);
  assert.equal(PLANOS_PROFISSIONAL.premium.preco, 69.9);
});

test("ciclos seguem a regra da empresa: semestral -15%, anual -30%", () => {
  assert.equal(valorProfissionalNoCiclo("pro", "MENSAL"), 29.9);
  assert.equal(mensalidadeProfissional("pro", "SEMESTRAL"), 25.42);
  assert.equal(valorProfissionalNoCiclo("pro", "SEMESTRAL"), 152.52);
  assert.equal(mensalidadeProfissional("pro", "ANUAL"), 20.93);
  assert.equal(valorProfissionalNoCiclo("pro", "ANUAL"), 251.16);
  assert.equal(valorProfissionalNoCiclo("premium", "MENSAL"), 69.9);
  assert.equal(valorProfissionalNoCiclo("premium", "SEMESTRAL"), 356.52);
  assert.equal(valorProfissionalNoCiclo("premium", "ANUAL"), 587.16);
  assert.equal(valorProfissionalNoCiclo("pro", "qualquer"), 29.9); // ciclo inválido = mensal
});

test("planos da empresa continuam separados", () => {
  assert.equal(PLANOS.pro, undefined);
  assert.notEqual(PLANOS.premium?.preco, 497);
});

test("grátis segue completo para trabalhar: perfil, candidatura e saque não são permissão de plano", () => {
  for (const r of ["perfil", "candidaturas", "saques", "candidatura", "saque"])
    assert.equal(PERMISSOES[r], undefined, `${r} não pode depender de plano`);
});

test("sem bônus de comissão em nenhum plano", () => {
  assert.equal(Object.keys(PERMISSOES).some((k) => /comiss/i.test(k)), false);
});

test("pode/limite/desconto por recurso", () => {
  assert.equal(pode("gratis", "etiquetaPro"), false);
  assert.equal(pode("pro", "etiquetaPro"), true);
  assert.equal(pode("pro", "mentoriaGrupoMensal"), false);
  assert.equal(pode("premium", "mentoriaGrupoMensal"), true);
  assert.equal(limite("pro", "treinadorIA"), Infinity);
  assert.equal(desconto("pro", "descontoCertAvancada"), 0.3);
  assert.equal(pode("inexistente", "etiquetaPro"), false, "plano desconhecido vira grátis");
  assert.throws(() => pode("pro", "recursoQueNaoExiste"));
});

test("número pendente (null) deixa o recurso desligado", () => {
  assert.equal(limite("pro", "minutosDiscadora"), null);
  assert.equal(pode("pro", "minutosDiscadora"), false);
  assert.equal(pode("premium", "lembretesWhatsApp"), false);
  assert.equal(desconto("pro", "descontoTrilhaChallenger"), 0);
});

test("Top Talent e carta exigem a etiqueta dourada além do Premium", () => {
  assert.equal(pode("premium", "vitrineTopTalent"), false);
  assert.equal(pode("premium", "vitrineTopTalent", { etiquetaDourada: true }), true);
  assert.equal(pode("pro", "vitrineTopTalent", { etiquetaDourada: true }), false);
});

test("sem assinatura = grátis", () => {
  assert.equal(planoDoProfissional([], AGORA).plano, "gratis");
});

test("ativa e cancelada valem até o fim do que foi pago", () => {
  const ate = AGORA + 10 * DIA;
  assert.equal(planoDoProfissional([{ id: "a", plano: "pro", status: "ativa", pagoAte: ate }], AGORA).plano, "pro");
  assert.equal(planoDoProfissional([{ id: "a", plano: "pro", status: "cancelada", pagoAte: ate }], AGORA).plano, "pro");
  assert.equal(planoDoProfissional([{ id: "a", plano: "pro", status: "cancelada", pagoAte: AGORA - 1 }], AGORA).plano, "gratis");
});

test("reembolsada, expirada e pendente não dão benefício", () => {
  for (const status of ["reembolsada", "expirada", "pendente"])
    assert.equal(planoDoProfissional([{ plano: "premium", status, pagoAte: AGORA + DIA }], AGORA).plano, "gratis", status);
});

test("atrasada: sem carência definida cai no fim do período; com carência, segue", () => {
  const a = [{ plano: "pro", status: "atrasada", pagoAte: AGORA - DIA }];
  assert.equal(planoDoProfissional(a, AGORA).plano, "gratis");
  assert.equal(planoDoProfissional(a, AGORA, 5).plano, "pro");
});

test("com duas válidas, vale a maior", () => {
  const r = planoDoProfissional([
    { id: "p", plano: "pro", status: "ativa", pagoAte: AGORA + 300 * DIA },
    { id: "m", plano: "premium", status: "cancelada", pagoAte: AGORA + 10 * DIA },
  ], AGORA);
  assert.equal(r.plano, "premium");
  assert.equal(r.assinaturaId, "m");
});

test("período anual conta do vencimento e não encurta quem renova antes", () => {
  const venc = Date.UTC(2026, 10, 17);
  assert.equal(estenderPeriodo(null, venc), Date.UTC(2027, 10, 17));
  assert.equal(estenderPeriodo(Date.UTC(2027, 0, 1), venc), Date.UTC(2028, 0, 1));
});

test("período mensal e semestral somam os meses do ciclo", () => {
  const venc = Date.UTC(2026, 10, 17);
  assert.equal(estenderPeriodo(null, venc, "MENSAL"), Date.UTC(2026, 11, 17));
  assert.equal(estenderPeriodo(null, venc, "SEMESTRAL"), Date.UTC(2027, 4, 17));
  assert.equal(estenderPeriodo(null, venc, "anual"), Date.UTC(2027, 10, 17));
});

test("cota conta por mês no fuso de Brasília", () => {
  assert.equal(periodoDaCota(Date.UTC(2026, 11, 1, 2)), "2026-11"); // 23h de 30/11 em Brasília
  assert.equal(periodoDaCota(Date.UTC(2026, 11, 1, 4)), "2026-12");
});

test("cota: pendente bloqueia, avisa a 80% e a 100% uma vez, recusa acima do limite", () => {
  assert.equal(avaliarConsumo({ limite: null, usado: 0 }).ok, false);
  assert.equal(avaliarConsumo({ limite: 0, usado: 0 }).motivo, "sem_cota");
  assert.equal(avaliarConsumo({ limite: 10, usado: 7, qtd: 1 }).aviso, 80);
  assert.equal(avaliarConsumo({ limite: 10, usado: 7, qtd: 1, avisado80: true }).aviso, null);
  assert.equal(avaliarConsumo({ limite: 10, usado: 9, qtd: 1, avisado80: true }).aviso, 100);
  const r = avaliarConsumo({ limite: 10, usado: 9, qtd: 2 });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "esgotada");
  assert.equal(avaliarConsumo({ limite: Infinity, usado: 500 }).ok, true);
});

test("desempate nunca passa por cima do Score", () => {
  const lista = [{ id: "a", nota: 89 }, { id: "b", nota: 81 }, { id: "c", nota: 79 }];
  const pro = (s) => s.id !== "a";
  assert.deepEqual(ordenarComDesempate(lista, pro, null).map((s) => s.id), ["a", "b", "c"], "tolerância pendente = intacto");
  // Faixas de 10: a e b na faixa 8, c na 7. b (Pro) passa a; c nunca passa ninguém da faixa de cima.
  assert.deepEqual(ordenarComDesempate(lista, pro, 10).map((s) => s.id), ["b", "a", "c"]);
});

test("saque mínimo por plano só baixa o piso", () => {
  assert.equal(saqueMinimoPara(null), SAQUE_MINIMO);
  assert.equal(saqueMinimoPara(5), 5);
  assert.equal(saqueMinimoPara(50), SAQUE_MINIMO);
});

test("vitrine não promete vendas nem ganho", () => {
  const textos = BENEFICIOS_VITRINE.flatMap((b) => [b.texto, b.pro, b.premium, b.gratis]).filter((x) => typeof x === "string").join(" ");
  assert.equal(/mais vendas|garant|ganhe mais|venda mais/i.test(textos), false);
});

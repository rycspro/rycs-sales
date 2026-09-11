import test from "node:test";
import assert from "node:assert/strict";
import { normalizarPolitica, politicaValida, estagiosNecessarios, POLITICAS_PADRAO } from "../shared/audit/politica.js";
import { pontuar, explicar, RESULTADOS } from "../shared/audit/scoring.js";
import { decidir, DECISOES, COBERTURA_MINIMA } from "../shared/audit/decisao.js";
import { distanciaMetros, avaliarGeo } from "../shared/audit/geo.js";
import { validarVisao, validarTranscricao, validarSemantica } from "../server/services/audit/providers/contratos.js";

const politica = normalizarPolitica({
  nome: "Teste", tipo: "visita", versao: 1,
  limiares: { aprovar: 70, revisar: 50 },
  criterios: [
    { chave: "obrigatorio", descricao: "Campos", fonte: "deterministico", peso: 20, obrigatorio: true },
    { chave: "geo", descricao: "Distância", fonte: "geo", peso: 40, confiancaMinima: 0.5 },
    { chave: "visao", descricao: "Ambiente", fonte: "visao", peso: 40, confiancaMinima: 0.7 },
  ],
});

const ok = (c = 1) => ({ resultado: RESULTADOS.atendido, confianca: c });
const nao = (c = 1) => ({ resultado: RESULTADOS.negado, confianca: c });

// --- Policy Engine ------------------------------------------------------

test("política inválida é recusada com o motivo", () => {
  assert.equal(politicaValida({ tipo: "", criterios: [] }).valida, false);
  const dup = politicaValida({ tipo: "visita", criterios: [{ chave: "a", peso: 10 }, { chave: "a", peso: 10 }] });
  assert.equal(dup.valida, false);
  assert.ok(dup.erros.some((e) => /mesma chave/.test(e)));
});

test("limiar de revisão acima do de aprovação é corrigido a favor da revisão", () => {
  const p = normalizarPolitica({ tipo: "visita", criterios: [{ chave: "a", peso: 10 }], limiares: { aprovar: 60, revisar: 90 } });
  assert.equal(p.limiares.revisar, 60);
});

test("estágios necessários saem da política, não de lista fixa", () => {
  assert.deepEqual(estagiosNecessarios(politica), ["deterministico", "geo", "visao"]);
  const soDeterministico = normalizarPolitica({ tipo: "x", criterios: [{ chave: "a", fonte: "deterministico", peso: 10 }] });
  assert.deepEqual(estagiosNecessarios(soDeterministico), ["deterministico"]);
});

test("as políticas padrão da plataforma são válidas", () => {
  for (const p of POLITICAS_PADRAO) {
    const check = politicaValida(p);
    assert.equal(check.valida, true, `${p.nome}: ${check.erros.join(" ")}`);
  }
});

// --- Scoring Engine -----------------------------------------------------

test("peso de critério inconclusivo sai do denominador", () => {
  // Sem o estágio de visão, a nota é calculada só sobre o que foi verificado.
  // Contar o peso não verificado puniria o profissional por indisponibilidade
  // da plataforma.
  const r = pontuar({ politica, veredictos: { obrigatorio: ok(), geo: ok() } });
  assert.equal(r.score, 100);
  assert.equal(r.pesoAvaliado, 60);
  assert.equal(r.cobertura, 60);
});

test("critério abaixo da confiança mínima vira inconclusivo, não negado", () => {
  const r = pontuar({ politica, veredictos: { obrigatorio: ok(), geo: ok(), visao: ok(0.5) } });
  const item = r.itens.find((i) => i.chave === "visao");
  assert.equal(item.resultado, RESULTADOS.inconclusivo);
  assert.match(item.motivo, /abaixo do mínimo/);
  assert.equal(r.pesoAvaliado, 60);
});

test("sem nenhum critério conclusivo não existe nota, e zero não é resposta", () => {
  const r = pontuar({ politica, veredictos: {} });
  assert.equal(r.score, null);
  assert.equal(r.itens.every((i) => i.resultado === RESULTADOS.inconclusivo), true);
});

test("nota é a proporção ponderada do que foi atendido", () => {
  const r = pontuar({ politica, veredictos: { obrigatorio: ok(), geo: nao(), visao: ok(0.9) } });
  assert.equal(r.pesoAvaliado, 100);
  assert.equal(r.pesoAtendido, 60);
  assert.equal(r.score, 60);
});

test("explicação separa aprovado, problema e não verificado", () => {
  const r = pontuar({ politica, veredictos: { obrigatorio: ok(), geo: nao(), visao: ok(0.1) } });
  const e = explicar(r);
  assert.deepEqual(e.aprovado.map((i) => i.chave), ["obrigatorio"]);
  assert.deepEqual(e.problemas.map((i) => i.chave), ["geo"]);
  assert.deepEqual(e.naoVerificado.map((i) => i.chave), ["visao"]);
});

// --- Decision Engine ----------------------------------------------------

test("falha de provedor externo nunca reprova o profissional", () => {
  const r = pontuar({ politica, veredictos: { obrigatorio: nao(), geo: nao(), visao: nao() } });
  const d = decidir({ politica, resultado: r, errosDeEstagio: [{ estagio: "visao" }] });
  assert.equal(d.decisao, DECISOES.revisao);
  assert.match(d.detalhe, /falha nossa não reprova/i);
});

test("obrigatório negado reprova, obrigatório inconclusivo manda para revisão", () => {
  const negado = pontuar({ politica, veredictos: { obrigatorio: nao(), geo: ok(), visao: ok(0.9) } });
  assert.equal(decidir({ politica, resultado: negado }).decisao, DECISOES.recusado);

  const inconclusivo = pontuar({ politica, veredictos: { geo: ok(), visao: ok(0.9) } });
  assert.equal(decidir({ politica, resultado: inconclusivo }).decisao, DECISOES.revisao);
});

test("cobertura baixa não aprova sozinha mesmo com nota alta", () => {
  // Só o obrigatório verificado: nota 100 sobre 20% do peso da política.
  const r = pontuar({ politica, veredictos: { obrigatorio: ok() } });
  assert.equal(r.score, 100);
  assert.ok(r.cobertura < COBERTURA_MINIMA);
  const d = decidir({ politica, resultado: r });
  assert.equal(d.decisao, DECISOES.revisao);
  assert.match(d.motivo, /não pôde ser verificada/i);
});

test("limiares da política definem as três faixas", () => {
  const alta = pontuar({ politica, veredictos: { obrigatorio: ok(), geo: ok(), visao: ok(0.9) } });
  assert.equal(decidir({ politica, resultado: alta }).decisao, DECISOES.aprovado);

  const media = pontuar({ politica, veredictos: { obrigatorio: ok(), geo: nao(), visao: ok(0.9) } });
  assert.equal(decidir({ politica, resultado: media }).decisao, DECISOES.revisao);

  const baixa = pontuar({ politica, veredictos: { obrigatorio: ok(), geo: nao(), visao: nao(0.9) } });
  assert.equal(decidir({ politica, resultado: baixa }).decisao, DECISOES.recusado);
});

test("limiares são configuráveis por política, não fixos no código", () => {
  const exigente = normalizarPolitica({ ...politica, limiares: { aprovar: 95, revisar: 80 } });
  const r = pontuar({ politica: exigente, veredictos: { obrigatorio: ok(), geo: ok(), visao: nao(0.9) } });
  assert.equal(r.score, 60);
  assert.equal(decidir({ politica: exigente, resultado: r }).decisao, DECISOES.recusado);
});

// --- Sinais / geo -------------------------------------------------------

test("distância geográfica confere com referência conhecida", () => {
  // Av. Paulista 1578 → Praça da Sé, ~2,6 km em linha reta.
  const d = distanciaMetros({ lat: -23.5613, lon: -46.6565 }, { lat: -23.5503, lon: -46.6339 });
  assert.ok(d > 2300 && d < 2900, `esperado ~2600 m, veio ${d}`);
  assert.equal(distanciaMetros({ lat: 1, lon: 1 }, { lat: 1, lon: 1 }), 0);
  assert.equal(distanciaMetros(null, { lat: 1, lon: 1 }), null);
});

test("precisão do aparelho entra na margem antes de acusar distância", () => {
  const esperado = { lat: -23.5613, lon: -46.6565 };
  const perto = { lat: -23.5615, lon: -46.6567, precisao: 0 };
  assert.equal(avaliarGeo({ capturado: perto, esperado, toleranciaMetros: 150 }).resultado, RESULTADOS.atendido);

  const longe = { lat: -23.5503, lon: -46.6339, precisao: 0 };
  assert.equal(avaliarGeo({ capturado: longe, esperado, toleranciaMetros: 150 }).resultado, RESULTADOS.negado);

  // O mesmo ponto distante, com precisão péssima declarada, continua negado —
  // a margem soma no máximo 200 m.
  const impreciso = { ...longe, precisao: 5000 };
  assert.equal(avaliarGeo({ capturado: impreciso, esperado, toleranciaMetros: 150 }).resultado, RESULTADOS.negado);
});

test("sem coordenada o critério é inconclusivo, não negado", () => {
  const r = avaliarGeo({ capturado: null, esperado: { lat: 1, lon: 1 } });
  assert.equal(r.resultado, RESULTADOS.inconclusivo);
});

// --- Contratos de provider ---------------------------------------------

test("resposta de visão sem confiança numérica é recusada", () => {
  assert.equal(validarVisao(null).valido, false);
  assert.equal(validarVisao({ business_environment_detected: true }).valido, false);
  const v = validarVisao({ business_environment_detected: true, possible_manipulation: false, confidence: 0.94 });
  assert.equal(v.valido, true);
  assert.equal(v.dados.ambienteComercial, true);
  assert.equal(v.dados.confianca, 0.94);
});

test("campo booleano ausente vira null, nunca false", () => {
  // "O provedor não respondeu" e "o provedor respondeu não" são coisas
  // diferentes: confundir as duas reprova por ausência de informação.
  const v = validarVisao({ confidence: 0.8 });
  assert.equal(v.dados.ambienteComercial, null);
  assert.equal(v.dados.possivelManipulacao, null);
});

test("transcrição vazia é recusada e segmentos são normalizados", () => {
  assert.equal(validarTranscricao({ text: "   " }).valido, false);
  const t = validarTranscricao({
    text: "olá", duration: 1320,
    segments: [{ start: 0, end: 12, text: "olá", speaker: "A", confidence: 0.9 }, { start: 12, end: 20, text: "" }],
  });
  assert.equal(t.valido, true);
  assert.equal(t.dados.segmentos.length, 1);
  assert.equal(t.dados.duracaoSegundos, 1320);
  assert.deepEqual(t.dados.locutores, ["A"]);
});

test("semântica só aceita critérios da política e exige met + confidence", () => {
  const bruto = {
    criteria: [
      { criterion_id: "decisor_presente", met: true, confidence: 0.91, evidence: [{ start: 242, end: 281, text: "..." }] },
      { criterion_id: "criterio_inventado", met: true, confidence: 0.99 },
      { criterion_id: "sem_confianca", met: true },
    ],
  };
  const s = validarSemantica(bruto, ["decisor_presente", "sem_confianca"]);
  assert.equal(s.valido, true);
  assert.equal(s.dados.avaliacoes.length, 1);
  assert.equal(s.dados.avaliacoes[0].chave, "decisor_presente");
  assert.equal(s.dados.avaliacoes[0].evidencia[0].inicio, 242);
});

test("resposta semântica sem nada aproveitável é recusada", () => {
  assert.equal(validarSemantica({ texto: "achei que sim" }).valido, false);
  assert.equal(validarSemantica({ criteria: [] }).valido, false);
});

// --- Metadados ----------------------------------------------------------
import { avaliarMetadados } from "../shared/audit/geo.js";

test("EXIF ausente é sinal informativo, nunca acusação", () => {
  // Qualquer aplicativo de mensagem remove EXIF. Tratar a ausência como
  // fraude reprovaria a maioria dos envios legítimos.
  const r = avaliarMetadados({ metadata: {} });
  const exif = r.sinais.find((s) => s.chave === "EXIF_AUSENTE");
  assert.equal(exif.severidade, "info");
});

test("software de edição e atraso de captura viram sinais de atenção", () => {
  const agora = Date.now();
  const r = avaliarMetadados({
    metadata: { exif: { Software: "Adobe Photoshop 25.0" }, capturadoEm: agora - 72 * 3600000, largura: 300, altura: 300 },
    enviadoEm: agora,
  });
  const chaves = r.sinais.map((s) => s.chave);
  assert.ok(chaves.includes("IMAGE_EDITED"));
  assert.ok(chaves.includes("CAPTURE_DELAY"));
  assert.ok(chaves.includes("LOW_RESOLUTION"));
  assert.equal(r.sinais.every((s) => s.severidade !== "critico"), true);
});

// --- Painel do vendedor -------------------------------------------------
import { desempenhoVendedor, potencialDeGanhos } from "../shared/desempenhoVendedor.js";

const agora = new Date("2026-09-11T12:00:00").getTime();
const ontem = agora - 86400000;

test("ganhos do painel usam o líquido, que é o que o profissional recebe", () => {
  const d = desempenhoVendedor({
    sellerId: "v1", seller: { disponivel: 50, pendente: 10, sacado: 30, nota: 80 }, agora,
    submissions: [
      { sellerId: "v1", status: "liberado", valor: 100, liquido: 88, tipo: "venda", criadoEm: agora },
      { sellerId: "v1", status: "liberado", valor: 10, liquido: 8.8, tipo: "agendamento", criadoEm: ontem },
      { sellerId: "outro", status: "liberado", valor: 999, liquido: 999, tipo: "venda", criadoEm: agora },
    ],
  });
  assert.equal(d.financeiro.hoje, 88);            // só a de hoje
  assert.equal(d.financeiro.semana, 96.8);        // as duas
  assert.equal(d.financeiro.historico, 96.8);     // nunca a de outro vendedor
});

test("em auditoria soma o que ainda não virou saldo e não conta como ganho", () => {
  const d = desempenhoVendedor({
    sellerId: "v1", seller: {}, agora,
    submissions: [
      { sellerId: "v1", status: "revisao", valor: 20, liquido: 17.6, tipo: "realizada", criadoEm: agora },
      { sellerId: "v1", status: "conferido", valor: 10, liquido: 8.8, tipo: "agendamento", criadoEm: agora },
    ],
  });
  assert.equal(d.financeiro.hoje, 0);
  assert.equal(d.financeiro.emAuditoria, 26.4);
  assert.equal(d.performance.emAuditoria, 2);
});

test("taxa de aprovação ignora o que ainda está em auditoria", () => {
  const d = desempenhoVendedor({
    sellerId: "v1", seller: {}, agora,
    submissions: [
      { sellerId: "v1", status: "liberado", valor: 10, tipo: "agendamento", criadoEm: agora },
      { sellerId: "v1", status: "recusado", valor: 10, tipo: "agendamento", criadoEm: agora },
      { sellerId: "v1", status: "revisao", valor: 10, tipo: "agendamento", criadoEm: agora },
    ],
  });
  assert.equal(d.performance.taxaAprovacao, 50);
});

test("sem ação decidida a taxa é nula, não zero", () => {
  // Zero diria "você reprova tudo"; nulo diz "ainda não há o que medir".
  const d = desempenhoVendedor({ sellerId: "v1", seller: {}, submissions: [], agora });
  assert.equal(d.performance.taxaAprovacao, null);
  assert.equal(d.comercial.conversao, null);
  assert.equal(d.performance.progressoMeta, null);
});

test("potencial de ganhos só conta empresa aprovada e com caixa", () => {
  const companies = [
    { id: "c1", nome: "Com caixa", saldo: 1000, saldoReservado: 200, comissoes: { agendamento: 12 } },
    { id: "c2", nome: "Sem caixa", saldo: 0, saldoReservado: 0, comissoes: { agendamento: 50 } },
    { id: "c3", nome: "Não aprovado", saldo: 9999, saldoReservado: 0, comissoes: { agendamento: 99 } },
  ];
  const r = potencialDeGanhos({ companies, campaigns: [], aplicacoes: { c1: "aprovado", c2: "aprovado", c3: "pendente" } });
  assert.equal(r.total, 800);
  assert.deepEqual(r.empresas.map((e) => e.companyId), ["c1"]);
});

test("potencial zero explica o motivo em vez de mostrar R$ 0,00 seco", () => {
  const semAprovacao = potencialDeGanhos({ companies: [{ id: "c1", saldo: 100 }], aplicacoes: {} });
  assert.match(semAprovacao.motivo, /não foi aprovado/i);

  const semCaixa = potencialDeGanhos({
    companies: [{ id: "c1", nome: "X", saldo: 10, saldoReservado: 10, comissoes: { agendamento: 5 } }],
    aplicacoes: { c1: "aprovado" },
  });
  assert.match(semCaixa.motivo, /sem caixa/i);
});

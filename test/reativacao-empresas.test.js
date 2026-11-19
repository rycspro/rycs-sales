import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as R from "../shared/reativacaoEmpresas.js";

const { DIA } = R;
const H = 60 * 60 * 1000;
const QUA_0930 = Date.UTC(2026, 10, 18, 12, 30); // quarta, 9h30 em Brasília
const base = (extra = {}) => ({
  statusCadastro: "aprovada", criadoEm: QUA_0930 - 30 * DIA, campanhas: 0, campanhasAtivas: 0,
  ultimaCampanhaEm: null, ultimoAcessoEm: null, ...extra,
});

test("segmentação: nunca ativou depois de 3 dias, parou de usar depois de N dias", () => {
  assert.equal(R.segmentoDa(base({ criadoEm: QUA_0930 - 2 * DIA }), QUA_0930), null);
  assert.equal(R.segmentoDa(base({ criadoEm: QUA_0930 - 4 * DIA }), QUA_0930), "nunca_ativou");
  assert.equal(R.segmentoDa(base({ statusCadastro: "em_analise" }), QUA_0930), null);
  const parada = base({ campanhas: 2, ultimaCampanhaEm: QUA_0930 - 40 * DIA, ultimoAcessoEm: QUA_0930 - 16 * DIA });
  assert.equal(R.segmentoDa(parada, QUA_0930), "parou_de_usar");
  assert.equal(R.segmentoDa({ ...parada, ultimoAcessoEm: QUA_0930 - 10 * DIA }, QUA_0930), null);
  assert.equal(R.segmentoDa({ ...parada, ultimoAcessoEm: QUA_0930 - 10 * DIA }, QUA_0930, { diasInativo: 7 }), "parou_de_usar");
  assert.equal(R.segmentoDa({ ...parada, campanhasAtivas: 1 }, QUA_0930), null);
});

test("exclusões: inscrita, carência de 60 dias, e-mail bloqueado e saída do WhatsApp", () => {
  assert.equal(R.motivoDeFora({}, QUA_0930), "");
  assert.equal(R.motivoDeFora({ inscricaoAtiva: true }, QUA_0930), "ja_inscrita");
  assert.equal(R.motivoDeFora({ ultimaInscricaoEm: QUA_0930 - 59 * DIA }, QUA_0930), "carencia_60_dias");
  assert.equal(R.motivoDeFora({ ultimaInscricaoEm: QUA_0930 - 61 * DIA }, QUA_0930), "");
  assert.equal(R.motivoDeFora({ motivoEmail: "email_bounce_ou_spam" }, QUA_0930), "email_bounce_ou_spam");
  assert.equal(R.motivoDeFora({ motivoWhatsapp: "pediu_para_sair" }, QUA_0930), "whatsapp_pediu_para_sair");
  assert.equal(R.motivoDeFora({ motivoWhatsapp: "sem_aceite" }, QUA_0930), "");
});

test("saída: criou campanha depois de entrar ou tem campanha ativa", () => {
  const insc = { inicioEm: QUA_0930 };
  assert.equal(R.reativou({ campanhasAtivas: 0, ultimaCampanhaEm: QUA_0930 - DIA }, insc), false);
  assert.equal(R.reativou({ campanhasAtivas: 0, ultimaCampanhaEm: QUA_0930 + H }, insc), true);
  assert.equal(R.reativou({ campanhasAtivas: 1, ultimaCampanhaEm: null }, insc), true);
});

test("cronograma: um passo por dia útil, fim de semana parado, conclui depois do dia 7", () => {
  const insc = { status: "ativa", diaAtual: 0, ultimoPassoEm: null };
  assert.deepEqual(R.proximoPasso(insc, QUA_0930), { dia: 1 });
  const d1 = { ...insc, diaAtual: 1, ultimoPassoEm: QUA_0930 };
  assert.equal(R.proximoPasso(d1, QUA_0930 + 5 * H), null); // mesmo dia
  assert.deepEqual(R.proximoPasso(d1, QUA_0930 + DIA), { dia: 2 }); // quinta
  const d3 = { ...insc, diaAtual: 3, ultimoPassoEm: QUA_0930 + 2 * DIA }; // sexta
  assert.equal(R.proximoPasso(d3, QUA_0930 + 3 * DIA), null); // sábado
  assert.equal(R.proximoPasso(d3, QUA_0930 + 4 * DIA), null); // domingo
  assert.deepEqual(R.proximoPasso(d3, QUA_0930 + 5 * DIA), { dia: 4 }); // segunda
  const d7 = { ...insc, diaAtual: 7, ultimoPassoEm: QUA_0930 };
  assert.equal(R.proximoPasso(d7, QUA_0930 + H), null);
  assert.deepEqual(R.proximoPasso(d7, QUA_0930 + DIA), { concluir: true });
  assert.equal(R.proximoPasso({ ...insc, status: "saiu" }, QUA_0930), null);
});

test("WhatsApp só nos dias 1, 3, 5 e 7 e na mesma data do passo; janelas de horário", () => {
  const em = (diaAtual, ultimoPassoEm = QUA_0930) => ({ status: "ativa", diaAtual, ultimoPassoEm });
  assert.equal(R.whatsappDoPasso(em(1), QUA_0930 + 5 * H).modelo, "rycs_reativacao_d1");
  assert.equal(R.whatsappDoPasso(em(2), QUA_0930 + 5 * H), null);
  assert.equal(R.whatsappDoPasso(em(3), QUA_0930 + DIA), null);
  assert.equal(R.janelaEmail(QUA_0930 - H), false); // 8h30
  assert.equal(R.janelaEmail(QUA_0930), true);
  assert.equal(R.janelaWhatsapp(QUA_0930), false);
  assert.equal(R.janelaWhatsapp(QUA_0930 + 5 * H), true); // 14h30
  assert.equal(R.janelaWhatsapp(QUA_0930 + 3 * DIA + 5 * H), false); // sábado
});

test("textos: dois textos no dia 1, sem nome não quebra, dados escapados, dias sem dado real são pulados", () => {
  const d = { nome: "João", empresa: "Acme <b>", vendedoresAtivos: 42, diasInativo: 18, linkAgenda: "" };
  const nunca = R.textoEmail(1, "nunca_ativou", d);
  const parou = R.textoEmail(1, "parou_de_usar", d);
  assert.equal(nunca.assunto, "João, a Acme <b> ainda não começou a vender na Rycs");
  assert.equal(parou.botao, "Retomar minha campanha");
  assert.match(parou.paragrafos.join(" "), /Faz 18 dias/);
  assert.ok(!nunca.paragrafos.join("").includes("<b>Acme <b></b>"));
  assert.ok(nunca.paragrafos.join("").includes("Acme &lt;b&gt;"));
  assert.equal(R.textoEmail(1, "nunca_ativou", { ...d, nome: "" }).assunto, "A Acme <b> ainda não começou a vender na Rycs");
  assert.equal(R.textoEmail(7, "nunca_ativou", { ...d, nome: "" }).assunto, "Última mensagem sobre isso");
  assert.equal(R.textoEmail(2, "nunca_ativou", d).assunto, "42 vendedores disponíveis para a Acme <b>");
  assert.equal(R.textoEmail(2, "nunca_ativou", { ...d, vendedoresAtivos: 0 }).pular, "sem_vendedores_ativos");
  assert.equal(R.textoEmail(4, "nunca_ativou", d).pular, "sem_case");
  assert.equal(R.textoEmail(5, "nunca_ativou", d).pular, "sem_link_agenda");
  assert.equal(R.textoEmail(5, "nunca_ativou", { ...d, linkAgenda: "https://agenda.exemplo/martin" }).destino, "agenda");
  assert.equal(R.textoEmail(6, "nunca_ativou", d).pular, "sem_oferta");
  for (const dia of [1, 2, 3, 7]) {
    const t = R.textoEmail(dia, "nunca_ativou", d);
    assert.ok(t.assunto && t.preheader && t.botao && t.paragrafos.length, `dia ${dia}`);
    assert.equal(t.destino, "campanha");
  }
  assert.equal(R.primeiroNome("JOÃO DA SILVA"), "João");
  assert.equal(R.primeiroNome("12345"), "");
});

test("modelos de WhatsApp: corpo não começa nem termina com variável, parâmetros e payloads", () => {
  for (const m of R.modelosParaMeta()) {
    const corpo = m.components[0].text;
    assert.ok(!/^\s*\{\{/.test(corpo) && !/\}\}\s*$/.test(corpo), m.name);
    assert.equal(m.category, "MARKETING");
    assert.equal(m.language, "pt_BR");
    assert.equal(m.components[0].example.body_text[0].length, (corpo.match(/\{\{\d\}\}/g) || []).length);
  }
  assert.deepEqual(R.parametrosWhatsapp(1, { nome: "Ana", empresa: "Acme" }), ["Ana", "Acme"]);
  assert.deepEqual(R.parametrosWhatsapp(7, { nome: "", empresa: "Acme" }), ["Acme"]);
  assert.deepEqual(R.parametrosWhatsapp(3, { nome: "Ana", vendedoresAtivos: 0 }), ["Ana", ""]);
  assert.deepEqual(R.lerPayload(R.payloadResposta("agendar", "abc")), { acao: "agendar", inscricaoId: "abc" });
  assert.equal(R.lerPayload("Parar mensagens"), null);
});

// Banco de verdade, em processo à parte (ver test/apoio/reativacao-rodada.mjs).
test("rodada: idempotência, simulação sem gravar, saídas e respostas", () => {
  let saida = "";
  for (let tentativa = 0; tentativa < 4 && !saida.includes("RESULTADO "); tentativa++) {
    const dir = mkdtempSync(join(tmpdir(), "reativacao-"));
    const p = spawnSync(process.execPath, ["--min-semi-space-size=256", "--max-semi-space-size=256", "test/apoio/reativacao-rodada.mjs"], {
      env: { ...process.env, DB_PATH: join(dir, "t.db"), NODE_ENV: "test", RESEND_API_KEY: "", WHATSAPP_TOKEN: "", WHATSAPP_PHONE_NUMBER_ID: "", WHATSAPP_WABA_ID: "" },
      encoding: "utf8", timeout: 60000,
    });
    saida = p.stdout || "";
    rmSync(dir, { recursive: true, force: true });
  }
  const linha = saida.split("\n").find((l) => l.startsWith("RESULTADO "));
  assert.ok(linha, `script não terminou:\n${saida.slice(-2000)}`);
  const r = JSON.parse(linha.slice("RESULTADO ".length));

  assert.equal(r.inscricoesAntes, 0);
  assert.equal(r.simulacao.simulacao, true);
  assert.equal(r.simulacao.inscrever, 1);
  assert.equal(r.inscricoesDepoisSimulacao, 0);
  assert.deepEqual(r.inscritas, [{ companyId: "parada", segmento: "nunca_ativou", diaAtual: 1 }]);
  assert.equal(r.emailsD1.length, 1);
  assert.equal(r.emailsD1[0].status, "enviado");
  assert.match(r.emailsD1[0].chave, /^reativacao_empresas:d1@/);
  assert.deepEqual(r.whatsappD1, [{ dia: 1, status: "pulado", erro: "whatsapp_nao_configurado" }]);
  assert.equal(r.diaQuinta, 2);
  assert.equal(r.diaSabado, 2);
  assert.deepEqual(r.saida, { status: "saiu", motivoSaida: "reativada" });
  assert.deepEqual(r.emailsFinal.map((e) => [e.chave.split("@")[0], e.status]),
    [["reativacao_empresas:d1", "enviado"], ["reativacao_empresas:d2", "pulado"]]);
  assert.deepEqual(r.respostas, [1, 0]);
  assert.equal(r.saidaZap, "whatsapp_parar");
  assert.equal(r.zapSaiu, true);
  assert.equal(r.metricas.reativadas, 1);
});

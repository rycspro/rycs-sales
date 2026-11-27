// Roteiro comercial guiado (discadora e videochamada): importação de PDF e
// texto, geração automática, edição, publicação, vínculo a campanha e
// execução guiada durante a chamada — sem IA (motor interno + casamento
// local) e com uma IA falsa (servidor HTTP local no lugar da API), para
// provar que só o trecho novo vai para a IA, que o documento nunca volta a
// ela e que resposta sem evidência na fala é descartada.

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { deflateSync } from "node:zlib";
import Database from "better-sqlite3";
import { subirServidor, cliente, assinar } from "./apoio/servidor.js";
import {
  normalizarEstrutura, perguntasVisiveis, proximaPergunta, casarLocal, aplicarAchados, trechoNaFala,
  valorDoCampo, avaliarCriterios, estruturarTextoInterno, listarPerguntas, progresso,
} from "../shared/roteiroComercial.js";

const ROTEIRO = {
  blocos: [
    { id: "b1", titulo: "Abertura", orientacao: "Apresente-se.", condicao: null, topicos: [{ id: "t1", titulo: "", orientacao: "", perguntas: [
      { id: "p1", texto: "Você é o responsável pelas compras da empresa?", obrigatoria: true, campo: { tipo: "sim_nao", opcoes: [] } },
    ] }] },
    { id: "b2", titulo: "Qualificação", orientacao: "", condicao: null, topicos: [{ id: "t2", titulo: "Porte", orientacao: "", perguntas: [
      { id: "p2", texto: "Quantos funcionários a empresa tem hoje?", variacoes: ["Qual o tamanho da equipe?"], campo: { tipo: "numero", opcoes: [] } },
      { id: "p3", texto: "Vocês já usam algum sistema de gestão?", campo: { tipo: "sim_nao", opcoes: [] } },
      { id: "p4", texto: "Qual sistema vocês usam atualmente?", campo: { tipo: "texto", opcoes: [] }, condicao: { perguntaId: "p3", operador: "igual", valor: "Sim" } },
    ] }] },
    { id: "b3", titulo: "Fechamento", orientacao: "", condicao: null, topicos: [{ id: "t3", titulo: "", orientacao: "", perguntas: [
      { id: "p5", texto: "Podemos agendar uma demonstração esta semana?", campo: { tipo: "sim_nao", opcoes: [] } },
    ] }] },
  ],
  criterios: [
    { descricao: "Mais de 10 funcionários", perguntaId: "p2", operador: "maior", valor: "10", efeito: "qualifica" },
    { descricao: "Não decide a compra", perguntaId: "p1", operador: "igual", valor: "Não", efeito: "desqualifica" },
  ],
};

const DOCUMENTO = `ROTEIRO DE PROSPECÇÃO
ABERTURA
Apresente-se e confirme se está falando com o responsável.
Você é o responsável pelas compras da empresa?
QUALIFICAÇÃO
Quantos funcionários a empresa tem hoje?
Vocês já usam algum sistema de gestão?
Se usar, pergunte: Qual sistema vocês usam atualmente?
FECHAMENTO
Podemos agendar uma demonstração esta semana?`;

// PDF mínimo com o texto num stream comprimido, como os PDFs de verdade.
function pdfCom(linhas) {
  const corpo = linhas.map((l, i) => `BT /F1 12 Tf 72 ${760 - i * 18} Td (${l}) Tj ET`).join("\n");
  const stream = deflateSync(Buffer.from(corpo, "latin1"));
  return Buffer.concat([
    Buffer.from(`%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n2 0 obj << /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`, "latin1"),
    stream,
    Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
  ]);
}

function semear(db) {
  const agora = Date.now();
  for (const id of ["e1", "e2"]) db.prepare("INSERT INTO companies (id, nome, produto, whatsapp, saldo, aportes, visivel, voice_habilitada, criadoEm) VALUES (?, ?, 'X', '1', 0, '[]', 1, 1, ?)").run(id, `Empresa ${id}`, agora);
  for (const [id, emp] of [["s1", "e1"], ["s2", "e2"]]) {
    db.prepare("INSERT INTO sellers (id, nome, email, whats, criadoEm) VALUES (?, ?, ?, '1', ?)").run(id, id, `${id}@t.dev`, agora);
    db.prepare("INSERT INTO applications (sellerId, companyId, status) VALUES (?, ?, 'aprovado')").run(id, emp);
  }
  db.prepare("INSERT INTO campaigns (id, companyId, titulo, criadoEm) VALUES ('c1', 'e1', 'Campanha Um', ?)").run(agora);
  db.prepare("INSERT INTO campaign_applications (id, campaignId, sellerId, status, criadoEm) VALUES ('ca1', 'c1', 's1', 'aprovado', ?)").run(agora);
  db.prepare("INSERT INTO leads (id, sellerId, companyId, campaignId, nome, telefone, criadoEm, atualizadoEm) VALUES ('L1', 's1', 'e1', 'c1', 'Maria', '11999990001', ?, ?)").run(agora, agora);
  db.prepare("INSERT INTO leads (id, sellerId, companyId, nome, telefone, criadoEm, atualizadoEm) VALUES ('L2', 's2', 'e2', 'João', '11999990002', ?, ?)").run(agora, agora);
  db.prepare("INSERT INTO voice_calls (id, companyId, campaignId, leadId, sellerId, providerId, numeroDestino, status, iniciadaEm, criadoEm) VALUES ('call1', 'e1', 'c1', 'L1', 's1', 'mock', '11999990001', 'em_andamento', ?, ?)").run(agora, agora);
  db.prepare("INSERT INTO campaign_reunioes (id, campaignId, companyId, leadId, sellerCloserId, titulo, data, horaInicio, horaFim, status, criadoEm) VALUES ('r1', 'c1', 'e1', 'L1', 's1', 'Demo', '2026-12-01', '10:00', '10:30', 'confirmada', ?)").run(agora);
}

const empresa = (id) => assinar({ id, role: "empresa", entityId: id });
const vendedor = (id) => assinar({ id: `u-${id}`, role: "vendedor", entityId: id });

// ── Regras puras ─────────────────────────────────────────────────────

test("estrutura: normaliza, aplica condições e escolhe a próxima pergunta", () => {
  const e = normalizarEstrutura(ROTEIRO);
  assert.equal(listarPerguntas(e).length, 5);
  assert.deepEqual(perguntasVisiveis(e, {}).map((p) => p.id), ["p1", "p2", "p3", "p5"], "p4 só aparece se p3 = Sim");
  assert.ok(perguntasVisiveis(e, { p3: { valor: "Sim" } }).some((p) => p.id === "p4"));
  assert.equal(proximaPergunta(e, { feitas: { p1: {} }, respostas: {} }, "p1"), "p2");
  assert.equal(proximaPergunta(e, { feitas: { p3: {} }, respostas: { p3: { valor: "Não" } } }, "p3"), "p5", "pula a pergunta fora da condição");
  // condição para pergunta inexistente é removida; ids duplicados viram únicos
  const suja = normalizarEstrutura({ blocos: [{ titulo: "X", topicos: [{ perguntas: [{ id: "a", texto: "Uma pergunta?", condicao: { perguntaId: "zzz", operador: "igual", valor: "1" } }, { id: "a", texto: "Outra pergunta?" }] }] }] });
  const ps = listarPerguntas(suja);
  assert.equal(ps[0].condicao, null);
  assert.notEqual(ps[0].id, ps[1].id);
});

test("casamento local reconhece por palavras-chave e variações, e a evidência precisa estar na fala", () => {
  const e = normalizarEstrutura(ROTEIRO);
  const r = casarLocal(e, { feitas: {}, respostas: {} }, "Bom dia! E qual o tamanho da equipe de vocês? Somos 35.");
  assert.deepEqual(r.feitas.map((f) => f.id), ["p2"], "variação reconhecida");
  assert.deepEqual(r.respostas, [{ id: "p2", valor: "35", trecho: "Somos 35." }]);
  assert.equal(trechoNaFala("somos uns 35 funcionários", "Hoje somos uns 35 funcionários aqui"), true);
  assert.equal(trechoNaFala("já usamos o sistema X", "Hoje somos uns 35 funcionários aqui"), false);
  assert.equal(valorDoCampo({ campo: { tipo: "opcao", opcoes: ["Pequena", "Grande"] } }, "grande"), "Grande");
  assert.equal(valorDoCampo({ campo: { tipo: "opcao", opcoes: ["Pequena", "Grande"] } }, "média"), null, "opção inexistente não é gravada");
});

test("resposta manual nunca é sobrescrita pela IA e o ponteiro avança", () => {
  const e = normalizarEstrutura(ROTEIRO);
  let est = { perguntaAtual: "p1", feitas: {}, respostas: { p2: { valor: "40", origem: "manual" } } };
  est = aplicarAchados(e, est, { feitas: [{ id: "p1", trecho: "x" }], respostas: [{ id: "p2", valor: "35", trecho: "y" }, { id: "p1", valor: "sim", trecho: "z" }] }, "ia");
  assert.equal(est.respostas.p2.valor, "40");
  assert.equal(est.respostas.p1.valor, "Sim");
  assert.equal(est.perguntaAtual, "p3", "p2 já respondida: segue para p3");
  assert.equal(avaliarCriterios(e, est.respostas).status, "qualificado");
  assert.equal(avaliarCriterios(e, { p1: { valor: "Não" } }).status, "desqualificado");
  assert.equal(progresso(e, est).respondidas, 2);
});

test("motor interno lê texto de PDF numa linha só", () => {
  const e = estruturarTextoInterno(DOCUMENTO.replace(/\n/g, " "));
  const titulos = e.blocos.map((b) => b.titulo);
  assert.ok(titulos.includes("QUALIFICAÇÃO") && titulos.includes("FECHAMENTO"), titulos.join(" | "));
  assert.equal(listarPerguntas(e).length, 5);
  assert.ok(listarPerguntas(e).every((p) => p.revisar), "sem IA, tudo fica para revisão");
});

// ── Rotas, sem IA ────────────────────────────────────────────────────

test("empresa importa PDF e texto, edita, publica e vincula; profissional executa na ligação e salva no CRM", async (t) => {
  const { base, dbPath } = await subirServidor(t);
  const db = new Database(dbPath);
  t.after(() => db.close());
  semear(db);
  const req = cliente(base);
  const E1 = empresa("e1");
  const S1 = vendedor("s1");

  // Importação de texto colado (sem IA: motor interno), salva como rascunho.
  const txt = await req("/voice/roteiros/gerar", { body: { texto: DOCUMENTO }, cookie: E1 });
  assert.equal(txt.status, 200, JSON.stringify(txt.corpo));
  assert.equal(txt.corpo.status, "rascunho");
  assert.equal(txt.corpo.origem, "interno");
  assert.equal(txt.corpo.perguntas, 5);
  assert.equal(txt.corpo.nome, "ROTEIRO DE PROSPECÇÃO", "título do documento vira o nome");

  // Importação de PDF (texto num stream comprimido).
  const pdf = pdfCom(DOCUMENTO.split("\n"));
  const rp = await req("/voice/roteiros/gerar", { body: { arquivo: { nome: "roteiro.pdf", base64: pdf.toString("base64") } }, cookie: E1 });
  assert.equal(rp.status, 200, JSON.stringify(rp.corpo));
  assert.equal(rp.corpo.fonteNome, "roteiro.pdf");
  assert.equal(rp.corpo.perguntas, 5);
  assert.ok(rp.corpo.estrutura.blocos.some((b) => b.titulo === "QUALIFICAÇÃO"));
  const ruim = await req("/voice/roteiros/gerar", { body: { arquivo: { nome: "x.docx", base64: "AAAA" } }, cookie: E1 });
  assert.equal(ruim.status, 422);

  // Rascunho não aparece para o profissional.
  const id = txt.corpo.id;
  await req(`/voice/roteiros/${id}`, { method: "PUT", body: { campanhas: ["c1"] }, cookie: E1 });
  assert.equal((await req("/voice/roteiros/campanha/c1", { cookie: S1 })).corpo.roteiro, null);
  assert.equal((await req("/voice/roteiros/execucoes", { body: { scriptId: id, leadId: "L1", callId: "call1" }, cookie: S1 })).status, 404);

  // Edição: estrutura revisada, nome e campanha; publicação.
  const ed = await req(`/voice/roteiros/${id}`, { method: "PUT", body: { nome: "Prospecção revisada", estrutura: ROTEIRO, campanhas: ["c1"] }, cookie: E1 });
  assert.equal(ed.status, 200);
  assert.deepEqual(ed.corpo.campanhas.map((c) => c.id), ["c1"]);
  const pub = await req(`/voice/roteiros/${id}/publicar`, { body: { publicar: true }, cookie: E1 });
  assert.equal(pub.corpo.status, "publicado");

  // Duplicar e excluir (exclusão lógica) não mexem no publicado.
  const dup = await req(`/voice/roteiros/${id}/duplicar`, { body: {}, cookie: E1 });
  assert.equal(dup.corpo.status, "rascunho");
  assert.equal(dup.corpo.campanhas.length, 0);
  assert.equal((await req(`/voice/roteiros/${dup.corpo.id}`, { method: "DELETE", cookie: E1 })).status, 200);
  assert.equal((await req(`/voice/roteiros/${dup.corpo.id}`, { cookie: E1 })).status, 404);

  // Isolamento: outra empresa não vê; profissional de outra empresa não executa.
  assert.equal((await req(`/voice/roteiros/${id}`, { cookie: empresa("e2") })).status, 404);
  assert.equal((await req("/voice/roteiros/execucoes", { body: { scriptId: id, leadId: "L1", callId: "call1" }, cookie: vendedor("s2") })).status, 403);
  assert.equal((await req("/voice/roteiros/execucoes", { body: { scriptId: id, leadId: "L2" }, cookie: S1 })).status, 404);

  // Profissional recebe o roteiro da campanha e inicia a execução na ligação.
  const camp = await req("/voice/roteiros/campanha/c1", { cookie: S1 });
  assert.equal(camp.corpo.roteiro.id, id);
  const ini = await req("/voice/roteiros/execucoes", { body: { scriptId: id, leadId: "L1", callId: "call1" }, cookie: S1 });
  assert.equal(ini.status, 200, JSON.stringify(ini.corpo));
  const ex = ini.corpo.execucao;
  assert.equal(ex.estado.perguntaAtual, "p1");
  assert.equal(ini.corpo.recursos.ia, false);
  // Retomar a mesma ligação devolve a mesma execução.
  assert.equal((await req("/voice/roteiros/execucoes", { body: { scriptId: id, leadId: "L1", callId: "call1" }, cookie: S1 })).corpo.execucao.id, ex.id);

  // Fala reconhecida: pergunta feita + resposta, avanço automático.
  let r = await req(`/voice/roteiros/execucoes/${ex.id}/trecho`, { body: { texto: "Bom dia! Você é o responsável pelas compras da empresa? Sim, sou eu." }, cookie: S1 });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.ia, "indisponivel");
  assert.equal(r.corpo.execucao.estado.respostas.p1.valor, "Sim");
  assert.equal(r.corpo.execucao.estado.perguntaAtual, "p2");

  // Fora de ordem: p3 respondida antes de p2; condição esconde p4 e o ponteiro vai a p5.
  r = await req(`/voice/roteiros/execucoes/${ex.id}/trecho`, { body: { texto: "E vocês já usam algum sistema de gestão? Não, ainda nada." }, cookie: S1 });
  assert.equal(r.corpo.execucao.estado.respostas.p3.valor, "Não");
  assert.equal(r.corpo.execucao.estado.perguntaAtual, "p5");
  assert.equal(r.corpo.execucao.progresso.total, 4, "p4 fora do roteiro pela condição");

  // Navegação e correção manual.
  r = await req(`/voice/roteiros/execucoes/${ex.id}`, { method: "PATCH", body: { perguntaAtual: "p2" }, cookie: S1 });
  assert.equal(r.corpo.execucao.estado.perguntaAtual, "p2");
  r = await req(`/voice/roteiros/execucoes/${ex.id}`, { method: "PATCH", body: { resposta: { perguntaId: "p2", valor: "35" } }, cookie: S1 });
  assert.equal(r.corpo.execucao.estado.respostas.p2.origem, "manual");
  assert.equal(r.corpo.execucao.estado.perguntaAtual, "p5", "respondeu a atual: avança");
  assert.equal(r.corpo.execucao.qualificacao.status, "qualificado");
  const invalida = await req(`/voice/roteiros/execucoes/${ex.id}`, { method: "PATCH", body: { resposta: { perguntaId: "p2", valor: "muitos" } }, cookie: S1 });
  assert.equal(invalida.status, 400);
  // Outro profissional não mexe nesta execução.
  assert.equal((await req(`/voice/roteiros/execucoes/${ex.id}/trecho`, { body: { texto: "oi" }, cookie: vendedor("s2") })).status, 404);

  // Salvar no CRM: ficha do lead e linha do tempo.
  const sv = await req(`/voice/roteiros/execucoes/${ex.id}/salvar`, { body: {}, cookie: S1 });
  assert.equal(sv.status, 200);
  assert.equal(sv.corpo.respostas, 3);
  const lead = db.prepare("SELECT dados FROM leads WHERE id = 'L1'").get();
  const salvo = JSON.parse(lead.dados).roteiros[id];
  assert.equal(salvo.qualificacao, "qualificado");
  assert.deepEqual(salvo.respostas.map((x) => [x.perguntaId, x.valor]), [["p1", "Sim"], ["p2", "35"], ["p3", "Não"]]);
  const ev = db.prepare("SELECT * FROM lead_events WHERE leadId = 'L1' AND tipo = 'roteiro'").all();
  assert.equal(ev.length, 1);
  assert.match(ev[0].observacao, /Quantos funcionários a empresa tem hoje\? → 35/);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM voice_call_events WHERE callId = 'call1' AND tipo = 'roteiro'").get().n, 1);
  // Salvar de novo sem mudança não duplica a linha do tempo.
  await req(`/voice/roteiros/execucoes/${ex.id}/salvar`, { body: {}, cookie: S1 });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM lead_events WHERE leadId = 'L1' AND tipo = 'roteiro'").get().n, 1);
  // A transcrição não fica guardada depois de salvar.
  assert.equal(db.prepare("SELECT contextoFala FROM voice_roteiro_execucoes WHERE id = ?").get(ex.id).contextoFala, "");

  // Videochamada: mesma execução guiada, ligada à reunião.
  const vc = await req("/voice/roteiros/execucoes", { body: { scriptId: id, leadId: "L1", reuniaoId: "r1" }, cookie: S1 });
  assert.equal(vc.status, 200);
  assert.equal(vc.corpo.execucao.contexto, "videochamada");
  assert.notEqual(vc.corpo.execucao.id, ex.id);
});

// ── Rotas, com IA falsa ──────────────────────────────────────────────

test("com IA: importação estrutura e marca o que não está no documento; ao vivo só vai o trecho novo e evidência falsa é descartada", async (t) => {
  const pedidos = [];
  const ia = createServer((rq, rs) => {
    let corpo = "";
    rq.on("data", (d) => { corpo += d; });
    rq.on("end", () => {
      const b = JSON.parse(corpo || "{}");
      pedidos.push(b);
      const responder = (json) => {
        rs.writeHead(200, { "Content-Type": "application/json" });
        rs.end(JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: b.model, content: [{ type: "text", text: JSON.stringify(json) }], stop_reason: "end_turn", usage: { input_tokens: 50, output_tokens: 10 } }));
      };
      if (b.output_config?.format?.schema?.required?.includes("blocos")) {
        return responder({
          nome: "Roteiro de prospecção", avisos: [],
          blocos: [
            { id: "b1", titulo: "Abertura", orientacao: "Apresente-se e confirme se está falando com o responsável.", condicao: null, topicos: [{ id: "t1", titulo: "", orientacao: "", perguntas: [
              { id: "p1", texto: "Você é o responsável pelas compras da empresa?", variacoes: ["É você quem decide as compras?"], orientacao: "", obrigatoria: true, campo: { tipo: "sim_nao", opcoes: [] }, condicao: null },
            ] }] },
            { id: "b2", titulo: "Qualificação", orientacao: "", condicao: null, topicos: [{ id: "t2", titulo: "", orientacao: "", perguntas: [
              { id: "p2", texto: "Quantos funcionários a empresa tem hoje?", variacoes: [], orientacao: "", obrigatoria: false, campo: { tipo: "numero", opcoes: [] }, condicao: null },
              { id: "p3", texto: "Vocês já usam algum sistema de gestão?", variacoes: [], orientacao: "", obrigatoria: false, campo: { tipo: "sim_nao", opcoes: [] }, condicao: null },
              { id: "p4", texto: "Qual é o orçamento disponível para o projeto?", variacoes: [], orientacao: "", obrigatoria: false, campo: { tipo: "moeda", opcoes: [] }, condicao: null },
            ] }] },
          ],
          criterios: [{ descricao: "Mais de 10 funcionários", perguntaId: "p2", operador: "maior", valor: "10", efeito: "qualifica" }],
        });
      }
      const usuario = String(b.messages?.[0]?.content || "");
      const novo = (usuario.match(/TRECHO NOVO: "([\s\S]*)"$/) || [])[1] || "";
      if (novo.includes("FALHA")) { rs.writeHead(500); return rs.end("{}"); }
      if (novo.includes("quantos funcionários")) {
        return responder({
          perguntasFeitas: [{ id: "p2", trecho: "quantos funcionários vocês têm" }],
          respostas: [{ id: "p2", valor: "35", trecho: "somos uns 35 funcionários" }, { id: "p3", valor: "Sim", trecho: "já usamos o sistema X" }],
        });
      }
      if (novo.includes("trinta")) return responder({ perguntasFeitas: [], respostas: [{ id: "p2", valor: "30", trecho: "trinta" }] });
      return responder({ perguntasFeitas: [], respostas: [] });
    });
  });
  await new Promise((ok) => ia.listen(0, "127.0.0.1", ok));
  t.after(() => ia.close());

  const { base, dbPath } = await subirServidor(t, { ANTHROPIC_API_KEY: "chave-de-teste", ANTHROPIC_BASE_URL: `http://127.0.0.1:${ia.address().port}` });
  const db = new Database(dbPath);
  t.after(() => db.close());
  semear(db);
  const req = cliente(base);
  const E1 = empresa("e1");
  const S1 = vendedor("s1");

  // Importação: uma chamada ao modelo de importação, com o texto do documento.
  const g = await req("/voice/roteiros/gerar", { body: { texto: DOCUMENTO }, cookie: E1 });
  assert.equal(g.status, 200, JSON.stringify(g.corpo));
  assert.equal(g.corpo.origem, "ia");
  assert.equal(g.corpo.nome, "Roteiro de prospecção");
  const imp = pedidos.find((b) => b.output_config?.format?.schema?.required?.includes("blocos"));
  assert.equal(imp.model, "claude-opus-5-5");
  assert.equal(imp.output_config.format.type, "json_schema");
  assert.match(imp.messages[0].content[0].text, /^DOCUMENTO:/);
  const ps = listarPerguntas(g.corpo.estrutura);
  assert.equal(ps.find((p) => p.id === "p4").revisar, true, "pergunta fora do documento fica para revisão");
  assert.equal(ps.find((p) => p.id === "p1").revisar, false);
  assert.equal(g.corpo.estrutura.criterios[0].perguntaId, "p2");

  const id = g.corpo.id;
  await req(`/voice/roteiros/${id}`, { method: "PUT", body: { campanhas: ["c1"] }, cookie: E1 });
  await req(`/voice/roteiros/${id}/publicar`, { body: { publicar: true }, cookie: E1 });
  const ini = await req("/voice/roteiros/execucoes", { body: { scriptId: id, leadId: "L1", callId: "call1" }, cookie: S1 });
  assert.equal(ini.corpo.recursos.ia, true);
  const exId = ini.corpo.execucao.id;
  const aoVivo = () => pedidos.filter((b) => String(b.messages?.[0]?.content || "").includes("TRECHO NOVO"));

  // Ao vivo: IA reconhece pergunta com outras palavras e preenche a resposta;
  // a resposta de p3 cita algo que ninguém disse e é descartada.
  let r = await req(`/voice/roteiros/execucoes/${exId}/trecho`, { body: { texto: "Me conta, quantos funcionários vocês têm? Hoje somos uns 35 funcionários." }, cookie: S1 });
  assert.equal(r.corpo.ia, "ok");
  assert.equal(r.corpo.execucao.estado.respostas.p2.valor, "35");
  assert.equal(r.corpo.execucao.estado.respostas.p2.origem, "ia");
  assert.equal(r.corpo.execucao.estado.respostas.p3, undefined, "resposta sem evidência na fala não entra");
  const vivo = aoVivo()[0];
  assert.equal(vivo.model, "claude-haiku-5-5");
  assert.deepEqual(vivo.thinking, { type: "disabled" });
  assert.deepEqual(vivo.system[1].cache_control, { type: "ephemeral" }, "roteiro em cache");
  assert.match(vivo.system[1].text, /p2 \[numero\] Quantos funcionários/);
  const textoVivo = JSON.stringify(vivo);
  assert.ok(!textoVivo.includes("DOCUMENTO") && !textoVivo.includes("\"document\""), "documento não volta à IA na chamada");

  // Só o trecho novo é analisado; o anterior vai como contexto curto.
  r = await req(`/voice/roteiros/execucoes/${exId}/trecho`, { body: { texto: "Perfeito, obrigado." }, cookie: S1 });
  const segundo = String(aoVivo().at(-1).messages[0].content);
  assert.match(segundo, /TRECHO NOVO: "Perfeito, obrigado\."$/);
  assert.match(segundo, /CONTEXTO ANTERIOR: ".*somos uns 35 funcionários\."/);

  // Correção manual prevalece sobre a IA.
  await req(`/voice/roteiros/execucoes/${exId}`, { method: "PATCH", body: { resposta: { perguntaId: "p2", valor: "40" } }, cookie: S1 });
  r = await req(`/voice/roteiros/execucoes/${exId}/trecho`, { body: { texto: "Na verdade são trinta." }, cookie: S1 });
  assert.equal(r.corpo.execucao.estado.respostas.p2.valor, "40");
  assert.equal(r.corpo.execucao.estado.respostas.p2.origem, "manual");

  // IA fora do ar: a chamada continua (casamento local e manual).
  r = await req(`/voice/roteiros/execucoes/${exId}/trecho`, { body: { texto: "FALHA. Vocês já usam algum sistema de gestão? Sim." }, cookie: S1 });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.ia, "falhou");
  assert.equal(r.corpo.execucao.estado.respostas.p3.valor, "Sim");
  assert.equal(r.corpo.execucao.estado.respostas.p3.origem, "local");

  const row = db.prepare("SELECT iaChamadas, iaTokens FROM voice_roteiro_execucoes WHERE id = ?").get(exId);
  assert.equal(row.iaChamadas, 4);
  assert.ok(row.iaTokens >= 180);
});

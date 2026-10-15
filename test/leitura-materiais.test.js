import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "zlib";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Leitor dos materiais da etapa 3 (services/leituraMateriais.js) e escolha
// das aulas do Academy (services/rag.js). Sem banco e sem rede: a IA é uma
// função falsa.

const pasta = mkdtempSync(join(tmpdir(), "rycs-teste-leitura-"));
process.env.ARQUIVOS_DIR = pasta;
process.env.OPENAI_API_KEY = "";
const { textoOffice, lerMaterial } = await import("../server/services/leituraMateriais.js");
const { escolherAulas } = await import("../server/services/rag.js");
const { identificarFatos, montarEstrategias, lerAjuste } = await import("../server/services/motorEstrategias.js");
const { normalizarParte, parteCompleta } = await import("../shared/onboarding.js");

// Zip mínimo (deflate), do jeito que o Office grava.
function zip(arquivos) {
  const locais = [], centrais = [];
  let offset = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const n = Buffer.from(nome), dados = deflateRawSync(Buffer.from(conteudo));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(dados.length, 18); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(dados.length, 20); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
    locais.push(local, n, dados); centrais.push(central, n);
    offset += 30 + n.length + dados.length;
  }
  const cd = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(Object.keys(arquivos).length, 10);
  fim.writeUInt32LE(cd.length, 12); fim.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, cd, fim]);
}

test("extrai texto de PPTX (slides em ordem e notas), DOCX e XLSX", () => {
  const pptx = zip({
    "ppt/slides/slide2.xml": "<p:sld><a:p><a:r><a:t>Integra com ERP em 1 dia</a:t></a:r></a:p></p:sld>",
    "ppt/slides/slide1.xml": "<p:sld><a:p><a:r><a:t>Nexo CRM</a:t></a:r></a:p><a:p><a:r><a:t>Vendas &amp; distribuição</a:t></a:r></a:p></p:sld>",
    "ppt/notesSlides/notesSlide2.xml": "<p:notes><a:p><a:r><a:t>Citar o case da Distribuidora Sul</a:t></a:r></a:p></p:notes>",
    "ppt/media/image1.png": "binario",
  });
  const t = textoOffice(pptx, "pptx");
  assert.ok(t.indexOf("[Slide 1]") < t.indexOf("[Slide 2]"));
  assert.match(t, /Nexo CRM\nVendas & distribuição/);
  assert.match(t, /Notas: Citar o case da Distribuidora Sul/);

  const docx = zip({ "word/document.xml": '<w:document><w:p><w:r><w:t xml:space="preserve">Garantia de </w:t></w:r><w:r><w:t>30 dias</w:t></w:r></w:p><w:p><w:r><w:t>Suporte 24h</w:t></w:r></w:p></w:document>' });
  assert.equal(textoOffice(docx, "docx"), "Garantia de 30 dias\nSuporte 24h");

  const xlsx = zip({
    "xl/sharedStrings.xml": "<sst><si><t>Plano</t></si><si><t>Preço</t></si><si><t>Pro</t></si></sst>",
    "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>890</v></c></row></sheetData></worksheet>',
  });
  assert.equal(textoOffice(xlsx, "xlsx"), "[Planilha 1]\nPlano\tPreço\nPro\t890");
});

test("lê cada material conforme o formato, sem inventar quando não dá", async () => {
  mkdirSync(join(pasta, "emp"), { recursive: true });
  const salvar = (nome, conteudo) => { writeFileSync(join(pasta, "emp", nome), conteudo); return `emp/${nome}`; };
  const pedidos = [];
  const descrever = async (blocos, pedido) => { pedidos.push({ blocos, pedido }); return "Foto do painel do CRM com gráfico de vendas."; };

  // Foto: vai para a IA como imagem.
  let r = await lerMaterial({ id: "1", nome: "painel.png", chave: salvar("painel.png", "png-falso") }, { descrever });
  assert.equal(r.status, "indexado");
  assert.equal(pedidos.at(-1).blocos[0].type, "image");
  assert.equal(pedidos.at(-1).blocos[0].source.media_type, "image/png");

  // Sem Claude, a foto vai para o OCR interno; sem OCR na máquina, nada de texto inventado.
  r = await lerMaterial({ id: "2", nome: "painel.png", chave: "emp/painel.png" }, { descrever: null });
  assert.equal(r.texto, "");
  assert.notEqual(r.status, "indexado");

  // DOCX curto vai como está, sem chamar a IA.
  const antes = pedidos.length;
  r = await lerMaterial({ id: "3", nome: "proposta.docx", chave: salvar("proposta.docx", zip({ "word/document.xml": "<w:p><w:t>Implantação em 1 dia</w:t></w:p>" })) }, { descrever });
  assert.deepEqual([r.status, r.texto], ["indexado", "Implantação em 1 dia"]);
  assert.equal(pedidos.length, antes);

  // Texto longo vira ficha pela Claude, quando houver.
  const longo = "Reduzimos o retrabalho do estoque em 30% para distribuidoras. ".repeat(100) + "\nNossa sede tem jardim e café para visitantes.\n" + "Texto institucional sem fato algum aqui dentro. ".repeat(300);
  r = await lerMaterial({ id: "4", nome: "manual.txt", chave: salvar("manual.txt", longo) }, { descrever });
  assert.equal(pedidos.length, antes + 1);
  assert.match(pedidos.at(-1).pedido, /ficha comercial/);
  // Sem Claude: resumo extrativo, só com as frases que carregam fato comercial.
  r = await lerMaterial({ id: "4b", nome: "manual.txt", chave: "emp/manual.txt" }, { descrever: null });
  assert.equal(r.status, "indexado");
  assert.match(r.texto, /retrabalho do estoque em 30%/);
  assert.doesNotMatch(r.texto, /jardim|institucional/);

  // Keynote: não é lido, e a leitura explica o porquê.
  r = await lerMaterial({ id: "5", nome: "deck.key", chave: "emp/deck.key" }, { descrever });
  assert.equal(r.status, "sem_texto");
  assert.match(r.leitura, /PDF/);

  // Áudio sem transcrição na máquina (sem whisper local): sem texto, e não é erro.
  r = await lerMaterial({ id: "6", nome: "pitch.mp3", chave: salvar("pitch.mp3", "mp3-falso") }, { descrever });
  assert.equal(r.status, "sem_texto");
  assert.match(r.leitura, /transcrição indisponível/);
});

test("aulas do Academy: as mais ligadas ao caso, com prioridade para WhatsApp e teto de texto", () => {
  const aulas = [
    { id: "a", curso: "Cold call na prática", titulo: "Abertura", conteudo: "Ligação fria para distribuidoras: abertura em dez segundos." },
    { id: "b", curso: "WhatsApp comercial sem parecer spam", titulo: "Primeira mensagem", conteudo: "Primeira mensagem para distribuidoras no WhatsApp." },
    { id: "c", curso: "Challenger", titulo: "Ensinar", conteudo: "Insight sobre mercado financeiro." },
    { id: "d", curso: "SDR", titulo: "Lista", conteudo: "x".repeat(5000) + " distribuidoras" },
  ];
  const escolhidas = escolherAulas("CRM para distribuidoras, primeira mensagem", aulas, { prioridade: [/whats/i], maxCaracteres: 200 });
  assert.equal(escolhidas[0].id, "b");
  assert.ok(escolhidas.some((a) => a.id === "a"));
  assert.ok(!escolhidas.some((a) => a.id === "c"), "aula sem relação fica de fora");
  assert.ok(!escolhidas.some((a) => a.id === "d"), "estoura o teto de texto");
});

// ---------------------------------------------------------------------------
// Motor interno de estratégias (sem provedor externo).

const MATERIAL = `Nexo CRM: o CRM para distribuidoras.
Reduz em 30% o tempo de montagem de pedidos.
Elimina o retrabalho entre vendas e estoque.
Mais de 200 distribuidoras atendidas em 12 estados.
Somos o único CRM integrado nativamente ao ERP Sankhya.
Implantação em 7 dias.
Planos a partir de R$ 890 por mês.
Garantia de 30 dias ou seu dinheiro de volta.
Distribuidoras perdem pedidos por falta de controle do estoque.
Perguntas frequentes
É caro para a minha empresa?
O retorno vem no primeiro trimestre, com a redução de pedidos perdidos.`;

const EMPRESA = { nome: "Nexo", produto: "CRM para distribuidoras", icp: "Distribuidoras de 20 a 200 funcionários", nicho: "Distribuição", diferenciais: "Integração nativa com ERP", regrasMarca: "" };

test("identificador separa os fatos comerciais e as objeções respondidas", () => {
  const f = identificarFatos([MATERIAL], { termosProduto: "CRM distribuidoras" });
  assert.match(f.beneficio[0], /30%|retrabalho/);
  assert.ok(f.prova.some((x) => /200 distribuidoras/.test(x)));
  assert.ok(f.diferencial.some((x) => /único CRM/.test(x)));
  assert.ok(f.preco.some((x) => /R\$ 890/.test(x)));
  assert.ok(f.garantia.some((x) => /Garantia de 30 dias/.test(x)));
  assert.ok(f.prazo.some((x) => /7 dias/.test(x)));
  assert.ok(f.dor.some((x) => /perdem pedidos/.test(x)));
  assert.deepEqual(f.objecoes.map((o) => o.chave), ["preco"]);
});

test("motor monta script, funil e follow-ups com os fatos, as permissões e as aulas", () => {
  const aulas = [{ curso: "WhatsApp comercial sem parecer spam", titulo: "Timing e frequência", conteudo: "" }];
  const base = { empresa: EMPRESA, materiais: [{ texto: MATERIAL }], aulas };

  // Sem permissão de preço e de prazo: não fala valor nem prazo, encaminha ao suporte.
  let r = montarEstrategias({ ...base, permissoes: {} });
  for (const parte of ["script", "funil", "followups"]) {
    const c = normalizarParte(parte, r[parte]);
    assert.ok(parteCompleta(parte, c), `${parte} completo`);
  }
  const tudo = JSON.stringify([r.script, r.funil, r.followups]);
  assert.doesNotMatch(tudo, /R\$ 890|\{ticket\}|7 dias/);
  assert.match(r.script.oferta, /\{contato de suporte\}/);
  assert.match(r.script.oferta, /30%|retrabalho/);
  assert.match(r.script.oferta, /200 distribuidoras/);
  assert.match(r.script.fechamento, /garantia de 30 dias/i);
  assert.match(r.funil.objecoes, /Se disser "Está caro": O retorno vem no primeiro trimestre/);
  assert.match(r.script.qualificacao, /Decisão/, "B2B pergunta quem decide");
  assert.ok(r.followups.length >= 3 && r.followups.length <= 6);
  assert.match(r.followups.at(-1).mensagem, /última mensagem/);
  assert.doesNotMatch(tudo, /👋|✅/);
  assert.deepEqual(r.fontes, ["WhatsApp comercial sem parecer spam — Timing e frequência"]);

  // Com permissão: preço e prazo entram, e emojis também.
  r = montarEstrategias({ ...base, permissoes: { informarPrecos: true, combinarPrazos: true, usarEmojis: true } });
  assert.match(r.script.oferta, /R\$ 890/);
  assert.match(r.script.oferta, /7 dias/);
  assert.match(r.funil.boasVindas, /👋/);

  // Mesma entrada, mesma saída.
  assert.deepEqual(montarEstrategias({ ...base, permissoes: {} }), montarEstrategias({ ...base, permissoes: {} }));

  // Sem material nenhum: continua completo, sem inventar número.
  r = montarEstrategias({ empresa: { produto: "Consultoria", icp: "" }, permissoes: {}, materiais: [], aulas: [] });
  assert.ok(parteCompleta("script", r.script) && parteCompleta("funil", r.funil));
  assert.doesNotMatch(JSON.stringify(r), /\d+%/);
});

test("ajustes que o motor interno entende: forma, não conteúdo", () => {
  assert.deepEqual(lerAjuste("Deixe mais curto e sem emojis").ajuste, { curto: true, emojis: false });
  assert.deepEqual(lerAjuste("mais formal, não fale de preço").ajuste, { formal: true, semPreco: true });
  assert.equal(lerAjuste("cite o case da Distribuidora Sul").entendido, false);
  const curto = montarEstrategias({ empresa: EMPRESA, permissoes: {}, materiais: [{ texto: MATERIAL }], pedidoAjuste: "mais curto" });
  const normal = montarEstrategias({ empresa: EMPRESA, permissoes: {}, materiais: [{ texto: MATERIAL }] });
  assert.ok(curto.script.abertura.length < normal.script.abertura.length);
  assert.equal(curto.ajusteEntendido, true);
});

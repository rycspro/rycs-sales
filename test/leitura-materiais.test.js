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

  // Sem IA, a foto fica para a próxima leitura (erro), sem texto inventado.
  r = await lerMaterial({ id: "2", nome: "painel.png", chave: "emp/painel.png" }, { descrever: null });
  assert.deepEqual([r.status, r.texto], ["erro", ""]);

  // DOCX curto vai como está, sem chamar a IA.
  const antes = pedidos.length;
  r = await lerMaterial({ id: "3", nome: "proposta.docx", chave: salvar("proposta.docx", zip({ "word/document.xml": "<w:p><w:t>Implantação em 1 dia</w:t></w:p>" })) }, { descrever });
  assert.deepEqual([r.status, r.texto], ["indexado", "Implantação em 1 dia"]);
  assert.equal(pedidos.length, antes);

  // Texto longo vira ficha pela IA.
  r = await lerMaterial({ id: "4", nome: "manual.txt", chave: salvar("manual.txt", "Integração com ERP. ".repeat(1000)) }, { descrever });
  assert.equal(pedidos.length, antes + 1);
  assert.match(pedidos.at(-1).pedido, /ficha comercial/);

  // Keynote: não é lido, e a leitura explica o porquê.
  r = await lerMaterial({ id: "5", nome: "deck.key", chave: "emp/deck.key" }, { descrever });
  assert.equal(r.status, "sem_texto");
  assert.match(r.leitura, /PDF/);

  // Áudio sem transcrição configurada: sem texto, e não é erro.
  r = await lerMaterial({ id: "6", nome: "pitch.mp3", chave: salvar("pitch.mp3", "mp3-falso") }, { descrever });
  assert.equal(r.status, "sem_texto");
  assert.match(r.leitura, /transcrição não configurada/);
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

const limpar = (s) => String(s ?? "").trim();

export function parseTabela(texto) {
  const linhas = String(texto || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return { colunas: [], linhas: [] };
  const delimitador = [",", ";", "\t"].sort((a, b) => (linhas[0].split(b).length - linhas[0].split(a).length))[0];
  const parse = (linha) => {
    const out = []; let atual = "", aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i];
      if (ch === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
      else if (ch === '"') aspas = !aspas;
      else if (ch === delimitador && !aspas) { out.push(limpar(atual)); atual = ""; }
      else atual += ch;
    }
    out.push(limpar(atual)); return out;
  };
  const colunas = parse(linhas[0]).map((x, i) => x || `Coluna ${i + 1}`);
  return { colunas, linhas: linhas.slice(1).map(parse).filter((r) => r.some(Boolean)) };
}

const xmlText = (buffer) => new TextDecoder().decode(buffer);

async function arquivosZip(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Arquivo XLSX inválido.");
  const total = view.getUint16(eocd + 10, true), inicio = view.getUint32(eocd + 16, true);
  const arquivos = new Map(); let pos = inicio;
  for (let i = 0; i < total; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error("Estrutura XLSX inválida.");
    const metodo = view.getUint16(pos + 10, true), tamanho = view.getUint32(pos + 20, true);
    const nomeTam = view.getUint16(pos + 28, true), extraTam = view.getUint16(pos + 30, true), comentarioTam = view.getUint16(pos + 32, true);
    const local = view.getUint32(pos + 42, true), nome = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + nomeTam));
    const localNome = view.getUint16(local + 26, true), localExtra = view.getUint16(local + 28, true);
    const comprimido = bytes.slice(local + 30 + localNome + localExtra, local + 30 + localNome + localExtra + tamanho);
    let conteudo;
    if (metodo === 0) conteudo = comprimido;
    else if (metodo === 8 && typeof DecompressionStream !== "undefined") {
      const fluxo = new Blob([comprimido]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      conteudo = new Uint8Array(await new Response(fluxo).arrayBuffer());
    } else throw new Error("Compactação XLSX não suportada neste navegador.");
    arquivos.set(nome, conteudo); pos += 46 + nomeTam + extraTam + comentarioTam;
  }
  return arquivos;
}

export async function lerArquivoLeads(file) {
  if (!file) throw new Error("Escolha um arquivo.");
  if (!/\.xlsx$/i.test(file.name)) return parseTabela(await file.text());
  const zip = await arquivosZip(await file.arrayBuffer());
  const parser = new DOMParser();
  const sharedXml = zip.get("xl/sharedStrings.xml");
  const compartilhadas = sharedXml ? [...parser.parseFromString(xmlText(sharedXml), "text/xml").querySelectorAll("si")].map((si) => [...si.querySelectorAll("t")].map((t) => t.textContent).join("")) : [];
  const sheetBytes = zip.get("xl/worksheets/sheet1.xml") || [...zip.entries()].find(([k]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))?.[1];
  if (!sheetBytes) throw new Error("A primeira planilha não foi encontrada.");
  const sheet = parser.parseFromString(xmlText(sheetBytes), "text/xml");
  const matriz = [...sheet.querySelectorAll("row")].map((row) => {
    const valores = [];
    [...row.querySelectorAll("c")].forEach((cell) => {
      const ref = cell.getAttribute("r") || "A1", letras = ref.match(/[A-Z]+/)?.[0] || "A";
      let indice = 0; for (const ch of letras) indice = indice * 26 + ch.charCodeAt(0) - 64; indice--;
      const tipo = cell.getAttribute("t"), bruto = cell.querySelector("v")?.textContent ?? cell.querySelector("t")?.textContent ?? "";
      valores[indice] = tipo === "s" ? (compartilhadas[Number(bruto)] || "") : bruto;
    });
    return valores.map(limpar);
  });
  const colunas = (matriz.shift() || []).map((x, i) => x || `Coluna ${i + 1}`);
  return { colunas, linhas: matriz.filter((r) => r.some(Boolean)) };
}

export function sugerirMapeamento(colunas) {
  const aliases = {
    nome: ["nome", "contato", "lead"], empresa: ["empresa", "company", "conta"], cargo: ["cargo", "titulo", "função", "funcao"],
    telefone: ["telefone", "celular", "whatsapp", "fone"], email: ["email", "e-mail"], valorEstimado: ["valor", "receita", "ticket"],
  };
  return Object.fromEntries(Object.entries(aliases).map(([campo, nomes]) => [campo, colunas.findIndex((c) => nomes.some((n) => c.toLocaleLowerCase("pt-BR").includes(n))) ]));
}

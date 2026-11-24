// Pedidos da empresa: regras puras do gerador de pedidos.

export const STATUS_PEDIDO = {
  rascunho: { nome: "Rascunho", tom: "muted" },
  aprovado: { nome: "Aprovado", tom: "indigo" },
  enviando: { nome: "Enviando ao ERP", tom: "amber" },
  enviado: { nome: "No ERP", tom: "brand" },
  erro: { nome: "Recusado pelo ERP", tom: "red" },
  conferir: { nome: "Conferir no ERP", tom: "amber" },
  cancelado: { nome: "Cancelado", tom: "muted" },
};
// Só dá para mexer no que ainda não foi (ou não foi aceito) pelo ERP.
export const editavel = (status) => ["rascunho", "erro"].includes(status);

export const ORIGENS = { erp: "ERP", rycs: "RYCS", whatsapp: "WhatsApp", instagram: "Instagram", manual: "Digitado" };

const cent = (v) => Math.round((Number(v) || 0) * 100);
const numero = (v) => { const n = Number(typeof v === "string" ? v.replace(",", ".") : v); return Number.isFinite(n) ? n : 0; };
const txt = (v, max) => String(v ?? "").trim().slice(0, max);

export function totais({ itens = [], desconto = 0, frete = 0 }) {
  const subtotal = itens.reduce((s, i) => s + Math.round(cent(i.valor) * numero(i.quantidade)), 0);
  return { subtotal: subtotal / 100, total: Math.max(0, subtotal - cent(desconto) + cent(frete)) / 100 };
}

export function normalizarPedido(dados = {}) {
  const c = dados.cliente || {};
  return {
    cliente: {
      nome: txt(c.nome, 120), documento: txt(c.documento, 20).replace(/\D/g, ""), telefone: txt(c.telefone, 20).replace(/\D/g, ""),
      email: txt(c.email, 160).toLowerCase(), endereco: txt(c.endereco, 300), erpId: txt(c.erpId, 80),
    },
    itens: (Array.isArray(dados.itens) ? dados.itens : []).slice(0, 100).map((i) => ({
      erpId: txt(i.erpId, 80), codigo: txt(i.codigo, 80), nome: txt(i.nome, 250), unidade: txt(i.unidade, 10) || "UN",
      quantidade: Math.max(0, Math.round(numero(i.quantidade) * 1000) / 1000), valor: Math.max(0, cent(numero(i.valor)) / 100), origem: ["erp", "rycs"].includes(i.origem) ? i.origem : "manual",
    })).filter((i) => i.nome),
    desconto: Math.max(0, cent(numero(dados.desconto)) / 100), frete: Math.max(0, cent(numero(dados.frete)) / 100),
    observacoes: txt(dados.observacoes, 1000),
  };
}

// O que impede a aprovação.
export function errosDoPedido(p) {
  const e = [];
  if ((p.cliente?.nome || "").length < 2) e.push("Informe o nome do cliente.");
  if (p.cliente?.documento && ![11, 14].includes(p.cliente.documento.length)) e.push("CPF ou CNPJ incompleto.");
  if (!p.itens?.length) e.push("Inclua ao menos um item.");
  for (const i of p.itens || []) {
    if (!(i.quantidade > 0)) e.push(`Informe a quantidade de "${i.nome}".`);
    if (!(i.valor > 0)) e.push(`Informe o valor de "${i.nome}".`);
  }
  if (!e.length && cent(p.desconto) > cent(totais({ itens: p.itens }).subtotal)) e.push("O desconto é maior que o subtotal.");
  return e;
}

export function textoPedido(p, moeda = (v) => `R$ ${v.toFixed(2).replace(".", ",")}`) {
  const t = totais(p);
  return [
    `Pedido${p.numero ? ` ${p.numero}` : ""}${p.cliente?.nome ? ` — ${p.cliente.nome}` : ""}`,
    ...p.itens.map((i) => `• ${String(i.quantidade).replace(".", ",")} ${i.unidade} ${i.nome} — ${moeda(i.valor)} cada`),
    p.desconto ? `Desconto: ${moeda(p.desconto)}` : "", p.frete ? `Frete: ${moeda(p.frete)}` : "", `Total: ${moeda(t.total)}`,
    p.observacoes ? `Obs.: ${p.observacoes}` : "",
  ].filter(Boolean).join("\n");
}

// ── Leitura da conversa pelo motor interno ────────────────────────────────
//
// Só reconhece produto que existe no catálogo, pelo código ou pelo nome, e
// quantidade escrita junto. Nunca inventa item nem preço.

const limpar = (t) => String(t || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");
const IGNORAR = new Set(["para", "com", "sem", "por", "dos", "das", "uma", "uns", "kit", "the", "und", "unidade", "unidades"]);
const palavras = (t) => (limpar(t).match(/[a-z0-9]{3,}/g) || []).filter((p) => !IGNORAR.has(p));
const POR_EXTENSO = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, doze: 12, quinze: 15, vinte: 20, trinta: 30, cinquenta: 50, cem: 100 };
const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const raiz = (p) => (p.length > 4 ? p.replace(/(oes|aes|ais|eis|is|es|s)$/, "") : p);

// Palavras sem acento e no singular: "Camisetas Pretas" e "camiseta preta" batem.
export const raizesDe = (t) => [...new Set(palavras(t).map(raiz))];

function quantidadeAntes(texto, posicao) {
  const m = /(\d{1,5}(?:[.,]\d{1,3})?|[a-z]+)\s*(?:x|un|und|unid|unidades?|pcs?|pecas?|caixas?|cx|pacotes?|kg|metros?|litros?)?\s*(?:d[eoa]s?\s+)?$/.exec(texto.slice(Math.max(0, posicao - 30), posicao));
  if (!m) return null;
  const n = /^\d/.test(m[1]) ? Number(m[1].replace(",", ".")) : POR_EXTENSO[m[1]];
  return n > 0 && n <= 10000 ? n : null;
}

export function extrairItens(mensagens, produtos) {
  const achados = new Map();
  const base = produtos.map((p) => ({ p, termos: [...new Set(palavras(p.nome))].map(raiz), codigo: limpar(p.codigo).trim() })).filter((x) => x.termos.length || x.codigo.length >= 3);
  for (const m of mensagens) {
    const texto = limpar(m.texto);
    if (!texto) continue;
    const candidatos = [];
    for (const x of base) {
      const cod = x.codigo.length >= 3 ? new RegExp(`(^|[^a-z0-9])${escapar(x.codigo)}(?=$|[^a-z0-9])`).exec(texto) : null;
      if (cod) { candidatos.push({ ...x, pontos: 100, pos: cod.index + cod[1].length }); continue; }
      const pos = x.termos.map((t) => { const r = new RegExp(`(^|[^a-z0-9])${escapar(t)}`).exec(texto); return r ? r.index + r[1].length : -1; });
      const presentes = pos.filter((i) => i >= 0).length;
      // Nome inteiro, ou a maior parte dele quando tem 3 palavras ou mais.
      if (x.termos.length && (presentes === x.termos.length || (x.termos.length >= 3 && presentes >= 2 && presentes / x.termos.length >= 0.6))) candidatos.push({ ...x, pontos: presentes, pos: Math.min(...pos.filter((i) => i >= 0)) });
    }
    // Mesmo trecho batendo em vários produtos: fica o mais específico.
    for (const c of candidatos.sort((a, b) => b.pontos - a.pontos)) {
      if (candidatos.some((o) => o !== c && o.pos === c.pos && o.pontos > c.pontos)) continue;
      const q = quantidadeAntes(texto, c.pos);
      const atual = achados.get(c.p.externoId);
      if (!atual || q) achados.set(c.p.externoId, { produto: c.p, quantidade: q ?? atual?.quantidade ?? 1, quantidadeInformada: q != null || !!atual?.quantidadeInformada, mensagem: m.id });
    }
  }
  return [...achados.values()];
}

// Dados do cliente escritos na conversa (só os formatos inconfundíveis).
export function extrairCliente(mensagens) {
  const r = {};
  for (const m of mensagens.filter((x) => x.direcao === "recebida")) {
    const t = String(m.texto || "");
    const email = /[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}/i.exec(t)?.[0];
    const cnpj = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/.exec(t)?.[0], cpf = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.exec(t)?.[0];
    if (email) r.email = { valor: email.toLowerCase(), mensagem: m.id };
    if (cnpj || cpf) r.documento = { valor: (cnpj || cpf).replace(/\D/g, ""), mensagem: m.id };
  }
  return r;
}

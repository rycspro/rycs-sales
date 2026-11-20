// Histórico das campanhas de anúncio da RYCS no admin (aba Campanhas).
//
// Cada visitante e cada conta carregam a origem de primeiro toque (UTMs do
// anúncio). Aqui eles são agrupados em campanha → conjunto → anúncio, como no
// Gerenciador de Anúncios, e somados ao gasto que vem da Meta (quando a conta
// de anúncios está conectada). Os nomes batem porque os anúncios usam
// utm_campaign={{campaign.name}}, utm_term={{adset.name}} e
// utm_content={{ad.name}}.
//
// Há dois tipos de campanha: de profissionais e de empresas. O tipo de cada
// campanha sai dos próprios dados (quem abriu qual cadastro, quem criou qual
// conta); sem dados ainda, do nome da campanha.

export const SEM_CAMPANHA = "(sem campanha)";
export const SEM_CONJUNTO = "(sem conjunto)";
export const SEM_ANUNCIO = "(sem anúncio)";

// Marcos da jornada contados em cada tipo de campanha (chaves de shared/jornada.js).
export const MARCOS_CAMPANHA = {
  vendedor: [
    { chave: "email", label: "E-mail confirmado" },
    { chave: "perfil", label: "Perfil completo" },
    { chave: "candidatura", label: "Candidatou-se" },
    { chave: "aprovado", label: "Aprovado em campanha" },
  ],
  empresa: [
    { chave: "email", label: "E-mail confirmado" },
    { chave: "plano", label: "Plano escolhido" },
    { chave: "publicada", label: "Publicou campanha" },
    { chave: "saldo", label: "Depositou" },
  ],
};

// Dia no fuso de Brasília, "AAAA-MM-DD".
export function chaveDia(ms) {
  return new Date(ms).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

const nomes = (o = {}) => [o.utm_campaign || SEM_CAMPANHA, o.utm_term || SEM_CONJUNTO, o.utm_content || SEM_ANUNCIO];

export function tipoPeloNome(nome) {
  const n = String(nome || "").toLowerCase();
  if (/prof|vendedor|seller|freelanc|sales ?rep/.test(n)) return "vendedor";
  if (/empresa|compan|business|b2b|negocio|negócio/.test(n)) return "empresa";
  return "";
}

function novoGrupo(nome) {
  return { nome, visitas: 0, abriram: 0, contas: 0, leads: 0, leadsConta: 0, marcos: {}, paises: {}, depositos: {}, gasto: 0, impressoes: 0, cliques: 0, temGasto: false, dias: {} };
}

const dia = (g, d) => (g.dias[d] ||= { dia: d, visitas: 0, contas: 0, leads: 0, gasto: 0 });
const mais = (obj, chave, n = 1) => { obj[chave] = (obj[chave] || 0) + n; };

function fechar(g, filhos) {
  const { dias, ...resto } = g;
  return {
    ...resto,
    custoPorConta: g.temGasto && g.contas ? g.gasto / g.contas : null,
    custoPorLead: g.temGasto && g.leads ? g.gasto / g.leads : null,
    dias: Object.values(dias).sort((a, b) => a.dia.localeCompare(b.dia)),
    ...(filhos && { [filhos.chave]: filhos.lista }),
  };
}

// Resultado = contas criadas + leads de formulário; depois visitas e gasto.
const ordenar = (a, b) => (b.contas + b.leads) - (a.contas + a.leads) || b.visitas - a.visitas || b.gasto - a.gasto || a.nome.localeCompare(b.nome);

// visitantes: [{ origem, em, papel }] — papel = qual cadastro abriu ("" se nenhum)
// contas:     [{ origem, criadoEm, papel, pais, marcos, depositos: { BRL: 100 } }]
// gastos:     [{ campanha, conjunto, anuncio, gasto, impressoes, cliques }] (por anúncio)
// gastosDia:  [{ campanha, dia, gasto }]
// leads:      [{ campanha, conjunto, anuncio, em, conta }] — formulário instantâneo da Meta;
//             `conta` = a pessoa já criou conta na plataforma
export function agruparCampanhas({ tipo, visitantes = [], contas = [], gastos = [], gastosDia = [], leads = [] }) {
  const papel = tipo === "empresa" ? "empresa" : "vendedor";

  // 1) Tipo de cada campanha: sinais dos dois cadastros; sem sinal, o nome.
  const sinais = new Map();
  const sinal = (nome, p) => { if (!p) return; const s = sinais.get(nome) || { vendedor: 0, empresa: 0 }; s[p] += 1; sinais.set(nome, s); };
  for (const v of visitantes) sinal(nomes(v.origem)[0], v.papel);
  for (const c of contas) sinal(nomes(c.origem)[0], c.papel);
  const tipoDe = (nome) => {
    const s = sinais.get(nome);
    if (s && (s.vendedor || s.empresa)) return s.vendedor >= s.empresa ? "vendedor" : "empresa";
    return tipoPeloNome(nome);
  };
  const entra = (nome) => { const t = tipoDe(nome); return !t || t === papel; };

  // 2) Árvore campanha → conjunto → anúncio, com o total por cima.
  const total = novoGrupo("Total");
  const campanhas = new Map();
  const grupos = ([c, s, a]) => {
    let gc = campanhas.get(c);
    if (!gc) campanhas.set(c, gc = { g: novoGrupo(c), conjuntos: new Map() });
    let gs = gc.conjuntos.get(s);
    if (!gs) gc.conjuntos.set(s, gs = { g: novoGrupo(s), anuncios: new Map() });
    let ga = gs.anuncios.get(a);
    if (!ga) gs.anuncios.set(a, ga = novoGrupo(a));
    return [total, gc.g, gs.g, ga];
  };

  for (const v of visitantes) {
    const n = nomes(v.origem);
    if (!entra(n[0])) continue;
    for (const g of grupos(n)) {
      g.visitas += 1;
      if (v.papel === papel) g.abriram += 1;
      dia(g, chaveDia(v.em)).visitas += 1;
    }
  }

  const marcos = MARCOS_CAMPANHA[papel];
  for (const c of contas) {
    const n = nomes(c.origem);
    if (c.papel !== papel || !entra(n[0])) continue;
    for (const g of grupos(n)) {
      g.contas += 1;
      for (const m of marcos) if (c.marcos?.[m.chave]) mais(g.marcos, m.chave);
      mais(g.paises, c.pais || "?");
      for (const [moeda, valor] of Object.entries(c.depositos || {})) mais(g.depositos, moeda, Number(valor) || 0);
      dia(g, chaveDia(c.criadoEm)).contas += 1;
    }
  }

  for (const l of leads) {
    const n = [l.campanha || SEM_CAMPANHA, l.conjunto || SEM_CONJUNTO, l.anuncio || SEM_ANUNCIO];
    if (!entra(n[0])) continue;
    for (const g of grupos(n)) {
      g.leads += 1;
      if (l.conta) g.leadsConta += 1;
      dia(g, chaveDia(l.em)).leads += 1;
    }
  }

  for (const x of gastos) {
    const n = [x.campanha || SEM_CAMPANHA, x.conjunto || SEM_CONJUNTO, x.anuncio || SEM_ANUNCIO];
    if (!entra(n[0])) continue;
    for (const g of grupos(n)) {
      g.gasto += Number(x.gasto) || 0;
      g.impressoes += Number(x.impressoes) || 0;
      g.cliques += Number(x.cliques) || 0;
      g.temGasto = true;
    }
  }
  for (const x of gastosDia) {
    const nome = x.campanha || SEM_CAMPANHA;
    if (!entra(nome)) continue;
    const gc = campanhas.get(nome)?.g;
    for (const g of gc ? [total, gc] : [total]) dia(g, x.dia).gasto += Number(x.gasto) || 0;
  }
  if (gastos.length) total.temGasto = true;

  const lista = [...campanhas.values()].map(({ g, conjuntos }) => fechar({ ...g, tipo: tipoDe(g.nome) }, {
    chave: "conjuntos",
    lista: [...conjuntos.values()].map(({ g: gs, anuncios }) => fechar(gs, {
      chave: "anuncios",
      lista: [...anuncios.values()].map((ga) => fechar(ga)).sort(ordenar),
    })).sort(ordenar),
  })).sort(ordenar);

  return { tipo: papel, marcos, total: fechar(total), campanhas: lista };
}

// field_data de um lead do formulário instantâneo → { nome, email, telefone, cidade, pais, outros }.
// Os nomes padrão da Meta vêm em inglês; perguntas próprias ficam em `outros`.
const PADRAO = { full_name: "nome", email: "email", phone_number: "telefone", city: "cidade", country: "pais" };

// Telefone pedido numa pergunta personalizada (ex.: "whatsapp_number") quando o
// formulário não usa o campo padrão de telefone.
export function telefoneDosOutros(outros = {}) {
  const k = Object.keys(outros || {}).find((n) => /whats|phone|telefone|celular|mobile/i.test(n) && String(outros[n]).replace(/\D/g, "").length >= 8);
  return k ? String(outros[k]) : "";
}

export function lerCamposLead(fieldData = []) {
  const lido = { nome: "", email: "", telefone: "", cidade: "", pais: "", outros: {} };
  let primeiro = "", ultimo = "";
  for (const campo of Array.isArray(fieldData) ? fieldData : []) {
    const nome = String(campo?.name || "");
    const valor = String((campo?.values || [])[0] ?? "").trim().slice(0, 300);
    if (!nome || !valor) continue;
    if (PADRAO[nome]) lido[PADRAO[nome]] = valor;
    else if (nome === "first_name") primeiro = valor;
    else if (nome === "last_name") ultimo = valor;
    else lido.outros[nome.slice(0, 80)] = valor;
  }
  if (!lido.nome) lido.nome = [primeiro, ultimo].filter(Boolean).join(" ");
  if (!lido.telefone) lido.telefone = telefoneDosOutros(lido.outros);
  lido.email = lido.email.toLowerCase();
  return lido;
}

// Últimos dígitos do telefone, para casar lead e conta mesmo com DDI/formatos diferentes.
export const chaveTelefone = (v) => String(v || "").replace(/\D/g, "").slice(-10);

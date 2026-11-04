// Jarvas: o assistente que monta a campanha conversando.
//
// Roda inteiro dentro da RYCS, sem provedor externo. Três partes:
//
// 1. INTERPRETAÇÃO. Lê o que a pessoa escreveu ou falou, em português do dia
//    a dia: "3 vendedores em Sorocaba visitando indústrias", "uns cinco mil",
//    "dois mil e quinhentos por mês". Uma frase pode responder várias
//    perguntas de uma vez, e as que já foram respondidas não são feitas.
// 2. CONDUÇÃO. Decide a próxima pergunta. O que já está no cadastro (ticket,
//    cliente ideal) vira confirmação de um toque em vez de pergunta.
// 3. RESPOSTA. Reage ao que foi dito com conta de verdade (comissão a partir
//    do ticket, custo por visita a partir do orçamento) antes de seguir. Nada
//    é inventado: sem dado, a frase diz que o valor fica para a revisão.
//
// Funções puras: a tela (src/components/empresa/NovaCampanha.jsx) só cuida do
// ritmo da conversa e da voz.

import { OBJETIVOS } from "./objetivosCampanha.js";
import { detectarObjetivo, extrairRegiao, extrairPublico } from "./interpretacaoCampanha.js";

export const OBJETIVO_OPCOES = [
  { valor: "campo", label: "Porta a porta" }, { valor: "visitas", label: "Visitas presenciais" },
  { valor: "reunioes", label: "Agendar reuniões" }, { valor: "leads", label: "Gerar leads" },
  { valor: "vendas", label: "Fechar vendas" }, { valor: "completa", label: "Prospecção completa" },
  { valor: "prospeccao", label: "Abrir mercado novo" }, { valor: "reativacao", label: "Reativar clientes" },
];
export const rotuloObjetivo = (k) => OBJETIVO_OPCOES.find((o) => o.valor === k)?.label || OBJETIVOS[k]?.nome || k;

const DIAS_UTEIS = 22;
const ACAO = { agendamento: "reunião agendada", visita: "visita", venda: "venda fechada" };
const ACAO_CURTA = { agendamento: "reunião", visita: "visita", venda: "venda" };

const sem = (t) => String(t || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");
export const dinheiro = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: Number(v) % 1 ? 2 : 0 });

// ---------------------------------------------------------------------------
// Números, em algarismo ou por extenso.

const UNIDADES = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300,
  quatrocentos: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
};
const MULTIPLICADORES = { mil: 1000, milhao: 1e6, milhoes: 1e6 };
const PALAVRA_NUMERO = `(?:${[...Object.keys(UNIDADES), ...Object.keys(MULTIPLICADORES)].join("|")})`;
const NUMERO_EXTENSO = `${PALAVRA_NUMERO}(?:\\s+(?:e\\s+)?${PALAVRA_NUMERO})*`;
const NUMERO_DIGITO = String.raw`r?\$?\s*\d[\d.]*(?:,\d+)?\s*(?:mil\b|k\b|mi\b|milh(?:ao|oes)\b)?`;
const NUMERO = `(?:${NUMERO_DIGITO}|${NUMERO_EXTENSO})`;

function porExtenso(trecho) {
  let total = 0, atual = 0, achou = false;
  for (const p of trecho.split(/\s+/)) {
    if (p === "e") continue;
    if (UNIDADES[p] != null) { atual += UNIDADES[p]; achou = true; }
    else if (MULTIPLICADORES[p]) { total += (atual || 1) * MULTIPLICADORES[p]; atual = 0; achou = true; }
  }
  return achou ? total + atual : null;
}

// Primeiro número do texto. "R$ 2.500,00" → 2500; "5 mil" → 5000; "3k" → 3000;
// "1,5 mil" → 1500; "dois mil e quinhentos" → 2500.
export function numeroDe(texto) {
  const n = sem(texto);
  const d = n.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(mil\b|k\b|mi\b|milh(?:ao|oes)\b)?/);
  if (d) {
    const base = Number(`${d[1].replace(/\./g, "")}${d[2] ? `.${d[2]}` : ""}`);
    const mult = d[3] ? (d[3].startsWith("mi") && d[3] !== "mil" ? 1e6 : 1000) : 1;
    return Math.round(base * mult * 100) / 100;
  }
  const e = n.match(new RegExp(`\\b${NUMERO_EXTENSO}\\b`));
  return e ? porExtenso(e[0]) : null;
}

// Taxa de conversão: "3" ou "3 de 10" → 0,3; "30%" → 0,3; "1 em 4" → 0,25.
export function taxaDe(texto) {
  const n = sem(texto);
  let m = n.match(new RegExp(`(${NUMERO})\\s*(?:de cada|em cada|a cada|de|em)\\s*(${NUMERO})`));
  if (m) { const a = numeroDe(m[1]), b = numeroDe(m[2]); if (a != null && b > 0 && a <= b) return a / b; }
  m = n.match(/(\d+(?:[.,]\d+)?)\s*(?:%|por cento)/);
  if (m) return Math.min(1, parseFloat(m[1].replace(",", ".")) / 100);
  const v = numeroDe(texto);
  if (v == null || v < 0) return null;
  return v <= 10 ? v / 10 : v <= 100 ? v / 100 : null;
}

// Retorno desejado, em vezes: "5", "5x", "5 vezes" → 5; "500%" → 5.
export function multiploDe(texto) {
  const n = sem(texto);
  const m = n.match(/(\d+(?:[.,]\d+)?)\s*(?:%|por cento)/);
  if (m) { const v = parseFloat(m[1].replace(",", ".")) / 100; return v > 1 ? v : null; }
  const v = numeroDe(n.replace(/(\d)\s*x\b/, "$1"));
  return v != null && v > 1 && v <= 50 ? v : null;
}

const decimal = (v) => Number(Number(v).toFixed(1)).toLocaleString("pt-BR");

// ---------------------------------------------------------------------------
// 1. Interpretação

const NAO_SEI = /\b(nao sei|sei la|nao faco ideia|nao tenho (ideia|certeza)|pula|pular|depois|tanto faz|nao defini|ainda nao|sem ideia|nenhuma ideia|nao tenho|n[aã]o decidi|skip|ignora|proxima|nao (tenho|sei) (esse|esse dado|isso)|n[aã]o (tenho|sei) ainda)\b/;
const PESSOAS = "(?:profission\\w*|vendedor\\w*|pessoas?|sdrs?|bdrs?|closers?|promotor\\w*|representantes?|consultor\\w*|corretor\\w*|hunter\\w*|farmer\\w*|inside\\s+sales|account\\w*|agente\\w*|time de vendas?|equipe de vendas?)";

const capitalizar = (t) => (t ? t[0].toLocaleUpperCase("pt-BR") + t.slice(1) : t);
const limparResposta = (t) => String(t || "").trim()
  .replace(/^(e |é |eh |acho que |seria |sera |vai ser |fica |bom |ent[aã]o |tipo |pois |olha |ah |[oó]timo )/i, "")
  .replace(/^(quero |gostaria de |preciso de |vou querer )/i, "")
  .replace(/[.!]+$/, "").trim();

// Valor de um campo a partir de um trecho curto ("Sorocaba", "3", "5 mil").
// undefined = não entendeu.
function lerCampo(campo, trecho) {
  const bruto = String(trecho || "").trim();
  const n = sem(bruto);
  if (!bruto) return undefined;
  const naoSabe = NAO_SEI.test(n);
  switch (campo) {
    case "objetivo": {
      const op = OBJETIVO_OPCOES.find((o) => sem(o.label) === n.replace(/[.!]+$/, ""));
      return op?.valor || detectarObjetivo(bruto) || undefined;
    }
    case "vagas": case "visitasPorDia": case "meta": {
      const v = numeroDe(bruto);
      return v != null && v > 0 ? Math.round(v) : undefined;
    }
    case "ticketMedio": case "fixoMensal": {
      const v = numeroDe(bruto);
      return v != null ? v : naoSabe ? 0 : undefined;
    }
    case "conversao": {
      if (naoSabe) return 0;
      const v = taxaDe(bruto);
      return v != null ? Math.round(v * 1000) / 1000 : undefined;
    }
    case "retorno":
      return naoSabe ? undefined : multiploDe(bruto) || undefined;
    case "regiao": {
      if (naoSabe) return undefined;
      const t = limparResposta(bruto).replace(/^(em|no|na|nos|nas|para|pra)\s+/i, "");
      return /[a-zà-ú]{2}/i.test(t) && t.length <= 80 ? capitalizar(t) : undefined;
    }
    case "publico": {
      if (naoSabe) return undefined;
      const t = limparResposta(bruto);
      return t.length >= 3 ? capitalizar(t) : undefined;
    }
    case "titulo": {
      const t = limparResposta(bruto).replace(/^(d[ae]\s+campanha\s*)/i, "").replace(/^(para|pra|de|é|e|:)\s+/i, "").replace(/^["“]|["”]$/g, "");
      return t.length >= 3 && t.length <= 90 ? capitalizar(t) : undefined;
    }
    case "valorPrincipal": case "valorVenda": case "orcamento": {
      const v = numeroDe(bruto);
      return v != null && v >= 0 ? v : undefined;
    }
    case "prazoHoras": {
      const v = numeroDe(bruto);
      if (v == null || v <= 0) return undefined;
      return Math.round(/\bdias?\b/.test(n) ? v * 24 : v);
    }
    default: return undefined;
  }
}

// Campo dito pelo nome, em qualquer momento da conversa: "muda o ticket para
// 8 mil", "na verdade a região é Campinas", "coloca 4 profissionais". O
// reconhecimento de voz escreve "ticket" de vários jeitos ("tíquete").
const ROTULOS = [
  ["ticketMedio", /\b(ticket|tiquete|tiket|tique|valor medio|venda media|preco medio|ticket medio|valor da venda|preco da venda)\b/],
  ["conversao", /\b(conversao|taxa de conversao|fecham|taxa de fechamento|quantas fecham)\b/],
  ["retorno", /\b(retorno|roi|quantas vezes)\b/],
  ["meta", /\b(meta|reunioes por mes|vendas por mes|quantas por mes|objetivo mensal)\b/],
  ["titulo", /\b(nome da campanha|titulo|chamar a campanha|campanha se chama|o nome|nome fica)\b/],
  ["valorPrincipal", /\b(valor|preco|pagamento|pagar) (da|de|por|pela|cada) (reuniao|reunioes|visita|visitas|agendamento)\b/],
  ["valorVenda", /\b(comiss\w*|(valor|preco|pagamento|pagar) (da|de|por|pela|cada) venda)\b/],
  ["prazoHoras", /\b(prazo|prazo de entrega|horas para|dias para)\b/],
  ["fixoMensal", /\b(fixo|por profissional|salario|investimento por pessoa|custo por vendedor)\b/],
  ["orcamento", /\b(orcamento|investimento|custo (total|mensal)?|verba|quanto (vou gastar|posso gastar|tenho para))\b/],
  ["visitasPorDia", /\b(visitas? por dia|quantas visitas)\b/],
  ["vagas", /\b(profission\w*|vendedor\w*|pessoas|vagas|sdrs?|closers?|hunters?|time|equipe|quantos (s[aã]o|ser[aã]o|ter))\b/],
  ["regiao", /\b(regiao|cidade|local|estado|municipio|onde|aonde|localiza\w+)\b/],
  ["publico", /\b(publico|cliente ideal|perfil|p[uú]blico.alvo|para quem|quem [eé] o cliente)\b/],
  ["objetivo", /\b(objetivo|tipo de campanha|o que (quero|desejo|preciso) (fazer|montar)|tipo de a[cç][aã]o)\b/],
];
const MUDANCA = /\b(mud\w*|alter\w*|troc\w*|corrig\w*|na verdade|ajust\w*|coloc\w*|poe|bota|em vez|ao inves|quero mudar|quero alterar|muda (para|o)|errei|corrige|na verdade quero|quero corrig\w+)\b/;

function porRotulo(texto) {
  const original = String(texto || "");
  const n = sem(original);
  const r = {};
  for (const [campo, re] of ROTULOS) {
    const m = n.match(re);
    if (!m) continue;
    // O que vem depois do nome do campo, sem o "para", "é", "de"...
    const depois = original.slice(m.index + m[0].length)
      .replace(/^\s*(m[eé]dio|m[eé]dia|mensal|desejado|ideal)?\s*(para|pra|por|é|e|eh|de|em|=|:)?\s*/i, "");
    const v = lerCampo(campo, depois.split(/[,;]|\s+e\s+(?=\D)/)[0]);
    if (v === undefined) continue;
    // Valor de uma tarefa vai para `valores` (sobrepõe o calculado).
    if (campo === "valorPrincipal") r.valores = { ...r.valores, [/visita/.test(m[0]) ? "visita" : "agendamento"]: v };
    else if (campo === "valorVenda") r.valores = { ...r.valores, venda: v };
    else r[campo] = v;
  }
  return r;
}

// O que a frase responde. `esperado` é a pergunta em aberto: uma resposta
// curta ("Sorocaba", "3", "5 mil") vale para ela. Campo dito pelo nome vale
// sempre, em qualquer etapa.
export function interpretar(texto, esperado = null) {
  const bruto = String(texto || "").trim();
  const n = sem(bruto);
  const r = {};
  if (!bruto) return r;
  const mudando = MUDANCA.test(n);
  const campoDeTexto = ["regiao", "publico"].includes(esperado);

  // O objetivo só é lido em frase livre, quando é ele que está em aberto ou
  // quando a pessoa pede para mudar: "5 visitas por dia" não troca a campanha.
  if (!esperado || esperado === "objetivo" || mudando) {
    const objetivo = lerCampo("objetivo", bruto);
    if (objetivo) r.objetivo = objetivo;
  }
  const regiao = extrairRegiao(bruto);
  if (regiao) r.regiao = regiao;
  // Em pedido de mudança, "para …" é o valor novo, não o público: o público
  // só muda quando a pessoa diz "público".
  if (!campoDeTexto && !mudando) {
    const publico = extrairPublico(bruto);
    if (publico) r.publico = publico;
  }

  let m = n.match(new RegExp(`(${NUMERO})\\s+${PESSOAS}`));
  if (m && !campoDeTexto) r.vagas = Math.round(numeroDe(m[1]));
  m = n.match(new RegExp(`(${NUMERO})\\s+visitas?\\s*(?:por|ao|\\/|a cada)\\s*dia`));
  if (m) r.visitasPorDia = Math.round(numeroDe(m[1]));
  m = n.match(new RegExp(`(?:ate|maximo|pagar|investir|orcamento|fixo)\\D{0,25}?(${NUMERO})(?=[^\\d]{0,30}(?:por mes|mensal|\\/mes|ao mes|por profissional|cada profissional))`));
  if (m) r.fixoMensal = numeroDe(m[1]);
  m = n.match(new RegExp(`(${NUMERO})\\s+(?:de cada|a cada|em cada)\\s+(${NUMERO})\\s+(?:reunio|visita|contato|lead)`));
  if (m) r.conversao = taxaDe(`${m[1]} de ${m[2]}`);
  m = n.match(new RegExp(`(${NUMERO})\\s*(?:x|vezes)\\s+(?:de |o )?retorno`));
  if (m) r.retorno = numeroDe(m[1]);
  m = n.match(new RegExp(`(${NUMERO})\\s+(?:reunioes|reunioes agendadas|vendas|leads|agendamentos)\\s*(?:por|ao|\\/)\\s*mes`));
  if (m) r.meta = Math.round(numeroDe(m[1]));
  // "R$ 200 por reunião", "500 reais por venda": valor de uma tarefa.
  for (const [, num, acao] of n.matchAll(new RegExp(`(${NUMERO})\\s*(?:reais\\s*)?(?:por|cada|a)\\s+(reuniao|visita|venda)\\b`, "g"))) {
    const v = numeroDe(num);
    if (v != null) r.valores = { ...r.valores, [acao === "reuniao" ? "agendamento" : acao]: v };
  }

  // Campo dito pelo nome. Numa resposta de texto livre (região, público),
  // só quando a pessoa pede a mudança: "indústrias com 10 profissionais" é
  // público, não quantidade.
  if (!campoDeTexto || mudando) Object.assign(r, porRotulo(bruto));

  // "200 por reunião" fala do valor, não troca o objetivo da campanha.
  if (r.valores && r.objetivo && !/\bobjetivo\b/.test(n)) delete r.objetivo;

  // Resposta curta para a pergunta em aberto, se a frase não falou de outra coisa.
  if (esperado && r[esperado] == null && !Object.keys(r).length) {
    const v = lerCampo(esperado, bruto);
    if (v !== undefined) r[esperado] = v;
    else if (esperado === "retorno" && NAO_SEI.test(n)) { r.retorno = 3; r.retornoSugerido = true; }
  }
  return r;
}

// Resposta à pergunta em aberto, entendendo também "sim", "mantenho" e o
// texto dos botões de resposta rápida. Com `campo` "ajuste" (no resumo), vale
// tudo o que a frase disser.
const SIM = /^(sim|isso|isso mesmo|pode|pode ser|mant\w*|confirm\w*|ok|certo|correto|exato|claro|beleza|esse mesmo|isso ai)\b/;
export function interpretarResposta(texto, campo, r = {}, emp = {}) {
  const n = sem(texto).trim().replace(/[.!?]+$/, "");
  const chips = campo && campo !== "ajuste" ? perguntar(campo, r, emp).chips : [];
  const chip = chips.find((c) => c.patch && sem(c.rotulo) === n);
  if (chip) return { ...chip.patch };
  const p = interpretar(texto, campo === "ajuste" ? null : campo);
  if (["publico", "ticketMedio"].includes(campo) && SIM.test(n) && chips[0]?.patch) {
    const v = p[campo];
    if (v == null || (campo === "publico" && sem(v) === n)) Object.assign(p, chips[0].patch);
  }
  return p;
}

// Ajuste depois do resumo: tudo o que a frase disser, por nome ou não.
export const interpretarAjuste = (texto) => interpretar(texto, null);

// O microfone ouve o próprio Jarvas falando. Se o que foi ouvido é quase
// tudo palavra da fala dele, é eco, não a pessoa.
export function pareceEco(ouvido, falado, limiar = 0.6) {
  // Eco repete a fala do Jarvas NA ORDEM; uma resposta pode repetir palavras
  // da pergunta ("quero 3 profissionais" depois de "Quantos profissionais?")
  // sem ser eco. Por isso a comparação é por pares de palavras seguidas.
  // Números sem separador ("15.000" = "15000") e a fala também na forma
  // falada ("R$ 15.000" → "15.000 reais").
  const tokens = (t) => sem(t).replace(/(\d)[.,](?=\d)/g, "$1").match(/[a-z]{2,}|\d+/g) || [];
  const ditas = tokens(ouvido);
  if (!ditas.length) return false;
  const fontes = [tokens(falado), tokens(paraFala(falado))];
  if (ditas.length === 1) return fontes.some((f) => f.includes(ditas[0]));
  const pares = (f) => f.slice(1).map((w, k) => `${f[k]} ${w}`);
  const dele = new Set(fontes.flatMap(pares));
  const meus = pares(ditas);
  return meus.filter((x) => dele.has(x)).length / meus.length >= limiar;
}

// A frase parou numa palavra de ligação ("e…", "para…", "tipo…"): a pessoa
// ainda vai continuar, então o Jarvas espera mais antes de responder.
export const fraseIncompleta = (texto) =>
  /\b(e|de|da|do|das|dos|para|pra|com|que|o|a|os|as|um|uma|mais|em|no|na|tipo|entao|ne|ah|eh|hum|uhm|mas|ou|porque|se)$/.test(sem(texto).trim().replace(/[.,!?]+$/, ""));

// ---------------------------------------------------------------------------
// 2. Condução
//
// Com ticket, o Jarvas conduz pelo retorno, como num funil de verdade:
// conversão ("de cada 10 reuniões, quantas viram venda?") → mostra quanto
// isso dá em vendas → retorno desejado → só então o custo por tarefa → meta
// do mês e o resultado do mês. Sem ticket ou sem conversão, não há como
// prometer retorno: a conversa segue pelo orçamento mensal.

const ticketDoCadastro = (emp) => numeroDe(emp?.ticket) || 0;
const principalDe = (r) => OBJETIVOS[r.objetivo]?.principal || "agendamento";
const UNIDADE = { agendamento: "reuniões", visita: "visitas", venda: "vendas" };
const UNIDADE_MES = { agendamento: "reuniões agendadas", visita: "visitas", venda: "vendas" };
const usaRoi = (r) => Number(r.ticketMedio) > 0 && (principalDe(r) === "venda" || Number(r.conversao) > 0);

export function proximoCampo(r) {
  if (!r.objetivo) return "objetivo";
  if (!r.regiao) return "regiao";
  if (!r.publico) return "publico";
  if (r.vagas == null) return "vagas";
  if (r.ticketMedio == null) return "ticketMedio";
  const obj = OBJETIVOS[r.objetivo];
  const p = principalDe(r);
  if (Number(r.ticketMedio) > 0 && p !== "venda" && r.conversao == null) return "conversao";
  if (usaRoi(r) && r.retorno == null) return "retorno";
  if (obj?.usaVisitasPorDia && r.visitasPorDia == null) return "visitasPorDia";
  if (usaRoi(r)) return !obj?.usaVisitasPorDia && r.meta == null ? "meta" : null;
  if (r.fixoMensal == null) return "fixoMensal";
  return null;
}

// Pergunta: { texto, chips: [{ rotulo, patch?, seguir? }] }. Chip com patch
// aplica o valor direto; com `seguir`, o Jarvas responde com essa frase.
export function perguntar(campo, r, emp = {}) {
  const obj = OBJETIVOS[r.objetivo];
  const p = principalDe(r);
  switch (campo) {
    case "objetivo":
      return { texto: "Qual o objetivo da campanha?",
        chips: OBJETIVO_OPCOES.map((o) => ({ rotulo: o.label, patch: { objetivo: o.valor } })) };
    case "regiao":
      return { texto: "Em qual cidade ou região?", chips: [{ rotulo: "Todo o Brasil", patch: { regiao: "Todo o Brasil" } }] };
    case "publico":
      return emp.icp
        ? { texto: `Público: ${emp.icp}. Mantenho?`,
            chips: [{ rotulo: "Manter esse perfil", patch: { publico: emp.icp } }, { rotulo: "Outro público", seguir: "Qual público, então?" }] }
        : { texto: "Quem é o cliente ideal?", chips: [] };
    case "vagas":
      return { texto: "Quantos profissionais?",
        chips: [1, 2, 3, 5].map((v) => ({ rotulo: String(v), patch: { vagas: v } })) };
    case "ticketMedio": {
      const t = ticketDoCadastro(emp);
      return t
        ? { texto: `Ticket: ${dinheiro(t)}. Confirma?`,
            chips: [{ rotulo: `Sim, usar ${dinheiro(t)}`, patch: { ticketMedio: t } }, { rotulo: "É outro valor", seguir: "Qual o ticket médio?" }] }
        : { texto: "Qual o seu ticket médio?", chips: [{ rotulo: "Ainda não sei", patch: { ticketMedio: 0 } }] };
    }
    case "conversao":
      return { texto: `De 10 ${UNIDADE[p]}, quantas fecham?`,
        chips: [...[1, 2, 3, 5].map((v) => ({ rotulo: `${v} de 10`, patch: { conversao: v / 10 } })), { rotulo: "Não sei", patch: { conversao: 0 } }] };
    case "retorno":
      return { texto: "Quer quantas vezes de retorno?",
        chips: [3, 5, 10].map((v) => ({ rotulo: `${v} vezes`, patch: { retorno: v } })) };
    case "meta":
      return { texto: `Quantas ${UNIDADE_MES[p]} por mês?`,
        chips: [10, 20, 40, 80].map((v) => ({ rotulo: String(v), patch: { meta: v } })) };
    case "visitasPorDia":
      return { texto: "Quantas visitas por dia?", chips: [3, 5, 8].map((v) => ({ rotulo: `${v} por dia`, patch: { visitasPorDia: v } })) };
    case "fixoMensal":
      return { texto: "Investimento mensal por profissional?", chips: [{ rotulo: "Ainda não sei", patch: { fixoMensal: 0 } }] };
    default:
      return { texto: "", chips: [] };
  }
}

// Quando a resposta não foi entendida: pergunta de novo com contexto do que
// já foi respondido e sugestão baseada no cadastro da empresa.
export function pedirDeNovo(campo, r = {}, emp = {}) {
  const p = perguntar(campo, r, emp);
  switch (campo) {
    case "objetivo":
      return "Não entendi o objetivo. É para agendar reuniões, fechar vendas, visitas presenciais ou prospecção?";
    case "regiao": {
      const seg = emp.segmento || "";
      const dica = seg ? ` Pode ser uma cidade, estado ou "Todo o Brasil".` : " Pode ser uma cidade, estado ou região.";
      return `Não entendi a região.${dica}`;
    }
    case "publico": {
      const icp = emp.icp ? ` Seu cadastro tem: "${emp.icp.slice(0, 60)}${emp.icp.length > 60 ? "…" : ""}".` : "";
      return `Não entendi o público.${icp} Descreva quem é o cliente ideal.`;
    }
    case "vagas":
      return "Número não entendi. Quantos profissionais? Diga um número: 1, 2, 3…";
    case "ticketMedio": {
      const t = emp.ticket ? ` Seu cadastro tem ${emp.ticket}.` : "";
      return `Não entendi o ticket.${t} Qual o valor médio de cada venda?`;
    }
    case "conversao":
      return `Não entendi. De 10 ${UNIDADE[r.objetivo ? (OBJETIVOS[r.objetivo]?.principal || "agendamento") : "agendamento"]}, quantas viram venda? Diga um número de 1 a 10.`;
    case "retorno":
      return "Não entendi. Quantas vezes quer de retorno? Por exemplo: 3 vezes, 5 vezes.";
    case "meta":
      return `Não entendi. Quantas ${UNIDADE_MES[r.objetivo ? (OBJETIVOS[r.objetivo]?.principal || "agendamento") : "agendamento"]} quer por mês?`;
    case "fixoMensal":
      return "Não entendi. Qual o investimento mensal por profissional?";
    default:
      return `Não entendi. ${p.texto}`;
  }
}

// ---------------------------------------------------------------------------
// 3. Contas e resposta

// Valores por tarefa, orçamento e, quando há ticket e conversão, o retorno.
//
// Pelo retorno: cada reunião (ou visita) vale ticket × conversão em vendas;
// para o retorno desejado, ela pode custar até isso ÷ retorno, somando o
// valor da tarefa e a parte da comissão de venda. A comissão parte da
// proporção do objetivo (8% do ticket) e nunca passa de 60% desse teto.
// Fechamento (closer): a comissão por venda é ticket ÷ retorno.
// Junta a resposta nova às anteriores (os valores por tarefa se somam).
export function aplicar(anteriores, patch) {
  const novas = { ...anteriores, ...patch };
  if (patch.valores) novas.valores = { ...anteriores.valores, ...patch.valores };
  return novas;
}

// Com o que a pessoa mudou no resumo por cima: valor de tarefa e orçamento.
export function calcularTarefasJarvas(r) {
  const base = calcularBase(r);
  const valores = r.valores || {};
  if (!Object.keys(valores).length && !(Number(r.orcamento) > 0)) return base;
  const acoes = OBJETIVOS[r.objetivo]?.acoes || [];
  const tarefas = { ...base.tarefas };
  for (const [acao, v] of Object.entries(valores)) if (acoes.includes(acao)) tarefas[acao] = v;
  let roi = base.roi;
  if (roi) {
    const p = roi.principal;
    const investimento = Math.round(p === "venda" ? roi.unidades * tarefas.venda : roi.unidades * tarefas[p] + roi.vendas * (tarefas.venda || 0));
    roi = { ...roi, investimento, multiplo: investimento ? roi.receita / investimento : null };
  }
  const orcamento = Number(r.orcamento) > 0 ? Number(r.orcamento) : roi ? roi.investimento : base.orcamento;
  return { tarefas, orcamento, roi };
}

function calcularBase(r) {
  const obj = OBJETIVOS[r.objetivo] || OBJETIVOS.reunioes;
  const p = obj.principal;
  const ticket = Number(r.ticketMedio) || 0;
  const vagas = Number(r.vagas) || 1;
  const retorno = Number(r.retorno) || 0;
  const conv = p === "venda" ? 1 : Number(r.conversao) || 0;

  if (ticket > 0 && conv > 0 && retorno > 0) {
    const tarefas = {};
    let porUnidade = null;
    if (p === "venda") tarefas.venda = Math.round(ticket / retorno);
    else {
      porUnidade = (ticket * conv) / retorno;
      const venda = obj.acoes.includes("venda")
        ? Math.min(Math.round(ticket * (obj.proporcao.venda || 0.08)), Math.round((porUnidade * 0.6) / conv)) : 0;
      tarefas[p] = Math.max(1, Math.round(porUnidade - venda * conv));
      if (obj.acoes.includes("venda")) tarefas.venda = venda;
    }
    const unidades = obj.usaVisitasPorDia ? (Number(r.visitasPorDia) || 0) * DIAS_UTEIS * vagas : Number(r.meta) || 0;
    const vendas = p === "venda" ? unidades : unidades * conv;
    const investimento = Math.round(p === "venda" ? unidades * tarefas.venda : unidades * tarefas[p] + vendas * (tarefas.venda || 0));
    const receita = Math.round(vendas * ticket);
    return {
      tarefas, orcamento: investimento,
      roi: { principal: p, conversao: conv, retorno, porUnidade, unidades, vendas, receita, investimento, multiplo: investimento ? receita / investimento : null },
    };
  }

  // Sem retorno calculável: pelo orçamento mensal por profissional.
  const fixoMensal = Number(r.fixoMensal) || 0;
  const visitasPorDia = Number(r.visitasPorDia) || 5;
  const tarefas = {};
  if (obj.usaVisitasPorDia) {
    tarefas.visita = fixoMensal > 0 ? Math.round(fixoMensal / DIAS_UTEIS / visitasPorDia) : (ticket ? Math.round(ticket * (obj.proporcao.visita || 0.008)) : 0);
    if (obj.acoes.includes("venda")) tarefas.venda = ticket ? Math.round(ticket * (obj.proporcao.venda || 0.08)) : 0;
  } else {
    const valorPrincipal = fixoMensal > 0 ? Math.round(fixoMensal / DIAS_UTEIS) : 0;
    const propPrincipal = obj.proporcao[p] || 1;
    for (const acao of obj.acoes) {
      if (acao === p) { tarefas[acao] = valorPrincipal; continue; }
      const rel = (obj.proporcao[acao] || 0) / propPrincipal;
      tarefas[acao] = valorPrincipal > 0 ? Math.max(1, Math.round(valorPrincipal * rel)) : (ticket ? Math.round(ticket * (obj.proporcao[acao] || 0)) : 0);
    }
    if (tarefas.venda === 0 && ticket) tarefas.venda = Math.round(ticket * (obj.proporcao.venda || 0.08));
  }
  return { tarefas, orcamento: fixoMensal > 0 ? fixoMensal * vagas : 0, roi: null };
}

// Reação curta ao que acabou de ser dito. Só fala de número quando ele
// importa: o retorno antes do custo, e o resultado do mês. `anteriores` são
// as respostas antes desta frase: o que mudou é confirmado em poucas palavras.
export function reagir(patch, r, emp = {}, anteriores = {}) {
  // Frases com número são as únicas que gastam crédito de voz: o mínimo de
  // palavras, cada número uma vez. O detalhe completo fica no resumo da tela.
  const frases = [];
  const p = principalDe(r);
  const plano = calcularTarefasJarvas(r);
  const roi = plano.roi;
  const custo = () => `Custo: ${dinheiro(roi.investimento)}.`;
  if (patch.conversao != null) {
    frases.push(r.conversao > 0
      ? `10 ${UNIDADE[p]}: ${dinheiro(r.ticketMedio * r.conversao * 10)}.`
      : "Sem a taxa, vamos pelo orçamento.");
  }
  if (patch.retorno != null && roi) {
    if (p === "venda") frases.push(`${dinheiro(plano.tarefas.venda)} por venda.`);
    else frases.push(`${dinheiro(plano.tarefas[p])} por ${ACAO_CURTA[p]}.`, `${dinheiro(plano.tarefas.venda || 0)} por venda.`);
    if (r.retornoSugerido) frases.push("Usei 3 vezes; dá para mudar.");
  }
  if ((patch.meta != null || patch.visitasPorDia != null) && roi && roi.unidades > 0) {
    if (p !== "venda") frases.push(`${decimal(roi.vendas)} vendas.`);
    frases.push(`${dinheiro(roi.receita)} por mês.`, custo());
  }
  if (patch.fixoMensal != null && r.fixoMensal > 0)
    frases.push(`${dinheiro(plano.tarefas[p])} por ${ACAO_CURTA[p] || "ação"}.`, `${dinheiro(plano.orcamento)} por mês.`);
  // Mudança de algo já respondido: "Feito." (frase fixa) e, se a conta mudou,
  // só os números novos.
  const campos = ["objetivo", "regiao", "publico", "vagas", "ticketMedio", "conversao", "retorno", "fixoMensal"];
  const sempreMudanca = ["titulo", "valores", "orcamento", "prazoHoras"]; // só são ditos no resumo
  const mudou = Object.keys(patch).some((k) => sempreMudanca.includes(k) || (campos.includes(k) && anteriores[k] != null && anteriores[k] !== patch[k]));
  if (mudou) {
    const antes = calcularTarefasJarvas(anteriores).roi;
    const contaMudou = roi && roi.unidades > 0 && antes?.investimento !== roi.investimento && patch.orcamento == null;
    return ["Feito.", ...(contaMudou && patch.meta == null && patch.visitasPorDia == null
      ? [`${dinheiro(plano.tarefas[p])} por ${ACAO_CURTA[p]}.`, `${dinheiro(roi.receita)} por mês.`, custo()]
      : frases.filter((f) => !/^Feito/.test(f)))].join(" ");
  }
  return frases.join(" ");
}

// Nome da campanha: o que a pessoa disse, ou montado a partir das respostas.
export function tituloPadrao(r) {
  const { orcamento } = calcularTarefasJarvas(r);
  return r.titulo || [rotuloObjetivo(r.objetivo), r.regiao, `${Number(r.vagas) || 1} prof.`, orcamento > 0 ? dinheiro(orcamento) : ""].filter(Boolean).join(" — ");
}

// Resumo final, em linhas [rótulo, valor].
export function resumo(r) {
  const obj = OBJETIVOS[r.objetivo];
  const { tarefas, orcamento, roi } = calcularTarefasJarvas(r);
  const p = principalDe(r);
  const linhas = [
    ["Nome", tituloPadrao(r)],
    ["Objetivo", rotuloObjetivo(r.objetivo)],
    ["Região", r.regiao],
    ["Cliente ideal", r.publico],
    ["Profissionais", `${r.vagas} de ${obj?.funcao.toUpperCase() || "—"}`],
    ["Ticket médio", r.ticketMedio ? dinheiro(r.ticketMedio) : "Em aberto"],
  ];
  if (roi && p !== "venda") linhas.push(["Conversão", `${decimal(roi.conversao * 10)} de cada 10 ${UNIDADE[p]}`]);
  if (roi) linhas.push(["Retorno desejado", `${decimal(roi.retorno)} vezes`]);
  if (obj?.usaVisitasPorDia) linhas.push(["Visitas por dia", String(r.visitasPorDia)]);
  for (const acao of obj?.acoes || []) if (tarefas[acao]) linhas.push([`Por ${ACAO[acao] || acao}`, dinheiro(tarefas[acao])]);
  if (roi && roi.unidades > 0) {
    linhas.push([`${capitalizar(UNIDADE_MES[p])} por mês`, String(roi.unidades)]);
    if (p !== "venda") linhas.push(["Vendas previstas", `${decimal(roi.vendas)} por mês`]);
    linhas.push(["Faturamento previsto", `${dinheiro(roi.receita)} por mês`]);
  }
  linhas.push(["Investimento mensal", orcamento ? dinheiro(orcamento) : "Em aberto"]);
  if (r.prazoHoras) linhas.push(["Prazo por tarefa", r.prazoHoras % 24 ? `${r.prazoHoras} horas` : `${r.prazoHoras / 24} dias`]);
  if (roi?.multiplo) linhas.push(["Retorno estimado", `${decimal(roi.multiplo)} vezes`]);
  return linhas;
}

export function saudacao(emp = {}) {
  return "Oi, sou o Jarvas. Vamos montar sua campanha.";
}

// Fim da conversa: a frase que convida a revisar e montar.
export const FECHAMENTO = "Pronto. Confere o resumo. Posso montar?";

// "Pode montar", "tá certo", "isso mesmo": confirma o resumo por voz.
export const confirmaMontagem = (texto) =>
  /\b(pode( sim)?|sim|pode (montar|criar|seguir|fazer)|monta(r)?( a campanha)?|confirm\w*|ta (certo|otimo|bom)|esta (certo|otimo)|isso mesmo|perfeito|fechado|manda ver|bora|ok|beleza)\b/.test(sem(texto));

// Texto para a voz: o que se lê bem na tela nem sempre soa bem falado.
// "R$ 2.500" vira "2.500 reais", siglas de função viram palavras, aspas e
// quebras de linha somem.
export function paraFala(texto) {
  return String(texto || "")
    .replace(/R\$\s?(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})/g, (_, r, c) => (c === "00" ? `${r} reais` : `${r} reais e ${Number(c)} centavos`))
    .replace(/R\$\s?(\d{1,3}(?:\.\d{3})+|\d+)/g, "$1 reais")
    .replace(/\bPAP\b/g, "porta a porta")
    .replace(/\bSDR\b/g, "pré-vendas")
    .replace(/\bBDR\b/g, "prospecção")
    .replace(/\bCLOSER\b/g, "fechamento")
    .replace(/["“”]/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Voz: economia de créditos do ElevenLabs.
//
// A fala é gerada e guardada frase por frase. Assim, as frases fixas
// ("Quantos profissionais?", "Confirma?") são gravadas uma única vez e
// reaproveitadas em qualquer conversa, mesmo quando vêm depois de uma frase
// com números de uma empresa. Só as frases com números próprios custam.

// "Ticket médio de R$ 5.000. Confirma?" → ["Ticket médio de R$ 5.000.", "Confirma?"].
// O ponto de "5.000" não separa: só ponto seguido de espaço.
export function segmentosDeFala(texto) {
  return String(texto || "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

// Todas as frases que não dependem de dado de empresa nenhuma. O servidor
// grava essas uma única vez (services de voz: aquecerVozJarvas).
export function frasesFixas() {
  const frases = new Set();
  const somar = (t) => segmentosDeFala(t).forEach((s) => frases.add(s));
  const campos = ["objetivo", "regiao", "publico", "vagas", "ticketMedio", "conversao", "retorno", "meta", "visitasPorDia", "fixoMensal"];
  for (const objetivo of Object.keys(OBJETIVOS)) {
    for (const campo of campos) {
      for (const emp of [{}, { icp: "x", ticket: "1" }]) {
        const r = { objetivo, ticketMedio: 1 };
        const p = perguntar(campo, r, emp);
        // Perguntas com dado do cadastro: só a parte fixa ("Mantenho?", "Confirma?").
        segmentosDeFala(p.texto).filter((s) => !/R\$|:/.test(s)).forEach((s) => frases.add(s));
        for (const c of p.chips) if (c.seguir) somar(c.seguir);
        segmentosDeFala(pedirDeNovo(campo, r, emp)).filter((s) => !/R\$|:/.test(s)).forEach((s) => frases.add(s));
      }
    }
  }
  [saudacao(), FECHAMENTO, "Feito.", "Montando sua campanha.", "Não entendi. O que mudo?", "Pode falar.",
    "Sem a taxa, vamos pelo orçamento.", "Usei 3 vezes; dá para mudar."].forEach(somar);
  return [...frases];
}

// A frase já responde a pergunta em aberto ("3", "sim", "Sorocaba")? Então
// o Jarvas não precisa esperar a pausa longa para responder.
export function respostaCompleta(texto, campo, r = {}, emp = {}) {
  if (!campo || fraseIncompleta(texto)) return false;
  if (campo === "ajuste") return confirmaMontagem(texto) || Object.keys(interpretarResposta(texto, campo, r, emp)).length > 0;
  return interpretarResposta(texto, campo, r, emp)[campo] != null;
}

// Tira do começo do que foi ouvido o pedaço que é eco da fala do Jarvas
// (quando a pessoa começa a falar por cima, o reconhecimento junta os dois).
export function semEco(ouvido, falado) {
  const norm = (w) => sem(w).replace(/(\d)[.,](?=\d)/g, "$1").replace(/[^a-z0-9]/g, "");
  const fonte = [falado, paraFala(falado)].map((t) => String(t).split(/\s+/).map(norm).filter(Boolean));
  const pares = new Set(fonte.flatMap((f) => f.slice(1).map((w, k) => `${f[k]} ${w}`)));
  const palavras = String(ouvido || "").trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < palavras.length - 1 && pares.has(`${norm(palavras[i])} ${norm(palavras[i + 1])}`)) i++;
  return (i > 0 ? palavras.slice(i + 1) : palavras).join(" ");
}

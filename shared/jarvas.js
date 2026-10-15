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

const NAO_SEI = /\b(nao sei|sei la|nao faco ideia|nao tenho (ideia|certeza)|pula|pular|depois|tanto faz|nao defini|ainda nao)\b/;
const PESSOAS = "(?:profission\\w*|vendedor\\w*|pessoas?|sdrs?|bdrs?|closers?|promotor\\w*|representantes?|consultor\\w*|corretor\\w*)";

const capitalizar = (t) => (t ? t[0].toLocaleUpperCase("pt-BR") + t.slice(1) : t);
const limparResposta = (t) => String(t || "").trim().replace(/^(e |é |eh |acho que |seria |sera |vai ser |fica )/i, "").replace(/[.!]+$/, "").trim();

// O que a frase responde. `esperado` é a pergunta em aberto: uma resposta
// curta ("Sorocaba", "3", "5 mil") vale para ela.
export function interpretar(texto, esperado = null) {
  const bruto = String(texto || "").trim();
  const n = sem(bruto);
  const r = {};
  if (!bruto) return r;

  // O objetivo só é lido quando é ele que está em aberto (ou numa frase
  // livre): "5 visitas por dia" responde visitas, não troca a campanha.
  const opcao = OBJETIVO_OPCOES.find((o) => sem(o.label) === n.replace(/[.!]+$/, ""));
  const objetivo = opcao?.valor || (!esperado || esperado === "objetivo" ? detectarObjetivo(bruto) : null);
  if (objetivo) r.objetivo = objetivo;

  const regiao = extrairRegiao(bruto);
  if (regiao) r.regiao = regiao;
  const publico = extrairPublico(bruto);
  if (publico) r.publico = publico;

  let m = n.match(new RegExp(`(${NUMERO})\\s+${PESSOAS}`));
  if (m) r.vagas = Math.round(numeroDe(m[1]));
  m = n.match(new RegExp(`(${NUMERO})\\s+visitas?\\s*(?:por|ao|\\/|a cada)\\s*dia`));
  if (m) r.visitasPorDia = Math.round(numeroDe(m[1]));
  m = n.match(new RegExp(`(?:ticket|cada venda|venda media|vendas? de|vale)\\D{0,25}?(${NUMERO})`));
  if (m) r.ticketMedio = numeroDe(m[1]);
  m = n.match(new RegExp(`(?:ate|maximo|pagar|investir|orcamento|fixo)\\D{0,25}?(${NUMERO})(?=[^\\d]{0,30}(?:por mes|mensal|\\/mes|ao mes|por profissional|cada profissional))`));
  if (m) r.fixoMensal = numeroDe(m[1]);
  m = n.match(new RegExp(`(${NUMERO})\\s+(?:de cada|a cada|em cada)\\s+(${NUMERO})\\s+(?:reunio|visita|contato|lead)`));
  if (m) r.conversao = taxaDe(`${m[1]} de ${m[2]}`);
  m = n.match(new RegExp(`retorno de\\s+(${NUMERO})\\s*(?:x|vezes)|(${NUMERO})\\s*(?:x|vezes)\\s+(?:de |o )?retorno`));
  if (m) r.retorno = numeroDe(m[1] || m[2]);
  m = n.match(new RegExp(`(${NUMERO})\\s+(?:reunioes|reunioes agendadas|vendas|leads|agendamentos)\\s*(?:por|ao|\\/)\\s*mes`));
  if (m) r.meta = Math.round(numeroDe(m[1]));

  if (esperado && r[esperado] == null) {
    const naoSabe = NAO_SEI.test(n);
    if (["vagas", "visitasPorDia"].includes(esperado)) {
      const v = numeroDe(bruto);
      if (v != null && v > 0) r[esperado] = Math.round(v);
    } else if (["ticketMedio", "fixoMensal"].includes(esperado)) {
      const v = numeroDe(bruto);
      if (v != null) r[esperado] = v;
      else if (naoSabe) r[esperado] = 0;
    } else if (esperado === "conversao") {
      const v = naoSabe ? null : taxaDe(bruto);
      if (v != null) r.conversao = Math.round(v * 1000) / 1000;
      else if (naoSabe) r.conversao = 0;
    } else if (esperado === "retorno") {
      const v = naoSabe ? null : multiploDe(bruto);
      if (v) r.retorno = v;
      else if (naoSabe) { r.retorno = 3; r.retornoSugerido = true; }
    } else if (esperado === "meta") {
      const v = numeroDe(bruto);
      if (v != null && v > 0) r.meta = Math.round(v);
    } else if (esperado === "regiao" && !naoSabe) {
      const t = limparResposta(bruto).replace(/^(em|no|na|nos|nas|para|pra)\s+/i, "");
      if (/[a-zà-ú]{2}/i.test(t) && t.length <= 80) r.regiao = capitalizar(t);
    } else if (esperado === "publico" && !naoSabe) {
      const t = limparResposta(bruto);
      if (t.length >= 3) r.publico = capitalizar(t);
    }
  }
  return r;
}

// Ajuste depois do resumo: "muda para 3 profissionais", "região: Campinas".
export function interpretarAjuste(texto) {
  const n = sem(texto);
  const r = interpretar(texto);
  const campo = [
    ["regiao", /\b(regiao|cidade|local)\b/], ["publico", /\b(publico|cliente ideal|perfil)\b/],
    ["vagas", /\b(profission\w*|vendedor\w*|pessoas|vagas)\b/], ["ticketMedio", /\bticket\b/],
    ["conversao", /\b(convers\w*|de cada)\b/], ["retorno", /\bretorno\b/],
    ["meta", /\b(meta|reunioes por mes|vendas por mes)\b/],
    ["visitasPorDia", /\bvisitas?\b/], ["fixoMensal", /\b(fixo|mensal|por mes|orcamento|pagar)\b/],
  ].find(([, re]) => re.test(n))?.[0];
  if (campo && r[campo] == null) {
    const depois = String(texto).split(/:|\bpara\b|\bpra\b|\bé\b|\bseja\b/i).slice(1).join(" ").trim() || String(texto);
    Object.assign(r, interpretar(depois, campo));
  }
  return r;
}

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
      return { texto: "Me conta: o que você precisa que aconteça? Pode falar do seu jeito, tipo \"agendar reuniões com indústrias em Sorocaba\".",
        chips: OBJETIVO_OPCOES.map((o) => ({ rotulo: o.label, patch: { objetivo: o.valor } })) };
    case "regiao":
      return { texto: "Em qual cidade ou região essa campanha vai acontecer?", chips: [{ rotulo: "Todo o Brasil", patch: { regiao: "Todo o Brasil" } }] };
    case "publico":
      return emp.icp
        ? { texto: `No seu cadastro, o cliente ideal é "${emp.icp}". Sigo com esse perfil ou quer focar em outro público nesta campanha?`,
            chips: [{ rotulo: "Manter esse perfil", patch: { publico: emp.icp } }, { rotulo: "Outro público", seguir: "Me descreve o perfil de quem você quer atingir: segmento, porte ou cargo de quem decide." }] }
        : { texto: "Quem é o cliente ideal dessa campanha? Me descreve o perfil de quem você quer atingir.", chips: [] };
    case "vagas":
      return { texto: `Quantos profissionais${obj ? ` de ${obj.funcao.toUpperCase()}` : ""} você quer nessa campanha?`,
        chips: [1, 2, 3, 5].map((v) => ({ rotulo: String(v), patch: { vagas: v } })) };
    case "ticketMedio": {
      const t = ticketDoCadastro(emp);
      return t
        ? { texto: `Vi no cadastro que o ticket médio é ${dinheiro(t)}. Uso esse valor para calcular o seu retorno?`,
            chips: [{ rotulo: `Sim, usar ${dinheiro(t)}`, patch: { ticketMedio: t } }, { rotulo: "É outro valor", seguir: "Qual é o ticket médio, então? Pode falar do seu jeito, tipo \"5 mil\"." }] }
        : { texto: "Quanto vale, em média, uma venda fechada para você?", chips: [{ rotulo: "Ainda não sei", patch: { ticketMedio: 0 } }] };
    }
    case "conversao":
      return { texto: `Agora uma pergunta importante para eu calcular o seu retorno: de cada 10 ${UNIDADE[p]}, quantas costumam virar venda?`,
        chips: [...[1, 2, 3, 5].map((v) => ({ rotulo: `${v} de 10`, patch: { conversao: v / 10 } })), { rotulo: "Não sei", patch: { conversao: 0 } }] };
    case "retorno":
      return { texto: "E quanto de retorno você quer? Por exemplo: para cada real investido, voltar 5 reais em vendas.",
        chips: [3, 5, 10].map((v) => ({ rotulo: `${v} vezes`, patch: { retorno: v } })) };
    case "meta":
      return { texto: `Quantas ${UNIDADE_MES[p]} você quer por mês, somando todos os profissionais?`,
        chips: [10, 20, 40, 80].map((v) => ({ rotulo: String(v), patch: { meta: v } })) };
    case "visitasPorDia":
      return { texto: "Quantas visitas por dia você espera de cada profissional?", chips: [3, 5, 8].map((v) => ({ rotulo: `${v} por dia`, patch: { visitasPorDia: v } })) };
    case "fixoMensal":
      return { texto: "E quanto você quer investir por mês em cada profissional, no máximo?", chips: [{ rotulo: "Ainda não sei", patch: { fixoMensal: 0 } }] };
    default:
      return { texto: "", chips: [] };
  }
}

// Quando a resposta não foi entendida.
export function pedirDeNovo(campo) {
  return {
    objetivo: "Hum, não consegui entender o objetivo. Você quer agendar reuniões, visitar clientes, fechar vendas ou reativar a base? Pode falar ou tocar numa opção.",
    regiao: "Não peguei a região. Pode me dizer a cidade, o estado ou \"todo o Brasil\"?",
    publico: "Me conta um pouco mais sobre quem é esse cliente: segmento, porte ou cargo de quem decide.",
    vagas: "Não peguei a quantidade. Quantos profissionais? Pode ser só o número, tipo 3.",
    ticketMedio: "Não entendi o valor. Pode me dizer em reais, tipo \"5 mil\"? Se ainda não souber, tudo bem.",
    conversao: "Não peguei. De cada 10, quantas viram venda? Pode dizer só o número, tipo 3. Se não souber, tudo bem.",
    retorno: "Quantas vezes o valor investido você quer de volta em vendas? Tipo 5 vezes.",
    meta: "Quantas por mês? Pode ser só o número, tipo 40.",
    visitasPorDia: "Quantas visitas por dia? Pode ser só o número, tipo 5.",
    fixoMensal: "Não entendi o valor. Quanto por mês, em reais, para cada profissional? Se ainda não souber, sem problema.",
  }[campo] || "Não entendi. Pode repetir de outro jeito?";
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
export function calcularTarefasJarvas(r) {
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

// Variação sem sorteio: a mesma conversa dá as mesmas frases.
const escolher = (lista, semente) => lista[Math.abs(semente) % lista.length];

function fraseResultadoMes(roi) {
  const u = roi.principal === "venda" ? "vendas" : UNIDADE_MES[roi.principal];
  const vendas = roi.principal === "venda" ? "" : `, a média é de ${decimal(roi.vendas)} vendas`;
  return `Com ${roi.unidades} ${u} por mês${vendas}: ${dinheiro(roi.receita)} em vendas, com investimento de ${dinheiro(roi.investimento)}. Um retorno de ${decimal(roi.multiplo)} vezes.`;
}

export function reagir(patch, r, emp = {}) {
  const frases = [];
  const obj = OBJETIVOS[r.objetivo];
  const p = principalDe(r);
  const s = Object.keys(r).length;
  if (patch.objetivo && obj)
    frases.push(`${escolher(["Boa escolha.", "Perfeito.", "Fechado."], s)} ${rotuloObjetivo(r.objetivo)}: ${obj.resumo.replace(/\.$/, "").toLowerCase()}. Vou buscar profissionais de ${obj.funcao.toUpperCase()} para isso.`);
  if (patch.regiao)
    frases.push(escolher([`${r.regiao}, anotado.`, `Certo, campanha em ${r.regiao}.`, `${r.regiao}, ótimo.`], s));
  if (patch.publico)
    frases.push(patch.publico === emp.icp ? "Mantive o perfil do cadastro." : escolher(["Entendi o perfil.", "Ótimo, isso ajuda a escolher os profissionais certos."], s));
  if (patch.vagas != null) {
    const v = r.vagas;
    frases.push(v === 1 ? "Um profissional para começar, bom para validar antes de escalar."
      : v <= 5 ? `${v} profissionais, um ótimo tamanho para começar.` : `${v} profissionais, uma operação de bom porte.`);
  }
  if (patch.ticketMedio != null)
    frases.push(r.ticketMedio ? `Ticket de ${dinheiro(r.ticketMedio)}, anotado.` : "Sem problema. Sem ticket, os valores ficam em aberto para você ajustar na revisão.");

  const plano = calcularTarefasJarvas(r);
  const roi = plano.roi;
  if (patch.conversao != null) {
    if (r.conversao > 0) {
      const de10 = decimal(r.conversao * 10);
      frases.push(`Então, a cada 10 ${UNIDADE[p]}, você fecha ${de10} ${r.conversao * 10 === 1 ? "negócio" : "negócios"}. Com ticket de ${dinheiro(r.ticketMedio)}, isso dá ${dinheiro(r.ticketMedio * r.conversao * 10)} em vendas a cada 10 ${UNIDADE[p]}.`);
    } else frases.push("Sem problema. Sem essa taxa eu não consigo te mostrar o retorno com segurança, então vamos pelo orçamento.");
  }
  if (patch.retorno != null && roi) {
    if (p === "venda") frases.push(`Para ter ${decimal(r.retorno)} vezes de retorno, a comissão pode ser de até ${dinheiro(roi.porUnidade ?? plano.tarefas.venda)} por venda fechada.`);
    else frases.push(`Para ter ${decimal(r.retorno)} vezes de retorno, dá para investir até ${dinheiro(Math.round(roi.porUnidade * 10))} a cada 10 ${UNIDADE[p]}. Na prática: ${dinheiro(plano.tarefas[p])} por ${ACAO[p]} e ${dinheiro(plano.tarefas.venda || 0)} de comissão por venda fechada.`);
    if (r.retornoSugerido) frases.push("Usei 3 vezes como ponto de partida; você pode mudar na revisão.");
  }
  if ((patch.meta != null || patch.visitasPorDia != null) && roi && roi.unidades > 0) frases.push(fraseResultadoMes(roi));
  else if (patch.visitasPorDia != null)
    frases.push(`${r.visitasPorDia} por dia dá umas ${r.visitasPorDia * DIAS_UTEIS} visitas por mês para cada profissional.`);
  if (patch.fixoMensal != null) {
    if (r.fixoMensal > 0 && obj) {
      frases.push(`Com ${dinheiro(r.fixoMensal)} por profissional, cada ${ACAO[p] || "ação"} sai por cerca de ${dinheiro(plano.tarefas[p])}. No total, ${dinheiro(plano.orcamento)} por mês.`);
    } else frases.push("Tudo bem. O orçamento fica em aberto e você define na revisão.");
  }
  return frases.join(" ");
}

// Resumo final, em linhas [rótulo, valor].
export function resumo(r) {
  const obj = OBJETIVOS[r.objetivo];
  const { tarefas, orcamento, roi } = calcularTarefasJarvas(r);
  const p = principalDe(r);
  const linhas = [
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
  if (roi?.multiplo) linhas.push(["Retorno estimado", `${decimal(roi.multiplo)} vezes`]);
  return linhas;
}

export function saudacao(emp = {}) {
  return `Oi! Eu sou o Jarvas. Vou montar a campanha${emp.nome ? ` da ${emp.nome}` : ""} com você, leva uns dois minutinhos, e eu já calculo os valores e o orçamento.`;
}

// Fim da conversa: a frase que convida a revisar e montar.
export const FECHAMENTO = "Pronto, já tenho tudo! Dá uma olhada no resumo. Se estiver certo, é só dizer \"pode montar\", ou me fala o que você quer mudar.";

// "Pode montar", "tá certo", "isso mesmo": confirma o resumo por voz.
export const confirmaMontagem = (texto) =>
  /\b(pode (montar|criar|seguir|fazer)|monta(r)?( a campanha)?|confirm\w*|ta (certo|otimo|bom)|esta (certo|otimo)|isso mesmo|perfeito|fechado|manda ver|bora)\b/.test(sem(texto));

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

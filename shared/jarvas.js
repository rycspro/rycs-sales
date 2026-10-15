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

  if (esperado && r[esperado] == null) {
    const naoSabe = NAO_SEI.test(n);
    if (["vagas", "visitasPorDia"].includes(esperado)) {
      const v = numeroDe(bruto);
      if (v != null && v > 0) r[esperado] = Math.round(v);
    } else if (["ticketMedio", "fixoMensal"].includes(esperado)) {
      const v = numeroDe(bruto);
      if (v != null) r[esperado] = v;
      else if (naoSabe) r[esperado] = 0;
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

const ticketDoCadastro = (emp) => numeroDe(emp?.ticket) || 0;

export function proximoCampo(r) {
  if (!r.objetivo) return "objetivo";
  if (!r.regiao) return "regiao";
  if (!r.publico) return "publico";
  if (r.vagas == null) return "vagas";
  if (r.ticketMedio == null) return "ticketMedio";
  if (OBJETIVOS[r.objetivo]?.usaVisitasPorDia && r.visitasPorDia == null) return "visitasPorDia";
  if (r.fixoMensal == null) return "fixoMensal";
  return null;
}

// Pergunta: { texto, chips: [{ rotulo, patch?, seguir? }] }. Chip com patch
// aplica o valor direto; com `seguir`, o Jarvas responde com essa frase.
export function perguntar(campo, r, emp = {}) {
  const obj = OBJETIVOS[r.objetivo];
  switch (campo) {
    case "objetivo":
      return { texto: "O que você precisa que aconteça? Pode escrever do seu jeito, como \"agendar reuniões com indústrias em Sorocaba\", ou escolher uma opção.",
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
        ? { texto: `Vi no cadastro que o ticket médio é ${dinheiro(t)}. Uso esse valor para calcular as comissões?`,
            chips: [{ rotulo: `Sim, usar ${dinheiro(t)}`, patch: { ticketMedio: t } }, { rotulo: "É outro valor", seguir: "Qual é o ticket médio, então? Pode escrever do seu jeito, como \"5 mil\"." }] }
        : { texto: "Quanto vale, em média, uma venda fechada para você?", chips: [{ rotulo: "Ainda não sei", patch: { ticketMedio: 0 } }] };
    }
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
    objetivo: "Não consegui identificar o objetivo. Me diz o que precisa acontecer (agendar reuniões, visitar clientes, fechar vendas, reativar a base…) ou escolhe uma opção abaixo.",
    regiao: "Não peguei a região. Pode me dizer a cidade, o estado ou \"todo o Brasil\"?",
    publico: "Me conta um pouco mais sobre quem é esse cliente: segmento, porte ou cargo de quem decide.",
    vagas: "Não peguei a quantidade. Quantos profissionais? Pode ser só o número, tipo 3.",
    ticketMedio: "Não entendi o valor. Pode me dizer em reais, tipo \"5 mil\" ou \"R$ 5.000\"? Se ainda não souber, tudo bem.",
    visitasPorDia: "Quantas visitas por dia? Pode ser só o número, tipo 5.",
    fixoMensal: "Não entendi o valor. Quanto por mês, em reais, para cada profissional? Se ainda não souber, sem problema.",
  }[campo] || "Não entendi. Pode repetir de outro jeito?";
}

// ---------------------------------------------------------------------------
// 3. Resposta: reação ao que acabou de ser dito, com as contas.

export function calcularTarefasJarvas(r) {
  const fixoMensal = Number(r.fixoMensal) || 0;
  const visitasPorDia = Number(r.visitasPorDia) || 5;
  const vagas = Number(r.vagas) || 1;
  const ticket = Number(r.ticketMedio) || 0;
  const obj = OBJETIVOS[r.objetivo] || OBJETIVOS.reunioes;
  const tarefas = {};

  if (obj.usaVisitasPorDia) {
    tarefas.visita = fixoMensal > 0 ? Math.round(fixoMensal / DIAS_UTEIS / visitasPorDia) : (ticket ? Math.round(ticket * (obj.proporcao.visita || 0.008)) : 0);
    if (obj.acoes.includes("venda")) tarefas.venda = ticket ? Math.round(ticket * (obj.proporcao.venda || 0.08)) : 0;
  } else {
    const principal = obj.principal;
    const valorPrincipal = fixoMensal > 0 ? Math.round(fixoMensal / DIAS_UTEIS) : 0;
    const propPrincipal = obj.proporcao[principal] || 1;
    for (const acao of obj.acoes) {
      if (acao === principal) { tarefas[acao] = valorPrincipal; continue; }
      const rel = (obj.proporcao[acao] || 0) / propPrincipal;
      tarefas[acao] = valorPrincipal > 0 ? Math.max(1, Math.round(valorPrincipal * rel)) : (ticket ? Math.round(ticket * (obj.proporcao[acao] || 0)) : 0);
    }
    if (tarefas.venda === 0 && ticket) tarefas.venda = Math.round(ticket * (obj.proporcao.venda || 0.08));
  }
  return { tarefas, orcamento: fixoMensal > 0 ? fixoMensal * vagas : 0 };
}

// Variação sem sorteio: a mesma conversa dá as mesmas frases.
const escolher = (lista, semente) => lista[Math.abs(semente) % lista.length];

export function reagir(patch, r, emp = {}) {
  const frases = [];
  const obj = OBJETIVOS[r.objetivo];
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
  if (patch.ticketMedio != null) {
    const comissao = r.ticketMedio && obj?.acoes.includes("venda") ? Math.round(r.ticketMedio * (obj.proporcao.venda || 0.08)) : 0;
    frases.push(r.ticketMedio
      ? `Com ticket de ${dinheiro(r.ticketMedio)}${comissao ? `, a comissão sugerida por venda fechada fica perto de ${dinheiro(comissao)}` : ""}.`
      : "Sem problema. Deixo os valores por venda em aberto para você ajustar na revisão.");
  }
  if (patch.visitasPorDia != null)
    frases.push(`${r.visitasPorDia} por dia dá umas ${r.visitasPorDia * DIAS_UTEIS} visitas por mês para cada profissional.`);
  if (patch.fixoMensal != null) {
    if (r.fixoMensal > 0 && obj) {
      const { tarefas, orcamento } = calcularTarefasJarvas(r);
      const unit = tarefas[obj.principal];
      frases.push(`Com ${dinheiro(r.fixoMensal)} por profissional, cada ${ACAO[obj.principal] || "ação"} sai por cerca de ${dinheiro(unit)}. No total, ${dinheiro(orcamento)} por mês.`);
    } else frases.push("Tudo bem. O orçamento fica em aberto e você define na revisão.");
  }
  return frases.join(" ");
}

export function saudacao(emp = {}) {
  return `Oi! Eu sou o Jarvas. Vou montar a campanha${emp.nome ? ` da ${emp.nome}` : ""} com você, leva uns 2 minutos e eu já calculo os valores por tarefa e o orçamento.`;
}

// Resumo final, em linhas [rótulo, valor].
export function resumo(r) {
  const obj = OBJETIVOS[r.objetivo];
  const { tarefas, orcamento } = calcularTarefasJarvas(r);
  const linhas = [
    ["Objetivo", rotuloObjetivo(r.objetivo)],
    ["Região", r.regiao],
    ["Cliente ideal", r.publico],
    ["Profissionais", `${r.vagas} de ${obj?.funcao.toUpperCase() || "—"}`],
    ["Ticket médio", r.ticketMedio ? dinheiro(r.ticketMedio) : "Em aberto"],
  ];
  if (obj?.usaVisitasPorDia) linhas.push(["Visitas por dia", String(r.visitasPorDia)]);
  for (const acao of obj?.acoes || []) if (tarefas[acao]) linhas.push([`Por ${ACAO[acao] || acao}`, dinheiro(tarefas[acao])]);
  linhas.push(["Orçamento mensal", orcamento ? dinheiro(orcamento) : "Em aberto"]);
  return linhas;
}

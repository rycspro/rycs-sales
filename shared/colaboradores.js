// Colaboradores internos (docs/colaboradores/SPEC.md) — regras puras, usadas
// pelo servidor e pela interface. Nada aqui lê banco nem relógio por conta
// própria: datas e dados chegam por parâmetro, para o cálculo ser testável e
// dar sempre o mesmo resultado para a mesma situação (seção 13.3).

export const TERMO_VERSAO = "2026-11-19";

// Termo de transparência (seção 6, ampliado pela seção 10).
export const TERMO_SECOES = [
  { titulo: "O que é registrado", texto: "As tarefas que você recebe e envia, as provas que você mesmo escolhe anexar, a data e a hora de cada envio, os seus acessos à plataforma e, se a sua regra prever, os botões \"Comecei o dia\" e \"Encerrei o dia\" que você mesmo aperta." },
  { titulo: "O que NUNCA é registrado", texto: "Foto sua, localização, captura de tela, teclado ou mouse. A plataforma não liga câmera, não rastreia onde você está e não observa o seu computador." },
  { titulo: "Quem vê", texto: "Só o administrador da RYCS e você. Não existe ranking entre colaboradores na sua área." },
  { titulo: "Para quê", texto: "Calcular o seu variável e acompanhar a produtividade e a presença: dias trabalhados, faltas, tarefas feitas versus a meta, aprovação das provas e a tendência do período. Você vê o seu painel e a fórmula da nota." },
  { titulo: "O que a IA faz", texto: "Resume o período, explica a tendência e aponta alertas (por exemplo, dias seguidos sem atividade). Ela não aprova nem recusa provas, não desconta valores e não decide nada sobre pagamento ou vínculo. Quem decide é o administrador." },
  { titulo: "Avisos", texto: "Se faltar atividade num dia previsto, o primeiro lembrete vem para você, na manhã seguinte e dentro do seu horário. Nenhum aviso é enviado fora da sua jornada ou em dia de folga." },
  { titulo: "Guarda e direitos", texto: "Os registros ficam guardados pelo prazo legal indicado pelo contador. Você pode pedir acesso e correção dos seus dados e contestar um dia marcado como ausente ou uma prova recusada, direto na sua área." },
  { titulo: "Base legal", texto: "O tratamento desses dados tem como base o seu contrato (LGPD, art. 7º, V). Este aceite registra que você leu e está ciente do que é medido." },
];

export const VINCULOS = { clt: "Empregatício (CLT)", outro: "Sem vínculo empregatício" };
export const REGIMES = {
  presencial: "Presencial",
  teletrabalho_jornada: "Teletrabalho por jornada",
  teletrabalho_producao: "Teletrabalho por produção ou tarefa",
};
export const TIPOS_PROVA = { link: "Link", arquivo: "Arquivo (PDF ou imagem de documento ou tela)", texto: "Texto" };
export const TIPOS_AUSENCIA = { ferias: "Férias", folga: "Folga combinada", atestado: "Atestado", licenca: "Licença", outro: "Outro motivo" };
export const NATUREZAS = {
  a_classificar: "A classificar pelo contador",
  salario: "Salário",
  comissao: "Comissão",
  premio: "Prêmio",
  diaria: "Diária",
  ajuda_custo: "Ajuda de custo",
  vale_transporte: "Vale-transporte",
  reembolso: "Reembolso",
};
export const TIPOS_LANCAMENTO = {
  cadastro: "Cadastro trazido",
  empresa_pagante: "Empresa pagante",
  tarefa: "Tarefa aprovada",
  diaria: "Diária verificada",
  ajuste: "Ajuste",
  estorno: "Estorno",
};
export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const SEMANAS_CALIBRACAO = 4;

// Quem não é CLT, ou é CLT em teletrabalho por produção, não tem presença
// medida por padrão (seções 13.1 e 13.13).
export function presencaPadrao(vinculo, regime) {
  if (vinculo !== "clt") return false;
  return regime !== "teletrabalho_producao";
}

export function regraPadrao({ vinculo = "clt", regime = "presencial", hoje } = {}) {
  return {
    fixoCents: 0,
    variavel: {
      cadastroCents: 0,
      cadastroCriterio: "qualificado",
      empresaPagante: { modo: "fixo", valorCents: 0, percentual: 0, meses: 1 },
      tarefaCents: 0,
      diariaCents: 0,
      // Estorno de cadastro ou empresa só desconta dentro deste prazo (seção 4.2).
      garantiaDias: 30,
    },
    tetoMensalCents: 0,
    permiteSaque: false,
    medirPresenca: presencaPadrao(vinculo, regime),
    diasPrevistos: [1, 2, 3, 4, 5],
    horario: { inicio: "08:00", fim: "18:00" },
    diaTrabalhado: { criterio: "envio", minimo: 1 },
    meta: { periodo: "dia", quantidade: null, status: "calibrando", calibracaoDesde: hoje || null },
    alertaDiasSemAtividade: 3,
    registroAtividade: false,
    pesos: { meta: 40, aprovacao: 30, presenca: 30 },
  };
}

// Campos que o admin pode definir como padrão para novos colaboradores.
export const CAMPOS_PADRAO = ["diasPrevistos", "horario", "diaTrabalhado", "alertaDiasSemAtividade", "pesos", "registroAtividade", "meta"];
export function aplicarPadroes(regra, padroes = {}) {
  const out = { ...regra };
  for (const k of CAMPOS_PADRAO) if (padroes[k] !== undefined && padroes[k] !== null) out[k] = typeof padroes[k] === "object" && !Array.isArray(padroes[k]) ? { ...regra[k], ...padroes[k] } : padroes[k];
  if (padroes.garantiaDias !== undefined) out.variavel = { ...regra.variavel, garantiaDias: Number(padroes.garantiaDias) || 0 };
  return out;
}

// Junta a regra salva com o padrão, para regras antigas ganharem campos novos.
export function normalizarRegra(regra = {}, base = {}) {
  const p = regraPadrao(base);
  const r = regra || {};
  return {
    ...p, ...r,
    variavel: { ...p.variavel, ...(r.variavel || {}), empresaPagante: { ...p.variavel.empresaPagante, ...(r.variavel?.empresaPagante || {}) } },
    horario: { ...p.horario, ...(r.horario || {}) },
    diaTrabalhado: { ...p.diaTrabalhado, ...(r.diaTrabalhado || {}) },
    meta: { ...p.meta, ...(r.meta || {}) },
    pesos: { ...p.pesos, ...(r.pesos || {}) },
    diasPrevistos: Array.isArray(r.diasPrevistos) ? r.diasPrevistos.map(Number) : p.diasPrevistos,
  };
}

// ───────────────────────────── Datas (Brasília) ─────────────────────────────
// Brasília é UTC−3 o ano todo desde 2019.
const OFFSET = 3 * 60 * 60 * 1000;
export const dataBR = (ts) => new Date(ts - OFFSET).toISOString().slice(0, 10);
export const mesBR = (ts) => dataBR(ts).slice(0, 7);
export const minutoBR = (ts) => { const d = new Date(ts - OFFSET); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
export const fimDoDiaTs = (iso) => Date.parse(`${iso}T23:59:59.999-03:00`);
export const inicioDoDiaTs = (iso) => Date.parse(`${iso}T00:00:00.000-03:00`);
export const diaDaSemana = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
export function somarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function intervaloDatas(inicio, fim) {
  const out = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) out.push(d);
  return out;
}
export const segundaDaSemana = (iso) => somarDias(iso, -((diaDaSemana(iso) + 6) % 7));
export function ultimoDiaDoMes(mes) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
export function mesSeguinte(mes) {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}
export function mesAnterior(mes) {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}
const hhmm = (s, padrao) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : padrao;
};
export const dataBRFormatada = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// Feriados nacionais. Estaduais e municipais o admin cadastra (seção 13.2).
export function feriadosNacionais(ano) {
  const fixos = [
    ["01-01", "Confraternização Universal"], ["04-21", "Tiradentes"], ["05-01", "Dia do Trabalho"],
    ["09-07", "Independência"], ["10-12", "Nossa Senhora Aparecida"], ["11-02", "Finados"],
    ["11-15", "Proclamação da República"], ["11-20", "Dia da Consciência Negra"], ["12-25", "Natal"],
  ].map(([md, nome]) => ({ data: `${ano}-${md}`, nome }));
  fixos.push({ data: somarDias(pascoa(ano), -2), nome: "Sexta-feira da Paixão" });
  return fixos.sort((a, b) => a.data.localeCompare(b.data));
}

// ───────────────────────────── Jornada ─────────────────────────────

export function foraDaJornada(ts, regra, feriados = new Set()) {
  const r = normalizarRegra(regra);
  const data = dataBR(ts);
  if (!r.diasPrevistos.includes(diaDaSemana(data)) || feriados.has(data)) return true;
  const min = minutoBR(ts);
  return min < hhmm(r.horario.inicio, 480) || min > hhmm(r.horario.fim, 1080);
}

// Avisos ao colaborador só saem em dia previsto, dentro do horário (13.12).
export function dentroDoHorario(ts, regra, feriados = new Set(), ausente = false) {
  return !ausente && !foraDaJornada(ts, regra, feriados);
}

// ───────────────────────────── Presença ─────────────────────────────

function cobre(ausencias, data) {
  return ausencias.find((a) => a.status === "aprovada" && a.dataInicio <= data && a.dataFim >= data) || null;
}

// atividades: { "YYYY-MM-DD": { envios, aprovadas, registros } }
// Devolve um item por dia, com a situação: presente, parcial, ausente,
// justificada, feriado, folga, extra (atividade fora dos dias previstos) ou
// em_andamento (hoje e futuro: o dia só fecha às 23h59, seção 13.2).
export function calcularDias({ inicio, fim, regra, atividades = {}, ausencias = [], feriados = new Set(), hoje }) {
  const r = normalizarRegra(regra);
  const minimo = Math.max(1, Number(r.diaTrabalhado.minimo) || 1);
  const crit = r.diaTrabalhado.criterio;
  return intervaloDatas(inicio, fim).map((data) => {
    const a = atividades[data] || {};
    const envios = a.envios || 0, aprovadas = a.aprovadas || 0, registros = a.registros || 0;
    const valor = crit === "aprovada" ? aprovadas : crit === "registro" ? registros : envios;
    const qualquer = envios + aprovadas + registros > 0;
    const previsto = r.diasPrevistos.includes(diaDaSemana(data));
    const base = { data, previsto, envios, aprovadas, registros };
    const just = cobre(ausencias, data);
    if (just) return { ...base, previsto: false, situacao: "justificada", motivo: just.tipo };
    if (feriados.has(data)) return { ...base, previsto: false, situacao: qualquer ? "extra" : "feriado" };
    if (!previsto) return { ...base, situacao: qualquer ? "extra" : "folga" };
    if (hoje && data >= hoje) return { ...base, situacao: valor >= minimo ? "presente" : "em_andamento" };
    if (valor >= minimo) return { ...base, situacao: "presente" };
    return { ...base, situacao: qualquer ? "parcial" : "ausente" };
  });
}

// Dias seguidos sem atividade até o último dia fechado (feriado e folga não
// quebram nem somam a sequência).
export function ausenciasSeguidas(dias) {
  let n = 0, desde = null;
  for (let i = dias.length - 1; i >= 0; i--) {
    const d = dias[i];
    if (d.situacao === "em_andamento" || d.situacao === "folga" || d.situacao === "feriado") continue;
    if (d.situacao !== "ausente") break;
    n++; desde = d.data;
  }
  return { dias: n, desde };
}

// ───────────────────────────── Nota (13.3) ─────────────────────────────

// ocorrencias: [{ status, contaMeta, dataRef }]
export function calcularPainel({ dias, ocorrencias = [], regra }) {
  const r = normalizarRegra(regra);
  const fechados = dias.filter((d) => d.situacao !== "em_andamento");
  const previstos = fechados.filter((d) => d.previsto).length;
  const presentes = fechados.filter((d) => d.previsto && d.situacao === "presente").length;
  const parciais = fechados.filter((d) => d.situacao === "parcial").length;
  const ausentes = fechados.filter((d) => d.situacao === "ausente").length;
  const justificadas = dias.filter((d) => d.situacao === "justificada").length;
  const extras = dias.filter((d) => d.situacao === "extra").length;
  const contam = ocorrencias.filter((o) => o.contaMeta !== 0 && o.contaMeta !== false);
  const feitas = contam.filter((o) => o.status === "enviada" || o.status === "aprovada").length;
  const aprovadas = ocorrencias.filter((o) => o.status === "aprovada").length;
  const recusadas = ocorrencias.filter((o) => o.status === "recusada").length;

  const porSemana = Math.max(1, r.diasPrevistos.length);
  const q = Number(r.meta.quantidade) || 0;
  const metaAtiva = r.meta.status === "ativa" && q > 0;
  const meta = metaAtiva ? Math.round((r.meta.periodo === "semana" ? (q * previstos) / porSemana : q * previstos) * 10) / 10 : null;

  const comp = {};
  if (metaAtiva && meta > 0) comp.meta = Math.min(1, feitas / meta);
  if (aprovadas + recusadas > 0) comp.aprovacao = aprovadas / (aprovadas + recusadas);
  if (r.medirPresenca && previstos > 0) comp.presenca = (presentes + 0.5 * parciais) / previstos;

  let soma = 0, pesos = 0;
  for (const [k, v] of Object.entries(comp)) {
    const p = Number(r.pesos[k]) || 0;
    soma += v * p; pesos += p;
  }
  const nota = pesos > 0 ? Math.round((soma / pesos) * 100) : null;
  return {
    previstos, presentes, parciais, ausentes, justificadas, extras,
    feitas, meta, metaAtiva, aprovadas, recusadas,
    taxaAprovacao: aprovadas + recusadas > 0 ? Math.round((aprovadas / (aprovadas + recusadas)) * 100) : null,
    presenca: r.medirPresenca && previstos > 0 ? Math.round(((presentes + 0.5 * parciais) / previstos) * 100) : null,
    componentes: Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, Math.round(v * 100)])),
    pesos: r.pesos,
    nota,
    faixa: faixaDaNota(nota),
  };
}

export function faixaDaNota(nota) {
  if (nota == null) return null;
  if (nota >= 85) return "Acima do esperado";
  if (nota >= 60) return "Dentro do esperado";
  return "Abaixo do esperado";
}

export function tendencia(notaAtual, notaAnterior) {
  if (notaAtual == null || notaAnterior == null) return "sem_base";
  const d = notaAtual - notaAnterior;
  return d >= 5 ? "subindo" : d <= -5 ? "caindo" : "estavel";
}

// Fórmula em uma frase, para o colaborador ver como a nota é feita.
export function explicarFormula(regra) {
  const r = normalizarRegra(regra);
  const partes = [];
  if (r.meta.status === "ativa" && r.meta.quantidade) partes.push(`tarefas feitas ÷ meta (peso ${r.pesos.meta})`);
  partes.push(`provas aprovadas ÷ provas avaliadas (peso ${r.pesos.aprovacao})`);
  if (r.medirPresenca) partes.push(`dias trabalhados ÷ dias previstos, com dia parcial valendo meio (peso ${r.pesos.presenca})`);
  return `Nota de 0 a 100: média ponderada de ${partes.join("; ")}. Só entram os itens que já têm dado no período.`;
}

// ───────────────────────────── Meta (13.11) ─────────────────────────────

export function sugerirMeta({ dias, ocorrencias = [], regra }) {
  const r = normalizarRegra(regra);
  const previstos = dias.filter((d) => d.previsto && d.situacao !== "em_andamento").length;
  const feitas = ocorrencias.filter((o) => (o.contaMeta !== 0 && o.contaMeta !== false) && (o.status === "enviada" || o.status === "aprovada")).length;
  if (!previstos || !feitas) return null;
  const porDia = feitas / previstos;
  if (r.meta.periodo === "semana") return Math.max(1, Math.round(porDia * Math.max(1, r.diasPrevistos.length)));
  return Math.max(1, Math.round(porDia * 10) / 10);
}

export function calibracaoTerminou(regra, hoje) {
  const r = normalizarRegra(regra);
  if (r.meta.status !== "calibrando" || !r.meta.calibracaoDesde) return false;
  return somarDias(r.meta.calibracaoDesde, SEMANAS_CALIBRACAO * 7) <= hoje;
}

// ───────────────────────────── Remuneração ─────────────────────────────

const reais = (c) => (Number(c || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const formatarCents = reais;

export function descreverVariavel(regra) {
  const v = normalizarRegra(regra).variavel;
  const itens = [];
  if (v.cadastroCents > 0) itens.push(`${reais(v.cadastroCents)} por cadastro válido trazido`);
  const e = v.empresaPagante;
  if (e.modo === "percentual" && e.percentual > 0) itens.push(`${e.percentual}% do pagamento de cada empresa trazida${e.meses > 1 ? `, nos primeiros ${e.meses} meses` : ", na primeira cobrança"}`);
  if (e.modo === "fixo" && e.valorCents > 0) itens.push(`${reais(e.valorCents)} por empresa pagante trazida${e.meses > 1 ? `, por cobrança nos primeiros ${e.meses} meses` : ""}`);
  if (v.tarefaCents > 0) itens.push(`${reais(v.tarefaCents)} por tarefa aprovada (salvo valor próprio da tarefa)`);
  if (v.diariaCents > 0) itens.push(`${reais(v.diariaCents)} por dia trabalhado verificado`);
  return itens.length ? itens.join("; ") : "Sem variável";
}

// Campos que, se mudarem, pedem aditivo (seção 9).
export function mudouContrato(antiga, nova) {
  const a = normalizarRegra(antiga), n = normalizarRegra(nova);
  const chave = (r) => JSON.stringify([r.fixoCents, r.variavel, r.tetoMensalCents, r.permiteSaque, r.diasPrevistos, r.horario]);
  return chave(a) !== chave(n);
}

// Lista o que diminuiu, para o aviso do art. 468 da CLT (seção 13.7).
export function reducoes(antiga, nova) {
  const a = normalizarRegra(antiga), n = normalizarRegra(nova);
  const out = [];
  const cmp = (rotulo, x, y) => { if (Number(y || 0) < Number(x || 0)) out.push(rotulo); };
  cmp("Fixo por mês", a.fixoCents, n.fixoCents);
  cmp("Valor por cadastro", a.variavel.cadastroCents, n.variavel.cadastroCents);
  cmp("Valor por tarefa", a.variavel.tarefaCents, n.variavel.tarefaCents);
  cmp("Diária", a.variavel.diariaCents, n.variavel.diariaCents);
  if (a.variavel.empresaPagante.modo === n.variavel.empresaPagante.modo) {
    cmp("Valor por empresa pagante", a.variavel.empresaPagante.valorCents, n.variavel.empresaPagante.valorCents);
    cmp("Percentual por empresa pagante", a.variavel.empresaPagante.percentual, n.variavel.empresaPagante.percentual);
    cmp("Meses de comissão por empresa", a.variavel.empresaPagante.meses, n.variavel.empresaPagante.meses);
  }
  if (a.tetoMensalCents > 0 && (n.tetoMensalCents === 0 ? false : n.tetoMensalCents < a.tetoMensalCents)) out.push("Teto mensal do variável");
  return out;
}

// ───────────────────────────── Contrato ─────────────────────────────

export const CAMPOS_CONTRATO = {
  nome: "Nome completo", cpf: "CPF", funcao: "Função (cargo)", vinculo: "Tipo de vínculo", regime: "Regime de trabalho",
  dataInicio: "Data de início", jornada: "Jornada (horas por semana)", diasPrevistos: "Dias de trabalho", horario: "Horário",
  fixo: "Fixo por mês", variavel: "Regras do variável", teto: "Teto mensal do variável", dataEmissao: "Data de emissão",
};

export function camposDoContrato(colab, regra, hoje) {
  const r = normalizarRegra(regra);
  const dias = r.diasPrevistos.slice().sort().map((d) => DIAS_SEMANA[d]).join(", ");
  return {
    nome: colab.nome || "",
    cpf: formatarCpf(colab.cpf),
    funcao: colab.funcao || "",
    vinculo: VINCULOS[colab.vinculo] || colab.vinculo || "",
    regime: REGIMES[colab.regime] || "",
    dataInicio: dataBRFormatada(colab.dataInicio),
    jornada: colab.jornadaHoras ? `${colab.jornadaHoras} horas semanais` : "",
    diasPrevistos: dias,
    horario: `das ${r.horario.inicio} às ${r.horario.fim}`,
    fixo: r.fixoCents > 0 ? reais(r.fixoCents) : "Sem fixo",
    variavel: descreverVariavel(r),
    teto: r.tetoMensalCents > 0 ? reais(r.tetoMensalCents) : "Sem teto",
    dataEmissao: dataBRFormatada(hoje),
  };
}

// Só troca {{campo}} pelo valor. A IA não redige cláusula (seção 9).
export function preencherContrato(texto, campos) {
  const faltando = new Set();
  const saida = String(texto || "").replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_m, k) => {
    const v = campos[k];
    if (v === undefined || v === null || v === "") { faltando.add(k); return `[${CAMPOS_CONTRATO[k] || k}]`; }
    return String(v);
  });
  return { texto: saida, faltando: [...faltando] };
}

export function formatarCpf(cpf) {
  const d = String(cpf || "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : String(cpf || "");
}
export function mascararCpf(cpf) {
  const d = String(cpf || "").replace(/\D/g, "");
  return d.length === 11 ? `***.${d.slice(3, 6)}.***-**` : d ? "***" : "";
}
export function cpfValido(cpf) {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

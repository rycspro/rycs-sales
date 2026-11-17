// Planos do PROFISSIONAL (vendedor): Grátis, Pro e Premium.
//
// Não confundir com shared/planos.js, que é da EMPRESA. Também não confundir
// com sellers.nivel = "pro" (nível por Score, server/services/score.js): aquilo
// é mérito, isto é assinatura paga.
//
// Regra da casa: o código pergunta por RECURSO (pode/limite/desconto), nunca
// pelo nome do plano. `if (plano === "pro")` fora deste arquivo é bug.
//
// `null` = número ainda não decidido pelo dono do produto
// (docs/rycs/planos-pro-premium.md §8). Enquanto for null o recurso fica
// DESLIGADO para todos — nenhum número é inventado aqui.

import { CICLOS, descontoDoCiclo, mesesDoCiclo, normalizarCiclo } from "./planos.js";

const DIA = 86_400_000;

// Ciclos e descontos são os MESMOS dos planos da empresa (shared/planos.js):
// mensal cheio, semestral -15%, anual -30%. `preco` é a mensalidade cheia.
export { CICLOS, normalizarCiclo };
export const CICLOS_PROFISSIONAL = [CICLOS.MENSAL, CICLOS.SEMESTRAL, CICLOS.ANUAL];

export const PLANOS_PROFISSIONAL = {
  gratis: { chave: "gratis", nome: "Grátis", preco: 0, resumo: "Tudo para trabalhar e ganhar: perfil, candidaturas sem limite e saques." },
  pro: { chave: "pro", nome: "Pro", preco: 29.9, resumo: "Ferramentas, treino e prioridade de visibilidade para acelerar o seu trabalho." },
  premium: { chave: "premium", nome: "Premium", preco: 69.9, resumo: "Tudo do Pro, com acompanhamento, mentoria e acesso às campanhas premium." },
};

const arred2 = (n) => Math.round(n * 100) / 100;

// Mensalidade equivalente no ciclo (com o desconto do ciclo).
export function mensalidadeProfissional(chave, ciclo = CICLOS.MENSAL) {
  const preco = PLANOS_PROFISSIONAL[chave]?.preco || 0;
  return arred2(preco * (1 - descontoDoCiclo(normalizarCiclo(ciclo))));
}

// Valor cobrado de uma vez a cada ciclo (mensalidade com desconto × meses).
export function valorProfissionalNoCiclo(chave, ciclo = CICLOS.MENSAL) {
  const c = normalizarCiclo(ciclo);
  return arred2(mensalidadeProfissional(chave, c) * mesesDoCiclo(c));
}

// Valor cobrado no ciclo anual (com o desconto de 30%), para quem lê o preço
// anual direto do plano.
for (const p of Object.values(PLANOS_PROFISSIONAL)) p.precoAnual = valorProfissionalNoCiclo(p.chave, CICLOS.ANUAL);

export const ORDEM_PLANOS_PROFISSIONAL = ["gratis", "pro", "premium"];
export const PLANOS_PAGOS_PROFISSIONAL = ["pro", "premium"];

// Pendências (§8): carência da renovação atrasada e faixa do desempate.
export const CARENCIA_DIAS = null;
export const TOLERANCIA_DESEMPATE = null;

// Tabela de permissões (§2.3). tipo: bool | numero | fracao | nivel.
// Para números: Infinity = ilimitado; null = pendente (desligado).
export const PERMISSOES = {
  etiquetaPro:                     { tipo: "bool",   gratis: false, pro: true,  premium: true },
  desempateScore:                  { tipo: "bool",   gratis: false, pro: true,  premium: true },
  prioridadeCampanhasPremium:      { tipo: "bool",   gratis: false, pro: false, premium: true },
  vagasAntecipadasHoras:           { tipo: "numero", gratis: 0,     pro: 24,    premium: 24 },
  alertaVagaApp:                   { tipo: "bool",   gratis: false, pro: true,  premium: true },
  alertaVagaWhatsApp:              { tipo: "bool",   gratis: false, pro: true,  premium: true },
  saqueNaHora:                     { tipo: "bool",   gratis: false, pro: true,  premium: true },
  saqueMinimo:                     { tipo: "numero", gratis: null,  pro: null,  premium: null }, // null = SAQUE_MINIMO
  cursosNicho:                     { tipo: "bool",   gratis: false, pro: true,  premium: true },
  descontoTrilhaChallenger:        { tipo: "fracao", gratis: 0,     pro: null,  premium: 1 },
  certProfissionalIncluida:        { tipo: "bool",   gratis: false, pro: true,  premium: true },
  renovacoesCertProfissional:      { tipo: "numero", gratis: 0,     pro: 1,     premium: Infinity },
  descontoCertAvancada:            { tipo: "fracao", gratis: 0,     pro: 0.3,   premium: 0 },
  tentativasCertAvancadaIncluidas: { tipo: "numero", gratis: 0,     pro: 0,     premium: null },
  treinadorIA:                     { tipo: "numero", gratis: 0,     pro: Infinity, premium: Infinity },
  treinadorCenariosAvancados:      { tipo: "bool",   gratis: false, pro: false, premium: true },
  scriptsIAPorCampanha:            { tipo: "bool",   gratis: false, pro: true,  premium: true },
  painel:                          { tipo: "nivel",  gratis: "basico", pro: "completo", premium: "comparativo" },
  minutosDiscadora:                { tipo: "numero", gratis: 0,     pro: null,  premium: null },
  discadoraGravacaoTranscricaoFeedback: { tipo: "bool", gratis: false, pro: false, premium: true },
  lembretesWhatsApp:               { tipo: "numero", gratis: 0,     pro: null,  premium: null },
  mentoriaGrupoMensal:             { tipo: "bool",   gratis: false, pro: false, premium: true },
  comunidade:                      { tipo: "bool",   gratis: false, pro: false, premium: true },
  revisaoHumanaPorTrimestre:       { tipo: "numero", gratis: 0,     pro: 0,     premium: 1 },
  vitrineTopTalent:                { tipo: "bool",   gratis: false, pro: false, premium: true }, // + etiqueta dourada
  cartaRecomendacao:               { tipo: "bool",   gratis: false, pro: false, premium: true }, // + etiqueta dourada
  suporte:                         { tipo: "nivel",  gratis: "normal", pro: "prioritario", premium: "direto" },
  bonusIndicacaoAssinante:         { tipo: "numero", gratis: 0,     pro: null,  premium: null },
  acessoAntecipado:                { tipo: "bool",   gratis: false, pro: false, premium: true },
};

// Recursos que exigem, além do plano, a etiqueta dourada (certificação
// avançada aprovada). Pagar não dá a etiqueta.
export const EXIGEM_ETIQUETA_DOURADA = ["vitrineTopTalent", "cartaRecomendacao"];

// Recursos que contam uso no mês (uso_profissional).
export const RECURSOS_COM_COTA = ["minutosDiscadora", "lembretesWhatsApp"];

const planoValido = (plano) => (PLANOS_PROFISSIONAL[plano] ? plano : "gratis");
const valorDe = (plano, recurso) => {
  const p = PERMISSOES[recurso];
  if (!p) throw new Error(`Recurso de plano desconhecido: ${recurso}`);
  return p[planoValido(plano)];
};

// Tem o recurso? Pendente (null), zero e false = não.
export function pode(plano, recurso, { etiquetaDourada = false } = {}) {
  const v = valorDe(plano, recurso);
  if (EXIGEM_ETIQUETA_DOURADA.includes(recurso) && !etiquetaDourada) return false;
  if (v === null || v === false || v === 0 || v === undefined) return false;
  return true;
}

// Limite numérico. Devolve null quando o número ainda não foi decidido —
// quem consome trata null como "desligado".
export function limite(plano, recurso) {
  const v = valorDe(plano, recurso);
  return typeof v === "number" || v === null ? v : null;
}

// Desconto como fração (0,30 = 30%). Pendente = sem desconto.
export function desconto(plano, recurso) {
  const v = valorDe(plano, recurso);
  return typeof v === "number" && v > 0 ? Math.min(1, v) : 0;
}

export const nivel = (plano, recurso) => valorDe(plano, recurso);

// Assinaturas que ainda dão benefício. `cancelada` vale até o fim do que
// foi pago; `atrasada` vale até pagoAte + carência; reembolsada/expirada/
// pendente não valem.
export function planoDoProfissional(assinaturas = [], agora = Date.now(), carenciaDias = CARENCIA_DIAS) {
  const carencia = (Number(carenciaDias) || 0) * DIA;
  let melhor = null;
  for (const a of assinaturas || []) {
    if (!a || !PLANOS_PAGOS_PROFISSIONAL.includes(a.plano) || !a.pagoAte) continue;
    const ate = a.status === "atrasada" ? a.pagoAte + carencia : a.pagoAte;
    if (!["ativa", "cancelada", "atrasada"].includes(a.status) || ate <= agora) continue;
    const rank = ORDEM_PLANOS_PROFISSIONAL.indexOf(a.plano);
    const rankMelhor = melhor ? ORDEM_PLANOS_PROFISSIONAL.indexOf(melhor.plano) : -1;
    if (rank > rankMelhor || (rank === rankMelhor && ate > melhor.ate))
      melhor = { plano: a.plano, ate, estado: a.status, assinaturaId: a.id };
  }
  return melhor || { plano: "gratis", ate: null, estado: "gratis", assinaturaId: null };
}

// Fim do período pago: o ano conta do vencimento, não do dia em que pagou.
// Soma os meses do ciclo pago ao maior entre o "pago até" atual e o vencimento.
// Ciclo ausente ou antigo ('anual') conta como anual.
export function estenderPeriodo(pagoAteAtual, vencimento, ciclo = CICLOS.ANUAL) {
  const base = new Date(Math.max(Number(pagoAteAtual) || 0, Number(vencimento) || 0));
  base.setUTCMonth(base.getUTCMonth() + mesesDoCiclo(normalizarCiclo(ciclo || CICLOS.ANUAL)));
  return base.getTime();
}

// Mês de contagem das cotas, no fuso de Brasília ("AAAA-MM").
export function periodoDaCota(agora = Date.now()) {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date(agora));
  const y = partes.find((p) => p.type === "year").value;
  const m = partes.find((p) => p.type === "month").value;
  return `${y}-${m}`;
}

// Decide um consumo de cota sem tocar no banco. Avisa uma vez a 80% e a 100%.
export function avaliarConsumo({ limite: lim, usado = 0, qtd = 1, avisado80 = false, avisado100 = false }) {
  if (lim === null || lim === undefined || lim <= 0)
    return { ok: false, motivo: lim === null ? "pendente" : "sem_cota", usado, limite: lim ?? null, restante: 0 };
  if (lim === Infinity) return { ok: true, usado: usado + qtd, limite: Infinity, restante: Infinity, aviso: null };
  if (usado + qtd > lim) return { ok: false, motivo: "esgotada", usado, limite: lim, restante: Math.max(0, lim - usado) };
  const novo = usado + qtd;
  let aviso = null;
  if (novo >= lim && !avisado100) aviso = 100;
  else if (novo >= lim * 0.8 && !avisado80) aviso = 80;
  return { ok: true, usado: novo, limite: lim, restante: lim - novo, aviso };
}

// Desempate do Pro (§2.3, regra 2): reordena só DENTRO da mesma faixa de
// Score. Tolerância pendente (null) = lista intacta. Faixa em vez de
// "diferença ≤ X" porque comparar por diferença não é transitivo.
export function ordenarComDesempate(lista, temDesempate, tolerancia = TOLERANCIA_DESEMPATE) {
  const tol = Number(tolerancia);
  if (!tolerancia || !Number.isFinite(tol) || tol <= 0) return lista;
  const faixa = (s) => Math.floor((Number(s.nota) || 0) / tol);
  return lista
    .map((s, i) => ({ s, i }))
    .sort((a, b) =>
      faixa(b.s) - faixa(a.s) ||
      (temDesempate(b.s) ? 1 : 0) - (temDesempate(a.s) ? 1 : 0) ||
      (Number(b.s.nota) || 0) - (Number(a.s.nota) || 0) ||
      a.i - b.i)
    .map((x) => x.s);
}

// Texto da vitrine. Nada aqui promete mais vendas, contratação ou ganho.
export const BENEFICIOS_VITRINE = [
  { texto: "Perfil, candidaturas sem limite e saques", gratis: true, pro: true, premium: true },
  { texto: "Etiqueta Pro e desempate entre Scores parecidos (o Score continua decidindo)", gratis: false, pro: true, premium: true },
  { texto: "Vagas compatíveis 24h antes, com alerta no app e no WhatsApp", gratis: false, pro: true, premium: true },
  { texto: "Saque na hora, dentro das regras antifraude", gratis: false, pro: true, premium: true },
  { texto: "Cursos de nicho incluídos", gratis: false, pro: true, premium: true },
  { texto: "Certificação Profissional incluída", gratis: false, pro: "Com 1 renovação", premium: "Renovações enquanto assinar" },
  { texto: "Certificação Avançada Challenger", gratis: false, pro: "30% de desconto", premium: "Direito à prova incluído" },
  { texto: "Treinador de vendas com IA", gratis: false, pro: "Ilimitado", premium: "Ilimitado + cenários avançados" },
  { texto: "Scripts e mensagens com IA para cada campanha", gratis: false, pro: true, premium: true },
  { texto: "Painel de desempenho", gratis: "Básico", pro: "Completo", premium: "Completo + comparação com os melhores" },
  { texto: "Discadora", gratis: false, pro: "Cota mensal", premium: "Cota maior, com gravação, transcrição e feedback por IA" },
  { texto: "Lembretes por WhatsApp (só para quem aceitou receber)", gratis: false, pro: "Básico", premium: "Completo" },
  { texto: "Prioridade em campanhas premium", gratis: false, pro: false, premium: true },
  { texto: "Mentoria em grupo mensal e comunidade", gratis: false, pro: false, premium: true },
  { texto: "Revisão humana de 1 conversa por trimestre", gratis: false, pro: false, premium: true },
  { texto: "Vitrine Top Talent e carta de recomendação (com a etiqueta dourada)", gratis: false, pro: false, premium: true },
  { texto: "Suporte", gratis: "Normal", pro: "Prioritário", premium: "Canal direto" },
  { texto: "Acesso antecipado a novidades", gratis: false, pro: false, premium: true },
];

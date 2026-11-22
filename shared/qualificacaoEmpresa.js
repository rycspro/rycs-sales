// Qualificação das empresas que chegam pelo formulário instantâneo da RYCS
// (campanhas [EMP]). As 13 perguntas de múltipla escolha são os 13 critérios da
// planilha de qualificação: cada resposta vale de 1 a 5, a nota é a média e a
// classificação sai da nota.
//
// As perguntas e respostas daqui são as mesmas do formulário na Meta. A Meta
// devolve pergunta e resposta como texto em minúsculas, com "_" no lugar dos
// espaços (ex.: "sim,_é_a_prioridade_agora"), então a comparação ignora acento,
// caixa, espaço e pontuação. Mudou o texto no formulário? Mude aqui também.

export const PERGUNTAS_QUALIFICACAO = [
  { criterio: "Necessidade comercial", pergunta: "Sua empresa precisa vender mais hoje?", opcoes: [
    ["Sim, é a prioridade agora", 5], ["Sim, precisa", 4], ["Seria bom, mas não é prioridade", 3], ["Não precisa", 1]] },
  { criterio: "Urgência (30 dias)", pergunta: "Em quanto tempo você precisa de resultado em vendas?", opcoes: [
    ["O quanto antes", 5], ["Em até 30 dias", 4], ["Em 2 a 3 meses", 3], ["Sem pressa", 1]] },
  { criterio: "Dificuldade comercial", pergunta: "Como está o comercial da sua empresa hoje?", opcoes: [
    ["Eu mesmo vendo, não tenho time", 5], ["Tenho vendedores, mas rendem pouco", 4], ["Funciona, mas pode melhorar", 3], ["Funciona bem", 1]] },
  { criterio: "Necessidade de profissionais", pergunta: "Quantos vendedores você precisa?", opcoes: [
    ["Mais de 3", 5], ["2 ou 3", 4], ["Só 1", 3], ["Nenhum por agora", 1]] },
  { criterio: "Compatibilidade operacional", pergunta: "Sua venda pode ser feita a distância (WhatsApp, telefone ou online)?", opcoes: [
    ["Sim, totalmente", 5], ["A maior parte", 4], ["Só uma parte", 3], ["Não, só presencial", 1]] },
  { criterio: "Escalabilidade", pergunta: "Seu produto ou serviço pode ser vendido para muito mais clientes?", opcoes: [
    ["Sim, em todo o Brasil", 5], ["Sim, na minha região", 4], ["Em parte, é limitado", 3], ["Não", 1]] },
  { criterio: "Capacidade operacional", pergunta: "Se as vendas dobrarem, sua empresa consegue entregar?", opcoes: [
    ["Sim, tranquilamente", 5], ["Sim, com ajustes", 4], ["Com dificuldade", 2], ["Não", 1]] },
  { criterio: "Capacidade de investimento", pergunta: "Você tem verba para investir em vendas (comissão e estrutura)?", opcoes: [
    ["Sim, já tenho verba separada", 5], ["Sim, se trouxer resultado", 4], ["Pouca verba", 2], ["Não tenho", 1]] },
  { criterio: "Mentalidade de crescimento", pergunta: "Qual o seu objetivo para a empresa nos próximos 12 meses?", opcoes: [
    ["Crescer forte e ganhar mercado", 5], ["Crescer aos poucos", 4], ["Ainda não sei", 2], ["Manter como está", 1]] },
  { criterio: "Poder de decisão", pergunta: "Quem decide sobre contratar vendas na empresa?", opcoes: [
    ["Eu decido", 5], ["Eu e meu sócio", 4], ["Outra pessoa decide", 2]] },
  { criterio: "Potencial financeiro", pergunta: "Qual o faturamento mensal da empresa?", opcoes: [
    ["Acima de R$ 100 mil", 5], ["De R$ 50 mil a R$ 100 mil", 4], ["De R$ 20 mil a R$ 50 mil", 3], ["De R$ 5 mil a R$ 20 mil", 2], ["Até R$ 5 mil", 1]] },
  { criterio: "Disponibilidade para iniciar", pergunta: "Se fizer sentido, quando você pode começar?", opcoes: [
    ["Já, esta semana", 5], ["Ainda este mês", 4], ["No próximo mês", 3], ["Sem data definida", 1]] },
  { criterio: "Probabilidade de fechar em 7 dias", pergunta: "Se a proposta fizer sentido, qual a chance de fechar em 7 dias?", opcoes: [
    ["Alta, quero fechar logo", 5], ["Boa, se o preço couber", 4], ["Média, preciso avaliar", 3], ["Baixa, só conhecendo", 1]] },
];

// Segmento: múltipla escolha também, mas não entra na nota.
export const PERGUNTA_SEGMENTO = {
  criterio: "Segmento",
  pergunta: "Qual o segmento da sua empresa?",
  opcoes: ["Serviços", "Comércio e varejo", "Indústria", "Saúde e estética", "Educação e cursos", "Tecnologia e software", "Construção e imóveis", "Outro"],
};

// Faixas da classificação, pela média das respostas (1 a 5).
export const CLASSIFICACOES = [
  { minimo: 4, nome: "Alta prioridade", tom: "alta" },
  { minimo: 3, nome: "Média prioridade", tom: "media" },
  { minimo: 0, nome: "Baixa prioridade", tom: "baixa" },
];

const semAcento = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const chave = (t) => semAcento(t).replace(/[^a-z0-9]/g, "");
const slug = (t) => semAcento(t).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// Formulário instantâneo de empresas na Página da RYCS. O servidor cria este
// formulário na Meta quando ele não existe (services/metaLeadsRycs.js).
export const FORMULARIO_EMPRESAS_NOME = "[EMP] Qualificação de empresas";

// Perguntas no formato da Meta. A chave de cada pergunta é o critério e a de
// cada opção é o próprio texto, então o lead volta com nomes que o
// qualificarLead reconhece.
export function perguntasDoFormulario() {
  const multipla = (p, opcoes) => ({
    type: "CUSTOM", key: slug(p.criterio), label: p.pergunta,
    options: opcoes.map((texto) => ({ value: texto, key: slug(texto) })),
  });
  return [
    { type: "FULL_NAME" }, { type: "EMAIL" }, { type: "PHONE" }, { type: "COMPANY_NAME" },
    multipla(PERGUNTA_SEGMENTO, PERGUNTA_SEGMENTO.opcoes),
    ...PERGUNTAS_QUALIFICACAO.map((p) => multipla(p, p.opcoes.map(([texto]) => texto))),
  ];
}

// A Meta pode cortar chaves longas: vale também quando uma começa pela outra.
const mesmaPergunta = (a, b) => a === b || (Math.min(a.length, b.length) >= 12 && (a.startsWith(b) || b.startsWith(a)));

const respostaDe = (entradas, pergunta) => {
  const kp = chave(pergunta);
  return entradas.find(([k]) => mesmaPergunta(k, kp))?.[1];
};

export function classificar(nota) {
  return CLASSIFICACOES.find((c) => nota >= c.minimo) || CLASSIFICACOES.at(-1);
}

// `outros` do lead (perguntas próprias do formulário) → nota, classificação,
// segmento e a resposta de cada critério. null quando o lead não respondeu
// nenhuma pergunta de qualificação (ex.: formulário de profissionais).
export function qualificarLead(outros = {}) {
  const entradas = Object.entries(outros || {}).map(([k, v]) => [chave(k), String(v ?? "")]);
  const criterios = [];
  for (const p of PERGUNTAS_QUALIFICACAO) {
    const valor = respostaDe(entradas, p.pergunta) ?? entradas.find(([k]) => k === chave(p.criterio))?.[1];
    if (valor == null) continue;
    const opcao = p.opcoes.find(([texto]) => chave(texto) === chave(valor));
    if (opcao) criterios.push({ criterio: p.criterio, resposta: opcao[0], nota: opcao[1] });
  }
  if (!criterios.length) return null;
  const nota = Math.round((criterios.reduce((s, c) => s + c.nota, 0) / criterios.length) * 10) / 10;
  const seg = respostaDe(entradas, PERGUNTA_SEGMENTO.pergunta) ?? entradas.find(([k]) => k === chave(PERGUNTA_SEGMENTO.criterio))?.[1];
  const segmento = seg == null ? "" : PERGUNTA_SEGMENTO.opcoes.find((o) => chave(o) === chave(seg)) || seg.replace(/_/g, " ");
  const c = classificar(nota);
  return { nota, classificacao: c.nome, tom: c.tom, respondidas: criterios.length, total: PERGUNTAS_QUALIFICACAO.length, segmento, criterios };
}

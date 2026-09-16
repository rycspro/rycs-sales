import { camposPendentesEmpresa, saldoDisponivel } from "../../shared/empresa.js";
import { FUNCOES, nomeFuncao } from "../../shared/funcoes.js";

// Dossiê da empresa: o que a plataforma precisa entender sobre quem contrata.
//
// Mesma regra do dossiê do profissional: a leitura é montada por regra, não
// por IA. Duas empresas com os mesmos dados recebem o mesmo parecer, e o
// parecer é defensável — dá para apontar de qual campo cada frase saiu.
//
// A narrativa por IA entra por cima, em campo separado, e só quando há chave
// configurada. Ela descreve; ela não classifica nem recomenda.
//
// O que a plataforma quer saber aqui não é "a empresa tem saldo", e sim: o
// que ela vende, para quem, que tipo de vendedor ela precisa, e se ela é uma
// contratante que honra o combinado. As três coisas saem de campos diferentes.

const vazio = (v) => !v || !String(v).trim();
const texto = (v, padrao = "—") => (vazio(v) ? padrao : String(v).trim());

// Ticket declarado vira número quando dá. "R$ 1.490,50/mês" → 1490.5
export function ticketNumerico(bruto) {
  if (!bruto) return null;
  const m = String(bruto).replace(/\s/g, "").match(/([\d.]+,\d{2}|[\d.]+)/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// A faixa de ticket muda o tipo de vendedor que serve. Vender R$ 200 e vender
// R$ 50.000 são operações diferentes, com ciclos e perfis diferentes.
export function faixaDeTicket(valor) {
  if (valor === null) return { chave: "indefinido", nome: "Não declarado", exige: "Sem o ticket não dá para dizer que perfil serve." };
  if (valor < 500) return { chave: "baixo", nome: "Ticket baixo", exige: "Volume alto e ciclo curto. Pede vendedor de cadência, não de negociação longa." };
  if (valor < 5000) return { chave: "medio", nome: "Ticket médio", exige: "Ciclo de semanas com mais de um contato. Pede qualificação antes de agendar." };
  return { chave: "alto", nome: "Ticket alto", exige: "Ciclo longo, múltiplos decisores. Pede closer experiente e tolerância a demora." };
}

// O que a empresa busca sai das campanhas, não do que ela diz buscar.
function operacao(campanhas = []) {
  const ativas = campanhas.filter((c) => c.status === "ativa");
  const funcoesBuscadas = [...new Set(campanhas.map((c) => c.funcao).filter(Boolean))];
  const tiposDeAcao = [...new Set(campanhas.flatMap((c) => Object.keys(c.tarefas || {})))];
  const exigemCertificacao = campanhas.filter((c) => c.exigeCertificacao).length;
  const vagas = campanhas.reduce((n, c) => n + Number(c.vagas || 0), 0);

  return {
    campanhasTotais: campanhas.length,
    campanhasAtivas: ativas.length,
    vagasAbertas: vagas,
    funcoesBuscadas: funcoesBuscadas.map((f) => ({ chave: f, nome: nomeFuncao(f), descricao: FUNCOES[f]?.descricao || "" })),
    tiposDeAcao,
    exigemCertificacao,
  };
}

// Como essa empresa se comporta com quem trabalha para ela. É o que um
// profissional gostaria de saber antes de entrar, e o que a plataforma
// precisa saber antes de recomendar.
function conduta(submissions = [], empresa = {}) {
  const decididas = submissions.filter((s) => ["liberado", "recusado"].includes(s.status));
  const liberadas = submissions.filter((s) => s.status === "liberado");
  const aguardando = submissions.filter((s) => ["revisao", "analisando", "ia_aprovado", "conferido"].includes(s.status));

  const taxaAprovacao = decididas.length ? Math.round((liberadas.length / decididas.length) * 100) : null;

  // Tempo entre o envio e a decisão. Conferência lenta trava o dinheiro de
  // quem já entregou — é o indicador de contratante que mais dói do outro lado.
  const tempos = decididas
    .map((s) => (s.decididoEm || s.liberadoEm || s.reviewedEm) - s.criadoEm)
    .filter((n) => Number.isFinite(n) && n > 0);
  const horasMedias = tempos.length
    ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length / 3600000)
    : null;

  return {
    acoesRecebidas: submissions.length,
    acoesLiberadas: liberadas.length,
    acoesAguardando: aguardando.length,
    taxaAprovacao,
    horasMediasParaDecidir: horasMedias,
    saldo: Number(empresa.saldo || 0),
    saldoDisponivel: saldoDisponivel(empresa),
    saldoReservado: Number(empresa.saldoReservado || 0),
  };
}

// Sinais que pedem olho humano. Nenhum bloqueia nada sozinho.
function alertas(empresa, op, cond, pendentes) {
  const lista = [];

  if (pendentes.length)
    lista.push(`Cadastro incompleto: falta ${pendentes.join(", ")}.`);

  if (cond.saldoDisponivel <= 0 && op.campanhasAtivas > 0)
    lista.push("Campanha ativa sem saldo disponível: o profissional trabalha e não tem de onde receber.");

  if (cond.horasMediasParaDecidir !== null && cond.horasMediasParaDecidir > 72)
    lista.push(`Leva em média ${cond.horasMediasParaDecidir}h para conferir uma ação. Acima de 72h o profissional desiste da campanha.`);

  if (cond.acoesAguardando >= 10)
    lista.push(`${cond.acoesAguardando} ações paradas esperando conferência.`);

  if (cond.taxaAprovacao !== null && cond.taxaAprovacao < 50 && cond.acoesRecebidas >= 10)
    lista.push(`Recusa mais da metade do que recebe (${cond.taxaAprovacao}% de aprovação). Ou o briefing está confuso, ou o critério está fora do combinado.`);

  if (vazio(empresa.icp) || vazio(empresa.produto))
    lista.push("Produto ou cliente ideal em branco: o vendedor não tem como saber para quem ligar.");

  if (!op.campanhasTotais)
    lista.push("Nunca criou campanha.");

  return lista;
}

// Que profissional serve para esta empresa. Sai do cruzamento entre o que ela
// vende, o ticket e as funções que ela mesma abriu nas campanhas.
function perfilIdeal(empresa, op) {
  const ticket = ticketNumerico(empresa.ticket);
  const faixa = faixaDeTicket(ticket);

  const declaradas = op.funcoesBuscadas.map((f) => f.nome);
  const sugerida = declaradas.length
    ? null
    : faixa.chave === "alto" ? "Closer"
      : faixa.chave === "baixo" ? "SDR ou PAP"
        : faixa.chave === "medio" ? "SDR para qualificar, Closer para fechar"
          : null;

  return {
    faixaDeTicket: faixa.nome,
    ticketEstimado: ticket,
    exigeDaOperacao: faixa.exige,
    funcoesQueAbriu: declaradas,
    sugestao: sugerida,
    exigeCertificacao: op.exigemCertificacao > 0,
  };
}

export function montarDossieEmpresa({ empresa, campanhas = [], submissions = [] }) {
  const pendentes = camposPendentesEmpresa(empresa);
  const op = operacao(campanhas);
  const cond = conduta(submissions, empresa);
  const ideal = perfilIdeal(empresa, op);

  // Uma linha antes de qualquer número, igual ao dossiê do profissional.
  const veredito = !op.campanhasTotais
    ? "Cadastrada, ainda não operou."
    : op.campanhasAtivas
      ? `Operando: ${op.campanhasAtivas} campanha(s) ativa(s), ${cond.acoesRecebidas} ação(ões) recebida(s).`
      : "Já operou, mas não tem campanha ativa agora.";

  return {
    identidade: {
      nome: texto(empresa.nome),
      razaoSocial: texto(empresa.razaoSocial),
      documento: texto(empresa.documento),
      segmento: texto(empresa.segmento),
      regiao: texto(empresa.regiao),
      statusCadastro: texto(empresa.statusCadastro, "rascunho"),
      desde: empresa.criadoEm || null,
    },
    oferta: {
      produto: texto(empresa.produto),
      ticket: texto(empresa.ticket),
      icp: texto(empresa.icp),
      diferenciais: texto(empresa.diferenciais),
      objecoes: texto(empresa.objecoes),
    },
    resumo: { veredito, nota: Number(empresa.nota || 0), assinatura: texto(empresa.assinatura, "free") },
    operacao: op,
    conduta: cond,
    perfilIdeal: ideal,
    pendencias: pendentes,
    alertas: alertas(empresa, op, cond, pendentes),
  };
}

// Leitura auxiliar por IA. Só roda com chave configurada; o dossiê inteiro
// funciona sem ela. Descreve a especialidade da empresa — não dá nota, não
// recomenda aprovar nem recusar, e não inventa o que não estiver nos campos.
export async function narrativaEmpresa(dossie) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const campos = [
      `Empresa: ${dossie.identidade.nome}`,
      `Segmento: ${dossie.identidade.segmento} · Região: ${dossie.identidade.regiao}`,
      `Produto: ${dossie.oferta.produto}`,
      `Ticket: ${dossie.oferta.ticket}`,
      `Cliente ideal: ${dossie.oferta.icp}`,
      `Diferenciais: ${dossie.oferta.diferenciais}`,
      `Objeções comuns: ${dossie.oferta.objecoes}`,
      `Funções que abriu em campanha: ${dossie.perfilIdeal.funcoesQueAbriu.join(", ") || "nenhuma"}`,
      `Tipos de ação remunerada: ${dossie.operacao.tiposDeAcao.join(", ") || "nenhum"}`,
    ].join("\n");

    const resposta = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system:
        "Você lê o cadastro de uma empresa contratante numa plataforma de vendas por comissão " +
        "e descreve, em português do Brasil, qual é a especialidade dela e que tipo de vendedor " +
        "se encaixa nessa operação. Máximo 4 frases. Seja concreto: o que ela vende, para quem, " +
        "como é o ciclo de venda provável e que perfil comercial funciona ali. " +
        "Não invente dados que não estejam nos campos, não dê nota, não recomende aprovar nem recusar. " +
        "Se um campo essencial estiver vazio, diga que falta em vez de supor.",
      messages: [{ role: "user", content: campos }],
    });

    return resposta.content.map((b) => b.text || "").join("").trim() || null;
  } catch (err) {
    console.error("[dossie-empresa] narrativa indisponível:", err.message);
    return null;
  }
}

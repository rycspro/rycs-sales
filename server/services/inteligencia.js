import { CATEGORIAS, ORDEM_CATEGORIAS } from "../../shared/triagem.js";

// Motor de leitura da RYCS.
//
// Escreve, em português corrido, o que os números do dossiê significam. Roda
// dentro da plataforma, sem depender de provedor externo, sem chave de API e
// sem custo por chamada.
//
// COMO ELE PRODUZ VARIAÇÃO
//
// Não produz. Essa é a característica central, não uma limitação: o texto é
// função pura dos dados. Dois cadastros idênticos geram a leitura idêntica, e
// o mesmo cadastro gera a mesma leitura hoje e daqui a um ano. A variação que
// se vê entre dois profissionais vem da diferença real entre eles — categoria
// forte diferente, ticket diferente, função diferente —, nunca de sorteio.
//
// Isso importa porque a leitura acompanha decisão sobre pessoa e sobre
// dinheiro. Um texto que mudasse a cada geração seria indefensável: não
// haveria como explicar, depois, por que dois perfis iguais receberam
// pareceres diferentes.
//
// O QUE ELE NÃO FAZ
//
// Não dá nota, não recomenda aprovar nem recusar, e não afirma nada que não
// esteja nos campos. Quando falta dado, ele diz que falta — não completa com
// suposição. Nenhum número aqui é gerado: todos vêm do dossiê, que por sua vez
// vem das respostas e do banco.

const pct = (n) => `${Math.round(n)}%`;

// Junta itens em português: "a, b e c".
function lista(itens) {
  const l = itens.filter(Boolean);
  if (!l.length) return "";
  if (l.length === 1) return l[0];
  return `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}`;
}

const frase = (s) => (s ? s.trim().replace(/\s+/g, " ") : "");

// Emenda um trecho no meio de uma frase sem estragar o que veio do usuário.
// Só a primeira letra desce, e só quando a primeira palavra não é sigla —
// "CNPJ" precisa continuar "CNPJ", e "Contabilidade" pode virar
// "contabilidade".
function emendar(texto) {
  const t = frase(texto);
  if (!t) return "";
  const primeira = t.split(/\s/)[0].replace(/[^\wÀ-ÿ]/g, "");
  const ehSigla = primeira.length > 1 && primeira === primeira.toUpperCase();
  return ehSigla ? t : t[0].toLowerCase() + t.slice(1);
}

// Tira o ponto final para o trecho caber no meio de outra frase.
const semPonto = (t) => frase(t).replace(/\.$/, "");

const plural = (n, singular, pluralForma) => `${n} ${n === 1 ? singular : pluralForma}`;


// -------------------------------------------------------------- profissional

// Como cada categoria se traduz em rotina de trabalho. Difere do mapa do
// dossiê: lá a frase descreve entrega; aqui descreve o que a pessoa faz no
// dia, que é o que o texto corrido pede.
const ROTINA = {
  prospeccao:   "monta a própria lista e mantém cadência",
  negociacao:   "sustenta preço na conversa",
  reunioes:     "conduz a reunião pelo problema do cliente",
  experiencia:  "já rodou operação parecida antes",
  comunicacao:  "escuta mais do que fala",
  qualificacao: "confirma decisor e orçamento antes de agendar",
  objecoes:     "devolve objeção com pergunta",
  fechamento:   "fecha com data e responsável definidos",
  disciplina:   "responde lead novo na hora",
  conhecimento: "entende onde cada papel do funil começa e termina",
};

// Onde o profissional se encaixa, pelo que ele declarou saber operar.
function encaixe(declarado = {}) {
  const t = String(declarado.ticketMaximo || "");
  const cap = String(declarado.capacidadeDiaria || "");
  const formatos = Array.isArray(declarado.formatos) ? declarado.formatos : [];

  if (/nunca vendi/i.test(t))
    return "Ainda não vendeu de forma remunerada — o encaixe inicial é em campanha de ciclo curto, com acompanhamento.";

  const alto = /(1[05]|2\d|[3-9]\d)\s*mil|50\.?000|acima/i.test(t);
  const baixo = /at[ée]\s*(1|2|5)\s*mil|menos de/i.test(t);

  const base = alto
    ? "Já operou ticket alto, então aguenta ciclo longo e mais de um decisor na mesa."
    : baixo
      ? "A bagagem é de ticket baixo: rende mais em campanha de volume e ciclo curto."
      : "A bagagem é de ticket médio: encaixa em ciclo de semanas, com follow-up estruturado.";

  const ritmo = /\b(3[0-9]|[4-9][0-9]|100)\b/.test(cap)
    ? " Declara volume alto de contatos por dia."
    : "";

  const canal = formatos.length ? ` Trabalha por ${lista(formatos.map((f) => f.toLowerCase()))}.` : "";

  return frase(base + ritmo + canal);
}

export function leituraProfissional(dossie) {
  if (!dossie?.resumo) return null;

  const { resumo, categorias, funcoes, declarado, alertas = [] } = dossie;
  const melhor = funcoes?.[0];

  const ordenadas = [...(categorias || [])].sort((a, b) => b.valor - a.valor);
  const fortes = ordenadas.filter((c) => c.valor >= 75).slice(0, 3);
  const fracas = ordenadas.filter((c) => c.valor < 50).slice(-2).reverse();

  const partes = [];

  // 1. Posicionamento — qual função, com que cobertura.
  if (melhor) {
    const cobertos = melhor.itens?.filter((i) => i.atende).length ?? 0;
    const total = melhor.itens?.length ?? 0;
    partes.push(
      melhor.veredito === "pronto"
        ? `Perfil de ${melhor.nome}: cobre os ${total} requisitos da função e opera sozinho.`
        : melhor.veredito === "com acompanhamento"
          ? `Perfil de ${melhor.nome}, com ${cobertos} de ${total} requisitos cobertos — entrega com acompanhamento, ainda não sozinho.`
          : `Não cobre o mínimo de nenhuma função da operação: ${cobertos} de ${total} requisitos no melhor encaixe, que seria ${melhor.nome}.`
    );
  }

  // 2. O que sustenta o perfil.
  if (fortes.length) {
    const rotinas = fortes.map((c) => ROTINA[c.chave]).filter(Boolean);
    // As rotinas já contêm "e" dentro delas; juntá-las com outro "e" produz
    // frase emendada. Ponto e vírgula separa sem ambiguidade.
    partes.push(`O que sustenta: ${rotinas.join("; ")} — ${lista(fortes.map((c) => `${emendar(c.nome)} em ${pct(c.valor)}`))}.`);
  } else {
    partes.push("Nenhuma categoria passou de 75%, então não há força marcada para apoiar a alocação.");
  }

  // 3. Onde trava.
  if (fracas.length) {
    partes.push(
      `Trava em ${lista(fracas.map((c) => `${emendar(c.nome)} (${pct(c.valor)})`))}, ` +
      `o que aparece na operação como ${lista(fracas.map((c) => ROTINA[c.chave]).filter(Boolean).map((r) => `dificuldade para ${r}`))}.`
    );
  } else if (fortes.length) {
    partes.push("Não há categoria abaixo de 50%: o perfil é parelho, sem buraco evidente.");
  }

  // 4. Encaixe operacional pelo que declarou.
  const enc = encaixe(declarado);
  if (enc) partes.push(enc);

  // 5. Ressalva — só quando existe e sem dramatizar.
  if (alertas.length) partes.push(`Antes de alocar, conferir — ${emendar(alertas[0])}`);

  return partes.join(" ");
}

// ------------------------------------------------------------------- empresa

export function leituraEmpresa(dossie) {
  if (!dossie?.oferta) return null;

  const { oferta, identidade, operacao, conduta, perfilIdeal, alertas = [] } = dossie;
  const partes = [];
  const semDado = (v) => !v || v === "—";

  // 1. O que a empresa é, pelo que ela declara vender.
  if (semDado(oferta.produto)) {
    partes.push(`${identidade.nome} não declarou o que vende — sem isso não há como dizer que vendedor serve aqui.`);
  } else {
    const paraQuem = semDado(oferta.icp) ? "" : `, mirando ${emendar(semPonto(oferta.icp))}`;
    const onde = semDado(identidade.segmento) ? "" : ` no segmento de ${emendar(identidade.segmento)}`;
    partes.push(frase(`${identidade.nome} vende ${emendar(semPonto(oferta.produto))}${paraQuem}${onde}.`));
  }

  // 2. O ciclo que o ticket implica — é o que mais muda o tipo de vendedor.
  if (perfilIdeal?.ticketEstimado) {
    partes.push(`${perfilIdeal.faixaDeTicket} (${oferta.ticket}). ${frase(perfilIdeal.exigeDaOperacao)}`);
  } else if (!semDado(oferta.ticket)) {
    partes.push(`Ticket declarado como "${oferta.ticket}", que não dá para converter em número — a faixa fica indefinida.`);
  } else {
    partes.push("Sem ticket declarado, não dá para dizer se a operação é de volume ou de ciclo longo.");
  }

  // 3. Quem ela busca — pela campanha aberta, não pela intenção.
  if (perfilIdeal?.funcoesQueAbriu?.length) {
    partes.push(
      `Abriu campanha para ${lista(perfilIdeal.funcoesQueAbriu)}` +
      (perfilIdeal.exigeCertificacao ? ", exigindo profissional certificado." : ".")
    );
  } else if (perfilIdeal?.sugestao) {
    partes.push(`Ainda não abriu campanha com função definida; pelo ticket, o encaixe seria ${perfilIdeal.sugestao}.`);
  }

  // 4. Como trata quem entrega. Sem histórico é resposta legítima.
  if (conduta?.acoesRecebidas > 0) {
    const velocidade = conduta.horasMediasParaDecidir === null
      ? ""
      : conduta.horasMediasParaDecidir <= 24
        ? ` e confere em cerca de ${conduta.horasMediasParaDecidir}h, o que segura o profissional na campanha`
        : conduta.horasMediasParaDecidir <= 72
          ? ` e leva cerca de ${conduta.horasMediasParaDecidir}h para conferir`
          : ` e demora cerca de ${conduta.horasMediasParaDecidir}h para conferir, tempo em que o profissional fica sem receber`;
    const taxa = conduta.taxaAprovacao === null ? "ainda não decidiu nenhuma ação" : `aprova ${pct(conduta.taxaAprovacao)} do que recebe`;
    partes.push(frase(`Recebeu ${plural(conduta.acoesRecebidas, "ação", "ações")}, ${taxa}${velocidade}.`));
  } else if (operacao?.campanhasTotais) {
    partes.push("Tem campanha criada, mas ainda não recebeu nenhuma ação para conferir.");
  } else {
    partes.push("Nunca criou campanha, então não há conduta para avaliar.");
  }

  // 5. A ressalva que mais pesa, quando existe.
  if (alertas.length) partes.push(`Ponto de atenção — ${emendar(alertas[0])}`);

  return partes.join(" ");
}

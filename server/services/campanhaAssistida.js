import { OBJETIVOS, ORDEM_OBJETIVOS, montarCampanha } from "../../shared/objetivosCampanha.js";
import { detectarObjetivo, extrairRegiao, extrairPublico } from "../../shared/interpretacaoCampanha.js";

// Monta uma campanha a partir de um texto livre da empresa.
//
// "Quero vender energia solar para comércios em Campinas, quem fecha é meu
// time" precisa virar objetivo, função comercial, ações remuneradas, prova
// exigida e prazo. Quem contrata sabe descrever o que quer; não sabe traduzir
// isso em configuração de campanha. Esta é a tradução.
//
// Duas fontes, como no motor de leitura: provedor externo quando há chave, e o
// motor interno sempre que não há. O que sai é RASCUNHO — nada é publicado, e
// a empresa revisa campo a campo antes de qualquer coisa ir ao ar.

// Leitura do texto (objetivo, região, público): shared/interpretacaoCampanha.js,
// a mesma que o Jarvas usa na tela.
export { detectarObjetivo };

// Motor interno. Determinístico: o mesmo texto produz sempre a mesma campanha.
export function sugerirInterno({ empresa = {}, brief = "" }) {
  const chave = detectarObjetivo(brief);

  if (!chave) {
    return {
      campanha: null,
      fonte: "interno",
      explicacao:
        "Não consegui identificar o objetivo pelo que você escreveu. " +
        "Diga o que precisa acontecer — agendar reuniões, abrir mercado novo, " +
        "fechar vendas, vender em campo ou reativar clientes — ou escolha o " +
        "objetivo na lista acima.",
    };
  }

  const campanha = montarCampanha(chave, empresa);
  const regiao = extrairRegiao(brief);
  const publico = extrairPublico(brief);
  if (regiao) campanha.regiao = regiao;
  if (publico && !campanha.publico) campanha.publico = publico;
  campanha.descricao = brief.trim().slice(0, 600);

  const obj = OBJETIVOS[chave];
  const partes = [`Objetivo identificado: ${obj.nome.toLowerCase()}, que pede ${obj.funcao.toUpperCase()}.`];
  if (regiao) partes.push(`Região lida do seu texto: ${regiao}.`);
  partes.push(
    campanha.valoresDerivadosDoTicket
      ? `Os valores por ação partem do seu ticket (${empresa.ticket}) e são ponto de partida — revise antes de publicar.`
      : "Sem ticket no cadastro da empresa, os valores por ação ficaram em zero: preencha antes de publicar."
  );

  return { campanha, fonte: "interno", explicacao: partes.join(" ") };
}

// Camada externa. Só roda com chave; qualquer falha cai no motor interno.
export async function sugerirCampanha({ empresa = {}, brief = "" }) {
  const base = sugerirInterno({ empresa, brief });
  if (!process.env.ANTHROPIC_API_KEY) return base;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    // Sem novas tentativas e com timeout: se o provedor falhar ou pendurar, o
    // catch abaixo devolve o rascunho do motor interno — a tela nunca fica presa.
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 45000 });

    const resposta = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 700,
      system:
        "Você traduz o pedido de uma empresa em configuração de campanha de vendas por comissão. " +
        `Responda APENAS um JSON com as chaves: objetivo (um de: ${ORDEM_OBJETIVOS.join(", ")}), ` +
        "titulo (curto), objetivoTexto (uma frase), publico (o cliente ideal descrito), regiao, descricao. " +
        "Não invente dado que não esteja no pedido nem no cadastro: campo sem informação vai como string vazia. " +
        "Não escreva valores em dinheiro — a plataforma calcula isso.",
      messages: [{
        role: "user",
        content: `Empresa: ${empresa.nome || "—"}\nProduto: ${empresa.produto || "—"}\n` +
                 `Ticket: ${empresa.ticket || "—"}\nCliente ideal: ${empresa.icp || "—"}\n\nPedido:\n${brief}`,
      }],
    });

    const texto = resposta.content.map((b) => b.text || "").join("");
    const json = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));

    // O objetivo devolvido precisa existir. Modelo que responde categoria
    // inventada não define a campanha: cai para o que o motor interno leu.
    const chave = OBJETIVOS[json.objetivo] ? json.objetivo : detectarObjetivo(brief);
    if (!chave) return base;

    const campanha = montarCampanha(chave, empresa);
    if (json.titulo) campanha.titulo = String(json.titulo).slice(0, 120);
    if (json.objetivoTexto) campanha.objetivo = String(json.objetivoTexto).slice(0, 200);
    if (json.publico) campanha.publico = String(json.publico).slice(0, 500);
    if (json.regiao) campanha.regiao = String(json.regiao).slice(0, 120);
    campanha.descricao = String(json.descricao || brief).slice(0, 600);

    return {
      campanha,
      fonte: "externo",
      explicacao: base.explicacao,
    };
  } catch (err) {
    console.error("[campanha] provedor externo indisponível, usando motor interno:", err.message);
    return base;
  }
}

// Canais de atendimento da empresa na aba Leads: WhatsApp (da empresa ou do
// vendedor) e Instagram. Regras puras, usadas pelo servidor, pela tela e pelos
// testes.

export const CANAIS = { whatsapp: "WhatsApp", instagram: "Instagram" };
export const JANELA_MS = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

export const LIMITE_TEXTO = { whatsapp: 4096, instagram: 1000 };

export const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

// Mesmo telefone com ou sem 55 e com ou sem o nono dígito. Compara DDD + os 8
// últimos dígitos; fora do Brasil, o número inteiro.
export function chaveTelefone(v) {
  let d = soDigitos(v).replace(/^0+/, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3);
  return d.length >= 8 ? d : "";
}
export const mesmoTelefone = (a, b) => { const x = chaveTelefone(a); return !!x && x === chaveTelefone(b); };

export const bytes = (t) => new TextEncoder().encode(String(t || "")).length;

// Texto livre só dentro de 24h da última mensagem do cliente (regra da Meta).
export const janelaAberta = (ultimaRecebidaEm, agora = Date.now()) =>
  (ultimaRecebidaEm && ultimaRecebidaEm + JANELA_MS > agora ? ultimaRecebidaEm + JANELA_MS : null);

// ── Auditoria pelo motor interno ──────────────────────────────────────────
//
// Só mede o que está na conversa. Sem mensagem suficiente, o critério fica
// "sem_dado" em vez de virar nota.

const PASSO = /\b(agend|reuni[aã]o|marcar|hor[aá]rio|proposta|or[cç]amento|pedido|contrato|link|pagamento|pix|boleto|visita|ligo|te chamo|retorno|amanh[aã]|segunda|ter[cç]a|quarta|quinta|sexta)/i;
const PERGUNTA = /\?/;
const OPOSICAO = /\b(caro|muito caro|sem dinheiro|desconto|vou pensar|pensar melhor|depois eu|n[aã]o tenho interesse|concorrente|j[aá] tenho|t[aá] dif[ií]cil)/i;

const minutos = (ms) => Math.max(0, Math.round(ms / MIN));
export function duracao(min) {
  if (min == null) return "";
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)}h${min % 60 ? `${String(min % 60).padStart(2, "0")}` : ""}`;
  const d = Math.floor(min / 1440);
  return `${d} dia${d > 1 ? "s" : ""}`;
}

export function medirConversa(mensagens, agora = Date.now()) {
  const msgs = [...mensagens].sort((a, b) => a.em - b.em);
  const recebidas = msgs.filter((m) => m.direcao === "recebida");
  const enviadas = msgs.filter((m) => m.direcao === "enviada");
  const esperas = [];
  let aberta = null;
  for (const m of msgs) {
    if (m.direcao === "recebida") aberta ||= m;
    else if (aberta) { esperas.push({ min: minutos(m.em - aberta.em), id: aberta.id }); aberta = null; }
  }
  const media = esperas.length ? Math.round(esperas.reduce((s, e) => s + e.min, 0) / esperas.length) : null;
  return {
    total: msgs.length, recebidas: recebidas.length, enviadas: enviadas.length,
    primeiraRespostaMin: esperas[0]?.min ?? null, mediaRespostaMin: media,
    semRespostaMin: aberta ? minutos(agora - aberta.em) : null,
    semRespostaId: aberta?.id || null,
    perguntasDoCliente: recebidas.filter((m) => PERGUNTA.test(m.texto || "")).map((m) => m.id),
    perguntasDoVendedor: enviadas.filter((m) => PERGUNTA.test(m.texto || "")).map((m) => m.id),
    objecoes: recebidas.filter((m) => OPOSICAO.test(m.texto || "")).map((m) => m.id),
    proximoPasso: enviadas.slice(-4).filter((m) => PASSO.test(m.texto || "")).map((m) => m.id),
  };
}

export const SITUACAO = { ok: "Atende", atencao: "Atenção", sem_dado: "Sem dado suficiente" };

export function criteriosInternos(m) {
  const c = (chave, nome, situacao, comentario, mensagens = []) => ({ chave, nome, situacao, comentario, mensagens });
  const lista = [];
  lista.push(m.primeiraRespostaMin == null
    ? c("primeira_resposta", "Primeira resposta", "sem_dado", "O cliente ainda não recebeu resposta para medir.")
    : c("primeira_resposta", "Primeira resposta", m.primeiraRespostaMin <= 15 ? "ok" : "atencao", `Respondeu em ${duracao(m.primeiraRespostaMin)}.`));
  lista.push(m.mediaRespostaMin == null
    ? c("tempo_medio", "Tempo médio de resposta", "sem_dado", "Ainda não há respostas para medir.")
    : c("tempo_medio", "Tempo médio de resposta", m.mediaRespostaMin <= 60 ? "ok" : "atencao", `Média de ${duracao(m.mediaRespostaMin)}.`));
  lista.push(m.semRespostaMin == null
    ? c("sem_resposta", "Cliente sem resposta", m.recebidas ? "ok" : "sem_dado", m.recebidas ? "Nenhuma mensagem do cliente ficou sem resposta." : "O cliente ainda não escreveu.")
    : c("sem_resposta", "Cliente sem resposta", m.semRespostaMin > 60 ? "atencao" : "ok", `Última mensagem do cliente espera resposta há ${duracao(m.semRespostaMin)}.`, m.semRespostaId ? [m.semRespostaId] : []));
  lista.push(m.enviadas < 2
    ? c("qualificacao", "Perguntas de qualificação", "sem_dado", "Poucas mensagens do vendedor para avaliar.")
    : c("qualificacao", "Perguntas de qualificação", m.perguntasDoVendedor.length >= 2 ? "ok" : "atencao", `O vendedor fez ${m.perguntasDoVendedor.length} pergunta(s).`, m.perguntasDoVendedor.slice(0, 3)));
  lista.push(m.enviadas < 2
    ? c("proximo_passo", "Próximo passo combinado", "sem_dado", "Poucas mensagens do vendedor para avaliar.")
    : c("proximo_passo", "Próximo passo combinado", m.proximoPasso.length ? "ok" : "atencao", m.proximoPasso.length ? "As últimas mensagens propõem um próximo passo." : "As últimas mensagens não propõem data, proposta, pedido ou retorno.", m.proximoPasso.slice(0, 2)));
  if (m.objecoes.length) lista.push(c("objecoes", "Objeções do cliente", "atencao", `${m.objecoes.length} mensagem(ns) com objeção. Confira se foram respondidas.`, m.objecoes.slice(0, 3)));
  return lista;
}

// "Atendidos: 3 de 4". Nunca uma nota solta: só conta o que deu para medir.
export function placar(criterios) {
  const medidos = criterios.filter((c) => c.situacao !== "sem_dado");
  return { atendidos: medidos.filter((c) => c.situacao === "ok").length, medidos: medidos.length };
}

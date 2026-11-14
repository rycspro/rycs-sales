// Etapa 4 do onboarding: a IA monta script, funil de WhatsApp e follow-ups.
//
// Roda fora do request, numa fila em tabela com um laço no próprio processo,
// como a fila de auditoria (services/audit/fila.js). Cada fase concluída fica
// salva: se uma falhar, "tentar de novo" continua de onde parou.
//
// Base de conhecimento ("RAG"), montada na fase de análise:
// 1. o perfil da etapa 2;
// 2. a ficha de cada material da etapa 3: apresentações, documentos, fotos,
//    vídeos e áudios, lidos por services/leituraMateriais.js;
// 3. as aulas do Academy da RYCS que mais combinam com o perfil e as fichas,
//    inteiras, escolhidas por services/rag.js (sem embeddings, como ficou em
//    docs/onboarding/DECISOES.md). O curso de WhatsApp tem prioridade, porque
//    o funil e os follow-ups são de WhatsApp.
// O script, o funil e os follow-ups aplicam essas estratégias ao caso da
// empresa.
//
// Dois motores, como na montagem de campanha: sem ANTHROPIC_API_KEY (o padrão
// da RYCS hoje), roda o motor interno (services/motorEstrategias.js), que não
// depende de provedor nenhum; com a chave, a Claude escreve. Os dois usam a
// mesma análise e nenhum inventa dado.

import Anthropic from "@anthropic-ai/sdk";
import db, { uid, agora } from "../db.js";
import { escolherAulas } from "./rag.js";
import { lerMaterial, LEITURA_VERSAO } from "./leituraMateriais.js";
import { montarEstrategias } from "./motorEstrategias.js";
import { FASES_GERACAO, proximaFase, normalizarParte, PERMISSOES_MARCA, normalizarPermissoes, formatarWhatsapp } from "../../shared/onboarding.js";

const MODELO = process.env.IA_ONBOARDING_MODELO || "claude-opus-5";
const INTERVALO_MS = 3000;
// Teto de espera por chamada à IA. Sem isso, um provedor que pendura deixa a
// geração presa em "processando" para sempre — e a tela do onboarding fica
// rodando sem fim. Esgotou o tempo: cai no motor interno da RYCS.
const IA_TIMEOUT_MS = 60000;
const MAX_TEXTO_MATERIAIS = 80000;
const MAX_FOTOS_LIDAS = 20;

export const iaDisponivel = () => !!process.env.ANTHROPIC_API_KEY;
export const motorAtual = () => (iaDisponivel() ? "claude" : "interno");

const ler = (json, padrao) => { try { return JSON.parse(json || ""); } catch { return padrao; } };

export function geracaoAtual(companyId) {
  return db.prepare("SELECT * FROM ia_geracoes WHERE companyId = ? AND status != 'substituida' ORDER BY versao DESC LIMIT 1").get(companyId) || null;
}

export function serializarGeracao(g) {
  if (!g) return null;
  return {
    id: g.id, versao: g.versao, status: g.status, erro: g.erro || "",
    fases: ler(g.fases, {}), conteudo: ler(g.conteudo, {}), aprovacoes: ler(g.aprovacoes, {}),
    pedidoAjuste: g.pedidoAjuste || "", aprovadoEm: g.aprovadoEm || null,
  };
}

// Nova versão. Um pedido de ajuste reaproveita a análise da versão anterior
// (os materiais não mudaram) e refaz o resto com o pedido junto.
export function criarGeracao(companyId, { pedidoAjuste = "" } = {}) {
  const anterior = geracaoAtual(companyId);
  const t = agora();
  const id = uid();
  db.transaction(() => {
    if (anterior) db.prepare("UPDATE ia_geracoes SET status = 'substituida', atualizadoEm = ? WHERE id = ?").run(t, anterior.id);
    const versao = (db.prepare("SELECT MAX(versao) v FROM ia_geracoes WHERE companyId = ?").get(companyId).v || 0) + 1;
    const reaproveita = pedidoAjuste && anterior?.contexto;
    db.prepare(`INSERT INTO ia_geracoes (id, companyId, versao, status, fases, contexto, pedidoAjuste, criadoEm, atualizadoEm)
                VALUES (?, ?, ?, 'pendente', ?, ?, ?, ?, ?)`)
      .run(id, companyId, versao, JSON.stringify(reaproveita ? { analise: "concluida" } : {}),
        reaproveita ? anterior.contexto : "", String(pedidoAjuste).slice(0, 2000), t, t);
  })();
  return db.prepare("SELECT * FROM ia_geracoes WHERE id = ?").get(id);
}

export function tentarDeNovo(companyId) {
  const g = geracaoAtual(companyId);
  if (!g || g.status !== "falhou") return null;
  db.prepare("UPDATE ia_geracoes SET status = 'pendente', erro = '', atualizadoEm = ? WHERE id = ?").run(agora(), g.id);
  return db.prepare("SELECT * FROM ia_geracoes WHERE id = ?").get(g.id);
}

// ---------------------------------------------------------------------------
// Fase 1: análise. Extrai o texto dos materiais e monta o contexto.

// Pedido de leitura à Claude (fotos, PDFs, quadros de vídeo, textos longos).
const LEITOR = `Você lê materiais enviados por uma empresa e escreve, em português do Brasil, anotações para um estrategista comercial.
Registre só o que está no material. Não invente números, preços, clientes nem resultados.`;

async function descrever(blocos, pedido) {
  // Blindado: se a IA falhar ou estourar o timeout, devolve vazio em vez de
  // derrubar a fase de análise. O material entra só pelo nome, e a geração segue.
  try {
    const resposta = await claude().beta.messages.create({
      model: MODELO,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: LEITOR,
      messages: [{ role: "user", content: [...blocos, { type: "text", text: pedido }] }],
    });
    return resposta.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  } catch (e) {
    console.warn(`[ia-onboarding] leitura de material falhou (${e.message}); seguindo sem a descrição.`);
    return "";
  }
}

function estrategiasRycs(base) {
  const aulas = db.prepare(`SELECT l.id, l.titulo, c.titulo AS curso, l.conteudo
    FROM course_lessons l JOIN courses c ON c.id = l.courseId
    WHERE c.status = 'publicado' AND l.conteudo != ''
    ORDER BY c.ordem, l.ordem`).all();
  return escolherAulas(base, aulas, { prioridade: [/whats/i] });
}

async function faseAnalise(g) {
  const e = db.prepare("SELECT * FROM companies WHERE id = ?").get(g.companyId);
  const permissoes = normalizarPermissoes(ler(e.permissoesMarca, {}));
  const materiais = db.prepare("SELECT * FROM academy_materiais WHERE companyId = ? ORDER BY criadoEm").all(g.companyId);

  // Lê o que ainda não foi lido por esta versão do leitor.
  let fotos = 0;
  for (const m of materiais) {
    if (m.categoria === "link") continue;
    if (m.categoria === "foto" && ++fotos > MAX_FOTOS_LIDAS) continue;
    // Lido por esta versão do leitor, deu certo ou não: não tenta de novo.
    if ((m.leituraVersao || 0) >= LEITURA_VERSAO) continue;
    const r = await lerMaterial(m, { descrever: iaDisponivel() ? descrever : null });
    db.prepare("UPDATE academy_materiais SET statusIndexacao = ?, textoExtraido = ?, leitura = ?, leituraVersao = ? WHERE id = ?")
      .run(r.status, r.texto, r.leitura, LEITURA_VERSAO, m.id);
    Object.assign(m, { statusIndexacao: r.status, textoExtraido: r.texto, leitura: r.leitura });
  }

  const textos = [];
  let total = 0;
  for (const m of materiais) {
    if (!m.textoExtraido || total >= MAX_TEXTO_MATERIAIS) continue;
    const trecho = m.textoExtraido.slice(0, MAX_TEXTO_MATERIAIS - total);
    total += trecho.length;
    textos.push(`### ${m.nome} (${m.categoria})\n${trecho}`);
  }
  const links = materiais.filter((m) => m.categoria === "link").map((m) => `- ${m.url}`);
  const naoLidos = materiais.filter((m) => m.categoria !== "link" && !m.textoExtraido).map((m) => `- ${m.nome} (${m.categoria})`);

  const base = [e.produto, e.icp, e.nicho, e.segmento, e.diferenciais, ...textos,
    "whatsapp follow-up abertura objeções qualificação oferta fechamento"].join(" ");
  const estrategias = estrategiasRycs(base);

  const contexto = [
    "## Perfil da empresa",
    `Nome: ${e.nome}`,
    `Produto e serviço: ${e.produto || "(não informado)"}`,
    `Ticket médio: ${e.ticket || "(não informado)"}`,
    `Nicho: ${e.nicho || e.segmento || "(não informado)"}`,
    `Diferencial: ${e.diferenciais || "(não informado)"}`,
    `Público: ${e.icp || "(não informado)"}`,
    `Regras da marca: ${e.regrasMarca || "(nenhuma)"}`,
    "Permissões (o que a IA pode fazer sozinha):",
    ...PERMISSOES_MARCA.map((p) => `- ${p.label}: ${permissoes[p.chave] ? "SIM" : "NÃO"}`),
    `Contato de suporte: ${[e.suporteNome, formatarWhatsapp(e.suporteWhatsapp), e.suporteEmail].filter(Boolean).join(" · ") || "(não informado)"}`,
    "",
    "## Materiais enviados pela empresa",
    textos.length ? textos.join("\n\n") : "(nenhum material lido)",
    links.length ? `\nLinks informados:\n${links.join("\n")}` : "",
    naoLidos.length ? `\nArquivos que não puderam ser lidos (use só o nome como pista):\n${naoLidos.join("\n")}` : "",
    "",
    "## Estratégias de vendas do Academy da RYCS",
    estrategias.length ? estrategias.map((a) => `### ${a.curso} — ${a.titulo}\n${a.conteudo}`).join("\n\n") : "(nenhuma aula relevante encontrada)",
  ].filter((l) => l !== "").join("\n");

  db.prepare("UPDATE ia_geracoes SET contexto = ? WHERE id = ?").run(contexto, g.id);
  return contexto;
}

// ---------------------------------------------------------------------------
// Fases 2 a 4: geração com a Claude, saída validada por JSON Schema.

const texto = { type: "string" };
const objeto = (campos) => ({ type: "object", properties: Object.fromEntries(campos.map((c) => [c, texto])), required: campos, additionalProperties: false });

const PEDIDOS = {
  script: {
    instrucao: "Escreva o script de vendas em quatro partes: abertura, qualificação, oferta e fechamento. Cada parte é o texto que o vendedor fala ou envia, com as perguntas e frases prontas.",
    schema: objeto(["abertura", "qualificacao", "oferta", "fechamento"]),
  },
  funil: {
    instrucao: "Escreva as estratégias do funil de WhatsApp: boas-vindas, qualificação, oferta, objeções e fechamento. Em cada etapa, uma frase de mensagem pronta para enviar, seguida, se necessário, de uma linha curta sobre quando usá-la.",
    schema: objeto(["boasVindas", "qualificacao", "oferta", "objecoes", "fechamento"]),
  },
  followups: {
    instrucao: "Escreva a sequência de follow-ups para quem parou de responder: de 3 a 6 mensagens, cada uma com o momento de envio (ex.: \"Após 1 hora\", \"Após 1 dia\", \"Após 3 dias\") e o texto da mensagem.",
    schema: {
      type: "object",
      properties: { followups: { type: "array", items: objeto(["quando", "mensagem"]) } },
      required: ["followups"], additionalProperties: false,
    },
  },
};

const SISTEMA = `Você é estrategista comercial da RYCS e escreve materiais de vendas em português do Brasil para uma empresa cliente.
Regras:
- Monte cada parte aplicando as estratégias do Academy da RYCS ao caso da empresa: siga as técnicas das aulas (abertura, qualificação, tratamento de objeções, fechamento, cadência de follow-up) e preencha com o que os materiais da empresa mostram (oferta, provas, público, tom).
- Use apenas o que está no perfil, nos materiais e no Academy da RYCS. Não invente números, preços, prazos, garantias, prêmios ou clientes.
- Respeite as regras da marca e as permissões. Se a permissão estiver "NÃO", a mensagem não faz aquilo: encaminha ao contato de suporte.
- Escreva no tom da marca, direto e humano, como uma pessoa escreveria no WhatsApp.
- Use as variáveis {nome}, {empresa}, {produto}, {ticket}, {diferencial} e {contato de suporte} onde couber, exatamente com essa grafia. {ticket} só aparece se informar preços for permitido.
- Quando faltar informação, escreva de forma que funcione sem ela, sem preencher a lacuna com suposição.`;

let cliente = null;
// Sem novas tentativas e com timeout: se a integração falhar OU pendurar, o
// motor interno assume — a geração nunca fica presa esperando o provedor.
const claude = () => (cliente ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: IA_TIMEOUT_MS }));

async function gerarParte(parte, contexto, pedidoAjuste, anteriores) {
  if (!iaDisponivel()) throw new Error("A IA não está configurada neste ambiente da RYCS.");
  const pedido = PEDIDOS[parte];
  const partes = [
    contexto,
    Object.keys(anteriores).length ? `\n## Já definido nesta geração (mantenha coerência)\n${JSON.stringify(anteriores)}` : "",
    pedidoAjuste ? `\n## Pedido de ajuste do dono da empresa\n${pedidoAjuste}` : "",
    `\n## Tarefa\n${pedido.instrucao}`,
  ];
  const resposta = await claude().beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: pedido.schema } },
    system: SISTEMA,
    messages: [{ role: "user", content: partes.join("\n") }],
  });
  if (resposta.stop_reason === "refusal") throw new Error("A IA não conseguiu gerar este conteúdo. Revise o perfil e tente de novo.");
  if (resposta.stop_reason === "max_tokens") throw new Error("A resposta da IA ficou incompleta. Tente de novo.");
  const bloco = resposta.content.find((b) => b.type === "text");
  const json = JSON.parse(bloco?.text || "");
  const conteudo = normalizarParte(parte, parte === "followups" ? json.followups : json);
  if (!conteudo || (parte === "followups" && !conteudo.length)) throw new Error("A IA devolveu um conteúdo vazio. Tente de novo.");
  return conteudo;
}

// ---------------------------------------------------------------------------
// Motor interno: as três partes de uma vez, a partir do que a análise leu.

function estrategiasInternas(g) {
  const e = db.prepare("SELECT * FROM companies WHERE id = ?").get(g.companyId);
  const materiais = db.prepare("SELECT nome, categoria, textoExtraido AS texto FROM academy_materiais WHERE companyId = ? AND textoExtraido != '' ORDER BY criadoEm").all(g.companyId);
  const base = [e.produto, e.icp, e.nicho, e.segmento, e.diferenciais, ...materiais.map((m) => m.texto),
    "whatsapp follow-up abertura objeções qualificação oferta fechamento"].join(" ");
  return montarEstrategias({
    empresa: e, permissoes: normalizarPermissoes(ler(e.permissoesMarca, {})),
    materiais, aulas: estrategiasRycs(base), pedidoAjuste: g.pedidoAjuste,
  });
}

// ---------------------------------------------------------------------------
// Fila

function reivindicar() {
  return db.transaction(() => {
    const g = db.prepare("SELECT * FROM ia_geracoes WHERE status = 'pendente' ORDER BY criadoEm LIMIT 1").get();
    if (!g) return null;
    db.prepare("UPDATE ia_geracoes SET status = 'processando', tentativas = tentativas + 1, atualizadoEm = ? WHERE id = ?").run(agora(), g.id);
    return g;
  })();
}

export async function processarProxima() {
  const g = reivindicar();
  if (!g) return null;
  const fases = ler(g.fases, {});
  const conteudo = ler(g.conteudo, {});
  let contexto = g.contexto;
  let interno = null;
  let usarClaude = iaDisponivel();
  const salvarFase = (fase, estado) => {
    fases[fase] = estado;
    db.prepare("UPDATE ia_geracoes SET fases = ?, conteudo = ?, atualizadoEm = ? WHERE id = ?")
      .run(JSON.stringify(fases), JSON.stringify(conteudo), agora(), g.id);
  };
  try {
    for (let fase = proximaFase(fases); fase; fase = proximaFase(fases)) {
      salvarFase(fase, "atual");
      if (fase === "analise") contexto = await faseAnalise(g);
      else if (usarClaude && (conteudo[fase] = await gerarParte(fase, contexto, g.pedidoAjuste, Object.fromEntries(FASES_GERACAO.filter((f) => conteudo[f]).map((f) => [f, conteudo[f]])))
        .catch((e) => {
          // Integração externa falhou: não insiste. Esta e as próximas partes
          // saem pelo motor interno da RYCS.
          console.warn(`[ia-onboarding] Claude falhou na fase ${fase} (${e.message}); seguindo com o motor interno.`);
          usarClaude = false;
          return null;
        }))) { /* gerado pela Claude */ }
      else {
        interno ||= estrategiasInternas(g);
        conteudo[fase] = normalizarParte(fase, interno[fase]);
        conteudo.fontes = interno.fontes;
        conteudo.aviso = interno.ajusteEntendido === false
          ? "O motor da RYCS não entendeu esse pedido de ajuste. Para mudar o conteúdo, edite o texto direto." : "";
      }
      conteudo.motor = usarClaude ? "claude" : "interno";
      salvarFase(fase, "concluida");
    }
    db.prepare("UPDATE ia_geracoes SET status = 'pronta', aprovacoes = '{}', atualizadoEm = ? WHERE id = ?").run(agora(), g.id);
    return { id: g.id, status: "pronta" };
  } catch (e) {
    const fase = proximaFase(fases);
    if (fase) fases[fase] = "falhou";
    const mensagem = e instanceof SyntaxError ? "A IA devolveu um formato inesperado. Tente de novo." : String(e.message || "Falha ao gerar.").slice(0, 300);
    db.prepare("UPDATE ia_geracoes SET status = 'falhou', erro = ?, fases = ?, conteudo = ?, atualizadoEm = ? WHERE id = ?")
      .run(mensagem, JSON.stringify(fases), JSON.stringify(conteudo), agora(), g.id);
    console.warn(`[ia-onboarding] geração ${g.id} falhou na fase ${fase}: ${mensagem}`);
    return { id: g.id, status: "falhou", erro: mensagem };
  }
}

let ocupado = false;
export function iniciarWorkerIA() {
  // Quem estava processando quando o processo caiu volta para a fila.
  db.prepare("UPDATE ia_geracoes SET status = 'pendente' WHERE status = 'processando'").run();
  setInterval(async () => {
    if (ocupado) return;
    ocupado = true;
    try { while (await processarProxima()); } catch (e) { console.error("[ia-onboarding] worker:", e.message); }
    ocupado = false;
  }, INTERVALO_MS).unref?.();
  console.log(`[ia-onboarding] worker ativo (${iaDisponivel() ? MODELO : "motor interno da RYCS"})`);
}

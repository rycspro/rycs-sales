// API de Conversões da Meta para a própria RYCS (anúncios de cadastro).
//
// O cadastro sai do navegador (pixel) e do servidor com o mesmo event_id; a
// Meta junta os dois em um. Pelo servidor o evento chega mesmo com bloqueador
// de anúncios e leva dados de correspondência (e-mail, telefone, nome, cidade
// — sempre em hash SHA-256), o que melhora a atribuição do anúncio.
//
// Depois do cadastro, os marcos da jornada (shared/jornada.js) viram eventos
// de qualidade — e-mail confirmado, perfil completo, candidatura, depósito —
// para a campanha poder otimizar por cadastro bom, não só por cadastro.
//
// Só para quem aceitou cookies de marketing. Sem META_CAPI_TOKEN nada é
// enviado. Variáveis: META_CAPI_TOKEN, META_PIXEL_ID (opcional, padrão em
// shared/metaPixel.js), META_TEST_EVENT_CODE (opcional, aba "Eventos de
// teste" do Gerenciador de Eventos) e META_GRAPH_VERSION (opcional).

import { createHash, randomUUID } from "crypto";
import db, { agora } from "../db.js";
import { urlApp } from "./email.js";
import { jornadasVendedores, jornadasEmpresas } from "./jornada.js";
import { META_PIXEL_ID, COOKIE_CONSENTIMENTO, CONSENTIU, CATEGORIA_META, camposCorrespondencia } from "../../shared/metaPixel.js";

export { normalizarTelefone } from "../../shared/metaPixel.js";

const DIA = 24 * 60 * 60 * 1000;
// A Meta recusa evento de site com mais de 7 dias.
const JANELA_META = 7 * DIA;
// Dados de correspondência guardados só pelo tempo de colher os marcos.
const RETENCAO = 30 * DIA;
const MAX_TENTATIVAS = 5;
const ID_EVENTO = /^[A-Za-z0-9_-]{8,64}$/;
const COOKIE_FB = /^fb\.\d\.\d{10,13}\.[A-Za-z0-9_.-]{1,500}$/;

db.exec(`
  CREATE TABLE IF NOT EXISTS meta_contatos (
    userId TEXT PRIMARY KEY,
    papel TEXT NOT NULL,
    entityId TEXT NOT NULL,
    dados TEXT NOT NULL DEFAULT '{}',
    criadoEm INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meta_eventos (
    userId TEXT NOT NULL,
    evento TEXT NOT NULL,
    eventId TEXT NOT NULL,
    status TEXT NOT NULL,
    tentativas INTEGER NOT NULL DEFAULT 0,
    erro TEXT NOT NULL DEFAULT '',
    atualizadoEm INTEGER NOT NULL,
    PRIMARY KEY (userId, evento)
  );
`);

// Marcos da jornada → eventos na Meta. SubmitApplication e Purchase são
// eventos padrão; os outros são personalizados (viram conversão
// personalizada no Gerenciador de Eventos).
export const EVENTOS_QUALIDADE = {
  vendedor: [
    { marco: "email", evento: "EmailConfirmado" },
    { marco: "perfil", evento: "PerfilCompleto" },
    { marco: "candidatura", evento: "SubmitApplication" },
    { marco: "aprovado", evento: "AprovadoEmCampanha" },
  ],
  empresa: [
    { marco: "email", evento: "EmailConfirmado" },
    { marco: "plano", evento: "PlanoEscolhido" },
    { marco: "publicada", evento: "CampanhaPublicada" },
    { marco: "saldo", evento: "Purchase" },
  ],
};

export const capiAtiva = () => !!process.env.META_CAPI_TOKEN;

const json = (texto) => { try { return JSON.parse(texto || "{}") || {}; } catch { return {}; } };
const sha = (v) => createHash("sha256").update(v).digest("hex");
const ID_VISITANTE = /^[A-Za-z0-9_-]{8,64}$/;

// Dados de correspondência no formato da Meta: normalizados e em SHA-256.
// external_id leva o id da conta e o do visitante: a Meta liga os passos de
// antes do cadastro (ViewContent, EtapaCadastro) à conta criada.
export function dadosCorrespondencia({ userId, visitanteId, ...dados } = {}) {
  const campos = camposCorrespondencia({ ...dados, idsExternos: [userId, visitanteId] });
  return Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, (Array.isArray(v) ? v : [v]).map(sha)]));
}

export function montarEvento({ nome, eventId, tempoMs, dados, customData }) {
  return {
    event_name: nome,
    event_time: Math.floor(tempoMs / 1000),
    event_id: eventId,
    action_source: "website",
    event_source_url: dados.url || urlApp(),
    user_data: dados.userData || {},
    ...(customData && { custom_data: customData }),
  };
}

async function postar(evento) {
  const versao = process.env.META_GRAPH_VERSION || "v23.0";
  const pixel = process.env.META_PIXEL_ID || META_PIXEL_ID;
  const corpo = { data: [evento], access_token: process.env.META_CAPI_TOKEN };
  if (process.env.META_TEST_EVENT_CODE) corpo.test_event_code = process.env.META_TEST_EVENT_CODE;
  const r = await fetch(`https://graph.facebook.com/${versao}/${pixel}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text().catch(() => "")).slice(0, 300)}`);
}

// Cada evento sai uma vez por usuário; falha é tentada de novo na próxima rodada.
// `chave` separa eventos de mesmo nome (EtapaCadastro:contato, :perfil…).
async function enviarUmaVez(contato, nome, { eventId, tempoMs, customData, chave = nome }) {
  if (!capiAtiva()) return false;
  const ant = db.prepare("SELECT eventId, status, tentativas FROM meta_eventos WHERE userId = ? AND evento = ?").get(contato.userId, chave);
  if (ant && (ant.status !== "erro" || ant.tentativas >= MAX_TENTATIVAS)) return false;
  const id = ant?.eventId || eventId || randomUUID();
  const tentativas = (ant?.tentativas || 0) + 1;
  db.prepare(`INSERT INTO meta_eventos (userId, evento, eventId, status, tentativas, atualizadoEm) VALUES (?, ?, ?, 'enviando', ?, ?)
    ON CONFLICT(userId, evento) DO UPDATE SET status = 'enviando', tentativas = excluded.tentativas, atualizadoEm = excluded.atualizadoEm`)
    .run(contato.userId, chave, id, tentativas, agora());
  try {
    await postar(montarEvento({ nome, eventId: id, tempoMs, dados: contato.dados, customData }));
    db.prepare("UPDATE meta_eventos SET status = 'enviado', erro = '', atualizadoEm = ? WHERE userId = ? AND evento = ?").run(agora(), contato.userId, chave);
    return true;
  } catch (e) {
    db.prepare("UPDATE meta_eventos SET status = 'erro', erro = ?, atualizadoEm = ? WHERE userId = ? AND evento = ?")
      .run(String(e?.message || e).slice(0, 300), agora(), contato.userId, chave);
    console.error(`[meta-capi] ${nome}:`, e?.message);
    return false;
  }
}

const cookieFb = (v) => (typeof v === "string" && COOKIE_FB.test(v) ? v : "");

// Sem o cookie _fbc (o visitante só aceitou cookies depois do clique), monta o
// fbc a partir do fbclid guardado no primeiro toque.
function fbcDoClique(origem, visitanteId, padraoMs) {
  const fbclid = json(typeof origem === "string" ? origem : JSON.stringify(origem || {})).fbclid;
  if (!fbclid) return "";
  const v = visitanteId && db.prepare("SELECT primeiroEm FROM jornada_visitantes WHERE visitanteId = ?").get(visitanteId);
  return cookieFb(`fb.1.${v?.primeiroEm || padraoMs}.${fbclid}`);
}

const metaDoCorpo = (corpo) => (corpo?.meta && typeof corpo.meta === "object" ? corpo.meta : {});
const consentiu = (req, meta) => meta.consentimento === true || req.cookies?.[COOKIE_CONSENTIMENTO] === CONSENTIU;
const urlCadastro = (papel) => `${urlApp()}/cadastro/${papel === "vendedor" ? "profissional" : "empresa"}`;

// O que o navegador traz para a correspondência: IP, navegador e cookies da Meta.
function sinaisNavegador(req, meta, fbcReserva = "") {
  const fbp = cookieFb(meta.fbp) || cookieFb(req.cookies?._fbp);
  const fbc = cookieFb(meta.fbc) || cookieFb(req.cookies?._fbc) || fbcReserva;
  const ip = String(req.ip || "").replace(/^::ffff:/, "");
  const ua = String(req.get?.("user-agent") || "").slice(0, 500);
  return {
    ...(ip && { client_ip_address: ip }),
    ...(ua && { client_user_agent: ua }),
    ...(fbp && { fbp }),
    ...(fbc && { fbc }),
  };
}

// Passos antes da conta (abriu o cadastro, passou de etapa): saem também pelo
// servidor, com o mesmo event_id do pixel, uma vez por visitante e passo.
const PASSOS_META = { cadastro_aberto: "ViewContent", cadastro_etapa: "EtapaCadastro" };

export function registrarPassoMeta(req, corpo = {}) {
  try {
    const nome = PASSOS_META[corpo.evento];
    const categoria = CATEGORIA_META[corpo.papel];
    const meta = metaDoCorpo(corpo);
    const visitanteId = String(corpo.visitanteId || "");
    if (!capiAtiva() || !nome || !categoria || !ID_VISITANTE.test(visitanteId) || !ID_EVENTO.test(String(meta.eventId || "")) || !consentiu(req, meta)) return;
    const etapa = nome === "EtapaCadastro" ? String(corpo.etapa || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) : "";
    if (nome === "EtapaCadastro" && !etapa) return;
    const userData = {
      ...dadosCorrespondencia({ visitanteId }),
      ...sinaisNavegador(req, meta, fbcDoClique(corpo.origem, visitanteId, agora())),
    };
    const customData = nome === "ViewContent"
      ? { content_name: `Cadastro ${categoria}`, content_category: categoria }
      : { content_category: categoria, etapa };
    enviarUmaVez({ userId: `v:${visitanteId}`, dados: { userData, url: urlCadastro(corpo.papel) } }, nome, {
      eventId: meta.eventId, tempoMs: agora(), customData, chave: etapa ? `${nome}:${etapa}` : nome,
    }).catch(() => null);
  } catch (e) {
    console.error("[meta-capi] passo:", e?.message);
  }
}

// Chamado logo depois de criar a conta (e de vincularVisitante).
export function registrarCadastroMeta(req, userId, papel) {
  try {
    const corpo = req.body || {};
    const meta = metaDoCorpo(corpo);
    // Sem token nada sai, então nada é guardado.
    if (!capiAtiva() || !consentiu(req, meta) || !CATEGORIA_META[papel]) return;
    const user = db.prepare("SELECT entityId, origem, visitanteId, criadoEm FROM users WHERE id = ?").get(userId);
    if (!user) return;

    const pessoa = papel === "vendedor";
    const userData = {
      ...dadosCorrespondencia({
        email: corpo.email, telefone: corpo.whats, pais: corpo.pais || "BR", userId, visitanteId: user.visitanteId,
        nome: pessoa ? corpo.nome : "", cidade: pessoa ? corpo.cidade : "", estado: pessoa ? corpo.estado : "",
        nascimento: pessoa ? corpo.dataNascimento : "", genero: pessoa ? corpo.genero : "",
      }),
      ...sinaisNavegador(req, meta, fbcDoClique(user.origem, user.visitanteId, user.criadoEm)),
    };
    const dados = { userData, url: urlCadastro(papel) };
    db.prepare("INSERT OR IGNORE INTO meta_contatos (userId, papel, entityId, dados, criadoEm) VALUES (?, ?, ?, ?, ?)")
      .run(userId, papel, user.entityId, JSON.stringify(dados), agora());

    const eventId = ID_EVENTO.test(String(meta.eventId || "")) ? meta.eventId : undefined;
    enviarUmaVez({ userId, dados }, "CompleteRegistration", {
      eventId, tempoMs: agora(),
      customData: { content_category: CATEGORIA_META[papel], content_name: `Cadastro ${CATEGORIA_META[papel]}`, status: "conta_criada" },
    }).catch(() => null);
  } catch (e) {
    console.error("[meta-capi] cadastro:", e?.message);
  }
}

function primeiroDeposito(companyId) {
  return db.prepare(`
    SELECT d.valor, COALESCE(NULLIF(d.moeda, ''), NULLIF(c.moeda, ''), 'BRL') AS moeda
    FROM deposit_requests d JOIN companies c ON c.id = d.companyId
    WHERE d.companyId = ? AND d.status = 'confirmado' ORDER BY COALESCE(d.confirmadoEm, d.criadoEm) LIMIT 1
  `).get(companyId);
}

let ocupado = false;

export async function rodadaQualidade(t = agora()) {
  if (ocupado || !capiAtiva()) return;
  ocupado = true;
  try {
    db.prepare("DELETE FROM meta_contatos WHERE criadoEm < ?").run(t - RETENCAO);
    db.prepare("DELETE FROM meta_eventos WHERE userId LIKE 'v:%' AND atualizadoEm < ?").run(t - RETENCAO);
    const contatos = db.prepare("SELECT * FROM meta_contatos").all();
    if (!contatos.length) return;
    const desde = Math.min(...contatos.map((c) => c.criadoEm)) - DIA;
    const marcos = { vendedor: new Map(), empresa: new Map() };
    if (contatos.some((c) => c.papel === "vendedor")) for (const j of jornadasVendedores(desde)) marcos.vendedor.set(j.id, j.marcos);
    if (contatos.some((c) => c.papel === "empresa")) for (const j of jornadasEmpresas(desde)) marcos.empresa.set(j.id, j.marcos);

    for (const c of contatos) {
      const m = marcos[c.papel]?.get(c.entityId);
      if (!m) continue;
      const contato = { userId: c.userId, dados: json(c.dados) };
      for (const q of EVENTOS_QUALIDADE[c.papel] || []) {
        const marco = m[q.marco];
        if (!marco) continue;
        // `true` = feito sem data conhecida: vale o momento em que foi visto.
        const tempoMs = typeof marco === "number" ? marco : t;
        if (t - tempoMs > JANELA_META) continue;
        let customData = { content_category: CATEGORIA_META[c.papel] };
        if (q.evento === "Purchase") {
          const dep = primeiroDeposito(c.entityId);
          if (!dep?.valor) continue;
          customData = { ...customData, value: Number(dep.valor), currency: dep.moeda || "BRL" };
        }
        await enviarUmaVez(contato, q.evento, { tempoMs, customData });
      }
    }
  } finally {
    ocupado = false;
  }
}

export function iniciarConversoesMeta() {
  if (!capiAtiva()) return;
  const tick = () => rodadaQualidade().catch((e) => console.error("[meta-capi] rodada:", e?.message));
  setTimeout(tick, 90 * 1000).unref?.();
  setInterval(tick, 10 * 60 * 1000).unref?.();
  console.log("[meta-capi] API de Conversões ativa");
}

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
import { META_PIXEL_ID, COOKIE_CONSENTIMENTO, CONSENTIU, CATEGORIA_META } from "../../shared/metaPixel.js";

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
const letras = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

// Telefone com DDI, só dígitos. Número brasileiro sem DDI ganha o 55.
export function normalizarTelefone(valor, pais = "BR") {
  let d = String(valor ?? "").replace(/\D/g, "");
  if (String(pais || "BR").toUpperCase() === "BR" && (d.length === 10 || d.length === 11)) d = `55${d}`;
  return d.length >= 8 && d.length <= 15 ? d : "";
}

// AAAAMMDD, a partir de "AAAA-MM-DD" ou "DD/MM/AAAA".
function normalizarNascimento(valor) {
  const v = String(valor ?? "").trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}${m[2]}${m[1]}` : "";
}

function normalizarGenero(valor) {
  const v = letras(valor);
  if (v.startsWith("fem")) return "f";
  if (v.startsWith("masc")) return "m";
  return "";
}

// Dados de correspondência no formato da Meta: normalizados e em SHA-256.
export function dadosCorrespondencia({ email, telefone, nome, cidade, estado, pais, nascimento, genero, userId } = {}) {
  const ud = {};
  const incluir = (chave, valor) => { if (valor) ud[chave] = [sha(valor)]; };
  incluir("em", String(email ?? "").trim().toLowerCase());
  incluir("ph", normalizarTelefone(telefone, pais));
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length) incluir("fn", letras(partes[0]));
  if (partes.length > 1) incluir("ln", letras(partes.at(-1)));
  // O cadastro manda "Cidade, UF" no Brasil.
  incluir("ct", letras(String(cidade ?? "").split(",")[0]));
  const uf = letras(estado);
  if (uf.length === 2) incluir("st", uf);
  const p = letras(pais);
  if (p.length === 2) incluir("country", p);
  incluir("db", normalizarNascimento(nascimento));
  incluir("ge", normalizarGenero(genero));
  incluir("external_id", userId ? String(userId) : "");
  return ud;
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
async function enviarUmaVez(contato, nome, { eventId, tempoMs, customData }) {
  if (!capiAtiva()) return false;
  const ant = db.prepare("SELECT eventId, status, tentativas FROM meta_eventos WHERE userId = ? AND evento = ?").get(contato.userId, nome);
  if (ant && (ant.status !== "erro" || ant.tentativas >= MAX_TENTATIVAS)) return false;
  const id = ant?.eventId || eventId || randomUUID();
  const tentativas = (ant?.tentativas || 0) + 1;
  db.prepare(`INSERT INTO meta_eventos (userId, evento, eventId, status, tentativas, atualizadoEm) VALUES (?, ?, ?, 'enviando', ?, ?)
    ON CONFLICT(userId, evento) DO UPDATE SET status = 'enviando', tentativas = excluded.tentativas, atualizadoEm = excluded.atualizadoEm`)
    .run(contato.userId, nome, id, tentativas, agora());
  try {
    await postar(montarEvento({ nome, eventId: id, tempoMs, dados: contato.dados, customData }));
    db.prepare("UPDATE meta_eventos SET status = 'enviado', erro = '', atualizadoEm = ? WHERE userId = ? AND evento = ?").run(agora(), contato.userId, nome);
    return true;
  } catch (e) {
    db.prepare("UPDATE meta_eventos SET status = 'erro', erro = ?, atualizadoEm = ? WHERE userId = ? AND evento = ?")
      .run(String(e?.message || e).slice(0, 300), agora(), contato.userId, nome);
    console.error(`[meta-capi] ${nome}:`, e?.message);
    return false;
  }
}

const cookieFb = (v) => (typeof v === "string" && COOKIE_FB.test(v) ? v : "");

// Sem o cookie _fbc (o visitante só aceitou cookies depois do clique), monta o
// fbc a partir do fbclid guardado no primeiro toque.
function fbcDoClique(user) {
  const fbclid = json(user.origem).fbclid;
  if (!fbclid) return "";
  const v = user.visitanteId && db.prepare("SELECT primeiroEm FROM jornada_visitantes WHERE visitanteId = ?").get(user.visitanteId);
  return cookieFb(`fb.1.${v?.primeiroEm || user.criadoEm}.${fbclid}`);
}

// Chamado logo depois de criar a conta (e de vincularVisitante).
export function registrarCadastroMeta(req, userId, papel) {
  try {
    const corpo = req.body || {};
    const meta = corpo.meta && typeof corpo.meta === "object" ? corpo.meta : {};
    const consentiu = meta.consentimento === true || req.cookies?.[COOKIE_CONSENTIMENTO] === CONSENTIU;
    // Sem token nada sai, então nada é guardado.
    if (!capiAtiva() || !consentiu || !CATEGORIA_META[papel]) return;
    const user = db.prepare("SELECT entityId, origem, visitanteId, criadoEm FROM users WHERE id = ?").get(userId);
    if (!user) return;

    const fbp = cookieFb(meta.fbp) || cookieFb(req.cookies?._fbp);
    const fbc = cookieFb(meta.fbc) || cookieFb(req.cookies?._fbc) || fbcDoClique(user);
    const ip = String(req.ip || "").replace(/^::ffff:/, "");
    const ua = String(req.get?.("user-agent") || "").slice(0, 500);
    const pessoa = papel === "vendedor";
    const userData = {
      ...dadosCorrespondencia({
        email: corpo.email, telefone: corpo.whats, pais: corpo.pais || "BR", userId,
        nome: pessoa ? corpo.nome : "", cidade: pessoa ? corpo.cidade : "", estado: pessoa ? corpo.estado : "",
        nascimento: pessoa ? corpo.dataNascimento : "", genero: pessoa ? corpo.genero : "",
      }),
      ...(ip && { client_ip_address: ip }),
      ...(ua && { client_user_agent: ua }),
      ...(fbp && { fbp }),
      ...(fbc && { fbc }),
    };
    const dados = { userData, url: `${urlApp()}/cadastro/${pessoa ? "profissional" : "empresa"}` };
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
    SELECT d.valor, c.moeda FROM deposit_requests d JOIN companies c ON c.id = d.companyId
    WHERE d.companyId = ? AND d.status = 'confirmado' ORDER BY COALESCE(d.confirmadoEm, d.criadoEm) LIMIT 1
  `).get(companyId);
}

let ocupado = false;

export async function rodadaQualidade(t = agora()) {
  if (ocupado || !capiAtiva()) return;
  ocupado = true;
  try {
    db.prepare("DELETE FROM meta_contatos WHERE criadoEm < ?").run(t - RETENCAO);
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

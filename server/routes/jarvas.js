import { Router } from "express";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { paraFala, frasesFixas } from "../../shared/jarvas.js";

// Voz do Jarvas (ElevenLabs).
//
// A chave fica só aqui (ELEVENLABS_API_KEY); a tela manda o texto e recebe o
// áudio. Sem chave, ou se o ElevenLabs falhar, a resposta diz `fallback` e a
// tela mostra a frase só na legenda: a conversa nunca trava por causa da voz.
//
// Economia de créditos (o ElevenLabs cobra por caractere):
// - a tela pede o áudio frase por frase (shared/jarvas.js, segmentosDeFala),
//   então as perguntas fixas são reaproveitadas em qualquer conversa;
// - cada frase gerada é gravada em disco, no volume da Railway: gerou uma
//   vez, nunca mais paga, nem depois de um deploy;
// - as frases fixas (frasesFixas, ~640 caracteres) são gravadas uma única vez
//   na subida do servidor, se ainda não estiverem no disco;
// - duas pessoas pedindo a mesma frase ao mesmo tempo geram um áudio só;
// - teto mensal de caracteres para a conta toda e teto diário por empresa.
//   Passou do teto, as frases já gravadas continuam tocando; a frase nova
//   aparece só na legenda (a tela nunca usa a voz robótica do navegador).
//
// Variáveis: ELEVENLABS_API_KEY; ELEVENLABS_VOICE_ID (sem ela, usa a primeira
// voz masculina em português da conta, ou uma voz padrão masculina);
// ELEVENLABS_MODELO (padrão eleven_multilingual_v2, a mais natural);
// JARVAS_VOZ_LIMITE_MES (caracteres por mês, padrão 25000);
// JARVAS_VOZ_LIMITE_DIA (caracteres por empresa por dia, padrão 3000);
// JARVAS_VOZ_DIR (pasta das gravações; padrão: voz-jarvas ao lado dos arquivos).

const router = Router();

const BASE = (process.env.NODE_ENV === "test" && process.env.ELEVENLABS_BASE_URL) || "https://api.elevenlabs.io";
const MODELO = process.env.ELEVENLABS_MODELO || "eleven_multilingual_v2";
const FORMATO = "mp3_44100_128";
// Voz padrão masculina e multilíngue ("Adam", da biblioteca padrão).
const VOZ_PADRAO = "pNInz6obpgDQGcFmaJgB";
const LIMITE_MES = Number(process.env.JARVAS_VOZ_LIMITE_MES) || 25000;
const LIMITE_DIA = Number(process.env.JARVAS_VOZ_LIMITE_DIA) || 3000;
const MAX_TEXTO = 700;
const MAX_MEMORIA = 300;

const PASTA = process.env.JARVAS_VOZ_DIR || join(
  process.env.ARQUIVOS_DIR || join(dirname(process.env.DB_PATH || join(dirname(fileURLToPath(import.meta.url)), "..", "data.db")), "arquivos"),
  "voz-jarvas",
);

const vozDisponivel = () => !!process.env.ELEVENLABS_API_KEY;

let vozEscolhida = null;
async function vozId() {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;
  if (vozEscolhida) return vozEscolhida;
  try {
    const r = await fetch(`${BASE}/v1/voices`, { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY }, signal: AbortSignal.timeout(8000) });
    const { voices = [] } = r.ok ? await r.json() : {};
    // O Jarvas é masculino: primeiro voz masculina em português, depois
    // qualquer voz masculina da conta.
    const pt = (v) => /portugu|brazil|brasil|pt-br/i.test(JSON.stringify(v.labels || {}) + (v.name || ""));
    const masculina = (v) => /\bmale\b|masculin/i.test(v.labels?.gender || "");
    const escolhida = voices.find((v) => pt(v) && masculina(v)) || voices.find((v) => masculina(v) && v.category !== "premade");
    vozEscolhida = escolhida?.voice_id || VOZ_PADRAO;
  } catch {
    vozEscolhida = VOZ_PADRAO;
  }
  return vozEscolhida;
}

// ---- gravações -------------------------------------------------------------

const memoria = new Map(); // chave → Buffer (LRU: Map mantém a ordem)
const gerando = new Map(); // chave → Promise<Buffer>

const arquivoDe = (chave) => join(PASTA, `${chave}.mp3`);

function lerGravacao(chave) {
  let audio = memoria.get(chave);
  if (!audio && existsSync(arquivoDe(chave))) {
    try { audio = readFileSync(arquivoDe(chave)); } catch { /* arquivo ilegível: gera de novo */ }
  }
  if (audio) {
    memoria.delete(chave);
    memoria.set(chave, audio);
    if (memoria.size > MAX_MEMORIA) memoria.delete(memoria.keys().next().value);
  }
  return audio || null;
}

function gravar(chave, audio) {
  memoria.set(chave, audio);
  try {
    mkdirSync(PASTA, { recursive: true });
    const tmp = `${arquivoDe(chave)}.tmp`;
    writeFileSync(tmp, audio);
    renameSync(tmp, arquivoDe(chave));
  } catch (e) {
    console.warn("[jarvas] não gravou o áudio no disco:", e.message);
  }
}

// ---- tetos de gasto ------------------------------------------------------------

const arquivoUso = () => join(PASTA, "uso.json");
const mesAtual = () => new Date().toISOString().slice(0, 7);

function usoDoMes() {
  try {
    const u = JSON.parse(readFileSync(arquivoUso(), "utf8"));
    if (u.mes === mesAtual()) return u;
  } catch { /* primeiro uso do mês */ }
  return { mes: mesAtual(), caracteres: 0 };
}

function somarUsoDoMes(caracteres) {
  const u = usoDoMes();
  u.caracteres += caracteres;
  try { mkdirSync(PASTA, { recursive: true }); writeFileSync(arquivoUso(), JSON.stringify(u)); } catch { /* segue sem persistir */ }
}

const usoDia = new Map(); // empresa → { dia, caracteres }
function cabeNoDia(dono, caracteres) {
  const dia = new Date().toISOString().slice(0, 10);
  const atual = usoDia.get(dono);
  const usado = atual?.dia === dia ? atual.caracteres : 0;
  return usado + caracteres <= LIMITE_DIA;
}
function somarUsoDoDia(dono, caracteres) {
  const dia = new Date().toISOString().slice(0, 10);
  const atual = usoDia.get(dono);
  usoDia.set(dono, { dia, caracteres: (atual?.dia === dia ? atual.caracteres : 0) + caracteres });
}

class SemCredito extends Error {}

// Áudio de uma frase: da gravação, se houver; senão gera (uma vez só).
async function audioDe(texto, dono) {
  const voz = await vozId();
  const chave = createHash("sha256").update(`${voz}|${MODELO}|${FORMATO}|${texto}`).digest("hex");
  const pronto = lerGravacao(chave);
  if (pronto) return { audio: pronto, gravado: true };
  if (gerando.has(chave)) return { audio: await gerando.get(chave), gravado: true };

  if (usoDoMes().caracteres + texto.length > LIMITE_MES) throw new SemCredito("Limite mensal de voz atingido.");
  if (dono && !cabeNoDia(dono, texto.length)) throw new SemCredito("Limite diário de voz atingido.");

  const p = (async () => {
    const r = await fetch(`${BASE}/v1/text-to-speech/${encodeURIComponent(voz)}?output_format=${FORMATO}`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: texto,
        model_id: MODELO,
        // Menos estabilidade e um pouco de estilo: entonação mais viva, de conversa.
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed: 1.0 },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`ElevenLabs recusou (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`);
    const audio = Buffer.from(await r.arrayBuffer());
    somarUsoDoMes(texto.length);
    if (dono) somarUsoDoDia(dono, texto.length);
    gravar(chave, audio);
    return audio;
  })();
  gerando.set(chave, p);
  try { return { audio: await p, gravado: false }; } finally { gerando.delete(chave); }
}

// Grava as frases fixas que ainda não estão no disco. Roda na subida do
// servidor; depois da primeira vez, não gasta nada.
export async function aquecerVozJarvas() {
  if (!vozDisponivel()) return;
  let novas = 0, prontas = 0;
  for (const frase of frasesFixas()) {
    try {
      const r = await audioDe(paraFala(frase), null);
      if (r.gravado) prontas++; else novas++;
    } catch (e) {
      console.warn(`[jarvas] aquecimento parou: ${e.message}`);
      break;
    }
  }
  console.log(`[jarvas] voz: ${prontas} frases já gravadas, ${novas} novas · uso do mês ${usoDoMes().caracteres}/${LIMITE_MES} caracteres`);
}

// ---- rotas -------------------------------------------------------------------

router.get("/jarvas/voz", (req, res) => {
  // Disponível = há chave. O teto do mês vale frase a frase: as gravadas
  // continuam tocando mesmo com o teto atingido.
  res.json({ disponivel: vozDisponivel() });
});

router.post("/jarvas/voz", async (req, res) => {
  if (!["empresa", "admin"].includes(req.user.role)) return res.status(403).json({ error: "Apenas empresas" });
  const texto = paraFala(String(req.body?.texto || "")).slice(0, MAX_TEXTO);
  if (!texto) return res.status(400).json({ error: "Texto vazio." });
  if (!vozDisponivel()) return res.status(503).json({ error: "Voz humana não configurada.", fallback: true });

  try {
    const { audio, gravado } = await audioDe(texto, req.user.entityId || req.user.id);
    res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=604800", "X-Voz-Gravada": gravado ? "1" : "0" });
    res.send(audio);
  } catch (e) {
    if (e instanceof SemCredito) return res.status(429).json({ error: e.message, fallback: true });
    console.warn("[jarvas]", e.message);
    res.status(502).json({ error: "A voz não respondeu agora.", fallback: true });
  }
});

export default router;
